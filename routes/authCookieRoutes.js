// translator-backend/routes/authCookieRoutes.js

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { CSRF_COOKIE_NAME, verifyCsrf } = require('../middleware/csrfMiddleware'); // single source of truth
const { logger } = require('../config/logger');
const { env } = require('../config');
const { validate, z } = require('../middleware/validate'); // Zod-based validation middleware

const router = express.Router();

// Use validated secret from ./config (no weak fallback)
const JWT_SECRET = env.JWT_SECRET;

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
  }),
});

// ---------- Handlers ----------

/**
 * Shared login handler for both /login and /login-cookie
 * - Verifies credentials
 * - Prevents session fixation via req.session.regenerate
 * - Sets session user & userId for cookie/session flows
 * - Issues a JWT for Bearer flows (mobile/3rd-party). Browsers should ignore it.
 */
async function handleLogin(req, res) {
  try {
    const { email, password } = req.body; // already validated by zod middleware

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create JWT for Bearer clients
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Regenerate to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error:', err);
        return res.status(500).json({ message: 'Could not log you in. Please try again.' });
      }

      // Persist minimal user info server-side
      req.session.userId = user._id;
      req.session.user = {
        id: user._id,
        email: user.email,
        role: user.role,
      };

      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        // IMPORTANT: Web SPA should ignore this and rely on the HttpOnly session cookie.
        token,
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
