// services/partialTranslationService.js
const { OpenAI } = require('openai');
const { translationCache } = require('./translationCache');
const TranslationHistory = require('../models/TranslationHistory');
const logger = require('../utils/logger');

class PartialTranslationService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            // Pre-populate cache with common phrases
            await this.preloadCommonPhrases();
            this.isInitialized = true;
            logger.info('Partial Translation Service initialized');
        } catch (error) {
            logger.error('Failed to initialize Partial Translation Service:', error);
        }
    }

    // Preload common phrases into cache
    async preloadCommonPhrases() {
        const commonPhrases = [
            { ar: 'السلام عليكم', en: 'Peace be upon you' },
            { ar: 'وعليكم السلام', en: 'And peace be upon you too' },
            { ar: 'بسم الله', en: 'In the name of Allah' },
            { ar: 'الحمد لله', en: 'Praise be to Allah' },
            { ar: 'سبحان الله', en: 'Glory be to Allah' },
            { ar: 'الله أكبر', en: 'Allah is the greatest' },
            { ar: 'لا إله إلا الله', en: 'There is no god but Allah' },
            { ar: 'محمد رسول الله', en: 'Muhammad is the messenger of Allah' },
            { ar: 'أستغفر الله', en: 'I seek forgiveness from Allah' },
            { ar: 'إن شاء الله', en: 'If Allah wills' },
            { ar: 'ما شاء الله', en: 'What Allah has willed' },
            { ar: 'بارك الله فيك', en: 'May Allah bless you' },
            { ar: 'جزاك الله خيراً', en: 'May Allah reward you with good' },
            { ar: 'في أمان الله', en: 'In Allah\'s protection' }
        ];

        for (const phrase of commonPhrases) {
            await translationCache.setTranslation(phrase.ar, 'ar', 'en', { translatedText: phrase.en, confidence: 1.0 });
            await translationCache.setTranslation(phrase.en, 'en', 'ar', { translatedText: phrase.ar, confidence: 1.0 });
        }

        logger.info(`Preloaded ${commonPhrases.length} common phrases`);
    }

    // Get partial translation for real-time typing
    async getPartialTranslation(text, fromLang, toLang, userId = null, sessionId = null) {
        if (!this.isInitialized) {
            await this.init();
        }

        if (!text || text.trim().length < 2) {
            return null;
        }

        try {
            // Try cache first
            const cached = translationCache.getPartialTranslation(text, fromLang, toLang, userId);
            if (cached) {
                return {
                    ...cached,
                    isPartial: true,
                    processingTime: 0
                };
            }

            // For very short text, try simple word lookup
            if (text.trim().length < 10) {
                const wordTranslation = await this.translateWord(text, fromLang, toLang);
                if (wordTranslation) {
                    translationCache.cacheTranslation(text, fromLang, toLang, wordTranslation, 0.8, userId);
                    return {
                        translated: wordTranslation,
                        confidence: 0.8,
                        source: 'word_lookup',
                        isPartial: true,
                        processingTime: 0
                    };
                }
            }

            // Use faster, cheaper model for partial translations
            const partialTranslation = await this.translateWithFastModel(text, fromLang, toLang);
            if (partialTranslation) {
                translationCache.cacheTranslation(text, fromLang, toLang, partialTranslation, 0.7, userId);
                
                // Save to database as partial translation
                if (userId && sessionId) {
                    await this.savePartialTranslation(text, partialTranslation, fromLang, toLang, userId, sessionId);
                }

                return {
                    translated: partialTranslation,
                    confidence: 0.7,
                    source: 'fast_model',
                    isPartial: true,
                    processingTime: partialTranslation.processingTime || 0
                };
            }

            return null;
        } catch (error) {
            logger.error('Error in partial translation:', error);
            return null;
        }
    }

    // Translate single word using dictionary lookup
    async translateWord(word, fromLang, toLang) {
        const normalizedWord = word.trim().toLowerCase();
        
        // Simple word mapping for common words
        const wordMappings = {
            'ar-en': {
                'الله': 'Allah',
                'محمد': 'Muhammad',
                'السلام': 'peace',
                'عليكم': 'upon you',
                'ورحمة': 'and mercy',
                'وبركاته': 'and blessings',
                'بسم': 'in the name',
                'الحمد': 'praise',
                'لله': 'to Allah',
                'سبحان': 'glory',
                'أكبر': 'greatest',
                'لا': 'no',
                'إله': 'god',
                'إلا': 'but',
                'رسول': 'messenger',
                'أستغفر': 'I seek forgiveness',
                'إن': 'if',
                'شاء': 'wills',
                'ما': 'what',
                'بارك': 'bless',
                'في': 'in',
                'جزاك': 'reward you',
                'خيراً': 'with good',
                'أمان': 'protection'
            },
            'en-ar': {
                'allah': 'الله',
                'muhammad': 'محمد',
                'peace': 'السلام',
                'upon': 'على',
                'you': 'أنت',
                'and': 'و',
                'mercy': 'رحمة',
                'blessings': 'بركات',
                'name': 'اسم',
                'praise': 'حمد',
                'glory': 'سبحان',
                'greatest': 'أكبر',
                'no': 'لا',
                'god': 'إله',
                'but': 'إلا',
                'messenger': 'رسول',
                'forgiveness': 'مغفرة',
                'if': 'إن',
                'wills': 'شاء',
                'what': 'ما',
                'bless': 'بارك',
                'in': 'في',
                'reward': 'جزاء',
                'good': 'خير',
                'protection': 'أمان'
            }
        };

        const mappingKey = `${fromLang}-${toLang}`;
        const mappings = wordMappings[mappingKey];
        
        if (mappings && mappings[normalizedWord]) {
            return mappings[normalizedWord];
        }

        return null;
    }

    // Translate with GPT-5 for partial translations
    async translateWithFastModel(text, fromLang, toLang) {
        try {
            const startTime = Date.now();
            
            const prompt = `Translate this text from ${fromLang} to ${toLang}. Provide only the translation, no explanations: "${text}"`;
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-5", // Using GPT-5 for all translations
                messages: [
                    {
                        role: "system",
                        content: "You are a fast translator. Provide only the translation, no explanations or additional text."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 100,
                temperature: 0.3
            });

            const processingTime = Date.now() - startTime;
            const translated = completion.choices[0].message.content.trim();
            
            return {
                translated,
                processingTime
            };
        } catch (error) {
            logger.error('Fast model translation failed:', error);
            return null;
        }
    }

    // Save partial translation to database
    async savePartialTranslation(originalText, translatedText, fromLang, toLang, userId, sessionId) {
        try {
            const translation = new TranslationHistory({
                userId,
                sessionId,
                conversationId: sessionId, // Using sessionId as conversationId for now
                originalText,
                translatedText,
                fromLanguage: fromLang,
                toLanguage: toLang,
                confidence: 0.7,
                isPartial: true,
                partialIndex: await this.getNextPartialIndex(sessionId),
                model: 'gpt-5'
            });

            await translation.save();
            logger.debug(`Saved partial translation for user ${userId}`);
        } catch (error) {
            logger.error('Failed to save partial translation:', error);
        }
    }

    // Get next partial index for a session
    async getNextPartialIndex(sessionId) {
        try {
            const lastPartial = await TranslationHistory.findOne({
                sessionId,
                isPartial: true
            }).sort({ partialIndex: -1 });

            return lastPartial ? lastPartial.partialIndex + 1 : 0;
        } catch (error) {
            logger.error('Failed to get next partial index:', error);
            return 0;
        }
    }

    // Get conversation history with partial translations
    async getConversationHistory(conversationId, userId, options = {}) {
        try {
            const query = {
                conversationId,
                userId,
                isDeleted: false
            };

            if (options.includePartial !== false) {
                // Include partial translations by default
            } else {
                query.isPartial = false;
            }

            const translations = await TranslationHistory.find(query)
                .sort({ partialIndex: 1, createdAt: 1 })
                .limit(options.limit || 100);

            return translations;
        } catch (error) {
            logger.error('Failed to get conversation history:', error);
            return [];
        }
    }

    // Convert partial translations to final translation
    async finalizeTranslation(conversationId, userId, finalText, fromLang, toLang) {
        try {
            // Get all partial translations for this conversation
            const partialTranslations = await TranslationHistory.find({
                conversationId,
                userId,
                isPartial: true,
                isDeleted: false
            }).sort({ partialIndex: 1 });

            if (partialTranslations.length === 0) {
                return null;
            }

            // Create final translation
            const finalTranslation = new TranslationHistory({
                userId,
                sessionId: conversationId,
                conversationId,
                originalText: finalText,
                translatedText: await this.translateWithAccurateModel(finalText, fromLang, toLang),
                fromLanguage: fromLang,
                toLanguage: toLang,
                confidence: 0.95,
                isPartial: false,
                model: 'gpt-5'
            });

            await finalTranslation.save();

            // Mark partial translations as deleted
            await TranslationHistory.updateMany(
                { _id: { $in: partialTranslations.map(p => p._id) } },
                { isDeleted: true }
            );

            logger.info(`Finalized translation for conversation ${conversationId}`);
            return finalTranslation;
        } catch (error) {
            logger.error('Failed to finalize translation:', error);
            return null;
        }
    }

    // Translate with GPT-5 for final translation
    async translateWithAccurateModel(text, fromLang, toLang) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-5",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional translator specializing in Islamic terminology. Provide accurate, context-aware translations."
                    },
                    {
                        role: "user",
                        content: `Translate this text from ${fromLang} to ${toLang}: "${text}"`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            logger.error('Accurate model translation failed:', error);
            return text; // Return original text as fallback
        }
    }

    // Get user translation statistics
    async getUserStats(userId) {
        try {
            const stats = await TranslationHistory.getUserStats(userId);
            return stats[0] || {
                totalTranslations: 0,
                totalCharacters: 0,
                averageConfidence: 0,
                languages: [],
                targetLanguages: [],
                lastTranslation: null,
                firstTranslation: null
            };
        } catch (error) {
            logger.error('Failed to get user stats:', error);
            return null;
        }
    }

    // Search user translations
    async searchUserTranslations(userId, searchTerm, options = {}) {
        try {
            const translations = await TranslationHistory.searchTranslations(userId, searchTerm, options);
            return translations;
        } catch (error) {
            logger.error('Failed to search translations:', error);
            return [];
        }
    }
}

module.exports = new PartialTranslationService();
