// translator-backend/services/prayerTimeService.js

const adhan = require('adhan');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

/**
 * Calculates prayer times using adhan.js (Egyptian Survey method).
 * @param {number} lat
 * @param {number} lon
 * @param {Date}   date    - JS Date (defaults to "now")
 * @param {string} timezone - IANA tz, e.g. "Africa/Cairo"
 * @returns {{fajr:Date,dhuhr:Date,asr:Date,maghrib:Date,isha:Date}}
 */
const getPrayerTimes = (lat, lon, date = new Date(), timezone = 'Africa/Cairo') => {
  try {
    const coords = new adhan.Coordinates(lat, lon);

    // Egyptian Survey method + Shafi madhab (common in Egypt)
    const params = adhan.CalculationMethod.Egyptian();
    params.madhab = adhan.Madhab.Shafi;

    // Create a date in the user's timezone (midnight that day)
    const m = moment.tz(date, timezone);
    const d = new Date(m.year(), m.month(), m.date());

    const times = new adhan.PrayerTimes(coords, d, params);

    // Normalize to timezone-aware JS Dates
    const toZoned = (dt) => moment.tz(dt, timezone).toDate();

    return {
      fajr:    toZoned(times.fajr),
      dhuhr:   toZoned(times.dhuhr),
      asr:     toZoned(times.asr),
      maghrib: toZoned(times.maghrib),
      isha:    toZoned(times.isha),
    };
  } catch (error) {
    logger.error('Error calculating prayer times', { lat, lon, error: error.message });
    throw new Error('Could not calculate prayer times.');
  }
};

module.exports = { getPrayerTimes };
