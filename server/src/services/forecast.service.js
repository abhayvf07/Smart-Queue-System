const Token = require('../models/Token');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * AI Feature 4: Smart Peak-Hours Forecasting using EWMA.
 * Filters to matching days-of-week (e.g., when forecasting Monday, uses last 4 Mondays)
 * to avoid weekend data poisoning weekday predictions.
 *
 * EWMA (Exponential Weighted Moving Average) with alpha=0.3 is applied to the
 * matching-day data to generate a predicted busy hours distribution for tomorrow.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get forecast for tomorrow's hourly traffic.
 * @param {string} [serviceId] - Optional service filter
 * @returns {{ forecast: Array<{hour, predictedTokens}>, confidence, dataPoints, targetDay }}
 */
const getForecast = async (serviceId = null) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDayOfWeek = tomorrow.getDay(); // 0=Sunday, 1=Monday, etc.
    const targetDayName = DAYS[targetDayOfWeek];

    // Find the last 4 matching days-of-week (e.g., last 4 Mondays)
    // Look back up to 35 days to find at least 4 matching days
    const lookbackDays = 35;
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const matchFilter = {
      createdAt: { $gte: lookbackDate },
    };

    if (serviceId) {
      matchFilter.serviceId = new mongoose.Types.ObjectId(serviceId);
    }

    // Aggregate hourly token counts, filtering to matching day-of-week
    const hourlyData = await Token.aggregate([
      { $match: matchFilter },
      {
        $project: {
          hour: { $hour: '$createdAt' },
          dayOfWeek: { $dayOfWeek: '$createdAt' }, // 1=Sunday in MongoDB
          dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        },
      },
      {
        // MongoDB dayOfWeek: 1=Sunday, 2=Monday... we need to match JS getDay(): 0=Sunday, 1=Monday
        $match: {
          dayOfWeek: targetDayOfWeek + 1, // MongoDB is 1-indexed
        },
      },
      {
        $group: {
          _id: { date: '$dateStr', hour: '$hour' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          hours: {
            $push: {
              hour: '$_id.hour',
              count: '$count',
            },
          },
        },
      },
      { $sort: { _id: 1 } }, // Sort by date ascending (oldest first)
    ]);

    // If fewer than 2 matching days, fall back to all-days average
    let dataSource = hourlyData;
    let fallback = false;

    if (hourlyData.length < 2) {
      fallback = true;
      // Get all-days average instead
      const allDaysData = await Token.aggregate([
        { $match: matchFilter },
        {
          $project: {
            hour: { $hour: '$createdAt' },
            dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          },
        },
        {
          $group: {
            _id: { date: '$dateStr', hour: '$hour' },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            hours: {
              $push: {
                hour: '$_id.hour',
                count: '$count',
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 }, // Last 2 weeks max
      ]);
      dataSource = allDaysData;
    }

    if (dataSource.length === 0) {
      return {
        forecast: Array.from({ length: 24 }, (_, i) => ({ hour: i, predictedTokens: 0 })),
        confidence: 'no_data',
        dataPoints: 0,
        targetDay: targetDayName,
        method: 'none',
      };
    }

    // Apply EWMA per hour across the matching days
    const alpha = 0.3;
    const hourlyForecasts = new Array(24).fill(0);
    const hourDataPoints = new Array(24).fill(0);

    // For each matching day (sorted chronologically), apply EWMA
    for (const dayData of dataSource) {
      // Build hour map for this day
      const hourMap = {};
      for (const h of dayData.hours) {
        hourMap[h.hour] = h.count;
      }

      // Apply EWMA: forecast[h] = alpha * observation + (1 - alpha) * previous_forecast
      for (let h = 0; h < 24; h++) {
        const observation = hourMap[h] || 0;
        if (hourDataPoints[h] === 0) {
          // First data point: initialize
          hourlyForecasts[h] = observation;
        } else {
          hourlyForecasts[h] = alpha * observation + (1 - alpha) * hourlyForecasts[h];
        }
        if (observation > 0) hourDataPoints[h]++;
      }
    }

    // Build forecast array
    const forecast = hourlyForecasts.map((val, hour) => ({
      hour,
      predictedTokens: Math.round(val * 10) / 10,
    }));

    // Confidence based on data points
    const totalDataPoints = dataSource.length;
    let confidence;
    if (totalDataPoints >= 4 && !fallback) confidence = 'high';
    else if (totalDataPoints >= 2) confidence = 'medium';
    else confidence = 'low';

    return {
      forecast,
      confidence,
      dataPoints: totalDataPoints,
      targetDay: targetDayName,
      method: fallback ? 'all_days_ewma' : 'matching_day_ewma',
    };
  } catch (error) {
    logger.error(`Forecast error: ${error.message}`);
    return {
      forecast: Array.from({ length: 24 }, (_, i) => ({ hour: i, predictedTokens: 0 })),
      confidence: 'error',
      dataPoints: 0,
      targetDay: DAYS[new Date().getDay()],
      method: 'error',
    };
  }
};

module.exports = { getForecast };
