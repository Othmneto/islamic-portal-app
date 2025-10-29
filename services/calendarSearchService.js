const { logger } = require('../config/logger');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const hotCache = require('./hotCacheService');

class CalendarSearchService {
  /**
   * Main search function
   * Searches across user events, prayer times, and holidays/occasions
   */
  async search(userId, query, options = {}) {
    try {
      const {
        includeUserEvents = true,
        includePrayerTimes = true,
        includeOccasions = true,
        year = new Date().getFullYear(),
        limit = 50,
        countryCode = null
      } = options;

      logger.info(`[CalendarSearch] Searching for "${query}" with options:`, options);

      // Check cache first
      const cacheKey = `search:${userId}:${query}:${year}`;
      const cached = hotCache.get(cacheKey);
      if (cached) {
        logger.debug(`[CalendarSearch] Cache HIT for ${cacheKey}`);
        return cached;
      }

      const results = {
        userEvents: [],
        prayerTimes: [],
        occasions: [],
        totalCount: 0
      };

      // Execute searches in parallel
      const searches = [];

      if (includeUserEvents) {
        searches.push(this.searchUserEvents(userId, query));
      }

      if (includePrayerTimes) {
        searches.push(this.searchPrayerTimes(userId, query, year));
      }

      if (includeOccasions) {
        searches.push(this.searchOccasions(query, year, countryCode));
      }

      const searchResults = await Promise.all(searches);

      // Assign results
      let idx = 0;
      if (includeUserEvents) results.userEvents = searchResults[idx++] || [];
      if (includePrayerTimes) results.prayerTimes = searchResults[idx++] || [];
      if (includeOccasions) results.occasions = searchResults[idx++] || [];

      // Calculate total
      results.totalCount = results.userEvents.length + 
                          results.prayerTimes.length + 
                          results.occasions.length;

      logger.info(`[CalendarSearch] Found ${results.totalCount} results`);

      // Rank and combine results
      const rankedResults = this.rankAndCombineResults(results, query, limit);

      // Cache for 1 hour
      hotCache.set(cacheKey, rankedResults, 3600);

      return rankedResults;

    } catch (error) {
      logger.error('[CalendarSearch] Search error:', error);
      throw error;
    }
  }

  /**
   * Search user events (calendar entries)
   */
  async searchUserEvents(userId, query) {
    try {
      const user = await User.findById(userId).lean();
      if (!user || !user.calendarEvents) {
        return [];
      }

      const queryLower = query.toLowerCase();

      return user.calendarEvents
        .filter(event => {
          return (
            event.title?.toLowerCase().includes(queryLower) ||
            event.description?.toLowerCase().includes(queryLower) ||
            event.location?.toLowerCase().includes(queryLower) ||
            event.tags?.some(tag => tag.toLowerCase().includes(queryLower))
          );
        })
        .map(event => ({
          ...event,
          type: 'event',
          relevance: this.calculateRelevance(query, event.title, event.description),
          resultType: 'user_event'
        }));

    } catch (error) {
      logger.error('[CalendarSearch] Error searching user events:', error);
      return [];
    }
  }

