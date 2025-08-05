module.exports = {
  apps : [{
    name   : "api-server",
    script : "./server.js",

  }, {
    name   : "notification-worker",
    script : "./workers/notificationWorker.js"
  }, {
      name   : "prayer-scheduler",
      script : "./tasks/prayerNotificationScheduler.js"
	 }]
}