const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');

// ✅ SECURITY FIX: Use JWT-based auth middleware for consistent security
const authMiddleware = require('../middleware/auth');

const PrayerLog = require('../models/PrayerLog');
const User = require('../models/User');

// --- Protect all routes in this file ---
// ✅ SECURITY FIX: Use JWT-based auth middleware for consistent security
router.use(authMiddleware);

/**
 * @route   POST /api/prayer-log
 * @desc    Log a completed prayer for the authenticated user.
 * @access  Private
 */
router.post('/', async (req, res, next) => {
  const { prayerName, date } = req.body;
  const userId = req.user.id;

  console.log('🕌 Prayer logging request:', { prayerName, date, userId });

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
  const userId = req.user.id;
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
  const userId = req.user.id;
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

module.exports = router;