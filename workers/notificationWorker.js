// translator-backend/workers/notificationWorker.js
'use strict';

/**
 * BullMQ Web Push worker (production-ready)
 * - Payloads are now always objects → we always JSON.stringify(payload)
 * - Back-compat for job payloads:
 *   { subscription, payload, options }           // inline
 *   { subscriptionId, payload }                  // DB lookup
 * - Cleans up dead subscriptions (404/410)
 * - Optional logger/model/redis configs (defensive fallbacks)
 * - Graceful shutdown for SIGINT/SIGTERM + fatal errors
 * - Optional DLQ + optional HTTP health endpoints
 * - Exports QUEUE config for optional centralization
 */

const http = require('http');
const { Worker, Queue } = require('bullmq');
const mongoose = require('mongoose');
const webpush = require('web-push');
const { env } = require('../config');

// ----- Logger (optional) -----
let logger = console;
try {
  ({ logger } = require('../config/logger'));
} catch { /* optional */ }

// ----- Optional model; fall back to raw collection if absent -----
let PushSubscription = null;
try {
  PushSubscription = require('../models/PushSubscription');
} catch { /* optional */ }

// ----- Redis connection (prefer exported connection, then ../config/redis, else REDIS_URL) -----
let redisConnection;
try {
  // If queues/notificationQueue exports a connection, prefer it
  const qq = require('../queues/notificationQueue');
  if (qq?.connection) redisConnection = qq.connection;
} catch { /* optional */ }
if (!redisConnection) {
  try {
    const redisExport = require('../config/redis');
    redisConnection = redisExport?.connection || redisExport;
  } catch { /* optional */ }
}
if (!redisConnection) {
  const REDIS_URL =
    env.REDIS_URL ||
    (env.REDIS_HOST && env.REDIS_PORT ? `redis://${env.REDIS_HOST}:${env.REDIS_PORT}` : 'redis://127.0.0.1:6379');
  redisConnection = { url: REDIS_URL };
}

// ----- Queue / Concurrency (exported for optional centralization) -----
const QUEUE_NAME = env.NOTIFICATION_QUEUE_NAME || 'notifications';
const CONCURRENCY = Number(env.WORKER_CONCURRENCY || 10);
module.exports.config = { QUEUE_NAME, CONCURRENCY };

// ----- Optional features (opt-in via env) -----
const ENABLE_DLQ = String(env.ENABLE_DLQ || '').toLowerCase() === 'true';
const HEALTH_PORT = Number(env.WORKER_HEALTH_PORT || 0);

// Prepare DLQ if enabled
const DLQ_NAME = `${QUEUE_NAME}-dlq`;
const dlq = ENABLE_DLQ ? new Queue(DLQ_NAME, { connection: redisConnection }) : null;

// ----- VAPID keys (fail fast) -----
if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
  logger.error('VAPID keys missing. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  process.exit(1);
}
webpush.setVapidDetails(
  env.VAPID_SUBJECT || `mailto:${env.VAPID_EMAIL || 'admin@example.com'}`,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

// ----- Helpers -----
function nowStr() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

// Pino-style object+message pattern
function log(level, msg, extra = {}) {
  const base = { service: 'notification-worker', ts: nowStr() };
  const logObject = { ...base, ...extra };
  if (typeof logger[level] === 'function') {
    logger[level](logObject, msg);
  } else {
    logger.info(logObject, msg);
  }
}

// Normalize DB doc → Web Push subscription shape
function normalizeSubscription(doc) {
  if (!doc) return null;
  // Newer shape: { subscription: { endpoint, keys: { p256dh, auth }, expirationTime? } }
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
  // Legacy: top-level fields
  if (doc.endpoint && doc.keys?.p256dh && doc.keys?.auth) {
    return {
      endpoint: doc.endpoint,
      expirationTime: doc.expirationTime ?? null,
      keys: {
        p256dh: doc.keys.p256dh,
        auth: doc.keys.auth,
      },
    };
  }
  // If already looks like a web-push subscription, pass through
  if (doc.endpoint && doc.keys) return doc;
  return null;
}

function pushSubsRawCollection() {
  return mongoose.connection.db.collection('pushsubscriptions');
}

async function ensureMongoConnected() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
  log('info', '📦 Connected to MongoDB.', { mongo: env.MONGO_URI, db: env.DB_NAME });
}

async function resolveSubscription(jobData) {
  if (jobData?.subscription) return { subscription: jobData.subscription, mode: 'inline' };
  const id = jobData?.subscriptionId;
  if (id && PushSubscription) {
    const doc = await PushSubscription.findById(id).lean();
    if (doc) return { subscription: doc, mode: 'model', id };
  }
  if (id) {
    try {
      const doc = await pushSubsRawCollection().findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (doc) return { subscription: doc, mode: 'raw', id };
    } catch { /* ignore */ }
  }
  return { subscription: null, mode: 'none' };
}

