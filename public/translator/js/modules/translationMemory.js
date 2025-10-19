// Translation Memory Module - Learn from user preferences and improve over time
export class TranslationMemory {
    constructor() {
        this.memory = new Map();
        this.userPreferences = new Map();
        this.learningData = new Map();
        this.performanceMetrics = {
            totalTranslations: 0,
            userCorrections: 0,
            accuracyScore: 0,
            improvementRate: 0
        };

        // Load existing memory from localStorage
        this.loadMemory();
    }

    /**
     * Add a translation to memory
     * @param {Object} translation - Translation object
     * @param {string} userFeedback - User feedback ('good', 'bad', 'alternative')
     */
    addToMemory(translation, userFeedback = 'good') {
        const key = this.generateMemoryKey(translation.original, translation.fromLang, translation.toLang);

        const memoryEntry = {
            id: translation.id,
            original: translation.original,
            translated: translation.translated,
            fromLang: translation.fromLang,
            toLang: translation.toLang,
            confidence: translation.confidence || 0,
            timestamp: Date.now(),
            userFeedback: userFeedback,
            usageCount: 1,
            lastUsed: Date.now(),
            alternatives: translation.alternatives || [],
            context: translation.context || 'general',
            isIslamic: translation.isIslamic || false
        };

        // If entry exists, update it
        if (this.memory.has(key)) {
            const existing = this.memory.get(key);
            existing.usageCount++;
            existing.lastUsed = Date.now();
            existing.userFeedback = userFeedback;
            existing.confidence = Math.max(existing.confidence, translation.confidence || 0);

            // Update alternatives if provided
            if (translation.alternatives && translation.alternatives.length > 0) {
                existing.alternatives = this.mergeAlternatives(existing.alternatives, translation.alternatives);
            }
        } else {
            this.memory.set(key, memoryEntry);
        }

        // Update learning data
        this.updateLearningData(translation, userFeedback);

        // Save to localStorage
        this.saveMemory();

        console.log('🧠 [TranslationMemory] Added to memory:', key, userFeedback);
    }

    /**
     * Get translation from memory
     * @param {string} original - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {Object|null} Memory entry or null
     */
    getFromMemory(original, fromLang, toLang) {
        const key = this.generateMemoryKey(original, fromLang, toLang);
        const entry = this.memory.get(key);

        if (entry) {
            // Update usage statistics
            entry.usageCount++;
            entry.lastUsed = Date.now();
            this.saveMemory();

            console.log('🧠 [TranslationMemory] Retrieved from memory:', key);
            return entry;
        }

        return null;
    }

    /**
     * Find similar translations in memory
     * @param {string} original - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {Array} Similar translations
     */
    findSimilarTranslations(original, fromLang, toLang) {
        const similar = [];
        const originalWords = original.toLowerCase().split(/\s+/);

        for (const [key, entry] of this.memory.entries()) {
            if (entry.fromLang === fromLang && entry.toLang === toLang) {
                const entryWords = entry.original.toLowerCase().split(/\s+/);
                const similarity = this.calculateSimilarity(originalWords, entryWords);

                if (similarity > 0.3) { // 30% similarity threshold
                    similar.push({
                        ...entry,
                        similarity: similarity,
                        key: key
                    });
                }
            }
        }

        // Sort by similarity and usage count
        return similar.sort((a, b) => {
            const scoreA = a.similarity * 0.7 + (a.usageCount / 100) * 0.3;
            const scoreB = b.similarity * 0.7 + (b.usageCount / 100) * 0.3;
            return scoreB - scoreA;
        }).slice(0, 5); // Top 5 similar translations
    }

