import re

with open('src/pages/FinancialReports.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix VAT export Report
text = text.replace('const headers = ["VAT ID", "Client", "Date", "Month", "Year", "Amount"];', 'const headers = ["Client", "Date", "Month", "Year", "Amount"];')
text = text.replace('const data = vatPayments.map(v => [v.id, v.client', 'const data = vatPayments.map(v => [v.client')

# Let's also check for any VAT PDF exports
text = text.replace('const head = [["VAT ID", "Client", "Date", "Month", "Year", "Amount"]];', 'const head = [["Client", "Date", "Month", "Year", "Amount"]];')
text = text.replace('const body = vatPayments.map(v => [v.id, v.client', 'const body = vatPayments.map(v => [v.client')
text = text.replace('const body = vatPayments.map(v => [ v.id, v.client', 'const body = vatPayments.map(v => [ v.client')

# Also check for previewModal for VAT
text = text.replace('const data = vatPayments.map(v => ({ "VAT ID": v.id, Client: v.client', 'const data = vatPayments.map(v => ({ Client: v.client')

with open('src/pages/FinancialReports.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
