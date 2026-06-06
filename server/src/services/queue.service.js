const Token = require('../models/Token');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const { EventEmitter } = require('events');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Event emitter to decouple from notification service (avoids circular require)
const queueEvents = new EventEmitter();

/**
 * Get queue for a service
 */
const getQueueForService = async (serviceId) => {
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

  return queue;
};

/**
 * Get queue stats for a service
 */
const getQueueStats = async (serviceId) => {
  const sId = serviceId._id || serviceId;
  const [waitingCount, servingToken, completedToday] = await Promise.all([
    Token.countDocuments({ serviceId: sId, status: 'waiting' }),
    Token.findOne({ serviceId: sId, status: 'serving' }).populate('userId', 'name').lean(),
    Token.countDocuments({
      serviceId: sId,
      status: 'completed',
      completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  // Calculate average wait time (completed tokens today)
  const avgWaitResult = await Token.aggregate([
    {
      $match: {
        serviceId: new mongoose.Types.ObjectId(sId),
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
const bookToken = async (userId, serviceId, priority = 'normal', bypassDuplicateCheck = false) => {
  // Check service exists and is active
  const service = await Service.findById(serviceId);
  if (!service || !service.active) {
    throw new ApiError(400, 'Service not available.');
  }

  // Prevent duplicate booking unless bypassed (e.g. by admin for walk-ins)
  if (!bypassDuplicateCheck) {
    const existingToken = await Token.findOne({
      userId,
      serviceId,
      status: { $in: ['waiting', 'serving'] },
    });
    if (existingToken) {
      throw new ApiError(400, 'You already have an active token for this service.');
    }
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

  logger.info(`Token booked: ${tokenNumber} by user ${userId} for service ${service.name}`);

  return token;
};

/**
 * Call next token — finds the next waiting token (emergency first)
 */
const callNextToken = async (serviceId) => {
  // Complete ALL currently serving tokens to prevent stuck tokens
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
    .populate('serviceId', 'name prefix capacityPerHour');

  // If no emergency token, find normal
  if (!nextToken) {
    nextToken = await Token.findOneAndUpdate(
      { serviceId, status: 'waiting' },
      { status: 'serving', calledAt: new Date() },
      { new: true, sort: { createdAt: 1 } }
    )
      .populate('userId', 'name email')
      .populate('serviceId', 'name prefix capacityPerHour');
  }

  if (!nextToken) {
    throw new ApiError(404, 'No waiting tokens in queue.');
  }

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

  logger.info(`Token skipped: ${token.tokenNumber}`);
  return token;
};

/**
 * Cancel a token (by user)
 */
const cancelToken = async (tokenId, userId) => {
  // First check if token exists at all for this user
  const token = await Token.findOne({ _id: tokenId, userId });

  if (!token) {
    throw new ApiError(404, 'Token not found.');
  }

  if (token.status === 'serving') {
    throw new ApiError(400, 'Token is currently being served and cannot be cancelled.');
  }

  if (token.status !== 'waiting') {
    throw new ApiError(400, `Token has status "${token.status}" and cannot be cancelled.`);
  }

  token.status = 'cancelled';
  await token.save();

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
    const sId = serviceId._id ? serviceId._id.toString() : serviceId.toString();
    const isValidId = /^[0-9a-fA-F]{24}$/.test(sId);
    
    if (!isValidId) {
      return { totalCompleted: 0, avgWaitMinutes: 0, peakHours: [] };
    }
    matchStage.serviceId = new mongoose.Types.ObjectId(sId);
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

  // Final analytics object
  const analyticsData = {
    totalCompleted: metrics[0]?.totalCompleted || 0,
    avgWaitMinutes: metrics[0] ? Math.round(metrics[0].avgWaitMs / 60000) : 0,
    peakHours: peakHours.map((h) => ({
      hour: h._id,
      count: h.count,
    })),
  };

  return analyticsData;
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
    
    // Emit event for notification broadcasting (handled in index.js)
    const uniqueServiceIds = [...new Set(expiredTokens.map((t) => t.serviceId.toString()))];
    queueEvents.emit('tokensExpired', uniqueServiceIds);

    logger.info(`Auto-cancelled ${expiredTokens.length} expired token(s) across ${uniqueServiceIds.length} service(s)`);
  } catch (error) {
    logger.error(`Failed to cancel expired tokens: ${error.message}`);
  }
};

/**
 * Get estimated wait time for a token, with capacityPerHour cold-start fallback.
 */
const getEstimatedWaitTime = async (token, service = null, preFetchedStats = null) => {
  if (token.status !== 'waiting') {
    return { estimatedMinutes: 0, estimatedCalledAt: null };
  }

  const position = await getTokenPosition(token);
  const stats = preFetchedStats || await module.exports.getQueueStats(token.serviceId);
  const targetService = service || await Service.findById(token.serviceId);
  
  // Cold-start fallback: if stats.avgWaitMinutes is 0, use capacityPerHour to estimate, default to 5
  const fallbackAvgWait = stats.avgWaitMinutes || (targetService?.capacityPerHour ? Math.round(60 / targetService.capacityPerHour) : 5);
  const estimatedMinutes = (position - 1) * fallbackAvgWait; // position 1 is next, so wait time is (position - 1) * avgWait
  const estimatedCalledAt = new Date(Date.now() + estimatedMinutes * 60000);

  return { estimatedMinutes, estimatedCalledAt };
};

/**
 * Bulk compute positions for multiple tokens (avoids N+1 queries).
 * Returns a Map of tokenId -> position.
 */
const getTokenPositions = async (tokens) => {
  const waitingTokens = tokens.filter(t => t.status === 'waiting');
  if (waitingTokens.length === 0) {
    return new Map(tokens.map(t => [t._id.toString(), 0]));
  }

  // Group tokens by serviceId
  const byService = {};
  for (const t of waitingTokens) {
    const sid = (t.serviceId._id || t.serviceId).toString();
    if (!byService[sid]) byService[sid] = [];
    byService[sid].push(t);
  }

  const positions = new Map(tokens.map(t => [t._id.toString(), 0]));

  // For each service, compute positions in bulk with a single aggregation
  for (const [sid, serviceTokens] of Object.entries(byService)) {
    // Get all waiting tokens for this service, sorted by priority and createdAt
    const allWaiting = await Token.find({
      serviceId: sid,
      status: 'waiting',
    }).sort({ createdAt: 1 }).select('_id priority createdAt').lean();

    // Sort: emergency first, then normal (stable sort preserves createdAt within each priority)
    allWaiting.sort((a, b) => {
      if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
      if (a.priority !== 'emergency' && b.priority === 'emergency') return 1;
      return 0;
    });

    // Build position map from sorted order
    const posMap = new Map();
    allWaiting.forEach((t, idx) => {
      posMap.set(t._id.toString(), idx + 1); // 1-based
    });

    // Assign positions to requested tokens
    for (const t of serviceTokens) {
      const tid = t._id.toString();
      positions.set(tid, posMap.get(tid) || 0);
    }
  }

  return positions;
};

module.exports = {
  queueEvents,
  getQueueForService,
  getQueueStats,
  getTokenPosition,
  getTokenPositions,
  bookToken,
  callNextToken,
  skipToken,
  cancelToken,
  getAnalytics,
  cancelExpiredTokens,
  getEstimatedWaitTime,
};
