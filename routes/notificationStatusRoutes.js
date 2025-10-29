const express = require('express');
const router = express.Router();
const { attachUser: authMiddleware } = require('../middleware/authMiddleware');
const NotificationHistory = require('../models/NotificationHistory');
const { getScheduleStatus } = require('../tasks/prayerNotificationScheduler');

// GET /api/notification-status/current
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const schedule = await getScheduleStatus(userId);

    if (schedule) {
      res.json({ success: true, schedule });
    } else {
      res.status(404).json({ success: false, message: 'Schedule not found or user has no location/timezone.' });
    }
  } catch (error) {
    console.error('[NotificationStatus] Error fetching current status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/notification-status/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    console.log('[NotificationStatus] Fetching history for user:', req.user.id);

    const history = await NotificationHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log('[NotificationStatus] Found', history.length, 'history entries');

    res.json({ success: true, history });
  } catch (error) {
    console.error('[NotificationStatus] Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/notification-status/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log('[NotificationStatus] Fetching stats for user:', req.user.id, 'since:', twentyFourHoursAgo);

    const stats = await NotificationHistory.aggregate([
      { $match: { userId: req.user.id, createdAt: { $gte: twentyFourHoursAgo } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('[NotificationStatus] Stats aggregation result:', stats);

    const statsObj = {
      sent: 0,
      failed: 0,
      total: 0
    };

    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });

    console.log('[NotificationStatus] Final stats object:', statsObj);

    res.json({ success: true, stats: statsObj });
  } catch (error) {
    console.error('[NotificationStatus] Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
