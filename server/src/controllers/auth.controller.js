const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Generate Access JWT
const generateJWT = (id) => {
  return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '1h',
  });
};

// Generate Refresh JWT
const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
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

    // Generate tokens
    const token = generateJWT(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshTokens.push(refreshToken);
    // Cap refresh tokens at 5 to prevent unbounded array growth
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save();

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
        refreshToken,
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

    // Generate tokens
    const token = generateJWT(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshTokens.push(refreshToken);
    // Cap refresh tokens at 5 to prevent unbounded array growth
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save();

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
        refreshToken,
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

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required.');
    }

    // Verify token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw new ApiError(401, 'Invalid token type.');
    }

    // Check if user still exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      throw new ApiError(401, 'User no longer exists.');
    }

    // Validate refresh token is in the database
    if (!user.refreshTokens.includes(refreshToken)) {
      throw new ApiError(401, 'Refresh token has been invalidated.');
    }

    // Remove old refresh token
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);

    // Generate new tokens
    const newAccessToken = generateJWT(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshTokens.push(newRefreshToken);
    // Cap refresh tokens at 5 to prevent unbounded array growth
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user,
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Refresh token expired. Please login again.'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Invalid refresh token.'));
    } else {
      next(error);
    }
  }
};

/**
 * POST /api/auth/logout
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      // Clear all refresh tokens
      req.user.refreshTokens = [];
      await req.user.save();
    }
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, refreshToken, logout };
