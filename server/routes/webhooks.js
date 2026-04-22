const express = require('express');
const crypto = require('crypto');
const { CampaignJob, Contact, TrackingEvent } = require('../models');
const { parseWebhookPayload, verifyWebhook } = require('../services/whatsappService');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

// GET /webhooks/whatsapp — Meta webhook verification
router.get('/whatsapp', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const result = await verifyWebhook(mode, token, challenge);
  if (result) return res.status(200).send(result);
  res.sendStatus(403);
});

// POST /webhooks/whatsapp — Incoming Meta events
router.post('/whatsapp', async (req, res) => {
  // Acknowledge immediately — Meta requires fast response
  res.sendStatus(200);

  try {
    const rawBody = req.body.toString();
    const body = JSON.parse(rawBody);
    
    // Attempt dynamic token extraction by finding a matching org account
    const { getMetaCredentials } = require('../services/orgSettingsService');
    const { WhatsAppAccount } = require('../models');
    
    let metaAppSecret = process.env.META_APP_SECRET;
    
    // Dig into payload to find phone_number_id uniformly mapped by Meta inside metadata
    const phoneNumId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    let orgId = null;
    let accountInfo = null;

    if (phoneNumId) {
      accountInfo = await WhatsAppAccount.findOne({ where: { phone_number_id: phoneNumId } });
      if (accountInfo) {
        orgId = accountInfo.organization_id;
        const creds = await getMetaCredentials(orgId);
        metaAppSecret = creds.appSecret;
      }
    }

    // Verify HMAC signature
    const sig = req.headers['x-hub-signature-256'];
    if (sig && metaAppSecret) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', metaAppSecret)
        .update(rawBody)
        .digest('hex');
      if (sig !== expected) {
        console.warn('⚠️  Webhook signature mismatch — ignoring');
        return;
      }
    }

    const events = parseWebhookPayload(body);

    for (const event of events) {
      // Pass along the resolved account and org ID dynamically to the event handler
      await handleWebhookEvent({ ...event, resolvedOrgId: orgId, resolvedAccountId: accountInfo?.id });
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

async function handleWebhookEvent(event) {
  if (event.type === 'status_update') {
    // Find the campaign job by meta_message_id
    const job = await CampaignJob.findOne({ where: { meta_message_id: event.messageId } });
    if (!job) return;

    const statusMap = { delivered: 'delivered', read: 'read', failed: 'failed', sent: 'sent' };
    const newStatus = statusMap[event.status];
    if (!newStatus) return;

    const updates = { status: newStatus };
    if (event.status === 'delivered') updates.delivered_at = event.timestamp;
    if (event.status === 'read') updates.read_at = event.timestamp;
    if (event.status === 'failed') updates.fail_reason = event.errors?.[0]?.message || 'Unknown error';

    await job.update(updates);

    await TrackingEvent.create({
      campaign_id: job.campaign_id,
      contact_id: job.contact_id,
      meta_message_id: event.messageId,
      event_type: newStatus,
      metadata: { errors: event.errors },
    });

    // High bounce rate alert: check if >10% of campaign failed
    if (event.status === 'failed') {
      const [total, failed] = await Promise.all([
        CampaignJob.count({ where: { campaign_id: job.campaign_id } }),
        CampaignJob.count({ where: { campaign_id: job.campaign_id, status: 'failed' } }),
      ]);
      if (total > 50 && (failed / total) > 0.1) {
        const campaign = await require('../models').Campaign.findByPk(job.campaign_id);
        if (campaign) {
          await createNotification({
            userId: campaign.created_by,
            orgId: campaign.organization_id,
            type: 'high_failure_rate',
            title: 'High Failure Rate Alert',
            message: `Campaign "${campaign.name}" has a ${((failed / total) * 100).toFixed(0)}% failure rate.`,
            metadata: { campaignId: campaign.id, failureRate: (failed / total) },
          });
        }
      }
    }
  }

  if (event.type === 'incoming_message') {
    // Find contact by phone number
    const contact = await Contact.findOne({ where: { phone_number: `+${event.from}` } });
    if (!contact) return;

    // Auto opt-out on STOP keyword
    if (event.isOptOut) {
      await Contact.update(
        {
          is_suppressed: true,
          opt_in_status: false,
          opted_out_at: event.timestamp,
          suppression_reason: 'User replied STOP',
        },
        { where: { phone_number: `+${event.from}`, organization_id: contact.organization_id } }
      );
    }

    // Log opt-out event for any recent campaign
    const recentJob = await CampaignJob.findOne({
      where: { contact_id: contact.id },
      order: [['sent_at', 'DESC']],
    });
    if (event.isOptOut && recentJob) {
      await TrackingEvent.create({
        campaign_id: recentJob.campaign_id,
        contact_id: contact.id,
        event_type: 'opted_out',
        metadata: { trigger: 'STOP keyword', message: event.text },
      });
    }

    // ─── UPSERT CONVERSATION & MESSAGE INBOX ENGINE ─────────────────────────
    const { Conversation, Message } = require('../models');

    // 1. Upsert conversation
    let conv = await Conversation.findOne({
      where: { contact_id: contact.id, organization_id: contact.organization_id }
    });

    if (!conv) {
      conv = await Conversation.create({
        organization_id: contact.organization_id,
        department_id: contact.department_id,
        contact_id: contact.id,
        campaign_id: recentJob ? recentJob.campaign_id : null,
        whatsapp_account_id: event.resolvedAccountId,
        status: 'open',
        last_message_at: event.timestamp,
        unread_count: 1
      });
    } else {
      await conv.update({
        status: conv.status === 'resolved' ? 'open' : conv.status,
        last_message_at: event.timestamp,
        whatsapp_account_id: event.resolvedAccountId, 
        unread_count: conv.unread_count + 1
      });
    }

    // 2. Create inbound message record
    await Message.create({
      conversation_id: conv.id,
      organization_id: conv.organization_id,
      contact_id: contact.id,
      direction: 'inbound',
      content: event.text,
      meta_message_id: event.messageId,
      status: 'delivered', // Incoming is implicitly delivered
      sent_at: event.timestamp
    });

    // We can skip duplicate 'replied' TrackingEvents if the user is opting out, 
    // but standard replies pass through below
    if (event.isOptOut) return;

    if (recentJob) {
      await TrackingEvent.create({
        campaign_id: recentJob.campaign_id,
        contact_id: contact.id,
        event_type: 'replied',
        metadata: { message: event.text },
      });
    }
  }
}

module.exports = router;
