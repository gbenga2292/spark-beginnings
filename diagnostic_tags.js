const fs = require('fs');

const content = fs.readFileSync('src/pages/Client360.tsx', 'utf8');

// Simple parser state
let i = 0;
let line = 1;
let col = 1;

function nextChar() {
  const c = content[i++];
  if (c === '\n') {
    line++;
    col = 1;
  } else {
    col++;
  }
  return c;
}

function peekChar() {
  return content[i];
}

const tagStack = [];

while (i < content.length) {
  const c = nextChar();
  
  // Skip line comments
  if (c === '/' && peekChar() === '/') {
    while (i < content.length && nextChar() !== '\n');
    continue;
  }
  
  // Skip block comments
  if (c === '/' && peekChar() === '*') {
    nextChar(); // consume '*'
    while (i < content.length) {
      if (nextChar() === '*' && peekChar() === '/') {
        nextChar(); // consume '/'
        break;
      }
    }
    continue;
  }

  // Skip string literals
  if (c === '"' || c === "'") {
    const quote = c;
    while (i < content.length) {
      const char = nextChar();
      if (char === '\\') {
        nextChar(); // skip escaped char
      } else if (char === quote) {
        break;
      }
    }
    continue;
  }

  // Skip template strings
  if (c === '`') {
    while (i < content.length) {
      const char = nextChar();
      if (char === '\\') {
        nextChar();
      } else if (char === '`') {
        break;
      }
    }
    continue;
  }

  // Check for tags
  if (c === '<') {
    const next = peekChar();
    
    // Check if it's a close tag
    if (next === '/') {
      nextChar(); // consume '/'
      let tagName = '';
      let tagLine = line;
      let tagCol = col - 1;
      
      if (peekChar() === '>') {
        nextChar(); // consume '>'
        tagName = 'Fragment';
      } else {
        while (i < content.length && /[a-zA-Z0-9.-]/.test(peekChar())) {
          tagName += nextChar();
        }
        if (peekChar() === '>') nextChar();
      }
      
      // Match with stack
      if (tagStack.length === 0) {
        console.log(`Error: Closed tag </${tagName}> at Line ${tagLine}, Col ${tagCol} but stack is empty.`);
      } else {
        const last = tagStack.pop();
        if (last.name !== tagName) {
          console.log(`Mismatch: Closed </${tagName}> at Line ${tagLine}, Col ${tagCol} but expected </${last.name}> (opened at Line ${last.line}, Col ${last.col})`);
        }
      }
      continue;
    }
    
    // Check for fragment open
    if (next === '>') {
      nextChar(); // consume '>'
      tagStack.push({ name: 'Fragment', line, col: col - 1 });
      continue;
    }

    // Check if it is a tag name
    if (/[a-zA-Z]/.test(next)) {
      let tagName = '';
      let tagLine = line;
      let tagCol = col;
      
      while (i < content.length && /[a-zA-Z0-9.-]/.test(peekChar())) {
        tagName += nextChar();
      }
      
      // Scan until closed (either > or />)
      let isSelfClosing = false;
      let inBraces = 0;
      
      while (i < content.length) {
        const char = nextChar();
        if (char === '{') {
          inBraces++;
        } else if (char === '}') {
          inBraces--;
        } else if (inBraces === 0) {
          if (char === '/' && peekChar() === '>') {
            nextChar(); // consume '>'
            isSelfClosing = true;
            break;
          }
          if (char === '>') {
            break;
          }
        }
      }
      
      if (!isSelfClosing) {
        // We need to ignore type assertions or generics if they aren't actual JSX tags.
        // In JSX, tags starting with uppercase or lowercase letters are tags. But some TypeScript files have <T> or similar.
        // Since we are parsing a TSX file, let's keep track of them.
        tagStack.push({ name: tagName, line: tagLine, col: tagCol });
      }
      continue;
    }
  }
}

console.log('Open tags remaining in stack:');
for (const tag of tagStack) {
  console.log(`  <${tag.name}> opened at Line ${tag.line}, Col ${tag.col}`);
}
