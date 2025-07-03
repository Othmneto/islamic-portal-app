// routes/apiRoutes.js (Corrected with Session Clear Endpoint)
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const adhan = require('adhan');
const moment = require('moment-hijri');
const { handleUserQuery } = require('../ai-assistant');
const { readHistory } = require('../utils/storage'); 
const router = express.Router();

// Helper for distance calculation
const KAABA_COORDS = { lat: 21.4225, lon: 39.8262 };
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// GET /api/zakat/nisab
router.get('/zakat/nisab', async (req, res) => {
    const { currency = 'USD' } = req.query;
    try {
        const goldApiKey = process.env.GOLD_API_KEY;
        const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY;

        if (!goldApiKey || !exchangeRateApiKey) {
            throw new Error("An API key is not configured on the server.");
        }

        const goldApiUrl = 'https://www.goldapi.io/api/XAU/USD';
        const silverApiUrl = 'https://www.goldapi.io/api/XAG/USD';
        const exchangeRateUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/USD`;
        const headers = { 'x-access-token': goldApiKey };

        const [goldResponse, silverResponse, exchangeResponse] = await Promise.all([
            axios.get(goldApiUrl, { headers }),
            axios.get(silverApiUrl, { headers }),
            axios.get(exchangeRateUrl)
        ]);
        
        const goldPriceInUSD = goldResponse.data.price;
        const silverPriceInUSD = silverResponse.data.price;
        
        const exchangeRates = exchangeResponse.data.conversion_rates;
        const targetRate = exchangeRates[currency.toUpperCase()];
        if (!targetRate) {
            throw new Error(`The currency code '${currency}' is invalid or not supported.`);
        }

        const goldPricePerGram = (goldPriceInUSD / 31.1035) * targetRate;
        const silverPricePerGram = (silverPriceInUSD / 31.1035) * targetRate;

        res.json({
            goldPricePerGram: goldPricePerGram.toFixed(2),
            silverPricePerGram: silverPricePerGram.toFixed(2),
        });

    } catch (error) {
        if (error.isAxiosError) {
            console.error(`[Zakat API Error] Axios error calling ${error.config.url}:`, error.message);
        } else {
            console.error("[Zakat API Error] A non-network error occurred:", error.message);
        }
        res.status(500).json({ error: 'Could not fetch live price data. An external service may be down.' });
    }
});


// GET /api/search-city
router.get('/search-city', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);
    
    try {
        const apiKey = process.env.GEOCODING_API_KEY;
        if (!apiKey) {
             throw new Error("Geocoding API key is not configured on the server.");
        }
        const response = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${apiKey}`);
        const searchResults = response.data.map(location => ({
            city: location.name,
            country: location.country,
            lat: location.lat,
            lng: location.lon
        }));
        res.json(searchResults);
    } catch (error) {
        console.error("Error searching cities:", error.message);
        res.status(500).json({ error: "Could not perform city search." });
    }
});


// GET /api/prayertimes
router.get('/prayertimes', (req, res) => {
    try {
        const { lat, lon, method = 'MuslimWorldLeague', madhab = 'shafii' } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'Latitude and Longitude are required.' });

        const coordinates = new adhan.Coordinates(parseFloat(lat), parseFloat(lon));
        let params = adhan.CalculationMethod[method]();
        params.madhab = (madhab === 'hanafi') ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
        const prayerTimes = new adhan.PrayerTimes(coordinates, new Date(), params);
        const qiblaDirection = adhan.Qibla(coordinates);
        const distance = calculateDistance(coordinates.latitude, coordinates.longitude, KAABA_COORDS.lat, KAABA_COORDS.lon);
        const hijriDate = moment(new Date()).format('iYYYY/iM/iD');

        res.json({
            timesRaw: prayerTimes,
            date: {
                gregorian: moment().format('dddd, MMMM D, YYYY'),
                hijri: hijriDate,
            },
            qibla: qiblaDirection,
            distance: distance.toFixed(2)
        });
    } catch (error) {
        console.error("Error calculating prayer times:", error.message);
        res.status(500).json({ error: 'Failed to calculate prayer times on the server.' });
    }
});

// GET /api/analytics
router.get('/analytics', async (req, res) => {
    try {
        const history = await readHistory();
        const langUsage = {};
        history.forEach(item => {
            const pair = `${item.from} → ${item.to}`;
            langUsage[pair] = (langUsage[pair] || 0) + 1;
        });

        const mostReplayed = history
            .filter(item => item.replayCount > 0)
            .sort((a, b) => b.replayCount - a.replayCount)
            .slice(0, 5);

        res.json({
            totalTranslations: history.length,
            languageUsage: langUsage,
            mostReplayed: mostReplayed
        });
    } catch (err) {
        console.error("Error reading analytics data:", err);
        res.status(500).json({ error: 'Could not read analytics data.' });
    }
});

// POST /api/assistant/ask
router.post('/assistant/ask', async (req, res) => {
    const { question, sessionId } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
    }
    try {
        const answer = await handleUserQuery(question, sessionId);
        res.json({ answer });
    } catch (error) {
        console.error("Error in AI Assistant endpoint:", error.message);
        res.status(500).json({ error: 'The assistant could not process your request.' });
    }
});

// GET /api/duas
router.get('/duas', (req, res) => {
    const duas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'duas.json'), 'utf8'));
    res.json(duas);
});

// GET /api/names
router.get('/names', (req, res) => {
    const names = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'names.json'), 'utf8'));
    res.json(names);
});

// GET /api/ummah-stats
router.get('/ummah-stats', async (req, res) => {
    try {
        const countryData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'country_islam_data.json'), 'utf8'));
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,cca2,population,flags');
        const liveCountryData = response.data;

        let globalMuslimPopulation = 0;

        const mergedData = countryData.map(islamData => {
            const liveData = liveCountryData.find(c => c.cca2 === islamData.code);
            if (!liveData) return null;

            const totalPopulation = liveData.population;
            const muslimPopulation = Math.round(totalPopulation * (islamData.muslim_percent / 100));
            globalMuslimPopulation += muslimPopulation;

            return {
                name: liveData.name.common,
                flag: liveData.flags.svg,
                totalPopulation: totalPopulation,
                muslimPercent: islamData.muslim_percent,
                muslimPopulation: muslimPopulation
            };
        }).filter(Boolean).sort((a, b) => b.muslimPopulation - a.muslimPopulation);

        res.json({
            globalMuslimPopulation,
            countries: mergedData
        });
    } catch (error) {
        console.error("Error fetching Ummah stats:", error.message);
        res.status(500).json({ error: "Failed to fetch population statistics." });
    }
});


module.exports = router;