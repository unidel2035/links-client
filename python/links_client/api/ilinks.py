"""ILinks - Universal flat API compatible with Platform.Data ILinks interface"""

from typing import List, Optional, Callable, Dict, Any
from enum import Enum
from links_client.services.link_db_service import LinkDBService
from links_client.utils.logger import get_logger

logger = get_logger(__name__)


class LinkConstants(Enum):
    """Constants for ILinks operations"""
    CONTINUE = "continue"
    BREAK = "break"
    ANY = 0  # Use 0 to represent "any" in restrictions


class ILinks:
    """
    ILinks - Universal flat Turing complete API for Links
    Compatible with https://github.com/linksplatform/Data/blob/main/csharp/Platform.Data/ILinks.cs

    Flat meaning it only works with a single link at a time.
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize ILinks

        Args:
            db_path: Path to database file
        """
        self.db = LinkDBService(db_path)
        self.constants = LinkConstants

    def get_constants(self) -> LinkConstants:
        """
        Get constants for this Links instance

        Returns:
            Constants enum
        """
        return self.constants

    def count(self, restriction: Optional[List[int]] = None) -> int:
        """
        Count links matching the restriction

        Args:
            restriction: List [id] or [id, source, target] to filter links, None for all

        Returns:
            Number of matching links
        """
        try:
            all_links = self.db.read_all_links()

            if not restriction:
                return len(all_links)

            # Filter based on restriction
            filtered = self._filter_links(all_links, restriction)
            return len(filtered)
        except Exception as error:
            logger.error(f"Failed to count links: {error}")
            raise

    def each(
        self,
        restriction: Optional[List[int]] = None,
        handler: Optional[Callable[[Dict[str, int]], LinkConstants]] = None
    ) -> LinkConstants:
        """
        Iterate through links matching restriction, calling handler for each

        Args:
            restriction: List to filter links, None for all
            handler: Callback function(link) that returns CONTINUE or BREAK

        Returns:
            CONTINUE if completed, BREAK if interrupted
        """
        try:
            all_links = self.db.read_all_links()
            filtered = self._filter_links(all_links, restriction)

            if not handler:
                return self.constants.CONTINUE

            for link in filtered:
                result = handler(link)
                if result == self.constants.BREAK:
                    return self.constants.BREAK

            return self.constants.CONTINUE
        except Exception as error:
            logger.error(f"Failed to iterate links: {error}")
            raise

    def create(
        self,
        substitution: Optional[List[int]] = None,
        handler: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> int:
        """
        Create a new link

        Args:
            substitution: List [source, target] or [id, source, target]
            handler: Callback function for changes

        Returns:
            Created link ID
        """
        try:
            if not substitution or len(substitution) < 2:
                raise ValueError("Substitution must contain at least [source, target]")

            source, target = substitution[0], substitution[1]
            link = self.db.create_link(source, target)

            if handler:
                handler({"before": None, "after": link})

            return link["id"]
        except Exception as error:
            logger.error(f"Failed to create link: {error}")
            raise

    def update(
        self,
        restriction: Optional[List[int]] = None,
        substitution: Optional[List[int]] = None,
        handler: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> int:
        """
        Update existing links matching restriction

        Args:
            restriction: List to filter links to update
            substitution: New values [source, target] or [id, source, target]
            handler: Callback function for changes

        Returns:
            Updated link ID
        """
        try:
            if not restriction:
                raise ValueError("Restriction required for update")
            if not substitution or len(substitution) < 2:
                raise ValueError("Substitution must contain at least [source, target]")

            all_links = self.db.read_all_links()
            filtered = self._filter_links(all_links, restriction)

            if not filtered:
                raise ValueError("No links found matching restriction")

            # Update first matching link
            link_to_update = filtered[0]
            new_source, new_target = (
                substitution if len(substitution) == 2
                else (substitution[1], substitution[2])
            )

            before = dict(link_to_update)
            updated = self.db.update_link(
                link_to_update["id"],
                new_source,
                new_target
            )

            if handler:
                handler({"before": before, "after": updated})

            return updated["id"]
        except Exception as error:
            logger.error(f"Failed to update link: {error}")
            raise

    def delete(
        self,
        restriction: Optional[List[int]] = None,
        handler: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> int:
        """
        Delete links matching restriction

        Args:
            restriction: List to filter links to delete
            handler: Callback function for changes

        Returns:
            Deleted link ID
        """
        try:
            if not restriction:
                raise ValueError("Restriction required for delete")

            all_links = self.db.read_all_links()
            filtered = self._filter_links(all_links, restriction)

            if not filtered:
                raise ValueError("No links found matching restriction")

            # Delete first matching link
            link_to_delete = filtered[0]
            before = dict(link_to_delete)
            self.db.delete_link(link_to_delete["id"])

            if handler:
                handler({"before": before, "after": None})

            return link_to_delete["id"]
        except Exception as error:
            logger.error(f"Failed to delete link: {error}")
            raise

    def _filter_links(
        self,
        links: List[Dict[str, int]],
        restriction: Optional[List[int]]
    ) -> List[Dict[str, int]]:
        """
        Helper method to filter links based on restriction

        Args:
            links: All links
            restriction: Restriction list

        Returns:
            Filtered links
        """
        if not restriction:
            return links

        filtered = []
        for link in links:
            if len(restriction) == 1:
                # [id] - match by ID
                if restriction[0] == self.constants.ANY.value or link["id"] == restriction[0]:
                    filtered.append(link)
            elif len(restriction) == 2:
                # [source, target] - match by source and target
                if ((restriction[0] == self.constants.ANY.value or link["source"] == restriction[0]) and
                    (restriction[1] == self.constants.ANY.value or link["target"] == restriction[1])):
                    filtered.append(link)
            elif len(restriction) >= 3:
                # [id, source, target] - match all three
                if ((restriction[0] == self.constants.ANY.value or link["id"] == restriction[0]) and
                    (restriction[1] == self.constants.ANY.value or link["source"] == restriction[1]) and
                    (restriction[2] == self.constants.ANY.value or link["target"] == restriction[2])):
                    filtered.append(link)

        return filtered
