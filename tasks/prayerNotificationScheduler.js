// translator-backend/tasks/prayerNotificationScheduler.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const adhan = require('adhan');
const moment = require('moment-timezone'); // timezone + formatting
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { notificationQueue } = require('../queues/notificationQueue');
const logger = require('../utils/logger');
const { env } = require('../config');

/* ---------------------------------------------
   Helpers
----------------------------------------------*/

/** Resolve calculation params incl. 'auto' using timezone hints */
function resolveParams(method = 'MuslimWorldLeague', madhab = 'shafii', tz = 'UTC') {
  let m = method;
  let md = madhab;

  if (!adhan.CalculationMethod[m]) {
    // 'auto' or unknown → infer from timezone
    if (/Africa\/Cairo|Egypt/i.test(tz)) m = 'Egyptian';
    else if (/Asia\/Dubai|Dubai/i.test(tz)) m = 'Dubai';
    else if (/Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz)) m = 'Karachi';
    else if (/America\/|Canada|USA|US|CA/i.test(tz)) m = 'NorthAmerica';
    else m = 'MuslimWorldLeague';
  }

  if (md === 'auto' || (md !== 'hanafi' && md !== 'shafii')) {
    md = /Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz) ? 'hanafi' : 'shafii';
  }

  const params = adhan.CalculationMethod[m]?.() || adhan.CalculationMethod.MuslimWorldLeague();
  params.madhab = md === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  return params;
}

/**
 * Calculate prayer times for a location in a specific timezone
 * Returns JS Date objects (server timezone) for each prayer on the user's local date.
 */
const getPrayerTimesForLocation = (lat, lon, tz = 'UTC', method = 'MuslimWorldLeague', madhab = 'shafii') => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid coordinates');
  }

  // Anchor to the user's current date/time in their timezone
  const userDate = moment.tz(tz).toDate();

  const coordinates = new adhan.Coordinates(latitude, longitude);
  const params = resolveParams(method, madhab, tz);

  const pt = new adhan.PrayerTimes(coordinates, userDate, params);
  return {
    fajr: pt.fajr,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
};

/** Build a unique jobId per subscription/prayer/day to prevent duplicates */
function buildJobId(sub, prayerName, prayerTime, tz) {
  const dayKey = moment(prayerTime).tz(tz).format('YYYY-MM-DD');
  return `push-${sub._id}-${prayerName}-${dayKey}`;
}

/* ---------------------------------------------
   Core scheduling
----------------------------------------------*/

const scheduleAllPrayerNotifications = async () => {
  logger.info('Scheduler running: Looking for users with subscriptions...');
  try {
    const usersWithSubs = await PushSubscription.distinct('userId');
    const users = await User.find({
      _id: { $in: usersWithSubs },
      'location.lat': { $exists: true },
      'location.lon': { $exists: true },
    }).lean();

    logger.info(`Found ${users.length} user(s) with location and subscriptions to schedule.`);

    for (const user of users) {
      const subscriptions = await PushSubscription.find({ userId: user._id }).lean();
      if (!subscriptions.length) continue;

      // User-level preferences (with graceful defaults/auto)
      const userMethod = user.preferences?.calculationMethod || 'MuslimWorldLeague';
      const userMadhab = user.preferences?.madhab || 'shafii';

      let scheduledCount = 0;

      // Schedule per subscription so each device's timezone is respected
      for (const sub of subscriptions) {
        const tz = sub.tz || 'UTC';
        let prayerTimes;
        try {
          prayerTimes = getPrayerTimesForLocation(
            user.location.lat,
            user.location.lon,
            tz,
            userMethod,
            userMadhab
          );
        } catch (e) {
          logger.warn(`Skip scheduling for user ${user._id} sub ${sub._id}: ${e.message}`);
          continue;
        }

        const reminders = user.notificationPreferences?.prayerReminders || {};
        for (const prayerName of Object.keys(prayerTimes)) {
          if (!reminders[prayerName]) continue;

          const prayerTime = new Date(prayerTimes[prayerName]);
          const now = new Date();
          const delay = prayerTime.getTime() - now.getTime();
          if (delay <= 0) continue; // only future prayers

          const payload = {
            title: `🕌 ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} Prayer Time`,
            body: `It's time for the ${prayerName} prayer.`,
            tag: `prayer-${prayerName}-${moment(prayerTime).tz(tz).format('YYYY-MM-DD')}`, // sticky per day
            requireInteraction: true,
            data: { url: '/prayer-time.html' },
          };

          const jobId = buildJobId(sub, prayerName, prayerTime, tz);
          await notificationQueue.add(
            'send-push',
            { subscription: sub, payload },
            {
              delay,
              jobId, // de-dup per sub/prayer/day
              removeOnComplete: true,
              removeOnFail: true,
            }
          );
          scheduledCount++;
        }
      }

      if (scheduledCount > 0) {
        logger.info(`Scheduled ${scheduledCount} prayer alert(s) for user ${user._id}`);
      }
    }
  } catch (error) {
    logger.error('Error in prayer notification scheduler:', error);
  }
};

/* ---------------------------------------------
   Bootstrap
----------------------------------------------*/

const initializeScheduler = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info('✅ Prayer Scheduler connected to MongoDB.');

    // Run daily shortly after midnight UTC (schedules next day per-user TZ properly)
    cron.schedule('1 0 * * *', scheduleAllPrayerNotifications, { timezone: 'UTC' });

    // Also run every 6 hours to catch new users or preference changes
    cron.schedule('0 */6 * * *', scheduleAllPrayerNotifications);

    logger.info('⏰ Prayer notification scheduler started.');

    // Prime once on startup (allow server to warm up)
    setTimeout(scheduleAllPrayerNotifications, 15000);
  } catch (error) {
    logger.error('❌ Failed to initialize prayer scheduler:', error);
    process.exit(1);
  }
};

// Start if invoked directly
if (require.main === module) {
  initializeScheduler();
}

module.exports = {
  initializeScheduler,
  scheduleAllPrayerNotifications,
  getPrayerTimesForLocation,
};
