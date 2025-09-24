// translator-backend/tasks/prayerNotificationScheduler.js
"use strict";

/**
 * Timezone-Aware Prayer Notification Scheduler (+ Pre-Prayer Reminders, City, Optional Queue)
 * -------------------------------------------------------------------------------------------
 * - Per-user scheduling in their IANA timezone (User.timezone; fallback UTC)
 * - Location from user.location, else first subscription.location
 * - Honors user-level and subscription-level per-prayer toggles
 * - Reminder lead time from user.notificationPreferences.reminderMinutes (fallback to sub.preferences.reminderMinutes)
 * - NEW: Adds city name to notifications via locationService.getCityFromCoordinates(lat, lon)
 * - NEW: If queues/notificationQueue is available, schedule one-off delayed jobs with deterministic jobIds
 *        to avoid duplicates on restarts. Otherwise, fall back to cron-triggered push.
 * - Prevents duplicate cron jobs and refreshes cleanly at user's midnight.
 */

const cron = require("node-cron");
const User = require("../models/User");
const PushSubscription = require("../models/PushSubscription");
const notificationService = require("../services/notificationService");
const prayerTimeService = require("../services/prayerTimeService");
const locationService = require("../services/locationService"); // NEW
const logger = require("../config/logger");

// Optional queue; fall back gracefully if missing
let notificationQueue = null;
try {
  // Expected to be something like Bull / BullMQ queue instance
  notificationQueue = require("../queues/notificationQueue");
} catch (_) {
  notificationQueue = null;
}

// In-memory registry to prevent duplicate cron jobs during runtime
// userId -> { prayerJobs: Map<key, CronTask>, dailyJob: CronTask|null }
const registry = new Map();
const PRAYER_KEYS = new Set(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

// Enhanced notification templates
const PRAYER_TEMPLATES = {
  fajr: {
    title: "🌅 Fajr Prayer Time",
    icon: "/images/prayers/fajr-icon.svg",
    color: "#FF6B35",
    emoji: "🌅",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 10 min" },
      { action: "view_qibla", title: "🧭 View Qibla" }
    ]
  },
  dhuhr: {
    title: "☀️ Dhuhr Prayer Time", 
    icon: "/images/prayers/dhuhr-icon.svg",
    color: "#FFD700",
    emoji: "☀️",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 5 min" },
      { action: "view_times", title: "🕐 View All Times" }
    ]
  },
  asr: {
    title: "🌤️ Asr Prayer Time",
    icon: "/images/prayers/asr-icon.svg", 
    color: "#FF8C00",
    emoji: "🌤️",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 5 min" },
      { action: "view_times", title: "🕐 View All Times" }
    ]
  },
  maghrib: {
    title: "🌅 Maghrib Prayer Time",
    icon: "/images/prayers/maghrib-icon.svg",
    color: "#FF4500", 
    emoji: "🌅",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 5 min" },
      { action: "view_times", title: "🕐 View All Times" }
    ]
  },
  isha: {
    title: "🌙 Isha Prayer Time",
    icon: "/images/prayers/isha-icon.svg",
    color: "#4B0082",
    emoji: "🌙", 
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 15 min" },
      { action: "view_times", title: "🕐 View All Times" }
    ]
  }
};

/** Validate an IANA timezone string, fall back to UTC if invalid. */
function sanitizeTz(tz) {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC" });
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}

/** Get motivational message for prayer */
function getMotivationalMessage(prayerName) {
  const messages = {
    fajr: "🌅 Start your day with Allah's blessings",
    dhuhr: "☀️ Take a moment to connect with your Creator", 
    asr: "🌤️ Find peace in the afternoon prayer",
    maghrib: "🌅 End your day with gratitude and reflection",
    isha: "🌙 Close your day with peace and tranquility"
  };
  return messages[prayerName.toLowerCase()] || "";
}

/** Get prayer priority for notification */
function getPrayerPriority(prayerName) {
  const priorities = {
    fajr: "high",    // Most important - easy to miss
    isha: "high",    // Important - end of day
    maghrib: "normal", // Sunset prayer
    dhuhr: "normal", // Midday prayer
    asr: "normal"    // Afternoon prayer
  };
  return priorities[prayerName.toLowerCase()] || "normal";
}

