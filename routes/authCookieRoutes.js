// translator-backend/routes/authCookieRoutes.js

const express = require('express');
const User = require('../models/User');
const { attachUser: authMiddleware } = require('../middleware/authMiddleware');
const sessionManagementService = require('../services/sessionManagementService');
const { CSRF_COOKIE_NAME, verifyCsrf } = require('../middleware/csrfMiddleware'); // single source of truth
const { logger } = require('../config/logger');
const { env } = require('../config');
const { validate, z } = require('../middleware/validate'); // Zod-based validation middleware

const router = express.Router();


// ---------- Helpers ----------

/** Clear a cookie with and without explicit domain (covers both cases) */
function clearCookieEverywhere(res, name) {
  const base = {
    path: '/',
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
  };
  res.clearCookie(name, base);
  if (env.COOKIE_DOMAIN) {
    res.clearCookie(name, { ...base, domain: env.COOKIE_DOMAIN });
  }
}

// ---------- Schemas ----------

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
  }),
});

// ---------- Handlers ----------

/**
 * Shared login handler for both /login and /login-cookie
 * - Verifies credentials
 * - Prevents session fixation via req.session.regenerate
 * - Sets session user & userId for cookie/session flows
 * - Issues a JWT for Bearer flows (mobile/3rd-party). Browsers should ignore it.
 * - NEW: Supports Remember Me with dynamic session lifetime
 */
async function handleLogin(req, res) {
  try {
    console.log('🔐 [Login] ========== LOGIN ATTEMPT ==========');
    console.log('🔐 [Login] Request body:', { email: req.body.email, rememberMe: req.body.rememberMe, passwordLength: req.body.password?.length });
    console.log('🔐 [Login] Session ID:', req.sessionID);
    console.log('🔐 [Login] Session data:', req.session);
    console.log('🔐 [Login] Cookies:', Object.keys(req.cookies || {}));
    console.log('🔐 [Login] Headers:', req.headers);
    
    const { email, password, rememberMe = false } = req.body; // already validated by zod middleware

    const user = await User.findOne({ email });
    console.log('🔐 [Login] User found:', !!user);
    
    if (!user || !(await user.comparePassword(password))) {
      console.log('❌ [Login] Invalid credentials');
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    console.log('✅ [Login] Credentials valid, creating session...');

    // Create session and issue tokens using sessionManagementService
    const sessionResult = await sessionManagementService.createSessionRememberMeAware(user, req, rememberMe);

    // Regenerate to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error:', err);
        return res.status(500).json({ message: 'Could not log you in. Please try again.' });
      }

      // Persist minimal user info server-side and set cookie lifetime dynamically
      req.session.userId = sessionResult.user.id;
      req.session.rememberMe = rememberMe;
      if (rememberMe) {
        req.session.cookie.maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      } else {
        // no maxAge -> session cookie (expires on browser close)
        req.session.cookie.maxAge = undefined;
      }

      logger.info(`[Auth] User ${sessionResult.user.id} logged in (rememberMe: ${rememberMe})`);

      return res.status(200).json({
        message: 'Login successful',
        user: sessionResult.user,
        rememberMe: rememberMe,
        sessionId: sessionResult.sessionId,
        expiresIn: sessionResult.expiresIn
      });
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
}

// ---------- Routes ----------

// Preferred modern path (mounted at /api/auth-cookie)
router.post('/login', verifyCsrf, validate(loginSchema), handleLogin);

// Legacy/back-compat path (mounted at /api/auth)
router.post('/login-cookie', validate(loginSchema), handleLogin);

// Logout (preferred modern path)
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction error:', err);
      return res.status(500).json({ message: 'Could not log you out. Please try again.' });
    }
    // Clear session cookie (matches name in server.js: 'sid')
    clearCookieEverywhere(res, 'sid');
    // Clear CSRF cookie set by csrfMiddleware
    clearCookieEverywhere(res, CSRF_COOKIE_NAME);
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

// Legacy/back-compat logout path
router.post('/logout-cookie', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction error:', err);
      return res.status(500).json({ message: 'Could not log you out. Please try again.' });
    }
    clearCookieEverywhere(res, 'sid');
    clearCookieEverywhere(res, CSRF_COOKIE_NAME);
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

// Me (requires JWT auth)
router.get('/me', authMiddleware, async (req, res) => {
  return res.json(req.user);
});

module.exports = router;
