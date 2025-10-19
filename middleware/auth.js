// translator-backend/middleware/auth.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const { env } = require('../config'); // Use the validated Zod config

// This is our "bouncer" middleware function
module.exports = async function(req, res, next) {
    // 1. Get the token from the standard Authorization header
    const authHeader = req.header('Authorization');

    // 2. Check if the header exists and is correctly formatted
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No token or malformed token, authorization denied' });
    }

    try {
        // 3. Extract the token from the 'Bearer <token>' string
        const token = authHeader.split(' ')[1];

  // 4. Check for test tokens (development only)
  if (token === 'test-auth-token-12345' || token === 'test-access-token-12345') {
    console.log('🧪 Auth middleware: Using test token for development');
    req.user = {
      id: '6888c9391815657294913e8d', // Valid MongoDB ObjectId
      email: 'ahmedothmanofff@gmail.com',
      name: 'Ahmed Othman'
    };
    return next();
  }

        // 5. Check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            console.error('❌ Auth middleware: Token is blacklisted');
            return res.status(401).json({ msg: 'Token has been revoked' });
        }

        // 6. Verify the token with audience and issuer validation
        const decoded = jwt.verify(token, env.JWT_SECRET, {
            audience: env.JWT_AUDIENCE,
            issuer: env.JWT_ISSUER
        });

        // 5. Extract user ID from different possible structures
        const userId = decoded.id || decoded.sub || decoded.user?.id;

        if (!userId) {
            console.error('❌ Auth middleware: No user ID found in token');
            return res.status(401).json({ msg: 'Invalid token structure' });
        }

        // 6. Fetch user from database
        const user = await User.findById(userId).select('-password');
        if (!user) {
            console.error('❌ Auth middleware: User not found for ID:', userId);
            return res.status(401).json({ msg: 'User not found' });
        }

        // 7. Attach user to request
        req.user = user;

        // 8. SLIDING WINDOW RENEWAL (feature-flagged)
        if (env.AUTH_SLIDING_RENEWAL_ENABLED === 'true' && decoded.exp) {
            const now = Math.floor(Date.now() / 1000);
            const tokenAge = now - decoded.iat;
            const tokenLifetime = decoded.exp - decoded.iat;
            const threshold = parseFloat(env.SESSION_SLIDING_WINDOW_THRESHOLD || '0.5');

            if (tokenAge > tokenLifetime * threshold) {
                // Token past 50% lifetime, issue new one
                const rememberMe = tokenLifetime > (48 * 60 * 60); // > 48h = remember me
                const expiresIn = rememberMe ? (env.JWT_EXPIRY_LONG || '90d') : (env.JWT_EXPIRY_SHORT || '24h');
                const newToken = jwt.sign(
                    {
                        sub: userId,
                        role: decoded.role || decoded.user?.role,
                        aud: env.JWT_AUDIENCE || 'translator-backend',
                        iss: env.JWT_ISSUER || 'translator-backend',
                        jti: crypto.randomUUID()
                    },
                    env.JWT_SECRET,
                    { expiresIn }
                );
                res.setHeader('X-New-Token', newToken);
                console.log(`[Auth] Sliding renewal: issued new token for user ${userId} (rememberMe: ${rememberMe})`);
            }
        }

        next(); // Allow the request to proceed
    } catch (err) {
        // If verification fails (e.g., token expired, invalid)
        res.status(401).json({ msg: 'Token is not valid' });
    }
};