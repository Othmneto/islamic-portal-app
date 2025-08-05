const { notificationQueue } = require('../queues/notificationQueue');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User'); // Import the User model
const logger = require('../utils/logger');

/**
 * Sends a notification to a user *if* their preferences allow it.
 * @param {string} userId - The ID of the user to notify.
 * @param {object} payload - The notification content { title, body, icon }.
 * @param {string} notificationType - A key matching the preferences, e.g., 'fajr', 'specialAnnouncements'.
 */
const sendNotificationToUser = async (userId, payload, notificationType) => {
    // 1. Fetch both the user's preferences and their device subscriptions
    const user = await User.findById(userId).select('notificationPreferences');
    if (!user) {
        logger.warn(`Attempted to send notification to non-existent user: ${userId}`);
        return;
    }

    // 2. Check the user's preferences
    // This logic navigates the preferences object based on the notification type
    let isAllowed = false;
    if (notificationType === 'specialAnnouncements') {
        isAllowed = user.notificationPreferences.specialAnnouncements;
    } else if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(notificationType)) {
        isAllowed = user.notificationPreferences.prayerReminders[notificationType];
    }
    
    if (!isAllowed) {
        logger.info(`Notification blocked by user preferences for user: ${userId}, type: ${notificationType}`);
        return; // Stop if the user has this notification type disabled
    }

    // 3. If allowed, find their devices and queue the jobs
    const subscriptions = await PushSubscription.find({ userId });
    if (subscriptions.length === 0) {
        return;
    }
    
    const jobs = subscriptions.map(sub => ({
        name: 'send-push',
        data: { subscription: sub.toObject(), payload }
    }));

    await notificationQueue.addBulk(jobs);
    logger.info(`Added ${jobs.length} notification jobs to queue for user: ${userId}, type: ${notificationType}`);
};

module.exports = { sendNotificationToUser };