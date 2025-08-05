// translator-backend/routes/apiRoutes.js

const express = require('express');
const router = express.Router();

// --- Service Imports ---
const zakatService = require('../services/zakatService');
const locationService = require('../services/locationService');
const islamicInfoService = require('../services/islamicInfoService');
const aiAssistantService = require('../services/aiAssistantService');
const analyticsService = require('../services/analyticsService');

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

// --- Islamic Info Routes ---
router.get('/prayertimes', (req, res, next) => {
    const { lat, lon, method, madhab } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ error: 'Latitude and Longitude are required.' });
    }
    try {
        const prayerData = islamicInfoService.getPrayerTimes(lat, lon, method, madhab);
        res.json(prayerData);
    } catch (error) {
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
        const stats = await islamicInfoService.getUmmahStats();
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
        // Handle specific validation error from the service
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