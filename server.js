// translator-backend/server.js
"use strict";

const { env } = require('./config');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const { issueCsrfToken, getCsrfToken } = require('./middleware/csrfMiddleware');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const prayerLogRoutes = require('./routes/prayerLogRoutes');

// --- timezone-aware scheduler ---
const prayerNotificationScheduler = require('./tasks/prayerNotificationScheduler');
require('./workers/notificationWorker');

// --- security monitoring ---
const { securityMonitor } = require('./services/securityMonitor');

let logger = console;
let httpLogger = (_req, _res, next) => next();
try {
  const l = require('./config/logger');
  logger = l.logger || logger;
  httpLogger = l.httpLogger || httpLogger;
} catch {}

const quranRoutes = require('./routes/quranRoutes');
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');
const microsoftAuth = require('./routes/microsoftAuth');
const namesRoutes = require('./routes/api/names');
const userRoutes = require('./routes/userRoutes');
const authCookieRoutes = require('./routes/authCookieRoutes');
const notificationsRouter = require('./routes/notifications');
const locationRoutes = require('./routes/locationRoutes');
const securityDashboard = require('./routes/securityDashboard');

const { attachUser, requireSession } = require('./middleware/authMiddleware');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

// --- Socket.io ---
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
require('./websockets/socketManager')(io);

// --- Request metadata, cookies, logging ---
app.use(requestId);
app.use(cookieParser());
app.use(httpLogger);

// --- Security headers ---
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        // Added 'unsafe-inline' to allow inline scripts when needed
        "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        "style-src-elem": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        "img-src": ["'self'", "data:"],
        "connect-src": [
          "'self'",
          "https://kaabah-ai-model-1-0-0.onrender.com",
          "https://nominatim.openstreetmap.org"
        ],
        "media-src": ["'self'"],
      },
    },
  })
);

// --- CORS (before routes) ---
const allowedOrigins = (process.env.CORS_ORIGINS || env.CLIENT_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

// --- Body parsers ---
app.use(express.json({ limit: process.env.JSON_LIMIT || '200kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || '200kb' }));

// --- Session (must be before Passport) ---
app.use(
  session({
    name: 'sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
      dbName: env.DB_NAME,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 14,
      autoRemove: 'interval',
      autoRemoveInterval: 10,
    }),
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);

// --- Passport (strategies + session support) ---
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// --- Attach req.user for session/JWT users ---
app.use(attachUser);

// --- Static files ---
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (/\.(html|js|css)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);

// --- Translation files ---
app.use('/locales', express.static(path.join(__dirname, 'locales'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  },
}));

// --- CSRF helpers ---
app.use(issueCsrfToken);
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.get('/api/auth/csrf', getCsrfToken);
app.get('/api/csrf-token', getCsrfToken);

// --- Rate limits ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Reduced from 100 to 10 for security
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication requests from this IP, please try again after 15 minutes',
  skip: (req) => {
    // Skip rate limiting for successful logins
    return req.path === '/api/auth/login' && req.method === 'POST' && req.body?.email;
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Increased to 20 login attempts per 15 minutes for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/auth') || req.path.startsWith('/auth-cookie'),
});

const notificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many subscription attempts from this IP, please try again later.',
});

// --- Routes (after session/passport) ---
app.use('/api/auth/login', loginLimiter); // Apply strict rate limiting to login
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth-cookie', authLimiter, authCookieRoutes);
app.use('/api/auth/microsoft', microsoftAuth);
app.use('/api/notifications', notificationLimiter, notificationsRouter);
app.use('/api/names', namesRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/quran', quranRoutes);
app.use('/api/history', requireSession, historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/prayer-log', prayerLogRoutes);
  app.use('/api/security', securityDashboard);
app.use('/api', apiLimiter, apiRoutes);

// --- SPA fallback ---
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/locales')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- CSRF error mapping ---
app.use((err, req, res, next) => {
  if (err && (err.code === 'EBADCSRFTOKEN' || err.name === 'EBADCSRFTOKEN')) {
    logger.warn?.('Invalid CSRF token', { path: req.path });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next(err);
});

// --- Error handler ---
app.use(errorHandler);

// --- Start server & DB ---
async function startServer() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info?.('✅ Successfully connected to MongoDB via Mongoose.');

    try {
      await prayerNotificationScheduler.initialize();
      logger.info?.('✅ Prayer notification scheduler initialized successfully');
    } catch (error) {
      logger.error?.('❌ Failed to initialize prayer notification scheduler:', error);
    }

    // Start token cleanup service
    const tokenCleanupService = require('./services/tokenCleanupService');
    tokenCleanupService.start();

    // Start security monitoring
    securityMonitor.start();

    server.listen(env.PORT || 3000, () => {
      logger.info?.(`🚀 Server running on port ${env.PORT || 3000}...`);
      logger.info?.(`🔍 Security monitoring active`);
    });
  } catch (err) {
    logger.error?.({ err }, '❌ Database connection failed');
    process.exit(1);
  }
}

startServer();

// --- Graceful shutdown ---
const shutdown = async () => {
  try {
    logger.info?.('🛑 Shutting down HTTP server...');
    
    // Stop token cleanup service
    const tokenCleanupService = require('./services/tokenCleanupService');
    tokenCleanupService.stop();
    
    await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState) await mongoose.connection.close();
  } catch (e) {
    logger.error?.('Error during shutdown:', e);
  } finally {
    process.exit(0);
  }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
