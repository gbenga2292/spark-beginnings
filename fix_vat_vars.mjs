import { readFileSync, writeFileSync } from 'fs';

// ═══════════════════════════════════════════════════════════════
// FIX 1 — VatPayments.tsx
// Uses payments module, specifically canManageVat for mutations
// ═══════════════════════════════════════════════════════════════
let vat = readFileSync('src/pages/VatPayments.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1a: Add usePriv import
if (!vat.includes("usePriv")) {
  vat = vat.replace(
    `import { Badge } from '@/src/components/ui/badge';`,
    `import { Badge } from '@/src/components/ui/badge';\nimport { usePriv } from '@/src/hooks/usePriv';`
  );
  console.log('✅ VatPayments: added usePriv import');
}

// 1b: Add priv declaration after opening braces of the component
vat = vat.replace(
  `    const [selectedId, setSelectedId] = useState<string | null>(null);`,
  `    // ─── Permissions ───────────────────────────────────────────\n    const priv = usePriv('payments');\n\n    const [selectedId, setSelectedId] = useState<string | null>(null);`
);
console.log('✅ VatPayments: added priv declaration');

// 1c: Gate "Add VAT Payment" button
vat = vat.replace(
  `            <div className="flex justify-end">
                <Button
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-10 px-5"
                    onClick={() => { handleClear(); setIsModalOpen(true); }}
                >
                    <Plus className="w-5 h-5" /> Add VAT Payment
                </Button>
            </div>`,
  `            <div className="flex justify-end">
                {priv.canManageVat && (
                  <Button
                      className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-10 px-5"
                      onClick={() => { handleClear(); setIsModalOpen(true); }}
                  >
                      <Plus className="w-5 h-5" /> Add VAT Payment
                  </Button>
                )}
            </div>`
);
console.log('✅ VatPayments: Add VAT Payment button gated with canManageVat');

// 1d: Gate the Actions column header
vat = vat.replace(
  `                                        <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">Actions</TableHead>`,
  `                                        {priv.canManageVat && (\n                                          <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">Actions</TableHead>\n                                        )}`
);
console.log('✅ VatPayments: Actions column header gated');

// 1e: Gate the Edit + Delete buttons in rows
vat = vat.replace(
  `                                            <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete record">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>`,
  `                                            {priv.canManageVat && (
                                              <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete record">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                              </TableCell>
                                            )}`
);
console.log('✅ VatPayments: Edit/Delete row buttons gated');

writeFileSync('src/pages/VatPayments.tsx', vat, 'utf8');

// ═══════════════════════════════════════════════════════════════
// FIX 2 — Variables.tsx
// Uses variables module: canView + canEdit
// All mutation buttons should require priv.canEdit
// ═══════════════════════════════════════════════════════════════
let vars = readFileSync('src/pages/Variables.tsx', 'utf8').replace(/\r\n/g, '\n');

// 2a: Add usePriv import
if (!vars.includes("usePriv")) {
  vars = vars.replace(
    `import { toast } from '@/src/components/ui/toast';`,
    `import { toast } from '@/src/components/ui/toast';\nimport { usePriv } from '@/src/hooks/usePriv';`
  );
  console.log('✅ Variables: added usePriv import');
}

// 2b: Add priv after the store declarations (after last useAppStore call around line 43)
vars = vars.replace(
  `  const [newExtraLabel, setNewExtraLabel] = useState('');`,
  `  // ─── Permissions ───────────────────────────────────────────\n  const priv = usePriv('variables');\n\n  const [newExtraLabel, setNewExtraLabel] = useState('');`
);
console.log('✅ Variables: added priv declaration');

// 2c: Gate the top-level "Save Changes" button
vars = vars.replace(
  `        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold gap-2 transition-all">
          <Save className="h-4 w-4" /> Save Changes
        </Button>`,
  `        {priv.canEdit && (
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold gap-2 transition-all">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        )}`
);
console.log('✅ Variables: Save Changes button gated');

// 2d: Gate "Add Holiday" button + inputs (wrap the whole row in canEdit)
vars = vars.replace(
  `              <div className="flex gap-2 mb-4">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  placeholder="Holiday Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddHoliday} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>`,
  `              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-40"
                  />
                  <Input
                    placeholder="Holiday Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddHoliday} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}`
);
console.log('✅ Variables: Add Holiday row gated');

// 2e: Gate Remove Holiday button inside table rows
vars = vars.replace(
  `                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveHoliday(holiday.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>`,
  `                            {priv.canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveHoliday(holiday.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}`
);
console.log('✅ Variables: Remove Holiday button gated');

// 2f: Gate "Add Position" button row
vars = vars.replace(
  `              <div className="flex gap-2 mb-4">
                <Input placeholder="New Position" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} className="flex-1" />
                <Button onClick={handleAddPosition} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>`,
  `              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="New Position" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} className="flex-1" />
                  <Button onClick={handleAddPosition} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}`
);
console.log('✅ Variables: Add Position row gated');

// 2g: Gate Remove Position button (inside the pill)
vars = vars.replace(
  `                    <button onClick={() => removePosition(pos)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>`,
  `                    {priv.canEdit && (
                      <button onClick={() => removePosition(pos)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}`
);
console.log('✅ Variables: Remove Position button gated');

// 2h: Gate "Add Department" button row
vars = vars.replace(
  `              <div className="flex gap-2 mb-4">
                <Input placeholder="New Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1" />
                <Button onClick={handleAddDepartment} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>`,
  `              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="New Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1" />
                  <Button onClick={handleAddDepartment} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}`
);
console.log('✅ Variables: Add Department row gated');

// 2i: Gate Remove Department button
vars = vars.replace(
  `                    <button onClick={() => removeDepartment(dep)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>`,
  `                    {priv.canEdit && (
                      <button onClick={() => removeDepartment(dep)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}`
);
console.log('✅ Variables: Remove Department button gated');

// 2j: Gate Add LeaveType row  
vars = vars.replace(
  `              <div className="flex gap-2 mb-4">
                <Input placeholder="e.g. Compassionate Leave" value={newLeaveType} onChange={(e) => setNewLeaveType(e.target.value)} className="flex-1" />
                <Button onClick={() => { if (newLeaveType && !leaveTypes.includes(newLeaveType)) { addLeaveType(newLeaveType); setNewLeaveType(''); } }} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>`,
  `              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="e.g. Compassionate Leave" value={newLeaveType} onChange={(e) => setNewLeaveType(e.target.value)} className="flex-1" />
                  <Button onClick={() => { if (newLeaveType && !leaveTypes.includes(newLeaveType)) { addLeaveType(newLeaveType); setNewLeaveType(''); } }} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}`
);
console.log('✅ Variables: Add LeaveType row gated');

// 2k: Gate Remove LeaveType button
vars = vars.replace(
  `                    <button onClick={() => removeLeaveType(lt)} className="text-teal-400 hover:text-rose-500">
                      <Trash2 className="h-3 w-3" />
                    </button>`,
  `                    {priv.canEdit && (
                      <button onClick={() => removeLeaveType(lt)} className="text-teal-400 hover:text-rose-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}`
);
console.log('✅ Variables: Remove LeaveType button gated');

// 2l: Gate Add Task row (inputs + button)
vars = vars.replace(
  `              <div className="flex gap-2">
                <Input placeholder="Task Title (e.g. Provide Laptop)" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1" />
                <Input placeholder="Assignee (e.g. IT)" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} className="w-32" />
                <Button variant="outline" onClick={handleAddTask} className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>`,
  `              {priv.canEdit && (
                <div className="flex gap-2">
                  <Input placeholder="Task Title (e.g. Provide Laptop)" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1" />
                  <Input placeholder="Assignee (e.g. IT)" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} className="w-32" />
                  <Button variant="outline" onClick={handleAddTask} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}`
);
console.log('✅ Variables: Add Task row gated');

// 2m: Gate Remove Task buttons (onboarding)
vars = vars.replace(
  `                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'onboarding')}>
                                <Trash2 className="h-3 w-3" />
                              </Button>`,
  `                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'onboarding')}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}`
);
console.log('✅ Variables: Remove Onboarding Task button gated');

// 2n: Gate Remove Task button (offboarding)
vars = vars.replace(
  `                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'offboarding')}>
                                <Trash2 className="h-3 w-3" />
                              </Button>`,
  `                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'offboarding')}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}`
);
console.log('✅ Variables: Remove Offboarding Task button gated');

// 2o: Gate Remove Tax Bracket button
vars = vars.replace(
  `                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                onClick={() => removeTaxBracket(b.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>`,
  `                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                  onClick={() => removeTaxBracket(b.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}`
);
console.log('✅ Variables: Remove Tax Bracket button gated');

// 2p: Gate Add Bracket row
vars = vars.replace(
  `                 <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Label</label>
                    <Input placeholder="e.g. Next ₦9m" value={newBracketLabel}
                      onChange={e => setNewBracketLabel(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Up To (₦) <span className="text-slate-400 font-normal italic">blank=top</span></label>
                    <Input type="number" placeholder="11200000" className="w-36" value={newBracketUpTo}
                      onChange={e => setNewBracketUpTo(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Rate (%)</label>
                    <Input type="number" step="0.1" placeholder="18" className="w-24" value={newBracketRate}
                      onChange={e => setNewBracketRate(e.target.value)} />
                  </div>
                  <Button variant="outline" className="gap-1 shrink-0" onClick={() => {
                    if (!newBracketLabel || !newBracketRate) return;
                    addTaxBracket({
                      id: Math.random().toString(36).slice(2),
                      label: newBracketLabel,
                      upTo: newBracketUpTo !== '' ? Number(newBracketUpTo) : null,
                      rate: Number(newBracketRate) / 100,
                    });
                    setNewBracketLabel(''); setNewBracketUpTo(''); setNewBracketRate('');
                  }}>
                    <Plus className="h-4 w-4" /> Add Bracket
                  </Button>
                </div>`,
  `                 {priv.canEdit && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Label</label>
                      <Input placeholder="e.g. Next ₦9m" value={newBracketLabel}
                        onChange={e => setNewBracketLabel(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Up To (₦) <span className="text-slate-400 font-normal italic">blank=top</span></label>
                      <Input type="number" placeholder="11200000" className="w-36" value={newBracketUpTo}
                        onChange={e => setNewBracketUpTo(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Rate (%)</label>
                      <Input type="number" step="0.1" placeholder="18" className="w-24" value={newBracketRate}
                        onChange={e => setNewBracketRate(e.target.value)} />
                    </div>
                    <Button variant="outline" className="gap-1 shrink-0" onClick={() => {
                      if (!newBracketLabel || !newBracketRate) return;
                      addTaxBracket({
                        id: Math.random().toString(36).slice(2),
                        label: newBracketLabel,
                        upTo: newBracketUpTo !== '' ? Number(newBracketUpTo) : null,
                        rate: Number(newBracketRate) / 100,
                      });
                      setNewBracketLabel(''); setNewBracketUpTo(''); setNewBracketRate('');
                    }}>
                      <Plus className="h-4 w-4" /> Add Bracket
                    </Button>
                  </div>
                 )}`
);
console.log('✅ Variables: Add Tax Bracket row gated');

// 2q: Gate Add Extra Condition row
vars = vars.replace(
  `                 <div className="flex gap-2 mb-3">
                  <Input placeholder="Label (e.g. Life Insurance Relief)" value={newExtraLabel}
                    onChange={e => setNewExtraLabel(e.target.value)} className="flex-1" />
                  <Input type="number" placeholder="₦ Amount" value={newExtraAmount}
                    onChange={e => setNewExtraAmount(e.target.value)} className="w-36" />
                  <Button variant="outline" className="gap-1" onClick={() => {
                    if (!newExtraLabel || !newExtraAmount) return;
                    addPayeTaxExtraCondition({ id: Math.random().toString(36).slice(2), label: newExtraLabel, amount: Number(newExtraAmount), enabled: true });
                    setNewExtraLabel(''); setNewExtraAmount('');
                  }}><Plus className="h-4 w-4" /> Add</Button>
                </div>`,
  `                 {priv.canEdit && (
                  <div className="flex gap-2 mb-3">
                    <Input placeholder="Label (e.g. Life Insurance Relief)" value={newExtraLabel}
                      onChange={e => setNewExtraLabel(e.target.value)} className="flex-1" />
                    <Input type="number" placeholder="₦ Amount" value={newExtraAmount}
                      onChange={e => setNewExtraAmount(e.target.value)} className="w-36" />
                    <Button variant="outline" className="gap-1" onClick={() => {
                      if (!newExtraLabel || !newExtraAmount) return;
                      addPayeTaxExtraCondition({ id: Math.random().toString(36).slice(2), label: newExtraLabel, amount: Number(newExtraAmount), enabled: true });
                      setNewExtraLabel(''); setNewExtraAmount('');
                    }}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                 )}`
);
console.log('✅ Variables: Add Extra Condition row gated');

// 2r: Gate Remove Extra Condition button
vars = vars.replace(
  `                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                onClick={() => removePayeTaxExtraCondition(cond.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>`,
  `                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                  onClick={() => removePayeTaxExtraCondition(cond.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}`
);
console.log('✅ Variables: Remove Extra Condition button gated');

writeFileSync('src/pages/Variables.tsx', vars, 'utf8');

// ── Final verification ──────────────────────────────────────────
console.log('\n═══ FINAL VERIFICATION ═══');

const vatFinal = readFileSync('src/pages/VatPayments.tsx', 'utf8');
console.log('VatPayments - usePriv imported:', vatFinal.includes("usePriv"));
console.log('VatPayments - priv declared:', vatFinal.includes("const priv = usePriv"));
console.log('VatPayments - Add gated:', vatFinal.includes("priv.canManageVat"));

const varsFinal = readFileSync('src/pages/Variables.tsx', 'utf8');
console.log('Variables - usePriv imported:', varsFinal.includes("usePriv"));
console.log('Variables - priv declared:', varsFinal.includes("const priv = usePriv"));
console.log('Variables - canEdit gates:', (varsFinal.match(/priv\.canEdit/g) || []).length, 'occurrences');
