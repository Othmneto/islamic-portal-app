// translator-backend/tasks/prayerNotificationScheduler.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { notificationQueue } = require('../queues/notificationQueue');
const { getPrayerTimes } = require('../services/prayerTimeService');
const logger = require('../utils/logger');
const { env } = require('../config');

const connectToDatabase = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info('Prayer Scheduler connected to MongoDB.');
  } catch (err) {
    logger.error('Prayer Scheduler failed to connect to MongoDB. Exiting.', { error: err.message });
    process.exit(1);
  }
};

/**
 * Schedules notifications for each enabled prayer for all eligible users.
 * Runs once daily (00:01 UTC). Each job is delayed to fire exactly at the prayer time.
 */
const scheduleDailyPrayerNotifications = async () => {
  logger.info('⏰ Starting daily prayer scheduling...');
  try {
    const nowUTC = moment.utc();

    // Find users with coords and at least one prayer enabled
    const users = await User.find({
      'location.lat': { $ne: null },
      'location.lon': { $ne: null },
      $or: [
        { 'notificationPreferences.prayerReminders.fajr': true },
        { 'notificationPreferences.prayerReminders.dhuhr': true },
        { 'notificationPreferences.prayerReminders.asr': true },
        { 'notificationPreferences.prayerReminders.maghrib': true },
        { 'notificationPreferences.prayerReminders.isha': true },
      ],
    })
      .select('location notificationPreferences')
      .lean();

    if (!users.length) {
      logger.info('No eligible users for today.');
      return;
    }

    let jobsScheduled = 0;

    for (const user of users) {
      const { lat, lon, timezone } = user.location || {};
      const tz = timezone || 'Africa/Cairo';

      // Compute today’s prayer times in the user’s timezone
      const prayerTimes = getPrayerTimes(lat, lon, nowUTC.toDate(), tz);

      // All this user's subscriptions
      const subs = await PushSubscription.find({ userId: user._id }).lean();
      if (!subs.length) continue;

      // For each enabled prayer -> schedule a job at the exact time
      for (const [prayerName, enabled] of Object.entries(
        user.notificationPreferences?.prayerReminders || {}
      )) {
        if (!enabled) continue;

        const pt = moment.tz(prayerTimes[prayerName], tz);
        const nowTz = moment.tz(tz);

        if (pt.isAfter(nowTz)) {
          const delay = Math.max(0, pt.diff(moment()));
          const payload = {
            title: `Time for ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)}`,
            body: `It's ${prayerName} time.`,
            icon: '/favicon.ico',
            data: { url: '/prayertimes.html' },
          };

          for (const subscription of subs) {
            await notificationQueue.add(
              'send-prayer-notification',
              { subscription, payload },
              {
                delay,
                removeOnComplete: true,
                removeOnFail: true,
                jobId: `${user._id}-${subscription._id}-${prayerName}-${nowUTC.format('YYYY-MM-DD')}`,
              }
            );
            jobsScheduled++;
          }
        }
      }
    }

    logger.info(`✅ Scheduled ${jobsScheduled} prayer notification job(s).`);
  } catch (error) {
    logger.error('Daily scheduling error', { errorMessage: error.message });
  }
};

const initialize = async () => {
  await connectToDatabase();

  // Every day at 00:01 UTC prepare that day’s schedule
  cron.schedule('1 0 * * *', scheduleDailyPrayerNotifications, { timezone: 'UTC' });

  logger.info('Prayer notification scheduler initialized (runs 00:01 UTC).');
};

initialize();
