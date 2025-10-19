// services/inMemoryTranslationQueue.js - In-Memory Translation Queue with NVMe Persistence
'use strict';

const InMemoryQueue = require('./inMemoryQueue');
const { translateText } = require('../translationEngineImproved');

/**
 * High-performance in-memory translation queue with NVMe disk persistence
 * Replaces BullMQ Redis-based translation queue
 */
class InMemoryTranslationQueueService {
    constructor() {
        this.queue = new InMemoryQueue('translation-queue', {
            concurrency: 5,
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 }
        });

        this.workers = new Map(); // Track workers by conversation ID
        this.setupEventListeners();
    }

    /**
     * Initialize the translation queue
     */
    async initialize() {
        try {
            // Set up job processor
            this.queue.process(async (job) => {
                return await this.processTranslationJob(job);
            });

            // Load existing jobs from disk
            await this.queue.loadFromDisk();

            console.log('🔄 [InMemoryTranslationQueue] Initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ [InMemoryTranslationQueue] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Add translation job to queue
     */
    async addTranslationJob(jobData) {
        const {
            text,
            from,
            to,
            voiceId,
            sessionId,
            conversationId,
            socket
        } = jobData;

        const job = await this.queue.add('translate', {
            text,
            from,
            to,
            voiceId,
            sessionId,
            conversationId,
            socketId: socket.id
        }, {
            jobId: `${conversationId}_${Date.now()}`,
            priority: this.calculatePriority(text),
            delay: this.calculateDelay(conversationId)
        });

        console.log(`[InMemoryTranslationQueue] Added job ${job.id} for conversation ${conversationId}`);
        return job.id;
    }

    /**
     * Create a worker for a specific conversation
     */
    createWorker(conversationId, io) {
        if (this.workers.has(conversationId)) {
            console.log(`[InMemoryTranslationQueue] Worker already exists for conversation ${conversationId}`);
            return;
        }

        // Store the worker info
        this.workers.set(conversationId, {
            conversationId,
            io,
            createdAt: Date.now()
        });

        console.log(`[InMemoryTranslationQueue] Created worker for conversation ${conversationId}`);
    }

    /**
     * Remove worker for a conversation
     */
    async removeWorker(conversationId) {
        if (this.workers.has(conversationId)) {
            this.workers.delete(conversationId);
            console.log(`[InMemoryTranslationQueue] Removed worker for conversation ${conversationId}`);
        }
    }

    /**
     * Process translation job
     */
    async processTranslationJob(job) {
        const { text, from, to, voiceId, sessionId, conversationId, socketId } = job.data;

        console.log(`[InMemoryTranslationQueue] Processing job ${job.id} for conversation ${conversationId}`);

        try {
            // Get worker for this conversation
            const worker = this.workers.get(conversationId);
            if (!worker) {
                throw new Error(`No worker found for conversation ${conversationId}`);
            }

            // Emit progress update
            worker.io.to(conversationId).emit('translationProgress', {
                jobId: job.id,
                status: 'processing',
                progress: 25
            });

            // Perform translation
            const results = await translateText(text, from, to, voiceId, sessionId);

            // Emit progress update
            worker.io.to(conversationId).emit('translationProgress', {
                jobId: job.id,
                status: 'completed',
                progress: 100
            });

            // Emit final result
            worker.io.to(conversationId).emit('translationResult', {
                jobId: job.id,
                translations: results,
                conversationId,
                timestamp: new Date().toISOString()
            });

            return { success: true, results };
        } catch (error) {
            console.error(`[InMemoryTranslationQueue] Job ${job.id} failed:`, error);

            // Emit error if worker exists
            const worker = this.workers.get(conversationId);
            if (worker) {
                worker.io.to(conversationId).emit('translationError', {
                    jobId: job.id,
                    error: error.message,
                    conversationId
                });
            }

            throw error;
        }
    }

    /**
     * Calculate job priority based on text length and content
     */
    calculatePriority(text) {
        const length = text.length;
        if (length < 50) return 10; // High priority for short texts
        if (length < 200) return 5;  // Medium priority
        return 1; // Low priority for long texts
    }

    /**
     * Calculate delay based on conversation activity
     */
    calculateDelay(conversationId) {
        // Simple delay calculation - can be enhanced with more sophisticated logic
        return Math.random() * 100; // 0-100ms random delay
    }

    /**
     * Get queue statistics
     */
    getStats() {
        const queueStats = this.queue.getStats();
        return {
            ...queueStats,
            workers: this.workers.size
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        // Clear workers
        this.workers.clear();

        // Close queue
        await this.queue.close();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.queue.on('jobCompleted', (job) => {
            console.log(`✅ [InMemoryTranslationQueue] Job completed: ${job.id}`);
        });

        this.queue.on('jobFailed', (job, error) => {
            console.error(`❌ [InMemoryTranslationQueue] Job failed: ${job.id}`, error);
        });

        this.queue.on('jobRetry', (job, error) => {
            console.warn(`🔄 [InMemoryTranslationQueue] Job retry: ${job.id}`, error.message);
        });
    }
}

// Singleton instance
let translationQueueService = null;

function getTranslationQueueService() {
    if (!translationQueueService) {
        translationQueueService = new InMemoryTranslationQueueService();
    }
    return translationQueueService;
}

module.exports = {
    InMemoryTranslationQueueService,
    getTranslationQueueService
};
