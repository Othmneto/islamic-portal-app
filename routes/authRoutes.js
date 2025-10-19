// routes/authRoutes.js - Text-only translation routes
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { env } = require('../config'); // <-- THIS LINE IS CRITICAL

// --- Import Controller and Middleware ---
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrfMiddleware');
const unifiedAuthService = require('../services/unifiedAuthService');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const sessionManagementService = require('../services/sessionManagementService');
const { checkPersistentAuth } = require('../middleware/persistentAuthMiddleware');

// --- Validation Rules ---
const registerValidation = [
  body('email', 'Please enter a valid email address').isEmail().normalizeEmail(),
  body('username', 'Username is required and must be 3-30 characters long')
    .isLength({ min: 3, max: 30 })
    .trim()
    .custom((value) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }
      return true;
    }),
  body('password', 'Password must be at least 12 characters long and contain uppercase, lowercase, number, and special character')
    .isLength({ min: 12 })
    .custom((value) => {
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/.test(value)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      }
      return true;
    }),
];

const loginValidation = [
  body('email', 'Please enter a valid email address').isEmail(),
  body('password', 'Password is required').notEmpty(),
];

const forgotPasswordValidation = [
  body('email', 'Please enter a valid email address').isEmail().normalizeEmail(),
];

const resetPasswordValidation = [
  body('token', 'Reset token is required').notEmpty(),
  body('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
];

// --- Route Definitions ---
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', authMiddleware, authController.getMe);

// Password reset routes
router.post('/forgot-password', verifyCsrf, forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

// Username setup route for OAuth users
router.post('/setup-username', authMiddleware, authController.setupUsername);

// Unified login route (email + OAuth integration)
router.post('/unified-login', [
  body('email', 'Please enter a valid email address').isEmail().normalizeEmail(),
  body('password', 'Password is required').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Authenticate with email and password
    const user = await unifiedAuthService.authenticateWithEmail(email, password, ip, userAgent);
    const token = unifiedAuthService.generateToken(user);
    const response = unifiedAuthService.createLoginResponse(user, token);

    res.json(response);
  } catch (error) {
    console.error('Unified login error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
});

// Get user authentication methods
router.get('/auth-methods/:userId', authMiddleware, async (req, res) => {
  try {
    const authMethods = await unifiedAuthService.getUserAuthMethods(req.user.id);
    res.json(authMethods);
  } catch (error) {
    console.error('Get auth methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get authentication methods'
    });
  }
});

// Link OAuth account to existing user
router.post('/link-oauth', authMiddleware, [
  body('provider', 'Provider is required').isIn(['google', 'microsoft', 'facebook', 'twitter', 'tiktok']),
  body('profile', 'Profile data is required').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { provider, profile } = req.body;
    const user = await unifiedAuthService.linkOAuthToExistingUser(req.user.email, profile, provider);

    res.json({
      success: true,
      message: `${provider} account linked successfully`,
      user: {
        id: user._id,
        email: user.email,
        authProvider: user.authProvider
      }
    });
  } catch (error) {
    console.error('Link OAuth error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to link OAuth account'
    });
  }
});

// Unlink OAuth account
router.delete('/unlink-oauth/:provider', authMiddleware, async (req, res) => {
  try {
    const { provider } = req.params;
    const user = await unifiedAuthService.unlinkOAuthAccount(req.user.id, provider);

    res.json({
      success: true,
      message: `${provider} account unlinked successfully`,
      user: {
        id: user._id,
        email: user.email,
        authProvider: user.authProvider
      }
    });
  } catch (error) {
    console.error('Unlink OAuth error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to unlink OAuth account'
    });
  }
});

// Email verification routes
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Debug endpoint to check OAuth configuration
router.get('/debug/oauth-config', (req, res) => {
  res.json({
    microsoft: {
      hasClientId: !!process.env.MICROSOFT_CLIENT_ID,
      hasClientSecret: !!process.env.MICROSOFT_CLIENT_SECRET,
      clientIdLength: process.env.MICROSOFT_CLIENT_ID?.length || 0,
      clientIdPrefix: process.env.MICROSOFT_CLIENT_ID?.substring(0, 8) || 'undefined'
    },
    google: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    },
    oauthRedirectUrl: process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/authCallback.html'
  });
});

