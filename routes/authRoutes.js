// translator-backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // For input validation
const User = require('../models/User'); // Our User blueprint
const jwt = require('jsonwebtoken'); // For creating user tokens
const authMiddleware = require('../middleware/auth'); // Our upcoming authentication check

// --- Validation rules for user input ---
const registerValidation = [
    body('email')
        .isEmail().withMessage('Please enter a valid email address')
        .normalizeEmail(), // Cleans up the email format
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
        .matches(/\d/).withMessage('Password must contain a number')
        .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
];

const loginValidation = [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required')
];

// --- Authentication Middleware (for protecting routes) ---
// (This will be defined in middleware/auth.js, but we're referencing it here)

// --- Endpoints ---

// POST /api/auth/register
// Allows new users to create an account.
router.post('/register', registerValidation, async (req, res) => {
    // Check if there are any validation errors (e.g., invalid email format)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username } = req.body;

    try {
        // Check if a user with this email already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists with this email' });
        }

        // Create a new user based on our User blueprint (User.js)
        user = new User({
            email,
            password, // Password will be hashed by the 'pre save' middleware in User.js
            username: username || email.split('@')[0] // Use username if provided, otherwise part of email
        });

        // Save the new user to the database
        await user.save();

        // Create a JSON Web Token (JWT) for the new user
        // This token acts as their digital ID for future requests
        const payload = {
            user: {
                id: user.id // Store the user's unique ID in the token
            }
        };

        // Sign the token (create the actual token string)
        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'supersecretjwtkey', // Use a secret key from environment variables (important!)
            { expiresIn: '1h' }, // Token expires in 1 hour (you can adjust this)
            (err, token) => {
                if (err) throw err;
                // Send the token back to the frontend
                res.status(201).json({ msg: 'Registration successful', token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during registration');
    }
});

// POST /api/auth/login
// Allows existing users to log in.
router.post('/login', loginValidation, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Find the user by email
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Compare the provided password with the stored hashed password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Create a JSON Web Token (JWT) for the logged-in user
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'supersecretjwtkey', // Use the same secret key as registration
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ msg: 'Login successful', token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during login');
    }
});

// GET /api/auth/me
// Get user's own profile information (requires authentication)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // After authMiddleware, req.user will contain the user's ID
        const user = await User.findById(req.user.id).select('-password'); // Don't send password back!
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error fetching user data');
    }
});

router.post('/login', loginValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // --- NEW DEBUGGING LINES ---
    console.log(`Login attempt for email: ${email}`);
    console.log(`Password received (hashed by frontend if applicable, or raw here): ${password}`); // BE CAREFUL: DO NOT LOG SENSITIVE INFO IN PRODUCTION!

    try {
        let user = await User.findOne({ email });
        // --- NEW DEBUGGING LINE ---
        console.log(`User found in DB: ${user ? user.email : 'None'}`);

        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // --- NEW DEBUGGING LINE ---
        console.log(`Comparing provided password with stored hash for user: ${user.email}`);
        console.log(`Stored hashed password: ${user.password}`); // BE CAREFUL: DO NOT LOG SENSITIVE INFO IN PRODUCTION!

        const isMatch = await user.comparePassword(password);
        // --- NEW DEBUGGING LINE ---
        console.log(`Password comparison result: ${isMatch}`);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // ... (rest of JWT token creation and response) ...

    } catch (err) {
        console.error('Server Error during login:', err.message); // More specific error log
        res.status(500).send('Server Error during login');
    }
});

module.exports = router;