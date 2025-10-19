#!/usr/bin/env node
/**
 * Debug script to understand prayer timing issues
 */

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const prayerTimeService = require('./services/prayerTimeService');
const { env } = require('./config');

async function debugPrayerTiming() {
  console.log('🔍 [Debug] Starting prayer timing analysis...');

  try {
    // Connect to database
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log('✅ [Debug] Connected to database');

    // Test coordinates (Cairo)
    const lat = 30.0444;
    const lon = 31.2357;
    const timezone = 'Africa/Cairo';

    console.log(`\n📍 [Debug] Testing with coordinates: ${lat}, ${lon}`);
    console.log(`🌍 [Debug] Timezone: ${timezone}`);

    // Get current time in different formats
    const now = new Date();
    const nowInTz = moment.tz(now, timezone);
    const nowInUTC = moment.utc(now);

    console.log(`\n⏰ [Debug] Current time analysis:`);
    console.log(`  - UTC: ${nowInUTC.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`  - ${timezone}: ${nowInTz.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`  - Minutes from midnight (${timezone}): ${nowInTz.hour() * 60 + nowInTz.minute() + nowInTz.second() / 60}`);

    // Calculate prayer times
    console.log(`\n🕌 [Debug] Calculating prayer times...`);
    const prayerTimes = prayerTimeService.getPrayerTimes({
      lat,
      lon,
      timezone,
      date: now,
      calculationMethod: 'MuslimWorldLeague',
      madhab: 'shafii'
    });

    console.log(`\n📅 [Debug] Prayer times for today (${nowInTz.format('YYYY-MM-DD')}):`);

    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const currentMinutes = nowInTz.hour() * 60 + nowInTz.minute() + nowInTz.second() / 60;

    for (const prayer of prayers) {
      const prayerTime = prayerTimes[prayer];
      if (prayerTime) {
        const prayerMoment = moment.tz(prayerTime, timezone);
        const prayerMinutes = prayerMoment.hour() * 60 + prayerMoment.minute();
        const timeUntil = prayerMinutes - currentMinutes;
        const delayMs = timeUntil * 60 * 1000;

        console.log(`  - ${prayer.toUpperCase()}: ${prayerMoment.format('HH:mm:ss')} (${prayerMinutes} min from midnight)`);
        console.log(`    Time until: ${timeUntil.toFixed(2)} minutes (${(delayMs / 1000 / 60).toFixed(2)} minutes in ms)`);
        console.log(`    Delay: ${delayMs}ms`);

        if (timeUntil < 0) {
          console.log(`    ⚠️  This prayer has already passed today`);
        } else if (timeUntil < 60) {
          console.log(`    ⏰  This prayer is coming up soon!`);
        }
      }
    }

    // Test tomorrow's prayer times
    console.log(`\n📅 [Debug] Prayer times for tomorrow (${nowInTz.clone().add(1, 'day').format('YYYY-MM-DD')}):`);
    const tomorrowPrayerTimes = prayerTimeService.getPrayerTimes({
      lat,
      lon,
      timezone,
      date: nowInTz.clone().add(1, 'day').toDate(),
      calculationMethod: 'MuslimWorldLeague',
      madhab: 'shafii'
    });

    for (const prayer of prayers) {
      const prayerTime = tomorrowPrayerTimes[prayer];
      if (prayerTime) {
        const prayerMoment = moment.tz(prayerTime, timezone);
        const prayerMinutes = prayerMoment.hour() * 60 + prayerMoment.minute();
        const timeUntil = (24 * 60) + prayerMinutes - currentMinutes; // Add 24 hours for tomorrow
        const delayMs = timeUntil * 60 * 1000;

        console.log(`  - ${prayer.toUpperCase()}: ${prayerMoment.format('HH:mm:ss')} (${prayerMinutes} min from midnight)`);
        console.log(`    Time until: ${timeUntil.toFixed(2)} minutes (${(delayMs / 1000 / 60).toFixed(2)} minutes in ms)`);
        console.log(`    Delay: ${delayMs}ms`);
      }
    }

    console.log(`\n✅ [Debug] Prayer timing analysis completed`);

  } catch (error) {
    console.error('❌ [Debug] Analysis failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 [Debug] Database connection closed');
  }
}

// Run the debug
if (require.main === module) {
  debugPrayerTiming().catch(console.error);
}

module.exports = { debugPrayerTiming };
