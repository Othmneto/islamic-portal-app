// routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const { requireSession } = require('../middleware/authMiddleware');
const { verifyCsrf } = require('../middleware/csrfMiddleware');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const { queueTestNotification, queueTestPrayerNotification } = require('../services/notificationQueue');
const logger = require('../utils/logger');

// POST /api/notifications/subscribe - Main endpoint to subscribe a user
router.post('/subscribe', requireSession, verifyCsrf, async (req, res) => {
  // The subscription object may be nested inside a 'subscription' key from the client
  const sub = req.body.subscription || req.body;
  const { endpoint, keys } = sub;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ success: false, message: 'Invalid subscription object.' });
  }

  try {
    // 1. Save or update the push subscription endpoint and keys
    await PushSubscription.updateOne(
      { endpoint },
      { userId: req.user.id, endpoint, keys },
      { upsert: true }
    );

    // 2. Save the user's notification preferences and location if provided
    const updates = {};
    if (req.body.preferences && req.body.preferences.perPrayer) {
      updates['notificationPreferences.prayerReminders'] = req.body.preferences.perPrayer;
    }
    if (req.body.location) {
      updates.location = req.body.location;
    }

    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(req.user.id, { $set: updates });
    }

    logger.info(`Subscription and preferences upserted for user ${req.user.id}`);
    res.status(201).json({ success: true, message: 'Subscription and preferences updated.' });

  } catch (error) {
    logger.error('Failed to save push subscription or preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to save subscription.' });
  }
});


// POST /api/notifications/unsubscribe - Remove a subscription
router.post('/unsubscribe', requireSession, verifyCsrf, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ success: false, message: 'Endpoint is required.' });
  }
  try {
    await PushSubscription.deleteOne({ userId: req.user.id, endpoint });
    logger.info(`Subscription removed for user ${req.user.id}`);
    res.status(200).json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (error) {
    logger.error('Failed to unsubscribe:', error);
    res.status(500).json({ success: false, message: 'Failed to unsubscribe.' });
  }
});


// GET /api/notifications/vapid-public-key - Provide the public VAPID key to the client
router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    logger.error('VAPID_PUBLIC_KEY is not set in the environment variables.');
    return res.status(500).send('VAPID public key not configured on the server.');
  }
  res.send(process.env.VAPID_PUBLIC_KEY);
});

// --- Test Routes ---

// POST /api/notifications/test - Send a generic test notification
router.post('/test', requireSession, verifyCsrf, async (req, res) => {
    try {
        await queueTestNotification(req.user.id);
        res.status(202).json({ success: true, message: 'Test notification queued.' });
    } catch (error) {
        logger.error(`Failed to queue test notification for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, error: 'Could not queue test notification.' });
    }
});

// POST /api/notifications/test-prayer - Send a test for the next prayer
router.post('/test-prayer', requireSession, verifyCsrf, async (req, res) => {
    try {
        const result = await queueTestPrayerNotification(req.user.id);
        res.status(202).json({ success: true, msg: result.message });
    } catch (error) {
        logger.error(`Failed to queue test prayer notification for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, error: 'Could not queue test prayer notification.' });
    }
});


module.exports = router;