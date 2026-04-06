const Bull = require('bull');
const { Campaign, CampaignJob, Contact, WhatsAppAccount, MessageTemplate, TrackingEvent } = require('../models');
const { sendTemplateMessage } = require('../services/whatsappService');
const { createNotification } = require('../services/notificationService');

let campaignQueue = null;

function initQueues() {
  campaignQueue = new Bull('campaign-send', {
    redis: process.env.REDIS_URL,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  campaignQueue.process('send-batch', 5, processBatch); // 5 concurrent workers

  campaignQueue.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  campaignQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
  });

  console.log('📨 Campaign queue initialized');
  return campaignQueue;
}

/**
 * Process a single message send job.
 * Each job = one message to one contact.
 */
async function processBatch(job) {
  const { campaignId, contactId, accountId, templateName, languageCode, components } = job.data;

  // Fetch contact with fresh suppression check
  const contact = await Contact.findOne({
    where: { id: contactId },
  });

  if (!contact) {
    await CampaignJob.update(
      { status: 'skipped', fail_reason: 'Contact not found' },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );
    return { skipped: true };
  }

  // Hard block: suppressed contacts never receive messages
  if (contact.is_suppressed) {
    await CampaignJob.update(
      { status: 'skipped', fail_reason: 'Contact is suppressed' },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );
    return { skipped: true };
  }

  // Hard block: no opt-in = no send
  if (!contact.opt_in_status) {
    await CampaignJob.update(
      { status: 'skipped', fail_reason: 'No opt-in recorded' },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );
    return { skipped: true };
  }

  const account = await WhatsAppAccount.findOne({
    where: { id: accountId, status: 'active' },
  });

  if (!account) {
    await CampaignJob.update(
      { status: 'failed', fail_reason: 'WhatsApp account not available' },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );
    return { failed: true };
  }

  // Check daily quota
  if (account.daily_sent_count >= account.daily_limit) {
    await CampaignJob.update(
      { status: 'failed', fail_reason: 'Daily quota exceeded' },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );
    return { failed: true };
  }

  // Personalize components with contact data
  const personalizedComponents = personalizeComponents(components, contact);

  try {
    const result = await sendTemplateMessage({
      account,
      to: contact.phone_number,
      templateName,
      languageCode,
      components: personalizedComponents,
    });

    const metaMessageId = result?.messages?.[0]?.id;

    // Update job status
    await CampaignJob.update(
      { status: 'sent', sent_at: new Date(), meta_message_id: metaMessageId },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );

    // Log tracking event
    await TrackingEvent.create({
      campaign_id: campaignId,
      contact_id: contactId,
      meta_message_id: metaMessageId,
      event_type: 'sent',
      metadata: { phone: contact.phone_number },
    });

    // Increment daily count
    await WhatsAppAccount.increment('daily_sent_count', { where: { id: accountId } });
    await Campaign.increment('sent_count', { where: { id: campaignId } });

    // Randomized delay: 500ms - 2000ms (compliance with Meta rate limits)
    const delay = Math.floor(Math.random() * 1500) + 500;
    await sleep(delay);

    return { success: true, messageId: metaMessageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;

    await CampaignJob.update(
      { status: 'failed', fail_reason: errorMsg },
      { where: { campaign_id: campaignId, contact_id: contactId } }
    );

    await TrackingEvent.create({
      campaign_id: campaignId,
      contact_id: contactId,
      event_type: 'failed',
      metadata: { error: errorMsg },
    });

    throw err; // Let Bull retry
  }
}

/**
 * Enqueue all jobs for a campaign.
 * Respects Meta's rate limits: max 80 msg/sec.
 * Batches into groups of 50 with delays between batches.
 */
async function enqueueCampaign(campaign, contacts, account, template) {
  if (!campaignQueue) throw new Error('Queue not initialized');

  const BATCH_SIZE = 50;
  const BATCH_DELAY_MS = 1000; // 1 second between batches of 50

  console.log(`📤 Enqueueing campaign ${campaign.id}: ${contacts.length} contacts`);

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE);
    const delay = batchNumber * BATCH_DELAY_MS;

    const jobs = batch.map((contact) => ({
      name: 'send-batch',
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        accountId: account.id,
        templateName: template.name,
        languageCode: template.language,
        components: buildComponents(template.components_json, campaign.template_variables),
      },
      opts: { delay, priority: 1 },
    }));

    await campaignQueue.addBulk(jobs);
  }

  console.log(`✅ Enqueued ${contacts.length} jobs for campaign ${campaign.id}`);
}

/**
 * Replace {{variable}} tokens in template components with contact field values.
 */
function personalizeComponents(components, contact) {
  const replacements = {
    '{{first_name}}': contact.first_name || '',
    '{{last_name}}': contact.last_name || '',
    '{{full_name}}': `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
    '{{company}}': contact.company || '',
    '{{phone}}': contact.phone_number || '',
    ...Object.entries(contact.custom_fields || {}).reduce((acc, [k, v]) => {
      acc[`{{${k}}}`] = String(v || '');
      return acc;
    }, {}),
  };

  return components.map((comp) => {
    if (comp.type === 'body' && comp.parameters) {
      return {
        ...comp,
        parameters: comp.parameters.map((param) => ({
          ...param,
          text: Object.entries(replacements).reduce(
            (text, [token, value]) => text.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'gi'), value),
            param.text || ''
          ),
        })),
      };
    }
    return comp;
  });
}

/**
 * Build template components array from stored template + campaign variables.
 */
function buildComponents(componentsJson, templateVariables = {}) {
  // This maps campaign-level variable values into the Meta components format
  const components = [];

  if (templateVariables.header) {
    components.push({
      type: 'header',
      parameters: [{ type: 'text', text: templateVariables.header }],
    });
  }

  if (templateVariables.body && Array.isArray(templateVariables.body)) {
    components.push({
      type: 'body',
      parameters: templateVariables.body.map((text) => ({ type: 'text', text })),
    });
  }

  return components;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getQueue() {
  return campaignQueue;
}

module.exports = { initQueues, enqueueCampaign, getQueue };
