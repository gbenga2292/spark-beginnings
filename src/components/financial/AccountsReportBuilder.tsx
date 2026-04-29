import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Upload, Printer, Trash2, Save, X, Info } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import logoSrc from '../../../logo/logo-2.png';
import { usePayrollCalculator } from '@/src/hooks/usePayrollCalculator';

// ── Constants ─────────────────────────────────────────────────────────────────
const YEAR_RANGE_START = 2020;
const currentYear = new Date().getFullYear();


type DataSource = 'INVOICE' | 'PAYMENT' | 'VAT' | 'PAYROLL' | 'LEDGER' | 'SITE';

const SOURCE_LABELS: Record<DataSource, string> = {
  INVOICE: 'Invoices',
  PAYMENT: 'Payments',
  VAT:     'VAT Remittances',
  PAYROLL: 'Payroll',
  LEDGER:  'Ledger',
  SITE:    'Sites',
};
const SOURCE_PILL: Record<DataSource, string> = {
  INVOICE: 'bg-blue-100 text-blue-700 border-blue-200',
  PAYMENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  VAT:     'bg-amber-100  text-amber-700  border-amber-200',
  PAYROLL: 'bg-purple-100 text-purple-700 border-purple-200',
  LEDGER:  'bg-slate-100  text-slate-700  border-slate-200',
  SITE:    'bg-indigo-100 text-indigo-700 border-indigo-200',
};
const SOURCE_TOGGLE_ON: Record<DataSource, string> = {
  INVOICE: 'bg-blue-50   border-blue-300  text-blue-800',
  PAYMENT: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  VAT:     'bg-amber-50   border-amber-300  text-amber-800',
  PAYROLL: 'bg-purple-50 border-purple-300 text-purple-800',
  LEDGER:  'bg-slate-50  border-slate-300  text-slate-800',
  SITE:    'bg-indigo-50 border-indigo-300 text-indigo-800',
};
const ROW_TINT: Record<DataSource, string> = {
  INVOICE: '',
  PAYMENT: 'bg-emerald-50/40',
  VAT:     'bg-amber-50/40',
  PAYROLL: 'bg-purple-50/40',
  LEDGER:  'bg-slate-50/40',
  SITE:    'bg-indigo-50/40',
};

// VAT month name → sidebar key
const MONTH_NAME_TO_KEY: Record<string, string> = {
  jan: 'jan', january: 'jan', feb: 'feb', february: 'feb',
  mar: 'mar', march: 'mar', apr: 'apr', april: 'apr', may: 'may',
  jun: 'jun', june: 'jun', jul: 'jul', july: 'jul',
  aug: 'aug', august: 'aug', sep: 'sep', september: 'sep',
  oct: 'oct', october: 'oct', nov: 'nov', november: 'nov',
  dec: 'dec', december: 'dec',
};
const monthNameToKey = (name: string): string | null =>
  MONTH_NAME_TO_KEY[(name ?? '').toLowerCase().trim()] ?? null;

const MONTHS = [
  { key: 'jan', label: 'Jan' }, { key: 'feb', label: 'Feb' }, { key: 'mar', label: 'Mar' },
  { key: 'apr', label: 'Apr' }, { key: 'may', label: 'May' }, { key: 'jun', label: 'Jun' },
  { key: 'jul', label: 'Jul' }, { key: 'aug', label: 'Aug' }, { key: 'sep', label: 'Sep' },
  { key: 'oct', label: 'Oct' }, { key: 'nov', label: 'Nov' }, { key: 'dec', label: 'Dec' },
];

// ── Column types ──────────────────────────────────────────────────────────────
interface ColumnDef {
  id: string;
  label: string;
  summable: boolean;
  /** Which sources must be active for this column to appear */
  sources: DataSource[];
}

/**
 * Flat transaction columns — single-source mode.
 * Each column knows which source(s) it belongs to.
 */
const TXN_COLUMNS: ColumnDef[] = [
  { id: 'sn',           label: 'S/N',                summable: false, sources: ['INVOICE','PAYMENT','VAT'] },
  { id: 'client',       label: 'Client Name',        summable: false, sources: ['INVOICE','PAYMENT','VAT'] },
  { id: 'tin',          label: 'Client TIN',         summable: false, sources: ['INVOICE','PAYMENT','VAT'] },
  { id: 'site',         label: 'Site',               summable: false, sources: ['INVOICE','PAYMENT'] },
  { id: 'date',         label: 'Date',               summable: false, sources: ['INVOICE','PAYMENT'] },
  // Invoice
  { id: 'project',      label: 'Project',            summable: false, sources: ['INVOICE'] },
  { id: 'dueDate',      label: 'Due Date',           summable: false, sources: ['INVOICE'] },
  { id: 'invoiceNo',    label: 'Invoice Number',     summable: false, sources: ['INVOICE'] },
  { id: 'billingCycle', label: 'Billing Cycle',      summable: false, sources: ['INVOICE'] },
  { id: 'duration',     label: 'Duration (Days)',    summable: true,  sources: ['INVOICE'] },
  { id: 'machines',     label: 'No. of Machines',   summable: true,  sources: ['INVOICE'] },
  { id: 'rentalCost',   label: 'Daily Rental Cost', summable: true,  sources: ['INVOICE'] },
  { id: 'dieselPerLtr', label: 'Diesel Cost/Ltr',   summable: false, sources: ['INVOICE'] },
  { id: 'dailyUsage',   label: 'Daily Usage',        summable: true,  sources: ['INVOICE'] },
  { id: 'technicians',  label: 'No. of Techs',      summable: true,  sources: ['INVOICE'] },
  { id: 'techDailyRate',label: 'Tech Daily Rate',   summable: true,  sources: ['INVOICE'] },
  { id: 'mobDemob',     label: 'Mob/Demob Cost',    summable: true,  sources: ['INVOICE'] },
  { id: 'installation', label: 'Installation Cost', summable: true,  sources: ['INVOICE'] },
  { id: 'damages',      label: 'Damages Cost',      summable: true,  sources: ['INVOICE'] },
  { id: 'invAmount',    label: 'Invoice Amount',    summable: true,  sources: ['INVOICE'] },
  { id: 'vatInc',       label: 'VAT Status',        summable: false, sources: ['INVOICE'] },
  { id: 'invVat',       label: 'VAT Amount (Inv)',  summable: true,  sources: ['INVOICE'] },
  { id: 'totalCharge',  label: 'Total Charge',      summable: true,  sources: ['INVOICE'] },
  { id: 'status',       label: 'Invoice Status',    summable: false, sources: ['INVOICE'] },
  // Payment
  { id: 'payAmount',    label: 'Amount Paid (Cash)',summable: true,  sources: ['PAYMENT'] },
  { id: 'amountForVAT', label: 'Amount For VAT',   summable: true,  sources: ['PAYMENT'] },
  { id: 'payVat',       label: 'VAT Amount (Pay)', summable: true,  sources: ['PAYMENT'] },
  { id: 'wht',          label: 'Withholding Tax',  summable: true,  sources: ['PAYMENT'] },
  { id: 'discount',     label: 'Discount',          summable: true,  sources: ['PAYMENT'] },
  { id: 'totalCleared', label: 'Total Value Cleared',summable: true, sources: ['PAYMENT'] },
  // VAT — matches the screenshot columns exactly
  { id: 'vatDate',      label: 'Date',             summable: false, sources: ['VAT'] },
  { id: 'remMonth',     label: 'Month',             summable: false, sources: ['VAT'] },
  { id: 'remYear',      label: 'Year',              summable: false, sources: ['VAT'] },
  { id: 'vatAmtPaid',   label: 'Amount Paid',      summable: true,  sources: ['VAT'] },
  { id: 'vatableAmt',   label: 'VATable Amount',   summable: true,  sources: ['VAT'] },
  { id: 'vatOwed',      label: 'VAT Owed',         summable: true,  sources: ['VAT'] },
  { id: 'vatPaid',      label: 'VAT Paid',         summable: true,  sources: ['VAT'] },
  { id: 'vatBalDue',    label: 'Bal Due',          summable: true,  sources: ['VAT'] },
  // Payroll
  { id: 'p_employee',   label: 'Employee Name',    summable: false, sources: ['PAYROLL'] },
  { id: 'p_department', label: 'Department',       summable: false, sources: ['PAYROLL'] },
  { id: 'p_position',   label: 'Position',         summable: false, sources: ['PAYROLL'] },
  { id: 'p_staffType',  label: 'Staff Type',       summable: false, sources: ['PAYROLL'] },
  { id: 'p_basic',      label: 'Gross Pay',        summable: true,  sources: ['PAYROLL'] },
  { id: 'p_pension',    label: 'Pension',          summable: true,  sources: ['PAYROLL'] },
  { id: 'p_paye',       label: 'PAYE Tax',         summable: true,  sources: ['PAYROLL'] },
  { id: 'p_nsitf',      label: 'NSITF',            summable: true,  sources: ['PAYROLL'] },
  { id: 'p_net',        label: 'Net Pay',          summable: true,  sources: ['PAYROLL'] },
  { id: 'p_month',      label: 'Month',            summable: false, sources: ['PAYROLL'] },
  { id: 'p_year',       label: 'Year',             summable: false, sources: ['PAYROLL'] },
  // Ledger
  { id: 'l_date',       label: 'Date',             summable: false, sources: ['LEDGER'] },
  { id: 'l_voucher',    label: 'Voucher No.',      summable: false, sources: ['LEDGER'] },
  { id: 'l_category',   label: 'Category',         summable: false, sources: ['LEDGER'] },
  { id: 'l_desc',       label: 'Description',      summable: false, sources: ['LEDGER'] },
  { id: 'l_amount',     label: 'Amount',           summable: true,  sources: ['LEDGER'] },
  { id: 'l_vendor',     label: 'Vendor',           summable: false, sources: ['LEDGER'] },
  { id: 'l_bank',       label: 'Bank',             summable: false, sources: ['LEDGER'] },
  { id: 'l_client',     label: 'Ledger Client',    summable: false, sources: ['LEDGER'] },
  { id: 'l_site',       label: 'Ledger Site',      summable: false, sources: ['LEDGER'] },
  { id: 'l_enteredBy',  label: 'Entered By',       summable: false, sources: ['LEDGER'] },
  // Site
  { id: 't_name',       label: 'Site Name',        summable: false, sources: ['SITE'] },
  { id: 't_client',     label: 'Site Client',      summable: false, sources: ['SITE'] },
  { id: 't_status',     label: 'Status',           summable: false, sources: ['SITE'] },
  { id: 't_vat',        label: 'VAT Setting',      summable: false, sources: ['SITE'] },
  { id: 't_start',      label: 'Start Date',       summable: false, sources: ['SITE'] },
  { id: 't_end',        label: 'End Date',         summable: false, sources: ['SITE'] },
];