/** Get vibration pattern for mobile */
function getVibrationPattern(prayerName) {
  const patterns = {
    fajr: [200, 100, 200, 100, 200], // Gentle wake-up pattern
    dhuhr: [300, 100, 300], // Standard pattern
    asr: [300, 100, 300], // Standard pattern
    maghrib: [200, 100, 200, 100, 200], // Gentle pattern
    isha: [400, 200, 400] // Stronger pattern for evening
  };
  return patterns[prayerName.toLowerCase()] || [300, 100, 300];
}

function ensureUserEntry(userId) {
  const key = String(userId);
  if (!registry.has(key)) {
    registry.set(key, { prayerJobs: new Map(), dailyJob: null });
  }
  return registry.get(key);
}

function stopPrayerJobs(userId) {
  const entry = registry.get(String(userId));
  if (!entry || !entry.prayerJobs) return;
  for (const task of entry.prayerJobs.values()) {
    try { task.stop(); } catch {}
  }
  entry.prayerJobs.clear();
}

/** Minute-of-day in the given tz for "now". */
function nowMinutesInTz(tz) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  let hh = 0, mm = 0;
  for (const p of parts) {
    if (p.type === "hour") hh = parseInt(p.value, 10);
    if (p.type === "minute") mm = parseInt(p.value, 10);
  }
  return hh * 60 + mm;
}

/** Extract {h, m} for the provided value, interpreted in tz if Date/ISO, or from "HH:mm". */
function extractHourMinute(value, tz) {
  // Date or timestamp
  if (value instanceof Date || (typeof value === "number" && Number.isFinite(value))) {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d)) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    let hh = null, mm = null;
    for (const p of parts) {
      if (p.type === "hour") hh = parseInt(p.value, 10);
      if (p.type === "minute") mm = parseInt(p.value, 10);
    }
    return Number.isFinite(hh) && Number.isFinite(mm) ? { h: hh, m: mm } : null;
  }
  // ISO
  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (isNaN(d)) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    let hh = null, mm = null;
    for (const p of parts) {
      if (p.type === "hour") hh = parseInt(p.value, 10);
      if (p.type === "minute") mm = parseInt(p.value, 10);
    }
    return Number.isFinite(hh) && Number.isFinite(mm) ? { h: hh, m: mm } : null;
  }
  // "HH:mm"
  if (typeof value === "string") {
    const [hh, mm] = value.split(":").map((s) => parseInt(s, 10));
    if (Number.isFinite(hh) && Number.isFinite(mm)) return { h: hh, m: mm };
  }
  return null;
}

/** Determine coordinates + timezone to use for calculations. */
function resolveGeoAndTz(user, subs) {
  const tz = sanitizeTz(user?.timezone || "UTC");
  if (user?.location && typeof user.location.lat === "number" && typeof user.location.lon === "number") {
    return { lat: user.location.lat, lon: user.location.lon, tz, source: "user" };
  }
  const subWithLoc = (subs || []).find(
    (s) => s?.location && typeof s.location.lat === "number" && typeof s.location.lon === "number"
  );
  if (subWithLoc) {
    logger?.warn?.(
      `Falling back to subscription location for ${user?.email || user?._id}: ${subWithLoc.location.lat}, ${subWithLoc.location.lon}`
    );
    return { lat: subWithLoc.location.lat, lon: subWithLoc.location.lon, tz, source: "subscription" };
  }
  return { lat: null, lon: null, tz, source: null };
}

/** Compute prayer times via prayerTimeService. Supports various signatures. */
async function computePrayerTimes({ lat, lon, tz, user }) {
  const argsObject = {
    lat,
    lon,
    timezone: tz,
    date: new Date(),
    // Use preferences from user.preferences object
    calculationMethod: user?.preferences?.calculationMethod || 'MuslimWorldLeague',
    madhab: user?.preferences?.madhab || 'shafii',
    preferences: {
      ...(user?.preferences || {}),
    },
  };
  try {
    const maybe = prayerTimeService.getPrayerTimes(argsObject);
    return (maybe && typeof maybe.then === "function") ? await maybe : maybe;
  } catch (e) {
    // Legacy fallback: getPrayerTimes(date, lat, lon, method, madhab)
    try {
      return prayerTimeService.getPrayerTimes(new Date(), lat, lon, user?.calculationMethod, user?.madhab);
    } catch (err) {
      logger?.error?.("prayerTimeService.getPrayerTimes failed with both signatures", err);
      return null;
    }
  }
}

