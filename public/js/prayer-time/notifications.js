/* ------------------------------------------------------------------
   Push notifications and service worker management
   - Service worker registration
   - Push subscription management
   - Notification preferences
   - Test notifications
------------------------------------------------------------------- */

export class PrayerTimesNotifications {
  constructor(core, api) {
    console.log("[Notifications] Initializing PrayerTimesNotifications");
    this.core = core;
    this.api = api;
  }

  // Base64 to Uint8Array conversion
  b64ToU8(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
    return out;
  }

  // Register service worker
  async registerSW() {
    console.log("[Notifications] Registering service worker");
    if (this.core.state.swRegistration) {
      console.log("[Notifications] Service worker already registered");
      return this.core.state.swRegistration;
    }
    if (!("serviceWorker" in navigator)) {
      console.log("[Notifications] Service worker not supported");
      return null;
    }
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    this.core.state.swRegistration = reg;
    console.log("[Notifications] Service worker registered successfully");
    return reg;
  }

  // Ensure subscribed
  async ensureSubscribed(reg) {
    if (!reg) throw new Error("Service worker registration is missing.");
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      this.core.state.pushSubscription = existing;
      return existing;
    }
    const r = await fetch("/api/notifications/vapid-public-key", { credentials: "include" });
    if (!r.ok) throw new Error("VAPID key error");
    const vapid = await r.text();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.b64ToU8(vapid),
    });
    this.core.state.pushSubscription = sub;
    return sub;
  }

  // Load per-prayer preferences
  loadPerPrayer() {
    try { return JSON.parse(localStorage.getItem("perPrayer")) || null; } catch { return null; }
  }

  // Default per-prayer preferences
  defaultPerPrayer() {
    return { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  }

  // Save per-prayer preferences
  savePerPrayer(m) {
    localStorage.setItem("perPrayer", JSON.stringify(m));
  }

  // Get preferences
  getPreferences(enabled) {
    const perPrayer = this.loadPerPrayer() || this.defaultPerPrayer();
    const method = this.core.el.methodSel?.value || this.core.state.settings.calculationMethod || "auto";
    const madhab = this.core.el.madhabSel?.value || this.core.state.settings.madhab || "auto";
    const reminderMinutes =
      parseInt(this.core.el.reminderSel?.value ?? this.core.state.settings.reminderMinutes ?? 0, 10);

    const src = localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3";
    const volume = parseFloat(localStorage.getItem("adhanVolume") || "1") || 1;
    const file = src.split("/").pop();

    console.log("[Notifications] Getting preferences:", {
      enabled,
      perPrayer,
      method,
      madhab,
      reminderMinutes,
      reminderSelValue: this.core.el.reminderSel?.value,
      settingsReminderMinutes: this.core.state.settings.reminderMinutes
    });

    return {
      enabled,
      tz: this.core.state.tz,
      perPrayer,
      method,
      madhab,
      reminderMinutes,
      highLatRule: "auto",
      audio: { file, volume, path: src },
    };
  }

  // Send subscription to server
  async sendSubscriptionToServer(enabled) {
    const prefs = this.getPreferences(enabled);
    const token = this.api.getAuthToken();
    const csrf =
      this.api.getCsrf() ||
      (await fetch("/api/auth/csrf", { credentials: "include" })
        .then(() => this.api.getCsrf())
        .catch(() => null));

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(csrf && { "X-CSRF-Token": csrf }),
    };

    const body = {
      subscription: this.core.state.pushSubscription,
      tz: this.core.state.tz,
      preferences: prefs,
      location: this.core.state.coords
        ? { lat: this.core.state.coords.lat, lon: this.core.state.coords.lon, city: this.core.state.cityLabel }
        : null,
    };

    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `Subscribe failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j.error || j.message || msg;
      } catch {}
      throw new Error(msg);
    }

    // Also update user notification preferences in profile
    await this.updateUserNotificationPreferences(prefs);
  }

  // Update user notification preferences in profile
  async updateUserNotificationPreferences(prefs) {
    try {
      console.log("[Notifications] Updating user notification preferences:", prefs);
      
      const response = await this.api.apiFetch("/api/user/notification-preferences", {
        method: "PUT",
        body: JSON.stringify({
          reminderMinutes: prefs.reminderMinutes,
          prayerReminders: prefs.perPrayer,
          calculationMethod: prefs.method,
          madhab: prefs.madhab,
          timezone: prefs.tz
        }),
      });

      if (response.success) {
        console.log("[Notifications] User preferences updated successfully");
      } else {
        console.warn("[Notifications] Failed to update user preferences:", response.error);
      }
    } catch (error) {
      console.warn("[Notifications] Failed to update user preferences:", error);
    }
  }

  // Setup notifications
  async setupNotifications() {
    console.log("[Notifications] Setting up notifications");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("[Notifications] Browser does not support push notifications");
        this.core.showLocationMessage("Browser does not support push notifications", "error");
        return false;
      }
      console.log("[Notifications] Requesting notification permission");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        console.log("[Notifications] Notification permission denied");
        this.core.showLocationMessage("Enable notifications in your browser settings", "error");
        return false;
      }
      console.log("[Notifications] Notification permission granted");
      const reg = (await this.registerSW()) || this.core.state.swRegistration;
      if (!reg) throw new Error("Service Worker failed");
      await this.ensureSubscribed(reg);
      await this.sendSubscriptionToServer(true);
      localStorage.setItem("notificationsEnabled", "true");
      this.core.toast("Prayer notifications enabled", "success");
      console.log("[Notifications] Notifications setup completed successfully");
      return true;
    } catch (e) {
      console.error("[Notifications] Failed to setup notifications:", e);
      this.core.toast(`Failed to enable notifications: ${e.message}`, "error");
      return false;
    }
  }

  // Unsubscribe push
  async unsubscribePush() {
    try {
      if (this.core.state.pushSubscription) await this.core.state.pushSubscription.unsubscribe();
      const token = this.api.getAuthToken();
      const csrf = this.api.getCsrf();
      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { "X-CSRF-Token": csrf }),
        },
        credentials: "include",
        body: JSON.stringify({ endpoint: this.core.state.pushSubscription?.endpoint }),
      }).catch(() => {});
      this.core.state.pushSubscription = null;
      localStorage.setItem("notificationsEnabled", "false");
      this.core.toast("Notifications disabled", "success");
    } catch (e) {
      this.core.toast("Failed to disable notifications", "error");
    }
  }

  // Check notification status
  async checkNotificationStatus() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      if (this.core.el.notifToggle) this.core.el.notifToggle.checked = false;
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    if (this.core.el.notifToggle) this.core.el.notifToggle.checked = !!sub;
    if (sub) {
      this.core.state.pushSubscription = sub;
      this.core.state.swRegistration = reg;
    }
  }

  // Send test notification
  async sendTestNotification() {
    try {
      const token = this.api.getAuthToken();
      const csrf = this.api.getCsrf();
      const r = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { "X-CSRF-Token": csrf }),
        },
        credentials: "include",
        body: JSON.stringify({ tz: this.core.state.tz }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) this.core.toast(j.msg || "Test notification queued", "success");
      else this.core.toast(j.error || "Failed to queue test notification", "error");
    } catch {
      this.core.toast("Failed to queue test notification", "error");
    }
  }

  // Send test prayer notification
  async sendTestPrayerNotification() {
    try {
      const token = this.api.getAuthToken();
      const csrf = this.api.getCsrf();
      let r = await fetch("/api/notifications/test-prayer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { "X-CSRF-Token": csrf }),
        },
        credentials: "include",
        body: JSON.stringify({ prayer: "next", tz: this.core.state.tz }),
      });
      if (r.status === 404) {
        r = await fetch("/api/notifications/test-prayer-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrf && { "X-CSRF-Token": csrf }),
          },
          credentials: "include",
        });
      }
      const j = await r.json().catch(() => ({}));
      if (r.ok) this.core.toast(j.msg || "Prayer test queued", "success");
      else this.core.toast(j.error || "Failed to queue prayer test", "error");
    } catch {
      this.core.toast("Failed to queue prayer test", "error");
    }
  }

  // Setup notification event listeners
  setupEventListeners() {
    // Notification toggle
    this.core.el.notifToggle?.addEventListener("change", async (e) => {
      if (e.target.checked) {
        const ok = await this.setupNotifications();
        if (!ok) e.target.checked = false;
      } else {
        await this.unsubscribePush();
      }
    });

    // Per-prayer toggles
    ["alertFajr", "alertDhuhr", "alertAsr", "alertMaghrib", "alertIsha"].forEach((k) => {
      this.core.el[k]?.addEventListener("change", async () => {
        const model = {
          fajr: !!this.core.el.alertFajr?.checked,
          dhuhr: !!this.core.el.alertDhuhr?.checked,
          asr: !!this.core.el.alertAsr?.checked,
          maghrib: !!this.core.el.alertMaghrib?.checked,
          isha: !!this.core.el.alertIsha?.checked,
        };
        this.savePerPrayer(model);
        if (this.core.el.notifToggle?.checked) {
          try { await this.sendSubscriptionToServer(true); } catch {}
        }
      });
    });

    // Test buttons
    this.core.el.testBtn?.addEventListener("click", this.sendTestNotification.bind(this));
    this.core.el.testPrayerBtn?.addEventListener("click", this.sendTestPrayerNotification.bind(this));
  }

  // Initialize notifications
  // Load per-prayer settings into UI
  loadPerPrayerToUI() {
    const perPrayer = this.loadPerPrayer() || this.defaultPerPrayer();
    console.log("[Notifications] Loading per-prayer settings to UI:", perPrayer);
    
    if (this.core.el.alertFajr) this.core.el.alertFajr.checked = !!perPrayer.fajr;
    if (this.core.el.alertDhuhr) this.core.el.alertDhuhr.checked = !!perPrayer.dhuhr;
    if (this.core.el.alertAsr) this.core.el.alertAsr.checked = !!perPrayer.asr;
    if (this.core.el.alertMaghrib) this.core.el.alertMaghrib.checked = !!perPrayer.maghrib;
    if (this.core.el.alertIsha) this.core.el.alertIsha.checked = !!perPrayer.isha;
  }

  async initialize() {
    // Load per-prayer settings into UI
    this.loadPerPrayerToUI();
    
    await this.checkNotificationStatus();
    this.setupEventListeners();

    if (
      localStorage.getItem("notificationsEnabled") === "true" &&
      Notification.permission === "granted"
    ) {
      this.setupNotifications().catch(() => {});
    }
  }
}
