/**
 * Supabase CRUD service layer.
 * Maps between DB snake_case and app camelCase.
 */
import { supabase } from '@/src/integrations/supabase/client';
import type {
  Site, Employee, AttendanceRecord, Invoice, PendingInvoice,
  SalaryAdvance, Loan, Payment, VatPayment, LeaveRecord, DepartmentTasks,
  DisciplinaryRecord, EvaluationRecord, Department, Position,
  LedgerCategory, LedgerVendor, LedgerBank, LedgerBeneficiaryBank, LedgerEntry, CommLog,
  CompanyExpense, StaffMeritRecord, LeaveType, DailyJournal, SiteJournalEntry
} from '@/src/store/appStore';
import { useUserStore, type AppUser, type PrivilegePreset } from '@/src/store/userStore';

// Workspace identifier — update this if this app is ever redeployed for another organisation.
const getWS = () => useUserStore.getState().getCurrentUser()?.workspaceId || 'dcel-team';
import type { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import type { Vehicle, VehicleTripLeg } from '@/src/types/operations';

// ─── Mappers: DB → App ──────────────────────────────────────

export function dbToClientProfile(r: any): any {
  return { id: r.id, name: r.name, tinNumber: r.tin_number || undefined, startDate: r.start_date || undefined, createdAt: r.created_at };
}

export function dbToSite(r: any): Site {
  return { id: r.id, name: r.name, client: r.client, vat: r.vat, status: r.status, startDate: r.start_date, endDate: r.end_date };
}

export function dbToEmployee(r: any): Employee {
  return {
    id: r.id, employeeCode: r.employee_code, surname: r.surname, firstname: r.firstname, department: r.department,
    staffType: r.staff_type, position: r.position, startDate: r.start_date,
    endDate: r.end_date, yearlyLeave: r.yearly_leave, bankName: r.bank_name,
    accountNo: r.account_no, payeTax: r.paye_tax, withholdingTax: r.withholding_tax,
    withholdingTaxRate: r.withholding_tax_rate,
    taxId: r.tax_id, pensionNumber: r.pension_number, payeNumber: r.paye_number || '',
    status: r.status,
    monthlySalaries: r.monthly_salaries, avatar: r.avatar,
    excludeFromOnboarding: r.exclude_from_onboarding, rent: Number(r.rent) || 0,
    onboardingTasks: r.onboarding_tasks || [],
    offboardingTasks: r.offboarding_tasks || [],
    probationPeriod: r.probation_period ?? undefined,
    noOfGuarantors: r.no_of_guarantors ?? 1,
    tentativeStartDate: r.tentative_start_date || undefined,
    verifiedStartDate: r.verified_start_date || undefined,
    onboardingChecklist: r.onboarding_checklist || undefined,
    lineManager: r.line_manager || undefined,
    phone: r.phone || undefined,
    email: r.email || undefined,
    payeeType: r.payee_type || undefined,
    typeOfPay: r.type_of_pay || undefined,
    startMonthOfPay: r.start_month_of_pay || undefined,
    level: r.level ?? 10,
    lashmaPolicyNumber: r.lashma_policy_number || undefined,
    lashmaRegistrationDate: r.lashma_registration_date || undefined,
    lashmaExpiryDate: r.lashma_expiry_date || undefined,
    onboardingMainTaskId: r.onboarding_main_task_id || undefined,
    onboardingSuspended: r.onboarding_suspended ?? false,
    secondaryDepartments: r.secondary_departments || [],
  };
}

export function dbToAttendance(r: any): AttendanceRecord {
  return {
    id: r.id, date: r.date, staffId: r.staff_id, staffName: r.staff_name,
    position: r.position, dayClient: r.day_client, daySite: r.day_site,
    nightClient: r.night_client, nightSite: r.night_site, day: r.day,
    night: r.night, absentStatus: r.absent_status, nightWk: r.night_wk,
    ot: r.ot, otSite: r.ot_site, dayWk: r.day_wk, dow: r.dow,
    ndw: r.ndw, mth: r.mth, isPresent: r.is_present, day2: r.day2, overtimeDetails: r.overtime_details,
  };
}

export function dbToInvoice(r: any): Invoice {
  return {
    id: r.id, invoiceNumber: r.invoice_number, client: r.client,
    project: r.project, siteId: r.site_id, siteName: r.site_name,
    amount: Number(r.amount), date: r.date, dueDate: r.due_date,
    billingCycle: r.billing_cycle, reminderDate: r.reminder_date,
    status: r.status, vatInc: r.vat_inc, noOfMachine: r.no_of_machine,
    dailyRentalCost: Number(r.daily_rental_cost), dieselCostPerLtr: Number(r.diesel_cost_per_ltr),
    dailyUsage: Number(r.daily_usage), noOfTechnician: r.no_of_technician,
    techniciansDailyRate: Number(r.technicians_daily_rate), mobDemob: Number(r.mob_demob),
    installation: Number(r.installation), damages: Number(r.damages),
    duration: r.duration, rentalCost: Number(r.rental_cost),
    dieselCost: Number(r.diesel_cost), techniciansCost: Number(r.technicians_cost),
    totalCost: Number(r.total_cost), vat: Number(r.vat),
    totalCharge: Number(r.total_charge), totalExclusiveOfVat: Number(r.total_exclusive_of_vat),
    printLayout: r.print_layout, historyLog: r.history_log || [],
    machineConfigs: r.machine_configs || undefined,
  };
}

export function dbToPendingInvoice(r: any): PendingInvoice {
  return {
    id: r.id, invoiceNo: r.invoice_no, client: r.client, site: r.site,
    vatInc: r.vat_inc, noOfMachine: r.no_of_machine,
    dailyRentalCost: Number(r.daily_rental_cost), dieselCostPerLtr: Number(r.diesel_cost_per_ltr),
    dailyUsage: Number(r.daily_usage), noOfTechnician: r.no_of_technician,
    techniciansDailyRate: Number(r.technicians_daily_rate),
    mobDemob: Number(r.mob_demob), installation: Number(r.installation),
    damages: Number(r.damages), startDate: r.start_date, duration: r.duration,
    endDate: r.end_date, rentalCost: Number(r.rental_cost),
    dieselCost: Number(r.diesel_cost), techniciansCost: Number(r.technicians_cost),
    totalCost: Number(r.total_cost), vat: Number(r.vat),
    totalCharge: Number(r.total_charge), totalExclusiveOfVat: Number(r.total_exclusive_of_vat),
    printLayout: r.print_layout, historyLog: r.history_log || [],
    machineConfigs: r.machine_configs || undefined,
  };
}

export function dbToSalaryAdvance(r: any): SalaryAdvance {
  return {
    id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
    amount: Number(r.amount), requestDate: r.request_date, status: r.status,
    approvedById: r.approved_by_id || undefined,
    approvedByName: r.approved_by_name || undefined,
    approvalTaskId: r.approval_task_id || undefined,
    approvedAt: r.approved_at || undefined,
    rejectionNote: r.rejection_note || undefined,
  };
}

export function dbToLoan(r: any): Loan {
  return {
    id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
    loanType: r.loan_type, principalAmount: Number(r.principal_amount),
    monthlyDeduction: Number(r.monthly_deduction), duration: r.duration,
    startDate: r.start_date, paymentStartDate: r.payment_start_date,
    remainingBalance: Number(r.remaining_balance), status: r.status,
    approvedById: r.approved_by_id || undefined,
    approvedByName: r.approved_by_name || undefined,
    approvalTaskId: r.approval_task_id || undefined,
    approvedAt: r.approved_at || undefined,
    rejectionNote: r.rejection_note || undefined,
  };
}

export function dbToPayment(r: any): Payment {
  return {
    id: r.id, client: r.client, site: r.site, date: r.date,
    amount: Number(r.amount), withholdingTax: Number(r.withholding_tax),
    discount: Number(r.discount), payVat: r.pay_vat,
    vat: Number(r.vat), amountForVat: Number(r.amount_for_vat),
  };
}

export function dbToVatPayment(r: any): VatPayment {
  return { id: r.id, client: r.client, date: r.date, month: r.month, year: r.year || '', amount: Number(r.amount) };
}

export function dbToLeave(r: any): LeaveRecord {
  return {
    id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
    leaveType: r.leave_type, startDate: r.start_date, duration: r.duration,
    expectedEndDate: r.expected_end_date, reason: r.reason,
    dateReturned: r.date_returned, canBeContacted: r.can_be_contacted,
    status: r.status, uploadedFile: r.uploaded_file, uploadedFileName: r.uploaded_file_name,
    nasFilePath: r.nas_file_path || undefined,
    supervisor: r.supervisor, management: r.management,
    approvedById: r.approved_by_id || undefined,
    approvedByName: r.approved_by_name || undefined,
    approvalTaskId: r.approval_task_id || undefined,
    approvedAt: r.approved_at || undefined,
    rejectionNote: r.rejection_note || undefined,
    approvalStatus: r.approval_status || 'Pending',
    personResponsibleId: r.person_responsible_id || undefined,
    personResponsibleDuringAbsence: r.person_responsible_during_absence || undefined,
    keyDuties: r.key_duties || undefined,
    formDateReturned: r.form_date_returned || undefined,
    employeeSignature: r.employee_signature || undefined,
    supervisorSignature: r.supervisor_signature || undefined,
    hodSignature: r.hod_signature || undefined,
    managementSignature: r.management_signature || undefined,
    hrSignature: r.hr_signature || undefined,
    hrApprovedFrom: r.hr_approved_from || undefined,
    hrApprovedTo: r.hr_approved_to || undefined,
    leaveNumber: r.leave_number || undefined,
    // Workflow tracking
    workflowStep: r.workflow_step ?? 0,
    lineManagerTaskId: r.line_manager_task_id || undefined,
    hodTaskId: r.hod_task_id || undefined,
    managementTaskId: r.management_task_id || undefined,
    hrTaskId: r.hr_task_id || undefined,
    hodEmployeeId: r.hod_employee_id || undefined,
  };
}

export function dbToDisciplinary(r: any): DisciplinaryRecord {
  return {
    id: r.id, employeeId: r.employee_id, date: r.date, type: r.type,
    severity: r.severity, description: r.description, actionTaken: r.action_taken,
    status: r.status, acknowledged: r.acknowledged, employeeComment: r.employee_comment,
    attachments: r.attachments || [], createdBy: r.created_by, visibleToEmployee: r.visible_to_employee,
    reportedBy: r.reported_by,
    queryIssued: r.query_issued,
    queryDeadline: r.query_deadline,
    queryReplied: r.query_replied,
    queryReplyText: r.query_reply_text,
    workflowState: r.workflow_state,
    initialResult: r.initial_result,
    committeeMeetingDate: r.committee_meeting_date,
    finalResult: r.final_result,
    suspensionStartDate: r.suspension_start_date,
    suspensionEndDate: r.suspension_end_date,
    points: r.points,
  };
}

export function dbToEvaluation(r: any): EvaluationRecord {
  return {
    id: r.id, employeeId: r.employee_id, date: r.date, type: r.type,
    scores: r.scores || {}, overallScore: Number(r.overall_score), managerNotes: r.manager_notes,
    status: r.status, acknowledged: r.acknowledged, employeeComment: r.employee_comment,
    createdBy: r.created_by,
  };
}

export function dbToLedgerCategory(r: any): LedgerCategory {
  return { id: r.id, name: r.name };
}

export function dbToLedgerVendor(r: any): LedgerVendor {
  return { id: r.id, name: r.name, tinNumber: r.tin_number };
}

export function dbToLedgerBank(r: any): LedgerBank {
  return { id: r.id, name: r.name };
}

export function dbToLedgerBeneficiaryBank(r: any): LedgerBeneficiaryBank {
  return { id: r.id, name: r.name, accountNo: r.account_no };
}

export function dbToLedgerEntry(r: any): LedgerEntry {
  return {
    id: r.id, voucherNo: r.voucher_no, date: r.date, description: r.description,
    category: r.category, amount: Number(r.amount), client: r.client, site: r.site,
    vendor: r.vendor, bank: r.bank, enteredBy: r.entered_by
  };
}

export function dbToLeaveType(r: any): LeaveType {
  return { id: r.id, name: r.name, defaultDays: r.default_days || 0 };
}

export function dbToCompanyExpense(r: any): CompanyExpense {
  return {
    id: r.id,
    date: r.date,
    description: r.description,
    amount: Number(r.amount),
    paidFrom: r.paid_from,
    paidToBankName: r.paid_to_bank_name,
    paidToAccountNo: r.paid_to_account_no,
    enteredBy: r.entered_by,
    createdAt: r.created_at,
    status: r.status || 'Pending'
  };
}

export function dbToStaffMerit(r: any): StaffMeritRecord {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    recordType: r.record_type,
    category: r.category,
    description: r.description,
    siteId: r.site_id || undefined,
    siteName: r.site_name || undefined,
    loggedById: r.logged_by_id || undefined,
    loggedByName: r.logged_by_name || undefined,
    hrNotified: r.hr_notified,
    incidentDate: r.incident_date,
    createdAt: r.created_at,
  };
}

