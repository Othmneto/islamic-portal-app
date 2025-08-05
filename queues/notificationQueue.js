const { Queue } = require('bullmq');
const { env } = require('../config'); // Use our validated Zod config

// Defines a queue named 'notifications' that uses your Redis connection
const notificationQueue = new Queue('notifications', {
  connection: { 
    host: env.REDIS_HOST, 
    port: env.REDIS_PORT,
  }
});

module.exports = { notificationQueue };