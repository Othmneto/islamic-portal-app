// translator-backend/websockets/socketManager.js

const logger = require('../utils/logger');
const RealTimeTranslationManager = require('./realTimeTranslationManager');
const LiveTranslationHandler = require('./liveTranslationHandler');

/**
 * Manages all WebSocket connections and events.
 * @param {object} io - The Socket.IO server instance.
 */
module.exports = (io) => {
  // Initialize Real-Time Translation Manager
  const realTimeTranslationManager = new RealTimeTranslationManager(io);
  
  // Initialize Live Translation Handler (Imam-Worshipper)
  const liveTranslationHandler = new LiveTranslationHandler(io);

  // This event fires whenever a new client connects
  io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Setup Live Translation handlers (Imam-Worshipper feature)
    liveTranslationHandler.setupHandlers(socket);

    // Example: A client can join a "room" to receive specific updates.
    // This is useful for things like translation jobs.
    socket.on('join_translation_room', (data) => {
      const { translationId } = data;
      if (translationId) {
        socket.join(translationId);
        logger.info(`Socket ${socket.id} joined room for translationId: ${translationId}`);
      }
    });

    // Real-time translation events (existing feature)
    socket.on('joinConversation', (data) => {
      realTimeTranslationManager.initializeConversation(data.conversationId, data.sessionId);
      socket.join(data.conversationId);
      logger.info(`Socket ${socket.id} joined conversation: ${data.conversationId}`);
    });

    socket.on('realTimeTranslation', (data) => {
      realTimeTranslationManager.handleRealTimeTranslation(socket, data);
    });

    socket.on('userTyping', (data) => {
      realTimeTranslationManager.handleTypingIndicator(socket, data);
    });

    socket.on('updateContext', (data) => {
      realTimeTranslationManager.updateConversationContext(data);
    });

    // This event fires when a client disconnects
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
      realTimeTranslationManager.handleDisconnection(socket);
    });
  });

  // --- Global Emitter Functions ---
  // By attaching functions to the `io` instance, we can easily call them
  // from our services to broadcast events without importing `io` everywhere.

  /**
   * Emits a progress update to a specific translation room.
   * @param {string} translationId - The ID of the translation job.
   * @param {object} progress - An object containing progress details.
   */
  io.emitTranslationProgress = (translationId, progress) => {
    if (io && translationId) {
      io.to(translationId).emit('translation_progress', progress);
    }
  };

  /**
   * Emits a real-time translation result to a conversation.
   * @param {string} conversationId - The ID of the conversation.
   * @param {object} translationData - The translation data to broadcast.
   */
  io.emitRealTimeTranslation = (conversationId, translationData) => {
    if (io && conversationId) {
      io.to(conversationId).emit('translationResult', translationData);
    }
  };

  /**
   * Gets conversation statistics.
   * @param {string} conversationId - The ID of the conversation.
   * @returns {object|null} Conversation statistics or null if not found.
   */
  io.getConversationStats = (conversationId) => {
    return realTimeTranslationManager.getConversationStats(conversationId);
  };

  /**
   * Gets all active conversations.
   * @returns {Array} Array of active conversations.
   */
  io.getAllConversations = () => {
    return realTimeTranslationManager.getAllConversations();
  };
};