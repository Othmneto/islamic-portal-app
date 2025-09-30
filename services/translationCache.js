// services/translationCache.js - Simple in-memory cache system
const crypto = require('crypto');

// Logger setup
let logger = console;
try {
  const l = require('../config/logger');
  logger = l.logger || logger;
} catch { /* optional */ }

class TranslationCache {
    constructor() {
        // Simple in-memory cache using Map
        this.cache = new Map();
        this.maxSize = 10000; // Maximum cache entries
        this.defaultTTL = 30 * 60 * 1000; // 30 minutes default TTL
        
        // Performance monitoring
        this.stats = {
            hits: 0,
            misses: 0,
            totalRequests: 0,
            averageResponseTime: 0,
            cacheSize: 0
        };

        // Common Islamic phrases for instant translation
        this.islamicPhrases = new Map([
            // Arabic to English
            ['السلام عليكم', 'Peace be upon you'],
            ['وعليكم السلام', 'And peace be upon you too'],
            ['السلام عليكم ورحمة الله وبركاته', 'Peace be upon you and the mercy of Allah and His blessings'],
            ['بسم الله', 'In the name of Allah'],
            ['الحمد لله', 'Praise be to Allah'],
            ['سبحان الله', 'Glory be to Allah'],
            ['الله أكبر', 'Allah is the greatest'],
            ['لا إله إلا الله', 'There is no god but Allah'],
            ['محمد رسول الله', 'Muhammad is the messenger of Allah'],
            ['أستغفر الله', 'I seek forgiveness from Allah'],
            ['إن شاء الله', 'If Allah wills'],
            ['ما شاء الله', 'What Allah has willed'],
            ['بارك الله فيك', 'May Allah bless you'],
            ['جزاك الله خيراً', 'May Allah reward you with good'],
            ['في أمان الله', 'In Allah\'s protection'],
            ['الله يعطيك العافية', 'May Allah give you health'],
            ['الله يبارك لك', 'May Allah bless you'],
            ['الله يهديك', 'May Allah guide you'],
            ['الله يغفر لك', 'May Allah forgive you'],
            ['الله يرحمك', 'May Allah have mercy on you'],
            
            // English to Arabic
            ['Peace be upon you', 'السلام عليكم'],
            ['And peace be upon you too', 'وعليكم السلام'],
            ['In the name of Allah', 'بسم الله'],
            ['Praise be to Allah', 'الحمد لله'],
            ['Glory be to Allah', 'سبحان الله'],
            ['Allah is the greatest', 'الله أكبر'],
            ['There is no god but Allah', 'لا إله إلا الله'],
            ['Muhammad is the messenger of Allah', 'محمد رسول الله'],
            ['I seek forgiveness from Allah', 'أستغفر الله'],
            ['If Allah wills', 'إن شاء الله'],
            ['What Allah has willed', 'ما شاء الله'],
            ['May Allah bless you', 'بارك الله فيك'],
            ['May Allah reward you with good', 'جزاك الله خيراً'],
            ['In Allah\'s protection', 'في أمان الله'],
            ['May Allah give you health', 'الله يعطيك العافية'],
            ['May Allah bless you', 'الله يبارك لك'],
            ['May Allah guide you', 'الله يهديك'],
            ['May Allah forgive you', 'الله يغفر لك'],
            ['May Allah have mercy on you', 'الله يرحمك']
        ]);

        logger.info('Simple translation cache initialized');
    }

    // Get cached translation
    getCachedTranslation(text, fromLang, toLang) {
        const startTime = Date.now();
        this.stats.totalRequests++;
        
        // Check common phrases first
        const commonPhrase = this.getCommonPhrase(text, fromLang, toLang);
        if (commonPhrase) {
            this.stats.hits++;
            this.updateStats(startTime);
            return {
                translated: commonPhrase,
                confidence: 1.0,
                source: 'common_phrase',
                cached: true
            };
        }

        // Check cache
        const cacheKey = this.generateCacheKey(text, fromLang, toLang);
        const cached = this.cache.get(cacheKey);
        
        if (cached && this.isValidCacheEntry(cached)) {
            this.stats.hits++;
            this.updateStats(startTime);
            logger.debug(`Cache hit for translation: ${text.substring(0, 50)}...`);
            return {
                ...cached.data,
                cached: true
            };
        }

        // Remove expired entry
        if (cached) {
            this.cache.delete(cacheKey);
        }

        this.stats.misses++;
        this.updateStats(startTime);
        return null;
    }

