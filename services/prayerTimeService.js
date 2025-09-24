// translator-backend/services/prayerTimeService.js

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
    // DUBAI METHOD - UAE and some Gulf states
    else if (/Asia\/Dubai|Dubai|UAE/i.test(tz)) {
      m = 'Dubai';
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
    else if (/Africa\/(Algiers|Casablanca|Tunis|Tripoli|Cairo|Khartoum|Addis_Ababa|Nairobi|Kampala|Kigali|Bujumbura|Dar_es_Salaam|Lusaka|Harare|Gaborone|Windhoek|Cape_Town|Johannesburg|Durban|Maputo|Antananarivo|Port_Louis|Victoria|Dakar|Bamako|Ouagadougou|Abidjan|Accra|Lome|Cotonou|Lagos|Abuja|Douala|Libreville|Brazzaville|Kinshasa|Luanda|Malabo|Banjul|Conakry|Freetown|Monrovia|Bissau|Praia|Sao_Tome|Nouakchott|Niamey|N'Djamena|Bangui|Yaounde|Bujumbura|Kigali|Kampala|Nairobi|Djibouti|Asmara|Mogadishu|Khartoum|Juba|Bangui|N'Djamena|Niamey|Ouagadougou|Bamako|Dakar|Banjul|Conakry|Freetown|Monrovia|Bissau|Praia|Sao_Tome|Malabo|Libreville|Brazzaville|Kinshasa|Luanda|Maputo|Lusaka|Harare|Gaborone|Windhoek|Cape_Town|Johannesburg|Durban|Antananarivo|Port_Louis|Victoria)|Africa/i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - Australia and Pacific
    else if (/Australia\/(Sydney|Melbourne|Brisbane|Perth|Adelaide|Darwin|Hobart)|Pacific\/(Auckland|Fiji|Tonga|Samoa|Guam|Honolulu|Noumea|Port_Moresby|Honiara|Port_Vila|Suva|Nuku'alofa|Apia|Pago_Pago)|Australia|New_Zealand|Fiji|Tonga|Samoa|Guam|Hawaii|New_Caledonia|Papua_New_Guinea|Solomon_Islands|Vanuatu|Marshall_Islands|Micronesia|Palau|Kiribati|Tuvalu|Nauru/i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - South America
    else if (/America\/(Sao_Paulo|Rio_de_Janeiro|Buenos_Aires|Santiago|Lima|Bogota|Caracas|La_Paz|Asuncion|Montevideo|Georgetown|Paramaribo|Cayenne|Brasilia|Manaus|Recife|Salvador|Fortaleza|Belo_Horizonte|Curitiba|Porto_Alegre|Cordoba|Rosario|Mendoza|Valparaiso|Concepcion|Arequipa|Trujillo|Chiclayo|Iquitos|Cusco|Barranquilla|Cali|Medellin|Cartagena|Bucaramanga|Pereira|Manizales|Valencia|Maracaibo|Barquisimeto|Ciudad_Guayana|Maracay|Valencia|San_Cristobal|Maturin|Ciudad_Bolivar|Cumana|Merida|Trujillo|San_Fernando|Coro|Puerto_La_Cruz|El_Tigre|Acarigua|Araure|Guanare|Trujillo|Valera|San_Cristobal|Merida|Tachira|Apure|Barinas|Portuguesa|Cojedes|Guarico|Anzoategui|Monagas|Sucre|Delta_Amacuro|Amazonas|Bolivar|Lara|Falcon|Zulia|Yaracuy|Carabobo|Aragua|Miranda|Vargas|Distrito_Capital|Nueva_Esparta|Trujillo|Merida|Tachira|Apure|Barinas|Portuguesa|Cojedes|Guarico|Anzoategui|Monagas|Sucre|Delta_Amacuro|Amazonas|Bolivar|Lara|Falcon|Zulia|Yaracuy|Carabobo|Aragua|Miranda|Vargas|Distrito_Capital|Nueva_Esparta)|South_America|Brazil|Argentina|Chile|Peru|Colombia|Venezuela|Bolivia|Paraguay|Uruguay|Guyana|Suriname|French_Guiana/i.test(tz)) {
      m = 'MuslimWorldLeague';
    }
    // MUSLIM WORLD LEAGUE METHOD - Central America and Caribbean
    else if (/America\/(Guatemala|Belize|El_Salvador|Honduras|Nicaragua|Costa_Rica|Panama|Havana|Kingston|Port-au-Prince|Santo_Domingo|San_Juan|Bridgetown|Castries|Roseau|Saint_George's|Saint_John's|Basseterre|Kingstown|Port_of_Spain|Nassau|Havana|Kingston|Port-au-Prince|Santo_Domingo|San_Juan|Bridgetown|Castries|Roseau|Saint_George's|Saint_John's|Basseterre|Kingstown|Port_of_Spain|Nassau)|Central_America|Caribbean|Guatemala|Belize|El_Salvador|Honduras|Nicaragua|Costa_Rica|Panama|Cuba|Jamaica|Haiti|Dominican_Republic|Puerto_Rico|Barbados|Saint_Lucia|Dominica|Grenada|Antigua_and_Barbuda|Saint_Vincent_and_the_Grenadines|Trinidad_and_Tobago|Bahamas/i.test(tz)) {
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
    if (/Asia\/(Karachi|Kolkata|Dhaka|Colombo|Tashkent|Almaty|Bishkek|Dushanbe|Ashgabat|Baku|Yerevan|Tbilisi|Bishkek|Dushanbe|Tashkent|Almaty|Nur-Sultan|Bishkek|Dushanbe|Tashkent|Almaty|Nur-Sultan|Bishkek|Dushanbe|Tashkent|Almaty|Nur-Sultan)|Pakistan|India|Bangladesh|Sri_Lanka|Uzbekistan|Kazakhstan|Kyrgyzstan|Tajikistan|Turkmenistan|Afghanistan|Azerbaijan|Armenia|Georgia/i.test(tz)) {
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
 * Argument normalizer to keep backwards compatibility with older callers.
 *
 * Supported call signatures:
 * 1) getPrayerTimes(lat, lon, date?, timezone?, method?, madhab?)
 * 2) getPrayerTimes(date, lat, lon, method?, madhab?, timezone?)
 * 3) getPrayerTimes({ date, lat, lon, timezone, method, madhab })
 */
function normalizeArgs(...args) {
  // Defaults (kept Cairo to preserve current project behavior unless overridden)
  let date = new Date();
  let lat, lon;
  let timezone = "Africa/Cairo";
  let method = "MuslimWorldLeague";
  let madhab = "shafii";

  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
    const o = args[0];
    date = o.date instanceof Date ? o.date : new Date(o.date || Date.now());
    lat = Number(o.lat ?? o.latitude);
    lon = Number(o.lon ?? o.longitude);
    timezone = o.timezone || timezone;
    method = o.method || method;
    madhab = o.madhab || madhab;
  } else if (args[0] instanceof Date && typeof args[1] === "number" && typeof args[2] === "number") {
    // (date, lat, lon, method?, madhab?, timezone?)
    date = args[0];
    lat = Number(args[1]);
    lon = Number(args[2]);
    method = args[3] || method;
    madhab = args[4] || madhab;
    timezone = args[5] || timezone;
  } else if (typeof args[0] === "number" && typeof args[1] === "number") {
    // (lat, lon, date?, timezone?, method?, madhab?)
    lat = Number(args[0]);
    lon = Number(args[1]);
    if (args[2] instanceof Date) date = args[2];
    else if (typeof args[2] === "string") timezone = args[2]; // if they passed timezone in position 3
    if (typeof args[3] === "string") timezone = args[3];
    if (typeof args[4] === "string") method = args[4];
    if (typeof args[5] === "string") madhab = args[5];
  } else {
    throw new Error("Invalid arguments for getPrayerTimes()");
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Latitude/Longitude must be numeric.");
  }

  return { date: new Date(date), lat, lon, timezone, method, madhab };
}

/**
 * Calculates prayer times + shuruq and worship periods (imsak, duha, tahajjud).
 *
 * Returns timezone-aware Date objects suitable for scheduling/displaying.
 */
function getPrayerTimes(...args) {
  try {
    const { date, lat, lon, timezone, method, madhab } = normalizeArgs(...args);

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
    logger?.error?.("Error calculating prayer times", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Could not calculate prayer times.");
  }
}

module.exports = { getPrayerTimes };
