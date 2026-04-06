const jwt = require('jsonwebtoken');
const { User, Organization } = require('../models');

/**
 * Verifies JWT and attaches user context to request.
 * Every protected route must use this middleware.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (ensures role/status changes are respected)
    const user = await User.findOne({
      where: { id: decoded.userId, status: 'active' },
      include: [{ model: Organization, attributes: ['id', 'name', 'status', 'subscription_plan'] }],
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    if (user.Organization.status !== 'active') {
      return res.status(403).json({ error: 'Organization is suspended' });
    }

    // Attach to request — used by all downstream middleware and controllers
    req.user = {
      userId: user.id,
      orgId: user.organization_id,
      deptId: user.department_id,
      role: user.role,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
};

/**
 * Role-based access control middleware.
 * Usage: requireRole('super_admin', 'dept_admin')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
};

/**
 * Ensures all data queries are scoped to the authenticated user's organization.
 * Injects orgId filter into query params for controllers to use.
 */
const orgScope = (req, res, next) => {
  if (!req.user || !req.user.orgId) {
    return res.status(401).json({ error: 'Organization context missing' });
  }
  // Controllers must use req.orgId for all DB queries
  req.orgId = req.user.orgId;
  next();
};

module.exports = { authenticate, requireRole, orgScope };
