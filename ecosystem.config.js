// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'API Server',
      script: 'server.js', // Path to the main server
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'Notification Worker',
      script: './workers/notificationWorker.js', // Path to the worker
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'Prayer Scheduler',
      script: './tasks/prayerNotificationScheduler.js', // Correct path to the scheduler
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};