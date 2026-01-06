import { extractBlocks } from "./blockExtractor.ts";

const testMarkdown = `
# Test Heading
This is a raw paragraph.

| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |

- List item 1
- List item 2

<div>
  Nested content in a div.
  <p>Wrapped paragraph.</p>
</div>

Ending text node.
`;

const blocks = extractBlocks(testMarkdown);
console.log("Extracted blocks:");
console.log(JSON.stringify(blocks, null, 2));

const ids = blocks.map(b => b.id);
const uniqueIds = new Set(ids);

if (ids.length !== uniqueIds.size) {
    console.error("ERROR: Duplicate IDs found!", ids);
} else {
    console.log("SUCCESS: All IDs are unique.");
}

const paragraphWithRawText = blocks.find(b => b.text === "Ending text node.");
if (paragraphWithRawText) {
    console.log("SUCCESS: Captured trailing text node.");
} else {
    console.error("ERROR: Failed to capture trailing text node.");
}

const tableBlock = blocks.find(b => b.type === "table");
if (tableBlock) {
    console.log("SUCCESS: Captured table block.");
} else {
    console.error("ERROR: Failed to capture table block.");
}
