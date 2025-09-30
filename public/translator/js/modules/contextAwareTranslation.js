// Context-Aware Translation Module
export class ContextAwareTranslation {
    constructor() {
        this.conversationContext = [];
        this.maxContextLength = 5;
        this.contextWindow = 3; // Number of previous translations to consider
        this.islamicContext = new Map();
        this.userPreferences = new Map();
        
        // Initialize Islamic context patterns
        this.initializeIslamicContext();
    }

    /**
     * Initialize Islamic context patterns
     */
    initializeIslamicContext() {
        this.islamicContext.set('greeting', {
            patterns: ['السلام عليكم', 'أهلا وسهلا', 'مرحبا'],
            responses: ['وعليكم السلام', 'أهلا وسهلا', 'مرحبا'],
            context: 'greeting'
        });
        
        this.islamicContext.set('prayer', {
            patterns: ['الصلاة', 'الصلوات', 'صلاة', 'صلاة الفجر', 'صلاة الظهر', 'صلاة العصر', 'صلاة المغرب', 'صلاة العشاء'],
            responses: ['prayer', 'prayers', 'Fajr prayer', 'Dhuhr prayer', 'Asr prayer', 'Maghrib prayer', 'Isha prayer'],
            context: 'prayer'
        });
        
        this.islamicContext.set('quran', {
            patterns: ['القرآن', 'القرآن الكريم', 'كتاب الله', 'الوحي'],
            responses: ['Quran', 'Holy Quran', 'Book of Allah', 'revelation'],
            context: 'quran'
        });
        
        this.islamicContext.set('hadith', {
            patterns: ['الحديث', 'الأحاديث', 'السنة', 'السنن'],
            responses: ['hadith', 'hadiths', 'Sunnah', 'traditions'],
            context: 'hadith'
        });
        
        this.islamicContext.set('dua', {
            patterns: ['الدعاء', 'الأدعية', 'الذكر', 'الأذكار'],
            responses: ['supplication', 'prayers', 'remembrance', 'dhikr'],
            context: 'dua'
        });
    }

    /**
     * Add translation to conversation context
     * @param {Object} translation - Translation object
     */
    addToContext(translation) {
        const contextEntry = {
            id: translation.id || Date.now(),
            original: translation.original,
            translated: translation.translated,
            fromLang: translation.fromLang,
            toLang: translation.toLang,
            timestamp: Date.now(),
            context: this.detectContext(translation.original),
            confidence: translation.confidence || 0
        };

        this.conversationContext.push(contextEntry);
        
        // Limit context length
        if (this.conversationContext.length > this.maxContextLength) {
            this.conversationContext.shift();
        }
    }

    /**
     * Detect context from text
     * @param {string} text - Text to analyze
     * @returns {string} Detected context
     */
    detectContext(text) {
        const lowerText = text.toLowerCase();
        
        for (const [context, data] of this.islamicContext.entries()) {
            for (const pattern of data.patterns) {
                if (lowerText.includes(pattern.toLowerCase())) {
                    return context;
                }
            }
        }
        
        return 'general';
    }

    /**
     * Get relevant context for translation
     * @param {string} currentText - Current text being translated
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {Object} Context information
     */
    getRelevantContext(currentText, fromLang, toLang) {
        const currentContext = this.detectContext(currentText);
        const relevantTranslations = this.conversationContext
            .filter(t => t.context === currentContext)
            .slice(-this.contextWindow);
        
        const contextText = relevantTranslations
            .map(t => t.original)
            .join(' ');
        
        const contextTranslations = relevantTranslations
            .map(t => t.translated)
            .join(' ');
        
        return {
            context: currentContext,
            relevantText: contextText,
            relevantTranslations: contextTranslations,
            contextCount: relevantTranslations.length,
            suggestions: this.getContextualSuggestions(currentText, currentContext)
        };
    }

    /**
     * Get contextual suggestions based on detected context
     * @param {string} text - Current text
     * @param {string} context - Detected context
     * @returns {Array} Contextual suggestions
     */
    getContextualSuggestions(text, context) {
        const suggestions = [];
        
        if (this.islamicContext.has(context)) {
            const contextData = this.islamicContext.get(context);
            suggestions.push(...contextData.responses);
        }
        
        // Add common Islamic phrases based on context
        switch (context) {
            case 'greeting':
                suggestions.push('Peace be upon you', 'May peace be upon you', 'Greetings');
                break;
            case 'prayer':
                suggestions.push('prayer', 'worship', 'salah', 'namaz');
                break;
            case 'quran':
                suggestions.push('Quran', 'Holy Quran', 'Book of Allah', 'revelation');
                break;
            case 'hadith':
                suggestions.push('hadith', 'tradition', 'Sunnah', 'prophetic saying');
                break;
            case 'dua':
                suggestions.push('supplication', 'prayer', 'invocation', 'dhikr');
                break;
        }
        
        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }

