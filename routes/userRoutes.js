// translator-backend/routes/userRoutes.js
"use strict";

const express = require("express");
const User = require("../models/User");
const { attachUser: authMiddleware } = require("../middleware/authMiddleware");
const { validate, z } = require("../middleware/validate");
const moment = require("moment-timezone");

// Prefer project logger if available; fall back to console
let logger = console;
try {
  ({ logger } = require("../services/logger"));
} catch {
  /* optional logger not present */
}

const router = express.Router();

/* -------------------------------------------------------
 * Validation Schemas (Zod)
 * -----------------------------------------------------*/

// For PUT /location (kept from existing code – note 'lng' in body maps to 'lon' in DB)
const locationBodySchema = z.object({
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  lat: z
    .coerce.number()
    .refine((v) => Number.isFinite(v) && v >= -90 && v <= 90, "lat must be between -90 and 90"),
  lng: z
    .coerce.number()
    .refine((v) => Number.isFinite(v) && v >= -180 && v <= 180, "lng must be between -180 and 180"),
  timezone: z.string().trim().optional().refine((tz) => {
    if (!tz) return true; // Optional field
    return moment.tz.zone(tz) !== null;
  }, "Invalid timezone"),
});
const locationSchema = z.object({ body: locationBodySchema });

// Preferences update
const perPrayerSchema = z
  .object({
    fajr: z.coerce.boolean().optional(),
    dhuhr: z.coerce.boolean().optional(),
    asr: z.coerce.boolean().optional(),
    maghrib: z.coerce.boolean().optional(),
    isha: z.coerce.boolean().optional(),
  })
  .partial();

const preferencesBodySchema = z
  .object({
    calculationMethod: z.string().trim().min(1).optional(),
    madhab: z.string().trim().min(1).optional(),
    prayerReminders: perPrayerSchema.optional(),
    reminderMinutes: z.coerce.number().min(0).max(60).optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    language: z.string().trim().min(2).max(10).optional(),
    is24Hour: z.coerce.boolean().optional(),
    audioEnabled: z.coerce.boolean().optional(),
    selectedAdhanSrc: z.string().trim().optional(),
    adhanVolume: z.coerce.number().min(0).max(1).optional(),
  })
  .superRefine((data, ctx) => {
    const hasAnyField = Object.keys(data).some(key => data[key] !== undefined);
    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: "Provide at least one field to update",
      });
    }
  });
const preferencesSchema = z.object({ body: preferencesBodySchema });

// Notification preferences update
const notificationPreferencesBodySchema = z.object({
  enabled: z.coerce.boolean().optional(),
  reminderMinutes: z.coerce.number().min(0).max(60).optional(),
  prayerReminders: perPrayerSchema.optional(),
  calculationMethod: z.string().trim().min(1).optional(),
  madhab: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
});
const notificationPreferencesSchema = z.object({ body: notificationPreferencesBodySchema });

// Saved locations
const savedLocationBodySchema = z.object({
  label: z.string().trim().min(1, "label is required"),
  address: z.string().trim().optional(),
  lat: z
    .coerce.number()
    .refine((v) => Number.isFinite(v) && v >= -90 && v <= 90, "lat must be between -90 and 90"),
  lon: z
    .coerce.number()
    .refine((v) => Number.isFinite(v) && v >= -180 && v <= 180, "lon must be between -180 and 180"),
  tz: z.string().trim().min(1, "tz (IANA timezone) is required"),
});
const savedLocationSchema = z.object({ body: savedLocationBodySchema });

const savedLocationParamSchema = z.object({
  params: z.object({
    label: z.string().trim().min(1, "label param is required"),
  }),
});

/* -------------------------------------------------------
 * Routes
 * -----------------------------------------------------*/

/**
 * GET /api/user/profile
 * Returns minimal profile info for the authenticated user.
 */
// Profile route moved to profileRoutes.js for comprehensive profile management

/**
 * PUT /api/user/location
 * Auth required. Normalizes to location.{lat,lon,city,country} and removes legacy coordinates.
 */
