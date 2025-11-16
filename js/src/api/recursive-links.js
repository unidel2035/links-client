// RecursiveLinks.js - Recursive API wrapper for nested arrays and objects
import ILinks from './ilinks.js';
import logger from '../utils/logger.js';

/**
 * RecursiveLinks - Recursive wrapper for ILinks that supports nested structures
 *
 * Converts between JavaScript nested arrays/objects and Links notation:
 * - [[1, 2], [3, 4]] ↔ ((1 2) (3 4))
 * - { "1": [1, { "2": [5, 6] }, 3, 4] } ↔ (1: 1 (2: 5 6) 3 4)
 */
class RecursiveLinks {
  constructor(dbPath = null) {
    this.links = new ILinks(dbPath);
    this.idCounter = 1000000; // Start high to avoid conflicts with user IDs
  }

  /**
   * Get the underlying ILinks instance
   * @returns {ILinks} - ILinks instance
   */
  getLinks() {
    return this.links;
  }

  /**
   * Generate a unique temporary ID for internal use
   * @private
   * @returns {number} - New unique ID
   */
  _generateTempId() {
    return this.idCounter++;
  }

  /**
   * Create links from nested array structure
   * [[1, 2], [3, 4]] represents two links: (1 2) and (3 4)
   *
   * @param {Array} nestedArray - Nested array structure
   * @returns {Promise<Array<number>>} - Array of created link IDs
   */
  async createFromNestedArray(nestedArray) {
    try {
      const linkIds = [];

      for (const item of nestedArray) {
        if (Array.isArray(item)) {
          if (item.length >= 2) {
            // Create a link from [source, target]
            const [source, target] = item;

            // Recursively handle nested arrays
            const actualSource = Array.isArray(source)
              ? (await this.createFromNestedArray([source]))[0]
              : source;
            const actualTarget = Array.isArray(target)
              ? (await this.createFromNestedArray([target]))[0]
              : target;

            const linkId = await this.links.create([actualSource, actualTarget]);
            linkIds.push(linkId);
          } else {
            throw new Error('Array items must have at least 2 elements [source, target]');
          }
        } else {
          // Single value - treat as a link to itself or skip
          logger.warn({ item }, 'Skipping non-array item in nested array');
        }
      }

      return linkIds;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create from nested array');
      throw error;
    }
  }

  /**
   * Create links from nested object structure with references
   * { "1": [1, { "2": [5, 6] }, 3, 4] } represents (1: 1 (2: 5 6) 3 4)
   *
   * @param {object} nestedObject - Nested object structure with named links
   * @returns {Promise<object>} - Map of reference names to created link IDs
   */
  async createFromNestedObject(nestedObject) {
    try {
      const referenceMap = {};

      // Process each named link in the object
      for (const [refName, value] of Object.entries(nestedObject)) {
        if (Array.isArray(value)) {
          // Create a sequence of links from the array
          const linkId = await this._createSequenceFromArray(value, referenceMap);
          referenceMap[refName] = linkId;
        } else {
          logger.warn({ refName, value }, 'Skipping non-array value in nested object');
        }
      }

      return referenceMap;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create from nested object');
      throw error;
    }
  }

  /**
   * Create a sequence of links from an array, handling nested objects
   * @private
   * @param {Array} arr - Array with potential nested objects
   * @param {object} referenceMap - Map to store reference IDs
   * @returns {Promise<number>} - ID of the created sequence link
   */
  async _createSequenceFromArray(arr, referenceMap) {
    if (arr.length === 0) {
      throw new Error('Cannot create sequence from empty array');
    }

    // For arrays with exactly 2 elements, create a single link
    if (arr.length === 2 && !this._hasNestedObject(arr)) {
      const [source, target] = arr;
      return await this.links.create([source, target]);
    }

    // For longer sequences or nested structures, create a chain of links
    // First element is the head
    let currentId = null;

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];

