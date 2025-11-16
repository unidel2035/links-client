# LinkDB Implementation Notes

## Issue #2178 - Database based on Links Theory

This implementation provides a database for storing users, tokens, and passwords using Links Theory via the [link-cli](https://github.com/link-foundation/link-cli) library.

## Key Points

### 1. Actual link-cli Integration

This implementation uses the **actual clink command-line tool**, not a mock or demo implementation:

- **Tool**: `clink` (installed via `dotnet tool install --global clink`)
- **Version**: 2.2.2+
- **Execution**: Via Node.js `child_process.exec()` in LinkDBService
- **Database Files**: `.links` files storing the actual link database

### 2. Correct Link Notation

**CRITICAL**: Link notation uses **SPACES**, not commas!

✅ **Correct**:
```
(id: source target)
```

❌ **Incorrect**:
```
(id: source, target)  // NO COMMAS!
```

### Examples:

**User link** (represents a user entity):
```
(123: 456789 2000)
```
- `123`: link ID (auto-assigned by clink)
- `456789`: numeric hash of user ID string
- `2000`: USER_TYPE_ID constant

**Token link** (token belongs to user):
```
(124: 111222 456789)
```
- `124`: link ID
- `111222`: numeric hash of token ID string
- `456789`: numeric hash of user ID string (target)

**Password link** (password belongs to user):
```
(125: 333444 456789)
```
- `125`: link ID
- `333444`: numeric hash of password ID string
- `456789`: numeric hash of user ID string (target)

### 3. Architecture

**Two-Layer Storage**:

1. **Link Database** (`auth.links`):
   - Stores relationships between entities
   - Entity types (user, token, password)
   - Ownership relationships (token→user, password→user)
   - Efficient for queries and relationships

2. **JSON Files** (`data/auth-data/{type}/{id}.json`):
   - Stores actual data content
   - User profiles (username, email, profile data)
   - Token details (apiKey, permissions, expiration)
   - Password hashes (hash, salt, algorithm, iterations)

**Why This Approach?**

- Links excel at relationships and associations
- JSON files are better for complex object data
- Together: Best of both worlds

### 4. Implementation Files

**Core Services**:
- `LinkDBService.js` - Wrapper for clink command execution
- `AuthStorageService.js` - High-level auth data management
- `MenuStorageService.js` - Menu storage using same pattern

**API Routes**:
- `backend/monolith/src/api/routes/authDataLinkDB.js` - REST API endpoints

**Tests**:
- `experiments/test-clink-basic.js` - Basic clink CRUD operations
- `experiments/test-auth-linkdb-integration.js` - Full auth storage tests
- `backend/monolith/src/services/linkdb/__tests__/AuthStorageService.spec.js` - Unit tests

**Documentation**:
- `docs/AUTH_LINKDB_INTEGRATION.md` - Full integration guide
- `backend/monolith/src/services/linkdb/README.md` - Service documentation

### 5. How LinkDBService Works

```javascript
import LinkDBService from './LinkDBService.js';

const linkDB = new LinkDBService('/path/to/database.links');

// Create a link: (source target)
const link = await linkDB.createLink(100, 200);
// Returns: { id: 1, source: 100, target: 200 }

// Read all links
const allLinks = await linkDB.readAllLinks();
// Returns: [{ id: 1, source: 100, target: 200 }, ...]

// Update a link
await linkDB.updateLink(1, 300, 400);
// Link 1 now: (1: 300 400)

// Delete a link
await linkDB.deleteLink(1);
```

**Behind the scenes**, each method executes actual clink commands:

- `createLink()` → `clink '() ((100 200))' --db "database.links" --changes`
- `readAllLinks()` → `clink '((($i: $s $t)) (($i: $s $t)))' --db "database.links" --after`
- `updateLink()` → `clink '(((1: $s $t)) ((1: 300 400)))' --db "database.links" --changes`
- `deleteLink()` → `clink '(((1: $s $t)) ())' --db "database.links" --changes`

### 6. PATH Configuration

**Important**: The `clink` command is installed in `~/.dotnet/tools/`, which may not be in the default PATH.

LinkDBService automatically adds this to PATH when executing commands:

```javascript
const env = {
  ...process.env,
  PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
};

const { stdout } = await execAsync(command, { env });
```

### 7. API Endpoints

Base path: `/api/auth-data`

**Users**:
- `POST /users` - Create user
- `GET /users` - List all users
- `GET /users/:userId` - Get user by ID
- `PUT /users/:userId` - Update user
- `DELETE /users/:userId` - Delete user (cascades to tokens & passwords)

**Tokens**:
- `POST /users/:userId/tokens` - Create token for user
- `GET /users/:userId/tokens` - List user's tokens
- `DELETE /tokens/:tokenId` - Delete token
- `POST /tokens/verify` - Verify token by API key

**Passwords**:
- `POST /users/:userId/password` - Set/update password
- `POST /users/:userId/password/verify` - Verify password

**Authentication**:
- `POST /login` - Login with username/password (returns session token)

**Statistics**:
- `GET /statistics` - Get database statistics

### 8. Security Features

**Password Hashing**:
- Algorithm: PBKDF2-SHA512
- Iterations: 100,000
- Salt: 16 random bytes (hex)

**Token Generation**:
- API keys: 32 random bytes (hex)
- Expiration: Configurable per token
- Permissions: Array of permission strings

**Cascade Deletion**:
- Deleting a user automatically deletes:
  - All user's tokens
  - All user's passwords
  - User link from database
  - User data file

### 9. Testing

**Run basic clink test**:
```bash
node experiments/test-clink-basic.js
```

**Run auth integration test** (requires backend dependencies):
```bash
cd backend/monolith
npm install
cd ../..
node experiments/test-auth-linkdb-integration.js
```

### 10. Verification

To verify the implementation uses actual clink:

1. Check the database file exists:
   ```bash
   ls -la backend/monolith/data/auth-data/auth.links
   ```

2. Read the database directly with clink:
   ```bash
   export PATH="$HOME/.dotnet/tools:$PATH"
   clink '((($i: $s $t)) (($i: $s $t)))' --db "backend/monolith/data/auth-data/auth.links" --after
   ```

3. Verify link format (NO COMMAS):
   - Correct: `(1: 456789 2000)`
   - Incorrect: `(1: 456789, 2000)`

## Common Issues

### "clink command not found"

**Solution**: Install clink globally:
```bash
dotnet tool install --global clink
export PATH="$HOME/.dotnet/tools:$PATH"
```

### "Link format has commas"

**Not possible with this implementation**. The clink tool outputs links without commas by design. If you see commas, it's in documentation or display code, not in the actual link database.

### "Database is empty after operations"

**Check**:
1. Is clink installed? `clink --version`
2. Is PATH set correctly? `which clink`
3. Are there errors in logs? Check logger output

## Future Enhancements

Potential improvements (not yet implemented):

1. **PQ-Programs**: Query language for complex link queries
2. **Prisms**: Multiple perspectives on same data
3. **Witnesses**: Proof-based validation for links
4. **Direct link manipulation**: Work with links as first-class entities
5. **Migration tools**: Import from SQL databases

## References

- **link-cli GitHub**: https://github.com/link-foundation/link-cli
- **Links Notation**: Space-separated link format
- **Issue #2178**: Original requirement
- **Pull Request #2268**: Implementation PR
