// middleware/socketAuth.js - JWT Authentication for Socket.IO connections
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * JWT Authentication middleware for Socket.IO connections
 * Verifies JWT token from handshake and attaches user info to socket
 */
const socketAuth = async (socket, next) => {
    try {
        // Extract token from handshake auth or headers
        const token = socket.handshake.auth?.token || 
                     socket.handshake.headers?.authorization?.split(' ')[1];
        
        if (!token) {
            return next(new Error('Authentication token required'));
        }

        // Check if token is blacklisted
        const isBlacklisted = await TokenBlacklist.findOne({ token });
        if (isBlacklisted) {
            return next(new Error('Token has been revoked'));
        }

        // Verify JWT token
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach user info to socket
        socket.user = {
            id: payload.sub || payload.id,
            email: payload.email,
            role: payload.role || 'user'
        };

        console.log(`[SocketAuth] Authenticated user: ${socket.user.id}`);
        next();
    } catch (error) {
        console.error('[SocketAuth] Authentication failed:', error.message);
        next(new Error('Invalid authentication token'));
    }
};

module.exports = socketAuth;
