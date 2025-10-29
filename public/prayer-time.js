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
   - Real-time auto-refresh service
------------------------------------------------------------------- */

// Session-based auth: no token helpers needed
// Tokens are managed server-side via httpOnly cookies
function getToken() {
  // DEPRECATED: Session-based auth does not use client-side tokens
  return null;
}

function removeToken() {
  // DEPRECATED: Session cleared server-side via /api/auth-cookie/logout
  // Clear any remaining legacy storage items
  localStorage.removeItem('userData');
  localStorage.removeItem('userPreferences');
  localStorage.removeItem('savedLocations');
}

async function logout() {
  try {
    // Session-based logout
    try {
      const response = await fetch('/api/auth-cookie/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        console.log('✅ Logout (session) successful');
      } else {
        console.warn('⚠️ Logout (session) failed, proceeding to clear local state');
      }
    } catch (apiError) {
      console.warn('⚠️ Logout (session) request error:', apiError.message);
    }

    removeToken();
    sessionStorage.clear();

    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    console.log('🔓 Logout completed successfully');
    return true;

  } catch (error) {
    console.error('❌ Logout error:', error);
    removeToken();
    return false;
  }
}

import { PrayerTimesCore } from './js/prayer-time/core.js';
// Import PrayerTimeAPI from the global window object since ES6 modules are having issues
const PrayerTimesAPI = window.PrayerTimesAPI || window.prayerTimeAPI?.constructor;
import { PrayerTimesLocation } from './js/prayer-time/location.js';
import { PrayerTimesCalculator } from './js/prayer-time/prayer-times.js';
import { PrayerTimesAudio } from './js/prayer-time/audio.js';
import { AudioSettingsUI } from './js/prayer-time/audio-settings-ui.js';
import { PrayerTimesNotifications } from './js/prayer-time/notifications.js';
import { PrayerTimesLogging } from './js/prayer-time/prayer-logging.js';
import { PrayerTimesSettings } from './js/prayer-time/settings.js';
import { PrayerTimesI18N } from './js/prayer-time/i18n.js';
import { PrayerTimesUIComponents } from './js/prayer-time/ui-components.js';
import { NotificationStatusDashboard } from './js/prayer-time/notification-status.js';

