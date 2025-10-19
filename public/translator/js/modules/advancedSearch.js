// Advanced Search Module - Translation history search and filtering
export class AdvancedSearch {
    constructor() {
        this.searchIndex = new Map();
        this.filters = {
            dateRange: null,
            languages: [],
            context: [],
            confidence: null,
            isIslamic: null,
            hasAlternatives: null
        };
        this.searchHistory = [];
        this.maxSearchHistory = 50;
    }

    /**
     * Index a translation for search
     * @param {Object} translation - Translation object
     */
    indexTranslation(translation) {
        const indexKey = this.generateIndexKey(translation);
        const searchableText = this.extractSearchableText(translation);

        this.searchIndex.set(indexKey, {
            id: translation.id,
            original: translation.original,
            translated: translation.translated,
            fromLang: translation.fromLang,
            toLang: translation.toLang,
            context: translation.context || 'general',
            confidence: translation.confidence || 0,
            isIslamic: translation.isIslamic || false,
            hasAlternatives: (translation.alternatives && translation.alternatives.length > 0) || false,
            timestamp: translation.timestamp || Date.now(),
            searchableText: searchableText,
            tags: this.extractTags(translation)
        });

        console.log('🔍 [AdvancedSearch] Indexed translation:', indexKey);
    }

    /**
     * Search translations with advanced filters
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Search results
     */
    search(query, options = {}) {
        const searchOptions = {
            caseSensitive: false,
            exactMatch: false,
            includeAlternatives: true,
            sortBy: 'relevance', // 'relevance', 'date', 'confidence'
            limit: 50,
            ...options
        };

        const results = [];
        const queryLower = searchOptions.caseSensitive ? query : query.toLowerCase();

        // Add to search history
        this.addToSearchHistory(query);

        for (const [key, entry] of this.searchIndex.entries()) {
            let score = 0;
            let matches = [];

            // Text matching
            if (searchOptions.exactMatch) {
                if (entry.original === query || entry.translated === query) {
                    score += 100;
                    matches.push('exact');
                }
            } else {
                // Original text matching
                if (entry.original.toLowerCase().includes(queryLower)) {
                    score += 80;
                    matches.push('original');
                }

                // Translated text matching
                if (entry.translated.toLowerCase().includes(queryLower)) {
                    score += 70;
                    matches.push('translated');
                }

                // Searchable text matching
                if (entry.searchableText.toLowerCase().includes(queryLower)) {
                    score += 60;
                    matches.push('searchable');
                }

                // Tag matching
                for (const tag of entry.tags) {
                    if (tag.toLowerCase().includes(queryLower)) {
                        score += 40;
                        matches.push('tag');
                    }
                }
            }

            // Apply filters
            if (this.passesFilters(entry, options.filters)) {
                // Boost score for recent translations
                const age = Date.now() - entry.timestamp;
                const ageBoost = Math.max(0, 20 - (age / (24 * 60 * 60 * 1000))); // Boost for last 20 days
                score += ageBoost;

                // Boost score for high confidence
                score += entry.confidence * 0.1;

                if (score > 0) {
                    results.push({
                        ...entry,
                        key: key,
                        score: score,
                        matches: matches,
                        relevance: this.calculateRelevance(query, entry)
                    });
                }
            }
        }

        // Sort results
        results.sort((a, b) => {
            switch (searchOptions.sortBy) {
                case 'date':
                    return b.timestamp - a.timestamp;
                case 'confidence':
                    return b.confidence - a.confidence;
                case 'relevance':
                default:
                    return b.score - a.score;
            }
        });

        // Limit results
        const limitedResults = results.slice(0, searchOptions.limit);

        console.log(`🔍 [AdvancedSearch] Found ${limitedResults.length} results for query: "${query}"`);
        return limitedResults;
    }

    /**
     * Check if entry passes filters
     * @param {Object} entry - Translation entry
     * @param {Object} filters - Filter options
     * @returns {boolean} Passes filters
     */
    passesFilters(entry, filters = {}) {
        // Date range filter
        if (filters.dateRange) {
            const entryDate = new Date(entry.timestamp);
            if (filters.dateRange.start && entryDate < filters.dateRange.start) return false;
            if (filters.dateRange.end && entryDate > filters.dateRange.end) return false;
        }

        // Language filter
        if (filters.languages && filters.languages.length > 0) {
            const langPair = `${entry.fromLang}-${entry.toLang}`;
            if (!filters.languages.includes(langPair)) return false;
        }

        // Context filter
        if (filters.context && filters.context.length > 0) {
            if (!filters.context.includes(entry.context)) return false;
        }

        // Confidence filter
        if (filters.confidence) {
            if (entry.confidence < filters.confidence.min) return false;
            if (entry.confidence > filters.confidence.max) return false;
        }

        // Islamic content filter
        if (filters.isIslamic !== null) {
            if (entry.isIslamic !== filters.isIslamic) return false;
        }

        // Alternatives filter
        if (filters.hasAlternatives !== null) {
            if (entry.hasAlternatives !== filters.hasAlternatives) return false;
        }

        return true;
    }

    /**
     * Calculate relevance score
     * @param {string} query - Search query
     * @param {Object} entry - Translation entry
     * @returns {number} Relevance score
     */
    calculateRelevance(query, entry) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const originalWords = entry.original.toLowerCase().split(/\s+/);
        const translatedWords = entry.translated.toLowerCase().split(/\s+/);

        let relevance = 0;

        // Word overlap with original
        for (const word of queryWords) {
            if (originalWords.includes(word)) {
                relevance += 1;
            }
        }

