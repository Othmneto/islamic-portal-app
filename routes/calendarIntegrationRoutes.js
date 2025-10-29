// Calendar Integration Routes
const express = require('express');
const axios = require('axios');
const { env } = require('../config');
const User = require('../models/User');
const { requireUser } = require('../middleware/authMiddleware');

const router = express.Router();

// Test endpoint to verify routes are loaded
router.get('/test', (req, res) => {
  console.log('🧪 [Calendar Integration] Test endpoint called');
  res.json({ success: true, message: 'Calendar integration routes are working' });
});

// Google Calendar API configuration
const GOOGLE_CALENDAR_API = {
  baseUrl: 'https://www.googleapis.com/calendar/v3',
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]
};

// Microsoft Graph API configuration
const MICROSOFT_GRAPH_API = {
  baseUrl: 'https://graph.microsoft.com/v1.0',
  scopes: [
    'https://graph.microsoft.com/calendars.readwrite',
    'https://graph.microsoft.com/calendars.readwrite.shared'
  ]
};

// Get user's calendar integration status
router.get('/status', requireUser, async (req, res) => {
  console.log('🚀 [Calendar Integration] Status endpoint called for user:', req.user?.email);
  try {
    if (!req.user) {
      console.log('❌ [Calendar Integration] No user found');
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const integrations = {
      mobile: {
        connected: false,
        type: null,
        lastSync: null
      },
      email: {
        connected: false,
        provider: null,
        lastSync: null
      }
    };

    // Check Google integration
    console.log('🔍 [Calendar Integration] Checking Google integration:', {
      googleId: !!user.googleId,
      googleAccessToken: !!user.googleAccessToken,
      authProvider: user.authProvider,
      hasGoogleId: !!user.googleId,
      hasGoogleToken: !!user.googleAccessToken
    });

    if (user.googleId && user.googleAccessToken) {
      integrations.email.connected = true;
      integrations.email.provider = 'google';
      integrations.email.lastSync = user.googleTokenExpiry || null;

      console.log('✅ [Calendar Integration] Google integration enabled with OAuth tokens');
    }

    // Check Microsoft integration
    console.log('🔍 [Calendar Integration] Checking Microsoft integration:', {
      microsoftId: !!user.microsoftId,
      microsoftAccessToken: !!user.microsoftAccessToken,
      authProvider: user.authProvider,
      microsoftIdValue: user.microsoftId,
      microsoftTokenValue: user.microsoftAccessToken ? 'EXISTS' : 'MISSING'
    });

    if (user.microsoftId && user.microsoftAccessToken) {
      // If Google is already connected, add Microsoft as additional provider
      if (integrations.email.connected && integrations.email.provider === 'google') {
        integrations.email.provider = 'google, microsoft';
        integrations.email.lastSync = user.microsoftTokenExpiry || integrations.email.lastSync;
        console.log('✅ [Calendar Integration] Microsoft added to existing Google integration');
      } else {
        integrations.email.connected = true;
        integrations.email.provider = 'microsoft';
        integrations.email.lastSync = user.microsoftTokenExpiry || null;
        console.log('✅ [Calendar Integration] Microsoft integration enabled as primary provider');
      }

      console.log('✅ [Calendar Integration] Microsoft integration enabled with OAuth tokens');
    } else {
      console.log('❌ [Calendar Integration] Microsoft integration not available:', {
        hasMicrosoftId: !!user.microsoftId,
        hasMicrosoftToken: !!user.microsoftAccessToken
      });
    }

    console.log('📊 [Calendar Integration] Final integrations status:', integrations);

    res.json({ success: true, integrations });
  } catch (error) {
    console.error('Calendar integration status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get integration status' });
  }
});

// Connect Google Calendar
router.post('/connect/google', requireUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user already has Google OAuth
    if (!user.googleId) {
      return res.status(400).json({
        success: false,
        error: 'Google account not linked. Please link your Google account first.'
      });
    }

    // Generate OAuth URL for calendar permissions
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback')}&` +
      `scope=${encodeURIComponent(GOOGLE_CALENDAR_API.scopes.join(' '))}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=calendar_integration`;

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Google Calendar connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate Google Calendar connection' });
  }
});

// Connect Microsoft Calendar
router.post('/connect/microsoft', requireUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user already has Microsoft OAuth
    if (!user.microsoftId) {
      return res.status(400).json({
        success: false,
        error: 'Microsoft account not linked. Please link your Microsoft account first.'
      });
    }

    // Generate OAuth URL for calendar permissions
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/auth/microsoft/callback')}&` +
      `scope=${encodeURIComponent(MICROSOFT_GRAPH_API.scopes.join(' '))}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=calendar_integration`;

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Microsoft Calendar connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate Microsoft Calendar connection' });
  }
});

