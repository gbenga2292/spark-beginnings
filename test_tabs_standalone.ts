import ts from 'typescript';
import fs from 'fs';

const content = fs.readFileSync('src/pages/Client360.tsx', 'utf8');
const lines = content.split('\n');

const tabs = [
  { name: 'overview', start: 1044, end: 1133 },
  { name: 'financials', start: 1136, end: 1278 },
  { name: 'contacts', start: 1281, end: 1330 },
  { name: 'operations', start: 1333, end: 1503 },
  { name: 'activity', start: 1506, end: 1612 },
  { name: 'tasks', start: 1615, end: 1812 },
];

for (const tab of tabs) {
  console.log(`\n=== Testing Tab: ${tab.name} (Lines ${tab.start}-${tab.end}) ===`);
  const tabLines = lines.slice(tab.start - 1, tab.end);
  const tabCode = tabLines.join('\n');
  
  // Wrap in a valid TSX component structure
  // We declare variables that might be used in the tab so that it doesn't fail on "Cannot find name" (or we can just ignore name resolution errors)
  const wrappedCode = `
    import React from 'react';
    const activeTab = '${tab.name}';
    const currentUser: any = {};
    const clientData: any = {};
    const subtasks: any[] = [];
    const expandedTasks = new Set();
    const setExpandedTasks = (x: any) => {};
    const setOpenSubtaskId = (x: any) => {};
    const openClientEdit = () => {};
    const isDark = false;
    const isChatCollapsed = false;
    const clientPendingSites: any[] = [];
    const sitesSubTab = '';
    const setSitesSubTab = (x: any) => {};
    const setSelectedSite = (x: any) => {};
    const setCommDialogOpen = (x: any) => {};
    const setCommForm = (x: any) => {};
    const navigate = (x: any) => {};
    const handleDeletePendingOnboarding = (x: any) => {};
    const taskSubTab = '';
    const setTaskSubTab = (x: any) => {};
    
    export function TestComponent() {
      return (
        <div>
          ${tabCode}
        </div>
      );
    }
  `;
  
  // Parse and compile
  const tempFileName = `temp_${tab.name}.tsx`;
  fs.writeFileSync(tempFileName, wrappedCode, 'utf8');
  
  const program = ts.createProgram([tempFileName], {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    noEmit: true
  });
  
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const syntaxErrors = diagnostics.filter(d => d.code < 2000 || d.code === 17014 || d.code === 1005 || d.code === 1381);
  
  if (syntaxErrors.length === 0) {
    console.log(`✅ Standalone parse of ${tab.name} tab succeeded!`);
  } else {
    console.log(`❌ Standalone parse of ${tab.name} tab failed with ${syntaxErrors.length} syntax errors:`);
    for (const diag of syntaxErrors) {
      const { line, character } = diag.file!.getLineAndCharacterOfPosition(diag.start!);
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      console.log(`    Line ${line + 1}, Col ${character + 1}: ${message}`);
    }
  }
  
  fs.unlinkSync(tempFileName);
}
