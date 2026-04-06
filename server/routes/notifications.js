const express = require('express');
const { Notification } = require('../models');
const { authenticate, orgScope } = require('../middleware/auth');
const { getCachedNotificationCount, cacheNotificationCount } = require('../services/redisService');

const router = express.Router();
router.use(authenticate, orgScope);

router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.userId },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json(notifications);
  } catch (err) { next(err); }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    let count = await getCachedNotificationCount(req.user.userId);
    if (count === null) {
      count = await Notification.count({ where: { user_id: req.user.userId, is_read: false } });
      await cacheNotificationCount(req.user.userId, count);
    }
    res.json({ count });
  } catch (err) { next(err); }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { id: req.params.id, user_id: req.user.userId } }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

router.put('/mark-all-read', async (req, res, next) => {
  try {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.userId } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

module.exports = router;
