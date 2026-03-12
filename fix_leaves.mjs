import { readFileSync, writeFileSync } from 'fs';

// ── Fix Leaves.tsx: Gate "File Leave Entry" button with priv.canAdd ────────────
let leaves = readFileSync('src/pages/Leaves.tsx', 'utf8');

const leaveBtnOld = `          <Button
            className="gap-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-md"
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            <Plus className="h-4 w-4" /> File Leave Entry
          </Button>`;

const leaveBtnNew = `          {priv.canAdd && (
            <Button
              className="gap-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-md"
              onClick={() => { resetForm(); setShowForm(true); }}
            >
              <Plus className="h-4 w-4" /> File Leave Entry
            </Button>
          )}`;

// Normalize line endings
const leavesNorm = leaves.replace(/\r\n/g, '\n');
const leaveBtnOldNorm = leaveBtnOld.replace(/\r\n/g, '\n');

if (leavesNorm.includes(leaveBtnOldNorm)) {
  const fixed = leavesNorm.replace(leaveBtnOldNorm, leaveBtnNew);
  writeFileSync('src/pages/Leaves.tsx', fixed, 'utf8');
  console.log('✅ Leaves.tsx: "File Leave Entry" button now requires priv.canAdd');
} else {
  console.log('❌ Leaves.tsx: Pattern not found. Checking partial...');
  const partial = 'gap-2 bg-gradient-to-r from-teal-600';
  const idx = leavesNorm.indexOf(partial);
  if (idx >= 0) {
    console.log('  Found at index', idx);
    console.log('  Context:', JSON.stringify(leavesNorm.substring(idx - 100, idx + 300)));
  } else {
    console.log('  No teal gradient found either!');
  }
}

// Verify
const finalLeaves = readFileSync('src/pages/Leaves.tsx', 'utf8');
console.log('\nFinal check - Leaves.tsx:');
console.log('priv.canAdd (File Leave Entry):', finalLeaves.includes('priv.canAdd'));
console.log('priv.canEdit:', finalLeaves.includes('priv.canEdit'));
console.log('priv.canDelete:', finalLeaves.includes('priv.canDelete'));

// ── Verify Billing.tsx ─────────────────────────────────────────────────────────
const billing = readFileSync('src/pages/Billing.tsx', 'utf8');
console.log('\nFinal check - Billing.tsx:');
console.log('priv.canCreate:', billing.includes('priv.canCreate'));
console.log('priv.canEdit:', billing.includes('priv.canEdit'));
console.log('priv.canDelete:', billing.includes('priv.canDelete'));
