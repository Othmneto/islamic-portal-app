// translator-backend/routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();

const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const { attachUser, requireSession } = require('../middleware/authMiddleware');
const { verifyCsrf } = require('../middleware/csrfMiddleware');

// Support either services/queues export styles transparently
let notifModule;
try {
  notifModule = require('../queues/notificationQueue');
} catch {
  try {
    notifModule = require('../services/notificationQueue');
  } catch {
    notifModule = {};
  }
}
async function enqueuePush(sub, payload, opts = {}) {
  if (typeof notifModule.addPushJob === 'function') {
    return notifModule.addPushJob({ subscription: sub, payload }, opts);
  }
  if (notifModule.notificationQueue?.add) {
    return notifModule.notificationQueue.add('send-push', { subscription: sub, payload }, opts);
  }
  throw new Error('Push queue module not available');
}

// Always attach user if present (JWT or session), but don't force auth.
router.use(attachUser);

/** Public: VAPID key */
router.get('/vapid-public-key', (_req, res) => {
  const pk = (process.env.VAPID_PUBLIC_KEY || '').trim();
  if (!pk) {
    console.error('VAPID_PUBLIC_KEY is not set in environment variables.');
    return res.status(500).send('VAPID public key not configured.');
  }
  res.type('text').send(pk);
});

/**
 * Subscribe (anonymous allowed; CSRF protected for cookie-based flows)
 * - Upserts by unique endpoint
 * - Stores tz per-subscription (IANA string)
 * - If user is logged-in, optionally updates their preferences and location
 */
router.post('/subscribe', verifyCsrf, async (req, res) => {
  // ==================================================================
  // --- TEMPORARY DEBUGGING BLOCK (REMOVE AFTER DIAGNOSIS) -----------
  // This will tell us if the server recognized your session for THIS request.
  // ==================================================================
  if (!req.user) {
    console.error('[DEBUG] /subscribe hit but req.user is MISSING');
    console.error('[DEBUG] sessionID:', req.sessionID);
    console.error('[DEBUG] req.session:', req.session);
    return res.status(401).json({
      error: 'Server failed to identify your session for this /subscribe request.',
      sessionExists: !!req.session,
      sessionID: req.sessionID || null,
      userIdInSession: req.session ? (req.session.userId || null) : null,
      sawCookiesHeader: typeof req.headers?.cookie === 'string',
    });
  }
  // ==================================================================
  // --- END TEMPORARY DEBUGGING BLOCK --------------------------------
  // ==================================================================

  try {
    const sub = req.body.subscription || req.body;
    const { endpoint, keys } = sub || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object.' });
    }

    const tz = (req.body.tz || 'UTC').trim();
    const preferences = req.body.preferences || null; // { method, madhab, perPrayer }
    const location = req.body.location || null;       // { lat, lon, city, country }

    const userId = req.user?.id || null;

    // Upsert subscription document
    const now = new Date();
    await PushSubscription.updateOne(
      { endpoint },
      {
        $set: { userId, endpoint, keys, tz, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // If authenticated, update user profile (best-effort)
    if (userId) {
      const setOps = {};
      if (preferences) {
        if (typeof preferences.method !== 'undefined') {
          setOps['preferences.calculationMethod'] = preferences.method;
        }
        if (typeof preferences.madhab !== 'undefined') {
          setOps['preferences.madhab'] = preferences.madhab;
        }
        if (preferences.perPrayer && typeof preferences.perPrayer === 'object') {
          setOps['notificationPreferences.prayerReminders'] = preferences.perPrayer;
        }
      }
      if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
        setOps['location'] = {
          lat: Number(location.lat),
          lon: Number(location.lon),
          city: location.city || '',
          country: location.country || '',
        };
      }
      if (Object.keys(setOps).length) {
        await User.updateOne({ _id: userId }, { $set: setOps });
      }
    }

    return res.status(201).json({ success: true, message: 'Subscription saved.' });
  } catch (e) {
    console.error('Failed to save subscription:', e);
    return res.status(500).json({ success: false, message: 'Failed to save subscription.' });
  }
});

/**
 * Unsubscribe (anonymous allowed; CSRF protected)
 * - If a user is logged in, scope deletion by userId+endpoint for safety
 */
router.post('/unsubscribe', verifyCsrf, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint is required.' });
    }

    const query = { endpoint };
    if (req.user?.id) query.userId = req.user.id;

    const result = await PushSubscription.deleteOne(query);
    return res.json({ success: true, deleted: result.deletedCount });
  } catch (e) {
    console.error('Failed to unsubscribe:', e);
    return res.status(500).json({ success: false, message: 'Failed to unsubscribe.' });
  }
});

/** Debug list (requires session) */
router.get('/list', requireSession, async (req, res) => {
  try {
    const subs = await PushSubscription
      .find({ userId: req.user.id })
      .select('endpoint keys.p256dh keys.auth tz createdAt updatedAt -_id');
    res.json({ subscriptions: subs });
  } catch (err) {
    console.error('Failed to fetch subscriptions', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/** Test push (requires session + CSRF) */
router.post('/test', requireSession, verifyCsrf, async (req, res) => {
  try {
    const subs = await PushSubscription.find({ userId: req.user.id }).lean();
    if (!subs.length) {
      return res.status(404).json({ error: 'No subscriptions found for the current user.' });
    }

    const payload = {
      title: 'Test Notification ✅',
      body: `This is a test notification sent at ${new Date().toLocaleTimeString()}.`,
      tag: 'test-push',
      data: { url: '/prayer-time.html' },
    };

    await Promise.all(
      subs.map((sub) => enqueuePush(sub, payload, { removeOnComplete: true, removeOnFail: true }))
    );

    res.json({ success: true, count: subs.length });
  } catch (e) {
    console.error('Failed to queue test push:', e);
    res.status(500).json({ error: 'Failed to queue test push' });
  }
});

module.exports = router;
