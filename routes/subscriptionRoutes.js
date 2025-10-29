// translator-backend/routes/subscriptionRoutes.js

const express = require('express');
const router = express.Router();

const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const { attachUser: authMiddleware } = require('../middleware/authMiddleware');
const { verifyCsrf } = require('../middleware/csrfMiddleware');
const { env } = require('../config');
const { validate, z } = require('../middleware/validate');

// Web push for direct notifications
const webPush = require('web-push');

// Configure web-push with VAPID keys
webPush.setVapidDetails(
  env.VAPID_SUBJECT || 'mailto:admin@islamic-portal.com',
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

// ---------- In-Memory Queue Integration ----------
let notifModule;
try {
  // Use the new in-memory notification queue with NVMe persistence
  notifModule = require('../services/inMemoryNotificationQueue');
  console.log('[subscriptionRoutes] Using in-memory notification queue with NVMe persistence');
} catch (err) {
  console.error('[subscriptionRoutes] In-memory notification queue failed:', err.message);
  notifModule = {};
}

async function enqueuePush({ subscriptionDoc, payload, opts = {} }) {
  if (notifModule?.addPushJob) {
    // Use the new in-memory queue
    if (subscriptionDoc?._id) {
      return notifModule.addPushJob(
        { subscriptionId: subscriptionDoc._id, payload },
        { removeOnComplete: true, removeOnFail: true, ...opts }
      );
    }
    return notifModule.addPushJob(
      { subscription: subscriptionDoc, payload },
      { removeOnComplete: true, removeOnFail: true, ...opts }
    );
  }

  // Fallback: Send notification directly if no queue is available
  console.warn('[subscriptionRoutes] No notification queue available, sending directly');
  return sendToSubscription(subscriptionDoc, payload);
}

/** Convert subscription document to web-push format */
function toWebPushSubscription(doc) {
  if (!doc?.subscription) {
    throw new Error("Invalid subscription document");
  }
  return {
    endpoint: doc.subscription.endpoint,
    keys: {
      p256dh: doc.subscription.keys?.p256dh,
      auth: doc.subscription.keys?.auth,
    },
  };
}

/** Send payload to one subscription immediately via web-push; prune if gone */
async function sendToSubscription(subDoc, payload) {
  try {
    const sub = toWebPushSubscription(subDoc);
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new Error("Invalid subscription in DB");
    }
    await webPush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 });
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      await PushSubscription.deleteOne({ _id: subDoc._id }).catch(() => {});
      console.info(`[subscriptionRoutes] Pruned expired endpoint: ${subDoc._id}`);
    } else {
      console.warn("[subscriptionRoutes] send error:", status, err?.body || err?.message || err);
    }
    return { ok: false, status };
  }
}

// ---------- Validation Schemas (Zod) ----------
const subscriptionShape = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'Missing p256dh'),
    auth: z.string().min(1, 'Missing auth'),
  }),
});

const perPrayerShape = z.object({
  fajr: z.boolean().optional(),
  dhuhr: z.boolean().optional(),
  asr: z.boolean().optional(),
  maghrib: z.boolean().optional(),
  isha: z.boolean().optional(),
}).optional();

const preferencesShape = z.object({
  method: z.string().optional(),
  madhab: z.string().optional(),
  perPrayer: perPrayerShape,
}).optional();

const locationShape = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  city: z.string().optional(),
  country: z.string().optional(),
}).partial().optional();

const subscribeBodySchema = z.object({
  // Accept either {subscription: {...}} or direct {endpoint, keys}
  subscription: subscriptionShape.optional(),
  endpoint: z.string().url().optional(),
  keys: subscriptionShape.shape.keys.optional(),
  tz: z.string().optional(),
  preferences: preferencesShape,
  location: locationShape,
}).superRefine((data, ctx) => {
  const hasNested = !!data.subscription;
  const hasDirect = !!(data.endpoint && data.keys);
  if (!hasNested && !hasDirect) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either "subscription" or "endpoint"+"keys".',
      path: ['subscription'],
    });
  }
});

const subscribeSchema = z.object({ body: subscribeBodySchema });

const unsubscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url('Valid endpoint is required'),
  }),
});

// ---------- Middleware ----------
// ✅ SECURITY FIX: Use JWT-based auth middleware for consistent security
// Note: Individual routes will use authMiddleware as needed

// ---------- Routes ----------

/** GET /api/subscription/vapid-public-key (public) */
router.get('/vapid-public-key', (_req, res) => {
  const pk = (env.VAPID_PUBLIC_KEY || '').trim();
  if (!pk) return res.status(500).send('VAPID public key not configured.');
  res.type('text').send(pk);
});

/**
 * POST /api/subscription/subscribe
 * Anonymous allowed; CSRF-protected for cookie flows.
 * Upserts by endpoint; updates user prefs/location when authenticated.
 */
