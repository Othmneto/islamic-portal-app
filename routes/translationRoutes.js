// routes/translationRoutes.js (Corrected with Forced Audio Conversion)
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { translateText, transcribeAudioFile, saveToMemory } = require('../translationEngineImproved');
const { addHistoryEntries } = require('../utils/storage');
const { validateSpeakRequest, validateAutoDetectSpeakRequest } = require('../middleware/validators');

const router = express.Router();

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
    res.json({ message: 'Translation routes are working!', timestamp: new Date().toISOString() });
});

// Setup Multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname || '.webm'));
    }
});

// Enhanced multer configuration with security limits
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1, // Only one file at a time
        fieldSize: 1024 * 1024 // 1MB field size limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow audio files
        const allowedMimes = [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/webm',
            'audio/ogg',
            'audio/m4a',
            'audio/aac'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed. Supported formats: MP3, WAV, WebM, OGG, M4A, AAC'), false);
        }
    }
});
const audioDir = path.join(__dirname, '..', 'public/audio');

// POST /speak
router.post('/speak', validateSpeakRequest, async (req, res) => {
    const { text, from, to, voiceId, sessionId } = req.body;
    
    try {
        const translationResults = await translateText(text, from, to, voiceId, sessionId);
        const newHistoryEntries = [];

        for (const result of translationResults) {
            const audioId = `${uuidv4()}.mp3`;
            const audioPath = path.join(audioDir, audioId);
            await fs.promises.writeFile(audioPath, result.audioBuffer);

            const historyEntry = {
                timestamp: new Date(),
                original: text,
                translated: result.translatedText,
                from: from,
                to: result.toLanguage,
                audioId: audioId,
                context: result.context,
                replayCount: 0,
                sessionId: sessionId,
                isFavorite: false
            };
            newHistoryEntries.push(historyEntry);
        }

        const insertResult = await addHistoryEntries(newHistoryEntries);
        
        const insertedIds = Object.values(insertResult.insertedIds);
        for (let i = 0; i < insertedIds.length; i++) {
            const dbId = insertedIds[i].toString();
            const originalTextForVector = newHistoryEntries[i].original;
            await saveToMemory(dbId, originalTextForVector, sessionId);
        }

        res.json(newHistoryEntries);
    } catch (err) {
        console.error("Server Error in /speak:", err);
        res.status(500).json({ error: err.message || 'Server error during translation.' });
    }
});

// POST /auto-detect-speak
router.post('/auto-detect-speak', upload.single('audioBlob'), validateAutoDetectSpeakRequest, async (req, res) => {
    const { toLang, voiceId, fromLang, sessionId } = req.body;
    const toLanguages = JSON.parse(toLang);

    const originalPath = req.file.path;
    let convertedPath = `${originalPath}.mp3`; // Always define a path for the converted file

    try {
        // <<< FIX: Always convert the uploaded file to MP3 using ffmpeg >>>
        // This ensures a consistent, high-quality format is sent to Whisper.
        await new Promise((resolve, reject) => {
            ffmpeg(originalPath)
                .toFormat('mp3')
                .on('error', (err) => {
                    console.error('ffmpeg error:', err);
                    reject(new Error('Failed to convert the uploaded file.'));
                })
                .on('end', () => resolve())
                .save(convertedPath);
        });

        // Now, proceed with the converted MP3 file
        const { originalText, detectedLang, translationResults } = await transcribeAudioFile(convertedPath, fromLang, toLanguages, voiceId, sessionId);
        const newHistoryEntries = [];

        for (const result of translationResults) {
            const audioId = `${uuidv4()}.mp3`;
            const audioPath = path.join(audioDir, audioId);
            await fs.promises.writeFile(audioPath, result.audioBuffer);
            
            const fromField = (fromLang && fromLang !== 'auto') ? fromLang : `Auto-Detect (${detectedLang})`;
            const historyEntry = {
                timestamp: new Date(),
                original: originalText,
                translated: result.translatedText,
                from: fromField,
                to: result.toLanguage,
                audioId: audioId,
                context: result.context,
                replayCount: 0,
                sessionId: sessionId,
                isFavorite: false
            };
            newHistoryEntries.push(historyEntry);
        }

        const insertResult = await addHistoryEntries(newHistoryEntries);

        const insertedIds = Object.values(insertResult.insertedIds);
        for (let i = 0; i < insertedIds.length; i++) {
            const dbId = insertedIds[i].toString();
            const originalTextForVector = newHistoryEntries[i].original;
            await saveToMemory(dbId, originalTextForVector, sessionId);
        }

        res.json(newHistoryEntries);
    } catch (err) {
        const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to process file.';
        console.error("Server Error in /auto-detect-speak:", err);
        res.status(500).json({ error: errorMessage });
    } finally {
        // Asynchronously clean up both the original upload and the converted file
        if (originalPath) {
            fs.promises.unlink(originalPath).catch(e => console.error("Error deleting original upload:", e));
        }
        if (convertedPath && fs.existsSync(convertedPath)) {
            fs.promises.unlink(convertedPath).catch(e => console.error("Error deleting converted file:", e));
        }
    }
});

// POST /translate - Simple text translation endpoint
router.post('/translate', async (req, res) => {
    const { text, fromLang, toLang, sessionId } = req.body;
    
    try {
        console.log('Translating text:', text.substring(0, 50) + '...');
        console.log('From language:', fromLang, 'To language:', toLang);
        
        // Convert language names to codes for the translateText function
        const languageMap = {
            'English': 'en',
            'Arabic': 'ar',
            'French': 'fr',
            'German': 'de',
            'Spanish': 'es',
            'Urdu': 'ur',
            'Hindi': 'hi',
            'Russian': 'ru',
            'Chinese': 'zh',
            'Japanese': 'ja'
        };
        
        const fromCode = languageMap[fromLang] || fromLang || 'auto';
        const toCode = languageMap[toLang] || toLang || 'en';
        
        console.log('Converted codes - From:', fromCode, 'To:', toCode);
        
        // Use the existing translateText function - normalize to array
        const toArr = Array.isArray(toCode) ? toCode : [toCode];
        const translationResults = await translateText(text, fromCode, toArr, null, sessionId);
        
        console.log('Translation results:', translationResults);
        
        // Return the first result (or create a simple response)
        if (translationResults && translationResults.length > 0) {
            const result = translationResults[0];
            res.json({
                translatedText: result.translatedText,
                fromLanguage: fromLang,
                toLanguage: result.toLanguage,
                confidence: result.confidence || 0.9,
                context: result.context || ''
            });
        } else {
            // Fallback response
            res.json({
                translatedText: text, // Return original if no translation
                fromLanguage: fromLang,
                toLanguage: toLang,
                confidence: 0.5,
                context: 'No translation available'
            });
        }
    } catch (err) {
        console.error("Server Error in /translate:", err);
        res.status(500).json({ 
            error: err.message || 'Translation failed',
            translatedText: text, // Return original text on error
            fromLanguage: fromLang,
            toLanguage: toLang,
            confidence: 0.1
        });
    }
});

module.exports = router;