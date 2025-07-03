// routes/translationRoutes.js (Corrected with Forced Audio Conversion)
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { translateText, transcribeAudioFile, saveToMemory } = require('../text-to-speech');
const { addHistoryEntries } = require('../utils/storage');
const { validateSpeakRequest, validateAutoDetectSpeakRequest } = require('../middleware/validators');

const router = express.Router();

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
const upload = multer({ storage: storage });
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


module.exports = router;