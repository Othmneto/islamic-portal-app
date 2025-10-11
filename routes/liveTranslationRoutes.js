/**
 * Live Translation API Routes
 * REST API endpoints for managing live translation sessions
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getInstance: getSessionManager } = require('../services/liveSessionManager');
const { getInstance: getLiveTranslationService } = require('../services/liveTranslationService');
const { requireAuth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();
const sessionManager = getSessionManager();
const liveTranslationService = getLiveTranslationService();

/**
 * Validation middleware
 */
const validateCreateSession = [
    body('sourceLanguage').optional().isString().isLength({ min: 2, max: 10 }),
    body('sourceLanguageName').optional().isString().isLength({ min: 2, max: 50 }),
    body('title').optional().isString().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('password').optional().isString().isLength({ min: 4, max: 50 }),
    body('settings.maxWorshippers').optional().isInt({ min: 1, max: 500 }),
    body('settings.audioQuality').optional().isIn(['low', 'medium', 'high'])
];

const validateSessionId = [
    param('sessionId').isString().isLength({ min: 1, max: 50 })
];

const validateJoinSession = [
    body('targetLanguage').isString().isLength({ min: 2, max: 10 }),
    body('targetLanguageName').optional().isString().isLength({ min: 2, max: 50 }),
    body('password').optional().isString()
];

/**
 * POST /api/live-translation/session/create
 * Create a new live translation session (Imam)
 */
router.post(
    '/session/create',
    requireAuth,
    validateCreateSession,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const result = await sessionManager.createSession(
                req.user.id,
                req.user.username || req.user.email,
                req.body
            );

            if (result.success) {
                logger.info(`✅ [LiveTranslationAPI] Session created: ${result.sessionId}`);
                res.json({
                    success: true,
                    sessionId: result.sessionId,
                    session: result.session
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Failed to create session'
                });
            }

        } catch (error) {
            logger.error('[LiveTranslationAPI] Create session error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/live-translation/session/:sessionId
 * Get session details
 */
router.get(
    '/session/:sessionId',
    validateSessionId,
    async (req, res) => {
        try {
            const { sessionId } = req.params;

            const session = await sessionManager.getSession(sessionId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            // Sanitize session data
            const sanitized = sessionManager.sanitizeSession(session);

            res.json({
                success: true,
                session: sanitized
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Get session error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /api/live-translation/session/:sessionId/join
 * Join a session (Worshipper)
 */
router.post(
    '/session/:sessionId/join',
    requireAuth,
    validateSessionId,
    validateJoinSession,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { sessionId } = req.params;
            const { targetLanguage, targetLanguageName, password } = req.body;

            // Verify session exists
            const session = await sessionManager.getSession(sessionId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            // Verify password if protected
            if (session.isPasswordProtected) {
                const passwordCheck = await sessionManager.verifySessionPassword(sessionId, password);
                if (!passwordCheck.success) {
                    return res.status(401).json({
                        success: false,
                        error: passwordCheck.error || 'Invalid password'
                    });
                }
            }

            res.json({
                success: true,
                sessionId,
                session: sessionManager.sanitizeSession(session),
                message: 'Ready to join. Connect via WebSocket to receive translations.'
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Join session error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * DELETE /api/live-translation/session/:sessionId/leave
 * Leave a session (Worshipper)
 */
router.delete(
    '/session/:sessionId/leave',
    requireAuth,
    validateSessionId,
    async (req, res) => {
        try {
            const { sessionId } = req.params;

            const result = await sessionManager.removeWorshipper(
                sessionId,
                req.user.id,
                null // socketId not needed for REST API
            );

            res.json(result);

        } catch (error) {
            logger.error('[LiveTranslationAPI] Leave session error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/live-translation/session/:sessionId/history
 * Get translation history for a session
 */
router.get(
    '/session/:sessionId/history',
    validateSessionId,
    async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const session = await sessionManager.getSession(sessionId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            // Get translations with pagination
            const translations = session.translations
                .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
                .reverse(); // Most recent first

            res.json({
                success: true,
                sessionId,
                translations,
                total: session.translations.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Get history error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/live-translation/sessions/my-sessions
 * Get all sessions for current user (Imam)
 */
router.get(
    '/sessions/my-sessions',
    requireAuth,
    async (req, res) => {
        try {
            const { includeEnded = false } = req.query;

            const sessions = await sessionManager.getSessionsByImam(
                req.user.id,
                includeEnded === 'true'
            );

            const sanitized = sessions.map(s => sessionManager.sanitizeSession(s));

            res.json({
                success: true,
                sessions: sanitized,
                count: sanitized.length
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Get my sessions error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/live-translation/sessions/active
 * Get all active sessions (public)
 */
router.get(
    '/sessions/active',
    async (req, res) => {
        try {
            const stats = sessionManager.getStatistics();

            res.json({
                success: true,
                activeSessions: stats.activeSessions,
                totalWorshippers: stats.totalWorshippers,
                sessions: stats.sessions.map(s => ({
                    sessionId: s.sessionId,
                    status: s.status,
                    worshippers: s.worshippers,
                    duration: s.duration
                }))
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Get active sessions error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * PUT /api/live-translation/session/:sessionId/language
 * Change target language (Worshipper)
 */
router.put(
    '/session/:sessionId/language',
    requireAuth,
    validateSessionId,
    body('targetLanguage').isString().isLength({ min: 2, max: 10 }),
    body('targetLanguageName').optional().isString().isLength({ min: 2, max: 50 }),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { sessionId } = req.params;
            const { targetLanguage, targetLanguageName } = req.body;

            // This will be handled via WebSocket in real-time
            // This endpoint is for confirming the change
            res.json({
                success: true,
                sessionId,
                targetLanguage,
                message: 'Language preference updated. Changes will apply to new translations.'
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Change language error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/live-translation/statistics
 * Get system-wide statistics (admin/monitoring)
 */
router.get(
    '/statistics',
    requireAuth,
    async (req, res) => {
        try {
            const stats = liveTranslationService.getStatistics();
            const metrics = liveTranslationService.getMetrics();

            res.json({
                success: true,
                statistics: stats,
                metrics
            });

        } catch (error) {
            logger.error('[LiveTranslationAPI] Get statistics error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /api/live-translation/session/:sessionId/end
 * End a session (Imam only)
 */
router.post(
    '/session/:sessionId/end',
    requireAuth,
    validateSessionId,
    async (req, res) => {
        try {
            const { sessionId } = req.params;

            // Verify user is the Imam
            const session = await sessionManager.getSession(sessionId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            if (session.imamId.toString() !== req.user.id.toString()) {
                return res.status(403).json({
                    success: false,
                    error: 'Only the session creator can end the session'
                });
            }

            const result = await sessionManager.updateSessionStatus(sessionId, 'ended');

            res.json(result);

        } catch (error) {
            logger.error('[LiveTranslationAPI] End session error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;

