const { Notification } = require('../models');
const { invalidateNotificationCount } = require('./redisService');

async function createNotification({ userId, orgId, type, title, message, metadata = {} }) {
  try {
    const notification = await Notification.create({
      user_id: userId,
      organization_id: orgId,
      type,
      title,
      message,
      metadata,
    });
    await invalidateNotificationCount(userId);
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

async function getUnreadCount(userId) {
  return Notification.count({ where: { user_id: userId, is_read: false } });
}

module.exports = { createNotification, getUnreadCount };
