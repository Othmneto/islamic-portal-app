// translator-backend/server.js

// Load validated env (from ./config using zod)
const { env } = require('./config');

// --- Core ---
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// --- Security & cookies ---
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// --- Sessions ---
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- CSRF ---
const { getCsrfToken, issueCsrfToken } = require('./middleware/csrfMiddleware');

// --- Media toolchain (existing in your app) ---
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// --- Routes ---
const quranRoutes = require('./routes/quranRoutes');
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');              // optional legacy token auth
const namesRoutes = require('./routes/api/names');
const userRoutes = require('./routes/userRoutes');
const authCookieRoutes = require('./routes/authCookieRoutes');  // cookie-based login/csrf/me/logout
const subscriptionRoutes = require('./routes/subscriptionRoutes');

// --- Error middleware ---
const errorHandler = require('./middleware/errorMiddleware');

// ----- Initial setup -----
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);

// If behind a proxy (Render/Heroku/Nginx), enable this so secure cookies work in prod
app.set('trust proxy', 1);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
});
require('./websockets/socketManager')(io);

// ----- Global Middleware -----

// Cookies first (so sessions & CSRF can read them)
app.use(cookieParser());

// Security headers (single helmet instance)
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

// CORS with credentials (must match your frontend origin)
app.use(
  cors({
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *** SESSION MIDDLEWARE — MUST COME BEFORE ANY ROUTES ***
app.use(
  session({
    name: 'sid',
    secret: env.SESSION_SECRET,           // ensure this exists in ./config and your .env
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: env.MONGO_URI,
      dbName: env.DB_NAME,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 7,              // 7 days
    }),
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production', // secure cookies in prod over https
      sameSite: 'lax',                        // change to 'none' if you truly need cross-site cookies
      maxAge: 1000 * 60 * 60 * 24 * 7,       // 7 days
    },
  })
);

// ==================================================================
// THE FIX: Force Browser to Never Cache Static Files
// ==================================================================
app.use(
  express.static('public', {
    setHeaders: (res, filePath /* , stat */) => {
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

// Ensure a CSRF cookie exists on all requests (after session so it can use it if needed)
app.use(issueCsrfToken);

// ----- Routes -----

// CSRF token fetch endpoint for frontend
app.get('/api/auth/csrf', getCsrfToken);

// Cookie-based auth (login-cookie, logout-cookie, csrf, me)
app.use('/api/auth', authCookieRoutes);

// Optional: legacy Bearer auth endpoints (login/register etc.)
app.use('/api/auth', authRoutes);

// Domain routes
app.use('/api/names', namesRoutes);
app.use('/', translationRoutes);
app.use('/history', historyRoutes);
app.use('/api', apiRoutes);
app.use('/api/explorer', quranRoutes);

// Notifications (req.session is available here now ✅)
app.use('/api/notifications', subscriptionRoutes);
// Back-compat for older paths like /api/subscribe, /api/vapid-public-key:
app.use('/api', subscriptionRoutes);

// User routes
app.use('/api/user', userRoutes);

// Centralized error handler (keep last)
app.use(errorHandler);

// ----- Start server with DB connection -----
async function startServer() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log('✅ Successfully connected to MongoDB via Mongoose.');

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}...`);
    });
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
