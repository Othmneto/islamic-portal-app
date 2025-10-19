// translator-backend/__tests__/zakatService.test.js

const axios = require('axios');
const zakatService = require('../services/zakatService');
const logger = require('../utils/logger');

// Mock the entire axios library
jest.mock('axios');

// Suppress console logs from the logger during tests to keep the output clean
beforeAll(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
});

describe('Zakat Service', () => {

    beforeEach(() => {
        // Set up the environment variables needed for this service
        process.env.GOLD_API_KEY = 'fake_gold_key';
        process.env.EXCHANGE_RATE_API_KEY = 'fake_exchange_key';

        // Reset mocks before each test
        axios.get.mockReset();
    });

    it('should calculate Nisab values correctly in USD', async () => {
        // Arrange: Define the fake data that axios will return
        const mockGoldResponse = { data: { price: 2300 } }; // Price per ounce
        const mockSilverResponse = { data: { price: 28 } }; // Price per ounce
        const mockExchangeResponse = { data: { conversion_rates: { USD: 1.0, EUR: 0.92 } } };

        // Tell axios what to do when it's called with specific URLs
        axios.get.mockImplementation(url => {
            if (url.includes('XAU')) return Promise.resolve(mockGoldResponse);
            if (url.includes('XAG')) return Promise.resolve(mockSilverResponse);
            if (url.includes('exchangerate-api')) return Promise.resolve(mockExchangeResponse);
            return Promise.reject(new Error('Unknown API URL'));
        });

        // Act: Call the service function we want to test
        const nisab = await zakatService.getNisabValues('USD');

        // Assert: Check if the calculations are correct
        // (2300 / 31.1035) * 1.0 = ~73.95
        // (28 / 31.1035) * 1.0 = ~0.90
        expect(nisab.goldPricePerGram).toBe('73.95');
        expect(nisab.silverPricePerGram).toBe('0.90');
    });

    it('should throw an error if an external API fails', async () => {
        // Arrange: Tell axios to simulate a failure
        axios.get.mockRejectedValue(new Error('Network Error'));

        // Act & Assert: Ensure our service correctly throws an error
        await expect(zakatService.getNisabValues('USD')).rejects.toThrow('Could not fetch live price data. An external service may be down.');
    });

    it('should throw an error if API keys are missing', async () => {
        // Arrange: Unset the environment variables
        delete process.env.GOLD_API_KEY;
        delete process.env.EXCHANGE_RATE_API_KEY;

        // Act & Assert: Check that our service fails fast
        await expect(zakatService.getNisabValues('USD')).rejects.toThrow('An API key is not configured on the server.');
    });
});