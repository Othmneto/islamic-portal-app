// translator-backend/routes/apiRoutes.js

const express = require('express');
const router = express.Router();

// --- Service Imports ---
const zakatService = require('../services/zakatService');
const locationService = require('../services/locationService');
const islamicInfoService = require('../services/islamicInfoService');
const aiAssistantService = require('../services/aiAssistantService');
const analyticsService = require('../services/analyticsService');
const prayerTimeService = require('../services/prayerTimeService'); // NEW

// --- Zakat Routes ---
router.get('/zakat/nisab', async (req, res, next) => {
  try {
    const nisabData = await zakatService.getNisabValues(req.query.currency);
    res.json(nisabData);
  } catch (error) {
    next(error);
  }
});

// --- Location Routes ---
router.get('/search-city', async (req, res, next) => {
  const { query } = req.query;
  if (!query) {
    return res.json([]);
  }
  try {
    const results = await locationService.searchCity(query);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// --- NEW: Prayer Times (enhanced) ---
// Supports both `latitude/longitude` and `lat/lon`,
// optional `date` (ISO, yyyy-mm-dd), `method`, `madhab`, and `tz|timezone`.
router.get('/prayer-times', (req, res, next) => {
  try {
    const {
      latitude, longitude, lat, lon,
      method, madhab, date, tz, timezone
    } = req.query;

    const LAT = parseFloat(latitude ?? lat);
    const LON = parseFloat(longitude ?? lon);

    if (!Number.isFinite(LAT) || !Number.isFinite(LON)) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    const calcDate = date ? new Date(date) : new Date();
    const tzStr = timezone || tz || 'Africa/Cairo';

    // Use the upgraded service which returns:
    // { fajr, dhuhr, asr, maghrib, isha, shuruq, periods:{imsak,duha,tahajjud}, meta:{...} }
    const result = prayerTimeService.getPrayerTimes({
      date: calcDate,
      lat: LAT,
      lon: LON,
      method,
      madhab,
      timezone: tzStr,
    });

    res.json(result);
  } catch (error) {
    console.error('Error calculating prayer times:', error);
    next(error);
  }
});

router.get('/duas', async (req, res, next) => {
  try {
    const duas = await islamicInfoService.getDuas();
    res.json(duas);
  } catch (error) {
    next(error);
  }
});

router.get('/names', async (req, res, next) => {
  try {
    const names = await islamicInfoService.getNames();
    res.json(names);
  } catch (error) {
    next(error);
  }
});

router.get('/ummah-stats', async (req, res, next) => {
  try {
    const stats = await analyticsService.getUmmahStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// --- AI Assistant Routes ---
router.post('/assistant/ask', async (req, res, next) => {
  try {
    const { question, sessionId } = req.body;
    const answer = await aiAssistantService.ask(question, sessionId);
    res.json({ answer });
  } catch (error) {
    if (error.message === 'Question is required.') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// --- Analytics Routes ---
router.get('/analytics', async (req, res, next) => {
  try {
    const stats = await analyticsService.getTranslationStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
