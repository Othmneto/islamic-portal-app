// Enhanced Production-Grade OAuth Implementation
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { env } = require('../config');
const User = require('../models/User');

const router = express.Router();

// Enhanced OAuth configuration
const OAUTH_CONFIG = {
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${env.CLIENT_URL}/api/auth/microsoft/callback`,
    scope: 'openid email profile User.Read https://graph.microsoft.com/calendars.readwrite https://graph.microsoft.com/calendars.readwrite.shared',
    tenant: process.env.MICROSOFT_TENANT || 'common',
    authorizationUrl: 'https://login.microsoftonline.com',
    tokenUrl: 'https://login.microsoftonline.com',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${env.CLIENT_URL}/api/auth/google/callback`,
    scope: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
  }
};

// PKCE (Proof Key for Code Exchange) implementation
const generatePKCE = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
};

// Enhanced state management with nonce
const generateSecureState = () => {
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return { state, nonce, timestamp };
};

// Validate state parameter
const validateState = (receivedState, sessionState) => {
  if (!receivedState || !sessionState) return false;

  // Check if state matches
  if (receivedState !== sessionState.state) return false;

  // Check if state is not too old (5 minutes)
  const stateAge = Date.now() - sessionState.timestamp;
  if (stateAge > 5 * 60 * 1000) return false;

  return true;
};

