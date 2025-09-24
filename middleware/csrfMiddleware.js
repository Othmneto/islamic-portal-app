// translator-backend/middleware/csrfMiddleware.js

const crypto = require('crypto');
const { env } = require('../config');

// Single source of truth
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
// Accept common header aliases
const CSRF_HEADER_NAMES = ['x-csrf-token', 'x-xsrf-token'];

/**
 * Cookie opts for the readable CSRF token cookie (double-submit pattern).
 * NOTE: httpOnly must be false so frontend can read & send as a header.
 */
function cookieOptions() {
  const opts = {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  };
  if (env.COOKIE_DOMAIN) opts.domain = env.COOKIE_DOMAIN;
  return opts;
}

/**
 * Ensure a per-session CSRF secret exists.
 * Stored server-side and never exposed directly.
 */
function ensureCsrfSecret(req) {
  if (!req.session) {
    throw new Error('Session is required for CSRF protection. Ensure express-session is configured.');
  }
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfSecret;
}

/**
 * Derive the public CSRF token sent to the browser (header & cookie) from the secret.
 * Using a stable label binds the token to the session secret without exposing it.
 */
function deriveToken(secret) {
  return crypto.createHmac('sha256', secret).update('auth-token').digest('hex');
}

/**
 * Middleware: ensure a CSRF cookie exists for every request.
 * - Derives a token from the session-held secret and sets it as a readable cookie.
 * - Also places the token in res.locals.csrfToken for templates if desired.
 */
function issueCsrfToken(req, res, next) {
  try {
    const secret = ensureCsrfSecret(req);
    const token = deriveToken(secret);
    // Always refresh cookie (cheap + avoids stale tokens after secret rotation)
    res.cookie(CSRF_COOKIE_NAME, token, cookieOptions());
    res.locals.csrfToken = token;
    console.log('🍪 CSRF token issued:', token.substring(0, 10) + '...');
    next();
  } catch (err) {
    console.error('❌ CSRF token issue error:', err);
    next(err);
  }
}

/**
 * Handler: returns the current CSRF token and (re)sets the cookie.
 * Frontend can call /api/csrf-token before state-changing requests.
 */
function getCsrfToken(req, res) {
  const secret = ensureCsrfSecret(req);
  const token = deriveToken(secret);
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions());
  res.status(200).json({ ok: true, csrfToken: token });
}

/**
 * Middleware: verify CSRF for state-changing requests (double-submit with HMAC).
 * - Skips verification for Bearer JWT API clients.
 * - Allows bypass in non-production if ALLOW_NO_CSRF=true (useful for local E2E).
 * - Compares the header token against the HMAC derived from the session secret,
 *   and also ensures the cookie carries the same token.
 */
function verifyCsrf(req, res, next) {
  console.log('🔍 CSRF verification for:', req.path);
  console.log('🔍 Request headers:', req.headers);
  console.log('🔍 Request cookies:', req.cookies);
  console.log('🔍 Request session:', req.session);
  
  // Skip for Bearer clients (mobile/3rd-party) — they should use Authorization header
  const authHeader = req.headers.authorization || '';
  if (/^Bearer\s+/i.test(authHeader)) {
    console.log('⏭️ Skipping CSRF for Bearer token');
    return next();
  }

  // Allow opt-out only in non-production (e.g., local E2E)
  if (env.ALLOW_NO_CSRF === 'true' && env.NODE_ENV !== 'production') {
    console.log('⏭️ Skipping CSRF (ALLOW_NO_CSRF=true)');
    return next();
  }

  const secret = req.session?.csrfSecret;
  if (!secret) {
    console.log('❌ No CSRF secret in session');
    return res.status(403).json({ success: false, error: 'CSRF token missing' });
  }

  // Accept either x-csrf-token or x-xsrf-token
  const headerToken = CSRF_HEADER_NAMES.map((h) => req.get(h)).find(Boolean);
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  console.log('🔐 CSRF tokens - Header:', headerToken ? headerToken.substring(0, 10) + '...' : 'None', 'Cookie:', cookieToken ? cookieToken.substring(0, 10) + '...' : 'None');

  if (!headerToken || !cookieToken) {
    console.log('❌ Missing CSRF tokens');
    return res.status(403).json({ success: false, error: 'CSRF token missing' });
  }

  const expectedToken = deriveToken(secret);

  // Require header to match derived token and cookie to carry the same token
  if (headerToken !== expectedToken || cookieToken !== expectedToken) {
    console.log('❌ CSRF token mismatch');
    return res.status(403).json({ success: false, error: 'Invalid CSRF token' });
  }

  console.log('✅ CSRF verification passed');
  return next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  issueCsrfToken,
  getCsrfToken,
  verifyCsrf,
};
