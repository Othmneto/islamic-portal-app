// translator-backend/services/islamicInfoService.js

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const adhan = require('adhan');
const moment = require('moment-hijri');
const logger = require('../utils/logger');

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

const getPrayerTimes = (lat, lon, method = 'MuslimWorldLeague', madhab = 'shafii') => {
    try {
        const coordinates = new adhan.Coordinates(parseFloat(lat), parseFloat(lon));
        let params = adhan.CalculationMethod[method]();
        params.madhab = (madhab === 'hanafi') ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
        
        const prayerTimes = new adhan.PrayerTimes(coordinates, new Date(), params);
        const qiblaDirection = adhan.Qibla(coordinates);
        const distance = calculateDistance(coordinates.latitude, coordinates.longitude, KAABA_COORDS.lat, KAABA_COORDS.lon);
        const hijriDate = moment(new Date()).format('iYYYY/iM/iD');

        return {
            timesRaw: prayerTimes,
            date: {
                gregorian: moment().format('dddd, MMMM D, YYYY'),
                hijri: hijriDate,
            },
            qibla: qiblaDirection,
            distance: distance.toFixed(2)
        };
    } catch (error) {
        logger.error('Error calculating prayer times.', { errorMessage: error.message });
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
        
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,cca2,population,flags');
        const liveCountryData = response.data;

        let globalMuslimPopulation = 0;

        const mergedData = liveCountryData.map(liveData => {
            const islamData = countryData.find(c => c.code === liveData.cca2);
            if (!islamData) return null;

            const totalPopulation = liveData.population;
            const muslimPopulation = Math.round(totalPopulation * (islamData.muslim_percent / 100));
            globalMuslimPopulation += muslimPopulation;

            return {
                name: liveData.name.common,
                flag: liveData.flags.svg,
                totalPopulation,
                muslimPercent: islamData.muslim_percent,
                muslimPopulation
            };
        }).filter(Boolean).sort((a, b) => b.muslimPopulation - a.muslimPopulation);

        return {
            globalMuslimPopulation,
            countries: mergedData
        };
    } catch (error) {
        logger.error("Error fetching Ummah stats.", { errorMessage: error.message });
        throw new Error("Failed to fetch population statistics.");
    }
};


module.exports = {
    getPrayerTimes,
    getDuas,
    getNames,
    getUmmahStats,
};