import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const fileName = 'src/pages/Client360.tsx';

// Load tsconfig.json
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

const program = ts.createProgram([fileName], parsedCommandLine.options);
const sourceFile = program.getSourceFile(fileName);
if (!sourceFile) {
  console.error('Could not load source file');
  process.exit(1);
}

const diagnostics = ts.getPreEmitDiagnostics(program);

let count = 0;
for (const diag of diagnostics) {
  if (diag.file && diag.file.fileName.includes('Client360.tsx')) {
    // Filter out:
    // - 2307: Cannot find module
    // - 2571: Object is of type 'unknown' (or other type-checking errors that are secondary to syntax errors)
    if (diag.code === 2307) continue;

    count++;
    if (count > 20) break;
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    console.log(`Error #${count} (TS${diag.code}) - Line ${line + 1}, Col ${character + 1}: ${message}`);
    
    const lines = sourceFile.text.split('\n');
    const startLine = Math.max(0, line - 3);
    const endLine = Math.min(lines.length - 1, line + 3);
    console.log('--- Context ---');
    for (let l = startLine; l <= endLine; l++) {
      const isErrorLine = l === line;
      console.log(`${isErrorLine ? '=>' : '  '} ${l + 1}: ${lines[l]}`);
    }
    console.log('---------------\n');
  }
}
