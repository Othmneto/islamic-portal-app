const crypto = require('crypto');

/**
 * Context-Aware Translation Service for Islamic Content
 * Provides enhanced translation understanding with Islamic context
 */
class ContextAwareTranslationService {
    constructor() {
        this.islamicContexts = {
            // Prayer contexts
            prayer: {
                keywords: ['prayer', 'salah', 'namaz', 'dua', 'supplication', 'worship', 'ibadah'],
                context: 'religious_prayer',
                tone: 'reverent',
                priority: 'high'
            },
            // Quranic contexts
            quranic: {
                keywords: ['quran', 'quranic', 'ayat', 'verse', 'surah', 'revelation', 'allah', 'god'],
                context: 'quranic_text',
                tone: 'sacred',
                priority: 'highest'
            },
            // Hadith contexts
            hadith: {
                keywords: ['hadith', 'sunnah', 'prophet', 'muhammad', 'messenger', 'tradition'],
                context: 'hadith_text',
                tone: 'reverent',
                priority: 'high'
            },
            // Islamic law contexts
            fiqh: {
                keywords: ['fiqh', 'jurisprudence', 'law', 'halal', 'haram', 'permissible', 'forbidden'],
                context: 'islamic_law',
                tone: 'formal',
                priority: 'high'
            },
            // General Islamic contexts
            general: {
                keywords: ['islam', 'muslim', 'islamic', 'deen', 'faith', 'belief', 'ummah'],
                context: 'general_islamic',
                tone: 'respectful',
                priority: 'medium'
            }
        };

        this.contextualTranslations = {
            // Specialized translations for different contexts
            'religious_prayer': {
                'peace': 'salam',
                'blessing': 'barakah',
                'mercy': 'rahman',
                'forgiveness': 'maghfirah'
            },
            'quranic_text': {
                'god': 'Allah',
                'lord': 'Rabb',
                'creator': 'Khaliq',
                'sustainer': 'Razzaq'
            },
            'hadith_text': {
                'messenger': 'Rasul',
                'prophet': 'Nabi',
                'companion': 'Sahabi',
                'tradition': 'Sunnah'
            }
        };

        this.toneModifiers = {
            'sacred': {
                preserve_arabic: true,
                use_honorifics: true,
                formal_language: true
            },
            'reverent': {
                preserve_arabic: true,
                use_honorifics: true,
                formal_language: true
            },
            'respectful': {
                preserve_arabic: false,
                use_honorifics: false,
                formal_language: true
            },
            'formal': {
                preserve_arabic: false,
                use_honorifics: false,
                formal_language: true
            }
        };
    }

    /**
     * Analyze text to determine Islamic context
     */
    analyzeContext(text, sourceLang = 'en') {
        const analysis = {
            detectedContexts: [],
            primaryContext: null,
            confidence: 0,
            tone: 'neutral',
            priority: 'low',
            suggestions: []
        };

        const lowerText = text.toLowerCase();
        let maxScore = 0;

        // Check each context
        for (const [contextName, contextData] of Object.entries(this.islamicContexts)) {
            let score = 0;
            const matchedKeywords = [];

            // Check for keyword matches
            for (const keyword of contextData.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    score += contextData.priority === 'highest' ? 3 : 
                            contextData.priority === 'high' ? 2 : 1;
                    matchedKeywords.push(keyword);
                }
            }

            if (score > 0) {
                analysis.detectedContexts.push({
                    context: contextName,
                    score: score,
                    keywords: matchedKeywords,
                    tone: contextData.tone,
                    priority: contextData.priority
                });

                if (score > maxScore) {
                    maxScore = score;
                    analysis.primaryContext = contextName;
                    analysis.tone = contextData.tone;
                    analysis.priority = contextData.priority;
                }
            }
        }

        // Calculate confidence based on keyword density and context strength
        analysis.confidence = Math.min(maxScore / (text.split(' ').length * 0.1), 1);

        // Generate context-specific suggestions
        if (analysis.primaryContext) {
            analysis.suggestions = this.generateContextualSuggestions(text, analysis.primaryContext);
        }

