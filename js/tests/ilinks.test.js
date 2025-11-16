// Test file for ILinks flat API
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import ILinks from '../src/api/ilinks.js';
import fs from 'fs';
import path from 'path';

// Test database path
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-ilinks.links');

describe('ILinks Flat API', () => {
  let links;

  before(async () => {
    // Clean up test database if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    links = new ILinks(TEST_DB_PATH);
  });

  after(async () => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Constants', () => {
    it('should have Continue and Break constants', () => {
      const constants = links.getConstants();
      assert.ok(constants.Continue);
      assert.ok(constants.Break);
      assert.strictEqual(constants.Any, 0);
    });
  });

  describe('Create', () => {
    it('should create a link with source and target', async () => {
      const linkId = await links.create([1, 2]);
      assert.ok(linkId > 0, 'Link ID should be positive');
    });

    it('should create multiple links', async () => {
      const linkId1 = await links.create([3, 4]);
      const linkId2 = await links.create([5, 6]);
      assert.ok(linkId1 > 0);
      assert.ok(linkId2 > 0);
      assert.notStrictEqual(linkId1, linkId2, 'Link IDs should be unique');
    });

    it('should call handler when provided', async () => {
      let handlerCalled = false;
      let capturedChange = null;

      const handler = (change) => {
        handlerCalled = true;
        capturedChange = change;
      };

      const linkId = await links.create([7, 8], handler);
      assert.ok(handlerCalled, 'Handler should be called');
      assert.strictEqual(capturedChange.before, null);
      assert.ok(capturedChange.after);
      assert.strictEqual(capturedChange.after.id, linkId);
    });

    it('should throw error if substitution is invalid', async () => {
      await assert.rejects(
        async () => await links.create([1]),
        /Substitution must contain at least \[source, target\]/
      );
    });
  });

  describe('Count', () => {
    it('should count all links when no restriction', async () => {
      const count = await links.count();
      assert.ok(count > 0, 'Should have at least one link');
    });

    it('should count links matching restriction by source and target', async () => {
      await links.create([10, 20]);
      await links.create([10, 30]);
      await links.create([40, 20]);

      const count = await links.count([10, 0]); // Links with source=10
      assert.ok(count >= 2, 'Should find at least 2 links with source=10');
    });

    it('should return 0 for non-matching restriction', async () => {
      const count = await links.count([999999, 999999]);
      assert.strictEqual(count, 0, 'Should return 0 for non-existent link');
    });
  });

  describe('Each', () => {
    it('should iterate through all links', async () => {
      const allLinks = [];
      const result = await links.each(null, (link) => {
        allLinks.push(link);
        return links.constants.Continue;
      });

      assert.strictEqual(result, links.constants.Continue);
      assert.ok(allLinks.length > 0, 'Should iterate through links');
    });

    it('should respect Break signal', async () => {
      let iterationCount = 0;
      const result = await links.each(null, (link) => {
        iterationCount++;
        if (iterationCount >= 2) {
          return links.constants.Break;
        }
        return links.constants.Continue;
      });

      assert.strictEqual(result, links.constants.Break);
      assert.strictEqual(iterationCount, 2, 'Should stop at second iteration');
    });

    it('should filter links by restriction', async () => {
      const linkId = await links.create([100, 200]);
      const foundLinks = [];

      await links.each([100, 200], (link) => {
        foundLinks.push(link);
        return links.constants.Continue;
      });

      assert.ok(foundLinks.length > 0, 'Should find links with matching source and target');
      assert.ok(foundLinks.some(l => l.source === 100 && l.target === 200));
    });
  });

  describe('Update', () => {
    it('should update a link', async () => {
      const linkId = await links.create([50, 60]);
      const updatedId = await links.update([linkId, 0, 0], [70, 80]);

      assert.strictEqual(updatedId, linkId, 'Should return same link ID');

      // Verify the update
      const foundLinks = [];
      await links.each([linkId, 0, 0], (link) => {
        foundLinks.push(link);
        return links.constants.Continue;
      });

      assert.strictEqual(foundLinks[0].source, 70);
      assert.strictEqual(foundLinks[0].target, 80);
    });

    it('should call handler when provided', async () => {
      const linkId = await links.create([90, 100]);
      let handlerCalled = false;
      let capturedChange = null;

      const handler = (change) => {
        handlerCalled = true;
        capturedChange = change;
      };

      await links.update([linkId, 0, 0], [110, 120], handler);

      assert.ok(handlerCalled, 'Handler should be called');
      assert.ok(capturedChange.before);
      assert.ok(capturedChange.after);
      assert.strictEqual(capturedChange.before.source, 90);
      assert.strictEqual(capturedChange.after.source, 110);
    });

    it('should throw error if no restriction provided', async () => {
      await assert.rejects(
        async () => await links.update(null, [1, 2]),
        /Restriction required for update/
      );
    });

    it('should throw error if no matching link found', async () => {
      await assert.rejects(
        async () => await links.update([999999, 0, 0], [1, 2]),
        /No links found matching restriction/
      );
    });
  });

  describe('Delete', () => {
    it('should delete a link', async () => {
      const linkId = await links.create([130, 140]);
      const deletedId = await links.delete([linkId, 0, 0]);

      assert.strictEqual(deletedId, linkId, 'Should return deleted link ID');

      // Verify deletion
      const count = await links.count([linkId, 0, 0]);
      assert.strictEqual(count, 0, 'Link should be deleted');
    });

    it('should call handler when provided', async () => {
      const linkId = await links.create([150, 160]);
      let handlerCalled = false;
      let capturedChange = null;

      const handler = (change) => {
        handlerCalled = true;
        capturedChange = change;
      };

      await links.delete([linkId, 0, 0], handler);

      assert.ok(handlerCalled, 'Handler should be called');
      assert.ok(capturedChange.before);
      assert.strictEqual(capturedChange.after, null);
    });

    it('should throw error if no restriction provided', async () => {
      await assert.rejects(
        async () => await links.delete(null),
        /Restriction required for delete/
      );
    });

    it('should throw error if no matching link found', async () => {
      await assert.rejects(
        async () => await links.delete([999999, 0, 0]),
        /No links found matching restriction/
      );
    });
  });
});
