// Language Detection and Context Management Module
export class LanguageDetection {
    constructor() {
        this.islamicKeywords = new Set([
            // Arabic Islamic terms
            'الله', 'الرحمن', 'الرحيم', 'السلام', 'عليكم', 'ورحمة', 'وبركاته',
            'بسم', 'الله', 'الرحمن', 'الرحيم', 'الحمد', 'لله', 'رب', 'العالمين',
            'الصلاة', 'السلام', 'على', 'محمد', 'وعلى', 'آله', 'وصحبه', 'أجمعين',
            'سبحان', 'الله', 'والحمد', 'لله', 'ولا', 'إله', 'إلا', 'الله',
            'أستغفر', 'الله', 'الذي', 'لا', 'إله', 'إلا', 'هو', 'الحي', 'القيوم',
            'لا', 'حول', 'ولا', 'قوة', 'إلا', 'بالله', 'العلي', 'العظيم',
            'إن', 'الله', 'مع', 'الصابرين', 'وما', 'توفيقي', 'إلا', 'بالله',
            'رضيت', 'بالله', 'ربا', 'وبالإسلام', 'دينا', 'وبمحمد', 'نبيا',
            'اللهم', 'صل', 'على', 'محمد', 'وعلى', 'آل', 'محمد', 'كما', 'صليت',
            'على', 'إبراهيم', 'وعلى', 'آل', 'إبراهيم', 'إنك', 'حميد', 'مجيد',
            'اللهم', 'بارك', 'على', 'محمد', 'وعلى', 'آل', 'محمد', 'كما', 'باركت',
            'على', 'إبراهيم', 'وعلى', 'آل', 'إبراهيم', 'إنك', 'حميد', 'مجيد',

            // English Islamic terms
            'allah', 'muhammad', 'islam', 'muslim', 'quran', 'hadith', 'sunnah',
            'prayer', 'salah', 'fasting', 'ramadan', 'hajj', 'umrah', 'zakat',
            'shahada', 'tawhid', 'sunnah', 'bidah', 'halal', 'haram', 'mashallah',
            'inshallah', 'alhamdulillah', 'subhanallah', 'astaghfirullah',
            'bismillah', 'barakallahu', 'jazakallahu', 'khair', 'ameen',
            'peace', 'be', 'upon', 'you', 'mercy', 'blessings', 'brother', 'sister',
            'imam', 'sheikh', 'hafiz', 'qari', 'muezzin', 'mosque', 'masjid',
            'minaret', 'mihrab', 'minbar', 'qibla', 'kaaba', 'mecca', 'medina',
            'jerusalem', 'al-aqsa', 'dome', 'rock', 'prophet', 'messenger',
            'revelation', 'guidance', 'wisdom', 'knowledge', 'faith', 'belief',
            'worship', 'devotion', 'piety', 'righteousness', 'goodness', 'virtue',
            'patience', 'gratitude', 'forgiveness', 'mercy', 'compassion', 'love',
            'peace', 'harmony', 'unity', 'brotherhood', 'sisterhood', 'community',
            'ummah', 'nation', 'people', 'believers', 'faithful', 'righteous',
            'pious', 'devout', 'sincere', 'humble', 'modest', 'pure', 'clean',
            'blessed', 'sacred', 'holy', 'divine', 'spiritual', 'religious',
            'islamic', 'muslim', 'arabic', 'quranic', 'prophetic', 'traditional',
            'authentic', 'genuine', 'true', 'correct', 'right', 'proper',
            'suitable', 'appropriate', 'fitting', 'becoming', 'worthy', 'deserving'
        ]);

        this.languagePatterns = {
            arabic: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
            english: /[a-zA-Z]/,
            urdu: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
            persian: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
            turkish: /[a-zA-Z\u00C0-\u017F\u011E\u011F\u0130\u0131\u015E\u015F\u00D6\u00F6\u00DC\u00FC]/,
            french: /[a-zA-Z\u00C0-\u017F\u0152\u0153\u0178\u0179]/,
            spanish: /[a-zA-Z\u00C0-\u017F\u00D1\u00F1\u00DC\u00FC]/,
            german: /[a-zA-Z\u00C0-\u017F\u00DF\u00D6\u00F6\u00DC\u00FC]/,
            italian: /[a-zA-Z\u00C0-\u017F]/,
            portuguese: /[a-zA-Z\u00C0-\u017F\u00C7\u00E7]/,
            russian: /[\u0400-\u04FF\u0500-\u052F]/,
            chinese: /[\u4E00-\u9FFF\u3400-\u4DBF]/,
            japanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
            korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
            hindi: /[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]/,
            bengali: /[\u0980-\u09FF\uA8E0-\uA8FF\u1CD0-\u1CFF]/,
            indonesian: /[a-zA-Z\u00C0-\u017F]/,
            malay: /[a-zA-Z\u00C0-\u017F]/,
            swahili: /[a-zA-Z\u00C0-\u017F]/,
            hausa: /[a-zA-Z\u00C0-\u017F]/
        };

        this.contextMemory = new Map();
        this.maxContextLength = 10;
    }

