const logger = require('../utils/logger');

let io = null;

const initNotificationService = (socketIO) => {
  io = socketIO;
};

/**
 * Broadcast queue update to all clients watching a service
 */
const broadcastQueueUpdate = (serviceId, queueData) => {
  if (!io) return;
  io.to(`service:${serviceId}`).emit('queue:update', queueData);
};

/**
 * Broadcast queue stats to all clients watching a service
 */
const broadcastQueueStats = (serviceId, stats) => {
  if (!io) return;
  io.to(`service:${serviceId}`).emit('queue:stats', stats);
};

/**
 * Notify a specific user that their token has been called
 */
const notifyTokenCalled = (userId, tokenData) => {
  if (!io) return;
  io.to(`user:${userId}`).emit('token:called', tokenData);
  logger.info(`Notification sent: token:called to user ${userId}`);
};

/**
 * Notify a user that their turn is approaching (≤2 ahead)
 */
const notifyTokenApproaching = (userId, tokenData) => {
  if (!io) return;
  io.to(`user:${userId}`).emit('token:approaching', tokenData);
  logger.info(`Notification sent: token:approaching to user ${userId}`);
};

/**
 * Broadcast to the live display screen
 */
const broadcastLiveDisplay = (serviceId, displayData) => {
  if (!io) return;
  io.to(`display:${serviceId}`).emit('display:update', displayData);
};

/**
 * Broadcast overload alert to a service's room
 */
const broadcastOverloadAlert = (serviceId, alertData) => {
  if (!io) return;
  io.to(`service:${serviceId}`).emit('overload:alert', alertData);
  logger.warn(`Queue overload alert broadcasted for service ${serviceId}: ${alertData.waiting} waiting`);
};

module.exports = {
  initNotificationService,
  broadcastQueueUpdate,
  broadcastQueueStats,
  notifyTokenCalled,
  notifyTokenApproaching,
  broadcastLiveDisplay,
  broadcastOverloadAlert,
};
