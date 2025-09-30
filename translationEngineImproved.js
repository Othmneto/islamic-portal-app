// translationEngineImproved.js - Enhanced AI-Powered Translation Engine
// Handles translation, transcription, context analysis, and text-to-speech with improved error handling

require('dotenv').config();
const { OpenAI } = require('openai');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const { getTranslationCache } = require('./services/translationCache');

// --- Initialize ALL Clients ---
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout
    maxRetries: 2
});
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVEN_API_KEY });

const pinecone = new Pinecone({ 
    apiKey: process.env.PINECONE_API_KEY
});
const pineconeIndex = pinecone.index('shaikh-translator');

// --- Error Handling Utilities ---
class TranslationError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = 'TranslationError';
    }
}

class ValidationError extends TranslationError {
    constructor(message) {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

// --- Helper Functions ---
function getFallbackTranslation(text, fromLanguage, to) {
    console.log(`Using fallback translation for: "${text}" from ${fromLanguage} to ${to}`);
    
    // Simple fallback translations for common Islamic phrases
    const fallbackTranslations = {
        'assalam walekum': 'Peace be upon you',
        'assalamu alaikum': 'Peace be upon you',
        'rahmatullah': 'Mercy of Allah',
        'barkat': 'Blessings',
        'blessings': 'بركات',
        'peace be upon you': 'السلام عليكم'
    };
    
    const lowerText = text.toLowerCase().trim();
    
    // Check for exact matches
    if (fallbackTranslations[lowerText]) {
        return fallbackTranslations[lowerText];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(fallbackTranslations)) {
        if (lowerText.includes(key)) {
            return text.replace(new RegExp(key, 'gi'), value);
        }
    }
    
    // If no fallback found, return original text with note
    return `[Translation unavailable] ${text}`;
}

async function streamToBuffer(webStream) {
    try {
        const reader = webStream.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        return Buffer.concat(chunks);
    } catch (error) {
        console.error('Error converting stream to buffer:', error);
        throw new TranslationError('Failed to process audio data');
    }
}

// --- Enhanced Islamic Context Analysis ---
function analyzeIslamicContext(text) {
    const islamicKeywords = [
        'allah', 'god', 'prayer', 'pray', 'mosque', 'islam', 'muslim', 'quran', 'koran',
        'hadith', 'sunnah', 'prophet', 'muhammad', 'peace', 'blessing', 'blessed',
        'ramadan', 'hajj', 'umrah', 'zakat', 'charity', 'fasting', 'fast', 'salah',
        'dua', 'supplication', 'dhikr', 'remembrance', 'tasbih', 'subhanallah',
        'alhamdulillah', 'allahu akbar', 'bismillah', 'inshallah', 'mashallah',
        'barakallahu', 'jazakallahu', 'fi amanillah', 'assalamu alaikum',
        'wa alaikum assalam', 'jazak allah', 'barak allah', 'fi aman allah'
    ];

    const arabicIslamicTerms = [
        'الله', 'الرحمن', 'الرحيم', 'بسم الله', 'الحمد لله', 'سبحان الله',
        'الله أكبر', 'لا إله إلا الله', 'محمد رسول الله', 'الصلاة', 'الزكاة',
        'الصوم', 'الحج', 'القرآن', 'الحديث', 'السنة', 'الدعاء', 'الذكر',
        'التسبيح', 'الاستغفار', 'التوبة', 'الرحمة', 'المغفرة', 'الهداية'
    ];

    const textLower = text.toLowerCase();
    const hasEnglishIslamicTerms = islamicKeywords.some(term => textLower.includes(term));
    const hasArabicIslamicTerms = arabicIslamicTerms.some(term => text.includes(term));
    
    return {
        hasIslamicContent: hasEnglishIslamicTerms || hasArabicIslamicTerms,
        englishTerms: islamicKeywords.filter(term => textLower.includes(term)),
        arabicTerms: arabicIslamicTerms.filter(term => text.includes(term)),
        confidence: hasEnglishIslamicTerms && hasArabicIslamicTerms ? 0.9 : 0.7
    };
}

// --- Input Validation ---
function validateTranslationInput(text, from, toLanguages, voiceId, sessionId) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new ValidationError('Text is required and must be a non-empty string');
    }
    
    if (text.length > 10000) {
        throw new ValidationError('Text is too long. Maximum 10,000 characters allowed');
    }
    
    if (!toLanguages || !Array.isArray(toLanguages) || toLanguages.length === 0) {
        throw new ValidationError('Target languages must be a non-empty array');
    }
    
    if (!voiceId || typeof voiceId !== 'string') {
        throw new ValidationError('Valid voice ID is required');
    }
    
    // Allow 'text-only' as a special case for text-only translation
    if (voiceId === 'text-only') {
        // Skip voice-related validation for text-only translation
        return;
    }
    
    if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('Valid session ID is required');
    }
}

