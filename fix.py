with open('src/pages/FinancialReports.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("\\'\\'", "''")
text = text.replace("\\'Paid\\'", "'Paid'")

with open('src/pages/FinancialReports.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