// Sync events to Google Calendar
router.post('/sync/google', requireUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ success: false, error: 'Google Calendar not connected' });
    }

    const { events } = req.body;
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'Events array is required' });
    }

    const syncedEvents = [];
    const errors = [];

    for (const event of events) {
      try {
        const googleEvent = {
          summary: event.title,
          description: event.description || '',
          start: {
            dateTime: new Date(event.startDate).toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: event.endDate ? new Date(event.endDate).toISOString() : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000).toISOString(),
            timeZone: 'UTC'
          }
        };

        const response = await axios.post(
          `${GOOGLE_CALENDAR_API.baseUrl}/calendars/primary/events`,
          googleEvent,
          {
            headers: {
              'Authorization': `Bearer ${user.googleAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        syncedEvents.push({
          id: event.id,
          googleEventId: response.data.id,
          status: 'synced'
        });
      } catch (error) {
        console.error(`Error syncing event ${event.id}:`, error.message);
        errors.push({
          eventId: event.id,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      synced: syncedEvents.length,
      errors: errors.length,
      syncedEvents,
      errors
    });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync to Google Calendar' });
  }
});

// Sync events to Microsoft Calendar
router.post('/sync/microsoft', requireUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.microsoftAccessToken) {
      return res.status(400).json({ success: false, error: 'Microsoft Calendar not connected' });
    }

    const { events } = req.body;
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'Events array is required' });
    }

    const syncedEvents = [];
    const errors = [];

    for (const event of events) {
      try {
        const microsoftEvent = {
          subject: event.title,
          body: {
            contentType: 'text',
            content: event.description || ''
          },
          start: {
            dateTime: new Date(event.startDate).toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: event.endDate ? new Date(event.endDate).toISOString() : new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000).toISOString(),
            timeZone: 'UTC'
          }
        };

        const response = await axios.post(
          `${MICROSOFT_GRAPH_API.baseUrl}/me/events`,
          microsoftEvent,
          {
            headers: {
              'Authorization': `Bearer ${user.microsoftAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        syncedEvents.push({
          id: event.id,
          microsoftEventId: response.data.id,
          status: 'synced'
        });
      } catch (error) {
        console.error(`Error syncing event ${event.id}:`, error.message);
        errors.push({
          eventId: event.id,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      synced: syncedEvents.length,
      errors: errors.length,
      syncedEvents,
      errors
    });
  } catch (error) {
    console.error('Microsoft Calendar sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync to Microsoft Calendar' });
  }
});

// Test calendar connection
router.post('/test/:provider', requireUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { provider } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let testResult = { success: false, error: 'Unknown provider' };

    if (provider === 'google' && user.googleAccessToken) {
      try {
        const response = await axios.get(
          `${GOOGLE_CALENDAR_API.baseUrl}/calendars/primary`,
          {
            headers: {
              'Authorization': `Bearer ${user.googleAccessToken}`
            }
          }
        );
        testResult = { success: true, calendar: response.data };
      } catch (error) {
        testResult = { success: false, error: error.message };
      }
    } else if (provider === 'microsoft' && user.microsoftAccessToken) {
      try {
        const response = await axios.get(
          `${MICROSOFT_GRAPH_API.baseUrl}/me/calendars`,
          {
            headers: {
              'Authorization': `Bearer ${user.microsoftAccessToken}`
            }
          }
        );
        testResult = { success: true, calendars: response.data.value };
      } catch (error) {
        testResult = { success: false, error: error.message };
      }
    } else {
      testResult = { success: false, error: `${provider} not connected` };
    }

    res.json(testResult);
  } catch (error) {
    console.error('Calendar test error:', error);
    res.status(500).json({ success: false, error: 'Failed to test calendar connection' });
  }
});

// Disconnect calendar integration
router.post('/disconnect/:type', requireUser, async (req, res) => {
  try {
    const { type } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (type === 'mobile' || type === 'email') {
      // For now, we'll just clear the OAuth tokens
      // In a real implementation, you might want to revoke the tokens with the provider
      if (user.googleId) {
        user.googleAccessToken = undefined;
        user.googleRefreshToken = undefined;
        user.googleTokenExpiry = undefined;
      }
      if (user.microsoftId) {
        user.microsoftAccessToken = undefined;
        user.microsoftRefreshToken = undefined;
        user.microsoftTokenExpiry = undefined;
      }

      await user.save();

      res.json({
        success: true,
        message: `${type} integration disconnected successfully`
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid integration type' });
    }
  } catch (error) {
    console.error('Error disconnecting calendar integration:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
