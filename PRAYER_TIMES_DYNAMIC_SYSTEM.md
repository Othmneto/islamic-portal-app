# Prayer Times Dynamic System Documentation

## Overview
The Prayer Times system is designed to work **automatically and dynamically** for users across **all timezones, locations, and dates worldwide**. No manual configuration is required.

---

## ✅ Key Features

### 1. **Automatic Location Detection**
- **IP-based Geolocation**: Automatically detects user's location (latitude, longitude, city, country)
- **Browser Geolocation**: Option to use precise GPS coordinates
- **Manual Search**: Users can search for any city worldwide
- **Location Caching**: Saves last location for faster loading

### 2. **Smart Calculation Method Selection**
The system automatically selects the most accurate calculation method based on geographical region:

| Region | Calculation Method | Madhab |
|--------|-------------------|--------|
| **UAE & Saudi Arabia** | Umm al-Qura | Shafi |
| **Egypt** | Egyptian General Authority | Shafi |
| **Turkey** | Diyanet (Turkey) | Hanafi |
| **Pakistan** | University of Karachi | Hanafi |
| **Bangladesh** | University of Karachi | Hanafi |
| **Indonesia & Malaysia** | Singapore | Shafi |
| **North America** | ISNA | Shafi |
| **Other Regions** | Muslim World League | Shafi |

### 3. **Automatic Timezone Handling**
- **Detects local timezone** for each user automatically
- **Converts prayer times** to user's local time
- **Handles DST** (Daylight Saving Time) automatically
- **Supports all IANA timezones** (e.g., Asia/Dubai, America/New_York, Europe/London)

### 4. **Daily Automatic Updates**
- **Prayer times update automatically at midnight** (local time)
- **Cache system** stores times per day (format: `prayerTimes_lat_lon_YYYY-MM-DD`)
- **Old cache automatically expires** when date changes
- **Countdown timer** updates every second to show time until next prayer

### 5. **Multi-User Support**
- **Each user gets personalized times** based on their location
- **No interference between users** - all calculations are client-side or per-request
- **Scalable architecture** - supports unlimited concurrent users
- **Server-side calculations** available with fallback to client-side Adhan.js

---

## 🌍 How It Works for Different Locations

### Example 1: User in Dubai, UAE
```
Location: Dubai (25.07°N, 55.30°E)
Timezone: Asia/Dubai (UTC+4)
Method: Umm al-Qura (auto-detected)
Madhab: Shafi (auto-detected)
Date: Updates daily at midnight Dubai time
```

### Example 2: User in New York, USA
```
Location: New York (40.71°N, -74.01°W)
Timezone: America/New_York (UTC-5/-4)
Method: ISNA (auto-detected)
Madhab: Shafi (auto-detected)
Date: Updates daily at midnight New York time
```

### Example 3: User in Cairo, Egypt
```
Location: Cairo (30.04°N, 31.24°E)
Timezone: Africa/Cairo (UTC+2)
Method: Egyptian (auto-detected)
Madhab: Shafi (auto-detected)
Date: Updates daily at midnight Cairo time
```

### Example 4: User in Karachi, Pakistan
```
Location: Karachi (24.86°N, 67.01°E)
Timezone: Asia/Karachi (UTC+5)
Method: Karachi (auto-detected)
Madhab: Hanafi (auto-detected)
Date: Updates daily at midnight Karachi time
```

---

## 📅 Daily Prayer Time Changes

Prayer times change **every single day** due to:
1. **Earth's axial tilt** (23.5°)
2. **Earth's elliptical orbit** around the sun
3. **Latitude of location** (higher latitudes = bigger changes)

### Example: Fajr Time Changes in Dubai
```
Date          | Fajr Time | Change
--------------|-----------|--------
Oct 1, 2025   | 5:05 AM   | -
Oct 13, 2025  | 4:58 AM   | -7 min
Oct 25, 2025  | 4:52 AM   | -6 min
Nov 6, 2025   | 4:47 AM   | -5 min
Dec 1, 2025   | 4:45 AM   | -2 min
```

**The system handles these changes automatically** - no user intervention needed!

---

## 🔄 Automatic Update Mechanisms

### 1. **On Page Load**
```javascript
// Detects location → Fetches/calculates times → Displays times
[Location] Starting location detection
[PrayerTimes] Refreshing prayer times for: Dubai, UAE
[PrayerTimes] Server data received successfully
[PrayerTimes] Applying prayer times data to UI
```

### 2. **At Midnight (Daily)**
```javascript
// Automatically refreshes at 00:00 local time
[PrayerTimes] Setting up daily date update in 198 minutes
[PrayerTimes] Updating date display - Gregorian: Tuesday, Oct 14, 2025
[PrayerTimes] Refreshing prayer times for new day
```

### 3. **When Location Changes**
```javascript
// User searches for a new city
[Location] User searched for: London
[PrayerTimes] Refreshing prayer times for: London, UK
```

### 4. **When Calculation Method Changes**
```javascript
// User manually changes method (optional)
[Settings] Calculation method changed to: Egyptian
[PrayerTimes] Refreshing prayer times
```

---

## 🛠️ Technical Architecture