        return analysis;
    }

    /**
     * Generate contextual translation suggestions
     */
    generateContextualSuggestions(text, context) {
        const suggestions = [];
        const contextTranslations = this.contextualTranslations[this.islamicContexts[context].context];

        if (contextTranslations) {
            for (const [english, arabic] of Object.entries(contextTranslations)) {
                if (text.toLowerCase().includes(english)) {
                    suggestions.push({
                        original: english,
                        suggested: arabic,
                        reason: `Islamic context: ${context}`,
                        confidence: 0.9
                    });
                }
            }
        }

        return suggestions;
    }

    /**
     * Enhance translation with context awareness
     */
    enhanceTranslation(originalText, translatedText, contextAnalysis, sourceLang, targetLang) {
        let enhancedTranslation = translatedText;
        const toneModifier = this.toneModifiers[contextAnalysis.tone];

        // Apply context-specific enhancements
        if (contextAnalysis.primaryContext) {
            const contextData = this.islamicContexts[contextAnalysis.primaryContext];
            const contextTranslations = this.contextualTranslations[contextData.context];

            // Apply specialized translations
            if (contextTranslations) {
                for (const [english, arabic] of Object.entries(contextTranslations)) {
                    const regex = new RegExp(`\\b${english}\\b`, 'gi');
                    enhancedTranslation = enhancedTranslation.replace(regex, arabic);
                }
            }

            // Apply tone-specific modifications
            if (toneModifier.preserve_arabic) {
                // Ensure Arabic terms are preserved
                enhancedTranslation = this.preserveArabicTerms(enhancedTranslation);
            }

            if (toneModifier.use_honorifics) {
                // Add appropriate Islamic honorifics
                enhancedTranslation = this.addIslamicHonorifics(enhancedTranslation, contextAnalysis.primaryContext);
            }

            if (toneModifier.formal_language) {
                // Ensure formal language usage
                enhancedTranslation = this.ensureFormalLanguage(enhancedTranslation);
            }
        }

        return {
            original: originalText,
            translated: enhancedTranslation,
            context: contextAnalysis.primaryContext,
            tone: contextAnalysis.tone,
            confidence: contextAnalysis.confidence,
            suggestions: contextAnalysis.suggestions,
            enhancements: {
                contextual_translations: contextAnalysis.suggestions.length,
                tone_applied: contextAnalysis.tone,
                formal_language: toneModifier?.formal_language || false
            }
        };
    }

    /**
     * Preserve Arabic terms in translation
     */
    preserveArabicTerms(text) {
        // Common Arabic terms that should be preserved
        const arabicTerms = [
            'Allah', 'Rabb', 'Rahman', 'Rahim', 'Salam', 'Barakah',
            'InshaAllah', 'MashaAllah', 'SubhanAllah', 'Alhamdulillah',
            'Bismillah', 'Ameen', 'Amin'
        ];

        let preservedText = text;
        for (const term of arabicTerms) {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            preservedText = preservedText.replace(regex, term);
        }

        return preservedText;
    }

    /**
     * Add Islamic honorifics where appropriate
     */
    addIslamicHonorifics(text, context) {
        let enhancedText = text;

        // Add honorifics based on context
        if (context === 'quranic_text' || context === 'hadith') {
            // Add peace be upon him for Prophet Muhammad
            enhancedText = enhancedText.replace(/\b(prophet|muhammad|messenger)\b/gi, 
                (match) => `${match} (peace be upon him)`);
        }

        return enhancedText;
    }

    /**
     * Ensure formal language usage
     */
    ensureFormalLanguage(text) {
        // Replace informal terms with formal equivalents
        const formalReplacements = {
            'gonna': 'going to',
            'wanna': 'want to',
            'gotta': 'have to',
            'ain\'t': 'is not',
            'don\'t': 'do not',
            'won\'t': 'will not',
            'can\'t': 'cannot'
        };

        let formalText = text;
        for (const [informal, formal] of Object.entries(formalReplacements)) {
            const regex = new RegExp(`\\b${informal}\\b`, 'gi');
            formalText = formalText.replace(regex, formal);
        }

        return formalText;
    }

    /**
     * Get context-specific translation guidelines
     */
    getContextGuidelines(context) {
        const guidelines = {
            'religious_prayer': {
                preserve_arabic_terms: true,
                use_formal_language: true,
                maintain_reverence: true,
                avoid_colloquialisms: true
            },
            'quranic_text': {
                preserve_arabic_terms: true,
                use_formal_language: true,
                maintain_sacredness: true,
                avoid_interpretation: true
            },
            'hadith_text': {
                preserve_arabic_terms: true,
                use_formal_language: true,
                maintain_authenticity: true,
                preserve_chain_of_narration: true
            },
            'islamic_law': {
                preserve_arabic_terms: false,
                use_formal_language: true,
                maintain_precision: true,
                avoid_ambiguity: true
            },
            'general_islamic': {
                preserve_arabic_terms: false,
                use_formal_language: true,
                maintain_respect: true,
                use_appropriate_terminology: true
            }
        };

        return guidelines[context] || guidelines['general_islamic'];
    }
}

module.exports = ContextAwareTranslationService;
