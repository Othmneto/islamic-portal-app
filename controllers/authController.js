// translator-backend/controllers/authController.js

const { validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config'); // Use centralized config
const sendEmail = require('../utils/sendEmail');
const { logAuthEvent, logSecurityViolation } = require('../middleware/securityLogging');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
exports.register = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Log validation errors for potential debugging
        console.warn('Validation failed during registration:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            // This is a client error, so we log it as a warning.
            console.warn('Registration attempt for existing user:', email);
            return res.status(400).json({ msg: 'User already exists with this email' });
        }

        // Generate email verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        user = new User({
            email,
            password,
            username: username || email.split('@')[0],
            emailVerificationToken,
            emailVerificationExpires,
            isVerified: false
        });

        await user.save();

        // Send verification email
        try {
            const verificationUrl = `${env.CLIENT_URL || 'http://localhost:3000'}/verify-email.html?token=${emailVerificationToken}`;
            
            await sendEmail({
                to: user.email,
                subject: 'Verify Your Email Address',
                html: `
                    <h2>Welcome to our Islamic App!</h2>
                    <p>Please verify your email address by clicking the link below:</p>
                    <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't create an account, please ignore this email.</p>
                `
            });
            
            console.log(`📧 Verification email sent to: ${user.email}`);
        } catch (emailError) {
            console.error('❌ Failed to send verification email:', emailError);
            // Don't fail registration if email fails, but log it
        }

        const payload = {
            id: user.id,
            role: user.role
        };

        // Don't return JWT token immediately - require email verification first
        console.log('✅ User registered successfully:', { userId: user.id, email: user.email });
        res.status(201).json({
            msg: 'Registration successful! Please check your email to verify your account.',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                isVerified: user.isVerified
            },
            requiresVerification: true
        });

    } catch (err) {
        // This is a server error, so we log it as an error.
        console.error('Server error during user registration:', err);
        next(err); // Pass error to the centralized error handler
    }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
exports.login = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if user exists or not
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check if account is locked
        if (user.isAccountLocked()) {
            return res.status(423).json({ 
                msg: 'Account is temporarily locked due to multiple failed login attempts',
                lockedUntil: user.accountLockedUntil
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            // Increment failed login attempts
            await user.incrementLoginAttempts();
            
            // Log security event
            console.warn(`🚨 Failed login attempt for user: ${user.email} from IP: ${clientIP}`);
            await logAuthEvent('LOGIN_FAILED', req, { email: user.email });
            
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check if email is verified
        if (!user.isVerified) {
            return res.status(400).json({ 
                msg: 'Please verify your email before logging in',
                requiresVerification: true,
                email: user.email
            });
        }

        // Reset failed login attempts on successful login
        await user.resetLoginAttempts();

        // Generate JWT token
        const payload = {
            id: user.id,
            role: user.role,
            email: user.email
        };

        jwt.sign(
            payload,
            env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                
                // Log successful login
                console.log(`✅ Successful login: ${user.email} from IP: ${clientIP}`);
                logAuthEvent('LOGIN_SUCCESS', req, { email: user.email });
                
                res.json({ 
                    msg: 'Login successful', 
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        username: user.username,
                        role: user.role
                    }
                });
            }
        );

    } catch (err) {
        console.error('Server error during login:', err);
        next(err);
    }
};

