// translator-backend/queues/notificationQueue.js

const { Queue } = require('bullmq');
const { env } = require('../config'); // zod-validated env

// Centralized Redis connection (password/TLS optional for future hardening)
const connection = {
  host: env.REDIS_HOST,
  port: Number(env.REDIS_PORT),
};

if (env.REDIS_PASSWORD) connection.password = env.REDIS_PASSWORD;
if (String(env.REDIS_TLS || '').toLowerCase() === 'true') connection.tls = {};

const notificationQueue = new Queue('notifications', { connection });

module.exports = { notificationQueue };
