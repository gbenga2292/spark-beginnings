const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const tempDir = path.join(__dirname, '.temp_fresh_start', 'src');

function fixFile(srcPath, relativePathToTemp) {
    if (!fs.existsSync(srcPath)) return;
    
    const isEmployeeOrLedgerOrAccounting = srcPath.includes('Employee') || srcPath.includes('Disciplinary') || srcPath.includes('Ledger') || srcPath.includes('ClientAccounts');
    if (isEmployeeOrLedgerOrAccounting) return; // Prevent corrupting existing app files
    
    // Check if it's actually part of the Task manager UI
    const isTaskFile = srcPath.includes('Task') || srcPath.includes('tasks') || srcPath.includes('task_ui');
    if (!isTaskFile) return;

    let content = '';
    const tempPath = path.join(tempDir, relativePathToTemp);
    if (fs.existsSync(tempPath)) {
        content = fs.readFileSync(tempPath, 'utf8');
    } else {
        content = fs.readFileSync(srcPath, 'utf8');
    }

    let changed = content;

    // Fix imports
    changed = changed.replace(/['"]@\/contexts\/AuthContext['"]/g, "'@/src/hooks/useAuth'");
    changed = changed.replace(/['"]@\/contexts\/AppDataContext['"]/g, "'@/src/contexts/AppDataContext'");
    changed = changed.replace(/['"]@\/hooks\/use-workspace['"]/g, "'@/src/hooks/use-workspace'");

    // Base imports
    changed = changed.replace(/(['"])@\/(components|lib|types|hooks)\//g, (m, quote, prefix) => `${quote}@/src/${prefix}/`);
    changed = changed.replace(/(['"])@\/types(['"])/g, "$1@/src/types/tasks$2");
    
    changed = changed.replace(/@\/src\/components\/ui\//g, "@/src/components/task_ui/");
    
    // Remove CreateProjectDialog from Tasks
    if (srcPath.endsWith('Tasks.tsx') || srcPath.endsWith('Tasks.ts')) {
        changed = changed.replace(/import\s+CreateProjectDialog\s+from[^;]+;/g, "");
        changed = changed.replace(/<CreateProjectDialog[^>]*\/>/g, "");
    }
    
    // Fix currentUser destructuring
    changed = changed.replace(/const\s+\{\s*currentUser\s*\}\s*=\s*useAuth\(\);/g, "const { user: currentUser } = useAuth();");

    // Fix TS Errors for Task type
    if (srcPath.endsWith('CreateTaskDialog.tsx')) {
        changed = changed.replace(/import \{ SubTask, MainTask \} from '@\/src\/types\/tasks';/g, "import { SubTask, MainTask } from '@/src/types/tasks/task';");
        // in case my regex replaced @/src/types/tasks blindly
        changed = changed.replace(/import\s+\{([^}]+)\}\s+from\s+['"]@\/src\/types\/tasks\/task['"]/g, "import type { $1 } from '@/src/types/tasks/task'");
    }

    fs.writeFileSync(srcPath, changed, 'utf8');
}

function walk(dir, relPathResolver) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, (f) => relPathResolver(fullPath, f));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const relTemp = relPathResolver(dir, file);
            fixFile(fullPath, relTemp);
        }
    }
}

walk(path.join(srcDir, 'components', 'tasks'), (d, f) => path.join('components', 'tasks', f));
walk(path.join(srcDir, 'components', 'task_ui'), (d, f) => path.join('components', 'ui', f));
walk(path.join(srcDir, 'pages'), (d, f) => path.join('pages', f));
walk(path.join(srcDir, 'types', 'tasks'), (d, f) => path.join('types', f));
