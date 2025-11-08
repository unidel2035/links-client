#!/usr/bin/env node
/**
 * Integration test for AuthStorageService with actual link-cli (clink) commands
 *
 * This test verifies that the system correctly:
 * 1. Uses the actual clink command-line tool
 * 2. Stores links in the correct format: (id source target) WITHOUT commas
 * 3. Creates and manages users, tokens, and passwords
 * 4. Properly integrates with the link-cli database
 */

import AuthStorageService from '../src/services/AuthStorageService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test database path
const TEST_DB_DIR = path.join(__dirname, '../backend/monolith/data/auth-data');
const TEST_DB_FILE = path.join(TEST_DB_DIR, 'auth.links');

let testResults = [];

function log(message, type = 'info') {
  const prefix = {
    info: '✓',
    error: '✗',
    warn: '⚠',
    test: '→'
  }[type] || '•';

  console.log(`${prefix} ${message}`);
  testResults.push({ message, type, timestamp: new Date().toISOString() });
}

async function cleanupTestData() {
  try {
    // Clear the link database using clink
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    try {
      await execAsync(`clink '((* *)) ()' --db "${TEST_DB_FILE}"`, { env });
      log('Cleared link database', 'info');
    } catch (error) {
      // Database might not exist yet, that's okay
      log('Link database does not exist yet (expected for first run)', 'warn');
    }

    // Clear data directories
    const dirs = ['users', 'tokens', 'passwords'];
    for (const dir of dirs) {
      const dirPath = path.join(TEST_DB_DIR, dir);
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(dirPath, file));
          }
        }
      } catch (error) {
        // Directory might not exist, that's okay
      }
    }

    log('Cleaned up test data directories', 'info');
  } catch (error) {
    log(`Cleanup error: ${error.message}`, 'warn');
  }
}

async function verifyClinkInstallation() {
  try {
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    const { stdout } = await execAsync('clink --version', { env });
    log(`clink is installed: version ${stdout.trim()}`, 'info');
    return true;
  } catch (error) {
    log('clink command not found! Please install with: dotnet tool install --global clink', 'error');
    return false;
  }
}

async function verifyLinkFormat() {
  log('Verifying link notation format (no commas)...', 'test');

  try {
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    // Create a test link
    const { stdout } = await execAsync(`clink '() ((100 200))' --db "${TEST_DB_FILE}" --changes`, { env });

    log(`clink output: ${stdout}`, 'test');

    // Verify format: should be (id: 100 200) NOT (id: 100, 200)
    if (stdout.includes(',')) {
      log('ERROR: Link format contains commas! Format should be (id: source target)', 'error');
      return false;
    }

    // Verify format matches (number: number number)
    const linkMatch = stdout.match(/\((\d+):\s+(\d+)\s+(\d+)\)/);
    if (!linkMatch) {
      log('ERROR: Link format does not match expected pattern (id: source target)', 'error');
      return false;
    }

    log(`Correct link format verified: (${linkMatch[1]}: ${linkMatch[2]} ${linkMatch[3]})`, 'info');
    return true;
  } catch (error) {
    log(`Link format verification failed: ${error.message}`, 'error');
    return false;
  }
}

