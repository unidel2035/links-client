// LinkDBService.js - Service wrapper for link-cli (clink) database operations
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default database path
const DEFAULT_DB_DIR = path.join(__dirname, '../../../data');
const DEFAULT_DB_FILE = path.join(DEFAULT_DB_DIR, 'linkdb.links');

/**
 * LinkDBService - Wrapper for link-cli database operations
 * Uses the clink tool (link-cli) for associative link-based data storage
 */
class LinkDBService {
  constructor(dbPath = DEFAULT_DB_FILE) {
    this.dbPath = dbPath;
    this.nextId = 1; // Track next available ID for menu items
  }

  /**
   * Execute a clink command
   * @param {string} query - LiNo query string
   * @param {object} options - Additional options
   * @returns {Promise<string>} - Command output
   */
  async executeQuery(query, options = {}) {
    const { before = false, changes = false, after = false, trace = false } = options;

    const flags = [];
    if (before) flags.push('--before');
    if (changes) flags.push('--changes');
    if (after) flags.push('--after');
    if (trace) flags.push('--trace');

    const command = `clink '${query}' --db "${this.dbPath}" ${flags.join(' ')}`;

    try {
      logger.debug({ command }, 'Executing clink command');

      // Set PATH to include .dotnet/tools directory where clink is installed
      const env = {
        ...process.env,
        PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
      };

      const { stdout, stderr } = await execAsync(command, { env });

      if (stderr) {
        logger.warn({ stderr }, 'clink command produced stderr output');
      }

      return stdout.trim();
    } catch (error) {
      // Issue #1823: Check if clink is not installed
      if (error.message.includes('clink') && (error.message.includes('not found') || error.message.includes('command not found'))) {
        logger.error('clink command not found - link-cli may not be installed');
        throw new Error('LinkDB not available: clink command not found. Please install link-cli.');
      }

      logger.error({ error: error.message, command }, 'Failed to execute clink command');
      throw new Error(`LinkDB query failed: ${error.message}`);
    }
  }

  /**
   * Parse clink output to extract links
   * Format: (id: source target)
   * @param {string} output - Raw clink output
   * @returns {Array<object>} - Parsed links
   */
  parseLinks(output) {
    if (!output || output.trim() === '') {
      return [];
    }

    const lines = output.split('\n').filter(line => line.trim());
    const links = [];

    for (const line of lines) {
      // Match pattern: (id: source target)
      const match = line.match(/\((\d+):\s+(\d+)\s+(\d+)\)/);
      if (match) {
        links.push({
          id: parseInt(match[1]),
          source: parseInt(match[2]),
          target: parseInt(match[3])
        });
      }
    }

    return links;
  }

  /**
   * Create a new link
   * @param {number} source - Source link ID
   * @param {number} target - Target link ID
   * @returns {Promise<object>} - Created link
   */
  async createLink(source, target) {
    const query = `() ((${source} ${target}))`;
    const output = await this.executeQuery(query, { changes: true });

    // Parse the created link from output
    const match = output.match(/\((\d+):\s+(\d+)\s+(\d+)\)/);
    if (match) {
      return {
        id: parseInt(match[1]),
        source: parseInt(match[2]),
        target: parseInt(match[3])
      };
    }

    throw new Error('Failed to parse created link');
  }

  /**
   * Read all links from database
   * @returns {Promise<Array<object>>} - All links
   */
  async readAllLinks() {
    const query = `((($i: $s $t)) (($i: $s $t)))`;
    const output = await this.executeQuery(query, { after: true });
    return this.parseLinks(output);
  }

  /**
   * Read a specific link by ID
   * @param {number} id - Link ID
   * @returns {Promise<object|null>} - Link or null if not found
   */
  async readLink(id) {
    const query = `(((${id}: $s $t)) ((${id}: $s $t)))`;
    const output = await this.executeQuery(query, { after: true });
    const links = this.parseLinks(output);
    return links.length > 0 ? links[0] : null;
  }

  /**
   * Update a link
   * @param {number} id - Link ID
   * @param {number} newSource - New source value
   * @param {number} newTarget - New target value
   * @returns {Promise<object>} - Updated link
   */
  async updateLink(id, newSource, newTarget) {
    const query = `(((${id}: $s $t)) ((${id}: ${newSource} ${newTarget})))`;
    await this.executeQuery(query, { changes: true });

    return {
      id,
      source: newSource,
      target: newTarget
    };
  }

  /**
   * Delete a link
   * @param {number} id - Link ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteLink(id) {
    const query = `(((${id}: $s $t)) ())`;
    await this.executeQuery(query, { changes: true });
    return true;
  }

  /**
   * Store menu item data as a link with encoded JSON
   * This is a higher-level abstraction for storing menu items
   * @param {object} menuItem - Menu item object
   * @returns {Promise<number>} - Link ID
   */
  async storeMenuItem(menuItem) {
    // Convert menu item to JSON string
    const jsonStr = JSON.stringify(menuItem);

    // For now, we'll store the menu item as a link where:
    // - source = hash of the JSON string (or incrementing ID)
    // - target = menu type identifier

    // Simple approach: use incrementing IDs
    const menuTypeId = 1000; // Identifier for menu items
    const itemId = this.nextId++;

    const link = await this.createLink(itemId, menuTypeId);

    // Store the actual JSON data separately (we'll need to implement a string storage mechanism)
    // For now, return the link ID
    return link.id;
  }

  /**
   * Get all menu items
   * @returns {Promise<Array<object>>} - Menu items
   */
  async getAllMenuItems() {
    // Read all links with source pointing to menu type
    const allLinks = await this.readAllLinks();

    // Filter links that represent menu items (target = 1000)
    const menuLinks = allLinks.filter(link => link.target === 1000);

    return menuLinks;
  }

  /**
   * Delete menu item
   * @param {number} linkId - Link ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMenuItem(linkId) {
    return await this.deleteLink(linkId);
  }

  /**
   * Clear all data from database
   * @returns {Promise<boolean>} - Success status
   */
  async clearDatabase() {
    try {
      // Delete all links one by one
      const allLinks = await this.readAllLinks();
      for (const link of allLinks) {
        await this.deleteLink(link.id);
      }
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to clear database');
      throw error;
    }
  }
}

export default LinkDBService;
