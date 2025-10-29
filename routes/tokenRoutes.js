// Token management routes
const express = require('express');
const router = express.Router();
const sessionManagementService = require('../services/sessionManagementService');
const { createError } = require('../middleware/errorHandler');

/**
 * @route   POST /api/token/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
    return res.status(410).json({
        success: false,
        error: 'JWT flow deprecated',
        message: 'Use session-based authentication. Tokens are no longer supported.'
    });
});

/**
 * @route   POST /api/token/validate
 * @desc    Validate access token and get token info
 * @access  Public
 */
router.post('/validate', async (req, res) => {
    return res.status(410).json({
        success: false,
        error: 'JWT flow deprecated',
        message: 'Use session-based authentication. Token validation is not supported.'
    });
});

/**
 * @route   POST /api/token/auto-refresh
 * @desc    Auto-refresh token if needed
 * @access  Public
 */
router.post('/auto-refresh', async (req, res) => {
    return res.status(410).json({
        success: false,
        error: 'JWT flow deprecated',
        message: 'Use session-based authentication. Auto refresh is not supported.'
    });
});

/**
 * @route   GET /api/token/session-stats/:userId
 * @desc    Get session statistics for a user
 * @access  Private
 */
router.get('/session-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        console.log(`📊 [Session Stats] Getting stats for user: ${userId}`);

        const stats = await sessionManagementService.getSessionStats(userId);

        res.json({
            success: true,
            message: 'Session statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('❌ [Session Stats] Error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve session statistics',
            code: 'STATS_FAILED'
        });
    }
});

/**
 * @route   POST /api/token/invalidate
 * @desc    Invalidate a session
 * @access  Private
 */
router.post('/invalidate', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        console.log(`🚫 [Session Invalidate] Invalidating session: ${sessionId}`);

        const result = await sessionManagementService.invalidateSession(sessionId);

        res.json({
            success: true,
            message: 'Session invalidated successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ [Session Invalidate] Error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to invalidate session',
            code: 'INVALIDATE_FAILED'
        });
    }
});

module.exports = router;
