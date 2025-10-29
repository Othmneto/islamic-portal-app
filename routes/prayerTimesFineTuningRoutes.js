/**
 * Prayer Times Fine-Tuning API Routes
 * Provides fine-tuning data and region information
 */

const express = require('express');
const router = express.Router();
const fineTuningService = require('../services/prayerTimesFineTuningService');
const { attachUser: authMiddleware } = require('../middleware/authMiddleware');

/**
 * GET /api/prayer-times-fine-tuning/region
 * Get region information and adjustments for a location
 */
router.get('/region', async (req, res) => {
  try {
    const { lat, lon } = req.query;

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

    const adjustments = await fineTuningService.getAdjustments(latitude, longitude);
    const regionInfo = await fineTuningService.getRegionInfo(latitude, longitude);

    res.json({
      success: true,
      region: regionInfo,
      adjustments: {
        fajr: adjustments.fajr || 0,
        shuruq: adjustments.shuruq || 0,
        dhuhr: adjustments.dhuhr || 0,
        asr: adjustments.asr || 0,
        maghrib: adjustments.maghrib || 0,
        isha: adjustments.isha || 0
      }
    });
  } catch (error) {
    console.error('[FineTuning API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fine-tuning data'
    });
  }
});

/**
 * GET /api/prayer-times-fine-tuning/method
 * Get recommended calculation method for a location
 */
router.get('/method', async (req, res) => {
  try {
    const { lat, lon } = req.query;

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

    const method = await fineTuningService.getRecommendedMethod(latitude, longitude);
    const madhab = await fineTuningService.getRecommendedMadhab(latitude, longitude);

    res.json({
      success: true,
      calculationMethod: method,
      madhab: madhab
    });
  } catch (error) {
    console.error('[FineTuning API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calculation method'
    });
  }
});

/**
 * GET /api/prayer-times-fine-tuning/regions
 * Get all regions (admin only)
 */
router.get('/regions', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin (you can add admin check here)
    const regions = await fineTuningService.getAllRegions();
    const adminNotes = await fineTuningService.getAdminNotes();

    res.json({
      success: true,
      regions: regions,
      adminNotes: adminNotes
    });
  } catch (error) {
    console.error('[FineTuning API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get regions'
    });
  }
});

/**
 * PUT /api/prayer-times-fine-tuning/region/:regionKey
 * Update adjustments for a region (admin only)
 */
router.put('/region/:regionKey', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin (you can add admin check here)
    const { regionKey } = req.params;
    const { adjustments, notes } = req.body;

    if (!adjustments) {
      return res.status(400).json({
        success: false,
        error: 'Adjustments are required'
      });
    }

    const success = await fineTuningService.updateRegionAdjustments(
      regionKey,
      adjustments,
      notes
    );

    if (success) {
      res.json({
        success: true,
        message: `Adjustments updated for ${regionKey}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update adjustments'
      });
    }
  } catch (error) {
    console.error('[FineTuning API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update adjustments'
    });
  }
});

module.exports = router;


