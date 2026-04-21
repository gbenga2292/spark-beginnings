import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Upload, Printer, Trash2, Save, X, Info } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import logoSrc from '../../../logo/logo-2.png';

// ── Constants ─────────────────────────────────────────────────────────────────
const YEAR_RANGE_START = 2020;
const currentYear = new Date().getFullYear();

type DataSource = 'INVOICE' | 'PAYMENT' | 'VAT';

const SOURCE_LABELS: Record<DataSource, string> = {
  INVOICE: 'Invoices',
  PAYMENT: 'Payments',
  VAT:     'VAT Remittances',
};
const SOURCE_PILL: Record<DataSource, string> = {
  INVOICE: 'bg-blue-100 text-blue-700 border-blue-200',
  PAYMENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  VAT:     'bg-amber-100  text-amber-700  border-amber-200',
};
const SOURCE_TOGGLE_ON: Record<DataSource, string> = {
  INVOICE: 'bg-blue-50   border-blue-300  text-blue-800',
  PAYMENT: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  VAT:     'bg-amber-50   border-amber-300  text-amber-800',
};
const ROW_TINT: Record<DataSource, string> = {
  INVOICE: '',
  PAYMENT: 'bg-emerald-50/40',
  VAT:     'bg-amber-50/40',
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
];

/**
 * Aggregated summary columns — multi-source mode.
 * Mix of period-scoped and all-time values to give accurate balance.
 */
const SUM_COLUMNS: ColumnDef[] = [
  { id: 's_sn',            label: 'S/N',                      summable: false, sources: ['INVOICE','PAYMENT','VAT'] },
  { id: 's_client',        label: 'Client Name',              summable: false, sources: ['INVOICE','PAYMENT','VAT'] },
  { id: 's_tin',           label: 'Client TIN',               summable: false, sources: ['INVOICE','PAYMENT','VAT'] },
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
    // Outstanding — uses all-time balance for accuracy
    id: '__outstanding', name: 'Outstanding Balance', builtIn: true,
    sources: ['INVOICE','PAYMENT'],
    columns: ['s_sn','s_client','s_bfwd','s_periodcharged','s_periodcleared','s_allcharged','s_allcleared','s_balance'],
  },
];

