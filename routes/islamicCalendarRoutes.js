const express = require('express');
const router = express.Router();
const IslamicCalendarService = require('../services/islamicCalendarService');
const { requireAuth } = require('../middleware/authMiddleware');
const { logger } = require('../config/logger');

const islamicCalendarService = new IslamicCalendarService();

// Get Hijri date for a specific Gregorian date
router.get('/hijri/:date', requireAuth, async (req, res) => {
    try {
        const { date } = req.params;
        const gregorianDate = new Date(date);

        if (isNaN(gregorianDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const hijri = await islamicCalendarService.convertToHijri(gregorianDate);

        if (!hijri) {
            return res.status(500).json({
                success: false,
                error: 'Failed to convert date to Hijri'
            });
        }

        res.json({
            success: true,
            gregorian: {
                date: gregorianDate.toISOString().split('T')[0],
                dayName: gregorianDate.toLocaleDateString('en-US', { weekday: 'long' })
            },
            hijri: hijri,
            message: 'Hijri date retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting Hijri date:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Hijri date'
        });
    }
});

// Get prayer times for a specific date and location
router.get('/prayer-times/:date', requireAuth, async (req, res) => {
    try {
        const { date } = req.params;
        const { latitude, longitude, country } = req.query;

        const gregorianDate = new Date(date);
        if (isNaN(gregorianDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const prayerTimes = await islamicCalendarService.getPrayerTimes(
            gregorianDate,
            parseFloat(latitude),
            parseFloat(longitude),
            country || 'AE'
        );

        if (!prayerTimes) {
            return res.status(500).json({
                success: false,
                error: 'Failed to get prayer times'
            });
        }

        res.json({
            success: true,
            date: gregorianDate.toISOString().split('T')[0],
            location: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            country: country || 'AE',
            prayerTimes: prayerTimes,
            message: 'Prayer times retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting prayer times:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get prayer times'
        });
    }
});

// Get Islamic holidays for a date range
router.get('/holidays', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate, country } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const holidays = await islamicCalendarService.getIslamicHolidays(
            start,
            end,
            country || 'AE'
        );

        res.json({
            success: true,
            holidays: holidays,
            totalHolidays: holidays.length,
            country: country || 'AE',
            dateRange: { startDate, endDate },
            message: 'Islamic holidays retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting Islamic holidays:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Islamic holidays'
        });
    }
});

// Get monthly Islamic events (holidays + prayer times)
router.get('/monthly-events/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const { latitude, longitude, country } = req.query;

        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                success: false,
                error: 'Invalid year or month'
            });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required for prayer times'
            });
        }

        const events = await islamicCalendarService.getMonthlyIslamicEvents(
            yearNum,
            monthNum,
            parseFloat(latitude),
            parseFloat(longitude),
            country || 'AE'
        );

        res.json({
            success: true,
            year: yearNum,
            month: monthNum,
            country: country || 'AE',
            events: events,
            message: 'Monthly Islamic events retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting monthly Islamic events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get monthly Islamic events'
        });
    }
});

// Create prayer time events for calendar integration
router.post('/create-prayer-events', requireAuth, async (req, res) => {
    try {
        const { date, latitude, longitude, country } = req.body;

        if (!date || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Date, latitude, and longitude are required'
            });
        }

        const gregorianDate = new Date(date);
        if (isNaN(gregorianDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format'
            });
        }

        const prayerEvents = await islamicCalendarService.createPrayerTimeEvents(
            gregorianDate,
            parseFloat(latitude),
            parseFloat(longitude),
            country || 'AE'
        );

        res.json({
            success: true,
            date: gregorianDate.toISOString().split('T')[0],
            events: prayerEvents,
            totalEvents: prayerEvents.length,
            message: 'Prayer time events created successfully'
        });

    } catch (error) {
        logger.error('Error creating prayer events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create prayer events'
        });
    }
});

// Get supported countries
router.get('/countries', requireAuth, async (req, res) => {
    try {
        const countries = [
            { code: 'AE', name: 'United Arab Emirates', nameAr: 'الإمارات العربية المتحدة' },
            { code: 'SA', name: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية' },
            { code: 'TR', name: 'Turkey', nameAr: 'تركيا' },
            { code: 'PK', name: 'Pakistan', nameAr: 'باكستان' },
            { code: 'MY', name: 'Malaysia', nameAr: 'ماليزيا' },
            { code: 'ID', name: 'Indonesia', nameAr: 'إندونيسيا' },
            { code: 'EG', name: 'Egypt', nameAr: 'مصر' },
            { code: 'MA', name: 'Morocco', nameAr: 'المغرب' },
            { code: 'DZ', name: 'Algeria', nameAr: 'الجزائر' },
            { code: 'TN', name: 'Tunisia', nameAr: 'تونس' },
            { code: 'LY', name: 'Libya', nameAr: 'ليبيا' },
            { code: 'KW', name: 'Kuwait', nameAr: 'الكويت' },
            { code: 'QA', name: 'Qatar', nameAr: 'قطر' },
            { code: 'BH', name: 'Bahrain', nameAr: 'البحرين' },
            { code: 'OM', name: 'Oman', nameAr: 'عمان' }
        ];

        res.json({
            success: true,
            countries: countries,
            totalCountries: countries.length,
            message: 'Supported countries retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting countries:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get countries'
        });
    }
});

// Get current Hijri date
router.get('/current-hijri', async (req, res) => {
    try {
        const today = new Date();
        const hijri = await islamicCalendarService.convertToHijri(today);

        if (!hijri) {
            return res.status(500).json({
                success: false,
                error: 'Failed to get current Hijri date'
            });
        }

        res.json({
            success: true,
            gregorian: {
                date: today.toISOString().split('T')[0],
                dayName: today.toLocaleDateString('en-US', { weekday: 'long' })
            },
            hijri: hijri,
            message: 'Current Hijri date retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting current Hijri date:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current Hijri date'
        });
    }
});

module.exports = router;

