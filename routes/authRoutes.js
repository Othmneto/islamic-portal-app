// translator-backend/routes/authRoutes.js

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
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/.test(value)) {
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

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login.html?error=auth_failed',
    session: false,
  }),
  (req, res) => {
    const payload = { user: { id: req.user.id } };

    jwt.sign(
      payload,
      env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) return res.status(500).send('OAuth token issuance failed');
        const redirectBase =
          process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/authCallback.html';
        const redirectUrl = `${redirectBase}?token=${encodeURIComponent(token)}`;
        res.redirect(redirectUrl);
      }
    );
  }
);

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

module.exports = router;