    /**
     * Calculate similarity between two word arrays
     * @param {Array} words1 - First word array
     * @param {Array} words2 - Second word array
     * @returns {number} Similarity score (0-1)
     */
    calculateSimilarity(words1, words2) {
        const set1 = new Set(words1);
        const set2 = new Set(words2);

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Generate memory key for translation
     * @param {string} original - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {string} Memory key
     */
    generateMemoryKey(original, fromLang, toLang) {
        const normalized = original.toLowerCase().trim();
        return `${fromLang}-${toLang}-${normalized}`;
    }

    /**
     * Merge alternatives from different sources
     * @param {Array} existing - Existing alternatives
     * @param {Array} newAlternatives - New alternatives
     * @returns {Array} Merged alternatives
     */
    mergeAlternatives(existing, newAlternatives) {
        const merged = [...existing];

        for (const alt of newAlternatives) {
            const exists = merged.find(e => e.text === alt.text);
            if (!exists) {
                merged.push(alt);
            } else {
                // Update confidence if higher
                exists.confidence = Math.max(exists.confidence, alt.confidence || 0);
            }
        }

        // Sort by confidence and remove duplicates
        return merged
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, 10); // Keep top 10 alternatives
    }

    /**
     * Update learning data based on user feedback
     * @param {Object} translation - Translation object
     * @param {string} feedback - User feedback
     */
    updateLearningData(translation, feedback) {
        this.performanceMetrics.totalTranslations++;

        if (feedback === 'bad' || feedback === 'alternative') {
            this.performanceMetrics.userCorrections++;
        }

        // Update accuracy score
        this.performanceMetrics.accuracyScore =
            ((this.performanceMetrics.totalTranslations - this.performanceMetrics.userCorrections) /
             this.performanceMetrics.totalTranslations) * 100;

        // Track learning patterns
        const patternKey = `${translation.fromLang}-${translation.toLang}`;
        if (!this.learningData.has(patternKey)) {
            this.learningData.set(patternKey, {
                totalTranslations: 0,
                corrections: 0,
                commonPatterns: new Map(),
                preferredStyles: new Map()
            });
        }

        const pattern = this.learningData.get(patternKey);
        pattern.totalTranslations++;

        if (feedback === 'bad' || feedback === 'alternative') {
            pattern.corrections++;
        }

        // Learn from context
        if (translation.context) {
            const contextKey = `${patternKey}-${translation.context}`;
            pattern.commonPatterns.set(contextKey, (pattern.commonPatterns.get(contextKey) || 0) + 1);
        }

        // Learn from style preferences
        if (translation.alternatives && translation.alternatives.length > 0) {
            for (const alt of translation.alternatives) {
                if (alt.style) {
                    pattern.preferredStyles.set(alt.style, (pattern.preferredStyles.get(alt.style) || 0) + 1);
                }
            }
        }
    }

    /**
     * Get user preferences for a language pair
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {Object} User preferences
     */
    getUserPreferences(fromLang, toLang) {
        const key = `${fromLang}-${toLang}`;
        const pattern = this.learningData.get(key);

        if (!pattern) {
            return {
                preferredStyle: 'formal',
                commonContexts: [],
                accuracyScore: 0
            };
        }

        // Find most preferred style
        let preferredStyle = 'formal';
        let maxStyleCount = 0;
        for (const [style, count] of pattern.preferredStyles.entries()) {
            if (count > maxStyleCount) {
                maxStyleCount = count;
                preferredStyle = style;
            }
        }

        // Find most common contexts
        const commonContexts = Array.from(pattern.commonPatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([context, count]) => context.split('-').pop());

        return {
            preferredStyle: preferredStyle,
            commonContexts: commonContexts,
            accuracyScore: ((pattern.totalTranslations - pattern.corrections) / pattern.totalTranslations) * 100
        };
    }

    /**
     * Get memory statistics
     * @returns {Object} Memory statistics
     */
    getMemoryStats() {
        return {
            totalEntries: this.memory.size,
            totalTranslations: this.performanceMetrics.totalTranslations,
            userCorrections: this.performanceMetrics.userCorrections,
            accuracyScore: this.performanceMetrics.accuracyScore,
            improvementRate: this.performanceMetrics.improvementRate,
            languagePairs: this.learningData.size,
            memorySize: JSON.stringify(Array.from(this.memory.entries())).length
        };
    }

