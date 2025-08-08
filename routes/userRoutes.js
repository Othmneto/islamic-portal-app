// translator-backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');

// GET /api/user/preferences - Fetches user's notification settings
router.get('/preferences', authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('notificationPreferences');
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        res.json(user.notificationPreferences);
    } catch (error) {
        logger.error('Failed to get user preferences', { userId: req.user.id, error });
        next(error);
    }
});

// PUT /api/user/preferences - Updates user's notification settings
router.put('/preferences', authMiddleware, async (req, res, next) => {
    try {
        const { notificationPreferences } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { notificationPreferences } },
            { new: true, runValidators: true }
        ).select('notificationPreferences');

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        logger.info(`User ${req.user.id} updated their notification preferences.`);
        res.json(user.notificationPreferences);
    } catch (error) {
        logger.error('Failed to update user preferences', { userId: req.user.id, error });
        next(error);
    }
});

// PUT /api/user/location - Updates user's location
router.put('/location', authMiddleware, async (req, res, next) => {
    try {
        const { city, country, lat, lng } = req.body; // Accept 'lng' from frontend

        if (!city || !country || lat === undefined || lng === undefined) {
            return res.status(400).json({ msg: 'Missing required location fields: city, country, lat, lng.' });
        }

        const locationUpdate = {
            city,
            country,
            lat,
            lon: lng // Store as 'lon' to match the schema
        };

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { location: locationUpdate } },
            { new: true }
        ).select('location');

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        
        logger.info(`User ${req.user.id} updated their location to ${city}, ${country}.`);
        res.json({ success: true, location: user.location });
    } catch (error) {
        logger.error('Failed to update user location', { userId: req.user.id, error });
        next(error);
    }
});

module.exports = router;