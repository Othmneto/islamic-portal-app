// translator-backend/server.js

// ---- Validated env (from ./config using zod) ----
const { env } = require('./config');

// --- Core ---
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// --- Security & cookies ---
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// --- Sessions & rate limiting ---
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');

// --- CSRF helpers ---
const { issueCsrfToken, getCsrfToken } = require('./middleware/csrfMiddleware');

// --- Media toolchain (existing) ---
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// --- New middleware (request id & centralized error handler) ---
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');

// --- Logging (optional) ---
let logger = console;
let httpLogger = (_req, _res, next) => next();
try {
  const l = require('./config/logger');
  logger = l.logger || logger;
  httpLogger = l.httpLogger || httpLogger;
} catch { /* optional logger not present */ }

// --- Routes ---
const quranRoutes = require('./routes/quranRoutes');
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');               // legacy token auth (optional)
const namesRoutes = require('./routes/api/names');
const userRoutes = require('./routes/userRoutes');
const authCookieRoutes = require('./routes/authCookieRoutes');   // cookie-based login/logout/me
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const { attachUser, requireSession } = require('./middleware/authMiddleware');

// ----- Initial setup -----
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);

// Trust proxy so secure cookies work behind Nginx/Render/Heroku
app.set('trust proxy', 1);

// ----- Socket.IO -----
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
require('./websockets/socketManager')(io);

// ----- Global Middleware -----

// ✔️ Ensure every request has a stable id (first in chain)
app.use(requestId);

// Cookies first (sessions & CSRF rely on cookies)
app.use(cookieParser());

// Structured request logging (if configured)
app.use(httpLogger);

// Security headers with CSP tuned for your app
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        "style-src-elem": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://kaabah-ai-model-1-0-0.onrender.com"],
        "media-src": ["'self'"],
      },
    },
  })
);

// CORS with credentials; allow list from env (comma-separated) or single origin
const allowedOrigins = (process.env.CORS_ORIGINS || env.CLIENT_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);                 // same-origin / curl
      if (allowedOrigins.length === 0) return cb(null, true); // permissive if not configured
      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

// Body size limits to mitigate DoS via large payloads
app.use(express.json({ limit: process.env.JSON_LIMIT || '200kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || '200kb' }));

// *** SESSION MIDDLEWARE — MUST COME BEFORE ANY ROUTES ***
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
      ttl: 60 * 60 * 24 * 14, // 14 days
      autoRemove: 'interval',
      autoRemoveInterval: 10, // minutes
    }),
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax', // switch to 'none' only if truly cross-site over HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    },
  })
);

// Attach user (works for both session cookie & Bearer JWT)
app.use(attachUser);

// ==================================================================
// Static files with strong no-cache for HTML/JS/CSS (SPA-friendly)
// ==================================================================
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith('.html') ||
        filePath.endsWith('.js') ||
        filePath.endsWith('.css')
      ) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  })
);
// ==================================================================

// Ensure a CSRF cookie exists on all requests (after session)
app.use(issueCsrfToken);

// Prevent caching of API responses
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ----- CSRF endpoints (BEFORE any rate limiters) -----
app.get('/api/auth/csrf', getCsrfToken);
app.get('/api/csrf-token', getCsrfToken); // alias for convenience

// ----- Rate Limiting -----

// Stricter limiter for auth endpoints (login/register/etc.)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

// Global API rate limit, but **skip** auth paths to avoid double counting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // This runs with mountpoint '/api', so req.path is relative to '/api'
    // Skip any path that starts with /auth or /auth-cookie to avoid overlap
    return req.path.startsWith('/auth') || req.path.startsWith('/auth-cookie');
  },
});

// More lenient limiter for notifications/subscriptions
const notificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many subscription attempts from this IP, please try again later.',
});

// Apply limiters
app.use(['/api/auth', '/api/auth-cookie'], authLimiter);
app.use('/api/', apiLimiter);
app.use(['/api/notifications', '/api/subscribe', '/api/subscription'], notificationLimiter);

// ----- Routes -----

// Cookie-based auth (login/logout/me) — canonical path
app.use('/api/auth-cookie', authCookieRoutes);

// Back-compat: keep legacy token endpoints under /api/auth
app.use('/api/auth', authRoutes);

// Domain routes
app.use('/api/names', namesRoutes);

// ---------- Subscription/Notifications (explicit mounts) ----------
// Canonical namespace for subscriptions:
app.use('/api/subscription', subscriptionRoutes);
// Explicit notifications namespace:
app.use('/api/notifications', subscriptionRoutes);

// Back-compat redirects from legacy endpoints to canonical ones:
app.post('/api/subscribe*', (req, res) =>
  res.redirect(308, `/api/subscription${req.path.replace(/^\/api\/subscribe/, '/subscribe')}`)
);
app.get('/api/vapid-public-key*', (req, res) =>
  res.redirect(308, `/api/subscription${req.path.replace(/^\/api\/vapid-public-key/, '/vapid-public-key')}`)
);

// ---------- Translation & Quran ----------
// Canonical
app.use('/api/translation', translationRoutes);
app.use('/api/quran', quranRoutes);

// Legacy mounts with warning + optional redirect (toggle via env.LEGACY_REDIRECTS='true')
const legacyWarn = (from, to) => (req, _res, next) => {
  logger.warn?.(`Legacy route hit: ${from}${req.path} — consider updating client to ${to}${req.path}`);
  next();
};
if (env.LEGACY_REDIRECTS === 'true') {
  app.use('/', (req, res) => res.redirect(308, `/api/translation${req.path === '/' ? '' : req.path}`));
  app.use('/api/explorer', (req, res) => res.redirect(308, `/api/quran${req.path.replace(/^\/api\/explorer/, '')}`));
} else {
  app.use('/', legacyWarn('/', '/api/translation'), translationRoutes);
  app.use('/api/explorer', legacyWarn('/api/explorer', '/api/quran'), quranRoutes);
}

// History (web UI likely uses session)
app.use('/api/history', requireSession, historyRoutes);

// Generic API routes (keep as needed)
app.use('/api', apiRoutes);

// User routes
app.use('/api/user', userRoutes);

// ----- SPA Fallback (for non-API routes) -----
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----- Error Handling -----

// Handle csurf-style token errors gracefully if any arise upstream
app.use((err, req, res, next) => {
  if (err && (err.code === 'EBADCSRFTOKEN' || err.name === 'EBADCSRFTOKEN')) {
    logger.warn?.('Invalid CSRF token', { path: req.path });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next(err);
});

// Centralized error handler (keep LAST)
app.use(errorHandler);

// ----- Start server with DB connection -----
async function startServer() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    logger.info?.('✅ Successfully connected to MongoDB via Mongoose.');
    server.listen(env.PORT || 3000, () => {
      logger.info?.(`🚀 Server running on port ${env.PORT || 3000}...`);
    });
  } catch (err) {
    logger.error?.({ err }, '❌ Database connection failed');
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
const shutdown = async () => {
  try {
    logger.info?.('🛑 Shutting down HTTP server...');
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