export function dbToCommLog(r: any): CommLog {
  return {
    id: r.id,
    date: r.date,
    time: r.time ?? undefined,
    direction: r.direction,
    channel: r.channel,
    contactType: r.contact_type,
    client: r.client ?? undefined,
    siteId: r.site_id ?? undefined,
    siteName: r.site_name ?? undefined,
    contactPerson: r.contact_person ?? undefined,
    subject: r.subject ?? undefined,
    notes: r.notes ?? '',
    outcome: r.outcome ?? undefined,
    followUpDate: r.follow_up_date ?? undefined,
    followUpDone: r.follow_up_done ?? false,
    loggedBy: r.logged_by ?? '',
    parentId: r.parent_id ?? undefined,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

export function dbToPendingSite(r: any): SiteQuestionnaire {
  return {
    id: r.id,
    clientName: r.client_name,
    siteName: r.site_name,
    status: r.status,
    ...r.data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function dbToProfile(r: any): AppUser {
  return {
    id: r.id, name: r.name, email: r.email, avatar: r.avatar,
    workspaceId: r.workspace_id || getWS(),
    password: '', // Not stored in DB
    privileges: r.privileges || {},
    isActive: r.is_active, createdAt: r.created_at,
  };
}

export function dbToVehicle(r: any): Vehicle {
  return {
    id: r.id,
    name: r.name,
    type: r.type || undefined,
    registration_number: r.registration_number,
    status: r.status as 'active' | 'inactive',
    documents: r.documents || {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function dbToVehicleDocumentType(r: any): any {
  return {
    id: r.id,
    name: r.name,
    created_at: r.created_at,
  };
}

export function dbToVehicleMovement(r: any): VehicleTripLeg {
  return {
    id: r.id,
    vehicle_id: r.vehicle_id,
    vehicle_reg: r.vehicle_reg,
    driver_name: r.driver_name,
    site_id: r.site_id || undefined,
    site_name: r.site_name,
    purpose: r.purpose,
    departure_time: r.departure_time,
    arrival_time: r.arrival_time || undefined,
    remark: r.remark || undefined,
    odometer_start: r.odometer_start || undefined,
    odometer_end: r.odometer_end || undefined,
  };
}

export function dbToDailyJournal(r: any): DailyJournal {
  return {
    id: r.id,
    date: r.date,
    generalNotes: r.general_notes,
    loggedBy: r.logged_by,
    createdAt: r.created_at,
  };
}

export function dbToSiteJournalEntry(r: any): SiteJournalEntry {
  return {
    id: r.id,
    journalId: r.journal_id,
    siteId: r.site_id,
    siteName: r.site_name,
    clientName: r.client_name,
    narration: r.narration,
  };
}

export function dailyJournalToDb(j: DailyJournal): any {
  return {
    id: j.id,
    date: j.date,
    general_notes: j.generalNotes,
    logged_by: j.loggedBy,
    workspace_id: getWS(),
  };
}

export function siteJournalEntryToDb(e: SiteJournalEntry): any {
  return {
    id: e.id,
    journal_id: e.journalId,
    site_id: e.siteId,
    site_name: e.siteName,
    client_name: e.clientName,
    narration: e.narration,
    workspace_id: getWS(),
  };
}

// ─── Exported DB Methods ──────────────────────────────────────

function clientProfileToDb(c: any) {
  return { id: c.id, name: c.name, tin_number: c.tinNumber || '', start_date: c.startDate || '' };
}

function siteToDb(s: Site) {
  return { id: s.id, name: s.name, client: s.client, vat: s.vat, status: s.status, start_date: s.startDate, end_date: s.endDate };
}


function employeeToDb(e: Employee) {
  return {
    id: e.id, employee_code: e.employeeCode, surname: e.surname, firstname: e.firstname, department: e.department,
    staff_type: e.staffType, position: e.position, start_date: e.startDate,
    end_date: e.endDate, yearly_leave: e.yearlyLeave, bank_name: e.bankName,
    account_no: e.accountNo, paye_tax: e.payeTax, withholding_tax: e.withholdingTax,
    withholding_tax_rate: e.withholdingTaxRate,
    tax_id: e.taxId, pension_number: e.pensionNumber, paye_number: e.payeNumber || '',
    status: e.status,
    monthly_salaries: e.monthlySalaries, avatar: e.avatar,
    exclude_from_onboarding: e.excludeFromOnboarding ?? false, rent: e.rent ?? 0,
    onboarding_tasks: e.onboardingTasks || [],
    offboarding_tasks: e.offboardingTasks || [],
    probation_period: e.probationPeriod ?? null,
    no_of_guarantors: e.noOfGuarantors ?? 1,
    tentative_start_date: e.tentativeStartDate ?? null,
    verified_start_date: e.verifiedStartDate ?? null,
    onboarding_checklist: e.onboardingChecklist ?? null,
    line_manager: e.lineManager ?? null,
    payee_type: e.payeeType ?? null,
    type_of_pay: e.typeOfPay ?? null,
    start_month_of_pay: e.startMonthOfPay ?? null,
    level: e.level ?? 10,
    secondary_departments: e.secondaryDepartments || [],
    lashma_policy_number: e.lashmaPolicyNumber || null,
    lashma_registration_date: e.lashmaRegistrationDate || null,
    lashma_expiry_date: e.lashmaExpiryDate || null,
    onboarding_main_task_id: e.onboardingMainTaskId || null,
    onboarding_suspended: e.onboardingSuspended ?? false,
  };
}

function attendanceToDb(r: AttendanceRecord) {
  return {
    id: r.id, date: r.date, staff_id: r.staffId, staff_name: r.staffName,
    position: r.position, day_client: r.dayClient, day_site: r.daySite,
    night_client: r.nightClient, night_site: r.nightSite, day: r.day,
    night: r.night, absent_status: r.absentStatus, night_wk: r.nightWk,
    ot: r.ot, ot_site: r.otSite, day_wk: r.dayWk, dow: r.dow,
    ndw: r.ndw, mth: r.mth, is_present: r.isPresent, day2: r.day2, overtime_details: r.overtimeDetails,
  };
}

function invoiceToDb(i: Invoice) {
  return {
    id: i.id, invoice_number: i.invoiceNumber, client: i.client,
    project: i.project, site_id: i.siteId, site_name: i.siteName,
    amount: i.amount, date: i.date, due_date: i.dueDate,
    billing_cycle: i.billingCycle, reminder_date: i.reminderDate,
    status: i.status, vat_inc: i.vatInc, no_of_machine: i.noOfMachine,
    daily_rental_cost: i.dailyRentalCost, diesel_cost_per_ltr: i.dieselCostPerLtr,
    daily_usage: i.dailyUsage, no_of_technician: i.noOfTechnician,
    technicians_daily_rate: i.techniciansDailyRate, mob_demob: i.mobDemob,
    installation: i.installation, damages: i.damages, duration: i.duration,
    rental_cost: i.rentalCost, diesel_cost: i.dieselCost,
    technicians_cost: i.techniciansCost, total_cost: i.totalCost,
    vat: i.vat, total_charge: i.totalCharge,
    total_exclusive_of_vat: i.totalExclusiveOfVat,
    print_layout: i.printLayout, history_log: i.historyLog || [],
    machine_configs: i.machineConfigs || null,
  };
}

function pendingInvoiceToDb(p: PendingInvoice) {
  return {
    id: p.id, invoice_no: p.invoiceNo, client: p.client, site: p.site,
    vat_inc: p.vatInc, no_of_machine: p.noOfMachine,
    daily_rental_cost: p.dailyRentalCost, diesel_cost_per_ltr: p.dieselCostPerLtr,
    daily_usage: p.dailyUsage, no_of_technician: p.noOfTechnician,
    technicians_daily_rate: p.techniciansDailyRate, mob_demob: p.mobDemob,
    installation: p.installation, damages: p.damages, start_date: p.startDate,
    duration: p.duration, end_date: p.endDate, rental_cost: p.rentalCost,
    diesel_cost: p.dieselCost, technicians_cost: p.techniciansCost,
    total_cost: p.totalCost, vat: p.vat, total_charge: p.totalCharge,
    total_exclusive_of_vat: p.totalExclusiveOfVat,
    print_layout: p.printLayout, history_log: p.historyLog || [],
    machine_configs: p.machineConfigs || null,
  };
}

function salaryAdvanceToDb(a: SalaryAdvance) {
  return {
    id: a.id, employee_id: a.employeeId, employee_name: a.employeeName,
    amount: a.amount, request_date: a.requestDate, status: a.status,
    approved_by_id: a.approvedById || null,
    approved_by_name: a.approvedByName || null,
    approval_task_id: a.approvalTaskId || null,
    approved_at: a.approvedAt || null,
    rejection_note: a.rejectionNote || null,
  };
}

function loanToDb(l: Loan) {
  return {
    id: l.id, employee_id: l.employeeId, employee_name: l.employeeName,
    loan_type: l.loanType, principal_amount: l.principalAmount,
    monthly_deduction: l.monthlyDeduction, duration: l.duration,
    start_date: l.startDate, payment_start_date: l.paymentStartDate,
    remaining_balance: l.remainingBalance, status: l.status,
    approved_by_id: l.approvedById || null,
    approved_by_name: l.approvedByName || null,
    approval_task_id: l.approvalTaskId || null,
    approved_at: l.approvedAt || null,
    rejection_note: l.rejectionNote || null,
  };
}

function paymentToDb(p: Payment) {
  return {
    id: p.id, client: p.client, site: p.site, date: p.date,
    amount: p.amount, withholding_tax: p.withholdingTax,
    discount: p.discount, pay_vat: p.payVat,
    vat: p.vat, amount_for_vat: p.amountForVat,
  };
}

function vatPaymentToDb(v: VatPayment) {
  return { id: v.id, client: v.client, date: v.date, month: v.month, year: v.year, amount: v.amount };
}

function leaveToDb(l: LeaveRecord) {
  return {
    id: l.id, employee_id: l.employeeId, employee_name: l.employeeName,
    leave_type: l.leaveType, start_date: l.startDate, duration: l.duration,
    expected_end_date: l.expectedEndDate, reason: l.reason,
    date_returned: l.dateReturned, can_be_contacted: l.canBeContacted,
    status: l.status, uploaded_file: l.uploadedFile, uploaded_file_name: l.uploadedFileName,
    nas_file_path: l.nasFilePath,
    person_responsible_during_absence: l.personResponsibleDuringAbsence,
    person_responsible_id: l.personResponsibleId,
    key_duties: l.keyDuties,
    form_date_returned: l.formDateReturned,
    employee_signature: l.employeeSignature,
    supervisor_signature: l.supervisorSignature,
    hod_signature: l.hodSignature || null,
    management_signature: l.managementSignature,
    hr_signature: l.hrSignature,
    hr_approved_from: l.hrApprovedFrom,
    hr_approved_to: l.hrApprovedTo,
    leave_number: l.leaveNumber,
    supervisor: l.supervisor, management: l.management,
    approved_by_id: l.approvedById || null,
    approved_by_name: l.approvedByName || null,
    approval_task_id: l.approvalTaskId || null,
    approved_at: l.approvedAt || null,
    rejection_note: l.rejectionNote || null,
    approval_status: l.approvalStatus || 'Pending',
    // Workflow tracking
    workflow_step: l.workflowStep ?? 0,
    line_manager_task_id: l.lineManagerTaskId || null,
    hod_task_id: l.hodTaskId || null,
    management_task_id: l.managementTaskId || null,
    hr_task_id: l.hrTaskId || null,
    hod_employee_id: l.hodEmployeeId || null,
  };
}

function disciplinaryToDb(d: DisciplinaryRecord) {
  return {
    id: d.id, employee_id: d.employeeId, date: d.date, type: d.type,
    severity: d.severity, description: d.description, action_taken: d.actionTaken,
    status: d.status, acknowledged: d.acknowledged, employee_comment: d.employeeComment,
    attachments: d.attachments, created_by: d.createdBy, visible_to_employee: d.visibleToEmployee,
    reported_by: d.reportedBy,
    query_issued: d.queryIssued,
    query_deadline: d.queryDeadline,
    query_replied: d.queryReplied,
    query_reply_text: d.queryReplyText,
    workflow_state: d.workflowState,
    initial_result: d.initialResult,
    committee_meeting_date: d.committeeMeetingDate,
    final_result: d.finalResult,
    suspension_start_date: d.suspensionStartDate,
    suspension_end_date: d.suspensionEndDate,
    points: d.points,
  };
}

function evaluationToDb(e: EvaluationRecord) {
  return {
    id: e.id, employee_id: e.employeeId, date: e.date, type: e.type,
    scores: e.scores, overall_score: e.overallScore, manager_notes: e.managerNotes,
    status: e.status, acknowledged: e.acknowledged, employee_comment: e.employeeComment,
    created_by: e.createdBy,
  };
}

function ledgerEntryToDb(e: LedgerEntry) {
  // Ensure date is always a valid date string; fallback to today
  const safeDate = e.date && e.date.trim() !== '' ? e.date : new Date().toISOString().split('T')[0];
  return {
    id: e.id, voucher_no: e.voucherNo, date: safeDate, description: e.description,
    category: e.category, amount: e.amount, client: e.client || null, site: e.site || null,
    vendor: e.vendor || null, bank: e.bank, entered_by: e.enteredBy
  };
}

function companyExpenseToDb(e: CompanyExpense) {
  const safeDate = e.date && e.date.trim() !== '' ? e.date : new Date().toISOString().split('T')[0];
  return {
    id: e.id,
    date: safeDate,
    description: e.description,
    amount: e.amount,
    paid_from: e.paidFrom,
    paid_to_bank_name: e.paidToBankName,
    paid_to_account_no: e.paidToAccountNo,
    entered_by: e.enteredBy,
    status: e.status || 'Pending'
  };
}

function staffMeritToDb(r: StaffMeritRecord) {
  return {
    id: r.id,
    workspace_id: r.workspaceId,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    record_type: r.recordType,
    category: r.category,
    description: r.description,
    site_id: r.siteId || null,
    site_name: r.siteName || null,
    logged_by_id: r.loggedById || null,
    logged_by_name: r.loggedByName || null,
    hr_notified: r.hrNotified,
    incident_date: r.incidentDate,
    created_at: r.createdAt,
  };
}

function commLogToDb(l: CommLog) {
  return {
    id: l.id,
    date: l.date,
    time: l.time ?? null,
    direction: l.direction,
    channel: l.channel,
    contact_type: l.contactType,
    client: l.client ?? null,
    site_id: l.siteId ?? null,
    site_name: l.siteName ?? null,
    contact_person: l.contactPerson ?? null,
    subject: l.subject ?? null,
    notes: l.notes,
    outcome: l.outcome ?? null,
    follow_up_date: l.followUpDate ?? null,
    follow_up_done: l.followUpDone,
    logged_by: l.loggedBy,
    parent_id: l.parentId ?? null,
    created_at: l.createdAt,
  };
}

function pendingSiteToDb(p: SiteQuestionnaire) {
  const { id, clientName, siteName, status, createdAt, updatedAt, ...restData } = p;
  return {
    id,
    client_name: clientName,
    site_name: siteName,
    status,
    data: restData,
    created_at: createdAt || new Date().toISOString(),
    updated_at: updatedAt || new Date().toISOString(),
  };
}

function ledgerBeneficiaryBankToDb(b: LedgerBeneficiaryBank) {
  return { id: b.id, name: b.name, account_no: b.accountNo };
}

function vehicleToDb(v: Vehicle) {
  return {
    id: v.id,
    name: v.name,
    type: v.type || null,
    registration_number: v.registration_number,
    status: v.status,
    documents: v.documents || {},
  };
}

function vehicleMovementToDb(v: VehicleTripLeg & { vehicle_id: string; vehicle_reg: string; driver_name: string; driver_employee_id?: string; created_by_id?: string; created_by_name?: string }) {
  return {
    id: v.id,
    workspace_id: getWS(),
    vehicle_id: v.vehicle_id,
    vehicle_reg: v.vehicle_reg,
    driver_name: v.driver_name,
    driver_employee_id: v.driver_employee_id || null,
    site_id: v.site_id || null,
    site_name: v.site_name,
    purpose: v.purpose,
    departure_time: v.departure_time,
    arrival_time: v.arrival_time || null,
    odometer_start: v.odometer_start || null,
    odometer_end: v.odometer_end || null,
    notes: v.remark || null,
    created_by_id: v.created_by_id || null,
    created_by_name: v.created_by_name || null,
  };
}

// ─── FETCH ALL ───────────────────────────────────────────────

export async function fetchAllAppData(privs?: any) {
  const isAdmin = privs?.users?.canManage === true;
  const canView = (mod: string) => isAdmin || (privs && privs[mod] && privs[mod].canView === true);

  const [
    sitesRes, clientsRes, employeesRes, attendanceRes,
    invoicesRes, pendingInvRes, advancesRes, loansRes,
    paymentsRes, vatPayRes, holidaysRes, deptTasksRes,
    leavesRes, leaveTypesRes, settingsRes,
    positionsRes, departmentsRes,
    disciplinaryRes, evaluationsRes,
    lCatRes, lVenRes, lBankRes, lBenBankRes,
    lEntRes,
    compExpRes,
    commLogsRes,
    pendingSitesRes,
    staffMeritRes,
    vehiclesRes,
    vehicleTripsRes,
    vehicleDocTypesRes,
    dailyJournalsRes,
    siteJournalEntriesRes,
  ] = await Promise.all([
    supabase.from('sites').select('*').order('created_at'),
    supabase.from('clients').select('*').order('name'),
    canView('employees') ? supabase.from('employees').select('*').order('surname') : Promise.resolve({ data: [] }),
    canView('attendance') ? supabase.from('attendance_records').select('*').order('date').limit(10000) : Promise.resolve({ data: [] }),
    canView('billing') ? supabase.from('invoices').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('billing') ? supabase.from('pending_invoices').select('*').order('created_at') : Promise.resolve({ data: [] }),
    canView('salaryLoans') ? supabase.from('salary_advances').select('*').order('request_date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('salaryLoans') ? supabase.from('loans').select('*').order('start_date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('payments') ? supabase.from('payments').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('payments') ? supabase.from('vat_payments').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('public_holidays').select('*').order('date'),
    supabase.from('department_tasks').select('*'),
    canView('leaves') ? supabase.from('leaves').select('*').order('start_date', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('leave_types').select('*').order('name'),
    supabase.from('app_settings').select('*').limit(1).maybeSingle(),
    supabase.from('positions').select('*').order('title'),
    supabase.from('departments').select('*').order('name'),
    canView('disciplinary') ? supabase.from('disciplinary_records').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('evaluations') ? supabase.from('evaluations').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('ledger') ? supabase.from('ledger_categories').select('*').order('name') : Promise.resolve({ data: [] }),
    canView('ledger') ? supabase.from('ledger_vendors').select('*').order('name') : Promise.resolve({ data: [] }),
    canView('ledger') ? supabase.from('ledger_banks').select('*').order('name') : Promise.resolve({ data: [] }),
    canView('ledger') ? supabase.from('ledger_beneficiary_banks').select('*').order('name') : Promise.resolve({ data: [] }),
    canView('ledger') ? supabase.from('ledger_entries').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    canView('ledger') ? supabase.from('company_expenses').select('*').order('date', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('comm_logs').select('*').order('date', { ascending: false }),
    supabase.from('pending_sites').select('*').order('created_at'),
    supabase.from('staff_merit_record').select('*').order('incident_date', { ascending: false }),
    supabase.from('vehicles').select('*').order('name'),
    supabase.from('vehicle_movement_log').select('*').order('departure_time', { ascending: false }).limit(500),
    supabase.from('vehicle_document_types').select('*').order('name'),
    supabase.from('daily_journals').select('*').order('date', { ascending: false }),
    supabase.from('site_journal_entries').select('*'),
  ]);

  const settings = settingsRes.data;

  return {
    commLogs: (commLogsRes.data || []).map(dbToCommLog),
    pendingSites: (pendingSitesRes.data || []).map(dbToPendingSite),
    sites: (sitesRes.data || []).map(dbToSite),
    clients: (clientsRes.data || []).map((c: any) => c.name),
    clientProfiles: (clientsRes.data || []).map(dbToClientProfile),
    employees: (employeesRes.data || []).map(dbToEmployee),
    attendanceRecords: (attendanceRes.data || []).map(dbToAttendance),
    invoices: (invoicesRes.data || []).map(dbToInvoice),
    pendingInvoices: (pendingInvRes.data || []).map(dbToPendingInvoice),
    salaryAdvances: (advancesRes.data || []).map(dbToSalaryAdvance),
    loans: (loansRes.data || []).map(dbToLoan),
    payments: (paymentsRes.data || []).map(dbToPayment),
    vatPayments: (vatPayRes.data || []).map(dbToVatPayment),
    publicHolidays: (holidaysRes.data || []).map((h: any) => ({ id: h.id, date: h.date, name: h.name })),
    departmentTasksList: (deptTasksRes.data || []).map((d: any) => ({
      department: d.department,
      onboardingTasks: d.onboarding_tasks || [],
      offboardingTasks: d.offboarding_tasks || [],
    })) as DepartmentTasks[],
    leaves: (leavesRes.data || []).map(dbToLeave),
    leaveTypes: (leaveTypesRes.data || []).map(dbToLeaveType),
    disciplinaryRecords: (disciplinaryRes.data || []).map(dbToDisciplinary),
    evaluations: (evaluationsRes.data || []).map(dbToEvaluation),
    ledgerCategories: (lCatRes.data || []).map(dbToLedgerCategory),
    ledgerVendors: (lVenRes.data || []).map(dbToLedgerVendor),
    ledgerBanks: (lBankRes.data || []).map(dbToLedgerBank),
    ledgerBeneficiaryBanks: (lBenBankRes.data || []).map(dbToLedgerBeneficiaryBank),
    ledgerEntries: (lEntRes.data || []).map(dbToLedgerEntry),
    companyExpenses: (compExpRes.data || []).map(dbToCompanyExpense),
    staffMeritRecords: (staffMeritRes.data || []).map(dbToStaffMerit),
    vehicles: (vehiclesRes.data || []).map(dbToVehicle),
    vehicleTrips: (vehicleTripsRes.data || []).map(dbToVehicleMovement),
    vehicleDocumentTypes: (vehicleDocTypesRes.data || []).map(dbToVehicleDocumentType),
    dailyJournals: (dailyJournalsRes.data || []).map(dbToDailyJournal),
    siteJournalEntries: (siteJournalEntriesRes?.data || []).map(dbToSiteJournalEntry),
    positions: (positionsRes.data || []).map((p: any) => ({
      id: p.id,
      title: p.title || p.name,
      departmentId: p.department_id || null,
    })) as Position[],
    departments: (departmentsRes.data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      staffType: d.staff_type || 'OFFICE',
      workDaysPerWeek: d.work_days_per_week || 5,
      parentDepartmentId: d.parent_department_id || null,
    })) as Department[],
    payrollVariables: settings?.payroll_variables || undefined,
    payeTaxVariables: settings?.paye_tax_variables || undefined,
    monthValues: settings?.month_values || undefined,
    hrVariables: settings?.hr_variables || undefined,
    superAdminCreated: settings?.super_admin_created ?? false,
    superAdminSignupEnabled: settings?.super_admin_signup_enabled ?? true,
    settingsId: settings?.id,
  };
}

export async function fetchAllUsers(privs?: any) {
  const isAdmin = privs?.users?.canManage === true;
  const canView = isAdmin || (privs && privs.users && privs.users.canView === true);
  if (!canView) return [];
  const { data } = await supabase.from('profiles').select('*').order('created_at');
  return (data || []).map(dbToProfile);
}

export async function fetchPresets() {
  const { data } = await supabase.from('privilege_presets').select('*').order('name');
  return (data || []).map((p: any) => ({ id: p.id, name: p.name, privileges: p.privileges })) as PrivilegePreset[];
}

// ─── CRUD: Sites ─────────────────────────────────────────────

export const db = {
  // Sites
  async insertSite(s: Site) {
    // Use upsert so that re-activating an existing site key doesn't 400
    const { data, error } = await supabase
      .from('sites')
      .upsert(siteToDb(s), { onConflict: 'id' })
      .select('id')
      .single();
    if (error) { console.error('insertSite:', error); throw error; }
    return data;
  },
  async updateSite(id: string, s: Partial<Site>) {
    const update: any = {};
    if (s.name !== undefined) update.name = s.name;
    if (s.client !== undefined) update.client = s.client;
    if (s.vat !== undefined) update.vat = s.vat;
    if (s.status !== undefined) update.status = s.status;
    if (s.startDate !== undefined) update.start_date = s.startDate;
    if (s.endDate !== undefined) update.end_date = s.endDate;
    const { error } = await supabase.from('sites').update(update).eq('id', id);
    if (error) { console.error('updateSite:', error); throw error; }
  },
  async deleteSite(id: string) {
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) { console.error('deleteSite:', error); throw error; }
  },
  async setSites(sites: Site[]) {
    // Task 3: Differential Upsert Fix
    if (sites.length > 0) {
      const { error: upsertErr } = await supabase.from('sites').upsert(sites.map(siteToDb));
      if (upsertErr) { console.error('setSites upsert:', upsertErr); throw upsertErr; }
      
      const ids = sites.map(s => s.id);
      const { error: delErr } = await supabase.from('sites').delete().not('id', 'in', `(${ids.join(',')})`);
      if (delErr) { console.error('setSites delete orphans:', delErr); throw delErr; }
    } else {
      const NIL_UUID = '00000000-0000-0000-0000-000000000000';
      const { error: delErr } = await supabase.from('sites').delete().neq('id', NIL_UUID);
      if (delErr) { console.error('setSites clear all:', delErr); throw delErr; }
    }
  },

  // Client Profiles
  async insertClientProfile(c: any) {
    // Upsert on name conflict to avoid creating duplicate rows for the same client name
    const { error } = await supabase
      .from('clients')
      .upsert(clientProfileToDb(c), { onConflict: 'name' });
    if (error) { console.error('insertClientProfile:', error); throw error; }
  },
  async updateClientProfile(id: string, c: Partial<any>) {
    const update: any = {};
    if (c.name !== undefined) update.name = c.name;
    if (c.tinNumber !== undefined) update.tin_number = c.tinNumber;
    if (c.startDate !== undefined) update.start_date = c.startDate;
    const { error } = await supabase.from('clients').update(update).eq('id', id);
    if (error) { console.error('updateClientProfile:', error); throw error; }
  },
  async deleteClientProfile(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { console.error('deleteClientProfile:', error); throw error; }
  },

  // Pending Sites
  async insertPendingSite(p: SiteQuestionnaire) {
    const { error } = await supabase.from('pending_sites').insert(pendingSiteToDb(p));
    if (error) { console.error('insertPendingSite:', error); throw error; }
  },
  async updatePendingSite(id: string, p: Partial<SiteQuestionnaire>) {
    // For pending sites, we overwrite the whole object as we're saving all phases.
    if (p.id) {
       const mapped = pendingSiteToDb(p as SiteQuestionnaire);
       const { error } = await supabase.from('pending_sites').update(mapped).eq('id', id);
       if (error) { console.error('updatePendingSite:', error); throw error; }
    }
  },
  async deletePendingSite(id: string) {
    const { error } = await supabase.from('pending_sites').delete().eq('id', id);
    if (error) { console.error('deletePendingSite:', error); throw error; }
  },
  async setPendingSites(sites: SiteQuestionnaire[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    const { error: delErr } = await supabase.from('pending_sites').delete().neq('id', NIL_UUID);
    if (delErr) console.error('setPendingSites delete:', delErr);
    if (sites.length > 0) {
      const { error } = await supabase
        .from('pending_sites')
        .upsert(sites.map(pendingSiteToDb), { onConflict: 'id' });
      if (error) { console.error('Database error:', error); throw error; }
    }
  },

  // Clients
  async insertClient(name: string) {
    const { error } = await supabase.from('clients').insert({ name });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteClient(name: string) {
    const { error } = await supabase.from('clients').delete().eq('name', name);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Positions
  async insertPosition(p: Position) {
    const { error } = await supabase.from('positions').insert({ id: p.id, title: p.title, department_id: p.departmentId });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updatePosition(id: string, p: Partial<Position>) {
    const update: any = {};
    if (p.title !== undefined) update.title = p.title;
    if (p.departmentId !== undefined) update.department_id = p.departmentId;
    const { error } = await supabase.from('positions').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deletePosition(id: string) {
    const { error } = await supabase.from('positions').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Departments
  async insertDepartment(d: Department) {
    const { error } = await supabase.from('departments').insert({ id: d.id, name: d.name, staff_type: d.staffType, work_days_per_week: d.workDaysPerWeek, parent_department_id: d.parentDepartmentId || null });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateDepartment(id: string, d: Partial<Department>) {
    const update: any = {};
    if (d.name !== undefined) update.name = d.name;
    if (d.staffType !== undefined) update.staff_type = d.staffType;
    if (d.workDaysPerWeek !== undefined) update.work_days_per_week = d.workDaysPerWeek;
    if (d.parentDepartmentId !== undefined) update.parent_department_id = d.parentDepartmentId || null;
    const { error } = await supabase.from('departments').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteDepartment(id: string) {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Employees
  async insertEmployee(e: Employee) {
    const { error } = await supabase.from('employees').insert(employeeToDb(e));
    if (error) { console.error('insertEmployee:', error); throw error; }
  },
  async updateEmployee(id: string, e: Partial<Employee>) {
    const update: any = {};
    if (e.employeeCode !== undefined) update.employee_code = e.employeeCode;
    if (e.surname !== undefined) update.surname = e.surname;
    if (e.firstname !== undefined) update.firstname = e.firstname;
    if (e.department !== undefined) update.department = e.department;
    if (e.staffType !== undefined) update.staff_type = e.staffType;
    if (e.position !== undefined) update.position = e.position;
    if (e.startDate !== undefined) update.start_date = e.startDate;
    if (e.endDate !== undefined) update.end_date = e.endDate;
    if (e.yearlyLeave !== undefined) update.yearly_leave = e.yearlyLeave;
    if (e.bankName !== undefined) update.bank_name = e.bankName;
    if (e.accountNo !== undefined) update.account_no = e.accountNo;
    if (e.payeTax !== undefined) update.paye_tax = e.payeTax;
    if (e.withholdingTax !== undefined) update.withholding_tax = e.withholdingTax;
    if (e.withholdingTaxRate !== undefined) update.withholding_tax_rate = e.withholdingTaxRate;
    if (e.taxId !== undefined) update.tax_id = e.taxId;
    if (e.pensionNumber !== undefined) update.pension_number = e.pensionNumber;
    if (e.payeNumber !== undefined) update.paye_number = e.payeNumber;
    if (e.status !== undefined) update.status = e.status;
    if (e.monthlySalaries !== undefined) update.monthly_salaries = e.monthlySalaries;
    if (e.avatar !== undefined) update.avatar = e.avatar;
    if (e.excludeFromOnboarding !== undefined) update.exclude_from_onboarding = e.excludeFromOnboarding;
    if (e.rent !== undefined) update.rent = e.rent;
    if (e.onboardingTasks !== undefined) update.onboarding_tasks = e.onboardingTasks;
    if (e.offboardingTasks !== undefined) update.offboarding_tasks = e.offboardingTasks;
    if (e.probationPeriod !== undefined) update.probation_period = e.probationPeriod;
    if (e.noOfGuarantors !== undefined) update.no_of_guarantors = e.noOfGuarantors;
    if (e.tentativeStartDate !== undefined) update.tentative_start_date = e.tentativeStartDate;
    if (e.verifiedStartDate !== undefined) update.verified_start_date = e.verifiedStartDate;
    if (e.onboardingChecklist !== undefined) update.onboarding_checklist = e.onboardingChecklist;
    if (e.onboardingMainTaskId !== undefined) update.onboarding_main_task_id = e.onboardingMainTaskId;
    if (e.onboardingSuspended !== undefined) update.onboarding_suspended = e.onboardingSuspended;
    if (e.lineManager !== undefined) update.line_manager = e.lineManager;
    if (e.phone !== undefined) update.phone = e.phone;
    if (e.email !== undefined) update.email = e.email;
    if (e.payeeType !== undefined) update.payee_type = e.payeeType;
    if (e.typeOfPay !== undefined) update.type_of_pay = e.typeOfPay;
    if (e.startMonthOfPay !== undefined) update.start_month_of_pay = e.startMonthOfPay;
    // ── Fields added recently that were previously not persisted ──
    if (e.level !== undefined) update.level = e.level;
    if (e.lashmaPolicyNumber !== undefined) update.lashma_policy_number = e.lashmaPolicyNumber;
    if (e.lashmaRegistrationDate !== undefined) update.lashma_registration_date = e.lashmaRegistrationDate;
    if (e.lashmaExpiryDate !== undefined) update.lashma_expiry_date = e.lashmaExpiryDate;
    if (e.secondaryDepartments !== undefined) update.secondary_departments = e.secondaryDepartments;
    const { error } = await supabase.from('employees').update(update).eq('id', id);
    if (error) { console.error('updateEmployee:', error); throw error; }
  },
  async bulkUpdateEmployees(ids: string[], e: Partial<Employee>) {
    if (ids.length === 0) return;
    const update: any = {};
    if (e.department !== undefined) update.department = e.department;
    if (e.staffType !== undefined) update.staff_type = e.staffType;
    if (e.status !== undefined) update.status = e.status;
    if (e.yearlyLeave !== undefined) update.yearly_leave = e.yearlyLeave;
    if (e.level !== undefined) update.level = e.level;
    if (e.payeTax !== undefined) update.paye_tax = e.payeTax;
    if (e.withholdingTax !== undefined) update.withholding_tax = e.withholdingTax;
    if (e.withholdingTaxRate !== undefined) update.withholding_tax_rate = e.withholdingTaxRate;
    if (e.probationPeriod !== undefined) update.probation_period = e.probationPeriod;
    if (e.payeeType !== undefined) update.payee_type = e.payeeType;
    if (e.typeOfPay !== undefined) update.type_of_pay = e.typeOfPay;
    if (e.startMonthOfPay !== undefined) update.start_month_of_pay = e.startMonthOfPay;

    const { error } = await supabase.from('employees').update(update).in('id', ids);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteEmployee(id: string) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Attendance
  async insertAttendanceRecords(records: AttendanceRecord[]) {
    if (records.length === 0) return;
    const CHUNK_SIZE = 200;
    const rows = records.map(attendanceToDb);
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('attendance_records')
        .upsert(chunk, { onConflict: 'id' });
      if (error) { console.error(`insertAttendance chunk ${i / CHUNK_SIZE + 1}:`, error); throw error; }
    }
  },
  async deleteAttendanceByDate(date: string) {
    const { error } = await supabase.from('attendance_records').delete().eq('date', date);
    if (error) { console.error('deleteAttendanceByDate:', error); throw error; }
  },
  async deleteAttendanceByIds(ids: string[]) {
    if (ids.length === 0) return;
    
    // We now use a PostgreSQL RPC function to securely process thousands 
    // of UUIDs inside a single POST payload, completely avoiding URI length limits
    const { error } = await supabase.rpc('delete_attendance_records_by_ids', { record_ids: ids });
    
    if (error) {
      console.error('RPC bulk delete failed:', error);
      // Fallback to chunks if RPC unexpectedly fails
      const CHUNK_SIZE = 60;
      const promises = [];
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        promises.push(supabase.from('attendance_records').delete().in('id', ids.slice(i, i + CHUNK_SIZE)));
      }
      await Promise.all(promises);
    }
  },

  // Invoices
  async insertInvoice(i: Invoice) {
    const { error } = await supabase.from('invoices').insert(invoiceToDb(i));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateInvoice(id: string, i: Partial<Invoice>) {
    const update: any = {};
    Object.entries(i).forEach(([k, v]) => {
      const map: Record<string, string> = {
        invoiceNumber: 'invoice_number', siteId: 'site_id', siteName: 'site_name',
        dueDate: 'due_date', billingCycle: 'billing_cycle', reminderDate: 'reminder_date',
        vatInc: 'vat_inc', noOfMachine: 'no_of_machine', dailyRentalCost: 'daily_rental_cost',
        dieselCostPerLtr: 'diesel_cost_per_ltr', dailyUsage: 'daily_usage',
        noOfTechnician: 'no_of_technician', techniciansDailyRate: 'technicians_daily_rate',
        mobDemob: 'mob_demob', rentalCost: 'rental_cost', dieselCost: 'diesel_cost',
        techniciansCost: 'technicians_cost', totalCost: 'total_cost', totalCharge: 'total_charge',
        totalExclusiveOfVat: 'total_exclusive_of_vat', printLayout: 'print_layout', historyLog: 'history_log',
      };
      update[map[k] || k] = v;
    });
    const { error } = await supabase.from('invoices').update(update).eq('id', id);
    if (error) { console.error('updateInvoice:', error); throw error; }
  },
  async deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) { console.error('deleteInvoice:', error); throw error; }
  },

  // Pending Invoices
  async insertPendingInvoice(p: PendingInvoice) {
    const { error } = await supabase.from('pending_invoices').insert(pendingInvoiceToDb(p));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updatePendingInvoice(id: string, p: Partial<PendingInvoice>) {
    const update: any = {};
    Object.entries(p).forEach(([k, v]) => {
      const map: Record<string, string> = {
        invoiceNo: 'invoice_no', vatInc: 'vat_inc', noOfMachine: 'no_of_machine',
        dailyRentalCost: 'daily_rental_cost', dieselCostPerLtr: 'diesel_cost_per_ltr',
        dailyUsage: 'daily_usage', noOfTechnician: 'no_of_technician',
        techniciansDailyRate: 'technicians_daily_rate', mobDemob: 'mob_demob',
        startDate: 'start_date', endDate: 'end_date', rentalCost: 'rental_cost',
        dieselCost: 'diesel_cost', techniciansCost: 'technicians_cost',
        totalCost: 'total_cost', totalCharge: 'total_charge',
        totalExclusiveOfVat: 'total_exclusive_of_vat', printLayout: 'print_layout', historyLog: 'history_log',
      };
      update[map[k] || k] = v;
    });
    const { error } = await supabase.from('pending_invoices').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deletePendingInvoice(id: string) {
    const { error } = await supabase.from('pending_invoices').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Salary Advances
  async insertSalaryAdvance(a: SalaryAdvance) {
    const { error } = await supabase.from('salary_advances').insert(salaryAdvanceToDb(a));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateSalaryAdvance(id: string, a: Partial<SalaryAdvance>) {
    const update: any = {};
    if (a.employeeId !== undefined) update.employee_id = a.employeeId;
    if (a.employeeName !== undefined) update.employee_name = a.employeeName;
    if (a.amount !== undefined) update.amount = a.amount;
    if (a.requestDate !== undefined) update.request_date = a.requestDate;
    if (a.status !== undefined) update.status = a.status;
    if (a.approvedById !== undefined) update.approved_by_id = a.approvedById;
    if (a.approvedByName !== undefined) update.approved_by_name = a.approvedByName;
    if (a.approvalTaskId !== undefined) update.approval_task_id = a.approvalTaskId;
    if (a.approvedAt !== undefined) update.approved_at = a.approvedAt;
    if (a.rejectionNote !== undefined) update.rejection_note = a.rejectionNote;
    const { error } = await supabase.from('salary_advances').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteSalaryAdvance(id: string) {
    const { error } = await supabase.from('salary_advances').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Loans
  async insertLoan(l: Loan) {
    const { error } = await supabase.from('loans').insert(loanToDb(l));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateLoan(id: string, l: Partial<Loan>) {
    const update: any = {};
    if (l.employeeId !== undefined) update.employee_id = l.employeeId;
    if (l.employeeName !== undefined) update.employee_name = l.employeeName;
    if (l.loanType !== undefined) update.loan_type = l.loanType;
    if (l.principalAmount !== undefined) update.principal_amount = l.principalAmount;
    if (l.monthlyDeduction !== undefined) update.monthly_deduction = l.monthlyDeduction;
    if (l.duration !== undefined) update.duration = l.duration;
    if (l.startDate !== undefined) update.start_date = l.startDate;
    if (l.paymentStartDate !== undefined) update.payment_start_date = l.paymentStartDate;
    if (l.remainingBalance !== undefined) update.remaining_balance = l.remainingBalance;
    if (l.status !== undefined) update.status = l.status;
    if (l.approvedById !== undefined) update.approved_by_id = l.approvedById;
    if (l.approvedByName !== undefined) update.approved_by_name = l.approvedByName;
    if (l.approvalTaskId !== undefined) update.approval_task_id = l.approvalTaskId;
    if (l.approvedAt !== undefined) update.approved_at = l.approvedAt;
    if (l.rejectionNote !== undefined) update.rejection_note = l.rejectionNote;
    const { error } = await supabase.from('loans').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLoan(id: string) {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Payments
  async insertPayment(p: Payment) {
    const { error } = await supabase.from('payments').insert(paymentToDb(p));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updatePayment(id: string, p: Partial<Payment>) {
    const update: any = {};
    if (p.client !== undefined) update.client = p.client;
    if (p.site !== undefined) update.site = p.site;
    if (p.date !== undefined) update.date = p.date;
    if (p.amount !== undefined) update.amount = p.amount;
    if (p.withholdingTax !== undefined) update.withholding_tax = p.withholdingTax;
    if (p.discount !== undefined) update.discount = p.discount;
    if (p.payVat !== undefined) update.pay_vat = p.payVat;
    if (p.vat !== undefined) update.vat = p.vat;
    if (p.amountForVat !== undefined) update.amount_for_vat = p.amountForVat;
    const { error } = await supabase.from('payments').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deletePayment(id: string) {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // VAT Payments
  async insertVatPayment(v: VatPayment) {
    const { error } = await supabase.from('vat_payments').insert(vatPaymentToDb(v));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateVatPayment(id: string, v: Partial<VatPayment>) {
    const { error } = await supabase.from('vat_payments').update(v).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteVatPayment(id: string) {
    const { error } = await supabase.from('vat_payments').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Public Holidays
  async insertPublicHoliday(h: { id: string; date: string; name: string }) {
    const { error } = await supabase.from('public_holidays').insert(h);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deletePublicHoliday(id: string) {
    const { error } = await supabase.from('public_holidays').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Disciplinary
  async insertDisciplinaryRecord(d: DisciplinaryRecord) {
    const { error } = await supabase.from('disciplinary_records').insert(disciplinaryToDb(d));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateDisciplinaryRecord(id: string, d: Partial<DisciplinaryRecord>) {
    const update: any = {};
    if (d.employeeId !== undefined) update.employee_id = d.employeeId;
    if (d.date !== undefined) update.date = d.date;
    if (d.type !== undefined) update.type = d.type;
    if (d.severity !== undefined) update.severity = d.severity;
    if (d.description !== undefined) update.description = d.description;
    if (d.actionTaken !== undefined) update.action_taken = d.actionTaken;
    if (d.status !== undefined) update.status = d.status;
    if (d.acknowledged !== undefined) update.acknowledged = d.acknowledged;
    if (d.employeeComment !== undefined) update.employee_comment = d.employeeComment;
    if (d.attachments !== undefined) update.attachments = d.attachments;
    if (d.createdBy !== undefined) update.created_by = d.createdBy;
    if (d.visibleToEmployee !== undefined) update.visible_to_employee = d.visibleToEmployee;
    
    if (d.reportedBy !== undefined) update.reported_by = d.reportedBy;
    if (d.queryIssued !== undefined) update.query_issued = d.queryIssued;
    if (d.queryDeadline !== undefined) update.query_deadline = d.queryDeadline;
    if (d.queryReplied !== undefined) update.query_replied = d.queryReplied;
    if (d.queryReplyText !== undefined) update.query_reply_text = d.queryReplyText;
    if (d.workflowState !== undefined) update.workflow_state = d.workflowState;
    if (d.initialResult !== undefined) update.initial_result = d.initialResult;
    if (d.committeeMeetingDate !== undefined) update.committee_meeting_date = d.committeeMeetingDate;
    if (d.finalResult !== undefined) update.final_result = d.finalResult;
    if (d.suspensionStartDate !== undefined) update.suspension_start_date = d.suspensionStartDate;
    if (d.suspensionEndDate !== undefined) update.suspension_end_date = d.suspensionEndDate;
    if (d.points !== undefined) update.points = d.points;

    const { error } = await supabase.from('disciplinary_records').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteDisciplinaryRecord(id: string) {
    const { error } = await supabase.from('disciplinary_records').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Evaluations
  async insertEvaluation(e: EvaluationRecord) {
    const { error } = await supabase.from('evaluations').insert(evaluationToDb(e));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateEvaluation(id: string, e: Partial<EvaluationRecord>) {
    const update: any = {};
    if (e.employeeId !== undefined) update.employee_id = e.employeeId;
    if (e.date !== undefined) update.date = e.date;
    if (e.type !== undefined) update.type = e.type;
    if (e.scores !== undefined) update.scores = e.scores;
    if (e.overallScore !== undefined) update.overall_score = e.overallScore;
    if (e.managerNotes !== undefined) update.manager_notes = e.managerNotes;
    if (e.status !== undefined) update.status = e.status;
    if (e.acknowledged !== undefined) update.acknowledged = e.acknowledged;
    if (e.employeeComment !== undefined) update.employee_comment = e.employeeComment;
    if (e.createdBy !== undefined) update.created_by = e.createdBy;
    const { error } = await supabase.from('evaluations').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteEvaluation(id: string) {
    const { error } = await supabase.from('evaluations').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Department Tasks
  async upsertDepartmentTasks(dt: DepartmentTasks) {
    const { error } = await supabase.from('department_tasks').upsert({
      department: dt.department,
      onboarding_tasks: dt.onboardingTasks,
      offboarding_tasks: dt.offboardingTasks,
    }, { onConflict: 'department' });
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Leaves
  async insertLeave(l: LeaveRecord) {
    const { error } = await supabase.from('leaves').insert(leaveToDb(l));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateLeave(id: string, l: Partial<LeaveRecord>) {
    const update: any = {};
    if (l.employeeId !== undefined) update.employee_id = l.employeeId;
    if (l.employeeName !== undefined) update.employee_name = l.employeeName;
    if (l.leaveType !== undefined) update.leave_type = l.leaveType;
    if (l.startDate !== undefined) update.start_date = l.startDate;
    if (l.duration !== undefined) update.duration = l.duration;
    if (l.expectedEndDate !== undefined) update.expected_end_date = l.expectedEndDate;
    if (l.reason !== undefined) update.reason = l.reason;
    if (l.dateReturned !== undefined) update.date_returned = l.dateReturned;
    if (l.canBeContacted !== undefined) update.can_be_contacted = l.canBeContacted;
    if (l.status !== undefined) update.status = l.status;
    if (l.uploadedFile !== undefined) update.uploaded_file = l.uploadedFile;
    if (l.uploadedFileName !== undefined) update.uploaded_file_name = l.uploadedFileName;
    if (l.nasFilePath !== undefined) update.nas_file_path = l.nasFilePath;
    if (l.personResponsibleDuringAbsence !== undefined) update.person_responsible_during_absence = l.personResponsibleDuringAbsence;
    if (l.personResponsibleId !== undefined) update.person_responsible_id = l.personResponsibleId;
    if (l.keyDuties !== undefined) update.key_duties = l.keyDuties;
    if (l.formDateReturned !== undefined) update.form_date_returned = l.formDateReturned;
    if (l.employeeSignature !== undefined) update.employee_signature = l.employeeSignature;
    if (l.supervisorSignature !== undefined) update.supervisor_signature = l.supervisorSignature;
    if (l.managementSignature !== undefined) update.management_signature = l.managementSignature;
    if (l.hrSignature !== undefined) update.hr_signature = l.hrSignature;
    if (l.hrApprovedFrom !== undefined) update.hr_approved_from = l.hrApprovedFrom;
    if (l.hrApprovedTo !== undefined) update.hr_approved_to = l.hrApprovedTo;
    if (l.leaveNumber !== undefined) update.leave_number = l.leaveNumber;
    if (l.supervisor !== undefined) update.supervisor = l.supervisor;
    if (l.management !== undefined) update.management = l.management;
    if (l.approvedById !== undefined) update.approved_by_id = l.approvedById;
    if (l.approvedByName !== undefined) update.approved_by_name = l.approvedByName;
    if (l.approvalTaskId !== undefined) update.approval_task_id = l.approvalTaskId;
    if (l.approvedAt !== undefined) update.approved_at = l.approvedAt;
    if (l.rejectionNote !== undefined) update.rejection_note = l.rejectionNote;
    if (l.approvalStatus !== undefined) update.approval_status = l.approvalStatus;
    if (l.hodSignature !== undefined) update.hod_signature = l.hodSignature;
    if (l.workflowStep !== undefined) update.workflow_step = l.workflowStep;
    if (l.lineManagerTaskId !== undefined) update.line_manager_task_id = l.lineManagerTaskId;
    if (l.hodTaskId !== undefined) update.hod_task_id = l.hodTaskId;
    if (l.managementTaskId !== undefined) update.management_task_id = l.managementTaskId;
    if (l.hrTaskId !== undefined) update.hr_task_id = l.hrTaskId;
    if (l.hodEmployeeId !== undefined) update.hod_employee_id = l.hodEmployeeId;
    const { error } = await supabase.from('leaves').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLeave(id: string) {
    const { error } = await supabase.from('leaves').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Leave Types
  async insertLeaveType(type: Partial<LeaveType>) {
    const { error } = await supabase.from('leave_types').insert({ 
      name: type.name, 
      default_days: type.defaultDays || 0 
    });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLeaveType(name: string) {
    const { error } = await supabase.from('leave_types').delete().eq('name', name);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Settings
  async updateSettings(data: {
    payrollVariables?: any;
    payeTaxVariables?: any;
    monthValues?: any;
    hrVariables?: any;
    superAdminCreated?: boolean;
    superAdminSignupEnabled?: boolean;
  }) {
    const update: any = {};
    if (data.payrollVariables !== undefined) update.payroll_variables = data.payrollVariables;
    if (data.payeTaxVariables !== undefined) update.paye_tax_variables = data.payeTaxVariables;
    if (data.monthValues !== undefined) update.month_values = data.monthValues;
    if (data.hrVariables !== undefined) update.hr_variables = data.hrVariables;
    if (data.superAdminCreated !== undefined) update.super_admin_created = data.superAdminCreated;
    if (data.superAdminSignupEnabled !== undefined) update.super_admin_signup_enabled = data.superAdminSignupEnabled;
    update.updated_at = new Date().toISOString();
    // Check if a row exists first
    const { data: existingData } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
    
    if (existingData) {
      const { error } = await supabase.from('app_settings').update(update).eq('id', existingData.id);
      if (error) { console.error('Database error:', error); throw error; }
    } else {
      const { error } = await supabase.from('app_settings').insert([update]);
      if (error) { console.error('Database error:', error); throw error; }
    }
  },

  // Profiles / Users
  async updateProfile(id: string, data: Partial<{ name: string; email: string; avatar: string; privileges: any; is_active: boolean }>) {
    const { error } = await supabase.from('profiles').update(data).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Presets
  async insertPreset(p: PrivilegePreset) {
    const { error } = await supabase.from('privilege_presets').insert({ id: p.id, name: p.name, privileges: p.privileges });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updatePreset(id: string, p: Partial<PrivilegePreset>) {
    const update: any = {};
    if (p.name !== undefined) update.name = p.name;
    if (p.privileges !== undefined) update.privileges = p.privileges;
    const { error } = await supabase.from('privilege_presets').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deletePreset(id: string) {
    const { error } = await supabase.from('privilege_presets').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Ledger
  async insertLedgerCategory(cat: LedgerCategory) {
    const { error } = await supabase.from('ledger_categories').insert({ id: cat.id, name: cat.name });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateLedgerCategory(id: string, cat: Partial<LedgerCategory>) {
    const { error } = await supabase.from('ledger_categories').update(cat).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLedgerCategory(id: string) {
    const { error } = await supabase.from('ledger_categories').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  async insertLedgerVendor(v: LedgerVendor) {
    const { error } = await supabase.from('ledger_vendors').insert({ id: v.id, name: v.name, tin_number: v.tinNumber });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateLedgerVendor(id: string, v: Partial<LedgerVendor>) {
    const update: any = {};
    if (v.name !== undefined) update.name = v.name;
    if (v.tinNumber !== undefined) update.tin_number = v.tinNumber;
    const { error } = await supabase.from('ledger_vendors').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLedgerVendor(id: string) {
    const { error } = await supabase.from('ledger_vendors').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  async insertLedgerBank(b: LedgerBank) {
    const { error } = await supabase.from('ledger_banks').insert({ id: b.id, name: b.name });
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateLedgerBank(id: string, b: Partial<LedgerBank>) {
    const { error } = await supabase.from('ledger_banks').update(b).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLedgerBank(id: string) {
    const { error } = await supabase.from('ledger_banks').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  async insertLedgerBeneficiaryBank(b: LedgerBeneficiaryBank) {
    const { error } = await supabase.from('ledger_beneficiary_banks').insert(ledgerBeneficiaryBankToDb(b));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateLedgerBeneficiaryBank(id: string, b: Partial<LedgerBeneficiaryBank>) {
    const update: any = {};
    if (b.name !== undefined) update.name = b.name;
    if (b.accountNo !== undefined) update.account_no = b.accountNo;
    const { error } = await supabase.from('ledger_beneficiary_banks').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteLedgerBeneficiaryBank(id: string) {
    const { error } = await supabase.from('ledger_beneficiary_banks').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  async insertLedgerEntry(e: LedgerEntry) {
    const payload = ledgerEntryToDb(e);
    // Use upsert to handle re-submits of the same voucher gracefully
    const { error } = await supabase
      .from('ledger_entries')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('insertLedgerEntry:', error.message, error.details, error.hint, payload);
    }
  },
  async updateLedgerEntry(id: string, e: Partial<LedgerEntry>) {
    const update: any = {};
    if (e.voucherNo !== undefined) update.voucher_no = e.voucherNo;
    if (e.date !== undefined) update.date = (e.date && e.date.trim() !== '') ? e.date : new Date().toISOString().split('T')[0];
    if (e.description !== undefined) update.description = e.description;
    if (e.category !== undefined) update.category = e.category;
    if (e.amount !== undefined) update.amount = e.amount;
    if (e.client !== undefined) update.client = e.client || null;
    if (e.site !== undefined) update.site = e.site || null;
    if (e.vendor !== undefined) update.vendor = e.vendor || null;
    if (e.bank !== undefined) update.bank = e.bank;
    if (e.enteredBy !== undefined) update.entered_by = e.enteredBy;
    const { error } = await supabase.from('ledger_entries').update(update).eq('id', id);
    if (error) {
      console.error('updateLedgerEntry:', error.message, error.details, error.hint);
    }
  },
  async deleteLedgerEntry(id: string) {
    const { error } = await supabase.from('ledger_entries').delete().eq('id', id);
    if (error) {
      console.error('deleteLedgerEntry:', error.message, error.details, error.hint);
    }
  },
  async bulkUpdateLedgerEntries(ids: string[], update: Partial<LedgerEntry>) {
    const mappedUpdate: any = {};
    if (update.date) mappedUpdate.date = update.date;
    if (update.category) mappedUpdate.category = update.category;
    if (update.client) mappedUpdate.client = update.client;
    if (update.site) mappedUpdate.site = update.site;
    if (update.bank) mappedUpdate.bank = update.bank;
    if (update.vendor) mappedUpdate.vendor = update.vendor;
    if (update.enteredBy) mappedUpdate.entered_by = update.enteredBy;

    const { error } = await supabase.from('ledger_entries').update(mappedUpdate).in('id', ids);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async bulkInsertLedgerEntries(entries: LedgerEntry[]) {
    if (entries.length === 0) return;
    const payload = entries.map(ledgerEntryToDb);
    const { error } = await supabase
      .from('ledger_entries')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('bulkInsertLedgerEntries error:', error.message, error.details, error.hint);
    }
  },

  // Company Expenses
  async insertCompanyExpense(e: CompanyExpense) {
    const { error } = await supabase.from('company_expenses').insert(companyExpenseToDb(e));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateCompanyExpense(id: string, e: Partial<CompanyExpense>) {
    const update: any = {};
    Object.entries(e).forEach(([k, v]) => {
      const map: Record<string, string> = {
        paidFrom: 'paid_from', paidToBankName: 'paid_to_bank_name',
        paidToAccountNo: 'paid_to_account_no', enteredBy: 'entered_by',
        createdAt: 'created_at'
      };
      update[map[k] || k] = v;
    });
    const { error } = await supabase.from('company_expenses').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteCompanyExpense(id: string) {
    const { error } = await supabase.from('company_expenses').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Communication Logs
  async insertCommLog(l: CommLog) {
    const { error } = await supabase.from('comm_logs').insert(commLogToDb(l));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateCommLog(id: string, l: Partial<CommLog>) {
    const update: any = {};
    if (l.date !== undefined) update.date = l.date;
    if (l.time !== undefined) update.time = l.time ?? null;
    if (l.direction !== undefined) update.direction = l.direction;
    if (l.channel !== undefined) update.channel = l.channel;
    if (l.contactType !== undefined) update.contact_type = l.contactType;
    if (l.client !== undefined) update.client = l.client ?? null;
    if (l.siteId !== undefined) update.site_id = l.siteId ?? null;
    if (l.siteName !== undefined) update.site_name = l.siteName ?? null;
    if (l.contactPerson !== undefined) update.contact_person = l.contactPerson ?? null;
    if (l.subject !== undefined) update.subject = l.subject ?? null;
    if (l.notes !== undefined) update.notes = l.notes;
    if (l.outcome !== undefined) update.outcome = l.outcome ?? null;
    if (l.followUpDate !== undefined) update.follow_up_date = l.followUpDate ?? null;
    if (l.followUpDone !== undefined) update.follow_up_done = l.followUpDone;
    // parentId maps to parent_id — critical for thread persistence
    if (l.parentId !== undefined) update.parent_id = l.parentId ?? null;
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from('comm_logs').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteCommLog(id: string) {
    const { error } = await supabase.from('comm_logs').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Staff Merit Records
  async insertStaffMeritRecord(r: StaffMeritRecord) {
    const { error } = await supabase.from('staff_merit_record').insert(staffMeritToDb(r));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateStaffMeritRecord(id: string, r: Partial<StaffMeritRecord>) {
    const update: any = {};
    if (r.workspaceId !== undefined) update.workspace_id = r.workspaceId;
    if (r.employeeId !== undefined) update.employee_id = r.employeeId;
    if (r.employeeName !== undefined) update.employee_name = r.employeeName;
    if (r.recordType !== undefined) update.record_type = r.recordType;
    if (r.category !== undefined) update.category = r.category;
    if (r.description !== undefined) update.description = r.description;
    if (r.siteId !== undefined) update.site_id = r.siteId;
    if (r.siteName !== undefined) update.site_name = r.siteName;
    if (r.loggedById !== undefined) update.logged_by_id = r.loggedById;
    if (r.loggedByName !== undefined) update.logged_by_name = r.loggedByName;
    if (r.hrNotified !== undefined) update.hr_notified = r.hrNotified;
    if (r.incidentDate !== undefined) update.incident_date = r.incidentDate;
    const { error } = await supabase.from('staff_merit_record').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteStaffMeritRecord(id: string) {
    const { error } = await supabase.from('staff_merit_record').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async setPositions(positions: Position[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('positions').delete().neq('id', NIL_UUID);
    if (positions.length > 0) {
      const { error } = await supabase.from('positions').insert(positions.map(p => ({ id: p.id, title: p.title, department_id: p.departmentId })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setDepartments(departments: Department[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('departments').delete().neq('id', NIL_UUID);
    if (departments.length > 0) {
      const { error } = await supabase.from('departments').insert(departments.map(d => ({ 
        id: d.id, name: d.name, staff_type: d.staffType, 
        work_days_per_week: d.workDaysPerWeek, parent_department_id: d.parentDepartmentId || null 
      })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setClients(clientsNames: string[]) {
    await supabase.from('clients').delete().neq('name', '');
    if (clientsNames.length > 0) {
      const { error } = await supabase.from('clients').insert(clientsNames.map(name => ({ name })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setPublicHolidays(holidays: { id: string, date: string, name: string }[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('public_holidays').delete().neq('id', NIL_UUID);
    if (holidays.length > 0) {
      const { error } = await supabase.from('public_holidays').insert(holidays.map(h => ({ id: h.id, date: h.date, name: h.name })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setLeaveTypes(types: LeaveType[]) {
    await supabase.from('leave_types').delete().neq('name', '');
    if (types.length > 0) {
      const { error } = await supabase.from('leave_types').insert(types.map(t => ({
        ...(t.id ? { id: t.id } : {}),
        name: t.name,
        default_days: t.defaultDays || 0,
      })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setLedgerCategories(cats: LedgerCategory[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('ledger_categories').delete().neq('id', NIL_UUID);
    if (cats.length > 0) {
      const { error } = await supabase.from('ledger_categories').insert(cats.map(c => ({ id: c.id, name: c.name })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setLedgerVendors(vendors: LedgerVendor[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('ledger_vendors').delete().neq('id', NIL_UUID);
    if (vendors.length > 0) {
      const { error } = await supabase.from('ledger_vendors').insert(vendors.map(v => ({ id: v.id, name: v.name, tin_number: v.tinNumber })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setLedgerBanks(banks: LedgerBank[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('ledger_banks').delete().neq('id', NIL_UUID);
    if (banks.length > 0) {
      const { error } = await supabase.from('ledger_banks').insert(banks.map(b => ({ id: b.id, name: b.name })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setLedgerBeneficiaryBanks(banks: LedgerBeneficiaryBank[]) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    await supabase.from('ledger_beneficiary_banks').delete().neq('id', NIL_UUID);
    if (banks.length > 0) {
      const { error } = await supabase.from('ledger_beneficiary_banks').insert(banks.map(b => ({ id: b.id, name: b.name, account_no: b.accountNo })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async setDepartmentTasksList(list: DepartmentTasks[]) {
    await supabase.from('department_tasks').delete().neq('department', '');
    if (list.length > 0) {
      const { error } = await supabase.from('department_tasks').insert(list.map(d => ({
        department: d.department,
        onboarding_tasks: d.onboardingTasks,
        offboarding_tasks: d.offboardingTasks
      })));
      if (error) { console.error('Database error:', error); throw error; }
    }
  },
  async updateAttendanceRecord(id: string, a: Partial<AttendanceRecord>) {
    const update: any = {};
    if (a.position !== undefined) update.position = a.position;
    if (a.dayClient !== undefined) update.day_client = a.dayClient;
    if (a.daySite !== undefined) update.day_site = a.daySite;
    if (a.nightClient !== undefined) update.night_client = a.nightClient;
    if (a.nightSite !== undefined) update.night_site = a.nightSite;
    if (a.day !== undefined) update.day = a.day;
    if (a.night !== undefined) update.night = a.night;
    const { error } = await supabase.from('attendance_records').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  // Vehicles
  async insertVehicle(v: Vehicle) {
    const { error } = await supabase.from('vehicles').insert(vehicleToDb(v));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateVehicle(id: string, v: Partial<Vehicle>) {
    const update: any = {};
    if (v.name !== undefined) update.name = v.name;
    if (v.type !== undefined) update.type = v.type;
    if (v.registration_number !== undefined) update.registration_number = v.registration_number;
    if (v.status !== undefined) update.status = v.status;
    const { error } = await supabase.from('vehicles').update(update).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteVehicle(id: string) { await supabase.from('vehicles').delete().eq('id', id); },
  async insertVehicleDocumentType(type: any) { await supabase.from('vehicle_document_types').insert(type); },
  async deleteVehicleDocumentType(id: string) { await supabase.from('vehicle_document_types').delete().eq('id', id); },
  async updateVehicleDocument(vehicleId: string, documents: any) {
    await supabase.from('vehicles').update({ documents }).eq('id', vehicleId);
  },

  // Vehicle Trip Logs
  async insertVehicleTripRecords(logs: any[]) {
    const { error } = await supabase.from('vehicle_movement_log').insert(logs.map(vehicleMovementToDb));
    if (error) { console.error('Database error:', error); throw error; }
  },
  async updateVehicleTripRecord(id: string, log: any) {
    const { error } = await supabase.from('vehicle_movement_log').update(vehicleMovementToDb(log)).eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },
  async deleteVehicleTripRecord(id: string) {
    const { error } = await supabase.from('vehicle_movement_log').delete().eq('id', id);
    if (error) { console.error('Database error:', error); throw error; }
  },

  // Daily Journals
  async insertDailyJournal(j: DailyJournal, entries: SiteJournalEntry[]) {
    // 1. Insert Journal
    const { error: jError } = await supabase.from('daily_journals').insert(dailyJournalToDb(j));
    if (jError) { console.error('insertDailyJournal (journal):', jError); throw jError; }

    // 2. Insert Entries
    if (entries.length > 0) {
      const { error: eError } = await supabase.from('site_journal_entries').insert(entries.map(siteJournalEntryToDb));
      if (eError) { console.error('insertDailyJournal (entries):', eError); throw eError; }
    }
  },
  async updateDailyJournal(id: string, j: Partial<DailyJournal>, newEntries: SiteJournalEntry[]) {
    // 1. Update Journal
    const update: any = {};
    if (j.date !== undefined) update.date = j.date;
    if (j.generalNotes !== undefined) update.general_notes = j.generalNotes;
    
    if (Object.keys(update).length > 0) {
      const { error: jError } = await supabase.from('daily_journals').update(update).eq('id', id);
      if (jError) { console.error('updateDailyJournal (journal):', jError); throw jError; }
    }

    // 2. Delete existing entries and insert new ones
    const { error: delError } = await supabase.from('site_journal_entries').delete().eq('journal_id', id);
    if (delError) { console.error('updateDailyJournal (delete entries):', delError); throw delError; }

    if (newEntries.length > 0) {
      const { error: insError } = await supabase.from('site_journal_entries').insert(newEntries.map(siteJournalEntryToDb));
      if (insError) { console.error('updateDailyJournal (insert entries):', insError); throw insError; }
    }
  },
  async deleteDailyJournal(id: string) {
    const { error } = await supabase.from('daily_journals').delete().eq('id', id);
    if (error) { console.error('deleteDailyJournal:', error); throw error; }
  }
};
