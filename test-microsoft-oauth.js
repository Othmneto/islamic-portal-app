#!/usr/bin/env node
// Test script to verify Microsoft OAuth configuration

const dotenv = require('dotenv');
dotenv.config();

console.log('🔍 Microsoft OAuth Configuration Test');
console.log('=====================================');

// Check environment variables
const hasClientId = !!process.env.MICROSOFT_CLIENT_ID;
const hasClientSecret = !!process.env.MICROSOFT_CLIENT_SECRET;
const clientIdLength = process.env.MICROSOFT_CLIENT_ID?.length || 0;

console.log('\n📋 Environment Variables:');
console.log(`✅ MICROSOFT_CLIENT_ID: ${hasClientId ? 'SET' : '❌ MISSING'}`);
console.log(`✅ MICROSOFT_CLIENT_SECRET: ${hasClientSecret ? 'SET' : '❌ MISSING'}`);
console.log(`📏 Client ID Length: ${clientIdLength} characters`);

if (hasClientId) {
  console.log(`🔑 Client ID Prefix: ${process.env.MICROSOFT_CLIENT_ID.substring(0, 8)}...`);
}

if (!hasClientId || !hasClientSecret) {
  console.log('\n❌ ERROR: Missing required environment variables!');
  console.log('Please create a .env file with:');
  console.log('MICROSOFT_CLIENT_ID=your_client_id_here');
  console.log('MICROSOFT_CLIENT_SECRET=your_client_secret_here');
  process.exit(1);
}

// Validate Client ID format (should be a GUID)
const clientIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidClientId = clientIdRegex.test(process.env.MICROSOFT_CLIENT_ID);

console.log(`\n🔍 Client ID Format: ${isValidClientId ? '✅ Valid GUID' : '❌ Invalid format'}`);

if (!isValidClientId) {
  console.log('❌ ERROR: Client ID should be a valid GUID format (e.g., 12345678-1234-1234-1234-123456789abc)');
  process.exit(1);
}

// Test the OAuth URLs
const baseUrl = 'http://localhost:3000';
const redirectUri = `${baseUrl}/api/auth/microsoft/callback`;

console.log('\n🌐 OAuth URLs:');
console.log(`🔗 Authorization URL: https://login.microsoftonline.com/common/oauth2/v2.0/authorize`);
console.log(`🔗 Token URL: https://login.microsoftonline.com/common/oauth2/v2.0/token`);
console.log(`🔗 Redirect URI: ${redirectUri}`);

console.log('\n📝 Azure App Registration Checklist:');
console.log('1. ✅ Client ID matches environment variable');
console.log('2. ❓ Client Secret is correct (use the VALUE, not the ID)');
console.log('3. ❓ Redirect URI is configured in Azure:');
console.log(`   - ${redirectUri}`);
console.log('4. ❓ App registration supports both personal and work accounts');
console.log('5. ❓ Required permissions are granted');

console.log('\n🧪 Test OAuth Flow:');
console.log(`1. Start your server: npm start`);
console.log(`2. Visit: ${baseUrl}/api/debug/oauth-config`);
console.log(`3. Try login: ${baseUrl}/login.html`);
console.log(`4. Click "Sign in with Microsoft"`);

console.log('\n✅ Configuration test completed!');

