// translator-backend/config/logger.js
'use strict';

const pino = require('pino');
const { env } = require('./index');

// In development, use `pino-pretty` for human-readable output.
// In production, log as JSON.
const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

module.exports = { logger };
