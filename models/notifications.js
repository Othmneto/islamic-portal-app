"use strict";

const express = require("express");
const webPush = require("web-push");
const { z } = require("zod");

const PushSubscription = require("../models/PushSubscription");
const logger = require("../utils/logger");
const { env } = require("../config");

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
const PreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  tz: z.string().min(1),
  perPrayer: z.object({
    fajr: z.boolean(),
    dhuhr: z.boolean(),
    asr: z.boolean(),
    maghrib: z.boolean(),
    isha: z.boolean(),
  }).partial().default({}),
  method: z.string().default("auto"),
  madhab: z.string().default("auto"),
  highLatRule: z.string().optional(),
  audio: z.object({
    file: z.string().default("adhan.mp3"),
    volume: z.number().min(0).max(1).default(1),
  }).optional(),
});
const SubscribeBodySchema = z.object({
  subscription: SubscriptionSchema,
  tz: z.string().min(1),
  preferences: PreferencesSchema.optional(),
  location: z.object({
    lat: z.number(),
    lon: z.number(),
    city: z.string().optional(),
  }).nullable().optional(),
});
const UnsubscribeBodySchema = z.object({
  endpoint: z.string().url().optional(),
});

const router = express.Router();

/** Public: return VAPID public key as plain text */
router.get("/vapid-public-key", (_req, res) => {
  if (!env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: "VAPID public key not configured" });
  }
  res.type("text/plain").send(env.VAPID_PUBLIC_KEY);
});

/** Subscribe or update a subscription (store correct schema fields) */
router.post("/subscribe", async (req, res) => {
  try {
    const body = SubscribeBodySchema.parse(req.body);

    const userId = req.user?._id || req.user?.id || null;
    const s = body.subscription;

    const doc = await PushSubscription.findOneAndUpdate(
      { "subscription.endpoint": s.endpoint },
      {
        $set: {
          userId,
          subscription: s,
          tz: body.tz,
          preferences: body.preferences || undefined,
          location: body.location || undefined,
          ua: req.headers["user-agent"] || "",
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    ).lean();

    return res.status(200).json({ ok: true, id: doc._id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "ValidationError", details: e.errors });
    }
    logger.error("[notifications] /subscribe error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

/** Unsubscribe by endpoint */
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
    logger.error("[notifications] /unsubscribe error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

/** Build a web-push subscription object from a DB document */
function toWebPushSubscription(doc) {
  return {
    endpoint: doc.subscription.endpoint,
    expirationTime: doc.subscription.expirationTime ?? null,
    keys: {
      p256dh: doc.subscription.keys?.p256dh,
      auth: doc.subscription.keys?.auth,
    },
  };
}

/** Send payload to one subscription; prune if gone */
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
      logger.info(`[notifications] Pruned expired endpoint: ${subDoc.endpoint}`);
    } else {
      logger.warn("[notifications] send error:", status, err?.body || err?.message || err);
    }
    return { ok: false, status };
  }
}

/** Find target subscriptions */
async function findTargetSubscriptions(userId) {
  return userId
    ? PushSubscription.find({ userId }).lean()
    : PushSubscription.find({}).lean();
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
    logger.error("[notifications] /test error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

/** POST /test-prayer → prayer-like push (includes audioFile hint) */
router.post("/test-prayer", async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const subs = await findTargetSubscriptions(userId);
    if (!subs.length) return res.status(404).json({ error: "NoSubscriptions" });

    const payload = {
      title: "🕌 Prayer Alert (Test)",
      body: "It’s time for prayer (test).",
      data: { url: "/prayer-time.html" },
      tag: "test-prayer",
      requireInteraction: true,
      audioFile: "/audio/adhan.mp3",
    };

    const results = await Promise.all(subs.map((s) => sendToSubscription(s, payload)));
    const delivered = results.filter((r) => r.ok).length;

    return res.status(200).json({ ok: true, delivered, msg: "Prayer test queued" });
  } catch (e) {
    logger.error("[notifications] /test-prayer error:", e);
    return res.status(500).json({ error: "UnexpectedError" });
  }
});

// Legacy alias kept for older frontends
router.post("/test-prayer-notification", (req, res) => router.handle(req, res));

module.exports = router;