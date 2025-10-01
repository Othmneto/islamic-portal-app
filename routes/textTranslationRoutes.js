// routes/textTranslationRoutes.js - Text-only translation routes
const express = require('express');
const { body, validationResult } = require('express-validator');
const translationEngine = require('../translationEngineImproved');
const { addHistoryEntries } = require('../utils/storage');

const router = express.Router();

// Input validation middleware for new controller
const validateTranslationInput = [
    body('sourceText')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Source text must be between 1 and 5000 characters'),
    body('sourceLanguage')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Source language code must be 2-10 characters'),
    body('targetLanguage')
        .isLength({ min: 2, max: 10 })
        .withMessage('Target language code must be 2-10 characters'),
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
        const result = await translationEngine.translate(
            text || 'Hello world',
            fromLang || 'en',
            toLang || 'ar'
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
router.post('/translate', validateTranslationInput, require('../controllers/textTranslationController').translate);

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
                const translationResults = await translationEngine.translate(text, fromLang || 'auto', toLanguages);
                
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

// GET /history - Get translation history
router.get('/history', async (req, res) => {
    try {
        const TranslationHistory = require('../models/TranslationHistory');
        const userId = req.user?.id || 'anonymous';
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;

        const history = await TranslationHistory.find({ userId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .select('-__v');

        const total = await TranslationHistory.countDocuments({ userId });

        res.json({
            success: true,
            data: history,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('[Translation History] Error:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to retrieve translation history' 
        });
    }
});

// GET /stats - Get translation statistics
router.get('/stats', async (req, res) => {
    try {
        const TranslationHistory = require('../models/TranslationHistory');
        const userId = req.user?.id || 'anonymous';
        
        const totalTranslations = await TranslationHistory.countDocuments({ userId });
        const successfulTranslations = await TranslationHistory.countDocuments({ 
            userId, 
            error: { $exists: false } 
        });
        const failedTranslations = await TranslationHistory.countDocuments({ 
            userId, 
            error: { $exists: true } 
        });

        // Language pair statistics
        const languageStats = await TranslationHistory.aggregate([
            { $match: { userId, error: { $exists: false } } },
            { $group: { 
                _id: { from: '$from', to: '$to' }, 
                count: { $sum: 1 } 
            }},
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Daily translation count (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const dailyStats = await TranslationHistory.aggregate([
            { 
                $match: { 
                    userId, 
                    timestamp: { $gte: thirtyDaysAgo },
                    error: { $exists: false }
                } 
            },
            { 
                $group: { 
                    _id: { 
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    }, 
                    count: { $sum: 1 } 
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                totalTranslations,
                successfulTranslations,
                failedTranslations,
                successRate: totalTranslations > 0 ? (successfulTranslations / totalTranslations * 100).toFixed(2) : 0,
                languagePairs: languageStats,
                dailyActivity: dailyStats
            }
        });

    } catch (err) {
        console.error('[Translation Stats] Error:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to retrieve translation statistics' 
        });
    }
});

// GET /export/pdf - Export translation history as PDF
router.get('/export/pdf', async (req, res) => {
    try {
        const PDFDocument = require('pdfkit');
        const TranslationHistory = require('../models/TranslationHistory');
        const userId = req.user?.id || 'anonymous';
        
        const history = await TranslationHistory.find({ 
            userId,
            error: { $exists: false } // Only successful translations
        })
        .sort({ timestamp: -1 })
        .limit(100);

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="translation-history.pdf"');
        
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Translation History', 50, 50);
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, 50, 80);
        doc.text(`Total Translations: ${history.length}`, 50, 100);
        
        let yPosition = 130;

        // Content
        history.forEach((entry, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text(`Translation ${index + 1}`, 50, yPosition);
            yPosition += 25;
            
            doc.fontSize(10).text(`From: ${entry.from} → To: ${entry.to}`, 50, yPosition);
            yPosition += 15;
            
            doc.text(`Date: ${entry.timestamp.toLocaleString()}`, 50, yPosition);
            yPosition += 15;
            
            doc.text('Original:', 50, yPosition);
            yPosition += 15;
            doc.text(entry.original, 70, yPosition, { width: 500 });
            yPosition += 30;
            
            doc.text('Translated:', 50, yPosition);
            yPosition += 15;
            doc.text(entry.translated, 70, yPosition, { width: 500 });
            yPosition += 40;
            
            doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
            yPosition += 20;
        });

        doc.end();

    } catch (err) {
        console.error('[PDF Export] Error:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate PDF export' 
        });
    }
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
