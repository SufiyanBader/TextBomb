const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { Campaign, CampaignJob, Contact, ContactList, WhatsAppAccount, MessageTemplate, TrackingEvent } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const { enqueueCampaign } = require('../jobs/campaignQueue');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate, orgScope);

// ─── GET /campaigns ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const where = { organization_id: req.orgId };
    if (status) where.status = status;
    // Dept admins only see their dept campaigns
    if (req.user.role === 'dept_admin') where.department_id = req.user.deptId;

    const { rows, count } = await Campaign.findAndCountAll({
      where,
      include: [
        { model: MessageTemplate, attributes: ['id', 'name', 'category'] },
        { model: require('../models').User, as: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ campaigns: rows, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
  } catch (err) { next(err); }
});

// ─── GET /campaigns/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      where: { id: req.params.id, organization_id: req.orgId },
      include: [
        { model: MessageTemplate },
        { model: WhatsAppAccount, attributes: ['id', 'display_name', 'phone_number'] },
      ],
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) { next(err); }
});

// ─── POST /campaigns ──────────────────────────────────────────────────────────
router.post('/', requireRole('super_admin', 'dept_admin', 'member'), [
  body('name').trim().notEmpty(),
  body('template_id').isUUID(),
  body('list_ids').isArray({ min: 1 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, template_id, list_ids, whatsapp_account_id, scheduled_at, template_variables, use_round_robin } = req.body;

    // Verify template is approved
    const template = await MessageTemplate.findOne({
      where: { id: template_id, organization_id: req.orgId, approval_status: 'approved' },
    });
    if (!template) return res.status(400).json({ error: 'Template not found or not approved' });

    // Verify account belongs to org AND is accessible to this dept
    if (whatsapp_account_id) {
      const { Op } = require('sequelize');
      const { role, deptId } = req.user;
      let accountWhere = { id: whatsapp_account_id, organization_id: req.orgId };
      
      // Non-super-admins can only use numbers assigned to their dept
      if (role !== 'super_admin' && deptId) {
        accountWhere = {
          ...accountWhere,
          [Op.or]: [
            { is_pooled: false, department_id: deptId },
            { is_pooled: true, assigned_department_ids: { [Op.contains]: [deptId] } },
          ],
        };
      }
      const account = await WhatsAppAccount.findOne({ where: accountWhere });
      if (!account) return res.status(400).json({ error: 'WhatsApp account not found or not assigned to your department' });
    }

    // Count total recipients (opted-in, non-suppressed)
    const total = await Contact.count({
      where: {
        list_id: { [Op.in]: list_ids },
        organization_id: req.orgId,
        opt_in_status: true,
        is_suppressed: false,
      },
    });

    const campaign = await Campaign.create({
      organization_id: req.orgId,
      department_id: req.user.deptId,
      created_by: req.user.userId,
      name,
      template_id,
      list_ids,
      whatsapp_account_id: whatsapp_account_id || null,
      use_round_robin: use_round_robin || false,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      total_recipients: total,
      template_variables: template_variables || {},
    });

      res.status(201).json(campaign);
  } catch (err) { next(err); }
});

// ─── POST /campaigns/:id/launch ───────────────────────────────────────────────
router.post('/:id/launch', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      where: { id: req.params.id, organization_id: req.orgId },
      include: [{ model: MessageTemplate }],
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ error: `Cannot launch campaign with status: ${campaign.status}` });
    }

    await launchCampaign(campaign.id);
    res.json({ message: 'Campaign launched successfully', campaign_id: campaign.id });
  } catch (err) { next(err); }
});

// ─── POST /campaigns/:id/pause ────────────────────────────────────────────────
router.post('/:id/pause', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      where: { id: req.params.id, organization_id: req.orgId },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status !== 'sending') return res.status(400).json({ error: 'Campaign is not currently sending' });

    // Pause all pending Bull jobs for this campaign
    const { getQueue } = require('../jobs/campaignQueue');
    const queue = getQueue();
    const jobs = await queue.getJobs(['waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data.campaignId === campaign.id) await job.remove();
    }

    await campaign.update({ status: 'paused' });
    res.json({ message: 'Campaign paused' });
  } catch (err) { next(err); }
});

