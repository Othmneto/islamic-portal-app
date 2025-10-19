// translator-backend/middleware/validate.js

const { z } = require('zod');

/**
 * Zod-based validation middleware.
 * @param {z.ZodObject} schemas - A Zod schema object with optional keys: body, query, params.
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      // Validate each part of the request against the provided schemas
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      return next();
    } catch (e) {
      // If validation fails, return a 422 Unprocessable Entity error
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: e.errors, // Zod provides a detailed array of validation errors
        },
      });
    }
  };
}

module.exports = { validate, z };