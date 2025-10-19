// app-functions.js

const adhan = require('adhan');
const moment = require('moment-hijri');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const KAABA_COORDS = { lat: 21.4225, lon: 39.8262 };
const historyFilePath = path.join(__dirname, 'history.json');

/**
 * Calculates prayer times for a given location.
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {string} method Calculation method from adhan library
 * @param {string} madhab Asr method ('shafii' or 'hanafi')
 * @returns {object} Prayer times data
 */
function getPrayerTimes(lat, lon, method = 'MuslimWorldLeague', madhab = 'shafii') {
    const coordinates = new adhan.Coordinates(parseFloat(lat), parseFloat(lon));
    let params = adhan.CalculationMethod[method]();
    params.madhab = (madhab === 'hanafi') ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
    const prayerTimes = new adhan.PrayerTimes(coordinates, new Date(), params);

    return {
        fajr: moment(prayerTimes.fajr).format('h:mm A'),
        dhuhr: moment(prayerTimes.dhuhr).format('h:mm A'),
        asr: moment(prayerTimes.asr).format('h:mm A'),
        maghrib: moment(prayerTimes.maghrib).format('h:mm A'),
        isha: moment(prayerTimes.isha).format('h:mm A'),
    };
}

/**
 * Converts a date between Gregorian and Hijri.
 * @param {string} date The date string to convert.
 * @param {'Gregorian' | 'Hijri'} from The source calendar.
 * @param {'Gregorian' | 'Hijri'} to The target calendar.
 * @returns {string} The converted date string.
 */
function convertDate(date, from, to) {
    if (from === 'Gregorian' && to === 'Hijri') {
        return moment(date, 'YYYY-MM-DD').format('iDo iMMMM iYYYY');
    }
    if (from === 'Hijri' && to === 'Gregorian') {
        return moment(date, 'iYYYY/iM/iD').format('dddd, MMMM Do YYYY');
    }
    return "Invalid conversion direction.";
}

/**
 * Searches the translation history.
 * @param {string} searchTerm The term to search for.
 * @param {string} sessionId The user's session ID to filter by.
 * @returns {Array} An array of matching history items.
 */
function searchHistory(searchTerm, sessionId) {
    const history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
    const lowercasedTerm = searchTerm.toLowerCase();

    let results = history;
    if (sessionId) {
        results = results.filter(item => item.sessionId === sessionId);
    }

    results = results.filter(item =>
        item.original.toLowerCase().includes(lowercasedTerm) ||
        item.translated.toLowerCase().includes(lowercasedTerm)
    );

    return results.slice(0, 5);
}


/**
 * Calculates Zakat.
 * @param {object} assets An object containing the user's assets.
 * @returns {object} The Zakat calculation result.
 */
async function calculateZakat(assets) {
    const { cash, goldGrams, silverGrams, currency = 'USD' } = assets;

    const goldApiKey = process.env.GOLD_API_KEY;
    const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY;

    if (!goldApiKey || !exchangeRateApiKey) {
        throw new Error("An API key is not configured on the server for Zakat calculation.");
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

    const targetRate = exchangeResponse.data.conversion_rates[currency.toUpperCase()];
    if (!targetRate) {
        throw new Error(`The currency code '${currency}' is invalid or not supported.`);
    }

    const goldPricePerGram = (goldResponse.data.price / 31.1035) * targetRate;
    const silverPricePerGram = (silverResponse.data.price / 31.1035) * targetRate;

    const nisabInSilver = silverPricePerGram * 595;

    let totalWealth = (cash || 0);
    totalWealth += (goldGrams || 0) * goldPricePerGram;
    totalWealth += (silverGrams || 0) * silverPricePerGram;

    let zakatDue = 0;
    let isPayable = false;

    if (totalWealth >= nisabInSilver) {
        isPayable = true;
        zakatDue = totalWealth * 0.025;
    }

    return {
        totalZakatableWealth: totalWealth.toFixed(2),
        nisabThreshold: nisabInSilver.toFixed(2),
        isZakatPayable: isPayable,
        zakatDue: zakatDue.toFixed(2),
        currency: currency
    };
}


module.exports = {
    getPrayerTimes,
    convertDate,
    searchHistory,
    calculateZakat,
};