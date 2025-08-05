// translator-backend/routes/subscriptionRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); 
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const logger = require('../utils/logger');
const { env } = require('../config');
const { sendNotificationToUser } = require('../services/notificationService');

// Test endpoint for sending a notification
router.post('/test-notification', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id; 
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User profile not found.' });
        }
        const payload = {
            title: 'Test Notification from Server 🚀',
            body: 'If you can see this, the push notification system is working!',
            icon: '/favicon.ico',
        };
        await sendNotificationToUser(user._id, payload, 'fajr');
        res.status(200).json({ success: true, message: 'Test notification job has been queued.' });
    } catch (error) {
        next(error);
    }
});

// Endpoint to provide the VAPID public key to the client
router.get('/vapid-public-key', (req, res) => {
  res.send(env.VAPID_PUBLIC_KEY);
});

// Endpoint for clients to subscribe to notifications
router.post('/subscribe', authMiddleware, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id; 
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    const newSubscription = {
      userId: user._id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      platform: 'web',
    };
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      newSubscription,
      { upsert: true }
    );
    logger.info(`User ${user._id} subscribed successfully with endpoint: ${subscription.endpoint}`);
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// --- NEW: Endpoint for clients to unsubscribe from notifications ---
router.post('/unsubscribe', authMiddleware, async (req, res, next) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ msg: 'Subscription endpoint is required.' });
        }

        const deletedSubscription = await PushSubscription.findOneAndDelete({ 
            userId: req.user.id,
            endpoint: endpoint 
        });

        if (deletedSubscription) {
            logger.info(`User ${req.user.id} unsubscribed successfully from endpoint: ${endpoint}`);
            res.status(200).json({ success: true, message: 'Unsubscribed successfully.' });
        } else {
            logger.warn(`No subscription found to delete for user ${req.user.id} with endpoint: ${endpoint}`);
            res.status(404).json({ msg: 'Subscription not found.' });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;