/** Decide if a given prayer should be sent, honoring user prefs AND sub-prefs. */
function isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs) {
  if (userPrayerPrefs && userPrayerPrefs[prayerName] === false) return false;
  if (subPrefs && subPrefs[prayerName] === false) return false;
  return true;
}

/** Resolve reminder minutes preference (user-level overrides; fallback to first subscription). */
function resolveReminderMinutes(user, subscriptions) {
  const userVal = user?.notificationPreferences?.reminderMinutes;
  if (Number.isFinite(userVal) && userVal >= 0) return userVal;
  const sub = (subscriptions || []).find((s) =>
    Number.isFinite(s?.preferences?.reminderMinutes) && s.preferences.reminderMinutes >= 0
  );
  if (sub) return sub.preferences.reminderMinutes;
  return 0;
}

/** "YYYYMMDD" for today's date in tz (used for deterministic jobIds). */
function dateKeyInTz(tz) {
  const dt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // e.g., "2025-09-17"
  return dt.replaceAll("-", ""); // "20250917"
}

/** "h:mm AM/PM" from hour/min in tz (h is already tz-hour). */
function formatHumanTime12(h, m) {
  const mm = String(m).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${mm} ${ampm}`;
}

/** Queue job helper (if queue exists), otherwise returns false. */
async function tryQueueNotification({ user, sub, prayerName, payload, delayMs, kind, tz }) {
  if (!notificationQueue || typeof notificationQueue.add !== "function") return false;
  try {
    const jobId = [
      "notif",
      String(user._id),
      String(sub._id),
      prayerName,
      kind,              // "main" or "reminder"
      dateKeyInTz(tz),
    ].join(":");

    await notificationQueue.add(
      {
        type: "push",
        userId: String(user._id),
        subscription: sub.subscription || sub, // raw web-push subscription object preferred
        payload,                                // keep as object for modern workers
        payloadJson: JSON.stringify(payload),   // also provide JSON for workers expecting a string
      },
      {
        delay: Math.max(0, delayMs),
        jobId, // many queue libs (e.g., Bull) dedupe by jobId
        // removeOnComplete / removeOnFail can be set in the queue impl
      }
    );
    return true;
  } catch (err) {
    logger?.error?.(`Queue add failed (user=${user.email}, sub=${sub._id}, ${prayerName}, kind=${kind})`, err);
    return false;
  }
}

/** Schedule notifications for a single user for today's prayer times. */
async function scheduleNotificationsForUser(user) {
  try {
    const subscriptions = await PushSubscription.find({ userId: user._id }).lean();
    if (!subscriptions || subscriptions.length === 0) {
      logger?.info?.(`No push subscriptions for ${user.email}; skipping schedule.`);
      return;
    }

    const { lat, lon, tz, source } = resolveGeoAndTz(user, subscriptions);
    if (typeof lat !== "number" || typeof lon !== "number") {
      logger?.warn?.(`Skipping notifications for ${user.email}: no valid location (user/sub).`);
      return;
    }

    // Compute prayer times (values may be Date, ISO string, or "HH:mm")
    const prayerTimesRaw = await computePrayerTimes({ lat, lon, tz, user });
    if (!prayerTimesRaw || typeof prayerTimesRaw !== "object") {
      logger?.warn?.(`No prayer times computed for ${user.email} (${tz}).`);
      return;
    }

    // Normalize to only the 5 daily prayers, case-insensitive keys supported
    const prayerTimes = {};
    for (const [k, v] of Object.entries(prayerTimesRaw)) {
      const key = String(k).toLowerCase();
      if (PRAYER_KEYS.has(key)) prayerTimes[key] = v;
    }
    if (!Object.keys(prayerTimes).length) {
      logger?.warn?.(`Prayer times object missing expected keys for ${user.email}.`);
      return;
    }

    const userPrayerPrefs = user?.notificationPreferences?.prayerReminders || {};
    const reminderMinutes = resolveReminderMinutes(user, subscriptions);
    const nowMin = nowMinutesInTz(tz);

    // City lookup (best-effort)
    let city = null;
    try {
      city = await locationService.getCityFromCoordinates(lat, lon);
    } catch (_) {
      city = null;
    }

    // Clear any existing cron tasks before rescheduling
    const entry = ensureUserEntry(user._id);
    stopPrayerJobs(user._id);

    let scheduled = 0;
    let scheduledReminders = 0;

    for (const [prayerName, prayerValue] of Object.entries(prayerTimes)) {
      // At least one subscription wants this prayer?
      const subsWantThisPrayer = subscriptions.some((sub) => {
        const subPrefs = sub?.preferences?.perPrayer;
        return isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs);
      });
      if (!subsWantThisPrayer) continue;

      const hm = extractHourMinute(prayerValue, tz);
      if (!hm) {
        logger?.warn?.(`Skipping invalid time for ${user.email} -> ${prayerName}: ${String(prayerValue)}`);
        continue;
      }

      const totalMin = hm.h * 60 + hm.m;

      // --- MAIN PRAYER NOTIFICATION ---
      if (totalMin > nowMin) {
        const delayMs = (totalMin - nowMin) * 60 * 1000;
        const formattedPrayerTime = formatHumanTime12(hm.h, hm.m);
        
        // Generate enhanced notification payload
        const template = PRAYER_TEMPLATES[prayerName.toLowerCase()] || PRAYER_TEMPLATES.fajr;
        const motivationalMessage = getMotivationalMessage(prayerName);
        
        const payload = {
          title: template.title,
          body: `It's time for ${capitalize(prayerName)} prayer\n${motivationalMessage}\n📍 ${city || 'Your location'}\n🕐 ${formattedPrayerTime}`,
          icon: template.icon,
          badge: template.icon,
          color: template.color,
          tag: `${prayerName}-${new Date().toDateString()}`,
          requireInteraction: true,
          data: {
            url: "/prayer-time.html",
            prayer: prayerName,
            time: formattedPrayerTime,
            location: city || 'Your location',
            category: "prayer-reminders",
            timestamp: new Date().toISOString(),
            userTimezone: user.timezone || 'UTC',
            audioFile: "/audio/adhan.mp3" // Add audio file for background playback
          },
          actions: template.actions,
          category: "prayer-reminders",
          priority: getPrayerPriority(prayerName),
          vibrate: getVibrationPattern(prayerName),
          audioFile: "/audio/adhan.mp3" // Also add at top level for service worker
        };

        // Prefer queue scheduling if available, otherwise cron at exact hour/min
        let queuedAny = false;
        if (notificationQueue) {
          for (const sub of subscriptions) {
            const subPrefs = sub?.preferences?.perPrayer;
            if (!isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs)) continue;
            const ok = await tryQueueNotification({
              user,
              sub,
              prayerName,
              payload,
              delayMs,
              kind: "main",
              tz,
            });
            queuedAny = queuedAny || ok;
          }
        }

        if (!queuedAny) {
          const cronExpr = `${hm.m} ${hm.h} * * *`;
          const task = cron.schedule(
            cronExpr,
            () => {
              subscriptions.forEach((sub) => {
                const subPrefs = sub?.preferences?.perPrayer;
                if (!isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs)) return;
                try {
                  notificationService.sendNotification(sub, payload);
                } catch (err) {
                  logger?.error?.(`Failed to notify sub ${sub._id} for ${user.email}`, err);
                }
              });
            },
            { timezone: tz }
          );
          entry.prayerJobs.set(prayerName, task);
        }

        scheduled++;
      }

      // --- PRE-PRAYER REMINDER ---
      if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
        const reminderTotalMin = totalMin - reminderMinutes;
        if (reminderTotalMin >= 0 && reminderTotalMin > nowMin) {
          const rH = Math.floor(reminderTotalMin / 60);
          const rM = reminderTotalMin % 60;
          const delayMs = (reminderTotalMin - nowMin) * 60 * 1000;
          const formattedPrayerTime = formatHumanTime12(hm.h, hm.m);

          // Generate enhanced reminder notification
          const template = PRAYER_TEMPLATES[prayerName.toLowerCase()] || PRAYER_TEMPLATES.fajr;
          
          const reminderPayload = {
            title: `⏰ ${reminderMinutes} min until ${template.title}`,
            body: `Prepare for ${capitalize(prayerName)} prayer\n📍 ${city || 'Your location'}\n🕐 ${formattedPrayerTime}`,
            icon: template.icon,
            badge: template.icon,
            color: template.color,
            tag: `reminder-${prayerName}-${reminderMinutes}min`,
            requireInteraction: false,
            data: {
              url: "/prayer-time.html",
              prayer: prayerName,
              time: formattedPrayerTime,
              location: city || 'Your location',
              category: "pre-prayer-reminders",
              isReminder: true,
              minutesBefore: reminderMinutes,
              timestamp: new Date().toISOString(),
              audioFile: "/audio/adhan.mp3" // Add audio file for background playback
            },
            actions: [
              { action: "view_times", title: "🕐 View Prayer Times" },
              { action: "prepare", title: "🧘 Prepare for Prayer" }
            ],
            category: "pre-prayer-reminders",
            priority: "normal",
            audioFile: "/audio/adhan.mp3" // Also add at top level for service worker
          };

          let queuedAny = false;
          if (notificationQueue) {
            for (const sub of subscriptions) {
              const subPrefs = sub?.preferences?.perPrayer;
              if (!isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs)) continue;
              const ok = await tryQueueNotification({
                user,
                sub,
                prayerName,
                payload: reminderPayload,
                delayMs,
                kind: "reminder",
                tz,
              });
              queuedAny = queuedAny || ok;
            }
          }

          if (!queuedAny) {
            const reminderCronExpr = `${rM} ${rH} * * *`;
            const reminderTask = cron.schedule(
              reminderCronExpr,
              () => {
                subscriptions.forEach((sub) => {
                  const subPrefs = sub?.preferences?.perPrayer;
                  if (!isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs)) return;
                  try {
                    notificationService.sendNotification(sub, reminderPayload);
                  } catch (err) {
                    logger?.error?.(`Failed to send reminder to sub ${sub._id} for ${user.email}`, err);
                  }
                });
              },
              { timezone: tz }
            );
            entry.prayerJobs.set(`${prayerName}_reminder`, reminderTask);
          }

          scheduledReminders++;
        }
      }
    }

    logger?.info?.(
      `Scheduled ${scheduled} prayer notifications` +
      (reminderMinutes > 0 ? ` and ${scheduledReminders} reminders (−${reminderMinutes}m)` : "") +
      ` for ${user.email} in ${tz} (location source: ${source || "n/a"}; queue=${!!notificationQueue}).`
    );
  } catch (error) {
    logger?.error?.(`Error scheduling notifications for user ${user?.email}:`, error);
  }
}

