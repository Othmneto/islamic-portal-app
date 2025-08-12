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

  // --- THIS IS THE FIX ---
  // Add the session secret to the schema so the app can load it
  SESSION_SECRET: z.string(),
  // ---------------------

  JWT_SECRET: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Redis (optional, for BullMQ)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_URL: z.string().optional(),
  NOTIFICATION_QUEUE_NAME: z.string().optional(),

  // AI model endpoint (optional)
  KAABAH_AI_API_URL: z.string().url().optional(),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error.format());
  process.exit(1);
}

module.exports = { env };
