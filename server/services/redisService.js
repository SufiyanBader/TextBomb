const { createClient } = require('redis');

let client = null;

async function connectRedis() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || process.env.REDISURL;
  if (!redisUrl) {
    console.error('================================================================');
    console.error('❌ FATAL ERROR: NO REDIS CONNECTION VARIABLES FOUND! ❌');
    console.error('If you are on Railway, you MUST add a Redis service and link it.');
    console.error('================================================================');
    throw new Error('MISSING_REDIS_VARIABLES - Cannot start server without Redis link.');
  }
  client = createClient({ url: redisUrl });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  return client;
}

function getRedis() {
  if (!client) throw new Error('Redis not connected');
  return client;
}

// Store refresh token (7 days TTL) - with 2s timeout safety
async function storeRefreshToken(userId, token) {
  try {
    const redis = getRedis();
    // We don't want Redis failure to block user login/signup entirely
    await Promise.race([
      redis.setEx(`refresh:${userId}`, 7 * 24 * 60 * 60, token),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000))
    ]);
  } catch (err) {
    console.error('Redis storeRefreshToken error:', err.message);
    // Non-fatal: user will just have to login again when access token expires
  }
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
