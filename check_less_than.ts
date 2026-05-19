import fs from 'fs';

const content = fs.readFileSync('src/pages/Client360.tsx', 'utf8');
const lines = content.split('\n');

const tagRegex = /<([a-zA-Z0-9.-]+|<\/|[a-zA-Z0-9.-]+\/>)/;

for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
  const lineText = lines[lineNum - 1];
  
  let pos = -1;
  while ((pos = lineText.indexOf('<', pos + 1)) !== -1) {
    const rest = lineText.substring(pos);
    
    // Check if it looks like a tag
    const isTag = /^(<\/?([a-zA-Z0-9.-]+)|<>)/.test(rest);
    if (!isTag) {
      console.log(`Non-tag < at line ${lineNum}:${pos + 1}: ${lineText.trim()}`);
    }
  }
}
