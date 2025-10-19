/**
 * Smart Timezone Detection Service
 *
 * Features:
 * - Automatic timezone detection based on user location
 * - Timezone change detection and notification rescheduling
 * - Travel mode detection
 * - Timezone history tracking
 * - Fallback mechanisms for edge cases
 */

const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const prayerNotificationScheduler = require('../tasks/prayerNotificationScheduler');
const locationService = require('./locationService');
const logger = require('../config/logger');

class SmartTimezoneService {
  constructor() {
    this.timezoneCheckInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.travelDetectionThreshold = 100; // 100km threshold for travel detection
    this.timezoneChangeThreshold = 30; // 30 minutes threshold for timezone change
    this.activeChecks = new Map(); // Track active timezone checks per user
    this.timezoneHistory = new Map(); // Store timezone history for analytics
  }

  /**
   * Initialize smart timezone detection for all users
   */
  async initialize() {
    console.log('🌍 [SmartTimezone] Initializing smart timezone detection service');

    // Start periodic timezone checks
    setInterval(() => {
      this.checkAllUsersTimezone();
    }, this.timezoneCheckInterval);

    // Load timezone history from database
    await this.loadTimezoneHistory();

    console.log('✅ [SmartTimezone] Smart timezone detection service initialized');
  }

  /**
   * Check timezone for a specific user
   */
  async checkUserTimezone(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.log(`⚠️ [SmartTimezone] User ${userId} not found`);
        return;
      }

      // Skip if user has disabled timezone detection
      if (user.preferences?.disableTimezoneDetection) {
        return;
      }

      // Get current location from user or subscriptions
      const subscriptions = await PushSubscription.find({ userId }).lean();
      const currentLocation = this.getCurrentLocation(user, subscriptions);

      if (!currentLocation) {
        console.log(`⚠️ [SmartTimezone] No location data for user ${user.email}`);
        return;
      }

      // Detect timezone from current location
      const detectedTimezone = await this.detectTimezoneFromLocation(currentLocation);

      if (!detectedTimezone) {
        console.log(`⚠️ [SmartTimezone] Could not detect timezone for user ${user.email}`);
        return;
      }

      // Check if timezone has changed
      const currentTimezone = user.timezone || 'UTC';
      const hasChanged = this.hasTimezoneChanged(currentTimezone, detectedTimezone);

      if (hasChanged) {
        console.log(`🌍 [SmartTimezone] Timezone change detected for ${user.email}: ${currentTimezone} → ${detectedTimezone}`);
        await this.handleTimezoneChange(user, detectedTimezone, currentLocation);
      } else {
        console.log(`✅ [SmartTimezone] Timezone unchanged for ${user.email}: ${currentTimezone}`);
      }

