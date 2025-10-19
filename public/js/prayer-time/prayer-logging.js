/* ------------------------------------------------------------------
   Prayer logging system
   - Fetch today's logged prayers
   - Log prayer as completed
   - Update UI with prayer status
   - Handle click-to-log functionality
------------------------------------------------------------------- */

export class PrayerTimesLogging {
  constructor(core, api) {
    console.log("[PrayerLogging] Initializing PrayerTimesLogging");
    this.core = core;
    this.api = api;
  }

  // Fetch and update prayer log
  async fetchAndUpdatePrayerLog() {
    console.log("[PrayerLogging] Fetching today's prayer log");
    try {
      const prayedToday = await this.api.apiFetch("/api/prayer-log/today");
      console.log("[PrayerLogging] Today's prayers:", prayedToday);

      document.querySelectorAll('.prayer-card[data-key]').forEach((card) => {
        const prayerName = card.dataset.key;
        const icon = card.querySelector('.prayer-status-icon');
        if (Array.isArray(prayedToday) && prayedToday.includes(prayerName)) {
          card.classList.add('prayed');
          if (icon) icon.innerHTML = '<i class="fa-solid fa-check"></i>';
          console.log(`[PrayerLogging] Marked ${prayerName} as prayed`);
        } else {
          card.classList.remove('prayed');
          if (icon) icon.innerHTML = '';
        }
      });
    } catch (error) {
      // Silently ignore for unauthenticated sessions; log others.
      if (!/401|Unauthorized/i.test(error.message)) {
        console.error("[PrayerLogging] Failed to fetch today's log:", error);
      } else {
        console.log("[PrayerLogging] User not authenticated, skipping prayer log fetch");
      }
    }
  }

  // Log prayer as completed
  async logPrayerAsCompleted(prayerName) {
    console.log(`[PrayerLogging] Logging prayer: ${prayerName}`);
    const validNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    if (!validNames.includes(prayerName)) {
      console.warn(`[PrayerLogging] Invalid prayer name: ${prayerName}`);
      return;
    }

    const card = document.querySelector(`.prayer-card[data-key="${prayerName}"]`);

    try {
      // Optimistic UI
      console.log(`[PrayerLogging] Updating UI optimistically for ${prayerName}`);
      card?.classList.add('prayed');
      const icon = card?.querySelector('.prayer-status-icon');
      if (icon) icon.innerHTML = '<i class="fa-solid fa-check"></i>';

      // Get user's timezone from core state or localStorage or default to Asia/Dubai
      let userTimezone = this.core?.state?.tz || localStorage.getItem('userTimezone');

      // If not found, try to get from lastLocation
      if (!userTimezone) {
        try {
          const lastLocation = JSON.parse(localStorage.getItem('lastLocation') || '{}');
          userTimezone = lastLocation.tz;
        } catch (e) {
          console.warn('[PrayerLogging] Could not parse lastLocation:', e);
        }
      }

      // Final fallback
      userTimezone = userTimezone || 'Asia/Dubai';

      // Store timezone in localStorage for future use
      localStorage.setItem('userTimezone', userTimezone);

      // Create date in user's timezone using the same method as the profile page
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const dateString = fmt.format(now);

      console.log(`[PrayerLogging] Logging prayer for date: ${dateString} (timezone: ${userTimezone})`);

      await this.api.apiFetch("/api/prayer-log", {
        method: "POST",
        body: JSON.stringify({
          prayerName,
          date: dateString,
        }),
      });

      console.log(`[PrayerLogging] Successfully logged ${prayerName} prayer`);
      this.core.toast(`${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} prayer logged!`, "success");

      // Ensure other tabs/pages reflect the change (e.g., Profile dashboard)
      this.fetchAndUpdatePrayerLog().catch(() => {});

      // Trigger cross-page update for profile dashboard
      this.triggerCrossPageUpdate('prayerLogs', { prayerName, date: dateString });
    } catch (error) {
      console.error("[PrayerLogging] Failed to log prayer:", error);
      const msg = /401|Unauthorized/i.test(error.message)
        ? "Please log in to track your prayers."
        : "Could not log prayer. Please try again.";
      this.core.toast(msg, "error");

      // Revert UI on failure
      console.log(`[PrayerLogging] Reverting UI for ${prayerName} due to error`);
      card?.classList.remove('prayed');
      const icon = card?.querySelector('.prayer-status-icon');
      if (icon) icon.innerHTML = '';
    }
  }

  // Setup click-to-log functionality
  setupClickToLog() {
    // Click-to-log the five main prayers
    document.querySelectorAll('.prayer-card[data-key]').forEach((card) => {
      const prayerName = card.dataset.key;
      if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(prayerName)) {
        card.addEventListener('click', () => {
          if (!card.classList.contains('prayed')) {
            this.logPrayerAsCompleted(prayerName);
          }
        });
      }
    });
  }

  // Trigger cross-page update for prayer logs
  triggerCrossPageUpdate(type, data) {
    try {
      // Store in localStorage for cross-page sync
      const updateData = {
        type: type,
        data: data,
        timestamp: Date.now(),
        action: 'prayerLogged'
      };

      localStorage.setItem('prayerLogUpdate', JSON.stringify(updateData));

      // Also store a simple flag for immediate detection
      localStorage.setItem('prayerLogChanged', Date.now().toString());

      // Dispatch custom event for same-page updates
      window.dispatchEvent(new CustomEvent('prayerLogUpdated', {
        detail: { type, data, action: 'prayerLogged' }
      }));

      console.log('[PrayerLogging] Cross-page update triggered:', type, data);
    } catch (error) {
      console.error('[PrayerLogging] Failed to trigger cross-page update:', error);
    }
  }

  // Initialize prayer logging
  async initialize() {
    this.setupClickToLog();
    await this.fetchAndUpdatePrayerLog();
  }
}