const fm = (v: number | null | undefined) =>
  typeof v === 'number'
    ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

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
  const sites          = useAppStore(s => s.sites);
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const pendingSites   = useAppStore(s => s.pendingSites);
  const vatRate        = useAppStore(s => s.payrollVariables.vatRate);

  const [selectedSources, setSelectedSources] = useState<DataSource[]>(['INVOICE']);
  const [selectedYear,    setSelectedYear]    = useState(currentYear);
  const [selectedMonths,  setSelectedMonths]  = useState<string[]>(MONTHS.map(m => m.key));
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(BUILT_IN_PRESETS[0].columns);

  const [userPresets,     setUserPresets]     = useState<ReportPreset[]>([]);
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [newPresetName,   setNewPresetName]   = useState('');

  const isMultiSource = selectedSources.length > 1;
  const prevMulti = useRef(false);

  // Auto-switch column set when entering/leaving multi-source mode
  useEffect(() => {
    if (isMultiSource && !prevMulti.current) {
      setSelectedColumns(BUILT_IN_PRESETS[3].columns); // Outstanding Balance defaults
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
  const getTin = (name: string): string => {
    const p = clientProfiles.find(x => x.name === name);
    if (p?.tinNumber) return p.tinNumber;
    const s = pendingSites.find(x => x.clientName === name && x.phase4?.clientTinNumber);
    return s?.phase4?.clientTinNumber || '';
  };

  const getVatDetails = (amount: number, payVat: string, rate: number) => {
    const vat =
      payVat === 'Add' ? Math.round(((amount * 7.5) / 107.5) * 100) / 100
      : payVat === 'Yes' ? Math.round(((amount / (100 + rate)) * rate) * 100) / 100
      : 0;
    return { vat, amountForVat: payVat !== 'No' ? amount - vat : amount };
  };

  // ── Available clients ────────────────────────────────────────────────────────
  const availableClients = useMemo(() => {
    const s = new Set<string>();
    sites.forEach(x => { if (x.client) s.add(x.client.trim()); });
    rawInvoices.forEach(x => { if (x.client) s.add(x.client.trim()); });
    rawPayments.forEach(x => { if ((x as any).client) s.add(((x as any).client as string).trim()); });
    rawVatPayments.forEach(x => { if (x.client) s.add(x.client.trim()); });
    return Array.from(s).sort();
  }, [sites, rawInvoices, rawPayments, rawVatPayments]);

  useEffect(() => {
    if (availableClients.length > 0 && selectedClients.length === 0) {
      setSelectedClients(availableClients);
    }
  }, [availableClients]); // eslint-disable-line

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
      if (!norm || !norm.startsWith(String(selectedYear))) return false;
      const mo = parseInt(norm.substring(5, 7), 10);
      return monthIndexes.includes(mo) && selectedClients.includes((client || '').trim());
    };

    // VAT: filter by VAT PERIOD month/year, not payment date
    const keepVat = (r: any) => {
      const mKey = monthNameToKey(r.month);
      if (!mKey || !selectedMonths.includes(mKey)) return false;
      if (String(r.year) !== String(selectedYear)) return false;
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

    if (selectedSources.length > 1) {
      rows.sort((a, b) => new Date(a._raw.date).getTime() - new Date(b._raw.date).getTime());
    }
    return rows;
  }, [rawInvoices, rawPayments, rawVatPayments, selectedSources, selectedYear, selectedMonths, selectedClients]);

  // ── Aggregated rows (multi-source) ───────────────────────────────────────────
  // Correctly separates period values from ALL-TIME values for accurate balance.
  const aggregatedRows = useMemo((): AggRow[] => {
    if (!isMultiSource) return [];

    const map = new Map<string, AggRow>();
    const ensure = (client: string): AggRow => {
      if (!map.has(client)) {
        map.set(client, {
          client, tin: getTin(client),
          invCount: 0, periodCharged: 0, invVat: 0,
          payCount: 0, periodCleared: 0, totalPaidCash: 0, payWht: 0, payDiscount: 0,
          vatCount: 0, vatRemitted: 0,
          allTimeCharged: 0, allTimeCleared: 0,
          bfwdCharged: 0, bfwdCleared: 0, bfwd: 0,
          balance: 0,
        });
      }
      return map.get(client)!;
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
      }
    });

    // Step 2: ALL-TIME totals — iterate raw records, no date filter
    if (selectedSources.includes('INVOICE')) {
      rawInvoices.forEach(r => {
        const client = (r.client || '').trim();
        if (!selectedClients.includes(client)) return;
        const row = ensure(client);
        row.allTimeCharged += r.totalCharge || 0;
        // Brought forward: invoices strictly before the selected year
        const norm = normalizeDate(r.date);
        if (norm) {
          const yr = parseInt(norm.substring(0, 4), 10);
          if (yr < selectedYear) row.bfwdCharged += r.totalCharge || 0;
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
        // Brought forward: payments strictly before the selected year
        const norm = normalizeDate((r as any).date);
        if (norm) {
          const yr = parseInt(norm.substring(0, 4), 10);
          if (yr < selectedYear) row.bfwdCleared += cleared;
        }
      });
    }

    // Step 3: Compute derived values
    map.forEach(row => {
      row.bfwd    = row.bfwdCharged - row.bfwdCleared;         // opening balance
      row.balance = row.allTimeCharged - row.allTimeCleared;   // true closing balance
    });

    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client));
  }, [recordsToPrint, isMultiSource, selectedClients, selectedYear, rawInvoices, rawPayments]); // eslint-disable-line

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
    return TXN_COLUMNS.filter(c => c.sources.some(s => selectedSources.includes(s)));
  }, [isMultiSource, selectedSources]);

  const orderedCols = useMemo(
    () => selectedColumns
      .filter(id => relevantCols.some(c => c.id === id))
      .map(id => relevantCols.find(c => c.id === id)!),
    [selectedColumns, relevantCols],
  );

  // ── Cell resolvers ────────────────────────────────────────────────────────────
  const getTxnValue = (colId: string, rec: TaggedRecord, idx: number): string | number => {
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
      // r is a Payment record (single-source VAT derives from payments received)
      const pvVal = r.payVat ||
        (sites.find(s => s.name === r.site && s.client === r.client)?.vat as any) || 'No';
      const { vat, amountForVat } = getVatDetails(r.amount || 0, pvVal, vatRate);
      // Determine the period month from the payment date
      const norm = normalizeDate(r.date);
      const payMoIdx = norm ? parseInt(norm.substring(5, 7), 10) - 1 : -1;
      const payYr    = norm ? norm.substring(0, 4) : '';
      const mKey     = payMoIdx >= 0 ? (MONTHS[payMoIdx]?.key || '') : '';
      const mLabel   = payMoIdx >= 0 ? (MONTHS[payMoIdx]?.label || '—') : '—';
      const client   = (r.client || '').trim();
      // Lookup total VAT already remitted for this client + period
      const vatPaidAmt = vatRemittanceMap.get(`${client}_${mKey}_${payYr}`) || 0;
      switch (colId) {
        case 'vatDate':    return formatDisplayDate(r.date);
        case 'remMonth':   return mLabel;
        case 'remYear':    return payYr || '—';
        case 'vatAmtPaid': return r.amount || 0;    // total client payment (incl. VAT)
        case 'vatableAmt': return amountForVat;      // excl. VAT
        case 'vatOwed':    return vat;               // VAT component from this payment
        case 'vatPaid':    return vatPaidAmt;        // what has actually been remitted (from vatPayments)
        case 'vatBalDue':  return vat - vatPaidAmt;  // still outstanding
        default: return '—';
      }
    }
    return '—';
  };

  const getAggValue = (colId: string, row: AggRow, idx: number): string | number => {
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
      case 's_bfwd':         return row.bfwd;
      case 's_balance':      return row.balance;
      default: return '—';
    }
  };

  const getColTotal = (colId: string): number => {
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
  };

  const isNumericCol = (colId: string) =>
    !['sn','client','site','tin','date','vatDate','dueDate','invoiceNo','billingCycle',
      'vatInc','status','remMonth','remYear','project',
      's_sn','s_client','s_tin'].includes(colId);

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
      const next = prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src];
      return next.length === 0 ? prev : next;
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
    const fileName = `${selectedSources.map(s => s.toLowerCase()).join('_')}_report_${selectedYear}.csv`;

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
        <DialogHeader className="bg-indigo-700 px-4 py-3 border-b border-indigo-800 shadow-md shrink-0 print:hidden text-left z-20">
          <div className="flex justify-between items-center w-full gap-3">
            <DialogTitle className="text-white font-bold text-base tracking-wide flex items-center gap-3 min-w-0">
              <button onClick={() => onOpenChange(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0" aria-label="Close">
                <X className="h-5 w-5 text-white" />
              </button>
              <span className="text-white/50 text-sm font-normal shrink-0">Report Builder</span>
              <span className="text-white font-bold truncate">{reportTitle}</span>
              {isMultiSource && (
                <span className="text-[11px] bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full shrink-0">
                  Grouped by Client
                </span>
              )}
            </DialogTitle>
            <div className="flex gap-2 items-center shrink-0">
              <span className="text-white/40 text-xs hidden sm:block">
                {rowCount} {isMultiSource ? 'client(s)' : 'record(s)'}
              </span>
              <Button variant="secondary" size="sm" className="gap-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                onClick={handleExportCSV} disabled={rowCount === 0}>
                <Upload className="h-4 w-4" /><span className="hidden sm:inline">Export CSV</span>
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => window.print()} disabled={rowCount === 0}>
                <Printer className="h-4 w-4" /><span className="hidden sm:inline">Print / PDF</span>
              </Button>
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
                  {(['INVOICE','PAYMENT','VAT'] as DataSource[]).map(src => {
                    const active = selectedSources.includes(src);
                    return (
                      <button key={src} onClick={() => toggleSource(src)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${active ? SOURCE_TOGGLE_ON[src] : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${active ? 'border-current' : 'border-slate-300'}`}>
                          {active && <div className="w-2 h-2 rounded-sm bg-current" />}
                        </div>
                        {SOURCE_LABELS[src]}
                      </button>
                    );
                  })}
                </div>
                {isMultiSource && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                    <p className="text-[11px] text-amber-800 font-semibold flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      One row per client. <strong>Balance Due</strong> is computed from <em>all historical data</em> — not just the filtered period.
                    </p>
                  </div>
                )}
              </div>

              {/* Year */}
              <div>
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wide mb-2">Year</h4>
                <select className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
                  value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                  {Array.from({ length: currentYear - YEAR_RANGE_START + 2 }, (_, i) => YEAR_RANGE_START + i)
                    .reverse().map(yr => <option key={yr} value={yr}>{yr}</option>)}
                </select>
                {selectedSources.includes('VAT') && (
                  <p className="text-[10px] text-slate-400 italic mt-1">VAT: filters by period year, not payment date</p>
                )}
                {isMultiSource && (
                  <p className="text-[10px] text-slate-400 italic mt-1"><strong>B/F</strong> = balance accrued before {selectedYear}</p>
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
                          : col.id === 's_bfwd' || col.id === 's_balance' ? 'CROSS'
                          : 'SHARED')
                        : (SHARED_IDS.has(col.id) ? 'SHARED' : col.sources.length === 1 ? col.sources[0] : 'SHARED');

                      const showHeader = group !== lastGroup;
                      lastGroup = group;

                      const groupLabel =
                        group === 'SHARED'  ? '— Common Fields —' :
                        group === 'INVOICE' ? (isMultiSource ? '— Invoice Totals —'  : '— Invoice Fields —')  :
                        group === 'PAYMENT' ? (isMultiSource ? '— Payment Totals —'  : '— Payment Fields —')  :
                        group === 'VAT'     ? (isMultiSource ? '— VAT Totals —'      : '— VAT Fields —')      :
                                              '— Accounting Balance —';
                      const groupColor =
                        group === 'INVOICE' ? 'text-blue-500'    :
                        group === 'PAYMENT' ? 'text-emerald-600' :
                        group === 'VAT'     ? 'text-amber-600'   :
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
                    {selectedYear} · {selectedMonths.length === 12 ? 'All Months' : `${selectedMonths.length} month(s)`}
                    {selectedClients.length !== availableClients.length ? ` · ${selectedClients.length} client(s)` : ''}
                    {isMultiSource ? ` · ${aggregatedRows.length} unique client(s)` : ` · ${recordsToPrint.length} record(s)`}
                  </p>
                  {isMultiSource && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      Balance Due and B/F reflect all-time data across all years, not just {selectedYear}.
                    </p>
                  )}
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
