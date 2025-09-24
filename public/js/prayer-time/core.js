/* ------------------------------------------------------------------
   Core utilities and state management for Prayer Times App
   - State management
   - DOM element references
   - Utility functions
   - Toast notifications
------------------------------------------------------------------- */

export class PrayerTimesCore {
  constructor() {
    console.log("[Core] Initializing PrayerTimesCore");
    this.initialTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    
    // State
    this.state = {
      tz: this.initialTZ,               // IANA tz (updated from rich location if available)
      coords: null,                // { lat, lon }
      cityLabel: "",               // display string in UI
      locationData: null,          // rich location: { lat, lon, display, tz, ... }
      times: null,                 // { fajr, dhuhr, asr, maghrib, isha, shuruq? } ISO
      periods: null,               // { imsak:{start,end}, duha:{start,end}, tahajjud:{start,end} } ISO
      dateMeta: { gregorian: "", hijri: "" },
      countdownTimerId: null,
      pushSubscription: null,
      swRegistration: null,
      translations: {},
      settings: {
        calculationMethod: "auto",
        madhab: "auto",
        is24Hour: false,
        reminderMinutes: 0,
      },
    };

    // DOM Elements
    this.$ = (id) => document.getElementById(id);
    this.el = {
      // Shell
      loading: this.$("loading-message"),
      content: this.$("prayer-times-content"),

      // Times (main)
      fajr: this.$("fajr-time"),
      dhuhr: this.$("dhuhr-time"),
      asr: this.$("asr-time"),
      maghrib: this.$("maghrib-time"),
      isha: this.$("isha-time"),

      // Extended timepoints
      shuruq: this.$("shuruq-time"),

      // Worship periods
      imsakStart: this.$("imsak-start-time"),
      imsakEnd: this.$("imsak-end-time"),
      duhaStart: this.$("duha-start-time"),
      duhaEnd: this.$("duha-end-time"),
      tahajjudStart: this.$("tahajjud-start-time"),
      tahajjudEnd: this.$("tahajjud-end-time"),

      // Meta
      gregorian: this.$("gregorian-date"),
      hijri: this.$("hijri-date"),
      location: this.$("location-display"),

      // Header widgets
      nextPrayerName: this.$("next-prayer-name"),
      countdown: this.$("countdown-timer"),

      // Settings
      langSel: this.$("language-selector"),
      methodSel: this.$("calculation-method-select"),
      madhabSel: this.$("madhab-select"),
      reminderSel: this.$("reminder-select"),
      clock24Toggle: this.$("clock-format-toggle"),
      notifToggle: this.$("notification-toggle"),
      adhanToggle: this.$("adhan-audio-toggle"),


      // Audio
      adhanPlayer: this.$("adhan-player"),
      volumeSlider: this.$("adhan-volume-slider"),
      audioOutputSelect: this.$("audio-output-select"),
      soundLibrary: this.$("sound-library"),

      // Per-prayer toggles
      alertFajr: this.$("alert-fajr"),
      alertDhuhr: this.$("alert-dhuhr"),
      alertAsr: this.$("alert-asr"),
      alertMaghrib: this.$("alert-maghrib"),
      alertIsha: this.$("alert-isha"),

      // Assistant + tests
      assistantModal: this.$("assistant-modal"),
      openAssistantBtn: this.$("open-assistant-btn"),
      closeAssistantBtn: this.$("close-assistant-btn"),
      assistantSendBtn: this.$("assistant-send-btn"),
      assistantInput: this.$("assistant-input"),
      assistantChatWindow: this.$("assistant-chat-window"),
      testBtn: this.$("test-notification-btn"),
      testPrayerBtn: this.$("test-prayer-notification-btn"),

      // Typeahead Location search
      locInput: this.$("location-search-input"),
      locResults: this.$("search-results"),

      // Optional legacy/manual elems
      locMsgBox: this.$("location-message-container"),
      manualLocContainer: this.$("manual-location-container"),
      legacyCityInput: this.$("city-input"),
      legacySearchBtn: this.$("search-button"),

      // Optional table
      prayerTimesTableBody: document.querySelector("#prayer-times-table tbody"),
    };
  }

  // Toast notification system
  toast(msg, type = "info") {
    console.log(`[Core] Toast: ${type} - ${msg}`);
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText =
      "position:fixed;top:20px;right:20px;padding:12px 14px;border-radius:10px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.12);animation:slideIn .2s ease-out;z-index:99999";
    n.style.background =
      type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.animation = "slideOut .2s ease-in";
      setTimeout(() => n.remove(), 160);
    }, 3800);
  }

    // Initialize toast animations
    initToastStyles() {
      const s = document.createElement("style");
      s.textContent =
        "@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}" +
        "@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}";
      document.head.appendChild(s);
    }


  // Clear node children
  clearNode(node) {
    if (!node) return;
    node.replaceChildren();
  }

  // Show location message
  showLocationMessage(text, type = "info") {
    console.log(`[Core] Location message: ${type} - ${text}`);
    if (this.el.locMsgBox) {
      this.el.locMsgBox.style.display = "block";
      this.clearNode(this.el.locMsgBox);
      const p = document.createElement("p");
      p.className = type;
      p.textContent = text;
      this.el.locMsgBox.appendChild(p);
    } else {
      if (this.el.loading && this.el.loading.style.display !== "none") {
        this.clearNode(this.el.loading);
        const p = document.createElement("p");
        p.textContent = text;
        this.el.loading.appendChild(p);
      } else {
        this.toast(text, type === "error" ? "error" : type === "success" ? "success" : "info");
      }
    }
  }

  // Debounce utility
  debounce(fn, ms = 300) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  // Get state
  getState() {
    return this.state;
  }

  // Get elements
  getElements() {
    return this.el;
  }

  // Update state
  updateState(updates) {
    Object.assign(this.state, updates);
  }
}
