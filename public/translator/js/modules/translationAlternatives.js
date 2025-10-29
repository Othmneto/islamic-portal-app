// Translation Alternatives Module
export class TranslationAlternatives {
    constructor() {
        this.alternatives = new Map();
        this.userPreferences = new Map();
        this.islamicPhrases = new Map([
            // Common Islamic phrases with multiple translations
            ['السلام عليكم', [
                'Peace be upon you',
                'May peace be upon you',
                'Peace and blessings be upon you',
                'Greetings of peace'
            ]],
            ['بسم الله الرحمن الرحيم', [
                'In the name of Allah, the Most Gracious, the Most Merciful',
                'In the name of God, the Most Gracious, the Most Merciful',
                'Bismillah ar-Rahman ar-Raheem',
                'In the name of Allah, the Beneficent, the Merciful'
            ]],
            ['الحمد لله', [
                'Praise be to Allah',
                'All praise is due to Allah',
                'Thanks be to Allah',
                'Alhamdulillah'
            ]],
            ['سبحان الله', [
                'Glory be to Allah',
                'Subhan Allah',
                'Exalted is Allah',
                'Praise be to Allah'
            ]],
            ['أستغفر الله', [
                'I seek forgiveness from Allah',
                'Astaghfirullah',
                'I ask Allah for forgiveness',
                'May Allah forgive me'
            ]],
            ['إن شاء الله', [
                'If Allah wills',
                'Inshallah',
                'God willing',
                'If it is Allah\'s will'
            ]],
            ['ما شاء الله', [
                'What Allah has willed',
                'Mashallah',
                'As Allah has willed',
                'What God has willed'
            ]],
            ['الله أكبر', [
                'Allah is the Greatest',
                'Allahu Akbar',
                'God is Great',
                'Allah is Greater'
            ]],
            ['لا إله إلا الله', [
                'There is no god but Allah',
                'La ilaha illa Allah',
                'There is no deity except Allah',
                'No god but Allah'
            ]],
            ['محمد رسول الله', [
                'Muhammad is the Messenger of Allah',
                'Muhammad Rasul Allah',
                'Muhammad is Allah\'s Prophet',
                'Muhammad is the Prophet of God'
            ]]
        ]);
    }

    /**
     * Get alternative translations for a text
     * @param {string} text - Original text
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {Array} Alternative translations
     */
    async getAlternatives(text, fromLang, toLang) {
        const cacheKey = `${text}-${fromLang}-${toLang}`;

        // Check cache first
        if (this.alternatives.has(cacheKey)) {
            return this.alternatives.get(cacheKey);
        }

        const alternatives = [];

        // Check if it's a known Islamic phrase
        if (this.islamicPhrases.has(text)) {
            alternatives.push(...this.islamicPhrases.get(text).map(alt => ({
                text: alt,
                confidence: 95,
                source: 'islamic-phrase',
                style: 'traditional'
            })));
        }

        // Generate alternatives using different approaches
        try {
            const apiAlternatives = await this.generateApiAlternatives(text, fromLang, toLang);
            alternatives.push(...apiAlternatives);
        } catch (error) {
            console.warn('Failed to generate API alternatives:', error);
        }

        // Sort by confidence and user preferences
        const sortedAlternatives = this.sortAlternatives(alternatives, text);

        // Cache the results
        this.alternatives.set(cacheKey, sortedAlternatives);

        return sortedAlternatives;
    }