// Test endpoint to verify callback is working
router.get('/debug/test-callback', (req, res) => {
  console.log('Test callback received:', req.query);
  res.json({ message: 'Callback test successful', query: req.query });
});

// --- Social Auth Routes ---
// DISABLED: Using custom PKCE implementation in routes/enhancedOAuth.js instead

// Google - DISABLED (using custom PKCE implementation)
// router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// router.get(
//   '/google/callback',
//   passport.authenticate('google', {
//     failureRedirect: '/login.html?error=auth_failed',
//     session: false,
//   }),
//   async (req, res) => {
//     try {
//       console.log('🔄 Google OAuth: Processing callback for user:', req.user);
//
//       // Use unified auth service to handle the OAuth callback
//       const response = await unifiedAuthService.handleOAuthCallback(
//         req.user,
//         'google',
//         req.ip,
//         req.get('User-Agent')
//       );
//
//       console.log('✅ Google OAuth: Unified auth service response:', response);
//
//       // Redirect to success page with token
//       const redirectBase = process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/authCallback.html';
//       const redirectUrl = `${redirectBase}?token=${encodeURIComponent(response.token)}`;
//
//       console.log('🎉 Google OAuth: Redirecting to:', redirectUrl);
//       res.redirect(redirectUrl);
//     } catch (error) {
//       console.error('❌ Google OAuth callback error:', error);
//       res.status(500).json({
//         success: false,
//         error: {
//           code: 'INTERNAL_SERVER_ERROR',
//           message: 'OAuth callback processing failed'
//         }
//       });
//     }
//   }
// );

// JWT-based logout route
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const TokenBlacklist = require('../models/TokenBlacklist');

    // Get the token from the Authorization header
    const authHeader = req.header('Authorization');
    const token = authHeader ? authHeader.split(' ')[1] : null;

    if (token) {
      // Blacklist the token for security
      await TokenBlacklist.blacklistToken(token, req.user.id, 'logout');
    }

    console.log(`🔓 User logout: ${req.user.email} (${req.user.id})`);

    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed. Please try again.'
    });
  }
});

// Microsoft OAuth routes are now handled by microsoftAuth.js

// Placeholders for other providers (enable when strategies are configured):
// router.get('/facebook', passport.authenticate('facebook'));
// router.get('/facebook/callback',
//   passport.authenticate('facebook', { failureRedirect: '/login.html', session: false }),
//   (req, res) => { /* sign JWT & redirect similar to Google */ }
// );
// router.get('/twitter', passport.authenticate('twitter'));
// router.get('/twitter/callback',
//   passport.authenticate('twitter', { failureRedirect: '/login.html', session: false }),
//   (req, res) => { /* sign JWT & redirect */ }
// );
// router.get('/tiktok', passport.authenticate('tiktok'));
// router.get('/tiktok/callback',
//   passport.authenticate('tiktok', { failureRedirect: '/login.html', session: false }),
//   (req, res) => { /* sign JWT & redirect */ }
// );

// @route   POST /api/auth/verify-password
// @desc    Verify user password for biometric authentication
// @access  Private
router.post('/verify-password', authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // For OAuth users, they don't have a password
        if (!user.password) {
            return res.status(400).json({ error: 'Password verification not available for OAuth users' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await safeLogSecurityViolation('INVALID_PASSWORD_ATTEMPT', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'Invalid password provided for biometric authentication'
            });
            return res.status(401).json({ error: 'Invalid password' });
        }

        await safeLogAuthEvent('PASSWORD_VERIFIED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'Password verified for biometric authentication'
        });

        res.json({ success: true, message: 'Password verified successfully' });
    } catch (error) {
        console.error('Error verifying password:', error);
        res.status(500).json({ error: 'Failed to verify password' });
    }
});

