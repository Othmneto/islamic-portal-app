// Enhanced Error Handling Middleware
const { safeLogSecurityViolation } = require('./securityLogging');

/**
 * Enhanced error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  console.error('❌ Application Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Determine error type and response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_SERVER_ERROR';

  // Handle different error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    errorCode = 'INVALID_ID';
  } else if (err.name === 'MongoError' && err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
    errorCode = 'DUPLICATE_ENTRY';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
    errorCode = 'FILE_UPLOAD_ERROR';
  } else if (err.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Too many requests';
    errorCode = 'RATE_LIMIT_EXCEEDED';
  } else if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode;
    message = err.message || 'Request failed';
    errorCode = err.code || 'REQUEST_ERROR';
  }

  // Log security violations for certain errors
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    safeLogSecurityViolation('SECURITY_VIOLATION', {
      userId: req.user?.id || null,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      errorType: errorCode,
      message: err.message,
      url: req.originalUrl,
      method: req.method
    });
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message,
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack
      })
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId || 'unknown'
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 errors
 */
const notFoundHandler = (req, res) => {
  const errorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId || 'unknown'
  };

  res.status(404).json(errorResponse);
};

/**
 * Handle async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error
 */
const createError = (message, statusCode = 500, code = 'CUSTOM_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

/**
 * Validation error handler
 */
const validationErrorHandler = (errors) => {
  const error = new Error('Validation failed');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = errors;
  return error;
};

/**
 * Database error handler
 */
const databaseErrorHandler = (err) => {
  console.error('❌ Database Error:', err);

  if (err.name === 'MongoError') {
    if (err.code === 11000) {
      return createError('Duplicate entry found', 409, 'DUPLICATE_ENTRY');
    }
    return createError('Database operation failed', 500, 'DATABASE_ERROR');
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return validationErrorHandler(errors);
  }

  return createError('Database error', 500, 'DATABASE_ERROR');
};

/**
 * Redis error handler
 */
const redisErrorHandler = (err) => {
  console.error('❌ Redis Error:', err);
  return createError('Cache service unavailable', 503, 'CACHE_ERROR');
};

/**
 * OAuth error handler
 */
const oauthErrorHandler = (err, provider) => {
  console.error(`❌ ${provider} OAuth Error:`, err);

  if (err.message.includes('No email found')) {
    return createError(`No email found in ${provider} profile`, 400, 'OAUTH_NO_EMAIL');
  }

  if (err.message.includes('access_denied')) {
    return createError('OAuth access denied', 403, 'OAUTH_ACCESS_DENIED');
  }

  return createError(`${provider} OAuth authentication failed`, 500, 'OAUTH_ERROR');
};

/**
 * Rate limit error handler
 */
const rateLimitErrorHandler = (err) => {
  console.error('❌ Rate Limit Error:', err);
  return createError('Too many requests, please try again later', 429, 'RATE_LIMIT_EXCEEDED');
};

/**
 * Security error handler
 */
const securityErrorHandler = (err) => {
  console.error('❌ Security Error:', err);

  if (err.message.includes('CSRF')) {
    return createError('CSRF token validation failed', 403, 'CSRF_VIOLATION');
  }

  if (err.message.includes('XSS')) {
    return createError('Potential XSS attack detected', 400, 'XSS_ATTEMPT');
  }

  return createError('Security violation detected', 403, 'SECURITY_VIOLATION');
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  validationErrorHandler,
  databaseErrorHandler,
  redisErrorHandler,
  oauthErrorHandler,
  rateLimitErrorHandler,
  securityErrorHandler
};