// translator-backend/middleware/errorMiddleware.js

const errorHandler = (err, req, res, next) => {
    // Log the error for debugging purposes. In production, you'd use a robust logger.
    console.error(err.stack);

    // If the error has a specific status code, use it. Otherwise, default to 500 (Internal Server Error).
    const statusCode = err.statusCode || 500;

    // Send a consistent JSON response
    res.status(statusCode).json({
        message: err.message || 'An unexpected server error occurred.',
        // In a development environment, you might want to send the stack trace.
        // Avoid sending the stack trace in production for security reasons.
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    });
};

module.exports = errorHandler;