// Custom Microsoft OAuth implementation with proper state management
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config');
const User = require('../models/User');
const unifiedAuthService = require('../services/unifiedAuthService');

const router = express.Router();

// Microsoft OAuth configuration
const MICROSOFT_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/api/auth/microsoft/callback',
  scope: 'openid email profile User.Read',
  tenant: 'common'
};

// Generate Microsoft OAuth URL with secure state parameter
router.get('/', (req, res) => {
  console.log('🔵 Microsoft OAuth: Starting authentication');
  console.log('🔵 Microsoft OAuth Config:', {
    CLIENT_ID: MICROSOFT_CONFIG.clientId ? `${MICROSOFT_CONFIG.clientId.substring(0, 8)}...` : 'MISSING',
    CLIENT_SECRET: MICROSOFT_CONFIG.clientSecret ? 'SET' : 'MISSING',
    REDIRECT_URI: MICROSOFT_CONFIG.redirectUri,
    SCOPES: MICROSOFT_CONFIG.scope,
    TENANT: MICROSOFT_CONFIG.tenant
  });
  
  if (!MICROSOFT_CONFIG.clientId || !MICROSOFT_CONFIG.clientSecret) {
    console.error('❌ Microsoft OAuth credentials are not set!');
    return res.redirect('/login.html?error=microsoft_credentials_missing');
  }
  
  // Generate a secure random state parameter
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store the state in the session for verification
  if (!req.session) {
    console.error('❌ Session not available for state storage');
    return res.redirect('/login.html?error=session_required');
  }
  
  req.session.oauthState = state;
  console.log('🔵 Microsoft OAuth: Generated state parameter:', state.substring(0, 16) + '...');
  
  const authUrl = `https://login.microsoftonline.com/${MICROSOFT_CONFIG.tenant}/oauth2/v2.0/authorize?` +
    `client_id=${MICROSOFT_CONFIG.clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(MICROSOFT_CONFIG.redirectUri)}&` +
    `scope=${encodeURIComponent(MICROSOFT_CONFIG.scope)}&` +
    `response_mode=query&` +
    `state=${state}`;
  
  console.log('🔵 Microsoft OAuth: Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Handle Microsoft OAuth callback
router.get('/callback', async (req, res) => {
  console.log('🟡 Microsoft OAuth: Callback received');
  console.log('🟡 Callback Query:', req.query);
  console.log('🟡 Callback Headers:', req.headers);
  
  const { code, error, error_description, state } = req.query;
  
  if (error) {
    console.error('❌ Microsoft OAuth: Error from Microsoft:', error, error_description);
    return res.redirect('/login.html?error=microsoft_oauth_error');
  }
  
  if (!code) {
    console.error('❌ Microsoft OAuth: No authorization code received');
    return res.redirect('/login.html?error=microsoft_no_code');
  }
  
  // Verify state parameter to prevent CSRF attacks
  if (!req.session || !req.session.oauthState) {
    console.error('❌ Microsoft OAuth: No state found in session');
    return res.redirect('/login.html?error=microsoft_no_state');
  }
  
  if (state !== req.session.oauthState) {
    console.error('❌ Microsoft OAuth: State mismatch - potential CSRF attack');
    console.error('❌ Expected state:', req.session.oauthState.substring(0, 16) + '...');
    console.error('❌ Received state:', state ? state.substring(0, 16) + '...' : 'undefined');
    return res.redirect('/login.html?error=microsoft_state_mismatch');
  }
  
  // Clear the state from session after verification
  delete req.session.oauthState;
  
  console.log('✅ Microsoft OAuth: State verified successfully');
  console.log('✅ Microsoft OAuth: Authorization code received:', code.substring(0, 20) + '...');
  
  try {
    // Exchange code for access token
    console.log('🔄 Microsoft OAuth: Exchanging code for token');
    console.log('🔄 Token request params:', {
      client_id: MICROSOFT_CONFIG.clientId,
      client_secret: MICROSOFT_CONFIG.clientSecret ? 'SET' : 'MISSING',
      code: code.substring(0, 20) + '...',
      redirect_uri: MICROSOFT_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_CONFIG.scope
    });
    
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${MICROSOFT_CONFIG.tenant}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: MICROSOFT_CONFIG.clientId,
        client_secret: MICROSOFT_CONFIG.clientSecret,
        code: code,
        redirect_uri: MICROSOFT_CONFIG.redirectUri,
        grant_type: 'authorization_code',
        scope: MICROSOFT_CONFIG.scope
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('✅ Microsoft OAuth: Token response received');
    console.log('✅ Token response status:', tokenResponse.status);
    console.log('✅ Token response data keys:', Object.keys(tokenResponse.data));
    
    const { access_token, id_token } = tokenResponse.data;
    console.log('✅ Microsoft OAuth: Access token received:', access_token ? 'YES' : 'NO');
    console.log('✅ Microsoft OAuth: ID token received:', id_token ? 'YES' : 'NO');
    
    // Decode the ID token to get user information
    let profile;
    if (id_token) {
      console.log('🔍 Microsoft OAuth: Decoding ID token');
      try {
        // Decode JWT token (without verification for now)
        const base64Url = id_token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        profile = JSON.parse(jsonPayload);
        console.log('✅ Microsoft OAuth: Profile from ID token:', {
          sub: profile.sub,
          name: profile.name,
          email: profile.email,
          preferred_username: profile.preferred_username,
          allKeys: Object.keys(profile)
        });
      } catch (error) {
        console.error('❌ Microsoft OAuth: Error decoding ID token:', error);
        return res.redirect('/login.html?error=microsoft_token_decode_error');
      }
    } else {
      // Fallback to Microsoft Graph API
      console.log('🔄 Microsoft OAuth: Fetching user profile from Graph API');
      console.log('🔄 Graph API URL: https://graph.microsoft.com/v1.0/me');
      console.log('🔄 Access token length:', access_token ? access_token.length : 'N/A');
      
      try {
        const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        profile = profileResponse.data;
        console.log('✅ Microsoft OAuth: Profile from Graph API:', {
          id: profile.id,
          displayName: profile.displayName,
          mail: profile.mail,
          userPrincipalName: profile.userPrincipalName,
          allKeys: Object.keys(profile)
        });
      } catch (error) {
        console.error('❌ Microsoft OAuth: Error fetching from Graph API');
        console.error('❌ Error status:', error.response?.status);
        console.error('❌ Error data:', error.response?.data);
        console.error('❌ Error message:', error.message);
        return res.redirect('/login.html?error=microsoft_graph_api_error');
      }
    }
    
    // Find or create user
    const email = profile.email || profile.mail || profile.preferred_username || profile.userPrincipalName;
    console.log('🔍 Microsoft OAuth: Looking for email in profile');
    console.log('🔍 Available email fields:', {
      email: profile.email,
      mail: profile.mail,
      preferred_username: profile.preferred_username,
      userPrincipalName: profile.userPrincipalName
    });
    
    if (!email) {
      console.error('❌ Microsoft OAuth: No email found in profile');
      console.error('❌ Full profile object:', profile);
      return res.redirect('/login.html?error=microsoft_no_email');
    }
    
    console.log('✅ Microsoft OAuth: Email found:', email);
    console.log('🔄 Microsoft OAuth: Creating/updating user with unified service');
    
    // Create or update user directly
    const user = await unifiedAuthService.createOrUpdateUserFromOAuth(profile, 'microsoft', req.ip, req.get('User-Agent'));
    
    console.log('✅ Microsoft OAuth: User created/updated:', {
      userId: user._id,
      email: user.email,
      username: user.username,
      authProvider: user.authProvider
    });
    
    // Generate JWT token
    const payload = { user: { id: user._id } };
    
    jwt.sign(
      payload,
      env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) {
          console.error('❌ Microsoft OAuth: Token generation failed:', err);
          return res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Microsoft OAuth token generation failed'
            }
          });
        }
        
        console.log('✅ Microsoft OAuth: JWT token generated for user:', user._id, 'email:', user.email);
        
        // Verify the token was created correctly
        try {
          const decoded = jwt.verify(token, env.JWT_SECRET);
          console.log('🔍 Microsoft OAuth: Token verification test - decoded payload:', decoded);
        } catch (err) {
          console.error('❌ Microsoft OAuth: Token verification failed:', err);
        }
        
        // Redirect to success page
        const redirectBase = process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/authCallback.html';
        const redirectUrl = `${redirectBase}?token=${encodeURIComponent(token)}`;
        
        console.log('🎉 Microsoft OAuth: Redirecting to success:', redirectUrl);
        res.redirect(redirectUrl);
      }
    );
    
  } catch (error) {
    console.error('❌ Microsoft OAuth: Error processing callback');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error response status:', error.response?.status);
    console.error('❌ Error response data:', error.response?.data);
    console.error('❌ Full error object:', error);
    res.redirect('/login.html?error=microsoft_oauth_error');
  }
});

module.exports = router;
