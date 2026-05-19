import fs from 'fs';

const content = fs.readFileSync('src/pages/Client360.tsx', 'utf8');
const lines = content.split('\n');

for (let lineNum = 1810; lineNum <= 1820; lineNum++) {
  const lineText = lines[lineNum - 1];
  console.log(`Line ${lineNum}: "${lineText}"`);
  const codes = [];
  for (let i = 0; i < lineText.length; i++) {
    codes.push(lineText.charCodeAt(i));
  }
  console.log(`  Codes: ${codes.join(', ')}`);
}
