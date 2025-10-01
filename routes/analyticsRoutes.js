const express = require('express');
const router = express.Router();
const TranslationHistory = require('../models/TranslationHistory');

/**
 * GET /api/analytics
 * Root analytics endpoint - redirect to dashboard
 */
router.get('/', (req, res) => {
    res.redirect('/api/analytics/dashboard');
});

/**
 * POST /api/analytics/interactions
 * Log user interactions for analytics
 */
router.post('/interactions', async (req, res) => {
    try {
        // Log user interaction for analytics
        console.log('[Analytics] User interaction logged:', req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('[Analytics] Interaction logging failed:', error);
        res.status(500).json({ success: false, error: 'Failed to log interaction' });
    }
});

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics dashboard data
 */
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const days = parseInt(req.query.days) || 30;
        
        // Get basic statistics
        const stats = await TranslationHistory.getUserStats(userId, days);
        
        // Get language pair statistics
        const languageStats = await TranslationHistory.getLanguagePairStats(userId, 10);
        
        // Get daily activity
        const dailyActivity = await TranslationHistory.getDailyActivity(userId, days);
        
        // Get recent translations
        const recentTranslations = await TranslationHistory.find({ userId })
            .sort({ timestamp: -1 })
            .limit(10)
            .select('from to original translated timestamp confidence')
            .lean();
        
        // Get error statistics
        const errorStats = await TranslationHistory.aggregate([
            {
                $match: {
                    userId,
                    error: { $exists: true },
                    timestamp: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: '$error',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);
        
        // Get hourly activity pattern
        const hourlyActivity = await TranslationHistory.aggregate([
            {
                $match: {
                    userId,
                    timestamp: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                    error: { $exists: false }
                }
            },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);
        
        // Calculate success rate
        const successRate = stats.totalTranslations > 0 
            ? ((stats.successfulTranslations / stats.totalTranslations) * 100).toFixed(2)
            : 0;
        
        res.json({
            success: true,
            data: {
                overview: {
                    totalTranslations: stats.totalTranslations,
                    successfulTranslations: stats.successfulTranslations,
                    failedTranslations: stats.failedTranslations,
                    successRate: parseFloat(successRate),
                    avgConfidence: stats.avgConfidence ? stats.avgConfidence.toFixed(3) : 0,
                    avgProcessingTime: stats.avgProcessingTime ? Math.round(stats.avgProcessingTime) : 0
                },
                languagePairs: languageStats,
                dailyActivity: dailyActivity,
                recentTranslations: recentTranslations,
                errorStats: errorStats,
                hourlyActivity: hourlyActivity,
                period: {
                    days: days,
                    startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                }
            }
        });
        
    } catch (error) {
        console.error('[Analytics] Dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve analytics data'
        });
    }
});

/**
 * POST /api/analytics/error
 * Log error for analytics
 */
router.post('/error', async (req, res) => {
    try {
        const { error, errorCode, context, timestamp, userAgent, url } = req.body;
        const userId = req.user?.id || 'anonymous';
        
        // Log error to database
        await TranslationHistory.create({
            userId,
            from: 'error',
            to: 'error',
            original: context || 'Unknown context',
            translated: '',
            error: `${errorCode}: ${error}`,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            userAgent,
            source: 'error-logging'
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('[Analytics] Error logging failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to log error'
        });
    }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
router.get('/export', async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const format = req.query.format || 'csv';
        const days = parseInt(req.query.days) || 30;
        
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const translations = await TranslationHistory.find({
            userId,
            timestamp: { $gte: startDate }
        }).sort({ timestamp: -1 }).lean();
        
        if (format === 'csv') {
            const csv = generateCSV(translations);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="translation-analytics.csv"');
            res.send(csv);
        } else {
            res.json({
                success: true,
                data: translations
            });
        }
        
    } catch (error) {
        console.error('[Analytics] Export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export analytics data'
        });
    }
});

/**
 * Generate CSV from translation data
 */
function generateCSV(translations) {
    const headers = [
        'Timestamp',
        'From Language',
        'To Language',
        'Original Text',
        'Translated Text',
        'Confidence',
        'Processing Time (ms)',
        'Success',
        'Error Message',
        'Source'
    ];
    
    const rows = translations.map(translation => [
        translation.timestamp.toISOString(),
        translation.from,
        translation.to,
        `"${(translation.original || '').replace(/"/g, '""')}"`,
        `"${(translation.translated || '').replace(/"/g, '""')}"`,
        translation.confidence || '',
        translation.processingTime || '',
        translation.error ? 'No' : 'Yes',
        `"${(translation.error || '').replace(/"/g, '""')}"`,
        translation.source || 'web'
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

module.exports = router;
