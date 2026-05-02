import { formatDisplayDate, getPayrollPeriodDates } from '@/src/lib/dateUtils';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Input } from '@/src/components/ui/input';
import { Download, Upload, CreditCard, ChevronDown, X, Printer, MoreVertical } from 'lucide-react';
import { useAppStore, Employee } from '@/src/store/appStore';
import { computeWorkDays, computeWorkDaysInRange, MONTH_INDEX } from '@/src/lib/workdays';
import logoSrc from '../../logo/logo-2.png';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { calculateAttendanceMetrics } from '@/src/lib/attendanceLogic';
import { supabase } from '@/src/integrations/supabase/client';

interface PayrollRecord {
  id: string;
  employeeCode?: string;
  sn: number;
  surname: string;
  firstname: string;
  position: string;
  department: string;
  staffType: 'OFFICE' | 'FIELD' | 'NON-EMPLOYEE';
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
  withholdingTaxRate?: number;
  withholdingTax: boolean;
  hasPension?: boolean;
  taxId: string;
  status: 'Pending' | 'Processed';
}



import { getPositionIndex } from '@/src/lib/hierarchy';


const isPayeEligible = (r: PayrollRecord) => r.paye > 0 && r.staffType !== 'NON-EMPLOYEE' && !r.department.trim().toLowerCase().includes('adhoc');
const isPensionEligible = (r: PayrollRecord) => r.hasPension && r.staffType !== 'NON-EMPLOYEE' && !r.department.trim().toLowerCase().includes('adhoc');
const isNsitfEligible = (r: PayrollRecord) => r.nsitf > 0 && !r.department.trim().toLowerCase().includes('adhoc');

const currentYear = new Date().getFullYear();
const YEAR_RANGE_START = 2020;

const fm = (v: number) => typeof v === 'number' ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0';
const fmT = fm;

