const express = require('express');
const {
  getServices,
  createService,
  updateService,
  deleteService,
  getRecommendedServices,
  classifyServiceEndpoint,
} = require('../controllers/service.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: Get all active services
router.get('/', getServices);
router.get('/recommend', getRecommendedServices);

// Admin only: Create, update, delete services
router.post('/', protect, requireRole('admin'), createService);
router.put('/:id', protect, requireRole('admin'), updateService);
router.delete('/:id', protect, requireRole('admin'), deleteService);

// AI-powered: Classify service (admin only)
router.post('/classify', protect, requireRole('admin'), classifyServiceEndpoint);

module.exports = router;
