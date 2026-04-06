const express = require('express');
const { body, validationResult } = require('express-validator');
const { WhatsAppAccount } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const { encrypt } = require('../utils/encryption');
const { getPhoneNumberInfo } = require('../services/whatsappService');

const router = express.Router();
router.use(authenticate, orgScope);

// GET /whatsapp-accounts
// Super admins see all; dept admins/members only see numbers assigned to their dept
router.get('/', async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const { role, deptId } = req.user;
    let where = { organization_id: req.orgId };

    if (role !== 'super_admin' && deptId) {
      // Only show pooled numbers assigned to this department
      where = {
        ...where,
        [Op.or]: [
          { is_pooled: false, department_id: deptId },
          { is_pooled: true, assigned_department_ids: { [Op.contains]: [deptId] } },
        ],
      };
    } else if (role !== 'super_admin') {
      // No dept assigned — show nothing
      return res.json([]);
    }

    const accounts = await WhatsAppAccount.findAll({
      where,
      attributes: { exclude: ['api_key_encrypted'] },
      order: [['created_at', 'DESC']],
    });
    res.json(accounts);
  } catch (err) { next(err); }
});

// POST /whatsapp-accounts/connect
router.post('/connect', requireRole('super_admin', 'dept_admin'), [
  body('phone_number_id').trim().notEmpty(),
  body('api_key').trim().notEmpty(),
  body('display_name').trim().notEmpty(),
  body('bsp').isIn(['meta_direct', 'twilio', '360dialog', 'gupshup']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { phone_number_id, api_key, display_name, bsp, waba_id } = req.body;

    // Check for duplicates
    const existing = await WhatsAppAccount.findOne({
      where: { phone_number_id, organization_id: req.orgId },
    });
    if (existing) return res.status(409).json({ error: 'This phone number is already connected' });

    const account = await WhatsAppAccount.create({
      organization_id: req.orgId,
      phone_number_id,
      display_name,
      bsp,
      waba_id: waba_id || null,
      api_key_encrypted: encrypt(api_key),
      status: 'active',
    });

    // Try to fetch phone info from Meta to validate credentials
    try {
      const info = await getPhoneNumberInfo({ account: { ...account.toJSON(), api_key_encrypted: encrypt(api_key) } });
      await account.update({
        phone_number: info.display_phone_number,
        quality_rating: info.quality_rating || 'UNKNOWN',
      });
    } catch (metaErr) {
      console.warn('Could not fetch phone info from Meta (credentials may be invalid):', metaErr.message);
    }

    const { api_key_encrypted, ...safe } = account.toJSON();
    res.status(201).json(safe);
  } catch (err) { next(err); }
});

// PUT /whatsapp-accounts/:id/status
router.put('/:id/status', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const account = await WhatsAppAccount.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.update({ status });
    res.json({ message: 'Status updated', status });
  } catch (err) { next(err); }
});

// DELETE /whatsapp-accounts/:id
router.delete('/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const account = await WhatsAppAccount.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.destroy();
    res.json({ message: 'Account disconnected' });
  } catch (err) { next(err); }
});

module.exports = router;
