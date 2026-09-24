const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Verifies JWT Access Token and attaches user to req.user
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Extract Bearer token from Authorization Header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Fallback: Check cookies for accessToken if used
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // No token provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.',
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support both `userId` or `id` decoded property
    const userId = decoded.userId || decoded.id;

    // 3. Fetch user from MongoDB (Excluding password and sensitive tokens)
    const user = await User.findById(userId).select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. User account no longer exists.',
      });
    }

    // 4. Attach user instance to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth Middleware Error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh your access token.',
        isExpired: true,
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or corrupted access token.',
      error: error.message,
    });
  }
};

/**
 * Admin Access Only
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden. Admin privileges are required to access this resource.',
  });
};

const employerOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden. Employer privileges are required to access this resource.',
  });
};

const investorOnly = (req, res, next) => {
  if (req.user && req.user.role === 'investor') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden. Investor privileges are required to access this resource.',
  });
};

/**
 * Flexible Role Authorization Helper
 * Example usage: authorize('admin', 'manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. User role '${req.user?.role}' is not authorized to access this route.`,
      });
    }
    next();
  };
};

module.exports = {
  protect,
  adminOnly,
  employerOnly,
  investorOnly,
  authorize,
};