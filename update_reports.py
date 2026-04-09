import re

with open('src/pages/FinancialReports.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove ID from exportInvoiceReport
# Before: headers = ['ID', 'Client', 'Site', 'Date', 'Amount', 'Status'];
# After: headers = ['Client', 'Site', 'Date', 'Amount', 'Status'];
code = code.replace("headers = ['ID', 'Client', 'Site', 'Date', 'Amount', 'Status'];", "headers = ['Client', 'Site', 'Date', 'Amount', 'Status'];")
code = code.replace("headers = ['ID', 'Invoice Number', 'Client', 'Site', 'Project', 'Amount', 'Date', 'Due Date', 'Status', 'Billing Cycle', 'Duration', 'Machines', 'VAT Inc', 'Total Charge'];", "headers = ['Invoice Number', 'Client', 'Site', 'Project', 'Amount', 'Date', 'Due Date', 'Status', 'Billing Cycle', 'Duration', 'Machines', 'VAT Inc', 'Total Charge'];")
code = re.sub(r'data = \[\s*inv\.id,\s*inv\.client,\s*inv\.siteName,\s*formatDisplayDate\(inv\.date\),\s*inv\.amount,\s*inv\.status\s*\];', r'data = [\n          inv.client,\n          inv.siteName,\n          formatDisplayDate(inv.date),\n          inv.amount,\n          inv.status\n        ];', code)
code = re.sub(r'data = \[\s*inv\.id,\s*inv\.invoiceNumber,\s*inv\.client,\s*inv\.siteName \|\| \'\',\s*inv\.project \|\| \'\',\s*inv\.amount,\s*formatDisplayDate\(inv\.date\),\s*formatDisplayDate\(inv\.dueDate\) \|\| \'\',\s*inv\.status,\s*inv\.billingCycle \|\| \'\',\s*inv\.duration \|\| \'\',\s*inv\.noOfMachine \|\| \'\',\s*inv\.vatInc \|\| \'\',\s*inv\.totalCharge \|\| \'\'\s*\];', r'data = [\n          inv.invoiceNumber,\n          inv.client,\n          inv.siteName || \'\',\n          inv.project || \'\',\n          inv.amount,\n          formatDisplayDate(inv.date),\n          formatDisplayDate(inv.dueDate) || \'\',\n          inv.status,\n          inv.billingCycle || \'\',\n          inv.duration || \'\',\n          inv.noOfMachine || \'\',\n          inv.vatInc || \'\',\n          inv.totalCharge || \'\'\n        ];', code)

# Payment exports
# Before: const head = [['ID', 'Client', 'Site', 'Date', 'Amount', 'WHT', 'VAT', 'Discount']];
code = code.replace("const head = [['ID', 'Client', 'Site', 'Date', 'Amount', 'WHT', 'VAT', 'Discount']];", "const head = [['Client', 'Site', 'Date', 'Amount', 'WHT', 'VAT', 'Discount']];")
code = code.replace("const headers = ['ID', 'Client', 'Site', 'Date', 'Amount', 'WHT', 'VAT', 'Discount', 'Status'];", "const headers = ['Client', 'Site', 'Date', 'Amount', 'WHT', 'VAT', 'Discount', 'Status'];")
code = re.sub(r'body\.push\(\[inv\.id, ', r'body.push([', code)
code = re.sub(r'body\.push\(\[p\.id, ', r'body.push([', code)
code = code.replace("p.id,", "")

# Preview modal Invoice Summary
code = re.sub(r'const data = invoices\.map\(i => \(\{ ID: i\.id, Client: i\.client', r'const data = invoices.map(i => ({ Client: i.client', code)

# Preview modal Payment Summary
code = re.sub(r'const data = payments\.map\(p => \(\{ ID: p\.id, Client: p\.client', r'const data = payments.map(p => ({ Client: p.client', code)

# Preview modal Overdue Invoices
code = re.sub(r'const data = rawInvoices\.filter[\s\S]*?map\(i => \(\{ ID: i\.id, Client: i\.client', r'const data = rawInvoices.filter(i => i.status !== \'Paid\' && i.dueDate && i.dueDate < today).map(i => ({ Client: i.client', code)

# Preview modal VAT
code = re.sub(r'const data = vatPayments\.map\(v => \(\{ ID: v\.id, Client: v\.client', r'const data = vatPayments.map(v => ({ Client: v.client', code)

# Edit filteredLedger Client filtering
code = re.sub(
r"""if \(filterMonth !== 'All'\) \{
               const d = new Date\(e\.date\);
               if \(!isNaN\(d\.getTime\(\)\) && String\(d\.getMonth\(\) \+ 1\) !== filterMonth\) return false;
            \}""",
r"""if (filterMonth !== 'All') {
               const d = new Date(e.date);
               if (!isNaN(d.getTime()) && String(d.getMonth() + 1) !== filterMonth) return false;
            }
            if (filterClient !== 'All') {
               // Determine client for ledger entry
               let entryClient = '';
               if (ledgerSummaryView === 'site') {
                 entryClient = sites.find(s => s.name === e.site)?.client || '';
               } else if (ledgerSummaryView === 'client') {
                 entryClient = e.client || '';
               }
               if (entryClient !== filterClient) return false;
            }""", code)

with open('src/pages/FinancialReports.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("FinancialReports.tsx updated successfully.")
