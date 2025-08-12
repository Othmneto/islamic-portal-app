// middleware/csrfMiddleware.js
const crypto = require('crypto');

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-csrf-token';

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function setCsrfCookie(res, token) {
  const isSecure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax; ${isSecure ? 'Secure; ' : ''}Max-Age=86400`,
  ]);
}

// Issue a CSRF cookie on any request (safe & additive)
function issueCsrfToken(req, res, next) {
  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader.includes(`${CSRF_COOKIE}=`)) {
    const token = makeToken();
    setCsrfCookie(res, token);
    res.locals.csrfToken = token;
  }
  next();
}

// Explicit endpoint to fetch a fresh token/cookie
function getCsrfToken(_req, res) {
  const token = makeToken();
  setCsrfCookie(res, token);
  res.status(200).json({ csrfToken: token });
}

// Optional standalone verifier (same logic as in authMiddleware.verifyCsrf)
function verifyCsrf(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (/^Bearer\s+/i.test(authHeader)) return next();
  if (process.env.ALLOW_NO_CSRF === 'true') return next();

  const headerToken = req.headers[CSRF_HEADER];
  const cookieHeader = req.headers.cookie || '';
  const cookieMatch = cookieHeader.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`));
  const cookieToken = cookieMatch ? cookieMatch[1] : null;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { issueCsrfToken, getCsrfToken, verifyCsrf };
