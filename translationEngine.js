// translationEngine.js - AI-Powered Translation Engine
// Handles translation, transcription, context analysis, and text-to-speech

require('dotenv').config();
const { OpenAI } = require('openai');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');

// --- Initialize ALL Clients ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVEN_API_KEY });

// <<< FIX: The 'environment' property has been removed as it's not a valid key for your library version >>>
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});
const pineconeIndex = pinecone.index('shaikh-translator');

// --- Helper Functions ---
async function streamToBuffer(webStream) {
    const reader = webStream.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return Buffer.concat(chunks);
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
    const foundKeywords = islamicKeywords.filter(keyword =>
        textLower.includes(keyword.toLowerCase())
    );

    const foundArabicTerms = arabicIslamicTerms.filter(term =>
        text.includes(term)
    );

    const islamicScore = (foundKeywords.length + foundArabicTerms.length) / Math.max(text.split(' ').length, 1);

    return {
        hasIslamicContent: foundKeywords.length > 0 || foundArabicTerms.length > 0,
        islamicKeywords: foundKeywords,
        arabicTerms: foundArabicTerms,
        islamicScore: islamicScore,
        contextLevel: islamicScore > 0.3 ? 'high' : islamicScore > 0.1 ? 'medium' : 'low'
    };
}

// --- Translation Confidence Calculator ---
function calculateTranslationConfidence(originalText, translatedText, targetLanguage) {
    // Basic confidence calculation based on text length and complexity
    const originalLength = originalText.length;
    const translatedLength = translatedText.length;

    // Length ratio should be reasonable (not too short or too long)
    const lengthRatio = translatedLength / originalLength;
    const lengthConfidence = lengthRatio > 0.3 && lengthRatio < 3 ? 1 : 0.5;

    // Text complexity (more complex = lower confidence)
    const complexity = originalText.split(' ').length;
    const complexityConfidence = complexity > 20 ? 0.8 : complexity > 10 ? 0.9 : 1;

    // Language-specific confidence adjustments
    const languageConfidence = getLanguageConfidence(targetLanguage);

    // Overall confidence (0-1 scale)
    const overallConfidence = (lengthConfidence + complexityConfidence + languageConfidence) / 3;

    return Math.min(Math.max(overallConfidence, 0.1), 1.0);
}

function getLanguageConfidence(targetLanguage) {
    // Confidence based on language complexity and common translation quality
    const languageConfidenceMap = {
        'Arabic': 0.95,
        'English': 0.98,
        'Urdu': 0.90,
        'French': 0.92,
        'German': 0.88,
        'Spanish': 0.90,
        'Hindi': 0.85,
        'Russian': 0.87,
        'Japanese': 0.80,
        'Chinese': 0.82
    };

    return languageConfidenceMap[targetLanguage] || 0.85;
}

// --- Memory Functions (Updated for Sessions) ---
async function getRelevantContext(text, sessionId, topK = 2) {
    if (!sessionId) return ""; // No context without a session
    try {
        const namespace = pineconeIndex.namespace(sessionId);
        const embeddingResponse = await openai.embeddings.create({ model: "text-embedding-ada-002", input: text });
        const vector = embeddingResponse.data[0].embedding;
        const queryResponse = await namespace.query({ topK, vector, includeMetadata: true });

        if (queryResponse.matches.length > 0) {
            return queryResponse.matches.map(match => match.metadata.text || "").join('\n');
        }
        return "";
    } catch (error) {
        if (error.message.includes('not found')) {
            return ""; // Namespace doesn't exist yet, which is normal.
        }
        console.error("Error fetching context from Pinecone:", error);
        return "";
    }
}

async function saveToMemory(id, text, sessionId) {
    if (!sessionId) return;
    try {
        const namespace = pineconeIndex.namespace(sessionId);
        const embeddingResponse = await openai.embeddings.create({ model: "text-embedding-ada-002", input: text });
        const vector = embeddingResponse.data[0].embedding;
        await namespace.upsert([{ id: id, values: vector, metadata: { text: text } }]);
    } catch (error) {
        console.error("Error saving to Pinecone:", error);
    }
}

async function deleteFromMemory(id, sessionId) {
    if (!sessionId || !id) return;
    try {
        const namespace = pineconeIndex.namespace(sessionId);
        await namespace.deleteOne(id);
    } catch (error) {
        console.error(`Error deleting vector from Pinecone:`, error);
    }
}

