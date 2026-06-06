const Service = require('../models/Service');
const Token = require('../models/Token');
const mongoose = require('mongoose');

/**
 * Rank services based on congestion score using a single aggregation pipeline.
 * Replaces the N sequential getQueueStats calls with one bulk query.
 */
const getRecommendedService = async () => {
  const activeServices = await Service.find({ active: true }).lean();
  if (activeServices.length === 0) return [];

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const serviceIds = activeServices.map(s => s._id);

  // Single aggregation: compute waiting, serving, completedToday, avgWait for all services at once
  const [statsResults, avgWaitResults] = await Promise.all([
    Token.aggregate([
      {
        $match: {
          serviceId: { $in: serviceIds },
          status: { $in: ['waiting', 'serving', 'completed'] },
        },
      },
      {
        $facet: {
          waitingCounts: [
            { $match: { status: 'waiting' } },
            { $group: { _id: '$serviceId', count: { $sum: 1 } } },
          ],
          servingTokens: [
            { $match: { status: 'serving' } },
            { $sort: { calledAt: 1 } },
            {
              $group: {
                _id: '$serviceId',
                tokenId: { $first: '$_id' },
                userId: { $first: '$userId' },
                tokenNumber: { $first: '$tokenNumber' },
              },
            },
            // $lookup into users to get the populated name
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userInfo',
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
          ],
          completedCounts: [
            { $match: { status: 'completed', completedAt: { $gte: today } } },
            { $group: { _id: '$serviceId', count: { $sum: 1 } } },
          ],
        },
      },
    ]),
    Token.aggregate([
      {
        $match: {
          serviceId: { $in: serviceIds },
          status: 'completed',
          calledAt: { $ne: null },
          completedAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: '$serviceId',
          avgWait: { $avg: { $subtract: ['$calledAt', '$createdAt'] } },
        },
      },
    ]),
  ]);

  // Build lookup maps
  const waitingMap = new Map();
  const servingMap = new Map();
  const completedMap = new Map();
  const avgWaitMap = new Map();

  if (statsResults[0]) {
    for (const r of statsResults[0].waitingCounts) waitingMap.set(r._id.toString(), r.count);
    for (const r of statsResults[0].servingTokens) {
      servingMap.set(r._id.toString(), {
        _id: r.tokenId,
        tokenNumber: r.tokenNumber,
        userId: r.userInfo || null,
      });
    }
    for (const r of statsResults[0].completedCounts) completedMap.set(r._id.toString(), r.count);
  }
  for (const r of avgWaitResults) {
    avgWaitMap.set(r._id.toString(), Math.round(r.avgWait / 60000));
  }

  // Build scored results
  const serviceScores = activeServices.map((service) => {
    const sid = service._id.toString();
    const waiting = waitingMap.get(sid) || 0;
    const completedToday = completedMap.get(sid) || 0;
    const avgWaitMinutes = avgWaitMap.get(sid) || 0;
    const capacity = service.capacityPerHour || 20;
    const score = waiting / capacity;

    // Estimate wait time for a new booker
    const fallbackAvgWait = avgWaitMinutes || Math.round(60 / capacity);
    const estimatedMinutes = waiting * fallbackAvgWait;

    return {
      ...service,
      stats: {
        waiting,
        currentToken: servingMap.get(sid) || null,
        completedToday,
        avgWaitMinutes,
      },
      congestionScore: score,
      estimatedMinutes,
    };
  });

  // Sort by congestionScore ascending (least congested first)
  serviceScores.sort((a, b) => a.congestionScore - b.congestionScore);

  return serviceScores;
};

module.exports = { getRecommendedService };