    /**
     * Detect language with enhanced accuracy
     * @param {string} text - Text to analyze
     * @returns {Object} Language detection result
     */
    detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return { language: 'auto', confidence: 0, isIslamic: false };
        }

        const cleanText = text.trim().toLowerCase();
        let maxScore = 0;
        let detectedLanguage = 'auto';
        let confidence = 0;

        // Check for Islamic content first
        const isIslamic = this.isIslamicContent(cleanText);

        // Score each language pattern
        for (const [lang, pattern] of Object.entries(this.languagePatterns)) {
            const matches = (cleanText.match(pattern) || []).length;
            const score = matches / cleanText.length;

            if (score > maxScore) {
                maxScore = score;
                detectedLanguage = lang;
                confidence = Math.min(score * 100, 100);
            }
        }

        // Boost confidence for Islamic content
        if (isIslamic && detectedLanguage === 'arabic') {
            confidence = Math.min(confidence + 20, 100);
        }

        return {
            language: detectedLanguage,
            confidence: Math.round(confidence),
            isIslamic: isIslamic,
            pattern: this.languagePatterns[detectedLanguage]
        };
    }

    /**
     * Check if content is Islamic
     * @param {string} text - Text to check
     * @returns {boolean} Is Islamic content
     */
    isIslamicContent(text) {
        const cleanText = text.toLowerCase().trim();

        // If text is too short, reject it
        if (cleanText.length < 2) {
            return false;
        }

        const words = cleanText.split(/\s+/);

        // Check for explicit Islamic keywords first
        let islamicWordCount = 0;
        for (const word of words) {
            if (this.islamicKeywords.has(word)) {
                islamicWordCount++;
            }
        }

        // Check for Arabic script (more strict)
        const hasArabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

        // Check for common Islamic phrases
        const islamicPhrases = [
            'bismillah', 'alhamdulillah', 'subhanallah', 'astaghfirullah',
            'inshallah', 'mashallah', 'barakallahu', 'jazakallahu',
            'peace be upon you', 'salam', 'salaam', 'ramadan', 'hajj',
            'prayer', 'salah', 'quran', 'hadith', 'islam', 'muslim',
            'allah', 'muhammad', 'prophet', 'mosque', 'masjid'
        ];

        let hasIslamicPhrase = false;
        for (const phrase of islamicPhrases) {
            if (cleanText.includes(phrase)) {
                hasIslamicPhrase = true;
                break;
            }
        }

        // More strict criteria:
        // 1. Must have Arabic script OR
        // 2. Must have at least 30% Islamic words OR
        // 3. Must contain explicit Islamic phrases
        const islamicRatio = islamicWordCount / words.length;

        return hasArabicScript || islamicRatio >= 0.3 || hasIslamicPhrase;
    }

    /**
     * Validate if content should be translated (Islamic only)
     * @param {string} text - Text to validate
     * @returns {Object} Validation result
     */
    validateContent(text) {
        // Allow all content for now - remove strict Islamic-only validation
        // This was causing issues with normal text input including spaces
        const detection = this.detectLanguage(text);

        return {
            valid: true,
            reason: 'Content is suitable for translation',
            detectedLanguage: detection.language,
            confidence: detection.confidence,
            isIslamic: detection.isIslamic
        };
    }

    /**
     * Get language suggestions based on context
     * @param {string} text - Text to analyze
     * @param {string} currentLang - Current selected language
     * @returns {Array} Language suggestions
     */
    getLanguageSuggestions(text, currentLang) {
        const detection = this.detectLanguage(text);
        const suggestions = [];

        if (detection.language === 'arabic') {
            suggestions.push(
                { code: 'en', name: 'English', confidence: 95 },
                { code: 'ur', name: 'Urdu', confidence: 90 },
                { code: 'fa', name: 'Persian', confidence: 85 },
                { code: 'tr', name: 'Turkish', confidence: 80 },
                { code: 'fr', name: 'French', confidence: 75 }
            );
        } else if (detection.language === 'english') {
            suggestions.push(
                { code: 'ar', name: 'Arabic', confidence: 95 },
                { code: 'ur', name: 'Urdu', confidence: 90 },
                { code: 'fa', name: 'Persian', confidence: 85 },
                { code: 'tr', name: 'Turkish', confidence: 80 }
            );
        }

        return suggestions.filter(s => s.code !== currentLang);
    }

    /**
     * Update context memory
     * @param {string} text - Text to add to context
     * @param {string} language - Language of the text
     */
    updateContext(text, language) {
        const context = {
            text: text,
            language: language,
            timestamp: Date.now()
        };

        this.contextMemory.set(text, context);

        // Limit context memory size
        if (this.contextMemory.size > this.maxContextLength) {
            const oldestKey = this.contextMemory.keys().next().value;
            this.contextMemory.delete(oldestKey);
        }
    }

    /**
     * Get context for better translation
     * @param {string} currentText - Current text being translated
     * @returns {string} Context string
     */
    getContext(currentText) {
        const contexts = Array.from(this.contextMemory.values())
            .filter(ctx => ctx.language !== this.detectLanguage(currentText).language)
            .slice(-3) // Last 3 translations
            .map(ctx => ctx.text)
            .join(' ');

        return contexts;
    }

    /**
     * Clear context memory
     */
    clearContext() {
        this.contextMemory.clear();
    }

    /**
     * Get context statistics
     * @returns {Object} Context statistics
     */
    getContextStats() {
        return {
            size: this.contextMemory.size,
            maxSize: this.maxContextLength,
            languages: [...new Set(Array.from(this.contextMemory.values()).map(ctx => ctx.language))],
            lastUpdate: Math.max(...Array.from(this.contextMemory.values()).map(ctx => ctx.timestamp))
        };
    }
}
