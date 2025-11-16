# Authentication Data Storage with Links Theory (link-cli)

## Overview

This document describes the implementation of authentication data storage (users, tokens, passwords) using [link-cli](https://github.com/link-foundation/link-cli) and Links Theory (associative link-based data representation).

**Issue**: #2178 - Создай базу данных на теории связей для хранения пользователей, токенов, паролей
**Implementation Date**: 2025-11-06
**Technology**: link-cli (clink) v2.2.2 - Associative link-based data storage
**Based on**: Links Notation protocol and Links Theory

## What is Links Theory?

Links Theory is a mathematical framework for representing data as associative relationships (links). Each link is a triple:

```
(id: source target)
```

Where:
- **id**: Unique identifier for the link
- **source**: Source node/value
- **target**: Target node/value

Links can represent:
- Entity types (e.g., "this is a User")
- Relationships (e.g., "this Token belongs to this User")
- Hierarchies (e.g., "this is a child of that")

## Architecture

### Storage Model

The authentication data storage uses a **hybrid approach**:

1. **link-cli database** (`menu.links`): Stores relationships and entity types as links
2. **JSON files** (`data/auth-data/`): Stores actual data content

### Why Hybrid?

- **Links are perfect for**: Entity types, relationships, associations
- **JSON files are better for**: Complex objects with multiple properties
- **Together**: Efficient storage and retrieval with flexible querying

### Link Schemas

#### 1. Users

**Link Schema**:
```
(linkId: userId USER_TYPE_ID)
```

Where:
- `userId`: Numeric hash of user ID string
- `USER_TYPE_ID = 2000`: Constant identifying user entities

**IMPORTANT**: Link notation uses SPACES, not commas. The correct format is `(id: source target)` without commas.

**File Storage**:
```
data/auth-data/users/{userId}.json
```

**File Content**:
```json
{
  "userId": "user_abc123def456",
  "username": "alice",
  "email": "alice@example.com",
  "profile": {
    "firstName": "Alice",
    "lastName": "Smith",
    "role": "admin",
    "department": "Engineering"
  },
  "createdAt": "2025-11-06T10:30:00.000Z",
  "updatedAt": "2025-11-06T15:45:00.000Z"
}
```

#### 2. Tokens

**Link Schema**:
```
(linkId: tokenId userId)
```

Where:
- `tokenId`: Numeric hash of token ID string
- `userId`: Numeric hash of the user who owns this token

**Note**: No commas between source and target.

**File Storage**:
```
data/auth-data/tokens/{tokenId}.json
```

**File Content**:
```json
{
  "tokenId": "token_xyz789abc123",
  "userId": "user_abc123def456",
  "apiKey": "sk_live_abc123def456...",
  "permissions": ["read", "write", "admin"],
  "expiresAt": "2025-12-06T10:30:00.000Z",
  "description": "Admin API token",
  "createdAt": "2025-11-06T10:30:00.000Z"
}
```

#### 3. Passwords

**Link Schema**:
```
(linkId: passwordId userId)
```

Where:
- `passwordId`: Numeric hash of password ID string
- `userId`: Numeric hash of the user who owns this password

**Note**: No commas between source and target.

**File Storage**:
```
data/auth-data/passwords/{passwordId}.json
```

**File Content**:
```json
{
  "passwordId": "pwd_def456ghi789",
  "userId": "user_abc123def456",
  "hash": "a1b2c3d4e5f6...",
  "salt": "f6e5d4c3b2a1...",
  "algorithm": "pbkdf2-sha512",
  "iterations": 100000,
  "createdAt": "2025-11-06T10:30:00.000Z"
}
```

## Implementation

### File Structure

```
backend/monolith/
├── src/
│   ├── services/
│   │   └── linkdb/
│   │       ├── LinkDBService.js           # Low-level link-cli wrapper
│   │       ├── MenuStorageService.js      # Menu storage (existing)
│   │       ├── AuthStorageService.js      # Authentication storage (NEW)
│   │       └── __tests__/
│   │           └── AuthStorageService.spec.js # Unit tests
│   └── api/
│       └── routes/
│           └── authDataLinkDB.js          # API routes for auth data
└── data/
    ├── menu.links                          # Link database (shared)
    └── auth-data/                          # Auth data files
        ├── users/
        │   ├── user_abc123.json
        │   └── user_def456.json
        ├── tokens/
        │   ├── token_xyz789.json
        │   └── token_abc123.json
        └── passwords/
            ├── pwd_def456.json
            └── pwd_ghi789.json
```

### Services

#### AuthStorageService

High-level service for authentication data storage using link-cli.

**Key Methods**:

**User Operations**:
- `createUser(userData)`: Create a new user
- `getUser(userId)`: Get user by ID
- `getAllUsers()`: Get all users
- `updateUser(userId, updates)`: Update user data
- `deleteUser(userId)`: Delete user and all associated data
- `findUserByUsername(username)`: Find user by username
- `findUserByEmail(email)`: Find user by email

**Password Operations**:
- `setPassword(userId, passwordData)`: Set/update password for user
- `getUserPassword(userId)`: Get user's password data
- `deletePassword(passwordId)`: Delete a password

**Token Operations**:
- `createToken(userId, tokenData)`: Create token for user
- `getToken(tokenId)`: Get token by ID
- `getUserTokens(userId)`: Get all tokens for user
- `deleteToken(tokenId)`: Delete a token
- `findTokenByApiKey(apiKey)`: Find token by API key

**Utilities**:
- `getStatistics()`: Get storage statistics
- `clearAllAuthData()`: Clear all data (dangerous!)

**Example Usage**:

```javascript
import AuthStorageService from './services/AuthStorageService.js';

const authStorage = new AuthStorageService();

// Create a user
const user = await authStorage.createUser({
  username: 'alice',
  email: 'alice@example.com',
  profile: {
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'admin'
  }
});

// Set password for user
await authStorage.setPassword(user.userId, {
  hash: 'hashed_password_here',
  salt: 'random_salt_here',
  algorithm: 'pbkdf2-sha512',
  iterations: 100000
});

// Create API token for user
const token = await authStorage.createToken(user.userId, {
  apiKey: 'sk_live_abc123...',
  permissions: ['read', 'write'],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  description: 'Admin API token'
});

// Find user by username
const foundUser = await authStorage.findUserByUsername('alice');

// Verify token
const verifiedToken = await authStorage.findTokenByApiKey('sk_live_abc123...');

// Delete user (cascade deletes tokens and passwords)
await authStorage.deleteUser(user.userId);
```

### API Routes

**Base Path**: `/api/auth-data`

#### User Routes

##### POST /api/auth-data/users
Create a new user

**Request**:
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secure_password_123",
  "profile": {
    "firstName": "Alice",
    "lastName": "Smith"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "userId": "user_abc123def456",
    "username": "alice",
    "email": "alice@example.com",
    "createdAt": "2025-11-06T10:30:00.000Z"
  }
}
```

##### GET /api/auth-data/users
Get all users

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "userId": "user_abc123",
      "username": "alice",
      "email": "alice@example.com",
      "profile": { ... },
      "createdAt": "2025-11-06T10:30:00.000Z"
    }
  ]
}
```

