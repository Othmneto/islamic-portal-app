const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const NotificationHistory = require('../models/NotificationHistory');
const PushSubscription = require('../models/PushSubscription');
const { env } = require('../config');

class NotificationRetryManager {
  constructor() {
    this.queue = new Map(); // notificationId -> retry data
    this.walPath = path.join(__dirname, '../temp/notification-retry.wal');
    this.maxRetries = 5;
    this.baseDelayMs = 1000; // 1 second
    this.maxDelayMs = 30000; // 30 seconds
    this.retryMultiplier = 2;
    this.isProcessing = false;
    this.processingInterval = null;
    this.processingIntervalMs = 10000; // 10 seconds

    this.init();
  }

  /**
   * Initialize retry manager
   */
  async init() {
    try {
      // Ensure temp directory exists
      await this.ensureTempDirectory();

      // Load queue state from WAL
      await this.reloadQueueStateOnBoot();
      
      // Clean expired notifications after reload
      await this.cleanExpiredNotificationsFromWal();

      // Start processing
      this.startProcessing();
      
      // Start periodic cleanup
      this.startPeriodicCleanup();

      console.log('🔄 [NotificationRetry] Retry manager initialized');
    } catch (error) {
      console.error('❌ [NotificationRetry] Error initializing retry manager:', error);
    }
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDirectory() {
    const tempDir = path.dirname(this.walPath);
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Clean expired notifications from WAL on boot
   */
  async cleanExpiredNotificationsFromWal() {
    try {
      const queue = this.queue;
      let cleanedCount = 0;

      for (const [notificationId, retryData] of queue.entries()) {
        // Check if subscription still exists and is active
        const subscription = await PushSubscription.findById(retryData.subscriptionId);
        
        if (!subscription || !subscription.isActive) {
          console.log('🗑️ [NotificationRetry] Removing expired notification from WAL:', notificationId);
          queue.delete(notificationId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 [NotificationRetry] Cleaned ${cleanedCount} expired notifications from WAL`);
        await this.persistQueueStateWriteAhead();
      }
    } catch (error) {
      console.error('❌ [NotificationRetry] Error cleaning expired notifications:', error);
    }
  }

  /**
   * Enqueue notification for retry with idempotency
   */
  async enqueueNotificationDeliveryWithIdempotency(notificationData) {
    try {
      const {
        notificationId,
        userId,
        prayerName,
        notificationType,
        scheduledTime,
        timezone,
        reminderMinutes,
        subscriptionId,
        payload
      } = notificationData;

      // Check if already in queue
      if (this.queue.has(notificationId)) {
        console.log('⚠️ [NotificationRetry] Notification already in queue:', notificationId);
        return false;
      }

      // Create retry data
      const retryData = {
        notificationId,
        userId,
        prayerName,
        notificationType,
        scheduledTime: new Date(scheduledTime),
        timezone,
        reminderMinutes,
        subscriptionId,
        payload,
        retryCount: 0,
        nextRetryAt: new Date(),
        createdAt: new Date(),
        lastAttempt: null,
        status: 'pending'
      };

      // Add to queue
      this.queue.set(notificationId, retryData);

      // Persist to WAL
      await this.persistQueueStateWriteAhead();

      console.log('📝 [NotificationRetry] Notification enqueued for retry:', notificationId);
      return true;
    } catch (error) {
      console.error('❌ [NotificationRetry] Error enqueuing notification:', error);
      return false;
    }
  }

  /**
   * Process notification queue with exponential backoff
   */
  async processNotificationQueueWithBackoff() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();
      const readyForRetry = [];

      // Find notifications ready for retry
      for (const [notificationId, retryData] of this.queue) {
        if (retryData.nextRetryAt <= now && retryData.status === 'pending') {
          readyForRetry.push(notificationId);
        }
      }

      // Process each notification
      for (const notificationId of readyForRetry) {
        await this.processNotificationRetry(notificationId);
      }

      // Clean up old entries
      await this.cleanupOldEntries();

    } catch (error) {
      console.error('❌ [NotificationRetry] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual notification retry
   */
  async processNotificationRetry(notificationId) {
    const retryData = this.queue.get(notificationId);
    if (!retryData) {
      return;
    }

    try {
      console.log(`🔄 [NotificationRetry] Processing retry ${retryData.retryCount + 1} for:`, notificationId);

      // Update attempt timestamp
      retryData.lastAttempt = new Date();
      retryData.status = 'processing';

      // Get subscription
      const subscription = await PushSubscription.findById(retryData.subscriptionId);
      if (!subscription) {
        console.log('❌ [NotificationRetry] Subscription not found:', retryData.subscriptionId);
        await this.markNotificationAsFailed(notificationId, 'Subscription not found');
        return;
      }

      // Convert to web push format
      const webPushSubscription = {
        endpoint: subscription.subscription.endpoint,
        keys: {
          p256dh: subscription.subscription.keys.p256dh,
          auth: subscription.subscription.keys.auth
        }
      };

      // Send notification
      const result = await this.sendNotification(webPushSubscription, retryData.payload);

      // Handle expired subscription (410 error)
      if (result && result.expired) {
        console.log('🗑️ [NotificationRetry] Removing expired subscription:', retryData.subscriptionId);
        
        // Delete expired subscription from database
        await PushSubscription.findByIdAndDelete(retryData.subscriptionId);
        
        // Mark notification as failed with specific reason
        await this.markNotificationAsFailed(notificationId, 'Subscription expired (410)');
        return;
      }

      if (result === true) {
        // Mark as delivered
        await this.markNotificationAsDelivered(notificationId);
        console.log('✅ [NotificationRetry] Notification delivered:', notificationId);
      } else {
        // Schedule next retry
        await this.scheduleDelayedRetryUsingTimeout(notificationId);
      }

    } catch (error) {
      console.error('❌ [NotificationRetry] Error processing retry:', error);
      await this.scheduleDelayedRetryUsingTimeout(notificationId);
    }
  }

  /**
   * Send notification via web push
   */
  async sendNotification(subscription, payload) {
    try {
      const webpush = require('web-push');
      const { env } = require('../config');

      // Set VAPID details
      webpush.setVapidDetails(
        'mailto:test@example.com',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        {
          TTL: 60,
          urgency: 'normal'
        }
      );

      return result.statusCode === 201;
    } catch (error) {
      console.error('❌ [NotificationRetry] Error sending notification:', error);
      
      // Check for 410 Gone - subscription expired/unsubscribed
      if (error.statusCode === 410) {
        console.log('🗑️ [NotificationRetry] Subscription expired (410), marking for cleanup');
        return { expired: true, error };
      }
      
      return false;
    }
  }

  /**
   * Mark notification as delivered
   */
  async markNotificationAsDelivered(notificationId) {
    try {
      // Update database
      await NotificationHistory.findOneAndUpdate(
        { notificationId },
        {
          status: 'delivered',
          sentTime: new Date()
        }
      );

      // Remove from queue
      this.queue.delete(notificationId);

      // Persist state
      await this.persistQueueStateWriteAhead();

    } catch (error) {
      console.error('❌ [NotificationRetry] Error marking as delivered:', error);
    }
  }

  /**
   * Mark notification as failed
   */
  async markNotificationAsFailed(notificationId, error) {
    try {
      // Update database
      await NotificationHistory.findOneAndUpdate(
        { notificationId },
        {
          status: 'failed',
          error: error,
          sentTime: new Date()
        }
      );

      // Remove from queue
      this.queue.delete(notificationId);

      // Persist state
      await this.persistQueueStateWriteAhead();

    } catch (err) {
      console.error('❌ [NotificationRetry] Error marking as failed:', err);
    }
  }

  /**
   * Schedule delayed retry using timeout
   */
  async scheduleDelayedRetryUsingTimeout(notificationId) {
    const retryData = this.queue.get(notificationId);
    if (!retryData) {
      return;
    }

    retryData.retryCount++;
    retryData.status = 'pending';

    // Check if max retries exceeded
    if (retryData.retryCount >= this.maxRetries) {
      console.log('❌ [NotificationRetry] Max retries exceeded for:', notificationId);
      await this.markNotificationAsFailed(notificationId, 'Max retries exceeded');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.baseDelayMs * Math.pow(this.retryMultiplier, retryData.retryCount - 1),
      this.maxDelayMs
    );

    retryData.nextRetryAt = new Date(Date.now() + delay);

    // Update database
    await NotificationHistory.findOneAndUpdate(
      { notificationId },
      {
        retryCount: retryData.retryCount,
        retryScheduledFor: retryData.nextRetryAt
      }
    );

    // Persist state
    await this.persistQueueStateWriteAhead();

    console.log(`⏰ [NotificationRetry] Scheduled retry ${retryData.retryCount} in ${delay}ms for:`, notificationId);
  }

  /**
   * Persist queue state to Write-Ahead Log
   */
  async persistQueueStateWriteAhead() {
    try {
      const state = {
        timestamp: new Date().toISOString(),
        queueSize: this.queue.size,
        notifications: Array.from(this.queue.values())
      };

      const logEntry = JSON.stringify(state) + '\n';

      // Use proper fs.promises API
      const handle = await fs.open(this.walPath, 'a');
      try {
        await handle.appendFile(logEntry);
        await handle.sync();
      } finally {
        await handle.close();
      }

    } catch (error) {
      console.error('❌ [NotificationRetry] Error persisting queue state:', error);
    }
  }

  /**
   * Reload queue state on boot
   */
  async reloadQueueStateOnBoot() {
    try {
      if (!await this.fileExists(this.walPath)) {
        console.log('📝 [NotificationRetry] No WAL file found, starting fresh');
        return;
      }

      const data = await fs.readFile(this.walPath, 'utf8');
      const lines = data.trim().split('\n').filter(line => line.length > 0);

      if (lines.length === 0) {
        return;
      }

      // Get the last (most recent) state
      const lastState = JSON.parse(lines[lines.length - 1]);

      // Restore queue
      this.queue.clear();
      for (const notification of lastState.notifications) {
        if (notification.status === 'pending' || notification.status === 'processing') {
          this.queue.set(notification.notificationId, notification);
        }
      }

      console.log(`🔄 [NotificationRetry] Restored ${this.queue.size} notifications from WAL`);

    } catch (error) {
      console.error('❌ [NotificationRetry] Error reloading queue state:', error);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start processing queue
   */
  startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processNotificationQueueWithBackoff();
    }, this.processingIntervalMs);

    console.log('⏰ [NotificationRetry] Processing started');
  }

  /**
   * Start periodic cleanup of expired subscriptions
   */
  startPeriodicCleanup() {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        console.log('🧹 [NotificationRetry] Running periodic cleanup...');
        await this.cleanExpiredNotificationsFromWal();
      } catch (error) {
        console.error('❌ [NotificationRetry] Periodic cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop processing queue
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('⏹️ [NotificationRetry] Processing stopped');
  }

  /**
   * Clean up old entries
   */
  async cleanupOldEntries() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [notificationId, retryData] of this.queue) {
      if (now - retryData.createdAt > maxAge) {
        console.log('🧹 [NotificationRetry] Cleaning up old entry:', notificationId);
        this.queue.delete(notificationId);
      }
    }

    // Persist after cleanup
    if (this.queue.size > 0) {
      await this.persistQueueStateWriteAhead();
    }
  }

  /**
   * Compact WAL file
   */
  async compactQueueLogFile() {
    try {
      if (!await this.fileExists(this.walPath)) {
        return;
      }

      const data = await fs.readFile(this.walPath, 'utf8');
      const lines = data.trim().split('\n').filter(line => line.length > 0);

      if (lines.length === 0) {
        return;
      }

      // Keep only the last 100 entries
      const keepLines = lines.slice(-100);

      await fs.writeFile(this.walPath, keepLines.join('\n') + '\n');

      console.log('🗜️ [NotificationRetry] WAL file compacted');

    } catch (error) {
      console.error('❌ [NotificationRetry] Error compacting WAL file:', error);
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const stats = {
      queueSize: this.queue.size,
      pending: 0,
      processing: 0,
      totalRetries: 0
    };

    for (const retryData of this.queue.values()) {
      if (retryData.status === 'pending') stats.pending++;
      if (retryData.status === 'processing') stats.processing++;
      stats.totalRetries += retryData.retryCount;
    }

    return stats;
  }
}

module.exports = new NotificationRetryManager();

