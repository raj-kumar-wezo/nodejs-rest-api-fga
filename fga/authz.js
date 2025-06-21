const { getFgaClient } = require('./client');

// Authorization service with OpenFGA integration
class AuthorizationService {
  
  static #isValid(id) {
    return id && String(id).trim().length > 0;
  }
  
  // Check if user can read a specific user
  static async canReadUser(userId, requestingUser) {
    if (!this.#isValid(userId) || !this.#isValid(requestingUser)) return false;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      // Fallback: allow if same user or admin
      return requestingUser === userId || requestingUser === 'admin';
    }

    try {
      const { allowed } = await fgaClient.check({
        user: `user:${requestingUser}`,
        relation: 'can_read',
        object: `user:${userId}`
      });
      return allowed;
    } catch (error) {
      console.error('OpenFGA check failed:', error.message);
      // Fallback: allow if same user or admin
      return requestingUser === userId || requestingUser === 'admin';
    }
  }

  // Check if user can write to a specific user
  static async canWriteUser(userId, requestingUser) {
    if (!this.#isValid(userId) || !this.#isValid(requestingUser)) return false;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      // Fallback: allow if same user or admin
      return requestingUser === userId || requestingUser === 'admin';
    }

    try {
      const { allowed } = await fgaClient.check({
        user: `user:${requestingUser}`,
        relation: 'can_write',
        object: `user:${userId}`
      });
      return allowed;
    } catch (error) {
      console.error('OpenFGA check failed:', error.message);
      // Fallback: allow if same user or admin
      return requestingUser === userId || requestingUser === 'admin';
    }
  }

  // Check if user can delete a specific user
  static async canDeleteUser(userId, requestingUser) {
    if (!this.#isValid(userId) || !this.#isValid(requestingUser)) return false;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      // Fallback: allow if same user or admin
      return requestingUser === userId || requestingUser === 'admin';
    }

    try {
      const { allowed } = await fgaClient.check({
        user: `user:${requestingUser}`,
        relation: 'can_delete',
        object: `user:${userId}`
      });
      return allowed;
    } catch (error) {
      console.error('OpenFGA check failed:', error.message);
      // Fallback: allow if same user or admin
      return requestingUser === userId || requestingUser === 'admin';
    }
  }

  // Check if user can read all users
  static async canReadAllUsers(requestingUser) {
    if (!this.#isValid(requestingUser)) return false;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      // Fallback: allow admin only
      return requestingUser === 'admin';
    }

    try {
      const { allowed } = await fgaClient.check({
        user: `user:${requestingUser}`,
        relation: 'can_read_all',
        object: 'users_collection:all'
      });
      return allowed;
    } catch (error) {
      console.error('OpenFGA check failed:', error.message);
      // Fallback: allow admin only
      return requestingUser === 'admin';
    }
  }

  // Check if user can create users
  static async canCreateUsers(requestingUser) {
    if (!this.#isValid(requestingUser)) return false;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      // Fallback: allow admin only
      return requestingUser === 'admin';
    }

    try {
      const { allowed } = await fgaClient.check({
        user: `user:${requestingUser}`,
        relation: 'can_create',
        object: 'users_collection:all'
      });
      return allowed;
    } catch (error) {
      console.error('OpenFGA check failed:', error.message);
      // Fallback: allow admin only
      return requestingUser === 'admin';
    }
  }

  // Create OpenFGA relationships for a new user
  static async createUserRelationships(userId, createdBy) {
    if (!this.#isValid(userId) || !this.#isValid(createdBy)) return;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      console.log(`OpenFGA not available, skipping relationship creation for user ${userId}`);
      return;
    }

    try {
      const relationships = [
        // The new user is the owner of their own record
        { user: `user:${userId}`, relation: 'owner', object: `user:${userId}` },
        { user: `user:${userId}`, relation: 'can_read', object: `user:${userId}` },
        { user: `user:${userId}`, relation: 'can_write', object: `user:${userId}` },
        { user: `user:${userId}`, relation: 'can_delete', object: `user:${userId}` },

        // The admin user is given all permissions on the new user's record
        { user: `user:admin`, relation: 'can_read', object: `user:${userId}` },
        { user: `user:admin`, relation: 'can_write', object: `user:${userId}` },
        { user: `user:admin`, relation: 'can_delete', object: `user:${userId}` },
      ];

      await fgaClient.write({
        writes: relationships
      });

      console.log(`Created OpenFGA relationships for user ${userId}`);
    } catch (error) {
      console.error('Failed to create OpenFGA relationships:', error.message);
    }
  }

  // Remove OpenFGA relationships when user is deleted
  static async removeUserRelationships(userId) {
    if (!this.#isValid(userId)) return;
    const fgaClient = getFgaClient();
    
    if (!fgaClient) {
      console.log(`OpenFGA not available, skipping relationship removal for user ${userId}`);
      return;
    }

    try {
      // Tuples to delete when a user is removed
      const relationshipsToDelete = [
        {
          user: `user:${userId}`,
          relation: 'owner',
          object: `user:${userId}`
        }
      ];

      await fgaClient.write({
        deletes: relationshipsToDelete
      });

      console.log(`Removed OpenFGA relationships for user ${userId}`);
    } catch (error) {
      console.error('Failed to remove OpenFGA relationships:', error.message);
    }
  }
}

module.exports = AuthorizationService; 