router.post('/subscribe', verifyCsrf, validate(subscribeSchema), async (req, res) => {
  try {
    const body = req.body;
    const sub = body.subscription || { endpoint: body.endpoint, keys: body.keys };

    // Validate endpoint is present and not null
    if (!sub.endpoint || typeof sub.endpoint !== 'string' || sub.endpoint.trim() === '') {
      return res.status(400).json({ success: false, message: 'Valid endpoint is required.' });
    }

    const tz = typeof body.tz === 'string' ? body.tz.trim() : 'UTC';
    const preferences = body.preferences || null;
    const location = body.location || null;
    const userId = req.user?.id || null;

    const now = new Date();
    await PushSubscription.updateOne(
      { endpoint: sub.endpoint },
      { $set: { userId, endpoint: sub.endpoint, keys: sub.keys, tz, updatedAt: now },
        $setOnInsert: { createdAt: now } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (userId) {
      const setOps = {};
      if (preferences && typeof preferences === 'object') {
        if (typeof preferences.method !== 'undefined') {
          setOps['preferences.calculationMethod'] = String(preferences.method);
        }
        if (typeof preferences.madhab !== 'undefined') {
          setOps['preferences.madhab'] = String(preferences.madhab);
        }
        if (preferences.perPrayer && typeof preferences.perPrayer === 'object') {
          setOps['notificationPreferences.prayerReminders'] = {
            ...(preferences.perPrayer.fajr !== undefined ? { fajr: !!preferences.perPrayer.fajr } : {}),
            ...(preferences.perPrayer.dhuhr !== undefined ? { dhuhr: !!preferences.perPrayer.dhuhr } : {}),
            ...(preferences.perPrayer.asr !== undefined ? { asr: !!preferences.perPrayer.asr } : {}),
            ...(preferences.perPrayer.maghrib !== undefined ? { maghrib: !!preferences.perPrayer.maghrib } : {}),
            ...(preferences.perPrayer.isha !== undefined ? { isha: !!preferences.perPrayer.isha } : {}),
          };
        }
      }
      if (
        location &&
        Number.isFinite(Number(location.lat)) &&
        Number.isFinite(Number(location.lon))
      ) {
        setOps['location'] = {
          lat: Number(location.lat),
          lon: Number(location.lon),
          city: typeof location.city === 'string' ? location.city : '',
          country: typeof location.country === 'string' ? location.country : '',
        };
      }
      if (Object.keys(setOps).length) {
        await User.updateOne({ _id: userId }, { $set: setOps });
      }
    }

    return res.status(201).json({ success: true, message: 'Subscription saved.' });
  } catch (e) {
    console.error('Failed to save subscription:', e);

    // Handle specific MongoDB errors
    if (e.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Subscription already exists. Please try refreshing the page.'
      });
    }

    return res.status(500).json({ success: false, message: 'Failed to save subscription.' });
  }
});

/** POST /api/subscription/unsubscribe (anonymous allowed; CSRF) */
router.post('/unsubscribe', verifyCsrf, validate(unsubscribeSchema), async (req, res) => {
  try {
    const { endpoint } = req.body;

    const query = { endpoint };
    if (req.user?.id) query.userId = req.user.id;

    const result = await PushSubscription.deleteOne(query);
    return res.json({ success: true, deleted: result.deletedCount || 0 });
  } catch (e) {
    console.error('Failed to unsubscribe:', e);
    return res.status(500).json({ success: false, message: 'Failed to unsubscribe.' });
  }
});

/** GET /api/subscription/list (requires JWT auth) */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const subs = await PushSubscription
      .find({ userId: req.user.id })
      .select('endpoint keys.p256dh keys.auth tz createdAt updatedAt');
    return res.json({ subscriptions: subs });
  } catch (err) {
    console.error('Failed to fetch subscriptions', err);
    return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * POST /api/subscription/test
 * Alias: POST /api/subscription/test-push
 * Uses Promise.allSettled so one enqueue failure doesn’t block others.
 */
async function handleTestPush(req, res) {
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

    const results = await Promise.allSettled(
      subs.map((sub) =>
        enqueuePush({
          subscriptionDoc: sub,
          payload,
          opts: { removeOnComplete: true, removeOnFail: true },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (failed) {
      results
        .filter((r) => r.status === 'rejected')
        .forEach((r) => console.error('Failed to enqueue test push:', r.reason));
    }

    return res.json({ success: failed === 0, enqueued: succeeded, failed });
  } catch (e) {
    console.error('Failed to queue test push:', e);
    return res.status(500).json({ error: 'Failed to queue test push' });
  }
}

router.post('/test', authMiddleware, verifyCsrf, handleTestPush);
router.post('/test-push', authMiddleware, verifyCsrf, handleTestPush); // alias/back-compat

module.exports = router;
