"""Example demonstrating the RecursiveLinks API"""

import json
from pathlib import Path
from links_client.api.recursive_links import RecursiveLinks


def main():
    print("=== RecursiveLinks API Example ===\n")

    # Create RecursiveLinks instance
    db_path = Path("data/example-recursive.links")
    recursive_links = RecursiveLinks(str(db_path))

    # Example 1: Create from nested list [[1, 2], [3, 4]]
    print("--- Example 1: Nested List ---")
    nested_list = [[1, 2], [3, 4]]
    print(f"Creating from nested list: {json.dumps(nested_list)}")

    link_ids = recursive_links.create_from_nested_list(nested_list)
    print(f"Created link IDs: {link_ids}")

    notation1 = recursive_links.to_links_notation(nested_list)
    print(f"Links notation: {notation1}")
    print("Expected: ((1 2) (3 4))")

    # Example 2: Create from nested dict with references
    print("\n--- Example 2: Nested Dict with References ---")
    nested_dict = {
        "1": [1, {"2": [5, 6]}, 3, 4]
    }
    print(f"Creating from nested dict: {json.dumps(nested_dict)}")

    ref_map = recursive_links.create_from_nested_dict(nested_dict)
    print(f"Created reference map: {ref_map}")

    notation2 = recursive_links.to_links_notation_with_refs(nested_dict)
    print(f"Links notation with refs: {notation2}")
    print("Expected: (1: 1 (2: 5 6) 3 4)")

    # Example 3: Parse Links notation
    print("\n--- Example 3: Parse Links Notation ---")
    links_notation = "((1 2) (3 4))"
    print(f"Parsing notation: {links_notation}")

    parsed = recursive_links.parse_links_notation(links_notation)
    print(f"Parsed result: {json.dumps(parsed)}")

    # Example 4: Round-trip conversion
    print("\n--- Example 4: Round-trip Conversion ---")
    original = [[7, 8], [9, 10]]
    print(f"Original list: {json.dumps(original)}")

    to_notation = recursive_links.to_links_notation(original)
    print(f"To notation: {to_notation}")

    back_to_list = recursive_links.parse_links_notation(to_notation)
    print(f"Back to list: {json.dumps(back_to_list)}")
    print(f"Match: {original == back_to_list}")

    # Example 5: Read stored links as nested list
    print("\n--- Example 5: Read as Nested List ---")
    stored_links = recursive_links.read_as_nested_list()
    print("All stored links as nested list:")
    print(json.dumps(stored_links[:5], indent=2))  # Show first 5

    # Example 6: Access underlying ILinks
    print("\n--- Example 6: Using Underlying ILinks ---")
    ilinks = recursive_links.get_links()
    count = ilinks.count()
    print(f"Total links in database (via ILinks): {count}")

    print("\n=== Example Complete ===")


if __name__ == "__main__":
    main()
