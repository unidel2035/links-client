// AuthStorageService.js - Service for storing authentication data using link-cli
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import LinkDBService from './LinkDBService.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directories for storing authentication data
const DATA_DIR = path.join(__dirname, '../../../data/auth-data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');
const PASSWORDS_DIR = path.join(DATA_DIR, 'passwords');
const AUTH_DB_FILE = path.join(DATA_DIR, 'auth.links');

// Type identifiers for links
const USER_TYPE_ID = 2000;      // Links of type (userId 2000) represent users
const TOKEN_LINK_PARENT = 3000; // Parent for token links (tokenId userId)
const PASSWORD_LINK_PARENT = 4000; // Parent for password links (passwordId userId)

/**
 * AuthStorageService - Store authentication data using link-cli
 *
 * Architecture:
 * - Link-cli stores relationships between entities
 * - File system stores the actual data (JSON files)
 * - Links represent entity types and relationships
 *
 * Link schemas:
 * 1. Users: (userId 2000) - represents a user entity
 * 2. Tokens: (tokenId userId) - token belongs to user
 * 3. Passwords: (passwordId userId) - password belongs to user
 *
 * File storage:
 * - data/auth-data/users/{userId}.json - user profile data
 * - data/auth-data/tokens/{tokenId}.json - token data
 * - data/auth-data/passwords/{passwordId}.json - hashed password data
 */
class AuthStorageService {
  constructor() {
    this.linkDB = new LinkDBService(AUTH_DB_FILE);
    this.ensureDataDirectories();
  }

