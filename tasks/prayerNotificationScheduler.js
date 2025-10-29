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
const NotificationHistory = require("../models/NotificationHistory");
const notificationService = require("../services/notificationService");
const prayerTimeService = require("../services/prayerTimeService");
const locationService = require("../services/locationService");
const subscriptionHealthService = require("../services/subscriptionHealthService");
const logger = require("../config/logger");
const eventEmitter = require("../services/eventEmitter");
const { emitNotificationStatus, emitScheduleUpdate } = require("../services/websocketService");

// Use in-memory notification queue
let notificationQueue = null;
try {
  // Use the in-memory notification queue service
  const { getNotificationQueueService } = require("../services/inMemoryNotificationQueue");
  notificationQueue = getNotificationQueueService();
  console.log("📬 [PrayerScheduler] Using in-memory notification queue");
} catch (error) {
  console.warn("⚠️ [PrayerScheduler] In-memory notification queue not available:", error.message);
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
      { action: "snooze", title: "⏰ Snooze 10 min" }
    ]
  },
  dhuhr: {
    title: "☀️ Dhuhr Prayer Time",
    icon: "/images/prayers/dhuhr-icon.svg",
    color: "#FFD700",
    emoji: "☀️",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 5 min" }
    ]
  },
  asr: {
    title: "🌤️ Asr Prayer Time",
    icon: "/images/prayers/asr-icon.svg",
    color: "#FF8C00",
    emoji: "🌤️",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 5 min" }
    ]
  },
  maghrib: {
    title: "🌅 Maghrib Prayer Time",
    icon: "/images/prayers/maghrib-icon.svg",
    color: "#FF4500",
    emoji: "🌅",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 5 min" }
    ]
  },
  isha: {
    title: "🌙 Isha Prayer Time",
    icon: "/images/prayers/isha-icon.svg",
    color: "#4B0082",
    emoji: "🌙",
    actions: [
      { action: "mark_prayed", title: "✅ Mark as Prayed" },
      { action: "snooze", title: "⏰ Snooze 15 min" }
    ]
  }
};

