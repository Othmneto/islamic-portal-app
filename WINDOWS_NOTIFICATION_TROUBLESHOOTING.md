# Windows Notification Troubleshooting Guide

## 🔍 Quick Diagnostic Steps

### Step 1: Run the Built-in Diagnostic Tool
1. Go to the prayer times page
2. Click the **"🔍 Run Full Diagnostics"** button
3. Review the diagnostic results for specific issues

### Step 2: Check Windows Notification Settings

#### Windows 10/11 Settings
1. **Press `Windows + I`** to open Settings
2. Go to **System > Notifications & actions**
3. Make sure **"Get notifications from apps and other senders"** is **ON**
4. Scroll down to **"Get notifications from these senders"**
5. Find your browser (Chrome/Comet/Edge) and ensure it's **ON**

#### Focus Assist (Do Not Disturb)
1. **Press `Windows + A`** to open Action Center
2. Look for **Focus Assist** icon (moon icon)
3. If it's **ON**, click it to turn **OFF**
4. Or go to Settings > System > Focus Assist and disable it

### Step 3: Browser-Specific Settings

#### For Comet Browser
1. Open Comet Browser
2. Go to **Settings** (three dots menu)
3. Navigate to **Privacy & Security**
4. Find **Notifications** section
5. Ensure **"Ask before sending"** is enabled
6. Check **"Allowed"** sites include your website

#### For Chrome/Edge
1. Click the **lock icon** in the address bar
2. Set **Notifications** to **"Allow"**
3. Or go to **Settings > Privacy and security > Site settings > Notifications**
4. Add your site to **"Allowed"** list

### Step 4: Test Basic Notifications

#### Test 1: Browser Permission
1. Go to your website
2. Look for a notification permission prompt
3. Click **"Allow"** if prompted
4. If no prompt appears, the permission might be blocked

#### Test 2: Manual Notification Test
1. On the prayer times page, click **"Test Basic Notification"**
2. You should see a notification appear immediately
3. If not, there's a system-level block

#### Test 3: Server Notification Test
1. Click **"Test Server Notification"**
2. This tests the full push notification system
3. Should work even with browser closed (background notifications)

## 🚨 Common Issues & Solutions

### Issue 1: "Permission denied" or no notification prompt
**Solution:**
- Check Windows Focus Assist is OFF
- Check browser notification settings
- Try refreshing the page
- Clear browser cache and cookies

### Issue 2: Notifications work in browser but not when closed
**Solution:**
- This is expected behavior for some browsers
- Chrome/Edge: Should work in background
- Firefox: May be delayed when browser is closed
- Safari: Limited background support

### Issue 3: "Notifications are blocked" error
**Solution:**
1. Go to browser settings
2. Find "Site settings" or "Privacy & Security"
3. Look for "Notifications"
4. Add your site to "Allowed" list
5. Refresh the page

### Issue 4: Notifications appear but disappear quickly
**Solution:**
- Check Windows notification duration settings
- Go to Settings > System > Notifications & actions
- Adjust "Show notification banners" duration

## 🔧 Advanced Troubleshooting

### Reset Browser Notifications
1. Go to browser settings
2. Find "Site settings" or "Privacy & Security"
3. Look for "Notifications"
4. Click "Reset permissions" or "Clear data"
5. Refresh the website and allow notifications again

### Windows Registry Fix (Advanced)
If notifications are completely blocked:
1. Press `Windows + R`
2. Type `regedit` and press Enter
3. Navigate to: `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings`
4. Look for your browser's entry
5. Set the value to `1` (enabled)

### Check Windows Event Logs
1. Press `Windows + R`
2. Type `eventvwr.msc` and press Enter
3. Go to **Windows Logs > System**
4. Look for notification-related errors

## 📱 Browser-Specific Notes

### Comet Browser (Windows)
- Based on Chromium, should work like Chrome
- May have additional privacy settings
- Check Comet-specific notification settings

### Chrome/Edge
- Full background notification support
- Should work even when browser is closed
- Uses FCM (Firebase Cloud Messaging)

### Firefox
- Good notification support
- May be delayed when browser is fully closed
- Uses Mozilla Push Service

### Safari (macOS only)
- Limited Web Push support
- Requires macOS Ventura (13) or later
- May only work when browser is running

## ✅ Verification Steps

### Step 1: Check Diagnostic Results
The diagnostic tool will show:
- ✅ Basic API Support
- ✅ Permission Status  
- ✅ Service Worker Status
- ✅ Push Subscription Status
- ✅ Browser-Specific Tests
- ✅ Platform-Specific Tests
- ✅ Notification Display Test

### Step 2: Test Background Notifications
1. Enable notifications on the website
2. Close the browser completely
3. Wait for a scheduled prayer time notification
4. The notification should appear even with browser closed

### Step 3: Check Notification History
1. Go to the notification status dashboard
2. Check the "History" section
3. Look for successful notification deliveries
4. This confirms the system is working

## 🆘 Still Not Working?

### Last Resort Solutions
1. **Try a different browser** (Chrome, Firefox, Edge)
2. **Check Windows version** (Windows 10/11 required)
3. **Update browser** to latest version
4. **Restart computer** to reset notification system
5. **Check antivirus software** (may block notifications)

### Contact Support
If none of the above works:
1. Run the diagnostic tool and save the results
2. Note your browser version and Windows version
3. Check if other websites can send notifications
4. The issue may be system-level (Windows or browser)

## 📊 Expected Behavior

### ✅ Working Correctly
- Notifications appear immediately when testing
- Notifications work with browser closed (background)
- No error messages in console
- Diagnostic tool shows all tests passing

### ❌ Not Working
- No notifications appear at all
- "Permission denied" errors
- Notifications only work when browser is open
- Diagnostic tool shows failed tests

---

**Remember:** The system is designed to work across all major desktop browsers on Windows, macOS, and Linux. If you're still having issues after following this guide, the problem is likely at the system level (Windows settings, browser settings, or antivirus software).