    /**
     * Enhance translation with context
     * @param {string} text - Text to translate
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @param {string} translation - Base translation
     * @returns {Object} Enhanced translation
     */
    enhanceWithContext(text, fromLang, toLang, translation) {
        const context = this.getRelevantContext(text, fromLang, toLang);
        const enhancedTranslation = {
            ...translation,
            context: context.context,
            contextualSuggestions: context.suggestions,
            contextRelevance: this.calculateContextRelevance(text, context),
            enhancedText: this.applyContextualEnhancements(translation.translated, context)
        };
        
        return enhancedTranslation;
    }

    /**
     * Calculate context relevance score
     * @param {string} text - Current text
     * @param {Object} context - Context information
     * @returns {number} Relevance score (0-100)
     */
    calculateContextRelevance(text, context) {
        let score = 0;
        
        // Base score for having context
        if (context.contextCount > 0) {
            score += 30;
        }
        
        // Boost score for matching context
        if (context.context !== 'general') {
            score += 40;
        }
        
        // Boost score for similar text patterns
        const textWords = text.toLowerCase().split(/\s+/);
        const contextWords = context.relevantText.toLowerCase().split(/\s+/);
        const commonWords = textWords.filter(word => contextWords.includes(word));
        score += (commonWords.length / textWords.length) * 30;
        
        return Math.min(score, 100);
    }

    /**
     * Apply contextual enhancements to translation
     * @param {string} translation - Base translation
     * @param {Object} context - Context information
     * @returns {string} Enhanced translation
     */
    applyContextualEnhancements(translation, context) {
        let enhanced = translation;
        
        // Add context-specific enhancements
        if (context.context === 'greeting' && !enhanced.includes('peace')) {
            enhanced = `Peace be upon you - ${enhanced}`;
        }
        
        if (context.context === 'prayer' && !enhanced.toLowerCase().includes('prayer')) {
            enhanced = `Prayer: ${enhanced}`;
        }
        
        if (context.context === 'quran' && !enhanced.toLowerCase().includes('quran')) {
            enhanced = `Quran: ${enhanced}`;
        }
        
        return enhanced;
    }

    /**
     * Get conversation summary
     * @returns {Object} Conversation summary
     */
    getConversationSummary() {
        const contexts = [...new Set(this.conversationContext.map(t => t.context))];
        const languages = [...new Set(this.conversationContext.map(t => t.fromLang))];
        const totalTranslations = this.conversationContext.length;
        
        return {
            totalTranslations,
            contexts,
            languages,
            duration: this.conversationContext.length > 0 ? 
                Date.now() - this.conversationContext[0].timestamp : 0,
            mostCommonContext: this.getMostCommonContext(),
            contextDistribution: this.getContextDistribution()
        };
    }

    /**
     * Get most common context
     * @returns {string} Most common context
     */
    getMostCommonContext() {
        const contextCounts = {};
        this.conversationContext.forEach(t => {
            contextCounts[t.context] = (contextCounts[t.context] || 0) + 1;
        });
        
        return Object.keys(contextCounts).reduce((a, b) => 
            contextCounts[a] > contextCounts[b] ? a : b, 'general'
        );
    }

    /**
     * Get context distribution
     * @returns {Object} Context distribution
     */
    getContextDistribution() {
        const distribution = {};
        this.conversationContext.forEach(t => {
            distribution[t.context] = (distribution[t.context] || 0) + 1;
        });
        
        return distribution;
    }

    /**
     * Clear conversation context
     */
    clearContext() {
        this.conversationContext = [];
    }

    /**
     * Save context to localStorage
     */
    saveContext() {
        try {
            localStorage.setItem('conversationContext', JSON.stringify(this.conversationContext));
        } catch (error) {
            console.warn('Failed to save conversation context:', error);
        }
    }

    /**
     * Load context from localStorage
     */
    loadContext() {
        try {
            const saved = localStorage.getItem('conversationContext');
            if (saved) {
                this.conversationContext = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load conversation context:', error);
        }
    }

    /**
     * Get context statistics
     * @returns {Object} Context statistics
     */
    getStats() {
        return {
            contextLength: this.conversationContext.length,
            maxContextLength: this.maxContextLength,
            contexts: [...new Set(this.conversationContext.map(t => t.context))],
            languages: [...new Set(this.conversationContext.map(t => t.fromLang))],
            averageConfidence: this.conversationContext.length > 0 ? 
                this.conversationContext.reduce((sum, t) => sum + t.confidence, 0) / this.conversationContext.length : 0
        };
    }
}
