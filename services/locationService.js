// translator-backend/services/locationService.js

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Searches for a city using an external geocoding API.
 * @param {string} query - The city name to search for.
 * @returns {Promise<Array>} A list of matching locations.
 * @throws {Error} If the API key is missing or the external API call fails.
 */
const searchCity = async (query) => {
    const apiKey = process.env.GEOCODING_API_KEY;
    if (!apiKey) {
        logger.error('Geocoding API key is not configured.');
        throw new Error("Geocoding API key is not configured on the server.");
    }

    try {
        logger.info('Searching for city via OpenWeatherMap Geocoding API', { query });
        const response = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${apiKey}`);
        
        return response.data.map(location => ({
            city: location.name,
            country: location.country,
            lat: location.lat,
            lng: location.lon
        }));
    } catch (error) {
        logger.error('Error searching for city.', { query, errorMessage: error.message });
        throw new Error("Could not perform city search.");
    }
};

module.exports = {
    searchCity,
};