/** Initialize per-user scheduling and a daily midnight refresh per user. */
async function initializeDailyScheduling() {
  const users = await User.find({}).lean();
  let count = 0;

  for (const user of users) {
    const tz = sanitizeTz(user.timezone || "UTC");
    const entry = ensureUserEntry(user._id);

    // Schedule today's notifications immediately on startup
    await scheduleNotificationsForUser(user);
    count++;

    // Create/replace the user's midnight refresh job
    if (entry.dailyJob) {
      try { entry.dailyJob.stop(); } catch {}
      entry.dailyJob = null;
    }

    entry.dailyJob = cron.schedule(
      "0 0 * * *",
      async () => {
        try {
          const fresh = await User.findById(user._id).lean();
          if (!fresh) return;
          await scheduleNotificationsForUser(fresh);
        } catch (err) {
          logger?.error?.(`Midnight refresh failed for ${user.email}`, err);
        }
      },
      { timezone: tz }
    );
  }

  logger?.info?.(`Daily per-user scheduling initialized for ${count} users.`);
}

/** Public initializer called by server.js */
async function initialize() {
  try {
    await initializeDailyScheduling();
    logger?.info?.("Prayer notification scheduler initialized.");
  } catch (err) {
    logger?.error?.("Failed to initialize prayer scheduler:", err);
  }
}

/** Helpers */
function capitalize(s) {
  return typeof s === "string" && s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

module.exports = {
  initialize,
  // Optionals for testing/diagnostics:
  _registry: registry,
  _scheduleNotificationsForUser: scheduleNotificationsForUser,
};