// --- Retry Logic for API Calls ---
async function retryApiCall(apiCall, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            console.error(`API call attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                break;
            }
            
            // Exponential backoff
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new TranslationError(`API call failed after ${maxRetries} attempts: ${lastError.message}`);
}

// --- Enhanced Translation Function ---
async function translateText(text, from, toLanguages, voiceId, sessionId) {
    try {
        // Input validation
        validateTranslationInput(text, from, toLanguages, voiceId, sessionId);
        
        console.log(`Translating text: "${text.substring(0, 50)}..." from ${from} to ${toLanguages.join(', ')}`);
        
        // Enhanced Islamic context analysis
        const islamicContext = analyzeIslamicContext(text);
        console.log('Islamic context analysis:', islamicContext);
        
        // Get conversation memory
        const context = await getRelevantContext(text, sessionId);
        const fromLanguage = from === 'auto' ? 'the detected language' : from;
        const translationResults = [];
        
        for (const to of toLanguages) {
            try {
                // Check cache first
                const cache = getTranslationCache();
                const cached = await cache.getTranslation(text, fromLanguage, to, sessionId);
                
                if (cached) {
                    console.log(`[Cache] Using cached translation for ${to}`);
                    translationResults.push({
                        translatedText: cached.translatedText,
                        audioBuffer: null, // Audio not cached
                        toLanguage: to,
                        context,
                        islamicContext,
                        confidence: cached.confidence || 0.9,
                        model: cached.model || 'gpt-5',
                        source: 'cache'
                    });
                } else {
                    // Perform translation
                    const result = await translateToLanguage(text, fromLanguage, to, context, islamicContext, voiceId);
                    translationResults.push(result);
                    
                    // Cache the result
                    await cache.setTranslation(text, fromLanguage, to, {
                        translatedText: result.translatedText,
                        confidence: result.confidence,
                        model: result.model,
                        timestamp: new Date().toISOString()
                    }, sessionId);
                }
            } catch (error) {
                console.error(`Translation failed for ${to}:`, error.message);
                
                // Add error result but don't fail the entire request
                translationResults.push({
                    translatedText: `[Translation error for ${to}]`,
                    audioBuffer: null,
                    toLanguage: to,
                    context,
                    islamicContext,
                    confidence: 0,
                    model: 'gpt-5',
                    error: error.message
                });
            }
        }
        
        console.log('Translation completed for', translationResults.length, 'languages');
        return translationResults;
        
    } catch (error) {
        console.error('Translation error:', error);
        
        if (error instanceof ValidationError) {
            throw error;
        }
        
        // Return user-friendly error without exposing internal details
        throw new TranslationError('Translation service temporarily unavailable. Please try again later.');
    }
}

// --- Individual Language Translation ---
async function translateToLanguage(text, fromLanguage, to, context, islamicContext, voiceId) {
    let prompt;
    if (context) {
        prompt = `Given the following conversation history as context:\n---\n${context}\n---\n\nTranslate the following text from ${fromLanguage} to ${to}. Provide a direct, accurate translation: "${text}"`;
    } else {
        prompt = `Translate the following text from ${fromLanguage} to ${to}. Provide a direct, accurate translation: "${text}"`;
    }

    // Add Islamic context if detected
    if (islamicContext.hasIslamicContent) {
        prompt += `\n\nNote: This text contains Islamic terminology. Please ensure accurate translation of Islamic terms and maintain the respectful, spiritual tone appropriate for Islamic content.`;
    }

    // Retry logic for OpenAI API with timeout
    let translatedText;
    try {
        translatedText = await Promise.race([
            retryApiCall(async () => {
                const completion = await openai.chat.completions.create({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    messages: [
                        { 
                            role: 'system', 
                            content: 'You are a professional translator. Provide accurate, direct translations without filtering or censoring content. Translate exactly what is given to you.' 
                        },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 1000
                });
                
                let result = completion.choices[0].message.content.replace(/"/g, '').trim();
                
                // Fallback if translation is empty
                if (!result || result === '') {
                    console.log('Empty translation, trying simpler prompt...');
                    const simplePrompt = `Translate "${text}" to ${to}`;
                    const simpleCompletion = await openai.chat.completions.create({
                        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'You are a translator. Translate the text exactly as requested.' },
                            { role: 'user', content: simplePrompt }
                        ],
                        max_tokens: 1000
                    });
                    result = simpleCompletion.choices[0].message.content.replace(/"/g, '').trim();
                }
                
                if (!result || result === '') {
                    result = `[Translation from ${fromLanguage}]: ${text}`;
                }
                
                return result;
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Translation timeout')), 25000)
            )
        ]);
    } catch (error) {
        console.error('OpenAI API failed, using fallback translation:', error.message);
        // Fallback translation using simple word mapping
        translatedText = getFallbackTranslation(text, fromLanguage, to);
    }
    
    // Generate audio with error handling
    let audioBuffer = null;
    try {
        // Skip audio generation for text-only mode
        if (voiceId === 'text-only') {
            console.log(`🎵 Skipping audio generation for text-only mode`);
        } else {
            console.log(`🎵 Generating audio for ${to} with voice ${voiceId}`);
            const audioResult = await elevenlabs.textToSpeech.convert(voiceId, { 
                text: translatedText, 
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                    style: 0.0,
                    use_speaker_boost: true
                }
            });
            audioBuffer = await streamToBuffer(audioResult);
            console.log(`✅ Audio generated successfully for ${to} (${audioBuffer.length} bytes)`);
        }
    } catch (audioError) {
        console.error(`❌ Audio generation failed for ${to}:`, audioError.message);
        console.error('Audio error details:', {
            voiceId,
            textLength: translatedText.length,
            errorType: audioError.constructor.name,
            statusCode: audioError.status || 'unknown'
        });
        // Don't throw here, translation can still succeed without audio
    }
    
    const confidence = calculateTranslationConfidence(text, translatedText, to);
    
    return { 
        translatedText, 
        audioBuffer, 
        toLanguage: to, 
        context,
        islamicContext,
        confidence,
        model: 'gpt-5'
    };
}

// --- Memory Management Functions ---
async function getRelevantContext(text, sessionId) {
    try {
        if (!sessionId) return null;
        
        const queryResponse = await pineconeIndex.query({
            vector: await generateEmbedding(text),
            topK: 5,
            includeMetadata: true,
            filter: { sessionId: { $eq: sessionId } }
        });
        
        if (queryResponse.matches && queryResponse.matches.length > 0) {
            return queryResponse.matches
                .map(match => match.metadata?.text || '')
                .join(' ');
        }
        
        return null;
    } catch (error) {
        console.error('Error retrieving context:', error);
        return null;
    }
}

async function generateEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw new TranslationError('Failed to generate text embedding');
    }
}

async function storeInMemory(text, translatedText, sessionId, islamicContext) {
    try {
        const embedding = await generateEmbedding(text);
        const id = `translation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await pineconeIndex.upsert([{
            id,
            values: embedding,
            metadata: {
                text: text,
                translatedText: translatedText,
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                islamicContext: islamicContext
            }
        }]);
        
        console.log('Stored translation in memory:', id);
    } catch (error) {
        console.error('Error storing in memory:', error);
        // Don't throw here, translation can still succeed
    }
}

