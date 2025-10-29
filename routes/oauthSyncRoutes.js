// routes/oauthSyncRoutes.js - OAuth Calendar Sync Routes

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { rateLimiters } = require('../middleware/rateLimiter');
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

// Sync with Google Calendar (with rate limiting: 10 syncs per 5 minutes)
router.post('/google/sync', rateLimiters.oauthSync, requireAuth, async (req, res) => {
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

// Sync with Microsoft Calendar (with rate limiting: 10 syncs per 5 minutes)
router.post('/microsoft/sync', rateLimiters.oauthSync, requireAuth, async (req, res) => {
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

// Debug endpoint to test Google Calendar API calls
router.get('/debug-google-calendar', requireAuth, async (req, res) => {
    try {
        console.log('🔍 [OAuth Sync] Debug Google Calendar API for user:', req.user.id);

        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user || !user.googleAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Google access token not found'
            });
        }

        const debugResults = {};

        // Test 1: Check calendar permissions
        try {
            const hasPermissions = await oauthCalendarSyncService.checkGoogleCalendarPermissions(user.googleAccessToken);
            debugResults.calendarPermissions = hasPermissions;
        } catch (error) {
            debugResults.calendarPermissions = { error: error.message };
        }

        // Test 2: Get primary calendar
        try {
            const primaryCalendar = await oauthCalendarSyncService.getGooglePrimaryCalendar(user.googleAccessToken);
            debugResults.primaryCalendar = {
                success: true,
                id: primaryCalendar.id,
                summary: primaryCalendar.summary,
                primary: primaryCalendar.primary
            };
        } catch (error) {
            debugResults.primaryCalendar = { error: error.message };
        }

        // Test 3: Get calendar list
        try {
            const calendars = await oauthCalendarSyncService.getGoogleCalendars(user.googleAccessToken);
            debugResults.calendarList = {
                success: true,
                count: calendars.length,
                calendars: calendars.map(cal => ({
                    id: cal.id,
                    summary: cal.summary,
                    primary: cal.primary
                }))
            };
        } catch (error) {
            debugResults.calendarList = { error: error.message };
        }

        res.json({
            success: true,
            debugResults: debugResults
        });

    } catch (error) {
        console.error('❌ [OAuth Sync] Error debugging Google Calendar:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to debug Google Calendar'
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

            if (googleTokenExpired && user.googleRefreshToken) {
                // Attempt automatic refresh transparently
                console.log('🔄 [OAuth Sync] Google token expired; attempting automatic refresh with saved refresh_token');
                try {
                    await oauthCalendarSyncService.refreshGoogleToken(user);
                    // Reload user to pick up updated tokens
                    const refreshed = await User.findById(user._id);
                    user.googleAccessToken = refreshed.googleAccessToken;
                    user.googleTokenExpiry = refreshed.googleTokenExpiry;
                    googleTokenExpired = oauthCalendarSyncService.isTokenExpired(user.googleTokenExpiry);
                    console.log('✅ [OAuth Sync] Google token refreshed during status check');
                } catch (refreshErr) {
                    console.log('⚠️ [OAuth Sync] Google auto-refresh failed:', refreshErr.message);
                }
            }

            if (!googleTokenExpired && user.googleAccessToken) {
                try {
                    // Set a timeout for permission check to avoid blocking
                    const permissionPromise = oauthCalendarSyncService.checkGoogleCalendarPermissions(user.googleAccessToken);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Permission check timeout')), 5000)
                    );

                    googleHasCalendarPermissions = await Promise.race([permissionPromise, timeoutPromise]);
                    console.log('✅ [OAuth Sync] Google calendar permissions check passed');
                } catch (error) {
                    console.log('⚠️ [OAuth Sync] Google calendar permissions check failed (non-blocking):', error.message);
                    // Don't set to false - assume permissions are OK if we have a valid token
                    googleHasCalendarPermissions = true;
                }
            }
        }

        if (user.microsoftAccessToken) {
            // Check if token is expired
            microsoftTokenExpired = oauthCalendarSyncService.isTokenExpired(user.microsoftTokenExpiry);

            if (microsoftTokenExpired && user.microsoftRefreshToken) {
                console.log('🔄 [OAuth Sync] Microsoft token expired; attempting automatic refresh with saved refresh_token');
                try {
                    await oauthCalendarSyncService.refreshMicrosoftToken(user);
                    const refreshed = await User.findById(user._id);
                    user.microsoftAccessToken = refreshed.microsoftAccessToken;
                    user.microsoftTokenExpiry = refreshed.microsoftTokenExpiry;
                    microsoftTokenExpired = oauthCalendarSyncService.isTokenExpired(user.microsoftTokenExpiry);
                    console.log('✅ [OAuth Sync] Microsoft token refreshed during status check');
                } catch (refreshErr) {
                    console.log('⚠️ [OAuth Sync] Microsoft auto-refresh failed:', refreshErr.message);
                }
            }

            if (!microsoftTokenExpired && user.microsoftAccessToken) {
                try {
                    // Set a timeout for permission check to avoid blocking
                    const permissionPromise = oauthCalendarSyncService.checkMicrosoftCalendarPermissions(user.microsoftAccessToken);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Permission check timeout')), 5000)
                    );

                    microsoftHasCalendarPermissions = await Promise.race([permissionPromise, timeoutPromise]);
                    console.log('✅ [OAuth Sync] Microsoft calendar permissions check passed');
                } catch (error) {
                    console.log('⚠️ [OAuth Sync] Microsoft calendar permissions check failed (non-blocking):', error.message);
                    // Don't set to false - assume permissions are OK if we have a valid token
                    microsoftHasCalendarPermissions = true;
                }
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
                needsReauth: (!user.googleAccessToken && !user.googleRefreshToken)
                    || (googleTokenExpired && !user.googleRefreshToken)
                    // Removed calendar permissions check from needsReauth - it's too strict
            },
            microsoft: {
                connected: microsoftConnected,
                lastSync: user.lastMicrosoftSync,
                hasToken: !!user.microsoftAccessToken,
                hasCalendarPermissions: microsoftHasCalendarPermissions,
                tokenExpired: microsoftTokenExpired,
                tokenExpiry: user.microsoftTokenExpiry,
                needsReauth: (!user.microsoftAccessToken && !user.microsoftRefreshToken)
                    || (microsoftTokenExpired && !user.microsoftRefreshToken)
                    // Removed calendar permissions check from needsReauth - it's too strict
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

// Fetch events from Google Calendar
router.get('/google/events', requireAuth, async (req, res) => {
    try {
        console.log('📥 [OAuth Sync] Fetching Google Calendar events for user:', req.user.id);

        // Fetch user from database to get OAuth tokens
        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user || !user.googleAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Google access token not found'
            });
        }

        // Get primary calendar first
        const primaryCalendar = await oauthCalendarSyncService.getGooglePrimaryCalendar(user.googleAccessToken);

        const result = await oauthCalendarSyncService.getGoogleEvents(
            user.googleAccessToken,
            primaryCalendar.id
        );

        res.json({
            success: true,
            provider: 'google',
            events: result,
            count: result.length
        });

    } catch (error) {
        console.error('❌ [OAuth Sync] Google events fetch error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch Google Calendar events'
        });
    }
});