// @route   POST /api/auth/enable-biometric
// @desc    Enable biometric authentication
// @access  Private
router.post('/enable-biometric', authMiddleware, async (req, res) => {
    try {
        const { credential, type, verified } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Handle different biometric types
        if (type === 'oauth-based' && verified) {
            // For OAuth users, enable biometric without WebAuthn credential
            user.biometricEnabled = true;
            user.biometricType = 'oauth-based';
            user.biometricCredentials = {
                type: 'oauth-based',
                verified: true,
                enabledAt: new Date()
            };

            await user.save();

            await safeLogAuthEvent('BIOMETRIC_AUTH_ENABLED', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'OAuth-based biometric authentication enabled for user'
            });

            res.json({
                success: true,
                message: 'Biometric authentication enabled successfully (OAuth-based)'
            });
        } else if (type === 'password-based' && verified) {
            // For password-verified users
            user.biometricEnabled = true;
            user.biometricType = 'password-based';
            user.biometricCredentials = {
                type: 'password-based',
                verified: true,
                enabledAt: new Date()
            };

            await user.save();

            await safeLogAuthEvent('BIOMETRIC_AUTH_ENABLED', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'Password-based biometric authentication enabled for user'
            });

            res.json({
                success: true,
                message: 'Biometric authentication enabled successfully (Password-based)'
            });
        } else if (credential) {
            // For WebAuthn credentials
            user.biometricEnabled = true;
            user.biometricType = 'webauthn';
            user.biometricCredentials = {
                id: credential.id,
                type: credential.type,
                rawId: credential.rawId,
                response: {
                    attestationObject: credential.response.attestationObject,
                    clientDataJSON: credential.response.clientDataJSON
                },
                enabledAt: new Date()
            };

            await user.save();

            await safeLogAuthEvent('BIOMETRIC_AUTH_ENABLED', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'WebAuthn biometric authentication enabled for user'
            });

            res.json({
                success: true,
                message: 'Biometric authentication enabled successfully (WebAuthn)'
            });
        } else {
            return res.status(400).json({ error: 'Invalid biometric authentication data' });
        }
    } catch (error) {
        console.error('Error enabling biometric authentication:', error);
        res.status(500).json({ error: 'Failed to enable biometric authentication' });
    }
});

// @route   POST /api/auth/disable-biometric
// @desc    Disable biometric authentication
// @access  Private
router.post('/disable-biometric', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.biometricEnabled = false;
        user.biometricCredentials = {};

        await user.save();

        await safeLogAuthEvent('BIOMETRIC_AUTH_DISABLED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'Biometric authentication disabled for user'
        });

        res.json({
            success: true,
            message: 'Biometric authentication disabled successfully'
        });
    } catch (error) {
        console.error('Error disabling biometric authentication:', error);
        res.status(500).json({ error: 'Failed to disable biometric authentication' });
    }
});

// Update user location for persistent authentication
router.post('/update-location', authMiddleware, checkPersistentAuth, async (req, res) => {
    try {
        console.log('📍 [Auth] Updating user location for persistent auth:', req.user.id);

        const { location, deviceInfo } = req.body;

        if (!location || !location.lat || !location.lon) {
            return res.status(400).json({
                success: false,
                error: 'Valid location data is required'
            });
        }

        // Update user's last known location
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update user location
        user.lastKnownLocation = {
            lat: location.lat,
            lon: location.lon,
            accuracy: location.accuracy || 0,
            timestamp: new Date(),
            isDefault: location.isDefault || false
        };

        await user.save();

        // Update session with location and device info
        if (req.sessionId) {
            await sessionManagementService.updateSession(req.sessionId, {
                location: location,
                deviceInfo: deviceInfo,
                lastActivity: Date.now()
            });
        }

        console.log('✅ [Auth] User location updated successfully');

        res.json({
            success: true,
            message: 'Location updated successfully',
            location: user.lastKnownLocation
        });

    } catch (error) {
        console.error('❌ [Auth] Error updating user location:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update location'
        });
    }
});

module.exports = router;
