// translator-backend/utils/logger.js

// Simple console.log wrapper for consistency
const logger = {
  error: (message, meta = {}) => {
    console.error(`[ERROR] ${message}`, meta);
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
  },
  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, meta);
  },
  debug: (message, meta = {}) => {
    console.log(`[DEBUG] ${message}`, meta);
  }
};

module.exports = logger;