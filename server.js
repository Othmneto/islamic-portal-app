// translator-backend - full/server.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser'); // This might be redundant if using express.json()
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const rateLimit = require('express-rate-limit');

// NEW: Import mongoose
const mongoose = require('mongoose');

// REMOVE THIS LINE: connectToDb is for raw MongoClient, we'll use Mongoose now
// const { connectToDb } = require('./utils/db'); 

const quranRoutes = require('./routes/quranRoutes');
const historyRoutes = require('./routes/historyRoutes');
const translationRoutes = require('./routes/translationRoutes');
const apiRoutes = require('./routes/apiRoutes');

// NEW: Import authRoutes (assuming you created this file as per previous instructions)
const authRoutes = require('./routes/authRoutes');


// --- Initial Setup ---
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

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
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

// Use built-in Express middleware for JSON body parsing
app.use(express.json());
app.use(express.static('public'));


// --- Mount Routers ---
// Apply the rate limiter to the routers that handle API requests
app.use('/api/auth', apiLimiter, authRoutes); // NEW LINE FOR AUTH ROUTES
app.use('/', apiLimiter, translationRoutes);
app.use('/history', apiLimiter, historyRoutes);
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/explorer', apiLimiter, quranRoutes);


// --- Start Server (MODIFIED for Mongoose connection) ---
async function startServer() {
    try {
        // Establish Mongoose connection first
        // Use the same MONGO_URI and DB_NAME from your .env file
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME, // Specify the database name here
            // useNewUrlParser: true, // These are default in modern Mongoose
            // useUnifiedTopology: true, // and no longer needed.
        });
        console.log("✅ Successfully connected to MongoDB Atlas via Mongoose.");

        app.listen(PORT, () => {
            console.log(`✅ Server is running and accessible at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server due to database connection error:", error);
        process.exit(1); // Exit if DB connection fails
    }
}

startServer(); // Call the async function to start the server