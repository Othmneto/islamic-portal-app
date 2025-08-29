// translator-backend/tasks/prayerNotificationScheduler.js
"use strict";

/* ------------------------------------------------------------------
   Prayer Notification Scheduler
   - Schedules a push job per subscription/prayer/day (de-duplicated)
   - Reads per-prayer prefs from sub.preferences.perPrayer (correct)
   - Falls back to subscription.location when user.location is absent
------------------------------------------------------------------- */

const cron = require("node-cron");
const mongoose = require("mongoose");
const adhan = require("adhan");
const moment = require("moment-timezone");

const PushSubscription = require("../models/PushSubscription");
const { notificationQueue } = require("../queues/notificationQueue");
const logger = require("../utils/logger");
const { env } = require("../config");

/* ---------------------------------------------
   Helpers
----------------------------------------------*/

function resolveParams(
  method = "MuslimWorldLeague",
  madhab = "shafii",
  tz = "UTC"
) {
  let m = method;
  let md = madhab;

  if (!adhan.CalculationMethod[m]) {
    if (/Africa\/Cairo|Egypt/i.test(tz)) m = "Egyptian";
    else if (/Asia\/Dubai|Dubai/i.test(tz)) m = "Dubai";
    else if (/Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz)) m = "Karachi";
    else if (/America\/|Canada|USA|US|CA/i.test(tz)) m = "NorthAmerica";
    else m = "MuslimWorldLeague";
  }

  if (md === "auto" || (md !== "hanafi" && md !== "shafii")) {
    md = /Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz) ? "hanafi" : "shafii";
  }

  const params = adhan.CalculationMethod[m]?.() || adhan.CalculationMethod.MuslimWorldLeague();
  params.madhab = md === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

  return params;
}

function getPrayerTimesForLocation(
  lat,
  lon,
  tz = "UTC",
  method = "MuslimWorldLeague",
  madhab = "shafii"
) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid coordinates");
  }

  const userLocalDate = moment.tz(tz).toDate();

  const coordinates = new adhan.Coordinates(latitude, longitude);
  const params = resolveParams(method, madhab, tz);
  const pt = new adhan.PrayerTimes(coordinates, userLocalDate, params);

  return {
    fajr: pt.fajr,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

function buildJobId(sub, prayerName, prayerTime, tz) {
  const dayKey = moment(prayerTime).tz(tz).format("YYYY-MM-DD");
  return `push-${sub._id}-${prayerName}-${dayKey}`;
}

/* ---------------------------------------------
   Core scheduling
----------------------------------------------*/

const scheduleAllPrayerNotifications = async () => {
  logger.info("[Scheduler] Scanning push subscriptions...");

  try {
    const subscriptions = await PushSubscription.find({
      $and: [
        {
          $or: [
            { "subscription.endpoint": { $exists: true, $ne: null } },
            { "endpoint": { $exists: true, $ne: null } }
          ]
        },
        { "location.lat": { $exists: true, $ne: null } },
        { "location.lon": { $exists: true, $ne: null } },
        { "preferences.enabled": { $ne: false } },
      ]
    }).lean();

    if (!subscriptions.length) {
      logger.info("[Scheduler] No valid subscriptions found to schedule for.");
      return;
    }

    logger.info(`[Scheduler] Found ${subscriptions.length} subscriptions with valid data.`);

    let totalScheduled = 0;

    for (const sub of subscriptions) {
      const perPrayer = sub.preferences?.perPrayer || {};
      const tz = sub.tz || "UTC";

      const method = sub.preferences?.method || "MuslimWorldLeague";
      const madhab = sub.preferences?.madhab || "shafii";
      const loc = sub.location;

      let times;
      try {
        times = getPrayerTimesForLocation(
          loc.lat,
          loc.lon,
          tz,
          method,
          madhab
        );
      } catch (e) {
        logger.warn(`[Scheduler] Skip sub ${sub._id}: ${e.message}`);
        continue;
      }

      const wpSub = sub.subscription;

      for (const [prayerName, prayerTime] of Object.entries(times)) {
        if (!perPrayer[prayerName]) continue;

        const delay = new Date(prayerTime).getTime() - Date.now();
        if (delay <= 0) continue;

        const payload = {
          title: `🕌 ${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} Prayer Time`,
          body: `It's time for the ${prayerName} prayer.`,
          tag: `prayer-${prayerName}-${moment(prayerTime).tz(tz).format("YYYY-MM-DD")}`,
          requireInteraction: true,
          data: { url: "/prayer-time.html" },
          audioFile: "/audio/adhan.mp3",
        };

        const jobId = buildJobId(sub, prayerName, prayerTime, tz);

        await notificationQueue.add(
          "send-push",
          { subscription: wpSub, payload },
          {
            delay,
            jobId,
            removeOnComplete: true,
            removeOnFail: true,
          }
        );

        totalScheduled++;
      }
    }

    logger.info(`[Scheduler] Scheduled ${totalScheduled} prayer alert(s) across ${subscriptions.length} subscription(s).`);
  } catch (err) {
    logger.error("[Scheduler] Error while scheduling prayer notifications:", err);
  }
};

/* ---------------------------------------------
   Bootstrap (when running the scheduler process)
----------------------------------------------*/

const initializeScheduler = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
      logger.info("✅ Prayer Scheduler connected to MongoDB.");
    }

    cron.schedule("1 0 * * *", scheduleAllPrayerNotifications, { timezone: "UTC" });
    cron.schedule("0 */6 * * *", scheduleAllPrayerNotifications);

    logger.info("⏰ Prayer notification scheduler started.");

    setTimeout(scheduleAllPrayerNotifications, 15_000);
  } catch (err) {
    logger.error("❌ Failed to initialize prayer scheduler:", err);
    process.exit(1);
  }
};

if (require.main === module) {
  initializeScheduler();
}

module.exports = {
  initializeScheduler,
  scheduleAllPrayerNotifications,
  getPrayerTimesForLocation,
};