import re
import sys

file_path = 'src/pages/FinancialReports.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the parts
filter_start = content.find('{/* ── Filter bar: flush full-width sticky strip right under header ── */}')
tabs_start = content.find('{/* Tab switcher - compact implementation */}')
tabs_end = content.find('{mainTab === \'site-summary\' ? (')

if filter_start == -1 or tabs_start == -1 or tabs_end == -1:
    print("Could not find markers")
    sys.exit(1)

# The tabs_end should be just before the {mainTab ...
# Let's find the closing div of the tabs section before tabs_end
tabs_end_actual = content.rfind('</div>', tabs_start, tabs_end) + 6

filter_block = content[filter_start:tabs_start]
tabs_block = content[tabs_start:tabs_end_actual]

# Add some margin to the tabs block
tabs_block = tabs_block.replace('<div className="flex bg-white p-2 rounded-xl', '<div className="flex bg-white p-2 mb-2 rounded-xl')

# Reorder
new_content = content[:filter_start] + tabs_block + '\n\n        ' + filter_block + content[tabs_end_actual:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Swapped successfully")
