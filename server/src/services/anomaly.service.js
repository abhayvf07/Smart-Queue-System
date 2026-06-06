const Token = require('../models/Token');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * AI Feature 2: Z-score based anomaly detection for queue congestion.
 * Replaces hardcoded threshold = capacityPerHour / 2 with adaptive statistical detection.
 *
 * Computes rolling mean and standard deviation of wait times over the last 7 days per service.
 * When current wait time exceeds mean + 2 * stddev, flags as anomaly.
 */

/**
 * Detect anomalous congestion for a service.
 * @param {string} serviceId
 * @returns {{ isAnomaly: boolean, currentWaitMinutes: number, rollingMean: number, stdDev: number, zScore: number, threshold: number }}
 */
const detectAnomaly = async (serviceId) => {
  try {
    const sId = new mongoose.Types.ObjectId(serviceId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    // Get historical wait times (calledAt - createdAt) for completed tokens in the last 7 days
    const historicalWaits = await Token.aggregate([
      {
        $match: {
          serviceId: sId,
          status: 'completed',
          calledAt: { $ne: null },
          completedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $project: {
          waitTimeMs: { $subtract: ['$calledAt', '$createdAt'] },
        },
      },
    ]);

    // Get current average wait time (today's completed tokens)
    const currentWaitResult = await Token.aggregate([
      {
        $match: {
          serviceId: sId,
          status: 'completed',
          calledAt: { $ne: null },
          completedAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          avgWait: { $avg: { $subtract: ['$calledAt', '$createdAt'] } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Also consider currently waiting tokens' expected wait
    const waitingCount = await Token.countDocuments({ serviceId: sId, status: 'waiting' });

    // Not enough historical data for statistical analysis
    if (historicalWaits.length < 10) {
      return {
        isAnomaly: false,
        currentWaitMinutes: 0,
        rollingMean: 0,
        stdDev: 0,
        zScore: 0,
        threshold: 0,
        waitingCount,
        dataPoints: historicalWaits.length,
        method: 'insufficient_data',
      };
    }

    // Compute rolling mean and standard deviation
    const waitMinutes = historicalWaits.map(t => t.waitTimeMs / 60000).filter(w => w >= 0 && w < 480);
    const n = waitMinutes.length;
    const mean = waitMinutes.reduce((s, v) => s + v, 0) / n;
    const variance = waitMinutes.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    // Current average wait in minutes
    const currentWaitMinutes = currentWaitResult[0]
      ? currentWaitResult[0].avgWait / 60000
      : 0;

    // Z-score: how many standard deviations current wait is from the mean
    const zScore = stdDev > 0 ? (currentWaitMinutes - mean) / stdDev : 0;

    // Anomaly if Z-score > 2 (current wait is 2+ standard deviations above the rolling average)
    const isAnomaly = zScore > 2;

    return {
      isAnomaly,
      currentWaitMinutes: Math.round(currentWaitMinutes * 10) / 10,
      rollingMean: Math.round(mean * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,
      threshold: Math.round((mean + 2 * stdDev) * 10) / 10,
      waitingCount,
      dataPoints: n,
      method: 'z_score',
    };
  } catch (error) {
    logger.error(`Anomaly detection error for service ${serviceId}: ${error.message}`);
    return {
      isAnomaly: false,
      currentWaitMinutes: 0,
      rollingMean: 0,
      stdDev: 0,
      zScore: 0,
      threshold: 0,
      waitingCount: 0,
      dataPoints: 0,
      method: 'error',
    };
  }
};

/**
 * Get anomaly status for all active services.
 */
const getAnomalyStatusAll = async () => {
  const Service = require('../models/Service');
  const services = await Service.find({ active: true }).lean();

  const results = await Promise.all(
    services.map(async (s) => ({
      serviceId: s._id,
      serviceName: s.name,
      prefix: s.prefix,
      ...await detectAnomaly(s._id.toString()),
    }))
  );

  return results;
};

module.exports = { detectAnomaly, getAnomalyStatusAll };
