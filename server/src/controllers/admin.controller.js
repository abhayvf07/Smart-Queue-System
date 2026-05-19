const mongoose = require('mongoose');
const Token = require('../models/Token');
const queueService = require('../services/queue.service');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');

/**
 * GET /api/admin/tokens
 * Get all tokens with filters
 */
const getAllTokens = async (req, res, next) => {
  try {
    const { status, serviceId, priority, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Whitelist validation to prevent NoSQL injection
    const validStatuses = ['waiting', 'serving', 'completed', 'cancelled', 'skipped'];
    const validPriorities = ['normal', 'emergency'];

    if (status) {
      if (!validStatuses.includes(status)) throw new ApiError(400, 'Invalid status filter.');
      filter.status = status;
    }
    if (serviceId) {
      if (!mongoose.Types.ObjectId.isValid(serviceId)) throw new ApiError(400, 'Invalid service ID.');
      filter.serviceId = serviceId;
    }
    if (priority) {
      if (!validPriorities.includes(priority)) throw new ApiError(400, 'Invalid priority filter.');
      filter.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tokens, total] = await Promise.all([
      Token.find(filter)
        .populate('userId', 'name email')
        .populate('serviceId', 'name prefix')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Token.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        tokens,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/call-next/:serviceId
 * Call the next token in queue
 */
const callNext = async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      throw new ApiError(400, 'Invalid service ID.');
    }

    const calledToken = await queueService.callNextToken(serviceId);

    // Notify the user whose token was called
    if (calledToken.userId) {
      const userId = calledToken.userId._id || calledToken.userId;
      notificationService.notifyTokenCalled(userId.toString(), calledToken);
    }

    // Get updated queue and notify approaching users
    const queue = await queueService.getQueueForService(serviceId);
    const stats = await queueService.getQueueStats(serviceId);

    // Notify users who are approaching (position ≤ 2)
    const waitingTokens = queue.filter((t) => t.status === 'waiting');
    for (let i = 0; i < Math.min(2, waitingTokens.length); i++) {
      const t = waitingTokens[i];
      if (t.userId) {
        const uid = t.userId._id || t.userId;
        notificationService.notifyTokenApproaching(uid.toString(), {
          ...t,
          position: i + 1,
        });
      }
    }

    // Broadcast to all
    notificationService.broadcastQueueUpdate(serviceId, queue);
    notificationService.broadcastQueueStats(serviceId, stats);
    notificationService.broadcastLiveDisplay(serviceId, { queue, stats, currentToken: calledToken });

    res.status(200).json({
      success: true,
      message: `Token ${calledToken.tokenNumber} is now being served.`,
      data: { token: calledToken },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/update-status/:tokenId
 * Update token status (skip, complete, etc.)
 */
const updateTokenStatus = async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(tokenId)) {
      throw new ApiError(400, 'Invalid Token ID format.');
    }

    if (!['waiting', 'serving', 'completed', 'skipped'].includes(status)) {
      throw new ApiError(400, 'Invalid status.');
    }

    const updateData = { status };
    if (status === 'completed') updateData.completedAt = new Date();
    if (status === 'serving') updateData.calledAt = new Date();

    const token = await Token.findByIdAndUpdate(tokenId, updateData, { new: true })
      .populate('userId', 'name email')
      .populate('serviceId', 'name prefix');

    if (!token) throw new ApiError(404, 'Token not found.');

    // Broadcast
    const queue = await queueService.getQueueForService(token.serviceId._id || token.serviceId);
    const stats = await queueService.getQueueStats(
      (token.serviceId._id || token.serviceId).toString()
    );
    const sid = (token.serviceId._id || token.serviceId).toString();
    notificationService.broadcastQueueUpdate(sid, queue);
    notificationService.broadcastQueueStats(sid, stats);

    res.status(200).json({
      success: true,
      message: `Token status updated to ${status}.`,
      data: { token },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/emergency-token
 * Create an emergency priority token (jumps to front)
 */
const createEmergencyToken = async (req, res, next) => {
  try {
    const { serviceId, userId } = req.body;

    if (!serviceId) {
      throw new ApiError(400, 'Service ID is required.');
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      throw new ApiError(400, 'Invalid service ID.');
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid User ID format.');
    }

    // Use the requesting admin's ID if no userId provided
    const targetUserId = userId || req.user._id;

    const token = await queueService.bookToken(targetUserId, serviceId, 'emergency');

    // Broadcast
    const queue = await queueService.getQueueForService(serviceId);
    const stats = await queueService.getQueueStats(serviceId);
    notificationService.broadcastQueueUpdate(serviceId, queue);
    notificationService.broadcastQueueStats(serviceId, stats);

    res.status(201).json({
      success: true,
      message: `Emergency token ${token.tokenNumber} created!`,
      data: { token },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics
 * Get queue analytics
 */
const getAnalytics = async (req, res, next) => {
  try {
    const { serviceId } = req.query;
    const analytics = await queueService.getAnalytics(serviceId);

    // Also get service-wise breakdown
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    const [serviceBreakdown, statusCounts, priorityCounts] = await Promise.all([
      Token.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: { serviceId: '$serviceId', status: '$status' },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: '_id.serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: '$service' },
        {
          $group: {
            _id: '$_id.serviceId',
            serviceName: { $first: '$service.name' },
            statuses: {
              $push: {
                status: '$_id.status',
                count: '$count',
              },
            },
          },
        },
      ]),
      // Aggregate status counts for all today's tokens
      Token.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Aggregate priority counts for all today's tokens
      Token.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

    // Convert array results to objects for easier frontend consumption
    const statusCountsObj = {};
    statusCounts.forEach((s) => { statusCountsObj[s._id] = s.count; });

    const priorityCountsObj = {};
    priorityCounts.forEach((p) => { priorityCountsObj[p._id] = p.count; });

    const totalTokensToday = Object.values(statusCountsObj).reduce((sum, c) => sum + c, 0);

    res.status(200).json({
      success: true,
      data: {
        ...analytics,
        serviceBreakdown,
        statusCounts: statusCountsObj,
        priorityCounts: priorityCountsObj,
        totalTokensToday,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTokens,
  callNext,
  updateTokenStatus,
  createEmergencyToken,
  getAnalytics,
};
