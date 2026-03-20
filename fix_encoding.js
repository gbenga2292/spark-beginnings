const fs = require('fs');
const path = require('path');

// These are the correct characters that got corrupted.
// The files contain proper UTF-8, but some chars were double-encoded or the
// source editor saved Windows-1252 bytes into a UTF-8 file.
// 
// Pattern: When UTF-8 bytes for a special char (e.g. em-dash U+2014 = 0xE2 0x80 0x94)
// were interpreted as Latin-1/Windows-1252 and then re-encoded as UTF-8, you get garbage.
//
// The garbled sequences as they appear in the source:
const REPLACEMENTS = [
  // em dash — (U+2014): shows as â€" 
  ['\u00e2\u0080\u0094', '\u2014'],  // â€" → —
  // bullet • (U+2022): shows as â€¢
  ['\u00e2\u0080\u00a2', '\u2022'],  // â€¢ → •
  // ellipsis … (U+2026): shows as â€¦
  ['\u00e2\u0080\u00a6', '\u2026'],  // â€¦ → …
  // en dash – (U+2013): shows as â€"
  ['\u00e2\u0080\u0093', '\u2013'],  // â€" → –
  // left double quote " (U+201C): shows as â€œ
  ['\u00e2\u0080\u009c', '\u201c'],  // â€œ → "
  // right double quote " (U+201D): shows as â€
  ['\u00e2\u0080\u009d', '\u201d'],  // â€ → "
  // left single quote ' (U+2018): shows as â€˜
  ['\u00e2\u0080\u0098', '\u2018'],  // â€˜ → '
  // right single quote ' (U+2019): shows as â€™
  ['\u00e2\u0080\u0099', '\u2019'],  // â€™ → '
  // right arrow → (U+2192): shows as â†'
  ['\u00e2\u0086\u0092', '\u2192'],  // â†' → →
  // checkmark ✓ (U+2713): shows as âœ"
  ['\u00e2\u009c\u0093', '\u2713'],  // âœ" → ✓
  // box drawing chars
  ['\u00e2\u0094\u0080', '\u2500'],  // â"€ → ─
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  let changed = false;

  for (const [from, to] of REPLACEMENTS) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      count += walkDir(full);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.css'))) {
      if (fixFile(full)) count++;
    }
  }
  return count;
}

const srcDir = path.join(__dirname, 'src');
const total = walkDir(srcDir);
console.log(`\nDone! Fixed ${total} file(s).`);
