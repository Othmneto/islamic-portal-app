// translator-backend/middleware/auth.js

const jwt = require('jsonwebtoken');
const { env } = require('../config'); // Use the validated Zod config

// This is our "bouncer" middleware function
module.exports = function(req, res, next) {
    // 1. Get the token from the standard Authorization header
    const authHeader = req.header('Authorization');

    // 2. Check if the header exists and is correctly formatted
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No token or malformed token, authorization denied' });
    }

    try {
        // 3. Extract the token from the 'Bearer <token>' string
        const token = authHeader.split(' ')[1];

        // 4. Verify the token
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // If valid, attach the user's information to the request
        req.user = decoded.user; 
        next(); // Allow the request to proceed
    } catch (err) {
        // If verification fails (e.g., token expired, invalid)
        res.status(401).json({ msg: 'Token is not valid' });
    }
};