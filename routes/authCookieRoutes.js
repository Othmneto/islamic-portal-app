// translator-backend/routes/authCookieRoutes.js

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { attachUser } = require('../middleware/authMiddleware');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';
const CSRF_COOKIE = 'XSRF-TOKEN';

// POST /api/auth/login-cookie
// - Verifies credentials
// - Returns a JWT for Bearer flows
// - Also sets req.session.userId for cookie/session flows
router.post('/login-cookie', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create JWT for Bearer auth (SPA/API calls)
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // Set session for cookie-based flows
    req.session.userId = user._id;

    // (Optional) set/refresh CSRF token cookie for double-submit CSRF on cookie-based requests
    const csrf = crypto.randomBytes(24).toString('hex');
    res.cookie(CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      _id: user._id,
      email: user.email,
      username: user.username,
      token, // client can store and send as Authorization: Bearer <token>
    });
  } catch (error) {
    console.error('Login error:', error?.message || error);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /api/auth/logout-cookie
// - Destroys the session and clears cookies
router.post('/logout-cookie', (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out.' });
      }
      // Clear the express-session cookie (named "sid" in server.js)
      res.clearCookie('sid', { path: '/' });
      // Clear CSRF cookie
      res.clearCookie(CSRF_COOKIE, { path: '/' });
      return res.status(200).json({ message: 'Logged out successfully.' });
    });
  } catch {
    return res.status(200).json({ message: 'Logged out successfully.' });
  }
});

// GET /api/auth/csrf
// - Issues/rotates the XSRF-TOKEN cookie (handy for first load or refresh)
router.get('/csrf', (_req, res) => {
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, csrfToken: csrf });
});

// GET /api/auth/me
// - Works with either Bearer JWT or session via attachUser
router.get('/me', attachUser, async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  return res.json(req.user);
});

module.exports = router;
