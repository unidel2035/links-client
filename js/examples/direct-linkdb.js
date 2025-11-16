// test-linkdb-direct.js - Direct test of link-cli commands
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const DB_PATH = '/tmp/gh-issue-solver-1762073356311/backend/monolith/data/menu.links';

async function executeQuery(query, options = {}) {
  const { before = false, changes = false, after = false } = options;
  const flags = [];
  if (before) flags.push('--before');
  if (changes) flags.push('--changes');
  if (after) flags.push('--after');

  const command = `clink '${query}' --db "${DB_PATH}" ${flags.join(' ')}`;
  console.log(`Executing: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.warn('STDERR:', stderr);
    }
    return stdout.trim();
  } catch (error) {
    throw new Error(`Query failed: ${error.message}`);
  }
}

async function testLinkDB() {
  console.log('=== Testing Link-CLI Commands Directly ===\n');

  try {
    // Test 1: Create a link
    console.log('Test 1: Create a link (100, 0) - menu item with parent 0 (root)');
    const result1 = await executeQuery('() ((100 0))', { changes: true, after: true });
    console.log('Result:', result1);
    console.log();

    // Test 2: Create another link
    console.log('Test 2: Create another link (200, 0) - another root menu item');
    const result2 = await executeQuery('() ((200 0))', { changes: true, after: true });
    console.log('Result:', result2);
    console.log();

    // Test 3: Create a child item
    console.log('Test 3: Create a child item (101, 100) - child of first menu item');
    const result3 = await executeQuery('() ((101 100))', { changes: true, after: true });
    console.log('Result:', result3);
    console.log();

    // Test 4: Read all links
    console.log('Test 4: Read all links');
    const result4 = await executeQuery('((($i: $s $t)) (($i: $s $t)))', { after: true });
    console.log('Result:', result4);
    console.log();

    // Test 5: Read links with parent 0 (root items)
    console.log('Test 5: Read links with parent 0 (root items)');
    const result5 = await executeQuery('((($i: $s 0)) (($i: $s 0)))', { after: true });
    console.log('Result:', result5);
    console.log();

    // Test 6: Read links with parent 100 (children of first item)
    console.log('Test 6: Read links with parent 100 (children of first menu item)');
    const result6 = await executeQuery('((($i: $s 100)) (($i: $s 100)))', { after: true });
    console.log('Result:', result6);
    console.log();

    // Test 7: Update a link
    console.log('Test 7: Update link 1 to (100, 999)');
    const result7 = await executeQuery('(((1: 100 0)) ((1: 100 999)))', { changes: true, after: true });
    console.log('Result:', result7);
    console.log();

    // Test 8: Delete a link
    console.log('Test 8: Delete link 3');
    const result8 = await executeQuery('(((3: $s $t)) ())', { changes: true, after: true });
    console.log('Result:', result8);
    console.log();

    // Test 9: Final state
    console.log('Test 9: Read all remaining links');
    const result9 = await executeQuery('((($i: $s $t)) (($i: $s $t)))', { after: true });
    console.log('Result:', result9);
    console.log();

    console.log('=== All tests completed successfully! ===');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLinkDB().then(() => {
  console.log('\n✓ Tests completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
