// Enhanced Production-Grade Security Headers
const helmet = require('helmet');

// Enhanced Content Security Policy
const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'strict-dynamic'", // Allow scripts loaded by trusted scripts
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
    // Remove 'unsafe-inline' for better security
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'", // CSS requires inline styles
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com"
  ],
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com",
    "https://cdnjs.cloudflare.com"
  ],
  "img-src": [
    "'self'",
    "data:",
    "https:", // Allow HTTPS images
    "blob:" // Allow blob URLs for generated images
  ],
  "connect-src": [
    "'self'",
    "https://kaabah-ai-model-1-0-0.onrender.com",
    "https://nominatim.openstreetmap.org",
    "wss:", // WebSocket connections
    "ws:" // WebSocket connections (fallback)
  ],
  "media-src": ["'self'"],
  "object-src": ["'none'"], // Disallow object, embed, applet
  "base-uri": ["'self'"], // Restrict base tag
  "form-action": ["'self'"], // Restrict form submissions
  "frame-ancestors": ["'none'"], // Prevent embedding in frames
  "upgrade-insecure-requests": [], // Upgrade HTTP to HTTPS
  "block-all-mixed-content": [], // Block mixed content
  "require-trusted-types-for": ["'script'"], // Require trusted types for scripts
};

// Enhanced security headers configuration
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    useDefaults: true,
    directives: cspDirectives,
    reportOnly: process.env.NODE_ENV !== 'production' // Report-only in development
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // X-Frame-Options (clickjacking protection)
  frameguard: {
    action: 'deny'
  },

  // X-Content-Type-Options (MIME type sniffing protection)
  noSniff: true,

  // X-XSS-Protection
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disable for compatibility

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: {
    policy: 'same-origin'
  },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  },

  // Permissions Policy (Feature Policy)
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: [],
    ambientLightSensor: [],
    autoplay: [],
    encryptedMedia: [],
    fullscreen: ["self"],
    pictureInPicture: []
  },

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },

  // IE No Open
  ieNoOpen: true,

  // Origin Agent Cluster
  originAgentCluster: true
});

// Additional custom security headers
const customSecurityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');

  // Add custom security headers
  res.setHeader('X-Request-ID', req.id || 'unknown');
  res.setHeader('X-Response-Time', Date.now() - req.startTime);

  // Cache control for sensitive endpoints
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/user/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Security headers for API endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }

  next();
};

// Security event logging middleware
const securityEventLogger = (req, res, next) => {
  const startTime = Date.now();
  req.startTime = startTime;

  // Log security events
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log suspicious activities
    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      console.warn(`🚨 Security Event: ${req.method} ${req.path} - ${statusCode}`, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        duration,
        timestamp: new Date().toISOString()
      });
    }

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      console.warn(`🐌 Slow Request: ${req.method} ${req.path} - ${duration}ms`, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};

module.exports = {
  securityHeaders,
  customSecurityHeaders,
  securityEventLogger
};
