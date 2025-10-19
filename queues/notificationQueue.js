// translator-backend/queues/notificationQueue.js - In-Memory Notification Queue with NVMe Persistence
// This file now exports the in-memory version for backward compatibility
const { notificationQueue, InMemoryNotificationQueue } = require('../services/inMemoryNotificationQueue');

// Export the in-memory version
module.exports = {
    notificationQueue,
    InMemoryNotificationQueueService: InMemoryNotificationQueue,
    getNotificationQueueService: () => notificationQueue
};
