/**
 * Offline Prayer Times Service
 * Pre-calculates and caches prayer times for 30 days
 * Enables offline functionality
 */

const adhan = require('adhan');

class OfflinePrayerTimesService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Calculate prayer times for multiple days
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} days - Number of days to calculate (default: 30)
   * @param {string} method - Calculation method
   * @param {string} madhab - Madhab for Asr calculation
   * @returns {Array} Array of prayer times for each day
   */
  calculateMultipleDays(lat, lon, days = 30, method = 'UmmAlQura', madhab = 'Shafi') {
    const results = [];
    const coords = new adhan.Coordinates(lat, lon);

    // Get calculation parameters
    let params;
    try {
      params = adhan.CalculationMethod[method]();
    } catch {
      params = adhan.CalculationMethod.UmmAlQura();
    }

    // Set madhab
    params.madhab = madhab === 'Hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

    // Calculate for each day
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start from midnight

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      try {
        const prayerTimes = new adhan.PrayerTimes(coords, date, params);

        results.push({
          date: date.toISOString().split('T')[0], // YYYY-MM-DD
          gregorian: date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          hijri: new Intl.DateTimeFormat('en-u-ca-islamic', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(date),
          times: {
            fajr: prayerTimes.fajr.toISOString(),
            sunrise: prayerTimes.sunrise.toISOString(),
            dhuhr: prayerTimes.dhuhr.toISOString(),
            asr: prayerTimes.asr.toISOString(),
            maghrib: prayerTimes.maghrib.toISOString(),
            isha: prayerTimes.isha.toISOString()
          },
          metadata: {
            calculationMethod: method,
            madhab: madhab,
            coordinates: { lat, lon }
          }
        });
      } catch (error) {
        console.error(`[OfflineService] Error calculating for day ${i}:`, error);
      }
    }

    return results;
  }

  /**
   * Generate cache key for a location
   */
  getCacheKey(lat, lon, method, madhab) {
    return `${lat.toFixed(4)}_${lon.toFixed(4)}_${method}_${madhab}`;
  }

  /**
   * Cache prayer times for offline use
   */
  cachePrayerTimes(lat, lon, method, madhab, days = 30) {
    const key = this.getCacheKey(lat, lon, method, madhab);
    const prayerTimes = this.calculateMultipleDays(lat, lon, days, method, madhab);

    this.cache.set(key, {
      prayerTimes,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log(`[OfflineService] Cached ${days} days of prayer times for ${lat}, ${lon}`);
    return prayerTimes;
  }

  /**
   * Get cached prayer times
   */
  getCachedPrayerTimes(lat, lon, method, madhab) {
    const key = this.getCacheKey(lat, lon, method, madhab);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (new Date(cached.expiresAt) < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return cached.prayerTimes;
  }

  /**
   * Get prayer times for a specific date
   */
  getPrayerTimesForDate(lat, lon, date, method, madhab) {
    const cached = this.getCachedPrayerTimes(lat, lon, method, madhab);

    if (!cached) {
      // Not cached, calculate for this day only
      return this.calculateMultipleDays(lat, lon, 1, method, madhab)[0];
    }

    // Find the date in cached data
    const dateStr = date.toISOString().split('T')[0];
    const found = cached.find(day => day.date === dateStr);

    if (found) {
      return found;
    }

    // Date not in cache, calculate it
    return this.calculateMultipleDays(lat, lon, 1, method, madhab)[0];
  }

  /**
   * Pre-cache prayer times for a user's location
   * This should be called when user sets their location
   */
  async preCacheUserLocation(lat, lon, method = 'UmmAlQura', madhab = 'Shafi') {
    try {
      console.log(`[OfflineService] Pre-caching 30 days for ${lat}, ${lon}`);
      const prayerTimes = this.cachePrayerTimes(lat, lon, method, madhab, 30);
      return {
        success: true,
        days: prayerTimes.length,
        cachedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[OfflineService] Pre-cache failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      totalLocations: this.cache.size,
      locations: []
    };

    for (const [key, value] of this.cache.entries()) {
      stats.locations.push({
        key,
        days: value.prayerTimes.length,
        cachedAt: value.cachedAt,
        expiresAt: value.expiresAt
      });
    }

    return stats;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = new Date();
    let cleared = 0;

    for (const [key, value] of this.cache.entries()) {
      if (new Date(value.expiresAt) < now) {
        this.cache.delete(key);
        cleared++;
      }
    }

    console.log(`[OfflineService] Cleared ${cleared} expired cache entries`);
    return cleared;
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[OfflineService] Cleared all cache (${size} entries)`);
    return size;
  }
}

// Export singleton instance
module.exports = new OfflinePrayerTimesService();


