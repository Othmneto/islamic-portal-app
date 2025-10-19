// Real-Time Translation Manager for WebSocket-based live translation
const { translateText } = require('../translationEngineImproved');
const { getTranslationQueueService } = require('../services/translationQueue');

class RealTimeTranslationManager {
    constructor(io) {
        this.io = io;
        this.activeConversations = new Map();
        this.translationQueue = new Map();
        this.typingUsers = new Map();
        this.queueService = getTranslationQueueService();
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            // Join conversation room
            socket.on('joinConversation', (data) => {
                const { conversationId, sessionId } = data;
                socket.join(conversationId);
                this.initializeConversation(conversationId, sessionId);
                console.log('User joined conversation:', conversationId);
            });

            // Handle real-time translation requests
            socket.on('realTimeTranslation', (data) => {
                this.handleRealTimeTranslation(socket, data);
            });

            // Handle typing indicators
            socket.on('userTyping', (data) => {
                this.handleTypingIndicator(socket, data);
            });

            // Handle conversation context updates
            socket.on('updateContext', (data) => {
                this.updateConversationContext(data);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('User disconnected:', socket.id);
                this.handleDisconnection(socket);
            });
        });
    }

    initializeConversation(conversationId, sessionId) {
        if (!this.activeConversations.has(conversationId)) {
            this.activeConversations.set(conversationId, {
                sessionId,
                participants: new Set(),
                translationHistory: [],
                context: '',
                createdAt: new Date(),
                lastActivity: new Date()
            });
        }

        const conversation = this.activeConversations.get(conversationId);
        conversation.participants.add(socket.id);
        conversation.lastActivity = new Date();
    }

    async handleRealTimeTranslation(socket, data) {
        const { text, fromLang, toLang, sessionId, conversationId, isPartial = false } = data;

        if (!text || text.trim().length < 2) return;

        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) {
            socket.emit('translationError', { error: 'Conversation not found' });
            return;
        }

        // Update conversation activity
        conversation.lastActivity = new Date();

        // For partial text (typing), use faster processing
        if (isPartial) {
            this.handlePartialTranslation(socket, data, conversation);
        } else {
            // For complete text, use full translation
            await this.queueTranslation(conversationId, {
                text,
                fromLang,
                toLang,
                sessionId,
                socketId: socket.id,
                conversationId
            });
        }
    }

    async handlePartialTranslation(socket, data, conversation) {
        const { text, fromLang, toLang } = data;

        // Simple partial translation for typing indicators
        try {
            const partialTranslation = await this.getPartialTranslation(text, fromLang, toLang);

            socket.emit('partialTranslation', {
                original: text,
                partial: partialTranslation,
                fromLang,
                toLang,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('[RealTime] Partial translation error:', error);
        }
    }

    async getPartialTranslation(text, fromLang, toLang) {
        // Use a simpler, faster approach for partial translations
        // This could be a cached translation or a lighter model
        const simpleTranslations = {
            'hello': { 'Arabic': 'مرحبا', 'Urdu': 'ہیلو', 'French': 'Bonjour' },
            'thank you': { 'Arabic': 'شكرا', 'Urdu': 'شکریہ', 'French': 'Merci' },
            'peace': { 'Arabic': 'سلام', 'Urdu': 'امن', 'French': 'Paix' }
        };

        const textLower = text.toLowerCase();
        return simpleTranslations[textLower]?.[toLang] || text;
    }

    async queueTranslation(conversationId, translationData) {
        // Ensure worker exists for this conversation
        if (!this.queueService.workers.has(conversationId)) {
            this.queueService.createWorker(conversationId, this.io);
        }

        // Add job to BullMQ queue
        const jobId = await this.queueService.addTranslationJob({
            text: translationData.text,
            from: translationData.fromLang,
            to: Array.isArray(translationData.toLang) ? translationData.toLang : [translationData.toLang],
            voiceId: 'default-voice',
            sessionId: translationData.sessionId,
            conversationId: conversationId,
            socket: { id: translationData.socketId }
        });

        console.log(`[RealTime] Queued translation job ${jobId} for conversation ${conversationId}`);
    }

    // Old processTranslationQueue method removed - now using BullMQ for better concurrency control

    handleTypingIndicator(socket, data) {
        const { conversationId, isTyping, text } = data;

        if (isTyping) {
            this.typingUsers.set(socket.id, {
                conversationId,
                text: text || '',
                timestamp: new Date()
            });
        } else {
            this.typingUsers.delete(socket.id);
        }

        // Broadcast typing status to conversation participants
        socket.to(conversationId).emit('userTyping', {
            socketId: socket.id,
            isTyping,
            text: text || '',
            timestamp: new Date()
        });
    }

    updateConversationContext(data) {
        const { conversationId, context } = data;
        const conversation = this.activeConversations.get(conversationId);

        if (conversation) {
            conversation.context = context;
            conversation.lastActivity = new Date();
        }
    }

    handleDisconnection(socket) {
        console.log(`[RealTime] User disconnected: ${socket.id}`);

        // Remove from typing users
        this.typingUsers.delete(socket.id);

        // Remove from all conversations
        for (const [conversationId, conversation] of this.activeConversations.entries()) {
            conversation.participants.delete(socket.id);
        }

        // Clean up empty conversations
        this.cleanupEmptyConversations();
    }

    cleanupEmptyConversations() {
        const now = new Date();
        const timeout = 30 * 60 * 1000; // 30 minutes

        for (const [conversationId, conversation] of this.activeConversations.entries()) {
            if (conversation.participants.size === 0 ||
                (now - conversation.lastActivity) > timeout) {
                this.activeConversations.delete(conversationId);
                this.translationQueue.delete(conversationId);

                // Clean up BullMQ worker for this conversation
                this.queueService.removeWorker(conversationId);

                console.log(`[RealTime] Cleaned up conversation: ${conversationId}`);
            }
        }
    }

    // Get conversation statistics
    getConversationStats(conversationId) {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) return null;

        return {
            participantCount: conversation.participants.size,
            translationCount: conversation.translationHistory.length,
            contextLength: conversation.context.length,
            lastActivity: conversation.lastActivity,
            createdAt: conversation.createdAt
        };
    }

    // Get all active conversations
    getAllConversations() {
        const conversations = [];
        for (const [id, conversation] of this.activeConversations.entries()) {
            conversations.push({
                id,
                ...this.getConversationStats(id)
            });
        }
        return conversations;
    }
}

module.exports = RealTimeTranslationManager;
