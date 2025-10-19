const express = require('express');
const router = express.Router();
const NotificationHistory = require('../models/NotificationHistory');
const { createError } = require('../middleware/errorHandler');
const { validate, z } = require('../middleware/validate');
const notificationService = require('../services/notificationService');
const PushSubscription = require('../models/PushSubscription');

// Validation schema for notification confirmation
const confirmNotificationSchema = z.object({
  body: z.object({
    notificationId: z.string().min(1, 'Notification ID is required'),
    confirmedAt: z.string().datetime().optional()
  })
});

/**
 * @route   POST /api/notifications/confirm
 * @desc    Confirm notification delivery
 * @access  Private
 */
router.post('/confirm', validate(confirmNotificationSchema), async (req, res) => {
  try {
    const { notificationId, confirmedAt } = req.body;
    const confirmedTime = confirmedAt ? new Date(confirmedAt) : new Date();

    console.log('📧 [Notification] Confirming delivery for:', notificationId);

    // Find and update notification
    const notification = await NotificationHistory.findOneAndUpdate(
      { notificationId },
      {
        status: 'confirmed',
        confirmedAt: confirmedTime
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    console.log('✅ [Notification] Delivery confirmed:', notificationId);

    res.json({
      success: true,
      message: 'Notification delivery confirmed',
      data: {
        notificationId,
        confirmedAt: confirmedTime,
        status: 'confirmed'
      }
    });
  } catch (error) {
    console.error('❌ [Notification] Error confirming delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm notification delivery'
    });
  }
});

/**
 * @route   GET /api/notifications/status/:notificationId
 * @desc    Get notification status
 * @access  Private
 */
router.get('/status/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await NotificationHistory.findOne({ notificationId })
      .select('notificationId status confirmedAt retryCount retryScheduledFor createdAt')
      .lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('❌ [Notification] Error getting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification status'
    });
  }
});

/**
 * @route   GET /api/notifications/history/:userId
 * @desc    Get notification history for user
 * @access  Private
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const notifications = await NotificationHistory.find(query)
      .select('notificationId prayerName notificationType status confirmedAt retryCount createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await NotificationHistory.countDocuments(query);

    res.json({
      success: true,
      data: {
        notifications,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('❌ [Notification] Error getting history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification history'
    });
  }
});

/**
 * @route   POST /api/notifications/retry/:notificationId
 * @desc    Manually retry a failed notification
 * @access  Private
 */
router.post('/retry/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await NotificationHistory.findOne({ notificationId });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Notification already confirmed'
      });
    }

    // Reset retry count and schedule for immediate retry
    await NotificationHistory.findByIdAndUpdate(notification._id, {
      retryCount: 0,
      retryScheduledFor: new Date(),
      status: 'sent'
    });

    console.log('🔄 [Notification] Manual retry scheduled for:', notificationId);

    res.json({
      success: true,
      message: 'Notification retry scheduled',
      data: {
        notificationId,
        retryScheduledFor: new Date()
      }
    });
  } catch (error) {
    console.error('❌ [Notification] Error scheduling retry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule notification retry'
    });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send a test notification
 * @access  Private
 */
router.post('/test', async (req, res) => {
  try {
    const { title, body, icon } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user's push subscriptions
    const subscriptions = await PushSubscription.find({ userId, isActive: true });

    if (subscriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active push subscriptions found for user'
      });
    }

    // Send test notification to all subscriptions
    const results = [];
    for (const subscription of subscriptions) {
      try {
        const notificationData = {
          title: title || 'Test Notification',
          body: body || 'This is a test notification',
          icon: icon || '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'test-notification',
          requireInteraction: true,
          data: {
            notificationId: `test-${Date.now()}`,
            type: 'test',
            userId: userId
          }
        };

        await notificationService.sendNotification(subscription, notificationData);
        results.push({ subscriptionId: subscription._id, status: 'sent' });
      } catch (error) {
        console.error('Error sending test notification to subscription:', subscription._id, error);
        results.push({ subscriptionId: subscription._id, status: 'failed', error: error.message });
      }
    }

    console.log('📧 [Notification] Test notification sent to', results.length, 'subscriptions');

    res.json({
      success: true,
      message: 'Test notification sent',
      data: {
        sentTo: results.filter(r => r.status === 'sent').length,
        total: results.length,
        results
      }
    });
  } catch (error) {
    console.error('❌ [Notification] Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
});

module.exports = router;

