import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const fileName = 'src/pages/Client360.tsx';
const content = fs.readFileSync(fileName, 'utf8');

const program = ts.createProgram([fileName], {
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.Latest,
  noEmit: true
});

const diagnostics = ts.getPreEmitDiagnostics(program);
const syntaxErrors = diagnostics.filter(d => d.file && d.file.fileName.includes('Client360.tsx') && (d.code < 2000 || d.code === 17014 || d.code === 1005 || d.code === 1381));

console.log(`Found ${syntaxErrors.length} syntax errors.`);

function printNodePath(node: ts.Node, pos: number) {
  const path: string[] = [];
  function walk(curr: ts.Node) {
    if (pos >= curr.getStart() && pos <= curr.getEnd()) {
      path.push(ts.SyntaxKind[curr.kind]);
      curr.forEachChild(walk);
    }
  }
  walk(node);
  return path.join(' -> ');
}

const sourceFile = program.getSourceFile(fileName);
if (sourceFile) {
  for (const diag of syntaxErrors) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start!);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    console.log(`\nError: Line ${line + 1}, Col ${character + 1}: ${message} (Code: ${diag.code})`);
    
    // Print AST Path
    const path = printNodePath(sourceFile, diag.start!);
    console.log(`  AST Path: ${path}`);
    
    // Print source context
    const lines = content.split('\n');
    const startLine = Math.max(0, line - 2);
    const endLine = Math.min(lines.length - 1, line + 2);
    console.log(`  Context:`);
    for (let l = startLine; l <= endLine; l++) {
      const marker = l === line ? '>> ' : '   ';
      console.log(`    ${marker}${l + 1}: ${lines[l].trimEnd()}`);
    }
  }
}
