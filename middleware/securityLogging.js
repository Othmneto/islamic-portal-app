// Security Logging Middleware
const { securityMonitor } = require('../services/securityMonitor');

// Extract client information
const extractClientInfo = (req) => {
  // Enhanced IP extraction with better error handling
  let ip = 'unknown';
  
  try {
    // Try multiple sources for IP address
    if (req.ip) {
      ip = req.ip;
    } else if (req.connection && req.connection.remoteAddress) {
      ip = req.connection.remoteAddress;
    } else if (req.socket && req.socket.remoteAddress) {
      ip = req.socket.remoteAddress;
    } else if (req.connection && req.connection.socket && req.connection.socket.remoteAddress) {
      ip = req.connection.socket.remoteAddress;
    } else if (req.headers['x-forwarded-for']) {
      // Handle comma-separated list of IPs
      const forwardedIps = req.headers['x-forwarded-for'].split(',');
      ip = forwardedIps[0].trim();
    } else if (req.headers['x-real-ip']) {
      ip = req.headers['x-real-ip'];
    } else if (req.headers['x-client-ip']) {
      ip = req.headers['x-client-ip'];
    } else if (req.headers['cf-connecting-ip']) {
      ip = req.headers['cf-connecting-ip'];
    }
    
    // Clean up IP address (remove IPv6 prefix if present)
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    
    // Validate IP format
    if (ip && ip !== 'unknown' && !isValidIP(ip)) {
      console.warn('⚠️ Invalid IP address detected:', ip);
      ip = 'unknown';
    }
  } catch (error) {
    console.error('❌ Error extracting IP address:', error.message);
    ip = 'unknown';
  }

  const userAgent = req.get('User-Agent') || 'unknown';
  const referer = req.get('Referer') || 'unknown';
  
  return {
    ip: ip, // Fixed: Changed from ipAddress to ip for consistency
    ipAddress: ip, // Keep both for backward compatibility
    userAgent: userAgent,
    referer: referer,
    location: req.location || null, // If geolocation middleware is used
    requestDetails: {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: {
        'content-type': req.get('content-type'),
        'accept': req.get('accept'),
        'referer': req.get('referer'),
        'origin': req.get('origin')
      },
      body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : null,
      query: req.query
    }
  };
};

// Helper function to validate IP address
const isValidIP = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'localhost' || ip === '127.0.0.1';
};

