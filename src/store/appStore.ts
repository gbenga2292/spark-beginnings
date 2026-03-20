import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/src/lib/supabaseService';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';

export interface LedgerCategory { id: string; name: string; }
export interface LedgerVendor { id: string; name: string; tinNumber?: string; }
export interface LedgerBank { id: string; name: string; }
export interface LedgerEntry {
  id: string; voucherNo: string; date: string; description: string;
  category: string; amount: number; client: string; site: string;
  vendor: string; bank: string; enteredBy: string;
}

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

export interface ServiceTemplate {
  serviceName: string;
  subtasks: { title: string; assignee: string; description?: string }[];
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

export interface GuarantorInfo {
  name: string;
  phone: string;
  verified: boolean;
}

export interface OnboardingChecklist {
  // Task 1
  emailFormsSent: boolean;
  emailFormsAcknowledged: boolean;
  // Task 2: Return of forms
  formsReturned: boolean;
  guarantorFormsReturned: boolean;      // 2.1
  personalEmployeeFormReturned: boolean; // 2.2
  passportReturned: boolean;             // 2.3
  // Task 3: Document verification
  guarantors: GuarantorInfo[];           // 3.1 - each has name, phone, verified
  passportPhotos: boolean;
  addressVerification: boolean;
  verifiedAddress?: string;          // 3.2 - typed address after verification
  educationalCredentials: boolean;
  // Task 3.2: Account details
  bankName: string;
  accountNo: string;
  accountDetailsVerified: boolean;
  // Task 3.2: Pension & PAYE
  pensionVerified: boolean;
  pensionNumberInput: string;
  payeVerified: boolean;
  payeNumberInput: string;
  // Task 4: Resumption
  verifiedStartDate: string;
  // Task 5: Employment letters
  employmentLettersIssued: boolean;
  // Post-activation tasks (6 & 8)
  orientationDone: boolean;
  ppeHandbookIssued: boolean;
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
  payeNumber?: string;
  status: 'Active' | 'On Leave' | 'Terminated' | 'Onboarding';
  monthlySalaries: MonthlySalary;
  avatar?: string;
  excludeFromOnboarding?: boolean;
  rent?: number;
  onboardingTasks?: OnboardingTask[];
  offboardingTasks?: OnboardingTask[];
  // New onboarding intake fields
  probationPeriod?: number;
  noOfGuarantors?: number;
  tentativeStartDate?: string;
  verifiedStartDate?: string;
  onboardingChecklist?: OnboardingChecklist;
  onboardingMainTaskId?: string;
  onboardingSuspended?: boolean;   // suspend/resume onboarding without deleting
}

export interface DisciplinaryRecord {
  id: string;
  employeeId: string;
  date: string;
  type: string;
  severity: string;
  description: string;
  actionTaken: string;
  status: 'Active' | 'Appealed' | 'Expired' | 'Closed'; // added Closed to align with workflows
  acknowledged: boolean;
  employeeComment?: string;
  attachments?: string[];
  createdBy: string;
  visibleToEmployee: boolean;

