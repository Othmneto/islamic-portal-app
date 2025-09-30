// translator-backend/routes/userRoutes.js
"use strict";

const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { validate, z } = require("../middleware/validate");

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
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.calculationMethod === "undefined" &&
      typeof data.madhab === "undefined" &&
      typeof data.prayerReminders === "undefined"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: "Provide at least one field: calculationMethod, madhab, or prayerReminders",
      });
    }
  });
const preferencesSchema = z.object({ body: preferencesBodySchema });

// Notification preferences update
const notificationPreferencesBodySchema = z.object({
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
    const { city, country, lat, lng } = req.body;

    await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          "location.city": city || null,
          "location.country": country || null,
          "location.lat": Number(lat),
          "location.lon": Number(lng),
        },
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
 * Allows partial updates:
 *  - preferences.calculationMethod
 *  - preferences.madhab
 *  - notificationPreferences.prayerReminders (optional per-prayer toggles)
 */
router.put("/preferences", authMiddleware, validate(preferencesSchema), async (req, res) => {
  try {
    const { calculationMethod, madhab, prayerReminders } = req.body;
    const $set = {};

    if (typeof calculationMethod !== "undefined") {
      $set["preferences.calculationMethod"] = calculationMethod;
    }
    if (typeof madhab !== "undefined") {
      $set["preferences.madhab"] = madhab;
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

    await User.findByIdAndUpdate(req.user.id, { $set });
    return res.json({ success: true, message: "Preferences updated" });
  } catch (error) {
    logger.error?.("Error updating preferences", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * PUT /api/user/notification-preferences
 * Updates notification preferences including reminderMinutes
 */
router.put("/notification-preferences", authMiddleware, validate(notificationPreferencesSchema), async (req, res) => {
  try {
    const { reminderMinutes, prayerReminders, calculationMethod, madhab, timezone } = req.body;
    const $set = {};

    if (typeof reminderMinutes !== "undefined") {
      $set["notificationPreferences.reminderMinutes"] = reminderMinutes;
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

    await User.findByIdAndUpdate(req.user.id, { $set });
    return res.json({ success: true, message: "Notification preferences updated" });
  } catch (error) {
    logger.error?.("Error updating notification preferences", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

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

module.exports = router;