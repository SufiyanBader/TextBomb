const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate, orgScope);

router.get('/', async (req, res, next) => {
  try {
    const where = { organization_id: req.orgId };
    if (req.user.role === 'dept_admin') where.department_id = req.user.deptId;
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']],
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/add', requireRole('super_admin', 'dept_admin'), [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().notEmpty(),
  body('role').isIn(['dept_admin', 'member']),
  body('password').isLength({ min: 8 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, name, role, password, department_id } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    // Dept admin can only add members to their own dept
    const deptId = req.user.role === 'dept_admin' ? req.user.deptId : (department_id || null);
    const userRole = req.user.role === 'dept_admin' ? 'member' : role;

    const user = await User.create({
      organization_id: req.orgId,
      department_id: deptId,
      name, email,
      password_hash: await bcrypt.hash(password, 12),
      role: userRole,
    });

    const { password_hash, ...safe } = user.toJSON();
    res.status(201).json(safe);
  } catch (err) { next(err); }
});

router.put('/:id/role', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['dept_admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot change super admin role' });
    await user.update({ role });
    res.json({ message: 'Role updated', user: { id: user.id, role } });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
    const user = await User.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ status: 'inactive' });
    res.json({ message: 'User deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;
