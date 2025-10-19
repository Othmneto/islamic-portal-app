// services/diskPersistence.js - NVMe Disk Persistence Layer
'use strict';

const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');

/**
 * High-performance disk persistence layer for production environments
 * Uses NVMe SSD for fast, reliable data persistence
 */
class DiskPersistence {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'data', 'persistence');
    this.compression = options.compression || false;
    this.syncInterval = options.syncInterval || 1000; // 1 second
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 100;

    // In-memory cache for hot data
    this.cache = new Map();
    this.dirtyKeys = new Set();
    this.syncTimer = null;
    this.isShuttingDown = false;

    // Statistics
    this.stats = {
      reads: 0,
      writes: 0,
      syncs: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Initialize the persistence layer
   */
  async initialize() {
    try {
      // Ensure base directory exists
      await fs.mkdir(this.baseDir, { recursive: true });

      // Create subdirectories
      await fs.mkdir(path.join(this.baseDir, 'queues'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'cache'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'ratelimits'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'backup'), { recursive: true });

      // Start periodic sync
      this.startSyncTimer();

      // Load existing data on startup
      await this.loadFromDisk();

      console.log(`💾 [DiskPersistence] Initialized with base directory: ${this.baseDir}`);
      return true;
    } catch (error) {
      console.error('❌ [DiskPersistence] Initialization failed:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get data from cache or disk
   */
  async get(key, category = 'cache') {
    try {
      // Check in-memory cache first
      const cacheKey = `${category}:${key}`;
      if (this.cache.has(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      // Read from disk
      const filePath = this.getFilePath(key, category);
      const data = await this.readFromFile(filePath);

      if (data !== null) {
        this.cache.set(cacheKey, data);
        this.stats.cacheMisses++;
        this.stats.reads++;
      }

      return data;
    } catch (error) {
      console.error(`❌ [DiskPersistence] Get failed for ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set data in cache and mark for disk write
   */
  async set(key, value, category = 'cache', options = {}) {
    try {
      const cacheKey = `${category}:${key}`;
      const data = {
        value,
        timestamp: Date.now(),
        ttl: options.ttl || null,
        category,
        key
      };

      // Update in-memory cache
      this.cache.set(cacheKey, data);
      this.dirtyKeys.add(cacheKey);
      this.stats.writes++;

      // Immediate write for critical data
      if (options.immediate) {
        await this.syncToDisk(cacheKey);
      }

      return true;
    } catch (error) {
      console.error(`❌ [DiskPersistence] Set failed for ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete data from cache and disk
   */
  async delete(key, category = 'cache') {
    try {
      const cacheKey = `${category}:${key}`;

      // Remove from cache
      this.cache.delete(cacheKey);
      this.dirtyKeys.delete(cacheKey);

      // Remove from disk
      const filePath = this.getFilePath(key, category);
      await this.deleteFile(filePath);

      return true;
    } catch (error) {
      console.error(`❌ [DiskPersistence] Delete failed for ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get all keys in a category
   */
  async keys(category = 'cache') {
    try {
      const categoryDir = path.join(this.baseDir, category);
      const files = await fs.readdir(categoryDir);
      return files.map(file => file.replace('.json', ''));
    } catch (error) {
      console.error(`❌ [DiskPersistence] Keys failed for ${category}:`, error);
      return [];
    }
  }

  /**
   * Clear all data in a category
   */
  async clear(category = 'cache') {
    try {
      const categoryDir = path.join(this.baseDir, category);
      const files = await fs.readdir(categoryDir);

      // Remove from cache
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${category}:`)) {
          this.cache.delete(key);
          this.dirtyKeys.delete(key);
        }
      }

      // Remove from disk
      for (const file of files) {
        await fs.unlink(path.join(categoryDir, file));
      }

      return true;
    } catch (error) {
      console.error(`❌ [DiskPersistence] Clear failed for ${category}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      dirtyKeys: this.dirtyKeys.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    try {
      this.isShuttingDown = true;

      // Stop sync timer
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }

      // Final sync
      await this.syncAllToDisk();

      console.log('💾 [DiskPersistence] Shutdown completed');
      return true;
    } catch (error) {
      console.error('❌ [DiskPersistence] Shutdown failed:', error);
      return false;
    }
  }

  // Private methods

  getFilePath(key, category) {
    const safeKey = this.sanitizeKey(key);
    return path.join(this.baseDir, category, `${safeKey}.json`);
  }

  sanitizeKey(key) {
    // Create a safe filename from the key
    const hash = createHash('md5').update(key).digest('hex');
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safeKey}_${hash.substring(0, 8)}`;
  }

  async readFromFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);

      // Check TTL
      if (parsed.ttl && Date.now() > parsed.timestamp + parsed.ttl) {
        await this.deleteFile(filePath);
        return null;
      }

      return parsed;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ [DiskPersistence] Read file failed:`, error);
      }
      return null;
    }
  }

  async writeToFile(filePath, data) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf8');
      return true;
    } catch (error) {
      console.error(`❌ [DiskPersistence] Write file failed:`, error);
      return false;
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ [DiskPersistence] Delete file failed:`, error);
      }
      return false;
    }
  }

  async loadFromDisk() {
    try {
      const categories = ['queues', 'cache', 'ratelimits'];
      let loadedCount = 0;

      for (const category of categories) {
        const categoryDir = path.join(this.baseDir, category);
        try {
          const files = await fs.readdir(categoryDir);

          for (const file of files) {
            if (file.endsWith('.json')) {
              const key = file.replace('.json', '');
              const data = await this.readFromFile(path.join(categoryDir, file));

              if (data) {
                const cacheKey = `${category}:${key}`;
                this.cache.set(cacheKey, data);
                loadedCount++;
              }
            }
          }
        } catch (error) {
          // Category directory doesn't exist, skip
        }
      }

      console.log(`💾 [DiskPersistence] Loaded ${loadedCount} items from disk`);
      return loadedCount;
    } catch (error) {
      console.error('❌ [DiskPersistence] Load from disk failed:', error);
      return 0;
    }
  }

  startSyncTimer() {
    this.syncTimer = setInterval(async () => {
      if (!this.isShuttingDown && this.dirtyKeys.size > 0) {
        await this.syncToDisk();
      }
    }, this.syncInterval);
  }

  async syncToDisk(key = null) {
    try {
      if (key) {
        // Sync specific key
        if (this.dirtyKeys.has(key)) {
          const data = this.cache.get(key);
          if (data) {
            const [category, originalKey] = key.split(':', 2);
            const filePath = this.getFilePath(originalKey, category);
            await this.writeToFile(filePath, data);
            this.dirtyKeys.delete(key);
            this.stats.syncs++;
          }
        }
      } else {
        // Sync all dirty keys
        const dirtyKeysArray = Array.from(this.dirtyKeys);
        for (const key of dirtyKeysArray) {
          await this.syncToDisk(key);
        }
      }
    } catch (error) {
      console.error('❌ [DiskPersistence] Sync to disk failed:', error);
      this.stats.errors++;
    }
  }

  async syncAllToDisk() {
    try {
      await this.syncToDisk();
      console.log('💾 [DiskPersistence] All data synced to disk');
    } catch (error) {
      console.error('❌ [DiskPersistence] Sync all failed:', error);
    }
  }
}

// Create singleton instance
const diskPersistence = new DiskPersistence({
  baseDir: path.join(process.cwd(), 'data', 'persistence'),
  syncInterval: 1000, // 1 second
  maxFileSize: 10 * 1024 * 1024 // 10MB
});

module.exports = diskPersistence;
