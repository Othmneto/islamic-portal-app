// translator-backend/middleware/requireSession.js

const jwt = require('jsonwebtoken');
const { env } = require('../config');

/**
 * Middleware to protect routes by requiring a valid session cookie.
 * It verifies the JWT from the signed cookie and attaches the user to req.
 */
function requireSession(req, res, next) {
  const cookieName = env.SESSION_COOKIE_NAME || 'session';
  // Use signedCookies, which are automatically verified by cookie-parser
  // if a secret was provided when initializing the middleware.
  const token = req.signedCookies[cookieName];

  if (!token) {
    return res.status(401).json({ msg: 'Authentication error: No session cookie provided.' });
  }

  try {
    // Verify the JWT inside the cookie using your secret.
    const payload = jwt.verify(token, env.SESSION_JWT_SECRET);
    // Attach user information to the request object for use in other routes.
    req.user = { id: payload.sub, ...payload };
    next();
  } catch (err) {
    // This will catch errors from invalid or expired tokens.
    return res.status(401).json({ msg: 'Authentication error: Invalid session.' });
  }
}

module.exports = requireSession;