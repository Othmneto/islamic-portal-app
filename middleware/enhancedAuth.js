// Enhanced Production-Grade Authentication Middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const { env } = require('../config');

// Rate limiting for token validation attempts
const tokenValidationAttempts = new Map();

const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         'unknown';
};

const isTokenRateLimited = (ip) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;
  
  if (!tokenValidationAttempts.has(ip)) {
    tokenValidationAttempts.set(ip, []);
  }
  
  const attempts = tokenValidationAttempts.get(ip);
  const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return true;
  }
  
  recentAttempts.push(now);
  tokenValidationAttempts.set(ip, recentAttempts);
  return false;
};

const recordTokenAttempt = (ip, success) => {
  if (!success) {
    const attempts = tokenValidationAttempts.get(ip) || [];
    attempts.push(Date.now());
    tokenValidationAttempts.set(ip, attempts);
  } else {
    tokenValidationAttempts.delete(ip);
  }
};

module.exports = async function(req, res, next) {
    const clientIP = getClientIP(req);
    const startTime = Date.now();
    
    // Check rate limiting for token validation
    if (isTokenRateLimited(clientIP)) {
        console.warn(`🚫 Rate limited token validation attempt from IP: ${clientIP}`);
        return res.status(429).json({ 
            msg: 'Too many token validation attempts. Please try again later.',
            retryAfter: 900
        });
    }

    // 1. Get the token from the standard Authorization header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        recordTokenAttempt(clientIP, false);
        return res.status(401).json({ msg: 'No token or malformed token, authorization denied' });
    }

    try {
        // 2. Extract the token
        const token = authHeader.split(' ')[1];

        // 3. Check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            console.warn(`🚫 Blacklisted token used from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(401).json({ msg: 'Token has been revoked' });
        }

        // 4. Verify the token
        const decoded = jwt.verify(token, env.JWT_SECRET);
        
        // 5. Extract user ID
        const userId = decoded.id || decoded.sub || decoded.user?.id;
        
        if (!userId) {
            console.warn(`🚫 Invalid token structure from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(401).json({ msg: 'Invalid token structure' });
        }

        // 6. Fetch user from database
        const user = await User.findById(userId).select('-password -passwordHistory -twoFactorSecret -backupCodes');
        if (!user) {
            console.warn(`🚫 User not found for token from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(401).json({ msg: 'User not found' });
        }

        // 7. Check if account is locked
        if (user.isAccountLocked()) {
            console.warn(`🚫 Locked account access attempt: ${user.email} from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(423).json({ 
                msg: 'Account is temporarily locked due to multiple failed login attempts',
                lockedUntil: user.accountLockedUntil,
                lockoutTimeRemaining: user.getLockoutTimeRemaining()
            });
        }

        // 8. Check if email is verified
        if (!user.isVerified) {
            console.warn(`🚫 Unverified account access attempt: ${user.email} from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(403).json({ 
                msg: 'Please verify your email before accessing the application',
                requiresVerification: true,
                email: user.email
            });
        }

        // 9. Check if password has expired
        if (user.isPasswordExpired()) {
            console.warn(`🚫 Expired password access attempt: ${user.email} from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(403).json({ 
                msg: 'Your password has expired. Please change your password.',
                requiresPasswordChange: true,
                passwordExpired: true
            });
        }

        // 10. Check if password needs to be changed
        if (user.needsPasswordChange()) {
            console.warn(`🚫 Password change required: ${user.email} from IP: ${clientIP}`);
            recordTokenAttempt(clientIP, false);
            return res.status(403).json({ 
                msg: 'Your password is due for renewal. Please change your password.',
                requiresPasswordChange: true,
                passwordExpired: false
            });
        }

        // 11. Update last activity
        await User.findByIdAndUpdate(userId, {
            lastLogin: new Date(),
            lastLoginIP: clientIP
        });

        // 12. Attach user to request
        req.user = user;
        req.clientIP = clientIP;
        
        // 13. Record successful authentication
        recordTokenAttempt(clientIP, true);
        
        // 14. Log successful authentication
        const processingTime = Date.now() - startTime;
        console.log(`✅ Successful authentication: ${user.email} from IP: ${clientIP} (${processingTime}ms)`);
        
        next();
    } catch (err) {
        console.warn(`🚫 Token verification failed from IP: ${clientIP}`, err.message);
        recordTokenAttempt(clientIP, false);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: 'Token has expired' });
        } else if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ msg: 'Invalid token' });
        } else {
            return res.status(401).json({ msg: 'Token is not valid' });
        }
    }
};
