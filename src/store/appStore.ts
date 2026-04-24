import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/src/lib/supabaseService';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import { Vehicle, VehicleTripLeg, VehicleDocumentType } from '@/src/types/operations';

export interface CommLog {
  id: string;
  date: string;
  time?: string;
  direction: 'Incoming' | 'Outgoing';
  channel: 'Call' | 'Email' | 'WhatsApp' | 'Meeting' | 'SMS' | 'Visit' | 'Other';
  contactType: 'Client' | 'Site' | 'Both' | 'Potential Client';
  client?: string;
  siteId?: string;
  siteName?: string;
  contactPerson?: string;
  subject?: string;
  notes: string;
  outcome?: string;
  followUpDate?: string;
  followUpDone: boolean;
  loggedBy: string;
  parentId?: string;
  isInternal?: boolean;   // true = internal staff comm, false/undefined = external client comm
  reportedBy?: string[];  // for internal logs: list of reporter names
  createdAt: string;
}

export interface ClientContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  note?: string;
  clientName: string;
  siteIds?: string[];
  siteNames?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyJournal {
  id: string;
  date: string;
  generalNotes: string;
  loggedBy: string;
  createdAt: string;
}

export interface SiteJournalEntry {
  id: string;
  journalId: string;
  siteId: string;
  siteName: string;
  clientName: string;
  narration: string;
  createdAt: string;
  loggedBy: string;
}

export interface StaffMeritRecord {
  id: string;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  recordType: 'Accolade' | 'Infringement';
  category: 'Behaviour on Site' | 'Dress Code' | 'PPE Maintenance' | 'Client Accolade' | 'Client Complaint' | 'Other';
  description: string;
  siteId?: string;
  siteName?: string;
  loggedById?: string;
  loggedByName?: string;
  hrNotified: boolean;
  incidentDate: string;
  createdAt: string;
}

export interface LedgerCategory { id: string; name: string; }
export interface LedgerVendor { id: string; name: string; tinNumber?: string; }
export interface LedgerBank { id: string; name: string; }
export interface LedgerBeneficiaryBank { id: string; name: string; accountNo: string; }
export interface LedgerEntry {
  id: string; voucherNo: string; date: string; description: string;
  category: string; amount: number; client: string; site: string;
  vendor: string; bank: string; enteredBy: string;
}

export interface CompanyExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  paidFrom: string;
  paidToBankName: string;
  paidToAccountNo: string;
  enteredBy: string;
  createdAt: string;
  status?: string;
}

export interface ClientProfile {
  id: string; // The supabse ID
  name: string;
  tinNumber?: string;
  startDate?: string;
  createdAt?: string;
}

export interface Site {
  id: string;
  name: string;
  client: string;
  vat: 'Yes' | 'No' | 'Add';
  status: 'Active' | 'Inactive' | 'Ended';
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

export interface Department {
  id: string;
  name: string;
  staffType: 'OFFICE' | 'FIELD' | 'NON-EMPLOYEE';
  workDaysPerWeek: number;
  parentDepartmentId?: string | null;
}

export interface Position {
  id: string;
  title: string;
  departmentId: string | null;
}

export const DEFAULT_OFFBOARDING_TASKS = [
  { title: '1. Documentation & Compliance - Receive and file resignation/termination letter', assignee: 'HR' },
  { title: '1. Documentation & Compliance - Update personnel records', assignee: 'HR' },
  { title: '1. Documentation & Compliance - Prepare final salary settlement', assignee: 'Finance' },
  { title: '2. Access & Security - Remove from Whatsapp Group or Internal Groups', assignee: 'IT' },
  { title: '2. Access & Security - Collect company property (laptop, phone, ID badge, keys, credit cards, uniforms)', assignee: 'Operations' },
  { title: '3. Knowledge Transfer - Ensure handover of ongoing projects/tasks', assignee: 'Management' },
  { title: '3. Knowledge Transfer - Collect important files and documentation', assignee: 'Management' },
  { title: '3. Knowledge Transfer - Redirect client communications and responsibilities', assignee: 'Management' },
  { title: '3. Knowledge Transfer - Assign replacement or interim staff', assignee: 'Management' },
  { title: '4. Employee Relations - Conduct exit interview', assignee: 'HR' },
  { title: '4. Employee Relations - Communicate departure to relevant teams', assignee: 'HR' },
  { title: '4. Employee Relations - Thank employee for contributions', assignee: 'HR' },
  { title: '4. Employee Relations - Provide reference letter (if applicable)', assignee: 'HR' },
  { title: '5. Benefits & Post-Employment - Notify benefits providers (health insurance, pension, etc.)', assignee: 'HR' },
  { title: '5. Benefits & Post-Employment - Issue employment certificate/clearance letter', assignee: 'HR' },
  { title: '5. Benefits & Post-Employment - Provide tax forms and final payslip', assignee: 'Finance' },
  { title: '5. Benefits & Post-Employment - Invite to alumni network (if applicable)', assignee: 'HR' },
  { title: '6. Final HR Sign-Off - All documentation completed', assignee: 'HR' },
  { title: '6. Final HR Sign-Off - Payroll & benefits settled', assignee: 'Finance' },
  { title: '6. Final HR Sign-Off - IT/system access revoked', assignee: 'IT' },
  { title: '6. Final HR Sign-Off - Company assets returned', assignee: 'Operations' },
  { title: '6. Final HR Sign-Off - Knowledge transfer verified', assignee: 'Management' },
  { title: '6. Final HR Sign-Off - Exit interview conducted', assignee: 'HR' },
  { title: '6. Final HR Sign-Off - Internal communication sent', assignee: 'HR' },
  { title: '6. Final HR Sign-Off - Legal compliance confirmed', assignee: 'HR' }
];

export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: 'lt-1', name: 'Annual', defaultDays: 20 },
  { id: 'lt-2', name: 'Sick', defaultDays: 14 },
  { id: 'lt-3', name: 'Maternity', defaultDays: 90 },
  { id: 'lt-4', name: 'Paternity', defaultDays: 14 },
  { id: 'lt-5', name: 'Casual', defaultDays: 5 },
  { id: 'lt-6', name: 'Compassionate', defaultDays: 5 },
  { id: 'lt-7', name: 'Study Leave', defaultDays: 14 },
  { id: 'lt-8', name: 'Bereavement', defaultDays: 7 },
];

