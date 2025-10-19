// middleware/inMemoryRateLimiter.js - In-Memory Rate Limiter Middleware
'use strict';

const InMemoryRateLimiter = require('../services/inMemoryRateLimiter');
const TokenBucketRateLimiter = require('../services/rateLimiterTokenBucket');

// Create rate limiter instances with enhanced per-user:IP support
const generalLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 60 * 1000, // 60 minutes (increased)
  max: 2000, // 2000 requests per window (increased)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

const authLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window (increased for Remember Me)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

const loginLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login attempts per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP only for login attempts (before authentication)
    return `ip:${req.ip}`;
  }
});

const translationLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 translations per minute (1 per second)
  message: 'Too many translation requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

const notificationLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 notification requests per minute (1 per second)
  message: 'Too many notification requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

const apiLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 API requests per window
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

// Burst rate limiter for handling traffic spikes
const burstLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests in burst, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

// Progressive rate limiter with escalating penalties
const progressiveLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Start with 5 requests
  message: 'Rate limit exceeded. Penalties will increase with repeated violations.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user:IP composite key for authenticated users
    if (req.user && req.user.id) {
      return `user:${req.user.id}:${req.ip}`;
    }
    return `ip:${req.ip}`;
  }
});

// Token bucket rate limiter for authenticated users (10x multiplier)
const authenticatedUserLimiter = new TokenBucketRateLimiter({
  capacity: 1000, // 1000 tokens
  refillRate: 100, // 100 tokens per second
  windowMs: 60 * 1000, // 1 minute
  maxBuckets: 5000
});

// Initialize all limiters
async function initializeRateLimiters() {
  try {
    // Load existing data from disk
    await Promise.all([
      generalLimiter.loadFromDisk(),
      authLimiter.loadFromDisk(),
      loginLimiter.loadFromDisk(),
      translationLimiter.loadFromDisk(),
      notificationLimiter.loadFromDisk(),
      apiLimiter.loadFromDisk(),
      burstLimiter.loadFromDisk(),
      progressiveLimiter.loadFromDisk()
    ]);

    console.log('🚦 [InMemoryRateLimiters] All rate limiters initialized and loaded from disk');
    return true;
  } catch (error) {
    console.error('❌ [InMemoryRateLimiters] Initialization failed:', error);
    return false;
  }
}

// Shutdown all rate limiters
async function shutdownRateLimiters() {
  try {
    await Promise.all([
      generalLimiter.shutdown(),
      authLimiter.shutdown(),
      loginLimiter.shutdown(),
      translationLimiter.shutdown(),
      notificationLimiter.shutdown(),
      apiLimiter.shutdown(),
      burstLimiter.shutdown(),
      progressiveLimiter.shutdown()
    ]);

    console.log('🚦 [InMemoryRateLimiters] All rate limiters shutdown gracefully');
    return true;
  } catch (error) {
    console.error('❌ [InMemoryRateLimiters] Shutdown failed:', error);
    return false;
  }
}

// Get statistics for all rate limiters
function getAllStats() {
  return {
    general: generalLimiter.getStats(),
    auth: authLimiter.getStats(),
    login: loginLimiter.getStats(),
    translation: translationLimiter.getStats(),
    notification: notificationLimiter.getStats(),
    api: apiLimiter.getStats(),
    burst: burstLimiter.getStats(),
    progressive: progressiveLimiter.getStats()
  };
}

// Middleware for authenticated user rate limiting
function authenticatedUserRateLimit() {
  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return next(); // Skip if not authenticated
    }

    const key = authenticatedUserLimiter.computeRateLimitKeyUserIpCompositeKey(req);
    const result = authenticatedUserLimiter.tryConsumeTokenFromBucket(key, 1);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded for authenticated user',
        retryAfter: Math.ceil(result.retryAfter / 1000),
        remaining: result.remaining,
        resetTime: result.resetTime
      });
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': authenticatedUserLimiter.capacity,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });

    next();
  };
}

module.exports = {
  // Rate limiter instances
  generalLimiter: generalLimiter.middleware(),
  authLimiter: authLimiter.middleware(),
  loginLimiter: loginLimiter.middleware(),
  translationLimiter: translationLimiter.middleware(),
  notificationLimiter: notificationLimiter.middleware(),
  apiLimiter: apiLimiter.middleware(),
  burstLimiter: burstLimiter.middleware(),
  progressiveLimiter: progressiveLimiter.middleware(),
  authenticatedUserLimiter: authenticatedUserRateLimit(),

  // Rate limiter classes (for advanced usage)
  rateLimiters: {
    general: generalLimiter,
    auth: authLimiter,
    login: loginLimiter,
    translation: translationLimiter,
    notification: notificationLimiter,
    api: apiLimiter,
    burst: burstLimiter,
    progressive: progressiveLimiter,
    authenticatedUser: authenticatedUserLimiter
  },

  // Utility functions
  initializeRateLimiters,
  shutdownRateLimiters,
  getAllStats
};