export function Payroll() {
  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const payeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const monthValues = useAppStore((state) => state.monthValues);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const departments = useAppStore((state) => state.departments);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const defaultMonthKey = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][new Date().getMonth()];
    return defaultMonthKey;
  });
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState('processing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSidebarOpen, setPrintSidebarOpen] = useState(false);
  const [printType, setPrintType] = useState<'PAYSLIPS' | 'PAYE' | 'PENSION' | 'NSITF' | 'WITHHOLDING'>('PAYSLIPS');
  const [printSelectedYear, setPrintSelectedYear] = useState(currentYear);
  const [printSelectedMonths, setPrintSelectedMonths] = useState<string[]>([]);
  const [printSelectedEmployees, setPrintSelectedEmployees] = useState<string[]>([]);
  const [printSelectedDepts, setPrintSelectedDepts] = useState<string[]>([]);
  const [printSelectedColumns, setPrintSelectedColumns] = useState<string[]>([]);
  const [printViewMode, setPrintViewMode] = useState<'LIST' | 'MATRIX'>('LIST');
  const [filterDept, setFilterDept] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [companyInfo, setCompanyInfo] = useState({ name: 'DEWATERING CONSTRUCTION ETC LIMITED', address: '', phone: '', email: '' });
  const [payslipTheme, setPayslipTheme] = useState<'MODERN' | 'CLASSIC' | 'FORMAL'>('MODERN');

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      const { data } = await supabase.from('app_settings').select('*');
      if (data) {
        const info = { name: '', address: '', phone: '', email: '' };
        data.forEach(setting => {
          if (setting.key === 'company_name') info.name = setting.value;
          if (setting.key === 'company_address') info.address = setting.value;
          if (setting.key === 'company_phone') info.phone = setting.value;
          if (setting.key === 'company_email') info.email = setting.value;
        });
        if (info.name) setCompanyInfo(prev => ({ ...prev, ...info }));
      }
    };
    fetchCompanyInfo();
  }, []);

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

  // Each column: id, label, summable (can be totalled), types it applies to ('all' or specific)
  const AVAILABLE_COLUMNS: Array<{ id: string; label: string; summable: boolean; types: string[] }> = [
    { id: 'sn',               label: 'S/N',               summable: false, types: ['all'] },
    { id: 'employee_name',    label: 'Employee Name',     summable: false, types: ['all'] },
    { id: 'month',            label: 'Month',             summable: false, types: ['all'] },
    { id: 'bank_name',        label: 'Bank Name',         summable: false, types: ['all'] },
    { id: 'account_number',   label: 'Account No',        summable: false, types: ['all'] },
    { id: 'paye_id',          label: 'PAYE ID',           summable: false, types: ['PAYE', 'PAYSLIPS'] },
    { id: 'pension_pin',      label: 'Pension Number',    summable: false, types: ['PENSION', 'PAYSLIPS'] },
    { id: 'main_salary',      label: 'Main Salary',       summable: true,  types: ['PAYSLIPS'] },
    { id: 'basic',            label: 'Basic Salary',      summable: true,  types: ['PAYE', 'PAYSLIPS'] },
    { id: 'housing',          label: 'Housing',           summable: true,  types: ['PAYE', 'PAYSLIPS'] },
    { id: 'transport',        label: 'Transport',         summable: true,  types: ['PAYE', 'PAYSLIPS'] },
    { id: 'other',            label: 'Other Allowances',  summable: true,  types: ['PAYE', 'PAYSLIPS'] },
    { id: 'overtime',         label: 'Overtime Pay',      summable: true,  types: ['PAYSLIPS'] },
    { id: 'gross',            label: 'Gross Pay',         summable: true,  types: ['PAYE', 'NSITF', 'PAYSLIPS'] },
    { id: 'paye',             label: 'PAYE Tax',          summable: true,  types: ['PAYE', 'PAYSLIPS'] },
    { id: 'loan',             label: 'Loan Repayment',    summable: true,  types: ['PAYSLIPS'] },
    { id: 'net_pay',          label: 'Net (Take-Home)',   summable: true,  types: ['PAYE', 'PAYSLIPS'] },
    { id: 'pensionable',      label: 'Pensionable Sum',   summable: true,  types: ['PENSION'] },
    { id: 'employee_pension', label: 'Employee Pension',  summable: true,  types: ['PENSION', 'PAYSLIPS'] },
    { id: 'employer_pension', label: 'Employer Pension',  summable: true,  types: ['PENSION'] },
    { id: 'total_pension',    label: 'Total Pension',     summable: true,  types: ['PENSION'] },
    { id: 'nsitf_rate',       label: 'NSITF Ratio',       summable: false, types: ['NSITF'] },
    { id: 'nsitf_amount',     label: 'NSITF Amount',      summable: true,  types: ['NSITF'] },
    { id: 'withholding_rate',  label: 'WHT Rate (%)',      summable: false, types: ['WITHHOLDING'] },
    { id: 'tin',               label: 'TIN',               summable: false, types: ['WITHHOLDING'] },
    { id: 'withholding',      label: 'Withholding Tax',   summable: true,  types: ['WITHHOLDING', 'PAYSLIPS'] },
  ];

  const DEFAULT_COLUMNS: Record<string, string[]> = {
    PAYSLIPS: ['employee_name', 'month', 'bank_name', 'account_number', 'main_salary', 'basic', 'housing', 'transport', 'other', 'overtime', 'gross', 'paye', 'loan', 'employee_pension', 'net_pay'],
    PAYE:    ['sn', 'employee_name', 'paye_id', 'month', 'bank_name', 'account_number', 'basic', 'housing', 'transport', 'other', 'gross', 'paye'],
    PENSION: ['sn', 'employee_name', 'pension_pin', 'month', 'bank_name', 'account_number', 'pensionable', 'employee_pension', 'employer_pension', 'total_pension'],
    NSITF:   ['sn', 'employee_name', 'month', 'bank_name', 'account_number', 'gross', 'nsitf_rate', 'nsitf_amount'],
    WITHHOLDING: ['sn', 'employee_name', 'tin', 'month', 'bank_name', 'account_number', 'gross', 'withholding_rate', 'withholding'],
  };

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

  const selectedMonthLabel = useMemo(() => months.find(m => m.key === selectedMonth)?.label || '', [selectedMonth, months]);


    // Calculate payroll logic extracted for multi-month generation capabilities
    const calculatePayrollForMonth = useCallback((monthKey: string, year: number = selectedYear) => {
      const mKey = monthKey as keyof typeof employees[0]['monthlySalaries'];
      const selectedMonthIndex = months.findIndex(m => m.key === monthKey) + 1;
      
      // Get custom payroll period dates
      const { start: periodStart, end: periodEnd } = getPayrollPeriodDates(year, selectedMonthIndex, payrollVariables.periodStartDay);

      // Auto-compute workdays divisor using the CALENDAR month (Jan 1 - Jan 31)
      const holidayDates = publicHolidays.map(h => h.date);
      const fallbackWorkdays = computeWorkDays(year, selectedMonthIndex, holidayDates, 6);

      const monthConfig = monthValues[mKey as keyof typeof monthValues] || { workDays: fallbackWorkdays, overtimeRate: 0.5 };
      const otRate = monthConfig.overtimeRate;

      let snCounter = 1;

      return employees
        .filter(e => {
          // Date-based eligibility using the CUSTOM payroll period boundaries
          if (e.startDate) {
            const empStart = new Date(e.startDate);
            if (empStart > periodEnd) return false;
          }
          if (e.endDate) {
            const empEnd = new Date(e.endDate);
            if (empEnd < periodStart) return false;
          }

          // If current status is not Active or On Leave, only show if they were active in the viewed month
          if (e.status !== 'Active' && e.status !== 'On Leave') {
             // For payroll history, we might want to see someone who was active but is now Terminated.
             // If endDate is empty, they should be Active.
             if (!e.endDate) return false;
          }

          // Frequency logic for Non-Employees (NON-EMPLOYEE)
          if (e.staffType === 'NON-EMPLOYEE') {
            const cycle = e.typeOfPay || 'Monthly';
            const startMonthLabel = e.startMonthOfPay || 'January';
            const startIdx = months.findIndex(m => m.label === startMonthLabel);
            const currentIdx = months.findIndex(m => m.key === monthKey);

            if (startIdx !== -1 && currentIdx !== -1) {
              const diff = currentIdx - startIdx;
              if (diff < 0) return false; // Not yet started in this year cycle

              if (cycle === 'Quarterly') return diff % 3 === 0;
              if (cycle === 'Half Year') return diff % 6 === 0;
              if (cycle === 'Yearly') return diff % 12 === 0;
            }
          }
          return true;
        })
        .sort((a, b) => {
          const idxA = getPositionIndex(a.position);
          const idxB = getPositionIndex(b.position);
          if (idxA !== idxB) return idxA - idxB;
          return (a.position || '').localeCompare(b.position || '');
        })
        .map((emp) => {
          let whtRateToStore = 0;
          const standardSalary = emp.monthlySalaries[mKey] || 0;

          const defaultDays = emp.staffType === 'FIELD' ? 6 : 5;
          // Use workDaysPerWeek from the departments table (set in Variables page) as the authoritative source
          const deptRecord = departments.find(d => d.name === emp.department);
          const empWorkDaysPerWeek = deptRecord?.workDaysPerWeek ?? defaultDays;
          const empOfficialWorkdays = computeWorkDays(year, selectedMonthIndex, holidayDates, empWorkDaysPerWeek);

          // Ã¢â€â‚¬Ã¢â€â‚¬ Attendance tallies Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
          let daysWorked = 0; // days where day === 'Yes'
          let daysAbsent = 0; // days where attendance record exists AND day === 'No'
          let totalOTInstances = 0;

          for (const r of attendanceRecords) {
            if (!r.date || r.staffId !== emp.id) continue;
            
            const recordDate = new Date(r.date + 'T12:00:00'); // Normalize to noon for comparison
            if (recordDate >= periodStart && recordDate <= periodEnd) {
              const metrics = calculateAttendanceMetrics(r, holidayDates, payrollVariables, monthValues as any, attendanceRecords);
              
              if (metrics.ot > 0) totalOTInstances += 1;

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

            const isFieldStaff = emp.staffType === 'FIELD';

            // ── Pro-rata for mid-month joiners ──────────────────────────────
            // If this employee's startDate falls inside the current payroll month
            // (and they didn't join on the 1st), scale their salary down to only
            // cover the workdays from their joining date → end of month.
            // We do NOT mark earlier days as absent — those days pre-date employment.
            let salaryBase = standardSalary;
            if (emp.startDate) {
              const empJoin = new Date(emp.startDate);
              const isJoinWithinPeriod = empJoin > periodStart && empJoin <= periodEnd;
              if (isJoinWithinPeriod) {
                // Workdays available FROM the joining date to end of CUSTOM period
                const workdaysFromJoin = computeWorkDaysInRange(
                  empJoin > periodStart ? empJoin : periodStart,
                  periodEnd,
                  holidayDates,
                  empWorkDaysPerWeek
                );
                // Pro-rate: only pay for the fraction of the cycle they were employed
                salaryBase = standardSalary * (workdaysFromJoin / empOfficialWorkdays);
              }
            }

            if (isFieldStaff) {
              // Field staff: paid only for days actually attended
              salary = dailyRate * daysWorked;
            } else {
              // Office / Non-Employee staff: pro-rated base, deduct explicit absent days
              salary = salaryBase - (dailyRate * daysAbsent);
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

          // Determine pension eligibility: use subjectToPension if explicitly set, else fall back to payeTax
          const hasPension = (emp.subjectToPension !== undefined && emp.subjectToPension !== null)
            ? (emp.subjectToPension && emp.staffType !== 'NON-EMPLOYEE')
            : (emp.payeTax && emp.staffType !== 'NON-EMPLOYEE');

          // PENSION deduction (on pensionSum, not totalAllowances)
          const pension = hasPension ? pensionSum * (payrollVariables.employeePensionRate / 100) : 0;

          // Ã¢â€â‚¬Ã¢â€â‚¬ PAYE calculation matching Excel formula exactly: Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
          // Ã¢â€ â‚¬Ã¢â€ â‚¬ PAYE calculation matching Excel formula exactly: Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬
          // =IF(payeTax="Yes", NIGERIATAX(salary, SUM(Basic:Transport), overtime, rentRelief),
          //    IF(withholdingTax="Yes", salary * withholdingTaxRate, 0))
          let paye = 0;
          if (emp.payeTax) {
            const tv = payeTaxVariables;
            const annualGross = (salary * 12) + overtime;
            const pensionAmt = hasPension ? (pensionSum * 12) * (payrollVariables.employeePensionRate / 100) : 0;
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
            let remainingTaxable = annualTaxable;
            let previousLimit = 0;

            if (annualTaxable > 0) {
              // Sort brackets by limit to ensure correct progressive application
              const sortedBrackets = [...tv.taxBrackets].sort((a, b) => {
                if (a.upTo === null) return 1;
                if (b.upTo === null) return -1;
                return a.upTo - b.upTo;
              });

              for (const bracket of sortedBrackets) {
                if (remainingTaxable <= 0) break;

                let taxableInBucket = 0;
                if (bracket.upTo === null) {
                  // Top bracket
                  taxableInBucket = remainingTaxable;
                } else {
                  // Current bracket limit minus previous limit gives the chunk size for this rate
                  const bracketSize = bracket.upTo - previousLimit;
                  taxableInBucket = Math.min(remainingTaxable, bracketSize);
                  previousLimit = bracket.upTo;
                }

                annualTax += taxableInBucket * bracket.rate;
                remainingTaxable -= taxableInBucket;
              }
            }

            paye = annualTax / 12;
          } else if (emp.withholdingTax) {
            // Use the individual consultant's tax rate, defaulting to 5%
            const whtRate = emp.withholdingTaxRate ?? 0.05;
            paye = salary * whtRate;
            whtRateToStore = whtRate;
          }

          // LOAN REPAYMENT: Sum of Advances and Monthly Repayments
          const empAdvances = salaryAdvances.filter(a => {
            if (a.employeeId !== emp.id) return false;
            if (a.status !== 'Approved' && a.status !== 'Deducted') return false;
            if (!a.requestDate) return false;
            const advanceDate = new Date(a.requestDate + 'T12:00:00');
            return advanceDate >= periodStart && advanceDate <= periodEnd;
          });
          const advanceDeduction = empAdvances.reduce((sum, a) => sum + a.amount, 0);

          const empLoans = loans.filter(l => {
            if (l.employeeId !== emp.id) return false;
            if (l.status !== 'Active' && l.status !== 'Completed' && l.status !== 'Approved') return false;
            if (!l.paymentStartDate) return false;
            
            // Check if the current payroll period falls within the loan duration
            const loanStart = new Date(l.paymentStartDate + 'T12:00:00');
            // Normalize both to months since year 0 for easy comparison
            const periodStartMonth = year * 12 + selectedMonthIndex - 1;
            const loanStartMonth = loanStart.getFullYear() * 12 + loanStart.getMonth();
            const monthsElapsed = periodStartMonth - loanStartMonth;
            
            return monthsElapsed >= 0 && monthsElapsed < l.duration;
          });
          const loanDeduction = empLoans.reduce((sum, l) => sum + l.monthlyDeduction, 0);

          const loanRepayment = advanceDeduction + loanDeduction;

          // TAKE HOME PAY: GROSS PAY - (PAYE + LOAN REPAYMENT + PENSION)
          const takeHomePay = grossPay - (paye + loanRepayment + pension);

          const employerPension = hasPension ? pensionSum * (payrollVariables.employerPensionRate / 100) : 0;
          const nsitf = emp.payeTax ? grossPay * (payrollVariables.nsitfRate / 100) : 0;

          return {
            id: emp.id,
            employeeCode: emp.employeeCode,
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
            hasPension,
            takeHomePay,
            withholdingTaxRate: whtRateToStore,
            withholdingTax: !!emp.withholdingTax,
            taxId: emp.taxId || '',
            status: 'Pending' as const,
          };
        });
    }, [employees, salaryAdvances, loans, payrollVariables, monthValues, attendanceRecords, months, selectedYear, payeTaxVariables, publicHolidays]);

    // Derive standard display payload
    const payrollData = useMemo(() => calculatePayrollForMonth(selectedMonth), [calculatePayrollForMonth, selectedMonth]);

    // Derived filtered print dataset
    const payslipsToPrint = useMemo(() => {
      if (!printType) return [];
      let slips: Array<{ monthLabel: string, monthKey: string, record: PayrollRecord }> = [];
      const monthsToUse = printSelectedMonths.length > 0 ? printSelectedMonths : [selectedMonth];

      monthsToUse.forEach(mKey => {
        const mLabel = months.find(m => m.key === mKey)?.label || mKey;
        const data = calculatePayrollForMonth(mKey, printSelectedYear);
        data.forEach(record => {
          // Now empty printSelectedEmployees means NONE (explicit list always used)
          if (printSelectedEmployees.length > 0 && printSelectedEmployees.includes(record.id)) {
            slips.push({ monthLabel: mLabel, monthKey: mKey, record });
          }
        });
      });
      return slips;
    }, [printType, printSelectedMonths, printSelectedEmployees, calculatePayrollForMonth, selectedMonth, months]);

    // Calculate totals
    const totals = useMemo(() => {
      const totalSalary = payrollData.reduce((sum, p) => sum + p.salary, 0);
      const totalOvertime = payrollData.reduce((sum, p) => sum + p.overtime, 0);
      const totalGross = payrollData.reduce((sum, p) => sum + p.grossPay, 0);
      const totalPAYE = payrollData.reduce((sum, p) => sum + p.paye, 0);
      const totalLoans = payrollData.reduce((sum, p) => sum + p.loanRepayment, 0);
      const totalPension = payrollData.reduce((sum, p) => sum + p.pension, 0);
      const totalWithholding = payrollData.filter(p => p.staffType === 'NON-EMPLOYEE').reduce((sum, p) => sum + p.paye, 0);
      const totalDeductions = totalPAYE + totalLoans + totalPension;
      const totalNet = payrollData.reduce((sum, p) => sum + p.takeHomePay, 0);
      return { totalSalary, totalOvertime, totalGross, totalPAYE, totalLoans, totalPension, totalWithholding, totalDeductions, totalNet, employeeCount: payrollData.length };
    }, [payrollData]);

    const handleProcess = () => {
      setIsProcessing(true);
      setTimeout(() => setIsProcessing(false), 2000);
    };

    const handleOpenPrintDialog = (type: 'PAYSLIPS' | 'PAYE' | 'PENSION' | 'NSITF' | 'WITHHOLDING') => {
      setPrintSelectedMonths([selectedMonth]);
      setPrintSelectedYear(selectedYear);
      // Seed with ALL active employee IDs so all checkboxes appear checked
      const isExcludeNonEmp = type === 'PAYSLIPS' || type === 'PAYE' || type === 'PENSION' || type === 'NSITF';
      const isOnlyNonEmp = type === 'WITHHOLDING';
      setPrintSelectedEmployees(employees.filter(e => {
        if (e.status !== 'Active' && e.status !== 'On Leave') return false;
        const isNonEmp = e.staffType === 'NON-EMPLOYEE' || e.department?.toUpperCase() === 'NON-EMPLOYEE' || e.department?.toUpperCase() === 'BENEFICIARY';
        if (isExcludeNonEmp && isNonEmp) return false;
        if (isOnlyNonEmp && !isNonEmp) return false;
        return true;
      }).map(e => e.id));
      setPrintType(type);
      setPrintDialogOpen(true);
      setPrintSelectedColumns(DEFAULT_COLUMNS[type] || []);
    };

    // Build self-contained HTML for every payslip so all appear in one print job
    const currency = (n: number) => '₦' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // Column visibility helper – gates each field against the user's checkbox selections
    const col = (id: string) => printSelectedColumns.includes(id);

    // Per-slip HTML builder — branches on payslipTheme for 3 distinct layouts
    const buildSlipHtml = (slip: typeof payslipsToPrint[0], i: number) => {
      const isLast = i === payslipsToPrint.length - 1;
      const name = `${slip.record.firstname} ${slip.record.surname}`;
      const period = `${slip.monthLabel} ${printSelectedYear}`;
      const totalDeductions = slip.record.paye + slip.record.loanRepayment + slip.record.pension;

      // ── Shared row builders (respect column filter) ──────────────────
      const earningsRows = [
        col('main_salary') ? `<tr><td>Main Salary</td><td class="text-right">${currency(slip.record.salary)}</td></tr>` : '',
        col('basic') ? `<tr><td>Basic Salary</td><td class="text-right">${currency(slip.record.basicSalary)}</td></tr>` : '',
        col('housing') && slip.record.housing > 0 ? `<tr><td>Housing Allowance</td><td class="text-right">${currency(slip.record.housing)}</td></tr>` : '',
        col('transport') && slip.record.transport > 0 ? `<tr><td>Transport Allowance</td><td class="text-right">${currency(slip.record.transport)}</td></tr>` : '',
        col('other') && slip.record.otherAllowances > 0 ? `<tr><td>Other Allowances</td><td class="text-right">${currency(slip.record.otherAllowances)}</td></tr>` : '',
        col('overtime') && slip.record.overtime > 0 ? `<tr><td>Overtime Pay</td><td class="text-right">${currency(slip.record.overtime)}</td></tr>` : '',
      ].filter(Boolean).join('');

      const grossRow = col('gross') ? `<tr class="sum"><td>GROSS PAY</td><td class="text-right">${currency(slip.record.grossPay)}</td></tr>` : '';

      const deductionRows = [
        col('paye') && slip.record.paye > 0 ? `<tr><td>PAYE Tax</td><td class="text-right">-${currency(slip.record.paye)}</td></tr>` : '',
        col('loan') && slip.record.loanRepayment > 0 ? `<tr><td>Loan &amp; Advance</td><td class="text-right">-${currency(slip.record.loanRepayment)}</td></tr>` : '',
        col('employee_pension') && slip.record.pension > 0 ? `<tr><td>Pension</td><td class="text-right">-${currency(slip.record.pension)}</td></tr>` : '',
        col('withholding') && slip.record.withholdingTax && slip.record.paye > 0 ? `<tr><td>Withholding Tax</td><td class="text-right">-${currency(slip.record.paye)}</td></tr>` : '',
      ].filter(Boolean).join('');

      const deductionsTotalRow = `<tr class="sum"><td>TOTAL DEDUCTIONS</td><td class="text-right">-${currency(totalDeductions)}</td></tr>`;
      const netPayBlock = col('net_pay') ? `<div class="net-pay"><span>TAKE HOME PAY</span><span>${currency(slip.record.takeHomePay)}</span></div>` : '';

      const bankInfoRows = [
        col('bank_name') ? `<tr><td>Bank:</td><td>${slip.record.bankName}</td></tr>` : '',
        col('account_number') ? `<tr><td>Account:</td><td>${slip.record.accountNo}</td></tr>` : '',
        col('paye_id') && slip.record.taxId ? `<tr><td>Tax ID (TIN):</td><td>${slip.record.taxId}</td></tr>` : '',
      ].filter(Boolean).join('');

      // ── CLASSIC theme ─────────────────────────────────────────────────
      if (payslipTheme === 'CLASSIC') {
        return `
        <div class="payslip${isLast ? ' last' : ''}">
          <div class="classic-header">
            <div class="classic-logo-area"><img src="${logoSrc}" alt="Logo" style="height:64px;width:auto;" /></div>
            <div class="classic-company-info">
              <h1 class="classic-company-name">${companyInfo.name}</h1>
              <p class="classic-company-sub">${companyInfo.address}</p>
              ${companyInfo.phone ? `<p class="classic-company-sub">Tel: ${companyInfo.phone}</p>` : ''}
              ${companyInfo.email ? `<p class="classic-company-sub">Email: ${companyInfo.email}</p>` : ''}
            </div>
          </div>
          <div class="classic-title-bar"><span>EMPLOYEE PAY STATEMENT</span><span>${period}</span></div>
          <div class="classic-info-grid">
            <table class="info-table">
              <tr><td>Employee Name:</td><td><strong>${name}</strong></td></tr>
              <tr><td>Employee ID:</td><td>${slip.record.employeeCode || slip.record.id}</td></tr>
              <tr><td>Position:</td><td>${slip.record.position}</td></tr>
              <tr><td>Department:</td><td>${slip.record.department}</td></tr>
            </table>
            <table class="info-table">${bankInfoRows}</table>
          </div>
          <div class="classic-body">
            <table class="classic-section-table">
              <thead><tr><th>EARNINGS</th><th class="text-right">AMOUNT (₦)</th></tr></thead>
              <tbody>${earningsRows}${grossRow}</tbody>
            </table>
            <table class="classic-section-table">
              <thead><tr><th>DEDUCTIONS</th><th class="text-right">AMOUNT (₦)</th></tr></thead>
              <tbody>${deductionRows}${deductionsTotalRow}</tbody>
            </table>
          </div>
          <div class="classic-spacer"></div>
          ${netPayBlock}
          <div class="classic-footer">
            <p>This is a computer-generated payslip. Please retain for your records.</p>
            <p>Generated: ${formatDisplayDate(Date.now())}</p>
          </div>
        </div>`;
      }

      // ── FORMAL theme ──────────────────────────────────────────────────
      if (payslipTheme === 'FORMAL') {
        return `
        <div class="payslip${isLast ? ' last' : ''}">
          <div class="formal-header">
            <img src="${logoSrc}" alt="Logo" style="height:52px;width:auto;" />
            <div class="formal-header-text">
              <div class="formal-company">${companyInfo.name}</div>
              <div class="formal-subtitle">PAYROLL ADVICE — ${period}</div>
              ${companyInfo.address ? `<div class="formal-address">${companyInfo.address}</div>` : ''}
            </div>
          </div>
          <table class="formal-info-table">
            <tbody>
              <tr>
                <td><label>Name</label><span>${name}</span></td>
                <td><label>Employee ID</label><span>${slip.record.employeeCode || slip.record.id}</span></td>
                <td><label>Position</label><span>${slip.record.position}</span></td>
              </tr>
              <tr>
                ${col('bank_name') ? `<td><label>Bank</label><span>${slip.record.bankName}</span></td>` : '<td></td>'}
                ${col('account_number') ? `<td><label>Account No.</label><span>${slip.record.accountNo}</span></td>` : '<td></td>'}
                ${col('paye_id') && slip.record.taxId ? `<td><label>Tax ID (TIN)</label><span>${slip.record.taxId}</span></td>` : '<td></td>'}
              </tr>
            </tbody>
          </table>
          <div class="formal-columns">
            <div class="formal-col">
              <div class="formal-col-header">EARNINGS</div>
              <table class="formal-breakdown">
                <tbody>${earningsRows}</tbody>
                <tfoot><tr class="sum"><td>Gross Pay</td><td class="text-right">${col('gross') ? currency(slip.record.grossPay) : '—'}</td></tr></tfoot>
              </table>
            </div>
            <div class="formal-col">
              <div class="formal-col-header">DEDUCTIONS</div>
              <table class="formal-breakdown">
                <tbody>${deductionRows}</tbody>
                <tfoot><tr class="sum"><td>Total Deductions</td><td class="text-right">-${currency(totalDeductions)}</td></tr></tfoot>
              </table>
            </div>
          </div>
          <div class="formal-spacer"></div>
          ${col('net_pay') ? `<div class="formal-net"><span class="formal-net-label">NET PAY</span><span class="formal-net-amount">${currency(slip.record.takeHomePay)}</span></div>` : ''}
          <div class="formal-footer">
            <span>Computer-generated payslip. Please retain for your records.</span>
            <span>Generated on ${formatDisplayDate(Date.now())}</span>
          </div>
        </div>`;
      }

      // ── MODERN theme (default) ────────────────────────────────────────
      return `
      <div class="payslip${isLast ? ' last' : ''}">
        <div class="header">
          <img src="${logoSrc}" alt="Company Logo" style="height: 48px; width: auto; margin-bottom: 8px;" />
          <h2>${companyInfo.name}</h2>
          <p>Employee Payslip &ndash; ${period}</p>
          ${companyInfo.address ? `<p style="font-size:12px;color:#94a3b8;margin:2px 0 0;">${companyInfo.address}</p>` : ''}
        </div>
        <div class="two-col">
          <table class="info-table">
            <tr><td>Name:</td><td><strong>${name}</strong></td></tr>
            <tr><td>ID:</td><td>${slip.record.employeeCode || slip.record.id}</td></tr>
            <tr><td>Position:</td><td>${slip.record.position}</td></tr>
          </table>
          <table class="info-table">${bankInfoRows}</table>
        </div>
        <table class="breakdown-table">
          <thead><tr><th>Earnings</th><th class="text-right">Amount (₦)</th></tr></thead>
          <tbody>${earningsRows}${grossRow}</tbody>
        </table>
        <table class="breakdown-table">
          <thead><tr><th>Deductions</th><th class="text-right">Amount (₦)</th></tr></thead>
          <tbody>${deductionRows}${deductionsTotalRow}</tbody>
        </table>
        ${netPayBlock}
        <div class="footer">This is a system generated payslip. No signature is required. Generated on ${formatDisplayDate(Date.now())}</div>
      </div>`;
    };

    const slipsHtml = payslipsToPrint.map((slip, i) => buildSlipHtml(slip, i)).join('');

    // ── Theme-specific CSS ───────────────────────────────────────────────
    const themeStyles = payslipTheme === 'CLASSIC' ? `
      @page { size: A4 portrait; margin: 14mm 16mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body, .preview-payslips-wrapper { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }
      .payslip { page-break-after: always; width: 100%; min-height: 269mm; display: flex; flex-direction: column; padding: 22px 28px; border: 1px solid #ccc; }
      .payslip.last { page-break-after: auto; }
      .classic-header { display: flex; align-items: center; gap: 24px; padding-bottom: 16px; border-bottom: 3px double #1a1a1a; margin-bottom: 16px; }
      .classic-company-name { margin: 0 0 5px; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .classic-company-sub { margin: 2px 0 0; font-size: 11.5px; color: #555; }
      .classic-title-bar { background: #1a1a1a; color: #fff; display: flex; justify-content: space-between; padding: 9px 14px; font-size: 12.5px; font-weight: bold; letter-spacing: 1px; margin-bottom: 18px; text-transform: uppercase; }
      .classic-info-grid { display: flex; gap: 32px; margin-bottom: 20px; }
      .info-table { flex: 1; font-size: 12.5px; border-collapse: collapse; }
      .info-table td { padding: 7px 8px; border: 1px solid #ddd; }
      .info-table td:first-child { font-weight: bold; background: #f5f5f5; width: 42%; }
      .classic-body { display: flex; gap: 24px; margin-bottom: 0; }
      .classic-section-table { flex: 1; border-collapse: collapse; font-size: 13px; height: fit-content; }
      .classic-section-table thead th { background: #2c2c2c; color: #fff; padding: 9px 10px; text-align: left; font-size: 11.5px; letter-spacing: 0.5px; }
      .classic-section-table td { padding: 8px 10px; border-bottom: 1px solid #eee; }
      .classic-section-table tr.sum td { font-weight: bold; border-top: 2px solid #333; background: #f4f4f4; padding: 10px; }
      .text-right { text-align: right !important; }
      .classic-spacer { flex: 1; }
      .net-pay { border: 2.5px solid #1a1a1a; padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; margin: 18px 0 16px; }
      .net-pay span:first-child { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
      .net-pay span:last-child { font-size: 22px; font-weight: bold; font-family: 'Courier New', monospace; }
      .classic-footer { border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #888; font-style: italic; }
    ` : payslipTheme === 'FORMAL' ? `
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body, .preview-payslips-wrapper { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; }
      .payslip { page-break-after: always; width: 100%; min-height: 297mm; display: flex; flex-direction: column; padding: 0; }
      .payslip.last { page-break-after: auto; }
      .formal-header { display: flex; align-items: center; gap: 18px; background: #0f172a; color: #fff; padding: 22px 28px; }
      .formal-header-text { flex: 1; }
      .formal-company { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .formal-subtitle { font-size: 11.5px; color: #9bb8d8; margin-top: 4px; letter-spacing: 1px; }
      .formal-address { font-size: 10.5px; color: #7a98b8; margin-top: 3px; }
      .formal-info-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #c8d8e8; }
      .formal-info-table td { padding: 13px 28px; border-right: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; width: 33.3%; }
      .formal-info-table td:last-child { border-right: none; }
      .formal-info-table label { display: block; font-size: 10px; color: #7a98b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .formal-info-table span { font-weight: 600; font-size: 13.5px; color: #1a1a2e; }
      .formal-columns { display: flex; border-top: 3px solid #0f172a; }
      .formal-col { flex: 1; padding: 18px 28px 22px; }
      .formal-col:first-child { border-right: 1px solid #e2e8f0; }
      .formal-col-header { font-size: 11px; font-weight: bold; letter-spacing: 1.2px; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
      .formal-breakdown { width: 100%; border-collapse: collapse; font-size: 13px; }
      .formal-breakdown tbody td { padding: 8px 0; border-bottom: 1px solid #eaeff5; }
      .formal-breakdown tfoot td { padding: 10px 0; font-weight: bold; border-top: 2px solid #0f172a; font-size: 13.5px; }
      .formal-breakdown tr.sum td { font-weight: bold; }
      .text-right { text-align: right !important; }
      .formal-spacer { flex: 1; }
      .formal-net { background: #0f172a; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
      .formal-net-label { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; }
      .formal-net-amount { font-size: 26px; font-weight: bold; font-family: 'Courier New', monospace; }
      .formal-footer { display: flex; justify-content: space-between; font-size: 10px; color: #888; padding: 10px 28px; background: #f8fafc; }
    ` : `
      body, .preview-payslips-wrapper { font-family: sans-serif; color: #333; }
      .payslip { page-break-after: always; max-width: 800px; margin: 0 auto; padding: 20px; }
      .payslip.last { page-break-after: auto; }
      .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
      .header h2 { margin: 0 0 4px; color: #1e293b; font-size: 18px; }
      .header p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
      .two-col { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
      .info-table { flex: 1; font-size: 14px; border-collapse: collapse; }
      .info-table td { padding: 4px 0; border: none; }
      .info-table td:first-child { color: #64748b; width: 90px; }
      .breakdown-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
      .breakdown-table th { background: #f8fafc; text-align: left; padding: 8px; border-bottom: 1px solid #cbd5e1; }
      .breakdown-table td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
      .breakdown-table .sum { font-weight: bold; font-size: 15px; }
      .breakdown-table .sum td { border-top: 1px solid #94a3b8; border-bottom: none; }
      .text-right { text-align: right !important; }
      .net-pay { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
      .net-pay span:first-child { font-size: 16px; font-weight: bold; color: #1e293b; }
      .net-pay span:last-child { font-size: 22px; font-weight: bold; color: #15803d; font-family: monospace; }
      .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 11px; color: #94a3b8; }
    `;

    const handlePrint = () => {
      if (!payslipsToPrint || payslipsToPrint.length === 0) return;

      if (printType === 'PAYE' || printType === 'PENSION' || printType === 'NSITF' || printType === 'WITHHOLDING') {
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

      const slipsHtml = payslipsToPrint.map((slip, i) => buildSlipHtml(slip, i)).join('');
      const html = `
    <!DOCTYPE html>
    <html><head>
      <title>Print Bulk Payslips</title>
      <style>${themeStyles}</style>
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

    const handleExportScheduleCSV = (customType?: 'PAYSLIPS' | 'PAYE' | 'PENSION' | 'NSITF' | 'WITHHOLDING') => {
      let csvStr = '';
      const fmCSV = (n: number) => n.toFixed(2);
      
      const typeToExport = customType || printType;
      
      // When called from the main page (not print dialog), build slips from payrollData for the current month
      const sourceSlips: Array<{ monthLabel: string; monthKey: string; record: PayrollRecord }> =
        printDialogOpen && payslipsToPrint.length > 0
          ? payslipsToPrint
          : payrollData.map(record => ({ monthLabel: selectedMonthLabel, monthKey: selectedMonth, record }));

      // Helpers for CSV eligibility
      const csvPayeOk  = (r: PayrollRecord) => r.staffType !== 'NON-EMPLOYEE' && !r.department.trim().toLowerCase().includes('adhoc');
      const csvPenOk   = (r: PayrollRecord) => r.hasPension && r.staffType !== 'NON-EMPLOYEE' && !r.department.trim().toLowerCase().includes('adhoc');
      const csvNsitfOk = (r: PayrollRecord) => r.nsitf > 0 && !r.department.trim().toLowerCase().includes('adhoc');

      if (typeToExport === 'PAYE') {
        csvStr = 'S/N,Employee Name,Month,Basic Salary (₦),Housing (₦),Transport (₦),Other Allowances (₦),Gross Pay (₦),PAYE Deducted (₦)\n';
        let sn = 1;
        sourceSlips.forEach(slip => {
          if (csvPayeOk(slip.record)) {
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.monthLabel}","${fmCSV(slip.record.basicSalary)}","${fmCSV(slip.record.housing)}","${fmCSV(slip.record.transport)}","${fmCSV(slip.record.otherAllowances)}","${fmCSV(slip.record.grossPay)}","${fmCSV(slip.record.paye)}"\n`;
          }
        });
      } else if (typeToExport === 'PENSION') {
        csvStr = 'S/N,Employee Name,Month,Pensionable Sum (₦),Employee Contrib. (₦),Employer Contrib. (₦),Total Contrib. (₦)\n';
        let sn = 1;
        sourceSlips.forEach(slip => {
          if (csvPenOk(slip.record)) {
            const penSum = slip.record.basicSalary + slip.record.housing + slip.record.transport;
            const totalPen = slip.record.pension + slip.record.employerPension;
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.monthLabel}","${fmCSV(penSum)}","${fmCSV(slip.record.pension)}","${fmCSV(slip.record.employerPension)}","${fmCSV(totalPen)}"\n`;
          }
        });
      } else if (typeToExport === 'NSITF') {
        csvStr = 'S/N,Employee Name,Month,Gross Pay (₦),Rate (%),NSITF (₦)\n';
        let sn = 1;
        sourceSlips.forEach(slip => {
          if (csvNsitfOk(slip.record)) {
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.monthLabel}","${fmCSV(slip.record.grossPay)}","${payrollVariables.nsitfRate}","${fmCSV(slip.record.nsitf)}"\n`;
          }
        });
      } else if (typeToExport === 'WITHHOLDING') {
        csvStr = 'S/N,Employee Name,TIN,Month,Gross Pay (₦),Rate (%),Withholding Tax (₦)\n';
        let sn = 1;
        sourceSlips.forEach(slip => {
          if (slip.record.staffType === 'NON-EMPLOYEE') {
            const whtRate = slip.record.withholdingTaxRate ? (slip.record.withholdingTaxRate * 100).toFixed(1) + '%' : '5%';
            csvStr += `"${sn++}","${slip.record.surname} ${slip.record.firstname}","${slip.record.taxId || ''}","${slip.monthLabel}","${fmCSV(slip.record.grossPay)}","${whtRate}","${fmCSV(slip.record.paye)}"\n`;
          }
        });
      } else {
        csvStr = 'S/N,Surname,Firstname,Job Title,Bank,Account No,Salary (₦),Basic Salary (₦),Housing (₦),Transport (₦),Other Allowances (₦),Total Allowances (₦),Overtime (₦),Gross Pay (₦),PAYE Tax (₦),Loan Repayment (₦),Pension (₦),Net Pay (₦),Month\n';
        let sn = 1;
        sourceSlips.forEach(slip => {
          csvStr += `"${sn++}","${slip.record.surname}","${slip.record.firstname}","${slip.record.position || ''}","${slip.record.bankName}","${slip.record.accountNo}","${fmCSV(slip.record.salary)}","${fmCSV(slip.record.basicSalary)}","${fmCSV(slip.record.housing)}","${fmCSV(slip.record.transport)}","${fmCSV(slip.record.otherAllowances)}","${fmCSV(slip.record.totalAllowances)}","${fmCSV(slip.record.overtime)}","${fmCSV(slip.record.grossPay)}","${fmCSV(slip.record.paye)}","${fmCSV(slip.record.loanRepayment)}","${fmCSV(slip.record.pension)}","${fmCSV(slip.record.takeHomePay)}","${slip.monthLabel}"\n`;
        });
      }
      
      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      let mLabel = selectedMonth;
      if (printDialogOpen && printSelectedMonths.length > 0) {
        if (printSelectedMonths.length === 1) mLabel = printSelectedMonths[0];
        else if (printSelectedMonths.length > 1) mLabel = `${printSelectedMonths[0]}_to_${printSelectedMonths[printSelectedMonths.length-1]}`;
      }
      
      const yrLabel = printDialogOpen ? printSelectedYear : selectedYear;
      
      link.setAttribute('download', `${typeToExport}_Schedule_${mLabel}_${yrLabel}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const activeTabTitle =
      activeTab === 'processing' ? 'Payroll Processing' :
      activeTab === 'paye' ? 'PAYE Schedule' :
      activeTab === 'pension' ? 'Pension Schedule' :
      activeTab === 'nsitf' ? 'NSITF Schedule' :
      'Withholding Schedule';

    useSetPageTitle(
      activeTabTitle,
      'Manage salaries, taxes, generate payslips, and handle staff advances and loans',
      <>
        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map(month => (
              <option key={month.key} value={month.key}>{month.label}</option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 mr-2"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {Array.from({ length: currentYear - YEAR_RANGE_START + 2 }, (_, i) => YEAR_RANGE_START + i).map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
          
          {priv.canGenerate && (
            <Button variant="outline" size="sm" className="h-9 w-9 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm" onClick={() => handleOpenPrintDialog(activeTab === 'processing' ? 'PAYSLIPS' : activeTab.toUpperCase() as any)} title={`Print ${activeTab === 'processing' ? 'Payslips' : 'Schedule'}`}>
              <Printer className="h-5 w-5" />
            </Button>
          )}
          {finRepPriv?.canExport && activeTab === 'processing' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700" title="Export CSV">
                  <Upload className="h-5 w-5 text-emerald-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Choose Export Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportScheduleCSV('PAYSLIPS')} className="cursor-pointer font-medium text-sm">
                  Entire Payroll Table
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportScheduleCSV('PAYE')} className="cursor-pointer text-sm">
                  PAYE Schedule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportScheduleCSV('PENSION')} className="cursor-pointer text-sm">
                  Pension Schedule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportScheduleCSV('NSITF')} className="cursor-pointer text-sm">
                  NSITF Schedule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportScheduleCSV('WITHHOLDING')} className="cursor-pointer text-sm">
                  Withholding Schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white shadow-sm border-slate-200">
                <MoreVertical className="h-5 w-5 text-slate-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <div className="flex flex-col gap-2 pb-2 mb-2 border-b border-slate-100">
                <label className="text-xs font-semibold text-slate-500 px-2">Filter Period</label>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm outline-none w-full"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {months.map(month => (
                    <option key={month.key} value={month.key}>{month.label}</option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm outline-none w-full"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {Array.from({ length: currentYear - YEAR_RANGE_START + 2 }, (_, i) => YEAR_RANGE_START + i).map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              
              {priv.canGenerate && (
                <DropdownMenuItem onClick={() => handleOpenPrintDialog(activeTab === 'processing' ? 'PAYSLIPS' : activeTab.toUpperCase() as any)} className="cursor-pointer">
                  <Printer className="mr-2 h-4 w-4" />
                  Print {activeTab === 'processing' ? 'Payslips' : 'Schedule'}
                </DropdownMenuItem>
              )}
              {finRepPriv?.canExport && activeTab === 'processing' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 pt-2 pb-1 text-xs text-slate-500">Export CSV</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleExportScheduleCSV('PAYSLIPS')} className="cursor-pointer">
                    Entire Payroll Table
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportScheduleCSV('PAYE')} className="cursor-pointer">
                    PAYE Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportScheduleCSV('PENSION')} className="cursor-pointer">
                    Pension Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportScheduleCSV('NSITF')} className="cursor-pointer">
                    NSITF Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportScheduleCSV('WITHHOLDING')} className="cursor-pointer">
                    Withholding Schedule
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>,
      [selectedMonth, selectedYear, activeTab]
    );

    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

        {/* COMPACT TABS */}
        <div className="flex bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 items-center overflow-x-auto no-scrollbar gap-2">
          <div className="flex gap-1">
            {[
              { id: 'processing', label: 'Payroll Processing' },
              { id: 'paye', label: 'PAYE', priv: priv.canViewPayeSchedule },
              { id: 'withholding', label: 'Withholding' },
              { id: 'pension', label: 'Pension', priv: priv.canViewPensionSchedule },
              { id: 'nsitf', label: 'NSITF', priv: priv.canViewNsitfSchedule }
            ].map(tab => {
              if (tab.priv === false) return null;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <Tabs>
          <TabsContent active={activeTab === 'processing'} className="space-y-6 mt-0">

             {/* COMPACT METRICS BAR FOR PROCESSING */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center relative overflow-hidden">
                   <div className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-slate-50/50 to-transparent pointer-events-none" />
                   <div className="flex justify-between items-center mb-1">
                     <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Gross Pay</span>
                   </div>
                   <div className="text-xl font-bold text-slate-900">₦{priv?.canViewAmounts === false ? '***' : totals.totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                   <div className="flex gap-2 mt-1.5 flex-wrap">
                     <span className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100 font-medium whitespace-nowrap">Salary: ₦{fm(totals.totalSalary)}</span>
                     <span className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100 font-medium whitespace-nowrap">Overtime: ₦{fm(totals.totalOvertime)}</span>
                   </div>
                </div>


                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-50 dark:border-red-900/30 shadow-sm flex flex-col justify-center relative overflow-hidden">
                   <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-red-50/50 to-transparent pointer-events-none" />
                   <div className="flex justify-between items-center mb-1 relative z-10">
                     <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Total Deductions</span>
                   </div>
                   <div className="text-xl font-bold text-red-600 relative z-10 flex items-center gap-2">
                     ₦{priv?.canViewAmounts === false ? '***' : totals.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </div>
                   <div className="flex gap-2 mt-1.5 relative z-10 flex-wrap">
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-medium whitespace-nowrap">PAYE: ₦{fm(totals.totalPAYE)}</span>
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-medium whitespace-nowrap">Loans: ₦{fm(totals.totalLoans)}</span>
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-medium whitespace-nowrap">Pension: ₦{fm(totals.totalPension)}</span>
                   </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm flex flex-col justify-center relative overflow-hidden">
                   <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-50/50 to-transparent pointer-events-none" />
                   <div className="flex justify-between items-center mb-1 relative z-10">
                     <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Net Payroll</span>
                     <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full whitespace-nowrap">{totals.employeeCount} staff</span>
                   </div>
                   <div className="text-xl font-bold text-emerald-600 relative z-10">₦{priv?.canViewAmounts === false ? '***' : totals.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                   <div className="text-[10px] text-emerald-500/80 mt-1 relative z-10 flex justify-between items-center whitespace-nowrap">
                     Take Home Pay
                   </div>
                </div>
             </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                <CardTitle>Master Payroll Register: {selectedMonthLabel}</CardTitle>
                <div className="flex items-center gap-2">
                  {showFilterPanel && (
                    <select
                      className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm"
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {[...new Set([...employees.map(e => e.department).filter(Boolean), 'Beneficiary'])].sort().map(d => (
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
              <CardContent className="p-0 border-t border-slate-100">

                {/* ── Mobile Card List (< md) ───────────────────────────────── */}
                <div className="md:hidden divide-y divide-slate-100">
                  {payrollData.filter(r => !filterDept || r.department === filterDept).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CreditCard className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-medium text-slate-500">No payroll records for this period.</p>
                    </div>
                  ) : (
                    payrollData.filter(r => !filterDept || r.department === filterDept).map((record) => (
                      <div key={record.id} className="px-4 py-3 space-y-2">
                        {/* Name & position row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{record.surname} {record.firstname}</p>
                            <p className="text-[11px] text-slate-400 truncate">{record.position} · {record.department}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Net Pay</p>
                            <p className="text-sm font-bold text-emerald-600 font-mono">
                              {priv?.canViewAmounts === false ? '***' : `₦${record.takeHomePay.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                            </p>
                          </div>
                        </div>
                        {/* Summary chips */}
                        {priv?.canViewAmounts !== false && (
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">Gross ₦{record.grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            {record.paye > 0 && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">PAYE ₦{record.paye.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                            {record.pension > 0 && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">Pension ₦{record.pension.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                            {record.loanRepayment > 0 && <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-medium">Loan ₦{record.loanRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                            {record.overtime > 0 && <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-medium">OT ₦{record.overtime.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* ── Desktop Table (≥ md) ───────────────────────────────────── */}
                <div
                  ref={tableContainerRef}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  className={`hidden md:block overflow-x-auto overflow-y-auto max-h-[70vh] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                {/* Table mimicking Excel specific columns precisely */}
                <Table className="whitespace-nowrap w-full text-xs">
                  <TableHeader className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-900">
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 left-0 z-30 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700" style={{minWidth:'48px'}}>S/N</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700" style={{left:'48px',minWidth:'110px'}}>SURNAMES</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700" style={{left:'158px',minWidth:'110px'}}>FIRNAME</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700" style={{left:'268px',minWidth:'180px'}}>JOB TITTLE</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">BANK</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">ACCOUNT NO.</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-indigo-50 dark:bg-indigo-900/50 ring-1 ring-slate-200 dark:ring-slate-700">SALARY</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Basic Salary</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Housing</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Transport</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Other Allowances</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">Total-Allowances</TableHead>
                      <TableHead className="font-bold text-amber-700 dark:text-amber-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">OVERTIME</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-slate-100 sticky top-0 z-20 bg-emerald-50 dark:bg-emerald-900/40 ring-1 ring-slate-200 dark:ring-slate-700">GROSS PAY</TableHead>
                      <TableHead className="font-bold text-red-600 dark:text-red-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">PAYE</TableHead>
                      <TableHead className="font-bold text-red-600 dark:text-red-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">LOAN REPAYMENT</TableHead>
                      <TableHead className="font-bold text-red-600 dark:text-red-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">PENSION</TableHead>
                      <TableHead className="font-bold text-slate-900 dark:text-emerald-400 sticky top-0 z-20 bg-emerald-100 dark:bg-emerald-900/60 ring-1 ring-slate-200 dark:ring-slate-700">TAKE HOME PAY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollData.filter(r => !filterDept || r.department === filterDept).map((record) => (
                      <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-transparent" style={{minWidth:'48px'}}>{record.sn}</TableCell>
                        <TableCell className="font-medium sticky z-10 bg-white dark:bg-slate-900" style={{left:'48px',minWidth:'110px'}}>{record.surname}</TableCell>
                        <TableCell className="sticky z-10 bg-white dark:bg-slate-900" style={{left:'158px',minWidth:'110px'}}>{record.firstname}</TableCell>
                        <TableCell className="sticky z-10 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700" style={{left:'268px',minWidth:'180px'}}>{record.position}</TableCell>
                        <TableCell>{record.bankName}</TableCell>
                        <TableCell className="font-mono">{record.accountNo}</TableCell>
                        <TableCell className="font-mono text-indigo-700 bg-indigo-50/30">₦{priv?.canViewAmounts === false ? '***' : record.salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.housing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.transport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-slate-600">{priv?.canViewAmounts === false ? '***' : record.otherAllowances.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono font-medium bg-slate-50 border-x">{priv?.canViewAmounts === false ? '***' : record.totalAllowances.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-amber-600">{priv?.canViewAmounts === false ? '***' : record.overtime.toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-bold text-slate-900 bg-emerald-50/50">₦{priv?.canViewAmounts === false ? '***' : record.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-red-600">{priv?.canViewAmounts === false ? '***' : record.paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-red-600">{priv?.canViewAmounts === false ? '***' : record.loanRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono text-red-600">{priv?.canViewAmounts === false ? '***' : record.pension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-mono font-bold text-emerald-700 bg-emerald-50 border-l">₦{priv?.canViewAmounts === false ? '***' : record.takeHomePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ PAYE TAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {priv.canViewPayeSchedule && (
            <TabsContent active={activeTab === 'paye'} className="mt-0">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <CardTitle>PAYE Tax Schedule: {selectedMonthLabel}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Total PAYE: <span className="text-red-600 font-bold">₦{fmT(totals.totalPAYE)}</span></span>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto overflow-y-auto max-h-[70vh] border-t border-slate-100 p-0 sm:p-6 sm:pt-0">
                  {/* MOBILE CARDS */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {payrollData.filter(r => (r.staffType === 'OFFICE' || r.staffType === 'FIELD') && !r.department.trim().toLowerCase().includes('adhoc')).map((r, i) => (
                      <div key={r.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{r.surname} {r.firstname}</h3>
                            <p className="text-xs text-slate-500">{r.department}</p>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PAYE</p>
                            <p className="font-bold text-red-600 text-base">₦{fm(r.paye)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 font-mono">Gross: ₦{fm(r.grossPay)}</span>
                        </div>
                      </div>
                    ))}
                    {(() => { const pd = payrollData.filter(r => (r.staffType === 'OFFICE' || r.staffType === 'FIELD') && !r.department.trim().toLowerCase().includes('adhoc')); return (
                      <div className="p-4 bg-red-50 border-t border-red-100 flex justify-between items-center">
                        <span className="font-bold text-red-900 text-sm">TOTAL PAYE</span>
                        <span className="font-bold text-red-600 text-lg">₦{fmT(pd.reduce((s, r) => s + r.paye, 0))}</span>
                      </div>
                    ); })()}
                  </div>

                  <Table className="hidden md:table whitespace-nowrap w-full text-xs cursor-grab">
                    <TableHeader>
                      <TableRow className="bg-red-50 dark:bg-slate-900">
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">S/N</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Surname</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Firstname</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Department</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Basic (₦)</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Housing (₦)</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Transport (₦)</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Other (₦)</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 ring-1 ring-slate-200 dark:ring-slate-700">Gross Pay (₦)</TableHead>
                        <TableHead className="font-bold text-right text-red-600 dark:text-red-500 sticky top-0 z-20 bg-red-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">PAYE (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.filter(r => (r.staffType === 'OFFICE' || r.staffType === 'FIELD') && !r.department.trim().toLowerCase().includes('adhoc')).map((r, i) => (
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
                      {(() => { const pd = payrollData.filter(r => (r.staffType === 'OFFICE' || r.staffType === 'FIELD') && !r.department.trim().toLowerCase().includes('adhoc')); return (
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
            <TabsContent active={activeTab === 'pension'} className="mt-0">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <CardTitle>Pension Schedule: {selectedMonthLabel}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Total Pension: <span className="text-amber-600 font-bold">₦{fmT(totals.totalPension)}</span></span>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto overflow-y-auto max-h-[70vh] border-t border-slate-100 p-0 sm:p-6 sm:pt-0">
                  {/* MOBILE CARDS */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {payrollData.filter(isPensionEligible).map((r, i) => (
                      <div key={r.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{r.surname} {r.firstname}</h3>
                            <p className="text-xs text-slate-500">{r.department}</p>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Pension</p>
                            <p className="font-bold text-emerald-700 text-base">₦{fm(r.pension + r.employerPension)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-amber-700 font-mono">Emp: ₦{fm(r.pension)}</span>
                          <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-indigo-700 font-mono">Empr: ₦{fm(r.employerPension)}</span>
                        </div>
                      </div>
                    ))}
                    {(() => { const pp = payrollData.filter(isPensionEligible); return (
                      <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                        <span className="font-bold text-emerald-900 text-sm">TOTAL PENSION</span>
                        <span className="font-bold text-emerald-700 text-lg">₦{fmT(pp.reduce((s, r) => s + r.pension + r.employerPension, 0))}</span>
                      </div>
                    ); })()}
                  </div>

                  <Table className="hidden md:table whitespace-nowrap w-full text-xs cursor-grab">
                    <TableHeader>
                      <TableRow className="bg-amber-50 dark:bg-slate-900">
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">S/N</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Surname</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Firstname</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Department</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Pensionable Sum (₦)</TableHead>
                        <TableHead className="font-bold text-right text-amber-700 dark:text-amber-500 sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Employee (₦)</TableHead>
                        <TableHead className="font-bold text-right text-indigo-700 dark:text-indigo-400 sticky top-0 z-20 bg-amber-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Employer (₦)</TableHead>
                        <TableHead className="font-bold text-right text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 sticky top-0 z-20 ring-1 ring-slate-200 dark:ring-slate-700">Total (₦)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.filter(isPensionEligible).map((r, i) => {
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
                      {(() => { const pp = payrollData.filter(isPensionEligible); return (
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
            <TabsContent active={activeTab === 'nsitf'} className="mt-0">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <CardTitle>NSITF Schedule: {selectedMonthLabel}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Total NSITF: <span className="text-blue-600 font-bold">₦{fmT(payrollData.reduce((s, r) => s + r.nsitf, 0))}</span></span>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto overflow-y-auto max-h-[70vh] border-t border-slate-100 p-0 sm:p-6 sm:pt-0">
                  {/* MOBILE CARDS */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {payrollData.filter(r => isNsitfEligible(r)).map((r, i) => (
                      <div key={r.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate">{r.surname} {r.firstname}</h3>
                            <p className="text-xs text-slate-500">{r.department}</p>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">NSITF</p>
                            <p className="font-bold text-blue-600 text-base">₦{fm(r.nsitf)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 font-mono">Gross: ₦{fm(r.grossPay)}</span>
                          <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 font-mono">Rate: {payrollVariables.nsitfRate}%</span>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
                      <span className="font-bold text-blue-900 text-sm">TOTAL NSITF</span>
                      <span className="font-bold text-blue-600 text-lg">₦{fmT(payrollData.reduce((s, r) => s + r.nsitf, 0))}</span>
                    </div>
                  </div>

                  <Table className="hidden md:table whitespace-nowrap w-full text-xs cursor-grab">
                    <TableHeader>
                      <TableRow className="bg-blue-50 dark:bg-slate-900">
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-blue-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">S/N</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-blue-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Surname</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-blue-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Firstname</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-blue-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Department</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-blue-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Gross Pay (₦)</TableHead>
                        <TableHead className="font-bold dark:text-slate-100 text-center sticky top-0 z-20 bg-blue-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Rate (%)</TableHead>
                        <TableHead className="font-bold text-right text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 sticky top-0 z-20 ring-1 ring-slate-200 dark:ring-slate-700">NSITF (₦)</TableHead>
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

          {/* ────────────────────────── WITHHOLDING TAB ────────────────────────────────── */}
          <TabsContent active={activeTab === 'withholding'} className="mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                <CardTitle>Withholding Tax Schedule (Consultants): {selectedMonthLabel}</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-medium">Total Withholding: <span className="text-indigo-600 font-bold">₦{fmT(totals.totalWithholding)}</span></span>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto overflow-y-auto max-h-[70vh] border-t border-slate-100 p-0 sm:p-6 sm:pt-0">
                {/* MOBILE CARDS */}
                <div className="md:hidden divide-y divide-slate-100">
                  {payrollData.filter(r => r.staffType === 'NON-EMPLOYEE' && r.withholdingTax).map((r, i) => (
                    <div key={r.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 truncate">{r.surname} {r.firstname}</h3>
                          <p className="text-xs text-slate-500">TIN: {r.taxId || 'N/A'}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Withholding</p>
                          <p className="font-bold text-indigo-600 text-base">₦{fm(r.paye)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 font-mono">Gross: ₦{fm(r.grossPay)}</span>
                        <span className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 font-mono">Net: ₦{fm(r.takeHomePay)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-indigo-50 border-t border-indigo-100 flex justify-between items-center">
                    <span className="font-bold text-indigo-900 text-sm">TOTAL WHT</span>
                    <span className="font-bold text-indigo-600 text-lg">₦{fmT(totals.totalWithholding)}</span>
                  </div>
                </div>

                <Table className="hidden md:table whitespace-nowrap w-full text-xs cursor-grab">
                  <TableHeader>
                    <TableRow className="bg-indigo-50 dark:bg-slate-900">
                      <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">S/N</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Surname</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Firstname</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">TIN</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Department</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 text-right sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Gross Pay (₦)</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 text-center sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Rate (%)</TableHead>
                      <TableHead className="font-bold text-right text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-900 sticky top-0 z-20 ring-1 ring-slate-200 dark:ring-slate-700">Withholding (₦)</TableHead>
                      <TableHead className="font-bold dark:text-slate-100 text-right text-slate-500 sticky top-0 z-20 bg-indigo-50 dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700">Net Pay (₦)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollData.filter(r => r.staffType === 'NON-EMPLOYEE' && r.withholdingTax).map((r, i) => (
                      <TableRow key={r.id} className="hover:bg-indigo-50/30">
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.surname}</TableCell>
                        <TableCell>{r.firstname}</TableCell>
                        <TableCell className="font-mono text-[10px] text-slate-500">{r.taxId || 'N/A'}</TableCell>
                        <TableCell className="text-slate-500">{r.department}</TableCell>
                        <TableCell className="text-right font-mono">{fm(r.grossPay)}</TableCell>
                        <TableCell className="text-center font-mono text-slate-500">{(r.withholdingTaxRate || 0.05) * 100}%</TableCell>
                        <TableCell className="text-right font-mono text-indigo-600 font-bold bg-indigo-50/50">{fm(r.paye)}</TableCell>
                        <TableCell className="text-right font-mono text-slate-600">{fm(r.takeHomePay)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-indigo-50 font-bold">
                      <TableCell colSpan={5} className="text-right font-bold">TOTALS</TableCell>
                      <TableCell className="text-right font-mono">{fmT(payrollData.filter(r => r.staffType === 'NON-EMPLOYEE').reduce((s, r) => s + r.grossPay, 0))}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono text-indigo-600">{fmT(totals.totalWithholding)}</TableCell>
                      <TableCell className="text-right font-mono text-slate-600">{fmT(payrollData.filter(r => r.staffType === 'NON-EMPLOYEE').reduce((s, r) => s + r.takeHomePay, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {printDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex flex-col z-50 overflow-hidden items-center justify-center">
            <div className="bg-slate-100 shadow-xl flex flex-col w-screen h-screen relative rounded-none">

              <div className="flex flex-col md:flex-row bg-indigo-600 p-4 justify-between md:items-center gap-4 md:gap-0 rounded-none shrink-0 z-10">
                <h3 className="text-white font-bold text-lg leading-tight">
                  {printType === 'PAYSLIPS' && "Print Bulk Payslips"}
                  {printType === 'PAYE' && "Generate PAYE Schedule"}
                  {printType === 'PENSION' && "Generate Pension Schedule"}
                  {printType === 'NSITF' && "Generate NSITF Schedule"}
                  {printType === 'WITHHOLDING' && "Generate Withholding Schedule"}
                </h3>
                <div className="flex items-center justify-between w-full md:w-auto gap-2">
                  <div className="flex gap-2">
                    {printType !== 'PAYSLIPS' && (
                      <Button variant="secondary" size="sm" className="gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800" onClick={() => handleExportScheduleCSV()} disabled={payslipsToPrint.length === 0}>
                        <Upload className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Export CSV</span>
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" className="gap-1" onClick={handlePrint} disabled={payslipsToPrint.length === 0}>
                      <Printer className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Print Document</span>
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700 p-2 shrink-0" onClick={() => setPrintDialogOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row flex-1 overflow-hidden print-hide">
                {/* Mobile Toggle Button */}
                <div className="md:hidden p-4 pb-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
                  <Button 
                    variant="outline" 
                    className="w-full flex justify-between items-center" 
                    onClick={() => setPrintSidebarOpen(!printSidebarOpen)}
                  >
                    <span className="font-semibold text-slate-700">Filter Options</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${printSidebarOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {/* Filter Sidebar */}
                <div className={`w-full md:w-1/3 md:max-w-[300px] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:overflow-y-auto flex-col gap-6 hide-on-print shadow-sm z-10 shrink-0 ${printSidebarOpen ? 'flex max-h-[50vh] overflow-y-auto' : 'hidden md:flex md:max-h-full'}`}>
                  {/* Schedule type selector */}
                  {printType === 'PAYSLIPS' && (
                    <div className="mb-4">
                      <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1">Payslip Theme</h4>
                      <div className="flex gap-2">
                        <button 
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border ${payslipTheme === 'MODERN' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                          onClick={() => setPayslipTheme('MODERN')}
                        >
                          Modern
                        </button>
                        <button 
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border ${payslipTheme === 'CLASSIC' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                          onClick={() => setPayslipTheme('CLASSIC')}
                        >
                          Classic
                        </button>
                        <button 
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border ${payslipTheme === 'FORMAL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                          onClick={() => setPayslipTheme('FORMAL')}
                        >
                          Formal
                        </button>
                      </div>
                    </div>
                  )}

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
                      <option value="WITHHOLDING">Withholding Schedule</option>
                    </select>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1">Select Year</h4>
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm mt-2"
                      value={printSelectedYear}
                      onChange={(e) => setPrintSelectedYear(Number(e.target.value))}
                    >
                      {Array.from({ length: currentYear - YEAR_RANGE_START + 2 }, (_, i) => YEAR_RANGE_START + i).map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1">Select Months</h4>
                    <div className="flex gap-2 mb-2">
                      <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedMonths(months.map(m => m.key))}>Select All</button>
                      <span className="text-slate-300">|</span>
                      <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedMonths([])}>Select None</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
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

                  {/* View Mode Toggle */}
                  {printType !== 'PAYSLIPS' && printSelectedMonths.length > 1 && (
                    <div className="mt-4">
                      <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex items-center justify-between">
                        Layout Mode
                      </h4>
                      <div className="flex gap-2">
                        <button 
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border ${printViewMode === 'LIST' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                          onClick={() => setPrintViewMode('LIST')}
                        >
                          Row per Month
                        </button>
                        <button 
                          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border ${printViewMode === 'MATRIX' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                          onClick={() => setPrintViewMode('MATRIX')}
                        >
                          Month Columns
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Department & Employee Filters */}
                  {(() => {
                    const isExcludeNonEmp = printType === 'PAYSLIPS' || printType === 'PAYE' || printType === 'PENSION' || printType === 'NSITF';
                    const isOnlyNonEmp = printType === 'WITHHOLDING';
                    const listStaff = employees.filter(e => {
                      if (e.status !== 'Active' && e.status !== 'On Leave') return false;
                      const isNonEmp = e.staffType === 'NON-EMPLOYEE' || e.department?.toUpperCase() === 'NON-EMPLOYEE' || e.department?.toUpperCase() === 'BENEFICIARY';
                      if (isExcludeNonEmp && isNonEmp) return false;
                      if (isOnlyNonEmp && !isNonEmp) return false;
                      return true;
                    });
                    const listDepts = [...new Set(listStaff.map(e => e.department).filter(Boolean))].sort();

                    return (
                      <>
                        {/* Department filter */}
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex items-center justify-between">
                            Filter by Department
                            <div className="flex gap-2">
                              <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => {
                                setPrintSelectedDepts(listDepts);
                                setPrintSelectedEmployees(listStaff.filter(e => listDepts.includes(e.department)).map(e => e.id));
                              }}>All</button>
                              <span className="text-slate-300">|</span>
                              <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => { setPrintSelectedDepts([]); setPrintSelectedEmployees([]); }}>None</button>
                            </div>
                          </h4>
                          <div className="space-y-1 mt-2 max-h-[110px] overflow-y-auto">
                            {listDepts.map(dept => (
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
                                      const deptEmployeeIds = listStaff
                                        .filter(emp => newDepts.includes(emp.department))
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

                        {/* Employee filter */}
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex items-center justify-between">
                            Select Employees
                            <div className="flex gap-2">
                              <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedEmployees(listStaff.map(e => e.id))}>All</button>
                              <span className="text-slate-300">|</span>
                              <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedEmployees([])}>None</button>
                            </div>
                          </h4>
                          <div className="space-y-1 mt-2 max-h-[200px] overflow-y-auto pr-2">
                            {listStaff.sort((a, b) => `${a.firstname} ${a.surname}`.localeCompare(`${b.firstname} ${b.surname}`)).map(emp => (
                              <label key={emp.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-indigo-600"
                                  checked={printSelectedEmployees.includes(emp.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setPrintSelectedEmployees(prev => [...prev, emp.id]);
                                    else setPrintSelectedEmployees(prev => prev.filter(id => id !== emp.id));
                                  }}
                                />
                                {emp.firstname} {emp.surname}
                                {emp.department && <span className="text-[10px] text-slate-400 ml-auto shrink-0">{emp.department}</span>}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Columns to Include */}
                  {(() => {
                    // Only show columns relevant to this schedule type
                    const relevantCols = AVAILABLE_COLUMNS.filter(c => c.types.includes('all') || c.types.includes(printType));
                    return (
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 mb-2 border-b pb-1 flex items-center justify-between">
                          Columns to Include
                          <div className="flex gap-2">
                            <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedColumns(relevantCols.map(c => c.id))}>All</button>
                            <span className="text-slate-300">|</span>
                            <button className="text-xs text-indigo-600 font-medium hover:underline" onClick={() => setPrintSelectedColumns([])}>None</button>
                          </div>
                        </h4>
                        <div className="flex flex-col gap-1 mt-1">
                          {relevantCols.map((col, idx) => (
                            <div key={col.id} className="flex items-center gap-2 py-0.5">
                              <input
                                type="checkbox"
                                id={`col-${col.id}`}
                                className="rounded border-slate-300 text-indigo-600 shrink-0"
                                checked={printSelectedColumns.includes(col.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPrintSelectedColumns([...printSelectedColumns, col.id]);
                                  } else {
                                    setPrintSelectedColumns(printSelectedColumns.filter(id => id !== col.id));
                                  }
                                }}
                              />
                              <label htmlFor={`col-${col.id}`} className="text-sm text-slate-700 cursor-pointer flex-1 flex items-center justify-between">
                                {col.label}
                                {printSelectedColumns.includes(col.id) && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-sm">
                                    #{printSelectedColumns.indexOf(col.id) + 1}
                                  </span>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Preview Area */}
                <div className="flex-1 p-4 md:p-8 overflow-auto bg-slate-200" id="print-area">
                  {payslipsToPrint.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-medium pb-20">
                      No records match your selection.
                    </div>
                  ) : printType === 'PAYSLIPS' ? (
                    <div className="bg-white mx-auto print-break shadow-sm" style={{ maxWidth: 820 }}>
                      <style>{`.preview-payslips-wrapper { text-align: left; } .preview-payslips-wrapper * { box-sizing: border-box; } ` + themeStyles}</style>
                      <div className="preview-payslips-wrapper" dangerouslySetInnerHTML={{ __html: payslipsToPrint.map((slip, i) => buildSlipHtml(slip, i)).join('') }} />
                    </div>
                  ) : printType === 'PAYE' || printType === 'PENSION' || printType === 'NSITF' || printType === 'WITHHOLDING' ? (() => {
                    // ── Ordered selected columns for this schedule type ──────────────
                    const relevantCols = AVAILABLE_COLUMNS.filter(c => c.types.includes('all') || c.types.includes(printType));
                    const orderedCols = printSelectedColumns
                      .filter(id => relevantCols.some(c => c.id === id))
                      .map(id => relevantCols.find(c => c.id === id)!);

                    const filteredSlips = payslipsToPrint.filter(slip =>
                      printType === 'PAYE'
                        ? ((slip.record.staffType === 'OFFICE' || slip.record.staffType === 'FIELD') && !slip.record.department.trim().toLowerCase().includes('adhoc'))
                        : printType === 'PENSION'
                          ? ((slip.record.staffType === 'OFFICE' || slip.record.staffType === 'FIELD') && !slip.record.department.trim().toLowerCase().includes('adhoc'))
                          : printType === 'WITHHOLDING'
                            ? slip.record.staffType === 'NON-EMPLOYEE'
                            : (slip.record.nsitf > 0 && !slip.record.department.trim().toLowerCase().includes('adhoc'))
                    );

                    const accentColor = printType === 'PAYE' ? '#7c3aed' : printType === 'PENSION' ? '#0d9488' : printType === 'WITHHOLDING' ? '#4f46e5' : '#2563eb';
                    const accentLight = printType === 'PAYE' ? '#ede9fe' : printType === 'PENSION' ? '#ccfbf1' : printType === 'WITHHOLDING' ? '#e0e7ff' : '#dbeafe';

                    // Cell value getter
                    const getCellValue = (col: typeof orderedCols[0], slip: typeof filteredSlips[0], idx: number): React.ReactNode => {
                      const pSum = slip.record.basicSalary + slip.record.housing + slip.record.transport;
                      switch (col.id) {
                        case 'sn':             return <span style={{ color: '#94a3b8', fontSize: '12px' }}>{idx + 1}</span>;
                        case 'employee_name':  return <span style={{ fontWeight: 600, color: '#0f172a' }}>{slip.record.surname} {slip.record.firstname}</span>;
                        case 'month':          return <span style={{ color: '#6366f1', fontSize: '12px', fontWeight: 500 }}>{slip.monthLabel}</span>;
                        case 'paye_id':        { const emp = employees.find(e => e.id === slip.record.id); return <span style={{ fontSize: '12px', color: '#475569' }}>{emp?.payeNumber || emp?.taxId || 'N/A'}</span>; }
                        case 'tin':            return <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>{slip.record.taxId || 'N/A'}</span>;
                        case 'pension_pin':    { const emp = employees.find(e => e.id === slip.record.id); return <span style={{ fontSize: '12px', color: '#475569' }}>{emp?.pensionNumber || 'N/A'}</span>; }
                        case 'bank_name':      return <span style={{ fontSize: '12px' }}>{slip.record.bankName}</span>;
                        case 'account_number': return <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>{slip.record.accountNo}</span>;
                        case 'basic':          return <span style={{ fontFamily: 'monospace' }}>{fm(slip.record.basicSalary)}</span>;
                        case 'housing':        return <span style={{ fontFamily: 'monospace' }}>{fm(slip.record.housing)}</span>;
                        case 'transport':      return <span style={{ fontFamily: 'monospace' }}>{fm(slip.record.transport)}</span>;
                        case 'other':          return <span style={{ fontFamily: 'monospace' }}>{fm(slip.record.otherAllowances)}</span>;
                        case 'gross':          return <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fm(slip.record.grossPay)}</span>;
                        case 'paye':           return <span style={{ fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>{fm(slip.record.paye)}</span>;
                        case 'net_pay':        return <span style={{ fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>{fm(slip.record.takeHomePay)}</span>;
                        case 'pensionable':    return <span style={{ fontFamily: 'monospace' }}>{fm(pSum)}</span>;
                        case 'employee_pension': return <span style={{ fontFamily: 'monospace', color: '#d97706' }}>{fm(slip.record.pension)}</span>;
                        case 'employer_pension': return <span style={{ fontFamily: 'monospace', color: '#4f46e5' }}>{fm(slip.record.employerPension)}</span>;
                        case 'total_pension':  return <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{fm(slip.record.pension + slip.record.employerPension)}</span>;
                        case 'nsitf_rate':     return <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{payrollVariables.nsitfRate}%</span>;
                        case 'nsitf_amount':   return <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{fm(slip.record.nsitf)}</span>;
                        case 'withholding_rate': return <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{(slip.record.withholdingTaxRate || 0.05) * 100}%</span>;
                        case 'withholding':    return <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>{fm(slip.record.paye)}</span>;
                        default: return null;
                      }
                    };

                    // Grand total getter
                    const getTotal = (colId: string): number => {
                      switch (colId) {
                        case 'basic':            return filteredSlips.reduce((s, x) => s + x.record.basicSalary, 0);
                        case 'housing':          return filteredSlips.reduce((s, x) => s + x.record.housing, 0);
                        case 'transport':        return filteredSlips.reduce((s, x) => s + x.record.transport, 0);
                        case 'other':            return filteredSlips.reduce((s, x) => s + x.record.otherAllowances, 0);
                        case 'gross':            return filteredSlips.reduce((s, x) => s + x.record.grossPay, 0);
                        case 'paye':             return filteredSlips.reduce((s, x) => s + x.record.paye, 0);
                        case 'withholding':      return filteredSlips.reduce((s, x) => s + x.record.paye, 0);
                        case 'net_pay':          return filteredSlips.reduce((s, x) => s + x.record.takeHomePay, 0);
                        case 'pensionable':      return filteredSlips.reduce((s, x) => s + x.record.basicSalary + x.record.housing + x.record.transport, 0);
                        case 'employee_pension': return filteredSlips.reduce((s, x) => s + x.record.pension, 0);
                        case 'employer_pension': return filteredSlips.reduce((s, x) => s + x.record.employerPension, 0);
                        case 'total_pension':    return filteredSlips.reduce((s, x) => s + x.record.pension + x.record.employerPension, 0);
                        case 'nsitf_amount':     return filteredSlips.reduce((s, x) => s + x.record.nsitf, 0);
                        default: return 0;
                      }
                    };

                    // Label colspan = leading non-summable selected columns
                    let labelSpan = 0;
                    for (const c of orderedCols) { if (!c.summable) labelSpan++; else break; }
                    if (labelSpan === 0) labelSpan = 1;

                    const colIsNumeric = (id: string) => !['sn','employee_name','month','bank_name','account_number','paye_id','pension_pin','tin'].includes(id);

                    return (
                      <div className="bg-white dark:bg-slate-900 mx-auto shadow-lg min-w-fit rounded-sm print-break" id="print-area-content"
                        style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden' }}>

                        {/* ── Premium print-safe header ── */}
                        <div style={{
                          padding: '28px 36px 16px',
                          borderBottom: `3px solid ${accentColor}`,
                          position: 'relative',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
                            <div>
                              <img src={logoSrc} alt="Company Logo" style={{ height: 48, width: 'auto', marginBottom: 16 }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <div style={{ width: 4, height: 28, background: accentColor, borderRadius: 2, flexShrink: 0 }} />
                                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#0f172a' }}>
                                  {printType === 'PAYE' ? 'PAYE Tax Schedule' : printType === 'PENSION' ? 'Pension Contribution Schedule' : printType === 'WITHHOLDING' ? 'Withholding Tax Schedule' : 'NSITF Schedule'}
                                </h2>
                              </div>
                              <p style={{ margin: 0, fontSize: 13, color: '#64748b', marginLeft: 14 }}>
                                Generated: {formatDisplayDate(Date.now())}
                              </p>
                            </div>
                            {/* The "Total Employees" box has been removed as requested */}
                          </div>
                        </div>

                        {/* ── Month/Period pills ── */}
                        {printSelectedMonths.length > 0 && (
                          <div style={{ background: accentLight, padding: '8px 36px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>Period:</span>
                            {printSelectedMonths.map(mk => {
                              const lbl = months.find(m => m.key === mk)?.label || mk;
                              return <span key={mk} style={{ background: 'white', color: accentColor, border: `1px solid ${accentColor}33`, borderRadius: 100, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>{lbl}</span>;
                            })}
                          </div>
                        )}

                        {/* ── Table ── */}
                        <div style={{ padding: '0 0 32px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            {printViewMode === 'MATRIX' && printSelectedMonths.length > 1 ? (() => {
                              const empIds = [...new Set(filteredSlips.map(s => s.record.id))];
                              const getMetric = (slip: typeof filteredSlips[0]) => {
                                if (printType === 'PAYE') return slip.record.paye;
                                if (printType === 'PENSION') return slip.record.pension + slip.record.employerPension;
                                if (printType === 'NSITF') return slip.record.nsitf;
                                if (printType === 'WITHHOLDING') return slip.record.paye;
                                return 0;
                              };
                              const mData = empIds.map(eid => {
                                const empSlips = filteredSlips.filter(s => s.record.id === eid);
                                const monthVals: Record<string, number> = {};
                                let rowTotal = 0;
                                empSlips.forEach(s => {
                                  const val = getMetric(s);
                                  monthVals[s.monthKey] = val;
                                  rowTotal += val;
                                });
                                return { record: empSlips[0].record, monthVals, rowTotal };
                              });

                              const metadataCols = orderedCols.filter(c => !c.summable && c.id !== 'month');

                              return (
                                <>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: `3px solid ${accentColor}` }}>
                                      {metadataCols.map(col => (
                                        <th key={col.id} style={{ padding: '12px 10px', textAlign: colIsNumeric(col.id) ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                          {col.label}
                                        </th>
                                      ))}
                                      {printSelectedMonths.map(mk => (
                                        <th key={mk} style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                          {months.find(m => m.key === mk)?.label || mk} (₦)
                                        </th>
                                      ))}
                                      <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#0f172a', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Total (₦)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {mData.map((row, idx) => {
                                      const dummySlip = { record: row.record, monthLabel: '', monthKey: '' } as typeof filteredSlips[0];
                                      return (
                                        <tr key={row.record.id} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }} className="hover:bg-indigo-50/30">
                                          {metadataCols.map(col => (
                                            <td key={col.id} style={{ padding: '11px 10px', textAlign: colIsNumeric(col.id) ? 'right' : 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                              {getCellValue(col, dummySlip, idx)}
                                            </td>
                                          ))}
                                          {printSelectedMonths.map(mk => (
                                            <td key={mk} style={{ padding: '11px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                              {row.monthVals[mk] ? fm(row.monthVals[mk]) : '—'}
                                            </td>
                                          ))}
                                          <td style={{ padding: '11px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                                            {fm(row.rowTotal)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    
                                    {/* Grand total row inside tbody so it prints only on the last page */}
                                    <tr style={{ background: `${accentColor}0f`, borderTop: `2px solid ${accentColor}` }}>
                                      {metadataCols.map((col, i) => (
                                        <td key={col.id} style={{ padding: '12px 10px', fontWeight: 800, fontSize: 12, color: accentColor, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                          {i === metadataCols.length - 1 ? 'Grand Total' : ''}
                                        </td>
                                      ))}
                                      {printSelectedMonths.map(mk => {
                                        const monthGrandTotal = mData.reduce((s, row) => s + (row.monthVals[mk] || 0), 0);
                                        return (
                                          <td key={mk} style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                                            {fm(monthGrandTotal)}
                                          </td>
                                        );
                                      })}
                                      <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#059669' }}>
                                        {fm(mData.reduce((s, row) => s + row.rowTotal, 0))}
                                      </td>
                                    </tr>
                                  </tbody>
                                </>
                              );
                            })() : (
                              <>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: `3px solid ${accentColor}` }}>
                                    {orderedCols.map(col => (
                                      <th key={col.id} style={{
                                        padding: '12px 10px',
                                        textAlign: colIsNumeric(col.id) ? 'right' : 'left',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#475569',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredSlips.map((slip, idx) => (
                                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
                                      className="hover:bg-indigo-50/30">
                                      {orderedCols.map(col => (
                                         <td key={col.id} style={{
                                           padding: '11px 10px',
                                           textAlign: colIsNumeric(col.id) ? 'right' : 'left',
                                           verticalAlign: 'middle',
                                           whiteSpace: 'nowrap',
                                         }}>
                                          {getCellValue(col, slip, idx)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}

                                  {/* Grand total row inside tbody so it prints only on the last page */}
                                  <tr style={{ background: `${accentColor}0f`, borderTop: `2px solid ${accentColor}` }}>
                                    {orderedCols.slice(0, labelSpan).map((col, i) => (
                                      <td key={col.id} colSpan={i === labelSpan - 1 ? 1 : 1}
                                        style={{ padding: '12px 10px', fontWeight: 800, fontSize: 12, color: accentColor, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {i === labelSpan - 1 ? 'Grand Total' : ''}
                                      </td>
                                    ))}
                                    {orderedCols.slice(labelSpan).map(col => (
                                      <td key={col.id} style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: col.summable ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                        {col.summable ? fm(getTotal(col.id)) : '—'}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </>
                            )}
                          </table>
                        </div>

                        {/* ── Footer ── */}
                        <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>This is a computer-generated payroll schedule. No manual signature required.</p>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${accentColor}22`, border: `2px solid ${accentColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 14 }}>✓</span>
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}
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