/**
 * Aggregated summary columns — multi-source mode.
 * Mix of period-scoped and all-time values to give accurate balance.
 */
const SUM_COLUMNS: ColumnDef[] = [
  { id: 's_sn',            label: 'S/N',                      summable: false, sources: ['INVOICE','PAYMENT','VAT','PAYROLL','LEDGER','SITE'] },
  { id: 's_client',        label: 'Client Name',              summable: false, sources: ['INVOICE','PAYMENT','VAT','PAYROLL','LEDGER','SITE'] },
  { id: 's_tin',           label: 'Client TIN',               summable: false, sources: ['INVOICE','PAYMENT','VAT','PAYROLL','LEDGER','SITE'] },
  // ── Invoice ──
  { id: 's_inv_count',     label: 'Invoice Count (Period)',   summable: true,  sources: ['INVOICE'] },
  { id: 's_periodcharged', label: 'Period Invoiced',          summable: true,  sources: ['INVOICE'] },
  { id: 's_inv_vat',       label: 'Invoice VAT (Period)',     summable: true,  sources: ['INVOICE'] },
  { id: 's_allcharged',    label: 'Total Invoiced (All-Time)',summable: true,  sources: ['INVOICE'] },
  // ── Payment ──
  { id: 's_pay_count',     label: 'Payment Count (Period)',   summable: true,  sources: ['PAYMENT'] },
  { id: 's_periodcleared', label: 'Period Cleared',           summable: true,  sources: ['PAYMENT'] },
  { id: 's_total_cash',    label: 'Total Paid Cash (Period)', summable: true,  sources: ['PAYMENT'] },
  { id: 's_pay_wht',       label: 'WHT Total (Period)',       summable: true,  sources: ['PAYMENT'] },
  { id: 's_pay_disct',     label: 'Discount (Period)',        summable: true,  sources: ['PAYMENT'] },
  { id: 's_allcleared',    label: 'Total Cleared (All-Time)', summable: true,  sources: ['PAYMENT'] },
  // ── VAT ──
  { id: 's_vat_count',     label: 'VAT Records',              summable: true,  sources: ['VAT'] },
  { id: 's_vat_remitted',  label: 'Total VAT Remitted',       summable: true,  sources: ['VAT'] },
  // ── Ledger ──
  { id: 's_ledger_total',  label: 'Ledger Expenses',          summable: true,  sources: ['LEDGER'] },
  // ── Site ──
  { id: 's_site_count',    label: 'Site Count',               summable: true,  sources: ['SITE'] },
  // ── Cross-source: accurate balance (all-time) ──────────────────────────────
  // Requires BOTH invoice and payment sources
  { id: 's_bfwd',          label: 'Balance B/F (Prev. Years)',summable: true,  sources: ['INVOICE','PAYMENT'] },
  { id: 's_balance',       label: 'Balance Due (All-Time)',   summable: true,  sources: ['INVOICE','PAYMENT'] },
];

// ── Built-in presets ──────────────────────────────────────────────────────────
interface ReportPreset {
  id: string;
  name: string;
  sources: DataSource[];
  columns: string[];
  builtIn?: boolean;
}

const BUILT_IN_PRESETS: ReportPreset[] = [
  {
    id: '__inv',  name: 'Invoice Report', builtIn: true,
    sources: ['INVOICE'],
    columns: ['sn','client','site','date','invoiceNo','invAmount','vatInc','invVat','totalCharge','status'],
  },
  {
    id: '__pay', name: 'Payment Report', builtIn: true,
    sources: ['PAYMENT'],
    columns: ['sn','client','site','date','payAmount','amountForVAT','payVat','wht','discount','totalCleared'],
  },
  {
    id: '__vat', name: 'VAT Report', builtIn: true,
    sources: ['VAT'],
    columns: ['sn','client','vatDate','remMonth','remYear','vatAmtPaid','vatableAmt','vatOwed','vatPaid','vatBalDue'],
  },
  {
    id: '__payroll', name: 'Payroll Report', builtIn: true,
    sources: ['PAYROLL'],
    columns: ['sn','p_employee','p_department','p_position','p_staffType','p_basic','p_pension','p_paye','p_nsitf','p_net','p_month','p_year'],
  },
  {
    id: '__led', name: 'Ledger Report', builtIn: true,
    sources: ['LEDGER'],
    columns: ['sn','l_date','l_voucher','l_category','l_desc','l_client','l_site','l_amount','l_vendor','l_bank','l_enteredBy'],
  },
  {
    id: '__site', name: 'Site Directory', builtIn: true,
    sources: ['SITE'],
    columns: ['sn','t_name','t_client','t_status','t_vat','t_start','t_end'],
  },
  {
    // Outstanding — uses all-time balance for accuracy
    id: '__outstanding', name: 'Outstanding Balance', builtIn: true,
    sources: ['INVOICE','PAYMENT'],
    columns: ['s_sn','s_client','s_bfwd','s_periodcharged','s_periodcleared','s_allcharged','s_allcleared','s_balance'],
  },
];

