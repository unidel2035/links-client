// Example demonstrating the RecursiveLinks API
import RecursiveLinks from '../src/api/recursive-links.js';
import path from 'path';

async function main() {
  console.log('=== RecursiveLinks API Example ===\n');

  // Create RecursiveLinks instance
  const dbPath = path.join(process.cwd(), 'data', 'example-recursive.links');
  const recursiveLinks = new RecursiveLinks(dbPath);

  // Example 1: Create from nested array [[1, 2], [3, 4]]
  console.log('--- Example 1: Nested Array ---');
  const nestedArray = [[1, 2], [3, 4]];
  console.log('Creating from nested array:', JSON.stringify(nestedArray));

  const linkIds = await recursiveLinks.createFromNestedArray(nestedArray);
  console.log('Created link IDs:', linkIds);

  const notation1 = recursiveLinks.toLinksNotation(nestedArray);
  console.log('Links notation:', notation1);
  console.log('Expected: ((1 2) (3 4))');

  // Example 2: Create from nested object with references
  console.log('\n--- Example 2: Nested Object with References ---');
  const nestedObject = {
    "1": [1, { "2": [5, 6] }, 3, 4]
  };
  console.log('Creating from nested object:', JSON.stringify(nestedObject));

  const refMap = await recursiveLinks.createFromNestedObject(nestedObject);
  console.log('Created reference map:', refMap);

  const notation2 = recursiveLinks.toLinksNotationWithRefs(nestedObject);
  console.log('Links notation with refs:', notation2);
  console.log('Expected: (1: 1 (2: 5 6) 3 4)');

  // Example 3: Parse Links notation
  console.log('\n--- Example 3: Parse Links Notation ---');
  const linksNotation = '((1 2) (3 4))';
  console.log('Parsing notation:', linksNotation);

  const parsed = recursiveLinks.parseLinksNotation(linksNotation);
  console.log('Parsed result:', JSON.stringify(parsed));

  // Example 4: Round-trip conversion
  console.log('\n--- Example 4: Round-trip Conversion ---');
  const original = [[7, 8], [9, 10]];
  console.log('Original array:', JSON.stringify(original));

  const toNotation = recursiveLinks.toLinksNotation(original);
  console.log('To notation:', toNotation);

  const backToArray = recursiveLinks.parseLinksNotation(toNotation);
  console.log('Back to array:', JSON.stringify(backToArray));
  console.log('Match:', JSON.stringify(original) === JSON.stringify(backToArray));

  // Example 5: Read stored links as nested array
  console.log('\n--- Example 5: Read as Nested Array ---');
  const storedLinks = await recursiveLinks.readAsNestedArray();
  console.log('All stored links as nested array:');
  console.log(JSON.stringify(storedLinks.slice(0, 5), null, 2)); // Show first 5

  // Example 6: Access underlying ILinks
  console.log('\n--- Example 6: Using Underlying ILinks ---');
  const ilinks = recursiveLinks.getLinks();
  const count = await ilinks.count();
  console.log(`Total links in database (via ILinks): ${count}`);

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