(() => {
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    "use strict";
    console.log("[Main] Initializing Prayer Times App");

    // Initialize logout functionality
    initLogout();

    // --- Early: handle URL param (LOG_PRAYER) ---
    {
      const urlParams = new URLSearchParams(window.location.search);
      const prayerToLog = urlParams.get("log");
      if (prayerToLog) {
        // This will be handled by prayer logging module after initialization
        console.log("[Main] URL param: log", prayerToLog);
        history.replaceState(null, "", window.location.pathname); // prevent repeat
      }
    }
    // --------------------------------------------------------------------------

    // Initialize core
    console.log("[Main] Initializing core module");
    const core = new PrayerTimesCore();
    core.initToastStyles();

    // Initialize API
    console.log("[Main] Initializing API module");
    const api = new PrayerTimesAPI();

    // Initialize modules
    console.log("[Main] Initializing all modules");
    const location = new PrayerTimesLocation(core, api);
    const calculator = new PrayerTimesCalculator(core, api, location);
    const audio = new PrayerTimesAudio(core);
    // Expose single shared instance globally for UI and SW
    window.adhanAudioPlayer = audio;
    const notifications = new PrayerTimesNotifications(core, api);
    // Expose for settings to use on dynamic changes
    core.notifications = notifications;
    const logging = new PrayerTimesLogging(core, api);
    const settings = new PrayerTimesSettings(core, api);
    const i18n = new PrayerTimesI18N(core);
    const uiComponents = new PrayerTimesUIComponents(core);
    const audioUI = new AudioSettingsUI(core, audio);  // Initialize after settings

    // Connect modules
    console.log("[Main] Connecting module callbacks");
    location.refreshPrayerTimesByLocation = calculator.refreshPrayerTimesByLocation.bind(calculator);
    calculator.onAdhanPlay = () => {
      console.log("[Main] Adhan play callback triggered");
      audio.playAdhan(localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3");
    };
    audio.onSubscriptionUpdate = () => {
      console.log("[Main] Audio subscription update callback triggered");
      notifications.sendSubscriptionToServer(true).catch(() => {});
    };
    calculator.onSubscriptionUpdate = () => {
      console.log("[Main] Calculator subscription update callback triggered");
      notifications.sendSubscriptionToServer(true).catch(() => {});
    };

    // Connect settings callbacks
    settings.onClockFormatChange = () => {
      if (core.state.times) {
        calculator.applyData({ times: core.state.times, periods: core.state.periods, dateMeta: core.state.dateMeta }, core.state.cityLabel);
      }
    };
    settings.onMethodChange = core.debounce(() => {
      if (core.state.locationData) {
        calculator.refreshPrayerTimesByLocation(core.state.locationData);
      }
      if (core.el.notifToggle?.checked) {
        notifications.sendSubscriptionToServer(true).catch(() => {});
      }
    }, 500); // 500ms debounce
    settings.onMadhabChange = core.debounce(() => {
      if (core.state.locationData) {
        calculator.refreshPrayerTimesByLocation(core.state.locationData);
      }
      if (core.el.notifToggle?.checked) {
        notifications.sendSubscriptionToServer(true).catch(() => {});
      }
    }, 500); // 500ms debounce
    settings.onReminderChange = () => {
      if (core.el.notifToggle?.checked) {
        notifications.sendSubscriptionToServer(true).catch(() => {});
      }
    };

    // Setup service worker message handlers (after modules are initialized)
    console.log("[Main] Setting up service worker message handlers");
    if (navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === "function") {
      navigator.serviceWorker.addEventListener("message", (event) => {
        console.log("[Main] Service worker message received:", event.data);
        if (event.data?.type === "LOG_PRAYER" && event.data.prayer) {
          console.log("[Main] Handling LOG_PRAYER message");
          logging.logPrayerAsCompleted(event.data.prayer);
        } else if (event.data?.type === "PLAY_ADHAN") {
          // Audio module already handles PLAY_ADHAN messages via its own SW listener
          // This handler is kept only for logging and toast notification
          console.log("[Main] PLAY_ADHAN message received (handled by audio module)");
          
          if (event.data.fromNotification) {
            console.log("[Main] Playing adhan from notification click");
            core.toast("success", "Adhan playing from notification");
          }
          // Don't call audio.playAdhan() here - let the audio module handle it to avoid race conditions
        }
      });
    }

    // Handle URL params (after modules are initialized)
    console.log("[Main] Handling URL parameters");
    {
      const urlParams = new URLSearchParams(window.location.search);
      const prayerToLog = urlParams.get("log");
      if (prayerToLog) {
        console.log("[Main] Processing URL log parameter:", prayerToLog);
        logging.logPrayerAsCompleted(prayerToLog);
        history.replaceState(null, "", window.location.pathname); // prevent repeat
      }
    }

    // Initialize all modules
    console.log("[Main] Initializing all modules");
    await settings.initialize();
    // Ensure settings listeners are attached after UI is present
    settings.attachListeners?.();
    calculator.initialize();
    await i18n.initialize();
    await audio.initialize();
    // Pass settings instance to audioUI for saving
    core.settings = settings;
    await audioUI.initialize();
    await notifications.initialize();
    await logging.initialize();
    uiComponents.initialize();

    // Initialize notification status dashboard
    console.log("[Main] Initializing notification status dashboard");
    const statusDashboard = new NotificationStatusDashboard(core, api);
    window.__statusDashboard = statusDashboard;

    // Check if user is authenticated before initializing (session-based)
    if (window.tokenManager?.isAuthenticated()) {
      console.log("[Main] User authenticated, initializing notification status dashboard");
      await statusDashboard.initialize();
    } else {
      console.log("[Main] User not authenticated, will retry notification status dashboard initialization");

      // Retry initialization when user becomes authenticated
      const checkAuth = setInterval(() => {
        if (window.tokenManager?.isAuthenticated()) {
          console.log("[Main] User now authenticated, initializing notification status dashboard");
          statusDashboard.initialize();
          clearInterval(checkAuth);
        }
      }, 2000);

      // Stop checking after 30 seconds
      setTimeout(() => {
        clearInterval(checkAuth);
      }, 30000);
    }

    // Setup location search
    console.log("[Main] Setting up location search");
    location.setupLocationSearch();
    location.setupLegacySearch();

    // Find location on startup
    console.log("[Main] Finding location on startup");
    await location.findLocationOnStartup();

    // Public debug API
    console.log("[Main] Setting up public debug API");
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

    console.log("[Main] Prayer Times App initialization completed successfully");
  }

  // Initialize logout functionality
  function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        // Show confirmation dialog
        if (confirm('Are you sure you want to logout?')) {
          // Show loading state
          const originalText = logoutBtn.innerHTML;
          logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
          logoutBtn.disabled = true;

          try {
            // Call enhanced logout function
            const success = await logout();

            if (success) {
              // Show success message
              alert('You have been logged out successfully.');

              // Redirect to home page
              window.location.href = 'index.html';
            } else {
              // This should rarely happen now since we handle errors gracefully
              console.warn('Logout completed with some issues, but data was cleared');
              alert('You have been logged out. Redirecting...');
              window.location.href = 'index.html';
            }
          } catch (error) {
            console.error('Logout error:', error);
            // Even if there's an error, clear local data and redirect
            removeToken();
            alert('You have been logged out. Redirecting...');
            window.location.href = 'index.html';
          }
        }
      });
    }
  }

})();