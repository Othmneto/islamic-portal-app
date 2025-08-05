// 1. Import the validated env object AT THE TOP. This handles all .env loading.
const { env } = require('./config');

// --- Core Dependencies ---
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http'); // For Socket.IO
const { Server } = require('socket.io'); // For Socket.IO

// --- Feature-specific Dependencies ---
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const rateLimit = require('express-rate-limit');

// --- Route Imports ---
const quranRoutes = require('./routes/quranRoutes');
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');
const namesRoutes = require('./routes/api/names');
const userRoutes = require('./routes/userRoutes');


// --- Middleware Imports ---
const errorHandler = require('./middleware/errorMiddleware');

// --- Initial Setup ---
ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();
const server = http.createServer(app); // Create HTTP server from Express app
const io = new Server(server, { // Initialize Socket.IO
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

// Pass the 'io' instance to our socket manager
require('./websockets/socketManager')(io);


// --- Create necessary directories ---
const audioDir = path.join(__dirname, 'public/audio');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


// --- Core Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});


// --- Mount Routers ---
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/names', apiLimiter, namesRoutes);
app.use('/', apiLimiter, translationRoutes);
app.use('/history', apiLimiter, historyRoutes);
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/explorer', apiLimiter, quranRoutes);
app.use('/api/notifications', require('./routes/subscriptionRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/user', apiLimiter, userRoutes);


// --- Centralized Error Handler ---
app.use(errorHandler);


// --- Start Server with Mongoose Connection ---
async function startServer() {
    try {
        // 2. Use the validated 'env' object for all configurations
        await mongoose.connect(env.MONGO_URI, {
            dbName: env.DB_NAME,
        });
        console.log("✅ Successfully connected to MongoDB via Mongoose.");

        // 3. Listen on the http server, not the express app
        server.listen(env.PORT, () => {
            console.log(`🚀 Server is running and accessible at http://localhost:${env.PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server due to a database connection error:", error);
        process.exit(1);
    }
}

startServer();