"""Test file for RecursiveLinks API"""

import os
import unittest
from pathlib import Path
from links_client.api.recursive_links import RecursiveLinks


class TestRecursiveLinksAPI(unittest.TestCase):
    """Test cases for RecursiveLinks API"""

    @classmethod
    def setUpClass(cls):
        """Set up test database path"""
        cls.test_db_path = Path("data/test-recursive.links")
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
        self.recursive_links = RecursiveLinks(str(self.test_db_path))

    def test_create_from_simple_nested_list(self):
        """Test creating links from simple nested list [[1, 2], [3, 4]]"""
        link_ids = self.recursive_links.create_from_nested_list([[1, 2], [3, 4]])

        self.assertEqual(len(link_ids), 2)
        self.assertGreater(link_ids[0], 0)
        self.assertGreater(link_ids[1], 0)

    def test_create_from_nested_list_multiple_elements(self):
        """Test creating links from nested list with multiple elements"""
        link_ids = self.recursive_links.create_from_nested_list([
            [5, 6],
            [7, 8],
            [9, 10]
        ])

        self.assertEqual(len(link_ids), 3)

    def test_create_from_deeply_nested_list(self):
        """Test handling deeply nested lists"""
        link_ids = self.recursive_links.create_from_nested_list([
            [[11, 12], 13]
        ])

        self.assertGreater(len(link_ids), 0)

    def test_create_from_invalid_list_item(self):
        """Test error for list items with less than 2 elements"""
        with self.assertRaises(ValueError):
            self.recursive_links.create_from_nested_list([[1]])

    def test_create_from_nested_dict_simple(self):
        """Test creating links from nested dict with references"""
        ref_map = self.recursive_links.create_from_nested_dict({
            "1": [1, 2]
        })

        self.assertGreater(ref_map["1"], 0)

    def test_create_from_nested_dict_multiple_refs(self):
        """Test creating links from dict with multiple references"""
        ref_map = self.recursive_links.create_from_nested_dict({
            "ref1": [5, 6],
            "ref2": [7, 8]
        })

        self.assertGreater(ref_map["ref1"], 0)
        self.assertGreater(ref_map["ref2"], 0)

    def test_create_from_nested_dict_with_nested_objects(self):
        """Test handling nested dicts within dicts"""
        ref_map = self.recursive_links.create_from_nested_dict({
            "1": [1, {"2": [5, 6]}, 3, 4]
        })

        self.assertGreater(ref_map["1"], 0)
        self.assertGreater(ref_map["2"], 0)

    def test_read_as_nested_list(self):
        """Test reading links as nested list"""
        # Create some links first
        self.recursive_links.create_from_nested_list([[20, 21], [22, 23]])

        # Read them back
        nested_list = self.recursive_links.read_as_nested_list()

        self.assertIsInstance(nested_list, list)
        self.assertGreater(len(nested_list), 0)
        self.assertTrue(
            any(isinstance(item, list) and len(item) == 2 for item in nested_list)
        )

    def test_read_as_nested_list_with_restriction(self):
        """Test filtering links when restriction is provided"""
        link_ids = self.recursive_links.create_from_nested_list([[30, 31]])
        first_link_id = link_ids[0]

        # Read with restriction
        nested_list = self.recursive_links.read_as_nested_list([first_link_id, 0, 0])

        self.assertGreater(len(nested_list), 0)

    def test_to_links_notation_simple(self):
        """Test converting nested list to Links notation"""
        notation = self.recursive_links.to_links_notation([[1, 2], [3, 4]])
        self.assertEqual(notation, "((1 2) (3 4))")

    def test_to_links_notation_single_element(self):
        """Test converting simple list to Links notation"""
        notation = self.recursive_links.to_links_notation([[5, 6]])
        self.assertEqual(notation, "((5 6))")

    def test_to_links_notation_deeply_nested(self):
        """Test converting deeply nested list to Links notation"""
        notation = self.recursive_links.to_links_notation([[[1, 2], 3]])
        self.assertIn("(", notation)

    def test_to_links_notation_with_refs_simple(self):
        """Test converting nested dict with refs to Links notation"""
        notation = self.recursive_links.to_links_notation_with_refs({
            "1": [1, 2]
        })
        self.assertIn("1:", notation)
        self.assertIn("(", notation)

    def test_to_links_notation_with_refs_complex(self):
        """Test converting complex nested dict to Links notation"""
        notation = self.recursive_links.to_links_notation_with_refs({
            "1": [1, {"2": [5, 6]}, 3, 4]
        })
        self.assertIn("1:", notation)
        self.assertIn("2:", notation)

    def test_parse_links_notation_simple(self):
        """Test parsing simple Links notation to nested list"""
        result = self.recursive_links.parse_links_notation("((1 2) (3 4))")
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], [1, 2])
        self.assertEqual(result[1], [3, 4])

    def test_parse_links_notation_single_link(self):
        """Test parsing single link notation"""
        result = self.recursive_links.parse_links_notation("((5 6))")
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], [5, 6])

    def test_parse_links_notation_numbers_only(self):
        """Test parsing notation with numbers only"""
        result = self.recursive_links.parse_links_notation("(1 2 3)")
        self.assertEqual(result, [1, 2, 3])

    def test_parse_links_notation_no_outer_parens(self):
        """Test handling notation without outer parentheses"""
        result = self.recursive_links.parse_links_notation("(1 2)")
        self.assertIsInstance(result, list)

    def test_round_trip_conversion_simple(self):
        """Test converting nested list to notation and back"""
        original = [[1, 2], [3, 4]]
        notation = self.recursive_links.to_links_notation(original)
        parsed = self.recursive_links.parse_links_notation(notation)

        self.assertEqual(parsed, original)

    def test_round_trip_conversion_single_element(self):
        """Test single element round-trip"""
        original = [[5, 6]]
        notation = self.recursive_links.to_links_notation(original)
        parsed = self.recursive_links.parse_links_notation(notation)

        self.assertEqual(parsed, original)

    def test_get_underlying_ilinks(self):
        """Test accessing underlying ILinks instance"""
        links = self.recursive_links.get_links()
        self.assertIsNotNone(links)
        self.assertTrue(hasattr(links, "get_constants"))

    def test_integration_with_ilinks(self):
        """Test that RecursiveLinks uses same database as underlying ILinks"""
        links = self.recursive_links.get_links()
        count_before = links.count()

        self.recursive_links.create_from_nested_list([[40, 41]])

        count_after = links.count()
        self.assertGreater(count_after, count_before)


if __name__ == "__main__":
    unittest.main()