      if (typeof item === 'object' && !Array.isArray(item)) {
        // Nested object with references
        const nestedRefs = await this.createFromNestedObject(item);
        // Use the first created link from nested object
        const firstRef = Object.values(nestedRefs)[0];

        if (currentId === null) {
          currentId = firstRef;
        } else {
          // Create link connecting previous to this nested structure
          currentId = await this.links.create([currentId, firstRef]);
        }

        // Merge reference maps
        Object.assign(referenceMap, nestedRefs);
      } else if (Array.isArray(item)) {
        // Nested array
        const nestedId = await this._createSequenceFromArray(item, referenceMap);

        if (currentId === null) {
          currentId = nestedId;
        } else {
          currentId = await this.links.create([currentId, nestedId]);
        }
      } else {
        // Simple value
        if (currentId === null) {
          currentId = item;
        } else {
          currentId = await this.links.create([currentId, item]);
        }
      }
    }

    return currentId;
  }

  /**
   * Check if array contains nested objects
   * @private
   * @param {Array} arr - Array to check
   * @returns {boolean} - True if contains nested objects
   */
  _hasNestedObject(arr) {
    return arr.some(item => typeof item === 'object' && !Array.isArray(item));
  }

  /**
   * Read links and convert to nested array structure
   * @param {Array<number>|null} restriction - Filter for links
   * @returns {Promise<Array>} - Nested array structure
   */
  async readAsNestedArray(restriction = null) {
    try {
      const result = [];
      const visited = new Set();

      await this.links.each(restriction, async (link) => {
        if (!visited.has(link.id)) {
          visited.add(link.id);
          result.push([link.source, link.target]);
        }
        return this.links.constants.Continue;
      });

      return result;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to read as nested array');
      throw error;
    }
  }

  /**
   * Convert nested array to Links notation string
   * [[1, 2], [3, 4]] -> "((1 2) (3 4))"
   *
   * @param {Array} nestedArray - Nested array structure
   * @returns {string} - Links notation string
   */
  toLinksNotation(nestedArray) {
    const convert = (item) => {
      if (Array.isArray(item)) {
        const inner = item.map(convert).join(' ');
        return `(${inner})`;
      }
      return String(item);
    };

    return `(${nestedArray.map(convert).join(' ')})`;
  }

  /**
   * Convert nested object with references to Links notation string
   * { "1": [1, { "2": [5, 6] }, 3, 4] } -> "(1: 1 (2: 5 6) 3 4)"
   *
   * @param {object} nestedObject - Nested object structure
   * @returns {string} - Links notation string with references
   */
  toLinksNotationWithRefs(nestedObject) {
    const convert = (item, refName = null) => {
      if (typeof item === 'object' && !Array.isArray(item)) {
        // Nested object with its own references
        return Object.entries(item)
          .map(([ref, val]) => convert(val, ref))
          .join(' ');
      } else if (Array.isArray(item)) {
        const inner = item.map(el => convert(el)).join(' ');
        return refName ? `(${refName}: ${inner})` : `(${inner})`;
      }
      return String(item);
    };

    const parts = Object.entries(nestedObject).map(([ref, val]) => convert(val, ref));
    return `(${parts.join(' ')})`;
  }

  /**
   * Parse Links notation string to nested array
   * "((1 2) (3 4))" -> [[1, 2], [3, 4]]
   *
   * @param {string} notation - Links notation string
   * @returns {Array} - Nested array structure
   */
  parseLinksNotation(notation) {
    notation = notation.trim();

    // Remove outer parentheses
    if (notation.startsWith('(') && notation.endsWith(')')) {
      notation = notation.slice(1, -1).trim();
    }

    const result = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < notation.length; i++) {
      const char = notation[i];

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;

        if (depth === 0 && current.trim()) {
          result.push(this.parseLinksNotation(current.trim()));
          current = '';
        }
      } else if (char === ' ' && depth === 0) {
        if (current.trim()) {
          // Parse number
          const num = parseInt(current.trim());
          if (!isNaN(num)) {
            result.push(num);
          }
          current = '';
        }
      } else {
        current += char;
      }
    }

    // Handle remaining content
    if (current.trim()) {
      const num = parseInt(current.trim());
      if (!isNaN(num)) {
        result.push(num);
      }
    }

    return result;
  }
}

export default RecursiveLinks;
