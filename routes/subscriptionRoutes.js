// translator-backend/routes/subscriptionRoutes.js

const express = require('express');
const router = express.Router();

const requireSession = require('../middleware/requireSession');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');
const { env } = require('../config');
const { notificationQueue } = require('../queues/notificationQueue');

// A simple CSRF verification middleware.
// This checks if the 'x-csrf-token' header matches the 'XSRF-TOKEN' cookie.
function verifyCsrf(req, res, next) {
  const header = req.get('x-csrf-token');
  const cookie = req.cookies['XSRF-TOKEN'];
  if (!header || !cookie || header !== cookie) {
    logger.warn('Invalid CSRF token attempt', { userId: req.user?.id, path: req.path });
    return res.status(403).json({ msg: 'Invalid CSRF token' });
  }
  next();
}

// VAPID public key (no authentication needed)
router.get('/vapid-public-key', (_req, res) => {
  res.send(env.VAPID_PUBLIC_KEY);
});

// Save or update a subscription.
// Protected by both session and CSRF middleware.
router.post('/subscribe', requireSession, verifyCsrf, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ msg: 'Invalid subscription object provided.' });
  }
  try {
    await PushSubscription.updateOne(
      { endpoint },
      { userId: req.user.id, endpoint, keys },
      { upsert: true } // Creates a new subscription if one doesn't exist for the endpoint.
    );
    logger.info(`Subscription upserted for user ${req.user.id}`);
    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Error saving push subscription', { userId: req.user.id, error: error.message });
    res.status(500).send('Server Error');
  }
});

// Unsubscribe from push notifications.
// Protected by both session and CSRF middleware.
router.post('/unsubscribe', requireSession, verifyCsrf, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ msg: 'Endpoint is required to unsubscribe.' });
  }
  try {
    const result = await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
    if (result.deletedCount === 0) {
        logger.warn(`Unsubscribe attempt failed for non-existent subscription for user ${req.user.id}`);
    } else {
        logger.info(`Subscription deleted for user ${req.user.id}`);
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting subscription', { userId: req.user.id, error: error.message });
    res.status(500).send('Server Error');
  }
});

// Send a test push notification.
// Protected by both session and CSRF middleware.
router.post('/test', requireSession, verifyCsrf, async (req, res) => {
  try {
    const subs = await PushSubscription.find({ userId: req.user.id }).lean();
    if (subs.length === 0) {
        return res.status(404).json({ ok: false, message: "No subscriptions found for this user." });
    }
    
    let queued = 0;
    for (const s of subs) {
      await notificationQueue.add(
        'test-notification',
        {
          subscription: { endpoint: s.endpoint, keys: s.keys },
          payload: {
            title: 'Test Notification',
            body: 'If you see this, Web Push is working ✅',
            icon: '/favicon.ico',
            data: { url: '/' },
          },
        },
        { removeOnComplete: true, removeOnFail: true }
      );
      queued++;
    }
    logger.info(`Queued ${queued} test notifications for user ${req.user.id}`);
    res.json({ ok: true, queued });
  } catch (e) {
    logger.error('Failed to queue test notification', { userId: req.user.id, error: e.message });
    res.status(500).json({ ok: false, error: 'Failed to queue test notification' });
  }
});

// List all active subscriptions for the logged-in user.
// Only protected by session middleware, as GET requests don't require CSRF.
router.get('/list', requireSession, async (req, res) => {
  try {
    const subs = await PushSubscription.find({ userId: req.user.id })
      .select('endpoint createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ ok: true, count: subs.length, subscriptions: subs });
  } catch (e) {
    logger.error('Failed to list subscriptions', { userId: req.user.id, error: e.message });
    res.status(500).json({ ok: false, error: 'Failed to list subscriptions' });
  }
});

module.exports = router;