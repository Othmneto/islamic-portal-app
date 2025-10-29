const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const calendarSearchService = require('../services/calendarSearchService');
const { logger } = require('../config/logger');

/**
 * Search across all calendar data
 * GET /api/calendar/search?q=query&type=all&year=2025&limit=50
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q, type, year, limit, country } = req.query;

    // Validate query
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    logger.info(`[CalendarSearch] User ${req.user.id} searching for: "${q}"`);

    // Parse options
    const options = {
      includeUserEvents: !type || type === 'all' || type === 'events',
      includePrayerTimes: !type || type === 'all' || type === 'prayers',
      includeOccasions: !type || type === 'all' || type === 'occasions',
      year: year ? parseInt(year) : new Date().getFullYear(),
      limit: limit ? parseInt(limit) : 50,
      countryCode: country || null
    };

    // Perform search
    const results = await calendarSearchService.search(req.user.id, q.trim(), options);

    res.json({
      success: true,
      query: q,
      ...results
    });

  } catch (error) {
    logger.error('[CalendarSearch] Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search',
      details: error.message
    });
  }
});

/**
 * Search suggestions / autocomplete
 * GET /api/calendar/search/suggest?q=query
 */
router.get('/search/suggest', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    // Get quick suggestions (cached heavily)
    const results = await calendarSearchService.search(req.user.id, q.trim(), {
      limit: 10,
      year: new Date().getFullYear()
    });

    // Extract top suggestions
    const suggestions = results.results.slice(0, 10).map(r => ({
      text: r.name || r.title,
      type: r.resultType,
      date: r.date || r.startDate
    }));

    res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logger.error('[CalendarSearch] Suggestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
});

module.exports = router;



