const express = require('express');
const router = express.Router();
const UsersController = require('../controllers/usersController');
const {
  extractUser,
  canReadAllUsers,
  canReadUser,
  canWriteUser,
  canDeleteUser,
  canCreateUsers
} = require('../middleware/authzMiddleware');

// Apply user extraction middleware to all routes
router.use(extractUser);

// GET /users - Get all users
router.get('/', canReadAllUsers, UsersController.getAllUsers);

// GET /users/:id - Get user by ID
router.get('/:id', canReadUser, UsersController.getUserById);

// POST /users - Create new user
router.post('/', canCreateUsers, UsersController.createUser);

// PUT /users/:id - Update user by ID
router.put('/:id', canWriteUser, UsersController.updateUser);

// DELETE /users/:id - Delete user by ID
router.delete('/:id', canDeleteUser, UsersController.deleteUser);

module.exports = router; 