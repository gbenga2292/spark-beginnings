const fs = require('fs');
const path = require('path');

// The corruption is double-UTF8 encoding (UTF8 bytes interpreted as Windows-1252 then re-encoded as UTF8).
// We identify the corrupted byte sequences and their correct replacements.

// To build the garbled byte sequences, we encode each Windows-1252 char as its UTF-8 representation:
//   — (U+2014): UTF-8 = E2 80 94. Read as Win-1252: E2=â(U+00E2), 80=€(U+20AC), 94="(U+201D)
//     Re-encoded UTF-8: C3A2 + E282AC + E2809D = [0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9D]
//   – (U+2013): UTF-8 = E2 80 93. Read as Win-1252: E2=â, 80=€, 93="(U+201C)
//     Re-encoded: C3A2 + E282AC + E2809C = [0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9C]
//   • (U+2022): UTF-8 = E2 80 A2. Read as Win-1252: E2=â, 80=€, A2=¢(U+00A2)
//     Re-encoded: C3A2 + E282AC + C2A2 = [0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA2]
//   … (U+2026): UTF-8 = E2 80 A6. Read as Win-1252: E2=â, 80=€, A6=¦(U+00A6)
//     Re-encoded: C3A2 + E282AC + C2A6 = [0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA6]
//   ' (U+2019): UTF-8 = E2 80 99. Read as Win-1252: E2=â, 80=€, 99=™(U+2122)
//     Re-encoded: C3A2 + E282AC + E284A2 = [0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x84,0xA2]
//   ' (U+2018): UTF-8 = E2 80 98. Read as Win-1252: E2=â, 80=€, 98=˜(U+02DC)
//     Re-encoded: C3A2 + E282AC + CB9C = [0xC3,0xA2,0xE2,0x82,0xAC,0xCB,0x9C]
//   " (U+201C): UTF-8 = E2 80 9C. Read as Win-1252: E2=â, 80=€, 9C=œ(U+0153)
//     Re-encoded: C3A2 + E282AC + C593 = [0xC3,0xA2,0xE2,0x82,0xAC,0xC5,0x93]
//   " (U+201D): // already decoded above as part of em-dash, standalone:
//     E2 80 9D -> â + € + " -> C3A2 + E282AC + E2809D
//   → (U+2192): UTF-8 = E2 86 92. Read as Win-1252: E2=â, 86=†(U+2020), 92=\x92='(U+2019 approx)
//     Re-encoded: C3A2 + E280 A0 + CB9C = need to recalc
//   ✓ (U+2713): UTF-8 = E2 9C 93. Read as Win-1252: E2=â, 9C=œ, 93="
//     Re-encoded: C3A2 + C593 + E2809C
//   ─ (U+2500): UTF-8 = E2 94 80. Read as Win-1252: E2=â, 94=", 80=€
//     Re-encoded: C3A2 + E2809D + E282AC

const REPLACEMENTS = [
  // em dash —
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9D]), to: '—' },
  // en dash –
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9C]), to: '–' },
  // bullet •
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA2]), to: '•' },
  // ellipsis …
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA6]), to: '…' },
  // right single quote '
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x84,0xA2]), to: '\u2019' },
  // left single quote '
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xCB,0x9C]), to: '\u2018' },
  // left double quote "
  { from: Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xC5,0x93]), to: '\u201C' },
  // right arrow →
  { from: Buffer.from([0xC3,0xA2,0xE2,0x86,0x92]), to: '\u2192' },
  // checkmark ✓
  { from: Buffer.from([0xC3,0xA2,0xE2,0x9C,0x93]), to: '\u2713' },
  // ─ box drawing
  { from: Buffer.from([0xC3,0xA2,0xE2,0x80,0x9D,0xE2,0x82,0xAC]), to: '\u2500' },
];

function replaceBytes(buf, from, toBuf) {
  const parts = [];
  let start = 0;
  while (start < buf.length) {
    const idx = buf.indexOf(from, start);
    if (idx === -1) {
      parts.push(buf.slice(start));
      break;
    }
    parts.push(buf.slice(start, idx));
    parts.push(toBuf);
    start = idx + from.length;
  }
  return Buffer.concat(parts);
}

function fixFile(filePath) {
  let buf = fs.readFileSync(filePath);
  let changed = false;

  for (const { from, to } of REPLACEMENTS) {
    if (buf.indexOf(from) !== -1) {
      const toBuf = Buffer.from(to, 'utf8');
      buf = replaceBytes(buf, from, toBuf);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, buf);
    console.log(`  Fixed: ${path.relative(process.cwd(), filePath)}`);
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

console.log('Scanning for encoding corruption...\n');
const srcDir = path.join(__dirname, 'src');
const total = walkDir(srcDir);
console.log(`\nDone! Fixed ${total} file(s).`);
