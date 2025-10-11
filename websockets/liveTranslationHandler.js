/**
 * Live Translation WebSocket Handler
 * Handles real-time communication between Imam and Worshippers
 */

const { getInstance: getSessionManager } = require('../services/liveSessionManager');
const { getInstance: getLiveTranslationService } = require('../services/liveTranslationService');
const logger = require('../utils/logger');

class LiveTranslationHandler {
    constructor(io) {
        this.io = io;
        this.sessionManager = getSessionManager();
        this.liveTranslationService = getLiveTranslationService();
        
        logger.info('✅ [LiveTranslationHandler] Initialized');
    }

    /**
     * Setup all event handlers
     */
    setupHandlers(socket) {
        // Imam events
        socket.on('imam:createSession', (data) => this.handleCreateSession(socket, data));
        socket.on('imam:startBroadcast', (data) => this.handleStartBroadcast(socket, data));
        socket.on('imam:audioChunk', (data) => this.handleAudioChunk(socket, data));
        socket.on('imam:stopBroadcast', (data) => this.handleStopBroadcast(socket, data));
        socket.on('imam:pauseBroadcast', (data) => this.handlePauseBroadcast(socket, data));
        socket.on('imam:resumeBroadcast', (data) => this.handleResumeBroadcast(socket, data));
        socket.on('imam:endSession', (data) => this.handleEndSession(socket, data));
        socket.on('imam:textMessage', (data) => this.handleTextMessage(socket, data));
        
        // Worshipper events
        socket.on('worshipper:joinSession', (data) => this.handleJoinSession(socket, data));
        socket.on('worshipper:leaveSession', (data) => this.handleLeaveSession(socket, data));
        socket.on('worshipper:changeLanguage', (data) => this.handleChangeLanguage(socket, data));
        socket.on('worshipper:connectionQuality', (data) => this.handleConnectionQuality(socket, data));
        
        // General events
        socket.on('ping', (data) => this.handlePing(socket, data));
        socket.on('disconnect', () => this.handleDisconnect(socket));
        
        logger.info(`🔌 [LiveTranslationHandler] Event handlers setup for socket: ${socket.id}`);
    }

