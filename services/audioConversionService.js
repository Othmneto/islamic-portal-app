/**
 * Audio Conversion Service
 * Production-grade audio format conversion using ffmpeg
 * Converts WebM/Opus to WAV for OpenAI Whisper compatibility
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Set ffmpeg path from the installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

class AudioConversionService {
    constructor() {
        this.supportedFormats = {
            input: ['webm', 'opus', 'ogg', 'mp3', 'm4a'],
            output: ['wav', 'mp3', 'flac']
        };
        
        this.conversionStats = {
            totalConversions: 0,
            successfulConversions: 0,
            failedConversions: 0,
            totalProcessingTime: 0
        };
        
        logger.info('✅ [AudioConversionService] Initialized with ffmpeg');
    }

    /**
     * Convert audio file to WAV format (16kHz, mono, 16-bit PCM)
     * Optimized for OpenAI Whisper API
     * 
     * @param {string} inputPath - Path to input audio file
     * @param {Object} options - Conversion options
     * @returns {Promise<string>} - Path to converted WAV file
     */
    async convertToWAV(inputPath, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log('🎵 [AudioConversionService] ========== STARTING CONVERSION ==========');
            console.log('📂 [AudioConversionService] Input file:', inputPath);
            
            // Verify input file exists
            const inputExists = await fs.access(inputPath).then(() => true).catch(() => false);
            if (!inputExists) {
                throw new Error(`Input file does not exist: ${inputPath}`);
            }
            
            const inputStats = await fs.stat(inputPath);
            console.log('📊 [AudioConversionService] Input file size:', inputStats.size, 'bytes');
            
            // Generate output path
            const outputPath = inputPath.replace(path.extname(inputPath), '.wav');
            console.log('📂 [AudioConversionService] Output file:', outputPath);
            
            // Conversion options optimized for Whisper
            const conversionOptions = {
                sampleRate: options.sampleRate || 16000,  // Whisper prefers 16kHz
                channels: options.channels || 1,           // Mono for speech
                bitDepth: options.bitDepth || 16,         // 16-bit PCM
                codec: 'pcm_s16le',                       // PCM signed 16-bit little-endian
                ...options
            };
            
            console.log('⚙️ [AudioConversionService] Conversion options:', conversionOptions);
            
            // Perform conversion
            await this.executeConversion(inputPath, outputPath, conversionOptions);
            
            // Verify output file
            const outputStats = await fs.stat(outputPath);
            console.log('✅ [AudioConversionService] Output file size:', outputStats.size, 'bytes');
            console.log('📉 [AudioConversionService] Compression ratio:', 
                ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(2) + '%');
            
            // Update stats
            const processingTime = Date.now() - startTime;
            this.conversionStats.totalConversions++;
            this.conversionStats.successfulConversions++;
            this.conversionStats.totalProcessingTime += processingTime;
            
            console.log('⏱️ [AudioConversionService] Conversion completed in', processingTime, 'ms');
            logger.info(`✅ [AudioConversionService] Converted ${path.basename(inputPath)} to WAV in ${processingTime}ms`);
            
            return outputPath;
            
        } catch (error) {
            this.conversionStats.failedConversions++;
            
            console.error('❌ [AudioConversionService] Conversion failed:', error.message);
            logger.error('[AudioConversionService] Conversion error:', error);
            
            throw new Error(`Audio conversion failed: ${error.message}`);
        }
    }

    /**
     * Execute ffmpeg conversion with detailed logging
     * 
     * @param {string} inputPath - Input file path
     * @param {string} outputPath - Output file path
     * @param {Object} options - Conversion options
     * @returns {Promise<void>}
     */
    executeConversion(inputPath, outputPath, options) {
        return new Promise((resolve, reject) => {
            console.log('🔧 [AudioConversionService] Starting ffmpeg process...');
            
            const command = ffmpeg(inputPath)
                .audioFrequency(options.sampleRate)
                .audioChannels(options.channels)
                .audioCodec(options.codec)
                .audioBitrate(options.bitrate || '128k')
                .format('wav')
                .on('start', (commandLine) => {
                    console.log('▶️ [AudioConversionService] FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`⏳ [AudioConversionService] Progress: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('codecData', (data) => {
                    console.log('📊 [AudioConversionService] Input codec:', {
                        format: data.format,
                        audio: data.audio,
                        duration: data.duration
                    });
                })
                .on('end', () => {
                    console.log('✅ [AudioConversionService] FFmpeg process completed');
                    resolve();
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('❌ [AudioConversionService] FFmpeg error:', err.message);
                    console.error('❌ [AudioConversionService] FFmpeg stderr:', stderr);
                    reject(new Error(`FFmpeg conversion failed: ${err.message}`));
                });
            
            // Save to output path
            command.save(outputPath);
        });
    }

    /**
     * Get audio file metadata
     * 
     * @param {string} filePath - Path to audio file
     * @returns {Promise<Object>} - Audio metadata
     */
    async getAudioMetadata(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(new Error(`Failed to get audio metadata: ${err.message}`));
                } else {
                    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                    resolve({
                        format: metadata.format.format_name,
                        duration: parseFloat(metadata.format.duration),
                        size: parseInt(metadata.format.size),
                        bitrate: parseInt(metadata.format.bit_rate),
                        sampleRate: audioStream ? parseInt(audioStream.sample_rate) : null,
                        channels: audioStream ? audioStream.channels : null,
                        codec: audioStream ? audioStream.codec_name : null
                    });
                }
            });
        });
    }

    /**
     * Validate audio file format
     * 
     * @param {string} filePath - Path to audio file
     * @returns {Promise<boolean>} - True if valid
     */
    async validateAudioFile(filePath) {
        try {
            const metadata = await this.getAudioMetadata(filePath);
            console.log('🔍 [AudioConversionService] Audio metadata:', metadata);
            
            // Check if audio stream exists
            if (!metadata.codec) {
                throw new Error('No audio stream found in file');
            }
            
            // Check duration
            if (metadata.duration <= 0 || metadata.duration > 600) { // Max 10 minutes
                throw new Error(`Invalid audio duration: ${metadata.duration}s (max: 600s)`);
            }
            
            // Check file size
            if (metadata.size <= 0 || metadata.size > 25 * 1024 * 1024) { // Max 25MB
                throw new Error(`Invalid file size: ${metadata.size} bytes (max: 25MB)`);
            }
            
            return true;
            
        } catch (error) {
            logger.error('[AudioConversionService] Validation failed:', error);
            return false;
        }
    }

    /**
     * Clean up temporary audio files
     * 
     * @param {string[]} filePaths - Array of file paths to delete
     * @returns {Promise<void>}
     */
    async cleanupFiles(filePaths) {
        const deletionPromises = filePaths.map(async (filePath) => {
            try {
                await fs.unlink(filePath);
                console.log('🗑️ [AudioConversionService] Deleted temp file:', path.basename(filePath));
            } catch (error) {
                console.warn('⚠️ [AudioConversionService] Failed to delete file:', filePath, error.message);
            }
        });
        
        await Promise.all(deletionPromises);
    }

    /**
     * Get conversion statistics
     * 
     * @returns {Object} - Conversion stats
     */
    getStats() {
        const avgProcessingTime = this.conversionStats.totalConversions > 0
            ? (this.conversionStats.totalProcessingTime / this.conversionStats.totalConversions).toFixed(2)
            : 0;
        
        return {
            ...this.conversionStats,
            averageProcessingTime: parseFloat(avgProcessingTime),
            successRate: this.conversionStats.totalConversions > 0
                ? ((this.conversionStats.successfulConversions / this.conversionStats.totalConversions) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset conversion statistics
     */
    resetStats() {
        this.conversionStats = {
            totalConversions: 0,
            successfulConversions: 0,
            failedConversions: 0,
            totalProcessingTime: 0
        };
        logger.info('📊 [AudioConversionService] Statistics reset');
    }
}

// Singleton instance
let instance = null;

/**
 * Get AudioConversionService instance
 * @returns {AudioConversionService}
 */
function getInstance() {
    if (!instance) {
        instance = new AudioConversionService();
    }
    return instance;
}

module.exports = getInstance();
module.exports.AudioConversionService = AudioConversionService;


