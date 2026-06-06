const express = require('express');
const { register, login, getMe, refreshToken, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', authLimiter, protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