  // Multi-Step Workflow Fields
  reportedBy?: string;
  queryIssued?: boolean;
  queryDeadline?: string;
  queryReplied?: boolean;
  queryReplyText?: string;
  workflowState?: 'Reported' | 'Query Issued' | 'Under Review' | 'Committee' | 'Closed';
  initialResult?: 'Warning' | 'Committee' | 'No Consequence' | 'Pending';
  committeeMeetingDate?: string;
  finalResult?: 'Warning' | 'Suspension' | 'Termination' | 'No Consequence' | 'Pending';
  suspensionStartDate?: string;
  suspensionEndDate?: string;
}

export interface EvaluationRecord {
  id: string;
  employeeId: string;
  date: string;
  type: string;
  scores: Record<string, number>;
  overallScore: number;
  managerNotes: string;
  status: 'Draft' | 'Review' | 'Acknowledged';
  acknowledged: boolean;
  employeeComment?: string;
  createdBy: string;
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
  pendingSites: SiteQuestionnaire[];
  clients: string[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  disciplinaryRecords: DisciplinaryRecord[];
  evaluations: EvaluationRecord[];
  positions: string[];
  departments: string[];
  invoices: Invoice[];
  pendingInvoices: PendingInvoice[];
  salaryAdvances: SalaryAdvance[];
  loans: Loan[];
  payments: Payment[];
  vatPayments: VatPayment[];
  ledgerCategories: LedgerCategory[];
  ledgerVendors: LedgerVendor[];
  ledgerBanks: LedgerBank[];
  ledgerEntries: LedgerEntry[];
  addSite: (site: Site) => void;
  setSites: (sites: Site[]) => void;
  updateSite: (id: string, site: Partial<Site>) => void;
  deleteSite: (id: string) => void;
  
  addPendingSite: (site: SiteQuestionnaire) => void;
  setPendingSites: (sites: SiteQuestionnaire[]) => void;
  updatePendingSite: (id: string, site: Partial<SiteQuestionnaire>) => void;
  deletePendingSite: (id: string) => void;

  addClient: (client: string) => void;
  removeClient: (client: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addAttendanceRecords: (records: AttendanceRecord[]) => void;
  removeAttendanceRecordsByDate: (date: string) => void;
  deleteAttendanceRecords: (ids: string[]) => void;
  
  addDisciplinaryRecord: (record: DisciplinaryRecord) => void;
  updateDisciplinaryRecord: (id: string, record: Partial<DisciplinaryRecord>) => void;
  deleteDisciplinaryRecord: (id: string) => void;

  addEvaluation: (evalRecord: EvaluationRecord) => void;
  updateEvaluation: (id: string, evalRecord: Partial<EvaluationRecord>) => void;
  deleteEvaluation: (id: string) => void;

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
  
  addLedgerCategory: (category: LedgerCategory) => void;
  updateLedgerCategory: (id: string, category: Partial<LedgerCategory>) => void;
  removeLedgerCategory: (id: string) => void;
  
  addLedgerVendor: (vendor: LedgerVendor) => void;
  updateLedgerVendor: (id: string, vendor: Partial<LedgerVendor>) => void;
  removeLedgerVendor: (id: string) => void;
  
  addLedgerBank: (bank: LedgerBank) => void;
  updateLedgerBank: (id: string, bank: Partial<LedgerBank>) => void;
  removeLedgerBank: (id: string) => void;
  
  addLedgerEntry: (entry: LedgerEntry) => void;
  updateLedgerEntry: (id: string, entry: Partial<LedgerEntry>) => void;
  deleteLedgerEntry: (id: string) => void;

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
  hrVariables: {
    flaggedAbsenceThreshold: number;
    disciplinaryExpirationMonths: number;
    actionLevels: string[];
    defaultProbationDays: number;
    investigationPeriodDays: number;
    appealPeriodDays: number;
  };
  updateHrVariables: (variables: Partial<AppState['hrVariables']>) => void;
  saveAllSettings: (payroll: AppState['payrollVariables'], paye: AppState['payeTaxVariables'], months: AppState['monthValues'], hr: AppState['hrVariables']) => void;
  publicHolidays: { id: string; date: string; name: string }[];
  addPublicHoliday: (holiday: { id: string; date: string; name: string }) => void;
  removePublicHoliday: (id: string) => void;
  departmentTasksList: DepartmentTasks[];
  updateDepartmentTasks: (deptTasks: DepartmentTasks) => void;
  getServiceTemplates: () => ServiceTemplate[];
  updateServiceTemplate: (template: ServiceTemplate) => void;
  removeServiceTemplate: (serviceName: string) => void;
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
      pendingSites: [],
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
      disciplinaryRecords: [],
      evaluations: [],
      ledgerCategories: [],
      ledgerVendors: [],
      ledgerBanks: [],
      ledgerEntries: [],

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
      hrVariables: {
        flaggedAbsenceThreshold: 3,
        disciplinaryExpirationMonths: 6,
        actionLevels: ['Verbal Warning', 'Written Warning', 'Final Written Warning', 'Suspension'],
        defaultProbationDays: 90,
        investigationPeriodDays: 5,
        appealPeriodDays: 7,
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

      // Pending Sites
      addPendingSite: (site) => { set((s) => ({ pendingSites: [...s.pendingSites, site] })); },
      setPendingSites: (pendingSites) => { set({ pendingSites }); },
      updatePendingSite: (id, updatedSite) => { set((s) => ({ pendingSites: s.pendingSites.map(site => site.id === id ? { ...site, ...updatedSite } : site) })); },
      deletePendingSite: (id) => { set((s) => ({ pendingSites: s.pendingSites.filter(site => site.id !== id) })); },

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

      // Ledger Categories
      addLedgerCategory: (cat) => { set(s => ({ ledgerCategories: [...s.ledgerCategories, cat] })); db.insertLedgerCategory(cat); },
      updateLedgerCategory: (id, cat) => { set(s => ({ ledgerCategories: s.ledgerCategories.map(c => c.id === id ? { ...c, ...cat } : c) })); db.updateLedgerCategory(id, cat); },
      removeLedgerCategory: (id) => { set(s => ({ ledgerCategories: s.ledgerCategories.filter(c => c.id !== id) })); db.deleteLedgerCategory(id); },

      // Ledger Vendors
      addLedgerVendor: (v) => { set(s => ({ ledgerVendors: [...s.ledgerVendors, v] })); db.insertLedgerVendor(v); },
      updateLedgerVendor: (id, v) => { set(s => ({ ledgerVendors: s.ledgerVendors.map(c => c.id === id ? { ...c, ...v } : c) })); db.updateLedgerVendor(id, v); },
      removeLedgerVendor: (id) => { set(s => ({ ledgerVendors: s.ledgerVendors.filter(c => c.id !== id) })); db.deleteLedgerVendor(id); },

      // Ledger Banks
      addLedgerBank: (b) => { set(s => ({ ledgerBanks: [...s.ledgerBanks, b] })); db.insertLedgerBank(b); },
      updateLedgerBank: (id, b) => { set(s => ({ ledgerBanks: s.ledgerBanks.map(c => c.id === id ? { ...c, ...b } : c) })); db.updateLedgerBank(id, b); },
      removeLedgerBank: (id) => { set(s => ({ ledgerBanks: s.ledgerBanks.filter(c => c.id !== id) })); db.deleteLedgerBank(id); },

      // Ledger Entries
      addLedgerEntry: (e) => { set(s => ({ ledgerEntries: [...s.ledgerEntries, e] })); db.insertLedgerEntry(e); },
      updateLedgerEntry: (id, e) => { set(s => ({ ledgerEntries: s.ledgerEntries.map(c => c.id === id ? { ...c, ...e } : c) })); db.updateLedgerEntry(id, e); },
      deleteLedgerEntry: (id) => { set(s => ({ ledgerEntries: s.ledgerEntries.filter(c => c.id !== id) })); db.deleteLedgerEntry(id); },

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

      // HR Variables
      updateHrVariables: (variables) => {
        set((s) => {
          const updated = { ...s.hrVariables, ...variables };
          db.updateSettings({ hrVariables: updated });
          return { hrVariables: updated };
        });
      },

      saveAllSettings: (payroll, paye, months, hr) => {
        set(() => ({
          payrollVariables: payroll,
          payeTaxVariables: paye,
          monthValues: months,
          hrVariables: hr
        }));
        db.updateSettings({
          payrollVariables: payroll,
          payeTaxVariables: paye,
          monthValues: months,
          hrVariables: hr
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

      // Disciplinary
      addDisciplinaryRecord: (record) => { set((s) => ({ disciplinaryRecords: [...s.disciplinaryRecords, record] })); db.insertDisciplinaryRecord(record); },
      updateDisciplinaryRecord: (id, record) => { set((s) => ({ disciplinaryRecords: s.disciplinaryRecords.map(r => r.id === id ? { ...r, ...record } : r) })); db.updateDisciplinaryRecord(id, record); },
      deleteDisciplinaryRecord: (id) => { set((s) => ({ disciplinaryRecords: s.disciplinaryRecords.filter(r => r.id !== id) })); db.deleteDisciplinaryRecord(id); },

      // Evaluations
      addEvaluation: (record) => { set((s) => ({ evaluations: [...s.evaluations, record] })); db.insertEvaluation(record); },
      updateEvaluation: (id, record) => { set((s) => ({ evaluations: s.evaluations.map(r => r.id === id ? { ...r, ...record } : r) })); db.updateEvaluation(id, record); },
      deleteEvaluation: (id) => { set((s) => ({ evaluations: s.evaluations.filter(r => r.id !== id) })); db.deleteEvaluation(id); },

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

      // Service Templates (piggybacking on department_tasks DB)
      getServiceTemplates: () => {
        return get().departmentTasksList
          .filter(d => d.department.startsWith('__SERVICE__'))
          .map(d => ({
            serviceName: d.department.replace('__SERVICE__', ''),
            subtasks: d.onboardingTasks
          }));
      },
      updateServiceTemplate: (template) => {
        get().updateDepartmentTasks({
          department: `__SERVICE__${template.serviceName}`,
          onboardingTasks: template.subtasks,
          offboardingTasks: []
        });
      },
      removeServiceTemplate: (serviceName) => {
        // Technically this leaves an empty record or we can just empty it to hide it. 
        // We'll empty it to effectively "remove" it.
        get().updateDepartmentTasks({
          department: `__SERVICE__${serviceName}`,
          onboardingTasks: [],
          offboardingTasks: []
        });
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
