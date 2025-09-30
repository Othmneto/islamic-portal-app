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

// Import logout functions from common.js
function getToken() {
  return localStorage.getItem('authToken') || 
         localStorage.getItem('token') || 
         localStorage.getItem('jwt') || 
         localStorage.getItem('access_token');
}

function removeToken() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('jwt');
  localStorage.removeItem('access_token');
  localStorage.removeItem('userData');
  localStorage.removeItem('userPreferences');
  localStorage.removeItem('savedLocations');
}

async function logout() {
  try {
    const token = getToken();
    
    if (token) {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log('✅ Logout API call successful');
        } else if (response.status === 401) {
          console.log('ℹ️ Token already expired, proceeding with client-side logout');
        } else {
          console.warn('⚠️ Logout API call failed, but continuing with client-side logout');
        }
      } catch (apiError) {
        console.warn('⚠️ Logout API call failed:', apiError.message);
      }
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
import { PrayerTimesAPI } from './js/prayer-time/api.js';
import { PrayerTimesLocation } from './js/prayer-time/location.js';
import { PrayerTimesCalculator } from './js/prayer-time/prayer-times.js';
import { PrayerTimesAudio } from './js/prayer-time/audio.js';
import { PrayerTimesNotifications } from './js/prayer-time/notifications.js';
import { PrayerTimesLogging } from './js/prayer-time/prayer-logging.js';
import { PrayerTimesSettings } from './js/prayer-time/settings.js';
import { PrayerTimesI18N } from './js/prayer-time/i18n.js';
import { PrayerTimesUIComponents } from './js/prayer-time/ui-components.js';

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
    const notifications = new PrayerTimesNotifications(core, api);
    const logging = new PrayerTimesLogging(core, api);
    const settings = new PrayerTimesSettings(core, api);
    const i18n = new PrayerTimesI18N(core);
    const uiComponents = new PrayerTimesUIComponents(core);

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
    settings.onMethodChange = () => {
      if (core.state.locationData) {
        calculator.refreshPrayerTimesByLocation(core.state.locationData);
      }
      if (core.el.notifToggle?.checked) {
        notifications.sendSubscriptionToServer(true).catch(() => {});
      }
    };
    settings.onMadhabChange = () => {
      if (core.state.locationData) {
        calculator.refreshPrayerTimesByLocation(core.state.locationData);
      }
      if (core.el.notifToggle?.checked) {
        notifications.sendSubscriptionToServer(true).catch(() => {});
      }
    };
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
          console.log("[Main] Handling PLAY_ADHAN message");
          const audioFile = event.data.audioFile || "/audio/adhan.mp3";
          const fromNotification = event.data.fromNotification || false;
          
          if (fromNotification) {
            console.log("[Main] Playing adhan from notification click");
            // Show a toast notification when adhan plays from notification
            core.toast("success", "Adhan playing from notification");
          }
          
          audio.playAdhan(audioFile);
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
    settings.initialize();
    calculator.initialize();
    await i18n.initialize();
    await audio.initialize();
    await notifications.initialize();
    await logging.initialize();
    uiComponents.initialize();

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
