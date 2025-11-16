# Universal Recursive API Documentation

This document describes the universal recursive API implemented in the Links Client library, compatible with the [Platform.Data ILinks interface](https://github.com/linksplatform/Data/blob/main/csharp/Platform.Data/ILinks.cs).

## Overview

The Links Client now provides two complementary APIs for working with Links databases:

1. **ILinks (Flat API)** - Universal flat Turing complete API for Links
2. **RecursiveLinks (Recursive API)** - Recursive wrapper supporting nested structures

These APIs are available in both JavaScript and Python implementations.

## ILinks - Flat API

The ILinks interface provides a flat API that works with a single link at a time. It is compatible with the C# ILinks interface from Platform.Data.

### Core Methods

#### `count(restriction = null)`

Returns the number of links matching the restriction.

**Parameters:**
- `restriction` (Array|null): Filter array `[id]`, `[source, target]`, or `[id, source, target]`. Use `0` for "any" value.

**Returns:** Number of matching links

**Example:**
```javascript
// JavaScript
const totalCount = await links.count(); // All links
const countWithSource = await links.count([5, 0]); // Links with source=5
```

```python
# Python
total_count = links.count()  # All links
count_with_source = links.count([5, 0])  # Links with source=5
```

#### `each(restriction = null, handler = null)`

Iterates through links matching restriction, calling handler for each.

**Parameters:**
- `restriction` (Array|null): Filter array
- `handler` (Function|null): Callback `function(link)` that returns `Continue` or `Break`

**Returns:** `Continue` if completed, `Break` if interrupted

**Example:**
```javascript
// JavaScript
await links.each(null, (link) => {
  console.log(`Link ${link.id}: ${link.source} -> ${link.target}`);
  return links.constants.Continue;
});
```

```python
# Python
def handler(link):
    print(f"Link {link['id']}: {link['source']} -> {link['target']}")
    return LinkConstants.CONTINUE

links.each(None, handler)
```

#### `create(substitution, handler = null)`

Creates a new link.

**Parameters:**
- `substitution` (Array): `[source, target]` or `[id, source, target]`
- `handler` (Function|null): Callback for change notifications

**Returns:** Created link ID

**Example:**
```javascript
// JavaScript
const linkId = await links.create([1, 2]);
```

```python
# Python
link_id = links.create([1, 2])
```

#### `update(restriction, substitution, handler = null)`

Updates existing links matching restriction.

**Parameters:**
- `restriction` (Array): Filter to select links to update
- `substitution` (Array): New values `[source, target]`
- `handler` (Function|null): Callback for change notifications

**Returns:** Updated link ID

**Example:**
```javascript
// JavaScript
await links.update([linkId, 0, 0], [10, 20]);
```

```python
# Python
links.update([link_id, 0, 0], [10, 20])
```

#### `delete(restriction, handler = null)`

Deletes links matching restriction.

**Parameters:**
- `restriction` (Array): Filter to select links to delete
- `handler` (Function|null): Callback for change notifications

**Returns:** Deleted link ID

**Example:**
```javascript
// JavaScript
await links.delete([linkId, 0, 0]);
```

```python
# Python
links.delete([link_id, 0, 0])
```

## RecursiveLinks - Recursive API

The RecursiveLinks API provides a higher-level interface for working with nested structures, converting between JavaScript/Python data structures and Links notation.

### Notation Conversions

#### Nested Arrays ↔ Links Notation

JavaScript/Python nested arrays are converted to Links notation:

```javascript
// JavaScript
[[1, 2], [3, 4]]  ↔  "((1 2) (3 4))"
```

```python
# Python
[[1, 2], [3, 4]]  ↔  "((1 2) (3 4))"
```

#### Nested Objects/Dicts with References ↔ Links Notation

Objects/dictionaries with named references are converted to Links notation with labels:

```javascript
// JavaScript
{ "1": [1, { "2": [5, 6] }, 3, 4] }  ↔  "(1: 1 (2: 5 6) 3 4)"
```

```python
# Python
{ "1": [1, { "2": [5, 6] }, 3, 4] }  ↔  "(1: 1 (2: 5 6) 3 4)"
```

### Core Methods

#### `createFromNestedArray(nestedArray)` / `createFromNestedList(nestedList)`

Creates links from nested array/list structure.

**Example:**
```javascript
// JavaScript
const linkIds = await recursiveLinks.createFromNestedArray([[1, 2], [3, 4]]);
```

```python
# Python
link_ids = recursive_links.create_from_nested_list([[1, 2], [3, 4]])
```

#### `createFromNestedObject(nestedObject)` / `createFromNestedDict(nestedDict)`

Creates links from nested object/dict with references.

**Example:**
```javascript
// JavaScript
const refMap = await recursiveLinks.createFromNestedObject({
  "1": [1, { "2": [5, 6] }, 3, 4]
});
```

```python
# Python
ref_map = recursive_links.create_from_nested_dict({
  "1": [1, { "2": [5, 6] }, 3, 4]
})
```

#### `readAsNestedArray(restriction)` / `readAsNestedList(restriction)`

Reads links and converts to nested array/list structure.

**Example:**
```javascript
// JavaScript
const nestedArray = await recursiveLinks.readAsNestedArray();
```

```python
# Python
nested_list = recursive_links.read_as_nested_list()
```

#### `toLinksNotation(nestedArray)`

Converts nested array/list to Links notation string.

**Example:**
```javascript
// JavaScript
const notation = recursiveLinks.toLinksNotation([[1, 2], [3, 4]]);
// Returns: "((1 2) (3 4))"
```

```python
# Python
notation = recursive_links.to_links_notation([[1, 2], [3, 4]])
# Returns: "((1 2) (3 4))"
```

#### `toLinksNotationWithRefs(nestedObject)` / `toLinksNotationWithRefs(nestedDict)`

Converts nested object/dict with references to Links notation string.

**Example:**
```javascript
// JavaScript
const notation = recursiveLinks.toLinksNotationWithRefs({
  "1": [1, { "2": [5, 6] }, 3, 4]
});
// Returns: "(1: 1 (2: 5 6) 3 4)"
```

```python
# Python
notation = recursive_links.to_links_notation_with_refs({
  "1": [1, { "2": [5, 6] }, 3, 4]
})
# Returns: "(1: 1 (2: 5 6) 3 4)"
```

#### `parseLinksNotation(notation)`

Parses Links notation string to nested array/list.

**Example:**
```javascript
// JavaScript
const parsed = recursiveLinks.parseLinksNotation("((1 2) (3 4))");
// Returns: [[1, 2], [3, 4]]
```

```python
# Python
parsed = recursive_links.parse_links_notation("((1 2) (3 4))")
# Returns: [[1, 2], [3, 4]]
```

## Usage Examples

### JavaScript

```javascript
import { ILinks, RecursiveLinks } from '@unidel2035/links-client';

// Using flat ILinks API
const links = new ILinks('./data/my.links');
const linkId = await links.create([1, 2]);
const count = await links.count();

// Using recursive API
const recursiveLinks = new RecursiveLinks('./data/my.links');
const linkIds = await recursiveLinks.createFromNestedArray([[1, 2], [3, 4]]);
const notation = recursiveLinks.toLinksNotation([[1, 2], [3, 4]]);
```

### Python

```python
from links_client import ILinks, RecursiveLinks

# Using flat ILinks API
links = ILinks("./data/my.links")
link_id = links.create([1, 2])
count = links.count()

# Using recursive API
recursive_links = RecursiveLinks("./data/my.links")
link_ids = recursive_links.create_from_nested_list([[1, 2], [3, 4]])
notation = recursive_links.to_links_notation([[1, 2], [3, 4]])
```

## Integration

Both APIs work with the same underlying database, so you can use them interchangeably:

```javascript
// JavaScript
const recursiveLinks = new RecursiveLinks('./data/my.links');
await recursiveLinks.createFromNestedArray([[1, 2]]);

// Access underlying ILinks
const ilinks = recursiveLinks.getLinks();
const count = await ilinks.count(); // Will include the links created above
```

```python
# Python
recursive_links = RecursiveLinks("./data/my.links")
recursive_links.create_from_nested_list([[1, 2]])

# Access underlying ILinks
ilinks = recursive_links.get_links()
count = ilinks.count()  # Will include the links created above
```

## Testing

Run tests for the new APIs:

```bash
# JavaScript
cd js
npm test

# Python
cd python
python -m unittest discover tests
```

## Examples

See the `examples` directory for complete working examples:

- `js/examples/ilinks-api-example.js` - ILinks flat API example
- `js/examples/recursive-links-example.js` - RecursiveLinks API example
- `python/examples/ilinks_api_example.py` - ILinks flat API example
- `python/examples/recursive_links_example.py` - RecursiveLinks API example

## Compatibility

This implementation is designed to be fully compatible with:
- [Platform.Data ILinks interface](https://github.com/linksplatform/Data/blob/main/csharp/Platform.Data/ILinks.cs)
- Links Notation format used across the Links Platform ecosystem
- Associative projects in the Links Foundation

## References

- [Platform.Data ILinks.cs](https://github.com/linksplatform/Data/blob/main/csharp/Platform.Data/ILinks.cs) - C# reference implementation
- [Links Notation](https://github.com/linksplatform) - Links Platform project documentation
