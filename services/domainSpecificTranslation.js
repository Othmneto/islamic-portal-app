/**
 * Domain-Specific Translation Service for Muslim Religious Content
 * Specialized translation handling for Islamic texts and terminology
 */
class DomainSpecificTranslationService {
    constructor() {
        this.islamicTerminology = {
            // Core Islamic concepts
            core: {
                'Allah': { ar: 'الله', en: 'Allah', context: 'divine_name' },
                'Rabb': { ar: 'رب', en: 'Lord', context: 'divine_attribute' },
                'Rahman': { ar: 'الرحمن', en: 'The Most Merciful', context: 'divine_attribute' },
                'Rahim': { ar: 'الرحيم', en: 'The Most Compassionate', context: 'divine_attribute' },
                'Salam': { ar: 'سلام', en: 'Peace', context: 'greeting' },
                'Barakah': { ar: 'بركة', en: 'Blessing', context: 'spiritual_concept' }
            },

            // Prayer and worship
            worship: {
                'Salah': { ar: 'صلاة', en: 'Prayer', context: 'worship' },
                'Namaz': { ar: 'نماز', en: 'Prayer', context: 'worship', language: 'urdu' },
                'Dua': { ar: 'دعاء', en: 'Supplication', context: 'worship' },
                'Ibadah': { ar: 'عبادة', en: 'Worship', context: 'worship' },
                'Dhikr': { ar: 'ذكر', en: 'Remembrance of Allah', context: 'worship' },
                'Tasbih': { ar: 'تسبيح', en: 'Glorification', context: 'worship' }
            },

            // Quranic terms
            quranic: {
                'Ayat': { ar: 'آية', en: 'Verse', context: 'quranic' },
                'Surah': { ar: 'سورة', en: 'Chapter', context: 'quranic' },
                'Quran': { ar: 'القرآن', en: 'Quran', context: 'quranic' },
                'Revelation': { ar: 'وحي', en: 'Revelation', context: 'quranic' },
                'Tafsir': { ar: 'تفسير', en: 'Exegesis', context: 'quranic' },
                'Mushaf': { ar: 'مصحف', en: 'Quranic Text', context: 'quranic' }
            },

            // Hadith and Sunnah
            hadith: {
                'Hadith': { ar: 'حديث', en: 'Hadith', context: 'hadith' },
                'Sunnah': { ar: 'سنة', en: 'Sunnah', context: 'hadith' },
                'Sahih': { ar: 'صحيح', en: 'Authentic', context: 'hadith_grade' },
                'Hasan': { ar: 'حسن', en: 'Good', context: 'hadith_grade' },
                'Daif': { ar: 'ضعيف', en: 'Weak', context: 'hadith_grade' },
                'Mawdu': { ar: 'موضوع', en: 'Fabricated', context: 'hadith_grade' }
            },

            // Islamic law and jurisprudence
            fiqh: {
                'Halal': { ar: 'حلال', en: 'Permissible', context: 'islamic_law' },
                'Haram': { ar: 'حرام', en: 'Forbidden', context: 'islamic_law' },
                'Makruh': { ar: 'مكروه', en: 'Disliked', context: 'islamic_law' },
                'Mustahabb': { ar: 'مستحب', en: 'Recommended', context: 'islamic_law' },
                'Wajib': { ar: 'واجب', en: 'Obligatory', context: 'islamic_law' },
                'Fard': { ar: 'فرض', en: 'Obligatory', context: 'islamic_law' }
            },

            // Islamic calendar and times
            calendar: {
                'Ramadan': { ar: 'رمضان', en: 'Ramadan', context: 'islamic_month' },
                'Hajj': { ar: 'حج', en: 'Pilgrimage', context: 'islamic_pillar' },
                'Umrah': { ar: 'عمرة', en: 'Lesser Pilgrimage', context: 'islamic_pillar' },
                'Eid': { ar: 'عيد', en: 'Festival', context: 'islamic_festival' },
                'Jummah': { ar: 'جمعة', en: 'Friday', context: 'islamic_day' },
                'Iftar': { ar: 'إفطار', en: 'Breaking Fast', context: 'ramadan' }
            }
        };

        this.translationRules = {
            // Rules for different contexts
            'divine_name': {
                preserve_original: true,
                capitalize: true,
                add_honorific: false
            },
            'divine_attribute': {
                preserve_original: true,
                capitalize: true,
                add_honorific: false
            },
            'worship': {
                preserve_original: false,
                capitalize: true,
                add_honorific: false
            },
            'quranic': {
                preserve_original: true,
                capitalize: true,
                add_honorific: false
            },
            'hadith': {
                preserve_original: false,
                capitalize: true,
                add_honorific: true
            },
            'islamic_law': {
                preserve_original: false,
                capitalize: true,
                add_honorific: false
            },
            'general': {
                preserve_original: false,
                capitalize: true,
                add_honorific: false
            }
        };

        this.languageSpecificRules = {
            'ar': {
                rtl: true,
                preserve_arabic: true,
                add_diacritics: false
            },
            'en': {
                rtl: false,
                preserve_arabic: false,
                add_diacritics: false
            },
            'ur': {
                rtl: false,
                preserve_arabic: true,
                add_diacritics: false
            },
            'fa': {
                rtl: true,
                preserve_arabic: true,
                add_diacritics: false
            }
        };
    }

