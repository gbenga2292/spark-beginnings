import ts from 'typescript';
import path from 'path';

const fileName = 'src/pages/Client360.tsx';

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

const diagnostics = ts.getPreEmitDiagnostics(program);

for (const diag of diagnostics) {
  if (diag.file && diag.file.fileName.includes('Client360.tsx')) {
    if (diag.code === 2307) continue; // skip module not found

    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
    console.log(`Line ${line + 1}, Col ${character + 1} (TS${diag.code}): ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
    
    if (diag.relatedInformation) {
      for (const info of diag.relatedInformation) {
        if (info.file) {
          const { line: l, character: c } = info.file.getLineAndCharacterOfPosition(info.start!);
          console.log(`  Related: ${info.file.fileName} Line ${l + 1}, Col ${c + 1}: ${ts.flattenDiagnosticMessageText(info.messageText, '\n')}`);
        }
      }
    }
  }
}
