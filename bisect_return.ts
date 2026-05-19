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

// Case 1: Simple return
console.log('--- Case 1: Simple Return ---');
const case1Lines = [...originalLines];
case1Lines[917] = 'return ( <div>Hello</div> );';
for (let i = 918; i < 2122; i++) {
  case1Lines[i] = '';
}
const case1Diags = checkCode(case1Lines.join('\n'));
console.log(`Errors: ${case1Diags.length}`);

// Case 2: Return with only dialogs mocked
console.log('--- Case 2: Return with dialogs mocked ---');
const case2Lines = [...originalLines];
// Mock lines 1819 to 2119 (dialogs) with empty space
for (let i = 1819; i < 2119; i++) {
  case2Lines[i] = '';
}
const case2Diags = checkCode(case2Lines.join('\n'));
console.log(`Errors: ${case2Diags.length}`);
if (case2Diags.length > 0) {
  console.log(`First error: Line ${case2Diags[0].file!.getLineAndCharacterOfPosition(case2Diags[0].start!).line + 1}: ${ts.flattenDiagnosticMessageText(case2Diags[0].messageText, '\n')}`);
}

// Case 3: Return with only top header + tabs mocked
console.log('--- Case 3: Return with top header + tabs mocked ---');
const case3Lines = [...originalLines];
// We keep lines 918 to 933. At line 933, we close everything.
case3Lines[932] = '<div>Mocked Client Content</div>';
for (let i = 933; i < 1814; i++) {
  case3Lines[i] = '';
}
// Line 1814 was closing div, line 1815 was ) : null} - we replace line 1815 with null
case3Lines[1814] = ') : null}';
const case3Diags = checkCode(case3Lines.join('\n'));
console.log(`Errors: ${case3Diags.length}`);
if (case3Diags.length > 0) {
  console.log(`First error: Line ${case3Diags[0].file!.getLineAndCharacterOfPosition(case3Diags[0].start!).line + 1}: ${ts.flattenDiagnosticMessageText(case3Diags[0].messageText, '\n')}`);
}