/** Validate an IANA timezone string, fall back to UTC if invalid. */
function sanitizeTz(tz) {
  try {

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
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  let hh = 0, mm = 0, ss = 0;
  for (const p of parts) {
    if (p.type === "hour") hh = parseInt(p.value, 10);
    if (p.type === "minute") mm = parseInt(p.value, 10);
    if (p.type === "second") ss = parseInt(p.value, 10);
  }
  // Include seconds for more accurate timing
  return hh * 60 + mm + (ss / 60);
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
  // This is the single source of truth for prayer time calculations.
  // Use user's preferred calculation method and madhab from their preferences.
  const args = {
    lat,
    lon,
    timezone: tz,
    date: new Date(),
    calculationMethod: user?.preferences?.calculationMethod || 'UmmAlQura', // Use user's preferred method, default to UmmAlQura for Dubai
    madhab: user?.preferences?.madhab || 'shafii', // Use user's preferred madhab, default to shafii
  };

  try {
    // Use the modern, correct service method directly.
    const prayerTimes = await prayerTimeService.getPrayerTimes(args);
    if (!prayerTimes) {
      throw new Error("getPrayerTimes returned null or undefined");
    }
    return prayerTimes;
  } catch (error) {
    logger?.error?.(`[PrayerScheduler] Failed to compute prayer times for user ${user._id}:`, error);
    return null; // Ensure failure is handled gracefully
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
  if (!notificationQueue || typeof notificationQueue.addPushJob !== "function") {
    console.log("⚠️ [PrayerScheduler] Notification queue not available or addPushJob method not found");
    return false;
  }

  try {
    const jobId = [
      "notif",
      String(user._id),
      String(sub._id),
      prayerName,
      kind,              // "main" or "reminder"
      dateKeyInTz(tz),
    ].join(":");

    const delayMinutes = delayMs / 1000 / 60;
    const delayHours = Math.floor(delayMinutes / 60);
    const remainingMinutes = Math.floor(delayMinutes % 60);
    const delayText = delayHours > 0 ? `${delayHours}h ${remainingMinutes}m` : `${delayMinutes.toFixed(1)}m`;

    console.log(`📬 [PrayerScheduler] Queuing notification: ${prayerName} for user ${user.email}, delay: ${delayText} (${delayMs}ms)`);

    await notificationQueue.addPushJob(
      {
        subscription: sub, // Use the subscription object directly
        payload,           // Keep as object for modern workers
      },
      {
        delay: Math.max(0, delayMs),
        jobId, // Use jobId for deduplication
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    console.log(`✅ [PrayerScheduler] Successfully queued notification: ${jobId}`);
    return true;
  } catch (err) {
    console.error(`❌ [PrayerScheduler] Queue add failed (user=${user.email}, sub=${sub._id}, ${prayerName}, kind=${kind}):`, err);
    logger?.error?.(`Queue add failed (user=${user.email}, sub=${sub._id}, ${prayerName}, kind=${kind})`, err);
    return false;
  }
}

/** Cancel all existing jobs for a specific user */
async function cancelUserJobs(userId) {
  const userJobs = registry.get(userId.toString());
  if (!userJobs) {
    console.log(`[PrayerScheduler] No existing jobs found for user ${userId}`);
    return;
  }

  let cancelledCount = 0;

  // Cancel all prayer jobs
  for (const [key, job] of userJobs.prayerJobs) {
    try {
      job.stop();
      cancelledCount++;
      console.log(`[PrayerScheduler] Cancelled job: ${key}`);
    } catch (error) {
      console.warn(`[PrayerScheduler] Error cancelling job ${key}:`, error.message);
    }
  }

  // Cancel daily job
  if (userJobs.dailyJob) {
    try {
      userJobs.dailyJob.stop();
      cancelledCount++;
      console.log(`[PrayerScheduler] Cancelled daily job`);
    } catch (error) {
      console.warn(`[PrayerScheduler] Error cancelling daily job:`, error.message);
    }
  }

  // Clear the registry entry
  registry.delete(userId.toString());
  console.log(`[PrayerScheduler] Cancelled ${cancelledCount} jobs for user ${userId}`);
}

/** Get current schedule status for a user */
async function getScheduleStatus(userId) {
  try {
    const user = await User.findById(userId)
      .select('notificationPreferences timezone location preferences')
      .lean();

    if (!user) {
      return null;
    }

    // Get scheduled prayer times for today
    const prayerTimes = await computePrayerTimes({
      lat: user.location?.lat || 0,
      lon: user.location?.lon || 0,
      tz: user.timezone || 'UTC',
      user
    });

    if (!prayerTimes) {
      return null;
    }

    // Calculate next prayer and reminder times
    const now = new Date();
    const reminderMinutes = user.notificationPreferences?.reminderMinutes || 0;

    const schedule = {
      timezone: user.timezone,
      reminderMinutes: reminderMinutes,
      prayerTimes: prayerTimes,
      nextPrayer: null,
      nextReminder: null,
      notificationsEnabled: user.notificationPreferences?.enabled || false
    };

    // Find next upcoming prayer
    for (const [prayer, time] of Object.entries(prayerTimes)) {
      if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(prayer)) {
        const prayerTime = new Date(time);
        if (prayerTime > now) {
          schedule.nextPrayer = { prayer, time: prayerTime };

          if (reminderMinutes > 0) {
            const reminderTime = new Date(prayerTime.getTime() - reminderMinutes * 60000);
            if (reminderTime > now) {
              schedule.nextReminder = { prayer, time: reminderTime };
            }
          }
          break;
        }
      }
    }

    return schedule;
  } catch (error) {
    console.error(`[PrayerScheduler] Error getting schedule status for user ${userId}:`, error);
    return null;
  }
}

/** Reschedule notifications for a user after preferences change */
async function rescheduleNotificationsForUser(userId) {
  console.log(`[PrayerScheduler] Rescheduling notifications for user ${userId}`);

  try {
    // Cancel existing jobs
    await cancelUserJobs(userId);

    // Reload user from database with fresh preferences
    const user = await User.findById(userId)
      .select('email location timezone notificationPreferences preferences')
      .lean();

    if (!user) {
      console.log(`[PrayerScheduler] User ${userId} not found`);
      return;
    }

    // Schedule notifications with new preferences
    await scheduleNotificationsForUser(user);

    // Recreate the daily job for this user
    const tz = sanitizeTz(user.timezone || "UTC");
    const entry = ensureUserEntry(user._id);

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

    console.log(`[PrayerScheduler] Successfully rescheduled notifications for user ${userId}`);

    // Emit schedule update via WebSocket
    try {
      const scheduleData = await getScheduleStatus(userId);
      emitScheduleUpdate(userId, scheduleData);
    } catch (scheduleError) {
      console.warn(`[PrayerScheduler] Failed to emit schedule update for user ${userId}:`, scheduleError);
    }
  } catch (error) {
    console.error(`[PrayerScheduler] Error rescheduling for user ${userId}:`, error);
  }
}

/** Schedule notifications for a single user for today's prayer times. */
async function scheduleNotificationsForUser(user) {
  try {
    // Before starting scheduling, ensure subscriptions are fresh
    const subscriptions = await PushSubscription.find({ 
      userId: user._id,
      isActive: true 
    })
    .sort({ updatedAt: -1 }) // Sort by most recent first for better Chrome support
    .lean();
    
    if (!subscriptions || subscriptions.length === 0) {
      logger?.info?.(`No push subscriptions for ${user.email}; skipping schedule.`);
      return;
    }

    console.log(`[PrayerScheduler] Found ${subscriptions.length} active subscription(s) for ${user.email}`);
    subscriptions.forEach(sub => {
      const pushType = sub.subscription?.endpoint?.includes('fcm') ? 'Chrome' : 
                       sub.subscription?.endpoint?.includes('mozilla') ? 'Firefox' : 'Other';
      console.log(`  - ${pushType}: Updated ${new Date(sub.updatedAt).toISOString()}`);
    });

    // Clear any existing jobs BEFORE getting new reminder minutes
    // This ensures old reminder times don't persist
    await cancelUserJobs(user._id);

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

    console.log(`🕐 [PrayerScheduler] Scheduling for ${user.email} in ${tz}:`);
    console.log(`🕐 [PrayerScheduler] Current time: ${nowMin} minutes (${Math.floor(nowMin/60)}:${String(Math.floor(nowMin%60)).padStart(2,'0')})`);
    console.log(`🕐 [PrayerScheduler] Reminder minutes: ${reminderMinutes}`);

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
      const formattedPrayerTime = formatHumanTime12(hm.h, hm.m);

      console.log(`🕐 [PrayerScheduler] ${prayerName}: ${formattedPrayerTime} (${totalMin} minutes from midnight)`);

      if (totalMin <= nowMin) {
        console.log(`⚠️ [PrayerScheduler] ${prayerName} has already passed today (${(nowMin - totalMin).toFixed(2)} minutes ago)`);
      } else {
        console.log(`⏰ [PrayerScheduler] ${prayerName} will be at ${formattedPrayerTime} in timezone ${tz}`);
      }

      // --- MAIN PRAYER NOTIFICATION ---
      if (totalMin > nowMin) {

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
          prayerName: prayerName, // Add at top level for notificationService
          notificationType: 'main', // NEW: Mark as main prayer notification
          data: {
            url: "/prayer-time.html",
            prayer: prayerName,
            time: formattedPrayerTime,
            location: city || 'Your location',
            category: "prayer-reminders",
            timestamp: new Date().toISOString(),
            userTimezone: user.timezone || 'UTC',
            audioFile: "/audio/adhan.mp3" // Add audio file for background playback (will be replaced if audio feature enabled)
          },
          actions: template.actions,
          category: "prayer-reminders",
          priority: getPrayerPriority(prayerName),
          vibrate: getVibrationPattern(prayerName),
          audioFile: "/audio/adhan.mp3" // Also add at top level for service worker
        };

        // Use CRON scheduling for exact timing (NO DELAYS!)
        const cronExpr = `${hm.m} ${hm.h} * * *`;
        console.log(`⏰ [PrayerScheduler] Scheduling ${prayerName} at ${formattedPrayerTime} (${cronExpr}) in timezone ${tz}`);

        const task = cron.schedule(
          cronExpr,
          async () => {
            const cronStartTime = Date.now();
            const cronStartTimeStr = new Date().toISOString();
            console.log(`🔔 [PrayerScheduler] ${prayerName} time! Cron fired at ${cronStartTimeStr}`);
            console.log(`🔔 [PrayerScheduler] Cron running in timezone ${tz} for user ${user.email}`);

            // RELOAD subscriptions fresh from DB to avoid 410 errors
            const freshSubs = await PushSubscription.find({ 
              userId: user._id,
              isActive: true 
            })
            .sort({ createdAt: -1 })
            .lean();
            console.log(`📬 [PrayerScheduler] Reloaded ${freshSubs.length} fresh subscription(s) from DB`);

            // Filter subscriptions that want this prayer
            const enabledSubs = freshSubs.filter(sub => {
              const subPrefs = sub?.preferences?.perPrayer;
              return isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs);
            });

            console.log(`📬 [PrayerScheduler] Sending to ${enabledSubs.length} subscription(s) in parallel`);

            // Send notifications to all subscriptions IN PARALLEL (10x faster!)
            const results = await Promise.allSettled(
              enabledSubs.map(async (sub) => {
                const sendStartTime = Date.now();
                try {
                  // DEBUG: Log payload structure before sending
                  console.log(`🔍 [PrayerScheduler] Pre-send payload check for ${prayerName}:`, {
                    notificationType: payload.notificationType,
                    prayerName: payload.prayerName,
                    hasAudioFile: !!payload.audioFile,
                    audioFileValue: payload.audioFile,
                    hasDataAudioFile: !!payload.data?.audioFile,
                    dataAudioFileValue: payload.data?.audioFile,
                    title: payload.title
                  });
                  
                  await notificationService.sendNotification(sub, payload);
                  const sendTime = Date.now() - sendStartTime;
                  console.log(`✅ [PrayerScheduler] ${prayerName} sent to ${user.email} (${sendTime}ms)`);

                  // Log successful notification
                  try {
                    await NotificationHistory.create({
                      userId: user._id,
                      prayerName: prayerName,
                      notificationType: 'main',
                      scheduledTime: new Date(),
                      sentTime: new Date(),
                      status: 'sent',
                      subscriptionId: sub._id,
                      timezone: tz,
                      reminderMinutes: null
                    });
                  } catch (historyError) {
                    console.error(`❌ [PrayerScheduler] Failed to log notification history:`, historyError);
                  }

                  // Emit notification status via WebSocket
                  emitNotificationStatus(user._id, {
                    prayerName,
                    notificationType: 'main',
                    status: 'sent',
                    sentTime: new Date(),
                    timezone: tz
                  });

                  return { success: true, time: sendTime };
                } catch (err) {
                  console.error(`❌ [PrayerScheduler] Failed to notify sub ${sub._id}:`, err);

                  // Log failed notification
                  try {
                    await NotificationHistory.create({
                      userId: user._id,
                      prayerName: prayerName,
                      notificationType: 'main',
                      scheduledTime: new Date(),
                      sentTime: new Date(),
                      status: 'failed',
                      subscriptionId: sub._id,
                      error: err.message,
                      timezone: tz,
                      reminderMinutes: null
                    });
                  } catch (historyError) {
                    console.error(`❌ [PrayerScheduler] Failed to log failed notification history:`, historyError);
                  }

                  // Emit failed notification status via WebSocket
                  emitNotificationStatus(user._id, {
                    prayerName,
                    notificationType: 'main',
                    status: 'failed',
                    sentTime: new Date(),
                    error: err.message,
                    timezone: tz
                  });

                  return { success: false, error: err.message };
                }
              })
            );

            const totalCronTime = Date.now() - cronStartTime;
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;

            console.log(`✅ [PrayerScheduler] ${prayerName} completed: ${successful} sent, ${failed} failed in ${totalCronTime}ms`);
          },
          {
            timezone: tz,
            scheduled: true
          }
        );

        // NEW: Log cron job creation details
        console.log(`✅ [PrayerScheduler] Main prayer cron job created for ${prayerName} at ${cronExpr} (timezone: ${tz})`);
        console.log(`✅ [PrayerScheduler] Cron task scheduled: ${task ? 'YES' : 'NO'}, running: ${task?.running ? 'YES' : 'NO'}`);

        entry.prayerJobs.set(prayerName, task);
        console.log(`📋 [PrayerScheduler] Stored ${prayerName} cron job in registry for user ${user.email}`);
        console.log(`✅ [PrayerScheduler] ${prayerName} scheduled for ${formattedPrayerTime} in ${tz}`);

        scheduled++;
      }

      // --- PRE-PRAYER REMINDER ---
      if (Number.isFinite(reminderMinutes) && reminderMinutes > 0) {
        const reminderTotalMin = totalMin - reminderMinutes;
        if (reminderTotalMin >= 0 && reminderTotalMin > nowMin) {
          const rH = Math.floor(reminderTotalMin / 60);
          const rM = reminderTotalMin % 60;
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
            prayerName: prayerName, // Add at top level for notificationService
            notificationType: 'reminder', // NEW: Mark as pre-prayer reminder
            data: {
              url: "/prayer-time.html",
              prayer: prayerName,
              time: formattedPrayerTime,
              location: city || 'Your location',
              category: "pre-prayer-reminders",
              isReminder: true,
              minutesBefore: reminderMinutes,
              timestamp: new Date().toISOString()
            },
            actions: [
              { action: "view_times", title: "🕐 View Prayer Times" }
            ],
            category: "pre-prayer-reminders",
            priority: "normal"
          };

          // Use CRON scheduling for exact reminder timing (NO DELAYS!)
          const reminderCronExpr = `${rM} ${rH} * * *`;
          console.log(`⏰ [PrayerScheduler] Scheduling ${prayerName} reminder at ${formatHumanTime12(rH, rM)} (${reminderCronExpr}) in timezone ${tz}`);

          const reminderTask = cron.schedule(
            reminderCronExpr,
            async () => {
              console.log(`🔔 [PrayerScheduler] ${prayerName} reminder time! Sending reminder notifications...`);

            // RELOAD subscriptions fresh from DB to avoid 410 errors
            const freshSubs = await PushSubscription.find({ 
              userId: user._id,
              isActive: true 
            })
            .sort({ createdAt: -1 })
            .lean();
            console.log(`📬 [PrayerScheduler] Reloaded ${freshSubs.length} fresh subscription(s) from DB for reminder`);
            
            // Log browser-specific subscription breakdown
            console.log(`[PrayerScheduler] Reminder subscriptions breakdown:`);
            freshSubs.forEach(sub => {
              const pushService = sub.subscription?.endpoint?.includes('fcm') ? 'FCM' : 
                                  sub.subscription?.endpoint?.includes('mozilla') ? 'Firefox' : 'Other';
              console.log(`  - ${pushService}: ${sub.subscription?.endpoint?.substring(0, 60)}... (Active: ${sub.isActive})`);
            });

              // Send reminder notifications to all user's subscriptions
              for (const sub of freshSubs) {
                const subPrefs = sub?.preferences?.perPrayer;
                if (!isPrayerEnabled(prayerName, userPrayerPrefs, subPrefs)) continue;

                try {
                  // Send reminder notification immediately
                  const pushType = sub.subscription?.endpoint?.includes('mozilla') ? 'FIREFOX' : 'CHROME';
                  await notificationService.sendNotification(sub, reminderPayload);
                  console.log(`✅ [PrayerScheduler] ${pushType} ${prayerName} reminder sent to ${user.email}`);

                  // Log successful reminder notification
                  try {
                    await NotificationHistory.create({
                      userId: user._id,
                      prayerName: prayerName,
                      notificationType: 'reminder',
                      scheduledTime: new Date(),
                      sentTime: new Date(),
                      status: 'sent',
                      subscriptionId: sub._id,
                      timezone: tz,
                      reminderMinutes: reminderMinutes
                    });
                  } catch (historyError) {
                    console.error(`❌ [PrayerScheduler] Failed to log reminder notification history:`, historyError);
                  }

                  // Emit reminder notification status via WebSocket
                  emitNotificationStatus(user._id, {
                    prayerName,
                    notificationType: 'reminder',
                    status: 'sent',
                    sentTime: new Date(),
                    timezone: tz,
                    reminderMinutes: reminderMinutes
                  });
                } catch (err) {
                  const pushType = sub.subscription?.endpoint?.includes('mozilla') ? 'FIREFOX' : 'CHROME';
                  console.error(`❌ [PrayerScheduler] ${pushType} reminder send failed for ${user.email}:`, err.message);
                  console.error(`❌ [PrayerScheduler] Failed to send reminder to sub ${sub._id}:`, err);

                  // Log failed reminder notification
                  try {
                    await NotificationHistory.create({
                      userId: user._id,
                      prayerName: prayerName,
                      notificationType: 'reminder',
                      scheduledTime: new Date(),
                      sentTime: new Date(),
                      status: 'failed',
                      subscriptionId: sub._id,
                      error: err.message,
                      timezone: tz,
                      reminderMinutes: reminderMinutes
                    });
                  } catch (historyError) {
                    console.error(`❌ [PrayerScheduler] Failed to log failed reminder notification history:`, historyError);
                  }

                  // Emit failed reminder notification status via WebSocket
                  emitNotificationStatus(user._id, {
                    prayerName,
                    notificationType: 'reminder',
                    status: 'failed',
                    sentTime: new Date(),
                    error: err.message,
                    timezone: tz,
                    reminderMinutes: reminderMinutes
                  });
                }
              }
            },
            {
              timezone: tz,
              scheduled: true
            }
          );

          entry.prayerJobs.set(`${prayerName}_reminder`, reminderTask);
          console.log(`✅ [PrayerScheduler] ${prayerName} reminder scheduled for ${formatHumanTime12(rH, rM)} in ${tz}`);

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

    // Set up event listener for dynamic updates
    eventEmitter.on('userPreferencesChanged', async (userId) => {
      try {
        console.log(`[PrayerScheduler] Received userPreferencesChanged event for user ${userId}`);
        await rescheduleNotificationsForUser(userId);
      } catch (error) {
        console.error(`[PrayerScheduler] Error handling userPreferencesChanged for user ${userId}:`, error);
      }
    });

    logger?.info?.("Prayer notification scheduler initialized with dynamic updates.");
  } catch (err) {
    logger?.error?.("Failed to initialize prayer scheduler:", err);
  }
}

/** Helpers */
function capitalize(s) {
  return typeof s === "string" && s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Get schedule status for a specific user (for debugging)
 * @param {string} userId - User ID to check
 * @returns {object} - Schedule status with cron job details
 */
function getUserScheduleStatus(userId) {
  const entry = registry.get(userId);
  if (!entry) {
    return { scheduled: false, message: "No cron jobs found for user" };
  }

  const jobs = {};
  for (const [prayer, task] of entry.prayerJobs.entries()) {
    jobs[prayer] = {
      exists: !!task,
      running: task?.running || false
    };
  }

  return {
    scheduled: true,
    prayerJobs: jobs,
    dailyJobExists: !!entry.dailyJob,
    dailyJobRunning: entry.dailyJob?.running || false
  };
}

module.exports = {
  initialize,
  getScheduleStatus,
  getUserScheduleStatus, // NEW: Debug function to check cron job status
  // Optionals for testing/diagnostics:
  _registry: registry,
  _scheduleNotificationsForUser: scheduleNotificationsForUser,
  _cancelUserJobs: cancelUserJobs,
  _rescheduleNotificationsForUser: rescheduleNotificationsForUser,
};

// Schedule daily subscription health check at 3 AM
cron.schedule('0 3 * * *', async () => {
  try {
    console.log('🔍 [PrayerScheduler] Starting daily subscription health check...');
    await subscriptionHealthService.checkAllSubscriptionsDaily();

    // Clean up expired subscriptions
    const removedCount = await subscriptionHealthService.cleanupExpiredSubscriptions();
    if (removedCount > 0) {
      console.log(`🧹 [PrayerScheduler] Cleaned up ${removedCount} expired subscriptions`);
    }

    // Get health stats
    const stats = await subscriptionHealthService.getHealthStats();
    if (stats) {
      console.log(`📊 [PrayerScheduler] Subscription health: ${stats.healthy}/${stats.total} healthy (${stats.healthPercentage}%)`);
    }
  } catch (error) {
    console.error('❌ [PrayerScheduler] Error during subscription health check:', error);
  }
});

console.log('✅ [PrayerScheduler] Daily subscription health check scheduled for 3:00 AM');
