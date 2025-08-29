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
const { issueCsrfToken, getCsrfToken } = require('./middleware/csrfMiddleware');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
let logger = console;
let httpLogger = (_req, _res, next) => next();
try {
  const l = require('./config/logger');
  logger = l.logger || logger;
  httpLogger = l.httpLogger || httpLogger;
} catch { /* optional logger not present */ }

const quranRoutes = require('./routes/quranRoutes');
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');
const namesRoutes = require('./routes/api/names');
const userRoutes = require('./routes/userRoutes');
const authCookieRoutes = require('./routes/authCookieRoutes');
const notificationsRouter = require('./routes/notifications');
const geocodeRouter = require('./routes/geocode');

const { attachUser, requireSession } = require('./middleware/authMiddleware');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
require('./websockets/socketManager')(io);

app.use(requestId);
app.use(cookieParser());
app.use(httpLogger);
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        "style-src-elem": [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
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

app.use(express.json({ limit: process.env.JSON_LIMIT || '200kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || '200kb' }));

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

app.use(attachUser);
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

app.use(issueCsrfToken);
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.get('/api/auth/csrf', getCsrfToken);
app.get('/api/csrf-token', getCsrfToken);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
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

app.use(['/api/auth', '/api/auth-cookie'], authLimiter, authCookieRoutes, authRoutes);

app.use('/api/notifications', notificationLimiter, notificationsRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/names', namesRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/quran', quranRoutes);
app.use('/api/history', requireSession, historyRoutes);
app.use('/api/user', userRoutes);

app.use('/api', apiLimiter, apiRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  if (err && (err.code === 'EBADCSRFTOKEN' || err.name === 'EBADCSRFTOKEN')) {
    logger.warn?.('Invalid CSRF token', { path: req.path });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next(err);
});

app.use(errorHandler);

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