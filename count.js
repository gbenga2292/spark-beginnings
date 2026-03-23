const fs = require('fs');
const lines = fs.readFileSync('src/pages/Beneficiaries.tsx', 'utf8').split('\n');
let chunk = lines.slice(372, 555).join('\n');

// count exact occurrences, omitting those in comments or jsx attributes if possible, 
// but since it's simple formatting we can just count literal matches.
let openCount = (chunk.match(/<div(\s|>)/g) || []).length;
let closeCount = (chunk.match(/<\/div>/g) || []).length;

console.log('Open:', openCount, 'Close:', closeCount);
