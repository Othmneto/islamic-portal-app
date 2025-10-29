const NodeCache = require('node-cache');
const { logger } = require('../config/logger');

class HotCacheService {
  constructor() {
    // Cache with 24-hour TTL and size limit
    this.cache = new NodeCache({
      stdTTL: 86400, // 24 hours
      checkperiod: 3600, // Check for expired keys every hour
      useClones: false, // Better performance, careful with mutations
      maxKeys: 10000 // Limit cache size
    });
    
    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };

    // Setup event listeners
    this.cache.on('expired', (key) => {
      logger.info(`Cache key expired: ${key}`);
    });

    this.cache.on('del', (key) => {
      logger.debug(`Cache key deleted: ${key}`);
    });
  }

  // Get from cache
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  // Set in cache
  set(key, value, ttl = 86400) {
    this.stats.sets++;
    return this.cache.set(key, value, ttl);
  }

  // Multi-set for batch operations
  mset(items) {
    this.stats.sets += items.length;
    return this.cache.mset(items);
  }

  // Delete from cache
  del(key) {
    return this.cache.del(key);
  }

  // Flush specific pattern
  flushPattern(pattern) {
    const keys = this.cache.keys().filter(k => k.includes(pattern));
    if (keys.length > 0) {
      logger.info(`Flushing ${keys.length} keys matching pattern: ${pattern}`);
      this.cache.del(keys);
    }
    return keys.length;
  }

  // Flush all cache
  flushAll() {
    const count = this.cache.keys().length;
    this.cache.flushAll();
    logger.info(`Flushed all cache: ${count} keys removed`);
    return count;
  }

  // Get cache stats
  getStats() {
    return {
      ...this.stats,
      keys: this.cache.keys().length,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  // Warm up cache (preload popular data)
  async warmUp(popularCountries = ['US', 'GB', 'AE', 'SA', 'IN', 'PK']) {
    logger.info('🔥 [HotCache] Warming up cache with popular countries...');
    const Holiday = require('../models/Holiday');
    const year = new Date().getFullYear();
    
    let warmedCount = 0;
    for (const country of popularCountries) {
      try {
        const key = `holidays:${country}:${year}`;
        const holidays = await Holiday.find({ countryCode: country, year }).lean();
        
        if (holidays.length > 0) {
          this.set(key, holidays, 86400);
          warmedCount++;
          logger.debug(`Warmed cache for ${country} ${year}: ${holidays.length} holidays`);
        }
      } catch (error) {
        logger.error(`Failed to warm cache for ${country}:`, error);
      }
    }
    
    logger.info(`✅ [HotCache] Cache warmed with ${warmedCount}/${popularCountries.length} countries`);
    return warmedCount;
  }

  // Intelligent cache warming based on usage patterns
  async warmUpIntelligent() {
    logger.info('🧠 [HotCache] Starting intelligent cache warming...');
    const Holiday = require('../models/Holiday');
    const User = require('../models/User');
    
    try {
      // 1. Get most requested countries in last 7 days
      const popularCountries = await Holiday.aggregate([
        { 
          $match: { 
            lastUpdated: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            requestCount: { $gt: 0 }
          } 
        },
        { $group: { _id: '$countryCode', totalRequests: { $sum: '$requestCount' } } },
        { $sort: { totalRequests: -1 } },
        { $limit: 20 }
      ]);

      // 2. Get countries with upcoming holidays (next 30 days)
      const upcomingCountries = await Holiday.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(),
              $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            isPublicHoliday: true
          }
        },
        { $group: { _id: '$countryCode' } },
        { $limit: 10 }
      ]);

      // Combine unique countries
      const toWarm = [
        ...new Set([
          ...popularCountries.map(c => c._id),
          ...upcomingCountries.map(c => c._id)
        ])
      ];

      logger.info(`Warming cache for ${toWarm.length} countries based on usage patterns`);

      // Warm cache for current and next year
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear + 1];

      for (const country of toWarm) {
        for (const year of years) {
          try {
            const key = `holidays:${country}:${year}`;
            const holidays = await Holiday.find({ countryCode: country, year }).lean();
            
            if (holidays.length > 0) {
              this.set(key, holidays, 86400);
            }
          } catch (error) {
            logger.error(`Failed to warm cache for ${country} ${year}:`, error);
          }
        }
      }

      logger.info(`✅ [HotCache] Intelligent warming completed for ${toWarm.length} countries`);
      return toWarm.length;
    } catch (error) {
      logger.error('Error in intelligent cache warming:', error);
      return 0;
    }
  }

  // Get popular keys (most accessed)
  getPopularKeys(limit = 10) {
    // This is a simplified version - in production, you'd track access counts
    return this.cache.keys().slice(0, limit);
  }
}

// Singleton instance
const hotCache = new HotCacheService();

module.exports = hotCache;



