// services/inMemoryNotificationQueue.js - In-Memory Notification Queue with NVMe Persistence
'use strict';

const InMemoryQueue = require('./inMemoryQueue');
const webPush = require('web-push');
const { env } = require('../config');

/**
 * High-performance in-memory notification queue with NVMe disk persistence
 * Replaces BullMQ Redis-based notification system
 */
class InMemoryNotificationQueue {
  constructor() {
    this.queue = new InMemoryQueue('notifications', {
      concurrency: 5,
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });

    // Configure web-push
    webPush.setVapidDetails(
      env.VAPID_SUBJECT || 'mailto:admin@islamic-portal.com',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );

    // Statistics
    this.stats = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      activeJobs: 0
    };

    this.initialize();
  }

  /**
   * Initialize the notification queue
   */
  async initialize() {
    try {
      // Set up job processor
      this.queue.process(async (job) => {
        return await this.processNotificationJob(job);
      });

      // Load existing jobs from disk
      await this.queue.loadFromDisk();

      // Set up event listeners
      this.setupEventListeners();

      console.log('📬 [InMemoryNotificationQueue] Initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ [InMemoryNotificationQueue] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Add a push notification job
   */
  async addPushJob(payload, options = {}) {
    try {
      const job = await this.queue.add('send-push', payload, {
        removeOnComplete: true,
        removeOnFail: true,
        ...options
      });

      this.stats.totalJobs++;
      console.log(`📬 [InMemoryNotificationQueue] Job added: ${job.id}`);
      return job;
    } catch (error) {
      console.error('❌ [InMemoryNotificationQueue] Add job failed:', error);
      throw error;
    }
  }

  /**
   * Add a test prayer notification
   */
  async queueTestPrayerNotification(userId, subs, messageOverride) {
    try {
      if (!Array.isArray(subs)) {
        throw new Error('queueTestPrayerNotification: subs (array) is required');
      }

      const payload = {
        title: 'Prayer Test',
        body: messageOverride || 'This is a test for the next prayer notification path.',
        tag: 'test-prayer',
        data: { url: '/prayer-time.html' }
      };

      const jobs = [];
      for (const sub of subs) {
        const job = await this.addPushJob(
          { subscription: sub, payload },
          { removeOnComplete: true }
        );
        jobs.push(job);
      }

      return {
        ok: true,
        count: jobs.length,
        message: `Queued ${jobs.length} test-prayer notification(s).`
      };
    } catch (error) {
      console.error('❌ [InMemoryNotificationQueue] Test prayer notification failed:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const queueStats = this.queue.getStats();
    return {
      ...this.stats,
      queue: queueStats
    };
  }

  /**
   * Get jobs by status
   */
  getJobs(status) {
    return this.queue.getJobs(status);
  }

  /**
   * Clean completed/failed jobs
   */
  clean(grace, status) {
    return this.queue.clean(grace, status);
  }

  /**
   * Close the queue
   */
  async close() {
    await this.queue.close();
    console.log('📬 [InMemoryNotificationQueue] Closed');
  }

  // Private methods

  async processNotificationJob(job) {
    try {
      const { subscription, payload, subscriptionId } = job.data;

      let subDoc;
      if (subscriptionId) {
        // Load subscription from database
        const PushSubscription = require('../models/PushSubscription');
        subDoc = await PushSubscription.findById(subscriptionId);
        if (!subDoc) {
          throw new Error(`Subscription not found: ${subscriptionId}`);
        }
      } else if (subscription) {
        subDoc = subscription;
      } else {
        throw new Error('No subscription provided');
      }

      // Convert to web-push format
      const webPushSub = this.toWebPushSubscription(subDoc);
      if (!webPushSub?.endpoint || !webPushSub?.keys?.p256dh || !webPushSub?.keys?.auth) {
        throw new Error('Invalid subscription format');
      }

      // Send notification with high urgency and short TTL to reduce latency
      await webPush.sendNotification(
        webPushSub,
        JSON.stringify(payload),
        { TTL: 10, urgency: 'high' }
      );

      this.stats.successfulJobs++;
      console.log(`📬 [InMemoryNotificationQueue] Notification sent: ${job.id}`);
      
      return { success: true, jobId: job.id };
    } catch (error) {
      this.stats.failedJobs++;
      console.error(`❌ [InMemoryNotificationQueue] Job failed: ${job.id}`, error);
      
      // Handle specific web-push errors
      if (error.statusCode === 404 || error.statusCode === 410) {
        // Subscription is invalid, remove it
        await this.removeInvalidSubscription(job.data);
      }
      
      throw error;
    }
  }

  toWebPushSubscription(doc) {
    if (!doc?.subscription) {
      throw new Error("Invalid subscription document");
    }
    
    return {
      endpoint: doc.subscription.endpoint,
      keys: {
        p256dh: doc.subscription.keys?.p256dh,
        auth: doc.subscription.keys?.auth
      }
    };
  }

  async removeInvalidSubscription(data) {
    try {
      if (data.subscriptionId) {
        const PushSubscription = require('../models/PushSubscription');
        await PushSubscription.deleteOne({ _id: data.subscriptionId });
        console.log(`🗑️ [InMemoryNotificationQueue] Removed invalid subscription: ${data.subscriptionId}`);
      }
    } catch (error) {
      console.error('❌ [InMemoryNotificationQueue] Remove subscription failed:', error);
    }
  }

  setupEventListeners() {
    this.queue.on('jobCompleted', (job) => {
      this.stats.successfulJobs++;
      console.log(`✅ [InMemoryNotificationQueue] Job completed: ${job.id}`);
    });

    this.queue.on('jobFailed', (job, error) => {
      this.stats.failedJobs++;
      console.error(`❌ [InMemoryNotificationQueue] Job failed: ${job.id}`, error);
    });

    this.queue.on('jobRetry', (job, error) => {
      console.warn(`🔄 [InMemoryNotificationQueue] Job retry: ${job.id}`, error.message);
    });

    this.queue.on('processingStarted', () => {
      console.log('🚀 [InMemoryNotificationQueue] Processing started');
    });

    this.queue.on('processingStopped', () => {
      console.log('⏹️ [InMemoryNotificationQueue] Processing stopped');
    });
  }
}

// Create singleton instance
const notificationQueue = new InMemoryNotificationQueue();

module.exports = {
  notificationQueue,
  InMemoryNotificationQueue,
  getNotificationQueueService: () => notificationQueue
};
