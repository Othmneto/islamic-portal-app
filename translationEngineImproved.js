/**
 * Improved Translation Engine
 * Provides robust translation functionality with error handling and fallbacks
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const IslamicTerminologyService = require('./services/islamicTerminologyService');

class TranslationEngine {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
        this.model = 'gpt-4o'; // Using GPT-4o for better translation quality
        this.timeout = 15000; // Reduced to 15 seconds for faster response
        this.maxRetries = 2; // Reduced retries for speed
        this.retryDelay = 500; // Faster retry delay
        this.contextHistory = new Map(); // Store recent translations for context
        this.islamicTerminology = new IslamicTerminologyService(); // Islamic terms database
    }

    /**
     * Translate text from source language to target language
     * @param {string} text - Text to translate
     * @param {string} sourceLang - Source language code
     * @param {string} targetLang - Target language code
     * @returns {Promise<Object>} Translation result
     */
    async translate(text, sourceLang, targetLang) {
        try {
            // Validate inputs
            this.validateInputs(text, sourceLang, targetLang);

            // Check if translation is needed
            if (sourceLang === targetLang) {
                return {
                    translatedText: text,
                    confidence: 1.0,
                    source: 'no-translation-needed'
                };
            }

            // Check for Islamic terms and preprocess
            const islamicTerms = this.islamicTerminology.findIslamicTerms(text);
            let processedText = text;
            let hasIslamicTerms = islamicTerms.length > 0;

            if (hasIslamicTerms) {
                console.log(`[TranslationEngine] Found ${islamicTerms.length} Islamic terms, preprocessing...`);
                processedText = this.islamicTerminology.replaceIslamicTerms(text, targetLang, 'religious');
            }

            // Perform translation
            const result = await this.performTranslation(processedText, sourceLang, targetLang);

            // Post-process to ensure Islamic terms are properly translated
            let finalTranslation = result.translatedText;
            if (hasIslamicTerms) {
                // Double-check that Islamic terms are correctly translated
                finalTranslation = this.postProcessIslamicTerms(finalTranslation, targetLang);
            }

            return {
                translatedText: finalTranslation,
                confidence: result.confidence || 0.9,
                source: 'openai-gpt4o',
                model: result.model || 'gpt-4o',
                processingTime: result.processingTime,
                islamicTermsProcessed: hasIslamicTerms,
                islamicTermsCount: islamicTerms.length
            };

        } catch (error) {
            console.error('[TranslationEngine] Translation failed:', error);
            console.error('[TranslationEngine] Error details:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                code: error.code,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    timeout: error.config?.timeout
                }
            });

            // Try fallback methods
            console.log('[TranslationEngine] Trying fallback translation...');
            const fallbackResult = await this.tryFallbackTranslation(text, sourceLang, targetLang, error);
            console.log('[TranslationEngine] Fallback result:', fallbackResult);

            // If fallback has translated text, return it as success
            if (fallbackResult && fallbackResult.translatedText && !fallbackResult.translatedText.includes('[Translation Error')) {
                console.log('[TranslationEngine] Fallback successful, returning clean result');
                return {
                    translatedText: fallbackResult.translatedText,
                    confidence: fallbackResult.confidence || 0.3,
                    source: fallbackResult.source || 'fallback',
                    model: fallbackResult.model || 'fallback',
                    warning: fallbackResult.warning || 'Using fallback translation - accuracy may be limited'
                };
            }

            return fallbackResult;
        }
    }

    /**
     * Post-process translation to ensure Islamic terms are correctly translated
     * @param {string} translation - Translated text
     * @param {string} targetLang - Target language
     * @returns {string} Post-processed translation
     */
    postProcessIslamicTerms(translation, targetLang) {
        try {
            // Find any remaining Islamic terms that might not have been properly translated
            const islamicTerms = this.islamicTerminology.findIslamicTerms(translation);

            if (islamicTerms.length > 0) {
                console.log(`[TranslationEngine] Post-processing ${islamicTerms.length} Islamic terms in translation`);
                return this.islamicTerminology.replaceIslamicTerms(translation, targetLang, 'religious');
            }

            return translation;
        } catch (error) {
            console.error('[TranslationEngine] Error in post-processing Islamic terms:', error);
            return translation;
        }
    }

    /**
     * Validate input parameters
     */
    validateInputs(text, sourceLang, targetLang) {
        if (!text || typeof text !== 'string') {
            throw new Error('Text must be a non-empty string');
        }

        if (text.length > 5000) {
            throw new Error('Text too long. Maximum 5000 characters allowed.');
        }

        if (!sourceLang || typeof sourceLang !== 'string') {
            throw new Error('Source language is required');
        }

        if (!targetLang || typeof targetLang !== 'string') {
            throw new Error('Target language is required');
        }

        if (sourceLang.length < 2 || sourceLang.length > 10) {
            throw new Error('Invalid source language code');
        }

        if (targetLang.length < 2 || targetLang.length > 10) {
            throw new Error('Invalid target language code');
        }
    }

    /**
     * Perform the actual translation using OpenAI GPT-4o
     */
    async performTranslation(text, sourceLang, targetLang) {
        console.log('[TranslationEngine] performTranslation called with:', { text, sourceLang, targetLang });
        console.log('[TranslationEngine] API key available:', !!this.apiKey);
        console.log('[TranslationEngine] API key preview:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'null');

        if (!this.apiKey) {
            console.warn('[TranslationEngine] No API key configured, using fallback translation');
            return this.getFallbackTranslation(text, sourceLang, targetLang);
        }

        const startTime = Date.now();
        let lastError;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Get language names for better context
                const sourceLangName = this.getLanguageName(sourceLang);
                const targetLangName = this.getLanguageName(targetLang);

                // Get context from recent translations for better accuracy
                const sessionKey = `${sourceLang}_${targetLang}`;
                const recentContext = this.contextHistory.get(sessionKey) || [];
                const contextStr = recentContext.length > 0
                    ? `\n\nRecent context (for coherence):\n${recentContext.slice(-3).map(c => `"${c}"`).join('\n')}`
                    : '';

                const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}. 
                Context: This is part of a live Islamic religious speech/sermon (Khutbah). 
                - Maintain formal, respectful tone appropriate for religious content
                - Preserve Islamic terminology and concepts accurately
                - Use proper Islamic terms (e.g., "Salah" for prayer, "Allah" for God)
                - Maintain the spiritual and reverent nature of the content
                Return only the translated text, nothing else. No explanations, no additional text, just the translation.${contextStr}

                Text to translate: "${text}"`;

                const response = await axios.post(
                    this.baseUrl,
                    {
                        model: this.model,
                        messages: [
                            {
                                role: "system",
                                content: "You are a professional Islamic translator specializing in religious content. Translate Arabic Islamic texts (sermons, Quranic recitations, Hadith) with utmost accuracy and reverence. Preserve Islamic terminology, maintain formal tone, and ensure spiritual authenticity. Return only the translated text."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        max_tokens: 1000,
                        temperature: 0.3,
                        top_p: 1,
                        frequency_penalty: 0,
                        presence_penalty: 0
                    },
                    {
                        timeout: this.timeout,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.apiKey}`,
                            'User-Agent': 'Islamic-Portal-Translator/1.0'
                        }
                    }
                );

                const processingTime = Date.now() - startTime;

                console.log('[TranslationEngine] OpenAI response received:', {
                    status: response.status,
                    hasData: !!response.data,
                    hasChoices: !!response.data?.choices,
                    choicesLength: response.data?.choices?.length || 0,
                    firstChoice: response.data?.choices?.[0] || null
                });

                if (response.data && response.data.choices && response.data.choices[0]) {
                    const translatedText = response.data.choices[0].message.content.trim();
                    console.log('[TranslationEngine] Translation successful:', translatedText);

                    // Store in context for future translations (improves coherence)
                    const sessionKey = `${sourceLang}_${targetLang}`;
                    const contextList = this.contextHistory.get(sessionKey) || [];
                    contextList.push(text);
                    if (contextList.length > 10) contextList.shift(); // Keep last 10 for memory efficiency
                    this.contextHistory.set(sessionKey, contextList);

                    return {
                        translatedText: translatedText,
                        confidence: this.calculateOpenAIConfidence(response.data),
                        processingTime,
                        model: this.model
                    };
                } else {
                    console.error('[TranslationEngine] Invalid response format:', response.data);
                    throw new Error('Invalid response format from OpenAI API');
                }

            } catch (error) {
                lastError = error;
                console.error(`[TranslationEngine] Attempt ${attempt} failed:`, error.message);
                console.error(`[TranslationEngine] Error details:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    code: error.code
                });

                // Handle rate limiting specifically
                if (error.response?.status === 429) {
                    console.warn(`[TranslationEngine] Rate limit hit on attempt ${attempt}`);

                    // Check if it's a quota exceeded error
                    const isQuotaError = error.response?.data?.error?.message?.includes('quota') ||
                                       error.response?.data?.error?.message?.includes('billing') ||
                                       error.response?.data?.error?.message?.includes('insufficient_quota');

                    if (isQuotaError) {
                        console.log('[TranslationEngine] Quota exceeded, trying fallback translation...');
                        return await this.tryFallbackTranslation(text, sourceLang, targetLang, error);
                    }

                    if (attempt < this.maxRetries) {
                        // Use exponential backoff for rate limiting
                        const backoffDelay = Math.min(this.retryDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
                        console.log(`[TranslationEngine] Waiting ${backoffDelay}ms before retry...`);
                        await this.delay(backoffDelay);
                    }
                } else if (attempt < this.maxRetries) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }

        // If we get here and it's a quota error, try fallback before throwing
        if (lastError?.response?.status === 429) {
            console.log('[TranslationEngine] 429 error detected, checking for quota...');
            console.log('[TranslationEngine] Error details:', lastError.response?.data);

            const isQuotaError = lastError.response?.data?.error?.message?.includes('quota') ||
                               lastError.response?.data?.error?.message?.includes('billing') ||
                               lastError.response?.data?.error?.message?.includes('insufficient_quota');

            console.log('[TranslationEngine] Is quota error:', isQuotaError);

            if (isQuotaError) {
                console.log('[TranslationEngine] Quota exceeded, trying fallback translation...');
                return await this.tryFallbackTranslation(text, sourceLang, targetLang, lastError);
            }
        }

        throw lastError;
    }

    /**
     * Try fallback translation methods
     */
    async tryFallbackTranslation(text, sourceLang, targetLang, originalError) {
        console.log('[TranslationEngine] Trying fallback translation methods...');

        // Fallback 1: Simple character substitution for common languages
        try {
            console.log('[TranslationEngine] Trying simple fallback for:', text, sourceLang, '->', targetLang);
            const fallbackResult = this.simpleFallbackTranslation(text, sourceLang, targetLang);
            console.log('[TranslationEngine] Simple fallback result:', fallbackResult);
            if (fallbackResult) {
                console.log('[TranslationEngine] Simple fallback successful, returning result');
                return {
                    translatedText: fallbackResult,
                    confidence: 0.3,
                    source: 'fallback-simple',
                    model: 'character-substitution',
                    warning: 'Using fallback translation - accuracy may be limited'
                };
            } else {
                console.log('[TranslationEngine] Simple fallback returned null/undefined');
            }
    } catch (error) {
            console.warn('[TranslationEngine] Simple fallback failed:', error.message);
        }

        // Fallback 2: Try to use the fallback dictionary for common phrases
        try {
            const fallbackResult = this.getFallbackTranslation(text, sourceLang, targetLang);
            if (fallbackResult && fallbackResult.translatedText && !fallbackResult.translatedText.includes('[Translation Error')) {
                console.log('[TranslationEngine] Using dictionary fallback for:', text);
                return {
                    translatedText: fallbackResult.translatedText,
                    confidence: 0.4,
                    source: 'fallback-dictionary',
                    model: 'dictionary-lookup',
                    warning: 'Using dictionary fallback - accuracy may be limited'
                };
            }
        } catch (error) {
            console.warn('[TranslationEngine] Dictionary fallback failed:', error.message);
        }

        // Fallback 3: Return original text with detailed error message
        const errorDetails = {
            message: originalError.message,
            status: originalError.response?.status,
            statusText: originalError.response?.statusText,
            apiError: originalError.response?.data?.error?.message,
            code: originalError.code
        };

        // Check if it's a quota/billing error
        const isQuotaError = errorDetails.status === 429 &&
            (errorDetails.apiError?.includes('quota') ||
             errorDetails.apiError?.includes('billing') ||
             errorDetails.apiError?.includes('insufficient_quota'));

        let errorMessage = errorDetails.apiError || errorDetails.message;
        if (isQuotaError) {
            errorMessage = 'Translation service quota exceeded. Please try again later or contact support.';
        }

        // For quota errors, try to return a basic fallback instead of error message
        if (isQuotaError) {
            console.log('[TranslationEngine] Quota error detected, trying basic fallback...');
            const basicFallback = this.simpleFallbackTranslation(text, sourceLang, targetLang);
            if (basicFallback) {
                return {
                    translatedText: basicFallback,
                    confidence: 0.3,
                    source: 'fallback-simple',
                    model: 'character-substitution',
                    warning: 'Using fallback translation - accuracy may be limited'
                };
            }
        }

        return {
            translatedText: `[Translation Error: ${errorMessage}] ${text}`,
            confidence: 0.0,
            source: 'error-fallback',
            model: 'error-handler',
            error: errorMessage,
            details: errorDetails,
            isQuotaError: isQuotaError
        };
    }

    /**
     * Get fallback translation when API is not available
     */
    getFallbackTranslation(text, sourceLang, targetLang) {
        console.log(`[TranslationEngine] Using fallback for: ${sourceLang} -> ${targetLang}`);

        // Basic fallback translations
        const fallbackTranslations = {
            'en-ar': {
                'hello': 'مرحبا',
                'world': 'عالم',
                'thank you': 'شكرا',
                'yes': 'نعم',
                'no': 'لا',
                'good': 'جيد',
                'bad': 'سيء',
                'welcome': 'أهلا وسهلا',
                'good morning': 'صباح الخير',
                'good evening': 'مساء الخير',
                'how are you': 'كيف حالك',
                'i am fine': 'أنا بخير',
                'please': 'من فضلك',
                'sorry': 'آسف',
                'excuse me': 'اعذرني'
            },
            'ar-en': {
                'مرحبا': 'hello',
                'عالم': 'world',
                'شكرا': 'thank you',
                'نعم': 'yes',
                'لا': 'no',
                'جيد': 'good',
                'سيء': 'bad',
                'أهلا وسهلا': 'welcome',
                'صباح الخير': 'good morning',
                'مساء الخير': 'good evening',
                'كيف حالك': 'how are you',
                'كيف الحال': 'how are you',
                'أنا بخير': 'i am fine',
                'من فضلك': 'please',
                'آسف': 'sorry',
                'اعذرني': 'excuse me',
                'السلام عليكم': 'peace be upon you',
                'السلام عليك': 'peace be upon you',
                'وعليكم السلام': 'and peace be upon you too',
                'وعليك السلام': 'and peace be upon you too',
                'أهلا وسهلا': 'welcome',
                'مرحبا': 'hello',
                'شكرا لك': 'thank you',
                'عفوا': 'you\'re welcome',
                'أنا': 'i',
                'أحب': 'love',
                'أنت': 'you',
                'جدا': 'very',
                'كثيرا': 'much',
                'أنا أحبك': 'i love you',
                'أنا أحبك جدا': 'i love you very much',
                'ماذا': 'what',
                'أين': 'where',
                'متى': 'when',
                'لماذا': 'why',
                'كيف': 'how',
                'الحال': 'the situation',
                'بخير': 'fine',
                'أنا بخير': 'i am fine',
                'شكرا جزيلا': 'thank you very much',
                'لا شكر على واجب': 'you\'re welcome',
                'معذرة': 'excuse me',
                'عفو': 'pardon',
                'انا احبك': 'i love you',
                'انا احبك اخي': 'i love you my brother',
                'انا احبك اختي': 'i love you my sister',
                'اخي': 'my brother',
                'اختي': 'my sister',
                'صديقي': 'my friend',
                'صديقتي': 'my friend (female)',
                'عزيزي': 'dear (male)',
                'عزيزتي': 'dear (female)',
                'حبيبي': 'my beloved (male)',
                'حبيبتي': 'my beloved (female)',
                'والدي': 'my father',
                'والدتي': 'my mother',
                'ابي': 'my father',
                'امي': 'my mother',
                'اخي الكبير': 'my older brother',
                'اختي الكبيرة': 'my older sister',
                'اخي الصغير': 'my younger brother',
                'اختي الصغيرة': 'my younger sister'
            }
        };

        // Handle auto-detect by trying both ar-en and en-ar
        let key = `${sourceLang}-${targetLang}`;
        let mappings = fallbackTranslations[key];

        // If sourceLang is 'auto', try to detect based on text content
        if (sourceLang === 'auto' && !mappings) {
            // Check if text contains Arabic characters
            const hasArabic = /[\u0600-\u06FF]/.test(text);
            if (hasArabic) {
                key = `ar-${targetLang}`;
                mappings = fallbackTranslations[key];
            } else {
                key = `en-${targetLang}`;
                mappings = fallbackTranslations[key];
            }
        }

        if (mappings) {
            const trimmedText = text.trim();
            // For Arabic text, don't use toLowerCase() as Arabic doesn't have case differences
            const isArabicText = key.startsWith('ar-');
            const searchText = isArabicText ? trimmedText : trimmedText.toLowerCase();
            if (mappings[searchText]) {
                return {
                    translatedText: mappings[searchText],
                    confidence: 0.8,
                    processingTime: 0,
                    source: 'fallback-dictionary'
                };
            }
        }

        // If no specific mapping found, return the text as-is (Islamic preprocessing may have already handled it)
    return {
            translatedText: text,
            confidence: 0.3,
            processingTime: 0,
            source: 'fallback-generic',
            warning: 'Translation service unavailable - using fallback'
        };
    }

    /**
     * Simple fallback translation using basic character substitution
     */
    simpleFallbackTranslation(text, sourceLang, targetLang) {
        // Enhanced fallback with more comprehensive mappings
        const mappings = {
            // English to Arabic
            'en-ar': {
                'peace be upon you': 'السلام عليكم',
                'peace be upon you too': 'وعليكم السلام',
                'hello': 'مرحبا',
                'welcome': 'أهلا وسهلا',
                'thank you': 'شكرا',
                'you\'re welcome': 'عفوا',
                'world': 'عالم',
                'yes': 'نعم',
                'no': 'لا',
                'good': 'جيد',
                'bad': 'سيء',
                'i': 'أنا',
                'love': 'أحب',
                'you': 'أنت',
                'very': 'جدا',
                'much': 'كثيرا',
                'i love you': 'أنا أحبك',
                'i love you very much': 'أنا أحبك جدا',
                'how are you': 'كيف حالك',
                'what': 'ماذا',
                'where': 'أين',
                'when': 'متى',
                'why': 'لماذا',
                'who': 'من',
                'how': 'كيف',
                'name': 'اسم',
                'my name is': 'اسمي',
                'nice to meet you': 'تشرفنا',
                'good morning': 'صباح الخير',
                'good evening': 'مساء الخير',
                'good night': 'تصبح على خير',
                'please': 'من فضلك',
                'excuse me': 'اعذرني',
                'sorry': 'آسف',
                'welcome': 'أهلا وسهلا',
                'see you later': 'أراك لاحقا',
                'goodbye': 'وداعا'
            },
            // Arabic to English
            'ar-en': {
                'السلام عليكم': 'Peace be upon you',
                'السلام عليك': 'Peace be upon you',
                'وعليكم السلام': 'And peace be upon you too',
                'وعليك السلام': 'And peace be upon you too',
                'أهلا وسهلا': 'Welcome',
                'مرحبا': 'Hello',
                'شكرا': 'Thank you',
                'شكرا لك': 'Thank you',
                'عفوا': 'You\'re welcome',
                'أنا': 'I',
                'أحب': 'love',
                'أنت': 'you',
                'جدا': 'very',
                'كثيرا': 'much',
                'أنا أحبك': 'I love you',
                'أنا أحبك جدا': 'I love you very much',
                'كيف حالك': 'how are you',
                'كيف الحال': 'how are you',
                'ماذا': 'what',
                'أين': 'where',
                'متى': 'when',
                'لماذا': 'why',
                'من': 'who',
                'كيف': 'how',
                'اسم': 'name',
                'اسمي': 'my name is',
                'تشرفنا': 'nice to meet you',
                'صباح الخير': 'good morning',
                'مساء الخير': 'good evening',
                'تصبح على خير': 'good night',
                'من فضلك': 'please',
                'اعذرني': 'excuse me',
                'آسف': 'sorry',
                'أهلا وسهلا': 'welcome',
                'أراك لاحقا': 'see you later',
                'وداعا': 'goodbye',
                'مرحبا': 'hello',
                'عالم': 'world',
                'شكرا': 'thank you',
                'نعم': 'yes',
                'لا': 'no',
                'جيد': 'good',
                'سيء': 'bad',
                'انا احبك': 'i love you',
                'انا احبك اخي': 'i love you my brother',
                'انا احبك اختي': 'i love you my sister',
                'اخي': 'my brother',
                'اختي': 'my sister',
                'صديقي': 'my friend',
                'صديقتي': 'my friend (female)',
                'عزيزي': 'dear (male)',
                'عزيزتي': 'dear (female)',
                'حبيبي': 'my beloved (male)',
                'حبيبتي': 'my beloved (female)',
                'والدي': 'my father',
                'والدتي': 'my mother',
                'ابي': 'my father',
                'امي': 'my mother',
                'اخي الكبير': 'my older brother',
                'اختي الكبيرة': 'my older sister',
                'اخي الصغير': 'my younger brother',
                'اختي الصغيرة': 'my younger sister'
            }
        };

        const mappingKey = `${sourceLang}-${targetLang}`;
        const languageMappings = mappings[mappingKey];

        if (languageMappings) {
            const lowerText = text.toLowerCase().trim();
            if (languageMappings[lowerText]) {
                return languageMappings[lowerText];
            }
        }

        return null;
    }

    /**
     * Get language name from language code
     */
    getLanguageName(langCode) {
        const languageNames = {
            'auto': 'auto-detect',
            'en': 'English',
            'ar': 'Arabic',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'hi': 'Hindi',
            'tr': 'Turkish',
            'fa': 'Persian',
            'ur': 'Urdu',
            'bn': 'Bengali',
            'id': 'Indonesian',
            'ms': 'Malay',
            'th': 'Thai',
            'vi': 'Vietnamese'
        };
        return languageNames[langCode] || langCode;
    }

    /**
     * Calculate confidence score based on OpenAI response
     */
    calculateOpenAIConfidence(response) {
        // Base confidence on response quality indicators
        let confidence = 0.9; // High base confidence for GPT-4o

        // Adjust based on response length and structure
        if (response.usage) {
            const promptTokens = response.usage.prompt_tokens || 0;
            const completionTokens = response.usage.completion_tokens || 0;

            // Higher confidence for more detailed responses
            if (completionTokens > 10) {
                confidence = Math.min(0.95, confidence + 0.05);
            }
        }

        return Math.round(confidence * 100) / 100;
    }

    /**
     * Calculate confidence score based on translation result
     */
    calculateConfidence(translation) {
        let confidence = 0.9; // Base confidence

        // Check for detected language confidence
        if (translation.detectedSourceLanguage) {
            const detectedConfidence = translation.detectedSourceLanguage.confidence || 0.8;
            confidence = Math.min(confidence, detectedConfidence);
        }

        // Penalize if translation is identical to original
        if (translation.translatedText === translation.originalText) {
            confidence *= 0.5;
        }

        // Penalize very short translations
        if (translation.translatedText.length < 3) {
            confidence *= 0.7;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
}

    /**
     * Delay execution for retry logic
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get supported languages
     */
    async getSupportedLanguages() {
        try {
            const response = await axios.get(`${this.baseUrl}/languages`, {
                params: { key: this.apiKey },
                timeout: this.timeout
            });

            return response.data.data.languages || [];
        } catch (error) {
            console.error('[TranslationEngine] Failed to get supported languages:', error);
            return this.getDefaultLanguages();
        }
    }

    /**
     * Get default language list when API is unavailable
     */
    getDefaultLanguages() {
        return [
            { language: 'en', name: 'English' },
            { language: 'ar', name: 'Arabic' },
            { language: 'fr', name: 'French' },
            { language: 'de', name: 'German' },
            { language: 'es', name: 'Spanish' },
            { language: 'ur', name: 'Urdu' },
            { language: 'hi', name: 'Hindi' },
            { language: 'zh', name: 'Chinese' },
            { language: 'ja', name: 'Japanese' },
            { language: 'ko', name: 'Korean' },
            { language: 'ru', name: 'Russian' },
            { language: 'it', name: 'Italian' },
            { language: 'pt', name: 'Portuguese' },
            { language: 'tr', name: 'Turkish' },
            { language: 'fa', name: 'Persian' },
            { language: 'bn', name: 'Bengali' },
            { language: 'id', name: 'Indonesian' },
            { language: 'ms', name: 'Malay' },
            { language: 'th', name: 'Thai' },
            { language: 'vi', name: 'Vietnamese' }
        ];
    }

    /**
     * Health check for translation service
     */
    async healthCheck() {
        try {
            const result = await this.translate('hello', 'en', 'ar');
        return {
                status: 'healthy',
                responseTime: result.processingTime,
                confidence: result.confidence
            };
    } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

// Create singleton instance
const translationEngine = new TranslationEngine();

// Export both the class and instance
module.exports = translationEngine;
module.exports.TranslationEngine = TranslationEngine;