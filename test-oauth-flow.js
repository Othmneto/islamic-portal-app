#!/usr/bin/env node
// Test script to verify Microsoft OAuth flow

const dotenv = require('dotenv');
dotenv.config();

console.log('🔍 Testing Microsoft OAuth Flow');
console.log('================================');

// Test 1: Check environment variables
console.log('\n1. Environment Variables:');
console.log(`   MICROSOFT_CLIENT_ID: ${process.env.MICROSOFT_CLIENT_ID ? 'SET' : 'MISSING'}`);
console.log(`   MICROSOFT_CLIENT_SECRET: ${process.env.MICROSOFT_CLIENT_SECRET ? 'SET' : 'MISSING'}`);

// Test 2: Generate OAuth URL
const clientId = process.env.MICROSOFT_CLIENT_ID;
const redirectUri = 'http://localhost:3000/api/auth/microsoft/callback';
const scope = 'openid email profile';
const state = 'test-state-123';

const oauthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
  `response_type=code&` +
  `client_id=${clientId}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `scope=${encodeURIComponent(scope)}&` +
  `state=${state}`;

console.log('\n2. Generated OAuth URL:');
console.log(`   ${oauthUrl}`);

// Test 3: Check if server is running
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/debug/oauth-config',
  method: 'GET'
};

console.log('\n3. Testing server connection...');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`   Server Status: ${res.statusCode}`);
    if (res.statusCode === 200) {
      const config = JSON.parse(data);
      console.log(`   Microsoft OAuth Config: ${JSON.stringify(config.microsoft, null, 2)}`);
    }

    console.log('\n4. Next Steps:');
    console.log('   1. Make sure the redirect URI is configured in Azure:');
    console.log(`      ${redirectUri}`);
    console.log('   2. Test the OAuth URL in your browser:');
    console.log(`      ${oauthUrl}`);
    console.log('   3. Check server console for any error messages');
  });
});

req.on('error', (err) => {
  console.log(`   Server Error: ${err.message}`);
  console.log('   Make sure the server is running: npm start');
});

req.end();

