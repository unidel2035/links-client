# LinkDB Services

Services for integrating link-cli (clink) database with the DronDoc backend.

## Overview

This directory contains services for using [link-cli](https://github.com/link-foundation/link-cli) as a database backend for storing:
- Hierarchical data structures (menu configurations)
- Authentication data (users, tokens, passwords)

## Services

### LinkDBService.js

Low-level wrapper for link-cli command execution.

**Note**: This service is shared by both MenuStorageService and AuthStorageService.

**Purpose**: Execute link-cli queries and manage basic link operations.

**Usage**:

```javascript
import LinkDBService from './LinkDBService.js';

const db = new LinkDBService('/path/to/database.links');

// Create a link
const link = await db.createLink(100, 200);
console.log(link); // { id: 1, source: 100, target: 200 }

// Read all links
const links = await db.readAllLinks();

// Read specific link
const link = await db.readLink(1);

// Update link
await db.updateLink(1, 150, 250);

// Delete link
await db.deleteLink(1);
```

### MenuStorageService.js

High-level service for storing menu configurations using link-cli.

**Purpose**: Store and retrieve hierarchical menu structures with link-cli database.

**Architecture**:
- Links store parent-child relationships: `(menuItemId, parentId)`
- JSON files store actual menu item data
- Parent ID of 0 means root-level menu item

**Usage**:

```javascript
import MenuStorageService from './MenuStorageService.js';

const menuStorage = new MenuStorageService();

// Store a menu structure
const menu = [
  {
    label: 'Dashboard',
    icon: 'pi pi-home',
    to: '/dashboard',
    items: [
      { label: 'Analytics', to: '/dashboard/analytics' },
      { label: 'Reports', to: '/dashboard/reports' }
    ]
  }
];

await menuStorage.storeMenuStructure(menu, 0);

// Retrieve menu structure
const retrievedMenu = await menuStorage.getMenuStructure(0);

// Get all items (flat list)
const allItems = await menuStorage.getAllMenuItems();

// Delete a menu item and its children
await menuStorage.deleteMenuItem(itemId);

// Clear all menus
await menuStorage.clearAllMenus();

// Get statistics
const stats = await menuStorage.getStatistics();
// { totalLinks: 10, totalFiles: 10, rootItems: 3 }
```

## Data Model

### Link Structure

Each link represents a menu item relationship:

```
(id: menuItemId, parentId)
```

Example:
```
(1: 123456, 0)      # Menu item 123456 at root level
(2: 789012, 123456) # Menu item 789012 is child of 123456
```

### File Structure

Menu item data is stored in JSON files:

```
backend/monolith/data/menu-items/
├── 123456.json
├── 789012.json
└── ...
```

Each file contains:

```json
{
  "label": "Dashboard",
  "icon": "pi pi-home",
  "to": "/dashboard"
}
```

### Item ID Generation

Item IDs are generated from content hash:

```javascript
const itemId = generateItemId(menuItem);
// SHA-256 hash of JSON string, first 8 chars, converted to number
```

This ensures:
- **Deterministic**: Same content → same ID
- **Collision-resistant**: Different content → different IDs
- **Portable**: IDs don't depend on insertion order

## link-cli Queries

### Basic Queries

**Create a link**:
```javascript
await db.executeQuery('() ((100 0))', { changes: true });
// Creates link: (1: 100 0)
```

**Read all links**:
```javascript
await db.executeQuery('((($i: $s $t)) (($i: $s $t)))', { after: true });
// Returns all links
```

**Read links by parent**:
```javascript
await db.executeQuery('((($i: $s 0)) (($i: $s 0)))', { after: true });
// Returns all root-level items (parent = 0)
```

**Update a link**:
```javascript
await db.executeQuery('(((1: 100 0)) ((1: 150 0)))', { changes: true });
// Updates link 1
```

**Delete a link**:
```javascript
await db.executeQuery('(((1: $s $t)) ())', { changes: true });
// Deletes link 1
```

## Error Handling

Both services throw errors on failure:

```javascript
try {
  await menuStorage.storeMenuItem(item, parentId);
} catch (error) {
  console.error('Failed to store menu item:', error.message);
  // Handle error
}
```

Common errors:
- `LinkDB query failed`: link-cli command execution failed
- `Failed to parse created link`: Unexpected output format
- `Failed to save menu configuration`: File system error

## Performance

### Optimization Tips

1. **Batch operations**: Use `storeMenuStructure()` instead of multiple `storeMenuItem()` calls
2. **Cache results**: Cache retrieved menu structures to reduce queries
3. **Lazy loading**: Load submenu items on demand
4. **Async operations**: All methods are async, use `Promise.all()` for parallel operations

### Benchmarks

Approximate performance (on typical system):

- Create single link: ~50ms
- Read all links: ~30ms
- Store menu structure (10 items): ~500ms
- Retrieve menu structure (10 items): ~300ms

## Testing

Test scripts are available in `experiments/`:

```bash
# Test LinkDBService directly
node experiments/test-linkdb-direct.js

# Test MenuStorageService
node experiments/test-linkdb-menu.js
```

## Dependencies

- **link-cli (clink)**: Must be installed globally
- **Node.js**: ES modules support
- **File system**: For JSON storage

## Installation

1. Install link-cli:
   ```bash
   dotnet tool install --global clink
   ```

2. Verify installation:
   ```bash
   clink --version
   ```

3. Services are ready to use!

### AuthStorageService.js

High-level service for storing authentication data using link-cli.

**Purpose**: Store and retrieve users, tokens, and passwords with link-cli database.

**Architecture**:
- Links store entity types and relationships
- JSON files store actual authentication data
- Supports cascade deletion (user → tokens, passwords)

**Usage**:

```javascript
import AuthStorageService from './AuthStorageService.js';

const authStorage = new AuthStorageService();

// Create a user
const user = await authStorage.createUser({
  username: 'alice',
  email: 'alice@example.com',
  profile: { firstName: 'Alice', lastName: 'Smith' }
});

// Set password
await authStorage.setPassword(user.userId, {
  hash: 'hashed_password',
  salt: 'random_salt',
  algorithm: 'pbkdf2-sha512',
  iterations: 100000
});

// Create API token
const token = await authStorage.createToken(user.userId, {
  apiKey: 'sk_live_abc123...',
  permissions: ['read', 'write'],
  expiresAt: '2025-12-06T10:30:00.000Z',
  description: 'Admin token'
});

// Find user
const foundUser = await authStorage.findUserByUsername('alice');

// Delete user (cascade deletes tokens and passwords)
await authStorage.deleteUser(user.userId);
```

## Integration

These services are used by:

- `api/routes/menuConfigLinkDB.js`: API routes for menu configuration
- `api/routes/authDataLinkDB.js`: API routes for authentication data (Issue #2178)
- Frontend menu components: Via API calls
- Authentication system: Via API calls

## Future Enhancements

- [ ] Transaction support for atomic operations
- [ ] Connection pooling for better performance
- [ ] Query caching layer
- [ ] Migration tools from JSON to link-cli
- [ ] Backup and restore utilities
- [ ] Performance monitoring and metrics

## References

- link-cli repository: https://github.com/link-foundation/link-cli
- Issue #1800: Menu database integration
- Issue #2178: Authentication data storage with Links Theory
- Menu storage documentation: `/docs/LINKDB_INTEGRATION.md`
- Authentication storage documentation: `/docs/AUTH_LINKDB_INTEGRATION.md`

---

**Last Updated**: 2025-11-02
