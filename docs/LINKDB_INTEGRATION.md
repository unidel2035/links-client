# Link-CLI Database Integration

## Overview

This document describes the integration of [link-cli (clink)](https://github.com/link-foundation/link-cli) as the database solution for storing sidebar menu items and other hierarchical data in the DronDoc application.

**Issue**: #1800 - База данных
**Implementation Date**: 2025-11-02
**Technology**: link-cli (clink) v2.2.2 - Associative link-based data storage

## What is link-cli?

link-cli (also called `clink`, `CLInk`, or `cLINK`) is a command-line tool for manipulating links using a single substitution operation. It's built on:

- **Associative theory** and the Links Notation protocol
- **Markov algorithms** for pattern-matching substitutions
- **Turing-complete** operation model
- **C# implementation** of a links data store

### Key Concept: Links

A "link" in link-cli is a triple: `(id: source target)`

- **id**: Unique identifier for the link
- **source**: Source node/value
- **target**: Target node/value

Links can represent:
- Parent-child relationships in hierarchies
- Key-value pairs
- Graph structures
- Any associative relationship

## Installation

### Prerequisites

- .NET SDK 8.0+ (already installed on the system)

### Install clink

```bash
dotnet tool install --global clink
```

Verify installation:

```bash
clink --help
```

## Architecture

### Storage Model

The integration uses a hybrid approach:

1. **link-cli database** (`menu.links`): Stores relationships and hierarchical structure
2. **JSON files** (`data/menu-items/*.json`): Stores actual menu item content

### Why Hybrid?

- **Links are perfect for**: Hierarchical relationships, parent-child structures
- **JSON files are better for**: Complex objects with multiple properties
- **Together**: Efficient storage and retrieval of hierarchical menu structures

### Link Schema for Menus

```
Link: (menuItemId, parentId)

Where:
- menuItemId: Hash-based ID derived from menu item content
- parentId: ID of parent menu item (0 = root level)
```

Example:
```
(3: 100 0)    // Menu item 100 is at root level (parent = 0)
(4: 200 0)    // Menu item 200 is at root level
(5: 101 100)  // Menu item 101 is child of item 100
```

## Implementation

### File Structure

```
backend/monolith/
├── src/
│   ├── services/
│   │   └── linkdb/
│   │       ├── LinkDBService.js       # Low-level link-cli wrapper
│   │       └── MenuStorageService.js  # High-level menu storage
│   └── api/
│       └── routes/
│           ├── menuConfigLinkDB.js    # New link-cli based API routes
│           └── menuConfig.js          # Legacy JSON-based routes
└── data/
    ├── menu.links                      # Link database file
    └── menu-items/                     # Menu item JSON files
        ├── 12345678.json
        └── 87654321.json
```

### Services

#### 1. LinkDBService

Low-level service for executing link-cli commands.

**Key Methods**:
- `executeQuery(query, options)`: Execute a LiNo query
- `createLink(source, target)`: Create a new link
- `readAllLinks()`: Read all links
- `updateLink(id, newSource, newTarget)`: Update a link
- `deleteLink(id)`: Delete a link

**Example Usage**:

```javascript
import LinkDBService from './services/LinkDBService.js';

const linkDB = new LinkDBService();

// Create a link
const link = await linkDB.createLink(100, 0); // (id: 100 0)

// Read all links
const allLinks = await linkDB.readAllLinks();

// Delete a link
await linkDB.deleteLink(link.id);
```

#### 2. MenuStorageService

High-level service for menu storage with link-cli.

**Key Methods**:
- `storeMenuItem(item, parentId)`: Store a single menu item
- `storeMenuStructure(menuItems, parentId)`: Store menu hierarchy recursively
- `getMenuStructure(parentId)`: Retrieve menu hierarchy
- `getAllMenuItems()`: Get flat list of all items
- `deleteMenuItem(itemId)`: Delete item and children
- `clearAllMenus()`: Clear all menu data

**Example Usage**:

```javascript
import MenuStorageService from './services/MenuStorageService.js';

const menuStorage = new MenuStorageService();

// Store menu structure
const menu = [
  {
    label: 'Home',
    icon: 'pi pi-home',
    to: '/home'
  },
  {
    label: 'Settings',
    icon: 'pi pi-cog',
    items: [
      { label: 'Profile', to: '/settings/profile' },
      { label: 'Security', to: '/settings/security' }
    ]
  }
];

await menuStorage.storeMenuStructure(menu, 0);

// Retrieve menu
const retrievedMenu = await menuStorage.getMenuStructure(0);
```

### API Routes

#### New Link-CLI Based Routes

**Base Path**: `/api/menu/*`

##### GET /api/menu/config

Get current menu configuration from link-cli database.

**Response**:
```json
{
  "success": true,
  "response": {
    "config": "[{\"label\":\"Home\",\"icon\":\"pi pi-home\",...}]",
    "updatedAt": "2025-11-02T10:30:00.000Z",
    "source": "linkdb"
  }
}
```

##### POST /api/menu/config

Save menu configuration to link-cli database.

**Request**:
```json
{
  "config": "[{\"label\":\"Home\",\"icon\":\"pi pi-home\",...}]"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Menu configuration saved successfully to link-cli database",
  "response": {
    "updatedAt": "2025-11-02T10:30:00.000Z",
    "source": "linkdb"
  }
}
```

##### DELETE /api/menu/config

Delete all menu configuration.

##### GET /api/menu/items

Get all menu items as a flat list.

##### POST /api/menu/item

Add a single menu item.

**Request**:
```json
{
  "item": {
    "label": "New Item",
    "icon": "pi pi-star",
    "to": "/new"
  },
  "parentId": 0
}
```

##### DELETE /api/menu/item/:itemId

Delete a menu item and all its children.

##### GET /api/menu/statistics

Get storage statistics.

**Response**:
```json
{
  "success": true,
  "response": {
    "totalLinks": 15,
    "totalFiles": 15,
    "rootItems": 5,
    "source": "linkdb"
  }
}
```

#### Legacy JSON-Based Routes

**Base Path**: `/api/menu-legacy/*`

The old JSON file-based routes are still available at `/api/menu-legacy/config` for migration and compatibility.

## link-cli Query Language (LiNo)

### Basic Operations

#### Create

Replace nothing with something:

```bash
clink '() ((1 1))' --changes --after
```

Creates link: `(1: 1 1)`

#### Read

Match and return (no net change):

```bash
clink '((($i: $s $t)) (($i: $s $t)))' --after
```

Reads all links.

#### Update

Substitute one pattern for another:

```bash
clink '((1: 1 1)) ((1: 1 2))' --changes --after
```

Updates link 1 to `(1: 1 2)`.

#### Delete

Replace something with nothing:

```bash
clink '((1 2)) ()' --changes --after
```

Deletes the link.

### Pattern Matching

Variables in queries:
- `$i`: Match any value (typically used for ID)
- `$s`: Match any value (typically used for source)
- `$t`: Match any value (typically used for target)

### CLI Options

| Option | Description |
|--------|-------------|
| `--db <path>` | Database file path (default: `db.links`) |
| `--changes` / `-c` | Show applied changes |
| `--after` / `-a` | Display database state post-operation |
| `--before` / `-b` | Display pre-operation state |
| `--trace` / `-t` | Enable verbose output |

## Testing

### Test Scripts

Two test scripts are provided:

1. **Direct link-cli test**: `experiments/test-linkdb-direct.js`
   - Tests raw link-cli commands
   - Verifies create, read, update, delete operations
   - Tests hierarchical relationships

2. **Menu storage test**: `experiments/test-linkdb-menu.js`
   - Tests MenuStorageService
   - Verifies menu hierarchy storage and retrieval
   - Tests menu item CRUD operations

### Running Tests

```bash
# Direct link-cli test
cd /tmp/gh-issue-solver-1762073356311
node experiments/test-linkdb-direct.js

# Menu storage test (requires monolith dependencies)
cd backend/monolith
npm install
cd ../../
node experiments/test-linkdb-menu.js
```

### Expected Test Output

```
=== Testing Link-CLI Commands Directly ===

Test 1: Create a link (100, 0)
Result: () ((3: 100 0))

Test 2: Read all links
Result: (3: 100 0)
(4: 200 0)

✓ Tests completed
```

## Migration Guide

### From JSON File Storage to Link-CLI

The system supports both storage methods simultaneously:

1. **New installations**: Automatically use link-cli
2. **Existing installations**: Can migrate gradually

#### Migration Process

1. Export existing menu from `/api/menu-legacy/config`
2. Import to link-cli via `/api/menu/config`
3. Verify menu works correctly
4. (Optional) Delete legacy JSON file

#### Migration Script

```javascript
// Migration example
const legacyResponse = await fetch('/api/menu-legacy/config');
const legacyData = await legacyResponse.json();

if (legacyData.response.config) {
  await fetch('/api/menu/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: legacyData.response.config })
  });
}
```

## Performance Considerations

### Advantages

1. **Efficient hierarchical queries**: link-cli is optimized for associative data
2. **Fast parent-child lookups**: Direct link traversal
3. **Scalable**: Can handle large menu structures
4. **Flexible**: Easy to add new relationship types

### Trade-offs

1. **External dependency**: Requires .NET runtime and clink tool
2. **Command execution overhead**: Each operation spawns a process
3. **Hybrid storage**: Requires managing both links and JSON files

### Optimization Tips

1. **Batch operations**: Store entire menu structures at once
2. **Cache retrieved menus**: Reduce database queries
3. **Lazy load children**: Only load submenu items when needed

## Troubleshooting

### clink not found

**Error**: `clink: command not found`

**Solution**:
```bash
dotnet tool install --global clink
# Add to PATH if needed
export PATH="$PATH:$HOME/.dotnet/tools"
```

### Database file locked

**Error**: `Database file is locked`

**Solution**: Ensure only one process accesses the database at a time. Use proper locking mechanisms if needed.

### Invalid query syntax

**Error**: `Failed to parse query`

**Solution**: Check LiNo query syntax. Common issues:
- Missing parentheses
- Incorrect variable names
- Quote escaping in shell commands

### Menu structure not loading

**Issue**: Menu appears empty after storage

**Debug Steps**:
1. Check link database: `clink '((($i: $s $t)) (($i: $s $t)))' --db menu.links --after`
2. Check JSON files: `ls -la backend/monolith/data/menu-items/`
3. Check logs: Look for errors in backend logs
4. Verify item IDs match between links and files

## Future Enhancements

### Planned Features

1. **Full-text search**: Index menu items for searching
2. **Menu versioning**: Store menu history with timestamps
3. **User-specific menus**: Link menus to user IDs
4. **Permission-based filtering**: Filter menu items by user permissions
5. **Menu templates**: Store and reuse menu templates
6. **Analytics**: Track menu item usage

### Additional Use Cases

link-cli can be extended for:

- **User preferences storage**
- **Configuration management**
- **Relationship mapping** (users, roles, permissions)
- **Workflow definitions**
- **Document hierarchies**

## References

- **link-cli Repository**: https://github.com/link-foundation/link-cli
- **Links Notation**: Associative theory-based data representation
- **Issue #1800**: https://github.com/unidel2035/dronedoc2025/issues/1800
- **Backend Guidelines**: See `CLAUDE.md` for backend architecture rules

## Support

For issues or questions:

1. Check this documentation
2. Review test scripts in `experiments/`
3. Check backend logs: `backend/monolith/logs/`
4. Refer to link-cli documentation: https://github.com/link-foundation/link-cli

---

**Last Updated**: 2025-11-02
**Author**: Claude AI (Issue Solver)
**Version**: 1.0.0
