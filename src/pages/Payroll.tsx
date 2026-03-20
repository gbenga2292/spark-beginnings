import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Input } from '@/src/components/ui/input';
import { Download, FileText, Calculator, CreditCard, ChevronDown, X, Printer } from 'lucide-react';
import { useAppStore, Employee } from '@/src/store/appStore';
import { computeWorkDays, MONTH_INDEX } from '@/src/lib/workdays';
import logoSrc from '../../logo/logo-2.png';
import { usePriv } from '@/src/hooks/usePriv';

interface PayrollRecord {
  id: string;
  sn: number;
  surname: string;
  firstname: string;
  position: string;
  department: string;
  staffType: 'INTERNAL' | 'EXTERNAL';
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
  employerPension: number;
  takeHomePay: number;
  nsitf: number;
  status: 'Pending' | 'Processed';
}



const POSITION_HIERARCHY = [
  'CEO',
  'Head of Admin',
  'Head of Operations',
  'Projects Supervisor',
  'Logistics and Warehouse Officer',
  'Admin/Accounts Officer',
  'HR Officer',
  'Foreman',
  'Engineer',
  'Site Supervisor',
  'Assistant Supervisor',
  'Mechanic Technician/Site Worker',
  'Site Worker',
  'Driver',
  'Adhoc Staff',
  'Security',
  'Consultant',
  'Sponsored Student',
];

const isPayeEligible = (r: PayrollRecord) => r.paye > 0 && r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc');
const isPensionEligible = (r: PayrollRecord) => r.pension > 0 && r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc');
const isNsitfEligible = (r: PayrollRecord) => r.nsitf > 0 && !r.department.trim().toLowerCase().includes('adhoc');

const currentYear = new Date().getFullYear();

