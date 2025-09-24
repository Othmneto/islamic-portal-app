// translator-backend/routes/geocode.js
"use strict";

const express = require("express");
const axios = require("axios");

const router = express.Router();

// Simple in-memory cache (q+lang) → results for 1 hour
const CACHE = new Map();
const TTL_MS = 60 * 60 * 1000; // 1h

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  if (hit) CACHE.delete(key);
  return null;
}
function cacheSet(key, data) {
  CACHE.set(key, { data, exp: Date.now() + TTL_MS });
}

/**
 * GET /api/geocode?q=Dubai&lang=en
 * Proxies to Nominatim with a proper User-Agent header and small cache.
 */
router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const lang = String(req.query.lang || "en").trim();

  // minimal validation
  if (q.length < 2) return res.json([]);

  const key = `${lang}::${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const r = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        format: "json",
        limit: 6,
        q,
        "accept-language": lang,
        addressdetails: 0,
      },
      headers: {
        // Please set these env vars for production deployments
        "User-Agent":
          process.env.GEOCODE_UA ||
          "MyMuslimApp/1.0 (contact: admin@example.com)",
        Accept: "application/json",
        Referer: process.env.GEOCODE_REFERER || "http://localhost",
      },
      timeout: 15000,
      // Do NOT follow redirects; OSM may rate limit
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 400, // treat 3xx as error to avoid cache poisoning
    });

    const out = Array.isArray(r.data)
      ? r.data.map((it) => ({
          display_name: it.display_name,
          lat: Number(it.lat),
          lon: Number(it.lon),
          type: it.type,
        }))
      : [];

    cacheSet(key, out);
    return res.json(out);
  } catch (e) {
    // Upstream failure → return 502 with minimal info
    const status = e?.response?.status || 502;
    const msg = e?.message || "Geocode upstream error";
    return res.status(502).json({ error: "GeocodeUpstream", status, msg });
  }
});

module.exports = router;
