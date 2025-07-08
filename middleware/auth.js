// translator-backend - full/middleware/auth.js

const jwt = require('jsonwebtoken');

// This is our "bouncer" middleware function
module.exports = function(req, res, next) {
    // 1. Get the token from the request header
    // It's usually sent as 'Authorization: Bearer <token>'
    const token = req.header('x-auth-token'); // A common header name for JWTs

    // 2. Check if no token is found
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // 3. Verify the token
    try {
        // Use jwt.verify to check if the token is valid and hasn't expired
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');

        // If valid, the 'decoded' object will contain the payload we put in (user ID)
        req.user = decoded.user; // Attach the user's information to the request
        next(); // Allow the request to proceed to the next function/route
    } catch (err) {
        // If verification fails (e.g., token expired, invalid secret)
        res.status(401).json({ msg: 'Token is not valid' });
    }
};