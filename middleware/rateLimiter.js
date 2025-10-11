// Enhanced Rate Limiting Middleware
const { get, set, del } = require('../services/diskPersistence');
const { safeLogSecurityViolation } = require('./securityLogging');
const { createError } = require('./errorHandler');

/**
 * Rate limiter configuration
 */
const RATE_LIMITS = {
  // Authentication endpoints
  login: { windowMs: 15 * 60 * 1000, max: 30, message: 'Too many login attempts' },
  register: { windowMs: 60 * 60 * 1000, max: 3, message: 'Too many registration attempts' },
  passwordReset: { windowMs: 60 * 60 * 1000, max: 3, message: 'Too many password reset attempts' },
  emailVerification: { windowMs: 60 * 60 * 1000, max: 5, message: 'Too many email verification attempts' },
  
  // OAuth endpoints
  oauth: { windowMs: 15 * 60 * 1000, max: 50, message: 'Too many OAuth attempts' },
  
  // API endpoints
  api: { windowMs: 15 * 60 * 1000, max: 100, message: 'Too many API requests' },
  translation: { windowMs: 60 * 1000, max: 20, message: 'Too many translation requests' },
  
  // General endpoints
  general: { windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests' }
};

/**
 * Create rate limiter middleware
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests',
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false
  } = options;

  return async (req, res, next) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}:${req.route?.path || req.path}`;
      const now = Date.now();
      const window = Math.floor(now / windowMs);
      const windowKey = `${key}:${window}`;

      // Get current count
      const currentCount = await get(windowKey) || '0';

      const count = parseInt(currentCount) || 0;

      // Check if limit exceeded
      if (count >= max) {
        // Log rate limit violation
        await safeLogSecurityViolation('RATE_LIMIT_EXCEEDED', {
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          path: req.path,
          method: req.method,
          limit: max,
          window: windowMs,
          count: count
        });

        // Set rate limit headers
        if (standardHeaders) {
          res.set({
            'X-RateLimit-Limit': max,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
          });
        }

        if (legacyHeaders) {
          res.set({
            'X-RateLimit-Limit': max,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000)
          });
        }

        const error = createError(message, 429, 'RATE_LIMIT_EXCEEDED');
        return next(error);
      }

      // Increment counter
      const newCount = parseInt(currentCount) + 1;
      await set(windowKey, newCount.toString(), windowMs);

      // Set rate limit headers
      if (standardHeaders) {
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - count - 1),
          'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });
      }

      if (legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - count - 1),
          'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('❌ Rate limiter error:', error);
      // If rate limiter fails, allow the request to proceed
      next();
    }
  };
};

/**
 * Predefined rate limiters
 */
const rateLimiters = {
  // Authentication rate limiters
  login: createRateLimiter(RATE_LIMITS.login),
  register: createRateLimiter(RATE_LIMITS.register),
  passwordReset: createRateLimiter(RATE_LIMITS.passwordReset),
  emailVerification: createRateLimiter(RATE_LIMITS.emailVerification),
  
  // OAuth rate limiters
  oauth: createRateLimiter(RATE_LIMITS.oauth),
  
  // API rate limiters
  api: createRateLimiter(RATE_LIMITS.api),
  translation: createRateLimiter(RATE_LIMITS.translation),
  
  // General rate limiter
  general: createRateLimiter(RATE_LIMITS.general)
};

/**
 * Dynamic rate limiter based on user type
 */
const dynamicRateLimiter = (req, res, next) => {
  // Determine rate limit based on user authentication status
  if (req.user) {
    // Authenticated users get higher limits
    const options = {
      windowMs: 15 * 60 * 1000,
      max: 500,
      message: 'Too many requests for authenticated user'
    };
    return createRateLimiter(options)(req, res, next);
  } else {
    // Anonymous users get standard limits
    return rateLimiters.general(req, res, next);
  }
};

/**
 * IP-based rate limiter with whitelist
 */
const ipRateLimiter = (whitelist = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || 'unknown';
    
    // Skip rate limiting for whitelisted IPs
    if (whitelist.includes(clientIP)) {
      return next();
    }
    
    return rateLimiters.general(req, res, next);
  };
};

/**
 * User-based rate limiter
 */
const userRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests for user'
  } = options;

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const keyGenerator = (req) => `user:${req.user.id}`;
    return createRateLimiter({
      windowMs,
      max,
      message,
      keyGenerator
    })(req, res, next);
  };
};

/**
 * Endpoint-specific rate limiter
 */
const endpointRateLimiter = (endpoint, options = {}) => {
  const defaultOptions = RATE_LIMITS[endpoint] || RATE_LIMITS.general;
  const mergedOptions = { ...defaultOptions, ...options };
  
  return createRateLimiter(mergedOptions);
};

/**
 * Burst rate limiter for handling traffic spikes
 */
const burstRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 10, // 10 requests per minute
    burstWindowMs = 10 * 1000, // 10 seconds
    burstMax = 5, // 5 requests per 10 seconds
    message = 'Too many requests in burst'
  } = options;

  return async (req, res, next) => {
    try {
      const key = `burst:${req.ip || 'unknown'}`;
      const now = Date.now();
      
      // Check burst limit
      const burstKey = `${key}:burst:${Math.floor(now / burstWindowMs)}`;
      const burstCount = await get(burstKey) || '0';

      if (parseInt(burstCount) >= burstMax) {
        const error = createError(message, 429, 'BURST_RATE_LIMIT_EXCEEDED');
        return next(error);
      }

      // Check regular limit
      const regularKey = `${key}:regular:${Math.floor(now / windowMs)}`;
      const regularCount = await get(regularKey) || '0';

      if (parseInt(regularCount) >= max) {
        const error = createError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
        return next(error);
      }

      // Increment both counters
      const newBurstCount = parseInt(burstCount) + 1;
      const newRegularCount = parseInt(regularCount) + 1;
      await set(burstKey, newBurstCount.toString(), burstWindowMs);
      await set(regularKey, newRegularCount.toString(), windowMs);

      next();
    } catch (error) {
      console.error('❌ Burst rate limiter error:', error);
      next();
    }
  };
};

/**
 * Rate limiter status checker
 */
const getRateLimitStatus = async (req) => {
  try {
    const key = `rate_limit:${req.ip || 'unknown'}:${req.route?.path || req.path}`;
    const now = Date.now();
    const window = Math.floor(now / (15 * 60 * 1000)); // 15 minutes
    const windowKey = `${key}:${window}`;

    const count = await get(windowKey) || '0';

    return {
      count: parseInt(count) || 0,
      limit: 100,
      remaining: Math.max(0, 100 - (parseInt(count) || 0)),
      resetTime: new Date(now + 15 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error('❌ Rate limit status error:', error);
    return null;
  }
};

module.exports = {
  createRateLimiter,
  rateLimiters,
  dynamicRateLimiter,
  ipRateLimiter,
  userRateLimiter,
  endpointRateLimiter,
  burstRateLimiter,
  getRateLimitStatus,
  RATE_LIMITS
};
