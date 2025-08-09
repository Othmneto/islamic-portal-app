// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { requireSession, requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const logger = require('../utils/logger');

// This uses requireAuth (Bearer token), but could use requireSession (cookie) too
router.put('/location', requireAuth, async (req, res) => {
  try {
    const { city, country, lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'location.city': city,
        'location.country': country,
        'location.coordinates': [lng, lat] // GeoJSON is [longitude, latitude]
      }
    });
    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    logger.error('Error updating user location:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/preferences - Update user's notification and app preferences
// This uses requireSession (cookie-based) as it's likely called from the web UI
router.put('/preferences', requireSession, async (req, res) => {
  try {
    const { prayerReminders, calculationMethod, madhab } = req.body;
    const updateData = { $set: {} };

    // Update prayer reminder toggles
    if (prayerReminders) {
      updateData.$set['notificationPreferences.prayerReminders'] = prayerReminders;
    }

    // Update calculation method and madhab
    if (calculationMethod) {
      updateData.$set['preferences.calculationMethod'] = calculationMethod;
    }
    if (madhab) {
      updateData.$set['preferences.madhab'] = madhab;
    }

    await User.findByIdAndUpdate(req.user.id, updateData);
    res.json({ success: true, message: 'Preferences updated.' });
  } catch (error) {
    logger.error('Error updating user preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences.' });
  }
});


module.exports = router;