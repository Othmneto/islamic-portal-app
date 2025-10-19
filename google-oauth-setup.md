# Google OAuth Setup Guide

## 🎯 **Step-by-Step Google OAuth Configuration**

### **Step 1: Get Google OAuth Credentials**

1. **Go to Google Cloud Console**: https://console.developers.google.com/
2. **Sign in** with your Google account: `ahmedothmanofff@gmail.com`
3. **Create a new project** (if needed):
   - Click project dropdown → "New Project"
   - Name: `Islamic Calendar App`
   - Click "Create"

4. **Enable Google Calendar API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click on it and "Enable"

5. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" user type
   - Fill in:
     - **App name**: `Islamic Calendar App`
     - **User support email**: `ahmedothmanofff@gmail.com`
     - **Developer contact**: `ahmedothmanofff@gmail.com`
   - Add scopes: `https://www.googleapis.com/auth/calendar`
   - Add test users: `ahmedothmanofff@gmail.com`

6. **Create OAuth Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: "Web application"
   - Name: `Islamic Calendar Web Client`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback`
     - `http://localhost:3000/authCallback.html`

### **Step 2: Update Environment Variables**

Create a `.env` file in your project root with:

```env
# OAuth Configuration - REPLACE WITH YOUR ACTUAL CREDENTIALS
GOOGLE_CLIENT_ID=your-actual-google-client-id-here
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret-here
OAUTH_REDIRECT_URL=http://localhost:3000/authCallback.html

# Other required variables
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/translator
DB_NAME=translator
CLIENT_ORIGIN=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-super-secret-session-key-here
```

### **Step 3: Test the Integration**

1. **Restart your server** after adding the credentials
2. **Go to your calendar**: http://localhost:3000/calendar.html
3. **Click the Google sync button** (fab fa-google)
4. **Authorize the app** when redirected to Google
5. **Your Google Calendar events should sync!**

### **Step 4: Verify the Setup**

Check that your Google Calendar events are now syncing by:
- Looking at the calendar display
- Checking the browser console for sync logs
- Verifying events appear with `source: 'google'`

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **"Invalid redirect URI"**:
   - Make sure the redirect URI in Google Console matches exactly
   - Check for typos in the URL

2. **"Access blocked"**:
   - Make sure you added your email as a test user
   - Check that the OAuth consent screen is configured

3. **"Invalid client"**:
   - Double-check your Client ID and Client Secret
   - Make sure there are no extra spaces in the .env file

4. **"Scope not authorized"**:
   - Make sure you added the Calendar scope in OAuth consent screen
   - The scope should be: `https://www.googleapis.com/auth/calendar`

## 📝 **Next Steps**

Once you have the credentials:
1. Update your `.env` file with the real credentials
2. Restart your server
3. Test the Google Calendar sync
4. Your events should now sync from your actual Google Calendar!