function calculateTranslationConfidence(originalText, translatedText, targetLanguage) {
    // Simple confidence calculation based on text length and language match
    const lengthRatio = translatedText.length / originalText.length;
    const baseConfidence = 0.8;
    
    // Adjust confidence based on length ratio
    let confidence = baseConfidence;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
        confidence -= 0.2;
    }
    
    // Adjust for language-specific factors
    if (targetLanguage === 'ar' && /[\u0600-\u06FF]/.test(translatedText)) {
        confidence += 0.1; // Bonus for Arabic script
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
}

// --- Audio Transcription Function ---
async function transcribeAudioFile(filePath, from, toLanguages, voiceId, sessionId) {
    try {
        console.log('Transcribing audio file:', filePath);
        
        if (!fs.existsSync(filePath)) {
            throw new ValidationError('Audio file not found');
        }
        
        const transcriptionOptions = {
            file: fs.createReadStream(filePath),
            model: "whisper-1",
            response_format: "verbose_json",
        };
        
        if (from && from !== 'auto') {
            const langMap = { 
                'English': 'en', 'Arabic': 'ar', 'French': 'fr', 'German': 'de', 
                'Urdu': 'ur', 'Spanish': 'es', 'Hindi': 'hi', 'Russian': 'ru', 
                'Japanese': 'ja', 'Chinese': 'zh' 
            };
            if (langMap[from]) {
                transcriptionOptions.language = langMap[from];
            }
        }
        
        const transcription = await retryApiCall(async () => {
            return await openai.audio.transcriptions.create(transcriptionOptions);
        });
        
        const transcribedText = transcription.text;
        console.log('Transcription result:', transcribedText);
        
        if (!transcribedText || transcribedText.trim().length === 0) {
            throw new TranslationError('No speech detected in audio file');
        }
        
        // Translate the transcribed text
        const translationResults = await translateText(transcribedText, from, toLanguages, voiceId, sessionId);
        
        return {
            transcription: transcribedText,
            translations: translationResults,
            confidence: transcription.language_confidence || 0.8
        };
        
    } catch (error) {
        console.error('Audio transcription error:', error);
        
        if (error instanceof ValidationError) {
            throw error;
        }
        
        throw new TranslationError('Audio transcription failed. Please try again.');
    }
}

// --- Export Functions ---
module.exports = {
    translateText,
    transcribeAudioFile,
    analyzeIslamicContext,
    TranslationError,
    ValidationError
};
