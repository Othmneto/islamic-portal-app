// translator-backend/services/locationService.js
"use strict";

const axios = require("axios");
const requestIp = require("request-ip");
const ngeohash = require("ngeohash");
const tzlookup = require("tz-lookup");
const logger = require("../utils/logger");

// --- Simple In-Memory Cache (no external deps) ---
const createSimpleCache = (ttl) => {
  const cache = new Map();
  return {
    get: (key) => cache.get(key), // returns { value, timeoutId } or undefined
    set: (key, value) => {
      if (cache.has(key)) {
        try { clearTimeout(cache.get(key).timeoutId); } catch {}
      }
      const timeoutId = setTimeout(() => cache.delete(key), ttl);
      cache.set(key, { value, timeoutId });
    },
  };
};

const ipCache  = createSimpleCache(10 * 60 * 1000);     // 10 minutes
const revCache = createSimpleCache(6  * 60 * 60 * 1000); // 6 hours
const fwdCache = createSimpleCache(2  * 60 * 60 * 1000); // 2 hours
// --------------------------------------------------

// -------------------------- HELPERS ---------------------------
function getClientIp(req) {
  const ip = requestIp.getClientIp(req);
  return (ip || "").replace("::ffff:", "");
}

function validLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
         Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function cityFrom(addr) {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.suburb ||
    addr.county ||
    null
  );
}

function compactDisplay(addr) {
  const parts = [
    addr.road || addr.pedestrian || addr.neighbourhood,
    cityFrom(addr),
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function timezoneFromCoords(lat, lon) {
  return tzlookup(lat, lon); // IANA tz
}

// --------------------------- IP LOOKUP ---------------------------
async function providerIpApi(ip) {
  const targetIp = (ip === "::1" || ip === "127.0.0.1") ? "" : ip;
  const url = `http://ip-api.com/json/${targetIp}?fields=status,message,country,countryCode,city,lat,lon,timezone`;
  const r = await axios.get(url, { timeout: 3000 });
  if (r.data?.status !== "success") {
    throw new Error(r.data?.message || "ip-api failed");
  }
  return {
    lat: r.data.lat,
    lon: r.data.lon,
    city: r.data.city,
    country: r.data.country,
    countryCode: r.data.countryCode,
    timezone: r.data.timezone,
    source: "ip-api",
    confidence: 0.6,
  };
}

async function providerIpInfo(ip) {
  const token = process.env.IPINFO_TOKEN ? `?token=${process.env.IPINFO_TOKEN}` : "";
  const targetIp = (ip === "::1" || ip === "127.0.0.1") ? "" : ip;
  const url = `https://ipinfo.io/${targetIp}/json${token}`;
  const r = await axios.get(url, { timeout: 3000 });
  if (!r.data) throw new Error("ipinfo empty");
  let [lat, lon] = r.data.loc ? r.data.loc.split(",").map(Number) : [null, null];
  return {
    lat,
    lon,
    city: r.data.city || null,
    country: r.data.country || null,     // may be 2-letter
    countryCode: r.data.country || null, // keep parallel field
    timezone: r.data.timezone || null,
    source: "ipinfo",
    confidence: 0.5,
  };
}

async function lookupIp(ip) {
  const key = `ip:${ip || "self"}`;
  const cached = ipCache.get(key);
  if (cached) return cached.value;

  try {
    let result;
    try {
      result = await providerIpApi(ip);
      logger?.info?.(`IP lookup (ip-api) OK for ${ip || "self"} => ${result.city}, ${result.country}`);
    } catch (e1) {
      logger?.warn?.(`IP lookup ip-api failed for ${ip || "self"}: ${e1.message}`);
      result = await providerIpInfo(ip);
      logger?.info?.(`IP lookup (ipinfo) OK for ${ip || "self"} => ${result.city}, ${result.countryCode}`);
    }
    ipCache.set(key, result);
    return result;
  } catch (error) {
    logger?.error?.("Error during IP lookup:", { ip, error: error.message });
    return null;
  }
}

async function lookupIpFromReq(req) {
  const ip = getClientIp(req);
  return lookupIp(ip);
}

// ------------------------ REVERSE GEOCODING ---------------------------
async function reverseGeocode(lat, lon, opts = {}) {
  if (!validLatLon(lat, lon)) return null;

  const gh = ngeohash.encode(lat, lon, 6); // ~1.2km
  const lang = (opts.lang || "en").toLowerCase();
  const zoom = opts.zoom || 18;
  const cacheKey = `rev:${gh}:${lang}`;
  const hit = revCache.get(cacheKey);
  if (hit) return hit.value;

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=${zoom}&addressdetails=1&namedetails=1`;
  try {
    const r = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent": "translator-backend/1.0",
        "Accept-Language": lang,
      },
    });
    const data = r.data || {};
    const addr = data.address || {};
    const tz = timezoneFromCoords(lat, lon);

    const out = {
      lat,
      lon,
      geohash: gh,
      tz,
      address: addr,
      display: data.display_name || compactDisplay(addr),
      city: cityFrom(addr),
      state: addr.state || null,
      country: addr.country || null,
      countryCode: addr.country_code ? addr.country_code.toUpperCase() : null,
      source: "gps",
      confidence: 0.95,
    };
    revCache.set(cacheKey, out);
    logger?.info?.(`Reverse geocode OK ${lat},${lon} => ${out.display}`);
    return out;
  } catch (error) {
    logger?.error?.("Error during reverse geocoding:", { lat, lon, error: error.message });
    return null;
  }
}

// ------------------------- CITY SEARCH (FWD) --------------------------
async function searchCity(query, opts = {}) {
  const q = (query || "").trim();
  if (!q) return [];
  const lang = (opts.lang || "en").toLowerCase();
  const limit = Math.min(Math.max(+opts.limit || 5, 1), 10);
  const cacheKey = `fwd:${lang}:${limit}:${q}`;
  const hit = fwdCache.get(cacheKey);
  if (hit) return hit.value;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=${limit}`;
  try {
    const r = await axios.get(url, {
      timeout: 6000,
      headers: {
        "User-Agent": "translator-backend/1.0",
        "Accept-Language": lang,
      },
    });
    const list = (Array.isArray(r.data) ? r.data : []).slice(0, limit).map(item => ({
      name: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      type: item.type,
    }));
    fwdCache.set(cacheKey, list);
    return list;
  } catch (error) {
    logger?.error?.("Error during forward geocoding:", { q, error: error.message });
    return [];
  }
}

// ------------------------------ EXPORTS -------------------------------
module.exports = {
  getClientIp,
  lookupIp,
  lookupIpFromReq,
  reverseGeocode,
  searchCity,
  timezoneFromCoords,
};