  /**
   * Ensure all data directories exist
   */
  async ensureDataDirectories() {
    const dirs = [DATA_DIR, USERS_DIR, TOKENS_DIR, PASSWORDS_DIR];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch (error) {
        await fs.mkdir(dir, { recursive: true });
        logger.info({ dir }, 'Created auth data directory');
      }
    }
  }

  /**
   * Generate a stable ID from content
   * @param {object} content - Content object
   * @param {string} prefix - ID prefix (e.g., 'user', 'token', 'pwd')
   * @returns {string} - Unique ID
   */
  generateId(content, prefix = '') {
    const contentStr = JSON.stringify(content) + Date.now();
    const hash = crypto.createHash('sha256').update(contentStr).digest('hex');
    const numericId = parseInt(hash.substring(0, 12), 16);
    return prefix ? `${prefix}_${numericId}` : numericId.toString();
  }

  /**
   * Convert string ID to numeric for link storage
   * @param {string} id - String ID
   * @returns {number} - Numeric ID
   */
  idToNumber(id) {
    const hash = crypto.createHash('sha256').update(id).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % 1000000000;
  }

  /**
   * Save data to file
   * @param {string} dir - Directory
   * @param {string} id - Item ID
   * @param {object} data - Data to save
   */
  async saveData(dir, id, data) {
    const filePath = path.join(dir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load data from file
   * @param {string} dir - Directory
   * @param {string} id - Item ID
   * @returns {Promise<object|null>} - Data or null
   */
  async loadData(dir, id) {
    try {
      const filePath = path.join(dir, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Create a new user
   * @param {object} userData - User data (username, email, profile, etc.)
   * @returns {Promise<object>} - Created user with ID
   */
  async createUser(userData) {
    const userId = this.generateId(userData, 'user');
    const userIdNumeric = this.idToNumber(userId);

    // Save user data to file
    const userDataWithId = { ...userData, userId, createdAt: new Date().toISOString() };
    await this.saveData(USERS_DIR, userId, userDataWithId);

    // Create link: (userId, USER_TYPE_ID)
    try {
      await this.linkDB.createLink(userIdNumeric, USER_TYPE_ID);
      logger.info({ userId }, 'User created in link database');
    } catch (error) {
      logger.error({ userId, error: error.message }, 'Failed to create user link');
      throw error;
    }

    return userDataWithId;
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} - User data or null
   */
  async getUser(userId) {
    return await this.loadData(USERS_DIR, userId);
  }

  /**
   * Get all users
   * @returns {Promise<Array<object>>} - Array of users
   */
  async getAllUsers() {
    const allLinks = await this.linkDB.readAllLinks();
    const userLinks = allLinks.filter(link => link.target === USER_TYPE_ID);

    const users = [];
    for (const link of userLinks) {
      try {
        const files = await fs.readdir(USERS_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const userData = await this.loadData(USERS_DIR, file.replace('.json', ''));
            if (userData) {
              users.push(userData);
            }
          }
        }
      } catch (error) {
        logger.warn({ error: error.message }, 'Error reading users directory');
      }
    }

    return users;
  }

  /**
   * Update user data
   * @param {string} userId - User ID
   * @param {object} updates - Data to update
   * @returns {Promise<object>} - Updated user data
   */
  async updateUser(userId, updates) {
    const existingUser = await this.getUser(userId);
    if (!existingUser) {
      throw new Error(`User ${userId} not found`);
    }

    const updatedUser = {
      ...existingUser,
      ...updates,
      userId, // Preserve userId
      updatedAt: new Date().toISOString()
    };

    await this.saveData(USERS_DIR, userId, updatedUser);
    logger.info({ userId }, 'User updated');

    return updatedUser;
  }

  /**
   * Delete user and all associated data (tokens, passwords)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteUser(userId) {
    const userIdNumeric = this.idToNumber(userId);

    // Delete user's tokens
    const userTokens = await this.getUserTokens(userId);
    for (const token of userTokens) {
      await this.deleteToken(token.tokenId);
    }

    // Delete user's passwords
    const userPasswords = await this.getUserPasswords(userId);
    for (const pwd of userPasswords) {
      await this.deletePassword(pwd.passwordId);
    }

    // Delete user link
    const allLinks = await this.linkDB.readAllLinks();
    const userLink = allLinks.find(link => link.source === userIdNumeric && link.target === USER_TYPE_ID);

    if (userLink) {
      await this.linkDB.deleteLink(userLink.id);
    }

    // Delete user data file
    try {
      const filePath = path.join(USERS_DIR, `${userId}.json`);
      await fs.unlink(filePath);
      logger.info({ userId }, 'User deleted');
    } catch (error) {
      logger.warn({ userId, error: error.message }, 'Failed to delete user data file');
    }

    return true;
  }

  // ==================== TOKEN OPERATIONS ====================

  /**
   * Create a new token for a user
   * @param {string} userId - User ID
   * @param {object} tokenData - Token data (apiKey, permissions, expiresAt, etc.)
   * @returns {Promise<object>} - Created token with ID
   */
  async createToken(userId, tokenData) {
    const tokenId = this.generateId(tokenData, 'token');
    const tokenIdNumeric = this.idToNumber(tokenId);
    const userIdNumeric = this.idToNumber(userId);

    // Save token data to file
    const tokenDataWithId = {
      ...tokenData,
      tokenId,
      userId,
      createdAt: new Date().toISOString()
    };
    await this.saveData(TOKENS_DIR, tokenId, tokenDataWithId);

    // Create link: (tokenId, userId)
    try {
      await this.linkDB.createLink(tokenIdNumeric, userIdNumeric);
      logger.info({ tokenId, userId }, 'Token created in link database');
    } catch (error) {
      logger.error({ tokenId, userId, error: error.message }, 'Failed to create token link');
      throw error;
    }

    return tokenDataWithId;
  }

  /**
   * Get token by ID
   * @param {string} tokenId - Token ID
   * @returns {Promise<object|null>} - Token data or null
   */
  async getToken(tokenId) {
    return await this.loadData(TOKENS_DIR, tokenId);
  }

  /**
   * Get all tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<object>>} - Array of tokens
   */
  async getUserTokens(userId) {
    const userIdNumeric = this.idToNumber(userId);
    const allLinks = await this.linkDB.readAllLinks();
    const tokenLinks = allLinks.filter(link => link.target === userIdNumeric);

    const tokens = [];
    try {
      const files = await fs.readdir(TOKENS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const tokenData = await this.loadData(TOKENS_DIR, file.replace('.json', ''));
          if (tokenData && tokenData.userId === userId) {
            tokens.push(tokenData);
          }
        }
      }
    } catch (error) {
      logger.warn({ error: error.message }, 'Error reading tokens directory');
    }

    return tokens;
  }

  /**
   * Delete a token
   * @param {string} tokenId - Token ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteToken(tokenId) {
    const tokenIdNumeric = this.idToNumber(tokenId);

    // Delete token link
    const allLinks = await this.linkDB.readAllLinks();
    const tokenLink = allLinks.find(link => link.source === tokenIdNumeric);

    if (tokenLink) {
      await this.linkDB.deleteLink(tokenLink.id);
    }

    // Delete token data file
    try {
      const filePath = path.join(TOKENS_DIR, `${tokenId}.json`);
      await fs.unlink(filePath);
      logger.info({ tokenId }, 'Token deleted');
    } catch (error) {
      logger.warn({ tokenId, error: error.message }, 'Failed to delete token data file');
    }

    return true;
  }

  // ==================== PASSWORD OPERATIONS ====================

  /**
   * Create/update password for a user
   * @param {string} userId - User ID
   * @param {object} passwordData - Password data (hash, salt, algorithm)
   * @returns {Promise<object>} - Created/updated password with ID
   */
  async setPassword(userId, passwordData) {
    // First, delete existing passwords for this user
    const existingPasswords = await this.getUserPasswords(userId);
    for (const pwd of existingPasswords) {
      await this.deletePassword(pwd.passwordId);
    }

    // Create new password
    const passwordId = this.generateId(passwordData, 'pwd');
    const passwordIdNumeric = this.idToNumber(passwordId);
    const userIdNumeric = this.idToNumber(userId);

    // Save password data to file
    const passwordDataWithId = {
      ...passwordData,
      passwordId,
      userId,
      createdAt: new Date().toISOString()
    };
    await this.saveData(PASSWORDS_DIR, passwordId, passwordDataWithId);

    // Create link: (passwordId, userId)
    try {
      await this.linkDB.createLink(passwordIdNumeric, userIdNumeric);
      logger.info({ passwordId, userId }, 'Password created in link database');
    } catch (error) {
      logger.error({ passwordId, userId, error: error.message }, 'Failed to create password link');
      throw error;
    }

    return passwordDataWithId;
  }

  /**
   * Get password for a user
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} - Password data or null
   */
  async getUserPassword(userId) {
    const passwords = await this.getUserPasswords(userId);
    // Return the most recent password (should only be one)
    return passwords.length > 0 ? passwords[0] : null;
  }

  /**
   * Get all passwords for a user (for migration/history)
   * @param {string} userId - User ID
   * @returns {Promise<Array<object>>} - Array of passwords
   */
  async getUserPasswords(userId) {
    const userIdNumeric = this.idToNumber(userId);
    const allLinks = await this.linkDB.readAllLinks();
    const passwordLinks = allLinks.filter(link => link.target === userIdNumeric);

    const passwords = [];
    try {
      const files = await fs.readdir(PASSWORDS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const passwordData = await this.loadData(PASSWORDS_DIR, file.replace('.json', ''));
          if (passwordData && passwordData.userId === userId) {
            passwords.push(passwordData);
          }
        }
      }
    } catch (error) {
      logger.warn({ error: error.message }, 'Error reading passwords directory');
    }

    return passwords;
  }

  /**
   * Delete a password
   * @param {string} passwordId - Password ID
   * @returns {Promise<boolean>} - Success
   */
  async deletePassword(passwordId) {
    const passwordIdNumeric = this.idToNumber(passwordId);

    // Delete password link
    const allLinks = await this.linkDB.readAllLinks();
    const passwordLink = allLinks.find(link => link.source === passwordIdNumeric);

    if (passwordLink) {
      await this.linkDB.deleteLink(passwordLink.id);
    }

    // Delete password data file
    try {
      const filePath = path.join(PASSWORDS_DIR, `${passwordId}.json`);
      await fs.unlink(filePath);
      logger.info({ passwordId }, 'Password deleted');
    } catch (error) {
      logger.warn({ passwordId, error: error.message }, 'Failed to delete password data file');
    }

    return true;
  }

  // ==================== STATISTICS & UTILITIES ====================

  /**
   * Get statistics about stored authentication data
   * @returns {Promise<object>} - Statistics
   */
  async getStatistics() {
    const allLinks = await this.linkDB.readAllLinks();

    const userFiles = await fs.readdir(USERS_DIR).then(files => files.filter(f => f.endsWith('.json'))).catch(() => []);
    const tokenFiles = await fs.readdir(TOKENS_DIR).then(files => files.filter(f => f.endsWith('.json'))).catch(() => []);
    const passwordFiles = await fs.readdir(PASSWORDS_DIR).then(files => files.filter(f => f.endsWith('.json'))).catch(() => []);

    return {
      totalLinks: allLinks.length,
      users: {
        links: allLinks.filter(link => link.target === USER_TYPE_ID).length,
        files: userFiles.length
      },
      tokens: {
        links: allLinks.filter(link => {
          // Tokens are links where target is a userId (not a type constant)
          return link.target !== USER_TYPE_ID && link.target < 1000000000;
        }).length,
        files: tokenFiles.length
      },
      passwords: {
        files: passwordFiles.length
      }
    };
  }

  /**
   * Clear all authentication data (DANGEROUS - use with caution)
   * @returns {Promise<boolean>} - Success
   */
  async clearAllAuthData() {
    logger.warn('Clearing ALL authentication data - this is irreversible!');

    // Clear link database
    await this.linkDB.clearDatabase();

    // Clear all data files
    const dirs = [USERS_DIR, TOKENS_DIR, PASSWORDS_DIR];

    for (const dir of dirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(dir, file));
          }
        }
        logger.info({ dir }, 'Cleared auth data directory');
      } catch (error) {
        logger.warn({ dir, error: error.message }, 'Failed to clear auth data directory');
      }
    }

    return true;
  }

  /**
   * Find user by username (requires scanning all users)
   * @param {string} username - Username to search for
   * @returns {Promise<object|null>} - User data or null
   */
  async findUserByUsername(username) {
    const allUsers = await this.getAllUsers();
    return allUsers.find(user => user.username === username) || null;
  }

  /**
   * Find user by email (requires scanning all users)
   * @param {string} email - Email to search for
   * @returns {Promise<object|null>} - User data or null
   */
  async findUserByEmail(email) {
    const allUsers = await this.getAllUsers();
    return allUsers.find(user => user.email === email) || null;
  }

  /**
   * Find token by API key (requires scanning all tokens)
   * @param {string} apiKey - API key to search for
   * @returns {Promise<object|null>} - Token data or null
   */
  async findTokenByApiKey(apiKey) {
    try {
      const files = await fs.readdir(TOKENS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const tokenData = await this.loadData(TOKENS_DIR, file.replace('.json', ''));
          if (tokenData && tokenData.apiKey === apiKey) {
            return tokenData;
          }
        }
      }
    } catch (error) {
      logger.warn({ error: error.message }, 'Error searching for token by API key');
    }

    return null;
  }
}

export default AuthStorageService;
