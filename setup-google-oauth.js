#!/usr/bin/env node

/**
 * Google OAuth Setup Helper
 * This script helps you set up Google OAuth credentials for your calendar app
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Google OAuth Setup Helper');
console.log('============================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (!envExists) {
  console.log('📝 Creating .env file...');

  const envContent = `# Environment Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
MONGO_URI=mongodb://localhost:27017/translator
DB_NAME=translator

# Client Configuration
CLIENT_ORIGIN=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Security Configuration
SESSION_SECRET=${generateRandomString(32)}
JWT_SECRET=${generateRandomString(32)}
COOKIE_SECRET=${generateRandomString(32)}
COOKIE_DOMAIN=

# OAuth Configuration - REPLACE THESE WITH YOUR ACTUAL CREDENTIALS
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
OAUTH_REDIRECT_URL=http://localhost:3000/authCallback.html

# Email Configuration
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=your-email-username
EMAIL_PASS=your-email-password
EMAIL_FROM=Translator App <noreply@translator-app.com>

# Logging Configuration
LOG_LEVEL=info

# Security Features
ALLOW_NO_CSRF=false

# File Upload Limits
JSON_LIMIT=200kb
FORM_LIMIT=200kb`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
} else {
  console.log('✅ .env file already exists');
}

console.log('\n🎯 Next Steps:');
console.log('==============');
console.log('1. Go to: https://console.developers.google.com/');
console.log('2. Sign in with your Google account: ahmedothmanofff@gmail.com');
console.log('3. Create a new project or select existing one');
console.log('4. Enable Google Calendar API');
console.log('5. Create OAuth 2.0 credentials');
console.log('6. Set authorized redirect URIs:');
console.log('   - http://localhost:3000/api/auth/google/callback');
console.log('   - http://localhost:3000/authCallback.html');
console.log('7. Copy your Client ID and Client Secret');
console.log('8. Update the .env file with your credentials');
console.log('9. Restart your server');
console.log('10. Test the Google Calendar sync!');

console.log('\n📋 Required Scopes:');
console.log('- https://www.googleapis.com/auth/calendar');
console.log('- https://www.googleapis.com/auth/calendar.events');

console.log('\n🔗 Test URLs:');
console.log('- Calendar: http://localhost:3000/calendar.html');
console.log('- Google OAuth: http://localhost:3000/api/auth/google');

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
