const cron = require('node-cron');
const { WhatsAppAccount, MessageTemplate, Campaign, CampaignJob } = require('../models');
const { Op } = require('sequelize');

function startCronJobs() {
  // Reset daily send counts at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Resetting daily send counts...');
    try {
      await WhatsAppAccount.update(
        { daily_sent_count: 0 },
        { where: { status: 'active' } }
      );
      console.log('✅ Daily send counts reset');
    } catch (err) {
      console.error('❌ Daily reset failed:', err);
    }
  }, { timezone: 'UTC' });

  // Check for scheduled campaigns every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const dueCampaigns = await Campaign.findAll({
        where: {
          status: 'scheduled',
          scheduled_at: { [Op.lte]: now },
        },
      });

      for (const campaign of dueCampaigns) {
        console.log(`📤 Launching scheduled campaign: ${campaign.name}`);
        // Dispatch to campaign controller
        const { launchCampaign } = require('../routes/campaigns');
        await launchCampaign(campaign.id);
      }
    } catch (err) {
      console.error('❌ Scheduled campaign check failed:', err);
    }
  });

  // Check for completed campaigns every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const sendingCampaigns = await Campaign.findAll({
        where: { status: 'sending' },
      });

      for (const campaign of sendingCampaigns) {
        const pendingJobs = await CampaignJob.count({
          where: { campaign_id: campaign.id, status: 'pending' },
        });

        if (pendingJobs === 0) {
          await campaign.update({ status: 'completed', completed_at: new Date() });
          console.log(`✅ Campaign ${campaign.name} marked as completed`);

          // Create completion notification
          const { createNotification } = require('../services/notificationService');
          await createNotification({
            userId: campaign.created_by,
            orgId: campaign.organization_id,
            type: 'campaign_completed',
            title: 'Campaign Completed',
            message: `Campaign "${campaign.name}" has finished sending.`,
            metadata: { campaignId: campaign.id },
          });
        }
      }
    } catch (err) {
      console.error('❌ Campaign completion check failed:', err);
    }
  });

  // Reset monthly sent counts on 1st of each month at midnight UTC
  cron.schedule('0 0 1 * *', async () => {
    try {
      await WhatsAppAccount.update({ monthly_sent_count: 0 }, { where: {} });
      console.log('✅ Monthly send counts reset');
    } catch (err) { console.error('❌ Monthly reset failed:', err); }
  }, { timezone: 'UTC' });

  console.log('⏰ Cron jobs scheduled');
}

module.exports = { startCronJobs };