export interface ServiceTemplate {
  serviceName: string;
  subtasks: { title: string; assignee: string; description?: string }[];
}

export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'date';

export interface FieldDefinition {
  id: string; // The property key it maps to (e.g., 'dischargeLocation')
  label: string;
  type: FieldType;
  options?: string[]; // For 'select' dropdowns
  requiredForActivation?: boolean; 
  placeholder?: string;
}

export interface PhaseDefinition {
  title: string;
  fields: FieldDefinition[];
}

export interface OnboardingTemplate {
  serviceName: string; // e.g. "Waterproofing", "Dewatering"
  phases: {
    phase1: PhaseDefinition;
    phase2: PhaseDefinition;
    phase3: PhaseDefinition;
    phase4: PhaseDefinition;
    phase5: PhaseDefinition;
  };
}

export interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
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
  nasFilePath?: string;
  supervisor?: string;
  management?: string;
  approvedById?: string;
  approvedByName?: string;
  approvalTaskId?: string;
  approvedAt?: string;
  rejectionNote?: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  personResponsibleDuringAbsence?: string;
  personResponsibleId?: string;
  keyDuties?: string[];
  formDateReturned?: string;
  employeeSignature?: { signed: 'Signed' | 'Unsigned'; date?: string };
  supervisorSignature?: { signed: 'Signed' | 'Unsigned'; date?: string };
  hodSignature?: { signed: 'Signed' | 'Unsigned'; date?: string };
  managementSignature?: { signed: 'Signed' | 'Unsigned'; date?: string };
  hrSignature?: { signed: 'Signed' | 'Unsigned'; date?: string };
  hrApprovedFrom?: string;
  hrApprovedTo?: string;
  leaveNumber?: string;
  // Sequential workflow tracking
  // workflowStep: 1=LM pending, 2=HoD pending, 3=Mgmt pending, 4=HR pending, 5=Fully approved, -1=Rejected
  workflowStep?: number;
  lineManagerTaskId?: string;   // subtask ID for LM approval
  hodTaskId?: string;           // subtask ID for HoD approval
  managementTaskId?: string;    // subtask ID for Management approval
  hrTaskId?: string;            // subtask ID for HR approval
  hodEmployeeId?: string;       // resolved HoD employee ID
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
  // 1. Send Necessary Information (Forms)
  emailFormsSent: boolean;           // All necessary forms sent
  emailFormsAcknowledged: boolean;   // Acknowledgement received

  // 2. Return of Forms
  formsReturned: boolean;            // Employee returned completed forms (main gate)
  guarantorFormsReturned: boolean;   // Guarantor forms returned
  guarantorPassportReturned: boolean; // Guarantor form includes passport photo
  personalEmployeeFormReturned: boolean; // Personal employee form returned
  personalEmployeePassportReturned: boolean; // Personal employee form includes passport photo

  // 3. Verification of Documents
  guarantors: GuarantorInfo[];
  passportPhotos: boolean;           // Passport photos verified
  addressVerification: boolean;      // Address input & verified
  verifiedAddress?: string;
  educationalCredentials: boolean;   // Education qualification doc verified
  bankName: string;
  accountNo: string;
  accountDetailsVerified: boolean;
  pensionNumberInput: string;
  pensionVerified: boolean;
  payeNumberInput: string;
  payeVerified: boolean;

  // 4. Employment Letters
  employmentLetterPrinted?: boolean;  // step 1: letter printed
  employmentLetterSigned?: boolean;   // step 2: signed by HR & employee
  employmentLetterFiled?: boolean;    // step 3: returned & filed
  employmentLettersIssued: boolean;   // legacy combined flag (true when all 3 done)

  // 5. Resumption
  verifiedStartDate: string;

  // Post Onboarding (6. Orientation)
  orientationDone: boolean;          // Legacy combined orientation flag
  hrOrientation: boolean;
  departmentOrientation: boolean;
  siteOrientation: boolean;
  hseOrientation: boolean;

  // 7. Provision of PPE, Handbook & Requirements
  ppeHandbookIssued: boolean;        // Legacy combined PPE/handbook flag
  ppeIssued: boolean;
  handbookProvided: boolean;
  otherRequirementsSupplied: boolean;

  // 8. Health insurance (LASHMA)
  lashmaPolicyNumber: string;
  lashmaRegistrationDate?: string;
  lashmaExpiryDate?: string;
  lashmaVerified: boolean;
}

export interface Employee {
  id: string;
  employeeCode?: string;
  surname: string;
  firstname: string;
  department: string;
  staffType: 'OFFICE' | 'FIELD' | 'NON-EMPLOYEE';
  position: string;
  startDate: string;
  endDate: string;
  yearlyLeave: number;
  bankName: string;
  accountNo: string;
  payeTax: boolean;
  withholdingTax: boolean;
  withholdingTaxRate?: number; // per-consultant rate (e.g. 0.05 or 0.10)
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
  lineManager?: string;            // ID of the line manager (typically CEO or Head of Dept)
  phone?: string;
  email?: string;
  payeeType?: string;
  typeOfPay?: string;
  startMonthOfPay?: string;
  level?: number;
  lashmaPolicyNumber?: string;
  lashmaRegistrationDate?: string;
  lashmaExpiryDate?: string;
  lashmaDuration?: number;
  secondaryDepartments?: string[];
}

