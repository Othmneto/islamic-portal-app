const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const User = require('../models/User');

const SESSION_COOKIE = 'session';
const CSRF_COOKIE = 'XSRF-TOKEN';

function setSessionCookies(res, jwtToken, csrfToken, isProd) {
  res.cookie(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'Lax' : 'Lax',
    signed: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'Lax' : 'Lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
}

router.post('/login-cookie', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ msg: 'Email & password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ msg: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ msg: 'Invalid credentials' });

    const payload = { user: { id: user._id.toString() } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const csrf = crypto.randomBytes(24).toString('hex');

    setSessionCookies(res, token, csrf, process.env.NODE_ENV === 'production');
    res.json({ ok: true, userId: user._id });
  } catch (e) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/logout-cookie', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Issue/rotate CSRF cookie
router.get('/csrf', (_req, res) => {
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'Lax' : 'Lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, csrfToken: csrf });
});

module.exports = router;
