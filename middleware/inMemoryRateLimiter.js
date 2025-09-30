// middleware/inMemoryRateLimiter.js - In-Memory Rate Limiter Middleware
'use strict';

const InMemoryRateLimiter = require('../services/inMemoryRateLimiter');

// Create rate limiter instances
const generalLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 login attempts per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const translationLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 translations per minute
  message: 'Too many translation requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

const notificationLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 notification requests per minute
  message: 'Too many notification requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 API requests per window
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Burst rate limiter for handling traffic spikes
const burstLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests in burst, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});

// Progressive rate limiter with escalating penalties
const progressiveLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Start with 5 requests
  message: 'Rate limit exceeded. Penalties will increase with repeated violations.',
  standardHeaders: true,
  legacyHeaders: false
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
  
  // Rate limiter classes (for advanced usage)
  rateLimiters: {
    general: generalLimiter,
    auth: authLimiter,
    login: loginLimiter,
    translation: translationLimiter,
    notification: notificationLimiter,
    api: apiLimiter,
    burst: burstLimiter,
    progressive: progressiveLimiter
  },
  
  // Utility functions
  initializeRateLimiters,
  shutdownRateLimiters,
  getAllStats
};
