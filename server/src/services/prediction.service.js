const Token = require('../models/Token');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * AI Feature 1: Smart Wait Time Prediction using Weighted Average.
 * Uses historical token data to predict wait times.
 *
 * This uses a simple weighted average of recent and historical wait times.
 */

/**
 * Predict wait time for a service using historical data and recent throughput.
 * @param {string} serviceId
 * @param {number} position - Current position in queue (1-based)
 * @param {number} currentQueueLength - Current total waiting tokens
 * @returns {{ predictedMinutes: number, confidence: string, method: string }}
 */
const predictWaitTime = async (serviceId, position, currentQueueLength) => {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sId = new mongoose.Types.ObjectId(serviceId);

    // Fetch completed tokens with valid calledAt from the last 14 days
    const historicalTokens = await Token.aggregate([
      {
        $match: {
          serviceId: sId,
          status: 'completed',
          calledAt: { $ne: null },
          createdAt: { $gte: fourteenDaysAgo },
        },
      },
      {
        $project: {
          waitTimeMs: { $subtract: ['$calledAt', '$createdAt'] },
        },
      },
    ]);

    // Calculate historical average wait time
    let historicalAvgMinutes = 5; // Default 5 mins
    if (historicalTokens.length > 0) {
      const totalWaitMs = historicalTokens.reduce((sum, t) => sum + t.waitTimeMs, 0);
      historicalAvgMinutes = (totalWaitMs / historicalTokens.length) / 60000;
    }

    // Get recent throughput (completed in last hour) to adjust prediction
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTokens = await Token.find({
      serviceId: sId,
      status: 'completed',
      calledAt: { $ne: null },
      completedAt: { $gte: oneHourAgo },
    });

    let recentAvgMinutes = historicalAvgMinutes;
    if (recentTokens.length > 0) {
      const recentTotalWaitMs = recentTokens.reduce((sum, t) => sum + (t.calledAt - t.createdAt), 0);
      recentAvgMinutes = (recentTotalWaitMs / recentTokens.length) / 60000;
    }

    // Weighted average: 70% recent, 30% historical
    const basePrediction = (recentAvgMinutes * 0.7) + (historicalAvgMinutes * 0.3);
    
    // Scale by position
    const prediction = Math.max(0, Math.round(basePrediction * (position > 0 ? position : 1)));

    let confidence = 'low';
    if (historicalTokens.length > 50 && recentTokens.length > 5) confidence = 'high';
    else if (historicalTokens.length > 20) confidence = 'medium';

    return {
      predictedMinutes: prediction,
      confidence,
      method: 'weighted_average',
      dataPoints: historicalTokens.length,
    };
  } catch (error) {
    logger.error(`Prediction error for service ${serviceId}: ${error.message}`);
    return {
      predictedMinutes: null,
      confidence: 'error',
      method: 'fallback',
      dataPoints: 0,
    };
  }
};

module.exports = { predictWaitTime };