router.put("/location", authMiddleware, validate(locationSchema), async (req, res) => {
  try {
    const { city, country, lat, lng, timezone } = req.body;

    const updateData = {
      "location.city": city || null,
      "location.country": country || null,
      "location.lat": Number(lat),
      "location.lon": Number(lng),
    };

    // Add timezone if provided
    if (timezone) {
      updateData.timezone = timezone;
    }

    await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: updateData,
        // Clean any old GeoJSON field if present
        $unset: { "location.coordinates": "" },
      },
      { runValidators: true }
    );

    return res.json({ success: true, message: "Location updated" });
  } catch (error) {
    logger.error?.("Error updating user location:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/user/preferences
 * Returns the user's app preferences (calculationMethod, madhab, etc.).
 */
router.get("/preferences", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("preferences").lean();
    return res.json({ success: true, preferences: user?.preferences || {} });
  } catch (error) {
    logger.error?.("Error fetching preferences", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * PUT /api/user/preferences
 * Allows partial updates for all user preferences:
 *  - preferences.calculationMethod, preferences.madhab
 *  - preferences.theme, preferences.language, preferences.is24Hour
 *  - preferences.audioEnabled, preferences.selectedAdhanSrc, preferences.adhanVolume
 *  - notificationPreferences.prayerReminders (optional per-prayer toggles)
 */
router.put("/preferences", authMiddleware, validate(preferencesSchema), async (req, res) => {
  try {
    const {
      calculationMethod,
      madhab,
      prayerReminders,
      reminderMinutes,
      theme,
      language,
      is24Hour,
      audioEnabled,
      selectedAdhanSrc,
      adhanVolume
    } = req.body;
    const $set = {};

    // Prayer calculation preferences
    if (typeof calculationMethod !== "undefined") {
      $set["preferences.calculationMethod"] = calculationMethod;
    }
    if (typeof madhab !== "undefined") {
      $set["preferences.madhab"] = madhab;
    }

    // Notification preferences
    if (typeof reminderMinutes !== "undefined") {
      $set["notificationPreferences.reminderMinutes"] = reminderMinutes;
      
      // Force immediate re-schedule by emitting event
      console.log(`[UserRoutes] Reminder time changed to ${reminderMinutes} minutes for user ${req.user.id}`);
    }

    // UI preferences
    if (typeof theme !== "undefined") {
      $set["preferences.theme"] = theme;
    }
    if (typeof language !== "undefined") {
      $set["preferences.language"] = language;
    }
    if (typeof is24Hour !== "undefined") {
      $set["preferences.is24Hour"] = !!is24Hour;
    }

    // Audio preferences
    if (typeof audioEnabled !== "undefined") {
      $set["preferences.audioEnabled"] = !!audioEnabled;
    }
    if (typeof selectedAdhanSrc !== "undefined") {
      $set["preferences.selectedAdhanSrc"] = selectedAdhanSrc;
    }
    if (typeof adhanVolume !== "undefined") {
      $set["preferences.adhanVolume"] = Math.max(0, Math.min(1, Number(adhanVolume)));
    }

    // Prayer reminder preferences
    if (prayerReminders && typeof prayerReminders === "object") {
      $set["notificationPreferences.prayerReminders"] = {
        ...(prayerReminders.fajr !== undefined ? { fajr: !!prayerReminders.fajr } : {}),
        ...(prayerReminders.dhuhr !== undefined ? { dhuhr: !!prayerReminders.dhuhr } : {}),
        ...(prayerReminders.asr !== undefined ? { asr: !!prayerReminders.asr } : {}),
        ...(prayerReminders.maghrib !== undefined ? { maghrib: !!prayerReminders.maghrib } : {}),
        ...(prayerReminders.isha !== undefined ? { isha: !!prayerReminders.isha } : {}),
      };
    }

    await User.findByIdAndUpdate(req.user.id, { $set });

    // Emit event for dynamic scheduler updates
    const eventEmitter = require('../services/eventEmitter');
    eventEmitter.emit('userPreferencesChanged', req.user.id);
    console.log(`[UserRoutes] Emitted userPreferencesChanged event for user ${req.user.id}`);

    return res.json({ success: true, message: "Preferences updated" });
  } catch (error) {
    logger.error?.("Error updating preferences", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * GET /api/user/notification-preferences
 * Returns the user's notification preferences
 */
router.get("/notification-preferences", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("notificationPreferences preferences timezone").lean();
    return res.json({
      success: true,
      preferences: {
        enabled: user?.notificationPreferences?.enabled || false,
        reminderMinutes: user?.notificationPreferences?.reminderMinutes || 0,
        prayerReminders: user?.notificationPreferences?.prayerReminders || {
          fajr: true,
          dhuhr: true,
          asr: true,
          maghrib: true,
          isha: true
        },
        calculationMethod: user?.preferences?.calculationMethod || "auto",
        madhab: user?.preferences?.madhab || "auto",
        timezone: user?.timezone || "UTC"
      }
    });
  } catch (error) {
    logger.error?.("Error fetching notification preferences", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * PUT/POST /api/user/notification-preferences
 * Updates notification preferences including reminderMinutes
 */
const notificationPreferencesHandler = async (req, res) => {
  try {
    const { 
      enabled, reminderMinutes, prayerReminders, calculationMethod, madhab, timezone,
      // NEW: Audio preferences (optional, validated but stored for future use)
      audioProfileMain, audioProfileReminder, audioSettings, audioOverrides
    } = req.body;
    const $set = {};

    if (typeof enabled !== "undefined") {
      $set["notificationPreferences.enabled"] = !!enabled;
    }
    if (typeof reminderMinutes !== "undefined") {
      $set["notificationPreferences.reminderMinutes"] = reminderMinutes;
      
      // Force immediate re-schedule by emitting event
      console.log(`[UserRoutes] Reminder time changed to ${reminderMinutes} minutes for user ${req.user.id}`);
    }
    if (prayerReminders && typeof prayerReminders === "object") {
      $set["notificationPreferences.prayerReminders"] = {
        ...(prayerReminders.fajr !== undefined ? { fajr: !!prayerReminders.fajr } : {}),
        ...(prayerReminders.dhuhr !== undefined ? { dhuhr: !!prayerReminders.dhuhr } : {}),
        ...(prayerReminders.asr !== undefined ? { asr: !!prayerReminders.asr } : {}),
        ...(prayerReminders.maghrib !== undefined ? { maghrib: !!prayerReminders.maghrib } : {}),
        ...(prayerReminders.isha !== undefined ? { isha: !!prayerReminders.isha } : {}),
      };
    }
    if (typeof calculationMethod !== "undefined") {
      $set["preferences.calculationMethod"] = calculationMethod;
    }
    if (typeof madhab !== "undefined") {
      $set["preferences.madhab"] = madhab;
    }
    if (typeof timezone !== "undefined") {
      $set["timezone"] = timezone;
    }

    // NEW: Accept and validate audio preferences (stored but not yet actively used)
    // Safe to add - if validation fails, we silently skip without breaking existing flow
    try {
      const { validateAudioProfile, validateAudioSettings } = require('../utils/audioVoices');
      const { env } = require('../config');

      if (audioProfileMain && typeof audioProfileMain === 'object') {
        const validName = validateAudioProfile(audioProfileMain.name);
        if (validName) {
          $set["preferences.audioProfileMain.name"] = validName;
          if (audioProfileMain.file) {
            $set["preferences.audioProfileMain.file"] = audioProfileMain.file;
          }
        }
      }

      if (audioProfileReminder && typeof audioProfileReminder === 'object') {
        const validName = validateAudioProfile(audioProfileReminder.name);
        if (validName) {
          $set["preferences.audioProfileReminder.name"] = validName;
          if (audioProfileReminder.file) {
            $set["preferences.audioProfileReminder.file"] = audioProfileReminder.file;
          }
        }
      }

      if (audioSettings && typeof audioSettings === 'object') {
        const validated = validateAudioSettings(audioSettings, {
          maxVolume: env.AUDIO_MAX_VOLUME,
          maxFadeMs: env.AUDIO_MAX_FADE_MS,
          maxCooldown: env.AUDIO_COOLDOWN_SECONDS
        });
        $set["preferences.audioSettings"] = validated;
      }

      if (audioOverrides && typeof audioOverrides === 'object') {
        $set["preferences.audioOverrides"] = audioOverrides;
      }
    } catch (audioError) {
      // Silently skip audio prefs if validation fails - don't break existing functionality
      logger.warn?.("Audio preferences validation skipped:", audioError.message);
    }

    console.log(`[UserRoutes] Updating notification-preferences for user ${req.user.id}:`, Object.keys($set));
    await User.findByIdAndUpdate(req.user.id, { $set });
    console.log(`[UserRoutes] Updated notification-preferences for user ${req.user.id}`);

    // Emit event for dynamic scheduler updates
    const eventEmitter = require('../services/eventEmitter');
    eventEmitter.emit('userPreferencesChanged', req.user.id);
    console.log(`[UserRoutes] Emitted userPreferencesChanged event for user ${req.user.id}`);

    return res.json({ success: true, message: "Notification preferences updated" });
  } catch (error) {
    logger.error?.("Error updating notification preferences", error);
    console.error('[UserRoutes] Error body:', error?.message);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Register both PUT and POST methods for notification-preferences
router.put("/notification-preferences", authMiddleware, validate(notificationPreferencesSchema), notificationPreferencesHandler);
router.post("/notification-preferences", authMiddleware, validate(notificationPreferencesSchema), notificationPreferencesHandler);

/* -------------------------------------------------------
 * NEW: Saved Locations API
 *  - GET /api/user/locations
 *  - POST /api/user/locations
 *  - DELETE /api/user/locations/:label
 * -----------------------------------------------------*/

/**
 * GET /api/user/locations
 * Retrieves the list of saved locations for the current user.
 */
router.get("/locations", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("savedLocations").lean();
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.status(200).json(user.savedLocations || []);
  } catch (error) {
    logger.error?.("Failed to retrieve saved locations:", error);
    return res.status(500).json({ error: "Failed to retrieve saved locations." });
  }
});

/**
 * POST /api/user/locations
 * Adds a new saved location.
 * Body: { label, address?, lat, lon, tz }
 */
router.post("/locations", authMiddleware, validate(savedLocationSchema), async (req, res) => {
  try {
    const { label, address, lat, lon, tz } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const exists = (user.savedLocations || []).some(
      (loc) => String(loc.label).toLowerCase() === String(label).toLowerCase()
    );
    if (exists) {
      return res.status(409).json({ error: `A location with the label "${label}" already exists.` });
    }

    user.savedLocations.push({ label, address, lat, lon, tz });
    await user.save();

    return res.status(201).json(user.savedLocations);
  } catch (error) {
    logger.error?.("Failed to save the new location:", error);
    return res.status(500).json({ error: "Failed to save the new location." });
  }
});

/**
 * DELETE /api/user/locations/:label
 * Deletes a saved location by label (case-insensitive).
 */
router.delete(
  "/locations/:label",
  authMiddleware,
  validate(savedLocationParamSchema),
  async (req, res) => {
    try {
      const labelToDelete = req.params.label;

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found." });

      const initial = user.savedLocations.length;
      user.savedLocations = user.savedLocations.filter(
        (loc) => String(loc.label).toLowerCase() !== String(labelToDelete).toLowerCase()
      );

      if (user.savedLocations.length === initial) {
        return res.status(404).json({ error: `Location with label "${labelToDelete}" not found.` });
      }

      await user.save();
      return res.status(200).json(user.savedLocations);
    } catch (error) {
      logger.error?.("Failed to delete the location:", error);
      return res.status(500).json({ error: "Failed to delete the location." });
    }
  }
);

/**
 * Clear Microsoft OAuth tokens
 * POST /api/user/clear-microsoft-tokens
 */
router.post("/clear-microsoft-tokens", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Clear Microsoft OAuth tokens
    user.microsoftAccessToken = undefined;
    user.microsoftRefreshToken = undefined;
    user.microsoftTokenExpiry = undefined;
    user.microsoftId = undefined;
    user.lastMicrosoftSync = undefined;

    await user.save();

    logger.info(`Microsoft OAuth tokens cleared for user: ${user.email}`);

    res.json({
      success: true,
      message: "Microsoft OAuth tokens cleared successfully"
    });

  } catch (error) {
    logger.error("Error clearing Microsoft tokens:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear Microsoft tokens"
    });
  }
});

/**
 * Clear Google OAuth tokens
 * POST /api/user/clear-google-tokens
 */
router.post("/clear-google-tokens", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Clear Google OAuth tokens
    user.googleAccessToken = undefined;
    user.googleRefreshToken = undefined;
    user.googleTokenExpiry = undefined;
    user.googleId = undefined;
    user.lastGoogleSync = undefined;

    await user.save();

    logger.info(`Google OAuth tokens cleared for user: ${user.email}`);

    res.json({
      success: true,
      message: "Google OAuth tokens cleared successfully"
    });

  } catch (error) {
    logger.error("Error clearing Google tokens:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear Google tokens"
    });
  }
});

// Occasion preferences schema
const occasionPreferencesSchema = z.object({
  selectedOccasions: z.array(z.string()).default([]),
  autoUpdate: z.boolean().default(false),
  country: z.string().min(2).max(2).default('AE'),
  includeIslamic: z.boolean().default(true),
  includeNational: z.boolean().default(true)
});

/**
 * Save user occasion preferences
 * POST /api/user/occasion-preferences
 */
router.post("/occasion-preferences", authMiddleware, validate(z.object({
  body: occasionPreferencesSchema
})), async (req, res) => {
  try {
    const { selectedOccasions, autoUpdate, country, includeIslamic, includeNational } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Update occasion preferences
    user.preferences.occasionPreferences = {
      autoUpdate,
      selectedOccasions,
      country,
      includeIslamic,
      includeNational,
      lastUpdated: new Date()
    };

    await user.save();

    logger.info(`Occasion preferences saved for user: ${user.email}`);

    res.json({
      success: true,
      message: "Occasion preferences saved successfully",
      preferences: user.preferences.occasionPreferences
    });

  } catch (error) {
    logger.error("Error saving occasion preferences:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save occasion preferences"
    });
  }
});

/**
 * Load user occasion preferences
 * GET /api/user/occasion-preferences
 */
router.get("/occasion-preferences", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const preferences = user.preferences.occasionPreferences || {
      autoUpdate: false,
      selectedOccasions: [],
      country: 'AE',
      includeIslamic: true,
      includeNational: true,
      lastUpdated: null
    };

    res.json({
      success: true,
      preferences: preferences
    });

  } catch (error) {
    logger.error("Error loading occasion preferences:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load occasion preferences"
    });
  }
});

module.exports = router;