// translator-backend/workers/notificationWorker.js

const { Worker } = require('bullmq');
const webPush = require('web-push');

// --- NEW: Direct Configuration Loading ---
// This ensures the worker always has the correct environment variables,
// even when run as a separate process by PM2.
const { env } = require('../config');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');


// Configure web-push with your VAPID keys
webPush.setVapidDetails(
  'mailto:support@your-domain.com', // Replace with your support email
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

logger.info('Notification worker starting...');

const worker = new Worker('notifications', async job => {
  const { subscription, payload } = job.data;
  
  if (subscription.platform === 'web') {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };
    try {
      logger.info(`Sending web push to endpoint: ${subscription.endpoint}`);
      await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        logger.warn(`Subscription expired or invalid. Deleting from DB: ${subscription.endpoint}`);
        await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
      } else {
        logger.error('Error sending web push notification.', { error: error.message });
        throw error;
      }
    }
  }
}, {
  // Use the validated environment variables from our config
  connection: { 
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  }
});

worker.on('completed', job => {
  logger.info(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} has failed with ${err.message}`);
});