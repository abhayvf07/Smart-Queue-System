const Token = require('../models/Token');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Get queue for a service — with Redis caching (TTL 10s)
 */
const getQueueForService = async (serviceId) => {
  const cacheKey = `queue:${serviceId}`;

  // Try cache first
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // Fetch serving and waiting separately — avoids fragile alphabetical sort on status
  const [servingTokens, waitingTokens] = await Promise.all([
    Token.find({ serviceId, status: 'serving' })
      .populate('userId', 'name email')
      .populate('serviceId', 'name prefix')
      .lean(),
    Token.find({ serviceId, status: 'waiting' })
      .sort({ createdAt: 1 })
      .populate('userId', 'name email')
      .populate('serviceId', 'name prefix')
      .lean(),
  ]);

  // Sort waiting: emergency first (stable), then FIFO (already sorted by createdAt)
  waitingTokens.sort((a, b) => {
    if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
    if (a.priority !== 'emergency' && b.priority === 'emergency') return 1;
    return 0; // preserve createdAt order from DB sort
  });

  const queue = [...servingTokens, ...waitingTokens];

  // Cache for 10 seconds
  await cacheSet(cacheKey, queue, 10);

  return queue;
};

/**
 * Get queue stats for a service — with Redis caching (TTL 5s)
 */
