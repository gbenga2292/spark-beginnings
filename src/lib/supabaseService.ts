/**
 * Supabase CRUD service layer.
 * Maps between DB snake_case and app camelCase.
 */
import { supabase } from '@/src/integrations/supabase/client';
import type {
  Site, Employee, AttendanceRecord, Invoice, PendingInvoice,
  SalaryAdvance, Loan, Payment, VatPayment, LeaveRecord, DepartmentTasks,
} from '@/src/store/appStore';
import type { AppUser, PrivilegePreset } from '@/src/store/userStore';

// ─── Mappers: DB → App ──────────────────────────────────────

function dbToSite(r: any): Site {
  return { id: r.id, name: r.name, client: r.client, vat: r.vat, status: r.status, startDate: r.start_date, endDate: r.end_date };
}

function dbToEmployee(r: any): Employee {
  return {
    id: r.id, employeeCode: r.employee_code, surname: r.surname, firstname: r.firstname, department: r.department,
    staffType: r.staff_type, position: r.position, startDate: r.start_date,
    endDate: r.end_date, yearlyLeave: r.yearly_leave, bankName: r.bank_name,
    accountNo: r.account_no, payeTax: r.paye_tax, withholdingTax: r.withholding_tax,
    taxId: r.tax_id, pensionNumber: r.pension_number, status: r.status,
    monthlySalaries: r.monthly_salaries, avatar: r.avatar,
    excludeFromOnboarding: r.exclude_from_onboarding, rent: Number(r.rent) || 0,
  };
}

function dbToAttendance(r: any): AttendanceRecord {
  return {
    id: r.id, date: r.date, staffId: r.staff_id, staffName: r.staff_name,
    position: r.position, dayClient: r.day_client, daySite: r.day_site,
    nightClient: r.night_client, nightSite: r.night_site, day: r.day,
    night: r.night, absentStatus: r.absent_status, nightWk: r.night_wk,
    ot: r.ot, otSite: r.ot_site, dayWk: r.day_wk, dow: r.dow,
    ndw: r.ndw, mth: r.mth, isPresent: r.is_present, day2: r.day2, overtimeDetails: r.overtime_details,
  };
}

function dbToInvoice(r: any): Invoice {
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
  };
}

function dbToPendingInvoice(r: any): PendingInvoice {
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
  };
}

function dbToSalaryAdvance(r: any): SalaryAdvance {
  return {
    id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
    amount: Number(r.amount), requestDate: r.request_date, status: r.status,
  };
}

function dbToLoan(r: any): Loan {
  return {
    id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
    loanType: r.loan_type, principalAmount: Number(r.principal_amount),
    monthlyDeduction: Number(r.monthly_deduction), duration: r.duration,
    startDate: r.start_date, paymentStartDate: r.payment_start_date,
    remainingBalance: Number(r.remaining_balance), status: r.status,
  };
}

function dbToPayment(r: any): Payment {
  return {
    id: r.id, client: r.client, site: r.site, date: r.date,
    amount: Number(r.amount), withholdingTax: Number(r.withholding_tax),
    discount: Number(r.discount), payVat: r.pay_vat,
    vat: Number(r.vat), amountForVat: Number(r.amount_for_vat),
  };
}

function dbToVatPayment(r: any): VatPayment {
  return { id: r.id, client: r.client, date: r.date, month: r.month, amount: Number(r.amount) };
}

function dbToLeave(r: any): LeaveRecord {
  return {
    id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
    leaveType: r.leave_type, startDate: r.start_date, duration: r.duration,
    expectedEndDate: r.expected_end_date, reason: r.reason,
    dateReturned: r.date_returned, canBeContacted: r.can_be_contacted,
    status: r.status, uploadedFile: r.uploaded_file, uploadedFileName: r.uploaded_file_name,
    supervisor: r.supervisor, management: r.management,
  };
}

function dbToProfile(r: any): AppUser {
  return {
    id: r.id, name: r.name, email: r.email, avatar: r.avatar,
    password: '', // Not stored in DB
    privileges: r.privileges || {},
    isActive: r.is_active, createdAt: r.created_at,
  };
}

// ─── Mappers: App → DB ──────────────────────────────────────

function siteToDb(s: Site) {
  return { id: s.id, name: s.name, client: s.client, vat: s.vat, status: s.status, start_date: s.startDate, end_date: s.endDate };
}

function employeeToDb(e: Employee) {
  return {
    id: e.id, employee_code: e.employeeCode, surname: e.surname, firstname: e.firstname, department: e.department,
    staff_type: e.staffType, position: e.position, start_date: e.startDate,
    end_date: e.endDate, yearly_leave: e.yearlyLeave, bank_name: e.bankName,
    account_no: e.accountNo, paye_tax: e.payeTax, withholding_tax: e.withholdingTax,
    tax_id: e.taxId, pension_number: e.pensionNumber, status: e.status,
    monthly_salaries: e.monthlySalaries, avatar: e.avatar,
    exclude_from_onboarding: e.excludeFromOnboarding ?? false, rent: e.rent ?? 0,
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
  };
}

