// ecosystem.config.js
const path = require('path');
const root = __dirname;

module.exports = {
  apps: [
    // API Server (unchanged is fine, but you can also add env_file here if you want)
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
      env_file: path.join(root, '.env'),
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        ALLOW_NO_REDIS: process.env.ALLOW_NO_REDIS || 'false',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
        // ❗️No MONGO_URI here unless you really want to force a value
      },
    },

    // Notification Worker
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
      env_file: path.join(root, '.env'),
      env: {
        NODE_ENV: 'production',
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME || 'notifications',
        VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        // ❗️No MONGO_URI here – let .env provide it
      },
    },

    // Prayer Scheduler
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
      env_file: path.join(root, '.env'),
      env: {
        NODE_ENV: 'production',
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME || 'notifications',
        // ❗️No MONGO_URI here – let .env provide it
      },
    },
  ],
};
