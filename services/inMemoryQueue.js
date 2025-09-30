// services/inMemoryQueue.js - In-Memory Job Queue with NVMe Persistence
'use strict';

const diskPersistence = require('./diskPersistence');
const { EventEmitter } = require('events');

/**
 * High-performance in-memory job queue with NVMe disk persistence
 * Similar to BullMQ but without Redis dependency
 */
class InMemoryQueue extends EventEmitter {
  constructor(name, options = {}) {
    super();
    
    this.name = name;
    this.options = {
      concurrency: options.concurrency || 5,
      removeOnComplete: options.removeOnComplete || 10,
      removeOnFail: options.removeOnFail || 5,
      attempts: options.attempts || 3,
      backoff: options.backoff || { type: 'exponential', delay: 2000 },
      delay: options.delay || 0,
      ...options
    };
    
    // In-memory storage
    this.jobs = new Map(); // jobId -> job
    this.waiting = []; // waiting jobs
    this.active = new Map(); // active jobs
    this.completed = []; // completed jobs
    this.failed = []; // failed jobs
    this.delayed = new Map(); // delayed jobs
    
    // Processing state
    this.isProcessing = false;
    this.processor = null;
    this.workers = new Set();
    
    // Statistics
    this.stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      processed: 0,
      errors: 0
    };
    