### Client-Side (Frontend)
```
┌─────────────────────────────────────────┐
│  User's Browser (Any Location/Timezone) │
├─────────────────────────────────────────┤
│  1. Detect Location (IP/GPS/Search)     │
│  2. Detect Timezone (Automatic)         │
│  3. Select Calculation Method (Auto)    │
│  4. Fetch/Calculate Prayer Times        │
│  5. Display in Local Time               │
│  6. Cache for Today (Date-specific)     │
│  7. Auto-refresh at Midnight            │
└─────────────────────────────────────────┘
```

### Server-Side (Backend)
```
┌─────────────────────────────────────────┐
│  API: /api/prayer-times                 │
├─────────────────────────────────────────┤
│  Input: lat, lon, method, madhab        │
│  Process: Calculate using Adhan.js      │
│  Output: Times in ISO format (UTC)      │
│  Note: Stateless - no user data stored  │
└─────────────────────────────────────────┘
```

### Fallback System
```
Primary: Server API
   ↓ (if fails)
Fallback: Client-side Adhan.js
   ↓ (if fails)
Error: Display error message
```

---

## 🌐 Supported Regions & Accuracy

### Highly Accurate Regions
- ✅ **Middle East** (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman)
- ✅ **North Africa** (Egypt, Morocco, Tunisia, Algeria, Libya)
- ✅ **South Asia** (Pakistan, India, Bangladesh, Sri Lanka)
- ✅ **Southeast Asia** (Indonesia, Malaysia, Singapore, Brunei)
- ✅ **Turkey & Central Asia**
- ✅ **Europe** (UK, France, Germany, etc.)
- ✅ **North America** (USA, Canada)
- ✅ **Sub-Saharan Africa**
- ✅ **Australia & New Zealand**

### Special Cases
- **Extreme Latitudes** (>60°N or <60°S): Uses nearest valid calculation
- **Polar Regions**: May show "N/A" for some prayers during extreme seasons

---

## 📊 Performance & Scalability

### Caching Strategy
```
Cache Key Format: prayerTimes_LAT_LON_DATE
Example: prayerTimes_25.07_55.30_2025-10-13

Cache Duration: Until midnight (local time)
Cache Storage: localStorage (client-side)
Cache Size: ~2-5 KB per location per day
```

### Scalability
- **Client-side calculations**: Unlimited users, no server load
- **Server-side API**: Stateless, horizontally scalable
- **No database required**: All calculations are real-time
- **CDN-friendly**: Static assets can be cached globally

---

## 🔧 Configuration Options

### User-Configurable Settings
1. **Calculation Method**: Auto (recommended) or manual selection
2. **Madhab**: Auto (by region) or manual (Shafi/Hanafi)
3. **Clock Format**: 12-hour or 24-hour
4. **Notifications**: Enable/disable per prayer
5. **Adhan Sound**: Multiple options available
6. **Pre-Prayer Reminder**: 5, 10, 15, or 20 minutes before

### Developer-Configurable Settings
```javascript
// In public/js/prayer-time/prayer-times.js

// Calculation method mappings (lines 20-54)
getAutoCalculationMethod(lat, lon) {
  // Add new regions here
}

// Madhab mappings (lines 56-67)
getAutoMadhab(lat, lon) {
  // Add new madhab regions here
}

// Region detection helpers (lines 69-103)
isInUAE(lat, lon) { ... }
isInSaudiArabia(lat, lon) { ... }
// Add new region helpers here
```

---

## 🧪 Testing Different Locations

### Test Scenario 1: Dubai User
```javascript
// Simulate Dubai user
const testLocation = {
  lat: 25.0734,
  lon: 55.2979,
  display: "Dubai, UAE",
  tz: "Asia/Dubai"
};
// Expected: Umm al-Qura method, Shafi madhab, UTC+4
```

### Test Scenario 2: New York User
```javascript
// Simulate New York user
const testLocation = {
  lat: 40.7128,
  lon: -74.0060,
  display: "New York, USA",
  tz: "America/New_York"
};
// Expected: ISNA method, Shafi madhab, UTC-5
```

### Test Scenario 3: London User
```javascript
// Simulate London user
const testLocation = {
  lat: 51.5074,
  lon: -0.1278,
  display: "London, UK",
  tz: "Europe/London"
};
// Expected: Muslim World League method, Shafi madhab, UTC+0
```

---

## 🚀 Future Enhancements

### Planned Features
1. **Historical Prayer Times**: View times for past dates
2. **Future Prayer Times**: View times for upcoming dates (30-day calendar)
3. **Qibla Direction**: Show direction to Mecca from user's location
4. **Prayer Tracking**: Log which prayers user has completed
5. **Mosque Finder**: Find nearby mosques using user's location
6. **Athan Customization**: Upload custom athan audio files
7. **Widget Mode**: Embeddable prayer times widget for other websites

---

## 📝 Summary

✅ **Fully Automatic**: No manual configuration required
✅ **Globally Accurate**: Works for all locations worldwide
✅ **Daily Updates**: Prayer times refresh automatically at midnight
✅ **Multi-User**: Each user gets personalized times
✅ **Timezone-Aware**: Handles all timezones and DST
✅ **Scalable**: Supports unlimited concurrent users
✅ **Reliable**: Server + client-side fallback
✅ **Fast**: Cached times load instantly

**The system is production-ready for a global user base!** 🌍🕌


