const express = require('express');
const { body, validationResult } = require('express-validator');
const { Department, User } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate, orgScope);

router.get('/', async (req, res, next) => {
  try {
    const departments = await Department.findAll({
      where: { organization_id: req.orgId },
      include: [{ model: User, attributes: ['id', 'name', 'email', 'role', 'status'] }],
    });
    res.json(departments);
  } catch (err) { next(err); }
});

router.post('/', requireRole('super_admin'), [body('name').trim().notEmpty()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const dept = await Department.create({ organization_id: req.orgId, name: req.body.name, created_by: req.user.userId });
    res.status(201).json(dept);
  } catch (err) { next(err); }
});

router.post('/:id/members', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ where: { id: userId, organization_id: req.orgId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ department_id: req.params.id });
    res.json({ message: 'Member added to department' });
  } catch (err) { next(err); }
});

router.delete('/:id/members/:userId', requireRole('super_admin', 'dept_admin'), async (req, res, next) => {
  try {
    const user = await User.findOne({ where: { id: req.params.userId, organization_id: req.orgId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ department_id: null });
    res.json({ message: 'Member removed from department' });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const dept = await Department.findOne({ where: { id: req.params.id, organization_id: req.orgId } });
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    await User.update({ department_id: null }, { where: { department_id: dept.id } });
    await dept.destroy();
    res.json({ message: 'Department deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
