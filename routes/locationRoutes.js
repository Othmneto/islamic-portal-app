// translator-backend/routes/locationRoutes.js
"use strict";

const express = require("express");
const router = express.Router();
const locationService = require("../services/locationService");

/**
 * GET /api/location/ip-lookup
 * Attempts to geolocate the user from their request IP.
 * Uses the advanced service with caching and fallbacks.
 */
router.get("/ip-lookup", async (req, res, next) => {
  try {
    const locationData = await locationService.lookupIpFromReq(req);
    if (locationData) {
      return res.json(locationData);
    }
    res.status(404).json({ error: "Could not determine location from IP." });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/reverse-geocode
 * Finds a structured address for the given latitude and longitude.
 */
router.get("/reverse-geocode", async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }
    const locationData = await locationService.reverseGeocode(
      parseFloat(lat),
      parseFloat(lon)
    );
    if (locationData) {
      return res.json(locationData);
    }
    res.status(404).json({ error: "Could not find an address for the given coordinates." });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/search
 * Searches for a city or place by name (forward geocoding).
 */
router.get("/search", async (req, res, next) => {
  try {
    const { q, lang } = req.query;
    if (!q) {
      return res.json([]);
    }
    const results = await locationService.searchCity(q, { lang });
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/timezone
 * Looks up the IANA timezone for a given latitude and longitude.
 */
router.get("/timezone", (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Latitude and longitude are required." });
  }
  const timezone = locationService.timezoneFromCoords(
    parseFloat(lat),
    parseFloat(lon)
  );
  if (timezone) {
    res.json({ timezone });
  } else {
    res.status(404).json({ error: "Could not determine timezone for the given coordinates." });
  }
});

module.exports = router;