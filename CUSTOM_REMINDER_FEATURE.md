# Custom Reminder Time Feature

## ✅ Implementation Complete

You can now set reminder times with preset values (5, 10, 15, 20 minutes) or enter a **custom value from 1 to 60 minutes** (up to 1 hour) before prayer!

## 🎯 How to Use

### Method 1: Preset Values (Quick)
1. Go to http://localhost:3000/prayer-time.html
2. Scroll to "Settings" section
3. Find "Pre-Prayer Reminder" dropdown
4. Choose from preset options:
   - No Reminder
   - 5 minutes before
   - 10 minutes before
   - 15 minutes before
   - 20 minutes before

### Method 2: Custom Value (Flexible - 1 to 60 minutes)
1. In the same dropdown, select **"Custom..."**
2. A number input box will appear next to the dropdown
3. Enter **any value** between 1 and 60 minutes
   - Examples:
     - `3` = 3 minutes before
     - `7` = 7 minutes before
     - `12` = 12 minutes before
     - `25` = 25 minutes before
     - `30` = 30 minutes before
     - `45` = 45 minutes before
     - `60` = 1 hour before (maximum)
4. Press Enter or click outside the box
5. The dropdown will update to show your custom value
6. Setting is automatically saved

## 📋 Examples

### Scenario 1: Short Notice
```
Want a quick reminder just before prayer?
→ Select "Custom..." → Enter "2" → Done!
→ You'll get reminded 2 minutes before each prayer
```

### Scenario 2: Work Schedule
```
Need to prepare for prayer during work hours?
→ Select "Custom..." → Enter "30" → Done!
→ You'll get reminded 30 minutes before to prepare
```

### Scenario 3: Morning Fajr
```
Want to wake up well before Fajr prayer?
→ Select "Custom..." → Enter "45" → Done!
→ You'll get reminded 45 minutes before Fajr
```

### Scenario 4: Maximum Advance Notice
```
Want maximum preparation time?
→ Select "Custom..." → Enter "60" → Done!
→ You'll get reminded 1 hour before (maximum allowed)
```

## 🔧 Technical Details

### Validation
- **Minimum:** 1 minute before
- **Maximum:** 60 minutes (1 hour) before
- Invalid values will show an error message
- The system will only accept integer values between 1-60

### How It Works
1. When you enter a custom value, the system:
   - Validates the input (1-60 range)
   - Creates a new option in the dropdown with your value
   - Saves the setting to your user preferences
   - Updates all active notification subscriptions
   - Reschedules all prayer reminders with the new timing

2. The reminder applies to:
   - ✅ All enabled prayers (Fajr, Dhuhr, Asr, Maghrib, Isha)
   - ✅ All your devices (Chrome, Firefox, etc.)
   - ✅ Background notifications (when browser is running)

### Server-Side Support
The backend already supports **any integer value** for `reminderMinutes`:
- No hard-coded limits in the scheduler
- Dynamically calculates reminder time: `prayerTime - reminderMinutes`
- Works with cron scheduling for exact timing
- Supports all browsers and devices simultaneously

## 🎨 UI Behavior

### Loading Existing Custom Values
- If you previously set a custom value (e.g., 25 minutes)
- When you reload the page, the custom input will show your value
- The dropdown will display: "25 minutes before (custom)"

### Multiple Custom Values
- You can change custom values as many times as you want
- Each change creates a new option in the dropdown
- Old custom values remain available for quick re-selection

### Resetting to Preset
- Simply select any preset value from the dropdown
- The custom input will hide automatically
- Your custom values are still available in the dropdown

## 📊 Real-World Examples

### Example 1: Software Developer Schedule
```
Fajr: 1 hour before (60 min) - Extra preparation time
Dhuhr: 10 minutes before - Quick reminder during work
Asr: 15 minutes before - Wrap up current task
Maghrib: 5 minutes before - End of day reminder
Isha: 30 minutes before - Evening wind-down time
```

### Example 2: Student Schedule
```
All prayers: 20 minutes before
→ Enough time to finish study session and prepare
```

### Example 3: Night Shift Worker
```
Fajr: 2 hours before (120 min) - Plan to wake up early
Other prayers: 30 minutes before - Sufficient prep time
```

### Example 4: Traveler/Frequent Timezone Changes
```
All prayers: 1 minute before - Instant notification
→ Useful when in unfamiliar locations with changing times
```

## ⚙️ Settings Persistence

Your custom reminder time is saved:
- ✅ In your user account (database)
- ✅ Across all devices and browsers
- ✅ Persists after logout/login
- ✅ Synced in real-time when changed

## 🔔 Notification Behavior

With custom reminder times:

### Reminder Notification
```
Title: ⏰ 25 min until 🌅 Fajr Prayer Time
Body: Prepare for Fajr prayer
      📍 Dubai, United Arab Emirates
      🕐 5:30 AM
```

### Main Prayer Notification (at prayer time)
```
Title: 🌅 Fajr Prayer Time
Body: It's time for Fajr prayer
      Start your day with Allah's blessings
      📍 Dubai, United Arab Emirates
      🕐 5:30 AM
```

## 🚀 Testing Your Custom Reminder

### Quick Test (2-minute reminder)
1. Set custom reminder to **2 minutes**
2. Look at current time on your device
3. Find the next upcoming prayer time
4. Calculate: prayer time - 2 minutes = reminder time
5. Wait until reminder time
6. You should receive notification exactly 2 minutes before prayer!

### Live Test (with "Test Scheduled Reminder" button)
1. Click "Test Scheduled Reminder (2 min)" button
2. Set your actual reminder to any custom value (e.g., 25 minutes)
3. Wait for the next real prayer time
4. You'll receive reminder 25 minutes before prayer ✅

## 💡 Pro Tips

### Tip 1: Different Times for Different Prayers
Currently, the system uses one reminder time for all prayers. However, the infrastructure supports per-prayer customization. Future enhancement can add individual reminder times per prayer.

### Tip 2: Combine with Browser Background
- Enable Chrome "Continue running background apps"
- Set custom reminder to any value
- Close all Chrome windows
- Chrome stays running → You receive reminders even when browser is "closed"!

### Tip 3: Multi-Device Different Timings
- Login on multiple devices
- Each device can have different reminder settings (future feature)
- For now, all devices use the same reminder time for consistency

### Tip 4: No Reminder Option
- Select "No Reminder" (0 minutes)
- You'll ONLY get the notification at exact prayer time
- No advance reminder will be sent

## 🔍 Debugging Custom Reminders

### Server Logs Show:
```
[PrayerScheduler] Scheduling for user@example.com in Asia/Dubai:
🕐 [PrayerScheduler] Reminder minutes: 25
🕐 [PrayerScheduler] fajr: 5:30 AM (330 minutes from midnight)
⏰ [PrayerScheduler] Scheduling fajr reminder at 5:05 AM (25 minutes before)
✅ [PrayerScheduler] fajr reminder scheduled for 5:05 AM in Asia/Dubai
```

### Browser Console Shows:
```
[CustomReminder] Set to 25 minutes before prayer
[Settings] Saved user settings with reminderMinutes: 25
[Notifications] Updating server preferences with reminderMinutes: 25
```

## 📖 Summary

✅ **Flexible:** Any value from 1 to 60 minutes (1 hour)
✅ **Easy:** Simple dropdown + custom input interface
✅ **Reliable:** Server-side validation and scheduling
✅ **Multi-Device:** Works across all browsers and devices
✅ **Persistent:** Saved in user account, survives logout
✅ **Real-Time:** Takes effect immediately when changed

**No restrictions - set exactly the reminder time you need!** ⏰🕌

