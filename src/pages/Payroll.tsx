import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Input } from '@/src/components/ui/input';
import { Download, FileText, Calculator, CreditCard, ChevronDown, X, Printer } from 'lucide-react';
import { useAppStore, Employee } from '@/src/store/appStore';
import { SalaryLoans } from './SalaryLoans';
import { computeWorkDays, MONTH_INDEX } from '@/src/lib/workdays';
import logoSrc from '../../logo/logo-2.png';

interface PayrollRecord {
  id: string;
  sn: number;
  surname: string;
  firstname: string;
  position: string;
  department: string;
  bankName: string;
  accountNo: string;
  salary: number;
  basicSalary: number;
  housing: number;
  transport: number;
  otherAllowances: number;
  totalAllowances: number;
  overtime: number;
  grossPay: number;
  paye: number;
  loanRepayment: number;
  pension: number;
  takeHomePay: number;
  status: 'Pending' | 'Processed';
}



export function Payroll() {
  const [activeTab, setActiveTab] = useState('processing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSelectedMonths, setPrintSelectedMonths] = useState<string[]>([]);
  const [printSelectedEmployees, setPrintSelectedEmployees] = useState<string[]>([]);

  const employees = useAppStore((state) => state.employees);
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const payeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const monthValues = useAppStore((state) => state.monthValues);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const [selectedMonth, setSelectedMonth] = useState('jan');

  // OPERATIONS departments – purely attendance-based pay
  const OPERATIONS_DEPARTMENTS = ['HEAD OF OPERATIONS', 'ENGINEERING'];

  const months = [
    { key: 'jan', label: 'January' },
    { key: 'feb', label: 'February' },
    { key: 'mar', label: 'March' },
    { key: 'apr', label: 'April' },
    { key: 'may', label: 'May' },
    { key: 'jun', label: 'June' },
    { key: 'jul', label: 'July' },
    { key: 'aug', label: 'August' },
    { key: 'sep', label: 'September' },
    { key: 'oct', label: 'October' },
    { key: 'nov', label: 'November' },
    { key: 'dec', label: 'December' },
  ];

  const currentYear = new Date().getFullYear();

  // Calculate payroll logic extracted for multi-month generation capabilities
  const calculatePayrollForMonth = useCallback((monthKey: string) => {
    const mKey = monthKey as keyof typeof employees[0]['monthlySalaries'];
    const selectedMonthIndex = months.findIndex(m => m.key === monthKey) + 1;

    // Auto-compute workdays for this month from public holidays
    const holidayDates = publicHolidays.map(h => h.date);
    const officialWorkdays = computeWorkDays(currentYear, selectedMonthIndex, holidayDates);

    const monthConfig = monthValues[mKey as keyof typeof monthValues] || { workDays: officialWorkdays, overtimeRate: 0.5 };
    const otRate = monthConfig.overtimeRate;

    let snCounter = 1;

    return employees
      .filter(e => e.status === 'Active')
      .map((emp) => {
        const standardSalary = emp.monthlySalaries[mKey] || 0;

        // ── Attendance tallies ────────────────────────────────────────────
        let daysWorked = 0; // days where day === 'Yes'
        let daysAbsent = 0; // days where attendance record exists AND day === 'No'
        let totalOTInstances = 0;

        for (const r of attendanceRecords) {
          if (r.staffId === emp.id && r.mth === selectedMonthIndex) {
            if (r.day?.toLowerCase() === 'yes') {
              daysWorked += 1;
              if (r.ot > 0) totalOTInstances += 1;
            } else if (r.day?.toLowerCase() === 'no') {
              daysAbsent += 1; // explicit absence recorded
            }
          }
        }

        // Cap daysWorked at the official workdays ceiling
        if (daysWorked > officialWorkdays) daysWorked = officialWorkdays;

        // ── Salary calculation (two-mode) ─────────────────────────────────
        let salary = 0;
        let overtime = 0;

        if (standardSalary > 0 && officialWorkdays > 0) {
          const dailyRate = standardSalary / officialWorkdays;

          const isOperations = OPERATIONS_DEPARTMENTS.includes(emp.department.toUpperCase());

          if (isOperations) {
            // Operations staff: paid only for days actually attended
            salary = dailyRate * daysWorked;
          } else {
            // All other staff: full salary, deduct explicit absent days
            salary = standardSalary - (dailyRate * daysAbsent);
            if (salary < 0) salary = 0;
          }

          // Overtime is always attendance-based for everyone
          overtime = totalOTInstances * (dailyRate * (1 + otRate));
        }

        // Allowances split exactly matching Excel: Basic, Housing, Transport, Other
        // payeTax employees get the breakdown; others get 0
        const basicSalary = emp.payeTax ? salary * (payrollVariables.basic / 100) : 0;
        const housing = emp.payeTax ? salary * (payrollVariables.housing / 100) : 0;
        const transport = emp.payeTax ? salary * (payrollVariables.transport / 100) : 0;
        const otherAllowances = emp.payeTax ? salary * (payrollVariables.otherAllowances / 100) : 0;

        // SUM(Jan[@[Basic Salary]:[Other Allowances]]) — full breakdown total
        const totalAllowances = basicSalary + housing + transport + otherAllowances;

        // pensionSum = SUM(Basic:Transport) — matches Excel: SUM(Jan[@[Basic Salary]:[Transport]])
        const pensionSum = basicSalary + housing + transport;

        // GROSS PAY: SALARY + OVERTIME
        const grossPay = salary + overtime;

        // PENSION deduction (on pensionSum, not totalAllowances)
        const pension = emp.payeTax ? pensionSum * (payrollVariables.pension / 100) : 0;

        // ── PAYE calculation matching Excel formula exactly: ────────────────
        // =IF(payeTax="Yes", NIGERIATAX(salary, SUM(Basic:Transport), overtime, rentRelief),
        //    IF(withholdingTax="Yes", salary * withholdingTaxRate, 0))
        let paye = 0;
        if (emp.payeTax) {
          const tv = payeTaxVariables;
          const annualGross = (salary * 12) + overtime;
          const pensionAmt = (pensionSum * 12) * tv.pensionRate;
          const extraCRA = tv.extraConditions.filter(c => c.enabled).reduce((s, c) => s + c.amount, 0);
          const cra = tv.craBase + payrollVariables.rentRelief + pensionAmt + extraCRA;
          const annualTaxable = Math.max(annualGross - cra, 0);

          // Sort brackets: upTo ascending, null (top bracket) goes last
          const sorted = [...tv.taxBrackets].sort((a, b) => {
            if (a.upTo === null) return 1;
            if (b.upTo === null) return -1;
            return a.upTo - b.upTo;
          });

          // Incremental bracket loop — works for any number of brackets
          let annualTax = 0;
          let prevLimit = 0;
          for (const bracket of sorted) {
            if (annualTaxable <= prevLimit) break;
            const ceiling = bracket.upTo !== null ? bracket.upTo : Infinity;
            const taxable = Math.min(annualTaxable, ceiling) - prevLimit;
            annualTax += taxable * bracket.rate;
            prevLimit = ceiling === Infinity ? annualTaxable : ceiling;
          }

          paye = annualTax / 12;
        } else if (emp.withholdingTax) {
          paye = salary * (payeTaxVariables.withholdingTaxRate ?? 0);
        }

        // LOAN REPAYMENT: Sum of Advances and Monthly Repayments
        const empAdvances = salaryAdvances.filter(a => {
          if (a.employeeId !== emp.id) return false;
          if (a.status !== 'Approved' && a.status !== 'Deducted') return false;
          if (!a.requestDate) return false;
          const dateParts = a.requestDate.split('-');
          const advanceMonth = parseInt(dateParts[1], 10);
          return advanceMonth === selectedMonthIndex;
        });
        const advanceDeduction = empAdvances.reduce((sum, a) => sum + a.amount, 0);

        const empLoans = loans.filter(l => {
          if (l.employeeId !== emp.id) return false;
          if (l.status !== 'Active' && l.status !== 'Completed') return false;
          if (!l.paymentStartDate) return false;
          const dateParts = l.paymentStartDate.split('-');
          const startYear = parseInt(dateParts[0], 10);
          const startMonth = parseInt(dateParts[1], 10);

          const monthsElapsed = (currentYear - startYear) * 12 + (selectedMonthIndex - startMonth);
          return monthsElapsed >= 0 && monthsElapsed < l.duration;
        });
        const loanDeduction = empLoans.reduce((sum, l) => sum + l.monthlyDeduction, 0);

        const loanRepayment = advanceDeduction + loanDeduction;

        // TAKE HOME PAY: GROSS PAY - (PAYE + LOAN REPAYMENT + PENSION)
        const takeHomePay = grossPay - (paye + loanRepayment + pension);

        return {
          id: emp.id,
          sn: snCounter++,
          surname: emp.surname,
          firstname: emp.firstname,
          position: emp.position,
          department: emp.department,
          bankName: emp.bankName,
          accountNo: emp.accountNo,
          salary,
          basicSalary,
          housing,
          transport,
          otherAllowances,
          totalAllowances,
          overtime,
          grossPay,
          paye,
          loanRepayment,
          pension,
          takeHomePay,
          status: 'Pending' as const,
        };
      });
  }, [employees, salaryAdvances, loans, payrollVariables, monthValues, attendanceRecords, months, currentYear]);

  // Derive standard display payload
  const payrollData = useMemo(() => calculatePayrollForMonth(selectedMonth), [calculatePayrollForMonth, selectedMonth]);

  // Derived filtered print dataset
  const payslipsToPrint = useMemo(() => {
    if (!showPrintDialog) return [];
    let slips: Array<{ monthLabel: string, monthKey: string, record: PayrollRecord }> = [];
    const monthsToUse = printSelectedMonths.length > 0 ? printSelectedMonths : [selectedMonth];

    monthsToUse.forEach(mKey => {
      const mLabel = months.find(m => m.key === mKey)?.label || mKey;
      const data = calculatePayrollForMonth(mKey);
      data.forEach(record => {
        if (printSelectedEmployees.length === 0 || printSelectedEmployees.includes(record.id)) {
          slips.push({ monthLabel: mLabel, monthKey: mKey, record });
        }
      });
    });
    return slips;
  }, [showPrintDialog, printSelectedMonths, printSelectedEmployees, calculatePayrollForMonth, selectedMonth, months]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalGross = payrollData.reduce((sum, p) => sum + p.grossPay, 0);
    const totalPAYE = payrollData.reduce((sum, p) => sum + p.paye, 0);
    const totalLoans = payrollData.reduce((sum, p) => sum + p.loanRepayment, 0);
    const totalPension = payrollData.reduce((sum, p) => sum + p.pension, 0);
    const totalDeductions = totalPAYE + totalLoans + totalPension;
    const totalNet = payrollData.reduce((sum, p) => sum + p.takeHomePay, 0);
    return { totalGross, totalPAYE, totalLoans, totalPension, totalDeductions, totalNet, employeeCount: payrollData.length };
  }, [payrollData]);

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const handleOpenPrintDialog = () => {
    setPrintSelectedMonths([selectedMonth]);
    setPrintSelectedEmployees([]);
    setShowPrintDialog(true);
  };

  const handlePrint = () => {
    if (payslipsToPrint.length === 0) return;

    // Build self-contained HTML for every payslip so all appear in one print job
    const currency = (n: number) => '₦' + n.toLocaleString();
    const slipsHtml = payslipsToPrint.map((slip, i) => `
      <div class="payslip${i === payslipsToPrint.length - 1 ? ' last' : ''}">
        <div class="header">
          <img src="${logoSrc}" alt="DCEL Logo" style="height: 48px; width: auto; margin-bottom: 8px;" />
          <p>Employee Payslip &ndash; ${slip.monthLabel} ${currentYear}</p>
        </div>
        <div class="two-col">
          <div>
            <h3>EMPLOYEE DETAILS</h3>
            <table><tbody>
              <tr><td>Name:</td><td><strong>${slip.record.firstname} ${slip.record.surname}</strong></td></tr>
              <tr><td>Employee ID:</td><td>${slip.record.id}</td></tr>
              <tr><td>Position:</td><td>${slip.record.position}</td></tr>
              <tr><td>Department:</td><td>${slip.record.department}</td></tr>
            </tbody></table>
          </div>
          <div>
            <h3>PAYMENT DETAILS</h3>
            <table><tbody>
              <tr><td>Pay Period:</td><td><strong>${slip.monthLabel}</strong></td></tr>
              <tr><td>Bank:</td><td>${slip.record.bankName}</td></tr>
              <tr><td>Account No:</td><td>${slip.record.accountNo}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div class="section">
          <h3>EARNINGS</h3>
          <table class="amounts"><thead><tr><th>Description</th><th class="r">Amount (₦)</th></tr></thead><tbody>
            <tr><td>Basic Salary</td><td class="r">${currency(slip.record.basicSalary)}</td></tr>
            ${slip.record.housing > 0 ? `<tr><td>Housing Allowance</td><td class="r">${currency(slip.record.housing)}</td></tr>` : ''}
            ${slip.record.transport > 0 ? `<tr><td>Transport Allowance</td><td class="r">${currency(slip.record.transport)}</td></tr>` : ''}
            ${slip.record.otherAllowances > 0 ? `<tr><td>Other Allowances</td><td class="r">${currency(slip.record.otherAllowances)}</td></tr>` : ''}
            ${slip.record.overtime > 0 ? `<tr><td>Overtime Pay</td><td class="r em">${currency(slip.record.overtime)}</td></tr>` : ''}
            <tr class="total"><td>GROSS PAY</td><td class="r">${currency(slip.record.grossPay)}</td></tr>
          </tbody></table>
        </div>
        <div class="section">
          <h3>DEDUCTIONS</h3>
          <table class="amounts"><thead><tr><th>Description</th><th class="r">Amount (₦)</th></tr></thead><tbody>
            ${slip.record.paye > 0 ? `<tr><td>PAYE Tax</td><td class="r red">${currency(slip.record.paye)}</td></tr>` : ''}
            ${slip.record.loanRepayment > 0 ? `<tr><td>Loan &amp; Advance Repayment</td><td class="r red">${currency(slip.record.loanRepayment)}</td></tr>` : ''}
            ${slip.record.pension > 0 ? `<tr><td>Pension Contribution</td><td class="r red">${currency(slip.record.pension)}</td></tr>` : ''}
            <tr class="total"><td>TOTAL DEDUCTIONS</td><td class="r red">${currency(slip.record.paye + slip.record.loanRepayment + slip.record.pension)}</td></tr>
          </tbody></table>
        </div>
        <div class="net-pay">
          <span>TAKE HOME PAY</span>
          <span>${currency(slip.record.takeHomePay)}</span>
        </div>
        <div class="footer">
          <p>This is a computer-generated document. No signature required.</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Payslips</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; }
        .payslip { padding: 40px; page-break-after: always; }
        .payslip.last { page-break-after: auto; }
        .header { border-bottom: 3px solid #4338ca; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 22px; color: #1e1b4b; font-weight: bold; }
        .header p  { font-size: 12px; color: #64748b; margin-top: 2px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 20px; }
        h3 { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 4px 6px; }
        th { font-weight: 600; color: #64748b; }
        td:first-child { color: #64748b; }
        td:last-child { font-weight: 500; }
        .amounts thead tr { border-bottom: 1px solid #e2e8f0; }
        .amounts tbody tr { border-bottom: 1px solid #f1f5f9; }
        .r { text-align: right; font-family: monospace; }
        .red { color: #dc2626; }
        .em { color: #059669; }
        .total td { font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 6px; }
        .section { margin-bottom: 20px; }
        .net-pay { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin: 16px 0; }
        .net-pay span:first-child { font-size: 14px; font-weight: bold; }
        .net-pay span:last-child  { font-size: 22px; font-weight: bold; color: #15803d; font-family: monospace; }
        .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 11px; color: #94a3b8; }
      </style>
    </head><body>${slipsHtml}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:21cm;height:29.7cm;border:none';
    document.body.appendChild(iframe);
    iframe.contentDocument!.write(html);
    iframe.contentDocument!.close();
    iframe.contentWindow!.focus();
    setTimeout(() => {
      iframe.contentWindow!.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const selectedMonthLabel = months.find(m => m.key === selectedMonth)?.label || selectedMonth;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Payroll & Finance</h1>
        <p className="text-slate-500">Manage salaries, taxes, generate payslips, and handle staff advances and loans.</p>
      </div>

      <Tabs>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger active={activeTab === 'processing'} onClick={() => setActiveTab('processing')}>
            Payroll Processing
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'loans'} onClick={() => setActiveTab('loans')}>
            Salary Advances & Loans
          </TabsTrigger>
        </TabsList>

        <TabsContent active={activeTab === 'processing'} className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 items-center">
              <label className="text-sm font-medium text-slate-700">Select Month:</label>
              <select
                className="flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {months.map(month => (
                  <option key={month.key} value={month.key}>{month.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleOpenPrintDialog} variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                Print Payslips
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleProcess}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  <><Calculator className="h-4 w-4" /> Run Payroll</>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Gross Pay</CardTitle>
                <CreditCard className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">₦{totals.totalGross.toLocaleString()}</div>
                <p className="text-xs text-slate-500 mt-1">Salary + Overtime</p>
              </CardContent>
            </Card>
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Deductions</CardTitle>
                <CreditCard className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600">₦{totals.totalDeductions.toLocaleString()}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Sum of all deductions</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 flex flex-col items-start px-2 py-1">
                    <span className="text-[9px] uppercase tracking-wider text-red-400">PAYE Tax</span>
                    <span className="font-bold text-sm">₦{totals.totalPAYE.toLocaleString()}</span>
                  </Badge>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 flex flex-col items-start px-2 py-1">
                    <span className="text-[9px] uppercase tracking-wider text-red-400">Loans & Adv.</span>
                    <span className="font-bold text-sm">₦{totals.totalLoans.toLocaleString()}</span>
                  </Badge>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 flex flex-col items-start px-2 py-1">
                    <span className="text-[9px] uppercase tracking-wider text-red-400">Pension</span>
                    <span className="font-bold text-sm">₦{totals.totalPension.toLocaleString()}</span>
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Net Payroll</CardTitle>
                <CreditCard className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">₦{totals.totalNet.toLocaleString()}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-slate-500">Take Home Pay</p>
                  <p className="text-[10px] font-medium text-slate-700">{totals.employeeCount} active staff</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <CardTitle>Master Payroll Register: {selectedMonthLabel}</CardTitle>
              <Button variant="outline" size="sm" className="gap-2">
                Filter <ChevronDown className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              {/* Table mimicking Excel specific columns precisely */}
              <Table className="whitespace-nowrap w-full text-xs">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-bold text-slate-900">S/N</TableHead>
                    <TableHead className="font-bold text-slate-900">SURNAMES</TableHead>
                    <TableHead className="font-bold text-slate-900">FIRNAME</TableHead>
                    <TableHead className="font-bold text-slate-900">JOB TITTLE</TableHead>
                    <TableHead className="font-bold text-slate-900">BANK</TableHead>
                    <TableHead className="font-bold text-slate-900">ACCOUNT NO.</TableHead>
                    <TableHead className="font-bold text-slate-900 bg-indigo-50/50">SALARY</TableHead>
                    <TableHead className="font-bold text-slate-900">Basic Salary</TableHead>
                    <TableHead className="font-bold text-slate-900">Housing</TableHead>
                    <TableHead className="font-bold text-slate-900">Transport</TableHead>
                    <TableHead className="font-bold text-slate-900">Other Allowances</TableHead>
                    <TableHead className="font-bold text-slate-900 bg-slate-100 border-x">Total-Allowances</TableHead>
                    <TableHead className="font-bold text-slate-900 text-amber-700">OVERTIME</TableHead>
                    <TableHead className="font-bold text-slate-900 bg-emerald-50">GROSS PAY</TableHead>
                    <TableHead className="font-bold text-slate-900 text-red-600">PAYE</TableHead>
                    <TableHead className="font-bold text-slate-900 text-red-600">LOAN REPAYMENT</TableHead>
                    <TableHead className="font-bold text-slate-900 text-red-600">PENSION</TableHead>
                    <TableHead className="font-bold text-slate-900 bg-emerald-100 border-l">TAKE HOME PAY</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollData.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>{record.sn}</TableCell>
                      <TableCell className="font-medium">{record.surname}</TableCell>
                      <TableCell>{record.firstname}</TableCell>
                      <TableCell>{record.position}</TableCell>
                      <TableCell>{record.bankName}</TableCell>
                      <TableCell className="font-mono">{record.accountNo}</TableCell>
                      <TableCell className="font-mono text-indigo-700 bg-indigo-50/30">₦{record.salary.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-slate-600">{record.basicSalary.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-slate-600">{record.housing.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-slate-600">{record.transport.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-slate-600">{record.otherAllowances.toLocaleString()}</TableCell>
                      <TableCell className="font-mono font-medium bg-slate-50 border-x">{record.totalAllowances.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-amber-600">{record.overtime.toLocaleString()}</TableCell>
                      <TableCell className="font-mono font-bold text-slate-900 bg-emerald-50/50">₦{record.grossPay.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-red-600">{record.paye.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-red-600">{record.loanRepayment.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-red-600">{record.pension.toLocaleString()}</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-700 bg-emerald-50 border-l">₦{record.takeHomePay.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent active={activeTab === 'loans'} className="mt-6">
          <SalaryLoans />
        </TabsContent>
      </Tabs>

      {/* Print Payslips Dialog */}
      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/50 flex flex-col z-50 overflow-hidden items-center justify-center p-4">
          <div className="bg-slate-100 rounded-lg shadow-xl flex flex-col w-full max-w-6xl h-[calc(100vh-2rem)] relative">

            <div className="flex bg-indigo-600 p-4 justify-between items-center rounded-t-lg shrink-0 z-10">
              <h3 className="text-white font-bold text-lg">Print Bulk Payslips</h3>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="gap-1" onClick={handlePrint} disabled={payslipsToPrint.length === 0}>
                  <Printer className="h-4 w-4" /> Print All ({payslipsToPrint.length})
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700" onClick={() => setShowPrintDialog(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden print-hide">
              {/* Filter Sidebar */}
              <div className="w-1/3 max-w-[300px] border-r border-slate-200 bg-white p-4 overflow-y-auto flex flex-col gap-6 hide-on-print shadow-sm z-10">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1">Select Months</h4>
                  <div className="space-y-2 mt-2">
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
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                    Select Employees
                    <button
                      className="text-xs text-indigo-600 font-medium hover:underline"
                      onClick={() => setPrintSelectedEmployees([])}
                    >
                      Select All
                    </button>
                  </h4>
                  <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-2">
                    {employees.filter(e => e.status === 'Active').map(emp => (
                      <label key={emp.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600"
                          checked={printSelectedEmployees.length === 0 || printSelectedEmployees.includes(emp.id)}
                          onChange={(e) => {
                            let curr = printSelectedEmployees.length === 0 ? employees.filter(e => e.status === 'Active').map(e => e.id) : [...printSelectedEmployees];
                            if (e.target.checked) curr.push(emp.id);
                            else curr = curr.filter(id => id !== emp.id);
                            if (curr.length === employees.filter(e => e.status === 'Active').length) curr = [];
                            setPrintSelectedEmployees(curr);
                          }}
                        />
                        {emp.firstname} {emp.surname}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Area */}
              <div className="flex-1 p-8 overflow-y-auto bg-slate-200" id="print-area">
                {payslipsToPrint.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium pb-20">
                    No payslips match your selection.
                  </div>
                ) : (
                  payslipsToPrint.map((slip, i) => (
                    <div key={`${slip.monthKey}-${slip.record.id}`} className="bg-white p-10 mb-8 mx-auto shadow-sm max-w-3xl rounded-sm print-break">
                      {/* Company Header */}
                      <div className="border-b-2 border-indigo-600 pb-4 mb-6">
                        <img src={logoSrc} alt="DCEL Logo" className="h-12 w-auto mb-2" />
                        <p className="text-sm text-slate-500">Employee Payslip - {slip.monthLabel} {currentYear}</p>
                      </div>

                      {/* Employee Info */}
                      <div className="grid grid-cols-2 gap-8 mb-6">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Employee Details</h3>
                          <table className="w-full text-sm">
                            <tbody>
                              <tr><td className="py-1 text-slate-600">Name:</td><td className="py-1 font-medium">{slip.record.firstname} {slip.record.surname}</td></tr>
                              <tr><td className="py-1 text-slate-600">Employee ID:</td><td className="py-1 font-mono">{slip.record.id}</td></tr>
                              <tr><td className="py-1 text-slate-600">Position:</td><td className="py-1">{slip.record.position}</td></tr>
                              <tr><td className="py-1 text-slate-600">Department:</td><td className="py-1">{slip.record.department}</td></tr>
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Payment Details</h3>
                          <table className="w-full text-sm">
                            <tbody>
                              <tr><td className="py-1 text-slate-600">Pay Period:</td><td className="py-1 font-medium">{slip.monthLabel}</td></tr>
                              <tr><td className="py-1 text-slate-600">Bank:</td><td className="py-1">{slip.record.bankName}</td></tr>
                              <tr><td className="py-1 text-slate-600">Account No:</td><td className="py-1 font-mono">{slip.record.accountNo}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Earnings Section */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2 border-b pb-1">Earnings</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left"><th className="py-2 text-slate-600">Description</th><th className="py-2 text-right text-slate-600">Amount (₦)</th></tr>
                          </thead>
                          <tbody>
                            <tr><td className="py-2">Basic Salary</td><td className="py-2 text-right font-mono">{slip.record.basicSalary.toLocaleString()}</td></tr>
                            {slip.record.housing > 0 && <tr><td className="py-2">Housing Allowance</td><td className="py-2 text-right font-mono">{slip.record.housing.toLocaleString()}</td></tr>}
                            {slip.record.transport > 0 && <tr><td className="py-2">Transport Allowance</td><td className="py-2 text-right font-mono">{slip.record.transport.toLocaleString()}</td></tr>}
                            {slip.record.otherAllowances > 0 && <tr><td className="py-2">Other Allowances</td><td className="py-2 text-right font-mono">{slip.record.otherAllowances.toLocaleString()}</td></tr>}
                            {slip.record.overtime > 0 && <tr><td className="py-2">Overtime Pay</td><td className="py-2 text-right font-mono text-emerald-600">+{slip.record.overtime.toLocaleString()}</td></tr>}
                            <tr className="border-t font-semibold"><td className="py-2">GROSS PAY</td><td className="py-2 text-right font-mono text-lg">{slip.record.grossPay.toLocaleString()}</td></tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Deductions Section */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2 border-b pb-1">Deductions</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left"><th className="py-2 text-slate-600">Description</th><th className="py-2 text-right text-slate-600">Amount (₦)</th></tr>
                          </thead>
                          <tbody>
                            {slip.record.paye > 0 && <tr><td className="py-2">PAYE Tax</td><td className="py-2 text-right font-mono text-red-600">-{slip.record.paye.toLocaleString()}</td></tr>}
                            {slip.record.loanRepayment > 0 && <tr><td className="py-2">Loan & Advance Repayment</td><td className="py-2 text-right font-mono text-red-600">-{slip.record.loanRepayment.toLocaleString()}</td></tr>}
                            {slip.record.pension > 0 && <tr><td className="py-2">Pension Contribution</td><td className="py-2 text-right font-mono text-red-600">-{slip.record.pension.toLocaleString()}</td></tr>}
                            <tr className="border-t font-semibold"><td className="py-2">TOTAL DEDUCTIONS</td><td className="py-2 text-right font-mono text-red-600 text-lg">-{(slip.record.paye + slip.record.loanRepayment + slip.record.pension).toLocaleString()}</td></tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Net Pay */}
                      <div className="bg-emerald-50 p-6 rounded-lg border border-emerald-100">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-slate-900">TAKE HOME PAY</span>
                          <span className="text-3xl font-bold text-emerald-700">₦{slip.record.takeHomePay.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-8 pt-4 border-t text-center text-xs text-slate-400">
                        <p>This is a computer-generated document. No signature required.</p>
                        <p>Generated on {new Date().toLocaleDateString()}</p>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

            <style>{`
              @media print {
                body > * { visibility: hidden !important; }
                .hide-on-print { display: none !important; }
                #print-area, #print-area * { visibility: visible !important; }
                #print-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  background: white !important;
                  padding: 0 !important;
                  overflow: visible !important;
                }
                .print-break {
                  page-break-after: always !important;
                  break-after: page !important;
                  box-shadow: none !important;
                  margin: 0 !important;
                  padding: 0 0 20px 0 !important;
                  border: none !important; 
                  max-width: 100% !important;
                }
                .print-break:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
