const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { WhatsAppAccount, Department, User, AuditLog, sequelize } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { getPhoneNumberInfo } = require('../services/whatsappService');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate, orgScope);

// ─── Helper: strip api_key from response ─────────────────────────────────────
function safeAccount(acc) {
  const obj = acc.toJSON ? acc.toJSON() : { ...acc };
  delete obj.api_key_encrypted;
  return obj;
}

async function logAudit(orgId, userId, action, entityId, req) {
  try {
    await AuditLog.create({
      organization_id: orgId, user_id: userId,
      action, entity_type: 'whatsapp_account', entity_id: entityId,
      ip_address: req.ip, user_agent: req.headers['user-agent'],
    });
  } catch (e) { /* non-fatal */ }
}

// ─── GET /number-pool ─────────────────────────────────────────────────────────
router.get('/', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { filter } = req.query; // all | assigned | unassigned
    const where = { organization_id: req.orgId, is_pooled: true };
    if (filter === 'assigned') where[Op.and] = [{ assigned_department_ids: { [Op.ne]: '{}' } }];
    if (filter === 'unassigned') where.assigned_department_ids = '{}';

    const accounts = await WhatsAppAccount.findAll({
      where,
      attributes: { exclude: ['api_key_encrypted'] },
      order: [['created_at', 'DESC']],
    });

    // Attach department names
    const depts = await Department.findAll({ where: { organization_id: req.orgId }, attributes: ['id', 'name'] });
    const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]));

    const result = accounts.map(acc => ({
      ...safeAccount(acc),
      assigned_departments: (acc.assigned_department_ids || []).map(id => ({ id, name: deptMap[id] || 'Unknown' })),
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// ─── POST /number-pool/add ────────────────────────────────────────────────────
router.post('/add', requireRole('super_admin'), [
  body('phone_number_id').trim().notEmpty(),
  body('api_key').trim().notEmpty(),
  body('display_name').trim().notEmpty(),
  body('bsp').isIn(['meta_direct', 'twilio', '360dialog', 'gupshup']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { phone_number_id, api_key, display_name, bsp, waba_id, notes,
            monthly_limit = 10000, department_ids = [] } = req.body;

    // Duplicate check
    const existing = await WhatsAppAccount.findOne({ where: { phone_number_id, organization_id: req.orgId } });
    if (existing) return res.status(409).json({ error: 'This phone number ID is already in your pool' });

    const account = await WhatsAppAccount.create({
      organization_id: req.orgId,
      phone_number_id,
      display_name,
      bsp,
      waba_id: waba_id || null,
      api_key_encrypted: encrypt(api_key),
      notes: notes || null,
      monthly_limit,
      is_pooled: true,
      added_by: req.user.userId,
      status: 'active',
      assigned_department_ids: department_ids,
    });

    // Try to fetch real phone number from Meta
    try {
      const info = await getPhoneNumberInfo({ account: { ...account.toJSON(), api_key_encrypted: encrypt(api_key) } });
      await account.update({ phone_number: info.display_phone_number, quality_rating: info.quality_rating || 'UNKNOWN' });
    } catch (metaErr) {
      console.warn('Meta validation skipped:', metaErr.message);
    }

    // Notify dept admins if assigned immediately
    if (department_ids.length > 0) {
      const deptAdmins = await User.findAll({
        where: { organization_id: req.orgId, department_id: { [Op.in]: department_ids }, role: 'dept_admin', status: 'active' },
      });
      for (const admin of deptAdmins) {
        await createNotification({
          userId: admin.id, orgId: req.orgId, type: 'number_assigned',
          title: 'WhatsApp Number Assigned',
          message: `"${display_name}" is now available for your team.`,
          metadata: { accountId: account.id },
        });
      }
    }

    await logAudit(req.orgId, req.user.userId, `Added number to pool: ${display_name}`, account.id, req);
    res.status(201).json(safeAccount(account));
  } catch (err) { next(err); }
});

// ─── PUT /number-pool/:id ─────────────────────────────────────────────────────
router.put('/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const account = await WhatsAppAccount.findOne({ where: { id: req.params.id, organization_id: req.orgId, is_pooled: true } });
    if (!account) return res.status(404).json({ error: 'Number not found in pool' });

    const { display_name, notes, monthly_limit, status } = req.body;
    await account.update({ display_name, notes, monthly_limit, status });
    res.json(safeAccount(account));
  } catch (err) { next(err); }
});

// ─── DELETE /number-pool/:id ──────────────────────────────────────────────────
router.delete('/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const account = await WhatsAppAccount.findOne({ where: { id: req.params.id, organization_id: req.orgId, is_pooled: true } });
    if (!account) return res.status(404).json({ error: 'Number not found in pool' });

    const { Campaign } = require('../models');
    const activeCampaigns = await Campaign.count({
      where: { whatsapp_account_id: account.id, status: { [Op.in]: ['sending', 'scheduled'] } },
    });
    if (activeCampaigns > 0) return res.status(400).json({ error: `Cannot remove — ${activeCampaigns} active campaign(s) using this number` });

    await logAudit(req.orgId, req.user.userId, `Removed number from pool: ${account.display_name}`, account.id, req);
    await account.destroy();
    res.json({ message: 'Number removed from pool' });
  } catch (err) { next(err); }
});

