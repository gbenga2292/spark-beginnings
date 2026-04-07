const fs = require('fs');

let c = fs.readFileSync('src/pages/Leaves.tsx', 'utf8');

const regex = /<\/div>\s*<\/div>\s*\{\/\*.*?PAGE 2.*?\*\/\}\s*<div[^>]+>\s*\{\/\* Header \*\/\}\s*<div[^>]+>[\s\S]*?<\/div>\s*<div[^>]+>\s*<\/div>/s;
c = c.replace(regex, '<div style={{ borderBottom: "1px solid #111", margin: "16px 0" }} />');

// also shrink outer padding
c = c.replace(/padding: '40px 48px'/g, "padding: '24px 32px'");
c = c.replace(/minHeight: 56/g, "minHeight: 40");
c = c.replace(/marginBottom: 16/g, "marginBottom: 12");
c = c.replace(/margin: '24px 0 12px'/g, "margin: '16px 0 8px'");

fs.writeFileSync('src/pages/Leaves.tsx', c);
console.log('Done!');
