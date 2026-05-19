import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const fileName = 'src/pages/Client360.tsx';
const content = fs.readFileSync(fileName, 'utf8');

// Load tsconfig options
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

// Check original first
const originalDiags = checkCode(content);
console.log(`Original has ${originalDiags.length} errors.`);

const tabs = [
  { name: 'overview', pattern: /\{activeTab === 'overview' && \([\s\S]*?\n\s*\}\)/ },
  { name: 'financials', pattern: /\{activeTab === 'financials' && \([\s\S]*?\n\s*\}\)/ },
  { name: 'contacts', pattern: /\{activeTab === 'contacts' && \([\s\S]*?\n\s*\}\)/ },
  { name: 'operations', pattern: /\{activeTab === 'operations' && \([\s\S]*?\n\s*\}\)/ },
  { name: 'activity', pattern: /\{activeTab === 'activity' && \([\s\S]*?\n\s*\}\)/ },
  { name: 'tasks', pattern: /\{activeTab === 'tasks' && \([\s\S]*?\n\s*\}\)/ },
];

for (const tab of tabs) {
  if (content.match(tab.pattern)) {
    const mockedContent = content.replace(tab.pattern, `{activeTab === '${tab.name}' && ( <div>Mocked {tab.name}</div> )}`);
    const diags = checkCode(mockedContent);
    console.log(`Mocking [${tab.name}] tab -> Errors remaining: ${diags.length}`);
    if (diags.length > 0 && diags.length < 5) {
      console.log(`  Errors:`);
      for (const diag of diags.slice(0, 3)) {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        console.log(`    Line ${diag.file!.getLineAndCharacterOfPosition(diag.start!).line + 1}: ${message}`);
      }
    }
  } else {
    console.log(`Could not find tab pattern for ${tab.name}`);
  }
}
