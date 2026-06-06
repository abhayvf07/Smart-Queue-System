const express = require('express');
const { protect } = require('../middleware/auth');
const { predictWaitTime } = require('../services/prediction.service');
const queueService = require('../services/queue.service');
const Token = require('../models/Token');

const router = express.Router();

/**
 * GET /api/predictions/wait-time/:serviceId
 * Get ML-predicted wait time for a service
 */
router.get('/wait-time/:serviceId', protect, async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    // Get current queue stats for context
    const waitingCount = await Token.countDocuments({ serviceId, status: 'waiting' });
    const stats = await queueService.getQueueStats(serviceId);

    const prediction = await predictWaitTime(serviceId, waitingCount, waitingCount);

    res.status(200).json({
      success: true,
      data: {
        prediction,
        currentStats: {
          waiting: stats.waiting,
          avgWaitMinutes: stats.avgWaitMinutes,
          completedToday: stats.completedToday,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
