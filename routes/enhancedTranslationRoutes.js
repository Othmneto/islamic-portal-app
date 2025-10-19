const express = require('express');
const { body, validationResult } = require('express-validator');
const integrationService = require('../services/integrationService');
const router = express.Router();

/**
 * Enhanced Translation Routes
 * Provides access to all advanced translation features
 */

// Middleware to ensure services are initialized
const ensureInitialized = async (req, res, next) => {
    try {
        if (!integrationService.isInitialized) {
            await integrationService.initialize();
        }
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Service initialization failed',
            message: error.message
        });
    }
};

// Apply middleware to all routes
router.use(ensureInitialized);

/**
 * POST /api/enhanced-translation/translate
 * Enhanced translation with all features
 */
router.post('/translate', [
    body('text').notEmpty().withMessage('Text is required'),
    body('sourceLang').notEmpty().withMessage('Source language is required'),
    body('targetLang').notEmpty().withMessage('Target language is required'),
    body('userId').optional().isMongoId().withMessage('Invalid user ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors.array()
            });
        }

        const { text, sourceLang, targetLang, userId, options = {} } = req.body;

        const enhancedTranslationService = integrationService.getEnhancedTranslationService();
        const result = await enhancedTranslationService.translateText(
            text,
            sourceLang,
            targetLang,
            userId || 'anonymous',
            options
        );

        res.json(result);
    } catch (error) {
        console.error('Enhanced translation error:', error);
        res.status(500).json({
            success: false,
            error: 'Translation failed',
            message: error.message
        });
    }
});

/**
 * POST /api/enhanced-translation/analyze-context
 * Analyze text context for Islamic content
 */
router.post('/analyze-context', [
    body('text').notEmpty().withMessage('Text is required'),
    body('sourceLang').optional().isString().withMessage('Source language must be a string')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors.array()
            });
        }

        const { text, sourceLang = 'en' } = req.body;

        const contextAwareService = integrationService.getContextAwareService();
        const analysis = contextAwareService.analyzeContext(text, sourceLang);

        res.json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error('Context analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Context analysis failed',
            message: error.message
        });
    }
});

/**
 * POST /api/enhanced-translation/domain-enhancement
 * Get domain-specific translation enhancements
 */
router.post('/domain-enhancement', [
    body('text').notEmpty().withMessage('Text is required'),
    body('sourceLang').notEmpty().withMessage('Source language is required'),
    body('targetLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors.array()
            });
        }

        const { text, sourceLang, targetLang } = req.body;

        const domainSpecificService = integrationService.getDomainSpecificService();
        const enhancement = domainSpecificService.enhanceTranslation(text, sourceLang, targetLang);

        res.json({
            success: true,
            data: enhancement
        });
    } catch (error) {
        console.error('Domain enhancement error:', error);
        res.status(500).json({
            success: false,
            error: 'Domain enhancement failed',
            message: error.message
        });
    }
});

/**
 * GET /api/enhanced-translation/stats/:userId
 * Get translation statistics for a user
 */
router.get('/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;

        const enhancedTranslationService = integrationService.getEnhancedTranslationService();
        const stats = await enhancedTranslationService.getTranslationStats(
            userId,
            startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
            endDate || new Date().toISOString()
        );

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Stats retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics',
            message: error.message
        });
    }
});

/**
 * GET /api/enhanced-translation/health
 * Get service health status
 */
router.get('/health', async (req, res) => {
    try {
        const enhancedTranslationService = integrationService.getEnhancedTranslationService();
        const health = await enhancedTranslationService.getHealthStatus();

        res.json(health);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * GET /api/enhanced-translation/services-status
 * Get status of all services
 */
router.get('/services-status', async (req, res) => {
    try {
        const status = await integrationService.getServicesStatus();
        res.json(status);
    } catch (error) {
        console.error('Services status error:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * POST /api/enhanced-translation/encrypt
 * Encrypt sensitive data
 */
router.post('/encrypt', [
    body('data').notEmpty().withMessage('Data is required'),
    body('userId').notEmpty().withMessage('User ID is required'),
    body('context').optional().isString().withMessage('Context must be a string')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors.array()
            });
        }

        const { data, userId, context = 'translation' } = req.body;

        const encryptionService = integrationService.getEncryptionService();
        const encrypted = await encryptionService.encryptTranslation(data, userId, context);

        res.json({
            success: true,
            data: encrypted
        });
    } catch (error) {
        console.error('Encryption error:', error);
        res.status(500).json({
            success: false,
            error: 'Encryption failed',
            message: error.message
        });
    }
});

/**
 * POST /api/enhanced-translation/decrypt
 * Decrypt sensitive data
 */
router.post('/decrypt', [
    body('encryptedData').notEmpty().withMessage('Encrypted data is required'),
    body('userId').notEmpty().withMessage('User ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors.array()
            });
        }

        const { encryptedData, userId } = req.body;

        const encryptionService = integrationService.getEncryptionService();
        const decrypted = await encryptionService.decryptTranslation(encryptedData, userId);

        res.json({
            success: true,
            data: decrypted
        });
    } catch (error) {
        console.error('Decryption error:', error);
        res.status(500).json({
            success: false,
            error: 'Decryption failed',
            message: error.message
        });
    }
});

/**
 * GET /api/enhanced-translation/audit-logs/:userId
 * Get audit logs for a user
 */
router.get('/audit-logs/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate, limit = 100 } = req.query;

        const auditLoggingService = integrationService.getAuditLoggingService();
        const logs = await auditLoggingService.getUserAuditLogs(
            userId,
            startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            endDate || new Date().toISOString(),
            parseInt(limit)
        );

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Audit logs retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit logs',
            message: error.message
        });
    }
});

/**
 * GET /api/enhanced-translation/audit-stats
 * Get audit statistics
 */
router.get('/audit-stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const auditLoggingService = integrationService.getAuditLoggingService();
        const stats = await auditLoggingService.getAuditStatistics(
            startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
            endDate || new Date().toISOString()
        );

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Audit stats retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit statistics',
            message: error.message
        });
    }
});

module.exports = router;
