// ILinks.js - Universal flat API compatible with Platform.Data ILinks interface
import LinkDBService from '../services/link-db-service.js';
import logger from '../utils/logger.js';

/**
 * Constants for ILinks operations
 */
class LinksConstants {
  constructor() {
    this.Continue = Symbol('Continue');
    this.Break = Symbol('Break');
    this.Any = 0; // Use 0 to represent "any" in restrictions
  }
}

/**
 * ILinks - Universal flat Turing complete API for Links
 * Compatible with https://github.com/linksplatform/Data/blob/main/csharp/Platform.Data/ILinks.cs
 *
 * Flat meaning it only works with a single link at a time.
 */
class ILinks {
  constructor(dbPath = null) {
    this.db = new LinkDBService(dbPath);
    this.constants = new LinksConstants();
  }

  /**
   * Get constants for this Links instance
   * @returns {LinksConstants} - Constants object
   */
  getConstants() {
    return this.constants;
  }

  /**
   * Count links matching the restriction
   * @param {Array<number>|null} restriction - Array [id] or [id, source, target] to filter links, null for all
   * @returns {Promise<number>} - Number of matching links
   */
  async count(restriction = null) {
    try {
      const allLinks = await this.db.readAllLinks();

      if (!restriction || restriction.length === 0) {
        return allLinks.length;
      }

      // Filter based on restriction
      const filtered = this._filterLinks(allLinks, restriction);
      return filtered.length;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to count links');
      throw error;
    }
  }

  /**
   * Iterate through links matching restriction, calling handler for each
   * @param {Array<number>|null} restriction - Array to filter links, null for all
   * @param {Function|null} handler - Callback function(link) that returns Continue or Break
   * @returns {Promise<Symbol>} - Continue if completed, Break if interrupted
   */
  async each(restriction = null, handler = null) {
    try {
      const allLinks = await this.db.readAllLinks();
      const filtered = this._filterLinks(allLinks, restriction);

      if (!handler) {
        return this.constants.Continue;
      }

      for (const link of filtered) {
        const result = await handler(link);
        if (result === this.constants.Break) {
          return this.constants.Break;
        }
      }

      return this.constants.Continue;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to iterate links');
      throw error;
    }
  }

  /**
   * Create a new link
   * @param {Array<number>|null} substitution - Array [source, target] or [id, source, target]
   * @param {Function|null} handler - Callback function for changes
   * @returns {Promise<number>} - Created link ID
   */
  async create(substitution = null, handler = null) {
    try {
      if (!substitution || substitution.length < 2) {
        throw new Error('Substitution must contain at least [source, target]');
      }

      const [source, target] = substitution;
      const link = await this.db.createLink(source, target);

      if (handler) {
        await handler({ before: null, after: link });
      }

      return link.id;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create link');
      throw error;
    }
  }

  /**
   * Update existing links matching restriction
   * @param {Array<number>|null} restriction - Array to filter links to update
   * @param {Array<number>|null} substitution - New values [source, target] or [id, source, target]
   * @param {Function|null} handler - Callback function for changes
   * @returns {Promise<number>} - Updated link ID
   */
  async update(restriction = null, substitution = null, handler = null) {
    try {
      if (!restriction || restriction.length === 0) {
        throw new Error('Restriction required for update');
      }
      if (!substitution || substitution.length < 2) {
        throw new Error('Substitution must contain at least [source, target]');
      }

      const allLinks = await this.db.readAllLinks();
      const filtered = this._filterLinks(allLinks, restriction);

      if (filtered.length === 0) {
        throw new Error('No links found matching restriction');
      }

      // Update first matching link
      const linkToUpdate = filtered[0];
      const [newSource, newTarget] = substitution.length === 2
        ? substitution
        : [substitution[1], substitution[2]];

      const before = { ...linkToUpdate };
      const updated = await this.db.updateLink(linkToUpdate.id, newSource, newTarget);

      if (handler) {
        await handler({ before, after: updated });
      }

      return updated.id;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update link');
      throw error;
    }
  }

  /**
   * Delete links matching restriction
   * @param {Array<number>|null} restriction - Array to filter links to delete
   * @param {Function|null} handler - Callback function for changes
   * @returns {Promise<number>} - Deleted link ID
   */
  async delete(restriction = null, handler = null) {
    try {
      if (!restriction || restriction.length === 0) {
        throw new Error('Restriction required for delete');
      }

      const allLinks = await this.db.readAllLinks();
      const filtered = this._filterLinks(allLinks, restriction);

      if (filtered.length === 0) {
        throw new Error('No links found matching restriction');
      }

      // Delete first matching link
      const linkToDelete = filtered[0];
      const before = { ...linkToDelete };
      await this.db.deleteLink(linkToDelete.id);

      if (handler) {
        await handler({ before, after: null });
      }

      return linkToDelete.id;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete link');
      throw error;
    }
  }

  /**
   * Helper method to filter links based on restriction
   * @private
   * @param {Array<object>} links - All links
   * @param {Array<number>|null} restriction - Restriction array
   * @returns {Array<object>} - Filtered links
   */
  _filterLinks(links, restriction) {
    if (!restriction || restriction.length === 0) {
      return links;
    }

    return links.filter(link => {
      if (restriction.length === 1) {
        // [id] - match by ID
        return restriction[0] === this.constants.Any || link.id === restriction[0];
      } else if (restriction.length === 2) {
        // [source, target] - match by source and target
        return (restriction[0] === this.constants.Any || link.source === restriction[0]) &&
               (restriction[1] === this.constants.Any || link.target === restriction[1]);
      } else if (restriction.length >= 3) {
        // [id, source, target] - match all three
        return (restriction[0] === this.constants.Any || link.id === restriction[0]) &&
               (restriction[1] === this.constants.Any || link.source === restriction[1]) &&
               (restriction[2] === this.constants.Any || link.target === restriction[2]);
      }
      return false;
    });
  }
}

export default ILinks;
