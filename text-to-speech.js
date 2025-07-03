// text-to-speech.js (Corrected for Pinecone Initialization)

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

// --- Main Translation & Transcription Functions ---
async function translateText(text, from, toLanguages, voiceId, sessionId) {
    const context = await getRelevantContext(text, sessionId);
    const fromLanguage = from === 'auto' ? 'the detected language' : from;
    const translationResults = [];

    for (const to of toLanguages) {
        let prompt;
        if (context) {
            prompt = `Given the following conversation history as context:\n---\n${context}\n---\n\nTranslate the following new sentence from ${fromLanguage} to ${to} in a wise, respectful tone: "${text}"`;
        } else {
            prompt = `Translate from ${fromLanguage} to ${to} in a wise, respectful tone: "${text}"`;
        }
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'You are a wise Shaikh translator who uses conversation history to provide accurate and context-aware translations.' },
                { role: 'user', content: prompt }
            ]
        });
        const translatedText = completion.choices[0].message.content.replace(/"/g, '');
        const audioResult = await elevenlabs.textToSpeech.convert(voiceId, { text: translatedText, model_id: "eleven_multilingual_v2" });
        const audioBuffer = await streamToBuffer(audioResult);
        translationResults.push({ translatedText, audioBuffer, toLanguage: to, context });
    }
    return translationResults;
}

async function transcribeAudioFile(filePath, from, toLanguages, voiceId, sessionId) {
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
    const originalText = transcription.text;
    const detectedLang = transcription.language;
    const translationResults = await translateText(originalText, detectedLang, toLanguages, voiceId, sessionId);
    return { originalText, detectedLang, translationResults };
}

module.exports = { 
    translateText, 
    transcribeAudioFile, 
    saveToMemory, 
    deleteFromMemory,
	pineconeIndex 
};