##### GET /api/auth-data/users/:userId
Get user by ID

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user_abc123",
    "username": "alice",
    "email": "alice@example.com",
    "profile": { ... }
  }
}
```

##### PUT /api/auth-data/users/:userId
Update user

**Request**:
```json
{
  "email": "newemail@example.com",
  "profile": {
    "department": "Engineering"
  }
}
```

##### DELETE /api/auth-data/users/:userId
Delete user (cascade deletes tokens and passwords)

#### Token Routes

##### POST /api/auth-data/users/:userId/tokens
Create token for user

**Request**:
```json
{
  "permissions": ["read", "write"],
  "expiresAt": "2025-12-06T10:30:00.000Z",
  "description": "API access token"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Token created successfully",
  "data": {
    "tokenId": "token_xyz789",
    "apiKey": "sk_live_abc123...",
    "permissions": ["read", "write"],
    "expiresAt": "2025-12-06T10:30:00.000Z",
    "createdAt": "2025-11-06T10:30:00.000Z"
  }
}
```

##### GET /api/auth-data/users/:userId/tokens
Get all tokens for user

##### DELETE /api/auth-data/tokens/:tokenId
Delete a token

##### POST /api/auth-data/tokens/verify
Verify token by API key

**Request**:
```json
{
  "apiKey": "sk_live_abc123..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tokenId": "token_xyz789",
    "userId": "user_abc123",
    "permissions": ["read", "write"],
    "expiresAt": "2025-12-06T10:30:00.000Z"
  }
}
```

#### Password Routes

##### POST /api/auth-data/users/:userId/password
Set/update password for user

**Request**:
```json
{
  "password": "new_secure_password_456"
}
```

##### POST /api/auth-data/users/:userId/password/verify
Verify password

**Request**:
```json
{
  "password": "user_entered_password"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

#### Authentication Routes

##### POST /api/auth-data/login
Login with username/email and password

**Request**:
```json
{
  "username": "alice",
  "password": "secure_password_123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "user_abc123",
    "username": "alice",
    "email": "alice@example.com",
    "sessionToken": "sk_session_xyz789...",
    "expiresAt": "2025-11-07T10:30:00.000Z"
  }
}
```

#### Statistics Routes

##### GET /api/auth-data/statistics
Get statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "totalLinks": 15,
    "users": {
      "links": 5,
      "files": 5
    },
    "tokens": {
      "links": 8,
      "files": 8
    },
    "passwords": {
      "files": 5
    }
  }
}
```

## Testing

### Test Scripts

#### 1. Integration Test: `experiments/test-auth-linkdb.js`

Tests the AuthStorageService directly with comprehensive scenarios.

**Run**:
```bash
cd /tmp/gh-issue-solver-1762438481744
node experiments/test-auth-linkdb.js
```

**Tests**:
- User creation, retrieval, update, deletion
- Password setting, retrieval, updating
- Token creation, retrieval, deletion
- Cascade deletion (user → tokens, passwords)
- Statistics and search operations

#### 2. Unit Tests: `backend/monolith/src/services/linkdb/__tests__/AuthStorageService.spec.js`

Comprehensive unit tests using Vitest.

**Run**:
```bash
cd backend/monolith
npm test -- AuthStorageService.spec.js
```

**Test Coverage**:
- User operations (CRUD, search)
- Password operations (set, get, update)
- Token operations (create, retrieve, verify, delete)
- Statistics
- ID generation and conversion
- Error handling

### Expected Test Output

```
=== Testing AuthStorageService with Link-CLI ===

