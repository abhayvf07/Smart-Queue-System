const mongoose = require('mongoose');
const logger = require('../utils/logger');

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI missing in environment variables');
}
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || 'smart-queue',
      autoIndex: true,
      maxPoolSize: 10,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB runtime error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting reconnect...');
  });
};

module.exports = connectDB;
