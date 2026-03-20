const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  // Various left-over UTF-8 double-encoding corruptions
  newContent = newContent.replace(/â†’/g, '→');
  newContent = newContent.replace(/â• /g, '═');
  newContent = newContent.replace(/â— /g, '●');
  newContent = newContent.replace(/â–¸/g, '▸');
  newContent = newContent.replace(/âœ…/g, '✅');
  newContent = newContent.replace(/ðŸ”’/g, '🔒');
  newContent = newContent.replace(/Ã¢â€\s*â‚¬/g, '─'); // usually meant to be a dashed line
  newContent = newContent.replace(/Ã¢â€ â‚¬/g, '─'); 
  newContent = newContent.replace(/Ã¢â‚¬“/g, '–');
  newContent = newContent.replace(/Ã¢â‚¬â€ /g, '—');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`  Cleaned: ${path.relative(process.cwd(), filePath)}`);
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
      if (cleanFile(full)) count++;
    }
  }
  return count;
}

console.log('Final text cleanup running...');
const total = walkDir(path.join(__dirname, 'src'));
console.log(`\nPhase 3 Done! Fixed ${total} file(s).`);
