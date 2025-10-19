// services/notificationQueue.js - In-Memory Notification Queue with NVMe Persistence
// This file now exports the in-memory version for backward compatibility
const { InMemoryNotificationQueueService, getNotificationQueueService } = require('./inMemoryNotificationQueue');

// Export the in-memory version
module.exports = {
    InMemoryNotificationQueueService,
    getNotificationQueueService
};
