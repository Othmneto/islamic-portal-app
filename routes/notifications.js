"use strict";

/* ------------------------------------------------------------------
   Notifications API (Web Push)
   Endpoints:
     GET  /api/notifications/vapid-public-key
     POST /api/notifications/subscribe
     POST /api/notifications/unsubscribe
     POST /api/notifications/test
     POST /api/notifications/test-prayer
     POST /api/notifications/snooze
------------------------------------------------------------------- */

const express = require("express");
const webPush = require("web-push");
const { z } = require("zod");

const PushSubscription = require("../models/PushSubscription");
const User = require("../models/User");
const logger = require("../utils/logger");
const { env } = require("../config");
const { sendNotification } = require("../services/notificationService"); // Delayed queue-based send for snooze

// --- Configure web-push (VAPID) ---
if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
  logger.warn("[notifications] Missing VAPID keys. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
}
webPush.setVapidDetails(
  `mailto:${env.VAPID_CONTACT || "admin@example.com"}`,
  env.VAPID_PUBLIC_KEY || "",
  env.VAPID_PRIVATE_KEY || ""
);

// --- Validation schemas ---
const SubscriptionKeysSchema = z.object({
  p256dh: z.string().min(20),
  auth: z.string().min(10),
});
const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: SubscriptionKeysSchema,
});
const PreferencesSchema = z
  .object({
    enabled: z.boolean().default(true),
    tz: z.string().min(1),
    perPrayer: z
      .object({
        fajr: z.boolean().optional(),
        dhuhr: z.boolean().optional(),
        asr: z.boolean().optional(),
        maghrib: z.boolean().optional(),
        isha: z.boolean().optional(),
      })
      .default({}),
    method: z.string().default("auto"),
    madhab: z.string().default("auto"),
    highLatRule: z.string().optional(),
    audio: z
      .object({
        file: z.string().default("adhan.mp3"),
        volume: z.number().min(0).max(1).default(1),
      })
      .optional(),
  })
  .default({});
const SubscribeBodySchema = z.object({
  subscription: SubscriptionSchema,
  tz: z.string().min(1),
  preferences: PreferencesSchema.optional(),
  location: z
    .object({
      lat: z.number(),
      lon: z.number(),
      city: z.string().optional(),
    })
    .nullable()
    .optional(),
});
const UnsubscribeBodySchema = z.object({
  endpoint: z.string().url().optional(),
});

const router = express.Router();

// ---- DEBUG: queue stats ----
router.get('/debug/queue-stats', async (req, res) => {
  try {
    const qmod = require('../services/inMemoryNotificationQueue');
    const q = qmod && qmod.getNotificationQueueService && qmod.getNotificationQueueService();
    if (!q) return res.status(503).json({ error: 'queue-unavailable' });
    return res.json({ ok: true, stats: q.getStats(), waiting: q.getJobs('waiting'), delayed: q.getJobs('delayed') });
  } catch (e) {
    return res.status(500).json({ error: 'debug-failed', message: e.message });
  }
});

/** Public: return VAPID public key as plain text */
router.get("/vapid-public-key", (_req, res) => {
  if (!env.VAPID_PUBLIC_KEY) return res.status(500).json({ error: "VAPID public key not configured" });
  res.type("text/plain").send(env.VAPID_PUBLIC_KEY);
});