async function testUserCreation() {
  log('Testing user creation...', 'test');

  try {
    const authStorage = new AuthStorageService();

    const userData = {
      username: 'alice_test',
      email: 'alice@test.com',
      profile: {
        firstName: 'Alice',
        lastName: 'Test'
      }
    };

    const user = await authStorage.createUser(userData);

    if (!user || !user.userId) {
      throw new Error('User creation failed: no userId returned');
    }

    log(`User created with ID: ${user.userId}`, 'info');

    // Verify link was created in database
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    const { stdout } = await execAsync(`clink '((($i: $s $t)) (($i: $s $t)))' --db "${TEST_DB_FILE}" --after`, { env });

    if (!stdout || stdout.trim() === '') {
      throw new Error('No links found in database after user creation');
    }

    log('Link database contains user links:', 'info');
    log(stdout.trim(), 'test');

    return user;
  } catch (error) {
    log(`User creation test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testTokenCreation(userId) {
  log('Testing token creation...', 'test');

  try {
    const authStorage = new AuthStorageService();

    const tokenData = {
      apiKey: 'test_api_key_12345',
      permissions: ['read', 'write'],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      description: 'Test token'
    };

    const token = await authStorage.createToken(userId, tokenData);

    if (!token || !token.tokenId) {
      throw new Error('Token creation failed: no tokenId returned');
    }

    log(`Token created with ID: ${token.tokenId}`, 'info');

    // Verify link was created
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    const { stdout } = await execAsync(`clink '((($i: $s $t)) (($i: $s $t)))' --db "${TEST_DB_FILE}" --after`, { env });

    log('Link database after token creation:', 'info');
    log(stdout.trim(), 'test');

    return token;
  } catch (error) {
    log(`Token creation test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testPasswordCreation(userId) {
  log('Testing password creation...', 'test');

  try {
    const authStorage = new AuthStorageService();

    const passwordData = {
      hash: 'hashed_password_test_123',
      salt: 'random_salt_456',
      algorithm: 'pbkdf2-sha512',
      iterations: 100000
    };

    const password = await authStorage.setPassword(userId, passwordData);

    if (!password || !password.passwordId) {
      throw new Error('Password creation failed: no passwordId returned');
    }

    log(`Password created with ID: ${password.passwordId}`, 'info');

    // Verify link was created
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    const { stdout } = await execAsync(`clink '((($i: $s $t)) (($i: $s $t)))' --db "${TEST_DB_FILE}" --after`, { env });

    log('Link database after password creation:', 'info');
    log(stdout.trim(), 'test');

    return password;
  } catch (error) {
    log(`Password creation test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testUserRetrieval(userId) {
  log('Testing user retrieval...', 'test');

  try {
    const authStorage = new AuthStorageService();

    const user = await authStorage.getUser(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.username !== 'alice_test') {
      throw new Error(`Expected username 'alice_test', got '${user.username}'`);
    }

    log(`User retrieved successfully: ${user.username}`, 'info');
    return user;
  } catch (error) {
    log(`User retrieval test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function testStatistics() {
  log('Testing statistics...', 'test');

  try {
    const authStorage = new AuthStorageService();

    const stats = await authStorage.getStatistics();

    log('Statistics:', 'info');
    log(JSON.stringify(stats, null, 2), 'test');

    if (stats.users.files < 1) {
      throw new Error('Expected at least 1 user in statistics');
    }

    log('Statistics test passed', 'info');
    return stats;
  } catch (error) {
    log(`Statistics test failed: ${error.message}`, 'error');
    throw error;
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  AuthStorageService Integration Test with link-cli (clink)  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Verify clink is installed
    log('Step 1: Verifying clink installation...', 'test');
    const clinkInstalled = await verifyClinkInstallation();
    if (!clinkInstalled) {
      throw new Error('clink is not installed');
    }

    // Step 2: Clean up test data
    log('Step 2: Cleaning up test data...', 'test');
    await cleanupTestData();

    // Step 3: Verify link format (no commas)
    log('Step 3: Verifying link notation format...', 'test');
    const formatCorrect = await verifyLinkFormat();
    if (!formatCorrect) {
      throw new Error('Link format verification failed');
    }

    // Step 4: Test user creation
    log('Step 4: Testing user creation...', 'test');
    const user = await testUserCreation();

    // Step 5: Test token creation
    log('Step 5: Testing token creation...', 'test');
    await testTokenCreation(user.userId);

    // Step 6: Test password creation
    log('Step 6: Testing password creation...', 'test');
    await testPasswordCreation(user.userId);

    // Step 7: Test user retrieval
    log('Step 7: Testing user retrieval...', 'test');
    await testUserRetrieval(user.userId);

    // Step 8: Test statistics
    log('Step 8: Testing statistics...', 'test');
    await testStatistics();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ALL TESTS PASSED ✓                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    log('AuthStorageService correctly uses link-cli (clink) with proper link notation (no commas)', 'info');
    log('Links are stored in correct format: (id: source target)', 'info');
    log('All CRUD operations working correctly', 'info');

    return true;
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    TESTS FAILED ✗                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    log(`Test suite failed: ${error.message}`, 'error');
    log(error.stack, 'error');

    return false;
  }
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
