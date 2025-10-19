# Prayer Times App - Modular Architecture

This directory contains the modularized version of the prayer-time.js application, split into logical, maintainable modules.

## Module Structure

### Core Modules

1. **core.js** - `PrayerTimesCore`
   - State management
   - DOM element references
   - Utility functions (toast, clearNode, debounce)
   - Location message display

2. **api.js** - `PrayerTimesAPI`
   - Unified authentication (JWT + session cookie)
   - API fetch wrapper with CSRF handling
   - User location saving

### Feature Modules

3. **location.js** - `PrayerTimesLocation`
   - Location detection (saved, IP, GPS)
   - Geocoding search and reverse geocoding
   - Location search UI and typeahead
   - Precise location handling

4. **prayer-times.js** - `PrayerTimesCalculator`
   - Prayer time calculations (server + local fallback)
   - Time formatting and display
   - Countdown timer
   - Data normalization and caching

5. **audio.js** - `PrayerTimesAudio`
   - Audio device management
   - Sound library and preview
   - Adhan playback
   - Volume and output device controls

6. **notifications.js** - `PrayerTimesNotifications`
   - Service worker registration
   - Push subscription management
   - Notification preferences
   - Test notifications

7. **prayer-logging.js** - `PrayerTimesLogging`
   - Prayer completion tracking
   - Click-to-log functionality
   - UI status updates

8. **settings.js** - `PrayerTimesSettings`
   - User preferences management
   - Settings migration from legacy format
   - Settings event listeners

9. **i18n.js** - `PrayerTimesI18N`
   - Language switching
   - Translation loading
   - DOM translation updates

10. **ui-components.js** - `PrayerTimesUIComponents`
    - Assistant modal
    - Modal management

## Main Entry Point

The main `prayer-time.js` file imports all modules and coordinates their interactions:

- Initializes all modules
- Connects module callbacks
- Handles service worker messages
- Manages URL parameters
- Provides public debug API

## Key Features Preserved

✅ **Complete functionality migration** - All original features preserved
✅ **Multi-layered location detection** - Saved, IP, GPS
✅ **Server + local fallback** - Adhan.js integration
✅ **Push notifications** - Service worker + VAPID
✅ **Prayer logging** - Click-to-log with authentication
✅ **Audio system** - Device routing + sound library
✅ **Settings management** - Legacy migration support
✅ **Internationalization** - Multi-language support
✅ **UI components** - Assistant modal
✅ **Countdown timer** - Real-time updates
✅ **Extended times** - Shurūq, worship periods

## Benefits of Modularization

1. **Maintainability** - Each module has a single responsibility
2. **Testability** - Modules can be tested independently
3. **Reusability** - Modules can be reused in other contexts
4. **Debugging** - Easier to isolate and fix issues
5. **Development** - Multiple developers can work on different modules
6. **Performance** - Potential for lazy loading in the future

## Module Dependencies

```
core.js (base)
├── api.js
├── location.js → prayer-times.js
├── audio.js
├── notifications.js
├── prayer-logging.js
├── settings.js
├── i18n.js
└── ui-components.js
```

## Usage

The modular version maintains the same public API as the original:

```javascript
window.__PrayerTimesApp = {
  refreshPrayerTimesByLocation,
  usePreciseLocation,
  setupNotifications,
  sendTestNotification,
  sendTestPrayerNotification,
  playAdhan,
  fetchAndUpdatePrayerLog,
  logPrayerAsCompleted,
};
```

All functionality has been preserved exactly as it was in the original monolithic file.
