// tasks/prayerNotificationScheduler.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const { notificationQueue } = require('../queues/notificationQueue');
const islamicInfoService = require('../services/islamicInfoService');
const logger = require('../utils/logger');
const { env } = require('../config');

/**
 * Connects this standalone process to MongoDB.
 */
const connectToDatabase = async () => {
    try {
        await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
        logger.info('Prayer Scheduler connected to MongoDB.');
    } catch (err) {
        logger.error('Prayer Scheduler failed to connect to MongoDB.', { error: err });
        process.exit(1);
    }
};

/**
 * Fetches prayer times for all unique locations and returns a map.
 * @param {Array} users - A list of eligible users.
 * @returns {Map<string, object>} A map where the key is "lat,lon" and the value is the prayer times object.
 */
const getPrayerTimesForLocations = async (users) => {
    const prayerTimesByLocation = new Map();
    const uniqueLocations = [...new Map(users.map(u => [`${u.location.lat},${u.location.lon}`, u.location])).values()];

    logger.info(`Found ${uniqueLocations.length} unique locations to fetch prayer times for.`);

    for (const location of uniqueLocations) {
        try {
            const times = islamicInfoService.getPrayerTimes(location.lat, location.lon);
            // The adhan.js library returns dates in the local timezone of the calculation,
            // which is exactly what we need.
            prayerTimesByLocation.set(`${location.lat},${location.lon}`, times.timesRaw);
        } catch (error) {
            logger.error('Failed to fetch prayer times for location', { location, error });
        }
    }
    return prayerTimesByLocation;
};

/**
 * The main function to schedule prayer notifications for all eligible users for the next 24 hours.
 */
const scheduleDailyPrayerNotifications = async () => {
    logger.info('Starting daily prayer notification scheduling job...');

    try {
        const now = new Date();
        const eligibleUsers = await User.find({
            'location.lat': { $ne: null },
            $or: [
                { 'notificationPreferences.prayerReminders.fajr': true },
                { 'notificationPreferences.prayerReminders.dhuhr': true },
                { 'notificationPreferences.prayerReminders.asr': true },
                { 'notificationPreferences.prayerReminders.maghrib': true },
                { 'notificationPreferences.prayerReminders.isha': true },
            ]
        }).select('location notificationPreferences').lean();

        if (eligibleUsers.length === 0) {
            logger.info('No eligible users found for prayer notifications. Job finished.');
            return;
        }

        const prayerTimesByLocation = await getPrayerTimesForLocations(eligibleUsers);
        let jobsScheduled = 0;

        for (const user of eligibleUsers) {
            const locationKey = `${user.location.lat},${user.location.lon}`;
            const prayerTimes = prayerTimesByLocation.get(locationKey);
            if (!prayerTimes) continue;

            for (const prayerName in user.notificationPreferences.prayerReminders) {
                if (user.notificationPreferences.prayerReminders[prayerName] === true) {
                    const prayerTime = new Date(prayerTimes[prayerName]);

                    // Only schedule notifications that are in the future
                    if (prayerTime > now) {
                        const delay = prayerTime.getTime() - now.getTime();
                        const payload = {
                            title: `Time for ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} Prayer`,
                            body: 'May your prayers be accepted.',
                            icon: '/favicon.ico',
                        };

                        // The job data now matches what the notificationService expects
                        await notificationQueue.add('send-push', {
                            userId: user._id.toString(),
                            payload,
                            notificationType: prayerName,
                        }, {
                            delay,
                            removeOnComplete: true, // Keep the queue clean
                            removeOnFail: true,
                        });
                        jobsScheduled++;
                    }
                }
            }
        }
        logger.info(`Successfully scheduled ${jobsScheduled} prayer notification jobs.`);

    } catch (error) {
        logger.error('An error occurred during the daily prayer scheduling job.', { error });
    }
};

/**
 * Initializes the scheduler.
 */
const initialize = async () => {
    await connectToDatabase();
    // Schedule the job to run every day at 5 minutes past midnight.
    // The timezone should be the primary timezone of your user base or your server.
    cron.schedule('5 0 * * *', scheduleDailyPrayerNotifications, {
        timezone: "Africa/Cairo" 
    });

    logger.info('Prayer notification scheduler initialized. Waiting for the scheduled time (00:05).');
    
    // Optional: Run once on startup for immediate testing
    // scheduleDailyPrayerNotifications();
};

initialize();