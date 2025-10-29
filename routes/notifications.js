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
const { attachUser: authMiddleware, attachUser } = require("../middleware/authMiddleware");
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
    // Reminder minutes validation: 0 (disabled) or 1-60 minutes
    reminderMinutes: z.number().int().min(0).max(60).optional().default(0),
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
  browserInfo: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      pushService: z.string().optional(),
      canBackgroundNotify: z.boolean().optional(),
    })
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

// ✅ SECURITY FIX: Protect all subsequent routes with authentication
router.use(authMiddleware);

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
      browserInfo: raw?.browserInfo || null,
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

    // Validate subscription endpoint
    if (!s || !s.endpoint || typeof s.endpoint !== 'string' || s.endpoint.trim() === '') {
      console.error("[subscribe] Invalid subscription endpoint:", s);
      return res.status(400).json({
        error: "ValidationError",
        message: "Valid subscription endpoint is required"
      });
    }

    // Clean up any existing records with null/empty endpoints globally
    await PushSubscription.deleteMany({
      "subscription.endpoint": { $in: [null, "", undefined] }
    });

    // REMOVED: Multi-device support - Keep ALL subscriptions active for different browsers/devices
    // Users can now receive notifications on all logged-in browsers simultaneously
    console.log("[/api/notifications/subscribe] Keeping all existing subscriptions active (multi-device support)");

    // Use upsert to handle existing subscriptions properly
    const doc = await PushSubscription.findOneAndUpdate(
      { "subscription.endpoint": s.endpoint },
      {
        $set: {
          userId: userId || null,
          subscription: {
            endpoint: s.endpoint,
            expirationTime: typeof s.expirationTime === "number" ? s.expirationTime : null,
            keys: {
              p256dh: String(s.keys?.p256dh || ""),
              auth: String(s.keys?.auth || "")
            }
          },
          tz: body.tz || "UTC",
          preferences: body.preferences || undefined,
          location: body.location || undefined,
          browserInfo: body.browserInfo || undefined, // Store browser information
          ua: req.headers["user-agent"] || "",
          isActive: true, // Mark subscription as active
          lastHealthCheck: new Date(),
          healthCheckFailures: 0,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );

    console.log("[/api/notifications/subscribe] Subscription saved successfully:", {
      id: doc._id,
      endpoint: doc.subscription?.endpoint,
      userId: doc.userId
    });

    // Log ALL subscriptions for this user to verify multi-device setup
    const allUserSubs = await PushSubscription.find({ userId: doc.userId }).lean();
    console.log(`[subscribe] User ${doc.userId} now has ${allUserSubs.length} subscription(s):`);
    allUserSubs.forEach((sub, idx) => {
      const pushService = sub.subscription?.endpoint?.includes('fcm') ? 'FCM(Chrome)' : 
                          sub.subscription?.endpoint?.includes('mozilla') ? 'Mozilla(Firefox)' :
                          sub.subscription?.endpoint?.includes('push.apple.com') ? 'APNs(Safari)' :
                          'Unknown';
      console.log(`  ${idx + 1}. ${pushService} - Active: ${sub.isActive} - Browser: ${sub.browserInfo?.browser || 'unknown'}`);
    });

    return res.status(200).json({ ok: true, id: doc._id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.error("[subscribe] ValidationError:", e.errors);
      return res.status(400).json({ error: "ValidationError", details: e.errors });
    }

    // Handle duplicate key errors specifically
    if (e.code === 11000) {
      console.error("[subscribe] Duplicate key error:", e.message);
      return res.status(409).json({
        error: "DuplicateSubscription",
        message: "Subscription already exists for this endpoint"
      });
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

    // Get user's ACTIVE subscription (most recent one)
    const subscription = await PushSubscription.findOne({ userId, isActive: true })
      .sort({ createdAt: -1 }) // Get most recent
      .lean();
    if (!subscription) {
      return res.status(404).json({ error: "No active subscription found for user" });
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

/**
 * POST /trigger-main-now -> Immediately trigger a MAIN prayer notification (for debugging)
 * Body: { prayerName: 'fajr'|'dhuhr'|'asr'|'maghrib'|'isha' }
 */
router.post("/trigger-main-now", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { prayerName } = req.body || {};
    const allowed = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    if (!allowed.includes(String(prayerName || "").toLowerCase())) {
      return res.status(400).json({ error: "Invalid prayerName. Use one of fajr|dhuhr|asr|maghrib|isha" });
    }

    // Find all active subscriptions for the user
    const subscriptions = await PushSubscription.find({ userId, isActive: true }).lean();
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: "No active subscription found for user" });
    }

    // Build a MAIN prayer-like payload (matches scheduler payload structure)
    const p = String(prayerName).toLowerCase();
    const templateTitles = {
      fajr: "🌅 Fajr Prayer Time",
      dhuhr: "☀️ Dhuhr Prayer Time",
      asr: "🌤️ Asr Prayer Time",
      maghrib: "🌅 Maghrib Prayer Time",
      isha: "🌙 Isha Prayer Time"
    };

    const title = templateTitles[p] || "🕌 Prayer Time";
    const payload = {
      title,
      body: `It's time for ${p.toUpperCase()} prayer`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      color: "#2196F3",
      tag: `${p}-debug-${Date.now()}`,
      requireInteraction: true,
      prayerName: p,
      notificationType: 'main',
      data: {
        url: "/prayer-time.html",
        prayer: p,
        time: new Date().toLocaleTimeString(),
        location: 'Your location',
        category: "prayer-reminders",
        timestamp: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        audioFile: "/audio/adhan.mp3"
      },
      actions: [
        { action: 'prayer-time', title: 'Prayer Time' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      category: "prayer-reminders",
      priority: 'high',
      vibrate: [200, 100, 200],
      audioFile: "/audio/adhan.mp3"
    };

    // Send to all active subscriptions (parallel)
    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendNotification(sub, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    return res.status(200).json({ ok: true, sent: successful, total: subscriptions.length });
  } catch (e) {
    logger.error("[notifications] /trigger-main-now error:", e);
    return res.status(500).json({ error: "UnexpectedError", message: e.message });
  }
});

/**
 * GET /cron-status -> List all active prayer cron jobs (for debugging)
 */
router.get("/cron-status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Access the scheduler registry
    const scheduler = require('../tasks/prayerNotificationScheduler');
    const status = scheduler.getUserScheduleStatus ? 
      scheduler.getUserScheduleStatus(userId.toString()) : 
      { message: "Registry not exposed" };

    return res.json({
      ok: true,
      userId: userId.toString(),
      status
    });
  } catch (e) {
    logger.error("[notifications] /cron-status error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/** Test scheduled reminder endpoint - mimics cron behavior with short delay */
router.post("/test-scheduled-reminder", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { delayMinutes = 2 } = req.body;
    
    // Get ALL user subscriptions (same as cron does)
    const subscriptions = await PushSubscription.find({ 
      userId,
      isActive: true 
    }).lean();
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: "No active subscriptions found" });
    }
    
    console.log(`[test-scheduled-reminder] Found ${subscriptions.length} subscription(s) for user ${userId}`);
    subscriptions.forEach(sub => {
      const pushService = sub.subscription?.endpoint?.includes('fcm') ? 'FCM(Chrome)' : 
                          sub.subscription?.endpoint?.includes('mozilla') ? 'Mozilla(Firefox)' : 'Unknown';
      console.log(`  - ${pushService}: Active=${sub.isActive}`);
    });
    
    const payload = {
      title: "⏰ Test Scheduled Reminder",
      body: `This is a ${delayMinutes}-minute delayed reminder test to verify background notifications work across all browsers`,
      icon: "/favicon.ico",
      tag: "test-scheduled-reminder",
      requireInteraction: true,
      notificationType: 'reminder',
      data: {
        url: "/prayer-time.html",
        category: "test-reminders",
        timestamp: new Date().toISOString()
      }
    };
    
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // Schedule for all subscriptions (simulating cron behavior)
    setTimeout(async () => {
      console.log(`[test-scheduled-reminder] Sending to ${subscriptions.length} subscription(s) NOW`);
      
      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const pushType = sub.subscription?.endpoint?.includes('mozilla') ? 'FIREFOX' : 
                           sub.subscription?.endpoint?.includes('fcm') ? 'CHROME' : 'OTHER';
          
          try {
            await notificationService.sendNotification(sub, payload);
            console.log(`✅ [test-scheduled-reminder] ${pushType} notification sent successfully`);
            return { success: true, pushType };
          } catch (error) {
            console.error(`❌ [test-scheduled-reminder] ${pushType} notification failed:`, error.message);
            return { success: false, pushType, error: error.message };
          }
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      console.log(`[test-scheduled-reminder] Completed: ${successful}/${subscriptions.length} successful`);
    }, delayMinutes * 60 * 1000);
    
    return res.status(200).json({ 
      ok: true, 
      message: `Reminder scheduled for ${subscriptions.length} device(s)`,
      scheduledFor: scheduledFor.toISOString(),
      subscriptionCount: subscriptions.length
    });
  } catch (error) {
    console.error("[test-scheduled-reminder] Error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// --- GET /api/notifications/subscription - List user's active subscriptions ---
router.get("/subscription", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const subscriptions = await PushSubscription.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

    // Enrich with browser info
    const enrichedSubs = subscriptions.map(sub => {
      const endpoint = sub.subscription?.endpoint || '';
      const pushService = endpoint.includes('fcm.googleapis.com') ? 'FCM(Chrome/Edge)' :
                          endpoint.includes('mozilla.com') ? 'Mozilla(Firefox)' :
                          endpoint.includes('push.apple.com') ? 'APNs(Safari)' : 'Unknown';
      
      return {
        id: sub._id,
        isActive: sub.isActive,
        pushService,
        detectedBrowser: sub.detectedBrowser,
        endpoint: endpoint.substring(0, 60) + '...',
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        preferences: sub.preferences
      };
    });

    res.json({
      success: true,
      subscriptions: enrichedSubs,
      total: enrichedSubs.length,
      active: enrichedSubs.filter(s => s.isActive).length
    });
  } catch (error) {
    logger.error("[notifications] /subscription error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- GET /api/notifications/history - Notification delivery history ---
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    const NotificationHistory = require("../models/NotificationHistory");
    
    const [history, total] = await Promise.all([
      NotificationHistory.find({ userId })
        .sort({ sentTime: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      NotificationHistory.countDocuments({ userId })
    ]);

    res.json({
      success: true,
      history,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total
      }
    });
  } catch (error) {
    logger.error("[notifications] /history error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- GET /api/notifications/schedule - Current prayer schedule ---
router.get("/schedule", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const user = await User.findById(userId).select('timezone lastKnownLocation preferences').lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Get prayer times from the calculation service
    const prayerTimeService = require("../services/prayerTimeService");
    const tz = user.timezone || 'UTC';
    const location = user.lastKnownLocation;

    if (!location || !location.lat || !location.lon) {
      return res.json({
        success: true,
        schedule: null,
        message: "No location set. Please set your location to see prayer times."
      });
    }

    const { lat, lon } = location;
    const prayerTimes = await prayerTimeService.getPrayerTimes(lat, lon, tz);

    // Find next prayer
    const now = new Date();
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    let nextPrayer = null;
    let nextReminder = null;

    for (const prayer of prayers) {
      const prayerTime = new Date(prayerTimes[prayer]);
      if (prayerTime > now) {
        nextPrayer = {
          name: prayer,
          time: prayerTime.toISOString(),
          timeFormatted: prayerTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: tz 
          })
        };

        // Calculate reminder time
        const reminderMinutes = user.preferences?.reminderMinutes || 15;
        const reminderTime = new Date(prayerTime.getTime() - reminderMinutes * 60000);
        if (reminderTime > now) {
          nextReminder = {
            prayerName: prayer,
            time: reminderTime.toISOString(),
            timeFormatted: reminderTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: tz 
            }),
            minutesBefore: reminderMinutes
          };
        }
        break;
      }
    }

    res.json({
      success: true,
      schedule: {
        timezone: tz,
        reminderMinutes: user.preferences?.reminderMinutes || 15,
        prayerTimes,
        nextPrayer,
        nextReminder,
        location: {
          lat: location.lat,
          lon: location.lon,
          accuracy: location.accuracy,
          timestamp: location.timestamp
        }
      }
    });
  } catch (error) {
    logger.error("[notifications] /schedule error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// NOTE: debug route is defined earlier to ensure it's registered before export
