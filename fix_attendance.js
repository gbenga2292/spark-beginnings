const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'pages', 'Attendance.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find lines around 639 and 664
const lines = content.split('\n');
for (let i = 630; i < 675; i++) {
  const line = lines[i];
  if (line.includes('<option')) {
    const hex = Buffer.from(line).toString('hex');
    console.log('Line ' + (i+1) + ': ' + line.trim());
    console.log('  HEX: ' + hex.substring(0, 80));
  }
}
