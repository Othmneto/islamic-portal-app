// translator-backend/services/notificationService.js

const { getNotificationQueueService } = require('../queues/notificationQueue');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const NotificationHistory = require('../models/NotificationHistory');
const notificationRetryManager = require('./notificationRetryManager');
const { env } = require('../config');
const logger = require('../utils/logger');
const { getAudioFile, validateAudioSettings, clamp } = require('../utils/audioVoices');

/**
 * Enrich payload with audio parameters based on user preferences
 * @param {string} userId - User ID
 * @param {object} payload - Notification payload
 * @returns {object} - Audio parameters to add to payload.data
 */
async function enrichPayloadWithAudio(userId, payload) {
  // Load user preferences
  const user = await User.findById(userId).select('preferences').lean();
  if (!user || !user.preferences) return {};

  const prefs = user.preferences;
  const notificationType = payload.notificationType || 'main';
  const prayer = payload.prayerName || payload.prayer;

  // Start with global audio settings
  let audioSettings = {
    volume: prefs.audioSettings?.volume || 0.8,
    fadeInMs: prefs.audioSettings?.fadeInMs || 3000,
    vibrateOnly: prefs.audioSettings?.vibrateOnly || false,
    cooldownSeconds: prefs.audioSettings?.cooldownSeconds || 30
  };

  // Select audio file based on notification type
  const profileMain = prefs.audioProfileMain || { name: 'madinah', file: '/audio/adhan_madinah.mp3' };
  const profileReminder = prefs.audioProfileReminder || { name: 'short', file: '/audio/adhan.mp3' };
  
  let audioFile = notificationType === 'reminder' ? profileReminder.file : profileMain.file;

  // Apply per-prayer overrides if they exist
  if (prayer && prefs.audioOverrides) {
    const override = prefs.audioOverrides.get ? prefs.audioOverrides.get(prayer) : prefs.audioOverrides[prayer];
    if (override) {
      if (override.volume !== undefined) audioSettings.volume = override.volume;
      if (override.fadeInMs !== undefined) audioSettings.fadeInMs = override.fadeInMs;
      if (override.vibrateOnly !== undefined) audioSettings.vibrateOnly = override.vibrateOnly;
      if (override.cooldownSeconds !== undefined) audioSettings.cooldownSeconds = override.cooldownSeconds;
      
      // Override audio file if specified
      if (notificationType === 'reminder' && override.fileReminder) {
        audioFile = override.fileReminder;
      } else if (notificationType === 'main' && override.fileMain) {
        audioFile = override.fileMain;
      }
    }
  }

  // Clamp values to safe limits
  const clamped = validateAudioSettings(audioSettings, {
    maxVolume: env.AUDIO_MAX_VOLUME,
    maxFadeMs: env.AUDIO_MAX_FADE_MS,
    maxCooldown: env.AUDIO_COOLDOWN_SECONDS
  });

  return {
    audioFile,
    volume: clamped.volume,
    fadeInMs: clamped.fadeInMs,
    vibrateOnly: clamped.vibrateOnly,
    cooldownSeconds: clamped.cooldownSeconds
  };
}

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
    // Identify push service type for debugging
    const endpoint = subscription.subscription?.endpoint || 'unknown';
    const pushService = endpoint.includes('fcm.googleapis.com') ? 'FCM(Chrome)' : 
                        endpoint.includes('mozilla.com') ? 'Mozilla(Firefox)' :
                        endpoint.includes('push.apple.com') ? 'APNs(Safari)' : 'Unknown';
    
    const pushType = endpoint.includes('fcm') ? 'CHROME' : 
                     endpoint.includes('mozilla') ? 'FIREFOX' : 'OTHER';
    
    // Enhanced logging for notification send
    console.log(`📤 [NotificationService] Attempting to send notification:`);
    console.log(`   Type: ${payload.notificationType || 'unknown'}`);
    console.log(`   Prayer: ${payload.prayerName || 'N/A'}`);
    console.log(`   User: ${subscription.userId || 'unknown'}`);
    console.log(`   Push Service: ${pushService}`);
    console.log(`   Endpoint: ${endpoint.substring(0, 60)}...`);
    console.log(`   Title: ${payload.title}`);
    
    // Generate unique notification ID for tracking
    const notificationId = require('crypto').randomUUID();

    // NEW: Enrich payload with audio params if feature enabled
    let audioParams = {};
    if (env.AUDIO_ENABLED === 'true' && subscription.userId) {
      try {
        audioParams = await enrichPayloadWithAudio(subscription.userId, payload);
      } catch (audioError) {
        logger.warn?.('Audio enrichment skipped:', audioError.message);
        // Continue without audio params - graceful degradation
      }
    }

    // Enhanced payload with notification ID for confirmation tracking + audio
    const enhancedPayload = {
      ...payload,
      data: {
        ...payload.data,
        notificationId: notificationId,
        ...audioParams // Add audio params if available
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
      console.log(`✅ [NotificationService] Notification queued successfully`);
      logger?.info?.(
        `Added notification job to queue for endpoint: ${subscription?.subscription?.endpoint || 'unknown'}`,
        { notificationId, delay }
      );
    }
  } catch (error) {
    console.error(`❌ [NotificationService] Failed to send notification:`, error.message);
    // Enhanced error logging for browser-specific issues
    const endpoint = subscription.subscription?.endpoint || 'unknown';
    const pushService = endpoint.includes('fcm.googleapis.com') ? 'FCM(Chrome)' : 
                        endpoint.includes('mozilla.com') ? 'Mozilla(Firefox)' :
                        endpoint.includes('push.apple.com') ? 'APNs(Safari)' : 'Unknown';
    
    console.error(`❌ [NotificationService] ${pushService} push failed:`, error.message);
    if (endpoint.includes('mozilla.com')) {
      console.error(`❌ [NotificationService] Mozilla Push specific error details:`, {
        message: error.message,
        stack: error.stack,
        endpoint: endpoint.substring(0, 100)
      });
    }
    
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
