const express = require('express');
const router = express.Router();
const IslamicCalendarService = require('../services/islamicCalendarService');
const { getPrayerTimesForMonth } = require('../services/prayerTimeServiceMonthly');
const holidayAggregator = require('../services/holidayAggregatorService');
const Holiday = require('../models/Holiday');
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

// Get current Hijri date (public endpoint)
router.get('/current-hijri', async (req, res) => {
    try {
        console.log('📅 [IslamicCalendar] Current Hijri date request');
        const today = new Date();
        console.log('📅 [IslamicCalendar] Today:', today.toISOString());
        
        const hijri = await islamicCalendarService.convertToHijri(today);
        console.log('📅 [IslamicCalendar] Hijri result:', hijri);

        if (!hijri) {
            console.error('❌ [IslamicCalendar] convertToHijri returned null/undefined');
            return res.status(500).json({
                success: false,
                error: 'Failed to get current Hijri date'
            });
        }

        console.log('✅ [IslamicCalendar] Returning Hijri date');
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
        console.error('❌ [IslamicCalendar] Error getting current Hijri date:', error);
        logger.error('Error getting current Hijri date:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current Hijri date',
            details: error.message
        });
    }
});

// Get daily prayer times
router.get('/daily-prayer-times', async (req, res) => {
    try {
        console.log('🕌 [IslamicCalendar] Daily prayer times request:', req.query);
        
        const { date, lat, lon, tz, method, madhab } = req.query;

        if (!date || !lat || !lon) {
            return res.status(400).json({
                success: false,
                error: 'Date, latitude and longitude are required'
            });
        }

        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;

        const monthlyPrayerTimes = await getPrayerTimesForMonth({
            year,
            month,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            timezone: tz || 'UTC',
            method: method || 'auto',
            madhab: madhab || 'auto'
        });

        // Find the specific day's prayer times from the monthly result
        const daysArray = Array.isArray(monthlyPrayerTimes?.days)
          ? monthlyPrayerTimes.days
          : monthlyPrayerTimes; // backward compatibility if an array is returned

        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        const dayData = Array.isArray(daysArray)
          ? daysArray.find(d => d?.date === isoDate)
          : undefined;

        if (!dayData) {
            // Fallback: compute single day using monthly service's day calculator
            try {
                const { getPrayerTimesForDay } = require('../services/prayerTimeServiceMonthly');
                const singleDay = getPrayerTimesForDay({
                    date: targetDate,
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                    timezone: tz || 'UTC',
                    method: method || 'auto',
                    madhab: madhab || 'auto'
                });
                return res.json({
                    success: true,
                    data: {
                        date: isoDate,
                        times: {
                            fajr: singleDay.fajr,
                            dhuhr: singleDay.dhuhr,
                            asr: singleDay.asr,
                            maghrib: singleDay.maghrib,
                            isha: singleDay.isha,
                            shuruq: singleDay.shuruq,
                        }
                    },
                    message: 'Daily prayer times calculated successfully'
                });
            } catch (e) {
                return res.status(404).json({
                    success: false,
                    error: 'Prayer times not found for the specified date'
                });
            }
        }

        res.json({
            success: true,
            data: {
                date: dayData.date,
                times: dayData.times
            },
            message: 'Daily prayer times retrieved successfully'
        });

    } catch (error) {
        console.error('❌ [IslamicCalendar] Error getting daily prayer times:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get daily prayer times'
        });
    }
});