    // Cache a translation
    cacheTranslation(text, fromLang, toLang, translation, confidence = 0.9, userId = null) {
        const cacheKey = this.generateCacheKey(text, fromLang, toLang);
        const cacheData = {
            translated: translation,
            confidence,
            timestamp: new Date().toISOString(),
            userId
        };

        // Check cache size and evict if necessary
        if (this.cache.size >= this.maxSize) {
            this.evictOldestEntry();
        }

        // Store in cache with TTL
        this.cache.set(cacheKey, {
            data: cacheData,
            expires: Date.now() + this.defaultTTL
        });

        logger.debug(`Cached translation: ${text.substring(0, 50)}... -> ${translation.substring(0, 50)}...`);
    }

    // Get common Islamic phrase translation
    getCommonPhrase(text, fromLang, toLang) {
        const normalizedText = text.trim().toLowerCase();
        
        // Direct lookup
        if (this.islamicPhrases.has(normalizedText)) {
            return this.islamicPhrases.get(normalizedText);
        }

        // Check for partial matches
        for (const [phrase, translation] of this.islamicPhrases) {
            if (normalizedText.includes(phrase) || phrase.includes(normalizedText)) {
                return translation;
            }
        }

        return null;
    }

    // Generate cache key
    generateCacheKey(text, fromLang, toLang) {
        const normalizedText = text.trim().toLowerCase();
        const keyData = `${normalizedText}:${fromLang}:${toLang}`;
        return crypto.createHash('sha256').update(keyData).digest('hex');
    }

    // Check if cache entry is valid (not expired)
    isValidCacheEntry(entry) {
        return entry && entry.expires > Date.now();
    }

    // Evict oldest entry when cache is full
    evictOldestEntry() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires < oldestTime) {
                oldestTime = entry.expires;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            logger.debug('Evicted oldest cache entry');
        }
    }

    // Clear cache for specific user
    clearUserCache(userId) {
        let cleared = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.data && entry.data.userId === userId) {
                this.cache.delete(key);
                cleared++;
            }
        }
        
        logger.info(`Cleared ${cleared} cached translations for user ${userId}`);
        return cleared;
    }

    // Update performance statistics
    updateStats(startTime) {
        const responseTime = Date.now() - startTime;
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime) / this.stats.totalRequests;
        this.stats.cacheSize = this.cache.size;
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.stats.totalRequests > 0 ? (this.stats.hits / this.stats.totalRequests) * 100 : 0,
            hits: this.stats.hits,
            misses: this.stats.misses,
            averageResponseTime: this.stats.averageResponseTime,
            islamicPhrasesCount: this.islamicPhrases.size
        };
    }

    // Set translation (for compatibility with partialTranslationService)
    setTranslation(text, fromLang, toLang, translation, confidence = 0.9, userId = null) {
        // Handle both string and object translation parameters
        let translatedText;
        if (typeof translation === 'string') {
            translatedText = translation;
        } else if (translation && typeof translation === 'object') {
            translatedText = translation.translatedText || translation.translated || translation;
        } else {
            translatedText = String(translation);
        }
        
        this.cacheTranslation(text, fromLang, toLang, translatedText, confidence, userId);
    }

    // Clear all caches
    clearAllCaches() {
        this.cache.clear();
        logger.info('All translation caches cleared');
    }

    // Clean expired entries
    cleanExpiredEntries() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires <= now) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} expired cache entries`);
        }
        
        return cleaned;
    }
}

// Singleton instance
const translationCache = new TranslationCache();

// Clean expired entries every 5 minutes
setInterval(() => {
    translationCache.cleanExpiredEntries();
}, 5 * 60 * 1000);

module.exports = {
    TranslationCache,
    getTranslationCache: () => translationCache,
    translationCache
};