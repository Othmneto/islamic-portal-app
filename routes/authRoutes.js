// translator-backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// --- Import Controller and Middleware ---
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth'); // Your authentication check

// --- Validation Rules ---
const registerValidation = [
    body('email', 'Please enter a valid email address').isEmail().normalizeEmail(),
    body('username', 'Username is required').not().isEmpty().trim().escape(),
    body('password', 'Password must be at least 6 characters long').isLength({ min: 6 })
];

const loginValidation = [
    body('email', 'Please enter a valid email address').isEmail(),
    body('password', 'Password is required').notEmpty()
];

// --- Route Definitions ---

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', registerValidation, authController.register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', loginValidation, authController.login);

// @route   GET /api/auth/me
// @desc    Get current user's profile (protected)
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;