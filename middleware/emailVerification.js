// translator-backend/middleware/emailVerification.js

const User = require('../models/User');

/**
 * Middleware to check if user's email is verified
 * Should be used after authMiddleware to ensure user is authenticated
 */
const requireEmailVerification = async (req, res, next) => {
    try {
        // Check if user is authenticated (should be set by authMiddleware)
        if (!req.user) {
            return res.status(401).json({
                msg: 'Authentication required',
                requiresAuth: true
            });
        }

        // Get fresh user data from database
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                msg: 'User not found',
                requiresAuth: true
            });
        }

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({
                msg: 'Email verification required',
                requiresVerification: true,
                email: user.email,
                isVerified: false
            });
        }

        // Email is verified, continue
        next();
    } catch (error) {
        console.error('Email verification middleware error:', error);
        res.status(500).json({
            msg: 'Server error during email verification check'
        });
    }
};

/**
 * Optional middleware to check email verification status
 * Returns user verification status without blocking access
 */
const checkEmailVerification = async (req, res, next) => {
    try {
        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                req.user.isVerified = user.isVerified;
                req.user.email = user.email;
            }
        }
        next();
    } catch (error) {
        console.error('Email verification check error:', error);
        next(); // Continue even if check fails
    }
};

module.exports = {
    requireEmailVerification,
    checkEmailVerification
};
