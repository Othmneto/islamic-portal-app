/**
 * Audio Processing Service
 * Handles audio buffering, format conversion, and quality optimization
 */

const { Readable } = require('stream');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const audioConversionService = require('./audioConversionService');

class AudioProcessingService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // Audio chunk buffers for each session
        this.sessionBuffers = new Map();
        
        // Temporary file directory
        this.tempDir = path.join(__dirname, '..', 'temp', 'audio');
        
        // Initialize temp directory
        this.initTempDir();
        
        logger.info('✅ [AudioProcessingService] Initialized');
    }

    /**
     * Initialize temporary directory
     */
    async initTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            logger.info(`✅ [AudioProcessingService] Temp directory created: ${this.tempDir}`);
        } catch (error) {
            logger.error('[AudioProcessingService] Error creating temp directory:', error);
        }
    }

    /**
     * Buffer audio chunks for a session
     * @param {string} sessionId - Session ID
     * @param {Buffer} chunk - Audio chunk buffer
     * @param {number} chunkDuration - Duration in milliseconds
     */
    bufferAudioChunk(sessionId, chunk, chunkDuration = 3000) {
        if (!this.sessionBuffers.has(sessionId)) {
            this.sessionBuffers.set(sessionId, {
                chunks: [],
                totalSize: 0,
                startTime: Date.now(),
                chunkDuration
            });
        }
        
        const buffer = this.sessionBuffers.get(sessionId);
        buffer.chunks.push(chunk);
        buffer.totalSize += chunk.length;
        
        // Check if we have enough audio to transcribe (based on duration or size)
        const elapsed = Date.now() - buffer.startTime;
        if (elapsed >= chunkDuration || buffer.totalSize >= 64000) { // ~64KB threshold
            return this.flushBuffer(sessionId);
        }
        
        return null;
    }

    /**
     * Flush buffer and return combined audio
     */
    flushBuffer(sessionId) {
        const buffer = this.sessionBuffers.get(sessionId);
        
        if (!buffer || buffer.chunks.length === 0) {
            return null;
        }
        
        // Combine all chunks
        const combinedBuffer = Buffer.concat(buffer.chunks);
        
        // Reset buffer
        this.sessionBuffers.set(sessionId, {
            chunks: [],
            totalSize: 0,
            startTime: Date.now(),
            chunkDuration: buffer.chunkDuration
        });
        
        logger.info(`📦 [AudioProcessingService] Buffer flushed for ${sessionId}: ${combinedBuffer.length} bytes`);
        
        return combinedBuffer;
    }

    /**
     * Transcribe audio buffer using OpenAI Whisper
     * @param {Buffer} audioBuffer - Audio data buffer
     * @param {string} sourceLanguage - Source language code
     * @returns {Promise<Object>} - Transcription result
     */
    async transcribeAudio(audioBuffer, sourceLanguage = 'ar') {
        const startTime = Date.now();
        
        try {
            console.log('🎤 [AudioProcessingService] ========== STARTING TRANSCRIPTION ==========');
            console.log('Audio buffer size:', audioBuffer.length, 'bytes');
            console.log('Source language:', sourceLanguage);
            
            // Save buffer to temporary file (Whisper API requires file input)
            const tempFile = path.join(this.tempDir, `${uuidv4()}.webm`);
            await fs.writeFile(tempFile, audioBuffer);
            console.log('💾 [AudioProcessingService] Saved temp file:', tempFile);
            console.log('📊 [AudioProcessingService] File size:', (await fs.stat(tempFile)).size, 'bytes');
            
            logger.info(`🎤 [AudioProcessingService] Transcribing audio: ${audioBuffer.length} bytes (${sourceLanguage})`);
            
            // Convert WebM to WAV for Whisper compatibility
            console.log('🔄 [AudioProcessingService] Converting audio to WAV format...');
            const wavFile = await audioConversionService.convertToWAV(tempFile, {
                sampleRate: 16000,  // Whisper optimal sample rate
                channels: 1,         // Mono for speech
                bitDepth: 16        // 16-bit PCM
            });
            console.log('✅ [AudioProcessingService] Audio converted to WAV:', wavFile);
            
            // Create file stream from converted WAV
            const nodeFs = require('fs');
            const audioFile = nodeFs.createReadStream(wavFile);
            
            console.log('📖 [AudioProcessingService] Created file stream from converted WAV');
            
            // Prepare transcription options with optimization for speed and accuracy
            const transcriptionOptions = {
                file: audioFile,
                model: 'whisper-1',
                response_format: 'verbose_json',
                language: this.mapLanguageCode(sourceLanguage),
                // Add prompt for better Arabic transcription accuracy
                prompt: sourceLanguage === 'ar' ? 
                    'خطبة الجمعة، الصلاة، القرآن، الحديث' : // Friday sermon, prayer, Quran, Hadith
                    undefined,
                temperature: 0.0 // Lower temperature for more accurate, deterministic transcription
            };
            
            console.log('📤 [AudioProcessingService] Sending WAV to Whisper API...', {
                model: transcriptionOptions.model,
                language: transcriptionOptions.language,
                format: transcriptionOptions.response_format,
                fileFormat: 'WAV (16kHz, mono, 16-bit PCM)'
            });
            
            // Call Whisper API
            const transcription = await this.openai.audio.transcriptions.create(transcriptionOptions);
            
            // Clean up temp files (both WebM and WAV)
            await audioConversionService.cleanupFiles([tempFile, wavFile]);
            console.log('🗑️ [AudioProcessingService] Cleaned up temporary files');
            
            const processingTime = Date.now() - startTime;
            
            logger.info(`✅ [AudioProcessingService] Transcription completed in ${processingTime}ms: "${transcription.text}"`);
            
            return {
                text: transcription.text,
                language: transcription.language || sourceLanguage,
                duration: transcription.duration,
                confidence: this.calculateConfidence(transcription),
                processingTime,
                success: true
            };
            
        } catch (error) {
            logger.error('[AudioProcessingService] Transcription error:', error);
            
            return {
                text: '',
                error: error.message,
                processingTime: Date.now() - startTime,
                success: false
            };
        }
    }

    /**
     * Calculate transcription confidence score
     */
    calculateConfidence(transcription) {
        // Basic confidence calculation based on available metadata
        let confidence = 0.8; // Base confidence
        
        if (transcription.text && transcription.text.length > 0) {
            confidence += 0.1;
        }
        
        if (transcription.language) {
            confidence += 0.05;
        }
        
        if (transcription.duration && transcription.duration > 0.5) {
            confidence += 0.05;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Map language codes to Whisper-compatible codes
     */
    mapLanguageCode(languageCode) {
        const mapping = {
            'ar': 'ar',      // Arabic
            'en': 'en',      // English
            'es': 'es',      // Spanish
            'fr': 'fr',      // French
            'de': 'de',      // German
            'hi': 'hi',      // Hindi
            'ur': 'ur',      // Urdu
            'tr': 'tr',      // Turkish
            'id': 'id',      // Indonesian
            'bn': 'bn',      // Bengali
            'ru': 'ru',      // Russian
            'zh': 'zh',      // Chinese
            'ja': 'ja',      // Japanese
            'ko': 'ko',      // Korean
            'auto': undefined // Auto-detect
        };
        
        return mapping[languageCode] || undefined;
    }

    /**
     * Optimize audio quality
     * @param {Buffer} audioBuffer - Raw audio buffer
     * @returns {Buffer} - Optimized audio buffer
     */
    optimizeAudioQuality(audioBuffer) {
        // Basic quality optimization
        // In a production system, you might use FFmpeg for advanced processing
        
        try {
            // For now, just ensure the buffer is valid
            if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
                throw new Error('Invalid audio buffer');
            }
            
            logger.info(`✨ [AudioProcessingService] Audio optimized: ${audioBuffer.length} bytes`);
            
            return audioBuffer;
            
        } catch (error) {
            logger.error('[AudioProcessingService] Error optimizing audio:', error);
            return audioBuffer;
        }
    }

    /**
     * Convert audio format (if needed)
     * @param {Buffer} buffer - Input audio buffer
     * @param {string} fromFormat - Source format (e.g., 'webm', 'mp3')
     * @param {string} toFormat - Target format
     * @returns {Promise<Buffer>} - Converted buffer
     */
    async convertAudioFormat(buffer, fromFormat, toFormat) {
        // For MVP, we'll work directly with WebM format
        // In production, you might use FFmpeg for format conversion
        
        if (fromFormat === toFormat) {
            return buffer;
        }
        
        logger.info(`🔄 [AudioProcessingService] Converting audio from ${fromFormat} to ${toFormat}`);
        
        // Placeholder for format conversion
        // In production, integrate FFmpeg here
        
        return buffer;
    }

    /**
     * Validate audio buffer
     */
    isValidAudioBuffer(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            return false;
        }
        
        if (buffer.length < 100) { // Too small to be valid audio
            return false;
        }
        
        if (buffer.length > 10 * 1024 * 1024) { // Larger than 10MB
            return false;
        }
        
        return true;
    }

    /**
     * Get buffer statistics for a session
     */
    getBufferStats(sessionId) {
        const buffer = this.sessionBuffers.get(sessionId);
        
        if (!buffer) {
            return null;
        }
        
        return {
            chunks: buffer.chunks.length,
            totalSize: buffer.totalSize,
            elapsed: Date.now() - buffer.startTime,
            chunkDuration: buffer.chunkDuration
        };
    }

    /**
     * Clear buffer for a session
     */
    clearBuffer(sessionId) {
        this.sessionBuffers.delete(sessionId);
        logger.info(`🧹 [AudioProcessingService] Buffer cleared for ${sessionId}`);
    }

    /**
     * Clear all buffers (for cleanup)
     */
    clearAllBuffers() {
        this.sessionBuffers.clear();
        logger.info('🧹 [AudioProcessingService] All buffers cleared');
    }

    /**
     * Clean up temporary files older than 1 hour
     */
    async cleanupTempFiles() {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtimeMs > oneHour) {
                    await fs.unlink(filePath);
                    logger.info(`🧹 [AudioProcessingService] Cleaned up temp file: ${file}`);
                }
            }
        } catch (error) {
            logger.error('[AudioProcessingService] Error cleaning temp files:', error);
        }
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            activeBuffers: this.sessionBuffers.size,
            buffers: Array.from(this.sessionBuffers.entries()).map(([sessionId, buffer]) => ({
                sessionId,
                chunks: buffer.chunks.length,
                totalSize: buffer.totalSize,
                elapsed: Date.now() - buffer.startTime
            }))
        };
    }
}

// Singleton instance
let instance = null;

module.exports = {
    AudioProcessingService,
    getInstance: () => {
        if (!instance) {
            instance = new AudioProcessingService();
            
            // Start cleanup scheduler
            setInterval(() => {
                instance.cleanupTempFiles();
            }, 60 * 60 * 1000); // Every hour
        }
        return instance;
    }
};

