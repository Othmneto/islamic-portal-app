// translator-backend/services/islamicInfoService.js

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const adhan = require('adhan');

// IMPORTANT: use a single Moment instance with both timezone + Hijri plugins
const moment = require('moment-timezone');
require('moment-hijri');

const logger = require('../utils/logger');

const KAABA_COORDS = { lat: 21.4225, lon: 39.8262 };

/** Haversine distance (km) */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Safe calculation method + madhab (accepts 'auto' gracefully) */
function resolveParams(method = 'MuslimWorldLeague', madhab = 'shafii', tz = 'UTC') {
  let m = method;
  let md = madhab;

  if (!adhan.CalculationMethod[m]) {
    // handle 'auto' and unknown keys
    if (/Africa\/Cairo|Egypt/i.test(tz)) m = 'Egyptian';
    else if (/Asia\/Dubai|Dubai/i.test(tz)) m = 'Dubai';
    else if (/Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz)) m = 'Karachi';
    else if (/America\/|Canada|USA|US|CA/i.test(tz)) m = 'NorthAmerica';
    else m = 'MuslimWorldLeague';
  }

  if (md === 'auto' || (md !== 'hanafi' && md !== 'shafii')) {
    md = /Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz) ? 'hanafi' : 'shafii';
  }

  const params = adhan.CalculationMethod[m]?.() || adhan.CalculationMethod.MuslimWorldLeague();
  params.madhab = md === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  return params;
}

/** Convert adhan.PrayerTimes -> ISO object (only the 5 needed) */
function toIsoTimesObject(pt) {
  return {
    fajr: new Date(pt.fajr).toISOString(),
    dhuhr: new Date(pt.dhuhr).toISOString(),
    asr: new Date(pt.asr).toISOString(),
    maghrib: new Date(pt.maghrib).toISOString(),
    isha: new Date(pt.isha).toISOString(),
  };
}

/**
 * Compute prayer times.
 * - Uses user's timezone (tz) for the "date-of-day" to avoid day-boundary issues.
 * - Returns raw times as ISO strings to serialize cleanly over JSON.
 */
const getPrayerTimes = (lat, lon, method = 'MuslimWorldLeague', madhab = 'shafii', tz = 'UTC') => {
  try {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Invalid coordinates');
    }

    // Establish the user's "current date" in their timezone
    // NOTE: adhan JS internally uses the system TZ; we mitigate date-boundary issues by anchoring the date via tz.
    // This does not change Node's TZ globally.
    const dateInTz = moment.tz(tz).toDate();

    const coordinates = new adhan.Coordinates(latitude, longitude);
    const params = resolveParams(method, madhab, tz);

    const prayerTimes = new adhan.PrayerTimes(coordinates, dateInTz, params);
    const qiblaDirection = adhan.Qibla(coordinates);
    const distanceKm = calculateDistance(latitude, longitude, KAABA_COORDS.lat, KAABA_COORDS.lon);

    // Format dates in the user's timezone for consistency
    const gregorianDate = moment(dateInTz).tz(tz).format('dddd, MMMM D, YYYY');
    const hijriDate = moment(dateInTz).tz(tz).format('iYYYY/iM/iD');

    return {
      // send ISO strings to ensure safe JSON over HTTP
      timesRaw: toIsoTimesObject(prayerTimes),
      date: {
        gregorian: gregorianDate,
        hijri: hijriDate,
      },
      qibla: qiblaDirection,             // degrees from true North
      distance: distanceKm.toFixed(2),   // kilometers as string
    };
  } catch (error) {
    logger.error('Error calculating prayer times.', {
      errorMessage: error.message,
      lat,
      lon,
      method,
      madhab,
      tz,
    });
    throw new Error('Failed to calculate prayer times.');
  }
};

const getDuas = async () => {
  const duasPath = path.join(__dirname, '..', 'duas.json');
  const data = await fs.readFile(duasPath, 'utf8');
  return JSON.parse(data);
};

const getNames = async () => {
  const namesPath = path.join(__dirname, '..', 'names.json');
  const data = await fs.readFile(namesPath, 'utf8');
  return JSON.parse(data);
};

const getUmmahStats = async () => {
  try {
    const countryDataPath = path.join(__dirname, '..', 'country_islam_data.json');
    const countryData = JSON.parse(await fs.readFile(countryDataPath, 'utf8'));

    const response = await axios.get(
      'https://restcountries.com/v3.1/all?fields=name,cca2,population,flags'
    );
    const liveCountryData = response.data;

    let globalMuslimPopulation = 0;

    const mergedData = liveCountryData
      .map((live) => {
        const islamData = countryData.find((c) => c.code === live.cca2);
        if (!islamData) return null;

        const totalPopulation = Number(live.population) || 0;
        const muslimPopulation = Math.round(totalPopulation * (Number(islamData.muslim_percent || 0) / 100));
        globalMuslimPopulation += muslimPopulation;

        return {
          name: live?.name?.common || live?.name || '',
          flag: live?.flags?.svg || live?.flags?.png || '',
          totalPopulation,
          muslimPercent: Number(islamData.muslim_percent) || 0,
          muslimPopulation,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.muslimPopulation - a.muslimPopulation);

    return {
      globalMuslimPopulation,
      countries: mergedData,
    };
  } catch (error) {
    logger.error('Error fetching Ummah stats.', { errorMessage: error.message });
    throw new Error('Failed to fetch population statistics.');
  }
};

module.exports = {
  getPrayerTimes,
  getDuas,
  getNames,
  getUmmahStats,
};
