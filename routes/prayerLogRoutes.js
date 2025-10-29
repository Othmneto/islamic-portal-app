const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');

// ✅ SECURITY FIX: Use session-based auth middleware for consistent security
const { attachUser } = require('../middleware/authMiddleware');

const PrayerLog = require('../models/PrayerLog');
const User = require('../models/User');

// --- Protect all routes in this file ---
// ✅ SECURITY FIX: Use session-based auth middleware for consistent security
router.use((req, res, next) => {
  console.log('🕌 [PrayerLog] Auth middleware check:', {
    path: req.path,
    hasUser: !!req.user,
    userId: req.user?.id || req.user?._id,
    sessionId: req.sessionID
  });
  next();
});
router.use(attachUser);

/**
 * @route   POST /api/prayer-log
 * @desc    Log a completed prayer for the authenticated user.
 * @access  Private
 */
router.post('/', async (req, res, next) => {
  const { prayerName, date } = req.body;
  const userId = req.user.id || req.user._id;

  console.log('🕌 Prayer logging request:', { prayerName, date, userId, userKeys: Object.keys(req.user || {}) });

  if (!prayerName || !['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(prayerName)) {
    return res.status(400).json({ error: 'A valid prayer name is required.' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ error: "A valid 'date' in 'YYYY-MM-DD' format is required." });
  }

  try {
    const user = await User.findById(userId);
    const timezone = user?.timezone || 'UTC';
    const prayerDate = moment.tz(date, 'YYYY-MM-DD', timezone).startOf('day').toDate();

    console.log('🕌 Prayer logging details:', {
      userTimezone: timezone,
      inputDate: date,
      prayerDate: prayerDate.toISOString(),
      userId
    });

    const prayerLogEntry = await PrayerLog.findOneAndUpdate(
      { userId, prayerName, prayerDate },
      { $set: { status: 'prayed', completedAt: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );

    console.log('🕌 Prayer logged successfully:', prayerLogEntry);
    res.status(201).json(prayerLogEntry);
  } catch (error) {
    console.error('Error logging prayer:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'This prayer has already been logged for this date.' });
    }
    next(error);
  }
});

/**
 * @route   GET /api/prayer-log/today
 * @desc    Get all prayers logged by the user for today.
 * @access  Private
 */
router.get('/today', async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  try {
    const user = await User.findById(userId);
    const timezone = user?.timezone || 'UTC';
    const todayStart = moment.tz(timezone).startOf('day').toDate();
    const todayEnd   = moment.tz(timezone).endOf('day').toDate();

    console.log('🕌 Fetching today\'s prayers:', {
      userId,
      timezone,
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString()
    });

    const todaysLogs = await PrayerLog.find({
      userId,
      prayerDate: { $gte: todayStart, $lte: todayEnd },
      status: 'prayed',
    });

    console.log('🕌 Found prayer logs:', todaysLogs);

    const prayedToday = todaysLogs.map(log => log.prayerName);
    console.log('🕌 Today\'s prayed prayers:', prayedToday);

    res.json(prayedToday);
  } catch (error) {
    console.error("Error fetching today's prayer logs:", error);
    next(error);
  }
});

/**
 * @route   GET /api/prayer-log/month
 * @desc    Get all prayers logged by the user for a specific month.
 * @access  Private
 */
router.get('/month', async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
    return res.status(400).json({ error: "A valid month in 'YYYY-MM' format is required." });
  }
  try {
    const user = await User.findById(userId);
    const timezone = user?.timezone || 'UTC';
    const startOfMonth = moment.tz(month, 'YYYY-MM', timezone).startOf('month').toDate();
    const endOfMonth   = moment.tz(month, 'YYYY-MM', timezone).endOf('month').toDate();
    const monthlyLogs = await PrayerLog.find({
      userId,
      prayerDate: { $gte: startOfMonth, $lte: endOfMonth },
      status: 'prayed',
    });
    const logsByDate = monthlyLogs.reduce((acc, log) => {
      const dateKey = moment(log.prayerDate).tz(timezone).format('YYYY-MM-DD');
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(log.prayerName);
      return acc;
    }, {});
    res.json(logsByDate);
  } catch (error) {
    console.error('Error fetching monthly prayer logs:', error);
    next(error);
  }
});

/**
 * @route   GET /api/prayer-log/stats
 * @desc    Get prayer statistics for the authenticated user
 * @access  Private
 * @query   days - Number of days to analyze (default: 30)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const days = parseInt(req.query.days) || 30;
    const user = await User.findById(userId).select('timezone').lean();
    const tz = user?.timezone || 'UTC';

    // Calculate date range
    const endDate = moment().tz(tz).format('YYYY-MM-DD');
    const startDate = moment().tz(tz).subtract(days, 'days').format('YYYY-MM-DD');

    // Get all prayer logs in the date range
    const logs = await PrayerLog.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    // Build statistics
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const prayerStats = {};
    const totalPossible = days * prayers.length;
    let totalCompleted = 0;
    let currentStreak = 0;
    let longestStreak = 0;

    // Per-prayer statistics
    prayers.forEach(prayer => {
      const completed = logs.filter(log => log.prayers.includes(prayer)).length;
      totalCompleted += completed;
      prayerStats[prayer] = {
        completed,
        total: days,
        percentage: Math.round((completed / days) * 100)
      };
    });

    // Calculate streaks (consecutive days with all 5 prayers)
    const dayMap = {};
    logs.forEach(log => {
      if (!dayMap[log.date]) dayMap[log.date] = [];
      dayMap[log.date].push(...log.prayers);
    });

    let tempStreak = 0;
    for (let i = 0; i < days; i++) {
      const checkDate = moment().tz(tz).subtract(i, 'days').format('YYYY-MM-DD');
      const dayPrayers = dayMap[checkDate] || [];
      const allPrayersCompleted = prayers.every(p => dayPrayers.includes(p));
      
      if (allPrayersCompleted) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak; // Only count current streak if it includes today
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (i === 0) currentStreak = 0; // Today not complete, so current streak is 0
        tempStreak = 0;
      }
    }

    // Best day (most prayers completed)
    let bestDay = null;
    let bestDayCount = 0;
    Object.keys(dayMap).forEach(date => {
      const uniquePrayers = [...new Set(dayMap[date])];
      if (uniquePrayers.length > bestDayCount) {
        bestDayCount = uniquePrayers.length;
        bestDay = { date, count: uniquePrayers.length };
      }
    });

    res.json({
      success: true,
      stats: {
        period: {
          startDate,
          endDate,
          days
        },
        overall: {
          totalCompleted,
          totalPossible,
          completionRate: Math.round((totalCompleted / totalPossible) * 100)
        },
        perPrayer: prayerStats,
        streaks: {
          current: currentStreak,
          longest: longestStreak
        },
        bestDay,
        recentLogs: logs.slice(-7) // Last 7 log entries
      }
    });
  } catch (error) {
    console.error('Error fetching prayer statistics:', error);
    next(error);
  }
});

module.exports = router;