/** Subscribe or update (saves nested `subscription` exactly as sent) */
router.post("/subscribe", async (req, res) => {
  try {
    // minimal debug (safe)
    const raw = req.body || {};
    console.log("[/api/notifications/subscribe] incoming:", {
      hasBody: !!raw,
      hasSubscription: !!raw.subscription,
      endpoint: raw?.subscription?.endpoint || null,
      tz: raw?.tz || null,
      hasPrefs: !!raw?.preferences,
      hasLoc: !!raw?.location,
    });

    // Debug authentication
    console.log("[/api/notifications/subscribe] auth debug:", {
      hasUser: !!req.user,
      userId: req.user?._id || req.user?.id,
      authSource: req._authSource,
      authHeader: req.headers.authorization ? 'present' : 'missing',
      sessionId: req.session?.id || 'no-session'
    });

    const body = SubscribeBodySchema.parse(req.body);

    const userId = req.user?._id || req.user?.id || null;
    const s = body.subscription;

    // Clean up any existing records with null endpoints globally
    await PushSubscription.deleteMany({ 
      "subscription.endpoint": { $in: [null, ""] } 
    });

    // Delete any existing subscription for this user first
    await PushSubscription.deleteMany({ userId });

    // Create a new subscription
    const doc = await PushSubscription.create({
      userId,
      subscription: s,
      tz: body.tz,
      preferences: body.preferences || undefined,
      location: body.location || undefined,
      ua: req.headers["user-agent"] || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({ ok: true, id: doc._id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.error("[subscribe] ValidationError:", e.errors);
      return res.status(400).json({ error: "ValidationError", details: e.errors });
    }
    console.error("[subscribe] UnexpectedError:", e);
    console.error("[subscribe] Error stack:", e.stack);
    return res.status(500).json({ error: "UnexpectedError", message: e.message });
  }
});

// Unsubscribe endpoint - delete user's subscription
router.post("/unsubscribe", async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Delete all subscriptions for this user
    const result = await PushSubscription.deleteMany({ userId });
    
    console.log(`[unsubscribe] Deleted ${result.deletedCount} subscriptions for user ${userId}`);
    
    return res.status(200).json({ 
      ok: true, 
      deletedCount: result.deletedCount,
      message: "Successfully unsubscribed from notifications" 
    });
  } catch (e) {
    console.error("[unsubscribe] UnexpectedError:", e);
    return res.status(500).json({ error: "UnexpectedError", message: e.message });
  }
});

/** Get notification status for current user */
router.get("/status", async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const subscriptions = await PushSubscription.find({ userId }).lean();
    const user = await User.findById(userId).select('email notificationPreferences').lean();

    return res.status(200).json({
      user: {
        email: user?.email,
        id: userId
      },
      subscriptions: subscriptions.map(sub => ({
        id: sub._id,
        endpoint: sub.subscription?.endpoint,
        tz: sub.tz,
        preferences: sub.preferences,
        location: sub.location,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt
      })),
      preferences: user?.notificationPreferences || {}
    });
  } catch (error) {
    console.error("[status] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** Unsubscribe by endpoint (nested path) */
router.post("/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = UnsubscribeBodySchema.parse(req.body);
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });
    const r = await PushSubscription.deleteOne({ "subscription.endpoint": endpoint });
    return res.status(200).json({ ok: true, deleted: r.deletedCount });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "ValidationError", details: e.errors });
    }
    console.error("[unsubscribe] UnexpectedError:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

/** Build a web-push subscription object from a DB document (supports legacy) */
function toWebPushSubscription(doc) {
  if (doc.subscription?.endpoint) {
    return {
      endpoint: doc.subscription.endpoint,
      expirationTime: doc.subscription.expirationTime ?? null,
      keys: {
        p256dh: doc.subscription.keys?.p256dh,
        auth: doc.subscription.keys?.auth,
      },
    };
  }
  // legacy shape
  return {
    endpoint: doc.endpoint,
    expirationTime: doc.expirationTime ?? null,
    keys: {
      p256dh: doc.keys?.p256dh,
      auth: doc.keys?.auth,
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
    await webPush.sendNotification(
      sub,
      JSON.stringify(payload),
      { TTL: 10, urgency: 'high' }
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      await PushSubscription.deleteOne({ _id: subDoc._id }).catch(() => {});
      console.info(`[notifications] Pruned expired endpoint: ${subDoc._id}`);
    } else {
      console.warn("[notifications] send error:", status, err?.body || err?.message || err);
    }
    return { ok: false, status };
  }
}

/** Find target subscriptions (only valid, sendable ones) */
async function findTargetSubscriptions(userId) {
  const query = {
    "subscription.endpoint": { $exists: true, $ne: null },
    "subscription.keys.p256dh": { $exists: true, $ne: null },
    "subscription.keys.auth": { $exists: true, $ne: null },
  };
  if (userId) query.userId = userId;
  return PushSubscription.find(query).lean();
}

/** POST /test → simple text push (no audio) */
router.post("/test", async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const subs = await findTargetSubscriptions(userId);
    if (!subs.length) return res.status(404).json({ error: "NoSubscriptions" });

    const payload = {
      title: "✅ Notification Test",
      body: "This is a test push from the Islamic Portal.",
      data: { url: "/prayer-time.html" },
      tag: "test-generic",
      requireInteraction: false,
    };

    const results = await Promise.all(subs.map((s) => sendToSubscription(s, payload)));
    const delivered = results.filter((r) => r.ok).length;

    return res.status(200).json({ ok: true, delivered, msg: "Test notification queued" });
  } catch (e) {
    console.error("[notifications] /test error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

/** POST /test-prayer → prayer-like push (includes audioFile hint) */
router.post("/test-prayer", async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const subs = await findTargetSubscriptions(userId);
    if (!subs.length) return res.status(404).json({ error: "NoSubscriptions" });

    // Prayer-like test with actions & data
    const payload = {
      title: "🕌 Prayer Alert (Test)",
      body: "It’s time for prayer (test).",
      icon: "/images/icon-192.png",
      tag: "test-prayer",
      requireInteraction: true,
      data: {
        url: "/prayer-time.html",
        prayer: "test-prayer",
      },
      actions: [
        { action: "snooze", title: "Snooze 5 Min" },
        { action: "mark_prayed", title: "Mark as Prayed" },
      ],
      audioFile: "/audio/adhan.mp3",
    };

    const results = await Promise.all(subs.map((s) => sendToSubscription(s, payload)));
    const delivered = results.filter((r) => r.ok).length;

    return res.status(200).json({ ok: true, delivered, msg: "Prayer test queued" });
  } catch (e) {
    console.error("[notifications] /test-prayer error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

// --- Snooze (queued + delayed via BullMQ) ---
/**
 * POST /snooze -> Re-schedules a notification with a 5-minute delay
 */
router.post("/snooze", async (req, res) => {
  try {
    const { originalPayload, endpoint, delaySeconds } = req.body;
    if (!originalPayload || !endpoint) {
      return res.status(400).json({ error: "Missing payload or endpoint." });
    }

    const subscription = await PushSubscription.findOne({ "subscription.endpoint": endpoint }).lean();
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found." });
    }

    // Simplified Snooze Logic: resend the original payload, just clean the title
    const payloadToResend = {
      ...originalPayload,
      title: (originalPayload.title || "").replace(/^Snooze:\s*/i, ""),
    };

    // Allow custom delay for testing; default to 5 minutes
    const delayMs = Number.isFinite(delaySeconds) ? Math.max(0, delaySeconds * 1000) : (5 * 60 * 1000);

    // Fast-path: deliver via precise timer without queue to avoid latency
    setTimeout(async () => {
      try {
        await sendToSubscription(subscription, payloadToResend);
        logger.info("[notifications] Snooze delivered via direct timer", { endpoint: endpoint?.slice(0, 32) + '...' });
      } catch (e) {
        logger.error("[notifications] Snooze direct delivery failed:", e);
      }
    }, delayMs);

    res.status(200).json({ ok: true, message: "Snooze job scheduled (direct timer).", delayMs });
  } catch (e) {
    logger.error("[notifications] /snooze error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

// Test endpoint for immediate notification testing
router.post("/test-immediate", async (req, res) => {
  try {
    // Debug authentication
    console.log("[test-immediate] Auth debug:", {
      hasUser: !!req.user,
      userId: req.user?._id || req.user?.id,
      authSource: req._authSource,
      authHeader: req.headers.authorization ? 'present' : 'missing',
      sessionId: req.session?.id || 'no-session'
    });

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      console.log("[test-immediate] No user found, returning 401");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user's subscription
    const subscription = await PushSubscription.findOne({ userId }).lean();
    if (!subscription) {
      return res.status(404).json({ error: "No subscription found for user" });
    }

    // Create test notification payload
    const testPayload = {
      title: "🧪 Test Prayer Notification",
      body: "This is a test notification to verify the system is working!",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      data: {
        url: "/prayer-time.html",
        type: "test",
        timestamp: new Date().toISOString()
      }
    };

    // Send immediate notification
    await sendNotification(subscription, testPayload);

    res.status(200).json({ 
      ok: true, 
      message: "Test notification sent immediately",
      payload: testPayload
    });
  } catch (e) {
    logger.error("[notifications] /test-immediate error:", e);
    return res.status(500).json({ error: "UnexpectedError", message: e.message });
  }
});

module.exports = router;
 
// NOTE: debug route is defined earlier to ensure it's registered before export
