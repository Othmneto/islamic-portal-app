const crypto = require('crypto');

class TokenBucketRateLimiter {
  constructor(options = {}) {
    this.capacity = options.capacity || 100; // Maximum tokens in bucket
    this.refillRate = options.refillRate || 10; // Tokens per second
    this.windowMs = options.windowMs || 60000; // 1 minute window
    this.maxBuckets = options.maxBuckets || 10000; // Maximum number of buckets

    // In-memory storage for buckets
    this.buckets = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Compute rate limit key for user:IP composite
   */
  computeRateLimitKeyUserIpCompositeKey(req) {
    const userId = req.user?.id || req.user?._id || 'anonymous';
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // Create composite key: user:ip
    const compositeKey = `user:${userId}:ip:${ip}`;

    // Hash for consistent length and privacy
    return crypto.createHash('sha256').update(compositeKey).digest('hex').substring(0, 16);
  }

  /**
   * Try to consume token from bucket
   */
  tryConsumeTokenFromBucket(key, tokens = 1) {
    const now = Date.now();
    const bucket = this.getOrCreateBucket(key);

    // Refill bucket based on time elapsed
    this.refillBucket(bucket, now);

    // Check if enough tokens available
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      bucket.lastAccess = now;
      this.updateLru(key, bucket);
      return { allowed: true, remaining: bucket.tokens, resetTime: bucket.lastRefill + this.windowMs };
    }

    // Not enough tokens
    bucket.lastAccess = now;
    this.updateLru(key, bucket);
    return {
      allowed: false,
      remaining: bucket.tokens,
      resetTime: bucket.lastRefill + this.windowMs,
      retryAfter: Math.ceil((tokens - bucket.tokens) / this.refillRate * 1000)
    };
  }

  /**
   * Get or create bucket for key
   */
  getOrCreateBucket(key) {
    if (this.buckets.has(key)) {
      return this.buckets.get(key);
    }

    // Create new bucket
    const now = Date.now();
    const bucket = {
      tokens: this.capacity,
      lastRefill: now,
      lastAccess: now,
      lru: now
    };

    this.buckets.set(key, bucket);
    return bucket;
  }

  /**
   * Refill bucket based on time elapsed
   */
  refillBucket(bucket, now) {
    const timeElapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(timeElapsed * this.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  /**
   * Update LRU timestamp
   */
  updateLru(key, bucket) {
    bucket.lru = Date.now();
  }

  /**
   * Prune idle buckets using LRU
   */
  pruneIdleBucketsLruBounded() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const toDelete = [];

    // Find buckets to delete
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastAccess > maxAge) {
        toDelete.push(key);
      }
    }

    // Delete old buckets
    for (const key of toDelete) {
      this.buckets.delete(key);
    }

    // If still too many buckets, remove least recently used
    if (this.buckets.size > this.maxBuckets) {
      const sortedBuckets = Array.from(this.buckets.entries())
        .sort(([,a], [,b]) => a.lru - b.lru);

      const excess = this.buckets.size - this.maxBuckets;
      for (let i = 0; i < excess; i++) {
        this.buckets.delete(sortedBuckets[i][0]);
      }
    }

    if (toDelete.length > 0) {
      console.log(`🧹 [RateLimiter] Pruned ${toDelete.length} idle buckets, ${this.buckets.size} remaining`);
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.pruneIdleBucketsLruBounded();
    }, this.cleanupInterval);
  }

  /**
   * Get bucket info for key
   */
  getBucketInfo(key) {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return null;
    }

    const now = Date.now();
    this.refillBucket(bucket, now);

    return {
      tokens: bucket.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      lastRefill: bucket.lastRefill,
      lastAccess: bucket.lastAccess,
      resetTime: bucket.lastRefill + this.windowMs
    };
  }

  /**
   * Reset bucket for key
   */
  resetBucket(key) {
    this.buckets.delete(key);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalBuckets: this.buckets.size,
      capacity: this.capacity,
      refillRate: this.refillRate,
      windowMs: this.windowMs,
      maxBuckets: this.maxBuckets
    };
  }

  /**
   * Check if key is rate limited
   */
  isRateLimited(key, tokens = 1) {
    const result = this.tryConsumeTokenFromBucket(key, tokens);
    return !result.allowed;
  }

  /**
   * Get remaining tokens for key
   */
  getRemainingTokens(key) {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return this.capacity;
    }

    const now = Date.now();
    this.refillBucket(bucket, now);
    return bucket.tokens;
  }

  /**
   * Get reset time for key
   */
  getResetTime(key) {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return Date.now() + this.windowMs;
    }

    return bucket.lastRefill + this.windowMs;
  }
}

module.exports = TokenBucketRateLimiter;

