// translator-backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');

// GET /api/user/preferences (no changes)
router.get('/preferences', authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('notificationPreferences');
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        res.json(user.notificationPreferences);
    } catch (error) {
        next(error);
    }
});

// PUT /api/user/preferences (no changes)
router.put('/preferences', authMiddleware, async (req, res, next) => {
    try {
        const { notificationPreferences } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { notificationPreferences: notificationPreferences } },
            { new: true, runValidators: true }
        ).select('notificationPreferences');
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        logger.info(`User ${req.user.id} updated their notification preferences.`);
        res.json(user.notificationPreferences);
    } catch (error) {
        next(error);
    }
});

// --- UPDATED ROUTE: Update User Location ---
router.put('/location', authMiddleware, async (req, res, next) => {
    try {
        // Correctly destructure 'lng' from the request body
        const { city, country, lat, lng } = req.body;

        // Basic validation
        if (!city || !country || !lat || !lng) {
            return res.status(400).json({ msg: 'Missing required location fields.' });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            // Save it as 'lon' in the database to match your schema
            { $set: { location: { city, country, lat, lon: lng } } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        
        logger.info(`User ${req.user.id} updated their location to ${city}, ${country}.`);
        res.json({ success: true, location: user.location });
    } catch (error) {
        next(error);
    }
});

module.exports = router;