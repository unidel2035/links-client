// Example demonstrating the ILinks flat API
import ILinks from '../src/api/ilinks.js';
import path from 'path';

async function main() {
  console.log('=== ILinks Flat API Example ===\n');

  // Create ILinks instance
  const dbPath = path.join(process.cwd(), 'data', 'example-ilinks.links');
  const links = new ILinks(dbPath);

  // Get constants
  const constants = links.getConstants();
  console.log('Constants:', { Continue: constants.Continue, Break: constants.Break, Any: constants.Any });

  // Create some links
  console.log('\n--- Creating Links ---');
  const link1Id = await links.create([1, 2]);
  console.log(`Created link (1 -> 2) with ID: ${link1Id}`);

  const link2Id = await links.create([3, 4]);
  console.log(`Created link (3 -> 4) with ID: ${link2Id}`);

  const link3Id = await links.create([1, 5]);
  console.log(`Created link (1 -> 5) with ID: ${link3Id}`);

  // Count links
  console.log('\n--- Counting Links ---');
  const totalCount = await links.count();
  console.log(`Total links in database: ${totalCount}`);

  const countWithSource1 = await links.count([1, constants.Any]);
  console.log(`Links with source=1: ${countWithSource1}`);

  // Iterate through links
  console.log('\n--- Iterating Through Links ---');
  let iterationCount = 0;
  await links.each(null, (link) => {
    console.log(`Link ${link.id}: ${link.source} -> ${link.target}`);
    iterationCount++;
    if (iterationCount >= 3) {
      return constants.Break; // Stop after 3 links
    }
    return constants.Continue;
  });

  // Update a link
  console.log('\n--- Updating Link ---');
  console.log(`Updating link ${link1Id} to (10 -> 20)`);
  await links.update([link1Id, constants.Any, constants.Any], [10, 20], (change) => {
    console.log('Before:', change.before);
    console.log('After:', change.after);
  });

  // Read updated link
  const updatedLinks = [];
  await links.each([link1Id, constants.Any, constants.Any], (link) => {
    updatedLinks.push(link);
    return constants.Continue;
  });
  console.log('Updated link:', updatedLinks[0]);

  // Delete a link
  console.log('\n--- Deleting Link ---');
  console.log(`Deleting link ${link2Id}`);
  await links.delete([link2Id, constants.Any, constants.Any], (change) => {
    console.log('Deleted:', change.before);
  });

  // Count after deletion
  const finalCount = await links.count();
  console.log(`\nFinal link count: ${finalCount}`);

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
