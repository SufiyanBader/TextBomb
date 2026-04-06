const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Organization, AuditLog } = require('../models');
const { storeRefreshToken, getRefreshToken, deleteRefreshToken } = require('../services/redisService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function issueTokens(userId, orgId, role) {
  const payload = { userId, orgId, role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });
  return { accessToken, refreshToken };
}

async function logAudit(orgId, userId, action, req) {
  try {
    await AuditLog.create({
      organization_id: orgId,
      user_id: userId,
      action,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  } catch (e) { /* non-fatal */ }
}

// ─── POST /auth/signup ────────────────────────────────────────────────────────
router.post('/signup', [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Your name is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { companyName, email, password, name, domain } = req.body;

    // Check email uniqueness
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create org + super admin in a transaction
    const result = await require('../models').sequelize.transaction(async (t) => {
      const org = await Organization.create({
        name: companyName,
        domain: domain || null,
      }, { transaction: t });

      const user = await User.create({
        organization_id: org.id,
        name,
        email,
        password_hash,
        role: 'super_admin',
        status: 'active',
      }, { transaction: t });

      return { org, user };
    });

    const { accessToken, refreshToken } = issueTokens(result.user.id, result.org.id, 'super_admin');
    await storeRefreshToken(result.user.id, refreshToken);
    await logAudit(result.org.id, result.user.id, 'signup', req);

    res.status(201).json({
      message: 'Organization created successfully',
      accessToken,
      refreshToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [{ model: Organization, attributes: ['id', 'name', 'status', 'subscription_plan'] }],
    });

    // Consistent timing to prevent user enumeration
    const dummyHash = '$2a$12$dummy.hash.for.timing.consistency.only.padding';
    const valid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    if (user.Organization.status !== 'active') {
      return res.status(403).json({ error: 'Organization is suspended' });
    }

    const { accessToken, refreshToken } = issueTokens(user.id, user.organization_id, user.role);
    await storeRefreshToken(user.id, refreshToken);
    await user.update({ last_login_at: new Date() });
    await logAudit(user.organization_id, user.id, 'login', req);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
      },
      organization: {
        id: user.Organization.id,
        name: user.Organization.name,
        subscription_plan: user.Organization.subscription_plan,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const storedToken = await getRefreshToken(decoded.userId);

    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = issueTokens(decoded.userId, decoded.orgId, decoded.role);
    await storeRefreshToken(decoded.userId, newRefreshToken);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  await deleteRefreshToken(req.user.userId);
  res.json({ message: 'Logged out successfully' });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.user.userId },
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Organization, attributes: ['id', 'name', 'status', 'subscription_plan', 'domain'] }],
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
