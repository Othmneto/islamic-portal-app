// Enhanced Production Server - Based on working server.js with security enhancements
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

const { attachUser, requireSession } = require('./middleware/authMiddleware');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Enhanced security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
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
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "object-src": ["'none'"],
      "script-src-attr": ["'none'"],
      "upgrade-insecure-requests": []
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || env.CLIENT_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request ID middleware
app.use(requestId);

// Session configuration with enhanced security
app.use(session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: env.MONGODB_URI,
    touchAfter: 24 * 3600,
    ttl: 14 * 24 * 60 * 60,
    autoRemove: 'native',
    autoRemoveInterval: 10,
    stringify: false
  }),
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  },
  name: 'sessionId'
}));

// Passport configuration
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Enhanced rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Reduced for security
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication requests from this IP, please try again after 15 minutes',
  skip: (req) => {
    return req.path === '/api/auth/login' && req.method === 'POST' && req.body?.email;
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3, // Very strict for login
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/auth') || req.path.startsWith('/auth-cookie'),
});

// Static files with security headers
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    security: 'enhanced'
  });
});

// CSRF protection
app.use('/api/auth', issueCsrfToken);
app.get('/api/csrf-token', getCsrfToken);

// Routes with enhanced security
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/microsoft', microsoftAuth);
app.use('/api/auth-cookie', authLimiter, authCookieRoutes);
app.use('/api/user', userRoutes);
app.use('/api/prayer-log', prayerLogRoutes);
app.use('/api/notifications', notificationsRouter);
app.use('/api/location', locationRoutes);
app.use('/api/quran', quranRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/names', namesRoutes);
app.use('/api/', apiLimiter, apiRoutes);

// Error handling
app.use(errorHandler);

// Database connection
mongoose.connect(env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  bufferMaxEntries: 0
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Start prayer notification scheduler
prayerNotificationScheduler.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Start server
const PORT = env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Enhanced production server running on port ${PORT}`);
  console.log(`🔒 Enhanced security features enabled`);
  console.log(`📊 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`🛡️ Rate limiting: Enhanced`);
  console.log(`🍪 CSRF protection: Active`);
  console.log(`🔐 Security headers: Comprehensive`);
});

module.exports = app;
