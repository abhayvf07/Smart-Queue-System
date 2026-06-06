const mongoose = require("mongoose");
const Token = require("../models/Token");
const queueService = require("../services/queue.service");
const notificationService = require("../services/notification.service");
const anomalyService = require("../services/anomaly.service");
const ApiError = require("../utils/ApiError");

/**
 * POST /api/tokens/book
 * Book a new token for a service
 */
const bookToken = async (req, res, next) => {
  try {
    const { serviceId, priority } = req.body;

    if (!serviceId) {
      throw new ApiError(400, "Please select a service.");
    }

    // Prevent priority spoofing: only admins can set emergency
    const actualPriority = req.user.role === 'admin' && priority === 'emergency' ? 'emergency' : 'normal';

    const token = await queueService.bookToken(req.user._id, serviceId, actualPriority);

    // Get updated queue and broadcast
    const queue = await queueService.getQueueForService(serviceId);
    const stats = await queueService.getQueueStats(serviceId);
    notificationService.broadcastQueueUpdate(serviceId, queue);
    notificationService.broadcastQueueStats(serviceId, stats);
    notificationService.broadcastLiveDisplay(serviceId, { queue, stats });

    // Get position and wait time for the new token
    const fullToken = await Token.findById(token._id)
      .populate("serviceId", "name prefix capacityPerHour")
      .lean();

    // AI-powered anomaly detection for overload alerts (replaces hardcoded threshold)
    const anomaly = await anomalyService.detectAnomaly(serviceId);
    if (anomaly.isAnomaly) {
      const serviceObj = fullToken.serviceId;
      notificationService.broadcastOverloadAlert(serviceId, {
        serviceId,
        waiting: stats.waiting,
        threshold: anomaly.threshold,
        zScore: anomaly.zScore,
        message: `⚠️ Service "${serviceObj?.name || 'Service'}" is experiencing unusual congestion! (${stats.waiting} waiting, Z-score: ${anomaly.zScore})`,
      });
    }

    const position = await queueService.getTokenPosition(token);
    const { estimatedMinutes, estimatedCalledAt } = await queueService.getEstimatedWaitTime(token, fullToken.serviceId);

    res.status(201).json({
      success: true,
      message: `Token ${token.tokenNumber} booked successfully!`,
      data: {
        token: { ...fullToken, position, estimatedMinutes, estimatedCalledAt },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tokens/my-tokens
 * Get current user's active tokens
 */
const getMyTokens = async (req, res, next) => {
  try {
    const tokens = await Token.find({
      userId: req.user._id,
      status: { $in: ["waiting", "serving"] },
    })
      .populate("serviceId", "name prefix capacityPerHour")
      .sort({ createdAt: -1 })
      .lean();

    // Optimize N+1: Pre-fetch stats for unique services
    const uniqueServiceIds = [...new Set(tokens.map(t => t.serviceId._id.toString()))];
    const statsMap = {};
    for (const sid of uniqueServiceIds) {
      statsMap[sid] = await queueService.getQueueStats(sid);
    }

    const tokensWithPositions = await Promise.all(
      tokens.map(async (t) => {
        const position = await queueService.getTokenPosition(t);
        const preFetchedStats = statsMap[t.serviceId._id.toString()];
        const { estimatedMinutes, estimatedCalledAt } = await queueService.getEstimatedWaitTime(t, t.serviceId, preFetchedStats);
        return {
          ...t,
          position,
          estimatedMinutes,
          estimatedCalledAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: { tokens: tokensWithPositions },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tokens/queue-status/:serviceId
 * Get live queue status for a service
 */
const getQueueStatus = async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      throw new ApiError(400, "Invalid service ID");
    }

    const [queue, stats] = await Promise.all([
      queueService.getQueueForService(serviceId),
      queueService.getQueueStats(serviceId),
    ]);

    res.status(200).json({
      success: true,
      data: { queue, stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tokens/cancel/:id
 * Cancel own token
 */
const cancelToken = async (req, res, next) => {
  try {
    const token = await queueService.cancelToken(req.params.id, req.user._id);

    const queue = await queueService.getQueueForService(token.serviceId);
    const stats = await queueService.getQueueStats(token.serviceId);
    
    // Broadcast updates
    notificationService.broadcastQueueUpdate(token.serviceId, queue);
    notificationService.broadcastQueueStats(token.serviceId, stats);
    notificationService.broadcastLiveDisplay(
      token.serviceId,
      { queue, stats }
    );
    
    res.status(200).json({
      success: true,
      message: "Token cancelled successfully.",
      data: { token },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tokens/history
 * Get user's token history
 */
const getTokenHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      Token.find({ userId: req.user._id })
        .populate("serviceId", "name prefix")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Token.countDocuments({ userId: req.user._id }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        tokens,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookToken,
  getMyTokens,
  getQueueStatus,
  cancelToken,
  getTokenHistory,
};
