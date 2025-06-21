const { pool } = require('../db');
const Joi = require('joi');
const AuthorizationService = require('../fga/authz');

// Validation schemas
const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 255 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 255 characters'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Please provide a valid email address'
  })
});

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const requestingUser = req.user;
    const isAllowed = await AuthorizationService.canReadAllUsers(requestingUser);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to view all users.'
      });
    }

    const [rows] = await pool.execute('SELECT * FROM users ORDER BY created_at DESC');
    
    res.status(200).json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch users'
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    const isAllowed = await AuthorizationService.canReadUser(id, requestingUser);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to view this user.'
      });
    }
    
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user'
    });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    // Get the requesting user's ID from the middleware
    const requestingUser = req.user;

    // **Authorization Check**
    const isAllowed = await AuthorizationService.canCreateUsers(requestingUser);
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to create users.'
      });
    }

    // Validate input
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const { name, email } = value;
    
    // Check if email already exists
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }
    
    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    
    // Fetch the created user
    const [newUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    
    // Create OpenFGA relationships for the new user
    await AuthorizationService.createUserRelationships(result.insertId, requestingUser);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create user'
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    const isAllowed = await AuthorizationService.canWriteUser(id, requestingUser);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to update this user.'
      });
    }
    
    // Validate input
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.details[0].message
      });       
    }

    // Check if user exists
    const [existingUser] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Check if email is being updated and if it already exists
    if (value.email) {
      const [emailCheck] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [value.email, id]
      );
      if (emailCheck.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'User with this email already exists'
        });
      }
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    if (value.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(value.name);
    }
    
    if (value.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(value.email);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    // Update user
    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Fetch updated user
    const [updatedUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update user'
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    const isAllowed = await AuthorizationService.canDeleteUser(id, requestingUser);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to delete this user.'
      });
    }
    
    // Check if user exists
    const [existingUser] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Delete user
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    
    // Remove OpenFGA relationships for the deleted user
    await AuthorizationService.removeUserRelationships(id);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete user'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
}; 