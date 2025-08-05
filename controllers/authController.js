// translator-backend/controllers/authController.js

const { validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger'); // Import the new logger

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
exports.register = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Log validation errors for potential debugging
        logger.warn('Validation failed during registration', { errors: errors.array() });
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            // This is a client error, so we log it as a warning.
            logger.warn('Registration attempt for existing user', { email });
            return res.status(400).json({ msg: 'User already exists with this email' });
        }

        user = new User({
            email,
            password,
            username: username || email.split('@')[0]
        });

        await user.save();

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err; // This will be caught by the catch block
                // Log successful registration
                logger.info('New user registered successfully', { userId: user.id, email });
                res.status(201).json({ msg: 'Registration successful', token });
            }
        );

    } catch (err) {
        // This is a server error, so we log it as an error.
        logger.error('Server error during user registration', { error: err });
        next(err); // Pass error to the centralized error handler
    }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
exports.login = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Validation failed during login', { errors: errors.array() });
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            logger.warn('Login failed: User not found', { email });
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logger.warn('Login failed: Invalid password', { email });
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                logger.info('User logged in successfully', { userId: user.id, email });
                res.json({ msg: 'Login successful', token });
            }
        );

    } catch (err) {
        logger.error('Server error during login', { error: err });
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
            logger.warn('Attempted to fetch non-existent user profile', { userId: req.user.id });
            return res.status(404).json({ msg: 'User not found' });
        }
        logger.info('User profile fetched', { userId: req.user.id });
        res.json(user);
    } catch (err) {
        logger.error('Server error fetching user profile', { userId: req.user.id, error: err });
        next(err);
    }
};