    /**
     * Get domain-specific translation for a term
     */
    getDomainTranslation(term, sourceLang, targetLang, context = 'general') {
        const lowerTerm = term.toLowerCase();

        // Search through all terminology categories
        for (const [category, terms] of Object.entries(this.islamicTerminology)) {
            for (const [key, data] of Object.entries(terms)) {
                // Check if term matches in any language
                if (data.ar === term || data.en === term || key.toLowerCase() === lowerTerm) {
                    return this.applyTranslationRules(data, sourceLang, targetLang, context);
                }
            }
        }

        return null;
    }

    /**
     * Apply translation rules based on context and languages
     */
    applyTranslationRules(termData, sourceLang, targetLang, context) {
        const termContext = termData.context || context || 'general';
        const rules = this.translationRules[termContext] || this.translationRules['general'] || {
            preserve_original: false,
            capitalize: true,
            add_honorific: false
        };
        const sourceRules = this.languageSpecificRules[sourceLang] || {};
        const targetRules = this.languageSpecificRules[targetLang] || {};

        let translation = termData[targetLang] || termData.en;

        // Apply context-specific rules
        if (rules.preserve_original && termData.context === 'divine_name') {
            translation = termData.ar; // Always use Arabic for divine names
        }

        if (rules.capitalize) {
            translation = this.capitalizeFirstLetter(translation);
        }

        if (rules.add_honorific && termData.context === 'hadith') {
            translation += ' (peace be upon him)';
        }

        return {
            original: termData[sourceLang] || termData.en,
            translated: translation,
            context: termData.context,
            category: this.getCategoryFromContext(termData.context),
            confidence: 0.95,
            rules_applied: rules
        };
    }

    /**
     * Enhance translation with domain-specific knowledge
     */
    enhanceTranslation(text, sourceLang, targetLang, detectedContext) {
        const words = text.split(/\s+/);
        const enhancedWords = [];
        let hasDomainTerms = false;

        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, '');
            const context = typeof detectedContext === 'string' ? detectedContext : (detectedContext?.primaryContext || 'general');
            const domainTranslation = this.getDomainTranslation(cleanWord, sourceLang, targetLang, context);

