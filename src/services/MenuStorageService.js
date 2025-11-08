// MenuStorageService.js - Service for storing menu configuration using link-cli
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import LinkDBService from './LinkDBService.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for storing menu item content
const DATA_DIR = path.join(__dirname, '../../../data/menu-items');

/**
 * MenuStorageService - Store menu configurations using link-cli
 *
 * Architecture:
 * - Link-cli stores the relationships and structure (menu hierarchy)
 * - File system stores the actual menu item data (JSON files)
 * - Links represent parent-child relationships in menu structure
 *
 * Link schema:
 * - Link (menuItemId, parentId) represents a menu item under a parent
 * - Special parentId = 0 means root-level menu item
 * - Link IDs are derived from content hashes for consistency
 */
class MenuStorageService {
  constructor() {
    this.linkDB = new LinkDBService();
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.access(DATA_DIR);
    } catch (error) {
      await fs.mkdir(DATA_DIR, { recursive: true });
      logger.info('Created menu items data directory');
    }
  }

  /**
   * Generate a stable ID from menu item content
   * @param {object} item - Menu item
   * @returns {number} - Numeric ID
   */
  generateItemId(item) {
    const content = JSON.stringify(item);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    // Take first 8 characters of hash and convert to number
    return parseInt(hash.substring(0, 8), 16) % 1000000; // Keep it reasonable
  }

  /**
   * Save menu item data to file
   * @param {number} itemId - Item ID
   * @param {object} item - Menu item data
   */
  async saveItemData(itemId, item) {
    const filePath = path.join(DATA_DIR, `${itemId}.json`);
    await fs.writeFile(filePath, JSON.stringify(item, null, 2), 'utf-8');
  }

  /**
   * Load menu item data from file
   * @param {number} itemId - Item ID
   * @returns {Promise<object|null>} - Menu item or null
   */
  async loadItemData(itemId) {
    try {
      const filePath = path.join(DATA_DIR, `${itemId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Store a menu item with its parent relationship
   * @param {object} item - Menu item (must have label, icon, to/items)
   * @param {number} parentId - Parent item ID (0 for root)
   * @returns {Promise<number>} - Item ID
   */
  async storeMenuItem(item, parentId = 0) {
    const itemId = this.generateItemId(item);

    // Save item data to file
    await this.saveItemData(itemId, item);

    // Create link in database: (itemId, parentId)
    try {
      await this.linkDB.createLink(itemId, parentId);
      logger.info({ itemId, parentId }, 'Menu item stored in link database');
    } catch (error) {
      // Link might already exist, that's okay
      logger.debug({ itemId, parentId }, 'Link already exists or failed to create');
    }

    return itemId;
  }

  /**
   * Store a complete menu structure recursively
   * @param {Array<object>} menuItems - Menu items array
   * @param {number} parentId - Parent ID
   * @returns {Promise<Array<number>>} - Array of created item IDs
   */
  async storeMenuStructure(menuItems, parentId = 0) {
    const itemIds = [];

    for (const item of menuItems) {
      // Create a copy without nested items for the link
      const itemWithoutChildren = { ...item };
      const children = itemWithoutChildren.items;
      delete itemWithoutChildren.items;

      // Store the item
      const itemId = await this.storeMenuItem(itemWithoutChildren, parentId);
      itemIds.push(itemId);

      // Recursively store children
      if (children && Array.isArray(children) && children.length > 0) {
        await this.storeMenuStructure(children, itemId);
      }
    }

    return itemIds;
  }

  /**
   * Retrieve menu structure by building from links
   * @param {number} parentId - Parent ID (0 for root)
   * @returns {Promise<Array<object>>} - Menu items
   */
  async getMenuStructure(parentId = 0) {
    // Get all links from database
    const allLinks = await this.linkDB.readAllLinks();

    // Filter links that have this parent
    const childLinks = allLinks.filter(link => link.target === parentId);

    // Build menu items
    const menuItems = [];

    for (const link of childLinks) {
      const itemId = link.source;

      // Load item data
      const itemData = await this.loadItemData(itemId);

      if (itemData) {
        // Recursively get children
        const children = await this.getMenuStructure(itemId);

        const menuItem = {
          ...itemData,
          _linkId: link.id,
          _itemId: itemId
        };

        // Add children if any
        if (children.length > 0) {
          menuItem.items = children;
        }

        menuItems.push(menuItem);
      }
    }

    return menuItems;
  }

  /**
   * Get all menu items (flat list)
   * @returns {Promise<Array<object>>} - All menu items
   */
  async getAllMenuItems() {
    const allLinks = await this.linkDB.readAllLinks();
    const items = [];

    for (const link of allLinks) {
      const itemData = await this.loadItemData(link.source);
      if (itemData) {
        items.push({
          ...itemData,
          _linkId: link.id,
          _itemId: link.source,
          _parentId: link.target
        });
      }
    }

    return items;
  }

  /**
   * Delete a menu item and its children
   * @param {number} itemId - Item ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteMenuItem(itemId) {
    // Get all child items
    const children = await this.getMenuStructure(itemId);

    // Recursively delete children
    for (const child of children) {
      await this.deleteMenuItem(child._itemId);
    }

    // Delete links where this item is the source
    const allLinks = await this.linkDB.readAllLinks();
    const itemLinks = allLinks.filter(link => link.source === itemId);

    for (const link of itemLinks) {
      await this.linkDB.deleteLink(link.id);
    }

    // Delete item data file
    try {
      const filePath = path.join(DATA_DIR, `${itemId}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn({ itemId, error: error.message }, 'Failed to delete item data file');
    }

    return true;
  }

  /**
   * Clear all menu data
   * @returns {Promise<boolean>} - Success
   */
  async clearAllMenus() {
    // Clear link database
    await this.linkDB.clearDatabase();

    // Clear all menu item files
    try {
      const files = await fs.readdir(DATA_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(DATA_DIR, file));
        }
      }
    } catch (error) {
      logger.warn({ error: error.message }, 'Failed to clear menu data files');
    }

    return true;
  }

  /**
   * Get statistics about stored menu data
   * @returns {Promise<object>} - Statistics
   */
  async getStatistics() {
    const allLinks = await this.linkDB.readAllLinks();
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    return {
      totalLinks: allLinks.length,
      totalFiles: jsonFiles.length,
      rootItems: allLinks.filter(link => link.target === 0).length
    };
  }
}

export default MenuStorageService;
