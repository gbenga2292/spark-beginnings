import fs from 'fs';
let c=fs.readFileSync('src/pages/Leaves.tsx', 'utf8');
c = c.replace(/<\/div>\s*<\/div>\s*\{\/\*.*?PAGE 2.*?\*\/\}\s*<div[^>]*>\s*\{\/\* Header \*\/\}\s*<div[^>]*>.*?<\/div>\s*<div[^>]*><\/div>/s, '<div style={{ borderBottom: \'1px solid #111\', margin: \'16px 0\' }} />');
c = c.replace(/<div className=.a4-page[^>]*>/, '<div className="a4-page bg-white shadow-lg mx-auto" style={{ width: 794, padding: '30px 40px', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#111' }}>');
fs.writeFileSync('src/pages/Leaves.tsx', c);
