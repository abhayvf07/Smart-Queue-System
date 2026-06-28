require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const setupSocket = require('./socket/socketHandler');
const { initNotificationService } = require('./services/notification.service');
const { cancelExpiredTokens, getQueueForService, getQueueStats, queueEvents } = require('./services/queue.service');
const { refreshAnomalyCache } = require('./services/anomalyCache');
const notificationService = require('./services/notification.service');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth.routes');
const tokenRoutes = require('./routes/token.routes');
const adminRoutes = require('./routes/admin.routes');
const serviceRoutes = require('./routes/service.routes');
const chatbotRoutes = require('./routes/chatbot.routes');


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

// Listen for expired token events and broadcast updates (decoupled from queue.service)
queueEvents.on('tokensExpired', async (serviceIds) => {
  for (const sId of serviceIds) {
    try {
      const queue = await getQueueForService(sId);
      const stats = await getQueueStats(sId);
      notificationService.broadcastQueueUpdate(sId, queue);
      notificationService.broadcastQueueStats(sId, stats);
      notificationService.broadcastLiveDisplay(sId, { queue, stats });
    } catch (err) {
      logger.error(`Failed to broadcast expired token update for service ${sId}: ${err.message}`);
    }
  }
});

// Make io accessible in routes via req.io
app.set('io', io);

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/chatbot', chatbotRoutes);


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

let cleanupInterval;
let anomalyCacheInterval;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Socket.IO ready for connections`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Auto-cancel expired tokens every 60 seconds
    cleanupInterval = setInterval(cancelExpiredTokens, 60 * 1000);
    logger.info('⏱️  Expired token cleanup scheduled (every 60s)');

    // Anomaly detection cache — refresh every 2 minutes (off the request path)
    await refreshAnomalyCache(); // warm cache on startup
    anomalyCacheInterval = setInterval(refreshAnomalyCache, 2 * 60 * 1000);
    logger.info('🔍 Anomaly detection cache scheduled (every 2min)');
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  clearInterval(cleanupInterval);
  clearInterval(anomalyCacheInterval);
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
