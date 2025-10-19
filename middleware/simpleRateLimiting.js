// Simplified Rate Limiting for Production (without Redis dependency)
const rateLimit = require('express-rate-limit');

// Enhanced rate limiter with progressive penalties
const createProgressiveRateLimit = (baseConfig) => {
  return rateLimit({
    ...baseConfig,
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      return `rate_limit:${ip}:${userAgent}`;
    },
    handler: (req, res) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      // Log rate limit violation
      console.warn(`🚫 Rate limit exceeded: ${ip}`, {
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(baseConfig.windowMs / 1000),
        message: `Rate limit exceeded. Please try again in ${Math.ceil(baseConfig.windowMs / 60000)} minutes.`
      });
    }
  });
};

// Login rate limiter with progressive penalties
const loginLimiter = createProgressiveRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased for testing (was 3)
  standardHeaders: true,
  legacyHeaders: false,
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

module.exports = {
  loginLimiter,
  registrationLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter
};
