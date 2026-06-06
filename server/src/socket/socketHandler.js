const jwt = require('jsonwebtoken');
const { Types } = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

const setupSocket = (io) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          socket.user = user;
          socket.join(`user:${user._id}`);
        }
      }
      next();
    } catch (err) {
      // Allow anonymous connections (for live display screens)
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(
      `Socket connected: ${socket.id} ${socket.user ? `(user: ${socket.user.email})` : '(anonymous)'}`
    );

    // Join a service's queue room
    socket.on('join:service', (serviceId) => {
      if (!Types.ObjectId.isValid(serviceId)) return;
      socket.join(`service:${serviceId}`);
      logger.debug(`Socket ${socket.id} joined service:${serviceId}`);
    });

    // Leave a service's queue room
    socket.on('leave:service', (serviceId) => {
      if (!Types.ObjectId.isValid(serviceId)) return;
      socket.leave(`service:${serviceId}`);
      logger.debug(`Socket ${socket.id} left service:${serviceId}`);
    });

    // Join live display room
    socket.on('join:display', (serviceId) => {
      if (!Types.ObjectId.isValid(serviceId)) return;
      socket.join(`display:${serviceId}`);
      logger.debug(`Socket ${socket.id} joined display:${serviceId}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });
};

module.exports = setupSocket;
