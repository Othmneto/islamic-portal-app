// services/translationQueue.js - In-Memory Translation Queue with NVMe Persistence
// This file now exports the in-memory version for backward compatibility
const { InMemoryTranslationQueueService, getTranslationQueueService } = require('./inMemoryTranslationQueue');

// Export the in-memory version
module.exports = {
    TranslationQueueService: InMemoryTranslationQueueService,
    getTranslationQueueService
};