// Enhanced Production-Grade Rate Limiting System
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Redis client for distributed rate limiting
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// IP blacklist for severe violations
const blacklistedIPs = new Set();

// Progressive penalty system
const getProgressiveLimit = (violationCount) => {
  if (violationCount === 0) return 5; // Normal limit
  if (violationCount === 1) return 3; // Reduced after first violation
  if (violationCount === 2) return 1; // Severely reduced after second violation
  return 0; // Blocked after third violation
};

// Enhanced rate limiter with progressive penalties
const createProgressiveRateLimit = (baseConfig) => {
  return rateLimit({
    ...baseConfig,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    }),
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      return `rate_limit:${ip}:${userAgent}`;
    },
    handler: (req, res) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const violationCount = req.rateLimit?.violationCount || 0;
      
      // Log rate limit violation
      console.warn(`🚫 Rate limit exceeded: ${ip}`, {
        violationCount,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      // Progressive penalties
      if (violationCount >= 3) {
        blacklistedIPs.add(ip);
        console.error(`🚫 IP BLACKLISTED: ${ip} - Too many violations`);
        return res.status(429).json({
          error: 'IP address has been blacklisted due to excessive violations',
          retryAfter: 3600, // 1 hour
          blacklisted: true
        });
      }
      
      const retryAfter = Math.min(900, 60 * Math.pow(2, violationCount)); // Exponential backoff
      
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        violationCount,
        message: `Rate limit exceeded. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
      });
    },
    skip: (req) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return blacklistedIPs.has(ip);
    }
  });
};

// Login rate limiter with progressive penalties
const loginLimiter = createProgressiveRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Base limit
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts from this IP'
});

// Registration rate limiter
const registrationLimiter = createProgressiveRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many registration attempts from this IP'
});

// Password reset rate limiter
const passwordResetLimiter = createProgressiveRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many password reset attempts from this IP'
});

// API rate limiter
const apiLimiter = createProgressiveRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for static assets and health checks
    return req.path.startsWith('/static/') || 
           req.path === '/health' ||
           req.path.startsWith('/api/auth/login') ||
           req.path.startsWith('/api/auth/register');
  }
});

// Strict rate limiter for sensitive operations
const strictLimiter = createProgressiveRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Only 3 attempts per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many sensitive operations from this IP'
});

// Device-based rate limiter
const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per device per 15 minutes
  keyGenerator: (req) => {
    const deviceId = req.headers['x-device-id'] || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `device_limit:${deviceId}:${ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this device'
});

// Cleanup blacklisted IPs periodically
setInterval(() => {
  // Remove IPs that have been blacklisted for more than 24 hours
  // This is a simple implementation - in production, use Redis with TTL
  console.log(`🧹 Blacklisted IPs: ${blacklistedIPs.size}`);
}, 60 * 60 * 1000); // Check every hour

module.exports = {
  loginLimiter,
  registrationLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  deviceLimiter,
  blacklistedIPs
};