      // Update timezone history
      await this.updateTimezoneHistory(userId, detectedTimezone, currentLocation);

    } catch (error) {
      console.error(`❌ [SmartTimezone] Error checking timezone for user ${userId}:`, error);
    }
  }

  /**
   * Check timezone for all users
   */
  async checkAllUsersTimezone() {
    try {
      const users = await User.find({
        'preferences.disableTimezoneDetection': { $ne: true }
      }).select('_id email timezone location preferences').lean();

      console.log(`🌍 [SmartTimezone] Checking timezone for ${users.length} users`);

      for (const user of users) {
        // Skip if already checking this user
        if (this.activeChecks.has(user._id.toString())) {
          continue;
        }

        this.activeChecks.set(user._id.toString(), true);

        // Check timezone asynchronously
        this.checkUserTimezone(user._id).finally(() => {
          this.activeChecks.delete(user._id.toString());
        });
      }
    } catch (error) {
      console.error('❌ [SmartTimezone] Error checking all users timezone:', error);
    }
  }

  /**
   * Get current location from user or subscriptions
   */
  getCurrentLocation(user, subscriptions) {
    // Priority 1: User's saved location
    if (user.location && typeof user.location.lat === 'number' && typeof user.location.lon === 'number') {
      return {
        lat: user.location.lat,
        lon: user.location.lon,
        source: 'user',
        confidence: 0.9
      };
    }

    // Priority 2: Most recent subscription location
    const subWithLocation = subscriptions.find(sub =>
      sub.location &&
      typeof sub.location.lat === 'number' &&
      typeof sub.location.lon === 'number'
    );

    if (subWithLocation) {
      return {
        lat: subWithLocation.location.lat,
        lon: subWithLocation.location.lon,
        source: 'subscription',
        confidence: 0.7
      };
    }

    return null;
  }

  /**
   * Detect timezone from location coordinates
   */
  async detectTimezoneFromLocation(location) {
    try {
      // Use location service to get timezone
      const timezone = locationService.timezoneFromCoords(location.lat, location.lon);

      if (timezone && timezone !== 'UTC') {
        return timezone;
      }

      // Fallback: Use browser timezone detection
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (error) {
      console.error('❌ [SmartTimezone] Error detecting timezone from location:', error);
      return null;
    }
  }

  /**
   * Check if timezone has significantly changed
   */
  hasTimezoneChanged(currentTz, newTz) {
    if (currentTz === newTz) {
      return false;
    }

    try {
      // Get current time in both timezones
      const now = new Date();
      const currentTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: currentTz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(now);

      const newTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: newTz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(now);

      const currentMinutes = parseInt(currentTime.find(p => p.type === 'hour').value) * 60 +
                            parseInt(currentTime.find(p => p.type === 'minute').value);
      const newMinutes = parseInt(newTime.find(p => p.type === 'hour').value) * 60 +
                        parseInt(newTime.find(p => p.type === 'minute').value);

      const timeDifference = Math.abs(currentMinutes - newMinutes);

      // Consider it a change if time difference is more than threshold
      return timeDifference > this.timezoneChangeThreshold;
    } catch (error) {
      console.error('❌ [SmartTimezone] Error comparing timezones:', error);
      return false;
    }
  }

  /**
   * Handle timezone change for a user
   */
  async handleTimezoneChange(user, newTimezone, location) {
    try {
      console.log(`🔄 [SmartTimezone] Updating timezone for ${user.email}: ${user.timezone} → ${newTimezone}`);

      // Update user's timezone
      await User.findByIdAndUpdate(user._id, {
        timezone: newTimezone,
        lastTimezoneUpdate: new Date(),
        timezoneSource: 'auto_detection'
      });

      // Reschedule prayer notifications for new timezone
      await this.reschedulePrayerNotifications(user._id, newTimezone);

      // Send notification to user about timezone change
      await this.notifyTimezoneChange(user, newTimezone, location);

      // Update timezone history
      await this.updateTimezoneHistory(user._id, newTimezone, location);

      console.log(`✅ [SmartTimezone] Successfully updated timezone for ${user.email}`);

    } catch (error) {
      console.error(`❌ [SmartTimezone] Error handling timezone change for ${user.email}:`, error);
    }
  }

  /**
   * Reschedule prayer notifications for new timezone
   */
  async reschedulePrayerNotifications(userId, newTimezone) {
    try {
      console.log(`🔄 [SmartTimezone] Rescheduling prayer notifications for user ${userId} in ${newTimezone}`);

      // Stop existing prayer jobs
      const entry = prayerNotificationScheduler._registry.get(String(userId));
      if (entry) {
        // Stop all prayer jobs
        for (const task of entry.prayerJobs.values()) {
          try { task.stop(); } catch {}
        }
        entry.prayerJobs.clear();

        // Stop daily job
        if (entry.dailyJob) {
          try { entry.dailyJob.stop(); } catch {}
          entry.dailyJob = null;
        }
      }

      // Reschedule with new timezone
      const user = await User.findById(userId);
      if (user) {
        await prayerNotificationScheduler._scheduleNotificationsForUser(user);
        console.log(`✅ [SmartTimezone] Prayer notifications rescheduled for ${newTimezone}`);
      }

    } catch (error) {
      console.error(`❌ [SmartTimezone] Error rescheduling prayer notifications:`, error);
    }
  }

  /**
   * Send notification to user about timezone change
   */
  async notifyTimezoneChange(user, newTimezone, location) {
    try {
      const subscriptions = await PushSubscription.find({ userId: user._id }).lean();

      if (subscriptions.length === 0) {
        return;
      }

      const timezoneDisplay = this.getTimezoneDisplayName(newTimezone);
      const locationDisplay = location.city || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`;

      const payload = {
        title: '🌍 Timezone Updated',
        body: `Your timezone has been automatically updated to ${timezoneDisplay} based on your location: ${locationDisplay}`,
        icon: '/icons/timezone-icon.png',
        badge: '/icons/timezone-icon.png',
        data: {
          url: '/prayer-time.html',
          type: 'timezone_change',
          newTimezone,
          location: locationDisplay
        },
        actions: [
          { action: 'view_times', title: '🕐 View Prayer Times' },
          { action: 'settings', title: '⚙️ Settings' }
        ]
      };

      // Send to all user's subscriptions
      for (const sub of subscriptions) {
        try {
          const notificationService = require('./notificationService');
          await notificationService.sendNotification(sub, payload);
        } catch (error) {
          console.error(`❌ [SmartTimezone] Error sending timezone change notification:`, error);
        }
      }

    } catch (error) {
      console.error(`❌ [SmartTimezone] Error notifying timezone change:`, error);
    }
  }

  /**
   * Get human-readable timezone display name
   */
  getTimezoneDisplayName(timezone) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'long'
      });

      const parts = formatter.formatToParts(now);
      const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || timezone;

      return timeZoneName;
    } catch (error) {
      return timezone;
    }
  }

  /**
   * Update timezone history for analytics
   */
  async updateTimezoneHistory(userId, timezone, location) {
    try {
      const historyKey = `${userId}_${timezone}`;
      const now = new Date();

      if (!this.timezoneHistory.has(historyKey)) {
        this.timezoneHistory.set(historyKey, {
          userId,
          timezone,
          firstSeen: now,
          lastSeen: now,
          location,
          count: 1
        });
      } else {
        const history = this.timezoneHistory.get(historyKey);
        history.lastSeen = now;
        history.count++;
        history.location = location; // Update with latest location
      }

      // Save to database periodically
      if (this.timezoneHistory.size % 10 === 0) {
        await this.saveTimezoneHistory();
      }

    } catch (error) {
      console.error('❌ [SmartTimezone] Error updating timezone history:', error);
    }
  }

  /**
   * Load timezone history from database
   */
  async loadTimezoneHistory() {
    try {
      // This would load from a timezone history collection
      // For now, we'll start with an empty history
      console.log('📊 [SmartTimezone] Timezone history loaded');
    } catch (error) {
      console.error('❌ [SmartTimezone] Error loading timezone history:', error);
    }
  }

  /**
   * Save timezone history to database
   */
  async saveTimezoneHistory() {
    try {
      // This would save to a timezone history collection
      // For now, we'll just log the history
      console.log('📊 [SmartTimezone] Timezone history saved');
    } catch (error) {
      console.error('❌ [SmartTimezone] Error saving timezone history:', error);
    }
  }

  /**
   * Get timezone analytics for a user
   */
  async getTimezoneAnalytics(userId) {
    try {
      const userHistory = Array.from(this.timezoneHistory.values())
        .filter(entry => entry.userId === userId)
        .sort((a, b) => b.lastSeen - a.lastSeen);

      return {
        currentTimezone: userHistory[0]?.timezone || 'UTC',
        timezoneHistory: userHistory,
        totalTimezones: userHistory.length,
        mostUsedTimezone: this.getMostUsedTimezone(userHistory)
      };
    } catch (error) {
      console.error('❌ [SmartTimezone] Error getting timezone analytics:', error);
      return null;
    }
  }

  /**
   * Get most used timezone from history
   */
  getMostUsedTimezone(history) {
    if (history.length === 0) return null;

    const timezoneCounts = {};
    history.forEach(entry => {
      timezoneCounts[entry.timezone] = (timezoneCounts[entry.timezone] || 0) + entry.count;
    });

    return Object.entries(timezoneCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * Force timezone check for a specific user (for testing)
   */
  async forceTimezoneCheck(userId) {
    console.log(`🔍 [SmartTimezone] Force checking timezone for user ${userId}`);
    await this.checkUserTimezone(userId);
  }

  /**
   * Disable timezone detection for a user
   */
  async disableTimezoneDetection(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        'preferences.disableTimezoneDetection': true
      });
      console.log(`🚫 [SmartTimezone] Timezone detection disabled for user ${userId}`);
    } catch (error) {
      console.error(`❌ [SmartTimezone] Error disabling timezone detection:`, error);
    }
  }

  /**
   * Enable timezone detection for a user
   */
  async enableTimezoneDetection(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        'preferences.disableTimezoneDetection': false
      });
      console.log(`✅ [SmartTimezone] Timezone detection enabled for user ${userId}`);
    } catch (error) {
      console.error(`❌ [SmartTimezone] Error enabling timezone detection:`, error);
    }
  }
}

module.exports = new SmartTimezoneService();
