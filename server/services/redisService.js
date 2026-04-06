const { createClient } = require('redis');

let client = null;

async function connectRedis() {
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  return client;
}

function getRedis() {
  if (!client) throw new Error('Redis not connected');
  return client;
}

// Store refresh token (7 days TTL)
async function storeRefreshToken(userId, token) {
  const redis = getRedis();
  await redis.setEx(`refresh:${userId}`, 7 * 24 * 60 * 60, token);
}

async function getRefreshToken(userId) {
  return getRedis().get(`refresh:${userId}`);
}

async function deleteRefreshToken(userId) {
  return getRedis().del(`refresh:${userId}`);
}

// Notification cache
async function cacheNotificationCount(userId, count) {
  return getRedis().setEx(`notif_count:${userId}`, 300, String(count));
}

async function getCachedNotificationCount(userId) {
  const val = await getRedis().get(`notif_count:${userId}`);
  return val ? parseInt(val) : null;
}

async function invalidateNotificationCount(userId) {
  return getRedis().del(`notif_count:${userId}`);
}

module.exports = {
  connectRedis,
  getRedis,
  storeRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  cacheNotificationCount,
  getCachedNotificationCount,
  invalidateNotificationCount,
};
