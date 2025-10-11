/**
 * Dual Output Generator
 * Generates both text and voice output simultaneously for live translation
 */

const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const logger = require('../utils/logger');

class DualOutputGenerator {
    constructor() {
        // Initialize ElevenLabs only if API key is available
        // Check both ELEVENLABS_API_KEY and ELEVEN_API_KEY for compatibility
        const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
        this.elevenLabs = null;
        
        if (apiKey && apiKey !== 'your-elevenlabs-api-key') {
            try {
                this.elevenLabs = new ElevenLabsClient({
                    apiKey: apiKey
                });
                logger.info('✅ [DualOutputGenerator] ElevenLabs initialized with API key');
            } catch (error) {
                logger.warn('⚠️ [DualOutputGenerator] ElevenLabs initialization failed:', error.message);
            }
        } else {
            logger.warn('⚠️ [DualOutputGenerator] ElevenLabs API key not configured - voice output will be disabled');
        }
        
        // Voice IDs mapped to languages (you can customize these)
        this.voiceMap = {
            'en': 'EXAVITQu4vr4xnSDxMaL', // Rachel (English)
            'ar': 'pNInz6obpgDQGcFmaJgB', // Adam (Arabic)
            'es': '21m00Tcm4TlvDq8ikWAM', // Antoni (Spanish)
            'fr': 'ThT5KcBeYPX3keUQqHPh', // Arnold (French)
            'de': 'VR6AewLTigWG4xSOukaG', // Domi (German)
            'hi': 'yoZ06aMxZJJ28mfd3POQ', // Bella (Hindi)
            'ur': 'SOYHLrjzK2X1ezoPC6cr', // Harry (Urdu)
            'tr': 'IKne3meq5aSn9XLyUdCD', // Thomas (Turkish)
            'id': 'onwK4e9ZLuTAKqWW03F9', // Freya (Indonesian)
            'bn': 'TxGEqnHWrfWFTfGW9XjX', // Charlie (Bengali)
            'default': 'EXAVITQu4vr4xnSDxMaL' // Default to English voice
        };
        
        // Cache for frequently used audio
        this.audioCache = new Map();
        this.maxCacheSize = 100;
        
        logger.info('✅ [DualOutputGenerator] Initialized');
    }