export interface DisciplinaryRecord {
  id: string;
  employeeId: string;
  date: string;
  type: string;
  severity: string;
  description: string;
  actionTaken?: string;
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
  points?: number; // 0=nothing, <0=demerit, >0=merit
  workspaceId?: string;
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
  overtimeDetails: string;

  // Calculated fields (Transient, should be derived via calculateAttendanceMetrics)
  nightWk?: number;
  ot?: number;
  otSite?: string;
  dayWk?: number;
  dow?: number;
  ndw?: 'Yes' | 'No';
  mth?: number;
  isPresent?: 'Yes' | 'No';
  day2?: number;
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
  printLayout?: any;
  historyLog?: any[];
  machineConfigs?: { qt: number, rate: number, duration: number }[];
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
  printLayout?: any;
  historyLog?: any[];
  machineConfigs?: { qt: number, rate: number, duration: number }[];
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Deducted';
  approvedById?: string;
  approvedByName?: string;
  approvalTaskId?: string;
  approvedAt?: string;
  rejectionNote?: string;
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
  approvedById?: string;
  approvedByName?: string;
  approvalTaskId?: string;
  approvedAt?: string;
  rejectionNote?: string;
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
  vat?: number;
  amountForVat?: number;
}

export interface VatPayment {
  id: string;
  client: string;
  date: string;
  month: string;
  year: string;
  amount: number;
}

export interface MonthValue {
  workDays: number;
  overtimeRate: number;
}

interface AppState {
  commLogs: CommLog[];
  addCommLog: (log: CommLog) => void;
  updateCommLog: (id: string, log: Partial<CommLog>) => void;
  deleteCommLog: (id: string) => void;

  clientContacts: ClientContact[];
  addClientContact: (contact: ClientContact) => void;
  updateClientContact: (id: string, updates: Partial<ClientContact>) => void;
  deleteClientContact: (id: string) => void;
  setClientContacts: (contacts: ClientContact[]) => void;

  dailyJournals: DailyJournal[];
  siteJournalEntries: SiteJournalEntry[];
  addDailyJournal: (journal: DailyJournal, entries: SiteJournalEntry[]) => void;
  updateDailyJournal: (journalId: string, journal: Partial<DailyJournal>, newEntries: SiteJournalEntry[]) => void;
  deleteDailyJournal: (journalId: string) => void;
  deleteSiteJournalEntry: (entryId: string) => void;

