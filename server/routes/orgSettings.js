const express = require('express');
const axios = require('axios');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const { OrgSettings } = require('../models');
const { encrypt } = require('../utils/encryption');
const { getMetaCredentials } = require('../services/orgSettingsService');

const router = express.Router();
router.use(authenticate, orgScope);

// GET /api/org-settings - Super Admin strictly
router.get('/', requireRole('super_admin'), async (req, res, next) => {
  try {
    let settings = await OrgSettings.findOne({ where: { organization_id: req.orgId } });
    if (!settings) {
      settings = await OrgSettings.create({ organization_id: req.orgId });
    }
    
    // Convert to strict JSON block and mask encrypted strings
    const output = settings.toJSON();
    output.meta_app_secret_set = !!output.meta_app_secret_encrypted;
    delete output.meta_app_secret_encrypted;
    
    res.json(output);
  } catch (err) { next(err); }
});

// PUT /api/org-settings
router.put('/', requireRole('super_admin'), async (req, res, next) => {
  try {
    // Basic body params allowed
    const { 
      meta_app_id, meta_app_secret, meta_webhook_verify_token, meta_graph_api_version,
      default_batch_size, default_delay_min, default_delay_max, default_reply_to, spam_words,
      unsub_company, unsub_color, unsub_message, notify_on_completion, notify_on_failure, notify_threshold_pct
    } = req.body;
    
    let settings = await OrgSettings.findOne({ where: { organization_id: req.orgId } });
    if (!settings) settings = await OrgSettings.create({ organization_id: req.orgId });
    
    const updates = {
      meta_app_id,
      meta_webhook_verify_token,
      meta_graph_api_version,
      default_batch_size, default_delay_min, default_delay_max, default_reply_to, spam_words,
      unsub_company, unsub_color, unsub_message, notify_on_completion, notify_on_failure, notify_threshold_pct
    };
    
    if (meta_app_secret) updates.meta_app_secret_encrypted = encrypt(meta_app_secret);
    
    await settings.update(updates);
    
    const output = settings.toJSON();
    output.meta_app_secret_set = !!output.meta_app_secret_encrypted;
    delete output.meta_app_secret_encrypted;
    
    res.json(output);
  } catch (err) { next(err); }
});

// POST /api/org-settings/test-meta
router.post('/test-meta', requireRole('super_admin'), async (req, res, next) => {
  try {
    const creds = await getMetaCredentials(req.orgId);
    if (!creds.appId || !creds.appSecret) {
      return res.status(400).json({ error: 'Meta App ID and Secret must be configured first.' });
    }
    
    // Testing graph connection using App Access Token
    const appAccessToken = `${creds.appId}|${creds.appSecret}`;
    const url = `https://graph.facebook.com/${creds.apiVersion}/app?access_token=${appAccessToken}`;
    
    const response = await axios.get(url);
    if (response.data && response.data.id === creds.appId) {
      return res.json({ success: true, account_name: response.data.name || 'Meta Developer App' });
    }
    res.status(400).json({ error: 'Connection failed' });
  } catch (err) {
    const defaultMsg = 'Meta API connection refused';
    res.status(400).json({ error: err.response?.data?.error?.message || defaultMsg });
  }
});

// POST /api/org-settings/test-webhook
router.post('/test-webhook', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) return res.status(400).json({ error: 'Webhook URL required.' });
    
    const payload = [{ object: 'whatsapp_business_account', entry: [{ id: 'test_id', changes: [] }] }];
    await axios.post(webhook_url, payload, { timeout: 5000 });
    
    res.json({ success: true, message: 'Ping reached webhook URL successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to reach webhook URL: ' + err.message });
  }
});

module.exports = router;
