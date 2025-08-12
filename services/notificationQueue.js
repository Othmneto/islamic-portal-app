// services/notificationQueue.js
'use strict';

/**
 * Notification queue using BullMQ (v4+).
 * - v4+ does NOT need QueueScheduler (delayed jobs work natively).
 * - Connects to REDIS_URL (defaults to redis://127.0.0.1:6379).
 * - If ALLOW_NO_REDIS=true, exports a no-op queue so the app can boot without Redis.
 */

const { Queue } = require('bullmq');

const QUEUE_NAME = process.env.NOTIFICATION_QUEUE_NAME || 'notifications';

const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.REDIS_URI ||
  (process.env.REDIS_HOST && process.env.REDIS_PORT
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    : 'redis://127.0.0.1:6379');

const allowNoRedis = String(process.env.ALLOW_NO_REDIS).toLowerCase() === 'true';

let notificationQueue;
let isReady = false;

// No-op stub to avoid crashes when Redis is absent
const stubQueue = {
  async add(name, data, opts) {
    console.warn(
      `[notificationQueue] NO-REDIS MODE: dropped job "${name}" (set REDIS_URL and start Redis to enable).`
    );
    return { id: `noop-${Date.now()}`, name, data, opts };
  },
};

try {
  if (allowNoRedis) {
    console.warn('[notificationQueue] ALLOW_NO_REDIS=true → using no-op queue.');
    notificationQueue = stubQueue;
  } else {
    notificationQueue = new Queue(QUEUE_NAME, { connection: { url: REDIS_URL } });
    isReady = true;
    console.log(
      `[notificationQueue] BullMQ queue "${QUEUE_NAME}" ready @ ${REDIS_URL} (no QueueScheduler required)`
    );
  }
} catch (err) {
  console.error('[notificationQueue] init failed:', err.message);
  notificationQueue = stubQueue; // fail-safe
}

/**
 * Enqueue a push job. `payload` must include:
 *   - subscription: { endpoint, keys: { p256dh, auth }, ... }
 *   - payload: { title, body, data?, tag?, requireInteraction? }
 *   - options?: { webPush?: { TTL, urgency, ... } }
 */
async function addPushJob(payload, opts = {}) {
  const defaults = { removeOnComplete: true, removeOnFail: false };
  const options = { ...defaults, ...opts };
  return notificationQueue.add('send-push', payload, options);
}

/**
 * Convenience helper used by admin/test to enqueue a "test prayer" message.
 * This keeps older code that calls queueTestPrayerNotification() working.
 */
async function queueTestPrayerNotification(userId, subs, messageOverride) {
  const payload = {
    title: 'Prayer Test',
    body: messageOverride || 'This is a test for the next prayer notification path.',
    tag: 'test-prayer',
    data: { url: '/prayer-time.html' },
  };
  if (!Array.isArray(subs)) {
    throw new Error('queueTestPrayerNotification: subs (array) is required');
  }
  const results = await Promise.all(
    subs.map((sub) => addPushJob({ subscription: sub, payload }, { removeOnComplete: true }))
  );
  return { ok: true, count: results.length, message: `Queued ${results.length} test-prayer notification(s).` };
}

function isQueueReady() {
  return isReady || notificationQueue === stubQueue;
}

module.exports = {
  notificationQueue,
  addPushJob,
  queueTestPrayerNotification,
  isQueueReady,
  QUEUE_NAME,
};