  sites: Site[];
  pendingSites: SiteQuestionnaire[];
  clients: string[]; // Keep this for legacy dropdowns and backward compat
  clientProfiles: ClientProfile[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  disciplinaryRecords: DisciplinaryRecord[];
  evaluations: EvaluationRecord[];
  positions: Position[];
  departments: Department[];
  invoices: Invoice[];
  pendingInvoices: PendingInvoice[];
  salaryAdvances: SalaryAdvance[];
  loans: Loan[];
  payments: Payment[];
  vatPayments: VatPayment[];
  ledgerCategories: LedgerCategory[];
  ledgerVendors: LedgerVendor[];
  ledgerBanks: LedgerBank[];
  ledgerBeneficiaryBanks: LedgerBeneficiaryBank[];
  ledgerEntries: LedgerEntry[];
  companyExpenses: CompanyExpense[];
  pendingLedgerEntries: CompanyExpense[];
  staffMeritRecords: StaffMeritRecord[];
  vehicles: Vehicle[];
  vehicleTrips: VehicleTripLeg[];
  vehicleDocumentTypes: VehicleDocumentType[];
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

  setClientProfiles: (profiles: ClientProfile[]) => void;
  addClientProfile: (profile: ClientProfile) => void;
  updateClientProfile: (id: string, updates: Partial<ClientProfile>) => void;
  deleteClientProfile: (id: string) => void;

  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  bulkUpdateEmployees: (ids: string[], employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addAttendanceRecords: (records: AttendanceRecord[]) => Promise<void>;
  updateAttendanceRecord: (id: string, record: Partial<AttendanceRecord>) => Promise<void>;
  removeAttendanceRecordsByDate: (date: string) => Promise<void>;
  deleteAttendanceRecords: (ids: string[]) => Promise<void>;
  
  addDisciplinaryRecord: (record: DisciplinaryRecord) => void;
  updateDisciplinaryRecord: (id: string, record: Partial<DisciplinaryRecord>) => void;
  deleteDisciplinaryRecord: (id: string) => void;

  addEvaluation: (evalRecord: EvaluationRecord) => void;
  updateEvaluation: (id: string, evalRecord: Partial<EvaluationRecord>) => void;
  deleteEvaluation: (id: string) => void;

  addPosition: (position: Position) => void;
  updatePosition: (id: string, position: Partial<Position>) => void;
  removePosition: (id: string) => void;
  addDepartment: (department: Department) => void;
  updateDepartment: (id: string, department: Partial<Department>) => void;
  removeDepartment: (id: string) => void;
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
  
  addLedgerBeneficiaryBank: (bank: LedgerBeneficiaryBank) => void;
  updateLedgerBeneficiaryBank: (id: string, bank: Partial<LedgerBeneficiaryBank>) => void;
  removeLedgerBeneficiaryBank: (id: string) => void;
  
  addLedgerEntry: (entry: LedgerEntry) => void;
  updateLedgerEntry: (id: string, entry: Partial<LedgerEntry>) => void;
  deleteLedgerEntry: (id: string) => void;
  setPositions: (positions: Position[]) => Promise<void>;
  setDepartments: (departments: Department[]) => Promise<void>;
  setClients: (clients: string[]) => Promise<void>;
  setPublicHolidays: (holidays: { id: string; date: string; name: string }[]) => Promise<void>;
  setLeaveTypes: (types: LeaveType[]) => Promise<void>;
  updateLeaveType: (name: string, defaultDays: number) => Promise<void>;
  setLedgerCategories: (cats: LedgerCategory[]) => Promise<void>;
  setLedgerVendors: (vendors: LedgerVendor[]) => Promise<void>;
  setLedgerBanks: (banks: LedgerBank[]) => Promise<void>;
  setLedgerBeneficiaryBanks: (banks: LedgerBeneficiaryBank[]) => Promise<void>;
  setDepartmentTasksList: (list: DepartmentTasks[]) => Promise<void>;
  bulkAddLedgerEntries: (entries: LedgerEntry[]) => void;
  bulkUpdateLedgerEntries: (ids: string[], update: Partial<LedgerEntry>) => void;

  addCompanyExpense: (expense: CompanyExpense) => void;
  updateCompanyExpense: (id: string, expense: Partial<CompanyExpense>) => void;
  deleteCompanyExpense: (id: string) => void;

  setPendingLedgerEntries: (entries: CompanyExpense[]) => void;
  clearPendingLedgerEntries: () => void;

  addStaffMeritRecord: (record: StaffMeritRecord) => void;
  updateStaffMeritRecord: (id: string, record: Partial<StaffMeritRecord>) => void;
  deleteStaffMeritRecord: (id: string) => void;
  setStaffMeritRecords: (records: StaffMeritRecord[]) => void;
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (id: string, vehicle: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  addVehicleTripRecords: (logs: any[]) => void;
  addVehicleDocumentType: (type: VehicleDocumentType) => void;
  deleteVehicleDocumentType: (id: string) => void;
  updateVehicleDocument: (vehicleId: string, docTypeName: string, date: string) => void;
  updateVehicleTripRecord: (id: string, log: any) => void;
  deleteVehicleTripRecord: (id: string) => void;

  payrollVariables: {
    basic: number;
    housing: number;
    transport: number;
    otherAllowances: number;
    employeePensionRate: number;
    employerPensionRate: number;
    nsitfRate: number;
    vatRate: number;
    withholdingTaxRate: number;
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
    onboardingStageLabels?: Record<string, string>;
    performanceCategories?: string[]; // Attendance, Behavioral, Performance, Safety, Accolade, etc.
    meritWeight?: number; // Default +1
    demeritWeight?: number; // Default -1
    suspensionCapDays?: number; 
    enableAutomaticEvaluationPenalty?: boolean; 
    sanctionThresholds?: { action: string; points: number }[];
    payeeTypes?: string[];
  };
  updateHrVariables: (variables: Partial<AppState['hrVariables']>) => void;
  saveAllSettings: (payroll: AppState['payrollVariables'], paye: AppState['payeTaxVariables'], months: AppState['monthValues'], hr: AppState['hrVariables'], onboarding: AppState['onboardingTemplates']) => void;
  publicHolidays: { id: string; date: string; name: string }[];
  addPublicHoliday: (holiday: { id: string; date: string; name: string }) => void;
  removePublicHoliday: (id: string) => void;
  departmentTasksList: DepartmentTasks[];
  updateDepartmentTasks: (deptTasks: DepartmentTasks) => void;
  getServiceTemplates: () => ServiceTemplate[];
  updateServiceTemplate: (template: ServiceTemplate) => void;
  removeServiceTemplate: (serviceName: string) => void;
  onboardingTemplates: OnboardingTemplate[];
  updateOnboardingTemplate: (template: OnboardingTemplate) => void;
  removeOnboardingTemplate: (serviceName: string) => void;
  leaves: LeaveRecord[];
  addLeave: (leave: LeaveRecord) => void;
  updateLeave: (id: string, leave: Partial<LeaveRecord>) => void;
  deleteLeave: (id: string) => void;
  leaveTypes: LeaveType[];
  addLeaveType: (name: string) => void;
  removeLeaveType: (name: string) => void;
  isVariablesDirty: boolean;
  setVariablesDirty: (val: boolean) => void;
  isLedgerDirty: boolean;
  setLedgerDirty: (val: boolean) => void;
  isEmployeeFormDirty: boolean;
  setEmployeeFormDirty: (val: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Default state (empty - data comes from Supabase) ──
      commLogs: [],
      dailyJournals: [],
      siteJournalEntries: [],
      leaves: [],
      isVariablesDirty: false,
      setVariablesDirty: (val) => set({ isVariablesDirty: val }),
      isLedgerDirty: false,
      setLedgerDirty: (val) => set({ isLedgerDirty: val }),
      isEmployeeFormDirty: false,
      setEmployeeFormDirty: (val) => set({ isEmployeeFormDirty: val }),
      sites: [],
      pendingSites: [],
      clients: [],
      clientProfiles: [],
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
      leaveTypes: [...DEFAULT_LEAVE_TYPES],
      disciplinaryRecords: [],
      evaluations: [],
      ledgerCategories: [],
      ledgerVendors: [],
      ledgerBanks: [],
      ledgerBeneficiaryBanks: [],
      ledgerEntries: [],
      companyExpenses: [],
      pendingLedgerEntries: [],
      staffMeritRecords: [],
      vehicles: [],
      vehicleTrips: [],
      vehicleDocumentTypes: [],
      clientContacts: [],
      
      onboardingTemplates: [
        {
          serviceName: 'Dewatering',
          phases: {
            phase1: {
              title: 'Phase 1',
              fields: [
                { id: 'isNewSite', label: 'Is New Site', type: 'checkbox', requiredForActivation: false },
                { id: 'isNewClient', label: 'Is New Client', type: 'checkbox', requiredForActivation: false },
                { id: 'whatIsBeingBuilt', label: 'What is being built', type: 'text', requiredForActivation: true },
                { id: 'excavationDepthMeters', label: 'Excavation Depth (m)', type: 'number', requiredForActivation: true },
                { id: 'siteLength', label: 'Site Length (m)', type: 'number', requiredForActivation: true },
                { id: 'siteWidth', label: 'Site Width (m)', type: 'number', requiredForActivation: true },
                { id: 'geotechnicalReportAvailable', label: 'Geotechnical Report Available', type: 'checkbox', requiredForActivation: false },
                { id: 'hydrogeologicalDataAvailable', label: 'Hydrogeological Data Available', type: 'checkbox', requiredForActivation: false },
              ]
            },
            phase2: {
              title: 'Phase 2',
              fields: [
                { id: 'knownObstacles', label: 'Known Obstacles', type: 'text', requiredForActivation: false },
                { id: 'dischargeLocation', label: 'Discharge Location', type: 'text', requiredForActivation: true },
                { id: 'dieselSupplyStrategy', label: 'Diesel Supply Strategy', type: 'select', options: ['Client', 'DCEL'], requiredForActivation: true },
              ]
            },
            phase3: {
              title: 'Phase 3',
              fields: [
                { id: 'totalWellpointsRequired', label: 'Total Wellpoints Required', type: 'number', requiredForActivation: true },
                { id: 'totalHeadersRequired', label: 'Total Headers Required', type: 'number', requiredForActivation: true },
                { id: 'totalPumpsRequired', label: 'Total Pumps Required', type: 'number', requiredForActivation: true },
                { id: 'expectedDailyDieselUsage', label: 'Expected Daily Diesel Usage (Liters)', type: 'number', requiredForActivation: true },
              ]
            },
            phase4: {
              title: 'Phase 4',
              fields: [
                { id: 'scopeOfWorkSummary', label: 'Scope of Work Summary', type: 'text', requiredForActivation: true },
                { id: 'scopeExclusionsSummary', label: 'Scope Exclusions Summary', type: 'text', requiredForActivation: true },
              ]
            },
            phase5: {
              title: 'Phase 5',
              fields: [
                { id: 'safetyPlanIntegrated', label: 'Safety Plan Integrated', type: 'checkbox', requiredForActivation: true },
                { id: 'stage1AdvanceReceived', label: 'Stage 1 Advance Received', type: 'checkbox', requiredForActivation: true },
                { id: 'stage2InstallationComplete', label: 'Stage 2 Installation Complete', type: 'checkbox', requiredForActivation: true },
                { id: 'stage2FirstInvoiceIssued', label: 'Stage 2 First Invoice Issued', type: 'checkbox', requiredForActivation: true },
                { id: 'stage3TimelyBilling', label: 'Stage 3 Timely Billing Ongoing', type: 'checkbox', requiredForActivation: true },
                { id: 'stage4DemobilizationComplete', label: 'Stage 4 Demobilization Complete', type: 'checkbox', requiredForActivation: true },
                { id: 'stage4FinalInvoiceIssued', label: 'Stage 4 Final Invoice Issued', type: 'checkbox', requiredForActivation: true },
              ]
            }
          }
        },
        {
          serviceName: 'Waterproofing',
          phases: {
            phase1: {
              title: 'Phase 1',
              fields: [
                { id: 'isNewSite', label: 'Is New Site', type: 'checkbox', requiredForActivation: false },
                { id: 'isNewClient', label: 'Is New Client', type: 'checkbox', requiredForActivation: false },
                { id: 'whatIsBeingBuilt', label: 'What is being built', type: 'text', requiredForActivation: true },
                { id: 'excavationDepthMeters', label: 'Excavation Depth (m)', type: 'number', requiredForActivation: true },
                { id: 'siteLength', label: 'Site Length (m)', type: 'number', requiredForActivation: true },
                { id: 'siteWidth', label: 'Site Width (m)', type: 'number', requiredForActivation: true },
                { id: 'geotechnicalReportAvailable', label: 'Geotechnical Report Available', type: 'checkbox', requiredForActivation: false },
                { id: 'hydrogeologicalDataAvailable', label: 'Hydrogeological Data Available', type: 'checkbox', requiredForActivation: false },
              ]
            },
            phase2: {
              title: 'Phase 2',
              fields: [
                { id: 'knownObstacles', label: 'Known Obstacles', type: 'text', requiredForActivation: false },
                { id: 'dischargeLocation', label: 'Discharge Location', type: 'text', requiredForActivation: true },
                { id: 'dieselSupplyStrategy', label: 'Diesel Supply Strategy', type: 'select', options: ['Client', 'DCEL'], requiredForActivation: true },
              ]
            },
            phase3: {
              title: 'Phase 3',
              fields: [
                { id: 'totalWellpointsRequired', label: 'Total Wellpoints Required', type: 'number', requiredForActivation: true },
                { id: 'totalHeadersRequired', label: 'Total Headers Required', type: 'number', requiredForActivation: true },
                { id: 'totalPumpsRequired', label: 'Total Pumps Required', type: 'number', requiredForActivation: true },
                { id: 'expectedDailyDieselUsage', label: 'Expected Daily Diesel Usage (Liters)', type: 'number', requiredForActivation: true },
              ]
            },
            phase4: {
              title: 'Phase 4',
              fields: [
                { id: 'scopeOfWorkSummary', label: 'Scope of Work Summary', type: 'text', requiredForActivation: true },
                { id: 'scopeExclusionsSummary', label: 'Scope Exclusions Summary', type: 'text', requiredForActivation: true },
              ]
            },
            phase5: {
              title: 'Phase 5',
              fields: [
                { id: 'safetyPlanIntegrated', label: 'Safety Plan Integrated', type: 'checkbox', requiredForActivation: true },
                { id: 'stage1AdvanceReceived', label: 'Stage 1 Advance Received', type: 'checkbox', requiredForActivation: true },
                { id: 'stage2InstallationComplete', label: 'Stage 2 Installation Complete', type: 'checkbox', requiredForActivation: true },
                { id: 'stage2FirstInvoiceIssued', label: 'Stage 2 First Invoice Issued', type: 'checkbox', requiredForActivation: true },
                { id: 'stage3TimelyBilling', label: 'Stage 3 Timely Billing Ongoing', type: 'checkbox', requiredForActivation: true },
                { id: 'stage4DemobilizationComplete', label: 'Stage 4 Demobilization Complete', type: 'checkbox', requiredForActivation: true },
                { id: 'stage4FinalInvoiceIssued', label: 'Stage 4 Final Invoice Issued', type: 'checkbox', requiredForActivation: true },
              ]
            }
          }
        }
      ],

      payrollVariables: {
        basic: 40, housing: 30, transport: 20, otherAllowances: 10,
        employeePensionRate: 8, employerPensionRate: 10,
        nsitfRate: 1, vatRate: 7.5, withholdingTaxRate: 5,
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
        actionLevels: ['Verbal Warning', 'Written Warning', 'Final Written Warning', 'Suspension', 'Termination'],
        defaultProbationDays: 90,
        investigationPeriodDays: 5,
        appealPeriodDays: 7,
        sanctionThresholds: [
          { action: 'Verbal Warning', points: -1 },
          { action: 'Written Warning', points: -3 },
          { action: 'Final Warning', points: -5 },
          { action: 'Suspension', points: -8 },
          { action: 'Termination', points: -12 }
        ],
        payeeTypes: []
      },

      // ── Actions with Supabase sync ──

      // Communication Logs
      addCommLog: (log) => { set((s) => ({ commLogs: [...s.commLogs, log] })); db.insertCommLog(log); },
      updateCommLog: (id, log) => { set((s) => ({ commLogs: s.commLogs.map(l => l.id === id ? { ...l, ...log } : l) })); db.updateCommLog(id, log); },
      deleteCommLog: (id) => { set((s) => ({ commLogs: s.commLogs.filter(l => l.id !== id) })); db.deleteCommLog(id); },

      // Client Contacts
      addClientContact: (contact) => set((s) => ({ clientContacts: [...s.clientContacts, contact] })),
      updateClientContact: (id, updates) => set((s) => {
        const oldContact = s.clientContacts.find(c => c.id === id);
        const updatedContacts = s.clientContacts.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c);
        // Cascade name change to all comm logs referencing this contact
        const updatedLogs = (updates.name && oldContact && updates.name !== oldContact.name)
          ? s.commLogs.map(l => (!l.isInternal && l.contactPerson === oldContact.name) ? { ...l, contactPerson: updates.name } : l)
          : s.commLogs;
        return { clientContacts: updatedContacts, commLogs: updatedLogs };
      }),
      deleteClientContact: (id) => set((s) => ({ clientContacts: s.clientContacts.filter(c => c.id !== id) })),
      setClientContacts: (contacts) => set({ clientContacts: contacts }),

      // Daily Journals
      addDailyJournal: (journal, entries) => {
        set((s) => ({
          dailyJournals: [...s.dailyJournals, journal],
          siteJournalEntries: [...s.siteJournalEntries, ...entries],
        }));
        db.insertDailyJournal(journal, entries);
      },
      updateDailyJournal: (journalId, journal, newEntries) => {
        set((s) => ({
          dailyJournals: s.dailyJournals.map((j) => (j.id === journalId ? { ...j, ...journal } : j)),
          siteJournalEntries: [...s.siteJournalEntries.filter((e) => e.journalId !== journalId), ...newEntries],
        }));
        db.updateDailyJournal(journalId, journal, newEntries);
      },
      deleteDailyJournal: (journalId) => {
        set((s) => ({
          dailyJournals: s.dailyJournals.filter((j) => j.id !== journalId),
          siteJournalEntries: s.siteJournalEntries.filter((e) => e.journalId !== journalId),
        }));
        db.deleteDailyJournal(journalId);
      },
      deleteSiteJournalEntry: (entryId) => {
        set((s) => ({
          siteJournalEntries: s.siteJournalEntries.filter((e) => e.id !== entryId),
        }));
        db.deleteSiteJournalEntry(entryId);
      },

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
      addPendingSite: (site) => { set((s) => ({ pendingSites: [...s.pendingSites, site] })); db.insertPendingSite(site); },
      setPendingSites: (pendingSites) => { set({ pendingSites }); db.setPendingSites(pendingSites); },
      updatePendingSite: (id, updatedSite) => { set((s) => ({ pendingSites: s.pendingSites.map(site => site.id === id ? { ...site, ...updatedSite } : site) })); db.updatePendingSite(id, updatedSite); },
      deletePendingSite: (id) => { set((s) => ({ pendingSites: s.pendingSites.filter(site => site.id !== id) })); db.deletePendingSite(id); },

      // Clients
      addClient: (client) => { set((s) => ({ clients: s.clients.includes(client) ? s.clients : [...s.clients, client] })); db.insertClient(client); },
      removeClient: (client) => { set((s) => ({ clients: s.clients.filter(c => c !== client) })); db.deleteClient(client); },

      setClientProfiles: (profiles) => { set({ clientProfiles: profiles }); },
      addClientProfile: (profile) => { set((s) => ({ clientProfiles: [...s.clientProfiles, profile] })); db.insertClientProfile(profile); },
      updateClientProfile: (id, updates) => { set((s) => ({ clientProfiles: s.clientProfiles.map((p) => p.id === id ? { ...p, ...updates } : p) })); db.updateClientProfile(id, updates); },
      deleteClientProfile: (id) => { set((s) => ({ clientProfiles: s.clientProfiles.filter((p) => p.id !== id) })); db.deleteClientProfile(id); },

      // Employees
      addEmployee: (employee) => { set((s) => ({ employees: [...s.employees, employee] })); db.insertEmployee(employee); },
      updateEmployee: (id, updatedEmployee) => { set((s) => ({ employees: s.employees.map(emp => emp.id === id ? { ...emp, ...updatedEmployee } : emp) })); db.updateEmployee(id, updatedEmployee); },
      bulkUpdateEmployees: (ids, updates) => { set((s) => ({ employees: s.employees.map(emp => ids.includes(emp.id) ? { ...emp, ...updates } : emp) })); db.bulkUpdateEmployees(ids, updates); },
      deleteEmployee: (id) => { set((s) => ({ employees: s.employees.filter(emp => emp.id !== id) })); db.deleteEmployee(id); },

      // Attendance
      addAttendanceRecords: async (records) => { set((s) => ({ attendanceRecords: [...s.attendanceRecords, ...records] })); await db.insertAttendanceRecords(records); },
      updateAttendanceRecord: async (id, record) => { set((s) => ({ attendanceRecords: s.attendanceRecords.map(r => r.id === id ? { ...r, ...record } : r) })); await db.updateAttendanceRecord(id, record); },
      removeAttendanceRecordsByDate: async (date) => { set((s) => ({ attendanceRecords: s.attendanceRecords.filter(r => r.date !== date) })); await db.deleteAttendanceByDate(date); },
      deleteAttendanceRecords: async (ids) => { set((s) => ({ attendanceRecords: s.attendanceRecords.filter(r => !ids.includes(r.id)) })); await db.deleteAttendanceByIds(ids); },

      // Positions & Departments
      addPosition: (position) => { set((s) => ({ positions: [...s.positions, position] })); db.insertPosition(position); },
      updatePosition: (id, position) => { set((s) => ({ positions: s.positions.map(p => p.id === id ? { ...p, ...position } : p) })); db.updatePosition(id, position); },
      removePosition: (id) => { set((s) => ({ positions: s.positions.filter(p => p.id !== id) })); db.deletePosition(id); },
      addDepartment: (department) => { set((s) => ({ departments: [...s.departments, department] })); db.insertDepartment(department); },
      updateDepartment: (id, department) => { set((s) => ({ departments: s.departments.map(d => d.id === id ? { ...d, ...department } : d) })); db.updateDepartment(id, department); },
      removeDepartment: (id) => { set((s) => ({ departments: s.departments.filter(d => d.id !== id) })); db.deleteDepartment(id); },

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

      // Ledger Beneficiary Banks
      addLedgerBeneficiaryBank: (b) => { set(s => ({ ledgerBeneficiaryBanks: [...s.ledgerBeneficiaryBanks, b] })); db.insertLedgerBeneficiaryBank(b); },
      updateLedgerBeneficiaryBank: (id, b) => { set(s => ({ ledgerBeneficiaryBanks: s.ledgerBeneficiaryBanks.map(c => c.id === id ? { ...c, ...b } : c) })); db.updateLedgerBeneficiaryBank(id, b); },
      removeLedgerBeneficiaryBank: (id) => { set(s => ({ ledgerBeneficiaryBanks: s.ledgerBeneficiaryBanks.filter(c => c.id !== id) })); db.deleteLedgerBeneficiaryBank(id); },

      // Ledger Entries
      addLedgerEntry: (e) => { set(s => ({ ledgerEntries: [...s.ledgerEntries, e] })); db.insertLedgerEntry(e); },
      updateLedgerEntry: (id, e) => { set(s => ({ ledgerEntries: s.ledgerEntries.map(c => c.id === id ? { ...c, ...e } : c) })); db.updateLedgerEntry(id, e); },
      deleteLedgerEntry: (id: string) => {
        set((state) => ({
          ledgerEntries: state.ledgerEntries.filter((e) => e.id !== id)
        }));
        db.deleteLedgerEntry(id);
      },
      bulkAddLedgerEntries: (entries: LedgerEntry[]) => {
        set((state) => ({
          ledgerEntries: [...entries, ...state.ledgerEntries]
        }));
        db.bulkInsertLedgerEntries(entries);
      },
      bulkUpdateLedgerEntries: (ids: string[], update: Partial<LedgerEntry>) => {
        set((state) => ({
          ledgerEntries: state.ledgerEntries.map((e) => 
            ids.includes(e.id) ? { ...e, ...update } : e
          )
        }));
        db.bulkUpdateLedgerEntries(ids, update);
      },

      // Company Expenses
      addCompanyExpense: (expense) => { set(s => ({ companyExpenses: [...s.companyExpenses, expense] })); db.insertCompanyExpense(expense); },
      updateCompanyExpense: (id, expense) => { set(s => ({ companyExpenses: s.companyExpenses.map(c => c.id === id ? { ...c, ...expense } : c) })); db.updateCompanyExpense(id, expense); },
      deleteCompanyExpense: (id) => { set(s => ({ companyExpenses: s.companyExpenses.filter(c => c.id !== id) })); db.deleteCompanyExpense(id); },

      setPendingLedgerEntries: (entries) => set({ pendingLedgerEntries: entries }),
      clearPendingLedgerEntries: () => set({ pendingLedgerEntries: [] }),

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

      saveAllSettings: (payroll, paye, months, hr, onboarding) => {
        set(() => ({
          payrollVariables: payroll,
          payeTaxVariables: paye,
          monthValues: months,
          hrVariables: hr,
          onboardingTemplates: onboarding
        }));
        db.updateSettings({
          payrollVariables: payroll,
          payeTaxVariables: paye,
          monthValues: months,
          hrVariables: hr,
          onboardingTemplates: onboarding
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

      // Staff Merit Records
      addStaffMeritRecord: (record) => { set((s) => ({ staffMeritRecords: [...s.staffMeritRecords, record] })); db.insertStaffMeritRecord(record); },
      updateStaffMeritRecord: (id, record) => { set((s) => ({ staffMeritRecords: s.staffMeritRecords.map(r => r.id === id ? { ...r, ...record } : r) })); db.updateStaffMeritRecord(id, record); },
      deleteStaffMeritRecord: (id) => { set((s) => ({ staffMeritRecords: s.staffMeritRecords.filter(r => r.id !== id) })); db.deleteStaffMeritRecord(id); },
      setStaffMeritRecords: (records) => set({ staffMeritRecords: records }),

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
        const fromTasks = get().departmentTasksList
          .filter(d => d.department.startsWith('__SERVICE__'))
          .map(d => ({
            serviceName: d.department.replace('__SERVICE__', ''),
            subtasks: d.onboardingTasks
          }));
        
        const fromTemplates = get().onboardingTemplates.map(t => ({
          serviceName: t.serviceName,
          subtasks: [] // subtasks are managed separately if needed
        }));

        // Merge and unique by serviceName (case-insensitive)
        const all: ServiceTemplate[] = [...fromTasks];
        fromTemplates.forEach(t => {
          if (!all.find(a => a.serviceName.toLowerCase() === t.serviceName.toLowerCase())) {
            all.push(t);
          }
        });
        return all;
      },
      updateServiceTemplate: (template) => {
        const s = get();
        // Check for case-insensitive naming conflicts in onboardingTemplates
        const conflict = s.onboardingTemplates.find(t => 
          t.serviceName.toLowerCase() === template.serviceName.toLowerCase()
        );
        
        if (conflict && conflict.serviceName !== template.serviceName) {
           // If there's a conflict with a different case, we should probably align them or block.
           // For now, we'll just allow the update but the uniqueness check in getServiceTemplates handles the display.
        }

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
      addLeaveType: (name) => {
        const newType = { id: crypto.randomUUID(), name, defaultDays: 0 };
        set((s) => ({ leaveTypes: [...s.leaveTypes, newType] }));
        db.insertLeaveType(newType);
      },
      removeLeaveType: (name) => {
        set((s) => ({ leaveTypes: s.leaveTypes.filter((t) => t.name !== name) }));
        db.deleteLeaveType(name);
      },

      setPositions: async (positions) => { set({ positions }); await db.setPositions(positions); },
      setDepartments: async (departments) => { set({ departments }); await db.setDepartments(departments); },
      setClients: async (clients) => { set({ clients }); await db.setClients(clients); },
      setPublicHolidays: async (publicHolidays) => { set({ publicHolidays }); await db.setPublicHolidays(publicHolidays); },
      setLeaveTypes: async (types) => { set({ leaveTypes: types }); await db.setLeaveTypes(types); },
      updateLeaveType: async (name, defaultDays) => {
        set((s) => ({
          leaveTypes: s.leaveTypes.map((t) => (t.name === name ? { ...t, defaultDays } : t)),
        }));
        const allTypes = get().leaveTypes;
        await db.setLeaveTypes(allTypes);
      },
      setLedgerCategories: async (ledgerCategories) => { set({ ledgerCategories }); await db.setLedgerCategories(ledgerCategories); },
      setLedgerVendors: async (ledgerVendors) => { set({ ledgerVendors }); await db.setLedgerVendors(ledgerVendors); },
      setLedgerBanks: async (ledgerBanks) => { set({ ledgerBanks }); await db.setLedgerBanks(ledgerBanks); },
      setLedgerBeneficiaryBanks: async (ledgerBeneficiaryBanks) => { set({ ledgerBeneficiaryBanks }); await db.setLedgerBeneficiaryBanks(ledgerBeneficiaryBanks); },
      setDepartmentTasksList: async (departmentTasksList) => { set({ departmentTasksList }); await db.setDepartmentTasksList(departmentTasksList); },

      // Vehicles
      addVehicle: (vehicle) => { set((s) => ({ vehicles: [...s.vehicles, vehicle] })); db.insertVehicle(vehicle); },
      updateVehicle: (id, vehicle) => { set((s) => ({ vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...vehicle } : v) })); db.updateVehicle(id, vehicle); },
      deleteVehicle: (id) => { set((s) => ({ vehicles: s.vehicles.filter(v => v.id !== id) })); db.deleteVehicle(id); },
      addVehicleTripRecords: (logs) => { set((s) => ({ vehicleTrips: [...logs, ...s.vehicleTrips] })); db.insertVehicleTripRecords(logs); },
      addVehicleDocumentType: (type) => { set((s) => ({ vehicleDocumentTypes: [...s.vehicleDocumentTypes, type] })); db.insertVehicleDocumentType(type); },
      deleteVehicleDocumentType: (id) => { set((s) => ({ vehicleDocumentTypes: s.vehicleDocumentTypes.filter(t => t.id !== id) })); db.deleteVehicleDocumentType(id); },
      updateVehicleDocument: (vehicleId: string, docTypeName, date) => {
        set((s) => {
          const vehicle = s.vehicles.find(v => v.id === vehicleId);
          if (!vehicle) return s;
          const updatedDocs = { ...vehicle.documents, [docTypeName]: date };
          db.updateVehicleDocument(vehicleId, updatedDocs);
          return { vehicles: s.vehicles.map(v => v.id === vehicleId ? { ...v, documents: updatedDocs } : v) };
        });
      },
      updateVehicleTripRecord: (id, log) => {
        set((s) => ({ vehicleTrips: s.vehicleTrips.map(t => t.id === id ? { ...t, ...log } : t) }));
        db.updateVehicleTripRecord(id, log);
      },
      deleteVehicleTripRecord: (id) => {
        set((s) => ({ vehicleTrips: s.vehicleTrips.filter(t => t.id !== id) }));
        db.deleteVehicleTripRecord(id);
      },

      // Onboarding Templates
      updateOnboardingTemplate: (template) => {
        set((s) => {
          const updated = s.onboardingTemplates.some(t => t.serviceName.toLowerCase() === template.serviceName.toLowerCase())
            ? s.onboardingTemplates.map(t => t.serviceName.toLowerCase() === template.serviceName.toLowerCase() ? template : t)
            : [...s.onboardingTemplates, template];
          
          db.updateSettings({ onboardingTemplates: updated });
          return { onboardingTemplates: updated };
        });
      },
      removeOnboardingTemplate: (serviceName) => {
        set((s) => {
          const updated = s.onboardingTemplates.filter(t => t.serviceName.toLowerCase() !== serviceName.toLowerCase());
          db.updateSettings({ onboardingTemplates: updated });
          return { onboardingTemplates: updated };
        });
      },
    }),
    {
      name: 'dcel-hr-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
