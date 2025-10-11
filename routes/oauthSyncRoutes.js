// routes/oauthSyncRoutes.js - OAuth Calendar Sync Routes

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
const axios = require('axios');

// Re-authorization endpoints for calendar permissions
router.get('/google/reauth', (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Initiating Google calendar re-authorization');
        res.redirect('/api/auth/google/calendar-reauth');
    } catch (error) {
        console.error('❌ [OAuth Sync] Google re-auth error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to initiate Google calendar re-authorization' 
        });
    }
});

router.get('/microsoft/reauth', (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Initiating Microsoft calendar re-authorization');
        res.redirect('/api/auth/microsoft/calendar-reauth');
    } catch (error) {
        console.error('❌ [OAuth Sync] Microsoft re-auth error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to initiate Microsoft calendar re-authorization' 
        });
    }
});

// Sync with Google Calendar
router.post('/google/sync', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Starting Google sync for user:', req.user.id);
        
        const result = await oauthCalendarSyncService.syncWithGoogle(req.user.id);
        
        res.json({
            success: true,
            provider: 'google',
            eventsCount: result.eventsCount,
            lastSync: result.lastSync,
            message: 'Google Calendar sync completed successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Google sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to sync with Google Calendar' 
        });
    }
});

// Sync with Microsoft Calendar
router.post('/microsoft/sync', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Starting Microsoft sync for user:', req.user.id);
        
        const result = await oauthCalendarSyncService.syncWithMicrosoft(req.user.id);
        
        res.json({
            success: true,
            provider: 'microsoft',
            eventsCount: result.eventsCount,
            lastSync: result.lastSync,
            message: 'Microsoft Calendar sync completed successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Microsoft sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to sync with Microsoft Calendar' 
        });
    }
});

// Two-way sync with Google
router.post('/google/two-way', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Starting two-way Google sync for user:', req.user.id);
        
        const result = await oauthCalendarSyncService.twoWaySync(req.user.id, 'google');
        
        res.json({
            success: true,
            provider: 'google',
            syncType: 'two-way',
            message: 'Two-way Google Calendar sync completed successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Two-way Google sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to perform two-way sync with Google Calendar' 
        });
    }
});

// Two-way sync with Microsoft
router.post('/microsoft/two-way', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Starting two-way Microsoft sync for user:', req.user.id);
        
        const result = await oauthCalendarSyncService.syncWithMicrosoft(req.user.id);
        
        console.log('✅ [OAuth Sync] Two-way Microsoft sync completed:', result);
        
        res.json({
            success: true,
            provider: 'microsoft',
            result: result,
            message: 'Two-way Microsoft Calendar sync completed successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Two-way Microsoft sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to perform two-way Microsoft sync' 
        });
    }
});

// Push events to Google Calendar
router.post('/google/push', requireAuth, async (req, res) => {
    try {
        console.log('📤 [OAuth Sync] Pushing events to Google for user:', req.user.id);
        
        const { events } = req.body;
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Events array is required' 
            });
        }
        
        const result = await oauthCalendarSyncService.pushToGoogle(req.user.id, events);
        
        res.json({
            success: true,
            provider: 'google',
            eventsCount: result.eventsCount,
            message: 'Events pushed to Google Calendar successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Google push error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to push events to Google Calendar' 
        });
    }
});

// Push events to Microsoft Calendar
router.post('/microsoft/push', requireAuth, async (req, res) => {
    try {
        console.log('📤 [OAuth Sync] Pushing events to Microsoft for user:', req.user.id);
        
        const { events } = req.body;
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Events array is required' 
            });
        }
        
        const result = await oauthCalendarSyncService.pushToMicrosoft(req.user.id, events);
        
        res.json({
            success: true,
            provider: 'microsoft',
            eventsCount: result.eventsCount,
            message: 'Events pushed to Microsoft Calendar successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Microsoft push error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to push events to Microsoft Calendar' 
        });
    }
});

// Force token refresh for Google
router.post('/google/refresh-token', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Forcing Google token refresh for user:', req.user.id);
        
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (!user || !user.googleRefreshToken) {
            return res.status(400).json({
                success: false,
                error: 'No Google refresh token found. Please re-authorize.'
            });
        }
        
        // Use the refresh token to get a new access token
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: user.googleRefreshToken,
            grant_type: 'refresh_token'
        });
        
        // Update the user with new token
        user.googleAccessToken = response.data.access_token;
        if (response.data.refresh_token) {
            user.googleRefreshToken = response.data.refresh_token;
        }
        user.googleTokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
        await user.save();
        
        console.log('✅ [OAuth Sync] Google token refreshed successfully');
        
        res.json({
            success: true,
            message: 'Google token refreshed successfully',
            hasNewToken: true
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Google token refresh error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to refresh Google token'
        });
    }
});

