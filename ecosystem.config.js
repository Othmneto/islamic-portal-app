// ecosystem.config.js
const path = require('path');
const root = __dirname;

// PM2 process definitions for Windows-hosted Islamic Portal App
// - API: web server
// - Notification Worker: sends web-push from BullMQ queue (fork mode)
// - Prayer Scheduler: enqueues prayer-time jobs (fork mode)

module.exports = {
  apps: [
    // 1) API Server
    {
      name: 'API Server',
      script: path.join(root, 'server.js'),
      cwd: root,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 50,
      exp_backoff_restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        // Make sure these exist in your system/user env or replace with literals
        MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/translator-backend',
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        // Optional: allow boot without Redis during dev
        ALLOW_NO_REDIS: process.env.ALLOW_NO_REDIS || 'false',
        // Security / auth
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
      },
      // out_file: path.join(root, 'logs', 'api-out.log'),
      // error_file: path.join(root, 'logs', 'api-err.log'),
      // time: true,
    },

    // 2) Notification Worker (BullMQ + web-push)
    {
      name: 'Notification Worker',
      script: path.join(root, 'workers', 'notificationWorker.js'),
      cwd: root,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 50,
      exp_backoff_restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        // NOTE (Option A): do NOT set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY here,
        // so the .env values take precedence and are not overridden by empty strings.
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/translator-backend',
        NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME || 'notifications',
        VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      },
      // out_file: path.join(root, 'logs', 'worker-out.log'),
      // error_file: path.join(root, 'logs', 'worker-err.log'),
      // time: true,
    },

    // 3) Prayer Scheduler (enqueues daily/next prayer jobs)
    {
      name: 'Prayer Scheduler',
      script: path.join(root, 'tasks', 'prayerNotificationScheduler.js'),
      cwd: root,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_restarts: 50,
      exp_backoff_restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/translator-backend',
        NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME || 'notifications',
      },
      // out_file: path.join(root, 'logs', 'scheduler-out.log'),
      // error_file: path.join(root, 'logs', 'scheduler-err.log'),
      // time: true,
    },
  ],
};
