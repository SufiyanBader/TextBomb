const express = require('express');
const { body, validationResult } = require('express-validator');
const { Conversation, Message, Contact, User, WhatsAppAccount } = require('../models');
const { authenticate, orgScope } = require('../middleware/auth');
const axios = require('axios');
const { getMetaCredentials } = require('../services/orgSettingsService');

const router = express.Router();
router.use(authenticate, orgScope);

// GET /api/conversations
router.get('/', async (req, res, next) => {
  try {
    const { status, dept_id, search } = req.query;
    const where = { organization_id: req.orgId };
    
    if (status) where.status = status;
    
    // Dept admins and members only see their dept's conversations (unless unassigned but in pool?)
    // For simplicity, enforce org scope, and optionally filter by dept_id
    if (dept_id) where.department_id = dept_id;
    if (req.user.role !== 'super_admin' && req.user.department_id) {
      where.department_id = req.user.department_id;
    }

    const conversations = await Conversation.findAll({
      where,
      include: [
        { model: Contact, attributes: ['id', 'first_name', 'last_name', 'phone_number'] },
        { model: User, as: 'assignedTo', attributes: ['id', 'name'] }
      ],
      order: [['last_message_at', 'DESC']]
    });
    
    res.json(conversations);
  } catch (err) { next(err); }
});

// GET /api/conversations/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const where = { organization_id: req.orgId, status: 'open' };
    if (req.user.role !== 'super_admin' && req.user.department_id) {
      where.department_id = req.user.department_id;
    }
    
    // Calculate sum of unread_count across all relevant conversations
    const total = await Conversation.sum('unread_count', { where }) || 0;
    res.json({ unreadCount: total });
  } catch (err) { next(err); }
});

// GET /api/conversations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, organization_id: req.orgId },
      include: [
        { model: Contact, attributes: ['id', 'first_name', 'last_name', 'phone_number'] },
        { 
          model: Message, 
          include: [{ model: User, as: 'sender', attributes: ['name'] }]
        }
      ],
      order: [[Message, 'sent_at', 'ASC']]
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Mark as read natively
    if (conversation.unread_count > 0) {
      await conversation.update({ unread_count: 0 });
    }

    res.json(conversation);
  } catch (err) { next(err); }
});

// POST /api/conversations/:id/reply
router.post('/:id/reply', [
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res, next) => {
  try {
    const { message } = req.body;
    
    const conv = await Conversation.findOne({
      where: { id: req.params.id, organization_id: req.orgId },
      include: [Contact, WhatsAppAccount]
    });
    
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    
    const account = conv.WhatsAppAccount;
    if (!account) return res.status(400).json({ error: 'No associated WhatsApp account to reply from' });

    const creds = await getMetaCredentials(req.orgId);
    
    // Send standard text message using Meta Graph API natively
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: conv.Contact.phone_number.replace(/\D/g, ''),
      type: 'text',
      text: { body: message }
    };

    const { decrypt } = require('../utils/encryption');
    const apiKey = decrypt(account.api_key_encrypted);
    
    const response = await axios.post(
      `https://graph.facebook.com/${creds.apiVersion}/${account.phone_number_id}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    
    const metaMessageId = response.data?.messages?.[0]?.id;

    // Log internally
    const newMsg = await Message.create({
      conversation_id: conv.id,
      organization_id: conv.organization_id,
      contact_id: conv.contact_id,
      sent_by_user_id: req.user.userId,
      direction: 'outbound',
      content: message,
      meta_message_id: metaMessageId,
      status: 'sent',
      sent_at: new Date()
    });

    await conv.update({ last_message_at: new Date(), status: 'open' });

    res.json(newMsg);
  } catch (err) {
    console.error('Failed to reply:', err.response?.data || err.message);
    res.status(502).json({ error: 'Failed to send WhatsApp reply' });
  }
});

// PUT /api/conversations/:id/status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const conv = await Conversation.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    
    await conv.update({ status });
    res.json(conv);
  } catch (err) { next(err); }
});

// PUT /api/conversations/:id/assign
router.put('/:id/assign', async (req, res, next) => {
  try {
    const { user_id } = req.body;
    const conv = await Conversation.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    
    await conv.update({ assigned_to: user_id || null });
    res.json(conv);
  } catch (err) { next(err); }
});

module.exports = router;
