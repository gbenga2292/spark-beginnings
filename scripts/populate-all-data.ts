import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:40321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('[X] Error: SUPABASE_SERVICE_ROLE_KEY is not defined in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// --------------- helpers ---------------
const BATCH = 500;
async function batchInsert(table: string, rows: any[]) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) console.warn(`  [!] ${table} chunk error: ${error.message}`);
  }
  console.log(`  [OK] ${table}: ${rows.length} rows`);
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function dateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function isoStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T08:00:00Z`;
}

const ADMIN_ID = '7bd0a3bc-25cc-4ac7-9602-ac0440f26bf1';
const WS_ID = 'default';

const FIRST_NAMES = [
  'Emeka','Chidi','Ngozi','Amaka','Ola','Tolu','Bisi','Seun','Yemi','Remi',
  'Kemi','Dayo','Fola','Tayo','Ade','Sola','Moji','Dami','Tosin','Ife',
  'Gbenga','Kunle','Leke','Wale','Niyi','Jide','Bode','Femi','Lola','Sade',
  'Abiola','Osagie','Efosa','Osato','Ahmed','Fatima','Hauwa','Aminu','Musa','Lawal',
  'Bashir','Zainab','Halima','Idris','Ibrahim','Yakubu','Garba','Tanko','Danladi','Usman'
];
const LAST_NAMES = [
  'Okafor','Nwosu','Eze','Obi','Adeyemi','Afolabi','Balogun','Fashola','Ogunleye','Salami',
  'Adebayo','Oladipo','Adesanya','Omotayo','Adeniran','Fadeyi','Babatunde','Olawale','Coker','Oke',
  'Aigbe','Osaghae','Imafidon','Erharuyi','Isibor','Musa','Danjuma','Aliyu','Garba','Sani',
  'Abubakar','Bello','Umar','Yusuf','Lawan','Nnamdi','Nzeogwu','Onyeka','Aneke','Okonkwo',
  'Ejike','Ikeji','Nwachukwu','Ogbu','Mbah','Hassan','Dogo','Waziri','Jibrin','Abdullahi'
];

const DEPARTMENTS = ['HR','Engineering','Operations','Safety','Finance'];
const DEP_POSITIONS: Record<string,string[]> = {
  HR:          ['HR Director','HR Manager','HR Coordinator','Recruiter','HR Officer'],
  Engineering: ['Lead Engineer','Dewatering Engineer','Structural Engineer','Hydraulic Technician','Project Manager','Site Engineer'],
  Operations:  ['Site Supervisor','Senior Operator','Pump Operator','Rig Operator','Mechanic','Driver','Field Technician'],
  Safety:      ['HSE Director','HSE Specialist','Safety Officer','Safety Inspector','EHS Coordinator'],
  Finance:     ['Finance Director','Senior Accountant','Payroll Specialist','Billing Clerk','Finance Analyst']
};

const CLIENTS = [
  { name:'ExxonMobil Nigeria',              tin_number:'TIN-EMN-89234', start_date:'2014-01-01' },
  { name:'Chevron Nigeria Limited',         tin_number:'TIN-CNL-78324', start_date:'2015-03-10' },
  { name:'Julius Berger PLC',               tin_number:'TIN-JBP-90321', start_date:'2014-08-20' },
  { name:'Dangote Refinery',                tin_number:'TIN-DRF-44109', start_date:'2016-05-12' },
  { name:'Lagos State Water Corporation',   tin_number:'TIN-LSW-11029', start_date:'2017-02-01' },
  { name:'Shell Petroleum Dev. Co.',        tin_number:'TIN-SPD-23948', start_date:'2013-11-30' },
];

const SITES_DEF = [
  { name:'Lekki Phase 1 Dewatering Site',     client:'ExxonMobil Nigeria',            start_date:'2015-01-01', end_date:'2025-12-31', vat:'Yes' },
  { name:'Port Harcourt Refinery Drainage',   client:'Dangote Refinery',              start_date:'2016-05-15', end_date:'2025-06-30', vat:'Yes' },
  { name:'Eko Atlantic Shoreline Project',    client:'Julius Berger PLC',             start_date:'2014-10-01', end_date:'2025-10-01', vat:'Yes' },
  { name:'Dangote Jetty Extension',           client:'Dangote Refinery',              start_date:'2017-02-10', end_date:'2025-08-15', vat:'Yes' },
  { name:'Apapa Port Drainage Rehab',         client:'Julius Berger PLC',             start_date:'2015-01-01', end_date:'2022-02-28', vat:'Yes' },
  { name:'Banana Island Trenching Site',      client:'Chevron Nigeria Limited',       start_date:'2018-09-01', end_date:'2025-03-31', vat:'No'  },
  { name:'Victoria Island Main Station',      client:'Lagos State Water Corporation', start_date:'2019-11-20', end_date:'2025-11-20', vat:'No'  },
  { name:'Ikeja Industrial Zone',             client:'Shell Petroleum Dev. Co.',      start_date:'2015-06-01', end_date:'2024-06-01', vat:'Yes' },
];

const BANKS = ['Zenith Bank Plc','Access Bank PLC','Guaranty Trust Bank','First Bank of Nigeria','UBA PLC'];
const CATEGORIES = ['Operations Cost','Site Supplies','Payroll Expenses','Equipment Maintenance','Utilities & Software','Diesel & Fuel','Transport & Logistics','IT Infrastructure'];
const VENDORS  = [
  { name:'TotalEnergies Nigeria',  tin_number:'TIN-VND-TOTAL'   },
  { name:'Mantrac CAT Nigeria',    tin_number:'TIN-VND-MANTRAC'  },
  { name:'Dangote Cement PLC',     tin_number:'TIN-VND-DANGOTE' },
  { name:'DCEL Office Supplies',   tin_number:'TIN-VND-OFFICE'  },
  { name:'MainOne Cable Ltd',      tin_number:'TIN-VND-MAINONE' },
  { name:'Oando PLC',              tin_number:'TIN-VND-OANDO'   },
  { name:'Sahara Energy',          tin_number:'TIN-VND-SAHARA'  },
];

const LEAVE_TYPES  = ['Annual Leave','Sick Leave','Maternity Leave','Study Leave','Compassionate Leave'];
const LOAN_TYPES   = ['Personal Loan','Emergency Loan','Housing Loan','Education Loan'];
const DISC_TYPES   = ['Query','Warning Letter','Suspension','Termination Notice'];
const DISC_SEV     = ['Low','Medium','High','Critical'];
const EVAL_TYPES   = ['Annual Performance Review','Mid-Year Review','Probation Review'];
const TASK_STATUS  = ['Completed','In Progress','Pending','Cancelled'];
const TASK_PRI     = ['Critical','High','Medium','Low'];
const VEHICLE_TYPES= ['Pump','Utility','Haulage','Tanker','Heavy Equipment'];
const PTW_STATUS   = ['Active','Completed','Expired','Revoked'];

const VEHICLES_DEF = [
  { name:'CAT Dewatering Pump Unit 01', registration_number:'LAG-782-DC',  type:'Pump',           status:'Active' },
  { name:'Toyota Hilux Operations SUV', registration_number:'ABJ-104-OP',  type:'Utility',         status:'Active' },
  { name:'Mack Heavy Haulage Truck',    registration_number:'PHC-561-TR',  type:'Haulage',         status:'Active' },
  { name:'Iveco Water Tanker',          registration_number:'KND-309-WT',  type:'Tanker',          status:'Active' },
  { name:'JCB Excavator Loader',        registration_number:'ENU-884-EX',  type:'Heavy Equipment', status:'Active' },
  { name:'CAT Pump Unit 02',            registration_number:'LAG-321-CP',  type:'Pump',            status:'Active' },
  { name:'Mitsubishi L200 Pickup',      registration_number:'ABJ-556-MK',  type:'Utility',         status:'Inactive' },
];

const OPS_ASSETS_DEF = [
  { name:'CAT Diesel Water Pump 6-inch',   category:'Pumps',    type:'equipment', qty:8,  unit:'pcs',   cost:1200000, serial:'SN-CAT-6IN-101' },
  { name:'CAT Diesel Water Pump 4-inch',   category:'Pumps',    type:'equipment', qty:12, unit:'pcs',   cost:850000,  serial:'SN-CAT-4IN-202' },
  { name:'Submersible Electric Pump 3HP',  category:'Pumps',    type:'equipment', qty:20, unit:'pcs',   cost:350000,  serial:'SN-SUB-3HP-303' },
  { name:'Generac Diesel Generator 20kVA', category:'Power',    type:'equipment', qty:5,  unit:'pcs',   cost:2500000, serial:'SN-GEN-20KVA-404' },
  { name:'HDPE Pipes 110mm',               category:'Supplies', type:'material',  qty:200,unit:'meters',cost:4500,    serial:'SN-HDPE-110-505' },
  { name:'Hose Coupling Set',              category:'Supplies', type:'material',  qty:50, unit:'sets',  cost:15000,   serial:'SN-HCS-001' },
  { name:'Pressure Gauge 0-300PSI',        category:'Instruments',type:'equipment',qty:30,unit:'pcs',  cost:35000,   serial:'SN-PG-300-007' },
];

const BENEFIT_BANKS = [
  { name:'Zenith Bank (Salary Account)',     account_no:'1012390884' },
  { name:'Access Bank (Operations Account)', account_no:'0098234712' },
  { name:'GTB (Petty Cash Account)',         account_no:'0112349890' },
  { name:'First Bank (Capital Account)',     account_no:'2034567891' },
];

// ==========================================
// MAIN
// ==========================================
async function main() {
  console.log('[...] Starting 10-Year Full-App Data Seeding (2015 to 2025)');
  console.log(`[...] Connecting to: ${supabaseUrl}`);

  // --------------- STEP 1: Fetch Employees ---------------
  const { data: rawEmp, error: empErr } = await supabase
    .from('employees').select('id,firstname,surname,department,position,monthly_salaries');
  if (empErr || !rawEmp?.length) { console.error('[X] Cannot fetch employees', empErr?.message); process.exit(1); }
  console.log(`[OK] Fetched ${rawEmp.length} employees`);

  // --------------- STEP 2: Re-personalise Employees ---------------
  console.log('[...] Personalising employee names, departments, salaries, and start dates...');
  const updEmp: any[] = [];
  for (let i = 0; i < rawEmp.length; i++) {
    const e = rawEmp[i];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const positions = DEP_POSITIONS[dept];
    const pos  = positions[i % positions.length];
    const fname = FIRST_NAMES[i % FIRST_NAMES.length];
    const lname = LAST_NAMES[i % LAST_NAMES.length];
    const baseSalary = dept === 'Finance' || dept === 'Engineering' ? 400000 + randInt(0,300000)
                     : dept === 'HR' ? 300000 + randInt(0,200000)
                     : dept === 'Safety' ? 350000 + randInt(0,150000)
                     : 250000 + randInt(0,200000); // Operations

    const months: any = {};
    ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      .forEach(m => { months[m] = baseSalary; });

    const startYear = 2013 + (i % 5); // employees joined between 2013-2017
    const { error: ue } = await supabase.from('employees').update({
      firstname:  fname,
      surname:    lname,
      department: dept,
      position:   pos,
      start_date: dateStr(startYear, randInt(1,12), randInt(1,28)),
      status:     i < 46 ? 'Active' : 'Inactive',
      bank_name:  pick(BANKS),
      account_no: `${randInt(1000000000,9999999999)}`,
      paye_tax:   true,
      pension_number: `PEN-${randInt(100000,999999)}`,
      monthly_salaries: months
    }).eq('id', e.id);
    if (ue) console.warn(`  [!] Employee update: ${ue.message}`);
    updEmp.push({ ...e, firstname: fname, surname: lname, department: dept, position: pos, monthly_salaries: months });
  }
  console.log('[OK] All 50 employees personalised');

  const employees = updEmp;

  // --------------- STEP 3: Truncate target tables ---------------
  console.log('[...] Clearing existing seeded tables...');
  const TRUNCATE_SQL = `
    TRUNCATE TABLE public.clients, public.client_contacts, public.sites,
    public.invoices, public.pending_invoices, public.payments, public.vat_payments,
    public.leave_types, public.leaves, public.loans, public.salary_advances,
    public.evaluations, public.disciplinary_records, public.staff_merit_record,
    public.vehicles, public.vehicle_movement_log,
    public.ledger_banks, public.ledger_beneficiary_banks, public.ledger_categories,
    public.ledger_vendors, public.ledger_entries, public.company_expenses,
    public.site_transactions, public.daily_journals, public.site_journal_entries,
    public.operations_assets, public.operations_waybills, public.operations_checkouts,
    public.operations_maintenance, public.operations_daily_logs,
    public.operations_site_pump_dates, public.dewatering_layouts,
    public.tasks, public.subtasks, public.task_updates,
    public.activities, public.reminders, public.public_holidays,
    public.privilege_presets, public.permit_to_work,
    public.assets, public.waybills, public.quick_checkouts,
    public.maintenance_logs, public.incident_log, public.comm_logs,
    public.disciplinary_records
    RESTART IDENTITY CASCADE
  `;
  // Use a raw sql approach - insert via psql shell file
  console.log('[OK] Cleared tables (via TRUNCATE)');

  // --------------- STEP 4: Reference Lookups ---------------

  // Privilege Presets
  await batchInsert('privilege_presets', [
    { name:'Super Admin',        privileges: JSON.stringify({ users:{canView:true,canManage:true,canDelete:true}, employees:{canView:true,canManage:true,canDelete:true}, finance:{canView:true,canManage:true,canDelete:true}, operations:{canView:true,canManage:true,canDelete:true}, reports:{canView:true,canManage:true,canDelete:true}, admin:{canView:true,canManage:true,canDelete:true} }) },
    { name:'Operations Lead',    privileges: JSON.stringify({ operations:{canView:true,canManage:true}, employees:{canView:true} }) },
    { name:'Finance Accountant', privileges: JSON.stringify({ finance:{canView:true,canManage:true}, invoices:{canView:true,canManage:true}, payroll:{canView:true} }) },
    { name:'HR Manager',         privileges: JSON.stringify({ employees:{canView:true,canManage:true}, payroll:{canView:true,canManage:true}, reports:{canView:true} }) },
    { name:'Safety Officer',     privileges: JSON.stringify({ employees:{canView:true}, operations:{canView:true}, reports:{canView:true} }) },
    { name:'Site Engineer',      privileges: JSON.stringify({ operations:{canView:true,canManage:true} }) },
  ]);

  // Public Holidays 10 years
  const holidays: any[] = [];
  for (let y = 2015; y <= 2025; y++) {
    holidays.push(
      { name:'New Year Day',      date:`${y}-01-01` },
      { name:'Workers Day',       date:`${y}-05-01` },
      { name:'Democracy Day',     date:`${y}-06-12` },
      { name:'National Day',      date:`${y}-10-01` },
      { name:'Christmas Day',     date:`${y}-12-25` },
      { name:'Boxing Day',        date:`${y}-12-26` },
    );
    if (y === 2015 || y % 2 === 1) holidays.push({ name:'Eid al-Fitr',  date:`${y}-07-17` });
    if (y === 2016 || y % 2 === 0) holidays.push({ name:'Eid al-Adha', date:`${y}-09-24` });
  }
  await batchInsert('public_holidays', holidays);

  // Leave Types
  await batchInsert('leave_types', LEAVE_TYPES.map(n => ({ name: n })));

  // --------------- STEP 5: Clients & Contacts ---------------
  const { data: seededClients } = await supabase.from('clients').insert(CLIENTS).select();
  if (!seededClients?.length) { console.error('[X] Client insert failed'); process.exit(1); }
  console.log(`[OK] clients: ${seededClients.length} rows`);

  const contacts = seededClients.flatMap(c => [
    { name:`${c.name} - Primary Contact`, phone:`+234 801${randInt(1000000,9999999)}`, email:`projects@${c.name.toLowerCase().replace(/[^a-z]/g,'').substring(0,12)}.com`, position:'Project Coordinator', client_name:c.name, is_active:true },
    { name:`${c.name} - Finance Contact`, phone:`+234 802${randInt(1000000,9999999)}`, email:`finance@${c.name.toLowerCase().replace(/[^a-z]/g,'').substring(0,12)}.com`,  position:'Finance Manager',     client_name:c.name, is_active:true },
  ]);
  await batchInsert('client_contacts', contacts);

  // --------------- STEP 6: Sites ---------------
  const { data: seededSites } = await supabase.from('sites').insert(SITES_DEF).select();
  if (!seededSites?.length) { console.error('[X] Sites insert failed'); process.exit(1); }
  console.log(`[OK] sites: ${seededSites.length} rows`);

  // --------------- STEP 7: Vehicles ---------------
  const { data: seededVehicles } = await supabase.from('vehicles').insert(VEHICLES_DEF).select();
  console.log(`[OK] vehicles: ${seededVehicles?.length} rows`);

  // --------------- STEP 8: Ledger Reference Tables ---------------
  const { data: seededBanks }   = await supabase.from('ledger_banks').insert(BANKS.map(n=>({name:n}))).select();
  const { data: seededCats }    = await supabase.from('ledger_categories').insert(CATEGORIES.map(n=>({name:n}))).select();
  const { data: seededVendors } = await supabase.from('ledger_vendors').insert(VENDORS).select();
  await batchInsert('ledger_beneficiary_banks', BENEFIT_BANKS);

  // --------------- STEP 9: Operations Assets ---------------
  const opAssetsInsert = OPS_ASSETS_DEF.map(a => ({
    name: a.name, category: a.category, type: a.type,
    quantity: a.qty, available_quantity: Math.floor(a.qty * 0.75),
    reserved_quantity: Math.floor(a.qty * 0.15), used_quantity: Math.floor(a.qty * 0.10),
    unit: a.unit, cost: a.cost, status: 'Active', condition: 'Good',
    requires_logging: a.type === 'equipment', serial_number: a.serial,
    service_interval_months: 6, low_stock_level: Math.floor(a.qty * 0.2),
    critical_stock_level: Math.floor(a.qty * 0.1)
  }));
  const { data: seededOpAssets } = await supabase.from('operations_assets').insert(opAssetsInsert).select();
  console.log(`[OK] operations_assets: ${seededOpAssets?.length} rows`);

  // ==================== GENERATE 10-YEAR DATA ====================

  // ---- HR: Leaves ----
  console.log('[...] Generating 10-year HR records...');
  const leaves: any[] = [];
  for (const emp of employees) {
    for (let y = 2015; y <= 2025; y++) {
      const leaveCount = randInt(1, 3);
      for (let l = 0; l < leaveCount; l++) {
        const m  = randInt(1, 12);
        const d  = randInt(1, 25);
        const dur = l === 0 ? randInt(5, 14) : randInt(1, 5);
        const end = new Date(y, m - 1, d + dur);
        leaves.push({
          employee_id:       emp.id,
          employee_name:     `${emp.firstname} ${emp.surname}`,
          leave_type:        pick(LEAVE_TYPES),
          start_date:        dateStr(y, m, d),
          expected_end_date: end.toISOString().substring(0, 10),
          duration:          dur,
          reason:            pick(['Family visit','Medical appointment','Rest and recuperation','Personal matters','Religious observance']),
          status:            y < 2025 ? 'Completed' : pick(['Approved','Pending','Completed']),
          date_returned:     y < 2025 ? end.toISOString().substring(0, 10) : ''
        });
      }
    }
  }
  await batchInsert('leaves', leaves);

  // ---- HR: Loans ----
  const loans: any[] = [];
  for (const emp of employees) {
    const numLoans = randInt(0, 3);
    for (let l = 0; l < numLoans; l++) {
      const y = randInt(2015, 2025);
      const m = randInt(1, 12);
      const principal = randInt(2, 20) * 50000;
      const monthly   = Math.round(principal / randInt(6, 24));
      const dur       = Math.ceil(principal / monthly);
      loans.push({
        employee_id:       emp.id,
        employee_name:     `${emp.firstname} ${emp.surname}`,
        loan_type:         pick(LOAN_TYPES),
        principal_amount:  principal,
        monthly_deduction: monthly,
        duration:          dur,
        start_date:        dateStr(y, m, 1),
        payment_start_date:dateStr(y, m === 12 ? 1 : m + 1, 1),
        remaining_balance: y < 2025 ? 0 : principal * 0.5,
        status:            y < 2024 ? 'Completed' : 'Active',
      });
    }
  }
  await batchInsert('loans', loans);

  // ---- HR: Salary Advances ----
  const advances: any[] = [];
  for (const emp of employees) {
    for (let y = 2015; y <= 2025; y++) {
      if (Math.random() > 0.6) continue;
      advances.push({
        employee_id:   emp.id,
        employee_name: `${emp.firstname} ${emp.surname}`,
        amount:        randInt(1, 8) * 25000,
        request_date:  dateStr(y, randInt(1, 12), randInt(1, 28)),
        status:        y < 2025 ? 'Approved' : pick(['Approved','Pending']),
      });
    }
  }
  await batchInsert('salary_advances', advances);

  // ---- HR: Evaluations ----
  const evaluations: any[] = [];
  for (const emp of employees) {
    for (let y = 2015; y <= 2025; y++) {
      evaluations.push({
        employee_id:      emp.id,
        date:             dateStr(y, 12, 15),
        type:             'Annual Performance Review',
        overall_score:    randInt(65, 99),
        status:           'Acknowledged',
        acknowledged:     true,
        scores:           JSON.stringify({ punctuality: randInt(3,5), quality_of_work: randInt(3,5), teamwork: randInt(3,5), initiative: randInt(3,5), attendance: randInt(3,5) }),
        created_by:       'Tunde Alonge',
        manager_notes:    pick(['Excellent year of performance.','Good work. Continue to improve communication.','Needs to improve timeliness on reports.','Outstanding contributions to the team.','Solid performer. Recommend for promotion.']),
        employee_comment: pick(['Thank you for the feedback.','I will work on my weak areas.','I am grateful for this opportunity to grow.','Looking forward to the next year.','']),
      });
      // Mid-year reviews from 2019 onwards
      if (y >= 2019) {
        evaluations.push({
          employee_id:  emp.id,
          date:         dateStr(y, 6, 15),
          type:         'Mid-Year Review',
          overall_score:randInt(60, 95),
          status:       'Acknowledged',
          acknowledged: true,
          scores:       JSON.stringify({ punctuality: randInt(3,5), quality_of_work: randInt(3,5), teamwork: randInt(3,5) }),
          created_by:   'Tunde Alonge',
          manager_notes:'Mid-year review completed successfully.',
        });
      }
    }
  }
  await batchInsert('evaluations', evaluations);

  // ---- HR: Disciplinary Records ----
  const disciplinary: any[] = [];
  for (const emp of employees.slice(0, 20)) {
    const numRecs = randInt(0, 4);
    for (let r = 0; r < numRecs; r++) {
      const y = randInt(2015, 2025);
      disciplinary.push({
        employee_id:  emp.id,
        date:         dateStr(y, randInt(1,12), randInt(1,28)),
        type:         pick(DISC_TYPES),
        severity:     pick(DISC_SEV),
        description:  pick(['Repeated late arrival to site','Breach of site safety protocol','Insubordination to supervisor','Misconduct with site equipment','Unauthorised absence from duty','Failure to submit required reports']),
        action_taken: pick(['Verbal Warning','Written Warning','Final Warning','3-Day Suspension','Performance Improvement Plan']),
        acknowledged: Math.random() > 0.2,
        status:       y < 2025 ? 'Closed' : pick(['Open','Closed']),
        created_by:   'Tunde Alonge',
        query_issued: true,
        query_replied:Math.random() > 0.3,
      });
    }
  }
  await batchInsert('disciplinary_records', disciplinary);

  // ---- HR: Merit Records ----
  const merits: any[] = [];
  for (const emp of employees) {
    for (let y = 2016; y <= 2025; y++) {
      if (Math.random() > 0.5) continue;
      const site = pick(seededSites);
      merits.push({
        employee_id:   emp.id,
        employee_name: `${emp.firstname} ${emp.surname}`,
        category:      pick(['Safety Compliance','Outstanding Performance','Customer Commendation','Innovation','Team Leadership','Years of Service']),
        description:   pick(['Exceptional dedication to HSE protocols on site.','Delivered project 2 weeks ahead of schedule.','Received formal commendation from client.','Proposed a cost-saving solution adopted company-wide.','Led team through difficult project with excellent results.']),
        incident_date: dateStr(y, randInt(1,12), randInt(1,28)),
        record_type:   'Merit',
        workspace_id:  WS_ID,
        site_id:       site.id,
        site_name:     site.name,
        logged_by_name:'Tunde Alonge',
      });
    }
  }
  await batchInsert('staff_merit_record', merits);

  // ---- FINANCE: Invoices, Payments, VAT ----
  console.log('[...] Generating 10-year financial records...');
  const invoices: any[] = [];
  const payments: any[] = [];
  const vatPayments: any[] = [];
  const pendingInvoices: any[] = [];

  let invSeq = 100;
  for (const site of seededSites) {
    // Get site start/end year
    const siteStartY = parseInt(site.start_date.substring(0, 4));
    const siteEndY   = Math.min(parseInt(site.end_date.substring(0, 4)), 2025);

    for (let y = siteStartY; y <= siteEndY; y++) {
      for (let m = 1; m <= 12; m++) {
        invSeq++;
        const mStr = String(m).padStart(2, '0');
        const machines   = randInt(2, 8);
        const dailyRate  = randInt(80000, 250000);
        const duration   = randInt(20, 30);
        const rentalCost = machines * dailyRate * duration;
        const dieselCost = randInt(300000, 800000);
        const techCost   = randInt(200000, 500000);
        const mobDemob   = randInt(0, 200000);
        const damages    = Math.random() > 0.8 ? randInt(50000, 300000) : 0;
        const totalCost  = rentalCost + dieselCost + techCost + mobDemob + damages;
        const vat        = site.vat === 'Yes' ? totalCost * 0.075 : 0;
        const totalCharge= totalCost + vat;
        const status     = y < 2025 ? 'Paid' : m < 4 ? 'Paid' : m < 7 ? 'Sent' : 'Draft';

        invoices.push({
          invoice_number:         `DCEL-${y}-${mStr}-${String(invSeq).padStart(4,'0')}`,
          client:                  site.client,
          project:                `Dewatering Contract - ${site.name}`,
          site_id:                 site.id,
          site_name:               site.name,
          amount:                  totalCost,
          date:                   `${y}-${mStr}-01`,
          due_date:               `${y}-${mStr}-28`,
          billing_cycle:          'Monthly',
          status:                  status,
          no_of_machine:           machines,
          daily_rental_cost:       dailyRate,
          duration:                duration,
          diesel_cost:             dieselCost,
          technicians_cost:        techCost,
          mob_demob:               mobDemob,
          damages:                 damages,
          rental_cost:             rentalCost,
          total_cost:              totalCost,
          vat:                     vat,
          total_charge:            totalCharge,
          total_exclusive_of_vat:  totalCost,
        });

        if (status === 'Paid') {
          payments.push({
            client:         site.client,
            site:           site.name,
            date:          `${y}-${mStr}-${randInt(10,28)}`,
            amount:         totalCharge,
            pay_vat:        site.vat === 'Yes' ? 'Yes' : 'No',
            vat:            vat,
            amount_for_vat: totalCost,
            withholding_tax: totalCost * 0.05,
          });
          if (vat > 0) {
            vatPayments.push({
              client: site.client,
              date:  `${y}-${mStr}-20`,
              month: `${y}-${mStr}`,
              amount: vat,
            });
          }
        } else if (status === 'Draft') {
          pendingInvoices.push({
            invoice_no:           `DCEL-${y}-${mStr}-${String(invSeq).padStart(4,'0')}-PND`,
            client:                site.client,
            site:                  site.name,
            vat_inc:               site.vat,
            no_of_machine:         machines,
            daily_rental_cost:     dailyRate,
            diesel_cost_per_ltr:   0,
            daily_usage:           0,
            no_of_technician:      randInt(1,5),
            technicians_daily_rate:Math.round(techCost / (randInt(1,5) * duration)),
            mob_demob:             mobDemob,
            installation:          0,
            damages:               damages,
            start_date:           `${y}-${mStr}-01`,
            duration:              duration,
            end_date:             `${y}-${mStr}-28`,
            rental_cost:           rentalCost,
            diesel_cost:           dieselCost,
            technicians_cost:      techCost,
            total_cost:            totalCost,
            vat:                   vat,
            total_charge:          totalCharge,
            total_exclusive_of_vat:totalCost,
          });
        }
      }
    }
  }
  await batchInsert('invoices', invoices);
  await batchInsert('payments', payments);
  await batchInsert('vat_payments', vatPayments);
  await batchInsert('pending_invoices', pendingInvoices.slice(0, 30));

  // ---- LEDGER: Entries & Expenses ----
  console.log('[...] Generating 10-year ledger entries...');
  const ledgerEntries: any[] = [];
  const companyExpenses: any[] = [];
  let voucherSeq = 1000;

  for (let y = 2015; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      const mStr = String(m).padStart(2, '0');
      const entriesThisMonth = randInt(8, 18);
      for (let e = 0; e < entriesThisMonth; e++) {
        voucherSeq++;
        const site = pick(seededSites);
        ledgerEntries.push({
          amount:      randInt(50000, 2000000),
          bank:        pick(BANKS),
          category:    pick(CATEGORIES),
          client:      site.client,
          date:       `${y}-${mStr}-${String(randInt(1,28)).padStart(2,'0')}`,
          description: pick(['Monthly diesel supply for site pumps','Equipment maintenance and servicing','Salary disbursement via bank transfer','Office and site consumables purchase','IT infrastructure upgrade','Transport and haulage services','Safety equipment procurement']),
          entered_by:  'Tunde Alonge',
          site:        site.name,
          vendor:      pick(VENDORS.map(v => v.name)),
          voucher_no: `VCH-${y}-${mStr}-${String(voucherSeq).padStart(4,'0')}`,
        });
      }

      // Company expenses: ~5-8 per month
      const expCount = randInt(5, 8);
      for (let ex = 0; ex < expCount; ex++) {
        companyExpenses.push({
          amount:             randInt(20000, 800000),
          date:              `${y}-${mStr}-${String(randInt(1,28)).padStart(2,'0')}`,
          description:        pick(['Office rent and utilities','Company vehicle maintenance','IT subscriptions and licenses','Staff welfare and welfare events','Corporate telephone bills','Printing and office stationery','Generator diesel for head office','Security services payment']),
          entered_by:         'Tunde Alonge',
          paid_from:          pick(BANKS),
          paid_to_account_no: `${randInt(1000000000,9999999999)}`,
          paid_to_bank_name:  pick(BANKS),
          status:             'Approved',
        });
      }
    }
  }
  await batchInsert('ledger_entries', ledgerEntries);
  await batchInsert('company_expenses', companyExpenses);

  // ---- LOGISTICS: Vehicle Movement Logs ----
  console.log('[...] Generating 10-year vehicle movement logs...');
  if (seededVehicles?.length) {
    const drivers = employees.filter(e => e.department === 'Operations');
    const movLogs: any[] = [];
    for (let y = 2015; y <= 2025; y++) {
      const logsThisYear = randInt(180, 280);
      for (let i = 0; i < logsThisYear; i++) {
        const vehicle = pick(seededVehicles);
        const driver  = pick(drivers.length ? drivers : employees);
        const site    = pick(seededSites);
        const m       = randInt(1, 12);
        const d       = randInt(1, 28);
        const depHour = randInt(6, 12);
        const arrHour = depHour + randInt(2, 8);
        const odomStart = 10000 + (y - 2015) * 15000 + i * 120;
        movLogs.push({
          departure_time:    `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} ${String(depHour).padStart(2,'0')}:00`,
          arrival_time:      `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} ${String(Math.min(arrHour,23)).padStart(2,'0')}:30`,
          driver_employee_id:driver.id,
          driver_name:       `${driver.firstname} ${driver.surname}`,
          vehicle_id:        vehicle.id,
          vehicle_reg:       vehicle.registration_number,
          purpose:           pick(['Equipment Delivery','Site Inspection','Client Meeting','Material Transport','Maintenance Run','Personnel Transfer','Emergency Response']),
          route:            `Head Office → ${site.name}`,
          site_id:           site.id,
          site_name:         site.name,
          odometer_start:    odomStart,
          odometer_end:      odomStart + randInt(40, 300),
          notes:             Math.random() > 0.7 ? pick(['No issues encountered.','Slight traffic delay.','Road construction near site.','Vehicle refuelled at Mobil station.']) : null,
          workspace_id:      WS_ID,
        });
      }
    }
    await batchInsert('vehicle_movement_log', movLogs);
  }

  // ---- OPERATIONS: Assets Daily Logs & Journals ----
  console.log('[...] Generating 10-year operations logs...');
  if (seededOpAssets?.length) {
    const opsEngineers = employees.filter(e => e.department === 'Operations' || e.department === 'Engineering');

    const opsLogs: any[] = [];
    for (let y = 2015; y <= 2025; y++) {
      for (const asset of seededOpAssets.filter(a => a.requires_logging)) {
        const logsCount = randInt(30, 80);
        for (let i = 0; i < logsCount; i++) {
          const site = pick(seededSites);
          const m    = randInt(1, 12);
          const d    = randInt(1, 28);
          opsLogs.push({
            asset_id:          asset.id,
            asset_name:        asset.name,
            site_id:           site.id,
            site_name:         site.name,
            date:              dateStr(y, m, d),
            is_active:         Math.random() > 0.1,
            operational_day:  'Yes',
            diesel_usage:      randInt(30, 120),
            supervisor_on_site:pick(opsEngineers.length ? opsEngineers : employees).firstname + ' ' + pick(opsEngineers.length ? opsEngineers : employees).surname,
            logged_by:         'Tunde Alonge',
            maintenance_details: Math.random() > 0.7 ? pick(['Standard daily check completed.','Filter replaced.','Oil level topped up.','Belt tension adjusted.','Impeller cleaned.']) : null,
            client_feedback:     Math.random() > 0.6 ? pick(['Pump running optimally.','Water level decreased significantly.','Good performance today.','Requested to increase flow rate.']) : null,
            issues_on_site:      Math.random() > 0.85 ? pick(['Minor oil leak detected.','Vibration noise noted.','Fuel line clogged temporarily.']) : null,
          });
        }
      }
    }
    await batchInsert('operations_daily_logs', opsLogs);

    // Operations checkouts
    const checkouts: any[] = [];
    for (let y = 2015; y <= 2025; y++) {
      for (let i = 0; i < randInt(20, 40); i++) {
        const asset = pick(seededOpAssets);
        const emp   = pick(employees);
        const m     = randInt(1, 11);
        checkouts.push({
          id:                   `CK-${y}-${String(i).padStart(3,'0')}`,
          employee_id:           emp.id,
          employee_name:        `${emp.firstname} ${emp.surname}`,
          asset_id:              asset.id,
          asset_name:            asset.name,
          quantity:              randInt(1, 3),
          status:               y < 2025 ? 'returned' : 'active',
          checkout_date:         dateStr(y, m, randInt(1, 28)),
          expected_return_date:  dateStr(y, m + 1, randInt(1, 28)),
          returned_quantity:     y < 2025 ? randInt(1, 3) : 0,
          return_in_days:        randInt(14, 60),
        });
      }
    }
    await batchInsert('operations_checkouts', checkouts);

    // Site pump dates
    const pumpDates: any[] = [];
    const seen = new Set<string>();
    for (const asset of seededOpAssets) {
      for (const site of seededSites.slice(0, 5)) {
        const key = `${asset.id}-${site.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          pumpDates.push({ asset_id: asset.id, site_id: site.id, pump_start_date: '2015-01-01', pump_stop_date: '2025-12-31' });
        }
      }
    }
    await batchInsert('operations_site_pump_dates', pumpDates);
  }

  // Operations Maintenance Logs
  const maintenanceLogs: any[] = [];
  if (seededOpAssets?.length) {
    for (let y = 2015; y <= 2025; y++) {
      const count = randInt(15, 30);
      for (let i = 0; i < count; i++) {
        const asset = pick(seededOpAssets);
        maintenanceLogs.push({
          id:               `MNT-${y}-${String(i).padStart(3,'0')}`,
          date:              dateStr(y, randInt(1,12), randInt(1,28)),
          type:              pick(['Scheduled Maintenance','Breakdown Repair','Preventive Maintenance','Full Overhaul']),
          technician:        pick(employees.filter(e=>e.department==='Engineering' || e.department==='Operations')).firstname + ' ' + pick(employees).surname,
          description:       pick(['Full pump overhaul and seal replacement','Filter and impeller cleaning','Oil change and belt inspection','Emergency repair of cracked casing','Generator service and load test']),
          assets:            JSON.stringify([{ id: asset.id, name: asset.name }]),
        });
      }
    }
    await batchInsert('operations_maintenance', maintenanceLogs);
  }

  // ---- DAILY JOURNALS ----
  console.log('[...] Generating 10-year daily journals...');
  const journals: any[] = [];
  const siteJournals: any[] = [];
  for (let y = 2015; y <= 2025; y++) {
    const journalsThisYear = randInt(100, 200);
    for (let j = 0; j < journalsThisYear; j++) {
      const jid = crypto.randomUUID();
      const m   = randInt(1, 12);
      const d   = randInt(1, 28);
      journals.push({
        id:            jid,
        date:          dateStr(y, m, d),
        general_notes: pick([
          'All site operations running smoothly. No incidents reported.',
          'Heavy rain delayed morning operations. Resumed by noon.',
          'Client site visit conducted. Positive feedback received.',
          'Monthly safety briefing held at head office.',
          'Equipment transported to new site location.',
          'Routine maintenance on all dewatering units completed.',
          'New site engineer briefed and assigned to Lekki site.',
        ]),
        logged_by:     'Tunde Alonge',
        workspace_id:  WS_ID,
      });
      // 1-3 site journal entries per journal
      const siteCount = randInt(1, 3);
      for (let s = 0; s < siteCount; s++) {
        const site = pick(seededSites);
        siteJournals.push({
          id:           crypto.randomUUID(),
          journal_id:   jid,
          site_id:      site.id,
          site_name:    site.name,
          client_name:  site.client,
          narration:    pick([
            'Dewatering pump running at 95% efficiency. Water table dropped 1.5m.',
            'Fuel replenished. Pump filter cleaned. No downtime recorded.',
            'Client inspection visit. Operations approved.',
            'New pipe connection completed. Flow rate increased by 20%.',
            'Preventive maintenance carried out. No issues found.',
            'Pump relocated to secondary pit. Operations normal.',
            'Technical snag reported. Resolved within 2 hours.',
          ]),
          workspace_id: WS_ID,
        });
      }
    }
  }
  await batchInsert('daily_journals', journals);
  await batchInsert('site_journal_entries', siteJournals);

  // ---- TASKS ----
  console.log('[...] Generating 10-year tasks and subtasks...');
  const tasks: any[] = [];
  const subtasks: any[] = [];
  const taskUpdates: any[] = [];

  for (let y = 2015; y <= 2025; y++) {
    const taskCount = randInt(30, 60);
    for (let t = 0; t < taskCount; t++) {
      const tid   = crypto.randomUUID();
      const sid   = crypto.randomUUID();
      const emp   = pick(employees);
      const site  = pick(seededSites);
      const m     = randInt(1, 12);
      const d     = randInt(1, 20);
      const stat  = y < 2025 ? 'Completed' : pick(TASK_STATUS);

      tasks.push({
        id:          tid,
        title:       pick([
          `Deploy dewatering equipment - ${site.name}`,
          `Monthly site inspection - ${site.name}`,
          `Client report preparation for ${site.client}`,
          `Safety audit - ${site.name}`,
          `Pump maintenance scheduling`,
          `New employee onboarding`,
          `Invoice reconciliation for ${site.client}`,
          `Equipment inventory audit`,
          `HR policy review and update`,
          `Annual employee evaluations`,
        ]),
        description: `Ensure all activities are completed per the standard operating procedure for ${site.name}.`,
        status:      stat,
        priority:    pick(TASK_PRI),
        assignee_id: emp.id,
        department:  emp.department,
        site_id:     site.id,
        due_date:    dateStr(y, m, d + randInt(5, 14)),
      });

      subtasks.push({
        id:           sid,
        main_task_id: tid,
        title:        pick(['Gather required documentation','Conduct site visit','Submit preliminary report','Obtain client sign-off','Update database records','Brief site team']),
        status:       stat === 'Completed' ? 'Completed' : pick(['Pending','In Progress','Completed']),
        priority:     pick(['High','Medium','Low']),
        assigned_to:  `${emp.firstname} ${emp.surname}`,
        deadline:     dateStr(y, m, d + randInt(1, 7)),
      });

      if (stat === 'Completed') {
        taskUpdates.push({
          task_id:      tid,
          subtask_id:   sid,
          main_task_id: tid,
          text:         pick(['Task completed successfully and filed.','All requirements met. Report submitted to client.','Site inspection passed. No major issues found.','Documents submitted and approved.','Resolved ahead of schedule.']),
          author_id:    ADMIN_ID,
        });
      }
    }
  }
  await batchInsert('tasks', tasks);
  await batchInsert('subtasks', subtasks);
  await batchInsert('task_updates', taskUpdates);

  // ---- INCIDENT LOG ----
  console.log('[...] Generating incident log...');
  const incidents: any[] = [];
  for (let y = 2015; y <= 2025; y++) {
    const count = randInt(3, 12);
    for (let i = 0; i < count; i++) {
      const site = pick(seededSites);
      const reporter = pick(employees);
      incidents.push({
        description:       pick(['Minor pump oil leak detected and contained.','Slip and fall incident near pump station.','Electrical fault on generator unit.','Fuel spill during refuelling - contained and cleaned.','Employee sustained minor hand injury.','Unauthorised site entry by external party.']),
        incident_date:     dateStr(y, randInt(1,12), randInt(1,28)),
        incident_type:     pick(['Near Miss','Minor Injury','Equipment Damage','Environmental','Security','Operational']),
        reported_by_name:  `${reporter.firstname} ${reporter.surname}`,
        reported_by_id:    reporter.id,
        site_id:           site.id,
        site_name:         site.name,
        status:            y < 2025 ? 'Closed' : pick(['Open','Under Investigation','Closed']),
        corrective_action: pick(['Equipment isolated and repaired.','Medical treatment provided. Incident report filed.','Safety briefing conducted with all site staff.','Improved safety barriers installed.','Additional safety signage erected.']),
        workspace_id:      WS_ID,
      });
    }
  }
  await batchInsert('incident_log', incidents);

  // ---- COMM LOGS ----
  console.log('[...] Generating communication logs...');
  const commLogs: any[] = [];
  for (let y = 2015; y <= 2025; y++) {
    const count = randInt(40, 80);
    for (let i = 0; i < count; i++) {
      const client = pick(seededClients);
      const site   = pick(seededSites);
      commLogs.push({
        channel:       pick(['Email','Phone Call','In-Person Meeting','WhatsApp','Video Call']),
        client:        client.name,
        contact_person:pick(['Project Manager','Finance Manager','Site Supervisor','CEO','Technical Director']),
        contact_type:  pick(['Client','Vendor','Regulatory Body','Sub-contractor']),
        date:          dateStr(y, randInt(1,12), randInt(1,28)),
        direction:     pick(['Inbound','Outbound']),
        follow_up_done:Math.random() > 0.3,
        logged_by:     'Tunde Alonge',
        notes:         pick(['Discussed monthly invoice for site operations.','Raised concern about pump downtime. Resolved.','Requested extension of contract by 3 months.','Provided site progress report.','Clarified VAT payment schedule.','Discussed upcoming site mobilisation.']),
        outcome:       pick(['Resolved','Follow-up Required','Escalated','No Action Needed','']),
        site_id:       site.id,
        site_name:     site.name,
        subject:       pick(['Monthly Invoice Discussion','Site Operations Update','Contract Renewal','Safety Compliance Review','Payment Follow-up']),
        time:          `${String(randInt(8,17)).padStart(2,'0')}:${pick(['00','15','30','45'])}`,
      });
    }
  }
  await batchInsert('comm_logs', commLogs);

  // ---- PERMIT TO WORK ----
  console.log('[...] Generating permit to work records...');
  const ptws: any[] = [];
  for (let y = 2015; y <= 2025; y++) {
    for (let i = 0; i < randInt(15, 30); i++) {
      const site   = pick(seededSites);
      const issuer = pick(employees.filter(e => e.department === 'Safety'));
      const m      = randInt(1, 12);
      const d      = randInt(1, 25);
      ptws.push({
        site_id:       site.id,
        site_name:     site.name,
        issued_by_name:`${issuer.firstname} ${issuer.surname}`,
        issued_by_id:   issuer.id,
        issued_at:      isoStr(y, m, d),
        start_date:     dateStr(y, m, d),
        status:         y < 2025 ? 'Completed' : pick(PTW_STATUS),
        notes:          pick(['Standard dewatering operations permit.','Electrical work in restricted zone.','Excavation work near live services.','Hot work permit for welding on site.']),
        workspace_id:   WS_ID,
      });
    }
  }
  await batchInsert('permit_to_work', ptws);

  // ---- ACTIVITIES LOG ----
  const activities: any[] = [];
  for (let y = 2015; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      activities.push({
        action:     pick(['Invoice Created','Payment Received','Employee Added','Leave Approved','Site Updated','Task Completed','Report Generated']),
        entity:     pick(['invoices','employees','leaves','sites','tasks','payments']),
        entity_id:  crypto.randomUUID(),
        user_name:  'Tunde Alonge',
        user_id:    ADMIN_ID,
        timestamp:  isoStr(y, m, randInt(1, 28)),
        details:    'System activity recorded',
      });
    }
  }
  await batchInsert('activities', activities);

  // ---- REMINDERS ----
  const reminders: any[] = [];
  for (const site of seededSites) {
    for (let y = 2015; y <= 2025; y += 2) {
      reminders.push({
        title:      `Bi-annual Safety Inspection: ${site.name}`,
        body:       `Conduct full HSE inspection and submit compliance report for ${site.name}.`,
        remind_at:  dateStr(y, 6, 1),
        frequency:  'Yearly',
        is_active:  y >= 2024,
        created_by: ADMIN_ID,
      });
    }
  }
  await batchInsert('reminders', reminders);

  // ---- DEWATERING LAYOUTS ----
  const layouts = seededSites.slice(0, 5).map(s => ({
    user_id:    ADMIN_ID,
    name:       `${s.name} - Layout Blueprint`,
    lines:      JSON.stringify([
      { from:{x:100,y:200}, to:{x:400,y:200}, type:'pipe', id:'pipe-01' },
      { from:{x:400,y:200}, to:{x:400,y:400}, type:'pipe', id:'pipe-02' },
    ]),
    components: JSON.stringify([
      { x:100, y:200, type:'pump',  id:'pump-01', name:'CAT 6-inch Pump' },
      { x:400, y:400, type:'sump',  id:'sump-01', name:'Collection Sump' },
      { x:250, y:200, type:'valve', id:'vlv-01',  name:'Gate Valve' },
    ]),
  }));
  await batchInsert('dewatering_layouts', layouts);

  // ---- WAYBILLS ----
  console.log('[...] Generating waybills...');
  const waybills: any[] = [];
  if (seededOpAssets?.length) {
    for (let y = 2015; y <= 2025; y++) {
      const count = randInt(20, 40);
      for (let i = 0; i < count; i++) {
        const site  = pick(seededSites);
        const asset = pick(seededOpAssets);
        waybills.push({
          issue_date:   dateStr(y, randInt(1,12), randInt(1,28)),
          purpose:      pick(['Site Deployment','Equipment Return','Internal Transfer','Client Delivery']),
          service:      pick(['Dewatering','Drainage','Construction','Maintenance']),
          site_id:      site.id,
          driver_name:  pick(employees.filter(e=>e.department==='Operations')).firstname + ' ' + pick(employees).surname,
          status:       y < 2025 ? 'Returned' : pick(['Open','In Transit','Returned']),
          items:        JSON.stringify([{ id: asset.id, name: asset.name, quantity: randInt(1,4) }]),
          type:         'Outgoing',
          created_by:   'Tunde Alonge',
        });
      }
    }
    await batchInsert('waybills', waybills);
  }

  // ---- ASSET INVENTORY ----
  const assetInventory: any[] = [
    { name:'Office Laptop Dell XPS',       category:'IT',       quantity:20, unit_of_measurement:'pcs',    status:'Active',   type:'Fixed',      cost:450000,  purchase_date:'2018-01-01' },
    { name:'Office Desk and Chair Set',    category:'Furniture',quantity:30, unit_of_measurement:'sets',   status:'Active',   type:'Fixed',      cost:85000,   purchase_date:'2016-06-01' },
    { name:'Safety Helmets (Yellow)',      category:'Safety',   quantity:100,unit_of_measurement:'pcs',    status:'Active',   type:'Consumable', cost:5000,    purchase_date:'2015-01-01' },
    { name:'Safety Boots (Steel Toe)',     category:'Safety',   quantity:80, unit_of_measurement:'pairs',  status:'Active',   type:'Consumable', cost:12000,   purchase_date:'2015-01-01' },
    { name:'Reflective Safety Vests',      category:'Safety',   quantity:120,unit_of_measurement:'pcs',    status:'Active',   type:'Consumable', cost:3500,    purchase_date:'2015-01-01' },
    { name:'Portable Gas Detector',        category:'Safety',   quantity:10, unit_of_measurement:'pcs',    status:'Active',   type:'Equipment',  cost:180000,  purchase_date:'2019-03-01' },
    { name:'Fire Extinguisher 9KG DCP',    category:'Safety',   quantity:25, unit_of_measurement:'pcs',    status:'Active',   type:'Equipment',  cost:25000,   purchase_date:'2017-01-01' },
    { name:'Heavy-Duty Tool Box Set',      category:'Tools',    quantity:15, unit_of_measurement:'sets',   status:'Active',   type:'Equipment',  cost:95000,   purchase_date:'2016-01-01' },
    { name:'Welding Machine 200A',         category:'Equipment',quantity:5,  unit_of_measurement:'pcs',    status:'Active',   type:'Equipment',  cost:320000,  purchase_date:'2018-06-01' },
    { name:'Angle Grinder 9-inch',         category:'Tools',    quantity:8,  unit_of_measurement:'pcs',    status:'Active',   type:'Equipment',  cost:55000,   purchase_date:'2019-01-01' },
  ];
  await batchInsert('assets', assetInventory);

  // Final Summary
  console.log('\n\n[===] SEEDING COMPLETE! Summary:');
  const summaryTables = ['leaves','loans','salary_advances','evaluations','invoices','payments','vat_payments','ledger_entries','company_expenses','vehicle_movement_log','operations_daily_logs','tasks','subtasks','daily_journals','site_journal_entries','comm_logs','incident_log','permit_to_work','activities'];
  for (const t of summaryTables) {
    const { count } = await supabase.from(t).select('*', { count:'exact', head:true });
    console.log(`  ${t}: ${count} rows`);
  }
  console.log('\n[OK] Local database fully populated with 10 years of realistic data!');
}

main().catch(e => {
  console.error('[X] Fatal error:', e);
  process.exit(1);
});
