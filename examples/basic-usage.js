#!/usr/bin/env node
/**
 * Basic test for clink (link-cli) to verify:
 * 1. clink is installed and accessible
 * 2. Links are created in correct format: (id: source target) WITHOUT commas
 * 3. CRUD operations work correctly
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DB = path.join(__dirname, 'test.links');

function log(message, type = 'info') {
  const prefix = {
    info: '✓',
    error: '✗',
    warn: '⚠',
    test: '→'
  }[type] || '•';

  console.log(`${prefix} ${message}`);
}

async function runClink(query, flags = ['--changes']) {
  const env = {
    ...process.env,
    PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
  };

  const command = `clink '${query}' --db "${TEST_DB}" ${flags.join(' ')}`;
  log(`Running: ${command}`, 'test');

  try {
    const { stdout, stderr } = await execAsync(command, { env });

    if (stderr) {
      log(`stderr: ${stderr}`, 'warn');
    }

    return stdout.trim();
  } catch (error) {
    throw new Error(`clink command failed: ${error.message}`);
  }
}

async function testClinkInstallation() {
  log('Test 1: Verifying clink installation...', 'test');

  try {
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.dotnet/tools:${process.env.PATH}`
    };

    const { stdout } = await execAsync('clink --version', { env });
    log(`clink version: ${stdout.trim()}`, 'info');
    return true;
  } catch (error) {
    log('clink is not installed!', 'error');
    log('Install with: dotnet tool install --global clink', 'info');
    return false;
  }
}

async function testLinkCreation() {
  log('Test 2: Creating a link...', 'test');

  try {
    // Create a link: (100 200)
    const output = await runClink('() ((100 200))');

    log(`Output: ${output}`, 'test');

    // Verify format: should be (id: 100 200) NOT (id: 100, 200)
    if (output.includes(',')) {
      log('ERROR: Output contains commas! Format should be (id: source target)', 'error');
      return false;
    }

    const linkMatch = output.match(/\((\d+):\s+(\d+)\s+(\d+)\)/);
    if (!linkMatch) {
      log('ERROR: Output does not match expected format (id: source target)', 'error');
      return false;
    }

    log(`Created link: (${linkMatch[1]}: ${linkMatch[2]} ${linkMatch[3]})`, 'info');
    log('Format is CORRECT (no commas)', 'info');
    return true;
  } catch (error) {
    log(`Link creation failed: ${error.message}`, 'error');
    return false;
  }
}

async function testLinkRead() {
  log('Test 3: Reading all links...', 'test');

  try {
    // Read all links
    const output = await runClink('((($i: $s $t)) (($i: $s $t)))', ['--after']);

    log(`Output: ${output}`, 'test');

    if (!output || output.trim() === '') {
      log('No links found in database', 'warn');
      return false;
    }

    // Count links
    const links = output.split('\n').filter(line => line.match(/\(\d+:\s+\d+\s+\d+\)/));
    log(`Found ${links.length} link(s)`, 'info');

    return true;
  } catch (error) {
    log(`Link read failed: ${error.message}`, 'error');
    return false;
  }
}

async function testLinkUpdate() {
  log('Test 4: Updating a link...', 'test');

  try {
    // First, get the first link ID
    const readOutput = await runClink('((($i: $s $t)) (($i: $s $t)))', ['--after']);
    const linkMatch = readOutput.match(/\((\d+):\s+\d+\s+\d+\)/);

    if (!linkMatch) {
      log('No links to update', 'warn');
      return false;
    }

    const linkId = linkMatch[1];
    log(`Updating link ${linkId}...`, 'test');

    // Update: (linkId: 100 200) -> (linkId: 300 400)
    const output = await runClink(`(((${linkId}: $s $t)) ((${linkId}: 300 400)))`);

    log(`Output: ${output}`, 'test');

    if (output.includes('300') && output.includes('400')) {
      log('Link updated successfully', 'info');
      return true;
    } else {
      log('Link update result unclear', 'warn');
      return false;
    }
  } catch (error) {
    log(`Link update failed: ${error.message}`, 'error');
    return false;
  }
}

async function testLinkDelete() {
  log('Test 5: Deleting all links...', 'test');

  try {
    // Delete all links: replace (any any) with nothing
    const output = await runClink('((* *)) ()');

    log(`Output: ${output}`, 'test');
    log('All links deleted', 'info');

    // Verify deletion
    const readOutput = await runClink('((($i: $s $t)) (($i: $s $t)))', ['--after']);

    if (readOutput && readOutput.trim() !== '') {
      log('WARNING: Links still exist after deletion', 'warn');
      log(`Output: ${readOutput}`, 'test');
      return false;
    }

    log('Deletion confirmed: database is empty', 'info');
    return true;
  } catch (error) {
    log(`Link deletion failed: ${error.message}`, 'error');
    return false;
  }
}

async function cleanup() {
  try {
    await fs.unlink(TEST_DB);
    log('Test database cleaned up', 'info');
  } catch (error) {
    // Database might not exist, that's okay
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     Basic clink (link-cli) Integration Test         ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // Cleanup before tests
    await cleanup();

    // Test 1: Installation
    const installed = await testClinkInstallation();
    if (!installed) {
      throw new Error('clink is not installed');
    }

    // Test 2: Create
    const created = await testLinkCreation();
    if (!created) {
      throw new Error('Link creation failed');
    }

    // Test 3: Read
    const read = await testLinkRead();
    if (!read) {
      throw new Error('Link read failed');
    }

    // Test 4: Update
    const updated = await testLinkUpdate();
    if (!updated) {
      throw new Error('Link update failed');
    }

    // Test 5: Delete
    const deleted = await testLinkDelete();
    if (!deleted) {
      throw new Error('Link deletion failed');
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║              ALL TESTS PASSED ✓                      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    log('clink is working correctly', 'info');
    log('Links are created in correct format: (id: source target)', 'info');
    log('NO COMMAS in link notation ✓', 'info');

    // Cleanup after tests
    await cleanup();

    return true;
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║              TESTS FAILED ✗                          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    log(`Test suite failed: ${error.message}`, 'error');

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
