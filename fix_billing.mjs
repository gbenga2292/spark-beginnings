import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/pages/Billing.tsx', 'utf8');

// ── Fix 1: Gate "Add Invoice" button with priv.canCreate ──────────────────────
// Find the button and replace it
const btnOld = `        <Button
          className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-10 px-5"
          onClick={() => { handleClear(); setIsModalOpen(true); }}
        >
          <Plus className="w-5 h-5" /> Add Invoice
        </Button>`;

const btnNew = `        {priv.canCreate && (
          <Button
            className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-10 px-5"
            onClick={() => { handleClear(); setIsModalOpen(true); }}
          >
            <Plus className="w-5 h-5" /> Add Invoice
          </Button>
        )}`;

// Try to match with CRLF variants too
const btnOldNorm = btnOld.replace(/\r\n/g, '\n');
const contentNorm = content.replace(/\r\n/g, '\n');

if (contentNorm.includes(btnOldNorm)) {
  content = contentNorm.replace(btnOldNorm, btnNew);
  console.log('✅ Fix 1: Add Invoice button gated with canCreate');
} else {
  console.log('❌ Fix 1: Button pattern not found, trying looser match...');
  // Try to find the button using indexOf
  const idx = content.indexOf('className="gap-2 bg-gradient-to-r from-indigo-600');
  if (idx >= 0) {
    console.log(`  Found at index ${idx}`);
    const surrounding = content.substring(idx - 100, idx + 300);
    console.log('  Surrounding:', surrounding.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n'));
  }
}

// ── Fix 2: Gate Edit/Delete row buttons ────────────────────────────────────────
// After normalizing to \n
const actionsOld = `                  <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-center gap-1">
                      {!isViewingActive && (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleMakeActive(inv); }} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Move to Active">
                          <ArrowRightCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(inv); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit row">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete row">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>`;

const actionsNew = `                  {(priv.canEdit || priv.canDelete) && (
                    <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-center gap-1">
                        {!isViewingActive && priv.canEdit && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleMakeActive(inv); }} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Move to Active">
                            <ArrowRightCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {priv.canEdit && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(inv); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit row">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {priv.canDelete && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete row">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}`;

if (content.includes(actionsOld)) {
  content = content.replace(actionsOld, actionsNew);
  console.log('✅ Fix 2: Edit/Delete buttons gated with canEdit/canDelete');
} else {
  console.log('❌ Fix 2: Actions pattern not found, trying normalized...');
  const actionsOldNorm = actionsOld.replace(/\r\n/g, '\n');
  if (content.includes(actionsOldNorm)) {
    content = content.replace(actionsOldNorm, actionsNew);
    console.log('✅ Fix 2 (normalized): Edit/Delete buttons gated');
  } else {
    console.log('  Still not found. Checking for partial match...');
    const partial = 'handleMakeActive(inv); }} className="h-8 w-8 text-emerald-600';
    const idx2 = content.indexOf(partial);
    if (idx2 >= 0) {
      const surrounding = content.substring(idx2 - 200, idx2 + 500);
      console.log('  Surrounding:', JSON.stringify(surrounding.substring(0, 200)));
    }
  }
}

writeFileSync('src/pages/Billing.tsx', content, 'utf8');
console.log('\nFinal check:');
const final = readFileSync('src/pages/Billing.tsx', 'utf8');
console.log('canCreate:', final.includes('priv.canCreate'));
console.log('canEdit:', final.includes('priv.canEdit'));
console.log('canDelete:', final.includes('priv.canDelete'));
