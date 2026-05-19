const express = require('express');
const {
  bookToken,
  getMyTokens,
  getQueueStatus,
  cancelToken,
  getTokenHistory,
} = require('../controllers/token.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public route — no auth needed (used by LiveDisplay screens)
router.get('/queue-status/:serviceId', getQueueStatus);

// All other token routes require authentication
router.use(protect);

router.post('/book', bookToken);
router.get('/my-tokens', getMyTokens);
router.put('/cancel/:id', cancelToken);
router.get('/history', getTokenHistory);

module.exports = router;
