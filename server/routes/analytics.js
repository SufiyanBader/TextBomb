const express = require('express');
const { sequelize, Campaign, TrackingEvent, CampaignJob, Contact, WhatsAppAccount } = require('../models');
const { authenticate, orgScope } = require('../middleware/auth');
const { QueryTypes, Op } = require('sequelize');

const router = express.Router();
router.use(authenticate, orgScope);

// GET /analytics/overview — Dashboard KPI cards
router.get('/overview', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const campaigns = await Campaign.findAll({
      where: { organization_id: req.orgId, created_at: { [Op.gte]: since } },
      attributes: ['id'],
    });
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return res.json({ sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, opted_out: 0,
        delivery_rate: 0, read_rate: 0, total_campaigns: 0 });
    }

    const counts = await TrackingEvent.findAll({
      where: { campaign_id: { [Op.in]: campaignIds } },
      attributes: ['event_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['event_type'],
      raw: true,
    });

    const stats = counts.reduce((acc, row) => {
      acc[row.event_type] = parseInt(row.count);
      return acc;
    }, { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, opted_out: 0 });

    stats.delivery_rate = stats.sent > 0 ? parseFloat(((stats.delivered / stats.sent) * 100).toFixed(1)) : 0;
    stats.read_rate = stats.delivered > 0 ? parseFloat(((stats.read / stats.delivered) * 100).toFixed(1)) : 0;
    stats.total_campaigns = campaignIds.length;

    res.json(stats);
  } catch (err) { next(err); }
});

// GET /analytics/campaigns/:id/funnel
router.get('/campaigns/:id/funnel', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const counts = await TrackingEvent.findAll({
      where: { campaign_id: campaign.id },
      attributes: ['event_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['event_type'],
      raw: true,
    });

    const map = counts.reduce((acc, r) => { acc[r.event_type] = parseInt(r.count); return acc; }, {});

    // Funnel stages
    const funnel = [
      { stage: 'Sent', count: map.sent || 0 },
      { stage: 'Delivered', count: map.delivered || 0 },
      { stage: 'Read', count: map.read || 0 },
      { stage: 'Replied', count: map.replied || 0 },
    ];

    res.json({ funnel, raw: map });
  } catch (err) { next(err); }
});

// GET /analytics/campaigns/:id/timeseries
router.get('/campaigns/:id/timeseries', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const rows = await sequelize.query(`
      SELECT
        DATE_TRUNC('hour', created_at) AS hour,
        event_type,
        COUNT(*) AS count
      FROM tracking_events
      WHERE campaign_id = :campaignId
        AND event_type IN ('sent', 'delivered', 'read')
      GROUP BY hour, event_type
      ORDER BY hour ASC
    `, {
      replacements: { campaignId: campaign.id },
      type: QueryTypes.SELECT,
    });

    // Reshape for recharts
    const grouped = {};
    for (const row of rows) {
      const key = row.hour;
      if (!grouped[key]) grouped[key] = { time: key };
      grouped[key][row.event_type] = parseInt(row.count);
    }

    res.json(Object.values(grouped));
  } catch (err) { next(err); }
});

// GET /analytics/campaigns/:id/failures
router.get('/campaigns/:id/failures', async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const failures = await CampaignJob.findAll({
      where: { campaign_id: campaign.id, status: 'failed' },
      include: [{ model: Contact, attributes: ['phone_number', 'first_name', 'last_name'] }],
      order: [['updated_at', 'DESC']],
      limit: 200,
    });

    res.json(failures);
  } catch (err) { next(err); }
});

// GET /analytics/accounts — Per-account performance
router.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await WhatsAppAccount.findAll({
      where: { organization_id: req.orgId },
      attributes: { exclude: ['api_key_encrypted'] },
    });
    res.json(accounts);
  } catch (err) { next(err); }
});

module.exports = router;