            if (domainTranslation) {
                enhancedWords.push(domainTranslation.translated);
                hasDomainTerms = true;
            } else {
                enhancedWords.push(word);
            }
        }

        return {
            original: text,
            enhanced: enhancedWords.join(' '),
            has_domain_terms: hasDomainTerms,
            domain_enhancements: this.getDomainEnhancements(text, sourceLang, targetLang)
        };
    }

    /**
     * Get domain-specific enhancements for the text
     */
    getDomainEnhancements(text, sourceLang, targetLang) {
        const enhancements = {
            terminology_corrections: [],
            context_suggestions: [],
            cultural_notes: []
        };

        // Check for common translation issues
        const commonIssues = this.identifyCommonIssues(text, sourceLang, targetLang);
        enhancements.terminology_corrections = commonIssues;

        // Provide context suggestions
        enhancements.context_suggestions = this.getContextSuggestions(text);

        // Add cultural notes
        enhancements.cultural_notes = this.getCulturalNotes(text, targetLang);

        return enhancements;
    }

    /**
     * Identify common translation issues
     */
    identifyCommonIssues(text, sourceLang, targetLang) {
        const issues = [];
        const lowerText = text.toLowerCase();

        // Common mistranslations
        const commonMistakes = {
            'god': 'Allah (when referring to the Islamic concept)',
            'lord': 'Rabb (when referring to Allah)',
            'prayer': 'Salah (for Islamic prayer)',
            'worship': 'Ibadah (for Islamic worship)'
        };

        for (const [mistake, correction] of Object.entries(commonMistakes)) {
            if (lowerText.includes(mistake)) {
                issues.push({
                    original: mistake,
                    suggested: correction,
                    reason: 'More accurate Islamic terminology',
                    confidence: 0.8
                });
            }
        }

        return issues;
    }

    /**
     * Get context suggestions
     */
    getContextSuggestions(text) {
        const suggestions = [];
        const lowerText = text.toLowerCase();

        // Context detection
        if (lowerText.includes('prayer') || lowerText.includes('salah')) {
            suggestions.push({
                context: 'worship',
                suggestion: 'Consider using "Salah" for Islamic prayer',
                confidence: 0.9
            });
        }

        if (lowerText.includes('quran') || lowerText.includes('verse')) {
            suggestions.push({
                context: 'quranic',
                suggestion: 'Ensure proper Quranic terminology is used',
                confidence: 0.9
            });
        }

        return suggestions;
    }

    /**
     * Get cultural notes
     */
    getCulturalNotes(text, targetLang) {
        const notes = [];
        const lowerText = text.toLowerCase();

        // Add cultural context notes
        if (lowerText.includes('ramadan')) {
            notes.push({
                term: 'Ramadan',
                note: 'The holy month of fasting in Islam',
                cultural_importance: 'high'
            });
        }

        if (lowerText.includes('hajj')) {
            notes.push({
                term: 'Hajj',
                note: 'One of the five pillars of Islam, obligatory pilgrimage to Mecca',
                cultural_importance: 'highest'
            });
        }

        return notes;
    }

    /**
     * Get category from context
     */
    getCategoryFromContext(context) {
        const categoryMap = {
            'divine_name': 'core',
            'divine_attribute': 'core',
            'worship': 'worship',
            'quranic': 'quranic',
            'hadith': 'hadith',
            'islamic_law': 'fiqh',
            'islamic_month': 'calendar',
            'islamic_pillar': 'calendar',
            'islamic_festival': 'calendar'
        };

        return categoryMap[context] || 'general';
    }

    /**
     * Capitalize first letter
     */
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Get all terminology for a specific category
     */
    getTerminologyByCategory(category) {
        return this.islamicTerminology[category] || {};
    }

    /**
     * Get terminology statistics
     */
    getTerminologyStats() {
        const stats = {
            total_terms: 0,
            by_category: {},
            by_context: {}
        };

        for (const [category, terms] of Object.entries(this.islamicTerminology)) {
            stats.by_category[category] = Object.keys(terms).length;
            stats.total_terms += Object.keys(terms).length;

            for (const [key, data] of Object.entries(terms)) {
                const context = data.context;
                stats.by_context[context] = (stats.by_context[context] || 0) + 1;
            }
        }

        return stats;
    }
}

module.exports = DomainSpecificTranslationService;
