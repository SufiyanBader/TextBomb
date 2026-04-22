require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Master Environment Check
const requiredEnvVars = ['ENCRYPTION_KEY', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('================================================================');
  console.error('❌ FATAL ERROR: MISSING REQUIRED ENVIRONMENT VARIABLES! ❌');
  console.error('The following variables must be set in your Railway / .env config:');
  console.error(missingVars.join(', '));
  console.error('================================================================');
  process.exit(1);
}

const { sequelize } = require('./models');
const { connectRedis } = require('./services/redisService');
const { initQueues } = require('./jobs/campaignQueue');
const { startCronJobs } = require('./jobs/cronJobs');

// Route imports
const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/organizations');
const departmentRoutes = require('./routes/departments');
const userRoutes = require('./routes/users');
const whatsappAccountRoutes = require('./routes/whatsappAccounts');
const templateRoutes = require('./routes/templates');
const contactRoutes = require('./routes/contacts');
const campaignRoutes = require('./routes/campaigns');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const webhookRoutes = require('./routes/webhooks');
const numberPoolRoutes = require('./routes/numberPool');
const orgSettingsRoutes = require('./routes/orgSettings');
const conversationRoutes = require('./routes/conversations');

const app = express();
const PORT = process.env.PORT || 5000;

// Hide framework details and trust proxy headers when behind a reverse proxy.
app.disable('x-powered-by');
app.set('trust proxy', true);

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// Auth-specific stricter rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// ─── Body Parsers ─────────────────────────────────────────────────────────────
// Webhooks need raw body for signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/whatsapp-accounts', whatsappAccountRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/number-pool', numberPoolRoutes);
app.use('/api/org-settings', orgSettingsRoutes);
app.use('/api/conversations', conversationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../client/build')));

// Catch-all handler: send back index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Connect to PostgreSQL
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected');

    // Sync models safely. Avoid automatic schema alteration in normal runs,
    // because it can fail against existing databases with inconsistent constraints.
    const syncOptions = {
      alter: process.env.NODE_ENV === 'development' && process.env.DB_SYNC_ALTER === 'true',
    };
    await sequelize.sync(syncOptions);
    console.log('✅ Database synced');

    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');

    // Initialize Bull.js queues
    initQueues();
    console.log('✅ Job queues initialized');

    // Start cron jobs
    startCronJobs();
    console.log('✅ Cron jobs started');

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 TextBomb server running on port ${PORT}`);
      console.log(`📱 WhatsApp Business Messaging Platform`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the conflicting process or change PORT.`);
      } else {
        console.error('❌ Server listen error:', err);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