// NEW: Get monthly prayer times using non-invasive monthly service
router.get('/monthly-prayer-times/:year/:month', async (req, res) => {
    try {
        console.log('🕌 [IslamicCalendar] Monthly prayer times request:', req.params, req.query);
        
        const { year, month } = req.params;
        const { lat, lon, tz, method, madhab } = req.query;

        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        console.log('🕌 [IslamicCalendar] Parsed params:', { yearNum, monthNum, lat, lon, tz, method, madhab });

        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                success: false,
                error: 'Invalid year or month'
            });
        }

        if (!lat || !lon) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        if (!tz) {
            return res.status(400).json({
                success: false,
                error: 'Timezone (tz) is required'
            });
        }

        console.log('🕌 [IslamicCalendar] Calling getPrayerTimesForMonth...');
        
        const monthlyTimes = getPrayerTimesForMonth({
            year: yearNum,
            month: monthNum,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            timezone: tz,
            method: method || 'auto',
            madhab: madhab || 'auto'
        });

        console.log('✅ [IslamicCalendar] Successfully retrieved monthly prayer times, returning response');

        res.json({
            success: true,
            ...monthlyTimes,
            message: 'Monthly prayer times retrieved successfully'
        });

    } catch (error) {
        console.error('❌ [IslamicCalendar] Error getting monthly prayer times:', error);
        logger.error('Error getting monthly prayer times:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get monthly prayer times'
        });
    }
});

// NEW: Get yearly holidays for occasions modal (using Holiday Aggregator)
router.get('/yearly-holidays/:year', requireAuth, async (req, res) => {
    try {
        console.log('🕌 [IslamicCalendar] Yearly holidays request:', req.params, req.query);
        
        const { year } = req.params;
        const { country, includeIslamic, includeNational } = req.query;

        const yearNum = parseInt(year);
        
        console.log('🕌 [IslamicCalendar] Parsed params:', { yearNum, country, includeIslamic, includeNational });

        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2035) {
            return res.status(400).json({
                success: false,
                error: 'Invalid year. Must be between 2020-2035'
            });
        }

        if (!country) {
            return res.status(400).json({
                success: false,
                error: 'Country parameter is required'
            });
        }

        console.log('🕌 [IslamicCalendar] Calling holidayAggregator...');
        
        // Build include types array
        const includeTypes = [];
        if (includeIslamic !== 'false') {
            includeTypes.push('islamic', 'religious');
        }
        if (includeNational !== 'false') {
            includeTypes.push('national', 'public', 'observance');
        }

        // Fetch from holiday aggregator (with DB and API integration)
        const holidays = await holidayAggregator.getHolidaysForCountry(
            country,
            yearNum,
            includeTypes
        );

        // Transform to frontend format
        const formattedHolidays = holidays.map(h => ({
            id: h.uniqueId,
            name: h.name,
            nameAr: h.nameAr || h.nameLocal,
            date: h.date,
            type: h.type,
            duration: h.duration || 1,
            country: h.countryCode,
            isPublic: h.isPublicHoliday,
            description: h.description,
            hijriDate: h.hijriDate
        }));

        console.log('✅ [IslamicCalendar] Successfully retrieved yearly holidays, returning response');

        res.json({
            success: true,
            holidays: formattedHolidays,
            year: yearNum,
            country: country,
            count: formattedHolidays.length,
            message: 'Yearly holidays retrieved successfully'
        });

    } catch (error) {
        console.error('❌ [IslamicCalendar] Error getting yearly holidays:', error);
        logger.error('Error getting yearly holidays:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get yearly holidays',
            details: error.message
        });
    }
});

// Get list of supported countries
router.get('/countries', async (req, res) => {
    try {
        const countries = await holidayAggregator.getAllCountries();
        
        res.json({
            success: true,
            countries: countries,
            count: countries.length,
            message: 'Countries list retrieved successfully'
        });
    } catch (error) {
        logger.error('Error getting countries list:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get countries list',
            details: error.message
        });
    }
});

// Get holiday details by ID
router.get('/holiday/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const holiday = await Holiday.findOne({ uniqueId: id });
        
        if (!holiday) {
            return res.status(404).json({
                success: false,
                error: 'Holiday not found'
            });
        }

        // Update request count
        holiday.requestCount = (holiday.requestCount || 0) + 1;
        await holiday.save();

        res.json({
            success: true,
            holiday: holiday,
            message: 'Holiday details retrieved successfully'
        });
    } catch (error) {
        logger.error('Error getting holiday details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get holiday details',
            details: error.message
        });
    }
});

module.exports = router;

