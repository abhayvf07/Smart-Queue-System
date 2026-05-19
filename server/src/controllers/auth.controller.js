const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Generate JWT
const generateJWT = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      throw new ApiError(400, 'Please provide name, email, and password.');
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, 'Please provide a valid email address.');
    }

    // Validate password length
    if (password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters.');
    }

    // Validate name length
    if (name.length < 2 || name.length > 50) {
      throw new ApiError(400, 'Name must be between 2 and 50 characters.');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ApiError(400, 'An account with this email already exists.');
    }

    // Create user (only allow 'user' role via registration; admin accounts created via seed)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'user',
    });

    // Generate token
    const token = generateJWT(user._id);

    logger.info(`User registered: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new ApiError(400, 'Please provide email and password.');
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, 'Please provide a valid email address.');
    }

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    // Generate token
    const token = generateJWT(user._id);

    logger.info(`User logged in: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