    /**
     * Generate alternatives using API
     * @param {string} text - Text to translate
     * @param {string} fromLang - Source language
     * @param {string} toLang - Target language
     * @returns {Array} API-generated alternatives
     */
    async generateApiAlternatives(text, fromLang, toLang) {
        const alternatives = [];

        try {
            // Generate with different styles/contexts
            const styles = [
                { style: 'formal', context: 'religious text' },
                { style: 'casual', context: 'everyday conversation' },
                { style: 'academic', context: 'scholarly work' },
                { style: 'poetic', context: 'poetry and literature' }
            ];

            for (const styleConfig of styles) {
                const response = await fetch('/api/text-translation/translate', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        fromLang: fromLang,
                        toLang: toLang,
                        style: styleConfig.style,
                        context: styleConfig.context,
                        sessionId: this.generateSessionId()
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.results && result.results.length > 0) {
                        alternatives.push({
                            text: result.results[0].translatedText,
                            confidence: result.results[0].confidence || 80,
                            source: 'api',
                            style: styleConfig.style,
                            context: styleConfig.context
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error generating API alternatives:', error);
        }

        return alternatives;
    }

    /**
     * Sort alternatives by confidence and user preferences
     * @param {Array} alternatives - Array of alternatives
     * @param {string} originalText - Original text
     * @returns {Array} Sorted alternatives
     */
    sortAlternatives(alternatives, originalText) {
        return alternatives
            .filter(alt => alt.text && alt.text.trim().length > 0)
            .sort((a, b) => {
                // First by user preference score
                const aPreference = this.getUserPreferenceScore(a, originalText);
                const bPreference = this.getUserPreferenceScore(b, originalText);

                if (aPreference !== bPreference) {
                    return bPreference - aPreference;
                }

                // Then by confidence
                return (b.confidence || 0) - (a.confidence || 0);
            })
            .slice(0, 5); // Limit to top 5 alternatives
    }

    /**
     * Get user preference score for an alternative
     * @param {Object} alternative - Alternative translation
     * @param {string} originalText - Original text
     * @returns {number} Preference score
     */
    getUserPreferenceScore(alternative, originalText) {
        let score = 0;

        // Boost score for Islamic phrases
        if (alternative.source === 'islamic-phrase') {
            score += 20;
        }

        // Boost score for preferred styles
        const preferredStyles = this.userPreferences.get('preferredStyles') || ['traditional', 'formal'];
        if (preferredStyles.includes(alternative.style)) {
            score += 10;
        }

        // Boost score for previously selected alternatives
        const selectedAlternatives = this.userPreferences.get('selectedAlternatives') || new Set();
        if (selectedAlternatives.has(alternative.text)) {
            score += 15;
        }

        return score;
    }

    /**
     * Record user preference for an alternative
     * @param {string} originalText - Original text
     * @param {string} selectedAlternative - Selected alternative
     * @param {string} style - Style of the alternative
     */
    recordUserPreference(originalText, selectedAlternative, style) {
        // Record selected alternative
        const selectedAlternatives = this.userPreferences.get('selectedAlternatives') || new Set();
        selectedAlternatives.add(selectedAlternative);
        this.userPreferences.set('selectedAlternatives', selectedAlternatives);

        // Record preferred style
        const preferredStyles = this.userPreferences.get('preferredStyles') || new Set();
        preferredStyles.add(style);
        this.userPreferences.set('preferredStyles', preferredStyles);

        // Save to localStorage
        this.savePreferences();
    }

    /**
     * Get cultural context for a translation
     * @param {string} text - Original text
     * @param {string} translation - Translation
     * @returns {Object} Cultural context
     */
    getCulturalContext(text, translation) {
        const context = {
            notes: [],
            explanations: [],
            usage: [],
            related: []
        };

        // Add Islamic context notes
        if (this.islamicPhrases.has(text)) {
            context.notes.push('This is a common Islamic greeting/phrase');
            context.explanations.push('Used in daily conversation among Muslims');
            context.usage.push('Can be used as a greeting or farewell');
        }

        // Add language-specific context
        if (text.includes('الله')) {
            context.notes.push('Contains the name of Allah');
            context.explanations.push('Should be treated with respect and reverence');
        }

        if (text.includes('محمد')) {
            context.notes.push('Mentions the Prophet Muhammad (PBUH)');
            context.explanations.push('Should be followed by "peace be upon him" in English');
        }

        return context;
    }

    /**
     * Save user preferences to localStorage
     */
    savePreferences() {
        const preferences = {
            selectedAlternatives: Array.from(this.userPreferences.get('selectedAlternatives') || []),
            preferredStyles: Array.from(this.userPreferences.get('preferredStyles') || [])
        };
        localStorage.setItem('translationPreferences', JSON.stringify(preferences));
    }

    /**
     * Load user preferences from localStorage
     */
    loadPreferences() {
        try {
            const saved = localStorage.getItem('translationPreferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                this.userPreferences.set('selectedAlternatives', new Set(preferences.selectedAlternatives || []));
                this.userPreferences.set('preferredStyles', new Set(preferences.preferredStyles || []));
            }
        } catch (error) {
            console.warn('Failed to load translation preferences:', error);
        }
    }

    /**
     * Clear all alternatives cache
     */
    clearCache() {
        this.alternatives.clear();
    }

    /**
     * Generate session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return 'alt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get statistics about alternatives
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            cacheSize: this.alternatives.size,
            islamicPhrases: this.islamicPhrases.size,
            userPreferences: {
                selectedAlternatives: (this.userPreferences.get('selectedAlternatives') || new Set()).size,
                preferredStyles: (this.userPreferences.get('preferredStyles') || new Set()).size
            }
        };
    }
}
