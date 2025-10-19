/* ------------------------------------------------------------------
   Prayer Times Page Script (Modular Version)

   This is the main entry point that imports and coordinates all modules:
   - Core utilities and state management
   - Location services and geocoding
   - Prayer times calculation and display
   - Audio system
   - Notifications and service worker
   - Prayer logging
   - Settings management
   - Internationalization
   - UI components and modals
------------------------------------------------------------------- */

import { PrayerTimesCore } from './js/prayer-time/core.js';
import { PrayerTimesAPI } from './js/prayer-time/api.js';
import { PrayerTimesLocation } from './js/prayer-time/location.js';
import { PrayerTimesCalculator } from './js/prayer-time/prayer-times.js';
import { PrayerTimesAudio } from './js/prayer-time/audio.js';
import { PrayerTimesNotifications } from './js/prayer-time/notifications.js';
import { ClientPrayerNotifications } from './js/prayer-time/clientPrayerNotifications.js';
import { PrayerTimesLogging } from './js/prayer-time/prayer-logging.js';
import { PrayerTimesSettings } from './js/prayer-time/settings.js';
import { PrayerTimesI18N } from './js/prayer-time/i18n.js';
import { PrayerTimesUIComponents } from './js/prayer-time/ui-components.js';

(() => {
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    "use strict";

    // --- Early: handle actions from SW + URL param (LOG_PRAYER / PLAY_ADHAN) ---
    if (navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === "function") {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "LOG_PRAYER" && event.data.prayer) {
          // This will be handled by prayer logging module
          console.log("SW message: LOG_PRAYER", event.data.prayer);
        } else if (event.data?.type === "PLAY_ADHAN") {
          // This will be handled by audio module
          console.log("SW message: PLAY_ADHAN", event.data.audioFile);
        }
      });
    }
    {
      const urlParams = new URLSearchParams(window.location.search);
      const prayerToLog = urlParams.get("log");
      if (prayerToLog) {
        // This will be handled by prayer logging module
        console.log("URL param: log", prayerToLog);
        history.replaceState(null, "", window.location.pathname); // prevent repeat
      }
    }
    // --------------------------------------------------------------------------

    // Initialize core
    const core = new PrayerTimesCore();
    core.initToastStyles();

    // Initialize API
    const api = new PrayerTimesAPI();

    // Initialize modules
    const location = new PrayerTimesLocation(core, api);
    const calculator = new PrayerTimesCalculator(core, api, location);
    const audio = new PrayerTimesAudio(core);
    const notifications = new PrayerTimesNotifications(core, api);
    const clientNotifications = new ClientPrayerNotifications(core, api);
    const logging = new PrayerTimesLogging(core, api);
    const settings = new PrayerTimesSettings(core);
    const i18n = new PrayerTimesI18N(core);
    const uiComponents = new PrayerTimesUIComponents(core);

    // Connect modules
    location.refreshPrayerTimesByLocation = calculator.refreshPrayerTimesByLocation.bind(calculator);

    // Setup service worker message handlers
    if (navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === "function") {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "LOG_PRAYER" && event.data.prayer) {
          logging.logPrayerAsCompleted(event.data.prayer);
        } else if (event.data?.type === "PLAY_ADHAN") {
          audio.playAdhan(event.data.audioFile || "/audio/adhan.mp3");
        }
      });
    }

    // Handle URL params
    {
      const urlParams = new URLSearchParams(window.location.search);
      const prayerToLog = urlParams.get("log");
      if (prayerToLog) {
        logging.logPrayerAsCompleted(prayerToLog);
        history.replaceState(null, "", window.location.pathname); // prevent repeat
      }
    }

    // Initialize all modules
    await settings.initialize();
    await i18n.initialize();
    await audio.initialize();
    await notifications.initialize();
    await logging.initialize();
    uiComponents.initialize();

    // Setup location search
    location.setupLocationSearch();
    location.setupLegacySearch();

    // Find location on startup
    await location.findLocationOnStartup();

    // Public debug API
    window.__PrayerTimesApp = {
      refreshPrayerTimesByLocation: calculator.refreshPrayerTimesByLocation.bind(calculator),
      usePreciseLocation: location.usePreciseLocation.bind(location),
      setupNotifications: notifications.setupNotifications.bind(notifications),
      sendTestNotification: notifications.sendTestNotification.bind(notifications),
      sendTestPrayerNotification: notifications.sendTestPrayerNotification.bind(notifications),
      playAdhan: audio.playAdhan.bind(audio),
      fetchAndUpdatePrayerLog: logging.fetchAndUpdatePrayerLog.bind(logging),
      logPrayerAsCompleted: logging.logPrayerAsCompleted.bind(logging),
    };
  }
})();
