const PushSubscription = require('../models/PushSubscription');
const { env } = require('../config');

class SubscriptionHealthService {
  constructor() {
    this.maxFailures = 3;
    this.healthCheckInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.isRunning = false;
  }

  /**
   * Check all subscriptions daily
   */
  async checkAllSubscriptionsDaily() {
    if (this.isRunning) {
      console.log('⚠️ [SubscriptionHealth] Health check already running, skipping');
      return;
    }

    this.isRunning = true;
    console.log('🔍 [SubscriptionHealth] Starting daily health check...');

    try {
      // Get all active subscriptions
      const subscriptions = await PushSubscription.find({
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      console.log(`📊 [SubscriptionHealth] Checking ${subscriptions.length} subscriptions`);

      let healthyCount = 0;
      let failedCount = 0;
      let removedCount = 0;

      // Check each subscription
      for (const subscription of subscriptions) {
        try {
          const isHealthy = await this.testSubscriptionWithSilentProbe(subscription);

          if (isHealthy) {
            await this.markSubscriptionHealthy(subscription._id);
            healthyCount++;
          } else {
            await this.markSubscriptionHealthFailure(subscription._id);
            failedCount++;

            // Remove if too many failures
            if (subscription.healthCheckFailures >= this.maxFailures - 1) {
              await this.removeSubscriptionAfter3Failures(subscription._id);
              removedCount++;
            }
          }
        } catch (error) {
          console.error(`❌ [SubscriptionHealth] Error checking subscription ${subscription._id}:`, error);
          await this.markSubscriptionHealthFailure(subscription._id);
          failedCount++;
        }
      }

      console.log(`✅ [SubscriptionHealth] Health check complete: ${healthyCount} healthy, ${failedCount} failed, ${removedCount} removed`);

    } catch (error) {
      console.error('❌ [SubscriptionHealth] Error during health check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Test subscription with silent probe
   */
  async testSubscriptionWithSilentProbe(subscription) {
    try {
      const webpush = require('web-push');

      // Create a silent test notification
      const testPayload = JSON.stringify({
        title: 'Health Check',
        body: 'Silent health check - no user notification',
        data: {
          type: 'health_check',
          silent: true,
          timestamp: Date.now()
        },
        silent: true,
        requireInteraction: false,
        tag: 'health-check'
      });

      // Send test notification
      const result = await webpush.sendNotification(
        subscription.subscription,
        testPayload
      );

      // Check if successful (201 = created)
      return result.statusCode === 201;

    } catch (error) {
      console.error(`❌ [SubscriptionHealth] Test failed for subscription ${subscription._id}:`, error.message);

      // Check for specific error types that indicate subscription is invalid
      if (this.isSubscriptionInvalid(error)) {
        return false;
      }

      // For other errors, consider it a temporary failure
      return true;
    }
  }

  /**
   * Check if error indicates subscription is invalid
   */
  isSubscriptionInvalid(error) {
    const invalidErrors = [
      '410', // Gone
      '404', // Not Found
      'invalid subscription',
      'expired',
      'invalid endpoint'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode?.toString() || '';

    return invalidErrors.some(invalidError =>
      errorMessage.includes(invalidError) || statusCode.includes(invalidError)
    );
  }

  /**
   * Mark subscription as healthy
   */
  async markSubscriptionHealthy(subscriptionId) {
    try {
      await PushSubscription.findByIdAndUpdate(subscriptionId, {
        lastHealthCheck: new Date(),
        healthCheckFailures: 0
      });

      console.log(`✅ [SubscriptionHealth] Marked subscription ${subscriptionId} as healthy`);
    } catch (error) {
      console.error(`❌ [SubscriptionHealth] Error marking subscription healthy:`, error);
    }
  }

  /**
   * Mark subscription health failure
   */
  async markSubscriptionHealthFailure(subscriptionId) {
    try {
      const subscription = await PushSubscription.findById(subscriptionId);
      if (!subscription) {
        return;
      }

      const newFailureCount = (subscription.healthCheckFailures || 0) + 1;

      await PushSubscription.findByIdAndUpdate(subscriptionId, {
        lastHealthCheck: new Date(),
        healthCheckFailures: newFailureCount
      });

      console.log(`⚠️ [SubscriptionHealth] Marked subscription ${subscriptionId} as failed (${newFailureCount}/${this.maxFailures})`);
    } catch (error) {
      console.error(`❌ [SubscriptionHealth] Error marking subscription failure:`, error);
    }
  }

  /**
   * Remove subscription after 3 failures
   */
  async removeSubscriptionAfter3Failures(subscriptionId) {
    try {
      await PushSubscription.findByIdAndDelete(subscriptionId);
      console.log(`🗑️ [SubscriptionHealth] Removed subscription ${subscriptionId} after ${this.maxFailures} failures`);
    } catch (error) {
      console.error(`❌ [SubscriptionHealth] Error removing subscription:`, error);
    }
  }

  /**
   * Get subscription health statistics
   */
  async getHealthStats() {
    try {
      const total = await PushSubscription.countDocuments();
      const healthy = await PushSubscription.countDocuments({
        healthCheckFailures: 0
      });
      const failed = await PushSubscription.countDocuments({
        healthCheckFailures: { $gt: 0, $lt: this.maxFailures }
      });
      const expired = await PushSubscription.countDocuments({
        expiresAt: { $lt: new Date() }
      });

      return {
        total,
        healthy,
        failed,
        expired,
        healthPercentage: total > 0 ? Math.round((healthy / total) * 100) : 0
      };
    } catch (error) {
      console.error('❌ [SubscriptionHealth] Error getting health stats:', error);
      return null;
    }
  }

  /**
   * Clean up expired subscriptions
   */
  async cleanupExpiredSubscriptions() {
    try {
      const result = await PushSubscription.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      console.log(`🧹 [SubscriptionHealth] Cleaned up ${result.deletedCount} expired subscriptions`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ [SubscriptionHealth] Error cleaning up expired subscriptions:', error);
      return 0;
    }
  }

  /**
   * Get subscriptions by health status
   */
  async getSubscriptionsByHealthStatus(status) {
    try {
      let query = {};

      switch (status) {
        case 'healthy':
          query = { healthCheckFailures: 0 };
          break;
        case 'failed':
          query = { healthCheckFailures: { $gt: 0, $lt: this.maxFailures } };
          break;
        case 'expired':
          query = { expiresAt: { $lt: new Date() } };
          break;
        case 'all':
        default:
          break;
      }

      return await PushSubscription.find(query)
        .select('_id userId subscription.endpoint lastHealthCheck healthCheckFailures expiresAt')
        .lean();
    } catch (error) {
      console.error('❌ [SubscriptionHealth] Error getting subscriptions by status:', error);
      return [];
    }
  }
}

module.exports = new SubscriptionHealthService();

