const express = require('express');
const {
  getAllTokens,
  callNext,
  updateTokenStatus,
  createEmergencyToken,
  getAnalytics,
  getForecastData,
  getSentimentAnalytics,
  getAnomalyStatus,
} = require('../controllers/admin.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(protect, requireRole('admin'));

router.get('/tokens', getAllTokens);
router.put('/call-next/:serviceId', callNext);
router.put('/update-status/:tokenId', updateTokenStatus);
router.post('/emergency-token', createEmergencyToken);
router.get('/analytics', getAnalytics);

// AI-powered endpoints
router.get('/forecast', getForecastData);
router.get('/sentiment', getSentimentAnalytics);
router.get('/anomaly-status', getAnomalyStatus);

module.exports = router;
