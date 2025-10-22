// translator-backend/services/prayerTimeServiceMonthly.js
// Extended prayer time service for monthly batch calculations
// Non-invasive: copy of core logic from prayerTimeService.js with monthly wrapper

const adhan = require("adhan");
const moment = require("moment-timezone");
const logger = require("../utils/logger");

// Add/subtract minutes from a Date
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

// Normalize method/madhab strings with comprehensive worldwide auto-detection
function resolveParams(method = "MuslimWorldLeague", madhab = "shafii", tz = "UTC") {
  let m = method;
  let md = madhab;

  // If method is 'auto' or not a valid method, use comprehensive auto-detection
  if (method === 'auto' || !adhan.CalculationMethod[m]) {
    // EGYPTIAN METHOD - North Africa and Egypt
    if (/Africa\/Cairo|Egypt/i.test(tz)) {
      m = 'Egyptian';
    }
    // UMM AL QURA METHOD - UAE (officially used)
    else if (/Asia\/Dubai|Dubai|UAE/i.test(tz)) {
      m = 'UmmAlQura';
    }
    // KARACHI METHOD - South Asia (Pakistan, India, Bangladesh, Sri Lanka)
    else if (/Asia\/(Karachi|Kolkata|Dhaka|Colombo)|Pakistan|India|Bangladesh|Sri_Lanka/i.test(tz)) {
      m = 'Karachi';
    }
    // TEHRAN METHOD - Iran
    else if (/Asia\/Tehran|Iran/i.test(tz)) {
      m = 'Tehran';
    }
    // UMM AL QURA METHOD - Saudi Arabia and Gulf states
    else if (/Asia\/(Riyadh|Dammam|Qatar|Bahrain|Kuwait|Muscat)|Saudi_Arabia|Kuwait|Qatar|Bahrain|Oman|Yemen/i.test(tz)) {
      m = 'UmmAlQura';
    }
    // UMM AL QURA METHOD - Southeast Asia
    else if (/Asia\/(Jakarta|Makassar|Pontianak|Jayapura|Bangkok|Ho_Chi_Minh|Hanoi|Phnom_Penh|Vientiane|Yangon|Manila|Kuala_Lumpur|Singapore|Brunei)|Indonesia|Malaysia|Singapore|Brunei|Thailand|Vietnam|Cambodia|Laos|Myanmar|Philippines/i.test(tz)) {
      m = 'UmmAlQura';
    }
    // TURKEY METHOD - Turkey
    else if (/Asia\/Istanbul|Europe\/Istanbul|Turkey/i.test(tz)) {
      m = 'Turkey';
    }
    // MAKKAH METHOD - Mecca and Medina
    else if (/Asia\/Makkah|Mecca|Medina/i.test(tz)) {
      m = 'Makkah';
    }
    // NORTH AMERICA METHOD - USA, Canada, Mexico
    else if (/America\/(New_York|Chicago|Denver|Los_Angeles|Anchorage|Toronto|Vancouver|Mexico_City|Tijuana|Cancun)|Canada|USA|US|CA|Mexico/i.test(tz)) {
      m = 'NorthAmerica';
    }
    // MUSLIM WORLD LEAGUE METHOD - Europe
    else if (/Europe\/(London|Paris|Berlin|Madrid|Rome|Amsterdam|Brussels|Vienna|Prague|Warsaw|Stockholm|Oslo|Copenhagen|Helsinki|Athens|Lisbon|Dublin|Luxembourg|Monaco|Vatican|San_Marino|Liechtenstein|Malta|Cyprus|Moscow|Kiev|Minsk|Bucharest|Sofia|Zagreb|Ljubljana|Bratislava|Budapest|Tallinn|Riga|Vilnius|Reykjavik)|Europe/i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - East Asia
    else if (/Asia\/(Tokyo|Seoul|Shanghai|Beijing|Hong_Kong|Taipei|Macau|Ulaanbaatar|Pyongyang)|Japan|South_Korea|China|Hong_Kong|Taiwan|Macau|Mongolia|North_Korea/i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - Africa (except Egypt)
    else if (/Africa\//i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - Australia and Pacific
    else if (/Australia\/|Pacific\//i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - South America
    else if (/America\/(Sao_Paulo|Rio_de_Janeiro|Buenos_Aires|Santiago|Lima|Bogota|Caracas|La_Paz|Asuncion|Montevideo)|South_America|Brazil|Argentina|Chile|Peru|Colombia|Venezuela|Bolivia|Paraguay|Uruguay/i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // Default fallback for unknown timezones
    else {
      m = 'MuslimWorldLeague';
    }
  }

  // Auto-detect madhab based on region
  if (madhab === 'auto' || (md !== 'hanafi' && md !== 'shafii')) {
    // Regions that typically use Hanafi madhab
    if (/Asia\/(Karachi|Kolkata|Dhaka|Colombo|Tashkent|Almaty|Bishkek|Dushanbe|Ashgabat|Baku)|Pakistan|India|Bangladesh|Sri_Lanka|Uzbekistan|Kazakhstan|Kyrgyzstan|Tajikistan|Turkmenistan|Afghanistan|Azerbaijan/i.test(tz)) {
      md = 'hanafi';
    } else {
      // Default to Shafii for most other regions
      md = 'shafii';
    }
  }

  const params = adhan.CalculationMethod[m]?.() || adhan.CalculationMethod.MuslimWorldLeague();
  params.madhab = md === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  return params;
}

/**
 * Calculate prayer times for a single day (same logic as original service)
 */
function getPrayerTimesForDay({ date, lat, lon, timezone, method, madhab }) {
  try {
    const coords = new adhan.Coordinates(lat, lon);
    const params = resolveParams(method, madhab, timezone);

    // Build the calculation date at local midnight of the target timezone
    const startOfDayLocal = moment.tz(date, timezone).startOf("day");
    const calcDate = startOfDayLocal.toDate();

    // Tomorrow (for Tahajjud end window)
    const tomorrowCalcDate = startOfDayLocal.clone().add(1, "day").toDate();

    const timesToday = new adhan.PrayerTimes(coords, calcDate, params);
    const timesTomorrow = new adhan.PrayerTimes(coords, tomorrowCalcDate, params);

    // Helper: convert returned times to the specified timezone (stable Date objects)
    const toZoned = (dt) => moment.tz(dt, timezone).toDate();

    // Worship periods
    const imsakStart = addMinutes(timesToday.fajr, -15);
    const imsakEnd = timesToday.fajr;

    const duhaStart = addMinutes(timesToday.sunrise, 15);
    const duhaEnd = addMinutes(timesToday.dhuhr, -15);

    const nightStart = timesToday.maghrib;
    const nightEnd = timesTomorrow.fajr;
    const nightDurationMin = (nightEnd - nightStart) / 60000;
    const tahajjudStart = addMinutes(nightStart, (nightDurationMin * 2) / 3);
    const tahajjudEnd = nightEnd;

    return {
      // Standard prayers
      fajr: toZoned(timesToday.fajr),
      dhuhr: toZoned(timesToday.dhuhr),
      asr: toZoned(timesToday.asr),
      maghrib: toZoned(timesToday.maghrib),
      isha: toZoned(timesToday.isha),

      // Key time
      shuruq: toZoned(timesToday.sunrise),

      // Worship periods
      periods: {
        imsak:   { start: toZoned(imsakStart),    end: toZoned(imsakEnd) },
        duha:    { start: toZoned(duhaStart),     end: toZoned(duhaEnd) },
        tahajjud:{ start: toZoned(tahajjudStart), end: toZoned(tahajjudEnd) },
      },

      // For convenience (metadata)
      meta: {
        method: typeof method === "string" ? method : "MuslimWorldLeague",
        madhab: String(madhab || "shafii").toLowerCase() === "hanafi" ? "hanafi" : "shafii",
        timezone,
        coordinates: { lat, lon },
        date: startOfDayLocal.format("YYYY-MM-DD"),
      },
    };
  } catch (error) {
    logger?.error?.("Error calculating prayer times for day", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Could not calculate prayer times for day.");
  }
}

/**
 * NEW: Calculate prayer times for an entire month
 * @param {Object} params
 * @param {number} params.year - Year (e.g., 2025)
 * @param {number} params.month - Month (1-12)
 * @param {number} params.lat - Latitude
 * @param {number} params.lon - Longitude
 * @param {string} params.timezone - IANA timezone (e.g., 'Asia/Dubai')
 * @param {string} params.method - Calculation method (e.g., 'UmmAlQura')
 * @param {string} params.madhab - Madhab ('shafii' or 'hanafi')
 * @returns {Array} Array of prayer times for each day in the month
 */
function getPrayerTimesForMonth({ year, month, lat, lon, timezone, method = 'auto', madhab = 'auto' }) {
  try {
    const monthlyTimes = [];
    
    // Calculate number of days in the month
    const daysInMonth = moment.tz(`${year}-${String(month).padStart(2, '0')}`, timezone).daysInMonth();
    
    // Calculate prayer times for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = moment.tz(dateStr, timezone).toDate();
      
      const dayTimes = getPrayerTimesForDay({
        date,
        lat,
        lon,
        timezone,
        method,
        madhab
      });
      
      monthlyTimes.push({
        date: dateStr,
        day: day,
        times: {
          fajr: dayTimes.fajr,
          dhuhr: dayTimes.dhuhr,
          asr: dayTimes.asr,
          maghrib: dayTimes.maghrib,
          isha: dayTimes.isha,
          shuruq: dayTimes.shuruq,
        },
        periods: dayTimes.periods,
        meta: dayTimes.meta
      });
    }
    
    return {
      year,
      month,
      timezone,
      method: typeof method === "string" ? method : "auto",
      madhab: typeof madhab === "string" ? madhab : "auto",
      coordinates: { lat, lon },
      days: monthlyTimes,
      totalDays: daysInMonth
    };
  } catch (error) {
    logger?.error?.("Error calculating monthly prayer times", {
      error: error.message,
      stack: error.stack,
      year,
      month
    });
    throw new Error("Could not calculate monthly prayer times.");
  }
}

module.exports = { 
  getPrayerTimesForDay,
  getPrayerTimesForMonth 
};

