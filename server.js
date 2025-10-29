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
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiters, dynamicRateLimiter } = require('./middleware/rateLimiter');
const {
  generalLimiter,
  authLimiter,
  loginLimiter,
  translationLimiter,
  notificationLimiter,
  apiLimiter
} = require('./middleware/inMemoryRateLimiter');
const prayerLogRoutes = require('./routes/prayerLogRoutes');
const prayerTimesFineTuningRoutes = require('./routes/prayerTimesFineTuningRoutes');
const offlinePrayerTimesRoutes = require('./routes/offlinePrayerTimesRoutes');
const prayerTimeReportRoutes = require('./routes/prayerTimeReportRoutes');

// Database connection
const { connect: connectDatabase, healthCheck: dbHealthCheck } = require('./config/database');

// --- timezone-aware scheduler ---
const prayerNotificationScheduler = require('./tasks/prayerNotificationScheduler');
// require('./workers/notificationWorker'); // Commented out - worker should run as separate process
// require('./services/partialTranslationService'); // Temporarily disabled

// --- Smart Timezone Detection Service ---
const smartTimezoneService = require('./services/smartTimezoneService');

// --- In-Memory Services with NVMe Persistence ---
const diskPersistence = require('./services/diskPersistence');
const { initializeRateLimiters, shutdownRateLimiters } = require('./middleware/inMemoryRateLimiter');

// --- Read Replicas Service ---
let initializeReadReplicas;
try {
  const readReplicaService = require('./services/readReplicaService');
  initializeReadReplicas = readReplicaService.initializeReadReplicas;
} catch (error) {
  console.log('⚠️ Read replicas service not available');
  initializeReadReplicas = async () => {};
}

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
const textTranslationRoutes = require('./routes/textTranslationRoutes');
const translationHistoryRoutes = require('./routes/translationHistoryRoutes');
const enhancedTranslationRoutes = require('./routes/enhancedTranslationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');
// const microsoftAuth = require('./routes/microsoftAuth'); // Removed - using custom PKCE OAuth instead
const namesRoutes = require('./routes/api/names');
const userRoutes = require('./routes/userRoutes');
const authCookieRoutes = require('./routes/authCookieRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const notificationsRouter = require('./routes/notifications');
const notificationConfirmationRoutes = require('./routes/notificationConfirmationRoutes');
const locationRoutes = require('./routes/locationRoutes');
const accountManagementRoutes = require('./routes/accountManagementRoutes');
const securityDashboard = require('./routes/securityDashboard');
// Load MFA routes conditionally to avoid circular dependencies
let mfaRoutes;
try {
    mfaRoutes = require('./routes/mfaRoutes');
    console.log('✅ MFA routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading MFA routes:', error.message);
    mfaRoutes = null;
}

const { attachUser, requireSession } = require('./middleware/authMiddleware');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

// --- Shared Session Configuration ---
const sessionMiddleware = session({
  name: 'sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  rolling: true, // Renew cookie maxAge on every request for 90-day persistence
  store: MongoStore.create({
    mongoUrl: env.MONGO_URI,
    dbName: env.DB_NAME,
    collectionName: 'sessions',
    touchAfter: 24 * 3600
  }),
  cookie: {
    httpOnly: true,
    secure: (env.NODE_ENV === 'production') || String(env.COOKIE_SECURE).toLowerCase() === 'true',
    sameSite: 'lax',
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    domain: env.COOKIE_DOMAIN || undefined
  }
});

// --- Socket.io with Session-Based Authentication ---
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Wrap Express session middleware for Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Session-based Socket.IO authentication
io.use((socket, next) => {
  const userId = socket.request.session?.userId;
  if (userId) {
    socket.userId = userId;
    socket.user = { id: userId };
    console.log(`[SocketAuth] Authenticated user via session: ${userId}`);
    next();
  } else {
    console.warn('[SocketAuth] No session found for socket connection');
    // Allow connection but mark as unauthenticated
    socket.userId = null;
    socket.user = null;
    next();
  }
});

require('./websockets/socketManager')(io);

// Initialize WebSocket service for notification status updates
const { initializeWebSocket } = require('./services/websocketService');
initializeWebSocket(io);

// --- Request metadata, cookies, logging ---
app.use(requestId);
app.use(cookieParser());
app.use(httpLogger);

// --- Security headers ---
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://cdn.socket.io",
          "https://unpkg.com"
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "https://unpkg.com"
        ],
        "style-src-elem": [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "https://unpkg.com"
        ],
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://r2cdn.perplexity.ai",
          "data:"
        ],
        "img-src": ["'self'", "data:", "https:", "http:"],
        "connect-src": [
          "'self'",
          "ws://localhost:3000",
          "wss://localhost:3000",
          "http://localhost:3000",
          "https://kaabah-ai-model-1-0-0.onrender.com",
          "https://nominatim.openstreetmap.org",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://cdn.socket.io",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
          "https://api.openai.com",
          "https://api.elevenlabs.io"
        ],
        "media-src": ["'self'", "data:", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": []
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
app.use(sessionMiddleware);

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

// Serve text translator page
app.get('/translator/text-translator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/translator/text-translator.html'));
});

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

