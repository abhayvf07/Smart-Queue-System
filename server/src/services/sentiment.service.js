const ChatLog = require('../models/ChatLog');
const logger = require('../utils/logger');

/**
 * AI Feature 5: Sentiment analysis aggregation service.
 * Sentiment extraction happens inside chatbot.service.js (single Gemini call).
 * This service handles storage and aggregation of sentiment data.
 */

/**
 * Save a chat log entry with sentiment.
 */
const saveChatLog = async (userId, message, response, sentiment = 'neutral') => {
  try {
    await ChatLog.create({
      userId,
      message: message.slice(0, 500),
      response: response.slice(0, 2000),
      sentiment,
    });
  } catch (error) {
    // Fire-and-forget — don't break chatbot flow
    logger.error(`Failed to save chat log: ${error.message}`);
  }
};

/**
 * Get aggregated sentiment statistics.
 * @param {number} [days=7] - Number of days to look back
 * @returns {{ positive, neutral, frustrated, total, satisfactionRate }}
 */
const getSentimentStats = async (days = 7) => {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await ChatLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$sentiment',
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = { positive: 0, neutral: 0, frustrated: 0 };
    for (const r of results) {
      if (counts.hasOwnProperty(r._id)) {
        counts[r._id] = r.count;
      }
    }

    const total = counts.positive + counts.neutral + counts.frustrated;
    const satisfactionRate = total > 0
      ? Math.round(((counts.positive + counts.neutral) / total) * 100)
      : 0;

    return {
      ...counts,
      total,
      satisfactionRate,
      periodDays: days,
    };
  } catch (error) {
    logger.error(`Sentiment stats error: ${error.message}`);
    return { positive: 0, neutral: 0, frustrated: 0, total: 0, satisfactionRate: 0, periodDays: days };
  }
};

/**
 * Get sentiment trend over time (daily breakdown).
 * @param {number} [days=7]
 */
const getSentimentTrend = async (days = 7) => {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await ChatLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            sentiment: '$sentiment',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Transform into daily buckets
    const dayMap = {};
    for (const r of results) {
      const date = r._id.date;
      if (!dayMap[date]) dayMap[date] = { date, positive: 0, neutral: 0, frustrated: 0 };
      dayMap[date][r._id.sentiment] = r.count;
    }

    return Object.values(dayMap);
  } catch (error) {
    logger.error(`Sentiment trend error: ${error.message}`);
    return [];
  }
};

module.exports = { saveChatLog, getSentimentStats, getSentimentTrend };
