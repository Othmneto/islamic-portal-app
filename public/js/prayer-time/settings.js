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
  load() {
    console.log("[Settings] Loading settings from localStorage");
    this.core.state.settings.calculationMethod =
      localStorage.getItem("prayerMethod") || "auto";
    this.core.state.settings.madhab =
      localStorage.getItem("prayerMadhab") || "auto";
    this.core.state.settings.is24Hour =
      JSON.parse(localStorage.getItem("is24HourFormat") || "false");
    this.core.state.settings.reminderMinutes =
      parseInt(localStorage.getItem("reminderMinutes") || "0", 10);
    
    console.log("[Settings] Loaded settings:", this.core.state.settings);

    if (this.core.el.methodSel) this.core.el.methodSel.value = this.core.state.settings.calculationMethod;
    if (this.core.el.madhabSel) this.core.el.madhabSel.value = this.core.state.settings.madhab;
    if (this.core.el.reminderSel) this.core.el.reminderSel.value = String(this.core.state.settings.reminderMinutes);
    if (this.core.el.clock24Toggle) this.core.el.clock24Toggle.checked = this.core.state.settings.is24Hour;

    if (this.core.el.adhanToggle) {
      const saved = localStorage.getItem("adhanEnabled");
      this.core.el.adhanToggle.checked = saved === null ? true : saved === "true";
    }

    localStorage.setItem("clockFormat24", this.core.state.settings.is24Hour ? "true" : "false");

    // Migration support
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
  save() {
    console.log("[Settings] Saving settings:", this.core.state.settings);
    localStorage.setItem("prayerMethod", this.core.state.settings.calculationMethod);
    localStorage.setItem("prayerMadhab", this.core.state.settings.madhab);
    localStorage.setItem("is24HourFormat", JSON.stringify(this.core.state.settings.is24Hour));
    localStorage.setItem("reminderMinutes", String(this.core.state.settings.reminderMinutes));
    localStorage.setItem("clockFormat24", this.core.state.settings.is24Hour ? "true" : "false");
    console.log("[Settings] Settings saved successfully");
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
      this.updateServerNotificationPreferences();
    });

    // Madhab
    this.core.el.madhabSel?.addEventListener("change", () => {
      this.core.state.settings.madhab = this.core.el.madhabSel.value;
      this.save();
      this.onMadhabChange?.();
      this.updateServerNotificationPreferences();
    });

    // Reminder minutes
    this.core.el.reminderSel?.addEventListener("change", () => {
      this.core.state.settings.reminderMinutes = parseInt(this.core.el.reminderSel.value, 10) || 0;
      this.save();
      this.onReminderChange?.();
      
      // Also update user notification preferences on server
      this.updateServerNotificationPreferences();
    });

    // Notification toggle (if it exists in settings)
    this.core.el.notifToggle?.addEventListener("change", () => {
      this.updateServerNotificationPreferences();
    });
  }

  // Update server notification preferences
  async updateServerNotificationPreferences() {
    try {
      console.log("[Settings] Updating server notification preferences");
      
      const token = this.api?.getAuthToken();
      if (!token) {
        console.warn("[Settings] No auth token available, skipping server update");
        return;
      }
      
      const response = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          ...(this.core.api?.getCsrf() && { 
            "X-CSRF-Token": this.core.api.getCsrf() 
          }),
        },
        credentials: "include",
        body: JSON.stringify({
          reminderMinutes: this.core.state.settings.reminderMinutes,
          calculationMethod: this.core.state.settings.calculationMethod,
          madhab: this.core.state.settings.madhab,
          timezone: this.core.state.tz,
          prayerReminders: {
            fajr: true,
            dhuhr: true,
            asr: true,
            maghrib: true,
            isha: true
          }
        }),
      });

      if (response.ok) {
        console.log("[Settings] Server notification preferences updated successfully");
      } else {
        console.warn("[Settings] Failed to update server notification preferences:", response.status);
        if (response.status === 401) {
          console.warn("[Settings] Authentication failed, user may need to re-login");
        }
        // Try to get error details
        try {
          const errorData = await response.json();
          console.warn("[Settings] Error details:", errorData);
        } catch (e) {
          console.warn("[Settings] Could not parse error response");
        }
      }
    } catch (error) {
      console.warn("[Settings] Failed to update server notification preferences:", error);
    }
  }

  // Initialize settings
  initialize() {
    this.load();
    this.setupEventListeners();
  }
}
