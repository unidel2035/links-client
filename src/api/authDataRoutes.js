// authDataLinkDB.js - API routes for authentication data management using LinkDB
import express from 'express';
import AuthStorageService from '../services/AuthStorageService.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();
const authStorage = new AuthStorageService();

/**
 * Hash password with salt
 * @param {string} password - Plain text password
 * @param {string} salt - Salt (optional, will generate if not provided)
 * @returns {object} - { hash, salt, algorithm }
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }

  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  return {
    hash,
    salt,
    algorithm: 'pbkdf2-sha512',
    iterations: 100000
  };
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @param {string} salt - Stored salt
 * @returns {boolean} - Match result
 */
function verifyPassword(password, hash, salt) {
  const verification = hashPassword(password, salt);
  return verification.hash === hash;
}

// ==================== USER ROUTES ====================

/**
 * POST /api/auth-data/users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, profile } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        error: 'Username and email are required'
      });
    }

    // Check if user already exists
    const existingUser = await authStorage.findUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this username already exists'
      });
    }

    const existingEmail = await authStorage.findUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Create user
    const userData = {
      username,
      email,
      profile: profile || {}
    };

    const user = await authStorage.createUser(userData);

    // Set password if provided
    if (password) {
      const passwordData = hashPassword(password);
      await authStorage.setPassword(user.userId, passwordData);
    }

    logger.info({ userId: user.userId, username }, 'User created via API');

    res.json({
      success: true,
      message: 'User created successfully',
      data: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create user');
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      details: error.message
    });
  }
});

/**
 * GET /api/auth-data/users
 * Get all users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await authStorage.getAllUsers();

    res.json({
      success: true,
      data: users.map(user => ({
        userId: user.userId,
        username: user.username,
        email: user.email,
        profile: user.profile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get users');
    res.status(500).json({
      success: false,
      error: 'Failed to get users',
      details: error.message
    });
  }
});

/**
 * GET /api/auth-data/users/:userId
 * Get user by ID
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await authStorage.getUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        profile: user.profile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get user');
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
      details: error.message
    });
  }
});

/**
 * PUT /api/auth-data/users/:userId
 * Update user
 */
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, profile } = req.body;

    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (profile) updates.profile = profile;

    const updatedUser = await authStorage.updateUser(userId, updates);

    logger.info({ userId }, 'User updated via API');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        userId: updatedUser.userId,
        username: updatedUser.username,
        email: updatedUser.email,
        profile: updatedUser.profile,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update user');
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      details: error.message
    });
  }
});

/**
 * DELETE /api/auth-data/users/:userId
 * Delete user and all associated data
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await authStorage.deleteUser(userId);

    logger.info({ userId }, 'User deleted via API');

    res.json({
      success: true,
      message: 'User and associated data deleted successfully'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete user');
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      details: error.message
    });
  }
});

// ==================== TOKEN ROUTES ====================

/**
 * POST /api/auth-data/users/:userId/tokens
 * Create a new token for a user
 */
router.post('/users/:userId/tokens', async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions, expiresAt, description } = req.body;

    // Verify user exists
    const user = await authStorage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate API key
    const apiKey = crypto.randomBytes(32).toString('hex');

    const tokenData = {
      apiKey,
      permissions: permissions || [],
      expiresAt: expiresAt || null,
      description: description || ''
    };

    const token = await authStorage.createToken(userId, tokenData);

    logger.info({ userId, tokenId: token.tokenId }, 'Token created via API');

    res.json({
      success: true,
      message: 'Token created successfully',
      data: {
        tokenId: token.tokenId,
        apiKey: token.apiKey,
        permissions: token.permissions,
        expiresAt: token.expiresAt,
        description: token.description,
        createdAt: token.createdAt
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create token');
    res.status(500).json({
      success: false,
      error: 'Failed to create token',
      details: error.message
    });
  }
});

/**
 * GET /api/auth-data/users/:userId/tokens
 * Get all tokens for a user
 */
