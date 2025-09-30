// translator-backend/services/notificationService.js

const { getNotificationQueueService } = require('../queues/notificationQueue');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const logger = require('../utils/logger');

// START: New function to add a single job with an optional delay
/**
 * Adds a single notification job to the queue.
 * @param {object} subscription - The PushSubscription document.
 * @param {object|string} payload - The notification content { title, body, ... } or a JSON string.
 * @param {number} delay - Optional delay in milliseconds.
 */
const sendNotification = async (subscription, payload, delay = 0) => {
  if (!subscription || !payload) return;

  try {
    const queueService = getNotificationQueueService();
    if (!queueService) {
      logger?.error?.('Notification queue service not available');
      return;
    }

    const jobData = {
      subscription: subscription.toObject ? subscription.toObject() : subscription,
      payload,
    };

    const options = {};
    if (delay > 0) {
      options.delay = delay;
    }

    await queueService.addPushJob(jobData, options);
    logger?.info?.(
      `Added notification job to queue for endpoint: ${subscription?.subscription?.endpoint || 'unknown'}`,
      { delay }
    );
  } catch (error) {
    logger?.error?.('Failed to add notification job:', error);
  }
};
// END: New function

/**
 * Sends a notification to a user *if* their preferences allow it.
 * @param {string} userId - The ID of the user to notify.
 * @param {object|string} payload - The notification content (object or JSON string).
 * @param {string} notificationType - A key matching the preferences, e.g., 'fajr', 'specialAnnouncements'.
 */
const sendNotificationToUser = async (userId, payload, notificationType) => {
  // 1. Fetch both the user's preferences and their device subscriptions
  const user = await User.findById(userId).select('notificationPreferences');
  if (!user) {
    logger.warn(`Attempted to send notification to non-existent user: ${userId}`);
    return;
  }

  // START: Corrected Logic
  // 2. Check preferences ONLY if a specific type is provided
  if (notificationType) {
    let isAllowed = false;
    if (notificationType === 'specialAnnouncements') {
      isAllowed = user.notificationPreferences?.specialAnnouncements;
    } else if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(notificationType)) {
      isAllowed = user.notificationPreferences?.prayerReminders?.[notificationType];
    }

    if (!isAllowed) {
      logger.info(
        `Notification blocked by user preferences for user: ${userId}, type: ${notificationType}`
      );
      return; // Stop if the user has this notification type disabled
    }
  }
  // END: Corrected Logic

  // 3. If allowed, find their devices and queue the jobs
  const subscriptions = await PushSubscription.find({ userId });
  if (subscriptions.length === 0) {
    return;
  }

  // Use the new single-job function
  for (const sub of subscriptions) {
    // We send the raw payload here; the worker has the final say
    const parsed =
      typeof payload === 'string'
        ? JSON.parse(payload)
        : payload;
    await sendNotification(sub, parsed);
  }

  logger.info(
    `Added ${subscriptions.length} notification jobs to queue for user: ${userId}`,
    { notificationType }
  );
};

module.exports = {
  sendNotification,
  sendNotificationToUser,
};
