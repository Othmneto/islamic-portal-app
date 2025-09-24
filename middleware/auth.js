// translator-backend/middleware/auth.js

const jwt = require('jsonwebtoken');
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

        // 4. Check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            console.error('❌ Auth middleware: Token is blacklisted');
            return res.status(401).json({ msg: 'Token has been revoked' });
        }

        // 5. Verify the token
        const decoded = jwt.verify(token, env.JWT_SECRET);

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
        next(); // Allow the request to proceed
    } catch (err) {
        // If verification fails (e.g., token expired, invalid)
        res.status(401).json({ msg: 'Token is not valid' });
    }
};