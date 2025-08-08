// tasks/prayerNotificationScheduler.js
// Complete Prayer Notification Scheduler for Backend

const cron = require('node-cron');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const adhan = require('adhan');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { notificationQueue } = require('../queues/notificationQueue');
const logger = require('../utils/logger');
const { env } = require('../config');

// Database connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info('✅ Prayer Scheduler connected to MongoDB.');
  } catch (err) {
    logger.error('❌ Prayer Scheduler failed to connect to MongoDB.', { error: err.message });
    process.exit(1);
  }
};

/**
 * Get prayer times for a specific location
 */
const getPrayerTimesForLocation = (lat, lon, date = new Date(), method = 'MuslimWorldLeague') => {
  const coordinates = new adhan.Coordinates(parseFloat(lat), parseFloat(lon));
  let params = adhan.CalculationMethod[method]();
  params.madhab = adhan.Madhab.Shafi;
  
  const prayerTimes = new adhan.PrayerTimes(coordinates, date, params);
  
  return {
    fajr: prayerTimes.fajr,
    sunrise: prayerTimes.sunrise,
    dhuhr: prayerTimes.dhuhr,
    asr: prayerTimes.asr,
    maghrib: prayerTimes.maghrib,
    isha: prayerTimes.isha
  };
};

/**
 * Schedule a single prayer notification
 */
const schedulePrayerNotification = async (user, prayerName, prayerTime, subscriptions) => {
  const now = new Date();
  const delay = Math.max(0, prayerTime.getTime() - now.getTime());
  
  // Skip if prayer time has already passed
  if (delay <= 0) {
    logger.info(`⏭️ ${prayerName} prayer time has already passed for user ${user._id}`);
    return 0;
  }

  // Prepare notification payload
  const payload = {
    title: `🕌 ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} Prayer Time`,
    body: `It's time for ${prayerName} prayer. May Allah accept your prayers.`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `prayer-${prayerName}`,
    requireInteraction: true,
    data: { 
      url: '/prayertimes.html',
      prayerName: prayerName,
      timestamp: prayerTime.toISOString()
    }
  };

  let jobsQueued = 0;

  // Queue notification for each subscription
  for (const subscription of subscriptions) {
    try {
      await notificationQueue.add(
        'prayer-notification',
        { 
          subscription: {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          }, 
          payload,
          userId: user._id.toString(),
          prayerName
        },
        {
          delay, // Delay until prayer time
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          // Unique job ID to prevent duplicates
          jobId: `prayer-${user._id}-${subscription._id}-${prayerName}-${now.toISOString().split('T')[0]}`,
        }
      );
      jobsQueued++;
      
      const minutesUntilPrayer = Math.round(delay / 1000 / 60);
      logger.info(`📅 Scheduled ${prayerName} for user ${user._id} in ${minutesUntilPrayer} minutes`);
    } catch (error) {
      logger.error(`Failed to schedule ${prayerName} for subscription ${subscription._id}:`, error);
    }
  }

  return jobsQueued;
};

/**
 * Main function to schedule all prayer notifications for today
 */
const scheduleAllPrayerNotifications = async () => {
  logger.info('🕌 Starting prayer notification scheduling...');
  
  try {
    // Find all users with location set and at least one prayer notification enabled
    const users = await User.find({
      'location.lat': { $exists: true, $ne: null },
      'location.lon': { $exists: true, $ne: null },
      $or: [
        { 'notificationPreferences.prayerReminders.fajr': true },
        { 'notificationPreferences.prayerReminders.dhuhr': true },
        { 'notificationPreferences.prayerReminders.asr': true },
        { 'notificationPreferences.prayerReminders.maghrib': true },
        { 'notificationPreferences.prayerReminders.isha': true }
      ]
    }).lean();

    if (!users.length) {
      logger.info('📭 No users found with prayer notifications enabled.');
      return;
    }

    logger.info(`👥 Found ${users.length} users with prayer notifications enabled.`);
    
    let totalJobsScheduled = 0;
    const now = new Date();

    // Process each user
    for (const user of users) {
      try {
        const { lat, lon } = user.location;
        
        // Get user's push subscriptions
        const subscriptions = await PushSubscription.find({ 
          userId: user._id 
        }).lean();
        
        if (!subscriptions.length) {
          logger.info(`📱 No push subscriptions for user ${user._id}`);
          continue;
        }

        logger.info(`📱 User ${user._id} has ${subscriptions.length} device(s) subscribed`);

        // Calculate prayer times for user's location
        const prayerTimes = getPrayerTimesForLocation(lat, lon, now);
        
        // Schedule notifications for each enabled prayer
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        
        for (const prayerName of prayers) {
          // Check if this prayer is enabled for the user
          const isEnabled = user.notificationPreferences?.prayerReminders?.[prayerName];
          
          if (!isEnabled) {
            logger.debug(`⏭️ ${prayerName} notifications disabled for user ${user._id}`);
            continue;
          }

          const prayerTime = prayerTimes[prayerName];
          if (!prayerTime) {
            logger.warn(`⚠️ No ${prayerName} time found for user ${user._id}`);
            continue;
          }

          const jobsQueued = await schedulePrayerNotification(
            user, 
            prayerName, 
            prayerTime, 
            subscriptions
          );
          
          totalJobsScheduled += jobsQueued;
        }
        
        // Also schedule 5-minute reminders if enabled
        if (user.notificationPreferences?.prayerReminders?.reminderMinutes) {
          const reminderMinutes = user.notificationPreferences.prayerReminders.reminderMinutes;
          
          for (const prayerName of prayers) {
            if (!user.notificationPreferences?.prayerReminders?.[prayerName]) continue;
            
            const prayerTime = prayerTimes[prayerName];
            if (!prayerTime) continue;
            
            const reminderTime = new Date(prayerTime.getTime() - (reminderMinutes * 60 * 1000));
            const delay = Math.max(0, reminderTime.getTime() - now.getTime());
            
            if (delay > 0) {
              const reminderPayload = {
                title: `⏰ ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} in ${reminderMinutes} minutes`,
                body: `Get ready for ${prayerName} prayer.`,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `reminder-${prayerName}`,
                data: { 
                  url: '/prayertimes.html',
                  type: 'reminder',
                  prayerName: prayerName
                }
              };

              for (const subscription of subscriptions) {
                await notificationQueue.add(
                  'prayer-reminder',
                  { 
                    subscription: {
                      endpoint: subscription.endpoint,
                      keys: subscription.keys
                    }, 
                    payload: reminderPayload
                  },
                  {
                    delay,
                    removeOnComplete: true,
                    jobId: `reminder-${user._id}-${subscription._id}-${prayerName}-${now.toISOString().split('T')[0]}`
                  }
                );
                totalJobsScheduled++;
              }
            }
          }
        }
        
      } catch (userError) {
        logger.error(`Error processing user ${user._id}:`, userError);
      }
    }

    logger.info(`✅ Successfully scheduled ${totalJobsScheduled} prayer notification jobs.`);
    
    // Log queue statistics
    const queueStats = await notificationQueue.getJobCounts();
    logger.info('📊 Queue Statistics:', queueStats);
    
  } catch (error) {
    logger.error('❌ Error in prayer notification scheduling:', error);
  }
};

