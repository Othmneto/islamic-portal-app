/* ------------------------------------------------------------------
   Client-Side Prayer Notifications for Anonymous Users
   - Works without authentication
   - Uses browser location and localStorage
   - Schedules notifications client-side
   - Integrates with existing notification system
------------------------------------------------------------------- */

export class ClientPrayerNotifications {
  constructor(core, api) {
    console.log("[ClientPrayerNotifications] Initializing client-side prayer notifications");
    this.core = core;
    this.api = api;
    this.notificationTimers = new Map();
    this.isEnabled = false;
    this.location = null;
    this.prayerTimes = null;
    this.reminderMinutes = 5; // Default reminder time
    
    this.init();
  }

  async init() {
    try {
      // Load settings from localStorage
      this.loadSettings();
      
      // Get user location
      await this.getLocation();
      
      // Start prayer time monitoring
      this.startPrayerTimeMonitoring();
      
      console.log("[ClientPrayerNotifications] Client-side notifications initialized");
    } catch (error) {
      console.error("[ClientPrayerNotifications] Failed to initialize:", error);
    }
  }

  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('prayerNotificationSettings') || '{}');
      this.isEnabled = settings.enabled || false;
      this.reminderMinutes = settings.reminderMinutes || 5;
      console.log("[ClientPrayerNotifications] Settings loaded:", { enabled: this.isEnabled, reminderMinutes: this.reminderMinutes });
    } catch (error) {
      console.warn("[ClientPrayerNotifications] Failed to load settings:", error);
    }
  }

  saveSettings() {
    try {
      const settings = {
        enabled: this.isEnabled,
        reminderMinutes: this.reminderMinutes
      };
      localStorage.setItem('prayerNotificationSettings', JSON.stringify(settings));
      console.log("[ClientPrayerNotifications] Settings saved:", settings);
    } catch (error) {
      console.warn("[ClientPrayerNotifications] Failed to save settings:", error);
    }
  }

  async getLocation() {
    try {
      // Try to get location from core state first
      if (this.core.state.location) {
        this.location = this.core.state.location;
        console.log("[ClientPrayerNotifications] Using core location:", this.location);
        return;
      }

      // Fallback to geolocation API
      if (navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          });
        });
        
        this.location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        console.log("[ClientPrayerNotifications] Location obtained:", this.location);
      } else {
        console.warn("[ClientPrayerNotifications] Geolocation not supported");
      }
    } catch (error) {
      console.warn("[ClientPrayerNotifications] Failed to get location:", error);
    }
  }

  startPrayerTimeMonitoring() {
    // Monitor prayer times changes
    this.core.on('prayerTimesUpdated', (prayerTimes) => {
      this.prayerTimes = prayerTimes;
      this.scheduleNotifications();
    });

    // Check every minute for prayer times
    setInterval(() => {
      if (this.isEnabled && this.location && this.prayerTimes) {
        this.checkPrayerTimes();
      }
    }, 60000); // Check every minute

    console.log("[ClientPrayerNotifications] Prayer time monitoring started");
  }

  scheduleNotifications() {
    if (!this.isEnabled || !this.prayerTimes || !this.location) {
      console.log("[ClientPrayerNotifications] Cannot schedule notifications - missing data");
      return;
    }

    // Clear existing timers
    this.clearAllTimers();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Schedule notifications for each prayer
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    prayers.forEach(prayer => {
      const prayerTime = this.prayerTimes[prayer];
      if (!prayerTime) return;

      // Parse prayer time
      const [hours, minutes] = prayerTime.split(':').map(Number);
      const prayerDate = new Date(today);
      prayerDate.setHours(hours, minutes, 0, 0);

      // Schedule main prayer notification
      this.scheduleNotification(prayer, prayerDate, false);

      // Schedule reminder notification
      if (this.reminderMinutes > 0) {
        const reminderDate = new Date(prayerDate.getTime() - (this.reminderMinutes * 60000));
        if (reminderDate > now) {
          this.scheduleNotification(prayer, reminderDate, true);
        }
      }
    });

    console.log("[ClientPrayerNotifications] Notifications scheduled for all prayers");
  }

  scheduleNotification(prayer, date, isReminder) {
    const now = new Date();
    const delay = date.getTime() - now.getTime();

    if (delay <= 0) {
      console.log(`[ClientPrayerNotifications] Skipping ${prayer} notification - time has passed`);
      return;
    }

    const timerId = setTimeout(() => {
      this.sendNotification(prayer, isReminder);
    }, delay);

    const key = `${prayer}_${isReminder ? 'reminder' : 'main'}`;
    this.notificationTimers.set(key, timerId);

    console.log(`[ClientPrayerNotifications] Scheduled ${prayer} ${isReminder ? 'reminder' : 'notification'} for ${date.toLocaleString()}`);
  }

  sendNotification(prayer, isReminder) {
    const prayerNames = {
      fajr: 'Fajr',
      dhuhr: 'Dhuhr', 
      asr: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha'
    };

    const prayerEmojis = {
      fajr: '🌅',
      dhuhr: '☀️',
      asr: '🌤️',
      maghrib: '🌅',
      isha: '🌙'
    };

    const title = isReminder 
      ? `${prayerEmojis[prayer]} ${prayerNames[prayer]} in ${this.reminderMinutes} minutes`
      : `${prayerEmojis[prayer]} ${prayerNames[prayer]} Prayer Time`;
    
    const body = isReminder
      ? `Get ready for ${prayerNames[prayer]} prayer`
      : `It's time for ${prayerNames[prayer]} prayer`;

    // Send browser notification
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/images/prayers/favicon.ico',
        badge: '/images/prayers/favicon.ico',
        tag: `prayer_${prayer}_${isReminder ? 'reminder' : 'main'}`,
        requireInteraction: true,
        actions: [
          { action: 'mark_prayed', title: '✅ Mark as Prayed' },
          { action: 'snooze', title: '⏰ Snooze 5 min' }
        ]
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log(`[ClientPrayerNotifications] Sent ${prayer} ${isReminder ? 'reminder' : 'notification'}`);
    }

    // Also trigger audio if available
    if (this.core.audio && !isReminder) {
      this.core.audio.playAdhan();
    }
  }

  checkPrayerTimes() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    if (!this.prayerTimes) return;

    // Check if it's time for any prayer
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    prayers.forEach(prayer => {
      const prayerTime = this.prayerTimes[prayer];
      if (!prayerTime) return;

      const [hours, minutes] = prayerTime.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      
      // Check if it's within 1 minute of prayer time
      if (Math.abs(currentTime - prayerMinutes) <= 1) {
        this.sendNotification(prayer, false);
      }
    });
  }

  clearAllTimers() {
    this.notificationTimers.forEach((timerId, key) => {
      clearTimeout(timerId);
    });
    this.notificationTimers.clear();
    console.log("[ClientPrayerNotifications] All timers cleared");
  }

  enable() {
    this.isEnabled = true;
    this.saveSettings();
    this.scheduleNotifications();
    console.log("[ClientPrayerNotifications] Client-side notifications enabled");
  }

  disable() {
    this.isEnabled = false;
    this.saveSettings();
    this.clearAllTimers();
    console.log("[ClientPrayerNotifications] Client-side notifications disabled");
  }

  setReminderMinutes(minutes) {
    this.reminderMinutes = Math.max(0, Math.min(60, minutes));
    this.saveSettings();
    if (this.isEnabled) {
      this.scheduleNotifications();
    }
    console.log("[ClientPrayerNotifications] Reminder minutes set to:", this.reminderMinutes);
  }

  destroy() {
    this.clearAllTimers();
    console.log("[ClientPrayerNotifications] Client-side notifications destroyed");
  }
}
