// menuConfigLinkDB.js - Menu configuration management routes using link-cli database
import express from 'express';
import logger from '../utils/logger.js';
import MenuStorageService from '../services/MenuStorageService.js';

const menuStorage = new MenuStorageService();

/**
 * Create menu configuration routes using link-cli database
 */
export function createMenuConfigLinkDBRoutes() {
  const router = express.Router();

  /**
   * GET /menu/config - Get current menu configuration from link-cli database
   */
  router.get('/menu/config', async (req, res, next) => {
    try {
      logger.info('Fetching menu configuration from link-cli database');

      // Get menu structure from link database
      const menuStructure = await menuStorage.getMenuStructure(0); // 0 = root

      if (!menuStructure || menuStructure.length === 0) {
        // Return null config if no menu exists yet
        return res.json({
          success: true,
          response: {
            config: null,
            updatedAt: null,
            source: 'linkdb'
          }
        });
      }

      // Convert to JSON string format (matching original API)
      const configString = JSON.stringify(menuStructure);

      res.json({
        success: true,
        response: {
          config: configString,
          updatedAt: new Date().toISOString(),
          source: 'linkdb'
        }
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error fetching menu configuration from link-cli');

      // Return empty config instead of throwing error (Issue #1823 - prevent 500 error)
      res.json({
        success: true,
        response: {
          config: null,
          updatedAt: null,
          source: 'linkdb',
          error: error.message
        }
      });
    }
  });

  /**
   * POST /menu/config - Save menu configuration to link-cli database
   */
  router.post('/menu/config', async (req, res, next) => {
    try {
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({
          error: 'Configuration is required',
          message: 'Request body must contain a "config" field with the menu configuration'
        });
      }

      // Validate and parse configuration
      let menuData;
      try {
        menuData = JSON.parse(config);
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid configuration format',
          message: 'The config field must be a valid JSON string'
        });
      }

      // Clear existing menu data
      await menuStorage.clearAllMenus();

      // Store new menu structure in link database
      await menuStorage.storeMenuStructure(menuData, 0);

      const updatedAt = new Date().toISOString();
      logger.info('Menu configuration saved successfully to link-cli database');

      res.json({
        success: true,
        message: 'Menu configuration saved successfully to link-cli database',
        response: {
          updatedAt,
          source: 'linkdb'
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error saving menu configuration to link-cli');
      next(error);
    }
  });

  /**
   * DELETE /menu/config - Delete menu configuration (reset to default)
   */
  router.delete('/menu/config', async (req, res, next) => {
    try {
      await menuStorage.clearAllMenus();
      logger.info('Menu configuration deleted successfully from link-cli database');

      res.json({
        success: true,
        message: 'Menu configuration deleted successfully from link-cli database',
        source: 'linkdb'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error deleting menu configuration from link-cli');
      next(error);
    }
  });

  /**
   * GET /menu/items - Get all menu items (flat list)
   */
  router.get('/menu/items', async (req, res, next) => {
    try {
      logger.info('Fetching all menu items from link-cli database');

      const items = await menuStorage.getAllMenuItems();

      res.json({
        success: true,
        response: {
          items,
          count: items.length,
          source: 'linkdb'
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error fetching menu items from link-cli');
      next(error);
    }
  });

  /**
   * GET /menu/statistics - Get menu storage statistics
   */
  router.get('/menu/statistics', async (req, res, next) => {
    try {
      logger.info('Fetching menu storage statistics');

      const stats = await menuStorage.getStatistics();

      res.json({
        success: true,
        response: {
          ...stats,
          source: 'linkdb'
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error fetching menu statistics');
      next(error);
    }
  });

  /**
   * POST /menu/item - Add a single menu item
   */
  router.post('/menu/item', async (req, res, next) => {
    try {
      const { item, parentId = 0 } = req.body;

      if (!item) {
        return res.status(400).json({
          error: 'Item is required',
          message: 'Request body must contain an "item" field with the menu item data'
        });
      }

      const itemId = await menuStorage.storeMenuItem(item, parentId);

      logger.info({ itemId, parentId }, 'Menu item added successfully');

      res.json({
        success: true,
        message: 'Menu item added successfully',
        response: {
          itemId,
          parentId,
          source: 'linkdb'
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error adding menu item');
      next(error);
    }
  });

  /**
   * DELETE /menu/item/:itemId - Delete a menu item and its children
   */
  router.delete('/menu/item/:itemId', async (req, res, next) => {
    try {
      const { itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({
          error: 'Item ID is required',
          message: 'Item ID must be provided in URL parameters'
        });
      }

      await menuStorage.deleteMenuItem(parseInt(itemId));

      logger.info({ itemId }, 'Menu item deleted successfully');

      res.json({
        success: true,
        message: 'Menu item deleted successfully',
        response: {
          itemId,
          source: 'linkdb'
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error deleting menu item');
      next(error);
    }
  });

  return router;
}