// --- In-Memory Rate Limits with NVMe Persistence ---
// Use our new in-memory rate limiters with disk persistence
// Note: The rate limiters are already imported above

// Apply general rate limiting to all routes with safe dev bypass and static skip
const isDevEnv = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
const isLocalRequest = (req) => {
  const ip = req.ip || '';
  const host = req.hostname || '';
  const fwd = (req.headers['x-forwarded-for'] || '').toString();
  return host === 'localhost' || host === '127.0.0.1' || ip.includes('127.0.0.1') || ip === '::1' || fwd.includes('127.0.0.1');
};
if (!isDevEnv) {
  app.use((req, res, next) => {
    // Skip common static assets to avoid throttling icons/css/js
    const isStatic = req.method === 'GET' && /\.(html|js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|map)$/.test(req.path);
    if (isStatic || isLocalRequest(req)) return next();
    return generalLimiter(req, res, next);
  });
}

// --- Routes (after session/passport) ---
// Helper to bypass rate limiter for dev or local requests
const bypassIfDevOrLocal = (limiter) => (req, res, next) => {
  if (isDevEnv || isLocalRequest(req)) return next();
  return limiter(req, res, next);
};

// Auth routes - disable rate limiting in dev/local to avoid 429s while testing
app.use('/api/auth/login', bypassIfDevOrLocal(loginLimiter));
app.use('/api/auth', bypassIfDevOrLocal(authLimiter), authRoutes);
app.use('/api/auth-cookie', bypassIfDevOrLocal(authLimiter), authCookieRoutes);
app.use('/api/token', tokenRoutes);
// Removed Passport OAuth routes to allow custom PKCE implementation to take precedence
app.use('/api/auth', require('./routes/enhancedOAuth'));
app.use('/api/notifications', notificationLimiter, notificationsRouter);
app.use('/api/notifications', notificationConfirmationRoutes);
app.use('/api/notification-status', require('./routes/notificationStatusRoutes'));
// app.use('/api/subscription', require('./routes/subscriptionRoutes')); // Disabled - conflicts with notifications routes

// Analytics routes
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// User feedback routes (using analytics routes for now)
app.use('/api/user-feedback', require('./routes/analyticsRoutes'));
app.use('/api/names', namesRoutes);
app.use('/api/translation', translationLimiter, translationRoutes);
app.use('/api/text-translation', translationLimiter, textTranslationRoutes);
app.use('/api/enhanced-translation', translationLimiter, enhancedTranslationRoutes);
app.use('/api/translation-history', translationHistoryRoutes);
app.use('/api/live-translation', translationLimiter, require('./routes/liveTranslationRoutes'));
app.use('/api/content-scraping', require('./routes/contentScrapingRoutes'));
app.use('/api/data-enhancement', require('./routes/dataEnhancementRoutes'));

// Data Viewer Routes
app.use('/api/data-viewer', require('./routes/dataViewerRoutes'));

// Calendar Integration Routes
app.use('/api/calendar', require('./routes/calendarIntegrationRoutes'));
app.use('/api/calendar', require('./routes/calendarEventsRoutes'));

// Hijri Calendar Routes
app.use('/api/hijri', require('./routes/hijriCalendarRoutes'));

// Enhanced Islamic Calendar Routes
app.use('/api/islamic-calendar', require('./routes/islamicCalendarRoutes'));

// Calendar Search Routes
app.use('/api/search', require('./routes/calendarSearchRoutes'));

// Category Routes
app.use('/api/categories', require('./routes/categoryRoutes'));

// Import Routes
app.use('/api/import', require('./routes/importRoutes'));

// OAuth Sync Routes
app.use('/api/oauth-sync', require('./routes/oauthSyncRoutes'));

// Recurring Events Routes
app.use('/api/recurring', require('./routes/recurringEventsRoutes'));

