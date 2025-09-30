// translator-backend/websockets/authenticatedSocketManager.js

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const RealTimeTranslationManager = require('./realTimeTranslationManager');

/**
 * Enhanced WebSocket Manager with JWT Authentication
 * Ensures only authenticated users can connect and join conversations
 * @param {object} io - The Socket.IO server instance.
 */
module.exports = (io) => {
  // Initialize Real-Time Translation Manager
  const realTimeTranslationManager = new RealTimeTranslationManager(io);

  // Middleware for JWT authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        logger.warn(`Unauthenticated connection attempt from ${socket.handshake.address}`);
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      socket.isAuthenticated = true;
      
      logger.info(`Authenticated user ${decoded.email} connected: ${socket.id}`);
      next();
    } catch (error) {
      logger.error(`Authentication failed for socket ${socket.id}:`, error.message);
      next(new Error('Invalid authentication token'));
    }
  });

  // This event fires whenever a new authenticated client connects
  io.on('connection', (socket) => {
    logger.info(`Authenticated client connected: ${socket.id} (User: ${socket.userEmail})`);

    // Store user info in translation manager
    realTimeTranslationManager.setUserInfo(socket.id, {
      userId: socket.userId,
      email: socket.userEmail,
      socketId: socket.id
    });

    // Example: A client can join a "room" to receive specific updates.
    socket.on('join_translation_room', (data) => {
      const { translationId } = data;
      if (translationId) {
        socket.join(translationId);
        logger.info(`Socket ${socket.id} (${socket.userEmail}) joined room for translationId: ${translationId}`);
      }
    });

    // Real-time translation events with user validation
    socket.on('joinConversation', (data) => {
      try {
        // Validate conversation access
        if (!this.validateConversationAccess(socket, data.conversationId)) {
          socket.emit('error', { message: 'Unauthorized access to conversation' });
          return;
        }

        realTimeTranslationManager.initializeConversation(data.conversationId, data.sessionId, socket.userId);
        socket.join(data.conversationId);
        logger.info(`Socket ${socket.id} (${socket.userEmail}) joined conversation: ${data.conversationId}`);
        
        // Notify user of successful join
        socket.emit('conversationJoined', { 
          conversationId: data.conversationId,
          userId: socket.userId 
        });
      } catch (error) {
        logger.error(`Error joining conversation:`, error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    socket.on('realTimeTranslation', (data) => {
      try {
        // Validate user has access to this conversation
        if (!this.validateConversationAccess(socket, data.conversationId)) {
          socket.emit('error', { message: 'Unauthorized translation request' });
          return;
        }

        // Add user context to translation data
        data.userId = socket.userId;
        data.userEmail = socket.userEmail;
        
        realTimeTranslationManager.handleRealTimeTranslation(socket, data);
      } catch (error) {
        logger.error(`Error in real-time translation:`, error);
        socket.emit('error', { message: 'Translation failed' });
      }
    });

    socket.on('userTyping', (data) => {
      try {
        if (!this.validateConversationAccess(socket, data.conversationId)) {
          return; // Silently ignore unauthorized typing indicators
        }

        data.userId = socket.userId;
        data.userEmail = socket.userEmail;
        realTimeTranslationManager.handleTypingIndicator(socket, data);
      } catch (error) {
        logger.error(`Error in typing indicator:`, error);
      }
    });

    socket.on('updateContext', (data) => {
      try {
        if (!this.validateConversationAccess(socket, data.conversationId)) {
          socket.emit('error', { message: 'Unauthorized context update' });
          return;
        }

        data.userId = socket.userId;
        realTimeTranslationManager.updateConversationContext(data);
      } catch (error) {
        logger.error(`Error updating context:`, error);
        socket.emit('error', { message: 'Context update failed' });
      }
    });

    // This event fires when a client disconnects
    socket.on('disconnect', () => {
      logger.info(`Authenticated client disconnected: ${socket.id} (User: ${socket.userEmail})`);
      realTimeTranslationManager.handleDisconnection(socket);
    });
  });

  // Helper function to validate conversation access
  io.validateConversationAccess = (socket, conversationId) => {
    // For now, allow access if user is authenticated
    // In the future, you could implement more granular permissions
    // based on conversation ownership, shared access, etc.
    return socket.isAuthenticated && conversationId;
  };

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

  /**
   * Gets user-specific conversations.
   * @param {string} userId - The user ID.
   * @returns {Array} Array of user's conversations.
   */
  io.getUserConversations = (userId) => {
    return realTimeTranslationManager.getUserConversations(userId);
  };
};