function salaryAdvanceToDb(a: SalaryAdvance) {
  return {
    id: a.id, employee_id: a.employeeId, employee_name: a.employeeName,
    amount: a.amount, request_date: a.requestDate, status: a.status,
  };
}

function loanToDb(l: Loan) {
  return {
    id: l.id, employee_id: l.employeeId, employee_name: l.employeeName,
    loan_type: l.loanType, principal_amount: l.principalAmount,
    monthly_deduction: l.monthlyDeduction, duration: l.duration,
    start_date: l.startDate, payment_start_date: l.paymentStartDate,
    remaining_balance: l.remainingBalance, status: l.status,
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
  return { id: v.id, client: v.client, date: v.date, month: v.month, amount: v.amount };
}

function leaveToDb(l: LeaveRecord) {
  return {
    id: l.id, employee_id: l.employeeId, employee_name: l.employeeName,
    leave_type: l.leaveType, start_date: l.startDate, duration: l.duration,
    expected_end_date: l.expectedEndDate, reason: l.reason,
    date_returned: l.dateReturned, can_be_contacted: l.canBeContacted,
    status: l.status, uploaded_file: l.uploadedFile, uploaded_file_name: l.uploadedFileName,
    supervisor: l.supervisor, management: l.management,
  };
}

// ─── FETCH ALL ───────────────────────────────────────────────

export async function fetchAllAppData() {
  const [
    sitesRes, clientsRes, employeesRes, attendanceRes,
    invoicesRes, pendingInvRes, advancesRes, loansRes,
    paymentsRes, vatPayRes, holidaysRes, deptTasksRes,
    leavesRes, leaveTypesRes, settingsRes,
    positionsRes, departmentsRes,
  ] = await Promise.all([
    supabase.from('sites').select('*').order('created_at'),
    supabase.from('clients').select('*').order('name'),
    supabase.from('employees').select('*').order('surname'),
    supabase.from('attendance_records').select('*').order('date'),
    supabase.from('invoices').select('*').order('date', { ascending: false }),
    supabase.from('pending_invoices').select('*').order('created_at'),
    supabase.from('salary_advances').select('*').order('request_date', { ascending: false }),
    supabase.from('loans').select('*').order('start_date', { ascending: false }),
    supabase.from('payments').select('*').order('date', { ascending: false }),
    supabase.from('vat_payments').select('*').order('date', { ascending: false }),
    supabase.from('public_holidays').select('*').order('date'),
    supabase.from('department_tasks').select('*'),
    supabase.from('leaves').select('*').order('start_date', { ascending: false }),
    supabase.from('leave_types').select('*').order('name'),
    supabase.from('app_settings').select('*').limit(1).maybeSingle(),
    supabase.from('positions').select('*').order('name'),
    supabase.from('departments').select('*').order('name'),
  ]);

  const settings = settingsRes.data;

  return {
    sites: (sitesRes.data || []).map(dbToSite),
    clients: (clientsRes.data || []).map((c: any) => c.name),
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
    leaveTypes: (leaveTypesRes.data || []).map((t: any) => t.name),
    positions: (positionsRes.data || []).map((p: any) => p.name),
    departments: (departmentsRes.data || []).map((d: any) => d.name),
    payrollVariables: settings?.payroll_variables || undefined,
    payeTaxVariables: settings?.paye_tax_variables || undefined,
    monthValues: settings?.month_values || undefined,
    superAdminCreated: settings?.super_admin_created ?? false,
    superAdminSignupEnabled: settings?.super_admin_signup_enabled ?? true,
    settingsId: settings?.id,
  };
}

export async function fetchAllUsers() {
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
    const { error } = await supabase.from('sites').insert(siteToDb(s));
    if (error) console.error('insertSite:', error);
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
    if (error) console.error('updateSite:', error);
  },
  async deleteSite(id: string) {
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) console.error('deleteSite:', error);
  },
  async setSites(sites: Site[]) {
    await supabase.from('sites').delete().neq('id', '');
    if (sites.length > 0) {
      const { error } = await supabase.from('sites').insert(sites.map(siteToDb));
      if (error) console.error('setSites:', error);
    }
  },

  // Clients
  async insertClient(name: string) {
    const { error } = await supabase.from('clients').insert({ name });
    if (error) console.error('insertClient:', error);
  },
  async deleteClient(name: string) {
    const { error } = await supabase.from('clients').delete().eq('name', name);
    if (error) console.error('deleteClient:', error);
  },

  // Positions
  async insertPosition(name: string) {
    const { error } = await supabase.from('positions').insert({ name });
    if (error) console.error('insertPosition:', error);
  },
  async deletePosition(name: string) {
    const { error } = await supabase.from('positions').delete().eq('name', name);
    if (error) console.error('deletePosition:', error);
  },

  // Departments
  async insertDepartment(name: string) {
    const { error } = await supabase.from('departments').insert({ name });
    if (error) console.error('insertDepartment:', error);
  },
  async deleteDepartment(name: string) {
    const { error } = await supabase.from('departments').delete().eq('name', name);
    if (error) console.error('deleteDepartment:', error);
  },

  // Employees
  async insertEmployee(e: Employee) {
    const { error } = await supabase.from('employees').insert(employeeToDb(e));
    if (error) console.error('insertEmployee:', error);
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
    if (e.taxId !== undefined) update.tax_id = e.taxId;
    if (e.pensionNumber !== undefined) update.pension_number = e.pensionNumber;
    if (e.status !== undefined) update.status = e.status;
    if (e.monthlySalaries !== undefined) update.monthly_salaries = e.monthlySalaries;
    if (e.avatar !== undefined) update.avatar = e.avatar;
    if (e.excludeFromOnboarding !== undefined) update.exclude_from_onboarding = e.excludeFromOnboarding;
    if (e.rent !== undefined) update.rent = e.rent;
    const { error } = await supabase.from('employees').update(update).eq('id', id);
    if (error) console.error('updateEmployee:', error);
  },
  async deleteEmployee(id: string) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) console.error('deleteEmployee:', error);
  },

  // Attendance
  async insertAttendanceRecords(records: AttendanceRecord[]) {
    if (records.length === 0) return;
    const { error } = await supabase.from('attendance_records').insert(records.map(attendanceToDb));
    if (error) console.error('insertAttendance:', error);
  },
  async deleteAttendanceByDate(date: string) {
    const { error } = await supabase.from('attendance_records').delete().eq('date', date);
    if (error) console.error('deleteAttendanceByDate:', error);
  },
  async deleteAttendanceByIds(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await supabase.from('attendance_records').delete().in('id', ids);
    if (error) console.error('deleteAttendanceByIds:', error);
  },

  // Invoices
  async insertInvoice(i: Invoice) {
    const { error } = await supabase.from('invoices').insert(invoiceToDb(i));
    if (error) console.error('insertInvoice:', error);
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
        totalExclusiveOfVat: 'total_exclusive_of_vat',
      };
      update[map[k] || k] = v;
    });
    const { error } = await supabase.from('invoices').update(update).eq('id', id);
    if (error) console.error('updateInvoice:', error);
  },
  async deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) console.error('deleteInvoice:', error);
  },

  // Pending Invoices
  async insertPendingInvoice(p: PendingInvoice) {
    const { error } = await supabase.from('pending_invoices').insert(pendingInvoiceToDb(p));
    if (error) console.error('insertPendingInvoice:', error);
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
        totalExclusiveOfVat: 'total_exclusive_of_vat',
      };
      update[map[k] || k] = v;
    });
    const { error } = await supabase.from('pending_invoices').update(update).eq('id', id);
    if (error) console.error('updatePendingInvoice:', error);
  },
  async deletePendingInvoice(id: string) {
    const { error } = await supabase.from('pending_invoices').delete().eq('id', id);
    if (error) console.error('deletePendingInvoice:', error);
  },

  // Salary Advances
  async insertSalaryAdvance(a: SalaryAdvance) {
    const { error } = await supabase.from('salary_advances').insert(salaryAdvanceToDb(a));
    if (error) console.error('insertSalaryAdvance:', error);
  },
  async updateSalaryAdvance(id: string, a: Partial<SalaryAdvance>) {
    const update: any = {};
    if (a.employeeId !== undefined) update.employee_id = a.employeeId;
    if (a.employeeName !== undefined) update.employee_name = a.employeeName;
    if (a.amount !== undefined) update.amount = a.amount;
    if (a.requestDate !== undefined) update.request_date = a.requestDate;
    if (a.status !== undefined) update.status = a.status;
    const { error } = await supabase.from('salary_advances').update(update).eq('id', id);
    if (error) console.error('updateSalaryAdvance:', error);
  },
  async deleteSalaryAdvance(id: string) {
    const { error } = await supabase.from('salary_advances').delete().eq('id', id);
    if (error) console.error('deleteSalaryAdvance:', error);
  },

  // Loans
  async insertLoan(l: Loan) {
    const { error } = await supabase.from('loans').insert(loanToDb(l));
    if (error) console.error('insertLoan:', error);
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
    const { error } = await supabase.from('loans').update(update).eq('id', id);
    if (error) console.error('updateLoan:', error);
  },
  async deleteLoan(id: string) {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) console.error('deleteLoan:', error);
  },

  // Payments
  async insertPayment(p: Payment) {
    const { error } = await supabase.from('payments').insert(paymentToDb(p));
    if (error) console.error('insertPayment:', error);
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
    if (error) console.error('updatePayment:', error);
  },
  async deletePayment(id: string) {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) console.error('deletePayment:', error);
  },

  // VAT Payments
  async insertVatPayment(v: VatPayment) {
    const { error } = await supabase.from('vat_payments').insert(vatPaymentToDb(v));
    if (error) console.error('insertVatPayment:', error);
  },
  async updateVatPayment(id: string, v: Partial<VatPayment>) {
    const { error } = await supabase.from('vat_payments').update(v).eq('id', id);
    if (error) console.error('updateVatPayment:', error);
  },
  async deleteVatPayment(id: string) {
    const { error } = await supabase.from('vat_payments').delete().eq('id', id);
    if (error) console.error('deleteVatPayment:', error);
  },

  // Public Holidays
  async insertPublicHoliday(h: { id: string; date: string; name: string }) {
    const { error } = await supabase.from('public_holidays').insert(h);
    if (error) console.error('insertPublicHoliday:', error);
  },
  async deletePublicHoliday(id: string) {
    const { error } = await supabase.from('public_holidays').delete().eq('id', id);
    if (error) console.error('deletePublicHoliday:', error);
  },

  // Department Tasks
  async upsertDepartmentTasks(dt: DepartmentTasks) {
    const { error } = await supabase.from('department_tasks').upsert({
      department: dt.department,
      onboarding_tasks: dt.onboardingTasks,
      offboarding_tasks: dt.offboardingTasks,
    }, { onConflict: 'department' });
    if (error) console.error('upsertDepartmentTasks:', error);
  },

  // Leaves
  async insertLeave(l: LeaveRecord) {
    const { error } = await supabase.from('leaves').insert(leaveToDb(l));
    if (error) console.error('insertLeave:', error);
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
    const { error } = await supabase.from('leaves').update(update).eq('id', id);
    if (error) console.error('updateLeave:', error);
  },
  async deleteLeave(id: string) {
    const { error } = await supabase.from('leaves').delete().eq('id', id);
    if (error) console.error('deleteLeave:', error);
  },

  // Leave Types
  async insertLeaveType(name: string) {
    const { error } = await supabase.from('leave_types').insert({ name });
    if (error) console.error('insertLeaveType:', error);
  },
  async deleteLeaveType(name: string) {
    const { error } = await supabase.from('leave_types').delete().eq('name', name);
    if (error) console.error('deleteLeaveType:', error);
  },

  // Settings
  async updateSettings(data: {
    payrollVariables?: any;
    payeTaxVariables?: any;
    monthValues?: any;
    superAdminCreated?: boolean;
    superAdminSignupEnabled?: boolean;
  }) {
    const update: any = {};
    if (data.payrollVariables !== undefined) update.payroll_variables = data.payrollVariables;
    if (data.payeTaxVariables !== undefined) update.paye_tax_variables = data.payeTaxVariables;
    if (data.monthValues !== undefined) update.month_values = data.monthValues;
    if (data.superAdminCreated !== undefined) update.super_admin_created = data.superAdminCreated;
    if (data.superAdminSignupEnabled !== undefined) update.super_admin_signup_enabled = data.superAdminSignupEnabled;
    update.updated_at = new Date().toISOString();
    // Check if a row exists first
    const { data: existingData } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
    
    if (existingData) {
      const { error } = await supabase.from('app_settings').update(update).eq('id', existingData.id);
      if (error) console.error('updateSettings (update):', error);
    } else {
      const { error } = await supabase.from('app_settings').insert([update]);
      if (error) console.error('updateSettings (insert):', error);
    }
  },

  // Profiles / Users
  async updateProfile(id: string, data: Partial<{ name: string; email: string; avatar: string; privileges: any; is_active: boolean }>) {
    const { error } = await supabase.from('profiles').update(data).eq('id', id);
    if (error) console.error('updateProfile:', error);
  },

  // Presets
  async insertPreset(p: PrivilegePreset) {
    const { error } = await supabase.from('privilege_presets').insert({ id: p.id, name: p.name, privileges: p.privileges });
    if (error) console.error('insertPreset:', error);
  },
  async updatePreset(id: string, p: Partial<PrivilegePreset>) {
    const update: any = {};
    if (p.name !== undefined) update.name = p.name;
    if (p.privileges !== undefined) update.privileges = p.privileges;
    const { error } = await supabase.from('privilege_presets').update(update).eq('id', id);
    if (error) console.error('updatePreset:', error);
  },
  async deletePreset(id: string) {
    const { error } = await supabase.from('privilege_presets').delete().eq('id', id);
    if (error) console.error('deletePreset:', error);
  },
};
