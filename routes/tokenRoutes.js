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
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        console.log('🔄 [Token Refresh] Attempting to refresh token...');
        
        const result = await sessionManagementService.refreshAccessToken(refreshToken);
        
        console.log('✅ [Token Refresh] Token refreshed successfully');
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn,
                sessionId: result.sessionId
            }
        });
    } catch (error) {
        console.error('❌ [Token Refresh] Error:', error.message);
        
        res.status(401).json({
            success: false,
            message: error.message || 'Failed to refresh token',
            code: error.code || 'REFRESH_FAILED'
        });
    }
});

/**
 * @route   POST /api/token/validate
 * @desc    Validate access token and get token info
 * @access  Public
 */
router.post('/validate', async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Access token is required'
            });
        }

        const tokenInfo = sessionManagementService.getTokenInfo(accessToken);
        
        if (!tokenInfo) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        res.json({
            success: true,
            message: 'Token validated successfully',
            data: {
                isValid: !tokenInfo.isExpired,
                isExpired: tokenInfo.isExpired,
                needsRefresh: tokenInfo.needsRefresh,
                expiresAt: tokenInfo.expiresAt,
                timeUntilExpiry: tokenInfo.timeUntilExpiry,
                userId: tokenInfo.userId
            }
        });
    } catch (error) {
        console.error('❌ [Token Validate] Error:', error.message);
        
        res.status(401).json({
            success: false,
            message: 'Token validation failed',
            code: 'VALIDATION_FAILED'
        });
    }
});

/**
 * @route   POST /api/token/auto-refresh
 * @desc    Auto-refresh token if needed
 * @access  Public
 */
router.post('/auto-refresh', async (req, res) => {
    try {
        const { accessToken, refreshToken } = req.body;

        if (!accessToken || !refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Both access token and refresh token are required'
            });
        }

        console.log('🔄 [Auto Refresh] Checking if token needs refresh...');
        
        const result = await sessionManagementService.autoRefreshToken(accessToken, refreshToken);
        
        if (result.needsRefresh) {
            console.log('✅ [Auto Refresh] Token refreshed successfully');
        } else {
            console.log('ℹ️ [Auto Refresh] Token does not need refresh');
        }
        
        res.json({
            success: true,
            message: result.needsRefresh ? 'Token refreshed successfully' : 'Token is still valid',
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                needsRefresh: result.needsRefresh,
                expiresIn: result.expiresIn
            }
        });
    } catch (error) {
        console.error('❌ [Auto Refresh] Error:', error.message);
        
        res.status(401).json({
            success: false,
            message: error.message || 'Auto refresh failed',
            code: error.code || 'AUTO_REFRESH_FAILED'
        });
    }
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
