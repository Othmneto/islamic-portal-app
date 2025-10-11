// routes/hijriCalendarRoutes.js - Hijri Calendar API Routes

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const hijriCalendarService = require('../services/hijriCalendarService');

// Get current Hijri date
router.get('/current', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting current Hijri date for user:', req.user.id);
        
        const hijriDate = await hijriCalendarService.getCurrentHijriDate();
        
        res.json({
            success: true,
            hijriDate: hijriDate,
            message: 'Current Hijri date retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting current Hijri date:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get current Hijri date' 
        });
    }
});

// Convert Gregorian to Hijri
router.post('/convert-to-hijri', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Converting Gregorian to Hijri for user:', req.user.id);
        
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ 
                success: false, 
                error: 'Date is required' 
            });
        }
        
        const gregorianDate = new Date(date);
        const hijriDate = await hijriCalendarService.convertToHijri(gregorianDate);
        
        res.json({
            success: true,
            gregorianDate: gregorianDate,
            hijriDate: hijriDate,
            message: 'Date converted successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error converting to Hijri:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to convert date' 
        });
    }
});

// Convert Hijri to Gregorian
router.post('/convert-to-gregorian', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Converting Hijri to Gregorian for user:', req.user.id);
        
        const { year, month, day } = req.body;
        if (!year || !month || !day) {
            return res.status(400).json({ 
                success: false, 
                error: 'Year, month, and day are required' 
            });
        }
        
        const gregorianDate = await hijriCalendarService.convertToGregorian(year, month, day);
        
        res.json({
            success: true,
            hijriDate: { year, month, day },
            gregorianDate: gregorianDate,
            message: 'Date converted successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error converting to Gregorian:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to convert date' 
        });
    }
});

// Get Hijri month calendar
router.get('/month/:year/:month', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting Hijri month for user:', req.user.id);
        
        const { year, month } = req.params;
        const hijriMonth = await hijriCalendarService.getHijriMonth(parseInt(year), parseInt(month));
        
        res.json({
            success: true,
            hijriMonth: hijriMonth,
            year: parseInt(year),
            month: parseInt(month),
            message: 'Hijri month retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting Hijri month:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get Hijri month' 
        });
    }
});

// Get Islamic holidays
router.get('/holidays', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting Islamic holidays for user:', req.user.id);
        
        const holidays = hijriCalendarService.getIslamicHolidays();
        
        res.json({
            success: true,
            holidays: holidays,
            message: 'Islamic holidays retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting Islamic holidays:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get Islamic holidays' 
        });
    }
});

// Get Islamic months
router.get('/months', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting Islamic months for user:', req.user.id);
        
        const months = hijriCalendarService.getIslamicMonths();
        
        res.json({
            success: true,
            months: months,
            message: 'Islamic months retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting Islamic months:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get Islamic months' 
        });
    }
});

// Get prayer times
router.get('/prayer-times', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting prayer times for user:', req.user.id);
        
        const { date, latitude, longitude } = req.query;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ 
                success: false, 
                error: 'Latitude and longitude are required' 
            });
        }
        
        const prayerDate = date ? new Date(date) : new Date();
        const prayerTimes = await hijriCalendarService.getPrayerTimes(
            prayerDate, 
            parseFloat(latitude), 
            parseFloat(longitude)
        );
        
        res.json({
            success: true,
            prayerTimes: prayerTimes,
            date: prayerDate,
            location: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            message: 'Prayer times retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting prayer times:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get prayer times' 
        });
    }
});

// Get Qibla direction
router.get('/qibla', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting Qibla direction for user:', req.user.id);
        
        const { latitude, longitude } = req.query;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ 
                success: false, 
                error: 'Latitude and longitude are required' 
            });
        }
        
        const qiblaDirection = await hijriCalendarService.getQiblaDirection(
            parseFloat(latitude), 
            parseFloat(longitude)
        );
        
        res.json({
            success: true,
            qiblaDirection: qiblaDirection,
            location: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            message: 'Qibla direction retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting Qibla direction:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get Qibla direction' 
        });
    }
});

// Get Ramadan information
router.get('/ramadan/:year', requireAuth, async (req, res) => {
    try {
        console.log('🌙 [Hijri API] Getting Ramadan info for user:', req.user.id);
        
        const { year } = req.params;
        const ramadanInfo = await hijriCalendarService.getRamadanInfo(parseInt(year));
        
        res.json({
            success: true,
            ramadanInfo: ramadanInfo,
            year: parseInt(year),
            message: 'Ramadan information retrieved successfully'
        });
        
    } catch (error) {
        console.error('❌ [Hijri API] Error getting Ramadan info:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get Ramadan information' 
        });
    }
});

module.exports = router;