// --- Enhanced Translation & Transcription Functions with GPT-5 ---
async function translateText(text, from, toLanguages, voiceId, sessionId) {
    console.log('Translating text:', text.substring(0, 50) + '...');

    const context = await getRelevantContext(text, sessionId);
    const fromLanguage = from === 'auto' ? 'the detected language' : from;
    const translationResults = [];

    // Enhanced Islamic context analysis
    const islamicContext = analyzeIslamicContext(text);

    for (const to of toLanguages) {
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

        const completion = await openai.chat.completions.create({
            model: 'gpt-5', // Updated to GPT-5
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional translator. Provide accurate, direct translations without filtering or censoring content. Translate exactly what is given to you.'
                },
                { role: 'user', content: prompt }
            ],
            max_completion_tokens: 1000
        });

        let translatedText = completion.choices[0].message.content.replace(/"/g, '').trim();
        console.log('Translation result:', translatedText);

        // If translation is empty, try a simpler approach
        if (!translatedText || translatedText === '') {
            console.log('Empty translation, trying simpler prompt...');
            const simplePrompt = `Translate "${text}" to ${to}`;
            const simpleCompletion = await openai.chat.completions.create({
                model: 'gpt-5',
                messages: [
                    { role: 'system', content: 'You are a translator. Translate the text exactly as requested.' },
                    { role: 'user', content: simplePrompt }
                ],
                max_completion_tokens: 1000
            });
            const simpleTranslation = simpleCompletion.choices[0].message.content.replace(/"/g, '').trim();
            console.log('Simple translation result:', simpleTranslation);

            if (simpleTranslation && simpleTranslation !== '') {
                translatedText = simpleTranslation;
            } else {
                // Final fallback - return a basic translation or the original text
                console.log('All translation attempts failed, using fallback');
                if (to === 'en') {
                    translatedText = `[Translation from ${fromLanguage}]: ${text}`;
                } else {
                    translatedText = text; // Return original if target is same as source
                }
            }
        }

        const audioResult = await elevenlabs.textToSpeech.convert(voiceId, { text: translatedText, model_id: "eleven_multilingual_v2" });
        const audioBuffer = await streamToBuffer(audioResult);

        const confidence = calculateTranslationConfidence(text, translatedText, to);

        const result = {
            translatedText,
            audioBuffer,
            toLanguage: to,
            context,
            islamicContext,
            confidence,
            model: 'gpt-5'
        };

        translationResults.push(result);
    }

    console.log('Translation completed for', translationResults.length, 'languages');
    return translationResults;
}

async function transcribeAudioFile(filePath, from, toLanguages, voiceId, sessionId) {
    console.log('Transcribing audio file:', filePath);

    const transcriptionOptions = {
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "verbose_json",
    };
    if (from && from !== 'auto') {
        const langMap = { 'English': 'en', 'Arabic': 'ar', 'French': 'fr', 'German': 'de', 'Urdu': 'ur', 'Spanish': 'es', 'Hindi': 'hi', 'Russian': 'ru', 'Japanese': 'ja', 'Chinese': 'zh' };
        if (langMap[from]) {
            transcriptionOptions.language = langMap[from];
        }
    }

    const transcription = await openai.audio.transcriptions.create(transcriptionOptions);
    console.log('Transcribed text:', transcription.text);

    const originalText = transcription.text;
    const detectedLang = transcription.language;

    // Enhanced transcription with confidence and Islamic context
    const islamicContext = analyzeIslamicContext(originalText);
    const transcriptionConfidence = calculateTranscriptionConfidence(transcription);

    const translationResults = await translateText(originalText, detectedLang, toLanguages, voiceId, sessionId);

    const result = {
        originalText,
        detectedLang,
        translationResults,
        islamicContext,
        transcriptionConfidence,
        model: 'whisper-1'
    };

    console.log('Audio transcription and translation completed');
    return result;
}

// --- Enhanced Transcription Confidence Calculator ---
function calculateTranscriptionConfidence(transcription) {
    // Basic confidence based on transcription quality indicators
    const text = transcription.text;
    const duration = transcription.duration || 1; // fallback to 1 second

    // Length confidence (reasonable text length for duration)
    const wordsPerSecond = text.split(' ').length / duration;
    const lengthConfidence = wordsPerSecond > 0.5 && wordsPerSecond < 5 ? 1 : 0.7;

    // Language detection confidence
    const languageConfidence = transcription.language_probability || 0.8;

    // Text quality (no excessive repetition or gibberish)
    const uniqueWords = new Set(text.toLowerCase().split(' ')).size;
    const totalWords = text.split(' ').length;
    const qualityConfidence = totalWords > 0 ? uniqueWords / totalWords : 0.5;

    // Overall confidence
    const overallConfidence = (lengthConfidence + languageConfidence + qualityConfidence) / 3;

    return Math.min(Math.max(overallConfidence, 0.1), 1.0);
}

module.exports = {
    translateText,
    transcribeAudioFile,
    saveToMemory,
    deleteFromMemory,
	pineconeIndex
};