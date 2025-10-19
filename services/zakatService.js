// translator-backend/services/zakatService.js

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Fetches the live price of gold and silver to determine the Nisab for Zakat.
 * @param {string} currency - The target currency code (e.g., 'USD', 'EUR').
 * @returns {Promise<object>} An object containing the price per gram for gold and silver.
 * @throws {Error} If API keys are missing or external API calls fail.
 */
const getNisabValues = async (currency = 'USD') => {
    const goldApiKey = process.env.GOLD_API_KEY;
    const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY;

    if (!goldApiKey || !exchangeRateApiKey) {
        logger.error('Missing API keys for Zakat service.');
        throw new Error("An API key is not configured on the server.");
    }

    try {
        const goldApiUrl = 'https://www.goldapi.io/api/XAU/USD';
        const silverApiUrl = 'https://www.goldapi.io/api/XAG/USD';
        const exchangeRateUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/USD`;
        const headers = { 'x-access-token': goldApiKey };

        logger.info('Fetching live metal and exchange rate data for Nisab calculation.');
        const [goldResponse, silverResponse, exchangeResponse] = await Promise.all([
            axios.get(goldApiUrl, { headers }),
            axios.get(silverApiUrl, { headers }),
            axios.get(exchangeRateUrl)
        ]);

        const goldPriceInUSD = goldResponse.data.price;
        const silverPriceInUSD = silverResponse.data.price;

        const exchangeRates = exchangeResponse.data.conversion_rates;
        const targetRate = exchangeRates[currency.toUpperCase()];
        if (!targetRate) {
            throw new Error(`The currency code '${currency}' is invalid or not supported.`);
        }

        // Convert from price per ounce to price per gram and apply exchange rate
        const goldPricePerGram = (goldPriceInUSD / 31.1035) * targetRate;
        const silverPricePerGram = (silverPriceInUSD / 31.1035) * targetRate;

        return {
            goldPricePerGram: goldPricePerGram.toFixed(2),
            silverPricePerGram: silverPricePerGram.toFixed(2),
        };

    } catch (error) {
        logger.error('Failed to fetch Nisab values from external APIs.', { errorMessage: error.message });
        throw new Error('Could not fetch live price data. An external service may be down.');
    }
};

module.exports = {
    getNisabValues,
};