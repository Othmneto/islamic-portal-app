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

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
require('./websockets/socketManager')(io);

// Ensure required directories exist
const audioDir = path.join(__dirname, 'public/audio');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ----- Security/CORS/body -----
app.disable('x-powered-by');
app.set('trust proxy', 1); // allow secure cookies behind proxies in prod

// IMPORTANT: do NOT enable CSP here unless you add nonces to inline scripts.
// (Your admin page has inline JS; CSP 'script-src self' would block it.)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

app.use(cookieParser(env.COOKIE_SECRET));

// If you’re serving the frontend from this same server, CORS isn’t needed.
// Keep it enabled for dev tools or if your UI is on another origin.
app.use(
  cors({
    origin: env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.static('public')); // serves admin.html, sw.js, etc.

// ----- Routes (no rate limiter) -----
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

// Notifications (cookie auth happens inside the router)
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
      console.log(`🚀 Server running at http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server due to DB error:', error);
    process.exit(1);
  }
}

startServer();