export function Payroll() {
  const [activeTab, setActiveTab] = useState('processing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printType, setPrintType] = useState<'PAYSLIPS' | 'PAYE' | 'PENSION' | 'NSITF'>('PAYSLIPS');
  const [printSelectedMonths, setPrintSelectedMonths] = useState<string[]>([]);
  const [printSelectedEmployees, setPrintSelectedEmployees] = useState<string[]>([]);
  const [printSelectedDepts, setPrintSelectedDepts] = useState<string[]>([]);
  const [filterDept, setFilterDept] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const payeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const monthValues = useAppStore((state) => state.monthValues);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const [selectedMonth, setSelectedMonth] = useState('jan');

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Permissions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const priv = usePriv('payroll');
  const finRepPriv = usePriv('financialReports');

  // Drag to pan functionality
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeft(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // OPERATIONS departments – purely attendance-based pay
  const OPERATIONS_DEPARTMENTS = ['OPERATIONS', 'ENGINEERING'];

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


    // Calculate payroll logic extracted for multi-month generation capabilities
    const calculatePayrollForMonth = useCallback((monthKey: string) => {
      const mKey = monthKey as keyof typeof employees[0]['monthlySalaries'];
      const selectedMonthIndex = months.findIndex(m => m.key === monthKey) + 1;

      // Auto-compute workdays for this month from public holidays
      const holidayDates = publicHolidays.map(h => h.date);
      const fallbackWorkdays = computeWorkDays(currentYear, selectedMonthIndex, holidayDates, 6);

      const monthConfig = monthValues[mKey as keyof typeof monthValues] || { workDays: fallbackWorkdays, overtimeRate: 0.5 };
      const otRate = monthConfig.overtimeRate;

      let snCounter = 1;

      return employees
        .filter(e => e.status === 'Active')
        .sort((a, b) => {
          const posA = a.position || '';
          const posB = b.position || '';
          const idxA = POSITION_HIERARCHY.indexOf(posA);
          const idxB = POSITION_HIERARCHY.indexOf(posB);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return posA.localeCompare(posB);
        })
        .map((emp) => {
          const standardSalary = emp.monthlySalaries[mKey] || 0;

          const defaultDays = ['OPERATIONS', 'ENGINEERING'].includes(emp.department.toUpperCase()) ? 6 : 5;
          const empWorkDaysPerWeek = payrollVariables.departmentWorkDays?.[emp.department] ?? defaultDays;
          const empOfficialWorkdays = computeWorkDays(currentYear, selectedMonthIndex, holidayDates, empWorkDaysPerWeek);

          // Ã¢â€â‚¬Ã¢â€â‚¬ Attendance tallies Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
          let daysWorked = 0; // days where day === 'Yes'
          let daysAbsent = 0; // days where attendance record exists AND day === 'No'
          let totalOTInstances = 0;

          for (const r of attendanceRecords) {
            if (r.staffId === emp.id && r.mth === selectedMonthIndex) {
              if (r.ot > 0) totalOTInstances += 1;

              if (r.day?.toLowerCase() === 'yes') {
                daysWorked += 1;
              } else if (r.day?.toLowerCase() === 'no') {
                const st = r.absentStatus?.toUpperCase() || '';
                const isRealAbsence = ["ABSENT", "NO WORK", "ABSENT WITHOUT PERMIT", "SUSPENSION", "OFF DUTY"].includes(st);
                if (isRealAbsence) {
                  daysAbsent += 1;
                }
              }
            }
          }

          // Cap daysWorked at the official workdays ceiling
          if (daysWorked > empOfficialWorkdays) daysWorked = empOfficialWorkdays;

          // Ã¢â€â‚¬Ã¢â€â‚¬ Salary calculation (two-mode) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
          let salary = 0;
          let overtime = 0;

          if (standardSalary > 0 && empOfficialWorkdays > 0) {
            const dailyRate = standardSalary / empOfficialWorkdays;

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

          // SUM(Jan[@[Basic Salary]:[Other Allowances]]) Ã¢â‚¬â€ full breakdown total
          const totalAllowances = basicSalary + housing + transport + otherAllowances;

          // pensionSum = SUM(Basic:Transport) Ã¢â‚¬â€ matches Excel: SUM(Jan[@[Basic Salary]:[Transport]])
          const pensionSum = basicSalary + housing + transport;

          // GROSS PAY: SALARY + OVERTIME
          const grossPay = salary + overtime;

          // PENSION deduction (on pensionSum, not totalAllowances) — INTERNAL staff only
          const pension = (emp.payeTax && emp.staffType === 'INTERNAL') ? pensionSum * (payrollVariables.employeePensionRate / 100) : 0;

          // Ã¢â€â‚¬Ã¢â€â‚¬ PAYE calculation matching Excel formula exactly: Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
          // =IF(payeTax="Yes", NIGERIATAX(salary, SUM(Basic:Transport), overtime, rentRelief),
          //    IF(withholdingTax="Yes", salary * withholdingTaxRate, 0))
          let paye = 0;
          if (emp.payeTax) {
            const tv = payeTaxVariables;
            const annualGross = (salary * 12) + overtime;
            const pensionAmt = (pensionSum * 12) * (payrollVariables.employeePensionRate / 100);
            const extraCRA = tv.extraConditions.filter(c => c.enabled).reduce((s, c) => s + c.amount, 0);
            const rentRelief = Math.min((emp.rent || 0) * (tv.rentReliefRate ?? 0.20), 500000);
            const cra = tv.craBase + rentRelief + pensionAmt + extraCRA;
            const annualTaxable = Math.max(annualGross - cra, 0);
            // Old Excel Logic Translation
            // Case Is <= 0: AnnualTax = 0
            // Case Is <= 2200000: AnnualTax = AnnualTaxable * 0.15
            // Case Is <= 11200000: AnnualTax = (AnnualTaxable - 2200000) * 0.18 + (330000)
            // Case Is <= 24200000: AnnualTax = (AnnualTaxable - 11200000) * 0.21 + (330000 + 1620000)
            // Case Is <= 49200000: AnnualTax = (AnnualTaxable - 24200000) * 0.23 + (330000 + 1620000 + 2730000)
            // Case Else: AnnualTax = (AnnualTaxable - 49200000) * 0.25 + (330000 + 1620000 + 2730000 + 5750000)

            let annualTax = 0;
            if (annualTaxable <= 0) {
              annualTax = 0;
            } else if (annualTaxable <= 2200000) {
              annualTax = annualTaxable * 0.15;
            } else if (annualTaxable <= 11200000) {
              annualTax = (annualTaxable - 2200000) * 0.18 + 330000;
            } else if (annualTaxable <= 24200000) {
              annualTax = (annualTaxable - 11200000) * 0.21 + (330000 + 1620000);
            } else if (annualTaxable <= 49200000) {
              annualTax = (annualTaxable - 24200000) * 0.23 + (330000 + 1620000 + 2730000);
            } else {
              annualTax = (annualTaxable - 49200000) * 0.25 + (330000 + 1620000 + 2730000 + 5750000);
            }

            paye = annualTax / 12;
          } else if (emp.withholdingTax) {
            paye = salary * (payrollVariables.withholdingTaxRate ?? 0);
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

          const employerPension = (emp.payeTax && emp.staffType === 'INTERNAL') ? pensionSum * (payrollVariables.employerPensionRate / 100) : 0;
          const nsitf = emp.payeTax ? grossPay * (payrollVariables.nsitfRate / 100) : 0;

          return {
            id: emp.id,
            sn: snCounter++,
            surname: emp.surname,
            firstname: emp.firstname,
            position: emp.position,
            department: emp.department,
            staffType: emp.staffType,
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
            employerPension,
            nsitf,
            takeHomePay,
            status: 'Pending' as const,
          };
        });
    }, [employees, salaryAdvances, loans, payrollVariables, monthValues, attendanceRecords, months, currentYear]);

    // Derive standard display payload
    const payrollData = useMemo(() => calculatePayrollForMonth(selectedMonth), [calculatePayrollForMonth, selectedMonth]);

    // Derived filtered print dataset
    const payslipsToPrint = useMemo(() => {
      if (!printType) return [];
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
    }, [printType, printSelectedMonths, printSelectedEmployees, calculatePayrollForMonth, selectedMonth, months]);

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

    const handleOpenPrintDialog = (type: 'PAYSLIPS' | 'PAYE' | 'PENSION' | 'NSITF') => {
      setPrintSelectedMonths([selectedMonth]);
      setPrintSelectedEmployees([]);
      setPrintType(type);
    };

    const handlePrint = () => {
      if (!payslipsToPrint || payslipsToPrint.length === 0) return;

      if (printType === 'PAYE' || printType === 'PENSION' || printType === 'NSITF') {
        const el = document.getElementById('print-area-content');
        if (!el) return;
        const html = `
        <!DOCTYPE html>
        <html><head>
          <title>${printType} Schedule</title>
          <style>
             body { font-family: sans-serif; color: #333; }
             table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
             th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
             th { background-color: #f1f5f9; font-weight: bold; }
             .text-right { text-align: right; }
             .text-center { text-align: center; }
             .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
             .header img { height: 48px; margin-bottom: 10px; }
             .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
           </style>
        </head><body>${el.innerHTML}</body></html>`;
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
        return;
      }

      // Build self-contained HTML for every payslip so all appear in one print job
      const currency = (n: number) => '₦' + n.toLocaleString();
      const slipsHtml = payslipsToPrint.map((slip, i) => `
      <div class="payslip${i === payslipsToPrint.length - 1 ? ' last' : ''}">
        <div class="header">
          <img src="${logoSrc}" alt="Company Logo" style="height: 48px; width: auto; margin-bottom: 8px;" />
          <p>Employee Payslip &ndash; ${slip.monthLabel} ${currentYear}</p>
        </div>
        <div class="two-col">
          <table class="info-table">
            <tr><td>Name:</td><td><strong>${slip.record.firstname} ${slip.record.surname}</strong></td></tr>
            <tr><td>ID:</td><td>${slip.record.id}</td></tr>
            <tr><td>Position:</td><td>${slip.record.position}</td></tr>
          </table>
          <table class="info-table">
            <tr><td>Bank:</td><td>${slip.record.bankName}</td></tr>
            <tr><td>Account:</td><td>${slip.record.accountNo}</td></tr>
          </table>
        </div>
        
        <table class="breakdown-table">
          <thead><tr><th>Earnings</th><th class="text-right">Amount (₦)</th></tr></thead>
          <tbody>
            <tr><td>Basic Salary</td><td class="text-right">${currency(slip.record.basicSalary)}</td></tr>
            ${slip.record.housing > 0 ? `<tr><td>Housing Allowance</td><td class="text-right">${currency(slip.record.housing)}</td></tr>` : ''}
            ${slip.record.transport > 0 ? `<tr><td>Transport Allowance</td><td class="text-right">${currency(slip.record.transport)}</td></tr>` : ''}
            ${slip.record.otherAllowances > 0 ? `<tr><td>Other Allowances</td><td class="text-right">${currency(slip.record.otherAllowances)}</td></tr>` : ''}
            ${slip.record.overtime > 0 ? `<tr><td>Overtime Pay</td><td class="text-right">${currency(slip.record.overtime)}</td></tr>` : ''}
            <tr class="sum"><td>GROSS PAY</td><td class="text-right">${currency(slip.record.grossPay)}</td></tr>
          </tbody>
        </table>

        <table class="breakdown-table">
          <thead><tr><th>Deductions</th><th class="text-right">Amount (₦)</th></tr></thead>
          <tbody>
            ${slip.record.paye > 0 ? `<tr><td>PAYE Tax</td><td class="text-right">-${currency(slip.record.paye)}</td></tr>` : ''}
            ${slip.record.loanRepayment > 0 ? `<tr><td>Loan & Advance</td><td class="text-right">-${currency(slip.record.loanRepayment)}</td></tr>` : ''}
            ${slip.record.pension > 0 ? `<tr><td>Pension</td><td class="text-right">-${currency(slip.record.pension)}</td></tr>` : ''}
            <tr class="sum"><td>TOTAL DEDUCTIONS</td><td class="text-right">-${currency(slip.record.paye + slip.record.loanRepayment + slip.record.pension)}</td></tr>
          </tbody>
        </table>

        <div class="net-pay">
            <span>TAKE HOME PAY</span>
            <span>${currency(slip.record.takeHomePay)}</span>
        </div>
        
        <div class="footer">This is a system generated payslip. No signature is required. Generated on ${new Date().toLocaleDateString()}</div>
      </div>
    `).join('');

      const html = `
    <!DOCTYPE html>
    <html><head>
      <title>Print Bulk Payslips</title>
      <style>
        body { font-family: sans-serif; color: #333; }
        .payslip { page-break-after: always; max-width: 800px; margin: 0 auto; padding: 20px; }
        .payslip.last { page-break-after: auto; }
        .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
        .header h2 { margin: 0; color: #1e293b; }
        .header p { margin: 4px 0 0 0; color: #64748b; font-size: 14px; }
        .two-col { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
        .info-table { flex: 1; font-size: 14px; }
        .info-table td { padding: 4px 0; border: none; }
        .info-table td:first-child { color: #64748b; width: 80px; }
        .breakdown-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
        .breakdown-table th { background: #f8fafc; text-align: left; padding: 8px; border-bottom: 1px solid #cbd5e1; }
        .breakdown-table td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        .breakdown-table .sum { font-weight: bold; font-size: 15px; }
        .breakdown-table .sum td { border-top: 1px solid #94a3b8; border-bottom: none; }
        .text-right { text-align: right !important; }
        .net-pay { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px;}
        .net-pay span:first-child { font-size: 16px; font-weight: bold; color: #1e293b; }
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

    const handleExportScheduleCSV = () => {
      let csvStr = '';
      const fmCSV = (n: number) => n.toFixed(2);

      // Helpers for CSV eligibility
      const csvPayeOk  = (r: typeof payslipsToPrint[0]['record']) => r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc');
      const csvPenOk   = (r: typeof payslipsToPrint[0]['record']) => r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc');
      const csvNsitfOk = (r: typeof payslipsToPrint[0]['record']) => r.nsitf > 0 && !r.department.trim().toLowerCase().includes('adhoc');

      if (printType === 'PAYE') {
        csvStr = 'S/N,Employee Name,Month,Basic Salary (₦),Housing (₦),Transport (₦),Other Allowances (₦),Gross Pay (₦),PAYE Deducted (₦)\n';
        let sn = 1;
        payslipsToPrint.forEach(slip => {
          if (csvPayeOk(slip.record)) {
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.monthLabel}","${fmCSV(slip.record.basicSalary)}","${fmCSV(slip.record.housing)}","${fmCSV(slip.record.transport)}","${fmCSV(slip.record.otherAllowances)}","${fmCSV(slip.record.grossPay)}","${fmCSV(slip.record.paye)}"\n`;
          }
        });
      } else if (printType === 'PENSION') {
        csvStr = 'S/N,Employee Name,Month,Pensionable Sum (₦),Employee Contrib. (₦),Employer Contrib. (₦),Total Contrib. (₦)\n';
        let sn = 1;
        payslipsToPrint.forEach(slip => {
          if (csvPenOk(slip.record)) {
            const penSum = slip.record.basicSalary + slip.record.housing + slip.record.transport;
            const totalPen = slip.record.pension + slip.record.employerPension;
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.monthLabel}","${fmCSV(penSum)}","${fmCSV(slip.record.pension)}","${fmCSV(slip.record.employerPension)}","${fmCSV(totalPen)}"\n`;
          }
        });
      } else if (printType === 'NSITF') {
        csvStr = 'S/N,Employee Name,Month,Gross Pay (₦),NSITF Rate (%),NSITF Amount (₦)\n';
        let sn = 1;
        payslipsToPrint.forEach(slip => {
          if (csvNsitfOk(slip.record)) {
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.monthLabel}","${fmCSV(slip.record.grossPay)}","${payrollVariables.nsitfRate}","${fmCSV(slip.record.nsitf)}"\n`;
          }
        });
      }

      if (!csvStr) return;
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${printType}_Schedule.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const selectedMonthLabel = months.find(m => m.key === selectedMonth)?.label || selectedMonth;

    const hideAmounts = priv?.canViewAmounts === false;
    const fm = (n: number) => hideAmounts ? '***' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // fmTotal always shows the real value (used for TOTALS rows)
    const fmT = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Payroll & Finance</h1>
          <p className="text-slate-500">Manage salaries, taxes, generate payslips, and handle staff advances and loans.</p>
        </div>

        <Tabs>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger active={activeTab === 'processing'} onClick={() => setActiveTab('processing')}>
              Payroll Processing
            </TabsTrigger>
            {priv.canViewPayeSchedule && (
              <TabsTrigger active={activeTab === 'paye'} onClick={() => setActiveTab('paye')}>
                PAYE
              </TabsTrigger>
            )}
            {priv.canViewPensionSchedule && (
              <TabsTrigger active={activeTab === 'pension'} onClick={() => setActiveTab('pension')}>
                Pension
              </TabsTrigger>
            )}
            {priv.canViewNsitfSchedule && (
              <TabsTrigger active={activeTab === 'nsitf'} onClick={() => setActiveTab('nsitf')}>
                NSITF
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent active={activeTab === 'processing'} className="space-y-6 mt-6">
            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Month selector + Print/Export button Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
                {priv.canGenerate && (
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
                )}
                {finRepPriv.canExport && (
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Gross Pay</CardTitle>
                  <CreditCard className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">₦{priv?.canViewAmounts === false ? '***' : totals.totalGross.toLocaleString()}</div>
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
                    <div className="text-2xl font-bold text-red-600">₦{priv?.canViewAmounts === false ? '***' : totals.totalDeductions.toLocaleString()}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Sum of all deductions</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 flex flex-col items-start px-2 py-1">
                      <span className="text-[9px] uppercase tracking-wider text-red-400">PAYE Tax</span>
                      <span className="font-bold text-sm">₦{priv?.canViewAmounts === false ? '***' : totals.totalPAYE.toLocaleString()}</span>
                    </Badge>
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 flex flex-col items-start px-2 py-1">
                      <span className="text-[9px] uppercase tracking-wider text-red-400">Loans & Adv.</span>
                      <span className="font-bold text-sm">₦{priv?.canViewAmounts === false ? '***' : totals.totalLoans.toLocaleString()}</span>
                    </Badge>
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 flex flex-col items-start px-2 py-1">
                      <span className="text-[9px] uppercase tracking-wider text-red-400">Pension</span>
                      <span className="font-bold text-sm">₦{priv?.canViewAmounts === false ? '***' : totals.totalPension.toLocaleString()}</span>
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
                  <div className="text-2xl font-bold text-emerald-600">₦{priv?.canViewAmounts === false ? '***' : totals.totalNet.toLocaleString()}</div>
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
                <div className="flex items-center gap-2">
                  {showFilterPanel && (
                    <select
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {[...new Set(employees.map(e => e.department).filter(Boolean))].sort().map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                  <Button
                    variant="outline" size="sm"
                    className={`gap-2 ${showFilterPanel ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : ''}`}
                    onClick={() => { setShowFilterPanel(p => !p); if (showFilterPanel) setFilterDept(''); }}
                  >
                    Filter <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent
                ref={tableContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={`pt-4 overflow-x-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {/* Table mimicking Excel specific columns precisely */}
                <Table className="whitespace-nowrap w-full text-xs">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-bold text-slate-900 sticky left-0 z-20 bg-slate-50" style={{minWidth:'48px',boxShadow:'none'}}>S/N</TableHead>
                      <TableHead className="font-bold text-slate-900 sticky z-20 bg-slate-50" style={{left:'48px',minWidth:'110px'}}>SURNAMES</TableHead>
                      <TableHead className="font-bold text-slate-900 sticky z-20 bg-slate-50" style={{left:'158px',minWidth:'110px'}}>FIRNAME</TableHead>
                      <TableHead className="font-bold text-slate-900 sticky z-20 bg-slate-50 border-r border-slate-300" style={{left:'268px',minWidth:'180px'}}>JOB TITTLE</TableHead>
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
                    {payrollData.filter(r => !filterDept || r.department === filterDept).map((record) => (
                      <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="sticky left-0 z-10 bg-white border-r border-transparent" style={{minWidth:'48px'}}>{record.sn}</TableCell>
                        <TableCell className="font-medium sticky z-10 bg-white" style={{left:'48px',minWidth:'110px'}}>{record.surname}</TableCell>
                        <TableCell className="sticky z-10 bg-white" style={{left:'158px',minWidth:'110px'}}>{record.firstname}</TableCell>
                        <TableCell className="sticky z-10 bg-white border-r border-slate-300" style={{left:'268px',minWidth:'180px'}}>{record.position}</TableCell>
                        <TableCell>{record.bankName}</TableCell>
                        <TableCell className="font-mono">{record.accountNo}</TableCell>
                        <TableCell className="font-mono text-indigo-700 bg-indigo-50/30">₦{priv?.canViewAmounts === false ? '***' : record.salary.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.basicSalary.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.housing.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.transport.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.otherAllowances.toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-medium bg-slate-50 border-x">{priv?.canViewAmounts === false ? '***' : record.totalAllowances.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-amber-600">{priv?.canViewAmounts === false ? '***' : record.overtime.toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-bold text-slate-900 bg-emerald-50/50">₦{priv?.canViewAmounts === false ? '***' : record.grossPay.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-red-600">{priv?.canViewAmounts === false ? '***' : record.paye.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-red-600">{priv?.canViewAmounts === false ? '***' : record.loanRepayment.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-red-600">{priv?.canViewAmounts === false ? '***' : record.pension.toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-bold text-emerald-700 bg-emerald-50 border-l">₦{priv?.canViewAmounts === false ? '***' : record.takeHomePay.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ PAYE TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {priv.canViewPayeSchedule && (
            <TabsContent active={activeTab === 'paye'} className="space-y-6 mt-6">
              <div className="flex gap-4 items-center">
                <label className="text-sm font-medium text-slate-700">Month:</label>
                <select
                  className="flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <CardTitle>PAYE Tax Schedule: {selectedMonthLabel}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Total PAYE: <span className="text-red-600 font-bold">₦{fmT(totals.totalPAYE)}</span></span>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintSelectedMonths([selectedMonth]); setPrintSelectedEmployees([]); setPrintDialogOpen(true); setPrintType('PAYE'); }}>
                      <Printer className="h-4 w-4" /> Print Schedule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto cursor-grab">
                  <Table className="whitespace-nowrap w-full text-xs">
                    <TableHeader>
                      <TableRow className="bg-red-50">
                        <TableHead className="font-bold">S/N</TableHead>
                        <TableHead className="font-bold">Surname</TableHead>
                        <TableHead className="font-bold">Firstname</TableHead>
                        <TableHead className="font-bold">Department</TableHead>
                        <TableHead className="font-bold text-right">Basic (₦)</TableHead>
                        <TableHead className="font-bold text-right">Housing (₦)</TableHead>
                        <TableHead className="font-bold text-right">Transport (₦)</TableHead>
                        <TableHead className="font-bold text-right">Other (₦)</TableHead>
                        <TableHead className="font-bold text-right bg-slate-100">Gross Pay (₦)</TableHead>
                        <TableHead className="font-bold text-right text-red-600">PAYE (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.filter(r => r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc')).map((r, i) => (
                        <TableRow key={r.id} className="hover:bg-red-50/30">
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{r.surname}</TableCell>
                          <TableCell>{r.firstname}</TableCell>
                          <TableCell className="text-slate-500">{r.department}</TableCell>
                          <TableCell className="text-right font-mono">{fm(r.basicSalary)}</TableCell>
                          <TableCell className="text-right font-mono">{fm(r.housing)}</TableCell>
                          <TableCell className="text-right font-mono">{fm(r.transport)}</TableCell>
                          <TableCell className="text-right font-mono">{fm(r.otherAllowances)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold bg-slate-50">{fm(r.grossPay)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-red-600">{fm(r.paye)}</TableCell>
                        </TableRow>
                      ))}
                      {(() => { const pd = payrollData.filter(r => r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc')); return (
                      <TableRow className="border-t-2 bg-red-50 font-bold">
                        <TableCell colSpan={4} className="text-right font-bold">TOTALS</TableCell>
                        <TableCell className="text-right font-mono">{fmT(pd.reduce((s, r) => s + r.basicSalary, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmT(pd.reduce((s, r) => s + r.housing, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmT(pd.reduce((s, r) => s + r.transport, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmT(pd.reduce((s, r) => s + r.otherAllowances, 0))}</TableCell>
                        <TableCell className="text-right font-mono">{fmT(pd.reduce((s, r) => s + r.grossPay, 0))}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{fmT(pd.reduce((s, r) => s + r.paye, 0))}</TableCell>
                      </TableRow>); })()}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ PENSION TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {priv.canViewPensionSchedule && (
            <TabsContent active={activeTab === 'pension'} className="space-y-6 mt-6">
              <div className="flex gap-4 items-center">
                <label className="text-sm font-medium text-slate-700">Month:</label>
                <select
                  className="flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <CardTitle>Pension Schedule: {selectedMonthLabel}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Total Pension: <span className="text-amber-600 font-bold">₦{fmT(totals.totalPension)}</span></span>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintSelectedMonths([selectedMonth]); setPrintSelectedEmployees([]); setPrintDialogOpen(true); setPrintType('PENSION'); }}>
                      <Printer className="h-4 w-4" /> Print Schedule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto cursor-grab">
                  <Table className="whitespace-nowrap w-full text-xs">
                    <TableHeader>
                      <TableRow className="bg-amber-50">
                        <TableHead className="font-bold">S/N</TableHead>
                        <TableHead className="font-bold">Surname</TableHead>
                        <TableHead className="font-bold">Firstname</TableHead>
                        <TableHead className="font-bold">Department</TableHead>
                        <TableHead className="font-bold text-right">Pensionable Sum (₦)</TableHead>
                        <TableHead className="font-bold text-right text-amber-700">Employee (₦)</TableHead>
                        <TableHead className="font-bold text-right text-indigo-700">Employer (₦)</TableHead>
                        <TableHead className="font-bold text-right text-emerald-700 bg-emerald-50">Total (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.filter(r => r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc')).map((r, i) => {
                        const penSum = r.basicSalary + r.housing + r.transport;
                        return (
                          <TableRow key={r.id} className="hover:bg-amber-50/30">
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium">{r.surname}</TableCell>
                            <TableCell>{r.firstname}</TableCell>
                            <TableCell className="text-slate-500">{r.department}</TableCell>
                            <TableCell className="text-right font-mono">{fm(penSum)}</TableCell>
                            <TableCell className="text-right font-mono text-amber-600 font-semibold">{fm(r.pension)}</TableCell>
                            <TableCell className="text-right font-mono text-indigo-600 font-semibold">{fm(r.employerPension)}</TableCell>
                            <TableCell className="text-right font-mono text-emerald-700 font-bold bg-emerald-50/50">{fm(r.pension + r.employerPension)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {(() => { const pp = payrollData.filter(r => r.staffType === 'INTERNAL' && !r.department.trim().toLowerCase().includes('adhoc')); return (
                      <TableRow className="border-t-2 bg-amber-50 font-bold">
                        <TableCell colSpan={4} className="text-right font-bold">TOTALS</TableCell>
                        <TableCell className="text-right font-mono">{fmT(pp.reduce((s, r) => s + (r.basicSalary + r.housing + r.transport), 0))}</TableCell>
                        <TableCell className="text-right font-mono text-amber-600">{fmT(pp.reduce((s, r) => s + r.pension, 0))}</TableCell>
                        <TableCell className="text-right font-mono text-indigo-600">{fmT(pp.reduce((s, r) => s + r.employerPension, 0))}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-700">{fmT(pp.reduce((s, r) => s + r.pension + r.employerPension, 0))}</TableCell>
                      </TableRow>); })()}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ NSITF TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {priv.canViewNsitfSchedule && (
            <TabsContent active={activeTab === 'nsitf'} className="space-y-6 mt-6">
              <div className="flex gap-4 items-center">
                <label className="text-sm font-medium text-slate-700">Month:</label>
                <select
                  className="flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <CardTitle>NSITF Schedule: {selectedMonthLabel}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Total NSITF: <span className="text-blue-600 font-bold">₦{fmT(payrollData.reduce((s, r) => s + r.nsitf, 0))}</span></span>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPrintSelectedMonths([selectedMonth]); setPrintSelectedEmployees([]); setPrintDialogOpen(true); setPrintType('NSITF'); }}>
                      <Printer className="h-4 w-4" /> Print Schedule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto cursor-grab">
                  <Table className="whitespace-nowrap w-full text-xs">
                    <TableHeader>
                      <TableRow className="bg-blue-50">
                        <TableHead className="font-bold">S/N</TableHead>
                        <TableHead className="font-bold">Surname</TableHead>
                        <TableHead className="font-bold">Firstname</TableHead>
                        <TableHead className="font-bold">Department</TableHead>
                        <TableHead className="font-bold text-right">Gross Pay (₦)</TableHead>
                        <TableHead className="font-bold text-center">Rate (%)</TableHead>
                        <TableHead className="font-bold text-right text-blue-700 bg-blue-50">NSITF (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.filter(r => isNsitfEligible(r)).map((r, i) => (
                        <TableRow key={r.id} className="hover:bg-blue-50/30">
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{r.surname}</TableCell>
                          <TableCell>{r.firstname}</TableCell>
                          <TableCell className="text-slate-500">{r.department}</TableCell>
                          <TableCell className="text-right font-mono">{fm(r.grossPay)}</TableCell>
                          <TableCell className="text-center font-mono text-slate-500">{payrollVariables.nsitfRate}%</TableCell>
                          <TableCell className="text-right font-mono text-blue-600 font-bold bg-blue-50/50">{fm(r.nsitf)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 bg-blue-50 font-bold">
                        <TableCell colSpan={4} className="text-right font-bold">TOTALS</TableCell>
                        <TableCell className="text-right font-mono">{fmT(payrollData.filter(r => r.nsitf > 0).reduce((s, r) => s + r.grossPay, 0))}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono text-blue-600">{fmT(payrollData.reduce((s, r) => s + r.nsitf, 0))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>

        {printDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex flex-col z-50 overflow-hidden items-center justify-center p-4">
            <div className="bg-slate-100 rounded-lg shadow-xl flex flex-col w-full max-w-6xl h-[calc(100vh-2rem)] relative">

              <div className="flex bg-indigo-600 p-4 justify-between items-center rounded-t-lg shrink-0 z-10">
                <h3 className="text-white font-bold text-lg">
                  {printType === 'PAYSLIPS' && "Print Bulk Payslips"}
                  {printType === 'PAYE' && "Generate PAYE Schedule"}
                  {printType === 'PENSION' && "Generate Pension Schedule"}
                  {printType === 'NSITF' && "Generate NSITF Schedule"}
                </h3>
                <div className="flex gap-2">
                  {printType !== 'PAYSLIPS' && (
                    <Button variant="secondary" size="sm" className="gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800" onClick={handleExportScheduleCSV} disabled={payslipsToPrint.length === 0}>
                      <Download className="h-4 w-4" /> Export CSV
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" className="gap-1" onClick={handlePrint} disabled={payslipsToPrint.length === 0}>
                    <Printer className="h-4 w-4" /> Print Document
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700" onClick={() => setPrintDialogOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden print-hide">
                {/* Filter Sidebar */}
                <div className="w-1/3 max-w-[300px] border-r border-slate-200 bg-white p-4 overflow-y-auto flex flex-col gap-6 hide-on-print shadow-sm z-10">
                  {/* Schedule type selector */}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1">Schedule Type</h4>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm mt-2"
                      value={printType}
                      onChange={(e) => setPrintType(e.target.value as any)}
                    >
                      {priv.canGenerate && <option value="PAYSLIPS">Bulk Payslips</option>}
                      {priv.canViewPayeSchedule && <option value="PAYE">PAYE Schedule</option>}
                      {priv.canViewPensionSchedule && <option value="PENSION">Pension Schedule</option>}
                      {priv.canViewNsitfSchedule && <option value="NSITF">NSITF Schedule</option>}
                    </select>
                  </div>

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

                  {/* Department filter */}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex justify-between items-center">
                      Filter by Department
                      <button
                        className="text-xs text-indigo-600 font-medium hover:underline"
                        onClick={() => { setPrintSelectedDepts([]); setPrintSelectedEmployees([]); }}
                      >
                        Clear
                      </button>
                    </h4>
                    <div className="space-y-2 mt-2">
                      {[...new Set(employees.filter(e => e.status === 'Active').map(e => e.department).filter(Boolean))].sort().map(dept => (
                        <label key={dept} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600"
                            checked={printSelectedDepts.includes(dept)}
                            onChange={(e) => {
                              const newDepts = e.target.checked
                                ? [...printSelectedDepts, dept]
                                : printSelectedDepts.filter(d => d !== dept);
                              setPrintSelectedDepts(newDepts);
                              // Auto-select employees in checked departments
                              if (newDepts.length > 0) {
                                const deptEmployeeIds = employees
                                  .filter(emp => emp.status === 'Active' && newDepts.includes(emp.department))
                                  .map(emp => emp.id);
                                setPrintSelectedEmployees(deptEmployeeIds);
                              } else {
                                setPrintSelectedEmployees([]);
                              }
                            }}
                          />
                          {dept}
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
                      {employees.filter(e => e.status === 'Active').sort((a, b) => (a.position || '').localeCompare(b.position || '')).map(emp => (
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
                          {emp.department && <span className="text-[10px] text-slate-400 ml-auto shrink-0">{emp.department}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-slate-200" id="print-area">
                  {payslipsToPrint.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-medium pb-20">
                      No records match your selection.
                    </div>
                  ) : printType === 'PAYSLIPS' ? (
                    payslipsToPrint.map((slip, i) => (
                      <div key={`${slip.monthKey}-${slip.record.id}`} className="bg-white p-10 mb-8 mx-auto shadow-sm max-w-3xl rounded-sm print-break">
                        {/* Company Header */}
                        <div className="border-b-2 border-indigo-600 pb-4 mb-6">
                          <img src={logoSrc} alt="Company Logo" className="h-12 w-auto mb-2" />
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
                              <tr><td className="py-2">Basic Salary</td><td className="py-2 text-right font-mono">{priv?.canViewAmounts === false ? '***' : slip.record.basicSalary.toLocaleString()}</td></tr>
                              {slip.record.housing > 0 && <tr><td className="py-2">Housing Allowance</td><td className="py-2 text-right font-mono">{priv?.canViewAmounts === false ? '***' : slip.record.housing.toLocaleString()}</td></tr>}
                              {slip.record.transport > 0 && <tr><td className="py-2">Transport Allowance</td><td className="py-2 text-right font-mono">{priv?.canViewAmounts === false ? '***' : slip.record.transport.toLocaleString()}</td></tr>}
                              {slip.record.otherAllowances > 0 && <tr><td className="py-2">Other Allowances</td><td className="py-2 text-right font-mono">{priv?.canViewAmounts === false ? '***' : slip.record.otherAllowances.toLocaleString()}</td></tr>}
                              {slip.record.overtime > 0 && <tr><td className="py-2">Overtime Pay</td><td className="py-2 text-right font-mono text-emerald-600">+{priv?.canViewAmounts === false ? '***' : slip.record.overtime.toLocaleString()}</td></tr>}
                              <tr className="border-t font-semibold"><td className="py-2">GROSS PAY</td><td className="py-2 text-right font-mono text-lg">{priv?.canViewAmounts === false ? '***' : slip.record.grossPay.toLocaleString()}</td></tr>
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
                              {slip.record.paye > 0 && <tr><td className="py-2">PAYE Tax</td><td className="py-2 text-right font-mono text-red-600">-{priv?.canViewAmounts === false ? '***' : slip.record.paye.toLocaleString()}</td></tr>}
                              {slip.record.loanRepayment > 0 && <tr><td className="py-2">Loan & Advance Repayment</td><td className="py-2 text-right font-mono text-red-600">-{priv?.canViewAmounts === false ? '***' : slip.record.loanRepayment.toLocaleString()}</td></tr>}
                              {slip.record.pension > 0 && <tr><td className="py-2">Pension Contribution</td><td className="py-2 text-right font-mono text-red-600">-{priv?.canViewAmounts === false ? '***' : slip.record.pension.toLocaleString()}</td></tr>}
                              <tr className="border-t font-semibold"><td className="py-2">TOTAL DEDUCTIONS</td><td className="py-2 text-right font-mono text-red-600 text-lg">-{priv?.canViewAmounts === false ? '***' : (slip.record.paye + slip.record.loanRepayment + slip.record.pension).toLocaleString()}</td></tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Net Pay */}
                        <div className="bg-emerald-50 p-6 rounded-lg border border-emerald-100">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-900">TAKE HOME PAY</span>
                            <span className="text-3xl font-bold text-emerald-700">₦{priv?.canViewAmounts === false ? '***' : slip.record.takeHomePay.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-4 border-t text-center text-xs text-slate-400">
                          <p>This is a computer-generated document. No signature required.</p>
                          <p>Generated on {new Date().toLocaleDateString()}</p>
                        </div>

                      </div>
                    ))
                  ) : printType === 'PAYE' || printType === 'PENSION' || printType === 'NSITF' ? (
                    <div className="bg-white p-10 mx-auto shadow-sm max-w-5xl rounded-sm print-break" id="print-area-content">
                      <div className="border-b-2 border-indigo-600 pb-4 mb-6" style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '16px', marginBottom: '24px' }}>
                        <div className="flex justify-between items-end" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <img src={logoSrc} alt="Company Logo" className="h-12 w-auto mb-2" style={{ height: '48px', width: 'auto', marginBottom: '8px' }} />
                            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900" style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a', margin: '0' }}>
                              {printType === 'PAYE' ? 'PAYE TAX SCHEDULE' : printType === 'PENSION' ? 'PENSION CONTRIBUTION SCHEDULE' : 'NSITF SCHEDULE'}
                            </h2>
                            <p className="text-sm text-slate-500 mt-1" style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', marginBottom: '0' }}>
                              Generated on {new Date().toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right" style={{ textAlign: 'right' }}>
                            <p className="font-semibold text-sm text-slate-600" style={{ fontWeight: 600, fontSize: '14px', color: '#475569', margin: '0' }}>Total Valid Records: {payslipsToPrint.filter(s => printType === 'PAYE' ? (s.record.staffType === 'INTERNAL' && !s.record.department.trim().toLowerCase().includes('adhoc')) : printType === 'PENSION' ? (s.record.staffType === 'INTERNAL' && !s.record.department.trim().toLowerCase().includes('adhoc')) : (s.record.nsitf > 0 && !s.record.department.trim().toLowerCase().includes('adhoc'))).length}</p>
                          </div>
                        </div>
                      </div>

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left bg-slate-50 border-b-2">
                            <th className="py-3 px-2 text-slate-600">S/N</th>
                            <th className="py-3 px-2 text-slate-600">Employee Name</th>
                            <th className="py-3 px-2 text-slate-600">Month</th>
                            {printType === 'PAYE' ? (
                              <>
                                <th className="py-3 px-2 text-right text-slate-600">Basic (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">Housing (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">Transport (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">Other (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">Gross Pay (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">PAYE Deducted (₦)</th>
                              </>
                            ) : printType === 'PENSION' ? (
                              <>
                                <th className="py-3 px-2 text-right text-slate-600">Pensionable Sum (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">Employee (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">Employer (₦)</th>
                                <th className="py-3 px-2 text-right font-bold text-slate-800">Total (₦)</th>
                              </>
                            ) : (
                              <>
                                <th className="py-3 px-2 text-right text-slate-600">Gross Pay (₦)</th>
                                <th className="py-3 px-2 text-right text-slate-600">NSITF Ratio (%)</th>
                                <th className="py-3 px-2 text-right font-bold text-slate-800">Amount (₦)</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
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
                                  <td className="py-2.5 px-2">{idx + 1}</td>
                                  <td className="py-2.5 px-2 font-medium">{slip.record.surname} {slip.record.firstname}</td>
                                  <td className="py-2.5 px-2 text-slate-500">{slip.monthLabel}</td>
                                  {printType === 'PAYE' ? (
                                    <>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.basicSalary)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.housing)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.transport)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.otherAllowances)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.grossPay)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-red-600">{fm(slip.record.paye)}</td>
                                    </>
                                  ) : printType === 'PENSION' ? (
                                    <>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(pSum)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono text-amber-600">{fm(slip.record.pension)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono text-indigo-600">{fm(slip.record.employerPension)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">{fm(slip.record.pension + slip.record.employerPension)}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-2.5 px-2 text-right font-mono">{fm(slip.record.grossPay)}</td>
                                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">{payrollVariables.nsitfRate}%</td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">{fm(slip.record.nsitf)}</td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-slate-50">
                            <td colSpan={3} className="py-3 px-2 text-right font-bold text-slate-700">GRAND TOTAL:</td>
                            {printType === 'PAYE' ? (
                              <>
                                <td className="py-3 px-2 text-right font-mono text-slate-600">{fm(payslipsToPrint.reduce((s, x) => s + x.record.basicSalary, 0))}</td>
                                <td className="py-3 px-2 text-right font-mono text-slate-600">{fm(payslipsToPrint.reduce((s, x) => s + x.record.housing, 0))}</td>
                                <td className="py-3 px-2 text-right font-mono text-slate-600">{fm(payslipsToPrint.reduce((s, x) => s + x.record.transport, 0))}</td>
                                <td className="py-3 px-2 text-right font-mono text-slate-600">{fm(payslipsToPrint.reduce((s, x) => s + x.record.otherAllowances, 0))}</td>
                                <td className="py-3 px-2 text-right font-mono font-bold">{fm(payslipsToPrint.reduce((s, x) => s + x.record.grossPay, 0))}</td>
                                <td className="py-3 px-2 text-right font-mono font-bold text-red-600">{fm(payslipsToPrint.reduce((s, x) => s + x.record.paye, 0))}</td>
                              </>
                            ) : printType === 'PENSION' ? (
                              <>
                                <td className="py-3 px-2 text-right font-mono font-bold text-slate-700">
                                  {fm(payslipsToPrint.reduce((s, x) => s + (x.record.pension > 0 ? (x.record.basicSalary + x.record.housing + x.record.transport) : 0), 0))}
                                </td>
                                <td className="py-3 px-2 text-right font-mono font-bold text-amber-600">
                                  {fm(payslipsToPrint.reduce((s, x) => s + x.record.pension, 0))}
                                </td>
                                <td className="py-3 px-2 text-right font-mono font-bold text-indigo-600">
                                  {fm(payslipsToPrint.reduce((s, x) => s + x.record.employerPension, 0))}
                                </td>
                                <td className="py-3 px-2 text-right font-mono font-bold text-emerald-700">
                                  {fm(payslipsToPrint.reduce((s, x) => s + (x.record.pension + x.record.employerPension), 0))}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 px-2 text-right font-mono font-bold text-slate-700">
                                  {fm(payslipsToPrint.reduce((s, x) => s + ((x.record.nsitf > 0 && x.record.department.trim().toLowerCase() !== 'adhoc staff') ? x.record.grossPay : 0), 0))}
                                </td>
                                <td className="py-3 px-2"></td>
                                <td className="py-3 px-2 text-right font-mono font-bold text-emerald-700">
                                  {fm(payslipsToPrint.reduce((s, x) => s + ((x.record.nsitf > 0 && x.record.department.trim().toLowerCase() !== 'adhoc staff') ? x.record.nsitf : 0), 0))}
                                </td>
                              </>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : null}
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

