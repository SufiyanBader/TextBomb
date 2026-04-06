const express = require('express');
const crypto = require('crypto');
const { CampaignJob, Contact, TrackingEvent } = require('../models');
const { parseWebhookPayload, verifyWebhook } = require('../services/whatsappService');
const { createNotification } = require('../services/notificationService');

const router = express.Router();

// GET /webhooks/whatsapp — Meta webhook verification
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const result = verifyWebhook(mode, token, challenge);
  if (result) return res.status(200).send(result);
  res.sendStatus(403);
});

// POST /webhooks/whatsapp — Incoming Meta events
router.post('/whatsapp', async (req, res) => {
  // Acknowledge immediately — Meta requires fast response
  res.sendStatus(200);

  try {
    // Verify HMAC signature
    const sig = req.headers['x-hub-signature-256'];
    if (sig && process.env.META_APP_SECRET) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(req.body)
        .digest('hex');
      if (sig !== expected) {
        console.warn('⚠️  Webhook signature mismatch — ignoring');
        return;
      }
    }

    const body = JSON.parse(req.body.toString());
    const events = parseWebhookPayload(body);

    for (const event of events) {
      await handleWebhookEvent(event);
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

      // Log opt-out event for any recent campaign
      const recentJob = await CampaignJob.findOne({
        where: { contact_id: contact.id },
        order: [['sent_at', 'DESC']],
      });
      if (recentJob) {
        await TrackingEvent.create({
          campaign_id: recentJob.campaign_id,
          contact_id: contact.id,
          event_type: 'opted_out',
          metadata: { trigger: 'STOP keyword', message: event.text },
        });
      }
      return;
    }

    // Log reply event
    const recentJob = await CampaignJob.findOne({
      where: { contact_id: contact.id },
      order: [['sent_at', 'DESC']],
    });
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
