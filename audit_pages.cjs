const fs = require('fs');
const path = require('path');
const pages = ['SalaryLoans', 'FinancialReports', 'Reports', 'VatPayments', 'Variables', 'ClientSummary', 'LeaveSummary', 'Dashboard'];
const dir = 'src/pages';
const out = [];
pages.forEach(p => {
  const file = path.join(dir, p + '.tsx');
  if (!fs.existsSync(file)) { out.push(p + ': FILE NOT FOUND'); return; }
  const c = fs.readFileSync(file, 'utf8');
  const hasUsePriv = c.includes('usePriv');
  const privUsed = c.includes('priv.');
  const addBtn = (c.match(/handleAdd|canAdd|canCreate|setShowForm|setIsModalOpen|setIsAdding/g) || []).length;
  const editBtn = (c.match(/handleEdit|canEdit/g) || []).length;
  const deleteBtn = (c.match(/handleDelete|canDelete/g) || []).length;
  out.push(p + ': usePriv=' + hasUsePriv + ' privUsed=' + privUsed + ' add=' + addBtn + ' edit=' + editBtn + ' del=' + deleteBtn);
});
fs.writeFileSync('audit_result.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
