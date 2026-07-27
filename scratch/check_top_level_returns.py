import os
import re

pages_dir = r"c:\Users\USER\Desktop\assign\spark-beginnings\src\pages"

hook_pattern = re.compile(r'\b(use[A-Z]\w*)\s*\(')

for fname in sorted(os.listdir(pages_dir)):
    if not fname.endswith('.tsx'):
        continue
    fpath = os.path.join(pages_dir, fname)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    # Track hooks outside of callbacks/functions vs early returns
    # We want top-level component hooks vs top-level returns
    component_name = None
    component_start = -1
    hooks = []
    returns = []
    
    for idx, line in enumerate(lines, 1):
        m = re.search(r'export function ([A-Z]\w*)|export default function ([A-Z]\w*)', line)
        if m:
            component_name = m.group(1) or m.group(2)
            component_start = idx
            hooks = []
            returns = []
        
        if component_name:
            # Check for top level return
            if re.search(r'^\s*if\s*\(.*?\)\s*(?:return|\{\s*return)', line):
                returns.append((idx, line.strip()))
            elif hook_pattern.search(line) and not 'export function use' in line:
                h = hook_pattern.search(line).group(1)
                hooks.append((idx, h, line.strip()))

            # Check if function ended
            if line.startswith('}') and idx > component_start + 10:
                # Analyze if any return happened before subsequent hooks
                for r_idx, r_line in returns:
                    sub_hooks = [h for h in hooks if h[0] > r_idx]
                    if sub_hooks:
                        print(f"CRITICAL BUG in {fname} ({component_name}):")
                        print(f"  Line {r_idx}: {r_line}")
                        print(f"  --> Followed by {len(sub_hooks)} hooks! First hook at Line {sub_hooks[0][0]}: {sub_hooks[0][2]}")
                component_name = None
