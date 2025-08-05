// translator-backend/config/index.js

const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

// Define the schema for your environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().min(1, { message: 'MONGO_URI is required.' }),
  DB_NAME: z.string().min(1, { message: 'DB_NAME is required.' }),
  JWT_SECRET: z.string().min(1, { message: 'JWT_SECRET is required.' }),
  GOLD_API_KEY: z.string().min(1, { message: 'GOLD_API_KEY is required.' }),
  EXCHANGE_RATE_API_KEY: z.string().min(1, { message: 'EXCHANGE_RATE_API_KEY is required.' }),
  GEOCODING_API_KEY: z.string().min(1, { message: 'GEOCODING_API_KEY is required.' }),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  // Add other keys like for OpenAI, Pinecone etc. as needed
  // OPENAI_API_KEY: z.string().min(1),
});

// Parse and validate the environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedEnv.error.flatten().fieldErrors,
  );
  // Exit the process with an error code
  process.exit(1);
}

// Export the validated and typed environment variables
module.exports = {
  env: parsedEnv.data,
};