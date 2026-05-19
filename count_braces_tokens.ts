import ts from 'typescript';
import fs from 'fs';

const content = fs.readFileSync('src/pages/Client360.tsx', 'utf8');

const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
scanner.setText(content);

let braceCount = 0;
let parenCount = 0;

let braceStack: { line: number; character: number }[] = [];
let parenStack: { line: number; character: number }[] = [];

let token = scanner.scan();
while (token !== ts.SyntaxKind.EndOfFileToken) {
  const pos = scanner.getTokenPos();
  const { line, character } = ts.getLineAndCharacterOfPosition(
    ts.createSourceFile('temp.tsx', content, ts.ScriptTarget.Latest),
    pos
  );

  if (token === ts.SyntaxKind.OpenBraceToken) {
    braceCount++;
    braceStack.push({ line: line + 1, character: character + 1 });
  } else if (token === ts.SyntaxKind.CloseBraceToken) {
    braceCount--;
    if (braceStack.length > 0) {
      braceStack.pop();
    } else {
      console.log(`Extra } at line ${line + 1}, character ${character + 1}`);
    }
  } else if (token === ts.SyntaxKind.OpenParenToken) {
    parenCount++;
    parenStack.push({ line: line + 1, character: character + 1 });
  } else if (token === ts.SyntaxKind.CloseParenToken) {
    parenCount--;
    if (parenStack.length > 0) {
      parenStack.pop();
    } else {
      console.log(`Extra ) at line ${line + 1}, character ${character + 1}`);
    }
  }
  token = scanner.scan();
}

console.log(`Net braces: ${braceCount}`);
console.log(`Net parens: ${parenCount}`);

if (braceStack.length > 0) {
  console.log('Unclosed braces opened at:');
  console.log(braceStack.slice(-5));
}
if (parenStack.length > 0) {
  console.log('Unclosed parens opened at:');
  console.log(parenStack.slice(-5));
}
