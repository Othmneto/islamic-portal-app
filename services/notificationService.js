// translator-backend/services/notificationService.js

const { getNotificationQueueService } = require('../queues/notificationQueue');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const NotificationHistory = require('../models/NotificationHistory');
const notificationRetryManager = require('./notificationRetryManager');
const { env } = require('../config');
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
    // Generate unique notification ID for tracking
    const notificationId = require('crypto').randomUUID();

    // Enhanced payload with notification ID for confirmation tracking
    const enhancedPayload = {
      ...payload,
      data: {
        ...payload.data,
        notificationId: notificationId
      }
    };

    // Create notification history record
    const notificationHistory = await NotificationHistory.create({
      userId: subscription.userId,
      prayerName: payload.prayerName || (payload.title?.includes('Test') ? 'test' : 'unknown'),
      notificationType: payload.notificationType || 'main',
      scheduledTime: new Date(),
      sentTime: new Date(),
      status: 'sent',
      subscriptionId: subscription._id,
      notificationId: notificationId,
      timezone: subscription.tz || 'UTC'
    });

    // Use retry manager if enabled
    if (env.NOTIFY_RETRY_BACKOFF_ENABLED === 'true') {
      await notificationRetryManager.enqueueNotificationDeliveryWithIdempotency({
        notificationId: notificationId,
        userId: subscription.userId,
        prayerName: payload.prayerName || (payload.title?.includes('Test') ? 'test' : 'unknown'),
        notificationType: payload.notificationType || 'main',
        scheduledTime: new Date(),
        timezone: subscription.tz || 'UTC',
        reminderMinutes: payload.reminderMinutes,
        subscriptionId: subscription._id,
        payload: enhancedPayload
      });

      logger?.info?.(
        `Added notification to retry manager for endpoint: ${subscription?.subscription?.endpoint || 'unknown'}`,
        { notificationId, delay }
      );
    } else {
      // Fallback to original queue system
      const queueService = getNotificationQueueService();
      if (!queueService) {
        logger?.error?.('Notification queue service not available');
        return;
      }

      const jobData = {
        subscription: subscription.toObject ? subscription.toObject() : subscription,
        payload: enhancedPayload,
      };

      const options = {};
      if (delay > 0) {
        options.delay = delay;
      }

      await queueService.addPushJob(jobData, options);
      logger?.info?.(
        `Added notification job to queue for endpoint: ${subscription?.subscription?.endpoint || 'unknown'}`,
        { notificationId, delay }
      );
    }
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