--- USER OPERATIONS ---

Test 1: Create users
✓ User 1 created: { userId: 'user_abc123', username: 'alice', email: 'alice@example.com' }
✓ User 2 created: { userId: 'user_def456', username: 'bob', email: 'bob@example.com' }

Test 2: Get user by ID
✓ Retrieved user: { userId: 'user_abc123', username: 'alice', email: 'alice@example.com' }

--- PASSWORD OPERATIONS ---

Test 7: Set password for user
✓ Password set for user: alice

Test 8: Get user password
✓ Retrieved password data: { algorithm: 'pbkdf2-sha512', iterations: 100000, hasHash: true, hasSalt: true }

--- TOKEN OPERATIONS ---

Test 10: Create token for user
✓ Token created: { tokenId: 'token_xyz789', apiKey: 'api_key_alice_12345', permissions: ['read', 'write', 'admin'] }

=== All Tests Completed Successfully ===
```

## Security Considerations

### Password Hashing

The API routes use **PBKDF2-SHA512** for password hashing:

```javascript
import crypto from 'crypto';

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }

  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  return { hash, salt, algorithm: 'pbkdf2-sha512', iterations: 100000 };
}
```

**Parameters**:
- Algorithm: PBKDF2 with SHA-512
- Iterations: 100,000
- Salt: 16 random bytes (hex encoded)
- Output: 64-byte hash (hex encoded)

### Token Generation

API keys use **32 random bytes** (hex encoded):

```javascript
const apiKey = crypto.randomBytes(32).toString('hex');
// Example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6..."
```

### Best Practices

1. **Never expose passwords**: Store only hashes and salts
2. **Rotate tokens regularly**: Set expiration dates
3. **Use HTTPS**: Always use encrypted connections
4. **Rate limiting**: Implement on authentication endpoints
5. **Audit logging**: Log authentication events
6. **Token permissions**: Use granular permissions

## Performance Considerations

### Advantages

1. **Efficient relationships**: link-cli excels at associative queries
2. **Fast lookups**: Direct link traversal for relationships
3. **Scalable**: Can handle large numbers of users/tokens
4. **Flexible schema**: Easy to add new entity types

### Trade-offs

1. **External dependency**: Requires .NET runtime and clink tool
2. **Command execution overhead**: Each link operation spawns a process
3. **Hybrid storage**: Requires managing both links and JSON files

### Optimization Tips

1. **Batch operations**: Create multiple entities in transactions (if supported)
2. **Cache frequently accessed data**: Users, permissions
3. **Index searches**: Build search indices for username/email lookups
4. **Connection pooling**: Reuse link-cli connections if possible

## Migration Guide

### From Traditional Database

If you have existing user data in PostgreSQL/MySQL:

1. Export users, tokens, passwords to JSON
2. For each user:
   ```javascript
   const user = await authStorage.createUser(userData);
   await authStorage.setPassword(user.userId, passwordData);
   for (const token of userTokens) {
     await authStorage.createToken(user.userId, token);
   }
   ```

### Example Migration Script

```javascript
import AuthStorageService from './services/AuthStorageService.js';
import oldDatabase from './old-db-connection.js';

