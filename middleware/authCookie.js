// middleware/authCookie.js
// Cookie-based auth with double-submit CSRF.
// - Reads signed httpOnly "session" cookie containing a JWT
// - For unsafe methods, requires X-CSRF-Token header to match XSRF-TOKEN cookie

const jwt = require('jsonwebtoken');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseCookie(name, cookieString) {
  // non-HttpOnly CSRF cookie (plain) read from document.cookie on the client
  if (!cookieString) return null;
  const parts = cookieString.split(';').map(s => s.trim());
  for (const part of parts) {
    if (part.startsWith(name + '=')) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

function cookieAuth(options = {}) {
  const {
    jwtSecret = process.env.JWT_SECRET,
    cookieName = 'session',         // signed, httpOnly
    csrfCookie = 'XSRF-TOKEN',      // non-httpOnly
    csrfHeader = 'x-csrf-token'
  } = options;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not set. Cookie auth cannot initialize.');
  }

  return (req, res, next) => {
    try {
      // 1) Read signed cookie with JWT
      const token = req.signedCookies && req.signedCookies[cookieName];
      if (!token) return res.status(401).json({ msg: 'No session cookie' });

      // 2) Verify JWT & attach user
      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (e) {
        return res.status(401).json({ msg: 'Invalid or expired session' });
      }
      req.user = decoded.user || decoded; // support { user: {...} } or raw

      // 3) CSRF for unsafe methods
      if (!SAFE_METHODS.has(req.method)) {
        const headerToken = req.header(csrfHeader) || '';
        // read non-HttpOnly cookie (not signed)
        const cookieToken = req.cookies && req.cookies[csrfCookie];
        if (!cookieToken || !headerToken || cookieToken !== headerToken) {
          return res.status(403).json({ msg: 'CSRF validation failed' });
        }
      }

      return next();
    } catch (err) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
  };
}

module.exports = { cookieAuth };
