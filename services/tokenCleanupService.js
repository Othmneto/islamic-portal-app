// translator-backend/services/tokenCleanupService.js

const TokenBlacklist = require('../models/TokenBlacklist');

class TokenCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
  }

  start() {
    if (this.cleanupInterval) {
      console.log('⚠️ Token cleanup service is already running');
      return;
    }

    console.log('🧹 Starting token cleanup service...');

    // Run cleanup immediately
    this.runCleanup();

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.cleanupIntervalMs);

    console.log(`✅ Token cleanup service started (interval: ${this.cleanupIntervalMs / 1000}s)`);
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Token cleanup service stopped');
    }
  }

  async runCleanup() {
    try {
      console.log('🧹 Running token cleanup...');
      const deletedCount = await TokenBlacklist.cleanupExpired();

      if (deletedCount > 0) {
        console.log(`✅ Token cleanup completed: ${deletedCount} expired tokens removed`);
      } else {
        console.log('✅ Token cleanup completed: No expired tokens found');
      }
    } catch (error) {
      console.error('❌ Token cleanup error:', error);
    }
  }

  // Manual cleanup method for testing
  async manualCleanup() {
    console.log('🧹 Running manual token cleanup...');
    await this.runCleanup();
  }
}

module.exports = new TokenCleanupService();
