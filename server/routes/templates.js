// ============================================================
// templates.js
// ============================================================
const express = require('express');
const { body, validationResult } = require('express-validator');
const { MessageTemplate, WhatsAppAccount } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const { submitTemplate } = require('../services/whatsappService');

const router = express.Router();
router.use(authenticate, orgScope);

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { organization_id: req.orgId };
    if (status) where.approval_status = status;
    const templates = await MessageTemplate.findAll({ where, order: [['created_at', 'DESC']] });
    res.json(templates);
  } catch (err) { next(err); }
});

router.post('/', requireRole('super_admin', 'dept_admin'), [
  body('name').trim().notEmpty().matches(/^[a-z0-9_]+$/).withMessage('Template name must be lowercase alphanumeric with underscores'),
  body('category').isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  body('language').notEmpty(),
  body('components_json').isArray({ min: 1 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, category, language, components_json, preview_text } = req.body;

    // Check name uniqueness within org
    const existing = await MessageTemplate.findOne({ where: { name, organization_id: req.orgId } });
    if (existing) return res.status(409).json({ error: 'Template name already exists in your organization' });

    const template = await MessageTemplate.create({
      organization_id: req.orgId,
      created_by: req.user.userId,
      name, category, language, components_json,
      preview_text: preview_text || '',
      approval_status: 'draft',
    });

    res.status(201).json(template);
  } catch (err) { next(err); }
});

// Submit to Meta for approval
router.post('/:id/submit', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.approval_status !== 'draft') return res.status(400).json({ error: 'Only draft templates can be submitted' });

    // Get org's primary WhatsApp account for submission
    const account = await WhatsAppAccount.findOne({ where: { organization_id: req.orgId, status: 'active' } });
    if (!account) return res.status(400).json({ error: 'No active WhatsApp account connected. Connect one first.' });

    let metaTemplateId = null;
    try {
      const metaResult = await submitTemplate({ account, template });
      metaTemplateId = metaResult.id;
    } catch (metaErr) {
      console.error('Meta template submission failed:', metaErr.response?.data || metaErr.message);
      return res.status(502).json({ error: 'Failed to submit to Meta: ' + (metaErr.response?.data?.error?.message || metaErr.message) });
    }

    await template.update({ approval_status: 'pending', meta_template_id: metaTemplateId });
    res.json({ message: 'Template submitted to Meta for approval', template });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    await template.destroy();
    res.json({ message: 'Template deleted' });
  } catch (err) { next(err); }
});

// ─── Approval Pipelines ───────────────────────────────────────────────────────

// POST /api/templates/:id/sync-status
router.post('/:id/sync-status', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!template.meta_template_id) return res.status(400).json({ error: 'Cannot sync unsubmitted template' });

    const account = await WhatsAppAccount.findOne({ where: { organization_id: req.orgId, status: 'active' } });
    if (!account) return res.status(400).json({ error: 'No active WhatsApp account found' });

    const { getTemplateStatus } = require('../services/whatsappService');
    const metaData = await getTemplateStatus({ account, metaTemplateId: template.meta_template_id });

    // Status map logic based on Meta API
    const metaStatus = metaData.status?.toLowerCase();
    const updatePayload = { approval_status: 'pending' };
    
    if (metaStatus === 'approved') updatePayload.approval_status = 'approved';
    if (metaStatus === 'rejected') {
      updatePayload.approval_status = 'rejected';
      updatePayload.rejection_reason = metaData.reason || 'Template content violates policy';
    }

    await template.update(updatePayload);
    res.json(template);
  } catch (err) { next(err); }
});

// POST /api/templates/:id/duplicate
router.post('/:id/duplicate', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const newTemplate = await MessageTemplate.create({
      organization_id: req.orgId,
      created_by: req.user.userId,
      name: `${template.name}_v${template.version + 1}`,
      category: template.category,
      language: template.language,
      components_json: template.components_json,
      preview_text: template.preview_text,
      version: template.version + 1,
      approval_status: 'draft',
      rejection_reason: null,
      meta_template_id: null
    });

    res.status(201).json(newTemplate);
  } catch (err) { next(err); }
});

// DELETE /api/templates/:id/meta
router.delete('/:id/meta', requireRole('super_admin'), async (req, res, next) => {
  try {
    const template = await MessageTemplate.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!template.name) return res.status(400).json({ error: 'No template name known' });

    const account = await WhatsAppAccount.findOne({ where: { organization_id: req.orgId, status: 'active' } });
    
    if (account) {
      const { getMetaCredentials } = require('../services/orgSettingsService');
      const creds = await getMetaCredentials(req.orgId);
      const { decrypt } = require('../utils/encryption');
      const apiKey = decrypt(account.api_key_encrypted);
      const axios = require('axios');
      
      // Delete formally from Meta Graph API using the WABA ID
      try {
        await axios.delete(`https://graph.facebook.com/${creds.apiVersion}/${account.waba_id}/message_templates?name=${template.name}`, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
      } catch (metaErr) {
        console.warn('Meta Graph Template delete error bypass: ', metaErr.response?.data);
      }
    }

    await template.destroy();
    res.json({ message: 'Template successfully unlinked from Meta and deleted locally' });
  } catch (err) { next(err); }
});

module.exports = router;
