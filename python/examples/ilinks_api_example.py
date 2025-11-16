"""Example demonstrating the ILinks flat API"""

from pathlib import Path
from links_client.api.ilinks import ILinks, LinkConstants


def main():
    print("=== ILinks Flat API Example ===\n")

    # Create ILinks instance
    db_path = Path("data/example-ilinks.links")
    links = ILinks(str(db_path))

    # Get constants
    constants = links.get_constants()
    print(f"Constants: Continue={constants.CONTINUE}, Break={constants.BREAK}, Any={constants.ANY.value}")

    # Create some links
    print("\n--- Creating Links ---")
    link1_id = links.create([1, 2])
    print(f"Created link (1 -> 2) with ID: {link1_id}")

    link2_id = links.create([3, 4])
    print(f"Created link (3 -> 4) with ID: {link2_id}")

    link3_id = links.create([1, 5])
    print(f"Created link (1 -> 5) with ID: {link3_id}")

    # Count links
    print("\n--- Counting Links ---")
    total_count = links.count()
    print(f"Total links in database: {total_count}")

    count_with_source_1 = links.count([1, constants.ANY.value])
    print(f"Links with source=1: {count_with_source_1}")

    # Iterate through links
    print("\n--- Iterating Through Links ---")
    iteration_count = 0

    def iterator(link):
        nonlocal iteration_count
        print(f"Link {link['id']}: {link['source']} -> {link['target']}")
        iteration_count += 1
        if iteration_count >= 3:
            return constants.BREAK
        return constants.CONTINUE

    links.each(None, iterator)

    # Update a link
    print("\n--- Updating Link ---")
    print(f"Updating link {link1_id} to (10 -> 20)")

    def update_handler(change):
        print("Before:", change["before"])
        print("After:", change["after"])

    links.update([link1_id, constants.ANY.value, constants.ANY.value], [10, 20], update_handler)

    # Read updated link
    updated_links = []

    def read_updated(link):
        updated_links.append(link)
        return constants.CONTINUE

    links.each([link1_id, constants.ANY.value, constants.ANY.value], read_updated)
    print("Updated link:", updated_links[0])

    # Delete a link
    print("\n--- Deleting Link ---")
    print(f"Deleting link {link2_id}")

    def delete_handler(change):
        print("Deleted:", change["before"])

    links.delete([link2_id, constants.ANY.value, constants.ANY.value], delete_handler)

    # Count after deletion
    final_count = links.count()
    print(f"\nFinal link count: {final_count}")

    print("\n=== Example Complete ===")


if __name__ == "__main__":
    main()
