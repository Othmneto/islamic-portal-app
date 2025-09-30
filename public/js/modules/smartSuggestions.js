// Smart Suggestions System for Context-Aware Translation
class SmartSuggestions {
    constructor(conversationMemory) {
        this.memory = conversationMemory;
        this.suggestionCache = new Map();
        this.userPreferences = this.loadPreferences();
        this.suggestionTypes = {
            TRANSLATION: 'translation',
            CONTEXT: 'context',
            GRAMMAR: 'grammar',
            CULTURAL: 'cultural',
            ISLAMIC: 'islamic'
        };
    }

    // Generate smart suggestions for translation
    async generateSuggestions(text, fromLang, toLang, context = '') {
        const cacheKey = `${text}_${fromLang}_${toLang}`;
        
        if (this.suggestionCache.has(cacheKey)) {
            return this.suggestionCache.get(cacheKey);
        }

        const suggestions = {
            translations: await this.getTranslationSuggestions(text, fromLang, toLang),
            context: await this.getContextSuggestions(text, context),
            grammar: await this.getGrammarSuggestions(text, fromLang, toLang),
            cultural: await this.getCulturalSuggestions(text, fromLang, toLang),
            islamic: await this.getIslamicSuggestions(text, fromLang, toLang),
            alternatives: await this.getAlternativePhrasings(text, fromLang, toLang)
        };

        // Cache suggestions
        this.suggestionCache.set(cacheKey, suggestions);
        
        // Clean cache if too large
        if (this.suggestionCache.size > 100) {
            const firstKey = this.suggestionCache.keys().next().value;
            this.suggestionCache.delete(firstKey);
        }

        return suggestions;
    }

    // Translation suggestions based on memory
    async getTranslationSuggestions(text, fromLang, toLang) {
        const similarMemories = await this.memory.findSimilarConversations(text, 5);
        
        return similarMemories.map(memory => ({
            type: this.suggestionTypes.TRANSLATION,
            original: memory.memory.originalText,
            translated: memory.memory.translatedText,
            confidence: memory.similarity,
            reason: 'Similar translation found in memory',
            fromLanguage: memory.memory.fromLanguage,
            toLanguage: memory.memory.toLanguage,
            timestamp: memory.memory.timestamp
        }));
    }

    // Context-based suggestions
    async getContextSuggestions(text, context) {
        const suggestions = [];

        // Analyze context for better translations
        if (context.includes('prayer') || context.includes('salah')) {
            suggestions.push({
                type: this.suggestionTypes.CONTEXT,
                suggestion: 'Consider using Islamic terminology for prayer-related translations',
                confidence: 0.8,
                reason: 'Prayer context detected'
            });
        }

        if (context.includes('food') || context.includes('halal')) {
            suggestions.push({
                type: this.suggestionTypes.CONTEXT,
                suggestion: 'Ensure food-related terms are culturally appropriate',
                confidence: 0.7,
                reason: 'Food context detected'
            });
        }

        if (context.includes('greeting') || context.includes('salam')) {
            suggestions.push({
                type: this.suggestionTypes.CONTEXT,
                suggestion: 'Use appropriate Islamic greetings',
                confidence: 0.9,
                reason: 'Greeting context detected'
            });
        }

        return suggestions;
    }

    // Grammar suggestions
    async getGrammarSuggestions(text, fromLang, toLang) {
        const suggestions = [];

        // Basic grammar checks
        if (text.length > 0 && text[0] !== text[0].toUpperCase()) {
            suggestions.push({
                type: this.suggestionTypes.GRAMMAR,
                suggestion: 'Consider capitalizing the first letter',
                confidence: 0.6,
                reason: 'Sentence should start with capital letter'
            });
        }

        if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
            suggestions.push({
                type: this.suggestionTypes.GRAMMAR,
                suggestion: 'Consider adding proper punctuation',
                confidence: 0.5,
                reason: 'Sentence may need punctuation'
            });
        }

        // Language-specific grammar suggestions
        if (fromLang === 'Arabic' && toLang === 'English') {
            suggestions.push({
                type: this.suggestionTypes.GRAMMAR,
                suggestion: 'Arabic text reads right-to-left, ensure proper word order in English',
                confidence: 0.8,
                reason: 'Arabic to English translation'
            });
        }