const getQueueStats = async (serviceId) => {
  const cacheKey = `stats:${serviceId}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const [waitingCount, servingToken, completedToday] = await Promise.all([
    Token.countDocuments({ serviceId, status: 'waiting' }),
    Token.findOne({ serviceId, status: 'serving' }).populate('userId', 'name').lean(),
    Token.countDocuments({
      serviceId,
      status: 'completed',
      completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  // Calculate average wait time (completed tokens today)
  const avgWaitResult = await Token.aggregate([
    {
      $match: {
        serviceId: mongoose.Types.ObjectId.createFromHexString(serviceId.toString()),
        status: 'completed',
        calledAt: { $ne: null },
        completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    },
    {
      $group: {
        _id: null,
        avgWait: { $avg: { $subtract: ['$calledAt', '$createdAt'] } },
      },
    },
  ]);

  const stats = {
    waiting: waitingCount,
    currentToken: servingToken,
    completedToday,
    avgWaitMinutes: avgWaitResult[0]
      ? Math.round(avgWaitResult[0].avgWait / 60000)
      : 0,
  };

  await cacheSet(cacheKey, stats, 5);
  return stats;
};

/**
 * Compute dynamic position for a token in its service queue.
 * Position = count of waiting tokens ahead (emergency tokens first).
 */
const getTokenPosition = async (token) => {
  if (token.status !== 'waiting') return 0;

  let aheadQuery;

  if (token.priority === 'emergency') {
    // Emergency token: only other emergency tokens created before this one are ahead
    aheadQuery = {
      serviceId: token.serviceId,
      status: 'waiting',
      priority: 'emergency',
      createdAt: { $lt: token.createdAt },
    };
  } else {
    // Normal token: ALL emergency tokens are ahead + normal tokens created before this one
    aheadQuery = {
      serviceId: token.serviceId,
      status: 'waiting',
      $or: [
        { priority: 'emergency' },
        { priority: 'normal', createdAt: { $lt: token.createdAt } },
      ],
    };
  }

  const aheadCount = await Token.countDocuments(aheadQuery);
  return aheadCount + 1; // 1-based position
};

/**
 * Book a new token — with duplicate prevention and atomic counter
 */
const bookToken = async (userId, serviceId, priority = 'normal') => {
  // Check service exists and is active
  const service = await Service.findById(serviceId);
  if (!service || !service.active) {
    throw new ApiError(400, 'Service not available.');
  }

  // Prevent duplicate booking
  const existingToken = await Token.findOne({
    userId,
    serviceId,
    status: { $in: ['waiting', 'serving'] },
  });
  if (existingToken) {
    throw new ApiError(400, 'You already have an active token for this service.');
  }

  // Generate atomic token number
  const tokenNumber = await generateTokenNumber(serviceId, service.prefix);

  // Set expiry (30 minutes from now)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const token = await Token.create({
    userId,
    serviceId,
    tokenNumber,
    priority,
    expiresAt,
  });

  // Invalidate cache
  await cacheDel(`queue:${serviceId}`);
  await cacheDel(`stats:${serviceId}`);

  logger.info(`Token booked: ${tokenNumber} by user ${userId} for service ${service.name}`);

  return token;
};

/**
 * Call next token — finds the next waiting token (emergency first)
 */
const callNextToken = async (serviceId) => {
  // Complete current serving token first
  await Token.updateMany(
    { serviceId, status: 'serving' },
    { status: 'completed', completedAt: new Date() }
  );

  // Find next: try emergency tokens first (FIFO within priority)
  let nextToken = await Token.findOneAndUpdate(
    { serviceId, status: 'waiting', priority: 'emergency' },
    { status: 'serving', calledAt: new Date() },
    { new: true, sort: { createdAt: 1 } }
  )
    .populate('userId', 'name email')
    .populate('serviceId', 'name prefix');

  // If no emergency token, find normal
  if (!nextToken) {
    nextToken = await Token.findOneAndUpdate(
      { serviceId, status: 'waiting' },
      { status: 'serving', calledAt: new Date() },
      { new: true, sort: { createdAt: 1 } }
    )
      .populate('userId', 'name email')
      .populate('serviceId', 'name prefix');
  }

  if (!nextToken) {
    throw new ApiError(404, 'No waiting tokens in queue.');
  }

  // Invalidate cache
  await cacheDel(`queue:${serviceId}`);
  await cacheDel(`stats:${serviceId}`);

  logger.info(`Token called: ${nextToken.tokenNumber} for service ${serviceId}`);

  return nextToken;
};

/**
 * Skip a token
 */
const skipToken = async (tokenId) => {
  const token = await Token.findByIdAndUpdate(
    tokenId,
    { status: 'skipped' },
    { new: true }
  );

  if (!token) throw new ApiError(404, 'Token not found.');

  await cacheDel(`queue:${token.serviceId}`);
  await cacheDel(`stats:${token.serviceId}`);

  logger.info(`Token skipped: ${token.tokenNumber}`);
  return token;
};

/**
 * Cancel a token (by user)
 */
const cancelToken = async (tokenId, userId) => {
  const token = await Token.findOne({
    _id: tokenId,
    userId,
    status: { $in: ['waiting'] },
  });

  if (!token) {
    throw new ApiError(404, 'Token not found or cannot be cancelled.');
  }

  token.status = 'cancelled';
  await token.save();

  await cacheDel(`queue:${token.serviceId}`);
  await cacheDel(`stats:${token.serviceId}`);

  logger.info(`Token cancelled: ${token.tokenNumber} by user ${userId}`);
  return token;
};

/**
 * Get analytics — avg wait time, throughput, peak hours
 */
const getAnalytics = async (serviceId) => {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const matchStage = {
    status: 'completed',
    completedAt: { $gte: today },
  };
  if (serviceId) {
    matchStage.serviceId = mongoose.Types.ObjectId.createFromHexString(serviceId.toString());
  }

  const [metrics, peakHours] = await Promise.all([
    Token.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: 1 },
          avgWaitMs: { $avg: { $subtract: ['$calledAt', '$createdAt'] } },
        },
      },
    ]),
    Token.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return {
    totalCompleted: metrics[0]?.totalCompleted || 0,
    avgWaitMinutes: metrics[0] ? Math.round(metrics[0].avgWaitMs / 60000) : 0,
    peakHours: peakHours.map((h) => ({
      hour: h._id,
      count: h.count,
    })),
  };
};

/**
 * Cancel all expired waiting tokens.
 * Called periodically via setInterval in index.js.
 */
const cancelExpiredTokens = async () => {
  try {
    const now = new Date();

    // Find expired tokens to get their serviceIds for cache invalidation
    const expiredTokens = await Token.find({
      status: 'waiting',
      expiresAt: { $lt: now },
    }).select('serviceId').lean();

    if (expiredTokens.length === 0) return;

    // Cancel all expired tokens
    await Token.updateMany(
      { status: 'waiting', expiresAt: { $lt: now } },
      { status: 'cancelled' }
    );

    // Invalidate Redis cache for each affected service
    const affectedServices = [...new Set(expiredTokens.map((t) => t.serviceId.toString()))];
    for (const sid of affectedServices) {
      await cacheDel(`queue:${sid}`);
      await cacheDel(`stats:${sid}`);
    }

    logger.info(`Auto-cancelled ${expiredTokens.length} expired token(s) across ${affectedServices.length} service(s)`);
  } catch (error) {
    logger.error(`Failed to cancel expired tokens: ${error.message}`);
  }
};

module.exports = {
  getQueueForService,
  getQueueStats,
  getTokenPosition,
  bookToken,
  callNextToken,
  skipToken,
  cancelToken,
  getAnalytics,
  cancelExpiredTokens,
};
