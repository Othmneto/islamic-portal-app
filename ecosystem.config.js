// ecosystem.config.js
const path = require('path');
const root = __dirname;

module.exports = {
  apps: [
    // API Server
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
      env_file: path.join(root, '.env'), // This will correctly load all secrets from .env
      env: {
        // We only define non-secret variables here.
        // JWT_SECRET has been removed to prevent overrides.
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        // Redis removed - using in-memory solution with NVMe persistence
      },
    },

    // Notification Worker removed - using in-memory queues integrated in main server

    // Prayer Scheduler
    {
      name: 'Prayer Scheduler',
      script: path.join(root, 'tasks', 'prayerNotificationScheduler.js'),
      // ... (rest of the file is the same)
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
        // Redis removed - using in-memory solution with NVMe persistence
        NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME || 'notifications',
      },
    },
  ],
};
