// translator-backend/routes/userRoutes.js

const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/authMiddleware');
const { validate, z } = require('../middleware/validate');

// Prefer project logger if available; fall back to console
let logger = console;
try {
  ({ logger } = require('../services/logger'));
} catch { /* optional logger not present */ }

const router = express.Router();

// ---------- Validation Schemas (Zod) ----------

const locationBodySchema = z.object({
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  lat: z.coerce.number()
    .refine((v) => Number.isFinite(v) && v >= -90 && v <= 90, 'lat must be between -90 and 90'),
  lng: z.coerce.number()
    .refine((v) => Number.isFinite(v) && v >= -180 && v <= 180, 'lng must be between -180 and 180'),
});
const locationSchema = z.object({ body: locationBodySchema });

const perPrayerSchema = z.object({
  fajr: z.coerce.boolean().optional(),
  dhuhr: z.coerce.boolean().optional(),
  asr: z.coerce.boolean().optional(),
  maghrib: z.coerce.boolean().optional(),
  isha: z.coerce.boolean().optional(),
}).partial();

const preferencesBodySchema = z.object({
  calculationMethod: z.string().trim().min(1).optional(),
  madhab: z.string().trim().min(1).optional(),
  prayerReminders: perPrayerSchema.optional(),
}).superRefine((data, ctx) => {
  if (
    typeof data.calculationMethod === 'undefined' &&
    typeof data.madhab === 'undefined' &&
    typeof data.prayerReminders === 'undefined'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'Provide at least one field: calculationMethod, madhab, or prayerReminders',
    });
  }
});
const preferencesSchema = z.object({ body: preferencesBodySchema });

// ---------- Routes ----------

/**
 * PUT /api/user/location
 * Auth required. Normalizes to location.{lat,lon,city,country} and removes legacy coordinates.
 */
router.put('/location', requireAuth, validate(locationSchema), async (req, res) => {
  try {
    const { city, country, lat, lng } = req.body;

    await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'location.city': city || null,
          'location.country': country || null,
          'location.lat': Number(lat),
          'location.lon': Number(lng),
        },
        // Clean any legacy GeoJSON field
        $unset: { 'location.coordinates': '' },
      },
      { runValidators: true }
    );

    return res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    logger.error?.('Error updating user location:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/user/preferences
 * Returns the user's app preferences (calculationMethod, madhab, etc.).
 */
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('preferences')
      .lean();

    return res.json({ success: true, preferences: user?.preferences || {} });
  } catch (error) {
    logger.error?.('Error fetching preferences', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * PUT /api/user/preferences
 * Allows partial updates:
 *  - preferences.calculationMethod
 *  - preferences.madhab
 *  - notificationPreferences.prayerReminders (optional per-prayer toggles)
 */
router.put('/preferences', requireAuth, validate(preferencesSchema), async (req, res) => {
  try {
    const { calculationMethod, madhab, prayerReminders } = req.body;
    const $set = {};

    if (typeof calculationMethod !== 'undefined') {
      $set['preferences.calculationMethod'] = calculationMethod;
    }
    if (typeof madhab !== 'undefined') {
      $set['preferences.madhab'] = madhab;
    }
    if (prayerReminders && typeof prayerReminders === 'object') {
      $set['notificationPreferences.prayerReminders'] = {
        ...(prayerReminders.fajr !== undefined ? { fajr: !!prayerReminders.fajr } : {}),
        ...(prayerReminders.dhuhr !== undefined ? { dhuhr: !!prayerReminders.dhuhr } : {}),
        ...(prayerReminders.asr !== undefined ? { asr: !!prayerReminders.asr } : {}),
        ...(prayerReminders.maghrib !== undefined ? { maghrib: !!prayerReminders.maghrib } : {}),
        ...(prayerReminders.isha !== undefined ? { isha: !!prayerReminders.isha } : {}),
      };
    }

    await User.findByIdAndUpdate(req.user.id, { $set });
    return res.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    logger.error?.('Error updating preferences', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
