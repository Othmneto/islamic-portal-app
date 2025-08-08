// translator-backend/workers/notificationWorker.js

const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const webPush = require('web-push');
const { env } = require('../config');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');

// ----- Web Push (VAPID) -----
const contact = (env.VAPID_EMAIL && env.VAPID_EMAIL.startsWith('mailto:'))
  ? env.VAPID_EMAIL
  : `mailto:${env.VAPID_EMAIL || 'admin@localhost'}`;

webPush.setVapidDetails(contact, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

// ----- Redis connection (BullMQ) -----
const connection = {
  host: env.REDIS_HOST,
  port: Number(env.REDIS_PORT),
};
if (env.REDIS_PASSWORD) connection.password = env.REDIS_PASSWORD;
if (String(env.REDIS_TLS || '').toLowerCase() === 'true') connection.tls = {};

// ----- Start Worker after Mongo connects -----
async function start() {
  try {
    logger.info('📬 Notification worker starting...');
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info('📦 Notification Worker connected to MongoDB.');

    const worker = new Worker(
      'notifications',
      async (job) => {
        const { subscription, payload } = job.data;
        const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

        try {
          await webPush.sendNotification(
            { endpoint: subscription.endpoint, keys: subscription.keys },
            body
          );
          logger.info(`✅ Pushed to ${subscription.endpoint}`);
        } catch (error) {
          // 410/404 = subscription no longer valid; remove from DB
          if (error.statusCode === 410 || error.statusCode === 404) {
            logger.warn(`Subscription gone, deleting: ${subscription.endpoint}`);
            try {
              await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
            } catch (delErr) {
              logger.error('Delete subscription failed', {
                endpoint: subscription.endpoint,
                error: delErr.message,
              });
            }
            // Don’t throw; job can complete even if delete failed
          } else {
            logger.error('Push failed', {
              endpoint: subscription.endpoint,
              error: error.message,
            });
            throw error; // Let BullMQ retry according to your config
          }
        }
      },
      { connection, concurrency: 10 }
    );

    worker.on('completed', (job) => logger.info(`Job ${job.id} completed`));
    worker.on('failed', (job, err) =>
      logger.error(`Job ${job?.id} failed: ${err.message}`)
    );

    // Graceful shutdown
    const shutdown = async () => {
      try {
        await worker.close();
      } catch {}
      try {
        await mongoose.connection.close();
      } catch {}
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    logger.error('Notification Worker failed to start', { error: err.message });
    process.exit(1);
  }
}

start();
