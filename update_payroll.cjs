const fs = require('fs');

const path = './src/pages/Payroll.tsx';
let d = fs.readFileSync(path, 'utf8');

// 1. Add employeeCode to PayrollRecord
d = d.replace(/id: string;\s+sn: number;/g, 'id: string;\n  employeeCode?: string;\n  sn: number;');

// 2. Add employeeCode: emp.employeeCode to calculatePayrollForMonth output
d = d.replace(/id: emp\.id,\s+sn: snCounter\+\+,/g, 'id: emp.id,\n            employeeCode: emp.employeeCode,\n            sn: snCounter++,');

// 3. Update the state hooks to add printSelectedColumns
d = d.replace(/const \[printSelectedDepts, setPrintSelectedDepts\] = useState<string\[\]>\(\[\]\);/g, 
`const [printSelectedDepts, setPrintSelectedDepts] = useState<string[]>([]);\n  const [printSelectedColumns, setPrintSelectedColumns] = useState<string[]>([]);`);

// 4. Constants for columns (add right after monthValues const or nearby)
const columnsConsts = `
  const AVAILABLE_COLUMNS = [
    { id: 'sn', label: 'S/N' },
    { id: 'employee_name', label: 'Employee Name' },
    { id: 'month', label: 'Month' },
    { id: 'bank_name', label: 'Bank Name' },
    { id: 'account_number', label: 'Account No' },
    { id: 'basic', label: 'Basic Salary' },
    { id: 'housing', label: 'Housing' },
    { id: 'transport', label: 'Transport' },
    { id: 'other', label: 'Other Allowances' },
    { id: 'gross', label: 'Gross Pay' },
    { id: 'paye', label: 'PAYE Tax' },
    { id: 'pensionable', label: 'Pensionable Sum' },
    { id: 'employee_pension', label: 'Employee Pension' },
    { id: 'employer_pension', label: 'Employer Pension' },
    { id: 'total_pension', label: 'Total Pension' },
    { id: 'nsitf_rate', label: 'NSITF Ratio' },
    { id: 'nsitf_amount', label: 'NSITF Amount' }
  ];

  const DEFAULT_COLUMNS: Record<string, string[]> = {
    PAYE: ['sn', 'employee_name', 'month', 'basic', 'housing', 'transport', 'other', 'gross', 'paye'],
    PENSION: ['sn', 'employee_name', 'month', 'pensionable', 'employee_pension', 'employer_pension', 'total_pension'],
    NSITF: ['sn', 'employee_name', 'month', 'gross', 'nsitf_rate', 'nsitf_amount']
  };
`;
d = d.replace(/const months = \[\n/, columnsConsts + '\n  const months = [\n');

// 5. Update handleOpenPrintDialog to set default columns and modal open
d = d.replace(/const handleOpenPrintDialog = \(type:.*\n\s+setPrintSelectedMonths.*\n\s+setPrintSelectedEmployees.*\n\s+setPrintType\(type\);\n\s+\};/g, 
`const handleOpenPrintDialog = (type: 'PAYSLIPS' | 'PAYE' | 'PENSION' | 'NSITF') => {
      setPrintSelectedMonths([selectedMonth]);
      setPrintSelectedEmployees([]);
      setPrintType(type);
      setPrintDialogOpen(true);
      setPrintSelectedColumns(DEFAULT_COLUMNS[type] || []);
    };`);

// 6. Update Employee ID rendering in Payslip HTML string
d = d.replace(/<tr><td>ID:<\/td><td>\$\{slip\.record\.id\}<\/td><\/tr>/g, '<tr><td>ID:</td><td>${slip.record.employeeCode || slip.record.id}</td></tr>');

// 7. Update the Print Schedule button in payroll processing tab
const oldButtonHtml = `{priv.canGenerate && (
                  <div className="flex gap-2 relative group">
                    <Button onClick={() => handleOpenPrintDialog('PAYSLIPS')} variant="outline" className="gap-2 shrink-0 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                      <Printer className="h-4 w-4" />
                      Print Schedule
                    </Button>
                    <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 flex flex-col gap-1 w-full pt-1">
                      {priv.canViewPayeSchedule && (
                        <Button onClick={() => handleOpenPrintDialog('PAYE')} variant="outline" className="gap-2 w-full justify-start shadow-md bg-white border border-slate-200">
                          <FileText className="h-4 w-4 text-rose-500" /> PAYE Schedule
                        </Button>
                      )}
                      {priv.canViewPensionSchedule && (
                        <Button onClick={() => handleOpenPrintDialog('PENSION')} variant="outline" className="gap-2 w-full justify-start shadow-md bg-white border border-slate-200">
                          <FileText className="h-4 w-4 text-emerald-500" /> Pension Schedule
                        </Button>
                      )}
                      {priv.canViewNsitfSchedule && (
                        <Button onClick={() => handleOpenPrintDialog('NSITF')} variant="outline" className="gap-2 w-full justify-start shadow-md bg-white border border-slate-200">
                          <FileText className="h-4 w-4 text-blue-500" /> NSITF Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                )}`;
const newButtonHtml = `{priv.canGenerate && (
                    <Button variant="outline" size="sm" className="gap-2 shrink-0 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => handleOpenPrintDialog('PAYSLIPS')}>
                      <Printer className="h-4 w-4" /> Print Schedule
                    </Button>
                )}`;
// fallback using RegExp if exact match is tricky
d = d.replace(/\{priv\.canGenerate && \(\s*<div className="flex gap-2 relative group">[\s\S]*?<\/div>\s*\)\}/g, newButtonHtml);

// 8. Update Month checkboxes in modal
const oldMonthsSelect = `<div className="space-y-2 mt-2">
                      {months.map(m => (
                        <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600"
                            checked={printSelectedMonths.includes(m.key)}
                            onChange={(e) => {
                              if (e.target.checked) setPrintSelectedMonths([...printSelectedMonths, m.key]);
                              else setPrintSelectedMonths(printSelectedMonths.filter(k => k !== m.key));
                            }}
                          />
                          {m.label}
                        </label>
                      ))}
                    </div>`;
const newMonthsSelect = `
                    <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                      Select Months
                      <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedMonths(printSelectedMonths.length === months.length ? [] : months.map(m => m.key))}>
                        {printSelectedMonths.length === months.length ? 'Clear' : 'Select All'}
                      </button>
                    </h4>
                    <div className="space-y-2 mt-2 grid grid-cols-2 max-h-[120px] overflow-y-auto">
                      {months.map(m => (
                        <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600"
                            checked={printSelectedMonths.includes(m.key)}
                            onChange={(e) => {
                              if (e.target.checked) setPrintSelectedMonths([...printSelectedMonths, m.key]);
                              else setPrintSelectedMonths(printSelectedMonths.filter(k => k !== m.key));
                            }}
                          />
                          {m.label}
                        </label>
                      ))}
                    </div>`;
d = d.replace(/<h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1">Select Months<\/h4>\s*<div className="space-y-2 mt-2">[\s\S]*?<\/div>/g, newMonthsSelect);

// 9. Update Department checkboxes to include select all/none and grid layout
const oldDeptHeader = `<h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                      Filter by Department
                      <button
                        className="text-xs text-indigo-600 font-medium hover:underline"
                        onClick={() => { setPrintSelectedDepts([]); setPrintSelectedEmployees([]); }}
                      >
                        Clear
                      </button>
                    </h4>`;
const newDeptHeader = `<h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                      Filter by Department
                      <button
                        className="text-xs text-indigo-600 font-medium hover:underline"
                        onClick={() => {
                          const allDepts = [...new Set(employees.filter(e => e.status === 'Active').map(e => e.department).filter(Boolean))].sort();
                          if (printSelectedDepts.length === allDepts.length) {
                             setPrintSelectedDepts([]);
                             setPrintSelectedEmployees([]);
                          } else {
                             setPrintSelectedDepts(allDepts);
                             setPrintSelectedEmployees(employees.filter(e => e.status === 'Active' && allDepts.includes(e.department)).map(e => e.id));
                          }
                        }}
                      >
                        {printSelectedDepts.length === [...new Set(employees.filter(e => e.status === 'Active').map(e => e.department).filter(Boolean))].sort().length ? 'Clear' : 'Select All'}
                      </button>
                    </h4>`;
d = d.replace(oldDeptHeader, newDeptHeader);
d = d.replace(/<div className="space-y-2 mt-2">(\s*\{\[\.\.\.new Set\(employees\.filter\(e => e\.status === 'Active'\)\.map\(e => e\.department\)\.filter\(Boolean\)\)\]\.sort\(\)\.map\(dept => \([\s\S]*?\}\)\s*)<\/div>/g, 
  '<div className="space-y-2 mt-2 max-h-[120px] overflow-y-auto grid grid-cols-2">$1</div>');

// 10. Update Employees list header
const oldEmpHeader = `<h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                      Select Employees
                      <button
                        className="text-xs text-indigo-600 font-medium hover:underline"
                        onClick={() => setPrintSelectedEmployees([])}
                      >
                        Select All
                      </button>
                    </h4>`;
const newEmpHeader = `<h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                      Select Employees
                      <button
                        className="text-xs text-indigo-600 font-medium hover:underline"
                        onClick={() => {
                           const activeEmpIds = employees.filter(e => e.status === 'Active').map(e => e.id);
                           if (printSelectedEmployees.length === activeEmpIds.length) {
                             setPrintSelectedEmployees([]);
                           } else {
                             setPrintSelectedEmployees(activeEmpIds);
                           }
                        }}
                      >
                        {printSelectedEmployees.length === employees.filter(e => e.status === 'Active').length ? 'Clear' : 'Select All'}
                      </button>
                    </h4>`;
d = d.replace(oldEmpHeader, newEmpHeader);

// 11. Add Columns to Include section right after Employees list
const columnsSectionHtml = `
                  {printType !== 'PAYSLIPS' && (
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                        Columns to Include
                        <button
                          className="text-xs text-indigo-600 font-medium hover:underline"
                          onClick={() => setPrintSelectedColumns(printSelectedColumns.length === AVAILABLE_COLUMNS.length ? [] : AVAILABLE_COLUMNS.map(c => c.id))}
                        >
                          {printSelectedColumns.length === AVAILABLE_COLUMNS.length ? 'Clear' : 'Select All'}
                        </button>
                      </h4>
                      <div className="space-y-2 mt-2 max-h-[150px] overflow-y-auto pr-2 grid grid-cols-2">
                        {AVAILABLE_COLUMNS.map((col) => (
                          <label key={col.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600"
                              checked={printSelectedColumns.includes(col.id)}
                              onChange={(e) => {
                                if (e.target.checked) setPrintSelectedColumns([...printSelectedColumns, col.id]);
                                else setPrintSelectedColumns(printSelectedColumns.filter(id => id !== col.id));
                              }}
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
`;
// Insert right after the Employee div which closes before "<!-- Preview Area -->"
d = d.replace(/(<\/div>\s*)({\/\* Preview Area \*\/})/g, `</div>\n                  ${columnsSectionHtml}\n                $2`);

// 12. Fix the Employee ID in the Preview pane React
d = d.replace(/<tr><td className="py-1 text-slate-600">Employee ID:<\/td><td className="py-1 font-mono">\{slip\.record\.id\}<\/td><\/tr>/g, 
  '<tr><td className="py-1 text-slate-600">Employee ID:</td><td className="py-1 font-mono">{slip.record.employeeCode || slip.record.id}</td></tr>');

// 13. Dynamic Columns rendering
// thead replacement
const oldTheadPattern = /<tr className="text-left bg-slate-50 border-b-2">[\s\S]*?<\/tr>/g;
const newThead = `<tr className="text-left bg-slate-50 border-b-2">
                            {printSelectedColumns.includes('sn') && <th className="py-3 px-2 text-slate-600">S/N</th>}
                            {printSelectedColumns.includes('employee_name') && <th className="py-3 px-2 text-slate-600">Employee Name</th>}
                            {printSelectedColumns.includes('month') && <th className="py-3 px-2 text-slate-600">Month</th>}
                            {printSelectedColumns.includes('bank_name') && <th className="py-3 px-2 text-slate-600">Bank</th>}
                            {printSelectedColumns.includes('account_number') && <th className="py-3 px-2 text-slate-600">Account No.</th>}
                            {printType === 'PAYE' ? (
                              <>
                                {printSelectedColumns.includes('basic') && <th className="py-3 px-2 text-right text-slate-600">Basic (₦)</th>}
                                {printSelectedColumns.includes('housing') && <th className="py-3 px-2 text-right text-slate-600">Housing (₦)</th>}
                                {printSelectedColumns.includes('transport') && <th className="py-3 px-2 text-right text-slate-600">Transport (₦)</th>}
                                {printSelectedColumns.includes('other') && <th className="py-3 px-2 text-right text-slate-600">Other (₦)</th>}
                                {printSelectedColumns.includes('gross') && <th className="py-3 px-2 text-right text-slate-600">Gross Pay (₦)</th>}
                                {printSelectedColumns.includes('paye') && <th className="py-3 px-2 text-right text-slate-600">PAYE Deducted (₦)</th>}
                              </>
                            ) : printType === 'PENSION' ? (
                              <>
                                {printSelectedColumns.includes('pensionable') && <th className="py-3 px-2 text-right text-slate-600">Pensionable Sum (₦)</th>}
                                {printSelectedColumns.includes('employee_pension') && <th className="py-3 px-2 text-right text-slate-600">Employee (₦)</th>}
                                {printSelectedColumns.includes('employer_pension') && <th className="py-3 px-2 text-right text-slate-600">Employer (₦)</th>}
                                {printSelectedColumns.includes('total_pension') && <th className="py-3 px-2 text-right font-bold text-slate-800">Total (₦)</th>}
                              </>
                            ) : (
                              <>
                                {printSelectedColumns.includes('gross') && <th className="py-3 px-2 text-right text-slate-600">Gross Pay (₦)</th>}
                                {printSelectedColumns.includes('nsitf_rate') && <th className="py-3 px-2 text-right text-slate-600">NSITF Ratio (%)</th>}
                                {printSelectedColumns.includes('nsitf_amount') && <th className="py-3 px-2 text-right font-bold text-slate-800">Amount (₦)</th>}
                              </>
                            )}
                          </tr>`;
d = d.replace(oldTheadPattern, newThead);

// tbody replacement
const tbodyRegex = /<tbody className="divide-y divide-slate-100">[\s\S]*?<\/tbody>/;
const newTbody = `<tbody className="divide-y divide-slate-100">
                          {payslipsToPrint
                            .filter(slip => printType === 'PAYE'
                              ? (slip.record.staffType === 'INTERNAL' && !slip.record.department.trim().toLowerCase().includes('adhoc'))
                              : printType === 'PENSION'
                                ? (slip.record.staffType === 'INTERNAL' && !slip.record.department.trim().toLowerCase().includes('adhoc'))
                                : (slip.record.nsitf > 0 && !slip.record.department.trim().toLowerCase().includes('adhoc')))
                            .map((slip, idx) => {
                              const pSum = slip.record.basicSalary + slip.record.housing + slip.record.transport;
                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  {printSelectedColumns.includes('sn') && <td className="py-2.5 px-2">{idx + 1}</td>}
                                  {printSelectedColumns.includes('employee_name') && <td className="py-2.5 px-2 font-medium">{slip.record.surname} {slip.record.firstname}</td>}
                                  {printSelectedColumns.includes('month') && <td className="py-2.5 px-2 text-slate-500">{slip.monthLabel}</td>}
                                  {printSelectedColumns.includes('bank_name') && <td className="py-2.5 px-2">{slip.record.bankName}</td>}
                                  {printSelectedColumns.includes('account_number') && <td className="py-2.5 px-2 font-mono">{slip.record.accountNo}</td>}
                                  {printType === 'PAYE' ? (
                                    <>
                                      {printSelectedColumns.includes('basic') && <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.basicSalary)}</td>}
                                      {printSelectedColumns.includes('housing') && <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.housing)}</td>}
                                      {printSelectedColumns.includes('transport') && <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.transport)}</td>}
                                      {printSelectedColumns.includes('other') && <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.otherAllowances)}</td>}
                                      {printSelectedColumns.includes('gross') && <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.grossPay)}</td>}
                                      {printSelectedColumns.includes('paye') && <td className="py-2.5 px-2 text-right font-mono font-bold text-red-600">{fm(slip.record.paye)}</td>}
                                    </>
                                  ) : printType === 'PENSION' ? (
                                    <>
                                      {printSelectedColumns.includes('pensionable') && <td className="py-2.5 px-2 text-right font-mono">{fm(pSum)}</td>}
                                      {printSelectedColumns.includes('employee_pension') && <td className="py-2.5 px-2 text-right font-mono text-amber-600">{fm(slip.record.pension)}</td>}
                                      {printSelectedColumns.includes('employer_pension') && <td className="py-2.5 px-2 text-right font-mono text-indigo-600">{fm(slip.record.employerPension)}</td>}
                                      {printSelectedColumns.includes('total_pension') && <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">{fm(slip.record.pension + slip.record.employerPension)}</td>}
                                    </>
                                  ) : (
                                    <>
                                      {printSelectedColumns.includes('gross') && <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.grossPay)}</td>}
                                      {printSelectedColumns.includes('nsitf_rate') && <td className="py-2.5 px-2 text-right font-mono text-slate-500">{payrollVariables.nsitfRate}%</td>}
                                      {printSelectedColumns.includes('nsitf_amount') && <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">{fm(slip.record.nsitf)}</td>}
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>`;
d = d.replace(tbodyRegex, newTbody);

fs.writeFileSync(path, d);
console.log("Done");
