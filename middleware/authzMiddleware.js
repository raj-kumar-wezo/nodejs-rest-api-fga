// Simple role-based authorization middleware
// No external dependencies required

const AuthorizationService = require('../fga/authz');

// Middleware to extract user from request headers
const extractUser = (req, res, next) => {
  // In a real application, this would extract user from JWT token
  // For demo purposes, we'll use a header or default to 'admin'
  const user = req.headers['x-user-id'] || req.headers['authorization'] || 'admin';
  req.user = user;
  next();
};

// Middleware to check if user can read all users
const canReadAllUsers = async (req, res, next) => {
  try {
    const allowed = await AuthorizationService.canReadAllUsers(req.user);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to read all users'
      });
    }
    next();
  } catch (error) {
    console.error('Authorization check failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
};

// Middleware to check if user can read a specific user
const canReadUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const allowed = await AuthorizationService.canReadUser(userId, req.user);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to read this user'
      });
    }
    next();
  } catch (error) {
    console.error('Authorization check failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
};

// Middleware to check if user can write to a specific user
const canWriteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const allowed = await AuthorizationService.canWriteUser(userId, req.user);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to modify this user'
      });
    }
    next();
  } catch (error) {
    console.error('Authorization check failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
};

// Middleware to check if user can delete a specific user
const canDeleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const allowed = await AuthorizationService.canDeleteUser(userId, req.user);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this user'
      });
    }
    next();
  } catch (error) {
    console.error('Authorization check failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
};

// Middleware to check if user can create users
const canCreateUsers = async (req, res, next) => {
  try {
    const allowed = await AuthorizationService.canCreateUsers(req.user);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create users'
      });
    }
    next();
  } catch (error) {
    console.error('Authorization check failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
};

module.exports = {
  extractUser,
  canReadAllUsers,
  canReadUser,
  canWriteUser,
  canDeleteUser,
  canCreateUsers
}; 