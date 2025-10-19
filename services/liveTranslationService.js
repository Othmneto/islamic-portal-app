/**
 * Live Translation Service
 * Orchestrates the complete live translation pipeline:
 * Audio → Transcription → Translation → Dual Output (Text + Voice)
 */

const { getInstance: getSessionManager } = require('./liveSessionManager');
const { getInstance: getAudioProcessor } = require('./audioProcessingService');
const { getInstance: getDualOutput } = require('./dualOutputGenerator');
const translationEngine = require('../translationEngineImproved');
const logger = require('../utils/logger');

class LiveTranslationService {
    constructor() {
        this.sessionManager = getSessionManager();
        this.audioProcessor = getAudioProcessor();
        this.dualOutputGenerator = getDualOutput();

        // Performance metrics
        this.metrics = {
            totalTranslations: 0,
            totalErrors: 0,
            averageLatency: 0,
            latencies: []
        };

        logger.info('✅ [LiveTranslationService] Initialized');
    }

    /**
     * Process audio chunk from Imam
     * Complete pipeline: Audio → Transcription → Translation → Broadcast
     *
     * @param {string} sessionId - Session ID
     * @param {Buffer} audioChunk - Audio data chunk
     * @param {Object} io - Socket.IO instance for broadcasting
     */
    async processAudioChunk(sessionId, audioChunk, io) {
        const startTime = Date.now();

        try {
            console.log('📥 [LiveTranslationService] ========== STARTING AUDIO PROCESSING ==========');
            console.log('📥 [LiveTranslationService] Session ID:', sessionId);
            console.log('📥 [LiveTranslationService] Audio chunk size:', audioChunk.length, 'bytes');
            logger.info(`📥 [LiveTranslationService] Processing audio chunk for session: ${sessionId}`);

            // Step 1: Get session details
            const session = await this.sessionManager.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            if (session.status !== 'active') {
                throw new Error(`Session is ${session.status}, not active`);
            }

            // Step 2: Process audio immediately (removed buffering for faster response)
            // Direct processing improves latency from 3-6s to 1.5-3s
            const bufferedAudio = audioChunk;

            // Step 3: Transcribe audio to text
            console.log('🎤 [LiveTranslationService] Step 1/4: Transcribing audio...');
            console.log('🎤 [LiveTranslationService] Source language:', session.sourceLanguage);
            logger.info('🎤 [LiveTranslationService] Step 1/4: Transcribing audio...');
            const transcription = await this.audioProcessor.transcribeAudio(
                bufferedAudio,
                session.sourceLanguage
            );
            console.log('✅ [LiveTranslationService] Transcription result:', transcription);

            if (!transcription.success || !transcription.text) {
                await this.sessionManager.incrementError(sessionId, 'transcriptionErrors');
                throw new Error('Transcription failed: ' + (transcription.error || 'No text returned'));
            }

            const originalText = transcription.text;
            logger.info(`✅ [LiveTranslationService] Transcription: "${originalText}"`);

            // Step 4: Get unique target languages from active worshippers
            const activeWorshippers = this.sessionManager.getActiveWorshippers(sessionId);
            const uniqueLanguages = [...new Set(activeWorshippers.map(w => w.targetLanguage))];

            console.log('👥 [LiveTranslationService] Active worshippers:', activeWorshippers.length);
            console.log('🌍 [LiveTranslationService] Unique target languages:', uniqueLanguages);
            logger.info(`🌍 [LiveTranslationService] Step 2/4: Translating to ${uniqueLanguages.length} languages...`);

            // Step 5: Translate to all target languages
            const translations = await Promise.all(
                uniqueLanguages.map(async (targetLang) => {
                    try {
                        // Skip if source and target are the same
                        if (targetLang === session.sourceLanguage) {
                            return {
                                language: targetLang,
                                text: originalText,
                                skipped: true
                            };
                        }

                        // Translate text
                        const result = await translationEngine.translate(
                            originalText,
                            session.sourceLanguage,
                            targetLang
                        );

                        return {
                            language: targetLang,
                            text: result.translatedText,
                            confidence: result.confidence,
                            success: true
                        };

                    } catch (error) {
                        logger.error(`[LiveTranslationService] Translation error for ${targetLang}:`, error);
                        await this.sessionManager.incrementError(sessionId, 'translationErrors');

                        return {
                            language: targetLang,
                            text: originalText, // Fallback to original
                            error: error.message,
                            success: false
                        };
                    }
                })
            );

            logger.info('✅ [LiveTranslationService] Translations completed');

            // Step 6: Generate dual output (text + voice) for each language
            logger.info('🎤 [LiveTranslationService] Step 3/4: Generating voice output...');

            const dualOutputs = await Promise.all(
                translations.map(async (translation) => {
                    try {
                        const output = await this.dualOutputGenerator.generate(
                            translation.text,
                            translation.language,
                            {
                                stability: 0.5,
                                similarity_boost: 0.75
                            }
                        );

                        return {
                            language: translation.language,
                            ...output,
                            translationConfidence: translation.confidence
                        };

                    } catch (error) {
                        logger.error(`[LiveTranslationService] Voice generation error for ${translation.language}:`, error);
                        await this.sessionManager.incrementError(sessionId, 'audioGenerationErrors');

                        // Fallback: text only
                        return {
                            language: translation.language,
                            text: this.dualOutputGenerator.formatTextOutput(translation.text, translation.language),
                            audio: null,
                            audioBase64: null,
                            error: error.message,
                            success: false
                        };
                    }
                })
            );

            logger.info('✅ [LiveTranslationService] Dual outputs generated');

            // Step 7: Save translation to session history
            const translationData = {
                originalText,
                translations: new Map(
                    dualOutputs.map(output => [
                        output.language,
                        {
                            text: output.text,
                            audioUrl: null, // Would be S3 URL in production
                            generatedAt: new Date()
                        }
                    ])
                ),
                timestamp: new Date(),
                processingTime: Date.now() - startTime,
                confidence: transcription.confidence
            };

            await this.sessionManager.addTranslation(sessionId, translationData);

            // Step 8: Broadcast to worshippers
            console.log('📡 [LiveTranslationService] Step 4/4: Broadcasting to worshippers...');
            console.log('📡 [LiveTranslationService] Broadcasting to', activeWorshippers.length, 'worshippers');
            logger.info('📡 [LiveTranslationService] Step 4/4: Broadcasting to worshippers...');

            const broadcastData = {
                sessionId,
                original: {
                    text: originalText,
                    language: session.sourceLanguage,
                    languageName: session.sourceLanguageName
                },
                translations: dualOutputs,
                timestamp: Date.now(),
                transcriptionConfidence: transcription.confidence,
                totalProcessingTime: Date.now() - startTime
            };

            // Broadcast to all worshippers in the session
            io.to(sessionId).emit('translation', broadcastData);

            // Also send individual messages to each worshipper with only their language
            activeWorshippers.forEach(worshipper => {
                const worshipperOutput = dualOutputs.find(o => o.language === worshipper.targetLanguage);
                if (worshipperOutput) {
                    io.to(worshipper.socketId).emit('personalTranslation', {
                        sessionId,
                        original: broadcastData.original,
                        translation: worshipperOutput,
                        timestamp: broadcastData.timestamp
                    });
                }
            });

            const totalTime = Date.now() - startTime;
            this.updateMetrics(totalTime);

            logger.info(`✅ [LiveTranslationService] Complete pipeline finished in ${totalTime}ms`);

            return {
                success: true,
                originalText,
                translationsCount: translations.length,
                processingTime: totalTime,
                broadcastedTo: activeWorshippers.length
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            this.metrics.totalErrors += 1;

            logger.error('[LiveTranslationService] Pipeline error:', error);

            // Notify Imam of error
            const imamSocket = this.sessionManager.getImamSocket(sessionId);
            if (imamSocket && io) {
                io.to(imamSocket).emit('processingError', {
                    sessionId,
                    error: error.message,
                    timestamp: Date.now()
                });
            }

            return {
                success: false,
                error: error.message,
                processingTime: totalTime
            };
        }
    }

    /**
     * Handle text-based translation (for testing or backup)
     */
    async processTextTranslation(sessionId, text, io) {
        const startTime = Date.now();

        try {
            const session = await this.sessionManager.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            const activeWorshippers = this.sessionManager.getActiveWorshippers(sessionId);
            const uniqueLanguages = [...new Set(activeWorshippers.map(w => w.targetLanguage))];

            // Translate and generate outputs
            const translations = await Promise.all(
                uniqueLanguages.map(async (targetLang) => {
                    if (targetLang === session.sourceLanguage) {
                        return { language: targetLang, text, skipped: true };
                    }

                    const result = await translationEngine.translate(text, session.sourceLanguage, targetLang);
                    return { language: targetLang, text: result.translatedText, success: true };
                })
            );

            const dualOutputs = await Promise.all(
                translations.map(t => this.dualOutputGenerator.generate(t.text, t.language))
            );

            // Broadcast
            const broadcastData = {
                sessionId,
                original: { text, language: session.sourceLanguage },
                translations: dualOutputs,
                timestamp: Date.now()
            };

            io.to(sessionId).emit('translation', broadcastData);

            const totalTime = Date.now() - startTime;
            this.updateMetrics(totalTime);

            return { success: true, processingTime: totalTime };

        } catch (error) {
            logger.error('[LiveTranslationService] Text translation error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update performance metrics
     */
    updateMetrics(latency) {
        this.metrics.totalTranslations += 1;
        this.metrics.latencies.push(latency);

        // Keep only last 100 latencies
        if (this.metrics.latencies.length > 100) {
            this.metrics.latencies.shift();
        }

        // Calculate average
        const sum = this.metrics.latencies.reduce((a, b) => a + b, 0);
        this.metrics.averageLatency = Math.round(sum / this.metrics.latencies.length);
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            audioProcessorStats: this.audioProcessor.getStatistics(),
            sessionManagerStats: this.sessionManager.getStatistics(),
            cacheStats: this.dualOutputGenerator.getCacheStats()
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            totalTranslations: this.metrics.totalTranslations,
            totalErrors: this.metrics.totalErrors,
            averageLatency: this.metrics.averageLatency,
            successRate: this.metrics.totalTranslations > 0
                ? ((this.metrics.totalTranslations - this.metrics.totalErrors) / this.metrics.totalTranslations * 100).toFixed(2)
                : 0
        };
    }
}

// Singleton instance
let instance = null;

module.exports = {
    LiveTranslationService,
    getInstance: () => {
        if (!instance) {
            instance = new LiveTranslationService();
        }
        return instance;
    }
};

