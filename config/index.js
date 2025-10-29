// translator-backend/config/index.js

const { z } = require('zod');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Define the schema for your environment variables
const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string(),
  DB_NAME: z.string(),
  CLIENT_ORIGIN: z.string().optional(),
  CLIENT_URL: z.string().optional(),
  SESSION_SECRET: z.string(),

  // --- THIS IS THE FIX ---
  // The JWT_SECRET must be a required string.
  JWT_SECRET: z.string().min(1, { message: "JWT_SECRET cannot be empty" }),
  // ---------------------

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Redis removed - using in-memory solution with NVMe persistence
  NOTIFICATION_QUEUE_NAME: z.string().optional(),

  // AI model endpoint (optional)
  KAABAH_AI_API_URL: z.string().url().optional(),

  // OpenAI API Key for translation
  OPENAI_API_KEY: z.string().optional(),

  // OAuth credentials
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_URL: z.string().optional(),

  // Email configuration
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_SECURE: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Security enhancements
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional(),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().optional(),
  ACCOUNT_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().optional(),
  ACCOUNT_LOCKOUT_DURATION_HOURS: z.coerce.number().optional(),
  PASSWORD_MIN_LENGTH: z.coerce.number().optional(),
  PASSWORD_EXPIRY_DAYS: z.coerce.number().optional(),
  SESSION_MAX_AGE_DAYS: z.coerce.number().optional(),
  SESSION_COOKIE_SECURE: z.string().optional(),
  SESSION_COOKIE_HTTP_ONLY: z.string().optional(),
  SESSION_COOKIE_SAME_SITE: z.string().optional(),

  // Monitoring & Logging
  LOG_LEVEL: z.string().optional(),
  ENABLE_SECURITY_LOGGING: z.string().optional(),
  ENABLE_PERFORMANCE_MONITORING: z.string().optional(),
  DEBUG: z.string().optional(),
  VERBOSE_LOGGING: z.string().optional(),

  // JWT Token Configuration
  JWT_EXPIRY_SHORT: z.string().default('24h'),
  JWT_EXPIRY_LONG: z.string().default('90d'),
  JWT_AUDIENCE: z.string().default('translator-backend'),
  JWT_ISSUER: z.string().default('translator-backend'),
  JWT_GRACE_SKEW_SECONDS: z.coerce.number().default(30),

  // Session Configuration
  SESSION_SLIDING_WINDOW_THRESHOLD: z.coerce.number().default(0.5),

  // Authentication Feature Flags
  AUTH_REMEMBER_ME_ENABLED: z.string().default('true'),
  AUTH_SLIDING_RENEWAL_ENABLED: z.string().default('true'),
  AUTH_REFRESH_ROTATION_HASHED_ENABLED: z.string().default('true'),
  AUTH_CROSS_TAB_SYNC_ENABLED: z.string().default('true'),

  // Push Notification Feature Flags
  PUSH_SUBSCRIPTION_HEALTH_ENABLED: z.string().default('true'),
  NOTIFY_DELIVERY_CONFIRMATION_ENABLED: z.string().default('true'),
  NOTIFY_RETRY_BACKOFF_ENABLED: z.string().default('true'),

  // CSRF Configuration
  ALLOW_NO_CSRF: z.string().default('true'),

  // Audio Feature Flags (disabled by default for safety)
  AUDIO_ENABLED: z.string().default('false'),
  AUDIO_MAX_VOLUME: z.coerce.number().default(0.9),
  AUDIO_MAX_FADE_MS: z.coerce.number().default(10000),
  AUDIO_COOLDOWN_SECONDS: z.coerce.number().default(30),
  AUDIO_DEFAULT_PROFILE: z.string().default('madinah'),

  // Holiday API Keys (optional)
  CALENDARIFIC_API_KEY: z.string().optional(),
  ABSTRACT_HOLIDAYS_API_KEY: z.string().optional(),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error.format());
  process.exit(1);
}

module.exports = { env };