// Microsoft OAuth with PKCE
router.get('/microsoft', async (req, res) => {
  console.log('🔵 Enhanced Microsoft OAuth: Starting authentication');

  if (!OAUTH_CONFIG.microsoft.clientId || !OAUTH_CONFIG.microsoft.clientSecret) {
    console.error('❌ Microsoft OAuth credentials are not set!');
    return res.redirect('/login.html?error=microsoft_credentials_missing');
  }

  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = generatePKCE();

  // Generate secure state
  const stateData = generateSecureState();

  // Store in session
  if (!req.session) {
    console.error('❌ Session not available for OAuth state storage');
    return res.redirect('/login.html?error=session_required');
  }

  req.session.oauthState = stateData;
  req.session.codeVerifier = codeVerifier;

  // Also store in database as fallback
  try {
    const OAuthState = require('../models/OAuthState');
    await OAuthState.create({
      state: stateData.state,
      codeVerifier: codeVerifier,
      nonce: stateData.nonce,
      timestamp: stateData.timestamp,
      provider: 'microsoft',
      calendarReauth: false
    });
    console.log('✅ [Microsoft OAuth] State also stored in database as fallback');
  } catch (dbError) {
    console.error('⚠️ [Microsoft OAuth] Failed to store state in database:', dbError);
    // Continue anyway - session should work
  }

  console.log('🔵 Microsoft OAuth: Generated PKCE and state parameters');
  console.log('🔍 Stored in session:', {
    oauthState: !!req.session.oauthState,
    codeVerifier: !!req.session.codeVerifier,
    sessionId: req.sessionID
  });

  const authUrl = `${OAUTH_CONFIG.microsoft.authorizationUrl}/${OAUTH_CONFIG.microsoft.tenant}/oauth2/v2.0/authorize?` +
    `client_id=${OAUTH_CONFIG.microsoft.clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.microsoft.redirectUri)}&` +
    `scope=${encodeURIComponent(OAUTH_CONFIG.microsoft.scope)}&` +
    `state=${stateData.state}&` +
    `nonce=${stateData.nonce}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256&` +
    `response_mode=query`;

  console.log('🔵 Microsoft OAuth: Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Debug endpoint to check session state
router.get('/debug-session', (req, res) => {
  console.log('🔍 [Debug] Session state check:', {
    hasSession: !!req.session,
    sessionId: req.session ? req.sessionID : null,
    oauthState: req.session ? req.session.oauthState : null,
    codeVerifier: req.session ? !!req.session.codeVerifier : false,
    sessionKeys: req.session ? Object.keys(req.session) : null
  });

  res.json({
    hasSession: !!req.session,
    sessionId: req.session ? req.sessionID : null,
    oauthState: req.session ? req.session.oauthState : null,
    hasCodeVerifier: req.session ? !!req.session.codeVerifier : false,
    sessionKeys: req.session ? Object.keys(req.session) : null
  });
});

// Test endpoint to verify Microsoft OAuth configuration
router.get('/test-microsoft-config', (req, res) => {
  const config = {
    clientId: !!OAUTH_CONFIG.microsoft.clientId,
    clientSecret: !!OAUTH_CONFIG.microsoft.clientSecret,
    redirectUri: OAUTH_CONFIG.microsoft.redirectUri,
    scope: OAUTH_CONFIG.microsoft.scope,
    tenant: OAUTH_CONFIG.microsoft.tenant,
    authorizationUrl: OAUTH_CONFIG.microsoft.authorizationUrl,
    tokenUrl: OAUTH_CONFIG.microsoft.tokenUrl,
    userInfoUrl: OAUTH_CONFIG.microsoft.userInfoUrl
  };

  console.log('🔍 [Debug] Microsoft OAuth configuration:', config);

  res.json({
    success: true,
    config: config,
    message: 'Microsoft OAuth configuration check complete'
  });
});

// Microsoft OAuth callback with enhanced security
router.get('/microsoft/callback', async (req, res) => {
  console.log('🔵 Enhanced Microsoft OAuth: Processing callback');

  const { code, state, error } = req.query;

  if (error) {
    console.error('❌ Microsoft OAuth error:', error);
    return res.redirect('/login.html?error=microsoft_oauth_error');
  }

  if (!code || !state) {
    console.error('❌ Missing code or state parameter');
    return res.redirect('/login.html?error=missing_parameters');
  }

  // Validate state parameter with fallback
  console.log('🔍 [Microsoft OAuth] State validation debug:', {
    hasSession: !!req.session,
    hasOAuthState: !!(req.session && req.session.oauthState),
    receivedState: state,
    sessionState: req.session ? req.session.oauthState : null,
    sessionKeys: req.session ? Object.keys(req.session) : null
  });

  let stateValid = false;
  let codeVerifier = null;

  // Try session-based validation first
  if (req.session && validateState(state, req.session.oauthState)) {
    stateValid = true;
    codeVerifier = req.session.codeVerifier;
    console.log('✅ [Microsoft OAuth] State validated via session');
  } else {
    console.log('⚠️ [Microsoft OAuth] Session validation failed, trying database fallback...');

    // Fallback: Try to find the OAuth state in the database
    try {
      const OAuthState = require('../models/OAuthState');
      const savedState = await OAuthState.findOne({ state: state });

      if (savedState && (Date.now() - savedState.timestamp) < 5 * 60 * 1000) { // 5 minutes
        stateValid = true;
        codeVerifier = savedState.codeVerifier;
        console.log('✅ [Microsoft OAuth] State validated via database fallback');

        // Clean up the temporary state record
        await OAuthState.deleteOne({ state: state });
      } else {
        console.log('❌ [Microsoft OAuth] No valid state found in database');
        stateValid = false;
      }
    } catch (dbError) {
      console.error('❌ [Microsoft OAuth] Database fallback failed:', dbError);
      stateValid = false;
    }
  }

  if (!stateValid) {
    console.error('❌ Invalid or expired state parameter');
    console.error('🔍 [Microsoft OAuth] State validation failed:', {
      receivedState: state,
      sessionState: req.session ? req.session.oauthState : null,
      validationResult: req.session ? validateState(state, req.session.oauthState) : false
    });
    return res.redirect('/login.html?error=invalid_state');
  }

  try {
    // Use the code verifier from validation (session or fallback)
    if (!codeVerifier) {
      console.error('❌ Missing code verifier');
      console.log('🔍 Session data:', req.session);
      return res.redirect('/login.html?error=missing_code_verifier');
    }

    console.log('🔵 Microsoft OAuth: Using code verifier for token exchange');

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `${OAUTH_CONFIG.microsoft.tokenUrl}/${OAUTH_CONFIG.microsoft.tenant}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: OAUTH_CONFIG.microsoft.clientId,
        client_secret: OAUTH_CONFIG.microsoft.clientSecret,
        code,
        redirect_uri: OAUTH_CONFIG.microsoft.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier // PKCE verification
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, id_token } = tokenResponse.data;

    // Optionally decode ID token (no signature verification) - not required for flow

    // Get user information
    const userResponse = await axios.get(OAUTH_CONFIG.microsoft.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userData = userResponse.data;
    console.log('🔵 Microsoft OAuth: User data received:', {
      id: userData.id,
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName
    });

    // Find or create user
    let user = await User.findOne({
      $or: [
        { microsoftId: userData.id },
        { email: userData.mail || userData.userPrincipalName }
      ]
    });

    if (!user) {
      // Create new user
      user = new User({
        email: userData.mail || userData.userPrincipalName,
        microsoftId: userData.id,
        authProvider: 'microsoft',
        isVerified: true, // OAuth users are pre-verified
        lastLogin: new Date(),
        lastLoginIP: req.ip || req.connection.remoteAddress || 'unknown',
        // Store OAuth tokens for calendar integration
        microsoftAccessToken: access_token,
        microsoftRefreshToken: refresh_token,
        microsoftTokenExpiry: new Date(Date.now() + 3600 * 1000) // 1 hour from now
      });

      await user.save();
      console.log('✅ New Microsoft user created:', user.email);
    } else {
      // Update existing user
      user.microsoftId = userData.id;
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress || 'unknown';
      // Update OAuth tokens for calendar integration
      user.microsoftAccessToken = access_token;
      user.microsoftRefreshToken = refresh_token;
      user.microsoftTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      console.log('🔍 Microsoft OAuth: About to save user with tokens:', {
        userId: user._id,
        email: user.email,
        hasAccessToken: !!user.microsoftAccessToken,
        hasRefreshToken: !!user.microsoftRefreshToken,
        tokenExpiry: user.microsoftTokenExpiry
      });

      await user.save();
      console.log('✅ Existing Microsoft user updated:', user.email);

      // Verify tokens were saved
      const savedUser = await User.findById(user._id);
      console.log('🔍 Microsoft OAuth: Tokens after save:', {
        hasAccessToken: !!savedUser.microsoftAccessToken,
        hasRefreshToken: !!savedUser.microsoftRefreshToken,
        tokenExpiry: savedUser.microsoftTokenExpiry,
        accessTokenLength: savedUser.microsoftAccessToken ? savedUser.microsoftAccessToken.length : 0,
        refreshTokenLength: savedUser.microsoftRefreshToken ? savedUser.microsoftRefreshToken.length : 0
      });

      // Additional verification - check if tokens are actually valid
      if (savedUser.microsoftAccessToken && savedUser.microsoftAccessToken.length > 10) {
        console.log('✅ Microsoft access token saved successfully');
      } else {
        console.log('❌ Microsoft access token NOT saved properly');
      }

      if (savedUser.microsoftRefreshToken && savedUser.microsoftRefreshToken.length > 10) {
        console.log('✅ Microsoft refresh token saved successfully');
      } else {
        console.log('❌ Microsoft refresh token NOT saved properly');
      }
    }

    // Establish session (session-based auth)
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => err ? reject(err) : resolve());
    });
    req.session.userId = user._id;

    // Check if this is a calendar re-authorization BEFORE clearing session data
    const isCalendarReauth = req.session.oauthState && req.session.oauthState.calendarReauth;

    // Clear session data
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    if (isCalendarReauth) {
        res.redirect(`/authCallback.html?provider=microsoft&redirect=/calendar.html`);
    } else {
        res.redirect(`/authCallback.html?provider=microsoft`);
    }

  } catch (error) {
    console.error('❌ Microsoft OAuth callback error:', error.message);
    res.redirect('/login.html?error=microsoft_oauth_failed');
  }
});

// Google OAuth with PKCE
router.get('/google', (req, res) => {
  console.log('🔵 Enhanced Google OAuth: Starting authentication');

  if (!OAUTH_CONFIG.google.clientId || !OAUTH_CONFIG.google.clientSecret) {
    console.error('❌ Google OAuth credentials are not set!');
    return res.redirect('/login.html?error=google_credentials_missing');
  }

  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = generatePKCE();

  // Generate secure state
  const stateData = generateSecureState();

  // Store in session
  if (!req.session) {
    console.error('❌ Session not available for OAuth state storage');
    return res.redirect('/login.html?error=session_required');
  }

  req.session.oauthState = stateData;
  req.session.codeVerifier = codeVerifier;

  console.log('🔵 Google OAuth: Generated PKCE and state parameters');
  console.log('🔍 Stored in session:', {
    oauthState: !!req.session.oauthState,
    codeVerifier: !!req.session.codeVerifier,
    sessionId: req.sessionID
  });

  const authUrl = `${OAUTH_CONFIG.google.authorizationUrl}?` +
    `client_id=${OAUTH_CONFIG.google.clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.google.redirectUri)}&` +
    `scope=${encodeURIComponent(OAUTH_CONFIG.google.scope)}&` +
    `state=${stateData.state}&` +
    `nonce=${stateData.nonce}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256&` +
    `access_type=offline&` +
    `prompt=consent`;

  console.log('🔵 Google OAuth: Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Google OAuth callback with enhanced security
router.get('/google/callback', async (req, res) => {
  console.log('🔵 Enhanced Google OAuth: Processing callback');
  console.log('🔍 [OAuth Callback] Query parameters:', req.query);
  console.log('🔍 [OAuth Callback] Session data:', {
    oauthState: !!req.session.oauthState,
    codeVerifier: !!req.session.codeVerifier,
    sessionId: req.sessionID
  });

  const { code, state, error } = req.query;

  if (error) {
    console.error('❌ Google OAuth error:', error);
    return res.redirect('/login.html?error=google_oauth_error');
  }

  if (!code || !state) {
    console.error('❌ Missing code or state parameter');
    return res.redirect('/login.html?error=missing_parameters');
  }

  // Validate state parameter
  if (!req.session || !validateState(state, req.session.oauthState)) {
    console.error('❌ Invalid or expired state parameter');
    return res.redirect('/login.html?error=invalid_state');
  }

  try {
    // Get code verifier from session
    const codeVerifier = req.session.codeVerifier;
    if (!codeVerifier) {
      console.error('❌ Missing code verifier in session');
      console.log('🔍 Session data:', req.session);
      return res.redirect('/login.html?error=missing_code_verifier');
    }

    console.log('🔵 Google OAuth: Using code verifier for token exchange');
    console.log('🔍 [OAuth Callback] Token exchange request:', {
      client_id: OAUTH_CONFIG.google.clientId,
      client_secret: '***',
      code: code.substring(0, 10) + '...',
      redirect_uri: OAUTH_CONFIG.google.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier.substring(0, 10) + '...'
    });

    // Exchange code for tokens
    const tokenResponse = await axios.post(OAUTH_CONFIG.google.tokenUrl, {
      client_id: OAUTH_CONFIG.google.clientId,
      client_secret: OAUTH_CONFIG.google.clientSecret,
      code,
      redirect_uri: OAUTH_CONFIG.google.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier // PKCE verification
    });

    const { access_token, refresh_token, id_token } = tokenResponse.data;

    console.log('🔵 Google OAuth: Tokens received');
    console.log('🔍 [OAuth Callback] Token response:', {
      access_token: access_token ? access_token.substring(0, 20) + '...' : 'null',
      refresh_token: refresh_token ? refresh_token.substring(0, 20) + '...' : 'null',
      id_token: id_token ? id_token.substring(0, 20) + '...' : 'null'
    });

    // Optionally decode ID token (no signature verification) - not required for flow

    // Get user information
    const userResponse = await axios.get(OAUTH_CONFIG.google.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userData = userResponse.data;
    console.log('🔵 Google OAuth: User data received:', {
      id: userData.id,
      email: userData.email,
      name: userData.name
    });

    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId: userData.id },
        { email: userData.email }
      ]
    });

    if (!user) {
      // Create new user
      user = new User({
        email: userData.email,
        googleId: userData.id,
        authProvider: 'google',
        isVerified: true, // OAuth users are pre-verified
        lastLogin: new Date(),
        lastLoginIP: req.ip || req.connection.remoteAddress || 'unknown',
        // Store OAuth tokens for calendar integration
        googleAccessToken: access_token,
        googleRefreshToken: refresh_token,
        googleTokenExpiry: new Date(Date.now() + 3600 * 1000) // 1 hour from now
      });

      await user.save();
      console.log('✅ New Google user created:', user.email);
      console.log('🔑 Google OAuth tokens stored with new access token');
      console.log('📅 Testing calendar permissions with new token...');

      // Test calendar permissions immediately
      try {
        const axios = require('axios');
        const calendarResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        console.log('✅ Calendar permissions verified:', calendarResponse.data.items?.length || 0, 'calendars found');
      } catch (calendarError) {
        console.log('❌ Calendar permissions test failed:', calendarError.response?.status, calendarError.response?.data?.error?.message || calendarError.message);
      }
      console.log('🔑 Google OAuth tokens stored with new access token');
      console.log('📅 Testing calendar permissions with new token...');

      // Test calendar permissions immediately
      try {
        const axios = require('axios');
        const calendarResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        console.log('✅ Calendar permissions verified:', calendarResponse.data.items?.length || 0, 'calendars found');
      } catch (calendarError) {
        console.log('❌ Calendar permissions test failed:', calendarError.response?.status, calendarError.response?.data?.error?.message || calendarError.message);
      }
      console.log('🔑 Google OAuth tokens stored with new access token');
      console.log('📅 Testing calendar permissions with new token...');

      // Test calendar permissions immediately
      try {
        const axios = require('axios');
        const calendarResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        console.log('✅ Calendar permissions verified:', calendarResponse.data.items?.length || 0, 'calendars found');
      } catch (calendarError) {
        console.log('❌ Calendar permissions test failed:', calendarError.response?.status, calendarError.response?.data?.error?.message || calendarError.message);
      }
    } else {
      // Update existing user
      user.googleId = userData.id;
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress || 'unknown';
      // Update OAuth tokens for calendar integration
      user.googleAccessToken = access_token;
      user.googleRefreshToken = refresh_token;
      user.googleTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      console.log('🔍 Google OAuth: About to save user with tokens:', {
        userId: user._id,
        email: user.email,
        hasAccessToken: !!user.googleAccessToken,
        hasRefreshToken: !!user.googleRefreshToken,
        tokenExpiry: user.googleTokenExpiry
      });

      await user.save();
      console.log('✅ Existing Google user updated:', user.email);

      // Verify tokens were saved
      const savedUser = await User.findById(user._id);
      console.log('🔍 Google OAuth: Tokens after save:', {
        hasAccessToken: !!savedUser.googleAccessToken,
        hasRefreshToken: !!savedUser.googleRefreshToken,
        tokenExpiry: savedUser.googleTokenExpiry,
        accessTokenLength: savedUser.googleAccessToken ? savedUser.googleAccessToken.length : 0,
        refreshTokenLength: savedUser.googleRefreshToken ? savedUser.googleRefreshToken.length : 0
      });

      // Additional verification - check if tokens are actually valid
      if (savedUser.googleAccessToken && savedUser.googleAccessToken.length > 10) {
        console.log('✅ Google access token saved successfully');
      } else {
        console.log('❌ Google access token NOT saved properly');
      }

      if (savedUser.googleRefreshToken && savedUser.googleRefreshToken.length > 10) {
        console.log('✅ Google refresh token saved successfully');
      } else {
        console.log('❌ Google refresh token NOT saved properly');
      }
    console.log('🔑 Google OAuth tokens updated with new access token');
    console.log('📅 Testing calendar permissions with new token...');

    // Test calendar permissions immediately
    try {
      const axios = require('axios');
      const calendarResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      console.log('✅ Calendar permissions verified:', calendarResponse.data.items?.length || 0, 'calendars found');
    } catch (calendarError) {
      console.log('❌ Calendar permissions test failed:', calendarError.response?.status, calendarError.response?.data?.error?.message || calendarError.message);
    }
    console.log('🔑 Google OAuth tokens updated with new access token');
    console.log('📅 Testing calendar permissions with new token...');

    // Test calendar permissions immediately
    try {
      const axios = require('axios');
      const calendarResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      console.log('✅ Calendar permissions verified:', calendarResponse.data.items?.length || 0, 'calendars found');
    } catch (calendarError) {
      console.log('❌ Calendar permissions test failed:', calendarError.response?.status, calendarError.response?.data?.error?.message || calendarError.message);
    }
    console.log('🔑 Google OAuth tokens updated with new access token');
    console.log('📅 Testing calendar permissions with new token...');

    // Test calendar permissions immediately
    try {
      const axios = require('axios');
      const calendarResponse = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      console.log('✅ Calendar permissions verified:', calendarResponse.data.items?.length || 0, 'calendars found');
    } catch (calendarError) {
      console.log('❌ Calendar permissions test failed:', calendarError.response?.status, calendarError.response?.data?.error?.message || calendarError.message);
    }
    }

    // Establish session (session-based auth)
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => err ? reject(err) : resolve());
    });
    req.session.userId = user._id;

    // Redirect to frontend without token
    // Check if this is a calendar re-authorization by looking for calendar scopes in the original request
    // IMPORTANT: determine before clearing session
    const isCalendarReauth = req.session.oauthState && req.session.oauthState.calendarReauth;

    // Clear session data AFTER computing isCalendarReauth
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    if (isCalendarReauth) {
      res.redirect(`/authCallback.html?provider=google&redirect=/calendar.html`);
    } else {
      res.redirect(`/authCallback.html?provider=google`);
    }

  } catch (error) {
    console.error('❌ Google OAuth callback error:', error.message);
    res.redirect('/login.html?error=google_oauth_failed');
  }
});

// Re-authorization endpoints for calendar permissions
router.get('/google/calendar-reauth', (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const { state, nonce, timestamp } = generateSecureState();

    // Store PKCE and state in session (same structure as main OAuth)
    req.session.oauthState = { state, nonce, timestamp, calendarReauth: true };
    req.session.codeVerifier = codeVerifier;

    console.log('🔵 Google Calendar Re-auth: Generated PKCE and state parameters');
    console.log('🔍 Stored in session:', {
      oauthState: !!req.session.oauthState,
      codeVerifier: !!req.session.codeVerifier,
      sessionId: req.sessionID
    });

    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.google.clientId,
      redirect_uri: OAUTH_CONFIG.google.redirectUri,
      response_type: 'code',
      scope: OAUTH_CONFIG.google.scope,
      access_type: 'offline',
      prompt: 'consent', // Force consent to get new permissions
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${OAUTH_CONFIG.google.authorizationUrl}?${params.toString()}`;
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ [OAuth] Google calendar re-auth error:', error);
    res.status(500).json({ error: 'Failed to initiate Google calendar re-authorization' });
  }
});

router.get('/microsoft/calendar-reauth', async (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const { state, nonce, timestamp } = generateSecureState();

    // Store PKCE and state in session with calendar re-auth flag
    req.session.oauthState = { state, nonce, timestamp, calendarReauth: true };
    req.session.codeVerifier = codeVerifier;

    // Also store in database as fallback
    try {
      const OAuthState = require('../models/OAuthState');
      await OAuthState.create({
        state: state,
        codeVerifier: codeVerifier,
        nonce: nonce,
        timestamp: timestamp,
        provider: 'microsoft',
        calendarReauth: true
      });
      console.log('✅ [Microsoft Calendar Re-auth] State also stored in database as fallback');
    } catch (dbError) {
      console.error('⚠️ [Microsoft Calendar Re-auth] Failed to store state in database:', dbError);
      // Continue anyway - session should work
    }

    console.log('🔵 Microsoft Calendar Re-auth: Generated PKCE and state parameters');
    console.log('🔍 Stored in session:', {
      oauthState: !!req.session.oauthState,
      codeVerifier: !!req.session.codeVerifier,
      sessionId: req.sessionID
    });

    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.microsoft.clientId,
      response_type: 'code',
      redirect_uri: OAUTH_CONFIG.microsoft.redirectUri,
      scope: OAUTH_CONFIG.microsoft.scope,
      response_mode: 'query',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent' // Force consent to get new permissions
    });

    const authUrl = `${OAUTH_CONFIG.microsoft.authorizationUrl}/${OAUTH_CONFIG.microsoft.tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ [OAuth] Microsoft calendar re-auth error:', error);
    res.status(500).json({ error: 'Failed to initiate Microsoft calendar re-authorization' });
  }
});

module.exports = router;
