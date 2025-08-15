// translator-backend/middleware/requestId.js
const { randomUUID } = require('crypto');

module.exports = (req, res, next) => {
  // Generate a unique ID for the request
  req.id = randomUUID();
  // Set it as a response header so it can be seen in the browser or API clients
  res.set('x-request-id', req.id);
  next();
};