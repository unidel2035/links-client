---
'@unidel2035/links-client': minor
---

Remove deprecated `toLinksNotationWithRefs` and `to_links_notation_with_refs` functions. Add CI/CD with changesets and test-anywhere testing framework.

**Breaking Changes:**
- Removed `toLinksNotationWithRefs()` / `to_links_notation_with_refs()` - use `toLinksNotation()` / `to_links_notation()` instead

**New Features:**
- Added CI/CD workflow with changeset-based releases
- Migrated JavaScript tests to test-anywhere framework
- Added automated changeset validation for pull requests

**Documentation:**
- Removed deprecated function references from UNIVERSAL_API.md
