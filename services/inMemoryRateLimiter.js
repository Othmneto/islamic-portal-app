// services/inMemoryRateLimiter.js - In-Memory Rate Limiter with NVMe Persistence
'use strict';

const diskPersistence = require('./diskPersistence');

/**
 * High-performance in-memory rate limiter with NVMe disk persistence
 * Production-ready with automatic cleanup and recovery
 */
class InMemoryRateLimiter {
  constructor(options = {}) {
    this.options = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 100, // max requests per window
      keyGenerator: options.keyGenerator || ((req) => req.ip || 'unknown'),
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      standardHeaders: options.standardHeaders || true,
      legacyHeaders: options.legacyHeaders || false,
      message: options.message || 'Too many requests',
      ...options
    };

    // In-memory storage
    this.counters = new Map(); // key -> { count, resetTime, window }
    this.blacklist = new Set(); // blacklisted keys
    this.violations = new Map(); // key -> violation count
    
    // Cleanup timers
    this.cleanupTimer = null;
    this.syncTimer = null;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      violations: 0,
      blacklisted: 0
    };

    this.startCleanupTimer();
    this.startSyncTimer();
  }

  /**
   * Create rate limiter middleware
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const key = this.options.keyGenerator(req);
        const now = Date.now();
        const window = Math.floor(now / this.options.windowMs);
        const windowKey = `${key}:${window}`;

        // Check if key is blacklisted
        if (this.blacklist.has(key)) {
          this.stats.blockedRequests++;
          this.stats.blacklisted++;
          return this.sendRateLimitResponse(res, 0, window);
        }

        // Get current count
        let counter = this.counters.get(windowKey);
        if (!counter) {
          counter = {
            count: 0,
            resetTime: (window + 1) * this.options.windowMs,
            window: window,
            key: key
          };
          this.counters.set(windowKey, counter);
        }

        // Check if limit exceeded
        if (counter.count >= this.options.max) {
          await this.handleRateLimitExceeded(key, req, res);
          this.stats.blockedRequests++;
          return this.sendRateLimitResponse(res, counter.count, counter.resetTime);
        }

        // Increment counter
        counter.count++;
        this.counters.set(windowKey, counter);
        this.stats.totalRequests++;
        this.stats.allowedRequests++;

        // Set rate limit headers
        this.setRateLimitHeaders(res, counter.count, counter.resetTime);

        next();
      } catch (error) {
        console.error('❌ [InMemoryRateLimiter] Middleware error:', error);
        next(); // Continue on error
      }
    };
  }

  /**
   * Check if key is rate limited
   */
  isRateLimited(key) {
    const now = Date.now();
    const window = Math.floor(now / this.options.windowMs);
    const windowKey = `${key}:${window}`;
    
    const counter = this.counters.get(windowKey);
    return counter && counter.count >= this.options.max;
  }

  /**
   * Get current count for key
   */
  getCount(key) {
    const now = Date.now();
    const window = Math.floor(now / this.options.windowMs);
    const windowKey = `${key}:${window}`;
    
    const counter = this.counters.get(windowKey);
    return counter ? counter.count : 0;
  }

  /**
   * Reset counter for key
   */
  resetKey(key) {
    const now = Date.now();
    const window = Math.floor(now / this.options.windowMs);
    const windowKey = `${key}:${window}`;
    
    this.counters.delete(windowKey);
    this.violations.delete(key);
    this.blacklist.delete(key);
  }

  /**
   * Blacklist a key
   */
  blacklistKey(key, duration = 24 * 60 * 60 * 1000) { // 24 hours default
    this.blacklist.add(key);
    
    // Auto-remove from blacklist after duration
    setTimeout(() => {
      this.blacklist.delete(key);
    }, duration);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeCounters: this.counters.size,
      blacklistedKeys: this.blacklist.size,
      violationKeys: this.violations.size
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.counters.clear();
    this.blacklist.clear();
    this.violations.clear();
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      violations: 0,
      blacklisted: 0
    };
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    // Final sync to disk
    await this.syncToDisk();
  }

  // Private methods

  async handleRateLimitExceeded(key, req, res) {
    // Increment violation count
    const violationCount = (this.violations.get(key) || 0) + 1;
    this.violations.set(key, violationCount);
    this.stats.violations++;

    // Progressive penalties
    if (violationCount >= 3) {
      this.blacklistKey(key, 24 * 60 * 60 * 1000); // 24 hours
      console.warn(`🚫 [RateLimiter] Key blacklisted: ${key} (${violationCount} violations)`);
    } else if (violationCount >= 2) {
      // Reduce rate limit for repeat offenders
      this.options.max = Math.max(1, Math.floor(this.options.max / 2));
      console.warn(`⚠️ [RateLimiter] Reduced rate limit for key: ${key}`);
    }

    // Log security event
    await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      key,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      path: req.path,
      method: req.method,
      violationCount,
      timestamp: new Date().toISOString()
    });
  }

  sendRateLimitResponse(res, count, resetTime) {
    const remaining = Math.max(0, this.options.max - count);
    
    if (this.options.standardHeaders) {
      res.set({
        'X-RateLimit-Limit': this.options.max,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': new Date(resetTime).toISOString()
      });
    }

    if (this.options.legacyHeaders) {
      res.set({
        'X-RateLimit-Limit': this.options.max,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000)
      });
    }

    return res.status(429).json({
      error: 'Too Many Requests',
      message: this.options.message,
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
    });
  }

  setRateLimitHeaders(res, count, resetTime) {
    const remaining = Math.max(0, this.options.max - count);
    
    if (this.options.standardHeaders) {
      res.set({
        'X-RateLimit-Limit': this.options.max,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': new Date(resetTime).toISOString()
      });
    }

    if (this.options.legacyHeaders) {
      res.set({
        'X-RateLimit-Limit': this.options.max,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000)
      });
    }
  }

  startCleanupTimer() {
    if (!this.options || !this.options.windowMs) {
      console.warn('[InMemoryRateLimiter] Cannot start cleanup timer: options not initialized');
      return;
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.windowMs); // Cleanup every window
  }

  startSyncTimer() {
    this.syncTimer = setInterval(async () => {
      await this.syncToDisk();
    }, 30000); // Sync every 30 seconds
  }

  cleanup() {
    if (!this.options || !this.options.windowMs) {
      return; // Skip cleanup if options are not properly initialized
    }
    
    const now = Date.now();
    const currentWindow = Math.floor(now / this.options.windowMs);
    
    // Remove expired counters
    for (const [key, counter] of this.counters.entries()) {
      if (counter && counter.window && counter.window < currentWindow - 1) { // Keep current and previous window
        this.counters.delete(key);
      }
    }

    // Remove expired violations (older than 24 hours)
    const dayAgo = now - (24 * 60 * 60 * 1000);
    for (const [key, violation] of this.violations.entries()) {
      if (violation && violation.timestamp && violation.timestamp < dayAgo) {
        this.violations.delete(key);
      }
    }
  }

  async syncToDisk() {
    try {
      // Sync counters
      const countersData = Object.fromEntries(this.counters);
      await diskPersistence.set('rate_limit_counters', countersData, 'ratelimits');
      
      // Sync violations
      const violationsData = Object.fromEntries(this.violations);
      await diskPersistence.set('rate_limit_violations', violationsData, 'ratelimits');
      
      // Sync blacklist
      const blacklistData = Array.from(this.blacklist);
      await diskPersistence.set('rate_limit_blacklist', blacklistData, 'ratelimits');
      
      // Sync stats
      await diskPersistence.set('rate_limit_stats', this.stats, 'ratelimits');
    } catch (error) {
      console.error('❌ [InMemoryRateLimiter] Sync to disk failed:', error);
    }
  }

  async loadFromDisk() {
    try {
      // Load counters
      const countersData = await diskPersistence.get('rate_limit_counters', 'ratelimits');
      if (countersData) {
        this.counters = new Map(Object.entries(countersData));
      }
      
      // Load violations
      const violationsData = await diskPersistence.get('rate_limit_violations', 'ratelimits');
      if (violationsData) {
        this.violations = new Map(Object.entries(violationsData));
      }
      
      // Load blacklist
      const blacklistData = await diskPersistence.get('rate_limit_blacklist', 'ratelimits');
      if (blacklistData && Array.isArray(blacklistData)) {
        this.blacklist = new Set(blacklistData);
      }
      
      // Load stats
      const statsData = await diskPersistence.get('rate_limit_stats', 'ratelimits');
      if (statsData) {
        this.stats = { ...this.stats, ...statsData };
      }

      console.log(`🚦 [InMemoryRateLimiter] Loaded from disk: ${this.counters.size} counters, ${this.blacklist.size} blacklisted`);
    } catch (error) {
      console.error('❌ [InMemoryRateLimiter] Load from disk failed:', error);
    }
  }

  async logSecurityEvent(eventType, metadata) {
    try {
      // This would integrate with your existing security logging
      console.log(`🔍 [Security] ${eventType}:`, metadata);
    } catch (error) {
      console.error('❌ [InMemoryRateLimiter] Security logging failed:', error);
    }
  }
}

module.exports = InMemoryRateLimiter;
