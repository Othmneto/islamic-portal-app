// Enhanced security authentication middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const { env } = require('../config');

// Rate limiting for authentication attempts
const authAttempts = new Map();

const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         'unknown';
};

const isRateLimited = (ip) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  
  if (!authAttempts.has(ip)) {
    authAttempts.set(ip, []);
  }
  
  const attempts = authAttempts.get(ip);
  const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return true;
  }
  
  recentAttempts.push(now);
  authAttempts.set(ip, recentAttempts);
  return false;
};

const recordAuthAttempt = (ip, success) => {
  if (!success) {
    const attempts = authAttempts.get(ip) || [];
    attempts.push(Date.now());
    authAttempts.set(ip, attempts);
  } else {
    authAttempts.delete(ip);
  }
};

module.exports = async function(req, res, next) {
    const clientIP = getClientIP(req);
    
    // Check rate limiting
    if (isRateLimited(clientIP)) {
        console.warn(`🚫 Rate limited authentication attempt from IP: ${clientIP}`);
        return res.status(429).json({ 
            msg: 'Too many authentication attempts. Please try again later.',
            retryAfter: 900 // 15 minutes in seconds
        });
    }

    // Get the token from the standard Authorization header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        recordAuthAttempt(clientIP, false);
        return res.status(401).json({ 
            msg: 'No token or malformed token, authorization denied',
            code: 'NO_TOKEN'
        });
    }

    try {
        // Extract the token
        const token = authHeader.split(' ')[1];

        // Check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            console.warn(`🚫 Blacklisted token used from IP: ${clientIP}`);
            recordAuthAttempt(clientIP, false);
            return res.status(401).json({ 
                msg: 'Token has been revoked',
                code: 'TOKEN_BLACKLISTED'
            });
        }

        // Verify the token
        const decoded = jwt.verify(token, env.JWT_SECRET);
        
        // Check token type
        if (decoded.type && decoded.type !== 'access') {
            console.warn(`🚫 Invalid token type from IP: ${clientIP}`);
            recordAuthAttempt(clientIP, false);
            return res.status(401).json({ 
                msg: 'Invalid token type',
                code: 'INVALID_TOKEN_TYPE'
            });
        }
        
        // Extract user ID
        const userId = decoded.id || decoded.sub || decoded.user?.id;
        
        if (!userId) {
            console.warn(`🚫 Invalid token structure from IP: ${clientIP}`);
            recordAuthAttempt(clientIP, false);
            return res.status(401).json({ 
                msg: 'Invalid token structure',
                code: 'INVALID_TOKEN_STRUCTURE'
            });
        }

        // Fetch user from database
        const user = await User.findById(userId).select('-password -passwordHistory -twoFactorSecret -backupCodes');
        if (!user) {
            console.warn(`🚫 User not found for token from IP: ${clientIP}`);
            recordAuthAttempt(clientIP, false);
            return res.status(401).json({ 
                msg: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if account is locked
        if (user.isAccountLocked()) {
            console.warn(`🚫 Locked account access attempt: ${user.email} from IP: ${clientIP}`);
            recordAuthAttempt(clientIP, false);
            return res.status(423).json({ 
                msg: 'Account is temporarily locked due to multiple failed login attempts',
                code: 'ACCOUNT_LOCKED',
                lockedUntil: user.accountLockedUntil
            });
        }

        // Check if email is verified
        if (!user.isVerified) {
            console.warn(`🚫 Unverified account access attempt: ${user.email} from IP: ${clientIP}`);
            recordAuthAttempt(clientIP, false);
            return res.status(403).json({ 
                msg: 'Please verify your email before accessing the application',
                code: 'EMAIL_NOT_VERIFIED',
                requiresVerification: true,
                email: user.email
            });
        }

        // Update last login info (only if it's been more than 5 minutes)
        const now = new Date();
        const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
        const timeSinceLastLogin = lastLogin ? now - lastLogin : Infinity;
        
        if (timeSinceLastLogin > 5 * 60 * 1000) { // 5 minutes
            await User.findByIdAndUpdate(userId, {
                lastLogin: now,
                lastLoginIP: clientIP
            });
        }

        // Attach user to request
        req.user = user;
        req.clientIP = clientIP;
        
        // Record successful authentication
        recordAuthAttempt(clientIP, true);
        
        next();
    } catch (err) {
        console.warn(`🚫 Token verification failed from IP: ${clientIP}`, err.message);
        recordAuthAttempt(clientIP, false);
        
        // Provide more specific error messages
        let errorCode = 'TOKEN_INVALID';
        let errorMessage = 'Token is not valid';
        
        if (err.name === 'TokenExpiredError') {
            errorCode = 'TOKEN_EXPIRED';
            errorMessage = 'Token has expired';
        } else if (err.name === 'JsonWebTokenError') {
            errorCode = 'TOKEN_MALFORMED';
            errorMessage = 'Token is malformed';
        }
        
        res.status(401).json({ 
            msg: errorMessage,
            code: errorCode
        });
    }
};
