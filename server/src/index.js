require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const setupSocket = require('./socket/socketHandler');
const { initNotificationService } = require('./services/notification.service');
const { cancelExpiredTokens } = require('./services/queue.service');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth.routes');
const tokenRoutes = require('./routes/token.routes');
const adminRoutes = require('./routes/admin.routes');
const serviceRoutes = require('./routes/service.routes');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize notification service with Socket.IO
initNotificationService(io);

// Setup Socket.IO
setupSocket(io);

// Make io accessible in routes via req.io
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/services', serviceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Smart Queue Server is running!',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis (graceful — won't crash if unavailable)
    connectRedis();

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Socket.IO ready for connections`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Auto-cancel expired tokens every 60 seconds
    setInterval(cancelExpiredTokens, 60 * 1000);
    logger.info('⏱️  Expired token cleanup scheduled (every 60s)');
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});
