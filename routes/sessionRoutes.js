// Session Management Routes
const express = require('express');
const router = express.Router();
const sessionManagementService = require('../services/sessionManagementService');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   POST /api/sessions/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_REFRESH_TOKEN',
                message: 'Refresh token is required'
            }
        });
    }

    const result = await sessionManagementService.refreshAccessToken(refreshToken);
    res.json({
        success: true,
        data: result
    });
}));

/**
 * @route   GET /api/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/', auth, asyncHandler(async (req, res) => {
    const sessions = await sessionManagementService.getUserSessions(req.user.id);
    res.json({
        success: true,
        data: sessions
    });
}));

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Invalidate specific session
 * @access  Private
 */
router.delete('/:sessionId', auth, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    const result = await sessionManagementService.invalidateSession(sessionId);
    res.json(result);
}));

/**
 * @route   DELETE /api/sessions
 * @desc    Invalidate all user sessions except current
 * @access  Private
 */
router.delete('/', auth, asyncHandler(async (req, res) => {
    const currentSessionId = req.headers['x-session-id']; // You'd need to pass this from frontend
    
    const result = await sessionManagementService.invalidateAllUserSessions(
        req.user.id, 
        currentSessionId
    );
    res.json(result);
}));

/**
 * @route   GET /api/sessions/stats
 * @desc    Get session statistics
 * @access  Private
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
    const stats = await sessionManagementService.getSessionStats(req.user.id);
    res.json({
        success: true,
        data: stats
    });
}));

/**
 * @route   PUT /api/sessions/:sessionId/activity
 * @desc    Update session activity
 * @access  Private
 */
router.put('/:sessionId/activity', auth, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    await sessionManagementService.updateSessionActivity(sessionId);
    res.json({
        success: true,
        message: 'Session activity updated'
    });
}));

module.exports = router;
