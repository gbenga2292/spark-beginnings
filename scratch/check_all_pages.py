import os
import re

pages_dir = r"c:\Users\USER\Desktop\assign\spark-beginnings\src\pages"

hook_pattern = re.compile(r'\b(use[A-Z]\w*)\s*\(')

for fname in sorted(os.listdir(pages_dir)):
    if fname.endswith('.tsx'):
        fpath = os.path.join(pages_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Check line by line for return vs hook
        hook_lines = []
        return_lines = []
        for idx, line in enumerate(lines, 1):
            if hook_pattern.search(line) and not 'export function use' in line and not 'function use' in line:
                hook_name = hook_pattern.search(line).group(1)
                hook_lines.append((idx, hook_name))
            if re.search(r'^\s*if\s*\(.*?\)\s*return\b|^\s*if\s*\(.*?\)\s*\{\s*return\b', line):
                return_lines.append(idx)
        
        # Check if any return_line is less than max(hook_lines)
        if hook_lines and return_lines:
            first_ret = return_lines[0]
            last_hook = hook_lines[-1]
            if first_ret < last_hook[0]:
                hooks_after = [h for h in hook_lines if h[0] > first_ret]
                print(f"[{fname}] Early return at line {first_ret} BEFORE hook {hooks_after[0][1]} at line {hooks_after[0][0]} (total {len(hooks_after)} hooks after return)")
