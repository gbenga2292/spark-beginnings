import os
import re

src_dir = r"c:\Users\USER\Desktop\assign\spark-beginnings\src"

hook_regex = re.compile(r'\b(use[A-Z]\w*)\s*\(')

findings = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            # Find hooks and early returns per function component
            func_name = None
            hook_lines = []
            early_return_lines = []
            
            for idx, line in enumerate(lines, 1):
                m = re.search(r'(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)|const\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo|forwardRef)?\(', line)
                if m:
                    # Check previous function
                    if func_name and early_return_lines and hook_lines:
                        for er_line in early_return_lines:
                            subsequent_hooks = [h for h in hook_lines if h[0] > er_line]
                            if subsequent_hooks:
                                findings.append((path, er_line, func_name, subsequent_hooks))
                    
                    func_name = m.group(1) or m.group(2)
                    hook_lines = []
                    early_return_lines = []
                
                # Exclude hook declarations themselves
                if hook_regex.search(line) and not 'export function use' in line and not 'function use' in line:
                    h_name = hook_regex.search(line).group(1)
                    hook_lines.append((idx, h_name))
                
                # Look for early returns (if (...) return)
                if re.search(r'^\s*if\s*\(.*?\)\s*return\b', line):
                    early_return_lines.append(idx)

            if func_name and early_return_lines and hook_lines:
                for er_line in early_return_lines:
                    subsequent_hooks = [h for h in hook_lines if h[0] > er_line]
                    if subsequent_hooks:
                        findings.append((path, er_line, func_name, subsequent_hooks))

for path, er_line, func, hooks in findings:
    rel_path = os.path.relpath(path, src_dir)
    print(f"FILE: {rel_path} | Line {er_line} in {func} early returns before {len(hooks)} hooks (e.g. Line {hooks[0][0]}: {hooks[0][1]})")