// @route   GET /api/auth/me
// @desc    Get current user's profile
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            console.warn('Attempted to fetch non-existent user profile:', req.user.id);
            return res.status(404).json({ msg: 'User not found' });
        }
        console.log('User profile fetched:', req.user.id);
        res.json(user);
    } catch (err) {
        console.error('Server error fetching user profile:', { userId: req.user.id, error: err });
        next(err);
    }
};

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    console.log('🔑 Forgot password request received:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('Validation failed during forgot password:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    console.log('📧 Processing forgot password for email:', email);

    try {
        const user = await User.findOne({ email });
        
        // Always return success to prevent email enumeration
        // But only send email if user exists
        if (user) {
            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            
            // Hash token and set expiry (1 hour)
            user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
            
            await user.save();

            // Create reset URL
            const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

            // Email content
            const message = `
                <h2>Password Reset Request</h2>
                <p>You have requested to reset your password for your Translator App account.</p>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <hr>
                <p><small>If the button doesn't work, copy and paste this link: ${resetUrl}</small></p>
            `;

            try {
                console.log('📧 Attempting to send email to:', user.email);
                console.log('📧 Email configuration check:', {
                    EMAIL_HOST: process.env.EMAIL_HOST || 'Not set',
                    EMAIL_PORT: process.env.EMAIL_PORT || 'Not set',
                    EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Not set',
                    EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'Not set'
                });
                
                await sendEmail({
                    email: user.email,
                    subject: 'Password Reset Request - Translator App',
                    html: message,
                });
                
                console.log('✅ Password reset email sent successfully:', user.email);
            } catch (emailError) {
                // If email fails, clear the reset token
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                await user.save();
                
                console.error('❌ Failed to send password reset email:', { 
                    email: user.email, 
                    error: emailError.message,
                    stack: emailError.stack 
                });
                return res.status(500).json({ msg: 'Failed to send reset email. Please try again.' });
            }
        }

        // Always return success message to prevent email enumeration
        res.status(200).json({ 
            msg: 'If an account with that email exists, a password reset link has been sent.' 
        });

    } catch (err) {
        console.error('Server error during forgot password:', err);
        next(err);
    }
};

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
exports.resetPassword = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('Validation failed during password reset:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    try {
        // Hash the token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid reset token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.warn('Invalid or expired password reset token used');
            return res.status(400).json({ msg: 'Invalid or expired reset token' });
        }

        // Update password and clear reset token
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        
        await user.save();

        console.log('Password reset successful:', { userId: user.id, email: user.email });
        res.status(200).json({ msg: 'Password has been reset successfully' });

    } catch (err) {
        console.error('Server error during password reset:', err);
        next(err);
    }
};

// Setup username for OAuth users
exports.setupUsername = async (req, res, next) => {
    try {
        const { username } = req.body;
        const userId = req.user.id;

        // Validate username
        if (!username || username.length < 3 || username.length > 30) {
            return res.status(400).json({ error: 'Username must be 3-30 characters long' });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
        }

        // Check if username is already taken
        const existingUser = await User.findOne({ username });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        // Update user with username
        const user = await User.findByIdAndUpdate(
            userId,
            { username },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('✅ Username setup completed for user:', user.email, 'Username:', user.username);
        res.status(200).json({ msg: 'Username setup completed successfully', username: user.username });

    } catch (err) {
        console.error('Server error during username setup:', err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Username is already taken' });
        }
        next(err);
    }
};

// @route   GET /api/auth/verify-email/:token
// @desc    Verify user email with token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ msg: 'Verification token is required' });
        }

        // Find user with valid verification token
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.warn('Invalid or expired email verification token used');
            return res.status(400).json({ msg: 'Invalid or expired verification token' });
        }

        // Mark email as verified and clear verification token
        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        
        await user.save();

        console.log('✅ Email verification successful:', { userId: user.id, email: user.email });
        res.status(200).json({ 
            msg: 'Email verified successfully',
            verified: true,
            email: user.email
        });

    } catch (err) {
        console.error('Server error during email verification:', err);
        next(err);
    }
};

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification
// @access  Public
exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ msg: 'Email is required' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if email exists or not for security
            return res.status(200).json({ msg: 'If the email exists and is not verified, a verification email has been sent' });
        }

        if (user.isVerified) {
            return res.status(400).json({ msg: 'Email is already verified' });
        }

        // Generate new verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Update user with new token
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationExpires = emailVerificationExpires;
        await user.save();

        // Send verification email
        try {
            const verificationUrl = `${env.CLIENT_URL || 'http://localhost:3000'}/verify-email.html?token=${emailVerificationToken}`;
            
            await sendEmail({
                to: user.email,
                subject: 'Verify Your Email Address',
                html: `
                    <h2>Email Verification</h2>
                    <p>Please verify your email address by clicking the link below:</p>
                    <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't request this verification, please ignore this email.</p>
                `
            });
            
            console.log(`📧 Verification email resent to: ${user.email}`);
        } catch (emailError) {
            console.error('❌ Failed to resend verification email:', emailError);
            return res.status(500).json({ msg: 'Failed to send verification email' });
        }

        res.status(200).json({ msg: 'Verification email sent successfully' });

    } catch (err) {
        console.error('Server error during resend verification:', err);
        next(err);
    }
};