const fm = (v: number | null | undefined) => {
  if (typeof v !== 'number' || v === 0) return '-';
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Stable set — defined outside component so it is never recreated on render
const NON_NUMERIC_COLS = new Set([
  'sn','client','site','tin','date','vatDate','dueDate','invoiceNo','billingCycle',
  'vatInc','status','remMonth','remYear','project',
  'p_employee','p_department','p_position','p_staffType','p_month','p_year',
  'l_date','l_voucher','l_category','l_desc','l_vendor','l_bank','l_client','l_site','l_enteredBy',
  't_name','t_client','t_status','t_vat','t_start','t_end',
  's_sn','s_client','s_tin',
]);
const isNumericCol = (colId: string) => !NON_NUMERIC_COLS.has(colId);

interface TaggedRecord { _source: DataSource; _raw: any; }

/**
 * Aggregated row — one per unique client in multi-source mode.
 * Separates period-scoped values from all-time values for accurate balance.
 */
interface AggRow {
  client: string;
  tin: string;
  // Period-scoped (filtered by selected year/months/clients)
  invCount: number;
  periodCharged: number;
  invVat: number;
  payCount: number;
  periodCleared: number;
  totalPaidCash: number;
  payWht: number;
  payDiscount: number;
  vatCount: number;
  vatRemitted: number;
  ledgerTotal: number;
  siteCount: number;
  // All-time (ignore date filter — driven from rawInvoices/rawPayments directly)
  allTimeCharged: number;
  allTimeCleared: number;
  // Brought forward: balance accrued BEFORE the selected year
  bfwdCharged: number;
  bfwdCleared: number;
  bfwd: number;
  // True outstanding balance
  balance: number;
}

// Legacy typing kept for callers that pass dashboardConfig
export interface DashboardConfig {
  groups: Array<{ group: string; color: string; fields: string[] }>;
  selectedFields: string[];
  toggleField: (field: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  canExport: boolean;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

// ── Source compatibility rules ──────────────────────────────────────────────
// Each entry defines sources that CANNOT be combined. A new source is blocked
// if it would form any of these forbidden pairings with the current selection.
const INCOMPATIBLE_PAIRS: [DataSource, DataSource][] = [
  ['INVOICE', 'PAYROLL'],
  ['INVOICE', 'LEDGER'],
  ['INVOICE', 'SITE'],
  ['PAYMENT', 'SITE'],
  ['PAYMENT', 'PAYROLL'],
  ['VAT',     'PAYROLL'],
  ['VAT',     'LEDGER'],
  ['VAT',     'SITE'],
  ['PAYROLL', 'LEDGER'],
  ['PAYROLL', 'SITE'],
  ['LEDGER',  'SITE'],
];

const isComboAllowed = (next: DataSource[]): boolean =>
  !INCOMPATIBLE_PAIRS.some(
    ([a, b]) => next.includes(a) && next.includes(b)
  );

// ── Component ─────────────────────────────────────────────────────────────────
export function AccountsReportBuilder({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** @deprecated no longer used */
  dashboardConfig?: DashboardConfig;
}) {
  const rawInvoices    = useAppStore(s => s.invoices);
  const rawPayments    = useAppStore(s => s.payments);
  const rawVatPayments = useAppStore(s => s.vatPayments);
  const rawLedgerEntries = useAppStore(s => s.ledgerEntries);
  const sites          = useAppStore(s => s.sites);
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const pendingSites   = useAppStore(s => s.pendingSites);
  const vatRate        = useAppStore(s => s.payrollVariables.vatRate);
  
  const { calculatePayrollForMonth } = usePayrollCalculator();
  const [selectedSources, setSelectedSources] = useState<DataSource[]>(['INVOICE']);
  const [selectedYears,   setSelectedYears]   = useState<number[]>([currentYear]);
  const [selectedMonths,  setSelectedMonths]  = useState<string[]>(MONTHS.map(m => m.key));
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(BUILT_IN_PRESETS[0].columns);
  const [vatGroupedView,  setVatGroupedView]  = useState(false);

  const [userPresets,     setUserPresets]     = useState<ReportPreset[]>([]);
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [newPresetName,   setNewPresetName]   = useState('');

  const isMultiSource = selectedSources.length > 1;
  const prevMulti = useRef(false);

  // Auto-switch column set when entering/leaving multi-source mode
  useEffect(() => {
    if (isMultiSource && !prevMulti.current) {
      const outstandingPreset = BUILT_IN_PRESETS.find(p => p.id === '__outstanding');
      if (outstandingPreset) setSelectedColumns(outstandingPreset.columns);
    }
    prevMulti.current = isMultiSource;
  }, [isMultiSource]);

  // Load user presets
  useEffect(() => {
    try {
      const raw = localStorage.getItem('arb_presets_v3');
      if (raw) setUserPresets(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getTin = useCallback((name: string): string => {
    const p = clientProfiles.find(x => x.name === name);
    if (p?.tinNumber) return p.tinNumber;
    const s = pendingSites.find(x => x.clientName === name && x.phase4?.clientTinNumber);
    return s?.phase4?.clientTinNumber || '';
  }, [clientProfiles, pendingSites]);

  const getVatDetails = useCallback((amount: number, payVat: string, rate: number) => {
    const vat =
      payVat === 'Add' ? Math.round(((amount * 7.5) / 107.5) * 100) / 100
      : payVat === 'Yes' ? Math.round(((amount / (100 + rate)) * rate) * 100) / 100
      : 0;
    return { vat, amountForVat: payVat !== 'No' ? amount - vat : amount };
  }, []);

  // ── Available clients ────────────────────────────────────────────────────────
  const availableClients = useMemo(() => {
    const s = new Set<string>();
    sites.forEach(x => { if (x.client) s.add(x.client.trim()); });
    rawInvoices.forEach(x => { if (x.client) s.add(x.client.trim()); });
    rawPayments.forEach(x => { if ((x as any).client) s.add(((x as any).client as string).trim()); });
    rawVatPayments.forEach(x => { if (x.client) s.add(x.client.trim()); });
    rawLedgerEntries.forEach(x => { if (x.client && x.client !== '—') s.add(x.client.trim()); });
    return Array.from(s).sort();
  }, [sites, rawInvoices, rawPayments, rawVatPayments, rawLedgerEntries]);

  useEffect(() => {
    if (availableClients.length > 0 && selectedClients.length === 0) {
      setSelectedClients(availableClients);
    }
  }, [availableClients]); // eslint-disable-line

  // ── Pre-cache payroll rows per year×month to avoid re-invoking heavy calculator on every sidebar interaction ──
  const payrollCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof calculatePayrollForMonth>>();
    selectedYears.forEach(yr => {
      selectedMonths.forEach(mKey => {
        const key = `${yr}_${mKey}`;
        if (!cache.has(key)) cache.set(key, calculatePayrollForMonth(mKey, yr));
      });
    });
    return cache;
  }, [selectedYears, selectedMonths, calculatePayrollForMonth]);

  // ── Pre-compute which sources are blocked to avoid calling isComboAllowed per-button on every render ──
  const blockedSources = useMemo(() => {
    const set = new Set<DataSource>();
    (['INVOICE','PAYMENT','VAT','PAYROLL','LEDGER','SITE'] as DataSource[]).forEach(src => {
      if (!selectedSources.includes(src) && !isComboAllowed([...selectedSources, src])) {
        set.add(src);
      }
    });
    return set;
  }, [selectedSources]);

  // ── VAT remittance lookup: client_monthKey_year → total remitted ─────────────
  // Used by single-source VAT mode to compare what's owed vs what's been paid.
  const vatRemittanceMap = useMemo(() => {
    const map = new Map<string, number>();
    rawVatPayments.forEach(vp => {
      const mKey = monthNameToKey(vp.month);
      if (!mKey) return;
      const key = `${(vp.client || '').trim()}_${mKey}_${String(vp.year)}`;
      map.set(key, (map.get(key) || 0) + (vp.amount || 0));
    });
    return map;
  }, [rawVatPayments]);

  // ── Period-scoped flat records ───────────────────────────────────────────────
  const recordsToPrint = useMemo((): TaggedRecord[] => {
    const monthIndexes = selectedMonths.map(m => MONTHS.findIndex(mx => mx.key === m) + 1);

    const keepByDate = (date: string, client: string) => {
      const norm = normalizeDate(date);
      if (!norm) return false;
      const yr = parseInt(norm.substring(0, 4), 10);
      if (!selectedYears.includes(yr)) return false;
      const mo = parseInt(norm.substring(5, 7), 10);
      return monthIndexes.includes(mo) && selectedClients.includes((client || '').trim());
    };

    // VAT: filter by VAT PERIOD month/year, not payment date
    const keepVat = (r: any) => {
      const mKey = monthNameToKey(r.month);
      if (!mKey || !selectedMonths.includes(mKey)) return false;
      if (!selectedYears.map(String).includes(String(r.year))) return false;
      return selectedClients.includes((r.client || '').trim());
    };

    const rows: TaggedRecord[] = [];

    if (selectedSources.includes('INVOICE')) {
      rawInvoices
        .filter(r => keepByDate(r.date, r.client || ''))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(r => rows.push({ _source: 'INVOICE', _raw: r }));
    }
    if (selectedSources.includes('PAYMENT')) {
      rawPayments
        .filter(r => keepByDate(r.date, (r as any).client || ''))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(r => rows.push({ _source: 'PAYMENT', _raw: r }));
    }
    if (selectedSources.includes('VAT')) {
      if (selectedSources.length === 1) {
        // Single-source VAT: derive liability from client payments.
        // The month the client paid us = the month VAT is due (regardless of when we remit).
        rawPayments
          .filter(r => {
            if (!keepByDate(r.date, (r as any).client || '')) return false;
            const pvVal = (r as any).payVat ||
              (sites.find(s => s.name === (r as any).site && s.client === (r as any).client)?.vat as any) || 'No';
            const { vat } = getVatDetails((r as any).amount || 0, pvVal, vatRate);
            return vat > 0; // only payments that carry VAT
          })
          .sort((a, b) => new Date((a as any).date).getTime() - new Date((b as any).date).getTime())
          .forEach(r => rows.push({ _source: 'VAT', _raw: r }));
      } else {
        // Multi-source: keep using the stored vatPayments records for aggregation
        rawVatPayments
          .filter(keepVat)
          .sort((a, b) => {
            const yr = Number(a.year) - Number(b.year);
            if (yr !== 0) return yr;
            return MONTHS.findIndex(m => m.key === monthNameToKey(a.month)) -
                   MONTHS.findIndex(m => m.key === monthNameToKey(b.month));
          })
          .forEach(r => rows.push({ _source: 'VAT', _raw: r }));
      }
    }

    if (selectedSources.includes('PAYROLL')) {
      selectedYears.forEach(yr => {
        selectedMonths.forEach(mKey => {
          const pRows = payrollCache.get(`${yr}_${mKey}`) ?? [];
          pRows.forEach(r => {
            rows.push({ _source: 'PAYROLL', _raw: { ...r, month: mKey, year: yr, date: `${yr}-01-01` } });
          });
        });
      });
    }

    if (selectedSources.includes('LEDGER')) {
      rawLedgerEntries
        .filter(r => {
          const norm = normalizeDate(r.date);
          if (!norm) return false;
          const yr = parseInt(norm.substring(0, 4), 10);
          if (!selectedYears.includes(yr)) return false;
          const mo = parseInt(norm.substring(5, 7), 10);
          return monthIndexes.includes(mo) && (
            selectedClients.includes((r.client || '').trim()) ||
            (r.client || '').trim() === '' ||
            r.client === '—'
          );
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(r => rows.push({ _source: 'LEDGER', _raw: r }));
    }

    if (selectedSources.includes('SITE')) {
      sites.forEach(s => {
        if (selectedClients.includes((s.client || '').trim())) {
           rows.push({ _source: 'SITE', _raw: { ...s, date: s.startDate || `${selectedYears[selectedYears.length - 1]}-01-01` } });
        }
      });
    }

    if (selectedSources.length > 1) {
      rows.sort((a, b) => new Date(a._raw.date || 0).getTime() - new Date(b._raw.date || 0).getTime());
    }

    // ── Apply Client Grouping for VAT if enabled ──
    if (vatGroupedView && selectedSources.length === 1 && selectedSources[0] === 'VAT') {
      const groupedMap = new Map<string, TaggedRecord>();
      rows.forEach(rec => {
        const client = (rec._raw.client || '').trim() || '—';
        if (!groupedMap.has(client)) {
          groupedMap.set(client, {
            _source: 'VAT',
            _raw: {
              ...rec._raw,
              vatDate: '—', remMonth: '—', remYear: '—', date: '—', // Temporal fields disabled
              vatAmtPaid: 0, vatableAmt: 0, vatOwed: 0, vatPaid: 0, vatBalDue: 0
            }
          });
        }
        const g = groupedMap.get(client)!;
        // Derived from payment-based VAT logic
        const pvVal = rec._raw.payVat || (sites.find(s => s.name === rec._raw.site && s.client === rec._raw.client)?.vat as any) || 'No';
        const { vat, amountForVat } = getVatDetails(rec._raw.amount || 0, pvVal, vatRate);
        const mKey = monthNameToKey(rec._raw.month || '');
        const payYr = rec._raw.date ? normalizeDate(rec._raw.date)?.substring(0, 4) : '';
        const vatPaidAmt = vatRemittanceMap.get(`${client}_${mKey || ''}_${payYr}`) || 0;

        g._raw.vatAmtPaid += rec._raw.amount || 0;
        g._raw.vatableAmt += amountForVat;
        g._raw.vatOwed    += vat;
        g._raw.vatPaid    += vatPaidAmt;
        g._raw.vatBalDue  += (vat - vatPaidAmt);
      });
      return Array.from(groupedMap.values()).sort((a, b) => a._raw.client.localeCompare(b._raw.client));
    }

    return rows;
  }, [rawInvoices, rawPayments, rawVatPayments, rawLedgerEntries, sites, payrollCache, selectedSources, selectedYears, selectedMonths, selectedClients, vatRate, vatGroupedView, getVatDetails, vatRemittanceMap]);

  // ── Aggregated rows (multi-source) ───────────────────────────────────────────
  // Correctly separates period values from ALL-TIME values for accurate balance.
  const aggregatedRows = useMemo((): AggRow[] => {
    if (!isMultiSource) return [];

    const map = new Map<string, AggRow>();
    const ensure = (client: string): AggRow => {
      const cLabel = client || '—';
      if (!map.has(cLabel)) {
        map.set(cLabel, {
          client: cLabel, tin: getTin(cLabel),
          invCount: 0, periodCharged: 0, invVat: 0,
          payCount: 0, periodCleared: 0, totalPaidCash: 0, payWht: 0, payDiscount: 0,
          vatCount: 0, vatRemitted: 0,
          ledgerTotal: 0, siteCount: 0,
          allTimeCharged: 0, allTimeCleared: 0,
          bfwdCharged: 0, bfwdCleared: 0, bfwd: 0,
          balance: 0,
        });
      }
      return map.get(cLabel)!;
    };

    // Step 1: Period-scoped values from pre-filtered records
    recordsToPrint.forEach(rec => {
      const r = rec._raw;
      const client = (r.client || '').trim();
      const row = ensure(client);
      if (rec._source === 'INVOICE') {
        row.invCount++;
        row.periodCharged += r.totalCharge || 0;
        row.invVat += r.vat || 0;
      } else if (rec._source === 'PAYMENT') {
        row.payCount++;
        row.totalPaidCash += r.amount || 0;
        row.payWht += r.withholdingTax || 0;
        row.payDiscount += r.discount || 0;
        row.periodCleared += (r.amount || 0) + (r.withholdingTax || 0) + (r.discount || 0);
      } else if (rec._source === 'VAT') {
        row.vatCount++;
        row.vatRemitted += r.amount || 0;
      } else if (rec._source === 'LEDGER') {
        row.ledgerTotal += r.amount || 0;
      } else if (rec._source === 'SITE') {
        row.siteCount++;
      }
    });

    // Step 2: ALL-TIME totals — iterate raw records, no date filter
    if (selectedSources.includes('INVOICE')) {
      rawInvoices.forEach(r => {
        const client = (r.client || '').trim();
        if (!selectedClients.includes(client)) return;
        const row = ensure(client);
        row.allTimeCharged += r.totalCharge || 0;
        // Brought forward: invoices strictly before the earliest selected year
        const norm = normalizeDate(r.date);
        if (norm) {
          const yr = parseInt(norm.substring(0, 4), 10);
          const minYr = Math.min(...selectedYears);
          if (yr < minYr) row.bfwdCharged += r.totalCharge || 0;
        }
      });
    }

    if (selectedSources.includes('PAYMENT')) {
      rawPayments.forEach(r => {
        const client = ((r as any).client || '').trim();
        if (!selectedClients.includes(client)) return;
        const row = ensure(client);
        const cleared = ((r as any).amount || 0) + ((r as any).withholdingTax || 0) + ((r as any).discount || 0);
        row.allTimeCleared += cleared;
        // Brought forward: payments strictly before the earliest selected year
        const norm = normalizeDate((r as any).date);
        if (norm) {
          const yr = parseInt(norm.substring(0, 4), 10);
          const minYr = Math.min(...selectedYears);
          if (yr < minYr) row.bfwdCleared += cleared;
        }
      });
    }

    // Step 3: Compute derived values
    map.forEach(row => {
      row.bfwd    = row.bfwdCharged - row.bfwdCleared;         // opening balance
      row.balance = row.allTimeCharged - row.allTimeCleared;   // true closing balance
    });

    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client));
  }, [recordsToPrint, isMultiSource, selectedClients, selectedYears, rawInvoices, rawPayments]); // eslint-disable-line

  // ── Column sets ──────────────────────────────────────────────────────────────
  const relevantCols = useMemo(() => {
    if (isMultiSource) {
      return SUM_COLUMNS.filter(col => {
        // Balance/B/F require BOTH invoice and payment sources
        if (['s_bfwd','s_balance'].includes(col.id)) {
          return selectedSources.includes('INVOICE') && selectedSources.includes('PAYMENT');
        }
        if (['s_sn','s_client','s_tin'].includes(col.id)) return true;
        return col.sources.some(s => selectedSources.includes(s));
      });
    }
    let cols = TXN_COLUMNS.filter(c => c.sources.some(s => selectedSources.includes(s)));
    if (vatGroupedView && selectedSources.length === 1 && selectedSources[0] === 'VAT') {
      cols = cols.filter(c => !['vatDate', 'remMonth', 'remYear', 'date'].includes(c.id));
    }
    return cols;
  }, [isMultiSource, selectedSources, vatGroupedView]);

  const orderedCols = useMemo(
    () => selectedColumns
      .filter(id => relevantCols.some(c => c.id === id))
      .map(id => relevantCols.find(c => c.id === id)!),
    [selectedColumns, relevantCols],
  );

  // ── Cell resolvers ────────────────────────────────────────────────────────────
  const getTxnValue = useCallback((colId: string, rec: TaggedRecord, idx: number): string | number => {
    const { _source: src, _raw: r } = rec;
    if (colId === 'sn')     return idx + 1;
    if (colId === 'client') return r.client || '—';
    if (colId === 'tin')    return getTin(r.client || '');
    if (colId === 'date')   return formatDisplayDate(r.date);
    if (colId === 'site')   return src !== 'VAT' ? (r.siteName || r.site || '—') : '—';

    const invOnly = ['project','dueDate','invoiceNo','billingCycle','duration','machines','rentalCost',
      'dieselPerLtr','dailyUsage','technicians','techDailyRate','mobDemob','installation','damages',
      'invAmount','vatInc','invVat','totalCharge','status'];
    if (invOnly.includes(colId)) {
      if (src !== 'INVOICE') return '—';
      switch (colId) {
        case 'project':       return r.project || '—';
        case 'dueDate':       return formatDisplayDate(r.dueDate) || '—';
        case 'invoiceNo':     return r.invoiceNumber || '—';
        case 'billingCycle':  return r.billingCycle || '—';
        case 'duration':      return r.duration || 0;
        case 'machines':      return r.noOfMachine || 0;
        case 'rentalCost':    return r.dailyRentalCost || 0;
        case 'dieselPerLtr':  return r.dieselCostPerLtr || 0;
        case 'dailyUsage':    return r.dailyUsage || 0;
        case 'technicians':   return r.noOfTechnician || 0;
        case 'techDailyRate': return r.techniciansDailyRate || 0;
        case 'mobDemob':      return r.mobDemob || 0;
        case 'installation':  return r.installation || 0;
        case 'damages':       return r.damages || 0;
        case 'invAmount':     return r.amount || 0;
        case 'vatInc':        return r.vatInc || '—';
        case 'invVat':        return r.vat || 0;
        case 'totalCharge':   return r.totalCharge || 0;
        case 'status':        return r.status || '—';
        default: return '—';
      }
    }

    const payOnly = ['payAmount','amountForVAT','payVat','wht','discount','totalCleared'];
    if (payOnly.includes(colId)) {
      if (src !== 'PAYMENT') return '—';
      const pvVal = r.payVat || (sites.find(s => s.name === r.site && s.client === r.client)?.vat as any) || 'No';
      const { vat, amountForVat } = getVatDetails(r.amount || 0, pvVal, vatRate);
      switch (colId) {
        case 'payAmount':    return r.amount || 0;
        case 'amountForVAT':return amountForVat;
        case 'payVat':       return vat;
        case 'wht':          return r.withholdingTax || 0;
        case 'discount':     return r.discount || 0;
        case 'totalCleared': return (r.amount || 0) + (r.withholdingTax || 0) + (r.discount || 0);
        default: return '—';
      }
    }

    const vatOnly = ['vatDate','remMonth','remYear','vatAmtPaid','vatableAmt','vatOwed','vatPaid','vatBalDue'];
    if (vatOnly.includes(colId)) {
      if (src !== 'VAT') return '—';
      
      // If we are in grouped view, the values are already aggregated in the raw record
      if (vatGroupedView && typeof r[colId] === 'number') {
        return r[colId];
      }

      // Detailed view: calculate on the fly from payment record
      const pvVal = r.payVat ||
        (sites.find(s => s.name === r.site && s.client === r.client)?.vat as any) || 'No';
      const { vat, amountForVat } = getVatDetails(r.amount || 0, pvVal, vatRate);
      
      const norm = normalizeDate(r.date);
      const payMoIdx = norm ? parseInt(norm.substring(5, 7), 10) - 1 : -1;
      const payYr    = norm ? norm.substring(0, 4) : '';
      const mKey     = payMoIdx >= 0 ? (MONTHS[payMoIdx]?.key || '') : '';
      const mLabel   = payMoIdx >= 0 ? (MONTHS[payMoIdx]?.label || '—') : '—';
      const client   = (r.client || '').trim();
      const vatPaidAmt = vatRemittanceMap.get(`${client}_${mKey}_${payYr}`) || 0;

      switch (colId) {
        case 'vatDate':    return formatDisplayDate(r.date);
        case 'remMonth':   return mLabel;
        case 'remYear':    return payYr || '—';
        case 'vatAmtPaid': return r.amount || 0;
        case 'vatableAmt': return amountForVat;
        case 'vatOwed':    return vat;
        case 'vatPaid':    return vatPaidAmt;
        case 'vatBalDue':  return vat - vatPaidAmt;
        default: return '—';
      }
    }

    if (src === 'PAYROLL') {
      switch (colId) {
        case 'p_employee':   return `${r.surname || ''} ${r.firstname || ''}`.trim() || '—';
        case 'p_department': return r.department || '—';
        case 'p_position':   return r.position || '—';
        case 'p_staffType':  return r.staffType || '—';
        case 'p_basic':      return r.grossPay || 0;
        case 'p_pension':    return r.pension || 0;
        case 'p_paye':       return r.paye || 0;
        case 'p_nsitf':      return r.nsitf || 0;
        case 'p_net':        return r.takeHomePay || 0;
        case 'p_month':      return MONTHS.find(m => m.key === r.month)?.label || r.month || '—';
        case 'p_year':       return r.year || '—';
        default: return '—';
      }
    }

    if (src === 'LEDGER') {
      switch (colId) {
        case 'l_date':       return formatDisplayDate(r.date);
        case 'l_voucher':    return r.voucherNo || '—';
        case 'l_category':   return r.category || '—';
        case 'l_desc':       return r.description || '—';
        case 'l_amount':     return r.amount || 0;
        case 'l_vendor':     return r.vendor || '—';
        case 'l_bank':       return r.bank || '—';
        case 'l_client':     return r.client || '—';
        case 'l_site':       return r.site || '—';
        case 'l_enteredBy':  return r.enteredBy || '—';
        default: return '—';
      }
    }

    if (src === 'SITE') {
      switch (colId) {
        case 't_name':       return r.name || '—';
        case 't_client':     return r.client || '—';
        case 't_status':     return r.status || '—';
        case 't_vat':        return r.vat || '—';
        case 't_start':      return formatDisplayDate(r.startDate);
        case 't_end':        return formatDisplayDate(r.endDate);
        default: return '—';
      }
    }

    return '—';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getTin, getVatDetails, sites, vatRate, vatRemittanceMap]);

  const getAggValue = useCallback((colId: string, row: AggRow, idx: number): string | number => {
    switch (colId) {
      case 's_sn':           return idx + 1;
      case 's_client':       return row.client;
      case 's_tin':          return row.tin;
      case 's_inv_count':    return row.invCount;
      case 's_periodcharged':return row.periodCharged;
      case 's_inv_vat':      return row.invVat;
      case 's_allcharged':   return row.allTimeCharged;
      case 's_pay_count':    return row.payCount;
      case 's_periodcleared':return row.periodCleared;
      case 's_total_cash':   return row.totalPaidCash;
      case 's_pay_wht':      return row.payWht;
      case 's_pay_disct':    return row.payDiscount;
      case 's_allcleared':   return row.allTimeCleared;
      case 's_vat_count':    return row.vatCount;
      case 's_vat_remitted': return row.vatRemitted;
      case 's_ledger_total': return row.ledgerTotal;
      case 's_site_count':   return row.siteCount;
      case 's_bfwd':         return row.bfwd;
      case 's_balance':      return row.balance;
      default: return '—';
    }
  }, []);

  const getColTotal = useCallback((colId: string): number => {
    if (isMultiSource) {
      return aggregatedRows.reduce((sum, row, i) => {
        const v = getAggValue(colId, row, i);
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);
    }
    return recordsToPrint.reduce((sum, rec, i) => {
      const v = getTxnValue(colId, rec, i);
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
  }, [isMultiSource, aggregatedRows, recordsToPrint, getAggValue, getTxnValue]);

  // isNumericCol is now a stable module-level function above the component

  // ── Preset management ────────────────────────────────────────────────────────
  const savePreset = () => {
    if (!newPresetName.trim()) { toast.error('Preset name is required.'); return; }
    const p: ReportPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      sources: [...selectedSources],
      columns: [...selectedColumns],
    };
    const updated = [...userPresets, p];
    setUserPresets(updated);
    localStorage.setItem('arb_presets_v3', JSON.stringify(updated));
    setNewPresetName('');
    setShowPresetInput(false);
    toast.success('Preset saved!');
  };

  const deleteUserPreset = (id: string) => {
    const updated = userPresets.filter(p => p.id !== id);
    setUserPresets(updated);
    localStorage.setItem('arb_presets_v3', JSON.stringify(updated));
    toast.success('Preset deleted.');
  };

  const applyPreset = (p: ReportPreset) => {
    setSelectedSources(p.sources);
    setTimeout(() => setSelectedColumns(p.columns), 50);
    toast.success(`Applied: ${p.name}`);
  };

  const toggleSource = (src: DataSource) => {
    setSelectedSources(prev => {
      if (prev.includes(src)) {
        // Deselecting: remove it; if last one, reset to INVOICE
        const next = prev.filter(s => s !== src);
        return next.length === 0 ? ['INVOICE'] : next;
      }
      const next = [...prev, src];
      if (!isComboAllowed(next)) {
        // Incompatible with current mix — switch to this source exclusively
        return [src];
      }
      return next;
    });
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    const rowCount = isMultiSource ? aggregatedRows.length : recordsToPrint.length;
    if (rowCount === 0) { toast.error('No data to export.'); return; }

    const headers = orderedCols.map(c => c.label);
    const esc = (v: any) => typeof v === 'number' ? String(v) : `"${String(v ?? '').replace(/"/g, '""')}"`;
    const dataRows = isMultiSource
      ? aggregatedRows.map((row, i) => orderedCols.map(c => getAggValue(c.id, row, i)))
      : recordsToPrint.map((rec, i) => orderedCols.map(c => getTxnValue(c.id, rec, i)));
    const totalsRow = orderedCols.map(c => c.summable ? getColTotal(c.id) : (c.id === 'client' || c.id === 's_client' ? 'TOTAL' : ''));
    dataRows.push(totalsRow);

    const csv = [headers.join(','), ...dataRows.map(r => r.map(esc).join(','))].join('\n');
    const fileName = `${selectedSources.map(s => s.toLowerCase()).join('_')}_report_${selectedYears.join('-')}.csv`;

    if ((window as any).electronAPI?.savePathDialog) {
      const fp = await (window as any).electronAPI.savePathDialog({
        title: 'Export Report (CSV)', defaultPath: fileName,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });
      if (fp) {
        const ok = await (window as any).electronAPI.writeFile(fp, csv, 'utf8');
        if (ok) toast.success(`Exported to ${fp}`); else toast.error('Failed to save.');
      }
    } else {
      const link = document.createElement('a');
      link.href = encodeURI('data:text/csv;charset=utf-8,' + csv);
      link.download = fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success('Report exported!');
    }
  };

  // ── Derived display ───────────────────────────────────────────────────────────
  const allPresets = [...BUILT_IN_PRESETS, ...userPresets];
  const rowCount = isMultiSource ? aggregatedRows.length : recordsToPrint.length;
  const reportTitle = selectedSources.length === 1
    ? `${SOURCE_LABELS[selectedSources[0]]} Report`
    : 'Combined Financial Report';

  const SHARED_IDS = new Set(TXN_COLUMNS.filter(c => c.sources.length > 1).map(c => c.id));

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !z-50 !max-w-[100vw] !w-screen !h-screen !max-h-screen !m-0 !rounded-none p-0 overflow-hidden flex flex-col bg-slate-100 print:max-w-none print:h-auto print:bg-white border-0 gap-0">

        {/* ── Top Header ── */}
        <DialogHeader className="bg-slate-900 border-b border-slate-700/60 shrink-0 print:hidden text-left z-20 overflow-hidden">
          <div className="flex items-center w-full py-0 h-8">

            {/* ── Close button: solid red, instant tactile feedback ── */}
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close report builder"
              className={[
                'flex items-center justify-center gap-1.5',
                'px-4 h-8 shrink-0 mr-1 cursor-pointer',
                'bg-red-600 hover:bg-red-500 active:bg-red-700',
                'text-white text-xs font-semibold rounded',
                'transition-all duration-100',
                'active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900',
              ].join(' ')}
            >
              Close
            </button>

            {/* ── Breadcrumb + title ── */}
            <DialogTitle className="flex items-center gap-2 px-3 min-w-0 flex-1">
              <span className="text-slate-500 text-[11px] font-medium uppercase tracking-widest shrink-0 select-none">
                Report Builder
              </span>
              <span className="text-slate-600 text-[11px] shrink-0">/</span>
              <span className="text-white text-sm font-semibold truncate">{reportTitle}</span>
              {isMultiSource && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold px-2 py-0.5 rounded shrink-0">
                  Multi-source
                </span>
              )}
            </DialogTitle>

            {/* ── Meta + actions ── */}
            <div className="flex items-center gap-2 px-2 shrink-0 border-l border-slate-700/50">
              {rowCount > 0 && (
                <span className="text-slate-500 text-[11px] font-mono hidden md:block">
                  {rowCount} {isMultiSource ? 'clients' : 'records'}
                </span>
              )}
              {/* Primary action */}
              <button
                onClick={handleExportCSV}
                disabled={rowCount === 0}
                className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Upload className="h-3.5 w-3.5" />
                Export CSV
              </button>
              {/* Secondary action */}
              <button
                onClick={() => window.print()}
                disabled={rowCount === 0}
                className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
            </div>

          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar ── */}
          <div className="w-[288px] shrink-0 border-r border-slate-200 bg-white shadow-sm z-10 flex flex-col h-full print:hidden">
            <div className="flex-1 overflow-y-auto p-4 pb-10 flex flex-col gap-5 custom-scrollbar">

              {/* Presets */}
              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[11px] text-indigo-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <Save className="h-3.5 w-3.5 text-indigo-500" /> Report Presets
                  </h4>
                  <button onClick={() => setShowPresetInput(!showPresetInput)}
                    className="text-[11px] font-semibold text-indigo-600 bg-white hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors">
                    {showPresetInput ? 'Cancel' : '+ Save Current'}
                  </button>
                </div>
                {showPresetInput && (
                  <div className="flex gap-2 mb-2 animate-in fade-in">
                    <input type="text" value={newPresetName} onChange={e => setNewPresetName(e.target.value)}
                      placeholder="Preset name…" onKeyDown={e => { if (e.key === 'Enter') savePreset(); }}
                      className="flex-1 h-7 px-2 text-xs rounded border border-indigo-200 outline-none focus:border-indigo-400" />
                    <Button size="sm" className="h-7 text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-3" onClick={savePreset}>Save</Button>
                  </div>
                )}
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {allPresets.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg shadow-sm border border-slate-100 group hover:border-indigo-200 transition-colors">
                      <button onClick={() => applyPreset(p)} className="text-left flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 hover:text-indigo-600 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.sources.map(s => SOURCE_LABELS[s]).join(' + ')}</p>
                      </button>
                      {!p.builtIn && (
                        <button onClick={() => deleteUserPreset(p.id)} className="text-rose-400 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Sources */}
              <div>
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wide mb-2">Data Sources</h4>
                <div className="flex flex-col gap-1.5">
                  {(['INVOICE','PAYMENT','VAT','PAYROLL','LEDGER','SITE'] as DataSource[]).map((src, idx) => {
                    const active = selectedSources.includes(src);
                    const isDivider = idx === 3;
                    // Use pre-computed blockedSources for performance
                    const wouldBlock = !active && blockedSources.has(src);
                    return (
                      <div key={src}>
                        {isDivider && <div className="my-1 border-t border-slate-200" />}
                        <button
                          onClick={() => toggleSource(src)}
                          title={wouldBlock ? `Cannot combine with current selection` : undefined}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-all
                            ${active
                              ? SOURCE_TOGGLE_ON[src]
                              : wouldBlock
                              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed opacity-50'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                            }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${active ? 'border-current' : 'border-slate-300'}`}>
                            {active && <div className="w-2 h-2 rounded-sm bg-current" />}
                          </div>
                          <span className="flex-1 text-left">{SOURCE_LABELS[src]}</span>
                          {wouldBlock
                            ? <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200">N/A</span>
                            : <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${SOURCE_PILL[src]}`}>
                                {['INVOICE','PAYMENT','VAT'].includes(src) ? 'Finance' : src === 'PAYROLL' ? 'HR' : src === 'LEDGER' ? 'Expense' : 'Ops'}
                              </span>
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Years */}
              <div>
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wide mb-2 flex items-center justify-between">
                  Year(s)
                  <div className="flex gap-2">
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline"
                      onClick={() => setSelectedYears(Array.from({ length: currentYear - YEAR_RANGE_START + 2 }, (_, i) => YEAR_RANGE_START + i))}>All</button>
                    <span className="text-slate-300">|</span>
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline"
                      onClick={() => setSelectedYears([currentYear])}>Reset</button>
                  </div>
                </h4>
                <div className="grid grid-cols-3 gap-1 max-h-[110px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {Array.from({ length: currentYear - YEAR_RANGE_START + 2 }, (_, i) => currentYear - i).map(yr => {
                    const active = selectedYears.includes(yr);
                    return (
                      <label key={yr} className={`flex items-center gap-1 text-xs font-medium cursor-pointer px-1.5 py-1 rounded transition-colors select-none ${
                        active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}>
                        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 h-3 w-3"
                          checked={active}
                          onChange={e => {
                            if (e.target.checked) setSelectedYears(prev => [...prev, yr].sort((a, b) => a - b));
                            else {
                              const next = selectedYears.filter(y => y !== yr);
                              if (next.length > 0) setSelectedYears(next); // keep at least one
                            }
                          }} />
                        {yr}
                      </label>
                    );
                  })}
                </div>
                {selectedSources.includes('VAT') && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Grouping Logic</h4>
                        <p className="text-[10px] text-amber-700">Concatenate client records</p>
                      </div>
                      <button
                        onClick={() => setVatGroupedView(!vatGroupedView)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${vatGroupedView ? 'bg-amber-600' : 'bg-slate-200'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${vatGroupedView ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
                {selectedSources.includes('VAT') && !vatGroupedView && (
                  <p className="text-[10px] text-slate-400 italic mt-1">VAT: filters by period year, not payment date</p>
                )}
                {isMultiSource && (
                  <p className="text-[10px] text-slate-400 italic mt-1"><strong>B/F</strong> = balance before {Math.min(...selectedYears)}</p>
                )}
              </div>

              {/* Months */}
              <div>
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wide mb-2 flex items-center justify-between">
                  {selectedSources.includes('VAT') && !isMultiSource ? 'VAT Period Month' : 'Months'}
                  <div className="flex gap-2">
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setSelectedMonths(MONTHS.map(m => m.key))}>All</button>
                    <span className="text-slate-300">|</span>
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setSelectedMonths([])}>None</button>
                  </div>
                </h4>
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS.map(m => {
                    const active = selectedMonths.includes(m.key);
                    return (
                      <label key={m.key} className={`flex items-center gap-1 text-xs font-medium cursor-pointer px-1.5 py-1 rounded transition-colors select-none ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 h-3 w-3" checked={active}
                          onChange={e => {
                            if (e.target.checked) setSelectedMonths([...selectedMonths, m.key]);
                            else setSelectedMonths(selectedMonths.filter(k => k !== m.key));
                          }} />
                        {m.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Clients */}
              <div>
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wide mb-2 flex items-center justify-between">
                  Clients
                  <div className="flex gap-2">
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setSelectedClients(availableClients)}>All</button>
                    <span className="text-slate-300">|</span>
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setSelectedClients([])}>None</button>
                  </div>
                </h4>
                <div className="flex flex-col gap-0.5 max-h-[130px] overflow-y-auto pr-1 custom-scrollbar">
                  {availableClients.map(c => (
                    <label key={c} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 px-1.5 py-1 rounded select-none">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 shrink-0 h-3 w-3" checked={selectedClients.includes(c)}
                        onChange={e => {
                          if (e.target.checked) setSelectedClients(prev => [...prev, c]);
                          else setSelectedClients(prev => prev.filter(x => x !== c));
                        }} />
                      <span className="truncate">{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Columns Map Builder */}
              <div>
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-between">
                  {isMultiSource ? 'Summary Columns' : 'Columns Map Builder'}
                  <div className="flex gap-2">
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setSelectedColumns(relevantCols.map(c => c.id))}>All</button>
                    <span className="text-slate-300">|</span>
                    <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setSelectedColumns([])}>None</button>
                  </div>
                </h4>
                {isMultiSource && (
                  <p className="text-[10px] text-amber-600 mb-2 italic">Balance Due uses all-time data, not just the filtered period.</p>
                )}

                <div className="flex flex-col gap-0.5 mb-12">
                  {(() => {
                    let lastGroup = '';
                    return relevantCols.map(col => {
                      const group = isMultiSource
                        ? (col.id.includes('charged') || col.id === 's_inv_count' || col.id === 's_inv_vat' ? 'INVOICE'
                          : col.id.includes('cleared') || col.id.includes('pay') || col.id === 's_total_cash'  ? 'PAYMENT'
                          : col.id.includes('vat')     ? 'VAT'
                          : col.id === 's_ledger_total' ? 'LEDGER'
                          : col.id === 's_site_count'   ? 'SITE'
                          : col.id === 's_bfwd' || col.id === 's_balance' ? 'CROSS'
                          : 'SHARED')
                        : (['INVOICE','PAYMENT','VAT','PAYROLL','LEDGER','SITE'] as const).reduce<string>((acc, src) => {
                            if (acc !== 'SHARED') return acc;
                            return col.sources.length === 1 && col.sources[0] === src ? src : acc;
                          }, SHARED_IDS.has(col.id) ? 'SHARED' : 'SHARED');

                      const showHeader = group !== lastGroup;
                      lastGroup = group;

                      const groupLabel =
                        group === 'SHARED'  ? '— Common Fields —' :
                        group === 'INVOICE' ? (isMultiSource ? '— Invoice Totals —'  : '— Invoice Fields —')  :
                        group === 'PAYMENT' ? (isMultiSource ? '— Payment Totals —'  : '— Payment Fields —')  :
                        group === 'VAT'     ? (isMultiSource ? '— VAT Totals —'      : '— VAT Fields —')      :
                        group === 'PAYROLL' ? '— Payroll Fields —' :
                        group === 'LEDGER'  ? (isMultiSource ? '— Ledger Totals —'   : '— Ledger Fields —')   :
                        group === 'SITE'    ? (isMultiSource ? '— Site Totals —'     : '— Site Fields —')     :
                                              '— Accounting Balance —';
                      const groupColor =
                        group === 'INVOICE' ? 'text-blue-500'    :
                        group === 'PAYMENT' ? 'text-emerald-600' :
                        group === 'VAT'     ? 'text-amber-600'   :
                        group === 'PAYROLL' ? 'text-purple-600'  :
                        group === 'LEDGER'  ? 'text-slate-500'   :
                        group === 'SITE'    ? 'text-indigo-600'  :
                        group === 'CROSS'   ? 'text-indigo-500'  : 'text-slate-400';

                      const isSelected = selectedColumns.includes(col.id);
                      return (
                        <div key={col.id}>
                          {showHeader && (
                            <p className={`text-[10px] font-bold uppercase tracking-wide py-1.5 pl-1 mt-2 ${groupColor}`}>{groupLabel}</p>
                          )}
                          <div className={`flex items-center gap-2 py-1 px-1.5 rounded transition-colors ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}>
                            <input type="checkbox" id={`col-${col.id}`} className="rounded border-slate-300 text-indigo-600 shrink-0 h-3.5 w-3.5"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) setSelectedColumns([...selectedColumns, col.id]);
                                else setSelectedColumns(selectedColumns.filter(id => id !== col.id));
                              }} />
                            <label htmlFor={`col-${col.id}`} className="text-xs font-semibold text-slate-700 cursor-pointer flex-1 flex items-center justify-between select-none">
                              {col.label}
                              {isSelected && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-sm tabular-nums">
                                  #{selectedColumns.indexOf(col.id) + 1}
                                </span>
                              )}
                            </label>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>{/* end scroll */}
          </div>{/* end sidebar */}

          {/* ── Right: Preview ── */}
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #arb-print-area, #arb-print-area * { visibility: visible; }
              #arb-print-area { position: absolute; left: 0; top: 0; width: 100%; }
              .print\\:hidden { display: none !important; }
            }
          `}</style>

          <div className="flex-1 overflow-auto bg-slate-200/60 p-6 md:p-8 print:p-0 print:bg-white" id="arb-print-area">
            <div className="bg-white mx-auto shadow-2xl max-w-7xl rounded-lg min-h-full print:shadow-none print:max-w-none mb-[100px] print:mb-0"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

              {/* Document header */}
              <div className="flex justify-between items-start px-8 py-6 border-b border-slate-200">
                <div>
                  <img src={logoSrc} alt="Logo" className="h-8 w-auto mb-2" />
                  <h1 className="text-xl font-bold text-slate-900">{reportTitle}</h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {selectedSources.length > 1 && `${selectedSources.map(s => SOURCE_LABELS[s]).join(' + ')} · `}
                    {selectedYears.length === 1 ? selectedYears[0] : `${Math.min(...selectedYears)}–${Math.max(...selectedYears)}`} · {selectedMonths.length === 12 ? 'All Months' : `${selectedMonths.length} month(s)`}
                    {selectedClients.length !== availableClients.length ? ` · ${selectedClients.length} client(s)` : ''}
                    {isMultiSource ? ` · ${aggregatedRows.length} unique client(s)` : ` · ${recordsToPrint.length} record(s)`}
                  </p>

                </div>
                <div className="text-right text-xs text-slate-400 print:hidden">
                  <p>Generated: {new Date().toLocaleDateString()}</p>
                  {orderedCols.length > 0 && <p className="mt-0.5">{orderedCols.length} column(s)</p>}
                </div>
              </div>

              {/* Empty states */}
              {orderedCols.length === 0 ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                  <div className="text-center">
                    <div className="text-5xl mb-4">📊</div>
                    <p className="font-semibold text-slate-600">Select columns to build your report</p>
                    <p className="text-sm mt-1">Use the sidebar or click a preset above.</p>
                  </div>
                </div>
              ) : rowCount === 0 ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                  <div className="text-center">
                    <div className="text-5xl mb-4">🔍</div>
                    <p className="font-semibold text-slate-600">No records match your filters</p>
                    <p className="text-sm mt-1">Adjust year, months, clients, or sources.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        {orderedCols.map(col => (
                          <th key={col.id}
                            className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide border-r border-slate-700 whitespace-nowrap ${isNumericCol(col.id) ? 'text-right' : 'text-left'}`}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {isMultiSource ? (
                        aggregatedRows.map((row, rowIdx) => {
                          const bal = row.balance;
                          const isOwing = bal > 0;
                          return (
                            <tr key={rowIdx} className={`border-b border-slate-100 hover:bg-indigo-50/20 transition-colors ${rowIdx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                              {orderedCols.map(col => {
                                const val = getAggValue(col.id, row, rowIdx);
                                const isNum = typeof val === 'number';
                                const isNeg = isNum && (val as number) < 0;
                                const isPos = isNum && (val as number) > 0 && col.id === 's_balance';
                                return (
                                  <td key={col.id}
                                    className={`px-3 py-2 text-xs border-r border-slate-100 ${isNum ? 'text-right tabular-nums font-medium' : 'text-left'} ${isNeg ? 'text-rose-600' : ''} ${isPos ? 'text-emerald-700 font-bold' : ''}`}>
                                    {isNum
                                      ? (['s_sn','s_inv_count','s_pay_count','s_vat_count'].includes(col.id)
                                          ? String(Math.round(val as number))
                                          : fm(val as number))
                                      : String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      ) : (
                        recordsToPrint.map((rec, rowIdx) => (
                          <tr key={rowIdx} className={`border-b border-slate-100 hover:brightness-95 transition-colors ${rowIdx % 2 === 0 ? '' : 'bg-slate-50/60'} ${ROW_TINT[rec._source]}`}>
                            {orderedCols.map(col => {
                              const val = getTxnValue(col.id, rec, rowIdx);
                              const isNum = typeof val === 'number';
                              return (
                                <td key={col.id}
                                  className={`px-3 py-2 text-xs border-r border-slate-100 ${isNum ? 'text-right tabular-nums font-medium' : 'text-left'} ${val === '—' ? 'text-slate-300' : ''}`}>
                                  {isNum
                                    ? (['sn'].includes(col.id)
                                        ? String(Math.round(val as number))
                                        : fm(val as number))
                                    : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}

                      {/* Totals row */}
                      {orderedCols.some(c => c.summable) && (
                        <tr className="bg-slate-800 text-white">
                          {orderedCols.map((col, ci) => {
                            const total = getColTotal(col.id);
                            const isNeg = col.summable && total < 0;
                            return (
                              <td key={col.id}
                                className={`px-3 py-3 text-xs font-bold border-r border-slate-700 ${isNumericCol(col.id) ? 'text-right tabular-nums' : 'text-left'} ${isNeg ? 'text-rose-300' : ''}`}>
                                {ci === 0 ? 'TOTAL' : col.summable ? fm(total) : ''}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
