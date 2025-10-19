// Enhanced Production-Grade Authentication Controller
const { validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config');
const sendEmail = require('../utils/sendEmail');

// Security event logging
const logSecurityEvent = (event, details) => {
    console.log(`🔒 SECURITY EVENT: ${event}`, {
        timestamp: new Date().toISOString(),
        ...details
    });
};

// @route   POST /api/auth/login
// @desc    Enhanced user authentication with comprehensive security checks
// @access  Public
exports.login = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const startTime = Date.now();

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if user exists or not
            logSecurityEvent('LOGIN_ATTEMPT_NONEXISTENT_USER', { email, clientIP, userAgent });
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check if account is locked
        if (user.isAccountLocked()) {
            logSecurityEvent('LOGIN_ATTEMPT_LOCKED_ACCOUNT', {
                email: user.email,
                clientIP,
                userAgent,
                lockoutTimeRemaining: user.getLockoutTimeRemaining()
            });
            return res.status(423).json({
                msg: 'Account is temporarily locked due to multiple failed login attempts',
                lockedUntil: user.accountLockedUntil,
                lockoutTimeRemaining: user.getLockoutTimeRemaining()
            });
        }

        // Check if email is verified
        if (!user.isVerified) {
            logSecurityEvent('LOGIN_ATTEMPT_UNVERIFIED_EMAIL', {
                email: user.email,
                clientIP,
                userAgent
            });
            return res.status(400).json({
                msg: 'Please verify your email before logging in',
                requiresVerification: true,
                email: user.email
            });
        }

        // Check if password has expired
        if (user.isPasswordExpired()) {
            logSecurityEvent('LOGIN_ATTEMPT_EXPIRED_PASSWORD', {
                email: user.email,
                clientIP,
                userAgent
            });
            return res.status(403).json({
                msg: 'Your password has expired. Please change your password.',
                requiresPasswordChange: true,
                passwordExpired: true
            });
        }

        // Check if password needs to be changed
        if (user.needsPasswordChange()) {
            logSecurityEvent('LOGIN_ATTEMPT_PASSWORD_CHANGE_REQUIRED', {
                email: user.email,
                clientIP,
                userAgent
            });
            return res.status(403).json({
                msg: 'Your password is due for renewal. Please change your password.',
                requiresPasswordChange: true,
                passwordExpired: false
            });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            // Increment failed login attempts
            await user.incrementLoginAttempts();

            // Log security event
            logSecurityEvent('LOGIN_FAILED_INVALID_PASSWORD', {
                email: user.email,
                clientIP,
                userAgent,
                failedAttempts: user.failedLoginAttempts + 1
            });

            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check if password is in history (prevent reuse)
        const isPasswordInHistory = await user.isPasswordInHistory(password);
        if (isPasswordInHistory) {
            logSecurityEvent('LOGIN_ATTEMPT_PASSWORD_REUSE', {
                email: user.email,
                clientIP,
                userAgent
            });
            return res.status(400).json({
                msg: 'You cannot reuse a previous password. Please choose a new password.',
                requiresPasswordChange: true
            });
        }

        // Reset failed login attempts on successful login
        await user.resetLoginAttempts();

        // Set password expiration if not set
        if (!user.passwordExpiresAt) {
            user.setPasswordExpiration();
            await user.save();
        }

        // Generate JWT token with enhanced payload
        const payload = {
            id: user.id,
            role: user.role,
            email: user.email,
            username: user.username,
            iat: Math.floor(Date.now() / 1000),
            jti: crypto.randomUUID() // JWT ID for token tracking
        };

        jwt.sign(
            payload,
            env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;

                // Log successful login
                const processingTime = Date.now() - startTime;
                logSecurityEvent('LOGIN_SUCCESS', {
                    email: user.email,
                    clientIP,
                    userAgent,
                    processingTime,
                    userId: user.id
                });

                res.json({
                    msg: 'Login successful',
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        username: user.username,
                        role: user.role,
                        isVerified: user.isVerified,
                        lastLogin: user.lastLogin,
                        passwordExpiresAt: user.passwordExpiresAt
                    }
                });
            }
        );

    } catch (err) {
        logSecurityEvent('LOGIN_ERROR', {
            email,
            clientIP,
            userAgent,
            error: err.message
        });
        console.error('Server error during login:', err);
        next(err);
    }
};

// @route   POST /api/auth/change-password
// @desc    Change user password with security checks
// @access  Private
exports.changePassword = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const clientIP = req.clientIP || 'unknown';

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            logSecurityEvent('PASSWORD_CHANGE_INVALID_CURRENT', {
                userId,
                clientIP
            });
            return res.status(400).json({ msg: 'Current password is incorrect' });
        }

        // Check if new password is in history
        const isPasswordInHistory = await user.isPasswordInHistory(newPassword);
        if (isPasswordInHistory) {
            return res.status(400).json({
                msg: 'You cannot reuse a previous password. Please choose a new password.'
            });
        }

        // Update password
        user.password = newPassword;
        user.lastPasswordChange = new Date();
        user.setPasswordExpiration();
        await user.save();

        logSecurityEvent('PASSWORD_CHANGED', {
            userId,
            clientIP
        });

        res.json({ msg: 'Password changed successfully' });

    } catch (err) {
        logSecurityEvent('PASSWORD_CHANGE_ERROR', {
            userId,
            clientIP,
            error: err.message
        });
        console.error('Server error during password change:', err);
        next(err);
    }
};

// @route   POST /api/auth/force-password-change
// @desc    Force password change for expired passwords
// @access  Public
exports.forcePasswordChange = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, newPassword } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if password is in history
        const isPasswordInHistory = await user.isPasswordInHistory(newPassword);
        if (isPasswordInHistory) {
            return res.status(400).json({
                msg: 'You cannot reuse a previous password. Please choose a new password.'
            });
        }

        // Update password
        user.password = newPassword;
        user.lastPasswordChange = new Date();
        user.setPasswordExpiration();
        await user.save();

        logSecurityEvent('FORCE_PASSWORD_CHANGE', {
            email: user.email,
            clientIP
        });

        res.json({ msg: 'Password changed successfully' });

    } catch (err) {
        logSecurityEvent('FORCE_PASSWORD_CHANGE_ERROR', {
            email,
            clientIP,
            error: err.message
        });
        console.error('Server error during force password change:', err);
        next(err);
    }
};

module.exports = exports;
