// Test file for RecursiveLinks API
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import RecursiveLinks from '../src/api/recursive-links.js';
import fs from 'fs';
import path from 'path';

// Test database path
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-recursive.links');

describe('RecursiveLinks API', () => {
  let recursiveLinks;

  before(async () => {
    // Clean up test database if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    recursiveLinks = new RecursiveLinks(TEST_DB_PATH);
  });

  after(async () => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Nested Array Creation', () => {
    it('should create links from simple nested array [[1, 2], [3, 4]]', async () => {
      const linkIds = await recursiveLinks.createFromNestedArray([[1, 2], [3, 4]]);

      assert.strictEqual(linkIds.length, 2, 'Should create 2 links');
      assert.ok(linkIds[0] > 0, 'First link ID should be positive');
      assert.ok(linkIds[1] > 0, 'Second link ID should be positive');
    });

    it('should create links from nested array with multiple elements', async () => {
      const linkIds = await recursiveLinks.createFromNestedArray([
        [5, 6],
        [7, 8],
        [9, 10]
      ]);

      assert.strictEqual(linkIds.length, 3, 'Should create 3 links');
    });

    it('should handle deeply nested arrays', async () => {
      const linkIds = await recursiveLinks.createFromNestedArray([
        [[11, 12], 13]
      ]);

      assert.ok(linkIds.length > 0, 'Should create links from deeply nested array');
    });

    it('should throw error for array items with less than 2 elements', async () => {
      await assert.rejects(
        async () => await recursiveLinks.createFromNestedArray([[1]]),
        /Array items must have at least 2 elements/
      );
    });
  });

  describe('Nested Object Creation', () => {
    it('should create links from nested object with references', async () => {
      const refMap = await recursiveLinks.createFromNestedObject({
        "1": [1, 2]
      });

      assert.ok(refMap["1"] > 0, 'Should create link with reference "1"');
    });

    it('should create links from complex nested object', async () => {
      const refMap = await recursiveLinks.createFromNestedObject({
        "ref1": [5, 6],
        "ref2": [7, 8]
      });

      assert.ok(refMap["ref1"] > 0, 'Should create link with reference "ref1"');
      assert.ok(refMap["ref2"] > 0, 'Should create link with reference "ref2"');
    });

    it('should handle nested objects within objects', async () => {
      const refMap = await recursiveLinks.createFromNestedObject({
        "1": [1, { "2": [5, 6] }, 3, 4]
      });

      assert.ok(refMap["1"] > 0, 'Should create link with reference "1"');
      assert.ok(refMap["2"] > 0, 'Should create link with reference "2"');
    });
  });

  describe('Read as Nested Array', () => {
    it('should read links as nested array', async () => {
      // Create some links first
      await recursiveLinks.createFromNestedArray([[20, 21], [22, 23]]);

      // Read them back
      const nestedArray = await recursiveLinks.readAsNestedArray();

      assert.ok(Array.isArray(nestedArray), 'Should return array');
      assert.ok(nestedArray.length > 0, 'Should have at least one link');
      assert.ok(nestedArray.some(item =>
        Array.isArray(item) && item.length === 2
      ), 'Should have [source, target] arrays');
    });

    it('should filter links when restriction is provided', async () => {
      const linkIds = await recursiveLinks.createFromNestedArray([[30, 31]]);
      const firstLinkId = linkIds[0];

      // Read with restriction
      const nestedArray = await recursiveLinks.readAsNestedArray([firstLinkId, 0, 0]);

      assert.ok(nestedArray.length > 0, 'Should find the specific link');
    });
  });

  describe('Links Notation Conversion', () => {
    it('should convert nested array to Links notation', () => {
      const notation = recursiveLinks.toLinksNotation([[1, 2], [3, 4]]);
      assert.strictEqual(notation, '((1 2) (3 4))');
    });

    it('should convert simple array to Links notation', () => {
      const notation = recursiveLinks.toLinksNotation([[5, 6]]);
      assert.strictEqual(notation, '((5 6))');
    });

    it('should convert deeply nested array to Links notation', () => {
      const notation = recursiveLinks.toLinksNotation([[[1, 2], 3]]);
      assert.ok(notation.includes('('), 'Should contain parentheses');
    });

    it('should convert nested object with refs to Links notation', () => {
      const notation = recursiveLinks.toLinksNotationWithRefs({
        "1": [1, 2]
      });
      assert.ok(notation.includes('1:'), 'Should include reference label');
      assert.ok(notation.includes('('), 'Should contain parentheses');
    });

    it('should convert complex nested object to Links notation', () => {
      const notation = recursiveLinks.toLinksNotationWithRefs({
        "1": [1, { "2": [5, 6] }, 3, 4]
      });
      assert.ok(notation.includes('1:'), 'Should include reference label "1"');
      assert.ok(notation.includes('2:'), 'Should include reference label "2"');
    });
  });

  describe('Parse Links Notation', () => {
    it('should parse simple Links notation to nested array', () => {
      const result = recursiveLinks.parseLinksNotation('((1 2) (3 4))');
      assert.ok(Array.isArray(result), 'Should return array');
      assert.strictEqual(result.length, 2, 'Should have 2 elements');
      assert.deepStrictEqual(result[0], [1, 2]);
      assert.deepStrictEqual(result[1], [3, 4]);
    });

    it('should parse single link notation', () => {
      const result = recursiveLinks.parseLinksNotation('((5 6))');
      assert.ok(Array.isArray(result), 'Should return array');
      assert.strictEqual(result.length, 1, 'Should have 1 element');
      assert.deepStrictEqual(result[0], [5, 6]);
    });

    it('should parse notation with numbers only', () => {
      const result = recursiveLinks.parseLinksNotation('(1 2 3)');
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should handle notation without outer parentheses', () => {
      const result = recursiveLinks.parseLinksNotation('(1 2)');
      assert.ok(Array.isArray(result), 'Should return array');
    });
  });

  describe('Round-trip Conversion', () => {
    it('should convert nested array to notation and back', () => {
      const original = [[1, 2], [3, 4]];
      const notation = recursiveLinks.toLinksNotation(original);
      const parsed = recursiveLinks.parseLinksNotation(notation);

      assert.deepStrictEqual(parsed, original, 'Round-trip should preserve structure');
    });

    it('should handle single element round-trip', () => {
      const original = [[5, 6]];
      const notation = recursiveLinks.toLinksNotation(original);
      const parsed = recursiveLinks.parseLinksNotation(notation);

      assert.deepStrictEqual(parsed, original, 'Round-trip should preserve single element');
    });
  });

  describe('Integration with ILinks', () => {
    it('should access underlying ILinks instance', () => {
      const links = recursiveLinks.getLinks();
      assert.ok(links, 'Should have ILinks instance');
      assert.ok(links.getConstants, 'Should have ILinks methods');
    });

    it('should use same database as underlying ILinks', async () => {
      const links = recursiveLinks.getLinks();
      const countBefore = await links.count();

      await recursiveLinks.createFromNestedArray([[40, 41]]);

      const countAfter = await links.count();
      assert.ok(countAfter > countBefore, 'Count should increase after creating links');
    });
  });
});
