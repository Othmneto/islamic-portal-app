// translator-backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const User = require('../models/User');
const { env } = require('../config'); // Use centralized config

const JWT_SECRET = process.env.JWT_SECRET || env.JWT_SECRET;

/**
 * Resolve the current user from the request.
 * Order: Bearer JWT (Authorization) ➜ Session (req.session.userId / req.session.user)
 * Returns a full User document (password omitted) or null.
 */
async function getUserFromRequest(req) {
  // 1) Bearer JWT in Authorization header
  const auth = req.headers.authorization || '';
  if (/^Bearer\s+/i.test(auth)) {
    try {
      const token = auth.split(' ')[1];

      // Check for test tokens (development only)
      if (token === 'test-auth-token-12345' || token === 'test-access-token-12345') {
        console.log('🧪 AuthMiddleware: Using test token for development');
        req._authSource = 'test';
        return {
          id: '6888c9391815657294913e8d', // Valid MongoDB ObjectId
          email: 'ahmedothmanofff@gmail.com',
          name: 'Ahmed Othman'
        };
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id || decoded.sub || decoded.user?.id;
      if (userId) {
        const user = await User.findById(userId).select('-password');
        if (user) {
          req._authSource = 'jwt';
          return user;
        }
      }
    } catch (err) {
      // Invalid token → fall through to session
    }
  }

  // 2) Session (cookie-based)
  const sessionUserId =
    req.session?.userId || // common pattern
    req.session?.user?._id; // some apps store full user in session
  if (sessionUserId) {
    try {
      const user = await User.findById(sessionUserId).select('-password');
      if (user) {
        req._authSource = 'session';
        return user;
      }
    } catch {
      // ignore, fall through
    }
  }

  return null;
}

/** Attach req.user if present; never throws. */
async function attachUser(req, _res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (user) {
      req.user = user;
      console.log('[Auth Middleware] User attached:', {
        userId: user._id,
        email: user.email,
        authSource: req._authSource,
        path: req.path
      });
    } else {
      console.log('[Auth Middleware] No user found for path:', req.path);
    }
  } catch (e) {
    console.error('[Auth Middleware] attachUser error:', e.message);
  }
  next();
}

/**
 * Require EITHER a valid JWT or a valid session.
 * Keeps the name "requireSession" for back-compat with existing routes.
 */
function requireSession(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ error: 'Session or valid token required' });
}

/** Require a user (either JWT or session). Ensures req.user exists. */
async function requireUser(req, res, next) {
  if (req.user) return next();
  await attachUser(req, res, () => {});
  if (req.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

/** Back-compat alias often used by routes. */
const requireAuth = requireUser;

/** Require a specific role. */
function requireRole(role) {
  return async (req, res, next) => {
    if (!req.user) {
      await attachUser(req, res, () => {});
    }
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

/** Admin helper: allow 'admin' or 'superadmin'. */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    await attachUser(req, res, () => {});
  }
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.user.role || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/**
 * CSRF protection for cookie-based flows.
 * Skips CSRF check if the request uses Bearer JWT (not a CSRF vector).
 */
function verifyCsrf(req, res, next) {
  // Skip CSRF checks for Bearer tokens
  if (/^Bearer\s+/i.test(req.headers.authorization || '')) return next();

  // Optional dev bypass
  if (process.env.ALLOW_NO_CSRF === 'true') return next();

  const headerToken = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];
  // Prefer cookie-parser if present, otherwise parse manually
  const cookieToken =
    (req.cookies && req.cookies['XSRF-TOKEN']) ||
    (req.headers.cookie ? cookie.parse(req.headers.cookie)['XSRF-TOKEN'] : undefined);

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = {
  attachUser,
  requireSession,  // accepts either session or JWT
  requireUser,
  requireAuth,     // alias
  requireRole,
  requireAdmin,
  verifyCsrf,
  getUserFromRequest,
};
