// tasks/prayerNotificationScheduler.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const adhan = require('adhan');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { notificationQueue } = require('../queues/notificationQueue');
const logger = require('../utils/logger');
const { env } = require('../config');

// Helper to calculate prayer times, now accepting madhab
const getPrayerTimesForLocation = (lat, lon, date = new Date(), method = 'MuslimWorldLeague', madhab = 'shafii') => {
  const coordinates = new adhan.Coordinates(parseFloat(lat), parseFloat(lon));
  // Default to MuslimWorldLeague if the method is invalid
  const params = adhan.CalculationMethod[method] ? adhan.CalculationMethod[method]() : adhan.CalculationMethod.MuslimWorldLeague();
  // Set the madhab based on user preference
  params.madhab = madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  
  const prayerTimes = new adhan.PrayerTimes(coordinates, date, params);
  
  return {
    fajr: prayerTimes.fajr,
    dhuhr: prayerTimes.dhuhr,
    asr: prayerTimes.asr,
    maghrib: prayerTimes.maghrib,
    isha: prayerTimes.isha,
  };
};

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
      const subscriptions = await PushSubscription.find({ userId: user._id });
      if (!subscriptions.length) continue;

      const today = new Date();
      
      // Use user's preferred method and madhab, or fall back to defaults
      const userMethod = user.preferences?.calculationMethod || 'MuslimWorldLeague';
      const userMadhab = user.preferences?.madhab || 'shafii';

      const prayerTimes = getPrayerTimesForLocation(
        user.location.lat,
        user.location.lon,
        today,
        userMethod,
        userMadhab
      );

      const reminders = user.notificationPreferences?.prayerReminders || {};
      let scheduledCount = 0;

      for (const prayerName in prayerTimes) {
        if (reminders[prayerName]) {
          const prayerTime = new Date(prayerTimes[prayerName]);

          if (prayerTime > new Date()) { // Only schedule future prayers
            const payload = {
              title: `🕌 ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} Prayer Time`,
              body: `It's time for the ${prayerName} prayer.`,
              tag: `prayer-${prayerName}`,
              requireInteraction: true, // Ensure notification is sticky
              data: { url: '/prayer-time.html' },
            };

            const delay = prayerTime.getTime() - Date.now();
            
            for (const sub of subscriptions) {
              await notificationQueue.add('send-push', { subscription: sub, payload }, { delay, removeOnComplete: true, removeOnFail: true });
            }
            scheduledCount++;
          }
        }
      }
      if (scheduledCount > 0) {
        logger.info(`Scheduled ${scheduledCount} prayer alerts for user ${user._id}`);
      }
    }
  } catch (error) {
    logger.error('Error in prayer notification scheduler:', error);
  }
}

const initializeScheduler = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info('✅ Prayer Scheduler connected to MongoDB.');

    // Run daily at midnight UTC
    cron.schedule('1 0 * * *', scheduleAllPrayerNotifications, { timezone: 'UTC' });

    // Also run every 6 hours to catch new users or changes
    cron.schedule('0 */6 * * *', scheduleAllPrayerNotifications);

    logger.info('⏰ Prayer notification scheduler started.');
    
    // Run once on startup after a delay to allow the server to be ready
    setTimeout(scheduleAllPrayerNotifications, 15000);

  } catch (error) {
    logger.error('❌ Failed to initialize prayer scheduler:', error);
    process.exit(1);
  }
};

// Start the scheduler if this file is run directly (e.g., by PM2)
if (require.main === module) {
  initializeScheduler();
}

module.exports = {
  initializeScheduler,
  scheduleAllPrayerNotifications,
  getPrayerTimesForLocation
};