    /**
     * Imam creates a new session
     */
    async handleCreateSession(socket, data) {
        try {
            console.log('========================================');
            console.log('👤 [LiveTranslationHandler] CREATE SESSION REQUEST');
            console.log('User ID:', socket.userId);
            console.log('User Email:', socket.userEmail);
            console.log('Data:', data);
            console.log('========================================');
            logger.info(`👤 [LiveTranslationHandler] Create session request from: ${socket.userId}`);
            
            const { sourceLanguage, sourceLanguageName, title, description, password, settings } = data;
            
            const result = await this.sessionManager.createSession(
                socket.userId,
                socket.userEmail || 'Imam',
                {
                    sourceLanguage: sourceLanguage || 'ar',
                    sourceLanguageName: sourceLanguageName || 'Arabic',
                    title: title || 'Live Translation Session',
                    description: description || '',
                    password: password || null,
                    ...settings
                }
            );
            
            if (result.success) {
                // Join the session room
                socket.join(result.sessionId);
                
                // Set as Imam socket
                this.sessionManager.setImamSocket(result.sessionId, socket.id);
                
                logger.info(`✅ [LiveTranslationHandler] Session created: ${result.sessionId}`);
                
                socket.emit('imam:sessionCreated', {
                    success: true,
                    sessionId: result.sessionId,
                    session: result.session,
                    timestamp: Date.now()
                });
            } else {
                socket.emit('imam:sessionCreated', {
                    success: false,
                    error: 'Failed to create session',
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Create session error:', error);
            socket.emit('imam:sessionCreated', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Imam starts broadcasting
     */
    async handleStartBroadcast(socket, data) {
        try {
            const { sessionId } = data;
            
            logger.info(`🎤 [LiveTranslationHandler] Start broadcast: ${sessionId}`);
            
            const result = await this.sessionManager.updateSessionStatus(sessionId, 'active');
            
            if (result.success) {
                // Notify all worshippers
                this.io.to(sessionId).emit('session:statusChanged', {
                    sessionId,
                    status: 'active',
                    message: 'Broadcast started',
                    timestamp: Date.now()
                });
                
                socket.emit('imam:broadcastStarted', {
                    success: true,
                    sessionId,
                    timestamp: Date.now()
                });
            } else {
                socket.emit('imam:broadcastStarted', {
                    success: false,
                    error: result.error,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Start broadcast error:', error);
            socket.emit('imam:broadcastStarted', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Imam sends audio chunk
     */
    async handleAudioChunk(socket, data) {
        try {
            const { sessionId, audioData, format } = data;
            
            console.log('🎵 [LiveTranslationHandler] ========== AUDIO CHUNK RECEIVED ==========');
            console.log('Session ID:', sessionId);
            console.log('Format:', format);
            console.log('Audio data type:', typeof audioData);
            
            // Convert base64 to buffer if needed
            const audioBuffer = Buffer.isBuffer(audioData) 
                ? audioData 
                : Buffer.from(audioData, 'base64');
            
            console.log('🎵 [LiveTranslationHandler] Audio buffer size:', audioBuffer.length, 'bytes');
            logger.info(`🎵 [LiveTranslationHandler] Audio chunk received: ${audioBuffer.length} bytes`);
            
            // Process through the live translation service
            const result = await this.liveTranslationService.processAudioChunk(
                sessionId,
                audioBuffer,
                this.io
            );
            
            if (result.success && !result.buffering) {
                // Acknowledge to Imam
                socket.emit('imam:audioProcessed', {
                    success: true,
                    sessionId,
                    processingTime: result.processingTime,
                    broadcastedTo: result.broadcastedTo,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Audio chunk error:', error);
            socket.emit('imam:audioProcessed', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Imam stops broadcasting
     */
    async handleStopBroadcast(socket, data) {
        try {
            const { sessionId } = data;
            
            logger.info(`⏹️ [LiveTranslationHandler] Stop broadcast: ${sessionId}`);
            
            const result = await this.sessionManager.updateSessionStatus(sessionId, 'paused');
            
            if (result.success) {
                this.io.to(sessionId).emit('session:statusChanged', {
                    sessionId,
                    status: 'paused',
                    message: 'Broadcast stopped',
                    timestamp: Date.now()
                });
                
                socket.emit('imam:broadcastStopped', {
                    success: true,
                    sessionId,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Stop broadcast error:', error);
            socket.emit('imam:broadcastStopped', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Imam pauses broadcasting
     */
    async handlePauseBroadcast(socket, data) {
        await this.handleStopBroadcast(socket, data);
    }

    /**
     * Imam resumes broadcasting
     */
    async handleResumeBroadcast(socket, data) {
        await this.handleStartBroadcast(socket, data);
    }

    /**
     * Imam ends session completely
     */
    async handleEndSession(socket, data) {
        try {
            const { sessionId } = data;
            
            logger.info(`🏁 [LiveTranslationHandler] End session: ${sessionId}`);
            
            const result = await this.sessionManager.updateSessionStatus(sessionId, 'ended');
            
            if (result.success) {
                // Notify all worshippers
                this.io.to(sessionId).emit('session:ended', {
                    sessionId,
                    message: 'Session has ended',
                    timestamp: Date.now()
                });
                
                socket.emit('imam:sessionEnded', {
                    success: true,
                    sessionId,
                    timestamp: Date.now()
                });
                
                // Clean up all connections
                this.io.in(sessionId).socketsLeave(sessionId);
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] End session error:', error);
            socket.emit('imam:sessionEnded', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Imam sends text message (backup/testing)
     */
    async handleTextMessage(socket, data) {
        try {
            const { sessionId, text } = data;
            
            logger.info(`💬 [LiveTranslationHandler] Text message: ${sessionId}`);
            
            const result = await this.liveTranslationService.processTextTranslation(
                sessionId,
                text,
                this.io
            );
            
            socket.emit('imam:textProcessed', {
                success: result.success,
                processingTime: result.processingTime,
                timestamp: Date.now()
            });
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Text message error:', error);
            socket.emit('imam:textProcessed', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Worshipper joins session
     */
    async handleJoinSession(socket, data) {
        try {
            const { sessionId, targetLanguage, targetLanguageName, password } = data;
            
            console.log('========================================');
            console.log('👥 [LiveTranslationHandler] JOIN SESSION REQUEST');
            console.log('Session ID:', sessionId);
            console.log('Target Language:', targetLanguage);
            console.log('User ID:', socket.userId);
            console.log('========================================');
            logger.info(`👥 [LiveTranslationHandler] Join session request: ${sessionId} (${targetLanguage})`);
            
            // Verify session exists
            const session = await this.sessionManager.getSession(sessionId);
            if (!session) {
                socket.emit('worshipper:joinResult', {
                    success: false,
                    error: 'Session not found',
                    timestamp: Date.now()
                });
                return;
            }
            
            // Verify password if protected
            if (session.isPasswordProtected) {
                const passwordCheck = await this.sessionManager.verifySessionPassword(sessionId, password);
                if (!passwordCheck.success) {
                    socket.emit('worshipper:joinResult', {
                        success: false,
                        error: passwordCheck.error || 'Invalid password',
                        timestamp: Date.now()
                    });
                    return;
                }
            }
            
            // Add worshipper to session
            const result = await this.sessionManager.addWorshipper(sessionId, {
                userId: socket.userId,
                userName: socket.userEmail || 'Guest',
                targetLanguage: targetLanguage || 'en',
                targetLanguageName: targetLanguageName || 'English',
                socketId: socket.id
            });
            
            if (result.success) {
                // Join the session room
                socket.join(sessionId);
                
                socket.emit('worshipper:joinResult', {
                    success: true,
                    sessionId,
                    session: result.session,
                    worshipperCount: result.worshipperCount,
                    timestamp: Date.now()
                });
                
                // Notify Imam
                const imamSocket = this.sessionManager.getImamSocket(sessionId);
                if (imamSocket) {
                    this.io.to(imamSocket).emit('imam:worshipperJoined', {
                        sessionId,
                        worshipperCount: result.worshipperCount,
                        userName: socket.userEmail || 'Guest',
                        targetLanguage,
                        timestamp: Date.now()
                    });
                }
                
                logger.info(`✅ [LiveTranslationHandler] Worshipper joined: ${sessionId}`);
            } else {
                socket.emit('worshipper:joinResult', {
                    success: false,
                    error: result.error,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Join session error:', error);
            socket.emit('worshipper:joinResult', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Worshipper leaves session
     */
    async handleLeaveSession(socket, data) {
        try {
            const { sessionId } = data;
            
            logger.info(`👋 [LiveTranslationHandler] Leave session: ${sessionId}`);
            
            const result = await this.sessionManager.removeWorshipper(
                sessionId,
                socket.userId,
                socket.id
            );
            
            if (result.success) {
                socket.leave(sessionId);
                
                socket.emit('worshipper:leaveResult', {
                    success: true,
                    sessionId,
                    timestamp: Date.now()
                });
                
                // Notify Imam
                const imamSocket = this.sessionManager.getImamSocket(sessionId);
                if (imamSocket) {
                    this.io.to(imamSocket).emit('imam:worshipperLeft', {
                        sessionId,
                        worshipperCount: result.worshipperCount,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Leave session error:', error);
            socket.emit('worshipper:leaveResult', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Worshipper changes target language
     */
    async handleChangeLanguage(socket, data) {
        try {
            const { sessionId, targetLanguage, targetLanguageName } = data;
            
            logger.info(`🌍 [LiveTranslationHandler] Change language: ${sessionId} → ${targetLanguage}`);
            
            // Remove and re-add with new language
            await this.sessionManager.removeWorshipper(sessionId, socket.userId, socket.id);
            
            const result = await this.sessionManager.addWorshipper(sessionId, {
                userId: socket.userId,
                userName: socket.userEmail || 'Guest',
                targetLanguage,
                targetLanguageName: targetLanguageName || targetLanguage,
                socketId: socket.id
            });
            
            if (result.success) {
                socket.emit('worshipper:languageChanged', {
                    success: true,
                    sessionId,
                    targetLanguage,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Change language error:', error);
            socket.emit('worshipper:languageChanged', {
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Handle connection quality updates
     */
    async handleConnectionQuality(socket, data) {
        const { sessionId, quality, latency } = data;
        
        // Store quality metrics (could be used for adaptive quality)
        logger.info(`📊 [LiveTranslationHandler] Connection quality: ${quality} (${latency}ms)`);
        
        socket.emit('worshipper:qualityAcknowledged', {
            received: true,
            timestamp: Date.now()
        });
    }

    /**
     * Handle ping for connection monitoring
     */
    handlePing(socket, data) {
        socket.emit('pong', {
            timestamp: Date.now(),
            serverTime: Date.now()
        });
    }

    /**
     * Handle socket disconnection
     */
    async handleDisconnect(socket) {
        try {
            logger.info(`🔌 [LiveTranslationHandler] Socket disconnected: ${socket.id}`);
            
            // Find which session this socket was in
            const sessionId = this.sessionManager.getSessionBySocket(socket.id);
            
            if (sessionId) {
                // Check if it was the Imam
                const imamSocket = this.sessionManager.getImamSocket(sessionId);
                
                if (imamSocket === socket.id) {
                    // Imam disconnected - notify all worshippers
                    this.io.to(sessionId).emit('session:imamDisconnected', {
                        sessionId,
                        message: 'Imam has disconnected',
                        timestamp: Date.now()
                    });
                    
                    logger.info(`👤 [LiveTranslationHandler] Imam disconnected from: ${sessionId}`);
                } else {
                    // Worshipper disconnected
                    await this.sessionManager.removeWorshipper(sessionId, socket.userId, socket.id);
                    
                    // Notify Imam
                    if (imamSocket) {
                        this.io.to(imamSocket).emit('imam:worshipperLeft', {
                            sessionId,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            
        } catch (error) {
            logger.error('[LiveTranslationHandler] Disconnect error:', error);
        }
    }
}

module.exports = LiveTranslationHandler;