// Sanitize request body to remove sensitive data
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Security logging middleware
const securityLogger = (options = {}) => {
  return async (req, res, next) => {
    // Skip logging for certain paths
    const skipPaths = options.skipPaths || ['/health', '/favicon.ico', '/static'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Extract client information
    const clientInfo = extractClientInfo(req);
    
    // Add security context to request
    req.securityContext = {
      ...clientInfo,
      userId: req.user?.id || null,
      sessionId: req.sessionID || null,
      timestamp: new Date()
    };

    // Log the request
    console.log(`🔍 Security Log: ${req.method} ${req.path}`, {
      ip: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      userId: req.securityContext.userId,
      timestamp: req.securityContext.timestamp
    });

    next();
  };
};

// Log authentication events
const logAuthEvent = async (eventType, req, additionalData = {}) => {
  try {
    const clientInfo = extractClientInfo(req);
    
    const eventData = {
      eventType,
      userId: req.user?.id || null,
      ip: clientInfo.ip,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      referer: clientInfo.referer,
      location: clientInfo.location,
      description: getEventDescription(eventType, additionalData),
      metadata: {
        ...additionalData,
        sessionId: req.sessionID,
        authProvider: req.user?.authProvider || 'local',
        requestDetails: clientInfo.requestDetails
      }
    };

    await securityMonitor.logEvent(eventData);
  } catch (error) {
    console.error('❌ Failed to log auth event:', error);
  }
};

// Log security violations
const logSecurityViolation = async (violationType, req, details = {}) => {
  try {
    const clientInfo = extractClientInfo(req);
    
    const eventData = {
      eventType: violationType,
      userId: req.user?.id || null,
      ip: clientInfo.ip,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      referer: clientInfo.referer,
      location: clientInfo.location,
      description: getViolationDescription(violationType, details),
      metadata: {
        ...details,
        sessionId: req.sessionID,
        violationDetails: details,
        requestDetails: clientInfo.requestDetails
      }
    };

    await securityMonitor.logEvent(eventData);
  } catch (error) {
    console.error('❌ Failed to log security violation:', error);
  }
};

// Get event description
const getEventDescription = (eventType, data) => {
  const descriptions = {
    'LOGIN_SUCCESS': `User ${data.email || data.userId} logged in successfully`,
    'LOGIN_FAILED': `Failed login attempt for ${data.email || 'unknown user'}`,
    'REGISTRATION_SUCCESS': `New user registered: ${data.email}`,
    'REGISTRATION_FAILED': `Registration failed for ${data.email || 'unknown'}`,
    'PASSWORD_RESET_REQUEST': `Password reset requested for ${data.email}`,
    'PASSWORD_RESET_SUCCESS': `Password reset completed for ${data.email}`,
    'PASSWORD_RESET_FAILED': `Password reset failed for ${data.email}`,
    'ACCOUNT_LOCKED': `Account locked for user ${data.userId || data.email}`,
    'ACCOUNT_UNLOCKED': `Account unlocked for user ${data.userId || data.email}`,
    'RATE_LIMIT_EXCEEDED': `Rate limit exceeded for IP ${data.ipAddress}`,
    'CSRF_VIOLATION': `CSRF token validation failed`,
    'XSS_ATTEMPT': `Potential XSS attack detected`,
    'SQL_INJECTION_ATTEMPT': `Potential SQL injection attempt detected`,
    'UNAUTHORIZED_ACCESS': `Unauthorized access attempt`,
    'SUSPICIOUS_ACTIVITY': `Suspicious activity detected`,
    'TOKEN_BLACKLISTED': `Token blacklisted for user ${data.userId}`,
    'EMAIL_VERIFICATION_SENT': `Verification email sent to ${data.email}`,
    'EMAIL_VERIFICATION_SUCCESS': `Email verified for ${data.email}`,
    'EMAIL_VERIFICATION_FAILED': `Email verification failed for ${data.email}`,
    'OAUTH_LOGIN_SUCCESS': `OAuth login successful for ${data.provider}`,
    'OAUTH_LOGIN_FAILED': `OAuth login failed for ${data.provider}`,
    'SESSION_EXPIRED': `Session expired for user ${data.userId}`,
    'SESSION_HIJACK_ATTEMPT': `Potential session hijack attempt`,
    'BRUTE_FORCE_ATTEMPT': `Brute force attack detected`,
    'CREDENTIAL_STUFFING_ATTEMPT': `Credential stuffing attack detected`
  };

  return descriptions[eventType] || `Security event: ${eventType}`;
};

// Get violation description
const getViolationDescription = (violationType, details) => {
  const descriptions = {
    'CSRF_VIOLATION': `CSRF token validation failed: ${details.reason || 'Invalid token'}`,
    'XSS_ATTEMPT': `XSS attempt detected in ${details.field || 'input'}: ${details.payload || 'malicious script'}`,
    'SQL_INJECTION_ATTEMPT': `SQL injection attempt detected: ${details.query || 'malicious query'}`,
    'UNAUTHORIZED_ACCESS': `Unauthorized access to ${details.resource || 'protected resource'}`,
    'RATE_LIMIT_EXCEEDED': `Rate limit exceeded: ${details.limit || 'unknown limit'} requests per ${details.window || 'time window'}`,
    'SUSPICIOUS_ACTIVITY': `Suspicious activity: ${details.activity || 'unusual pattern detected'}`
  };

  return descriptions[violationType] || `Security violation: ${violationType}`;
};

// Rate limiting violation logger
const logRateLimitViolation = async (req, limit, window) => {
  await logSecurityViolation('RATE_LIMIT_EXCEEDED', req, {
    limit,
    window,
    path: req.path,
    method: req.method
  });
};

// CSRF violation logger
const logCSRFViolation = async (req, reason) => {
  await logSecurityViolation('CSRF_VIOLATION', req, {
    reason,
    expectedToken: req.headers['x-csrf-token'] ? '[PRESENT]' : '[MISSING]',
    sessionToken: req.session?.csrfToken ? '[PRESENT]' : '[MISSING]'
  });
};

// XSS attempt logger
const logXSSAttempt = async (req, field, payload) => {
  await logSecurityViolation('XSS_ATTEMPT', req, {
    field,
    payload: payload.substring(0, 100), // Truncate for storage
    fullPayload: payload.length > 100
  });
};

// SQL injection attempt logger
const logSQLInjectionAttempt = async (req, query, field) => {
  await logSecurityViolation('SQL_INJECTION_ATTEMPT', req, {
    query: query.substring(0, 200), // Truncate for storage
    field,
    fullQuery: query.length > 200
  });
};

// Safe logging functions that can be called without request object
const safeLogAuthEvent = async (eventType, data = {}) => {
  try {
    const eventData = {
      eventType,
      userId: data.userId || null,
      ip: data.ip || 'unknown',
      ipAddress: data.ipAddress || data.ip || 'unknown',
      userAgent: data.userAgent || 'unknown',
      referer: data.referer || 'unknown',
      location: data.location || null,
      description: getEventDescription(eventType, data),
      metadata: {
        ...data,
        sessionId: data.sessionId || null,
        authProvider: data.authProvider || 'local'
      }
    };

    await securityMonitor.logEvent(eventData);
  } catch (error) {
    console.error('❌ Failed to log auth event:', error);
  }
};

const safeLogSecurityViolation = async (violationType, data = {}) => {
  try {
    const eventData = {
      eventType: violationType,
      userId: data.userId || null,
      ip: data.ip || 'unknown',
      ipAddress: data.ipAddress || data.ip || 'unknown',
      userAgent: data.userAgent || 'unknown',
      referer: data.referer || 'unknown',
      location: data.location || null,
      description: getViolationDescription(violationType, data),
      metadata: {
        ...data,
        sessionId: data.sessionId || null,
        violationDetails: data
      }
    };

    await securityMonitor.logEvent(eventData);
  } catch (error) {
    console.error('❌ Failed to log security violation:', error);
  }
};

module.exports = {
  securityLogger,
  logAuthEvent,
  logSecurityViolation,
  logRateLimitViolation,
  logCSRFViolation,
  logXSSAttempt,
  logSQLInjectionAttempt,
  extractClientInfo,
  safeLogAuthEvent,
  safeLogSecurityViolation
};
