with open('src/pages/FinancialReports.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('["Payment ID", "Client",', '["Client",')
text = text.replace('[["Payment ID", "Client",', '[["Client",')

with open('src/pages/FinancialReports.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
