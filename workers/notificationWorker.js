'use strict';

// Always load .env from project root (works no matter where you run from)
const path = require('path');
const dotenvPath = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: dotenvPath });

const { Worker } = require('bullmq');
const webPush = require('web-push');
const mongoose = require('mongoose');

// Build REDIS_URL from host/port if needed
const REDIS_URL =
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST && process.env.REDIS_PORT
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    : 'redis://127.0.0.1:6379');

const QUEUE_NAME = process.env.NOTIFICATION_QUEUE_NAME || 'notifications';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/translator-backend';

// Fail fast if VAPID keys are missing
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error(
    'VAPID keys missing. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY ' +
    `(loaded .env from: ${dotenvPath}).`
  );
  process.exit(1);
}

process.on('unhandledRejection', (err) => { console.error('unhandledRejection:', err); process.exit(1); });
process.on('uncaughtException',  (err) => { console.error('uncaughtException:',  err); process.exit(1); });

function nowStr() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
function log(level, msg, extra = {}) {
  const base = { service: 'translator-backend', timestamp: nowStr() };
  console[level](`${level}: ${msg}`, { ...base, ...extra });
}

async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URI);
  log('info', '📦 Notification Worker connected to MongoDB.', { mongo: MONGO_URI });
}

function pushSubsCollection() {
  return mongoose.connection.db.collection('pushsubscriptions');
}

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

(async () => {
  log('info', '📬 Notification worker starting...', {
    dotenv: dotenvPath,
    queue: QUEUE_NAME,
    redis: REDIS_URL
  });

  await connectMongo();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== 'send-push') return;

      const { subscription, payload, options } = job.data || {};
      const endpoint = subscription?.endpoint;

      try {
        await webPush.sendNotification(subscription, JSON.stringify(payload), options?.webPush);
        log('info', `Job ${job.id} completed`);
      } catch (err) {
        const statusCode = err?.statusCode;
        // Clean up dead subscriptions (Gone/Not Found)
        if (statusCode === 404 || statusCode === 410) {
          log('warn', 'Subscription gone, deleting', { endpoint });
          try {
            await pushSubsCollection().deleteOne({ endpoint }, { maxTimeMS: 30000 });
          } catch (delErr) {
            log('error', 'Delete subscription failed', { endpoint, error: delErr.message });
          }
          return; // handled; do not retry
        }
        // Let BullMQ retry transient errors (Phase 2 adds attempts/backoff on .add())
        throw err;
      }
    },
    { connection: { url: REDIS_URL }, concurrency: 10 }
  );

  worker.on('ready',     () => log('info', `🔔 BullMQ Worker ready on "${QUEUE_NAME}"`));
  worker.on('failed',    (job, err) => log('error', 'Job failed', { id: job?.id, error: err?.message }));
  worker.on('completed', (job)      => log('info', 'Job completed', { id: job?.id }));
})();
