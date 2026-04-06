// organizations.js
const express = require('express');
const { Organization } = require('../models');
const { authenticate, requireRole, orgScope } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate, orgScope);

router.get('/', async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.orgId, { attributes: { exclude: ['meta_access_token_encrypted'] } });
    res.json(org);
  } catch (err) { next(err); }
});

router.put('/update', requireRole('super_admin'), async (req, res, next) => {
  try {
    const { name, domain } = req.body;
    const org = await Organization.findByPk(req.orgId);
    await org.update({ name, domain });
    res.json(org);
  } catch (err) { next(err); }
});

module.exports = router;
