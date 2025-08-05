// translator-backend/utils/logger.js

const winston = require('winston');

const logger = winston.createLogger({
  // The default minimum level of messages to log
  level: 'info',
  // The format for all logs
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Log the full stack trace on errors
    winston.format.splat(),
    winston.format.json() // Log in JSON format
  ),
  // Default metadata to be included in all logs
  defaultMeta: { service: 'translator-backend' },
  // Where to send the logs (the "transports")
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = logger;