const authStorage = new AuthStorageService();

// Migrate users
const users = await oldDatabase.query('SELECT * FROM users');

for (const oldUser of users) {
  const newUser = await authStorage.createUser({
    username: oldUser.username,
    email: oldUser.email,
    profile: JSON.parse(oldUser.profile || '{}')
  });

  // Migrate password
  await authStorage.setPassword(newUser.userId, {
    hash: oldUser.password_hash,
    salt: oldUser.password_salt,
    algorithm: 'pbkdf2-sha512',
    iterations: 100000
  });

  // Migrate tokens
  const tokens = await oldDatabase.query('SELECT * FROM tokens WHERE user_id = ?', [oldUser.id]);
  for (const token of tokens) {
    await authStorage.createToken(newUser.userId, {
      apiKey: token.api_key,
      permissions: JSON.parse(token.permissions || '[]'),
      expiresAt: token.expires_at,
      description: token.description
    });
  }

  console.log(`Migrated user: ${oldUser.username}`);
}
```

## Troubleshooting

### clink not found

**Error**: `clink: command not found`

**Solution**:
```bash
dotnet tool install --global clink
export PATH="$PATH:$HOME/.dotnet/tools"
```

### Database file locked

**Error**: `Database file is locked`

**Solution**: Ensure only one process accesses the database at a time. Use proper locking mechanisms.

### Invalid link query

**Error**: `Failed to parse query`

**Solution**: Check LiNo query syntax in LinkDBService.js. Common issues:
- Missing parentheses
- Incorrect variable names
- Quote escaping

### User not found after creation

**Issue**: Created user but cannot retrieve it

**Debug Steps**:
1. Check link database: `clink '((($i: $s $t)) (($i: $s $t)))' --db menu.links --after`
2. Check user files: `ls -la backend/monolith/data/auth-data/users/`
3. Check logs: Look for errors in backend logs
4. Verify user ID matches between link and file

## Future Enhancements

### Planned Features

1. **User roles and permissions**: Role-based access control
2. **OAuth integration**: External identity providers
3. **Multi-factor authentication**: TOTP, SMS, email codes
4. **Session management**: Active sessions tracking
5. **Audit logging**: Comprehensive authentication logs
6. **Password reset**: Secure password recovery
7. **Email verification**: Email confirmation workflow
8. **Account locking**: Brute-force protection

### Additional Use Cases

Links Theory can be extended for:

- **Role hierarchies**: Admin → Manager → User
- **Permission groups**: Group permissions together
- **Organization structures**: Multi-tenant support
- **API key scopes**: Fine-grained permissions
- **Token families**: Refresh tokens, access tokens

## References

- **link-cli Repository**: https://github.com/link-foundation/link-cli
- **Links Notation**: https://github.com/link-foundation/links-notation
- **Issue #2178**: https://github.com/unidel2035/dronedoc2025/issues/2178
- **Issue #1800**: Menu storage with LinkDB (reference implementation)
- **Backend Guidelines**: See `CLAUDE.md` for backend architecture rules

## Support

For issues or questions:

1. Check this documentation
2. Review test scripts in `experiments/`
3. Check backend logs: `backend/monolith/logs/`
4. Refer to link-cli documentation: https://github.com/link-foundation/link-cli
5. Open issue: https://github.com/unidel2035/dronedoc2025/issues

---

**Last Updated**: 2025-11-06
**Author**: Claude AI (Issue Solver)
**Version**: 1.0.0
