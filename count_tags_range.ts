import fs from 'fs';

const content = fs.readFileSync('src/pages/Client360.tsx', 'utf8');
const lines = content.split('\n');

function checkRange(startLine: number, endLine: number, label: string) {
  console.log(`=== checking ${label} (Lines ${startLine}-${endLine}) ===`);
  const rangeLines = lines.slice(startLine - 1, endLine);
  
  const tags: { tag: string; line: number; isOpen: boolean }[] = [];
  
  for (let i = 0; i < rangeLines.length; i++) {
    const lineNum = startLine + i;
    const lineText = rangeLines[i];
    
    // Find tags
    const reg = /<\/?([a-zA-Z0-9.-]+)(?:\s|>|\/)/g;
    let match;
    while ((match = reg.exec(lineText)) !== null) {
      const tagName = match[1];
      const fullMatch = match[0];
      
      // Ignore self-closing tags
      const isSelfClosing = fullMatch.endsWith('/>') || lineText.substring(match.index).split('>')[0].endsWith('/');
      
      const isOpen = !fullMatch.startsWith('</');
      
      // Let's filter some non-HTML/React tags or common false matches
      if (tagName === 'import' || tagName === 'const' || tagName === 'export' || tagName === 'return') continue;
      
      if (!isSelfClosing) {
        tags.push({ tag: tagName, line: lineNum, isOpen });
      }
    }
  }

  // print stack
  const stack: { tag: string; line: number }[] = [];
  for (const t of tags) {
    if (t.isOpen) {
      stack.push({ tag: t.tag, line: t.line });
    } else {
      if (stack.length === 0) {
        console.log(`Extra closing tag </${t.tag}> at line ${t.line}`);
      } else {
        const top = stack.pop()!;
        if (top.tag !== t.tag) {
          console.log(`Mismatch: Opened <${top.tag}> at line ${top.line} but closed </${t.tag}> at line ${t.line}`);
        }
      }
    }
  }
  
  if (stack.length > 0) {
    console.log(`Unclosed tags:`);
    for (const s of stack) {
      console.log(`  <${s.tag}> opened at line ${s.line}`);
    }
  } else {
    console.log(`All tags balanced!`);
  }
}

// Check each tab
checkRange(1044, 1133, 'Overview Tab');
checkRange(1136, 1278, 'Financials Tab');
checkRange(1281, 1330, 'Contacts Tab');
checkRange(1333, 1503, 'Operations Tab');
checkRange(1506, 1612, 'Activity Tab');
checkRange(1615, 1812, 'Tasks Tab');
