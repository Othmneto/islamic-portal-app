/**
 * Smart Timezone Detection API Routes
 *
 * Endpoints:
 * - GET /api/timezone/status - Get timezone detection status
 * - POST /api/timezone/check - Force timezone check
 * - POST /api/timezone/disable - Disable timezone detection
 * - POST /api/timezone/enable - Enable timezone detection
 * - GET /api/timezone/analytics - Get timezone analytics
 * - POST /api/timezone/update - Manually update timezone
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const smartTimezoneService = require('../services/smartTimezoneService');
const User = require('../models/User');
const logger = require('../config/logger');

// Apply authentication middleware to all routes
router.use(authMiddleware.attachUser);

/**
 * @route   GET /api/timezone/status
 * @desc    Get timezone detection status for the authenticated user
 * @access  Private
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId).select('timezone preferences lastTimezoneUpdate timezoneSource');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const status = {
      currentTimezone: user.timezone || 'UTC',
      timezoneSource: user.timezoneSource || 'manual',
      lastUpdate: user.lastTimezoneUpdate || null,
      detectionEnabled: !user.preferences?.disableTimezoneDetection,
      timezoneDisplayName: smartTimezoneService.getTimezoneDisplayName(user.timezone || 'UTC')
    };

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error getting timezone status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timezone status'
    });
  }
});

/**
 * @route   POST /api/timezone/check
 * @desc    Force timezone check for the authenticated user
 * @access  Private
 */
router.post('/check', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    console.log(`🔍 [TimezoneAPI] Force timezone check requested by user ${userId}`);

    // Trigger timezone check
    await smartTimezoneService.forceTimezoneCheck(userId);

    res.json({
      success: true,
      message: 'Timezone check initiated'
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error checking timezone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check timezone'
    });
  }
});

/**
 * @route   POST /api/timezone/disable
 * @desc    Disable timezone detection for the authenticated user
 * @access  Private
 */
router.post('/disable', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    console.log(`🚫 [TimezoneAPI] Disabling timezone detection for user ${userId}`);

    await smartTimezoneService.disableTimezoneDetection(userId);

    res.json({
      success: true,
      message: 'Timezone detection disabled'
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error disabling timezone detection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable timezone detection'
    });
  }
});

/**
 * @route   POST /api/timezone/enable
 * @desc    Enable timezone detection for the authenticated user
 * @access  Private
 */
router.post('/enable', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    console.log(`✅ [TimezoneAPI] Enabling timezone detection for user ${userId}`);

    await smartTimezoneService.enableTimezoneDetection(userId);

    res.json({
      success: true,
      message: 'Timezone detection enabled'
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error enabling timezone detection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable timezone detection'
    });
  }
});

/**
 * @route   GET /api/timezone/analytics
 * @desc    Get timezone analytics for the authenticated user
 * @access  Private
 */
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    const analytics = await smartTimezoneService.getTimezoneAnalytics(userId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'No timezone analytics available'
      });
    }

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error getting timezone analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timezone analytics'
    });
  }
});

/**
 * @route   POST /api/timezone/update
 * @desc    Manually update timezone for the authenticated user
 * @access  Private
 */
router.post('/update', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { timezone } = req.body;

    if (!timezone) {
      return res.status(400).json({
        success: false,
        error: 'Timezone is required'
      });
    }

    // Validate timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timezone'
      });
    }

    console.log(`🔄 [TimezoneAPI] Manual timezone update for user ${userId}: ${timezone}`);

    // Update user timezone
    await User.findByIdAndUpdate(userId, {
      timezone,
      lastTimezoneUpdate: new Date(),
      timezoneSource: 'manual'
    });

    // Reschedule prayer notifications
    await smartTimezoneService.reschedulePrayerNotifications(userId, timezone);

    res.json({
      success: true,
      message: 'Timezone updated successfully',
      timezone,
      timezoneDisplayName: smartTimezoneService.getTimezoneDisplayName(timezone)
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error updating timezone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update timezone'
    });
  }
});

/**
 * @route   GET /api/timezone/supported
 * @desc    Get list of supported timezones
 * @access  Private
 */
router.get('/supported', async (req, res) => {
  try {
    // Get list of common timezones
    const timezones = [
      // Major timezones
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Asia/Dubai',
      'Asia/Karachi',
      'Asia/Jakarta',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',

      // Middle East & Africa
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Asia/Riyadh',
      'Asia/Tehran',
      'Asia/Istanbul',
      'Asia/Kuwait',
      'Asia/Qatar',
      'Asia/Bahrain',
      'Asia/Muscat',

      // South Asia
      'Asia/Dhaka',
      'Asia/Colombo',
      'Asia/Kathmandu',
      'Asia/Karachi',

      // Southeast Asia
      'Asia/Bangkok',
      'Asia/Ho_Chi_Minh',
      'Asia/Manila',
      'Asia/Singapore',
      'Asia/Kuala_Lumpur',

      // Americas
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Sao_Paulo',
      'America/Argentina/Buenos_Aires',
      'America/Lima',
      'America/Bogota',
      'America/Caracas',

      // Europe
      'Europe/Amsterdam',
      'Europe/Brussels',
      'Europe/Vienna',
      'Europe/Prague',
      'Europe/Warsaw',
      'Europe/Stockholm',
      'Europe/Oslo',
      'Europe/Copenhagen',
      'Europe/Helsinki',
      'Europe/Athens',
      'Europe/Lisbon',
      'Europe/Dublin',
      'Europe/Zurich',
      'Europe/Budapest',
      'Europe/Bucharest',
      'Europe/Sofia',
      'Europe/Zagreb',
      'Europe/Belgrade',
      'Europe/Sarajevo',
      'Europe/Skopje',
      'Europe/Podgorica',
      'Europe/Tirana',
      'Europe/Pristina',
      'Europe/Chisinau',
      'Europe/Kiev',
      'Europe/Minsk',
      'Europe/Moscow',
      'Europe/Volgograd',
      'Europe/Samara',
      'Europe/Yekaterinburg',
      'Europe/Omsk',
      'Europe/Novosibirsk',
      'Europe/Krasnoyarsk',
      'Europe/Irkutsk',
      'Europe/Yakutsk',
      'Europe/Vladivostok',
      'Europe/Magadan',
      'Europe/Kamchatka',
      'Europe/Anadyr'
    ];

    // Format timezones with display names
    const formattedTimezones = timezones.map(tz => ({
      value: tz,
      label: smartTimezoneService.getTimezoneDisplayName(tz),
      offset: getTimezoneOffset(tz)
    })).sort((a, b) => a.offset - b.offset);

    res.json({
      success: true,
      timezones: formattedTimezones
    });

  } catch (error) {
    console.error('❌ [TimezoneAPI] Error getting supported timezones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported timezones'
    });
  }
});

/**
 * Helper function to get timezone offset
 */
function getTimezoneOffset(timezone) {
  try {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const tzTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
    return (tzTime.getTime() - utc.getTime()) / (1000 * 60 * 60);
  } catch (error) {
    return 0;
  }
}

module.exports = router;
