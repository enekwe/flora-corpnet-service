/**
 * Authentication Middleware
 * Verifies JWT tokens from main Flora app
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const auth = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET || 'flora-dev-secret-change-in-production';
    const decoded = jwt.verify(token, secret);

    // Attach user info to request
    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.role === 'admin'
    };

    logger.debug(`Authenticated user: ${req.user.email}`);

    next();
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

module.exports = auth;
