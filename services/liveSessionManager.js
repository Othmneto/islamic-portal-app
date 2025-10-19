/**
 * Live Session Manager
 * Manages live translation sessions, worshippers, and session state
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const LiveTranslationSession = require('../models/LiveTranslationSession');
const logger = require('../utils/logger');

class LiveSessionManager {
    constructor() {
        // In-memory cache for active sessions (for fast access)
        this.activeSessions = new Map();
        this.socketToSession = new Map(); // Map socket IDs to session IDs

        // Initialize cleanup scheduler
        this.startCleanupScheduler();

        logger.info('✅ [LiveSessionManager] Initialized');
    }

    /**
     * Generate a unique session ID
     * Format: ABC-123-XYZ (easy to read and type)
     */
    generateSessionId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars
        const segments = [3, 3, 3]; // 3-3-3 format

        let sessionId = segments.map(len => {
            let segment = '';
            for (let i = 0; i < len; i++) {
                segment += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return segment;
        }).join('-');

        return sessionId;
    }

    /**
     * Create a new live translation session
     */
    async createSession(imamId, imamName, config = {}) {
        try {
            console.log('📝 [LiveSessionManager] Creating session for Imam:', imamName);
            const sessionId = this.generateSessionId();
            console.log('🆔 [LiveSessionManager] Generated Session ID:', sessionId);

            // Hash password if provided
            let passwordHash = null;
            if (config.password) {
                passwordHash = await bcrypt.hash(config.password, 10);
            }

            const sessionData = {
                sessionId,
                imamId,
                imamName,
                sourceLanguage: config.sourceLanguage || 'ar',
                sourceLanguageName: config.sourceLanguageName || 'Arabic',
                title: config.title || 'Live Translation Session',
                description: config.description || '',
                isPasswordProtected: !!config.password,
                passwordHash,
                status: 'created',
                worshippers: [],
                translations: [],
                settings: {
                    maxWorshippers: config.maxWorshippers || 100,
                    allowRecording: config.allowRecording || false,
                    autoTranscribe: config.autoTranscribe !== false,
                    showOriginalText: config.showOriginalText !== false,
                    audioQuality: config.audioQuality || 'high',
                    chunkDuration: config.chunkDuration || 3000
                },
                analytics: {
                    totalDuration: 0,
                    totalTranslations: 0,
                    averageLatency: 0,
                    averageConfidence: 0,
                    peakWorshippersCount: 0,
                    totalWorshippersJoined: 0,
                    languagesUsed: [],
                    audioQuality: 'good'
                },
                qualityMetrics: {
                    transcriptionErrors: 0,
                    translationErrors: 0,
                    audioGenerationErrors: 0,
                    reconnections: 0,
                    averageChunkSize: 0
                }
            };

            const session = new LiveTranslationSession(sessionData);
            await session.save();

            // Cache in memory
            this.activeSessions.set(sessionId, {
                session,
                imamSocketId: null,
                lastActivity: Date.now()
            });

            logger.info(`✅ [LiveSessionManager] Session created: ${sessionId} by Imam ${imamName}`);

            return {
                success: true,
                sessionId,
                session: this.sanitizeSession(session)
            };

        } catch (error) {
            logger.error('[LiveSessionManager] Error creating session:', error);
            throw error;
        }
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        try {
            // Check cache first
            if (this.activeSessions.has(sessionId)) {
                const cached = this.activeSessions.get(sessionId);
                return cached.session;
            }

            // Load from database
            const session = await LiveTranslationSession.findBySessionId(sessionId);

            if (session && ['created', 'active', 'paused'].includes(session.status)) {
                // Cache it
                this.activeSessions.set(sessionId, {
                    session,
                    imamSocketId: null,
                    lastActivity: Date.now()
                });
            }

            return session;

        } catch (error) {
            logger.error('[LiveSessionManager] Error getting session:', error);
            throw error;
        }
    }

    /**
     * Verify session password (if protected)
     */
    async verifySessionPassword(sessionId, password) {
        try {
            const session = await this.getSession(sessionId);

            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            if (!session.isPasswordProtected) {
                return { success: true };
            }

            if (!password) {
                return { success: false, error: 'Password required' };
            }

            const isValid = await bcrypt.compare(password, session.passwordHash);

            return { success: isValid, error: isValid ? null : 'Invalid password' };

        } catch (error) {
            logger.error('[LiveSessionManager] Error verifying password:', error);
            return { success: false, error: 'Verification failed' };
        }
    }

    /**
     * Set Imam's socket ID for a session
     */
    setImamSocket(sessionId, socketId) {
        const cached = this.activeSessions.get(sessionId);
        if (cached) {
            cached.imamSocketId = socketId;
            cached.lastActivity = Date.now();
            this.socketToSession.set(socketId, sessionId);
            logger.info(`🔌 [LiveSessionManager] Imam socket connected: ${sessionId}`);
        }
    }

    /**
     * Add worshipper to session
     */
    async addWorshipper(sessionId, worshipperData) {
        try {
            const session = await this.getSession(sessionId);

            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            if (session.status === 'ended') {
                return { success: false, error: 'Session has ended' };
            }

            // Check if session is full
            const activeCount = session.worshippers.filter(w => w.isActive).length;
            if (activeCount >= session.settings.maxWorshippers) {
                return { success: false, error: 'Session is full' };
            }

            // Add worshipper
            await session.addWorshipper(worshipperData);

            // Update cache
            const cached = this.activeSessions.get(sessionId);
            if (cached) {
                cached.session = session;
                cached.lastActivity = Date.now();
            }

            // Map socket to session
            this.socketToSession.set(worshipperData.socketId, sessionId);

            logger.info(`👤 [LiveSessionManager] Worshipper joined ${sessionId}: ${worshipperData.userName} (${worshipperData.targetLanguage})`);

            return {
                success: true,
                session: this.sanitizeSession(session),
                worshipperCount: session.worshippers.filter(w => w.isActive).length
            };

        } catch (error) {
            logger.error('[LiveSessionManager] Error adding worshipper:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove worshipper from session
     */
    async removeWorshipper(sessionId, userId, socketId) {
        try {
            const session = await this.getSession(sessionId);

            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            await session.removeWorshipper(userId);

            // Update cache
            const cached = this.activeSessions.get(sessionId);
            if (cached) {
                cached.session = session;
                cached.lastActivity = Date.now();
            }

            // Remove socket mapping
            if (socketId) {
                this.socketToSession.delete(socketId);
            }

            logger.info(`👋 [LiveSessionManager] Worshipper left ${sessionId}: ${userId}`);

            return {
                success: true,
                worshipperCount: session.worshippers.filter(w => w.isActive).length
            };

        } catch (error) {
            logger.error('[LiveSessionManager] Error removing worshipper:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update session status
     */
    async updateSessionStatus(sessionId, status) {
        try {
            const session = await this.getSession(sessionId);

            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            await session.updateStatus(status);

            // Update cache
            const cached = this.activeSessions.get(sessionId);
            if (cached) {
                cached.session = session;
                cached.lastActivity = Date.now();
            }

            // If session ended, clean up
            if (status === 'ended') {
                this.cleanupSession(sessionId);
            }

            logger.info(`📊 [LiveSessionManager] Session ${sessionId} status: ${status}`);

            return { success: true, status };

        } catch (error) {
            logger.error('[LiveSessionManager] Error updating status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add translation to session
     */
    async addTranslation(sessionId, translationData) {
        try {
            const session = await this.getSession(sessionId);

            if (!session) {
                logger.warn(`[LiveSessionManager] Session not found for translation: ${sessionId}`);
                return { success: false, error: 'Session not found' };
            }

            await session.addTranslation(translationData);

            // Update cache
            const cached = this.activeSessions.get(sessionId);
            if (cached) {
                cached.session = session;
                cached.lastActivity = Date.now();
            }

            return { success: true };

        } catch (error) {
            logger.error('[LiveSessionManager] Error adding translation:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get session by socket ID
     */
    getSessionBySocket(socketId) {
        return this.socketToSession.get(socketId);
    }

    /**
     * Get active worshippers for a session
     */
    getActiveWorshippers(sessionId) {
        const cached = this.activeSessions.get(sessionId);
        if (!cached) return [];

        return cached.session.worshippers.filter(w => w.isActive);
    }

    /**
     * Get Imam socket ID for a session
     */
    getImamSocket(sessionId) {
        const cached = this.activeSessions.get(sessionId);
        return cached ? cached.imamSocketId : null;
    }

    /**
     * Increment error count
     */
    async incrementError(sessionId, errorType) {
        try {
            const session = await this.getSession(sessionId);
            if (session) {
                await session.incrementError(errorType);
            }
        } catch (error) {
            logger.error('[LiveSessionManager] Error incrementing error count:', error);
        }
    }

    /**
     * Get sessions by Imam ID
     */
    async getSessionsByImam(imamId, includeEnded = false) {
        try {
            if (includeEnded) {
                return await LiveTranslationSession.find({ imamId })
                    .sort({ createdAt: -1 })
                    .limit(50);
            } else {
                return await LiveTranslationSession.findActiveByImam(imamId);
            }
        } catch (error) {
            logger.error('[LiveSessionManager] Error getting sessions by Imam:', error);
            return [];
        }
    }

    /**
     * Get sessions by Worshipper ID
     */
    async getSessionsByWorshipper(userId) {
        try {
            return await LiveTranslationSession.findActiveByWorshipper(userId);
        } catch (error) {
            logger.error('[LiveSessionManager] Error getting sessions by Worshipper:', error);
            return [];
        }
    }

    /**
     * Clean up session from memory
     */
    cleanupSession(sessionId) {
        const cached = this.activeSessions.get(sessionId);

        if (cached) {
            // Remove all socket mappings
            if (cached.imamSocketId) {
                this.socketToSession.delete(cached.imamSocketId);
            }

            cached.session.worshippers.forEach(w => {
                if (w.socketId) {
                    this.socketToSession.delete(w.socketId);
                }
            });

            this.activeSessions.delete(sessionId);
            logger.info(`🧹 [LiveSessionManager] Session cleaned up: ${sessionId}`);
        }
    }

    /**
     * Start automatic cleanup scheduler
     */
    startCleanupScheduler() {
        // Clean up inactive sessions every hour
        setInterval(async () => {
            try {
                logger.info('🧹 [LiveSessionManager] Running scheduled cleanup...');

                // Clean up database sessions inactive for 24 hours
                const result = await LiveTranslationSession.cleanupInactiveSessions(24);

                if (result.modifiedCount > 0) {
                    logger.info(`🧹 [LiveSessionManager] Cleaned up ${result.modifiedCount} inactive sessions`);
                }

                // Clean up memory cache - sessions inactive for 1 hour
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                for (const [sessionId, cached] of this.activeSessions.entries()) {
                    if (cached.lastActivity < oneHourAgo) {
                        this.cleanupSession(sessionId);
                    }
                }

            } catch (error) {
                logger.error('[LiveSessionManager] Error in cleanup scheduler:', error);
            }
        }, 60 * 60 * 1000); // Every hour

        logger.info('✅ [LiveSessionManager] Cleanup scheduler started');
    }

    /**
     * Sanitize session data for client
     */
    sanitizeSession(session) {
        if (!session) return null;

        const sanitized = session.toObject();

        // Remove sensitive data
        delete sanitized.passwordHash;

        // Remove inactive worshippers for client
        sanitized.worshippers = sanitized.worshippers.filter(w => w.isActive);

        // Limit translation history for performance
        if (sanitized.translations && sanitized.translations.length > 100) {
            sanitized.translations = sanitized.translations.slice(-100);
        }

        return sanitized;
    }

    /**
     * Get active sessions count (for monitoring)
     */
    getActiveSessionsCount() {
        return this.activeSessions.size;
    }

    /**
     * Get total active worshippers count (for monitoring)
     */
    getTotalWorshippersCount() {
        let total = 0;
        for (const cached of this.activeSessions.values()) {
            total += cached.session.worshippers.filter(w => w.isActive).length;
        }
        return total;
    }

    /**
     * Get statistics for monitoring
     */
    getStatistics() {
        const stats = {
            activeSessions: this.activeSessions.size,
            totalWorshippers: this.getTotalWorshippersCount(),
            sessions: []
        };

        for (const [sessionId, cached] of this.activeSessions.entries()) {
            stats.sessions.push({
                sessionId,
                status: cached.session.status,
                worshippers: cached.session.worshippers.filter(w => w.isActive).length,
                translations: cached.session.translations.length,
                duration: cached.session.duration
            });
        }

        return stats;
    }
}

// Singleton instance
let instance = null;

module.exports = {
    LiveSessionManager,
    getInstance: () => {
        if (!instance) {
            instance = new LiveSessionManager();
        }
        return instance;
    }
};

