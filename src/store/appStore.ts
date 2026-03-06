import { create } from 'zustand';

export interface Site {
  id: string;
  name: string;
  client: string;
  vat: 'Yes' | 'No';
  status: 'Active' | 'Inactive';
}

export interface TaxBracket {
  id: string;
  upTo: number | null; // null = top bracket (catches all remaining income)
  rate: number;        // e.g. 0.15 for 15%
  label: string;
}

interface AppState {
  sites: Site[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  positions: string[];
  departments: string[];
  invoices: Invoice[];
  salaryAdvances: SalaryAdvance[];
  loans: Loan[];
  addSite: (site: Site) => void;
  updateSite: (id: string, site: Partial<Site>) => void;
  deleteSite: (id: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addAttendanceRecords: (records: AttendanceRecord[]) => void;
  removeAttendanceRecordsByDate: (date: string) => void;
  addPosition: (position: string) => void;
  removePosition: (position: string) => void;
  addDepartment: (department: string) => void;
  removeDepartment: (department: string) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addSalaryAdvance: (advance: SalaryAdvance) => void;
  updateSalaryAdvance: (id: string, advance: Partial<SalaryAdvance>) => void;
  deleteSalaryAdvance: (id: string) => void;
  addLoan: (loan: Loan) => void;
  updateLoan: (id: string, loan: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;
  payrollVariables: {
    basic: number;
    housing: number;
    transport: number;
    otherAllowances: number;
    rentRelief: number;
    pension: number;
  };
  updatePayrollVariables: (variables: Partial<AppState['payrollVariables']>) => void;
  payeTaxVariables: {
    craBase: number;
    pensionRate: number;
    withholdingTaxRate: number;
    taxBrackets: TaxBracket[];
    extraConditions: { id: string; label: string; amount: number; enabled: boolean }[];
  };
  updatePayeTaxVariables: (variables: Partial<Omit<AppState['payeTaxVariables'], 'taxBrackets' | 'extraConditions'>>) => void;
  addTaxBracket: (bracket: TaxBracket) => void;
  updateTaxBracket: (id: string, bracket: Partial<TaxBracket>) => void;
  removeTaxBracket: (id: string) => void;
  addPayeTaxExtraCondition: (cond: { id: string; label: string; amount: number; enabled: boolean }) => void;
  updatePayeTaxExtraCondition: (id: string, cond: Partial<{ label: string; amount: number; enabled: boolean }>) => void;
  removePayeTaxExtraCondition: (id: string) => void;
  monthValues: Record<string, MonthValue>;
  updateMonthValue: (month: string, values: Partial<MonthValue>) => void;
  publicHolidays: { id: string; date: string; name: string }[];
  addPublicHoliday: (holiday: { id: string; date: string; name: string }) => void;
  removePublicHoliday: (id: string) => void;
}


export interface MonthlySalary {
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
}

export interface Employee {
  id: string;
  surname: string;
  firstname: string;
  department: string;
  staffType: 'INTERNAL' | 'EXTERNAL';
  position: string;
  startDate: string;
  endDate: string;
  yearlyLeave: number;
  bankName: string;
  accountNo: string;
  payeTax: boolean;
  withholdingTax: boolean;
  taxId: string;
  pensionNumber: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  monthlySalaries: MonthlySalary;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  position: string;
  dayClient: string;
  daySite: string;
  nightClient: string;
  nightSite: string;
  day: 'Yes' | 'No';
  night: 'Yes' | 'No';
  absentStatus: string;
  nightWk: number;
  ot: number;
  otSite: string;
  dayWk: number;
  dow: number;
  ndw: 'Yes' | 'No';
  mth: number;
  isPresent: 'Yes' | 'No';
  day2: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  client: string;
  project: string;
  siteId: string;
  siteName: string;
  amount: number;
  date: string;
  dueDate: string;
  billingCycle: 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Custom';
  reminderDate: string;
  status: 'Paid' | 'Overdue' | 'Sent' | 'Draft';
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Deducted';
}

export interface Loan {
  id: string;
  employeeId: string;
  employeeName: string;
  loanType: string;
  principalAmount: number;
  monthlyDeduction: number;
  duration: number; // months
  startDate: string;
  paymentStartDate: string;
  remainingBalance: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Completed';
}

export interface MonthValue {
  workDays: number;
  overtimeRate: number; // 0.5 for 50%
}



const defaultSalary: MonthlySalary = {
  jan: 600000, feb: 600000, mar: 600000, apr: 600000,
  may: 600000, jun: 600000, jul: 600000, aug: 600000,
  sep: 600000, oct: 600000, nov: 600000, dec: 600000
};

export const useAppStore = create<AppState>((set) => ({
  sites: [
    { id: 'S-001', name: 'Louiseville', client: 'Alpha Corp', vat: 'No', status: 'Active' },
    { id: 'S-002', name: 'Bose Enenmon', client: 'Beta LLC', vat: 'Yes', status: 'Active' },
    { id: 'S-003', name: 'CornerView Apartment', client: 'Gamma Inc', vat: 'No', status: 'Active' },
    { id: 'S-004', name: 'Office', client: 'Internal', vat: 'No', status: 'Active' },
  ],
  positions: ['CEO', 'Head of Admin', 'Head of Operations', 'Projects Supervisor', 'Site Engineer', 'Technician', 'Security'],
  departments: ['ADMIN', 'HEAD OF OPERATIONS', 'ENGINEERING', 'HR', 'FINANCE'],
  employees: [
    {
      id: 'EMP-001', surname: 'DAVIES', firstname: 'HUBERT', department: 'ADMIN', staffType: 'INTERNAL', position: 'CEO',
      startDate: '2018-01-08', endDate: '', yearlyLeave: 20, bankName: 'STANBIC', accountNo: '9200384717',
      payeTax: true, withholdingTax: false, taxId: 'TAX-001', pensionNumber: 'PEN-001', status: 'Active', monthlySalaries: defaultSalary
    },
    {
      id: 'EMP-002', surname: 'OBOKIA', firstname: 'ALICIA', department: 'ADMIN', staffType: 'INTERNAL', position: 'Head of Admin',
      startDate: '2018-01-08', endDate: '', yearlyLeave: 20, bankName: 'FIRST BANK', accountNo: '3059739035',
      payeTax: true, withholdingTax: false, taxId: 'TAX-002', pensionNumber: 'PEN-002', status: 'Active',
      monthlySalaries: { ...defaultSalary, jan: 400000, feb: 400000, mar: 400000, apr: 400000, may: 400000, jun: 400000, jul: 400000, aug: 400000, sep: 400000, oct: 400000, nov: 400000, dec: 400000 }
    },
    {
      id: 'EMP-003', surname: 'IDIAFEHI', firstname: 'ELIJAH', department: 'HEAD OF OPERATIONS', staffType: 'INTERNAL', position: 'Head of Operations',
      startDate: '2025-03-01', endDate: '', yearlyLeave: 20, bankName: 'STANBIC', accountNo: '0026639919',
      payeTax: true, withholdingTax: false, taxId: 'TAX-003', pensionNumber: 'PEN-003', status: 'Active',
      monthlySalaries: { ...defaultSalary, jan: 400000, feb: 400000, mar: 400000, apr: 400000, may: 400000, jun: 400000, jul: 400000, aug: 400000, sep: 400000, oct: 400000, nov: 400000, dec: 400000 }
    },
    {
      id: 'EMP-004', surname: 'ALONGE', firstname: 'OLATUNDE GBENGA', department: 'ADMIN', staffType: 'INTERNAL', position: 'Projects Supervisor',
      startDate: '2025-02-24', endDate: '', yearlyLeave: 20, bankName: 'ACCESS', accountNo: '1445714675',
      payeTax: true, withholdingTax: false, taxId: 'TAX-004', pensionNumber: 'PEN-004', status: 'Active',
      monthlySalaries: { ...defaultSalary, jan: 200000, feb: 200000, mar: 200000, apr: 200000, may: 200000, jun: 200000, jul: 200000, aug: 200000, sep: 200000, oct: 200000, nov: 200000, dec: 200000 }
    },
  ],
  attendanceRecords: [],
  invoices: [
    { id: 'INV-2023-001', invoiceNumber: 'INV-001', client: 'Acme Corp', project: 'Website Redesign', siteId: 'S-001', siteName: 'Louiseville', amount: 12500000, date: '2023-10-01', dueDate: '2023-10-15', billingCycle: 'Monthly', reminderDate: '2023-10-12', status: 'Paid' },
    { id: 'INV-2023-002', invoiceNumber: 'INV-002', client: 'Global Tech', project: 'Mobile App Dev', siteId: 'S-002', siteName: 'Bose Enenmon', amount: 24000000, date: '2023-10-05', dueDate: '2023-10-20', billingCycle: 'Monthly', reminderDate: '2023-10-17', status: 'Overdue' },
    { id: 'INV-2023-003', invoiceNumber: 'INV-003', client: 'Stark Industries', project: 'Security Audit', siteId: 'S-003', siteName: 'CornerView Apartment', amount: 8500000, date: '2023-10-15', dueDate: '2023-10-30', billingCycle: 'Monthly', reminderDate: '2023-10-27', status: 'Sent' },
    { id: 'INV-2023-004', invoiceNumber: 'INV-004', client: 'Wayne Enterprises', project: 'Cloud Migration', siteId: 'S-004', siteName: 'Office', amount: 32000000, date: '2023-10-20', dueDate: '2023-11-04', billingCycle: 'Monthly', reminderDate: '2023-11-01', status: 'Draft' },
  ],
  salaryAdvances: [
    { id: 'SA-001', employeeId: 'EMP-002', employeeName: 'OBOKIA ALICIA', amount: 100000, requestDate: '2023-10-15', status: 'Pending' },
    { id: 'SA-002', employeeId: 'EMP-004', employeeName: 'ALONGE OLATUNDE GBENGA', amount: 50000, requestDate: '2023-10-10', status: 'Approved' },
  ],
  loans: [
    { id: 'LN-001', employeeId: 'EMP-003', employeeName: 'IDIAFEHI ELIJAH', loanType: 'Personal Loan', principalAmount: 500000, monthlyDeduction: 50000, duration: 10, startDate: '2023-01-01', paymentStartDate: '2023-02-01', remainingBalance: 450000, status: 'Active' },
    { id: 'LN-002', employeeId: 'EMP-004', employeeName: 'ALONGE OLATUNDE GBENGA', loanType: 'Emergency Loan', principalAmount: 200000, monthlyDeduction: 40000, duration: 5, startDate: '2023-06-01', paymentStartDate: '2023-07-01', remainingBalance: 120000, status: 'Active' },
  ],
  addSite: (site) => set((state) => ({ sites: [...state.sites, site] })),
  updateSite: (id, updatedSite) => set((state) => ({
    sites: state.sites.map(site => site.id === id ? { ...site, ...updatedSite } : site)
  })),
  deleteSite: (id) => set((state) => ({
    sites: state.sites.filter(site => site.id !== id)
  })),
  addEmployee: (employee) => set((state) => ({ employees: [...state.employees, employee] })),
  updateEmployee: (id, updatedEmployee) => set((state) => ({
    employees: state.employees.map(emp => emp.id === id ? { ...emp, ...updatedEmployee } : emp)
  })),
  deleteEmployee: (id) => set((state) => ({
    employees: state.employees.filter(emp => emp.id !== id)
  })),
  addAttendanceRecords: (records) => set((state) => ({ attendanceRecords: [...state.attendanceRecords, ...records] })),
  removeAttendanceRecordsByDate: (date) => set((state) => ({ attendanceRecords: state.attendanceRecords.filter(r => r.date !== date) })),
  addPosition: (position) => set((state) => ({ positions: [...state.positions, position] })),
  removePosition: (position) => set((state) => ({ positions: state.positions.filter(p => p !== position) })),
  addDepartment: (department) => set((state) => ({ departments: [...state.departments, department] })),
  removeDepartment: (department) => set((state) => ({ departments: state.departments.filter(d => d !== department) })),
  addInvoice: (invoice) => set((state) => ({ invoices: [...state.invoices, invoice] })),
  updateInvoice: (id, updatedInvoice) => set((state) => ({
    invoices: state.invoices.map(inv => inv.id === id ? { ...inv, ...updatedInvoice } : inv)
  })),
  deleteInvoice: (id) => set((state) => ({
    invoices: state.invoices.filter(inv => inv.id !== id)
  })),
  addSalaryAdvance: (advance) => set((state) => ({ salaryAdvances: [...state.salaryAdvances, advance] })),
  updateSalaryAdvance: (id, updatedAdvance) => set((state) => ({
    salaryAdvances: state.salaryAdvances.map(adv => adv.id === id ? { ...adv, ...updatedAdvance } : adv)
  })),
  deleteSalaryAdvance: (id) => set((state) => ({
    salaryAdvances: state.salaryAdvances.filter(adv => adv.id !== id)
  })),
  addLoan: (loan) => set((state) => ({ loans: [...state.loans, loan] })),
  updateLoan: (id, updatedLoan) => set((state) => ({
    loans: state.loans.map(ln => ln.id === id ? { ...ln, ...updatedLoan } : ln)
  })),
  deleteLoan: (id) => set((state) => ({
    loans: state.loans.filter(ln => ln.id !== id)
  })),
  payrollVariables: {
    basic: 40,
    housing: 30,
    transport: 20,
    otherAllowances: 10,
    rentRelief: 0,
    pension: 8,
  },
  updatePayrollVariables: (variables) => set((state) => ({
    payrollVariables: { ...state.payrollVariables, ...variables }
  })),
  payeTaxVariables: {
    craBase: 800000,
    pensionRate: 0.08,
    withholdingTaxRate: 0.05,
    taxBrackets: [
      { id: 'tb-1', upTo: 2200000, rate: 0.15, label: 'First ₦2.2m' },
      { id: 'tb-2', upTo: 11200000, rate: 0.18, label: 'Next ₦9m' },
      { id: 'tb-3', upTo: 24200000, rate: 0.21, label: 'Next ₦13m' },
      { id: 'tb-4', upTo: 49200000, rate: 0.23, label: 'Next ₦25m' },
      { id: 'tb-5', upTo: null, rate: 0.25, label: 'Above ₦49.2m' },
    ],
    extraConditions: [],
  },
  updatePayeTaxVariables: (variables) => set((state) => ({
    payeTaxVariables: { ...state.payeTaxVariables, ...variables }
  })),
  addTaxBracket: (bracket) => set((state) => ({
    payeTaxVariables: {
      ...state.payeTaxVariables,
      taxBrackets: [...state.payeTaxVariables.taxBrackets, bracket]
    }
  })),
  updateTaxBracket: (id, update) => set((state) => ({
    payeTaxVariables: {
      ...state.payeTaxVariables,
      taxBrackets: state.payeTaxVariables.taxBrackets.map(b => b.id === id ? { ...b, ...update } : b)
    }
  })),
  removeTaxBracket: (id) => set((state) => ({
    payeTaxVariables: {
      ...state.payeTaxVariables,
      taxBrackets: state.payeTaxVariables.taxBrackets.filter(b => b.id !== id)
    }
  })),
  addPayeTaxExtraCondition: (cond) => set((state) => ({
    payeTaxVariables: {
      ...state.payeTaxVariables,
      extraConditions: [...state.payeTaxVariables.extraConditions, cond]
    }
  })),
  updatePayeTaxExtraCondition: (id, update) => set((state) => ({
    payeTaxVariables: {
      ...state.payeTaxVariables,
      extraConditions: state.payeTaxVariables.extraConditions.map(c => c.id === id ? { ...c, ...update } : c)
    }
  })),
  removePayeTaxExtraCondition: (id) => set((state) => ({
    payeTaxVariables: {
      ...state.payeTaxVariables,
      extraConditions: state.payeTaxVariables.extraConditions.filter(c => c.id !== id)
    }
  })),
  monthValues: {
    jan: { workDays: 22, overtimeRate: 0.5 },
    feb: { workDays: 20, overtimeRate: 0.5 },
    mar: { workDays: 21, overtimeRate: 0.5 },
    apr: { workDays: 20, overtimeRate: 0.5 },
    may: { workDays: 22, overtimeRate: 0.5 },
    jun: { workDays: 21, overtimeRate: 0.5 },
    jul: { workDays: 22, overtimeRate: 0.5 },
    aug: { workDays: 21, overtimeRate: 0.5 },
    sep: { workDays: 22, overtimeRate: 0.5 },
    oct: { workDays: 21, overtimeRate: 0.5 },
    nov: { workDays: 20, overtimeRate: 0.5 },
    dec: { workDays: 22, overtimeRate: 0.5 },
  },
  updateMonthValue: (month, values) => set((state) => ({
    monthValues: {
      ...state.monthValues,
      [month]: { ...state.monthValues[month], ...values }
    }
  })),
  publicHolidays: [
    { id: '1', date: '2026-01-01', name: 'New Year\'s Day' },
    { id: '2', date: '2026-01-02', name: 'New Year Holiday' },
    { id: '3', date: '2026-01-03', name: 'New Year Holiday' },
    { id: '4', date: '2026-03-20', name: 'Eid-el-Fitr' },
    { id: '5', date: '2026-03-21', name: 'Eid-el-Fitr' },
    { id: '6', date: '2026-04-03', name: 'Good Friday' },
    { id: '7', date: '2026-04-06', name: 'Easter Monday' },
    { id: '8', date: '2026-05-01', name: 'Workers\' Day' },
    { id: '9', date: '2026-05-27', name: 'Children\'s Day' },
    { id: '10', date: '2026-05-28', name: 'Eid-el-Kabir' },
    { id: '11', date: '2026-06-12', name: 'Democracy Day' },
    { id: '12', date: '2026-08-26', name: 'Eid-el-Maulud' },
    { id: '13', date: '2026-10-01', name: 'Independence Day' },
    { id: '14', date: '2026-12-25', name: 'Christmas Day' },
  ],
  addPublicHoliday: (holiday) => set((state) => {
    return {
      publicHolidays: [...state.publicHolidays, holiday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }),
  removePublicHoliday: (id: string) => set((state) => ({
    publicHolidays: state.publicHolidays.filter(h => h.id !== id)
  })),
}));
