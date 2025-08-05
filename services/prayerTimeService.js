// translator-backend/services/prayerTimeService.js

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Fetches prayer times from the Al-Adhan API for a given city and country.
 * @param {string} city - The name of the city.
 * @param {string} country - The name of the country.
 * @returns {Promise<object>} The prayer times data.
 * @throws {Error} If the API call fails or returns no data.
 */
const getPrayerTimes = async (city, country) => {
    try {
        const url = `http://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=2`;
        logger.info('Fetching prayer times from external API', { city, country });
        
        const response = await axios.get(url);

        if (response.data && response.data.data) {
            return response.data.data;
        } else {
            throw new Error('Invalid data format received from prayer times API.');
        }
    } catch (error) {
        logger.error('Error fetching prayer times from Al-Adhan API', {
            city,
            country,
            errorMessage: error.message,
        });
        // Re-throw the error to be handled by the controller's catch block
        throw new Error('Could not fetch prayer times.');
    }
};

module.exports = {
    getPrayerTimes,
};