const { OrgSettings } = require('../models');
const { decrypt } = require('../utils/encryption');

async function getMetaCredentials(orgId) {
  if (!orgId) {
    return {
      appId: process.env.META_APP_ID,
      appSecret: process.env.META_APP_SECRET,
      apiVersion: process.env.META_GRAPH_API_VERSION || 'v18.0',
      webhookToken: process.env.META_WEBHOOK_VERIFY_TOKEN
    };
  }

  const settings = await OrgSettings.findOne({ where: { organization_id: orgId } });
  
  return {
    appId: settings?.meta_app_id || process.env.META_APP_ID,
    appSecret: settings?.meta_app_secret_encrypted 
      ? decrypt(settings.meta_app_secret_encrypted) 
      : process.env.META_APP_SECRET,
    apiVersion: settings?.meta_graph_api_version || process.env.META_GRAPH_API_VERSION || 'v18.0',
    webhookToken: settings?.meta_webhook_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN
  };
}

// Function to find the correct webhook token by brute-forcing active org overrides. 
// Used natively when Meta setup pings GET /webhooks without an org_id
async function findMatchingWebhookToken(token) {
  // First check global
  if (token === process.env.META_WEBHOOK_VERIFY_TOKEN) return true;
  
  // Checking all overrides 
  const match = await OrgSettings.findOne({ where: { meta_webhook_verify_token: token } });
  return !!match;
}

module.exports = {
  getMetaCredentials,
  findMatchingWebhookToken
};
