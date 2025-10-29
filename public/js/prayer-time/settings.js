/* ------------------------------------------------------------------
   Settings management
   - Load and save user preferences
   - Settings migration from legacy format
   - Settings event listeners
------------------------------------------------------------------- */

export class PrayerTimesSettings {
  constructor(core, api) {
    console.log("[Settings] Initializing PrayerTimesSettings");
    this.core = core;
    this.api = api;
    this.onClockFormatChange = null;
    this.onMethodChange = null;
    this.onMadhabChange = null;
    this.onReminderChange = null;
  }

  // Load settings
  async load() {
    console.log("[Settings] Loading settings...");

    // Try to load from server first
    const serverSettings = await this.loadFromServer();
    if (serverSettings) {
      console.log("[Settings] Loaded settings from server:", serverSettings);
      this.applySettings(serverSettings);
    } else {
      // Fallback to localStorage
      console.log("[Settings] Loading settings from localStorage (server unavailable)");
      this.loadFromLocalStorage();
    }

    // Apply settings to UI
    this.updateUI();

    // Migration support
    this.handleLegacyMigration();
  }

  // Load settings from server
  async loadFromServer() {
    try {
      // Session-based: Always try server first, fallback to localStorage
      console.log("[Settings] Attempting to load settings from server with session authentication");

      const response = await fetch("/api/user/preferences", {
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        const serverSettings = data.preferences || {};

        // Merge with notification preferences
        const notificationResponse = await fetch("/api/user/notification-preferences", {
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include"
        });

        if (notificationResponse.ok) {
          const notificationData = await notificationResponse.json();
          const notificationPrefs = notificationData.preferences || {};

          return {
            calculationMethod: serverSettings.calculationMethod || "auto",
            madhab: serverSettings.madhab || "auto",
            reminderMinutes: notificationPrefs.reminderMinutes || 0,
            is24Hour: serverSettings.is24Hour || false,
            theme: serverSettings.theme || "dark",
            language: serverSettings.language || "en",
            audioEnabled: serverSettings.audioEnabled !== false,
            selectedAdhanSrc: serverSettings.selectedAdhanSrc || "/audio/adhan.mp3",
            adhanVolume: serverSettings.adhanVolume || 1.0,
            prayerReminders: notificationPrefs.prayerReminders || {
              fajr: true,
              dhuhr: true,
              asr: true,
              maghrib: true,
              isha: true
            },
            // NEW: Audio preferences from server
            audioProfileMain: serverSettings.audioProfileMain || { name: 'madinah', file: '/audio/adhan_madinah.mp3' },
            audioProfileReminder: serverSettings.audioProfileReminder || { name: 'short', file: '/audio/adhan.mp3' },
            audioSettings: serverSettings.audioSettings || { volume: 0.8, fadeInMs: 3000, vibrateOnly: false, cooldownSeconds: 30 }
          };
        }

        return {
          calculationMethod: serverSettings.calculationMethod || "auto",
          madhab: serverSettings.madhab || "auto",
          reminderMinutes: 0,
          is24Hour: serverSettings.is24Hour || false,
          theme: serverSettings.theme || "dark",
          language: serverSettings.language || "en",
          audioEnabled: serverSettings.audioEnabled !== false,
          // NEW: Audio preferences fallback
          audioProfileMain: serverSettings.audioProfileMain || { name: 'madinah', file: '/audio/adhan_madinah.mp3' },
          audioProfileReminder: serverSettings.audioProfileReminder || { name: 'short', file: '/audio/adhan.mp3' },
          audioSettings: serverSettings.audioSettings || { volume: 0.8, fadeInMs: 3000, vibrateOnly: false, cooldownSeconds: 30 },
          selectedAdhanSrc: serverSettings.selectedAdhanSrc || "/audio/adhan.mp3",
          adhanVolume: serverSettings.adhanVolume || 1.0,
          prayerReminders: {
            fajr: true,
            dhuhr: true,
            asr: true,
            maghrib: true,
            isha: true
          }
        };
      } else {
        console.warn("[Settings] Server returned error:", response.status);
        return null;
      }
    } catch (error) {
      console.warn("[Settings] Failed to load from server:", error);
      return null;
    }
  }

  // Load settings from localStorage (fallback)
  loadFromLocalStorage() {
    this.core.state.settings.calculationMethod =
      localStorage.getItem("prayerMethod") || "auto";
    this.core.state.settings.madhab =
      localStorage.getItem("prayerMadhab") || "auto";
    this.core.state.settings.is24Hour =
      JSON.parse(localStorage.getItem("is24HourFormat") || "false");
    this.core.state.settings.reminderMinutes =
      parseInt(localStorage.getItem("reminderMinutes") || "0", 10);
  }

  // Apply settings to state
  applySettings(settings) {
    this.core.state.settings.calculationMethod = settings.calculationMethod || "auto";
    this.core.state.settings.madhab = settings.madhab || "auto";
    this.core.state.settings.reminderMinutes = settings.reminderMinutes || 0;
    this.core.state.settings.is24Hour = settings.is24Hour || false;
    this.core.state.settings.theme = settings.theme || "dark";
    this.core.state.settings.language = settings.language || "en";
    this.core.state.settings.audioEnabled = settings.audioEnabled !== false;
    this.core.state.settings.selectedAdhanSrc = settings.selectedAdhanSrc || "/audio/adhan.mp3";
    this.core.state.settings.adhanVolume = settings.adhanVolume || 1.0;

    if (settings.prayerReminders) {
      this.core.state.settings.prayerReminders = settings.prayerReminders;
    }
  }

  // Update UI elements
  updateUI() {
    if (this.core.el.methodSel) this.core.el.methodSel.value = this.core.state.settings.calculationMethod;
    if (this.core.el.madhabSel) this.core.el.madhabSel.value = this.core.state.settings.madhab;
    if (this.core.el.reminderSel) {
      const current = String(this.core.state.settings.reminderMinutes);
      // If current value is not in the dropdown, add it dynamically
      if (!Array.from(this.core.el.reminderSel.options).some(o => o.value === current)) {
        const opt = document.createElement('option');
        opt.value = current;
        opt.textContent = `${current} minutes before`;
        this.core.el.reminderSel.appendChild(opt);
      }
      this.core.el.reminderSel.value = current;
    }
    if (this.core.el.clock24Toggle) this.core.el.clock24Toggle.checked = this.core.state.settings.is24Hour;

    if (this.core.el.adhanToggle) {
      this.core.el.adhanToggle.checked = this.core.state.settings.audioEnabled;
    }

    // Apply theme if theme manager is available
    if (window.themeManager && this.core.state.settings.theme) {
      window.themeManager.setTheme(this.core.state.settings.theme);
    }

    // Apply language if i18n is available
    if (window.i18n && this.core.state.settings.language) {
      window.i18n.setLanguage(this.core.state.settings.language);
    }

    localStorage.setItem("clockFormat24", this.core.state.settings.is24Hour ? "true" : "false");
  }

  // Attach dynamic listeners (idempotent)
  attachListeners() {
    if (this._listenersAttached) return;
    this._listenersAttached = true;

    // Dynamic reminder change: update state, persist, and resubscribe
    if (this.core.el.reminderSel) {
      this.core.el.reminderSel.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        if (!Number.isNaN(val)) {
          this.core.state.settings.reminderMinutes = val;
          await this.save(); // debounce persists to server
          try {
            // Re-send subscription with latest settings
            const notifications = this.core.notifications;
            if (notifications && typeof notifications.sendSubscriptionToServer === 'function') {
              await notifications.sendSubscriptionToServer(true);
            }
          } catch (err) {
            console.warn('[Settings] Failed to re-sync subscription after reminder change:', err);
          }
        }
      });
    }
  }

  // Handle legacy migration
  handleLegacyMigration() {
    try {
      const legacy = JSON.parse(localStorage.getItem("prayerAppSettings") || "null");
      if (legacy && typeof legacy === "object") {
        if (legacy.calculationMethod && legacy.calculationMethod !== this.core.state.settings.calculationMethod) {
          this.core.state.settings.calculationMethod = legacy.calculationMethod;
          if (this.core.el.methodSel) this.core.el.methodSel.value = legacy.calculationMethod;
        }
        if (legacy.madhab && legacy.madhab !== this.core.state.settings.madhab) {
          this.core.state.settings.madhab = legacy.madhab;
          if (this.core.el.madhabSel) this.core.el.madhabSel.value = legacy.madhab;
        }
        if (typeof legacy.use24HourFormat === "boolean") {
          this.core.state.settings.is24Hour = legacy.use24HourFormat;
          if (this.core.el.clock24Toggle) this.core.el.clock24Toggle.checked = legacy.use24HourFormat;
          localStorage.setItem("clockFormat24", legacy.use24HourFormat ? "true" : "false");
        }
        const hasLast = !!localStorage.getItem("lastLocation");
        if (!hasLast && Number.isFinite(legacy.latitude) && Number.isFinite(legacy.longitude)) {
          const display = legacy.city || "Saved Location";
          const migrate = { lat: legacy.latitude, lon: legacy.longitude, display, tz: this.core.state.tz };
          localStorage.setItem("lastLocation", JSON.stringify(migrate));
        }
      }
    } catch {}
  }

  // Save settings
  async save() {
    console.log("[Settings] Saving settings:", this.core.state.settings);

    // Save to localStorage immediately for responsiveness
    this.saveToLocalStorage();

    // Debounce server save to prevent rapid API calls
    this.debouncedServerSave();
  }

  // Debounced server save
  debouncedServerSave() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    this._saveTimeout = setTimeout(async () => {
      await this.performServerSave();
    }, 1000); // 1 second debounce
  }

  // Save to localStorage
  saveToLocalStorage() {
    localStorage.setItem("prayerMethod", this.core.state.settings.calculationMethod);
    localStorage.setItem("prayerMadhab", this.core.state.settings.madhab);
    localStorage.setItem("is24HourFormat", JSON.stringify(this.core.state.settings.is24Hour));
    localStorage.setItem("reminderMinutes", String(this.core.state.settings.reminderMinutes));
    localStorage.setItem("clockFormat24", this.core.state.settings.is24Hour ? "true" : "false");
    console.log("[Settings] Settings saved to localStorage");
  }

  // Save to server (background)
  async saveToServer() {
    try {
      // Session-based: Always try server save
      console.log("[Settings] Attempting to save settings to server with session authentication");

      // Debounce server saves to avoid too many API calls
      if (this._saveTimeout) {
        clearTimeout(this._saveTimeout);
      }

      this._saveTimeout = setTimeout(async () => {
        await this.performServerSave();
      }, 1000); // Wait 1 second before saving to server

    } catch (error) {
      console.warn("[Settings] Failed to save to server:", error);
    }
  }

  // Perform actual server save
  async performServerSave() {
    try {
      // Session-based: Always try server save

      // Prepare CSRF header (cookie-based)
      const csrf = (this.api && typeof this.api.getCsrf === 'function') ? this.api.getCsrf() : null;
      const baseHeaders = {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {})
      };
      console.log("[Settings] Using CSRF header:", !!csrf);

      // Simple retry helper for transient network failures
      const doFetchWithRetry = async (url, options, retries = 1) => {
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await fetch(url, options);
          } catch (err) {
            lastError = err;
            console.warn(`[Settings] Network error on ${url} (attempt ${attempt + 1}/${retries + 1}):`, err);
            if (attempt < retries) await new Promise(r => setTimeout(r, 500));
          }
        }
        throw lastError;
      };

      // Save all preferences to the main preferences endpoint
      let preferencesResponse;
      try {
        preferencesResponse = await doFetchWithRetry("/api/user/preferences", {
          method: "PUT",
          headers: baseHeaders,
          credentials: "include",
          body: JSON.stringify({
            calculationMethod: this.core.state.settings.calculationMethod,
            madhab: this.core.state.settings.madhab,
            theme: this.core.state.settings.theme,
            language: this.core.state.settings.language,
            is24Hour: this.core.state.settings.is24Hour,
            audioEnabled: this.core.state.settings.audioEnabled,
            selectedAdhanSrc: this.core.state.settings.selectedAdhanSrc,
            adhanVolume: this.core.state.settings.adhanVolume,
            prayerReminders: this.core.state.settings.prayerReminders || {
              fajr: true,
              dhuhr: true,
              asr: true,
              maghrib: true,
              isha: true
            }
          })
        }, 1);
      } catch (prefErr) {
        console.warn("[Settings] Preferences save failed due to network error:", prefErr);
        preferencesResponse = { ok: false, status: 0 };
      }

      // Save notification preferences separately (including audio prefs)
      let notificationResponse;
      try {
        notificationResponse = await doFetchWithRetry("/api/user/notification-preferences", {
          method: "PUT",
          headers: baseHeaders,
          credentials: "include",
          body: JSON.stringify({
            reminderMinutes: this.core.state.settings.reminderMinutes,
            calculationMethod: this.core.state.settings.calculationMethod,
            madhab: this.core.state.settings.madhab,
            timezone: this.core.state.tz,
            // NEW: Audio preferences
            audioProfileMain: this.core.state.settings.audioProfileMain || { name: 'madinah', file: '/audio/adhan_madinah.mp3' },
            audioProfileReminder: this.core.state.settings.audioProfileReminder || { name: 'short', file: '/audio/adhan.mp3' },
            audioSettings: this.core.state.settings.audioSettings || { volume: 0.8, fadeInMs: 3000, vibrateOnly: false, cooldownSeconds: 30 },
            prayerReminders: this.core.state.settings.prayerReminders || {
              fajr: true,
              dhuhr: true,
              asr: true,
              maghrib: true,
              isha: true
            }
          })
        }, 1);
      } catch (notifErr) {
        console.warn("[Settings] Notification preferences save failed due to network error:", notifErr);
        notificationResponse = { ok: false, status: 0 };
      }

      if (preferencesResponse.ok && notificationResponse.ok) {
        console.log("[Settings] Settings saved to server successfully");
        // Note: Removed automatic reload to prevent infinite loops
        // Settings are already in sync since we just saved them
      } else {
        console.warn("[Settings] Some server saves failed:", {
          preferences: preferencesResponse.status,
          notifications: notificationResponse.status
        });
        // Fallback: If notification endpoint failed but preferences endpoint succeeded,
        // try to persist reminderMinutes via /preferences as a backup.
        if (preferencesResponse.ok && !notificationResponse.ok && Number.isFinite(this.core.state.settings.reminderMinutes)) {
          try {
            console.log("[Settings] Attempting fallback: saving reminderMinutes via /api/user/preferences");
            const fallbackRes = await doFetchWithRetry("/api/user/preferences", {
              method: "PUT",
              headers: baseHeaders,
              credentials: "include",
              body: JSON.stringify({
                reminderMinutes: this.core.state.settings.reminderMinutes
              })
            }, 1);
            console.log("[Settings] Fallback save status:", fallbackRes.status);
          } catch (fbErr) {
            console.warn("[Settings] Fallback save failed:", fbErr);
          }
        }
      }
    } catch (error) {
      console.warn("[Settings] Server save failed:", error);
    }
  }

  // Setup settings event listeners
  setupEventListeners() {
    // Clock format toggle
    this.core.el.clock24Toggle?.addEventListener("change", () => {
      this.core.state.settings.is24Hour = !!this.core.el.clock24Toggle.checked;
      this.save();
      if (this.core.state.times) {
        // This will be handled by prayer-times module
        this.onClockFormatChange?.();
      }
    });

    // Calculation method
    this.core.el.methodSel?.addEventListener("change", () => {
      this.core.state.settings.calculationMethod = this.core.el.methodSel.value;
      this.save();
      this.onMethodChange?.();
    });

    // Madhab
    this.core.el.madhabSel?.addEventListener("change", () => {
      this.core.state.settings.madhab = this.core.el.madhabSel.value;
      this.save();
      this.onMadhabChange?.();
    });

    // Reminder minutes
    this.core.el.reminderSel?.addEventListener("change", () => {
      this.core.state.settings.reminderMinutes = parseInt(this.core.el.reminderSel.value, 10) || 0;
      this.save();
      this.onReminderChange?.();
    });

    // Notification toggle is handled by notifications.js
    // No need to duplicate the event listener here

    // Audio toggle
    this.core.el.adhanToggle?.addEventListener("change", () => {
      this.core.state.settings.audioEnabled = !!this.core.el.adhanToggle.checked;
      this.save();
    });

    // Theme change (if theme manager is available)
    if (window.themeManager) {
      window.themeManager.addListener((theme) => {
        this.core.state.settings.theme = theme;
        this.save();
      });
    }

    // Language change (if i18n is available)
    if (window.i18n) {
      // Listen for language changes from i18n
      window.addEventListener('languageChanged', (event) => {
        this.core.state.settings.language = event.detail.language;
        this.save();
      });
    }
  }


  // Initialize settings
  async initialize() {
    await this.load();
    this.setupEventListeners();
  }
}
