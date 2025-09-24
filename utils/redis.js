const Redis = require('ioredis');
const { env } = require('../config');

// Redis client configuration
const redisConfig = {
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

// Use Redis URL if provided (for production)
if (env.REDIS_URL) {
  redisConfig.url = env.REDIS_URL;
}

// Create Redis client
const redis = new Redis(redisConfig);

// Handle Redis connection events
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

// Cache utility functions
const cache = {
  // Set a key-value pair with optional expiration
  async set(key, value, ttlSeconds = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redis.setex(key, ttlSeconds, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  // Get a value by key
  async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  // Delete a key
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  // Check if a key exists
  async exists(key) {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  // Set expiration for a key
  async expire(key, ttlSeconds) {
    try {
      await redis.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  },

  // Get multiple keys
  async mget(keys) {
    try {
      const values = await redis.mget(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Redis MGET error:', error);
      return [];
    }
  },

  // Set multiple key-value pairs
  async mset(keyValuePairs, ttlSeconds = 3600) {
    try {
      const serializedPairs = {};
      for (const [key, value] of Object.entries(keyValuePairs)) {
        serializedPairs[key] = JSON.stringify(value);
      }
      
      await redis.mset(serializedPairs);
      
      // Set expiration for all keys
      if (ttlSeconds > 0) {
        const pipeline = redis.pipeline();
        for (const key of Object.keys(keyValuePairs)) {
          pipeline.expire(key, ttlSeconds);
        }
        await pipeline.exec();
      }
      
      return true;
    } catch (error) {
      console.error('Redis MSET error:', error);
      return false;
    }
  },

  // Clear all cache (use with caution)
  async flushall() {
    try {
      await redis.flushall();
      return true;
    } catch (error) {
      console.error('Redis FLUSHALL error:', error);
      return false;
    }
  },

  // Get Redis info
  async info() {
    try {
      return await redis.info();
    } catch (error) {
      console.error('Redis INFO error:', error);
      return null;
    }
  }
};

module.exports = { redis, cache };
