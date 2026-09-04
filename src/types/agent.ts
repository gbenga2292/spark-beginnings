export type ActionProposalType = 
  | 'CREATE_SITE_DIARY'
  | 'LOG_ATTENDANCE_BATCH'
  | 'CREATE_INCIDENT_REPORT'
  | 'LOG_DIESEL_REFILL'
  | 'LOG_CONSUMABLE_BURN'
  | 'LOG_MAINTENANCE_TICKET'
  | 'CREATE_SITE_TASK'
  | 'CREATE_INVOICE'
  | 'CREATE_LEDGER_ENTRY'
  | 'CREATE_EMPLOYEE';

export type ActionProposalStatus = 
  | 'pending' 
  | 'editing' 
  | 'executing' 
  | 'confirmed' 
  | 'rejected' 
  | 'failed';

export interface SiteDiaryPayload {
  date: string; // YYYY-MM-DD
  siteId: string;
  siteName: string;
  clientName?: string;
  narration: string;
  progressPercentage?: number;
  dewateringStage?: 'mobilization' | 'installation' | 'jetting' | 'rejetting' | 'operation' | 'demobilisation';
  generalNotes?: string;
}

export interface AttendanceBatchPayload {
  date: string; // YYYY-MM-DD
  siteId: string;
  siteName: string;
  totalPresent: number;
  notes?: string;
  tradeBreakdown?: {
    trade: string;
    count: number;
  }[];
}

export interface IncidentReportPayload {
  incidentDate: string; // YYYY-MM-DD
  siteId?: string;
  siteName?: string;
  recordType: 'Accolade' | 'Infringement';
  category: 'Behaviour on Site' | 'Dress Code' | 'PPE Maintenance' | 'Client Accolade' | 'Client Complaint' | 'Other';
  description: string;
  employeeName?: string;
  employeeId?: string;
  hrNotified: boolean;
}

export interface DieselRefillPayload {
  date: string; // YYYY-MM-DD
  siteId: string;
  siteName: string;
  totalLitres: number;
  pricePerLitre?: number;
  totalCost?: number;
  supplier?: string;
  notes?: string;
  machineAllocations?: {
    machineId: string;
    machineName: string;
    litres: number;
  }[];
}

export interface ConsumableBurnPayload {
  date: string; // YYYY-MM-DD
  siteId: string;
  siteName: string;
  assetId?: string;
  assetName: string;
  quantity: number;
  unitOfMeasurement?: string;
  reason?: string;
  notes?: string;
}

export interface MaintenanceTicketPayload {
  date: string; // YYYY-MM-DD
  siteId: string;
  siteName: string;
  assetId?: string;
  assetName: string;
  type: 'emergency' | 'repair' | 'scheduled' | 'routine';
  remark: string;
  technician?: string;
  downtimeHours?: number;
  estimatedCost?: number;
}

export interface SiteTaskPayload {
  title: string;
  description?: string;
  siteId?: string;
  siteName?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string; // YYYY-MM-DD
  assigneeName?: string;
}

export interface InvoicePayload {
  invoiceNumber: string;
  client: string;
  project?: string;
  siteId?: string;
  siteName?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  billingCycle: 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Custom';
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  vatInc: 'Yes' | 'No' | 'Add';
  vatAmount?: number;
  totalCharge?: number;
  notes?: string;
}

export interface LedgerEntryPayload {
  voucherNo: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  client?: string;
  site?: string;
  vendor?: string;
  bank?: string;
  isVatable?: boolean;
  vatMode?: 'No' | 'Yes' | 'Add';
}

export interface EmployeePayload {
  firstname: string;
  surname: string;
  department: string;
  position: string;
  staffType: 'OFFICE' | 'FIELD' | 'NON-EMPLOYEE';
  startDate: string; // YYYY-MM-DD
  salary?: number;
  bankName?: string;
  accountNo?: string;
}

export type ActionPayload = 
  | { type: 'CREATE_SITE_DIARY'; data: SiteDiaryPayload }
  | { type: 'LOG_ATTENDANCE_BATCH'; data: AttendanceBatchPayload }
  | { type: 'CREATE_INCIDENT_REPORT'; data: IncidentReportPayload }
  | { type: 'LOG_DIESEL_REFILL'; data: DieselRefillPayload }
  | { type: 'LOG_CONSUMABLE_BURN'; data: ConsumableBurnPayload }
  | { type: 'LOG_MAINTENANCE_TICKET'; data: MaintenanceTicketPayload }
  | { type: 'CREATE_SITE_TASK'; data: SiteTaskPayload }
  | { type: 'CREATE_INVOICE'; data: InvoicePayload }
  | { type: 'CREATE_LEDGER_ENTRY'; data: LedgerEntryPayload }
  | { type: 'CREATE_EMPLOYEE'; data: EmployeePayload };

export interface ActionProposal {
  id: string;
  type: ActionProposalType;
  title: string;
  summary: string;
  payload: ActionPayload;
  status: ActionProposalStatus;
  createdRecordId?: string;
  targetPath?: string;
  error?: string;
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  proposals?: ActionProposal[];
  isThinking?: boolean;
}

export interface AgentOperationalContext {
  user: {
    id?: string;
    name?: string;
    role?: string;
    privileges?: Record<string, any>;
  };
  currentRoute?: {
    path: string;
    moduleName: string;
    hint: string;
    activeEntity?: string;
  };
  activeSite?: {
    id: string;
    name: string;
    clientName?: string;
  };
  activeClient?: {
    name: string;
    sites: { id: string; name: string; status: string }[];
  };
  availableSites: {
    id: string;
    name: string;
    clientName?: string;
  }[];
  todayDate: string;
  permittedTools: string[];
}