/**
 * Send a test notification to verify the system is working
 */
const sendTestNotification = async (userId = null) => {
  try {
    logger.info('🧪 Sending test notification...');
    
    // Find a user with push subscription
    const query = userId ? { userId } : {};
    const subscription = await PushSubscription.findOne(query).lean();
    
    if (!subscription) {
      logger.warn('No push subscriptions found for testing.');
      return false;
    }

    const user = await User.findById(subscription.userId).lean();
    const prayerTimes = user?.location?.lat 
      ? getPrayerTimesForLocation(user.location.lat, user.location.lon)
      : null;

    // Find next prayer
    let nextPrayer = 'Fajr';
    let nextPrayerTime = null;
    
    if (prayerTimes) {
      const now = new Date();
      const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
      
      for (const prayer of prayers) {
        if (prayerTimes[prayer] > now) {
          nextPrayer = prayer.charAt(0).toUpperCase() + prayer.slice(1);
          nextPrayerTime = prayerTimes[prayer];
          break;
        }
      }
    }

    const payload = {
      title: '🧪 Test Prayer Notification',
      body: nextPrayerTime 
        ? `System is working! Next prayer: ${nextPrayer} at ${nextPrayerTime.toLocaleTimeString()}`
        : 'Prayer notification system is working!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      data: { 
        url: '/prayertimes.html',
        type: 'test'
      }
    };

    await notificationQueue.add(
      'test-notification',
      { 
        subscription: {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        }, 
        payload 
      },
      {
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    
    logger.info('✅ Test notification queued successfully.');
    return true;
    
  } catch (error) {
    logger.error('❌ Error sending test notification:', error);
    return false;
  }
};

/**
 * Clear all scheduled prayer notifications (useful for debugging)
 */
const clearAllScheduledNotifications = async () => {
  try {
    const jobs = await notificationQueue.getJobs(['delayed', 'waiting']);
    let count = 0;
    
    for (const job of jobs) {
      if (job.name.includes('prayer')) {
        await job.remove();
        count++;
      }
    }
    
    logger.info(`🧹 Cleared ${count} scheduled prayer notifications.`);
    return count;
    
  } catch (error) {
    logger.error('Error clearing notifications:', error);
    return 0;
  }
};

/**
 * Main initialization function
 */
const initialize = async () => {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Clear any old notifications from previous runs (optional)
    // await clearAllScheduledNotifications();
    
    // Schedule notifications for today immediately on startup
    await scheduleAllPrayerNotifications();
    
    // Schedule daily at midnight (00:01) to prepare next day's notifications
    cron.schedule('1 0 * * *', async () => {
      logger.info('⏰ Running scheduled daily prayer notification setup...');
      await scheduleAllPrayerNotifications();
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    // Also run at noon to catch any new users or changes
    cron.schedule('0 12 * * *', async () => {
      logger.info('⏰ Running midday prayer notification update...');
      await scheduleAllPrayerNotifications();
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    // Run every 6 hours to ensure notifications are scheduled
    cron.schedule('0 */6 * * *', async () => {
      logger.info('⏰ Running 6-hour prayer notification check...');
      await scheduleAllPrayerNotifications();
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    logger.info('✅ Prayer notification scheduler initialized successfully.');
    
    // Optional: Send a test notification after 10 seconds
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => sendTestNotification(), 10000);
    }
    
  } catch (error) {
    logger.error('❌ Failed to initialize prayer scheduler:', error);
    process.exit(1);
  }
};

// Graceful shutdown handlers
const shutdown = async (signal) => {
  logger.info(`📴 Received ${signal}, shutting down prayer scheduler gracefully...`);
  
  try {
    await mongoose.connection.close();
    logger.info('✅ Database connection closed.');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Export functions for testing
module.exports = {
  scheduleAllPrayerNotifications,
  sendTestNotification,
  clearAllScheduledNotifications,
  getPrayerTimesForLocation
};

// Start the scheduler if this file is run directly
if (require.main === module) {
  initialize().catch(error => {
    logger.error('Fatal error during initialization:', error);
    process.exit(1);
  });
}