// ─── POST /number-pool/:id/rotate-key ────────────────────────────────────────
router.post('/:id/rotate-key', requireRole('super_admin'), [
  body('new_api_key').trim().notEmpty(),
], async (req, res, next) => {
  try {
    const account = await WhatsAppAccount.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!account) return res.status(404).json({ error: 'Number not found' });
    await account.update({ api_key_encrypted: encrypt(req.body.new_api_key) });
    await logAudit(req.orgId, req.user.userId, `Rotated API key for: ${account.display_name}`, account.id, req);
    res.json({ message: 'API key rotated successfully' });
  } catch (err) { next(err); }
});

// ─── GET /number-pool/:id/stats ───────────────────────────────────────────────
router.get('/:id/stats', requireRole('super_admin'), async (req, res, next) => {
  try {
    const account = await WhatsAppAccount.findOne({
      where: { id: req.params.id, organization_id: req.orgId },
      attributes: { exclude: ['api_key_encrypted'] },
    });
    if (!account) return res.status(404).json({ error: 'Number not found' });

    const { Campaign, CampaignJob, TrackingEvent } = require('../models');
    const campaigns = await Campaign.findAll({ where: { whatsapp_account_id: account.id }, attributes: ['id'] });
    const campIds = campaigns.map(c => c.id);

    const [totalSent, totalDelivered, totalFailed] = await Promise.all([
      campIds.length ? TrackingEvent.count({ where: { campaign_id: { [Op.in]: campIds }, event_type: 'sent' } }) : 0,
      campIds.length ? TrackingEvent.count({ where: { campaign_id: { [Op.in]: campIds }, event_type: 'delivered' } }) : 0,
      campIds.length ? TrackingEvent.count({ where: { campaign_id: { [Op.in]: campIds }, event_type: 'failed' } }) : 0,
    ]);

    res.json({
      account: safeAccount(account),
      total_campaigns: campaigns.length,
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_failed: totalFailed,
      delivery_rate: totalSent > 0 ? parseFloat(((totalDelivered / totalSent) * 100).toFixed(1)) : 0,
    });
  } catch (err) { next(err); }
});

