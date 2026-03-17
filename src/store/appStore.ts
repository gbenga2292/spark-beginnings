import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/src/lib/supabaseService';

export interface Site {
  id: string;
  name: string;
  client: string;
  vat: 'Yes' | 'No' | 'Add';
  status: 'Active' | 'Inactive';
  startDate?: string;
  endDate?: string;
}

export interface TaxBracket {
  id: string;
  upTo: number | null;
  rate: number;
  label: string;
}

export interface DepartmentTasks {
  department: string;
  onboardingTasks: { title: string; assignee: string }[];
  offboardingTasks: { title: string; assignee: string }[];
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  duration: number;
  expectedEndDate: string;
  reason: string;
  dateReturned: string;
  canBeContacted: 'Yes' | 'No';
  status: 'Active' | 'Cancelled';
  uploadedFile?: string;
  uploadedFileName?: string;
  supervisor?: string;
  management?: string;
}

export interface MonthlySalary {
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
}

export interface OnboardingTask {
  id: string;
  title: string;
  assignee: string;
  status: 'Completed' | 'In Progress' | 'Pending';
  date: string;
}

export interface Employee {
  id: string;
  employeeCode?: string;
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
  status: 'Active' | 'On Leave' | 'Terminated' | 'Onboarding';
  monthlySalaries: MonthlySalary;
  avatar?: string;
  excludeFromOnboarding?: boolean;
  rent?: number;
  onboardingTasks?: OnboardingTask[];
  offboardingTasks?: OnboardingTask[];
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
  overtimeDetails: string;
}

export interface PendingInvoice {
  id: string;
  invoiceNo: string;
  client: string;
  site: string;
  vatInc: 'Yes' | 'No' | 'Add';
  noOfMachine: number;
  dailyRentalCost: number;
  dieselCostPerLtr: number;
  dailyUsage: number;
  noOfTechnician: number;
  techniciansDailyRate: number;
  mobDemob: number;
  installation: number;
  damages: number;
  startDate: string;
  duration: number;
  endDate: string;
  rentalCost: number;
  dieselCost: number;
  techniciansCost: number;
  totalCost: number;
  vat: number;
  totalCharge: number;
  totalExclusiveOfVat: number;
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
  vatInc?: 'Yes' | 'No' | 'Add';
  noOfMachine?: number;
  dailyRentalCost?: number;
  dieselCostPerLtr?: number;
  dailyUsage?: number;
  noOfTechnician?: number;
  techniciansDailyRate?: number;
  mobDemob?: number;
  installation?: number;
  damages?: number;
  duration?: number;
  rentalCost?: number;
  dieselCost?: number;
  techniciansCost?: number;
  totalCost?: number;
  vat?: number;
  totalCharge?: number;
  totalExclusiveOfVat?: number;
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
  duration: number;
  startDate: string;
  paymentStartDate: string;
  remainingBalance: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Completed';
}

export interface Payment {
  id: string;
  client: string;
  site: string;
  date: string;
  amount: number;
  withholdingTax: number;
  discount: number;
  payVat: 'Yes' | 'No' | 'Add';
  vat: number;
  amountForVat: number;
}

export interface VatPayment {
  id: string;
  client: string;
  date: string;
  month: string;
  amount: number;
}

export interface MonthValue {
  workDays: number;
  overtimeRate: number;
}

