// server.js (Final, Refactored Version)

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const rateLimit = require('express-rate-limit');
const quranRoutes = require('./routes/quranRoutes');



// --- Import Refactored Routes ---
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');


// --- Initial Setup ---
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000; // CORRECTED

// --- Create necessary directories and files on startup ---
const audioDir = path.join(__dirname, 'public/audio');
const uploadDir = path.join(__dirname, 'uploads');
const historyFilePath = path.join(__dirname, 'history.json');
const duasFilePath = path.join(__dirname, 'duas.json');
const namesFilePath = path.join(__dirname, 'names.json');
const countryIslamDataPath = path.join(__dirname, 'country_islam_data.json');

if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(historyFilePath)) fs.writeFileSync(historyFilePath, JSON.stringify([]));
if (!fs.existsSync(duasFilePath)) fs.writeFileSync(duasFilePath, JSON.stringify([]));
if (!fs.existsSync(namesFilePath)) fs.writeFileSync(namesFilePath, JSON.stringify([]));
if (!fs.existsSync(countryIslamDataPath)) fs.writeFileSync(countryIslamDataPath, JSON.stringify([]));


// --- Middleware ---

// 1. Security Enhancement: Apply rate limiting to all major API endpoints
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per window
	standardHeaders: true,
	legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

// 2. Standard Middleware
// app.use(bodyParser.json()); // REPLACED
app.use(express.json()); // CORRECT: Use built-in Express middleware
app.use(express.static('public'));


// --- Mount Routers ---
// Apply the rate limiter to the routers that handle API requests
app.use('/', apiLimiter, translationRoutes); 
app.use('/history', apiLimiter, historyRoutes); // historyRoutes is now only mounted here
// app.use('/export', apiLimiter, historyRoutes); // REMOVED THIS REDUNDANT LINE
app.use('/api', apiLimiter, apiRoutes);

app.use('/api/explorer', apiLimiter, quranRoutes);


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running and accessible at http://localhost:${PORT}`);
});