        // Word overlap with translated
        for (const word of queryWords) {
            if (translatedWords.includes(word)) {
                relevance += 0.8;
            }
        }

        // Phrase matching
        if (entry.original.toLowerCase().includes(query.toLowerCase())) {
            relevance += 2;
        }

        if (entry.translated.toLowerCase().includes(query.toLowerCase())) {
            relevance += 1.5;
        }

        return relevance;
    }

    /**
     * Generate index key for translation
     * @param {Object} translation - Translation object
     * @returns {string} Index key
     */
    generateIndexKey(translation) {
        return `${translation.id}-${translation.fromLang}-${translation.toLang}`;
    }

    /**
     * Extract searchable text from translation
     * @param {Object} translation - Translation object
     * @returns {string} Searchable text
     */
    extractSearchableText(translation) {
        let text = `${translation.original} ${translation.translated}`;

        // Add alternatives if available
        if (translation.alternatives && translation.alternatives.length > 0) {
            text += ' ' + translation.alternatives.map(alt => alt.text).join(' ');
        }

        // Add cultural context if available
        if (translation.culturalContext && translation.culturalContext.notes) {
            text += ' ' + translation.culturalContext.notes.join(' ');
        }

        return text;
    }

    /**
     * Extract tags from translation
     * @param {Object} translation - Translation object
     * @returns {Array} Tags
     */
    extractTags(translation) {
        const tags = [];

        // Language tags
        tags.push(translation.fromLang);
        tags.push(translation.toLang);
        tags.push(`${translation.fromLang}-${translation.toLang}`);

        // Context tags
        if (translation.context) {
            tags.push(translation.context);
        }

        // Islamic content tag
        if (translation.isIslamic) {
            tags.push('islamic');
        }

        // Confidence tags
        if (translation.confidence >= 0.8) {
            tags.push('high-confidence');
        } else if (translation.confidence >= 0.6) {
            tags.push('medium-confidence');
        } else {
            tags.push('low-confidence');
        }

        // Alternatives tag
        if (translation.alternatives && translation.alternatives.length > 0) {
            tags.push('has-alternatives');
        }

        return tags;
    }

    /**
     * Get search suggestions
     * @param {string} query - Partial query
     * @returns {Array} Suggestions
     */
    getSuggestions(query) {
        const suggestions = new Set();
        const queryLower = query.toLowerCase();

        for (const [key, entry] of this.searchIndex.entries()) {
            // Original text suggestions
            if (entry.original.toLowerCase().includes(queryLower)) {
                suggestions.add(entry.original);
            }

            // Translated text suggestions
            if (entry.translated.toLowerCase().includes(queryLower)) {
                suggestions.add(entry.translated);
            }

            // Tag suggestions
            for (const tag of entry.tags) {
                if (tag.toLowerCase().includes(queryLower)) {
                    suggestions.add(tag);
                }
            }
        }

        return Array.from(suggestions).slice(0, 10);
    }

    /**
     * Get search statistics
     * @returns {Object} Search statistics
     */
    getSearchStats() {
        const totalEntries = this.searchIndex.size;
        const languagePairs = new Set();
        const contexts = new Set();
        let totalConfidence = 0;
        let islamicCount = 0;
        let alternativesCount = 0;

        for (const entry of this.searchIndex.values()) {
            languagePairs.add(`${entry.fromLang}-${entry.toLang}`);
            contexts.add(entry.context);
            totalConfidence += entry.confidence;

            if (entry.isIslamic) islamicCount++;
            if (entry.hasAlternatives) alternativesCount++;
        }

        return {
            totalEntries,
            languagePairs: languagePairs.size,
            contexts: contexts.size,
            averageConfidence: totalConfidence / totalEntries,
            islamicPercentage: (islamicCount / totalEntries) * 100,
            alternativesPercentage: (alternativesCount / totalEntries) * 100,
            searchHistoryCount: this.searchHistory.length
        };
    }

    /**
     * Add query to search history
     * @param {string} query - Search query
     */
    addToSearchHistory(query) {
        if (query.trim().length === 0) return;

        // Remove if already exists
        this.searchHistory = this.searchHistory.filter(q => q !== query);

        // Add to beginning
        this.searchHistory.unshift(query);

        // Limit history size
        if (this.searchHistory.length > this.maxSearchHistory) {
            this.searchHistory = this.searchHistory.slice(0, this.maxSearchHistory);
        }

        // Save to localStorage
        this.saveSearchHistory();
    }

    /**
     * Get search history
     * @returns {Array} Search history
     */
    getSearchHistory() {
        return this.searchHistory;
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
        console.log('🔍 [AdvancedSearch] Search history cleared');
    }

    /**
     * Save search history to localStorage
     */
    saveSearchHistory() {
        try {
            localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
        } catch (error) {
            console.warn('Failed to save search history:', error);
        }
    }

    /**
     * Load search history from localStorage
     */
    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('searchHistory');
            if (saved) {
                this.searchHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load search history:', error);
        }
    }

    /**
     * Remove translation from index
     * @param {string} translationId - Translation ID
     */
    removeFromIndex(translationId) {
        for (const [key, entry] of this.searchIndex.entries()) {
            if (entry.id === translationId) {
                this.searchIndex.delete(key);
                console.log('🔍 [AdvancedSearch] Removed from index:', key);
                break;
            }
        }
    }

    /**
     * Clear all search data
     */
    clearAll() {
        this.searchIndex.clear();
        this.searchHistory = [];
        this.saveSearchHistory();
        console.log('🔍 [AdvancedSearch] All search data cleared');
    }
}
