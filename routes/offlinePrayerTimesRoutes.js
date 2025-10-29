/**
 * Offline Prayer Times API Routes
 * Provides 30-day prayer times for offline functionality
 */

const express = require('express');
const router = express.Router();
const offlineService = require('../services/offlinePrayerTimesService');
const { attachUser: authMiddleware } = require('../middleware/authMiddleware');

/**
 * GET /api/offline-prayer-times/30-days
 * Get 30 days of prayer times for offline caching
 */
router.get('/30-days', async (req, res) => {
  try {
    const { lat, lon, method, madhab } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude'
      });
    }

    const calculationMethod = method || 'UmmAlQura';
    const madhabMethod = madhab || 'Shafi';

    console.log(`[OfflineAPI] Generating 30 days for ${latitude}, ${longitude}`);

    const prayerTimes = offlineService.calculateMultipleDays(
      latitude,
      longitude,
      30,
      calculationMethod,
      madhabMethod
    );

    res.json({
      success: true,
      days: prayerTimes.length,
      location: { lat: latitude, lon: longitude },
      calculationMethod,
      madhab: madhabMethod,
      generatedAt: new Date().toISOString(),
      prayerTimes
    });
  } catch (error) {
    console.error('[OfflineAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prayer times'
    });
  }
});

/**
 * GET /api/offline-prayer-times/date
 * Get prayer times for a specific date
 */
router.get('/date', async (req, res) => {
  try {
    const { lat, lon, date, method, madhab } = req.query;

    if (!lat || !lon || !date) {
      return res.status(400).json({
        success: false,
        error: 'Latitude, longitude, and date are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const targetDate = new Date(date);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude, longitude, or date'
      });
    }

    const calculationMethod = method || 'UmmAlQura';
    const madhabMethod = madhab || 'Shafi';

    const prayerTimes = offlineService.getPrayerTimesForDate(
      latitude,
      longitude,
      targetDate,
      calculationMethod,
      madhabMethod
    );

    res.json({
      success: true,
      date: prayerTimes.date,
      location: { lat: latitude, lon: longitude },
      calculationMethod,
      madhab: madhabMethod,
      prayerTimes
    });
  } catch (error) {
    console.error('[OfflineAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prayer times for date'
    });
  }
});

/**
 * POST /api/offline-prayer-times/pre-cache
 * Pre-cache 30 days of prayer times for a user's location
 */
router.post('/pre-cache', authMiddleware, async (req, res) => {
  try {
    const { lat, lon, method, madhab } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude'
      });
    }

    const calculationMethod = method || 'UmmAlQura';
    const madhabMethod = madhab || 'Shafi';

    const result = await offlineService.preCacheUserLocation(
      latitude,
      longitude,
      calculationMethod,
      madhabMethod
    );

    res.json(result);
  } catch (error) {
    console.error('[OfflineAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pre-cache prayer times'
    });
  }
});

/**
 * GET /api/offline-prayer-times/cache-stats
 * Get cache statistics (admin only)
 */
router.get('/cache-stats', authMiddleware, async (req, res) => {
  try {
    const stats = offlineService.getCacheStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[OfflineAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

/**
 * DELETE /api/offline-prayer-times/cache
 * Clear expired cache entries (admin only)
 */
router.delete('/cache/expired', authMiddleware, async (req, res) => {
  try {
    const cleared = offlineService.clearExpiredCache();
    res.json({
      success: true,
      cleared
    });
  } catch (error) {
    console.error('[OfflineAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

module.exports = router;


