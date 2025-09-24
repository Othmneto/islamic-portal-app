// translator-backend/routes/geocode.js
"use strict";
const express = require("express");
const axios = require("axios");
const router = express.Router();
const CACHE = new Map();

// GET /api/geocode?q=Dubai&lang=en
router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const lang = String(req.query.lang || "en").trim();
  if (q.length < 2) return res.json([]);

  const key = `${lang}::${q.toLowerCase()}`;
  const cached = CACHE.get(key);
  if (cached && cached.exp > Date.now()) return res.json(cached.data);

  try {
    const r = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { format: "json", limit: 6, q, "accept-language": lang },
      headers: {
        "User-Agent": process.env.GEOCODE_UA || "MyMuslimApp/1.0 (+contact@example.com)",
        Referer: process.env.GEOCODE_REFERER || "https://localhost",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    const out = Array.isArray(r.data)
      ? r.data.map((it) => ({
          display_name: it.display_name,
          lat: Number(it.lat),
          lon: Number(it.lon),
          type: it.type,
        }))
      : [];

    CACHE.set(key, { data: out, exp: Date.now() + 60 * 60 * 1000 }); // 1h
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: "GeocodeUpstream", detail: e?.message || String(e) });
  }
});

module.exports = router;
