import fs from 'fs';

let content = fs.readFileSync('src/pages/Variables.tsx', 'utf8');

const positionStartToken = '<Card>\n            <CardHeader>\n              <CardTitle>Positions</CardTitle>';
const posIdx = content.indexOf(positionStartToken);
if (posIdx === -1) throw new Error('Positions not found');

// Find the very bottom of the document where these cards end
const posEndTokens = '\n        </div>\n      </div>\n    </div>\n  );\n}';
const endIdx = content.lastIndexOf(posEndTokens);

if (endIdx === -1 || posIdx >= endIdx) throw new Error('Could not slice correctly');

// Extract all the Cards (Positions, Depts, Tasks)
const toMove = content.substring(posIdx, endIdx);

// Remove extracted from original
let updated = content.substring(0, posIdx) + content.substring(endIdx);

// Insert toMove right after Public holidays Card
const phEndToken = '</CardContent>\n          </Card>\n\n        <div className="flex flex-col gap-6">\n          <Card>\n            <CardHeader>\n              <CardTitle>Payroll Breakdown Variables (%)</CardTitle>';

const insertIdx = updated.indexOf(phEndToken);
if (insertIdx === -1) throw new Error('PH End not found');

// We insert toMove BEFORE the `<div className="flex flex-col gap-6">`
const splitPt = updated.indexOf('<div className="flex flex-col gap-6">', insertIdx);
const before = updated.substring(0, splitPt);
const after = updated.substring(splitPt);

updated = before + toMove + '\n        </div>\n\n        ' + after;

// Now add the wrapper for the Left column and fix the Grid className
updated = updated.replace(
    '<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">\n        <Card>\n          <CardHeader>\n            <CardTitle>Public Holidays</CardTitle>',
    '<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">\n        {/* Left Column */}\n        <div className="flex flex-col gap-6">\n          <Card>\n            <CardHeader>\n              <CardTitle>Public Holidays</CardTitle>'
);

fs.writeFileSync('src/pages/Variables.tsx', updated);
console.log('Done mapping layout');