        return suggestions;
    }

    // Cultural suggestions
    async getCulturalSuggestions(text, fromLang, toLang) {
        const suggestions = [];

        // Cultural sensitivity checks
        const culturalTerms = {
            'God': ['Allah', 'الله'],
            'prayer': ['Salah', 'صلاة'],
            'fasting': ['Sawm', 'صوم'],
            'charity': ['Zakat', 'زكاة'],
            'pilgrimage': ['Hajj', 'حج']
        };

        Object.entries(culturalTerms).forEach(([english, alternatives]) => {
            if (text.toLowerCase().includes(english.toLowerCase())) {
                suggestions.push({
                    type: this.suggestionTypes.CULTURAL,
                    suggestion: `Consider using "${alternatives[0]}" instead of "${english}" for Islamic context`,
                    confidence: 0.9,
                    reason: 'Cultural sensitivity for Islamic terms'
                });
            }
        });

        return suggestions;
    }

    // Islamic-specific suggestions
    async getIslamicSuggestions(text, fromLang, toLang) {
        const suggestions = [];

        const islamicTerms = {
            'Bismillah': 'In the name of Allah',
            'Alhamdulillah': 'Praise be to Allah',
            'InshaAllah': 'If Allah wills',
            'MashaAllah': 'What Allah has willed',
            'SubhanAllah': 'Glory be to Allah',
            'Astaghfirullah': 'I seek forgiveness from Allah',
            'Barakallahu': 'May Allah bless',
            'Jazakallahu': 'May Allah reward you'
        };

        Object.entries(islamicTerms).forEach(([arabic, english]) => {
            if (text.includes(arabic)) {
                suggestions.push({
                    type: this.suggestionTypes.ISLAMIC,
                    suggestion: `"${arabic}" translates to "${english}"`,
                    confidence: 1.0,
                    reason: 'Islamic term translation'
                });
            }
        });

        // Check for Islamic phrases
        if (text.includes('السلام عليكم')) {
            suggestions.push({
                type: this.suggestionTypes.ISLAMIC,
                suggestion: 'This is the Islamic greeting "Peace be upon you"',
                confidence: 1.0,
                reason: 'Islamic greeting detected'
            });
        }

        return suggestions;
    }

    // Alternative phrasings
    async getAlternativePhrasings(text, fromLang, toLang) {
        const alternatives = [];

        // Common alternative phrasings
        const phrasings = {
            'hello': ['hi', 'greetings', 'salam'],
            'thank you': ['thanks', 'shukran', 'jazakallahu'],
            'goodbye': ['farewell', 'ma\'a salama', 'fi amanillah'],
            'how are you': ['how do you do', 'kayf halak', 'kayf halik']
        };

        const textLower = text.toLowerCase();
        Object.entries(phrasings).forEach(([phrase, alts]) => {
            if (textLower.includes(phrase)) {
                alternatives.push({
                    type: 'alternative',
                    original: phrase,
                    alternatives: alts,
                    confidence: 0.8,
                    reason: 'Common alternative phrasings available'
                });
            }
        });

        return alternatives;
    }

    // Get real-time suggestions as user types
    async getRealtimeSuggestions(text, fromLang, toLang, cursorPosition = 0) {
        if (text.length < 3) return [];

        const currentWord = this.getCurrentWord(text, cursorPosition);
        const suggestions = [];

        // Word completion suggestions
        if (currentWord.length >= 2) {
            const completions = await this.getWordCompletions(currentWord, fromLang);
            suggestions.push(...completions);
        }

        // Context suggestions
        const contextSuggestions = await this.getContextSuggestions(text, '');
        suggestions.push(...contextSuggestions);

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }

    // Get current word at cursor position
    getCurrentWord(text, cursorPosition) {
        const beforeCursor = text.substring(0, cursorPosition);
        const words = beforeCursor.split(/\s+/);
        return words[words.length - 1] || '';
    }

    // Word completion suggestions
    async getWordCompletions(word, fromLang) {
        const completions = [];

        // Common word completions
        const commonWords = {
            'en': ['hello', 'world', 'thank', 'please', 'good', 'morning', 'evening'],
            'ar': ['مرحبا', 'شكرا', 'من فضلك', 'صباح', 'مساء', 'خير'],
            'fr': ['bonjour', 'merci', 's\'il vous plaît', 'bon', 'matin', 'soir']
        };

        const langCode = this.getLanguageCode(fromLang);
        if (commonWords[langCode]) {
            const matches = commonWords[langCode].filter(w => 
                w.toLowerCase().startsWith(word.toLowerCase())
            );
            
            matches.forEach(match => {
                completions.push({
                    type: 'completion',
                    word: match,
                    confidence: 0.7,
                    reason: 'Common word completion'
                });
            });
        }

        return completions;
    }

    // Get language code
    getLanguageCode(language) {
        const langMap = {
            'English': 'en',
            'Arabic': 'ar',
            'French': 'fr',
            'German': 'de',
            'Spanish': 'es',
            'Urdu': 'ur',
            'Hindi': 'hi',
            'Russian': 'ru',
            'Chinese': 'zh',
            'Japanese': 'ja'
        };
        return langMap[language] || 'en';
    }

    // Learn from user feedback
    learnFromFeedback(suggestionId, feedback) {
        // Store user feedback for improving suggestions
        const feedbackData = {
            suggestionId,
            feedback, // 'helpful', 'not_helpful', 'irrelevant'
            timestamp: new Date(),
            userAgent: navigator.userAgent
        };

        // Store in localStorage
        const feedbacks = JSON.parse(localStorage.getItem('suggestionFeedbacks') || '[]');
        feedbacks.push(feedbackData);
        
        if (feedbacks.length > 1000) {
            feedbacks.splice(0, feedbacks.length - 1000);
        }
        
        localStorage.setItem('suggestionFeedbacks', JSON.stringify(feedbacks));
        
        // Update user preferences based on feedback
        this.updatePreferences(suggestionId, feedback);
    }

    // Update user preferences
    updatePreferences(suggestionId, feedback) {
        if (!this.userPreferences.suggestionTypes) {
            this.userPreferences.suggestionTypes = {};
        }

        const suggestionType = this.getSuggestionType(suggestionId);
        if (!this.userPreferences.suggestionTypes[suggestionType]) {
            this.userPreferences.suggestionTypes[suggestionType] = { helpful: 0, not_helpful: 0 };
        }

        if (feedback === 'helpful') {
            this.userPreferences.suggestionTypes[suggestionType].helpful++;
        } else if (feedback === 'not_helpful') {
            this.userPreferences.suggestionTypes[suggestionType].not_helpful++;
        }

        this.savePreferences();
    }

    // Get suggestion type from ID
    getSuggestionType(suggestionId) {
        // Simple implementation - in production, store type with ID
        return 'translation';
    }

    // Load user preferences
    loadPreferences() {
        try {
            return JSON.parse(localStorage.getItem('suggestionPreferences') || '{}');
        } catch (error) {
            console.error('Failed to load preferences:', error);
            return {};
        }
    }

    // Save user preferences
    savePreferences() {
        try {
            localStorage.setItem('suggestionPreferences', JSON.stringify(this.userPreferences));
        } catch (error) {
            console.error('Failed to save preferences:', error);
        }
    }

    // Get suggestion statistics
    getSuggestionStats() {
        const feedbacks = JSON.parse(localStorage.getItem('suggestionFeedbacks') || '[]');
        const stats = {
            totalSuggestions: this.suggestionCache.size,
            totalFeedbacks: feedbacks.length,
            helpfulFeedbacks: feedbacks.filter(f => f.feedback === 'helpful').length,
            notHelpfulFeedbacks: feedbacks.filter(f => f.feedback === 'not_helpful').length,
            cacheHitRate: this.suggestionCache.size / (this.suggestionCache.size + 1)
        };

        return stats;
    }

    // Clear suggestions cache
    clearCache() {
        this.suggestionCache.clear();
        console.log('Suggestions cache cleared');
    }
}

// Export for use
export default SmartSuggestions;
