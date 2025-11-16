// test-auth-linkdb.js - Test AuthStorageService with link-cli database
import AuthStorageService from '../src/services/AuthStorageService.js';
import logger from '../src/utils/logger.js';

// Configure logger to show info level
logger.level = 'info';

const authStorage = new AuthStorageService();

/**
 * Test suite for AuthStorageService
 */
async function runTests() {
  console.log('=== Testing AuthStorageService with Link-CLI ===\n');

  let testUser1, testUser2, testToken1, testToken2;

  try {
    // ==================== USER TESTS ====================
    console.log('--- USER OPERATIONS ---');

    // Test 1: Create users
    console.log('\nTest 1: Create users');
    testUser1 = await authStorage.createUser({
      username: 'alice',
      email: 'alice@example.com',
      profile: {
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'admin'
      }
    });
    console.log('✓ User 1 created:', {
      userId: testUser1.userId,
      username: testUser1.username,
      email: testUser1.email
    });

    testUser2 = await authStorage.createUser({
      username: 'bob',
      email: 'bob@example.com',
      profile: {
        firstName: 'Bob',
        lastName: 'Johnson',
        role: 'user'
      }
    });
    console.log('✓ User 2 created:', {
      userId: testUser2.userId,
      username: testUser2.username,
      email: testUser2.email
    });

    // Test 2: Get user by ID
    console.log('\nTest 2: Get user by ID');
    const retrievedUser = await authStorage.getUser(testUser1.userId);
    console.log('✓ Retrieved user:', {
      userId: retrievedUser.userId,
      username: retrievedUser.username,
      email: retrievedUser.email
    });

    // Test 3: Get all users
    console.log('\nTest 3: Get all users');
    const allUsers = await authStorage.getAllUsers();
    console.log('✓ Total users:', allUsers.length);
    allUsers.forEach(user => {
      console.log('  -', user.username, '(' + user.email + ')');
    });

    // Test 4: Update user
    console.log('\nTest 4: Update user');
    const updatedUser = await authStorage.updateUser(testUser1.userId, {
      profile: {
        ...testUser1.profile,
        department: 'Engineering'
      }
    });
    console.log('✓ User updated with department:', updatedUser.profile.department);

    // Test 5: Find user by username
    console.log('\nTest 5: Find user by username');
    const foundUser = await authStorage.findUserByUsername('alice');
    console.log('✓ Found user by username:', foundUser ? foundUser.username : 'Not found');

    // Test 6: Find user by email
    console.log('\nTest 6: Find user by email');
    const foundUserByEmail = await authStorage.findUserByEmail('bob@example.com');
    console.log('✓ Found user by email:', foundUserByEmail ? foundUserByEmail.username : 'Not found');

    // ==================== PASSWORD TESTS ====================
    console.log('\n--- PASSWORD OPERATIONS ---');

    // Test 7: Set password for user
    console.log('\nTest 7: Set password for user');
    const password1 = await authStorage.setPassword(testUser1.userId, {
      hash: 'dummy_hash_12345',
      salt: 'dummy_salt_67890',
      algorithm: 'pbkdf2-sha512',
      iterations: 100000
    });
    console.log('✓ Password set for user:', testUser1.username);

    // Test 8: Get user password
    console.log('\nTest 8: Get user password');
    const retrievedPassword = await authStorage.getUserPassword(testUser1.userId);
    console.log('✓ Retrieved password data:', {
      algorithm: retrievedPassword.algorithm,
      iterations: retrievedPassword.iterations,
      hasHash: !!retrievedPassword.hash,
      hasSalt: !!retrievedPassword.salt
    });

    // Test 9: Update password (set new password)
    console.log('\nTest 9: Update password');
    await authStorage.setPassword(testUser1.userId, {
      hash: 'new_hash_54321',
      salt: 'new_salt_09876',
      algorithm: 'pbkdf2-sha512',
      iterations: 100000
    });
    const newPassword = await authStorage.getUserPassword(testUser1.userId);
    console.log('✓ Password updated, new hash:', newPassword.hash.substring(0, 20) + '...');

    // ==================== TOKEN TESTS ====================
    console.log('\n--- TOKEN OPERATIONS ---');

    // Test 10: Create token for user
    console.log('\nTest 10: Create token for user');
    testToken1 = await authStorage.createToken(testUser1.userId, {
      apiKey: 'api_key_alice_12345',
      permissions: ['read', 'write', 'admin'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      description: 'Alice admin token'
    });
    console.log('✓ Token created:', {
      tokenId: testToken1.tokenId,
      apiKey: testToken1.apiKey,
      permissions: testToken1.permissions
    });

    // Test 11: Create another token for same user
    console.log('\nTest 11: Create another token for same user');
    testToken2 = await authStorage.createToken(testUser1.userId, {
      apiKey: 'api_key_alice_67890',
      permissions: ['read'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      description: 'Alice read-only token'
    });
    console.log('✓ Second token created:', {
      tokenId: testToken2.tokenId,
      permissions: testToken2.permissions
    });

    // Test 12: Get all tokens for user
    console.log('\nTest 12: Get all tokens for user');
    const userTokens = await authStorage.getUserTokens(testUser1.userId);
    console.log('✓ User has', userTokens.length, 'tokens');
    userTokens.forEach(token => {
      console.log('  -', token.description, '(expires:', token.expiresAt ? token.expiresAt.substring(0, 10) : 'never' + ')');
    });

    // Test 13: Find token by API key
    console.log('\nTest 13: Find token by API key');
    const foundToken = await authStorage.findTokenByApiKey('api_key_alice_12345');
    console.log('✓ Found token by API key:', foundToken ? foundToken.description : 'Not found');

    // Test 14: Get token by ID
    console.log('\nTest 14: Get token by ID');
    const retrievedToken = await authStorage.getToken(testToken1.tokenId);
    console.log('✓ Retrieved token:', retrievedToken.description);

    // ==================== STATISTICS TESTS ====================
    console.log('\n--- STATISTICS ---');

    // Test 15: Get statistics
    console.log('\nTest 15: Get statistics');
    const stats = await authStorage.getStatistics();
    console.log('✓ Statistics:', JSON.stringify(stats, null, 2));

    // ==================== DELETION TESTS ====================
    console.log('\n--- DELETION OPERATIONS ---');

    // Test 16: Delete a token
    console.log('\nTest 16: Delete a token');
    await authStorage.deleteToken(testToken2.tokenId);
    const remainingTokens = await authStorage.getUserTokens(testUser1.userId);
    console.log('✓ Token deleted, remaining tokens:', remainingTokens.length);

    // Test 17: Delete a user (cascade delete tokens and passwords)
    console.log('\nTest 17: Delete a user (cascade delete)');
    await authStorage.deleteUser(testUser1.userId);
    const deletedUser = await authStorage.getUser(testUser1.userId);
    console.log('✓ User deleted:', deletedUser === null ? 'Success' : 'Failed');

    const deletedUserTokens = await authStorage.getUserTokens(testUser1.userId);
    console.log('✓ User tokens deleted:', deletedUserTokens.length === 0 ? 'Success' : 'Failed');

    const deletedUserPassword = await authStorage.getUserPassword(testUser1.userId);
    console.log('✓ User password deleted:', deletedUserPassword === null ? 'Success' : 'Failed');

    // ==================== FINAL STATISTICS ====================
    console.log('\n--- FINAL STATISTICS ---');
    const finalStats = await authStorage.getStatistics();
    console.log('Final statistics:', JSON.stringify(finalStats, null, 2));

    console.log('\n=== All Tests Completed Successfully ===');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  console.log('\n✓ Test suite finished');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