// Force token refresh for Microsoft
router.post('/microsoft/refresh-token', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Forcing Microsoft token refresh for user:', req.user.id);
        
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (!user || !user.microsoftRefreshToken) {
            return res.status(400).json({
                success: false,
                error: 'No Microsoft refresh token found. Please re-authorize.'
            });
        }
        
        // Use the refresh token to get a new access token
        const response = await axios.post(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT || 'common'}/oauth2/v2.0/token`, {
            client_id: process.env.MICROSOFT_CLIENT_ID,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET,
            refresh_token: user.microsoftRefreshToken,
            grant_type: 'refresh_token',
            scope: 'openid email profile User.Read https://graph.microsoft.com/calendars.readwrite https://graph.microsoft.com/calendars.readwrite.shared'
        });
        
        // Update the user with new token
        user.microsoftAccessToken = response.data.access_token;
        if (response.data.refresh_token) {
            user.microsoftRefreshToken = response.data.refresh_token;
        }
        user.microsoftTokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
        await user.save();
        
        console.log('✅ [OAuth Sync] Microsoft token refreshed successfully');
        
        res.json({
            success: true,
            message: 'Microsoft token refreshed successfully',
            hasNewToken: true
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Microsoft token refresh error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to refresh Microsoft token'
        });
    }
});

// Debug endpoint to check user OAuth data
router.get('/debug-user', requireAuth, async (req, res) => {
    try {
        console.log('🔍 [OAuth Sync] Debug user data for:', req.user.id);
        
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        const debugData = {
            userId: user._id,
            email: user.email,
            google: {
                hasAccessToken: !!user.googleAccessToken,
                hasRefreshToken: !!user.googleRefreshToken,
                hasId: !!user.googleId,
                tokenExpiry: user.googleTokenExpiry,
                lastSync: user.lastGoogleSync
            },
            microsoft: {
                hasAccessToken: !!user.microsoftAccessToken,
                hasRefreshToken: !!user.microsoftRefreshToken,
                hasId: !!user.microsoftId,
                tokenExpiry: user.microsoftTokenExpiry,
                lastSync: user.lastMicrosoftSync
            }
        };
        
        console.log('🔍 [OAuth Sync] Debug data:', debugData);
        
        res.json({
            success: true,
            debugData: debugData
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Error getting debug data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get debug data' 
        });
    }
});

// Get sync status
router.get('/status', requireAuth, async (req, res) => {
    try {
        console.log('📊 [OAuth Sync] Getting sync status for user:', req.user.id);
        
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        console.log('🔍 [OAuth Sync] User OAuth tokens:', {
            googleAccessToken: !!user.googleAccessToken,
            googleId: !!user.googleId,
            googleTokenExpiry: user.googleTokenExpiry,
            microsoftAccessToken: !!user.microsoftAccessToken,
            microsoftId: !!user.microsoftId,
            microsoftTokenExpiry: user.microsoftTokenExpiry
        });
        
        // Additional debugging
        console.log('🔍 [OAuth Sync] Raw token values:', {
            googleAccessTokenLength: user.googleAccessToken ? user.googleAccessToken.length : 0,
            googleRefreshTokenLength: user.googleRefreshToken ? user.googleRefreshToken.length : 0,
            microsoftAccessTokenLength: user.microsoftAccessToken ? user.microsoftAccessToken.length : 0,
            microsoftRefreshTokenLength: user.microsoftRefreshToken ? user.microsoftRefreshToken.length : 0
        });
        
        // Check calendar permissions for each provider
        let googleHasCalendarPermissions = false;
        let microsoftHasCalendarPermissions = false;
        let googleTokenExpired = false;
        let microsoftTokenExpired = false;
        
        if (user.googleAccessToken) {
            // Check if token is expired
            googleTokenExpired = oauthCalendarSyncService.isTokenExpired(user.googleTokenExpiry);
            
            if (!googleTokenExpired) {
                try {
                    googleHasCalendarPermissions = await oauthCalendarSyncService.checkGoogleCalendarPermissions(user.googleAccessToken);
                } catch (error) {
                    console.log('❌ [OAuth Sync] Google calendar permissions check failed:', error.message);
                    googleHasCalendarPermissions = false;
                }
            } else {
                console.log('🔄 [OAuth Sync] Google token is expired, will need refresh');
            }
        }
        
        if (user.microsoftAccessToken) {
            // Check if token is expired
            microsoftTokenExpired = oauthCalendarSyncService.isTokenExpired(user.microsoftTokenExpiry);
            
            if (!microsoftTokenExpired) {
                try {
                    microsoftHasCalendarPermissions = await oauthCalendarSyncService.checkMicrosoftCalendarPermissions(user.microsoftAccessToken);
                } catch (error) {
                    console.log('❌ [OAuth Sync] Microsoft calendar permissions check failed:', error.message);
                    microsoftHasCalendarPermissions = false;
                }
            } else {
                console.log('🔄 [OAuth Sync] Microsoft token is expired, will need refresh');
            }
        }
        
        const googleConnected = !!(user.googleAccessToken && user.googleId);
        const microsoftConnected = !!(user.microsoftAccessToken && user.microsoftId);
        
        console.log('🔍 [OAuth Sync] Connection calculations:', {
            googleAccessToken: !!user.googleAccessToken,
            googleId: !!user.googleId,
            googleConnected: googleConnected,
            microsoftAccessToken: !!user.microsoftAccessToken,
            microsoftId: !!user.microsoftId,
            microsoftConnected: microsoftConnected
        });
        
        const syncStatus = {
            google: {
                connected: googleConnected,
                lastSync: user.lastGoogleSync,
                hasToken: !!user.googleAccessToken,
                hasCalendarPermissions: googleHasCalendarPermissions,
                tokenExpired: googleTokenExpired,
                tokenExpiry: user.googleTokenExpiry,
                needsReauth: !user.googleAccessToken || googleTokenExpired || (user.googleAccessToken && !googleHasCalendarPermissions)
            },
            microsoft: {
                connected: microsoftConnected,
                lastSync: user.lastMicrosoftSync,
                hasToken: !!user.microsoftAccessToken,
                hasCalendarPermissions: microsoftHasCalendarPermissions,
                tokenExpired: microsoftTokenExpired,
                tokenExpiry: user.microsoftTokenExpiry,
                needsReauth: !user.microsoftAccessToken || microsoftTokenExpired || (user.microsoftAccessToken && !microsoftHasCalendarPermissions)
            },
            totalEvents: user.calendarEvents ? user.calendarEvents.length : 0,
            externalEvents: user.calendarEvents ? user.calendarEvents.filter(e => e.isExternal).length : 0
        };
        
        console.log('📊 [OAuth Sync] Final sync status:', syncStatus);
        
        res.json({
            success: true,
            syncStatus: syncStatus,
            message: 'Sync status retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Error getting sync status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get sync status' 
        });
    }
});

// Force full sync (both providers)
router.post('/full-sync', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Starting full sync for user:', req.user.id);
        
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        const results = [];
        
        // Sync with Google if connected
        if (user.googleAccessToken && user.googleId) {
            try {
                const googleResult = await oauthCalendarSyncService.syncWithGoogle(req.user.id);
                results.push({
                    provider: 'google',
                    success: true,
                    eventsCount: googleResult.eventsCount
                });
            } catch (error) {
                results.push({
                    provider: 'google',
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Sync with Microsoft if connected
        if (user.microsoftAccessToken && user.microsoftId) {
            try {
                const microsoftResult = await oauthCalendarSyncService.syncWithMicrosoft(req.user.id);
                results.push({
                    provider: 'microsoft',
                    success: true,
                    eventsCount: microsoftResult.eventsCount
                });
            } catch (error) {
                results.push({
                    provider: 'microsoft',
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results: results,
            message: 'Full sync completed'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Full sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to perform full sync' 
        });
    }
});

// Two-way sync with Google Calendar
router.post('/google/two-way', requireAuth, async (req, res) => {
    try {
        console.log('🔄 [OAuth Sync] Starting two-way Google sync for user:', req.user.id);
        
        const result = await oauthCalendarSyncService.syncWithGoogle(req.user.id);
        
        console.log('✅ [OAuth Sync] Two-way Google sync completed:', result);
        
        res.json({
            success: true,
            provider: 'google',
            result: result,
            message: 'Two-way Google Calendar sync completed successfully'
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Two-way Google sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to perform two-way Google sync' 
        });
    }
});

// Sync Islamic events to Google Calendar
router.post('/google/sync-islamic-events', requireAuth, async (req, res) => {
    try {
        console.log('🕌 [OAuth Sync] Syncing Islamic events to Google for user:', req.user.id);
        
        const { latitude, longitude, country } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }
        
        const result = await oauthCalendarSyncService.syncIslamicEvents(
            req.user.id,
            'google',
            parseFloat(latitude),
            parseFloat(longitude),
            country || 'AE'
        );
        
        res.json({
            success: true,
            message: 'Islamic events synced to Google Calendar successfully',
            ...result
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Islamic events sync to Google error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync Islamic events to Google'
        });
    }
});

// Sync Islamic events to Microsoft Calendar
router.post('/microsoft/sync-islamic-events', requireAuth, async (req, res) => {
    try {
        console.log('🕌 [OAuth Sync] Syncing Islamic events to Microsoft for user:', req.user.id);
        
        const { latitude, longitude, country } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }
        
        const result = await oauthCalendarSyncService.syncIslamicEvents(
            req.user.id,
            'microsoft',
            parseFloat(latitude),
            parseFloat(longitude),
            country || 'AE'
        );
        
        res.json({
            success: true,
            message: 'Islamic events synced to Microsoft Calendar successfully',
            ...result
        });
        
    } catch (error) {
        console.error('❌ [OAuth Sync] Islamic events sync to Microsoft error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync Islamic events to Microsoft'
        });
    }
});

module.exports = router;