// ─── POST /number-pool/assign ─────────────────────────────────────────────────
router.post('/assign', requireRole('super_admin'), [
  body('whatsapp_account_id').isUUID(),
  body('department_id').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { whatsapp_account_id, department_id, notes } = req.body;

    const [account, dept] = await Promise.all([
      WhatsAppAccount.findOne({ where: { id: whatsapp_account_id, organization_id: req.orgId } }),
      Department.findOne({ where: { id: department_id, organization_id: req.orgId } }),
    ]);

    if (!account) return res.status(404).json({ error: 'WhatsApp account not found' });
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const current = account.assigned_department_ids || [];
    if (current.includes(department_id)) return res.status(409).json({ error: 'Already assigned to this department' });

    await account.update({ assigned_department_ids: [...current, department_id] });

    // Log assignment
    const { NumberAssignment } = require('../models');
    await NumberAssignment.create({
      organization_id: req.orgId, whatsapp_account_id, department_id,
      assigned_by: req.user.userId, notes: notes || null,
    });

    // Notify dept admins
    const deptAdmins = await User.findAll({
      where: { organization_id: req.orgId, department_id, role: 'dept_admin', status: 'active' },
    });
    for (const admin of deptAdmins) {
      await createNotification({
        userId: admin.id, orgId: req.orgId, type: 'number_assigned',
        title: 'WhatsApp Number Assigned to Your Team',
        message: `"${account.display_name}" (${account.phone_number || account.phone_number_id}) is now available for your team.`,
        metadata: { accountId: account.id },
      });
    }

    await logAudit(req.orgId, req.user.userId, `Assigned "${account.display_name}" to dept "${dept.name}"`, account.id, req);
    res.json({ message: 'Number assigned successfully', account: safeAccount(account) });
  } catch (err) { next(err); }
});

// ─── DELETE /number-pool/assign ───────────────────────────────────────────────
router.delete('/assign', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { whatsapp_account_id, department_id } = req.body;
    const account = await WhatsAppAccount.findOne({ where: { id: whatsapp_account_id, organization_id: req.orgId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const updated = (account.assigned_department_ids || []).filter(id => id !== department_id);
    await account.update({ assigned_department_ids: updated });

    // Close assignment record
    const { NumberAssignment } = require('../models');
    await NumberAssignment.update(
      { unassigned_by: req.user.userId, unassigned_at: new Date() },
      { where: { whatsapp_account_id, department_id, unassigned_at: null } }
    );

    await logAudit(req.orgId, req.user.userId, `Removed assignment from dept`, account.id, req);
    res.json({ message: 'Assignment removed' });
  } catch (err) { next(err); }
});

// ─── GET /number-pool/:id/assignments ─────────────────────────────────────────
router.get('/:id/assignments', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { NumberAssignment } = require('../models');
    const history = await NumberAssignment.findAll({
      where: { whatsapp_account_id: req.params.id, organization_id: req.orgId },
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: User, as: 'assigner', attributes: ['id', 'name'] },
      ],
      order: [['assigned_at', 'DESC']],
    });
    res.json(history);
  } catch (err) { next(err); }
});

// ─── GET /number-pool/department/:deptId ──────────────────────────────────────
// Used by campaign builder to get numbers available to a department
router.get('/department/:deptId', authenticate, orgScope, async (req, res, next) => {
  try {
    const { deptId } = req.params;
    const { role, orgId } = req.user;

    // Dept admins/members can only query their own dept
    if (role !== 'super_admin' && req.user.deptId !== deptId) {
      return res.status(403).json({ error: 'You can only view numbers for your own department' });
    }

    let accounts;
    if (role === 'super_admin') {
      accounts = await WhatsAppAccount.findAll({
        where: { organization_id: orgId, status: 'active' },
        attributes: { exclude: ['api_key_encrypted'] },
      });
    } else {
      // Only show numbers assigned to this department
      accounts = await WhatsAppAccount.findAll({
        where: {
          organization_id: orgId,
          status: 'active',
          assigned_department_ids: { [Op.contains]: [deptId] },
        },
        attributes: { exclude: ['api_key_encrypted'] },
      });
    }

    res.json(accounts);
  } catch (err) { next(err); }
});

module.exports = router;
