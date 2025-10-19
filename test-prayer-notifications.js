#!/usr/bin/env node
/**
 * Test script for prayer notification system
 * This script tests the complete prayer notification flow
 */

const mongoose = require('mongoose');
const { getNotificationQueueService } = require('./services/inMemoryNotificationQueue');
const prayerNotificationScheduler = require('./tasks/prayerNotificationScheduler');
const User = require('./models/User');
const PushSubscription = require('./models/PushSubscription');
const { env } = require('./config');

async function testPrayerNotifications() {
  console.log('🧪 [Test] Starting prayer notification system test...');

  try {
    // Connect to database
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log('✅ [Test] Connected to database');

    // Get notification queue
    const notificationQueue = getNotificationQueueService();
    if (!notificationQueue) {
      throw new Error('Notification queue not available');
    }
    console.log('✅ [Test] Notification queue available');

    // Find the specific test user
    const user = await User.findOne({ email: 'ahmedothmanofff@gmail.com' }).lean();
    if (!user) {
      console.log('⚠️ [Test] User ahmedothmanofff@gmail.com not found in database');
      return;
    }

    console.log(`👤 [Test] Testing with user: ${user.email}`);

    // Update user location and timezone for accurate prayer times
    await User.findByIdAndUpdate(user._id, {
      location: {
        lat: 30.0444,
        lon: 31.2357,
        city: 'Cairo',
        country: 'Egypt'
      },
      timezone: 'Africa/Cairo',
      notificationPreferences: {
        enabled: true,
        prayerReminders: {
          fajr: true,
          dhuhr: true,
          asr: true,
          maghrib: true,
          isha: true
        },
        reminderMinutes: 10
      }
    });
    console.log('✅ [Test] Updated user location and preferences');

    // Check if user has push subscriptions
    let subscriptions = await PushSubscription.find({ userId: user._id }).lean();
    if (subscriptions.length === 0) {
      console.log('⚠️ [Test] User has no push subscriptions, creating a test subscription...');

      // Create a test push subscription
      const testSubscription = new PushSubscription({
        userId: user._id,
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
          }
        },
        preferences: {
          enabled: true,
          perPrayer: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
          reminderMinutes: 10
        },
        location: {
          lat: 30.0444,
          lon: 31.2357,
          city: 'Cairo'
        }
      });

      await testSubscription.save();
      subscriptions = [testSubscription];
      console.log('✅ [Test] Created test push subscription');
    }

    console.log(`📱 [Test] User has ${subscriptions.length} push subscription(s)`);

    // Initialize prayer notification scheduler
    await prayerNotificationScheduler.initialize();
    console.log('✅ [Test] Prayer notification scheduler initialized');

    // Wait a moment for scheduling to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check queue statistics
    const stats = notificationQueue.getStats();
    console.log('📊 [Test] Queue statistics:', stats);

    // Check for any jobs in the queue
    const waitingJobs = notificationQueue.getJobs('waiting');
    const delayedJobs = notificationQueue.getJobs('delayed');
    const activeJobs = notificationQueue.getJobs('active');

    console.log(`📋 [Test] Jobs in queue:`);
    console.log(`  - Waiting: ${waitingJobs.length}`);
    console.log(`  - Delayed: ${delayedJobs.length}`);
    console.log(`  - Active: ${activeJobs.length}`);

    if (delayedJobs.length > 0) {
      console.log('⏰ [Test] Delayed jobs:');
      delayedJobs.forEach(job => {
        const delayMs = job.options.delay || 0;
        const executeAt = new Date(Date.now() + delayMs);
        console.log(`  - ${job.id}: ${delayMs}ms delay (execute at ${executeAt.toISOString()})`);
      });
    }

    // Test sending an immediate notification
    console.log('📬 [Test] Testing immediate notification...');
    try {
      const testPayload = {
        title: 'Test Prayer Notification',
        body: 'This is a test notification for prayer times',
        icon: '/icons/icon-192x192.png',
        data: {
          url: '/prayer-time.html',
          prayer: 'test',
          timestamp: new Date().toISOString()
        }
      };

      await notificationQueue.addPushJob(
        {
          subscription: subscriptions[0],
          payload: testPayload
        },
        { removeOnComplete: true }
      );

      console.log('✅ [Test] Test notification queued successfully');
    } catch (error) {
      console.error('❌ [Test] Failed to queue test notification:', error);
    }

    // Wait for processing
    console.log('⏳ [Test] Waiting for notification processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check final statistics
    const finalStats = notificationQueue.getStats();
    console.log('📊 [Test] Final queue statistics:', finalStats);

    console.log('✅ [Test] Prayer notification system test completed');

  } catch (error) {
    console.error('❌ [Test] Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 [Test] Database connection closed');
  }
}

// Run the test
if (require.main === module) {
  testPrayerNotifications().catch(console.error);
}

module.exports = { testPrayerNotifications };
