const ts = require('typescript');

const fileName = 'src/pages/Client360.tsx';
const program = ts.createProgram([fileName], {
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.Latest,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
});

const diagnostics = ts.getPreEmitDiagnostics(program);

for (const diag of diagnostics) {
  if (diag.file && diag.file.fileName === fileName) {
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    console.log(`Line ${line + 1}, Col ${character + 1}: ${message}`);
  }
}