// ─── GET /campaigns/:id/stats ─────────────────────────────────────────────────
router.get('/:id/stats', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const [sent, delivered, read, replied, failed, opted_out] = await Promise.all([
      TrackingEvent.count({ where: { campaign_id: campaign.id, event_type: 'sent' } }),
      TrackingEvent.count({ where: { campaign_id: campaign.id, event_type: 'delivered' } }),
      TrackingEvent.count({ where: { campaign_id: campaign.id, event_type: 'read' } }),
      TrackingEvent.count({ where: { campaign_id: campaign.id, event_type: 'replied' } }),
      TrackingEvent.count({ where: { campaign_id: campaign.id, event_type: 'failed' } }),
      TrackingEvent.count({ where: { campaign_id: campaign.id, event_type: 'opted_out' } }),
    ]);

    const delivery_rate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0;
    const read_rate = delivered > 0 ? ((read / delivered) * 100).toFixed(1) : 0;
    const reply_rate = delivered > 0 ? ((replied / delivered) * 100).toFixed(1) : 0;
    const opt_out_rate = delivered > 0 ? ((opted_out / delivered) * 100).toFixed(1) : 0;

    res.json({
      campaign_id: campaign.id,
      total_recipients: campaign.total_recipients,
      sent, delivered, read, replied, failed, opted_out,
      delivery_rate: parseFloat(delivery_rate),
      read_rate: parseFloat(read_rate),
      reply_rate: parseFloat(reply_rate),
      opt_out_rate: parseFloat(opt_out_rate),
    });
  } catch (err) { next(err); }
});

// ─── Shared launch function (also called by cron) ─────────────────────────────
async function launchCampaign(campaignId) {
  const campaign = await Campaign.findOne({
    where: { id: campaignId },
    include: [{ model: MessageTemplate }],
  });

  if (!campaign || !['draft', 'scheduled'].includes(campaign.status)) return;

  // Get account (or pick first active one for round-robin)
  let account;
  if (campaign.use_round_robin) {
    account = await WhatsAppAccount.findOne({
      where: { organization_id: campaign.organization_id, status: 'active' },
      order: [['daily_sent_count', 'ASC']],
    });
  } else {
    account = await WhatsAppAccount.findOne({
      where: { id: campaign.whatsapp_account_id, status: 'active' },
    });
  }

  if (!account) throw new Error('No active WhatsApp account available');

  // Fetch contacts who haven't received a message from this campaign yet
  const { CampaignJob } = require('../models');
  const sentJobs = await CampaignJob.findAll({
    where: { campaign_id: campaignId, status: ['sent', 'delivered', 'read'] },
    attributes: ['contact_id']
  });
  const sentIds = sentJobs.map(j => j.contact_id);

  const contacts = await Contact.findAll({
    where: {
      id: { [Op.notIn]: sentIds },
      list_id: { [Op.in]: campaign.list_ids },
      organization_id: campaign.organization_id,
      opt_in_status: true,
      is_suppressed: false,
    },
  });

  if (contacts.length === 0) {
    if (sentIds.length > 0) {
      await campaign.update({ status: 'completed', completed_at: new Date() });
      return;
    }
    throw new Error('No eligible contacts found');
  }

  // Create campaign job records for new contacts
  const jobRecords = contacts.map((c) => ({
    campaign_id: campaign.id,
    contact_id: c.id,
    whatsapp_account_id: account.id,
    status: 'pending',
  }));
  await CampaignJob.bulkCreate(jobRecords, { ignoreDuplicates: true });

  await campaign.update({ status: 'sending', started_at: campaign.started_at || new Date() });

  // Enqueue to Bull
  await enqueueCampaign(campaign, contacts, account, campaign.MessageTemplate);

  console.log(`🚀 Campaign "${campaign.name}" ${sentIds.length > 0 ? 'resumed' : 'launched'}: ${contacts.length} contacts remaining`);
}

module.exports = router;
module.exports.launchCampaign = launchCampaign;