    // Auto-cleanup timers
    this.cleanupTimer = null;
    this.startCleanupTimer();
  }

  /**
   * Add a job to the queue
   */
  async add(jobName, data, options = {}) {
    try {
      const jobId = this.generateJobId();
      const job = {
        id: jobId,
        name: jobName,
        data,
        options: {
          ...this.options,
          ...options,
          delay: options.delay || this.options.delay
        },
        timestamp: Date.now(),
        status: 'waiting',
        attempts: 0,
        maxAttempts: options.attempts || this.options.attempts,
        createdAt: new Date(),
        processedAt: null,
        finishedAt: null,
        failedReason: null
      };

      // Store in memory
      this.jobs.set(jobId, job);
      
      // Add to appropriate queue
      if (job.options.delay > 0) {
        this.addToDelayed(job);
      } else {
        this.addToWaiting(job);
      }

      // Persist to disk
      await this.persistJob(job);

      // Emit event
      this.emit('jobAdded', job);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return { id: jobId, name: jobName, data, options: job.options };
    } catch (error) {
      console.error(`❌ [InMemoryQueue] Add job failed:`, error);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Register a job processor (BullMQ compatibility)
   */
  process(jobName, processor) {
    if (typeof jobName === 'function') {
      // Legacy call: process(processor)
      this.processor = jobName;
      console.log(`📋 [InMemoryQueue] Registered legacy processor`);
      return;
    }
    
    this.jobProcessors = this.jobProcessors || new Map();
    this.jobProcessors.set(jobName, processor);
    console.log(`📋 [InMemoryQueue] Registered processor for job: ${jobName}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Start processing jobs
   */
  async startProcessing() {
    if (this.isProcessing) {
      console.log('⚠️ [InMemoryQueue] Already processing');
      return;
    }

    this.isProcessing = true;
    this.emit('processingStarted');

    while (this.isProcessing && this.waiting.length > 0) {
      const jobId = this.waiting.shift();
      if (!jobId) break;

      const job = this.jobs.get(jobId);
      if (!job) {
        console.error(`❌ [InMemoryQueue] Job not found: ${jobId}`);
        continue;
      }

      try {
        await this.executeJob(job);
      } catch (error) {
        console.error(`❌ [InMemoryQueue] Job execution failed:`, error);
        this.stats.errors++;
      }
    }

    this.isProcessing = false;
    this.emit('processingStopped');
  }

  /**
   * Stop processing
   */
  stop() {
    this.isProcessing = false;
    this.emit('processingStopped');
  }

  /**
   * Get job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs by status
   */
  getJobs(status) {
    switch (status) {
      case 'waiting':
        return this.waiting.map(id => this.jobs.get(id));
      case 'active':
        return Array.from(this.active.values());
      case 'completed':
        return this.completed.map(id => this.jobs.get(id));
      case 'failed':
        return this.failed.map(id => this.jobs.get(id));
      case 'delayed':
        return Array.from(this.delayed.values());
      default:
        return Array.from(this.jobs.values());
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      waiting: this.waiting.length,
      active: this.active.size,
      completed: this.completed.length,
      failed: this.failed.length,
      delayed: this.delayed.size,
      total: this.jobs.size
    };
  }

  /**
   * Clean completed/failed jobs
   */
  clean(grace, status) {
    const now = Date.now();
    let cleaned = 0;

    if (status === 'completed' || !status) {
      const toRemove = this.completed.filter(jobId => {
        const job = this.jobs.get(jobId);
        return job && (now - job.finishedAt) > grace;
      });
      
      toRemove.forEach(jobId => {
        this.jobs.delete(jobId);
        this.completed = this.completed.filter(id => id !== jobId);
        cleaned++;
      });
    }

    if (status === 'failed' || !status) {
      const toRemove = this.failed.filter(jobId => {
        const job = this.jobs.get(jobId);
        return job && (now - job.finishedAt) > grace;
      });
      
      toRemove.forEach(jobId => {
        this.jobs.delete(jobId);
        this.failed = this.failed.filter(id => id !== jobId);
        cleaned++;
      });
    }

    return cleaned;
  }

  /**
   * Close the queue
   */
  async close() {
    this.stop();
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Persist final state
    await this.persistQueueState();
    
    this.emit('closed');
  }

  // Private methods

  generateJobId() {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addToWaiting(job) {
    this.waiting.push(job.id);
    job.status = 'waiting';
    this.stats.waiting = this.waiting.length;
  }

  addToDelayed(job) {
    const delay = job.options.delay;
    const executeAt = Date.now() + delay;
    
    this.delayed.set(job.id, { ...job, executeAt });
    job.status = 'delayed';
    this.stats.delayed = this.delayed.size;

    // Set timeout to move to waiting
    setTimeout(() => {
      if (this.delayed.has(job.id)) {
        this.delayed.delete(job.id);
        this.addToWaiting(job);
        this.stats.delayed = this.delayed.size;
        
        // Start processing if not already running
        if (!this.isProcessing) {
          this.startProcessing();
        }
      }
    }, delay);
  }

  async executeJob(job) {
    try {
      // Move to active
      this.active.set(job.id, job);
      job.status = 'active';
      job.attempts++;
      this.stats.active = this.active.size;
      this.stats.waiting = this.waiting.length;

      this.emit('jobStarted', job);

      // Execute the job using registered processor or default processor
      let result;
      if (this.jobProcessors && this.jobProcessors.has(job.name)) {
        const processor = this.jobProcessors.get(job.name);
        result = await processor(job);
      } else if (this.processor) {
        result = await this.processor(job);
      } else {
        throw new Error(`No processor found for job: ${job.name}`);
      }

      // Job completed successfully
      this.active.delete(job.id);
      this.completed.push(job.id);
      job.status = 'completed';
      job.processedAt = new Date();
      job.finishedAt = Date.now();
      job.result = result;

      this.stats.active = this.active.size;
      this.stats.completed = this.completed.length;
      this.stats.processed++;

      this.emit('jobCompleted', job);

      // Persist job update
      await this.persistJob(job);

      // Cleanup if needed
      this.cleanupJob(job);

    } catch (error) {
      await this.handleJobError(job, error);
    }
  }

  async handleJobError(job, error) {
    // Handle case where job might be a string (from waiting queue)
    if (typeof job === 'string') {
      const jobId = job;
      job = this.jobs.get(jobId);
      if (!job) {
        console.error(`❌ [InMemoryQueue] Job not found: ${jobId}`);
        return;
      }
    }

    this.active.delete(job.id);
    job.attempts++;
    job.failedReason = error.message;

    this.stats.active = this.active.size;

    if (job.attempts < job.maxAttempts) {
      // Retry the job
      const delay = this.calculateBackoffDelay(job.attempts);
      job.options.delay = delay;
      this.addToDelayed(job);
      
      this.emit('jobRetry', job, error);
    } else {
      // Job failed permanently
      this.failed.push(job.id);
      job.status = 'failed';
      job.finishedAt = Date.now();
      
      this.stats.failed = this.failed.length;
      this.stats.errors++;

      this.emit('jobFailed', job, error);

      // Persist job update
      await this.persistJob(job);

      // Cleanup if needed
      this.cleanupJob(job);
    }
  }

  calculateBackoffDelay(attempt) {
    const { type, delay } = this.options.backoff;
    
    switch (type) {
      case 'exponential':
        return delay * Math.pow(2, attempt - 1);
      case 'fixed':
        return delay;
      default:
        return delay;
    }
  }

  cleanupJob(job) {
    // Remove from completed/failed if limits exceeded
    if (job.status === 'completed' && this.completed.length > this.options.removeOnComplete) {
      const toRemove = this.completed.shift();
      this.jobs.delete(toRemove);
    }
    
    if (job.status === 'failed' && this.failed.length > this.options.removeOnFail) {
      const toRemove = this.failed.shift();
      this.jobs.delete(toRemove);
    }
  }

  async persistJob(job) {
    try {
      await diskPersistence.set(job.id, job, 'queues', { immediate: true });
    } catch (error) {
      console.error(`❌ [InMemoryQueue] Persist job failed:`, error);
    }
  }

  async persistQueueState() {
    try {
      const state = {
        waiting: this.waiting,
        completed: this.completed,
        failed: this.failed,
        delayed: Array.from(this.delayed.keys()),
        stats: this.stats,
        timestamp: Date.now()
      };
      
      await diskPersistence.set(`${this.name}_state`, state, 'queues', { immediate: true });
    } catch (error) {
      console.error(`❌ [InMemoryQueue] Persist state failed:`, error);
    }
  }

  async loadFromDisk() {
    try {
      // Load queue state
      const state = await diskPersistence.get(`${this.name}_state`, 'queues');
      if (state) {
        this.waiting = state.waiting || [];
        this.completed = state.completed || [];
        this.failed = state.failed || [];
        this.stats = state.stats || this.stats;
        
        // Load delayed jobs
        const delayedKeys = state.delayed || [];
        for (const key of delayedKeys) {
          const job = await diskPersistence.get(key, 'queues');
          if (job) {
            this.delayed.set(job.id, job);
          }
        }
      }

      // Load all jobs
      const jobKeys = await diskPersistence.keys('queues');
      for (const key of jobKeys) {
        if (key !== `${this.name}_state`) {
          const job = await diskPersistence.get(key, 'queues');
          if (job) {
            this.jobs.set(job.id, job);
          }
        }
      }

      console.log(`📦 [InMemoryQueue] ${this.name} loaded ${this.jobs.size} jobs from disk`);
    } catch (error) {
      console.error(`❌ [InMemoryQueue] Load from disk failed:`, error);
    }
  }

  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.clean(24 * 60 * 60 * 1000); // Clean jobs older than 24 hours
    }, 60 * 60 * 1000); // Run every hour
  }
}

module.exports = InMemoryQueue;