async function deleteSubscription({ id, endpoint }) {
  try {
    if (id) {
      if (PushSubscription) {
        await PushSubscription.findByIdAndDelete(id);
      } else {
        await pushSubsRawCollection().deleteOne({ _id: new mongoose.Types.ObjectId(id) }, { maxTimeMS: 30000 });
      }
      return;
    }
    if (endpoint) {
      if (PushSubscription) {
        // Support nested shape
        const res = await PushSubscription.deleteOne({
          $or: [{ endpoint }, { 'subscription.endpoint': endpoint }],
        });
        if (!res?.deletedCount) {
          // fall back to raw collection
          await pushSubsRawCollection().deleteOne({ endpoint }, { maxTimeMS: 30000 });
          await pushSubsRawCollection().deleteOne({ 'subscription.endpoint': endpoint }, { maxTimeMS: 30000 });
        }
      } else {
        await pushSubsRawCollection().deleteOne({ endpoint }, { maxTimeMS: 30000 });
        await pushSubsRawCollection().deleteOne({ 'subscription.endpoint': endpoint }, { maxTimeMS: 30000 });
      }
    }
  } catch (err) {
    log('error', 'Failed to delete dead subscription', { id, endpoint, error: err?.message });
  }
}

// Classify fatal vs transient: treat most 4xx (except 408/429/404/410) as fatal
function isFatal(err) {
  const sc = err?.statusCode;
  if (typeof sc === 'number') {
    const family = Math.floor(sc / 100);
    if (family === 4 && sc !== 408 && sc !== 429 && sc !== 404 && sc !== 410) return true;
  }
  const name = err?.name || '';
  return name === 'TypeError' || name === 'SyntaxError';
}

// ----- Lifecycle / signals -----
let worker;               // set after start
let shuttingDown = false; // prevent double shutdown
let lastEventAt = Date.now();

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    log('info', 'Shutting down worker…');
    if (worker) await worker.close(); // stop polling new jobs
    if (mongoose.connection.readyState) await mongoose.connection.close();
    if (dlq) await dlq.close();
  } catch (e) {
    log('error', 'Error during worker shutdown', { error: e?.message });
  } finally {
    process.exit(exitCode);
  }
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT',  () => shutdown(0));
process.on('unhandledRejection', (err) => { log('error', 'UnhandledRejection', { error: err?.message }); shutdown(1); });
process.on('uncaughtException',  (err) => { log('error', 'UncaughtException',  { error: err?.message }); shutdown(1); });

// Optional in-process health server
if (HEALTH_PORT > 0) {
  http.createServer((req, res) => {
    if (req.url === '/livez' || req.url === '/healthz') {
      const status = {
        up: true,
        queue: QUEUE_NAME,
        dlq: ENABLE_DLQ ? DLQ_NAME : null,
        shuttingDown,
        lastEventAt,
        mongoState: mongoose.connection.readyState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(status));
    }
    res.writeHead(404).end();
  }).listen(HEALTH_PORT, () => log('info', `Health endpoint on :${HEALTH_PORT} (/healthz,/livez)`));
}

// ----- Bootstrap -----
(async () => {
  log('info', '📬 Notification worker starting…', {
    queue: QUEUE_NAME,
    redis: redisConnection?.url || '[custom connection]',
    dlq: ENABLE_DLQ ? DLQ_NAME : '(disabled)',
  });

  await ensureMongoConnected();

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== 'send-push') return;

      const { payload, options } = job.data || {};
      const { subscription: subDoc, mode, id } = await resolveSubscription(job.data);

      if (!subDoc) {
        log('warn', 'No subscription found for job; skipping', { jobId: job.id, mode, id });
        return;
      }

      const webPushSub = normalizeSubscription(subDoc);
      if (!webPushSub?.endpoint || !webPushSub?.keys?.p256dh || !webPushSub?.keys?.auth) {
        log('error', 'Invalid subscription shape; skipping', { jobId: job.id, mode, id });
        try { job.discard(); } catch {}
        return;
      }

      const endpoint = webPushSub.endpoint;
      try {
        // Payload is always an object now → always stringify
        await webpush.sendNotification(webPushSub, JSON.stringify(payload), options?.webPush);
        log('info', 'Push sent', { jobId: job.id, endpoint });
      } catch (err) {
        const status = err?.statusCode;

        // Clean up dead subscriptions
        if (status === 404 || status === 410) {
          log('warn', 'Subscription gone; deleting', { endpoint, id });
          await deleteSubscription({ id, endpoint });
          return; // handled; don't retry
        }

        // Non-retryable: discard and optionally mirror to DLQ
        if (isFatal(err)) {
          try { job.discard(); } catch { /* best effort */ }
          if (ENABLE_DLQ && dlq) {
            await dlq.add('dead-letter', {
              job: { id: job.id, name: job.name, data: job.data },
              error: { message: err?.message, statusCode: status, stack: err?.stack },
              meta: { endpoint, subscriptionId: id, ts: Date.now() },
            }, { removeOnComplete: true, removeOnFail: true });
          }
        }

        // Throw to let BullMQ apply attempts/backoff for transient cases
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
    }
  );

  worker.on('ready',     () => { lastEventAt = Date.now(); log('info', `🔔 BullMQ Worker ready on "${QUEUE_NAME}"`); });
  worker.on('failed',    (job, err) => { lastEventAt = Date.now(); log('error', 'Job failed', { id: job?.id, error: err?.message }); });
  worker.on('completed', (job)      => { lastEventAt = Date.now(); log('info', 'Job completed', { id: job?.id }); });
})();

module.exports = worker;
