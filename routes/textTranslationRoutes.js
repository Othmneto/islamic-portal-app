// routes/textTranslationRoutes.js - Text-only translation routes
const express = require('express');
const { body, validationResult } = require('express-validator');
const { translateText } = require('../translationEngineImproved');
const { addHistoryEntries } = require('../utils/storage');

const router = express.Router();

// Input validation middleware
const validateTranslationInput = [
    body('text')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Text must be between 1 and 5000 characters'),
    body('fromLang')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Source language code must be 2-10 characters'),
    body('toLang')
        .isArray({ min: 1, max: 10 })
        .withMessage('Target languages must be an array with 1-10 languages'),
    body('toLang.*')
        .isLength({ min: 2, max: 10 })
        .withMessage('Each target language code must be 2-10 characters'),
    body('sessionId')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Session ID must be 1-100 characters')
];

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
    res.json({ message: 'Text translation routes are working!', timestamp: new Date().toISOString() });
});

// Test translation endpoint
router.post('/test-translation', async (req, res) => {
    try {
        const { text, fromLang, toLang } = req.body;
        
        // Simple test translation
        const result = await translateText(
            text || 'Hello world',
            fromLang || 'en',
            toLang || ['ar'],
            'default',
            'test-session'
        );
        
        res.json({
            success: true,
            message: 'Translation test successful',
            result: result
        });
    } catch (error) {
        console.error('Translation test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Translation test failed',
            message: error.message
        });
    }
});

// POST /translate - Main text translation endpoint
router.post('/translate', validateTranslationInput, async (req, res) => {
    try {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors.array()
            });
        }
        
        const { text, fromLang, toLang, sessionId } = req.body;

        // Normalize toLang to array format
        const toLanguages = Array.isArray(toLang) ? toLang : [toLang];
        
        console.log(`[TextTranslation] Translating: "${text}" from ${fromLang || 'auto'} to ${toLanguages.join(', ')}`);
        
        // Perform translation (using default voiceId for text-only translation)
        const translationResults = await translateText(text, fromLang || 'auto', toLanguages, 'text-only', sessionId);
        
        // Prepare history entries
        const newHistoryEntries = [];
        for (const result of translationResults) {
            newHistoryEntries.push({
                timestamp: new Date(),
                original: text,
                translated: result.translatedText,
                from: fromLang || 'auto',
                to: result.toLanguage,
                sessionId: sessionId,
                userId: req.user?.id || null,
                confidence: result.confidence,
                model: result.model,
                context: result.context || ''
            });
        }

        // Save to history
        if (newHistoryEntries.length > 0) {
            await addHistoryEntries(newHistoryEntries);
        }

        // Return results
        res.json({
            success: true,
            results: translationResults.map(result => ({
                translatedText: result.translatedText,
                toLanguage: result.toLanguage,
                confidence: result.confidence,
                model: result.model,
                source: result.source
            })),
            original: text,
            fromLang: fromLang || 'auto',
            toLang: toLanguages,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[TextTranslation] Error:', error);
        
        // Determine error type and status code
        let statusCode = 500;
        let errorMessage = 'Translation failed';
        let errorCode = 'TRANSLATION_ERROR';
        
        if (error.name === 'ValidationError') {
            statusCode = 400;
            errorMessage = 'Invalid input data';
            errorCode = 'VALIDATION_ERROR';
        } else if (error.name === 'TranslationError') {
            statusCode = error.statusCode || 500;
            errorMessage = error.message;
            errorCode = 'TRANSLATION_ERROR';
        } else if (error.message.includes('API key')) {
            statusCode = 503;
            errorMessage = 'Translation service temporarily unavailable';
            errorCode = 'SERVICE_UNAVAILABLE';
        } else if (error.message.includes('rate limit')) {
            statusCode = 429;
            errorMessage = 'Rate limit exceeded. Please try again later.';
            errorCode = 'RATE_LIMIT_EXCEEDED';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            errorCode,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /translate-batch - Batch translation endpoint
router.post('/translate-batch', async (req, res) => {
    try {
        const { texts, fromLang, toLang, sessionId } = req.body;
        
        // Validate required fields
        if (!texts || !Array.isArray(texts) || texts.length === 0 || !toLang) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: texts (array) and toLang are required'
            });
        }

        const toLanguages = Array.isArray(toLang) ? toLang : [toLang];
        const results = [];
        const allHistoryEntries = [];

        // Process each text
        for (const text of texts) {
            if (!text.trim()) continue;

            try {
                const translationResults = await translateText(text, fromLang || 'auto', toLanguages, null, sessionId);
                
                // Prepare results
                const textResults = translationResults.map(result => ({
                    translatedText: result.translatedText,
                    toLanguage: result.toLanguage,
                    confidence: result.confidence,
                    model: result.model,
                    source: result.source
                }));

                results.push({
                    original: text,
                    translations: textResults
                });

                // Prepare history entries
                for (const result of translationResults) {
                    allHistoryEntries.push({
                        timestamp: new Date(),
                        original: text,
                        translated: result.translatedText,
                        from: fromLang || 'auto',
                        to: result.toLanguage,
                        sessionId: sessionId,
                        userId: req.user?.id || null,
                        confidence: result.confidence,
                        model: result.model,
                        context: result.context || ''
                    });
                }

            } catch (error) {
                console.error(`[TextTranslation] Error translating text "${text}":`, error);
                results.push({
                    original: text,
                    error: error.message
                });
            }
        }

        // Save all history entries
        if (allHistoryEntries.length > 0) {
            await addHistoryEntries(allHistoryEntries);
        }

        res.json({
            success: true,
            results: results,
            fromLang: fromLang || 'auto',
            toLang: toLanguages,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[TextTranslation] Batch error:', error);
        res.status(500).json({
            success: false,
            error: 'Batch translation failed',
            message: error.message
        });
    }
});

// GET /languages - Get supported languages
router.get('/languages', (req, res) => {
    const languages = [
        { code: 'auto', name: 'Auto-Detect' },
        { code: 'en', name: 'English' },
        { code: 'ar', name: 'Arabic' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'es', name: 'Spanish' },
        { code: 'ur', name: 'Urdu' },
        { code: 'hi', name: 'Hindi' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ru', name: 'Russian' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'tr', name: 'Turkish' },
        { code: 'fa', name: 'Persian' },
        { code: 'bn', name: 'Bengali' },
        { code: 'id', name: 'Indonesian' },
        { code: 'ms', name: 'Malay' },
        { code: 'th', name: 'Thai' },
        { code: 'vi', name: 'Vietnamese' }
    ];

    res.json({
        success: true,
        languages: languages
    });
});

// GET /health - Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'text-translation'
    });
});

module.exports = router;