router.get('/users/:userId/tokens', async (req, res) => {
  try {
    const { userId } = req.params;

    const tokens = await authStorage.getUserTokens(userId);

    res.json({
      success: true,
      data: tokens.map(token => ({
        tokenId: token.tokenId,
        apiKey: token.apiKey, // Be cautious about exposing API keys
        permissions: token.permissions,
        expiresAt: token.expiresAt,
        description: token.description,
        createdAt: token.createdAt
      }))
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get tokens');
    res.status(500).json({
      success: false,
      error: 'Failed to get tokens',
      details: error.message
    });
  }
});

/**
 * DELETE /api/auth-data/tokens/:tokenId
 * Delete a token
 */
router.delete('/tokens/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    await authStorage.deleteToken(tokenId);

    logger.info({ tokenId }, 'Token deleted via API');

    res.json({
      success: true,
      message: 'Token deleted successfully'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete token');
    res.status(500).json({
      success: false,
      error: 'Failed to delete token',
      details: error.message
    });
  }
});

/**
 * POST /api/auth-data/tokens/verify
 * Verify a token by API key
 */
router.post('/tokens/verify', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }

    const token = await authStorage.findTokenByApiKey(apiKey);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    // Check if token is expired
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      });
    }

    res.json({
      success: true,
      data: {
        tokenId: token.tokenId,
        userId: token.userId,
        permissions: token.permissions,
        expiresAt: token.expiresAt
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to verify token');
    res.status(500).json({
      success: false,
      error: 'Failed to verify token',
      details: error.message
    });
  }
});

// ==================== PASSWORD ROUTES ====================

/**
 * POST /api/auth-data/users/:userId/password
 * Set/update password for a user
 */
router.post('/users/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Verify user exists
    const user = await authStorage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Hash password
    const passwordData = hashPassword(password);

    // Set password
    await authStorage.setPassword(userId, passwordData);

    logger.info({ userId }, 'Password set via API');

    res.json({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to set password');
    res.status(500).json({
      success: false,
      error: 'Failed to set password',
      details: error.message
    });
  }
});

/**
 * POST /api/auth-data/users/:userId/password/verify
 * Verify password for a user
 */
router.post('/users/:userId/password/verify', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Get user password
    const passwordData = await authStorage.getUserPassword(userId);

    if (!passwordData) {
      return res.status(404).json({
        success: false,
        error: 'Password not set for this user'
      });
    }

    // Verify password
    const isValid = verifyPassword(password, passwordData.hash, passwordData.salt);

    res.json({
      success: true,
      data: {
        valid: isValid
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to verify password');
    res.status(500).json({
      success: false,
      error: 'Failed to verify password',
      details: error.message
    });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

/**
 * POST /api/auth-data/login
 * Login with username/email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if ((!username && !email) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username/email and password are required'
      });
    }

    // Find user
    let user = null;
    if (username) {
      user = await authStorage.findUserByUsername(username);
    } else if (email) {
      user = await authStorage.findUserByEmail(email);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const passwordData = await authStorage.getUserPassword(user.userId);

    if (!passwordData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isValid = verifyPassword(password, passwordData.hash, passwordData.salt);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Create session token
    const sessionToken = await authStorage.createToken(user.userId, {
      apiKey: crypto.randomBytes(32).toString('hex'),
      permissions: ['session'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      description: 'Session token'
    });

    logger.info({ userId: user.userId }, 'User logged in via API');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        sessionToken: sessionToken.apiKey,
        expiresAt: sessionToken.expiresAt
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Login failed');
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: error.message
    });
  }
});

// ==================== STATISTICS ROUTES ====================

/**
 * GET /api/auth-data/statistics
 * Get statistics about authentication data
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await authStorage.getStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get statistics');
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      details: error.message
    });
  }
});

/**
 * DELETE /api/auth-data/clear-all
 * Clear all authentication data (DANGEROUS - admin only)
 */
router.delete('/clear-all', async (req, res) => {
  try {
    // Add authentication/authorization check here in production
    const { confirm } = req.body;

    if (confirm !== 'YES_DELETE_ALL') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Set confirm: "YES_DELETE_ALL" to proceed'
      });
    }

    await authStorage.clearAllAuthData();

    logger.warn('All authentication data cleared via API');

    res.json({
      success: true,
      message: 'All authentication data cleared'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to clear authentication data');
    res.status(500).json({
      success: false,
      error: 'Failed to clear authentication data',
      details: error.message
    });
  }
});

export default router;
