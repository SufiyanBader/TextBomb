const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { Contact, ContactList } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, orgScope);

// Multer: memory storage, whitelist only xlsx/csv
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv, .xlsx, .xls files are allowed'));
    }
  },
});

// ─── GET /contacts/lists ──────────────────────────────────────────────────────
router.get('/lists', async (req, res, next) => {
  try {
    const lists = await ContactList.findAll({
      where: { organization_id: req.orgId },
      order: [['created_at', 'DESC']],
    });
    res.json(lists);
  } catch (err) { next(err); }
});

// ─── POST /contacts/lists/upload ──────────────────────────────────────────────
router.post('/lists/upload', requireRole('super_admin', 'dept_admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });

    let rows = [];
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const csvText = req.file.buffer.toString('utf8');
      const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      rows = result.data;
    } else {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty' });

    // Return preview of first 10 rows + detected columns for mapping UI
    res.json({
      preview: rows.slice(0, 10),
      columns: Object.keys(rows[0] || {}),
      total_rows: rows.length,
      // Temporary storage — client will submit mapping + full data
      raw_data: rows.slice(0, 5000), // Limit to 5000 per upload
    });
  } catch (err) { next(err); }
});

// ─── POST /contacts/lists/import ─────────────────────────────────────────────
// Client sends parsed rows + column mapping after user confirms
router.post('/lists/import', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const { list_name, rows, column_map } = req.body;
    // column_map: { phone: 'Phone Number', first_name: 'First Name', opt_in: 'Subscribed', ... }

    if (!list_name || !rows || !column_map?.phone) {
      return res.status(400).json({ error: 'list_name, rows, and column_map.phone are required' });
    }

    const list = await ContactList.create({
      organization_id: req.orgId,
      department_id: req.user.deptId,
      name: list_name,
      uploaded_by: req.user.userId,
    });

    const stats = { total: rows.length, valid: 0, invalid: 0, no_optin: 0, duplicates: 0 };
    const seen = new Set();
    const toInsert = [];

    for (const row of rows) {
      const rawPhone = String(row[column_map.phone] || '').trim();
      if (!rawPhone) { stats.invalid++; continue; }

      // Parse and validate phone (E.164 format)
      const parsed = parsePhoneNumberFromString(rawPhone, 'US'); // Default country hint
      if (!parsed || !parsed.isValid()) { stats.invalid++; continue; }
      const e164 = parsed.format('E.164');

      if (seen.has(e164)) { stats.duplicates++; continue; }
      seen.add(e164);

      // Check opt-in
      const optInRaw = column_map.opt_in ? String(row[column_map.opt_in] || '').toLowerCase() : '';
      const hasOptIn = ['true', 'yes', '1', 'y', 'opted in', 'subscribed'].includes(optInRaw);
      if (!hasOptIn) stats.no_optin++;

      const optInTimestampRaw = column_map.opt_in_timestamp ? row[column_map.opt_in_timestamp] : null;

      toInsert.push({
        list_id: list.id,
        organization_id: req.orgId,
        phone_number: e164,
        first_name: column_map.first_name ? row[column_map.first_name] || null : null,
        last_name: column_map.last_name ? row[column_map.last_name] || null : null,
        email: column_map.email ? row[column_map.email] || null : null,
        company: column_map.company ? row[column_map.company] || null : null,
        opt_in_status: hasOptIn,
        opt_in_source: 'import',
        opt_in_timestamp: optInTimestampRaw ? new Date(optInTimestampRaw) : (hasOptIn ? new Date() : null),
        custom_fields: {},
      });
      stats.valid++;
    }

    if (toInsert.length > 0) {
      await Contact.bulkCreate(toInsert, { ignoreDuplicates: true });
    }

    await list.update({
      record_count: stats.valid,
      valid_count: stats.valid,
      opted_in_count: toInsert.filter(c => c.opt_in_status).length,
    });

    res.status(201).json({ list, stats });
  } catch (err) { next(err); }
});

// ─── GET /contacts/lists/:id/contacts ─────────────────────────────────────────
router.get('/lists/:id/contacts', async (req, res, next) => {
  try {
    const list = await ContactList.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!list) return res.status(404).json({ error: 'List not found' });

    const { page = 1, limit = 50 } = req.query;
    const { rows, count } = await Contact.findAndCountAll({
      where: { list_id: list.id },
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ contacts: rows, total: count });
  } catch (err) { next(err); }
});

// ─── POST /contacts/suppress ─────────────────────────────────────────────────
router.post('/suppress', requireRole('super_admin', 'dept_admin'), [
  body('phone_number').notEmpty(),
  body('reason').notEmpty(),
], async (req, res, next) => {
  try {
    const { phone_number, reason } = req.body;
    const count = await Contact.update(
      { is_suppressed: true, suppression_reason: reason, opted_out_at: new Date(), opt_in_status: false },
      { where: { phone_number, organization_id: req.orgId } }
    );
    res.json({ suppressed: count[0], message: `Suppressed ${count[0]} contacts with this number` });
  } catch (err) { next(err); }
});

// ─── GET /contacts/suppression-list ──────────────────────────────────────────
router.get('/suppression-list', async (req, res, next) => {
  try {
    const contacts = await Contact.findAll({
      where: { organization_id: req.orgId, is_suppressed: true },
      attributes: ['id', 'phone_number', 'first_name', 'suppression_reason', 'opted_out_at'],
      order: [['opted_out_at', 'DESC']],
      limit: 500,
    });
    res.json(contacts);
  } catch (err) { next(err); }
});

module.exports = router;
