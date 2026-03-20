const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  // checkmark ✓ (UTF-8: E2 9C 93 -> Win-1252: â œ “ -> Re-encoded: C3A2 C593 E2809C)
  { from: Buffer.from([0xC3, 0xA2, 0xC5, 0x93, 0xE2, 0x80, 0x9C]), to: '✓' },
  // dash – (UTF-8: E2 80 93 -> Win-1252: â € “ -> Re-encoded: C3A2 E282AC E2809C)
  { from: Buffer.from([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x9C]), to: '–' },
  // double quote ” (UTF-8: E2 80 9D -> Win-1252: â € ” -> Re-encoded: C3A2 E282AC E2809D)
  { from: Buffer.from([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xE2, 0x80, 0x9D]), to: '”' },
  // bullet • (UTF-8: E2 80 A2 -> Win-1252: â € ¢ -> Re-encoded: C3A2 E282AC C2A2)
  { from: Buffer.from([0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC2, 0xA2]), to: '•' },
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

  // Final catch-all for any remaining â€" (using simple string replace as fallback)
  const content = buf.toString('utf8');
  let newContent = content;
  
  if (newContent.includes('âœ“')) newContent = newContent.replace(/âœ“/g, '✓');
  if (newContent.includes('âœ"')) newContent = newContent.replace(/âœ"/g, '✓');
  if (newContent.includes('â€"')) newContent = newContent.replace(/â€"/g, '—');
  if (newContent.includes('â€”')) newContent = newContent.replace(/â€”/g, '—');
  if (newContent.includes('â€¢')) newContent = newContent.replace(/â€¢/g, '•');
  if (newContent.includes('â€¦')) newContent = newContent.replace(/â€¦/g, '…');
  if (newContent.includes('â€˜')) newContent = newContent.replace(/â€˜/g, '\'');
  if (newContent.includes('â€™')) newContent = newContent.replace(/â€™/g, '\'');
  if (newContent.includes('â‚¦')) newContent = newContent.replace(/â‚¦/g, '₦');

  if (content !== newContent) {
    buf = Buffer.from(newContent, 'utf8');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, buf);
    console.log(`  Fixed (Phase 2): ${path.relative(process.cwd(), filePath)}`);
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
console.log(`\nPhase 2 Done! Fixed ${total} file(s).`);