    /**
     * Generate both text and voice output simultaneously
     * @param {string} text - Text to convert
     * @param {string} targetLanguage - Target language code
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - { text, audioBuffer, audioUrl, timestamp, language }
     */
    async generate(text, targetLanguage, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log('🎯 [DualOutputGenerator] ========== GENERATING DUAL OUTPUT ==========');
            console.log('Text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            console.log('Target Language:', targetLanguage);
            console.log('Options:', options);
            logger.info(`🎯 [DualOutputGenerator] Generating dual output for: ${text.substring(0, 50)}... (${targetLanguage})`);
            
            // 1. Format text output
            const textOutput = this.formatTextOutput(text, targetLanguage, options);
            
            // 2. Generate voice output (parallel with text formatting)
            const audioResult = await this.generateVoiceOutput(text, targetLanguage, options);
            
            const processingTime = Date.now() - startTime;
            logger.info(`✅ [DualOutputGenerator] Dual output generated in ${processingTime}ms`);
            
            return {
                text: textOutput,
                audio: audioResult.audioBuffer,
                audioBase64: audioResult.audioBase64,
                timestamp: Date.now(),
                language: targetLanguage,
                processingTime,
                success: true
            };
            
        } catch (error) {
            logger.error('[DualOutputGenerator] Error generating dual output:', error);
            
            // Return fallback with text only
            return {
                text: this.formatTextOutput(text, targetLanguage, options),
                audio: null,
                audioBase64: null,
                timestamp: Date.now(),
                language: targetLanguage,
                processingTime: Date.now() - startTime,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Format text output with proper styling
     */
    formatTextOutput(text, language, options = {}) {
        const formatted = {
            text: text.trim(),
            language,
            timestamp: new Date().toISOString(),
            length: text.length,
            wordCount: text.split(/\s+/).length
        };
        
        // Add formatting metadata
        if (options.showTimestamps) {
            formatted.displayTime = new Date().toLocaleTimeString();
        }
        
        if (options.highlight) {
            formatted.isHighlighted = true;
        }
        
        return formatted;
    }

    /**
     * Generate voice output using ElevenLabs TTS
     */
    async generateVoiceOutput(text, language, options = {}) {
        try {
            // Check if ElevenLabs is available
            if (!this.elevenLabs) {
                logger.warn('⚠️ [DualOutputGenerator] ElevenLabs not available - returning text-only');
                return {
                    audioBuffer: null,
                    audioBase64: null,
                    voiceId: null,
                    size: 0,
                    textOnly: true
                };
            }
            
            // Check cache first
            const cacheKey = `${language}:${text}`;
            if (this.audioCache.has(cacheKey)) {
                logger.info('💾 [DualOutputGenerator] Using cached audio');
                return this.audioCache.get(cacheKey);
            }
            
            // Select voice based on language
            const voiceId = this.voiceMap[language] || this.voiceMap['default'];
            
            // Generate audio using ElevenLabs
            logger.info(`🎤 [DualOutputGenerator] Generating audio with voice: ${voiceId}`);
            
            const audioStream = await this.elevenLabs.textToSpeech.convert(voiceId, {
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: options.stability || 0.5,
                    similarity_boost: options.similarity_boost || 0.75,
                    style: options.style || 0.0,
                    use_speaker_boost: options.use_speaker_boost !== false
                }
            });
            
            // Convert stream to buffer
            const audioBuffer = await this.streamToBuffer(audioStream);
            
            // Convert to base64 for easy transmission
            const audioBase64 = audioBuffer.toString('base64');
            
            const result = {
                audioBuffer,
                audioBase64,
                voiceId,
                size: audioBuffer.length
            };
            
            // Cache the result
            this.cacheAudio(cacheKey, result);
            
            logger.info(`✅ [DualOutputGenerator] Audio generated: ${audioBuffer.length} bytes`);
            
            return result;
            
        } catch (error) {
            logger.error('[DualOutputGenerator] Error generating voice:', error);
            throw error;
        }
    }

    /**
     * Generate audio for multiple languages simultaneously
     */
    async generateMultiLanguage(text, languages, options = {}) {
        try {
            logger.info(`🌍 [DualOutputGenerator] Generating audio for ${languages.length} languages`);
            
            const promises = languages.map(lang => 
                this.generate(text, lang, options).catch(error => ({
                    language: lang,
                    error: error.message,
                    success: false
                }))
            );
            
            const results = await Promise.all(promises);
            
            return results;
            
        } catch (error) {
            logger.error('[DualOutputGenerator] Error in multi-language generation:', error);
            throw error;
        }
    }

    /**
     * Stream to buffer conversion
     */
    async streamToBuffer(stream) {
        const chunks = [];
        
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        
        return Buffer.concat(chunks);
    }

    /**
     * Cache audio with size limit
     */
    cacheAudio(key, value) {
        // If cache is full, remove oldest entry
        if (this.audioCache.size >= this.maxCacheSize) {
            const firstKey = this.audioCache.keys().next().value;
            this.audioCache.delete(firstKey);
        }
        
        this.audioCache.set(key, value);
    }

    /**
     * Clear audio cache
     */
    clearCache() {
        this.audioCache.clear();
        logger.info('🧹 [DualOutputGenerator] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.audioCache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
        };
    }

    /**
     * Set custom voice for a language
     */
    setVoiceForLanguage(language, voiceId) {
        this.voiceMap[language] = voiceId;
        logger.info(`✅ [DualOutputGenerator] Voice set for ${language}: ${voiceId}`);
    }

    /**
     * Get available voices (for configuration)
     */
    getAvailableVoices() {
        return Object.entries(this.voiceMap).map(([lang, voiceId]) => ({
            language: lang,
            voiceId
        }));
    }
}

// Singleton instance
let instance = null;

module.exports = {
    DualOutputGenerator,
    getInstance: () => {
        if (!instance) {
            instance = new DualOutputGenerator();
        }
        return instance;
    }
};