// Clear OAuth Tokens Route (for testing)
app.use('/api', require('./routes/clearOAuthTokens'));
// Direct token clearing route
app.use('/api/tokens', require('./routes/clearTokensRoute'));
app.use('/api/quran', quranRoutes);
app.use('/api/history', requireSession, historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user', accountManagementRoutes);
app.use('/api/user', require('./routes/profileRoutes'));
app.use(sessionRoutes);
// Add MFA routes only if they loaded successfully
if (mfaRoutes) {
    app.use('/api/mfa', mfaRoutes);
    console.log('✅ MFA routes registered successfully');
} else {
    console.log('⚠️ MFA routes not available');
}
app.use('/api/location', locationRoutes);
app.use('/api/prayer-log', prayerLogRoutes);
app.use('/api/prayer-times-fine-tuning', prayerTimesFineTuningRoutes);
app.use('/api/offline-prayer-times', offlinePrayerTimesRoutes);
app.use('/api/prayer-time-reports', prayerTimeReportRoutes);
app.use('/api/timezone', require('./routes/smartTimezoneRoutes'));
app.use('/api/security', securityDashboard);
// General API limiter - disabled in dev/local
app.use('/api', bypassIfDevOrLocal(apiLimiter), apiRoutes);

// Enhanced health check endpoints
app.get('/api/health/database', async (req, res) => {
  try {
    const health = await dbHealthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database health check failed',
      error: error.message
    });
  }
});

// Redis health check removed - using simple in-memory solutions

app.get('/api/health/read-replicas', async (req, res) => {
  try {
    const { getHealthStatus } = require('./services/readReplicaService');
    const health = await getHealthStatus();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Read replicas health check failed',
      error: error.message
    });
  }
});

// Cache health check removed - using simple in-memory solutions

// Query optimization health check removed - service not available

