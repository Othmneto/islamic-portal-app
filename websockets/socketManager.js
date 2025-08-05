// translator-backend/websockets/socketManager.js

const logger = require('../utils/logger');

/**
 * Manages all WebSocket connections and events.
 * @param {object} io - The Socket.IO server instance.
 */
module.exports = (io) => {
  // This event fires whenever a new client connects
  io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Example: A client can join a "room" to receive specific updates.
    // This is useful for things like translation jobs.
    socket.on('join_translation_room', (data) => {
      const { translationId } = data;
      if (translationId) {
        socket.join(translationId);
        logger.info(`Socket ${socket.id} joined room for translationId: ${translationId}`);
      }
    });

    // This event fires when a client disconnects
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
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
};