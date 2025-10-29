# Debugging Missing Prayer Time Notification

## Issue
User received pre-prayer reminder but did NOT receive the actual prayer time notification and no adhan was played.

## Expected Behavior
1. User receives pre-prayer reminder (e.g., at 6:57 PM)
2. User receives main prayer notification at exact prayer time (e.g., 7:00 PM) 
3. Adhan audio should play

## Possible Causes

### 1. Cron Job Not Firing
- The cron job scheduled for the exact prayer time might not be executing
- Check server logs for: `🔔 [PrayerScheduler] ${prayerName} time! Cron fired at...`

### 2. Subscription Issues
- Subscriptions might be marked as inactive
- Check logs for: `📬 [PrayerScheduler] Reloaded X fresh subscription(s) from DB`

### 3. Per-Prayer Toggle Disabled
- User might have the specific prayer disabled in settings
- Check logs for: `📬 [PrayerScheduler] Sending to ${enabledSubs.length} subscription(s) in parallel`
- If `enabledSubs.length` is 0, the prayer is disabled

### 4. Adhan Not Playing
- Audio might be disabled in user preferences
- Service worker might not be receiving the notification

## What to Check

### Server Logs
Look for these log entries around prayer time:

```
🔔 [PrayerScheduler] isha time! Cron fired at 2025-10-26T19:00:00.000Z
📬 [PrayerScheduler] Reloaded 2 fresh subscription(s) from DB
📬 [PrayerScheduler] Sending to 2 subscription(s) in parallel
✅ [PrayerScheduler] isha sent to ahmedothmanofff@gmail.com (123ms)
```

### User Preferences
Check if the prayer is enabled:
- User settings → Notification preferences
- Verify the specific prayer toggle is ON

### Subscription Status
Both Chrome and Firefox subscriptions should be ACTIVE:
```
[subscribe] User xxx now has 2 subscription(s):
  1. FCM(Chrome) - Active: true
  2. Mozilla(Firefox) - Active: true
```

## Quick Test Steps

1. Check server logs for scheduled prayer time
   - Look for: `⏰ [PrayerScheduler] Scheduling isha at 7:12 PM`

2. Check if cron fired at prayer time
   - Look for: `🔔 [PrayerScheduler] isha time! Cron fired at...`

3. Check subscription count
   - Look for: `📬 [PrayerScheduler] Reloaded X fresh subscription(s) from DB`
   - Should show 2 (Chrome + Firefox)

4. Check if notification was sent
   - Look for: `✅ [PrayerScheduler] isha sent to...`
   - Or: `❌ [PrayerScheduler] Failed to send...`

5. Check browser console for service worker messages
   - Open browser DevTools → Console
   - Look for service worker notification logs

## Fixes

### If cron job didn't fire:
- Timezone mismatch
- Server restart after scheduling
- Cron expression incorrect

### If subscriptions are inactive:
- Re-enable notifications in both browsers
- Check database for active status

### If prayer is disabled:
- Enable prayer in user settings
- Re-schedule notifications

### If notification sent but not received:
- Check browser notification permissions
- Check service worker is active
- Check browser console for errors