  /**
   * Search prayer times
   * Prayer times are dynamic, so we search prayer names
   */
  async searchPrayerTimes(userId, query, year) {
    try {
      const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'sunrise', 'sunset'];
      const queryLower = query.toLowerCase();

      const matchingPrayers = prayerNames.filter(prayer => 
        prayer.includes(queryLower) || 
        queryLower.includes(prayer) ||
        this.getPrayerTranslations(prayer).some(trans => trans.toLowerCase().includes(queryLower))
      );

      if (matchingPrayers.length === 0) {
        return [];
      }

      // Get user location for prayer time context
      const user = await User.findById(userId).select('location timezone').lean();
      const location = user?.location || { city: 'Unknown' };

      return matchingPrayers.map(prayer => ({
        name: this.capitalize(prayer),
        nameAr: this.getPrayerArabicName(prayer),
        type: 'prayer',
        description: `${this.capitalize(prayer)} prayer time`,
        location: location.city,
        year: year,
        relevance: query.toLowerCase() === prayer ? 100 : 50,
        resultType: 'prayer_time',
        tags: ['prayer', 'islamic']
      }));

    } catch (error) {
      logger.error('[CalendarSearch] Error searching prayer times:', error);
      return [];
    }
  }

  /**
   * Search holidays and occasions
   */
  async searchOccasions(query, year, countryCode = null) {
    try {
      const queryLower = query.toLowerCase();

      // Build search query
      const searchQuery = {
        year: year,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { nameLocal: { $regex: query, $options: 'i' } },
          { nameAr: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      };

      if (countryCode) {
        searchQuery.countryCode = countryCode;
      }

      const holidays = await Holiday.find(searchQuery)
        .limit(50)
        .lean();

      // Update request counts
      if (holidays.length > 0) {
        const holidayIds = holidays.map(h => h._id);
        await Holiday.updateMany(
          { _id: { $in: holidayIds } },
          { $inc: { requestCount: 1 } }
        );
      }

      return holidays.map(holiday => ({
        ...holiday,
        type: 'occasion',
        relevance: this.calculateRelevance(query, holiday.name, holiday.description),
        resultType: 'holiday'
      }));

    } catch (error) {
      logger.error('[CalendarSearch] Error searching occasions:', error);
      return [];
    }
  }

  /**
   * Rank and combine search results
   * Priority: exact match > starts with > contains
   * Boost: upcoming events > recent events > past events
   */
  rankAndCombineResults(results, query, limit) {
    const queryLower = query.toLowerCase();
    const now = new Date();

    // Combine all results
    let combined = [
      ...results.userEvents,
      ...results.prayerTimes,
      ...results.occasions
    ];

    // Calculate final relevance score
    combined = combined.map(item => {
      let score = item.relevance || 0;

      // Boost for exact match
      if (item.name?.toLowerCase() === queryLower || item.title?.toLowerCase() === queryLower) {
        score += 50;
      }

      // Boost for starts with
      if (item.name?.toLowerCase().startsWith(queryLower) || item.title?.toLowerCase().startsWith(queryLower)) {
        score += 25;
      }

      // Boost for upcoming events
      if (item.date || item.startDate) {
        const eventDate = new Date(item.date || item.startDate);
        const daysDiff = (eventDate - now) / (1000 * 60 * 60 * 24);

        if (daysDiff >= 0 && daysDiff <= 7) {
          score += 30; // This week
        } else if (daysDiff > 7 && daysDiff <= 30) {
          score += 20; // This month
        } else if (daysDiff > 30 && daysDiff <= 90) {
          score += 10; // Next 3 months
        } else if (daysDiff < 0 && daysDiff >= -7) {
          score += 15; // Last week
        }
      }

      // Boost for public holidays
      if (item.isPublicHoliday) {
        score += 10;
      }

      // Boost for Islamic events
      if (item.isIslamic || item.type === 'islamic') {
        score += 5;
      }

      return {
        ...item,
        finalScore: score
      };
    });

    // Sort by relevance score
    combined.sort((a, b) => b.finalScore - a.finalScore);

    // Limit results
    const limitedResults = combined.slice(0, limit);

    // Group by type for better presentation
    return {
      results: limitedResults,
      grouped: {
        userEvents: limitedResults.filter(r => r.resultType === 'user_event'),
        prayerTimes: limitedResults.filter(r => r.resultType === 'prayer_time'),
        holidays: limitedResults.filter(r => r.resultType === 'holiday')
      },
      totalCount: combined.length,
      returnedCount: limitedResults.length
    };
  }

  /**
   * Calculate relevance score for a search result
   */
  calculateRelevance(query, title, description) {
    const queryLower = query.toLowerCase();
    let score = 0;

    if (!title && !description) return 0;

    // Check title
    if (title) {
      const titleLower = title.toLowerCase();
      if (titleLower === queryLower) {
        score += 100; // Exact match
      } else if (titleLower.startsWith(queryLower)) {
        score += 75; // Starts with
      } else if (titleLower.includes(queryLower)) {
        score += 50; // Contains
      }
    }

    // Check description
    if (description) {
      const descLower = description.toLowerCase();
      if (descLower.includes(queryLower)) {
        score += 25;
      }
    }

    return score;
  }

  /**
   * Get prayer name translations
   */
  getPrayerTranslations(prayer) {
    const translations = {
      fajr: ['fajr', 'dawn', 'fair', 'morning'],
      dhuhr: ['dhuhr', 'noon', 'zuhr', 'midday'],
      asr: ['asr', 'afternoon', 'evening'],
      maghrib: ['maghrib', 'sunset', 'evening'],
      isha: ['isha', 'night', 'nightfall'],
      sunrise: ['sunrise', 'shuruq', 'sun'],
      sunset: ['sunset', 'maghrib']
    };
    return translations[prayer] || [prayer];
  }

  /**
   * Get Arabic name for prayer
   */
  getPrayerArabicName(prayer) {
    const arabicNames = {
      fajr: 'الفجر',
      dhuhr: 'الظهر',
      asr: 'العصر',
      maghrib: 'المغرب',
      isha: 'العشاء',
      sunrise: 'الشروق',
      sunset: 'الغروب'
    };
    return arabicNames[prayer] || '';
  }

  /**
   * Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = new CalendarSearchService();



