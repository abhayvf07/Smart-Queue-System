const express = require('express');
const { handleChatMessage } = require('../controllers/chatbot.controller');
const { protect } = require('../middleware/auth');
const { chatbotLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Require protection for chatbot conversation
router.post('/message', protect, chatbotLimiter, handleChatMessage);

module.exports = router;
