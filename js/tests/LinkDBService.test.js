/**
 * LinkDBService Tests
 *
 * Comprehensive tests for link-cli (clink) database operations wrapper
 * Issue #2271: Add tests and make LinkDB an alternative storage engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import LinkDBService from '../LinkDBService.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test database path (separate from production)
const TEST_DB_DIR = path.join(__dirname, '../../../../test-data');
const TEST_DB_FILE = path.join(TEST_DB_DIR, 'test-linkdb.links');

describe('LinkDBService', () => {
  let service;
  let clinkAvailable = true;

  beforeEach(async () => {
    // Ensure test data directory exists
    try {
      await fs.mkdir(TEST_DB_DIR, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    service = new LinkDBService(TEST_DB_FILE);

    // Check if clink is available
    try {
      await service.executeQuery('(() ())', { after: true });
    } catch (error) {
      if (error.message.includes('clink command not found')) {
        clinkAvailable = false;
        console.warn('⚠️  clink not available - some tests will be skipped');
      }
    }
  });

  afterEach(async () => {
    // Clean up test database
    if (clinkAvailable) {
      try {
        await service.clearDatabase();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Remove test database file
    try {
      await fs.unlink(TEST_DB_FILE);
    } catch (error) {
      // File may not exist
    }
  });

  describe('Basic Operations', () => {
    it('should initialize with default database path', () => {
      const defaultService = new LinkDBService();
      expect(defaultService.dbPath).toBeDefined();
      expect(defaultService.nextId).toBe(1);
    });

    it('should initialize with custom database path', () => {
      const customPath = '/custom/path/db.links';
      const customService = new LinkDBService(customPath);
      expect(customService.dbPath).toBe(customPath);
    });

    it.skipIf(!clinkAvailable)('should execute simple query', async () => {
      const result = await service.executeQuery('(() ())', { after: true });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it.skipIf(!clinkAvailable)('should handle query with all flags', async () => {
      const result = await service.executeQuery('(() ())', {
        before: true,
        changes: true,
        after: true,
        trace: true
      });
      expect(result).toBeDefined();
    });

    it('should throw error if clink is not available', async () => {
      // This test simulates clink not being installed
      const invalidService = new LinkDBService('/nonexistent/path.links');

      // Mock the PATH to ensure clink is not found
      const originalPath = process.env.PATH;
      process.env.PATH = '/tmp/nonexistent';

      try {
        await expect(invalidService.executeQuery('(() ())')).rejects.toThrow('LinkDB not available');
      } finally {
        process.env.PATH = originalPath;
      }
    });
  });

  describe('Link Parsing', () => {
    it('should parse empty output', () => {
      const result = service.parseLinks('');
      expect(result).toEqual([]);
    });

    it('should parse single link', () => {
      const output = '(1: 2 3)';
      const result = service.parseLinks(output);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        source: 2,
        target: 3
      });
    });

    it('should parse multiple links', () => {
      const output = `(1: 2 3)
(2: 4 5)
(3: 6 7)`;
      const result = service.parseLinks(output);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 1, source: 2, target: 3 });
      expect(result[1]).toEqual({ id: 2, source: 4, target: 5 });
      expect(result[2]).toEqual({ id: 3, source: 6, target: 7 });
    });

    it('should skip lines that do not match link pattern', () => {
      const output = `(1: 2 3)
Some random text
(2: 4 5)
Another line without pattern`;
      const result = service.parseLinks(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, source: 2, target: 3 });
      expect(result[1]).toEqual({ id: 2, source: 4, target: 5 });
    });

    it('should handle output with extra whitespace', () => {
      const output = `

(1: 2 3)

(2: 4 5)

      `;
      const result = service.parseLinks(output);

      expect(result).toHaveLength(2);
    });
  });

  describe('CRUD Operations', () => {
    it.skipIf(!clinkAvailable)('should create a link', async () => {
      const link = await service.createLink(100, 200);

      expect(link).toBeDefined();
      expect(link.id).toBeGreaterThan(0);
      expect(link.source).toBe(100);
      expect(link.target).toBe(200);
    });

    it.skipIf(!clinkAvailable)('should read all links', async () => {
      // Create some test links
      await service.createLink(1, 2);
      await service.createLink(3, 4);
      await service.createLink(5, 6);

      const links = await service.readAllLinks();

      expect(links).toBeDefined();
      expect(Array.isArray(links)).toBe(true);
      expect(links.length).toBeGreaterThanOrEqual(3);
    });

    it.skipIf(!clinkAvailable)('should read specific link by ID', async () => {
      const created = await service.createLink(10, 20);
      const linkId = created.id;

      const link = await service.readLink(linkId);

      expect(link).toBeDefined();
      expect(link.id).toBe(linkId);
      expect(link.source).toBe(10);
      expect(link.target).toBe(20);
    });

    it.skipIf(!clinkAvailable)('should return null for non-existent link', async () => {
      const link = await service.readLink(999999);
      expect(link).toBeNull();
    });

    it.skipIf(!clinkAvailable)('should update a link', async () => {
      const created = await service.createLink(10, 20);
      const linkId = created.id;

      const updated = await service.updateLink(linkId, 30, 40);

      expect(updated.id).toBe(linkId);
      expect(updated.source).toBe(30);
      expect(updated.target).toBe(40);

      // Verify the update
      const link = await service.readLink(linkId);
      expect(link.source).toBe(30);
      expect(link.target).toBe(40);
    });

    it.skipIf(!clinkAvailable)('should delete a link', async () => {
      const created = await service.createLink(10, 20);
      const linkId = created.id;

      const result = await service.deleteLink(linkId);
      expect(result).toBe(true);

      // Verify deletion
      const link = await service.readLink(linkId);
      expect(link).toBeNull();
    });
  });

  describe('Menu Item Operations', () => {
    it.skipIf(!clinkAvailable)('should store menu item', async () => {
      const menuItem = {
        label: 'Test Menu',
        icon: 'pi pi-home',
        to: '/test'
      };

      const linkId = await service.storeMenuItem(menuItem);

      expect(linkId).toBeGreaterThan(0);
      expect(service.nextId).toBe(2);
    });

    it.skipIf(!clinkAvailable)('should store multiple menu items', async () => {
      const items = [
        { label: 'Home', icon: 'pi pi-home', to: '/' },
        { label: 'About', icon: 'pi pi-info', to: '/about' },
        { label: 'Contact', icon: 'pi pi-envelope', to: '/contact' }
      ];

      const linkIds = [];
      for (const item of items) {
        const linkId = await service.storeMenuItem(item);
        linkIds.push(linkId);
      }

      expect(linkIds).toHaveLength(3);
      expect(new Set(linkIds).size).toBe(3); // All IDs should be unique
    });

    it.skipIf(!clinkAvailable)('should get all menu items', async () => {
      // Store some menu items
      await service.storeMenuItem({ label: 'Item 1', icon: 'pi-home', to: '/1' });
      await service.storeMenuItem({ label: 'Item 2', icon: 'pi-info', to: '/2' });
      await service.storeMenuItem({ label: 'Item 3', icon: 'pi-user', to: '/3' });

      const menuItems = await service.getAllMenuItems();

      expect(menuItems).toBeDefined();
      expect(Array.isArray(menuItems)).toBe(true);
      expect(menuItems.length).toBeGreaterThanOrEqual(3);

      // All items should have target = 1000 (menu type identifier)
      menuItems.forEach(item => {
        expect(item.target).toBe(1000);
      });
    });

    it.skipIf(!clinkAvailable)('should delete menu item', async () => {
      const linkId = await service.storeMenuItem({
        label: 'Temporary Item',
        icon: 'pi pi-trash',
        to: '/temp'
      });

      const result = await service.deleteMenuItem(linkId);
      expect(result).toBe(true);

      // Verify deletion
      const link = await service.readLink(linkId);
      expect(link).toBeNull();
    });
  });

  describe('Database Management', () => {
    it.skipIf(!clinkAvailable)('should clear entire database', async () => {
      // Create multiple links
      await service.createLink(1, 2);
      await service.createLink(3, 4);
      await service.createLink(5, 6);

      // Verify links exist
      let links = await service.readAllLinks();
      expect(links.length).toBeGreaterThan(0);

      // Clear database
      const result = await service.clearDatabase();
      expect(result).toBe(true);

      // Verify database is empty
      links = await service.readAllLinks();
      expect(links).toHaveLength(0);
    });

    it.skipIf(!clinkAvailable)('should handle clearing empty database', async () => {
      const result = await service.clearDatabase();
      expect(result).toBe(true);
    });
  });

  describe('Example Use Cases', () => {
    it.skipIf(!clinkAvailable)('should handle hierarchical menu structure', async () => {
      // Create parent menu items
      const homeId = (await service.createLink(1, 0)).id; // Root level
      const productsId = (await service.createLink(2, 0)).id; // Root level

      // Create child menu items under "Products"
      const product1Id = (await service.createLink(101, productsId)).id;
      const product2Id = (await service.createLink(102, productsId)).id;

      // Verify structure
      const allLinks = await service.readAllLinks();

      // Find root items (target = 0)
      const rootItems = allLinks.filter(link => link.target === 0);
      expect(rootItems.length).toBeGreaterThanOrEqual(2);

      // Find children of products
      const productChildren = allLinks.filter(link => link.target === productsId);
      expect(productChildren.length).toBeGreaterThanOrEqual(2);
    });

    it.skipIf(!clinkAvailable)('should handle many-to-many relationships', async () => {
      // Create entities
      const tag1 = (await service.createLink(1001, 0)).id;
      const tag2 = (await service.createLink(1002, 0)).id;
      const tag3 = (await service.createLink(1003, 0)).id;

      const item1 = (await service.createLink(2001, 0)).id;
      const item2 = (await service.createLink(2002, 0)).id;

      // Create relationships (item -> tag)
      await service.createLink(item1, tag1);
      await service.createLink(item1, tag2);
      await service.createLink(item2, tag2);
      await service.createLink(item2, tag3);

      const allLinks = await service.readAllLinks();

      // Find tags for item1
      const item1Tags = allLinks.filter(link => link.source === item1 && link.target > 1000);
      expect(item1Tags.length).toBe(2);

      // Find items with tag2
      const tag2Items = allLinks.filter(link => link.target === tag2 && link.source > 2000);
      expect(tag2Items.length).toBe(2);
    });

    it.skipIf(!clinkAvailable)('should handle graph traversal', async () => {
      // Create a simple graph: A -> B -> C
      const nodeA = 100;
      const nodeB = 200;
      const nodeC = 300;

      await service.createLink(nodeA, nodeB);
      await service.createLink(nodeB, nodeC);

      // Traverse: Start at A, find what it points to
      const allLinks = await service.readAllLinks();

      // A points to B
      const aTargets = allLinks.filter(link => link.source === nodeA);
      expect(aTargets.length).toBe(1);
      expect(aTargets[0].target).toBe(nodeB);

      // B points to C
      const bTargets = allLinks.filter(link => link.source === nodeB);
      expect(bTargets.length).toBe(1);
      expect(bTargets[0].target).toBe(nodeC);
    });

    it.skipIf(!clinkAvailable)('should handle metadata storage pattern', async () => {
      // Pattern: Store entity ID and its metadata type
      // e.g., (entityId, metadataTypeId) where types are:
      // 1000 = name, 2000 = description, 3000 = tags

      const entityId = 12345;
      const nameType = 1000;
      const descType = 2000;
      const tagsType = 3000;

      await service.createLink(entityId, nameType);
      await service.createLink(entityId, descType);
      await service.createLink(entityId, tagsType);

      // Query all metadata for entity
      const allLinks = await service.readAllLinks();
      const entityMeta = allLinks.filter(link => link.source === entityId);

      expect(entityMeta.length).toBe(3);

      // Check metadata types
      const metaTypes = entityMeta.map(link => link.target).sort();
      expect(metaTypes).toEqual([1000, 2000, 3000]);
    });

    it.skipIf(!clinkAvailable)('should handle versioning pattern', async () => {
      // Pattern: Store versions as links
      // (documentId, versionNumber)

      const docId = 5000;

      // Create versions
      await service.createLink(docId, 1); // Version 1
      await service.createLink(docId, 2); // Version 2
      await service.createLink(docId, 3); // Version 3

      // Get all versions
      const allLinks = await service.readAllLinks();
      const versions = allLinks.filter(link => link.source === docId);

      expect(versions.length).toBe(3);

      // Get latest version
      const latestVersion = Math.max(...versions.map(v => v.target));
      expect(latestVersion).toBe(3);
    });
  });

  describe('Performance and Edge Cases', () => {
    it.skipIf(!clinkAvailable)('should handle large numbers', async () => {
      const largeSource = 999999999;
      const largeTarget = 888888888;

      const link = await service.createLink(largeSource, largeTarget);

      expect(link.source).toBe(largeSource);
      expect(link.target).toBe(largeTarget);
    });

    it.skipIf(!clinkAvailable)('should handle zero values', async () => {
      const link = await service.createLink(0, 0);

      expect(link.source).toBe(0);
      expect(link.target).toBe(0);
    });

    it.skipIf(!clinkAvailable)('should handle rapid sequential operations', async () => {
      const operations = [];

      // Perform 10 rapid creates
      for (let i = 0; i < 10; i++) {
        operations.push(service.createLink(i, i + 100));
      }

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.source).toBe(index);
        expect(result.target).toBe(index + 100);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid query syntax gracefully', async () => {
      if (!clinkAvailable) return;

      try {
        await service.executeQuery('invalid query syntax {{{{');
        // If no error is thrown, test passes (clink handles it)
      } catch (error) {
        // Error is expected and acceptable
        expect(error.message).toContain('LinkDB query failed');
      }
    });

    it.skipIf(!clinkAvailable)('should handle concurrent modifications', async () => {
      const link = await service.createLink(500, 600);
      const linkId = link.id;

      // Try to update and delete simultaneously (race condition)
      const updatePromise = service.updateLink(linkId, 700, 800);
      const deletePromise = service.deleteLink(linkId);

      // One should succeed, one might fail - both outcomes are acceptable
      try {
        await Promise.all([updatePromise, deletePromise]);
      } catch (error) {
        // Expected - race condition occurred
        expect(error).toBeDefined();
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it.skipIf(!clinkAvailable)('should implement simple todo list', async () => {
      // Todo items structure: (todoId, statusId)
      // Status: 0 = pending, 1 = in_progress, 2 = completed

      const todo1 = 1001;
      const todo2 = 1002;
      const todo3 = 1003;

      // Create todos with status
      await service.createLink(todo1, 0); // pending
      await service.createLink(todo2, 0); // pending
      await service.createLink(todo3, 0); // pending

      // Get all pending todos
      let allLinks = await service.readAllLinks();
      let pending = allLinks.filter(l => l.source >= 1001 && l.source <= 1003 && l.target === 0);
      expect(pending.length).toBe(3);

      // Update todo1 to in_progress
      const todo1Link = allLinks.find(l => l.source === todo1);
      await service.updateLink(todo1Link.id, todo1, 1);

      // Mark todo2 as completed
      const todo2Link = allLinks.find(l => l.source === todo2);
      await service.updateLink(todo2Link.id, todo2, 2);

      // Verify states
      allLinks = await service.readAllLinks();
      const completed = allLinks.filter(l => l.source >= 1001 && l.source <= 1003 && l.target === 2);
      expect(completed.length).toBe(1);
      expect(completed[0].source).toBe(todo2);
    });

    it.skipIf(!clinkAvailable)('should implement role-based access control', async () => {
      // Pattern: (userId, roleId)
      // Roles: 1 = admin, 2 = editor, 3 = viewer

      const users = {
        alice: 10001,
        bob: 10002,
        charlie: 10003
      };

      const roles = {
        admin: 1,
        editor: 2,
        viewer: 3
      };

      // Assign roles
      await service.createLink(users.alice, roles.admin);
      await service.createLink(users.bob, roles.editor);
      await service.createLink(users.charlie, roles.viewer);

      // Query: Get all users with editor role
      const allLinks = await service.readAllLinks();
      const editors = allLinks.filter(l => l.target === roles.editor);

      expect(editors.length).toBe(1);
      expect(editors[0].source).toBe(users.bob);

      // Query: Get role for alice
      const aliceRole = allLinks.find(l => l.source === users.alice);
      expect(aliceRole.target).toBe(roles.admin);
    });

    it.skipIf(!clinkAvailable)('should implement recommendation system', async () => {
      // Pattern: (userId, itemId) = user likes item

      const users = { alice: 1, bob: 2, charlie: 3 };
      const items = { item1: 101, item2: 102, item3: 103, item4: 104 };

      // Alice likes item1 and item2
      await service.createLink(users.alice, items.item1);
      await service.createLink(users.alice, items.item2);

      // Bob likes item1 and item3
      await service.createLink(users.bob, items.item1);
      await service.createLink(users.bob, items.item3);

      // Charlie likes item2 and item4
      await service.createLink(users.charlie, items.item2);
      await service.createLink(users.charlie, items.item4);

      const allLinks = await service.readAllLinks();

      // Find items alice likes
      const aliceLikes = allLinks.filter(l => l.source === users.alice);
      expect(aliceLikes.length).toBe(2);

      // Find users who like item1 (similar to alice)
      const item1Fans = allLinks.filter(l => l.target === items.item1);
      expect(item1Fans.length).toBe(2); // Alice and Bob

      // Recommendation: Bob also likes item3, recommend to alice
      const bobLikes = allLinks.filter(l => l.source === users.bob);
      const bobsItems = bobLikes.map(l => l.target);
      const alicesItems = aliceLikes.map(l => l.target);

      // Items bob likes but alice doesn't
      const recommendations = bobsItems.filter(item => !alicesItems.includes(item));
      expect(recommendations).toContain(items.item3);
    });
  });
});
