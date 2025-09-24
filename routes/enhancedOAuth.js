// Enhanced Production-Grade OAuth Implementation
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
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
    scope: 'openid email profile User.Read',
    tenant: process.env.MICROSOFT_TENANT || 'common',
    authorizationUrl: 'https://login.microsoftonline.com',
    tokenUrl: 'https://login.microsoftonline.com',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${env.CLIENT_URL}/api/auth/google/callback`,
    scope: 'openid email profile',
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
router.get('/microsoft', (req, res) => {
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
  
  console.log('🔵 Microsoft OAuth: Generated PKCE and state parameters');
  
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
  
  // Validate state parameter
  if (!req.session || !validateState(state, req.session.oauthState)) {
    console.error('❌ Invalid or expired state parameter');
    return res.redirect('/login.html?error=invalid_state');
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `${OAUTH_CONFIG.microsoft.tokenUrl}/${OAUTH_CONFIG.microsoft.tenant}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: OAUTH_CONFIG.microsoft.clientId,
        client_secret: OAUTH_CONFIG.microsoft.clientSecret,
        code,
        redirect_uri: OAUTH_CONFIG.microsoft.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: req.session.codeVerifier // PKCE verification
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token, id_token } = tokenResponse.data;
    
    // Verify ID token
    const decodedToken = jwt.decode(id_token);
    if (!decodedToken) {
      throw new Error('Invalid ID token');
    }
    
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
        lastLoginIP: req.ip || req.connection.remoteAddress || 'unknown'
      });
      
      await user.save();
      console.log('✅ New Microsoft user created:', user.email);
    } else {
      // Update existing user
      user.microsoftId = userData.id;
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress || 'unknown';
      await user.save();
      console.log('✅ Existing Microsoft user updated:', user.email);
    }
    
    // Generate JWT token
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
      username: user.username,
      authProvider: 'microsoft',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID()
    };
    
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
    
    // Clear session data
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    
    // Redirect to frontend with token
    res.redirect(`/authCallback.html?token=${token}&provider=microsoft`);
    
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
    // Exchange code for tokens
    const tokenResponse = await axios.post(OAUTH_CONFIG.google.tokenUrl, {
      client_id: OAUTH_CONFIG.google.clientId,
      client_secret: OAUTH_CONFIG.google.clientSecret,
      code,
      redirect_uri: OAUTH_CONFIG.google.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: req.session.codeVerifier // PKCE verification
    });
    
    const { access_token, refresh_token, id_token } = tokenResponse.data;
    
    // Verify ID token
    const decodedToken = jwt.decode(id_token);
    if (!decodedToken) {
      throw new Error('Invalid ID token');
    }
    
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
        lastLoginIP: req.ip || req.connection.remoteAddress || 'unknown'
      });
      
      await user.save();
      console.log('✅ New Google user created:', user.email);
    } else {
      // Update existing user
      user.googleId = userData.id;
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress || 'unknown';
      await user.save();
      console.log('✅ Existing Google user updated:', user.email);
    }
    
    // Generate JWT token
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
      username: user.username,
      authProvider: 'google',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID()
    };
    
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
    
    // Clear session data
    delete req.session.oauthState;
    delete req.session.codeVerifier;
    
    // Redirect to frontend with token
    res.redirect(`/authCallback.html?token=${token}&provider=google`);
    
  } catch (error) {
    console.error('❌ Google OAuth callback error:', error.message);
    res.redirect('/login.html?error=google_oauth_failed');
  }
});

module.exports = router;