app.get('/api/health/comprehensive', async (req, res) => {
  try {
    const [dbHealth] = await Promise.allSettled([
      dbHealthCheck()
    ]);

    const overallStatus = dbHealth.status === 'fulfilled' && dbHealth.value.status !== 'error'
      ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'error', error: dbHealth.reason?.message }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Comprehensive health check failed',
      error: error.message
    });
  }
});

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
    // Initialize disk persistence
    await diskPersistence.initialize();
    console.log('💾 Disk Persistence: Initialized with NVMe storage');

    // Initialize in-memory rate limiters
    await initializeRateLimiters();
    console.log('🚦 Rate Limiters: Initialized with disk persistence');

    // Database connection (fallback to original method)
    try {
      await connectDatabase();
      logger.info?.('✅ Successfully connected to MongoDB with enhanced connection pooling.');
    } catch (error) {
      logger.warn?.('⚠️ Enhanced database connection failed, using fallback:', error.message);
      await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
      logger.info?.('✅ Successfully connected to MongoDB via Mongoose (fallback).');
    }

    // Initialize read replicas
    try {
      await initializeReadReplicas();
      logger.info?.('✅ Read replicas initialized successfully');
    } catch (error) {
      logger.warn?.('⚠️ Read replicas initialization failed (continuing with primary):', error.message);
    }

    // Initialize content scheduler for web scraping
    try {
      const ContentScheduler = require('./services/contentScheduler');
      const contentScheduler = new ContentScheduler();
      await contentScheduler.initialize();
      contentScheduler.startScheduledScraping();
      logger.info?.('✅ Content scheduler initialized and started');
    } catch (error) {
      logger.warn?.('⚠️ Content scheduler initialization failed (continuing without scraping):', error.message);
    }

    // Redis cluster removed - using simple in-memory solutions

    try {
      await prayerNotificationScheduler.initialize();
      logger.info?.('✅ Prayer notification scheduler initialized successfully');
    } catch (error) {
      logger.error?.('❌ Failed to initialize prayer notification scheduler:', error);
    }

    // Initialize Smart Timezone Detection Service
    try {
      await smartTimezoneService.initialize();
      logger.info?.('✅ Smart timezone detection service initialized successfully');
    } catch (error) {
      logger.error?.('❌ Failed to initialize smart timezone detection service:', error);
    }

    // Initialize notification retry manager
    try {
      const notificationRetryManager = require('./services/notificationRetryManager');
      logger.info?.('✅ Notification retry manager initialized successfully');
    } catch (error) {
      logger.error?.('❌ Failed to initialize notification retry manager:', error);
    }

    // Start token cleanup service
    const tokenCleanupService = require('./services/tokenCleanupService');
    tokenCleanupService.start();

    // Start security monitoring
    securityMonitor.start();

    // Start notification queue processing
    try {
      const { getNotificationQueueService } = require('./services/inMemoryNotificationQueue');
      const notificationQueue = getNotificationQueueService();
      if (notificationQueue) {
        // Set up job processing using the queue's process method
        notificationQueue.queue.process('send-push', async (job) => {
          try {
            const { subscription, payload } = job.data;
            console.log(`📬 [Notification Worker] Processing notification job: ${job.id}`);

            // Import web-push here to avoid circular dependencies
            const webPush = require('web-push');

            // Configure web-push with VAPID keys
            webPush.setVapidDetails(
              env.VAPID_SUBJECT || 'mailto:admin@islamic-portal.com',
              env.VAPID_PUBLIC_KEY,
              env.VAPID_PRIVATE_KEY
            );

            // Convert subscription to web-push format
            // Handle both direct subscription objects and nested subscription objects
            let webPushSubscription;

            if (subscription.subscription) {
              // Nested subscription object (from database)
              webPushSubscription = {
                endpoint: subscription.subscription.endpoint,
                keys: {
                  p256dh: subscription.subscription.keys?.p256dh,
                  auth: subscription.subscription.keys?.auth,
                },
              };
            } else {
              // Direct subscription object
              webPushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.keys?.p256dh,
                  auth: subscription.keys?.auth,
                },
              };
            }

            // Validate subscription
            if (!webPushSubscription.endpoint) {
              console.error('❌ [Notification Worker] Invalid subscription data:', JSON.stringify(subscription, null, 2));
              throw new Error('You must pass in a subscription with at least an endpoint.');
            }

            // Send notification with high urgency and low TTL to reduce broker buffering
            await webPush.sendNotification(
              webPushSubscription,
              JSON.stringify(payload),
              { TTL: 10, urgency: 'high' }
            );
            console.log(`✅ [Notification Worker] Notification sent successfully: ${job.id}`);

            return { success: true };
      } catch (error) {
            console.error(`❌ [Notification Worker] Failed to send notification ${job.id}:`, error.message);

            // If subscription is invalid, remove it from database
            if (error.statusCode === 404 || error.statusCode === 410) {
              try {
                const PushSubscription = require('./models/PushSubscription');
                await PushSubscription.deleteOne({ _id: job.data.subscription._id });
                console.log(`🗑️ [Notification Worker] Removed invalid subscription: ${job.data.subscription._id}`);
              } catch (dbError) {
                console.error(`❌ [Notification Worker] Failed to remove invalid subscription:`, dbError.message);
              }
            }

            throw error;
          }
        });

        console.log('📬 [Notification Worker] Started processing notifications');
        logger.info?.('📬 [Notification Worker] Started processing notifications');
      }
    } catch (error) {
      console.error('❌ [Notification Worker] Failed to start notification processing:', error.message);
      logger.error?.('❌ [Notification Worker] Failed to start notification processing:', error.message);
    }

    // Query optimization monitoring removed - service not available

    // Warm up holiday cache
    try {
      const hotCache = require('./services/hotCacheService');
      setTimeout(() => {
        hotCache.warmUp(['US', 'GB', 'AE', 'SA', 'IN', 'PK', 'TR', 'EG', 'MY', 'ID'])
          .then(() => logger.info?.('🔥 [HotCache] Initial cache warming completed'))
          .catch(err => logger.error?.('Failed to warm cache:', err));
      }, 5000); // Wait 5 seconds after server start
    } catch (error) {
      logger.warn?.('Cache warming skipped:', error.message);
    }

    server.listen(env.PORT || 3000, () => {
      console.log(`Server running on port ${env.PORT || 3000}...`);
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

    // Shutdown in-memory services
    await shutdownRateLimiters();
    await diskPersistence.shutdown();

    await new Promise((resolve) => server.close(resolve));

    // Close enhanced database connections
    const { disconnect: disconnectDatabase } = require('./config/database');

    try {
      const { closeAllConnections: closeReadReplicas } = require('./services/readReplicaService');
    await Promise.all([
      disconnectDatabase(),
      closeReadReplicas()
    ]);
    } catch (error) {
      // Read replicas service not available, just disconnect main database
      await disconnectDatabase();
    }
  } catch (e) {
    logger.error?.('Error during shutdown:', e);
  } finally {
    process.exit(0);
  }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