interface AppState {
  sites: Site[];
  clients: string[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  positions: string[];
  departments: string[];
  invoices: Invoice[];
  pendingInvoices: PendingInvoice[];
  salaryAdvances: SalaryAdvance[];
  loans: Loan[];
  payments: Payment[];
  vatPayments: VatPayment[];
  addSite: (site: Site) => void;
  setSites: (sites: Site[]) => void;
  updateSite: (id: string, site: Partial<Site>) => void;
  deleteSite: (id: string) => void;
  addClient: (client: string) => void;
  removeClient: (client: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addAttendanceRecords: (records: AttendanceRecord[]) => void;
  removeAttendanceRecordsByDate: (date: string) => void;
  deleteAttendanceRecords: (ids: string[]) => void;
  addPosition: (position: string) => void;
  removePosition: (position: string) => void;
  addDepartment: (department: string) => void;
  removeDepartment: (department: string) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  addPendingInvoice: (inv: PendingInvoice) => void;
  updatePendingInvoice: (id: string, inv: Partial<PendingInvoice>) => void;
  deletePendingInvoice: (id: string) => void;
  addSalaryAdvance: (advance: SalaryAdvance) => void;
  updateSalaryAdvance: (id: string, advance: Partial<SalaryAdvance>) => void;
  deleteSalaryAdvance: (id: string) => void;
  addLoan: (loan: Loan) => void;
  updateLoan: (id: string, loan: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (id: string, payment: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  addVatPayment: (payment: VatPayment) => void;
  updateVatPayment: (id: string, payment: Partial<VatPayment>) => void;
  deleteVatPayment: (id: string) => void;
  payrollVariables: {
    basic: number;
    housing: number;
    transport: number;
    otherAllowances: number;
    employeePensionRate: number;
    employerPensionRate: number;
    withholdingTaxRate: number;
    nsitfRate: number;
    vatRate: number;
    departmentWorkDays?: Record<string, number>;
  };
  updatePayrollVariables: (variables: Partial<AppState['payrollVariables']>) => void;
  payeTaxVariables: {
    craBase: number;
    rentReliefRate: number;
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
  saveAllSettings: (payroll: AppState['payrollVariables'], paye: AppState['payeTaxVariables'], months: AppState['monthValues']) => void;
  publicHolidays: { id: string; date: string; name: string }[];
  addPublicHoliday: (holiday: { id: string; date: string; name: string }) => void;
  removePublicHoliday: (id: string) => void;
  departmentTasksList: DepartmentTasks[];
  updateDepartmentTasks: (deptTasks: DepartmentTasks) => void;
  leaves: LeaveRecord[];
  addLeave: (leave: LeaveRecord) => void;
  updateLeave: (id: string, leave: Partial<LeaveRecord>) => void;
  deleteLeave: (id: string) => void;
  leaveTypes: string[];
  addLeaveType: (type: string) => void;
  removeLeaveType: (type: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Default state (empty - data comes from Supabase) ──
      leaves: [],
      sites: [],
      clients: [],
      positions: [],
      departments: [],
      employees: [],
      attendanceRecords: [],
      pendingInvoices: [],
      invoices: [],
      salaryAdvances: [],
      loans: [],
      payments: [],
      vatPayments: [],
      publicHolidays: [],
      departmentTasksList: [],
      leaveTypes: [],

      payrollVariables: {
        basic: 40, housing: 30, transport: 20, otherAllowances: 10,
        employeePensionRate: 8, employerPensionRate: 10,
        withholdingTaxRate: 0.05, nsitfRate: 1, vatRate: 7.5,
      },
      payeTaxVariables: {
        craBase: 800000, rentReliefRate: 0.20,
        taxBrackets: [
          { id: 'tb-1', upTo: 2200000, rate: 0.15, label: 'First ₦2.2m' },
          { id: 'tb-2', upTo: 11200000, rate: 0.18, label: 'Next ₦9m' },
          { id: 'tb-3', upTo: 24200000, rate: 0.21, label: 'Next ₦13m' },
          { id: 'tb-4', upTo: 49200000, rate: 0.23, label: 'Next ₦25m' },
          { id: 'tb-5', upTo: null, rate: 0.25, label: 'Above ₦49.2m' },
        ],
        extraConditions: [],
      },
      monthValues: {
        jan: { workDays: 22, overtimeRate: 0.5 }, feb: { workDays: 20, overtimeRate: 0.5 },
        mar: { workDays: 21, overtimeRate: 0.5 }, apr: { workDays: 20, overtimeRate: 0.5 },
        may: { workDays: 22, overtimeRate: 0.5 }, jun: { workDays: 21, overtimeRate: 0.5 },
        jul: { workDays: 22, overtimeRate: 0.5 }, aug: { workDays: 21, overtimeRate: 0.5 },
        sep: { workDays: 22, overtimeRate: 0.5 }, oct: { workDays: 21, overtimeRate: 0.5 },
        nov: { workDays: 20, overtimeRate: 0.5 }, dec: { workDays: 22, overtimeRate: 0.5 },
      },

      // ── Actions with Supabase sync ──

      // Leaves
      addLeave: (leave) => { set((s) => ({ leaves: [...s.leaves, leave] })); db.insertLeave(leave); },
      updateLeave: (id, leave) => { set((s) => ({ leaves: s.leaves.map(l => l.id === id ? { ...l, ...leave } : l) })); db.updateLeave(id, leave); },
      deleteLeave: (id) => { set((s) => ({ leaves: s.leaves.filter(l => l.id !== id) })); db.deleteLeave(id); },

      // Sites
      addSite: (site) => { set((s) => ({ sites: [...s.sites, site] })); db.insertSite(site); },
      setSites: (sites) => { set({ sites }); db.setSites(sites); },
      updateSite: (id, updatedSite) => { set((s) => ({ sites: s.sites.map(site => site.id === id ? { ...site, ...updatedSite } : site) })); db.updateSite(id, updatedSite); },
      deleteSite: (id) => { set((s) => ({ sites: s.sites.filter(site => site.id !== id) })); db.deleteSite(id); },

      // Clients
      addClient: (client) => { set((s) => ({ clients: s.clients.includes(client) ? s.clients : [...s.clients, client] })); db.insertClient(client); },
      removeClient: (client) => { set((s) => ({ clients: s.clients.filter(c => c !== client) })); db.deleteClient(client); },

      // Employees
      addEmployee: (employee) => { set((s) => ({ employees: [...s.employees, employee] })); db.insertEmployee(employee); },
      updateEmployee: (id, updatedEmployee) => { set((s) => ({ employees: s.employees.map(emp => emp.id === id ? { ...emp, ...updatedEmployee } : emp) })); db.updateEmployee(id, updatedEmployee); },
      deleteEmployee: (id) => { set((s) => ({ employees: s.employees.filter(emp => emp.id !== id) })); db.deleteEmployee(id); },

      // Attendance
      addAttendanceRecords: (records) => { set((s) => ({ attendanceRecords: [...s.attendanceRecords, ...records] })); db.insertAttendanceRecords(records); },
      removeAttendanceRecordsByDate: (date) => { set((s) => ({ attendanceRecords: s.attendanceRecords.filter(r => r.date !== date) })); db.deleteAttendanceByDate(date); },
      deleteAttendanceRecords: (ids) => { set((s) => ({ attendanceRecords: s.attendanceRecords.filter(r => !ids.includes(r.id)) })); db.deleteAttendanceByIds(ids); },

      // Positions & Departments
      addPosition: (position) => { set((s) => ({ positions: [...s.positions, position] })); db.insertPosition(position); },
      removePosition: (position) => { set((s) => ({ positions: s.positions.filter(p => p !== position) })); db.deletePosition(position); },
      addDepartment: (department) => { set((s) => ({ departments: [...s.departments, department] })); db.insertDepartment(department); },
      removeDepartment: (department) => { set((s) => ({ departments: s.departments.filter(d => d !== department) })); db.deleteDepartment(department); },

      // Invoices
      addInvoice: (invoice) => { set((s) => ({ invoices: [...s.invoices, invoice] })); db.insertInvoice(invoice); },
      updateInvoice: (id, updatedInvoice) => { set((s) => ({ invoices: s.invoices.map(inv => inv.id === id ? { ...inv, ...updatedInvoice } : inv) })); db.updateInvoice(id, updatedInvoice); },
      deleteInvoice: (id) => { set((s) => ({ invoices: s.invoices.filter(inv => inv.id !== id) })); db.deleteInvoice(id); },

      // Pending Invoices
      addPendingInvoice: (inv) => { set((s) => ({ pendingInvoices: [...s.pendingInvoices, inv] })); db.insertPendingInvoice(inv); },
      updatePendingInvoice: (id, updated) => { set((s) => ({ pendingInvoices: s.pendingInvoices.map(inv => inv.id === id ? { ...inv, ...updated } : inv) })); db.updatePendingInvoice(id, updated); },
      deletePendingInvoice: (id) => { set((s) => ({ pendingInvoices: s.pendingInvoices.filter(inv => inv.id !== id) })); db.deletePendingInvoice(id); },

      // Salary Advances
      addSalaryAdvance: (advance) => { set((s) => ({ salaryAdvances: [...s.salaryAdvances, advance] })); db.insertSalaryAdvance(advance); },
      updateSalaryAdvance: (id, updatedAdvance) => { set((s) => ({ salaryAdvances: s.salaryAdvances.map(adv => adv.id === id ? { ...adv, ...updatedAdvance } : adv) })); db.updateSalaryAdvance(id, updatedAdvance); },
      deleteSalaryAdvance: (id) => { set((s) => ({ salaryAdvances: s.salaryAdvances.filter(adv => adv.id !== id) })); db.deleteSalaryAdvance(id); },

      // Loans
      addLoan: (loan) => { set((s) => ({ loans: [...s.loans, loan] })); db.insertLoan(loan); },
      updateLoan: (id, updatedLoan) => { set((s) => ({ loans: s.loans.map(ln => ln.id === id ? { ...ln, ...updatedLoan } : ln) })); db.updateLoan(id, updatedLoan); },
      deleteLoan: (id) => { set((s) => ({ loans: s.loans.filter(ln => ln.id !== id) })); db.deleteLoan(id); },

      // Payments
      addPayment: (payment) => { set((s) => ({ payments: [...s.payments, payment] })); db.insertPayment(payment); },
      updatePayment: (id, updatedPayment) => { set((s) => ({ payments: s.payments.map(p => p.id === id ? { ...p, ...updatedPayment } : p) })); db.updatePayment(id, updatedPayment); },
      deletePayment: (id) => { set((s) => ({ payments: s.payments.filter(p => p.id !== id) })); db.deletePayment(id); },

      // VAT Payments
      addVatPayment: (payment) => { set((s) => ({ vatPayments: [...s.vatPayments, payment] })); db.insertVatPayment(payment); },
      updateVatPayment: (id, updatedPayment) => { set((s) => ({ vatPayments: s.vatPayments.map(p => p.id === id ? { ...p, ...updatedPayment } : p) })); db.updateVatPayment(id, updatedPayment); },
      deleteVatPayment: (id) => { set((s) => ({ vatPayments: s.vatPayments.filter(p => p.id !== id) })); db.deleteVatPayment(id); },

      // Payroll Variables
      updatePayrollVariables: (variables) => {
        set((s) => {
          const updated = { ...s.payrollVariables, ...variables };
          db.updateSettings({ payrollVariables: updated });
          return { payrollVariables: updated };
        });
      },

      // PAYE Tax Variables
      updatePayeTaxVariables: (variables) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, ...variables };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },
      addTaxBracket: (bracket) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, taxBrackets: [...s.payeTaxVariables.taxBrackets, bracket] };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },
      updateTaxBracket: (id, update) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, taxBrackets: s.payeTaxVariables.taxBrackets.map(b => b.id === id ? { ...b, ...update } : b) };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },
      removeTaxBracket: (id) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, taxBrackets: s.payeTaxVariables.taxBrackets.filter(b => b.id !== id) };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },
      addPayeTaxExtraCondition: (cond) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, extraConditions: [...s.payeTaxVariables.extraConditions, cond] };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },
      updatePayeTaxExtraCondition: (id, update) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, extraConditions: s.payeTaxVariables.extraConditions.map(c => c.id === id ? { ...c, ...update } : c) };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },
      removePayeTaxExtraCondition: (id) => {
        set((s) => {
          const updated = { ...s.payeTaxVariables, extraConditions: s.payeTaxVariables.extraConditions.filter(c => c.id !== id) };
          db.updateSettings({ payeTaxVariables: updated });
          return { payeTaxVariables: updated };
        });
      },

      // Month Values
      updateMonthValue: (month, values) => {
        set((s) => {
          const updated = { ...s.monthValues, [month]: { ...s.monthValues[month], ...values } };
          db.updateSettings({ monthValues: updated });
          return { monthValues: updated };
        });
      },

      saveAllSettings: (payroll, paye, months) => {
        set(() => ({
          payrollVariables: payroll,
          payeTaxVariables: paye,
          monthValues: months
        }));
        db.updateSettings({
          payrollVariables: payroll,
          payeTaxVariables: paye,
          monthValues: months
        });
      },

      // Public Holidays
      addPublicHoliday: (holiday) => {
        set((s) => ({
          publicHolidays: [...s.publicHolidays, holiday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        }));
        db.insertPublicHoliday(holiday);
      },
      removePublicHoliday: (id: string) => { set((s) => ({ publicHolidays: s.publicHolidays.filter(h => h.id !== id) })); db.deletePublicHoliday(id); },

      // Department Tasks
      updateDepartmentTasks: (deptTasks) => {
        set((s) => {
          const exists = s.departmentTasksList.find(d => d.department === deptTasks.department);
          if (exists) {
            return { departmentTasksList: s.departmentTasksList.map(d => d.department === deptTasks.department ? deptTasks : d) };
          }
          return { departmentTasksList: [...s.departmentTasksList, deptTasks] };
        });
        db.upsertDepartmentTasks(deptTasks);
      },

      // Leave Types
      addLeaveType: (type) => { set((s) => ({ leaveTypes: s.leaveTypes.includes(type) ? s.leaveTypes : [...s.leaveTypes, type] })); db.insertLeaveType(type); },
      removeLeaveType: (type) => { set((s) => ({ leaveTypes: s.leaveTypes.filter(t => t !== type) })); db.deleteLeaveType(type); },
    }),
    {
      name: 'dcel-hr-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
