// routes/translationHistoryRoutes.js
const express = require('express');
const router = express.Router();
const TranslationHistory = require('../models/TranslationHistory');
const partialTranslationService = require('../services/partialTranslationService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Get user's translation history
router.get('/history', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, fromLanguage, toLanguage, sessionId, conversationId, isPartial, isFavorite } = req.query;
        const skip = (page - 1) * limit;

        const options = {
            limit: parseInt(limit),
            skip: parseInt(skip),
            fromLanguage,
            toLanguage,
            sessionId,
            conversationId,
            isPartial: isPartial === 'true',
            isFavorite: isFavorite === 'true'
        };

        const translations = await TranslationHistory.findByUser(req.user.id, options);
        const total = await TranslationHistory.countDocuments({
            userId: req.user.id,
            isDeleted: false,
            ...(fromLanguage && { fromLanguage }),
            ...(toLanguage && { toLanguage }),
            ...(sessionId && { sessionId }),
            ...(conversationId && { conversationId }),
            ...(isPartial !== undefined && { isPartial: isPartial === 'true' }),
            ...(isFavorite !== undefined && { isFavorite: isFavorite === 'true' })
        });

        res.json({
            success: true,
            data: {
                translations,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching translation history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch translation history'
        });
    }
});

// Get conversation history
router.get('/conversation/:conversationId', auth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { includePartial = true } = req.query;

        const translations = await partialTranslationService.getConversationHistory(
            conversationId,
            req.user.id,
            { includePartial: includePartial === 'true' }
        );

        res.json({
            success: true,
            data: translations
        });
    } catch (error) {
        logger.error('Error fetching conversation history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversation history'
        });
    }
});

// Search translations
router.get('/search', auth, async (req, res) => {
    try {
        const { q, page = 1, limit = 20, fromLanguage, toLanguage } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters long'
            });
        }

        const options = {
            limit: parseInt(limit),
            skip: (page - 1) * limit,
            fromLanguage,
            toLanguage
        };

        const translations = await partialTranslationService.searchUserTranslations(
            req.user.id,
            q.trim(),
            options
        );

        res.json({
            success: true,
            data: {
                translations,
                query: q.trim(),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: translations.length
                }
            }
        });
    } catch (error) {
        logger.error('Error searching translations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search translations'
        });
    }
});

// Get partial translation for real-time typing
router.post('/partial', auth, async (req, res) => {
    try {
        const { text, fromLanguage, toLanguage, sessionId } = req.body;

        if (!text || text.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Text must be at least 2 characters long'
            });
        }

        const partialTranslation = await partialTranslationService.getPartialTranslation(
            text,
            fromLanguage || 'auto',
            toLanguage || 'en',
            req.user.id,
            sessionId
        );

        if (partialTranslation) {
            res.json({
                success: true,
                data: partialTranslation
            });
        } else {
            res.json({
                success: true,
                data: null,
                message: 'No partial translation available'
            });
        }
    } catch (error) {
        logger.error('Error getting partial translation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get partial translation'
        });
    }
});

// Finalize partial translations
router.post('/finalize', auth, async (req, res) => {
    try {
        const { conversationId, finalText, fromLanguage, toLanguage } = req.body;

        if (!conversationId || !finalText) {
            return res.status(400).json({
                success: false,
                message: 'Conversation ID and final text are required'
            });
        }

        const finalTranslation = await partialTranslationService.finalizeTranslation(
            conversationId,
            req.user.id,
            finalText,
            fromLanguage || 'auto',
            toLanguage || 'en'
        );

        if (finalTranslation) {
            res.json({
                success: true,
                data: finalTranslation
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No partial translations found to finalize'
            });
        }
    } catch (error) {
        logger.error('Error finalizing translation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to finalize translation'
        });
    }
});

// Mark translation as favorite
router.patch('/:id/favorite', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { isFavorite } = req.body;

        const translation = await TranslationHistory.findOne({
            _id: id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!translation) {
            return res.status(404).json({
                success: false,
                message: 'Translation not found'
            });
        }

        if (isFavorite) {
            await translation.markAsFavorite();
        } else {
            await translation.unmarkAsFavorite();
        }

        res.json({
            success: true,
            data: translation
        });
    } catch (error) {
        logger.error('Error updating favorite status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update favorite status'
        });
    }
});

// Add tags to translation
router.patch('/:id/tags', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { tags } = req.body;

        if (!tags || !Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                message: 'Tags must be an array'
            });
        }

        const translation = await TranslationHistory.findOne({
            _id: id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!translation) {
            return res.status(404).json({
                success: false,
                message: 'Translation not found'
            });
        }

        await translation.addTags(tags);

        res.json({
            success: true,
            data: translation
        });
    } catch (error) {
        logger.error('Error adding tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add tags'
        });
    }
});

// Remove tags from translation
router.delete('/:id/tags', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { tags } = req.body;

        if (!tags || !Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                message: 'Tags must be an array'
            });
        }

        const translation = await TranslationHistory.findOne({
            _id: id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!translation) {
            return res.status(404).json({
                success: false,
                message: 'Translation not found'
            });
        }

        await translation.removeTags(tags);

        res.json({
            success: true,
            data: translation
        });
    } catch (error) {
        logger.error('Error removing tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove tags'
        });
    }
});

// Delete translation (soft delete)
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        const translation = await TranslationHistory.findOne({
            _id: id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!translation) {
            return res.status(404).json({
                success: false,
                message: 'Translation not found'
            });
        }

        await translation.softDelete();

        res.json({
            success: true,
            message: 'Translation deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting translation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete translation'
        });
    }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const stats = await partialTranslationService.getUserStats(req.user.id);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics'
        });
    }
});

// Export translations
router.post('/export', auth, async (req, res) => {
    try {
        const { format = 'json', conversationId, fromDate, toDate } = req.body;

        let query = {
            userId: req.user.id,
            isDeleted: false
        };

        if (conversationId) {
            query.conversationId = conversationId;
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        const translations = await TranslationHistory.find(query)
            .sort({ createdAt: -1 })
            .limit(1000);

        if (format === 'json') {
            res.json({
                success: true,
                data: translations
            });
        } else if (format === 'csv') {
            const csv = convertToCSV(translations);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=translations.csv');
            res.send(csv);
        } else {
            res.status(400).json({
                success: false,
                message: 'Unsupported export format'
            });
        }
    } catch (error) {
        logger.error('Error exporting translations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export translations'
        });
    }
});

// Helper function to convert translations to CSV
function convertToCSV(translations) {
    const headers = ['Date', 'Original Text', 'Translated Text', 'From Language', 'To Language', 'Confidence'];
    const rows = translations.map(t => [
        t.createdAt.toISOString(),
        `"${t.originalText.replace(/"/g, '""')}"`,
        `"${t.translatedText.replace(/"/g, '""')}"`,
        t.fromLanguage,
        t.toLanguage,
        t.confidence
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

module.exports = router;
