# 🧪 Quick Testing Guide: 1-60 Minute Custom Reminders

## ✅ Server Status
- Server is running on port 3000
- All validation layers are active
- Ready for testing!

## 🎯 What to Test

### Test 1: Preset Values (Should Work)
1. Go to http://localhost:3000/prayer-time.html
2. Scroll to "Settings" → "Pre-Prayer Reminder"
3. Select from dropdown:
   - ✅ No Reminder
   - ✅ 5 minutes before
   - ✅ 10 minutes before
   - ✅ 15 minutes before
   - ✅ 20 minutes before

**Expected:** Settings save successfully, reminder scheduled

### Test 2: Custom Values - Valid Range (Should Work)
1. Select "Custom..." from dropdown
2. Enter these values one at a time:
   - ✅ `1` (minimum)
   - ✅ `7` (random low)
   - ✅ `30` (mid-range)
   - ✅ `45` (high)
   - ✅ `60` (maximum - 1 hour)

**Expected:** 
- Value accepted
- Custom option added to dropdown showing "X minutes before (custom)"
- Settings saved
- Reminder scheduled

### Test 3: Invalid Values - Below Range (Should Fail)
1. Select "Custom..." from dropdown
2. Try to enter:
   - ❌ `-1` (negative)
   - ❌ `0` in custom field (use "No Reminder" instead)

**Expected:**
- Error message: "Please enter a value between 1 and 60 minutes (maximum 1 hour before prayer)"
- Value cleared
- Setting not saved

### Test 4: Invalid Values - Above Range (Should Fail)
1. Select "Custom..." from dropdown
2. Try to enter:
   - ❌ `61` (just above max)
   - ❌ `100` (way above max)
   - ❌ `1440` (old 24-hour limit)

**Expected:**
- Error message: "Please enter a value between 1 and 60 minutes (maximum 1 hour before prayer)"
- Value cleared
- Setting not saved

### Test 5: Non-Numeric Values (Should Fail)
1. Select "Custom..." from dropdown
2. Try to enter:
   - ❌ `abc` (letters)
   - ❌ `30.5` (decimal - integers only)
   - ❌ Empty field

**Expected:**
- HTML5 validation prevents non-numeric input
- Decimal values may be rounded by browser
- Empty field doesn't trigger save

### Test 6: API Direct Test (Advanced)
Open browser console and run:

```javascript
// Test valid value
fetch('/api/user/notification-preferences', {
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reminderMinutes: 45 })
}).then(r => r.json()).then(console.log);

// Expected: { success: true, ... }
```

```javascript
// Test invalid value (too high)
fetch('/api/user/notification-preferences', {
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reminderMinutes: 100 })
}).then(r => r.json()).then(console.log);

// Expected: { success: false, errors: [...] } with 400 status
```

### Test 7: Multi-Browser Sync
1. Set custom reminder to `25` minutes in Chrome
2. Save and wait for confirmation
3. Open http://localhost:3000/prayer-time.html in Firefox
4. Check if reminder shows `25 minutes before (custom)`

**Expected:** Custom value syncs across browsers

### Test 8: Persistence Test
1. Set custom reminder to `17` minutes
2. Log out
3. Log back in
4. Check reminder setting

**Expected:** Custom value `17` is still selected

## 🔍 What to Look For

### Success Indicators ✅
- Dropdown shows your custom value after entering it
- Console shows: `[CustomReminder] Set to X minutes before prayer`
- Console shows: `[Settings] Saved user settings with reminderMinutes: X`
- No error messages
- Reminder scheduled in server logs

### Failure Indicators ❌
- Alert popup with error message
- Value gets cleared from input field
- Console shows validation errors
- Settings not saved to server
- Reminder not scheduled

## 📊 Server Logs to Monitor

Watch your server console for these messages:

**Successful Save:**
```
[PrayerScheduler] Received userPreferencesChanged event for user [userId]
[PrayerScheduler] Rescheduling notifications for user [userId]
⏰ [PrayerScheduler] Scheduling [prayer] reminder at [time]
✅ [PrayerScheduler] [prayer] reminder scheduled for [time]
```

**Validation Failure:**
```
400 Bad Request - Validation Error
Number must be less than or equal to 60
```

## 🎯 Edge Cases to Test

1. **Rapid Changes:** Change value multiple times quickly
   - Should save the last valid value
   
2. **Browser Reload:** Set custom value, reload page
   - Should persist the custom value
   
3. **Switch Between Custom and Preset:** 
   - Set custom `25` → switch to preset `10` → back to custom
   - Should remember last custom value
   
4. **Timezone Change:** Set reminder, change timezone
   - Reminder should remain same relative time
   
5. **Disable Then Re-enable:** 
   - Set `30` → select "No Reminder" → re-enable notifications
   - Should remember last custom value

## ✅ Validation Summary

| Layer | Location | Validates |
|-------|----------|-----------|
| HTML | `<input max="60">` | Browser-level max |
| JavaScript | `value <= 60` | Client-side validation |
| API Routes | `z.number().max(60)` | Server-side validation |
| Database | `max: 60` | Data persistence validation |

## 🚀 Quick Start

```bash
# 1. Server is already running on port 3000
# 2. Open browser: http://localhost:3000/prayer-time.html
# 3. Log in if not already logged in
# 4. Scroll to "Settings" section
# 5. Find "Pre-Prayer Reminder" dropdown
# 6. Select "Custom..." and start testing!
```

## 📝 Test Results Template

Copy this and fill in your results:

```
Test 1 - Preset Values: ✅ / ❌
Test 2 - Valid Custom Values (1, 7, 30, 45, 60): ✅ / ❌
Test 3 - Invalid Below Range (-1, 0): ✅ / ❌
Test 4 - Invalid Above Range (61, 100, 1440): ✅ / ❌
Test 5 - Non-Numeric Values: ✅ / ❌
Test 6 - API Direct Test: ✅ / ❌
Test 7 - Multi-Browser Sync: ✅ / ❌
Test 8 - Persistence Test: ✅ / ❌

Notes:
_____________________________________
_____________________________________
```

## 🎉 All Tests Passing = System Fully Aligned!

When all tests pass, you have:
- ✅ Frontend validation working
- ✅ Backend validation working  
- ✅ Database constraints enforced
- ✅ User experience is intuitive
- ✅ Multi-device sync operational
- ✅ Security layers active

---

**Happy Testing!** 🕌⏰





