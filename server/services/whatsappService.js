const axios = require('axios');
const { decrypt } = require('../utils/encryption');

const GRAPH_API_BASE = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || 'v18.0'}`;

/**
 * Build axios instance for a WhatsApp account.
 * Decrypts stored API key and dynamically respects Org API versions before each call.
 */
async function buildClient(account) {
  const { getMetaCredentials } = require('./orgSettingsService');
  const creds = await getMetaCredentials(account.organization_id);
  const apiKey = decrypt(account.api_key_encrypted);
  return axios.create({
    baseURL: `https://graph.facebook.com/${creds.apiVersion}`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * Send a template message to a single recipient.
 * @param {Object} account - WhatsAppAccount model instance
 * @param {string} to - E.164 phone number e.g. +14155238886
 * @param {string} templateName - Meta-approved template name
 * @param {string} languageCode - e.g. 'en_US'
 * @param {Array} components - Template variable components
 */
async function sendTemplateMessage({ account, to, templateName, languageCode = 'en_US', components = [] }) {
  const client = await buildClient(account);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to.replace(/\s+/g, ''), // Clean phone number
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 && { components }),
    },
  };

  const response = await client.post(`/${account.phone_number_id}/messages`, payload);
  return response.data; // { messages: [{ id: 'wamid.xxx' }] }
}

/**
 * Submit a template to Meta for approval.
 */
async function submitTemplate({ account, template }) {
  const client = await buildClient(account);

  const payload = {
    name: template.name,
    category: template.category,
    language: template.language,
    components: template.components_json,
  };

  const response = await client.post(`/${account.waba_id}/message_templates`, payload);
  return response.data; // { id: 'meta_template_id', status: 'PENDING' }
}

/**
 * Fetch template approval status from Meta.
 */
async function getTemplateStatus({ account, metaTemplateId }) {
  const client = await buildClient(account);
  const response = await client.get(`/${metaTemplateId}?fields=name,status,quality_score`);
  return response.data;
}

/**
 * Get phone number details and quality rating.
 */
async function getPhoneNumberInfo({ account }) {
  const client = await buildClient(account);
  const response = await client.get(`/${account.phone_number_id}?fields=display_phone_number,quality_rating,name_status`);
  return response.data;
}

/**
 * Verify webhook token dynamically.
 */
async function verifyWebhook(mode, token, challenge) {
  const { findMatchingWebhookToken } = require('./orgSettingsService');
  if (mode === 'subscribe' && await findMatchingWebhookToken(token)) {
    return challenge;
  }
  return null;
}

/**
 * Parse incoming Meta webhook payload.
 * Returns normalized event objects.
 */
function parseWebhookPayload(body) {
  const events = [];

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return events;

    // Message status updates (delivered, read, failed)
    if (value.statuses) {
      for (const status of value.statuses) {
        events.push({
          type: 'status_update',
          messageId: status.id,
          recipientPhone: status.recipient_id,
          status: status.status, // 'delivered' | 'read' | 'failed'
          timestamp: new Date(parseInt(status.timestamp) * 1000),
          errors: status.errors || [],
        });
      }
    }

    // Incoming messages (replies, opt-out keywords)
    if (value.messages) {
      for (const message of value.messages) {
        const text = message.text?.body || message.button?.text || '';
        events.push({
          type: 'incoming_message',
          messageId: message.id,
          from: message.from,
          text,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          isOptOut: /^(stop|unsubscribe|quit|cancel|optout|opt out|opt-out)$/i.test(text.trim()),
        });
      }
    }
  } catch (err) {
    console.error('Webhook parse error:', err);
  }

  return events;
}

module.exports = {
  sendTemplateMessage,
  submitTemplate,
  getTemplateStatus,
  getPhoneNumberInfo,
  verifyWebhook,
  parseWebhookPayload,
};
