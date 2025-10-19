let ioInstance;

const initializeWebSocket = (io) => {
  ioInstance = io;
};

function emitNotificationStatus(userId, data) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notificationStatus', data);
  }
}

function emitScheduleUpdate(userId, scheduleData) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('scheduleUpdate', scheduleData);
  }
}

module.exports = {
  initializeWebSocket,
  emitNotificationStatus,
  emitScheduleUpdate
};
