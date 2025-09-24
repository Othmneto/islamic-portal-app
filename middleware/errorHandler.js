// translator-backend/middleware/errorHandler.js
'use strict';

// This is our standard error shape for all API responses
function errJson(code, details) {
  return {
    success: false,
    error: { code, details },
    requestId: undefined,
  };
}

// The error handling middleware. Must have 4 arguments.
module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');

  // Log the full error with context
  console.error('Error occurred:', {
    requestId: req.id, // Include the unique request ID
    err: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status,
    },
  });

  // Send a clean response to the client
  res.status(status).json({
    ...errJson(code, err.details),
    requestId: req.id,
  });
};