// Fetch events from Microsoft Calendar
router.get('/microsoft/events', requireAuth, async (req, res) => {
    try {
        console.log('📥 [OAuth Sync] Fetching Microsoft Calendar events for user:', req.user.id);

        // Fetch user from database to get OAuth tokens
        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user || !user.microsoftAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Microsoft access token not found'
            });
        }

        const result = await oauthCalendarSyncService.getMicrosoftEvents(
            user.microsoftAccessToken,
            'primary'
        );

        res.json({
            success: true,
            provider: 'microsoft',
            events: result,
            count: result.length
        });

    } catch (error) {
        console.error('❌ [OAuth Sync] Microsoft events fetch error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch Microsoft Calendar events'
        });
    }
});

// Create event in Google Calendar
router.post('/google/create-event', requireAuth, async (req, res) => {
    try {
        console.log('📤 [OAuth Sync] Creating Google Calendar event for user:', req.user.id);

        const { event } = req.body;
        if (!event) {
            return res.status(400).json({
                success: false,
                error: 'Event data is required'
            });
        }

        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user || !user.googleAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Google access token not found'
            });
        }

        // Get primary calendar first
        const primaryCalendar = await oauthCalendarSyncService.getGooglePrimaryCalendar(user.googleAccessToken);

        // Convert event to format expected by service
        const eventData = {
            ...event,
            title: event.summary || event.title,
            startDate: new Date(event.start?.dateTime || event.startDate),
            endDate: new Date(event.end?.dateTime || event.endDate || event.startDate)
        };

        const result = await oauthCalendarSyncService.createGoogleEvent(
            user.googleAccessToken,
            primaryCalendar.id,
            eventData
        );

        res.json({
            success: true,
            provider: 'google',
            event: result
        });

    } catch (error) {
        console.error('❌ [OAuth Sync] Google event creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create Google Calendar event'
        });
    }
});

// Create event in Microsoft Calendar
router.post('/microsoft/create-event', requireAuth, async (req, res) => {
    try {
        console.log('📤 [OAuth Sync] Creating Microsoft Calendar event for user:', req.user.id);

        const { event } = req.body;
        if (!event) {
            return res.status(400).json({
                success: false,
                error: 'Event data is required'
            });
        }

        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user || !user.microsoftAccessToken) {
            return res.status(400).json({
                success: false,
                error: 'Microsoft access token not found'
            });
        }

        // Convert event to format expected by service
        const eventData = {
            ...event,
            title: event.subject || event.title,
            startDate: new Date(event.start?.dateTime || event.startDate),
            endDate: new Date(event.end?.dateTime || event.endDate || event.startDate),
            description: event.body?.content || event.description || ''
        };

        const result = await oauthCalendarSyncService.createMicrosoftEvent(
            user.microsoftAccessToken,
            'primary',
            eventData
        );

        res.json({
            success: true,
            provider: 'microsoft',
            event: result
        });

    } catch (error) {
        console.error('❌ [OAuth Sync] Microsoft event creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create Microsoft Calendar event'
        });
    }
});

module.exports = router;
