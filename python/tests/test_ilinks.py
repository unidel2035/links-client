"""Test file for ILinks flat API"""

import os
import unittest
from pathlib import Path
from links_client.api.ilinks import ILinks, LinkConstants


class TestILinksAPI(unittest.TestCase):
    """Test cases for ILinks flat API"""

    @classmethod
    def setUpClass(cls):
        """Set up test database path"""
        cls.test_db_path = Path("data/test-ilinks.links")
        # Clean up test database if exists
        if cls.test_db_path.exists():
            cls.test_db_path.unlink()

    @classmethod
    def tearDownClass(cls):
        """Clean up test database"""
        if cls.test_db_path.exists():
            cls.test_db_path.unlink()

    def setUp(self):
        """Set up test instance"""
        self.links = ILinks(str(self.test_db_path))

    def test_constants(self):
        """Test that constants are available"""
        constants = self.links.get_constants()
        self.assertEqual(constants, LinkConstants)
        self.assertEqual(LinkConstants.ANY.value, 0)
        self.assertIsNotNone(LinkConstants.CONTINUE)
        self.assertIsNotNone(LinkConstants.BREAK)

    def test_create_link(self):
        """Test creating a link with source and target"""
        link_id = self.links.create([1, 2])
        self.assertIsInstance(link_id, int)
        self.assertGreater(link_id, 0)

    def test_create_multiple_links(self):
        """Test creating multiple links"""
        link_id1 = self.links.create([3, 4])
        link_id2 = self.links.create([5, 6])
        self.assertGreater(link_id1, 0)
        self.assertGreater(link_id2, 0)
        self.assertNotEqual(link_id1, link_id2)

    def test_create_with_handler(self):
        """Test that handler is called on create"""
        handler_called = False
        captured_change = None

        def handler(change):
            nonlocal handler_called, captured_change
            handler_called = True
            captured_change = change

        link_id = self.links.create([7, 8], handler)
        self.assertTrue(handler_called)
        self.assertIsNone(captured_change["before"])
        self.assertIsNotNone(captured_change["after"])
        self.assertEqual(captured_change["after"]["id"], link_id)

    def test_create_invalid_substitution(self):
        """Test that creating with invalid substitution raises error"""
        with self.assertRaises(ValueError):
            self.links.create([1])

    def test_count_all_links(self):
        """Test counting all links"""
        count = self.links.count()
        self.assertGreater(count, 0)

    def test_count_with_restriction(self):
        """Test counting links with restriction"""
        self.links.create([10, 20])
        self.links.create([10, 30])
        self.links.create([40, 20])

        count = self.links.count([10, 0])
        self.assertGreaterEqual(count, 2)

    def test_count_non_matching(self):
        """Test counting with non-matching restriction"""
        count = self.links.count([999999, 999999])
        self.assertEqual(count, 0)

    def test_each_iterate_all(self):
        """Test iterating through all links"""
        all_links = []

        def handler(link):
            all_links.append(link)
            return LinkConstants.CONTINUE

        result = self.links.each(None, handler)
        self.assertEqual(result, LinkConstants.CONTINUE)
        self.assertGreater(len(all_links), 0)

    def test_each_with_break(self):
        """Test that each respects Break signal"""
        iteration_count = 0

        def handler(link):
            nonlocal iteration_count
            iteration_count += 1
            if iteration_count >= 2:
                return LinkConstants.BREAK
            return LinkConstants.CONTINUE

        result = self.links.each(None, handler)
        self.assertEqual(result, LinkConstants.BREAK)
        self.assertEqual(iteration_count, 2)

    def test_each_with_restriction(self):
        """Test filtering links with restriction"""
        link_id = self.links.create([100, 200])
        found_links = []

        def handler(link):
            found_links.append(link)
            return LinkConstants.CONTINUE

        self.links.each([100, 200], handler)
        self.assertGreater(len(found_links), 0)
        self.assertTrue(
            any(l["source"] == 100 and l["target"] == 200 for l in found_links)
        )

    def test_update_link(self):
        """Test updating a link"""
        link_id = self.links.create([50, 60])
        updated_id = self.links.update([link_id, 0, 0], [70, 80])

        self.assertEqual(updated_id, link_id)

        # Verify the update
        found_links = []

        def handler(link):
            found_links.append(link)
            return LinkConstants.CONTINUE

        self.links.each([link_id, 0, 0], handler)
        self.assertEqual(found_links[0]["source"], 70)
        self.assertEqual(found_links[0]["target"], 80)

    def test_update_with_handler(self):
        """Test that handler is called on update"""
        link_id = self.links.create([90, 100])
        handler_called = False
        captured_change = None

        def handler(change):
            nonlocal handler_called, captured_change
            handler_called = True
            captured_change = change

        self.links.update([link_id, 0, 0], [110, 120], handler)
        self.assertTrue(handler_called)
        self.assertIsNotNone(captured_change["before"])
        self.assertIsNotNone(captured_change["after"])
        self.assertEqual(captured_change["before"]["source"], 90)
        self.assertEqual(captured_change["after"]["source"], 110)

    def test_update_no_restriction(self):
        """Test that update requires restriction"""
        with self.assertRaises(ValueError):
            self.links.update(None, [1, 2])

    def test_update_no_matching_link(self):
        """Test that update raises error if no matching link"""
        with self.assertRaises(ValueError):
            self.links.update([999999, 0, 0], [1, 2])

    def test_delete_link(self):
        """Test deleting a link"""
        link_id = self.links.create([130, 140])
        deleted_id = self.links.delete([link_id, 0, 0])

        self.assertEqual(deleted_id, link_id)

        # Verify deletion
        count = self.links.count([link_id, 0, 0])
        self.assertEqual(count, 0)

    def test_delete_with_handler(self):
        """Test that handler is called on delete"""
        link_id = self.links.create([150, 160])
        handler_called = False
        captured_change = None

        def handler(change):
            nonlocal handler_called, captured_change
            handler_called = True
            captured_change = change

        self.links.delete([link_id, 0, 0], handler)
        self.assertTrue(handler_called)
        self.assertIsNotNone(captured_change["before"])
        self.assertIsNone(captured_change["after"])

    def test_delete_no_restriction(self):
        """Test that delete requires restriction"""
        with self.assertRaises(ValueError):
            self.links.delete(None)

    def test_delete_no_matching_link(self):
        """Test that delete raises error if no matching link"""
        with self.assertRaises(ValueError):
            self.links.delete([999999, 0, 0])


if __name__ == "__main__":
    unittest.main()