    /**
     * Clear old memory entries
     * @param {number} maxAge - Maximum age in milliseconds (default: 30 days)
     */
    clearOldMemory(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAge;
        let removed = 0;

        for (const [key, entry] of this.memory.entries()) {
            if (entry.lastUsed < cutoff && entry.usageCount < 3) {
                this.memory.delete(key);
                removed++;
            }
        }

        console.log(`🧠 [TranslationMemory] Cleared ${removed} old memory entries`);
        this.saveMemory();
    }

    /**
     * Export memory data
     * @returns {Object} Exported memory data
     */
    exportMemory() {
        // Convert learningData with nested Maps to serializable format
        const serializableLearningData = {};
        for (const [key, value] of this.learningData.entries()) {
            serializableLearningData[key] = {
                ...value,
                commonPatterns: Array.from(value.commonPatterns.entries()),
                preferredStyles: Array.from(value.preferredStyles.entries())
            };
        }

        return {
            memory: Array.from(this.memory.entries()),
            learningData: serializableLearningData,
            performanceMetrics: this.performanceMetrics,
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Import memory data
     * @param {Object} data - Memory data to import
     */
    importMemory(data) {
        if (data.memory) {
            this.memory = new Map(data.memory);
        }
        if (data.learningData) {
            this.learningData = new Map();
            for (const [key, value] of Object.entries(data.learningData)) {
                this.learningData.set(key, {
                    ...value,
                    commonPatterns: new Map(value.commonPatterns || []),
                    preferredStyles: new Map(value.preferredStyles || [])
                });
            }
        }
        if (data.performanceMetrics) {
            this.performanceMetrics = { ...this.performanceMetrics, ...data.performanceMetrics };
        }

        this.saveMemory();
        console.log('🧠 [TranslationMemory] Memory data imported successfully');
    }

    /**
     * Save memory to localStorage
     */
    saveMemory() {
        try {
            // Convert learningData with nested Maps to serializable format
            const serializableLearningData = {};
            for (const [key, value] of this.learningData.entries()) {
                serializableLearningData[key] = {
                    ...value,
                    commonPatterns: Array.from(value.commonPatterns.entries()),
                    preferredStyles: Array.from(value.preferredStyles.entries())
                };
            }

            const memoryData = {
                memory: Array.from(this.memory.entries()),
                learningData: serializableLearningData,
                performanceMetrics: this.performanceMetrics,
                lastSaved: Date.now()
            };

            localStorage.setItem('translationMemory', JSON.stringify(memoryData));
        } catch (error) {
            console.warn('Failed to save translation memory:', error);
        }
    }

    /**
     * Load memory from localStorage
     */
    loadMemory() {
        try {
            const saved = localStorage.getItem('translationMemory');
            if (saved) {
                const data = JSON.parse(saved);

                if (data.memory) {
                    this.memory = new Map(data.memory);
                }
                if (data.learningData) {
                    this.learningData = new Map();
                    for (const [key, value] of Object.entries(data.learningData)) {
                        this.learningData.set(key, {
                            ...value,
                            commonPatterns: new Map(value.commonPatterns || []),
                            preferredStyles: new Map(value.preferredStyles || [])
                        });
                    }
                }
                if (data.performanceMetrics) {
                    this.performanceMetrics = { ...this.performanceMetrics, ...data.performanceMetrics };
                }

                console.log('🧠 [TranslationMemory] Memory loaded successfully');
            }
        } catch (error) {
            console.warn('Failed to load translation memory:', error);
        }
    }

    /**
     * Clear all memory
     */
    clearMemory() {
        this.memory.clear();
        this.learningData.clear();
        this.performanceMetrics = {
            totalTranslations: 0,
            userCorrections: 0,
            accuracyScore: 0,
            improvementRate: 0
        };

        this.saveMemory();
        console.log('🧠 [TranslationMemory] All memory cleared');
    }
}
