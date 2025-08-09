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
    credentials: true,
  },
});
require('./websockets/socketManager')(io);

// ----- Global Middleware -----
app.use(cookieParser()); // Must be before any route that needs cookies

// Enable Helmet with a secure Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://cdnjs.cloudflare.com"],
      "style-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      "connect-src": ["'self'", "https://kaabah-ai-model-1-0-0.onrender.com"],
      "img-src": ["'self'", "data:"], // data: is for inline SVGs or base64 images
    },
  },
}));

// CORS must be enabled for dev tools or if your UI is on another origin.
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
      console.log(`🚀 Server running on port ${env.PORT}...`);
    });
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
}

startServer();