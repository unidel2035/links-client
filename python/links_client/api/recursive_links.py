"""RecursiveLinks - Recursive API wrapper for nested lists and dicts"""

from typing import List, Dict, Any, Optional, Union
from links_client.api.ilinks import ILinks
from links_client.utils.logger import get_logger

logger = get_logger(__name__)


class RecursiveLinks:
    """
    RecursiveLinks - Recursive wrapper for ILinks that supports nested structures

    Converts between Python nested lists/dicts and Links notation:
    - [[1, 2], [3, 4]] ↔ ((1 2) (3 4))
    - { "1": [1, { "2": [5, 6] }, 3, 4] } ↔ (1: 1 (2: 5 6) 3 4)
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize RecursiveLinks

        Args:
            db_path: Path to database file
        """
        self.links = ILinks(db_path)
        self.id_counter = 1000000  # Start high to avoid conflicts with user IDs

    def get_links(self) -> ILinks:
        """
        Get the underlying ILinks instance

        Returns:
            ILinks instance
        """
        return self.links

    def _generate_temp_id(self) -> int:
        """
        Generate a unique temporary ID for internal use

        Returns:
            New unique ID
        """
        temp_id = self.id_counter
        self.id_counter += 1
        return temp_id

    def create_from_nested_list(self, nested_list: List[Any]) -> List[int]:
        """
        Create links from nested list structure
        [[1, 2], [3, 4]] represents two links: (1 2) and (3 4)

        Args:
            nested_list: Nested list structure

        Returns:
            List of created link IDs
        """
        try:
            link_ids = []

            for item in nested_list:
                if isinstance(item, list):
                    if len(item) >= 2:
                        # Create a link from [source, target]
                        source, target = item[0], item[1]

                        # Recursively handle nested lists
                        actual_source = (
                            self.create_from_nested_list([source])[0]
                            if isinstance(source, list)
                            else source
                        )
                        actual_target = (
                            self.create_from_nested_list([target])[0]
                            if isinstance(target, list)
                            else target
                        )

                        link_id = self.links.create([actual_source, actual_target])
                        link_ids.append(link_id)
                    else:
                        raise ValueError("List items must have at least 2 elements [source, target]")
                else:
                    # Single value - skip
                    logger.warning(f"Skipping non-list item in nested list: {item}")

            return link_ids
        except Exception as error:
            logger.error(f"Failed to create from nested list: {error}")
            raise

    def create_from_nested_dict(self, nested_dict: Dict[str, Any]) -> Dict[str, int]:
        """
        Create links from nested dict structure with references
        { "1": [1, { "2": [5, 6] }, 3, 4] } represents (1: 1 (2: 5 6) 3 4)

        Args:
            nested_dict: Nested dict structure with named links

        Returns:
            Map of reference names to created link IDs
        """
        try:
            reference_map = {}

            # Process each named link in the dict
            for ref_name, value in nested_dict.items():
                if isinstance(value, list):
                    # Create a sequence of links from the list
                    link_id = self._create_sequence_from_list(value, reference_map)
                    reference_map[ref_name] = link_id
                else:
                    logger.warning(f"Skipping non-list value in nested dict: {ref_name}={value}")

            return reference_map
        except Exception as error:
            logger.error(f"Failed to create from nested dict: {error}")
            raise

    def _create_sequence_from_list(
        self,
        lst: List[Any],
        reference_map: Dict[str, int]
    ) -> int:
        """
        Create a sequence of links from a list, handling nested dicts

        Args:
            lst: List with potential nested dicts
            reference_map: Map to store reference IDs

        Returns:
            ID of the created sequence link
        """
        if not lst:
            raise ValueError("Cannot create sequence from empty list")

        # For lists with exactly 2 elements, create a single link
        if len(lst) == 2 and not self._has_nested_dict(lst):
            source, target = lst[0], lst[1]
            return self.links.create([source, target])

        # For longer sequences or nested structures, create a chain of links
        current_id = None

        for item in lst:
            if isinstance(item, dict):
                # Nested dict with references
                nested_refs = self.create_from_nested_dict(item)
                # Use the first created link from nested dict
                first_ref = next(iter(nested_refs.values()))

                if current_id is None:
                    current_id = first_ref
                else:
                    # Create link connecting previous to this nested structure
                    current_id = self.links.create([current_id, first_ref])

                # Merge reference maps
                reference_map.update(nested_refs)
            elif isinstance(item, list):
                # Nested list
                nested_id = self._create_sequence_from_list(item, reference_map)

                if current_id is None:
                    current_id = nested_id
                else:
                    current_id = self.links.create([current_id, nested_id])
            else:
                # Simple value
                if current_id is None:
                    current_id = item
                else:
                    current_id = self.links.create([current_id, item])

        return current_id

    def _has_nested_dict(self, lst: List[Any]) -> bool:
        """
        Check if list contains nested dicts

        Args:
            lst: List to check

        Returns:
            True if contains nested dicts
        """
        return any(isinstance(item, dict) for item in lst)

    def read_as_nested_list(self, restriction: Optional[List[int]] = None) -> List[List[int]]:
        """
        Read links and convert to nested list structure

        Args:
            restriction: Filter for links

        Returns:
            Nested list structure
        """
        try:
            result = []
            visited = set()

            def handler(link):
                if link["id"] not in visited:
                    visited.add(link["id"])
                    result.append([link["source"], link["target"]])
                return self.links.constants.CONTINUE

            self.links.each(restriction, handler)

            return result
        except Exception as error:
            logger.error(f"Failed to read as nested list: {error}")
            raise

    def to_links_notation(self, nested_list: List[Any]) -> str:
        """
        Convert nested list to Links notation string
        [[1, 2], [3, 4]] -> "((1 2) (3 4))"

        Args:
            nested_list: Nested list structure

        Returns:
            Links notation string
        """
        def convert(item):
            if isinstance(item, list):
                inner = ' '.join(convert(el) for el in item)
                return f"({inner})"
            return str(item)

        inner = ' '.join(convert(item) for item in nested_list)
        return f"({inner})"

    def to_links_notation_with_refs(self, nested_dict: Dict[str, Any]) -> str:
        """
        Convert nested dict with references to Links notation string
        { "1": [1, { "2": [5, 6] }, 3, 4] } -> "(1: 1 (2: 5 6) 3 4)"

        Args:
            nested_dict: Nested dict structure

        Returns:
            Links notation string with references
        """
        def convert(item, ref_name=None):
            if isinstance(item, dict):
                # Nested dict with its own references
                parts = [convert(val, ref) for ref, val in item.items()]
                return ' '.join(parts)
            elif isinstance(item, list):
                inner = ' '.join(convert(el) for el in item)
                return f"({ref_name}: {inner})" if ref_name else f"({inner})"
            return str(item)

        parts = [convert(val, ref) for ref, val in nested_dict.items()]
        return f"({' '.join(parts)})"

    def parse_links_notation(self, notation: str) -> List[Any]:
        """
        Parse Links notation string to nested list
        "((1 2) (3 4))" -> [[1, 2], [3, 4]]

        Args:
            notation: Links notation string

        Returns:
            Nested list structure
        """
        notation = notation.strip()

        # Remove outer parentheses
        if notation.startswith('(') and notation.endswith(')'):
            notation = notation[1:-1].strip()

        result = []
        current = ''
        depth = 0

        for char in notation:
            if char == '(':
                depth += 1
                current += char
            elif char == ')':
                depth -= 1
                current += char

                if depth == 0 and current.strip():
                    result.append(self.parse_links_notation(current.strip()))
                    current = ''
            elif char == ' ' and depth == 0:
                if current.strip():
                    # Parse number
                    try:
                        num = int(current.strip())
                        result.append(num)
                    except ValueError:
                        pass
                    current = ''
            else:
                current += char

        # Handle remaining content
        if current.strip():
            try:
                num = int(current.strip())
                result.append(num)
            except ValueError:
                pass

        return result
