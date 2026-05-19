import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const fileName = 'src/pages/Client360.tsx';
const originalContent = fs.readFileSync(fileName, 'utf8');
const originalLines = originalContent.split('\n');

const tsconfigPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
if (!tsconfigPath) {
  console.error('Could not find tsconfig.json');
  process.exit(1);
}
const tsconfigFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
const parsedCommandLine = ts.parseJsonConfigFileContent(
  tsconfigFile.config,
  ts.sys,
  path.dirname(tsconfigPath)
);

function checkCode(codeText: string): ts.Diagnostic[] {
  const tempFileName = 'src/pages/Client360_temp.tsx';
  fs.writeFileSync(tempFileName, codeText, 'utf8');
  
  const program = ts.createProgram([tempFileName], parsedCommandLine.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  
  fs.unlinkSync(tempFileName);
  
  return diagnostics.filter(diag => {
    return diag.file && diag.file.fileName.includes('Client360_temp.tsx') && diag.code !== 2307;
  });
}

const tabs = [
  { name: 'overview', start: 1044, end: 1133 },
  { name: 'financials', start: 1136, end: 1278 },
  { name: 'contacts', start: 1281, end: 1330 },
  { name: 'operations', start: 1333, end: 1503 },
  { name: 'activity', start: 1506, end: 1612 },
  { name: 'tasks', start: 1615, end: 1812 },
];

// 1. Check original first
const originalDiags = checkCode(originalContent);
console.log(`Original has ${originalDiags.length} errors.`);
for (const diag of originalDiags.slice(0, 3)) {
  const { line, character } = diag.file!.getLineAndCharacterOfPosition(diag.start!);
  console.log(`  Line ${line + 1}, Col ${character + 1}: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
}

// 2. Mock each tab individually and check
for (const tab of tabs) {
  const newLines = [...originalLines];
  
  // Replace the tab lines with a dummy expression
  // Note: start and end are 1-based line numbers.
  // We keep the start line's condition `{activeTab === 'name' && (` and replace the body, closing it with `)}`
  const header = originalLines[tab.start - 1]; // e.g. {activeTab === 'overview' && (
  newLines[tab.start - 1] = `${header} <div>Mocked ${tab.name}</div> )}`;
  for (let i = tab.start; i < tab.end; i++) {
    newLines[i] = ''; // clear out the body
  }
  
  const mockedContent = newLines.join('\n');
  const diags = checkCode(mockedContent);
  console.log(`Mocking [${tab.name}] tab -> Errors remaining: ${diags.length}`);
  if (diags.length < originalDiags.length) {
    console.log(`  Significant change in errors! First error in this mock:`);
    for (const diag of diags.slice(0, 2)) {
      const { line, character } = diag.file!.getLineAndCharacterOfPosition(diag.start!);
      console.log(`    Line ${line + 1}, Col ${character + 1}: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
    }
  }
}
