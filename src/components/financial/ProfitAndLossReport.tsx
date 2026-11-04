import React, { useMemo, useState } from 'react';
import { useAppStore, Invoice } from '@/src/store/appStore';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { NairaSign } from '@/src/components/ui/naira-sign';
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  ShieldAlert,
  FileText,
  ArrowUpRight,
  Building2,
  SlidersHorizontal,
  PieChart,
  Calendar,
  ArrowUpDown,
  Download,
  X,
  Check,
  Lock,
  ReceiptText,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/integrations/supabase/client';
import {
  ChartAccount,
  DCEL_CHART_OF_ACCOUNTS,
  DEFAULT_CATEGORY_COA_MAP,
  resolveCategoryAccountCode,
} from '@/src/constants/chartOfAccounts';
import { TransactionDrilldownDialog, DrillEntry } from './TransactionDrilldownDialog';
import { toast } from '@/src/components/ui/toast';
import * as XLSX from 'xlsx';

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES = FULL_MONTHS;

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtAmount(n: number): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface PnlStatementRow {
  id: string;
  date: string;
  description: string;
  sourceType: 'in' | 'out' | 'bf';
  moneyIn: number;
  moneyOut: number;
  balance: number;
  client: string;
  payeeOrVendor: string;
  categoryOrStream: string;
  ref: string;
  voucherNo?: string;
  site?: string;
  isBroughtForward?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAccounting(n: number) {
  if (Math.abs(n) < 0.005) return '—';
  if (n < 0) return `(${fmt(Math.abs(n))})`;
  return fmt(n);
}

function invoiceLines(inv: Invoice) {
  const rental = (inv.rentalCost || 0) + (inv.auxiliaryCost || 0);
  const installation = inv.installation || 0;
  const mob = inv.mobDemob || 0;
  const diesel = inv.dieselCost || 0;
  const tech = inv.techniciansCost || 0;
  const damages = inv.damages || 0;
  const discount = inv.discount || 0;
  const vat = inv.vat || 0;
  const subtotal =
    inv.totalExclusiveOfVat ||
    Math.max(0, rental + installation + mob + diesel + tech + damages - discount);
  const total = inv.totalCharge || subtotal + vat;
  return { rental, installation, mob, diesel, tech, damages, discount, vat, subtotal, total };
}

interface ProfitAndLossReportProps {
  filterYears: (string | number)[];
  filterMonths: string[];
  filterClient?: string;
}

interface CategoryBreakdownRow {
  categoryName: string;
  amount: number;
  count: number;
  entries: DrillEntry[];
}

interface CoaStatementLine {
  code: string;
  name: string;
  section: 'REVENUE' | 'DIRECT_COST' | 'OPERATING_EXPENSE' | 'NON_PNL';
  amount: number;
  count: number;
  entries: DrillEntry[];
  categoryBreakdowns: CategoryBreakdownRow[];
}

export function ProfitAndLossReport({
  filterYears,
  filterMonths,
  filterClient,
}: ProfitAndLossReportProps) {
  const invoices = useAppStore((s) => s.invoices);
  const payments = useAppStore((s) => s.payments);
  const ledgerEntries = useAppStore((s) => s.ledgerEntries);
  const ledgerCategories = useAppStore((s) => s.ledgerCategories);
  const sites = useAppStore((s) => s.sites);
  const pendingSites = useAppStore((s) => s.pendingSites);
  const payrollVariables = useAppStore((s) => s.payrollVariables);
  const updatePayrollVariables = useAppStore((s) => s.updatePayrollVariables);
  const addLedgerCategory = useAppStore((s) => s.addLedgerCategory);

  const [activeSubView, setActiveSubView] = useState<'minimalist' | 'statement' | 'scrutiny'>('minimalist');
  const fetchLedgerYearIfNeeded = useAppStore((s) => s.fetchLedgerYearIfNeeded);

  // ─── Filter & View States for Minimalist Statement (Petty Cash style) ────
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [dialogVoucher, setDialogVoucher] = useState<string | null>(null);

  // Automatically fetch ledger years for all selected years
  React.useEffect(() => {
    const currentYear = new Date().getFullYear();
    fetchLedgerYearIfNeeded(currentYear);
    fetchLedgerYearIfNeeded(currentYear - 1);
  }, [fetchLedgerYearIfNeeded]);

  React.useEffect(() => {
    filterYears.forEach((y) => {
      const num = parseInt(String(y), 10);
      if (!isNaN(num) && num > 2000 && num < 2100) {
        fetchLedgerYearIfNeeded(num);
      }
    });
  }, [filterYears, fetchLedgerYearIfNeeded]);

  // Period display labels synced with Account Report Filters
  const periodLabel = useMemo(() => {
    const isAllYears = filterYears.length === 0 || filterYears.includes('All') || filterYears.includes('ALL');
    const isAllMonths = filterMonths.length === 0 || filterMonths.includes('All') || filterMonths.includes('ALL');

    if (isAllYears && isAllMonths) return 'All Time';

    const yLabel = isAllYears ? 'All Years' : filterYears.join(', ');

    if (isAllMonths) {
      return isAllYears ? 'All Time' : `${yLabel} (All Months)`;
    }

    const mLabels = filterMonths.map((m) => {
      const idx = parseInt(String(m), 10);
      if (!isNaN(idx) && idx >= 1 && idx <= 12) return SHORT_MONTHS[idx - 1];
      const found = FULL_MONTHS.indexOf(String(m));
      return found >= 0 ? SHORT_MONTHS[found] : m;
    }).join(', ');

    return `${mLabels} ${yLabel}`;
  }, [filterYears, filterMonths]);

  const fullPeriodLabel = useMemo(() => {
    const isAllYears = filterYears.length === 0 || filterYears.includes('All') || filterYears.includes('ALL');
    const isAllMonths = filterMonths.length === 0 || filterMonths.includes('All') || filterMonths.includes('ALL');

    if (isAllYears && isAllMonths) return 'All Time Financial Statement';

    const yLabel = isAllYears ? 'All Years' : filterYears.join(', ');

    if (isAllMonths) {
      return `Full Year ${yLabel} (All Months)`;
    }

    const mLabels = filterMonths.map((m) => {
      const idx = parseInt(String(m), 10);
      if (!isNaN(idx) && idx >= 1 && idx <= 12) return MONTH_NAMES[idx - 1];
      const found = FULL_MONTHS.indexOf(String(m));
      return found >= 0 ? MONTH_NAMES[found] : m;
    }).join(', ');

    return `${mLabels} ${yLabel}`;
  }, [filterYears, filterMonths]);

  // Period & client matching helper (supports 'All'/'ALL', numeric month strings '1'..'12', and month names)
  const isInSelectedPeriod = React.useCallback((dateStr?: string, clientVal?: string) => {
    if (!dateStr) return false;
    const norm = normalizeDate(dateStr);
    if (!norm) return false;
    const yrStr = norm.substring(0, 4);
    const mthIdx = parseInt(norm.substring(5, 7), 10);
    const mthNumStr = String(mthIdx);
    const mthName = FULL_MONTHS[mthIdx - 1] || '';

    const yearStrs = filterYears.map(String);
    if (yearStrs.length > 0 && !yearStrs.includes('All') && !yearStrs.includes('ALL') && !yearStrs.includes(yrStr)) {
      return false;
    }
    if (
      filterMonths.length > 0 &&
      !filterMonths.includes('All') &&
      !filterMonths.includes('ALL') &&
      !filterMonths.includes(mthNumStr) &&
      !filterMonths.includes(mthName)
    ) {
      return false;
    }
    if (
      filterClient &&
      filterClient !== 'All' &&
      filterClient !== 'ALL' &&
      (clientVal || '').trim().toLowerCase() !== filterClient.trim().toLowerCase()
    ) {
      return false;
    }
    return true;
  }, [filterYears, filterMonths, filterClient]);

  // Starting date threshold for Brought Forward (b/f) balance
  const periodStartDate = useMemo(() => {
    const isAllYears = filterYears.length === 0 || filterYears.includes('All') || filterYears.includes('ALL');
    if (isAllYears) return null;

    const numericYears = filterYears.map((y) => parseInt(String(y), 10)).filter((y) => !isNaN(y));
    if (numericYears.length === 0) return null;
    const minYear = Math.min(...numericYears);

    const isAllMonths = filterMonths.length === 0 || filterMonths.includes('All') || filterMonths.includes('ALL');
    if (isAllMonths) {
      return `${minYear}-01-01`;
    }

    const numericMonths = filterMonths.map((m) => {
      const idx = parseInt(String(m), 10);
      if (!isNaN(idx) && idx >= 1 && idx <= 12) return idx;
      const found = FULL_MONTHS.indexOf(String(m));
      return found >= 0 ? found + 1 : 1;
    });
    const minMonth = Math.min(...numericMonths);
    return `${minYear}-${String(minMonth).padStart(2, '0')}-01`;
  }, [filterYears, filterMonths]);

  // Balance Brought Forward (b/f) — Cumulative prior Revenue In minus prior Expense Out
  // Rule: Zero-deficit rule — negative balance is capped at 0
  const balanceBroughtForward = useMemo(() => {
    if (!periodStartDate) return 0;

    const priorIncome = payments.reduce((sum, p) => {
      const norm = normalizeDate(p.date);
      if (!norm || norm >= periodStartDate) return sum;
      if (filterClient && filterClient !== 'All' && (p.client || '').toLowerCase() !== filterClient.toLowerCase()) return sum;
      return sum + (Number(p.amount) || 0);
    }, 0);

    const priorExpenses = ledgerEntries.reduce((sum, e) => {
      const norm = normalizeDate(e.date);
      if (!norm || norm >= periodStartDate) return sum;
      const resolvedClient = e.client || sites.find((s) => s.name?.toLowerCase() === e.site?.trim().toLowerCase())?.client || '';
      if (filterClient && filterClient !== 'All' && resolvedClient.toLowerCase() !== filterClient.toLowerCase()) return sum;
      return sum + (Number(e.amount) || 0);
    }, 0);

    const rawDiff = priorIncome - priorExpenses;
    return Math.max(0, rawDiff);
  }, [periodStartDate, payments, ledgerEntries, filterClient, sites]);

  // Build unified chronological Profit & Loss Statement Rows
  // Money In = Client Payments, Money Out = Ledger Expenses
  const statementRows = useMemo(() => {
    const rawRows: PnlStatementRow[] = [];

    // 1. Client Payments -> Revenue (Money In)
    payments.forEach((p) => {
      if (!isInSelectedPeriod(p.date, p.client)) return;
      const norm = normalizeDate(p.date);
      if (!norm) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      const desc = p.reference
        ? `Payment from ${p.client} — ${p.reference}`
        : p.invoiceNumber
        ? `Payment from ${p.client} (Inv #${p.invoiceNumber})`
        : `Payment from ${p.client}${p.site ? ` [${p.site}]` : ''}`;

      rawRows.push({
        id: `pay_${p.id}`,
        date: norm,
        description: desc,
        sourceType: 'in',
        moneyIn: amt,
        moneyOut: 0,
        balance: 0,
        client: p.client || '—',
        payeeOrVendor: p.paidTo || 'Bank Account',
        categoryOrStream: p.invoiceNumber ? `Invoice #${p.invoiceNumber}` : 'Client Payment',
        ref: p.invoiceNumber ? `#${p.invoiceNumber}` : (p.reference || 'PAY'),
        site: p.site,
      });
    });

    // 2. Ledger Entries -> Operational Expenses (Money Out)
    ledgerEntries.forEach((e) => {
      const resolvedClient = e.client || sites.find((s) => s.name?.toLowerCase() === e.site?.trim().toLowerCase())?.client || '';
      if (!isInSelectedPeriod(e.date, resolvedClient)) return;
      const norm = normalizeDate(e.date);
      if (!norm) return;

      const amt = Number(e.amount) || 0;
      if (amt <= 0) return;

      rawRows.push({
        id: `ldg_${e.id}`,
        date: norm,
        description: e.description || e.category || 'Ledger Expense',
        sourceType: 'out',
        moneyIn: 0,
        moneyOut: amt,
        balance: 0,
        client: resolvedClient || '—',
        payeeOrVendor: e.vendor || e.bank || '—',
        categoryOrStream: e.category || 'Expense',
        ref: e.voucherNo || 'VCH',
        voucherNo: e.voucherNo,
        site: e.site,
      });
    });

    // Sort chronologically ascending to calculate running balance
    rawRows.sort((a, b) => a.date.localeCompare(b.date));

    // Running Balance computation
    let running = periodStartDate ? balanceBroughtForward : 0;
    rawRows.forEach((r) => {
      running += r.moneyIn - r.moneyOut;
      r.balance = running;
    });

    // Synthetic Balance Brought Forward row at position 0
    const finalRows: PnlStatementRow[] = [];
    if (periodStartDate && balanceBroughtForward > 0) {
      finalRows.push({
        id: '__bf__',
        date: periodStartDate,
        description: `Balance brought forward (b/f prior to ${periodLabel})`,
        sourceType: 'bf',
        moneyIn: balanceBroughtForward,
        moneyOut: 0,
        balance: balanceBroughtForward,
        client: '—',
        payeeOrVendor: '—',
        categoryOrStream: 'Opening Balance',
        ref: 'B/F',
        isBroughtForward: true,
      });
    }

    if (sortOrder === 'desc') {
      return [...finalRows, ...rawRows.reverse()];
    }
    return [...finalRows, ...rawRows];
  }, [payments, ledgerEntries, sites, balanceBroughtForward, periodStartDate, periodLabel, sortOrder, isInSelectedPeriod]);

  // Filtered rows for the view
  const displayRows = useMemo(() => {
    return statementRows.filter((r) => {
      if (typeFilter === 'in' && r.sourceType !== 'in' && r.sourceType !== 'bf') return false;
      if (typeFilter === 'out' && r.sourceType !== 'out') return false;
      if (!search.trim()) return true;
      if (r.isBroughtForward) return true;
      const q = search.toLowerCase();
      return (
        r.description.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        r.payeeOrVendor.toLowerCase().includes(q) ||
        r.categoryOrStream.toLowerCase().includes(q) ||
        r.ref.toLowerCase().includes(q) ||
        (r.site && r.site.toLowerCase().includes(q))
      );
    });
  }, [statementRows, typeFilter, search]);

  const periodMoneyIn = useMemo(
    () => statementRows.filter((r) => r.sourceType === 'in').reduce((s, r) => s + r.moneyIn, 0),
    [statementRows]
  );

  const periodMoneyOut = useMemo(
    () => statementRows.filter((r) => r.sourceType === 'out').reduce((s, r) => s + r.moneyOut, 0),
    [statementRows]
  );

  const closingBalance = useMemo(
    () => balanceBroughtForward + periodMoneyIn - periodMoneyOut,
    [balanceBroughtForward, periodMoneyIn, periodMoneyOut]
  );

  const netProfitMargin = useMemo(
    () => (periodMoneyIn > 0 ? ((periodMoneyIn - periodMoneyOut) / periodMoneyIn) * 100 : 0),
    [periodMoneyIn, periodMoneyOut]
  );

  // Summary Modal Breakdowns
  const summaryData = useMemo(() => {
    const clientMap = new Map<string, { count: number; total: number }>();
    statementRows.filter((r) => r.sourceType === 'in').forEach((r) => {
      const c = r.client || 'Unspecified';
      const cur = clientMap.get(c) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.moneyIn;
      clientMap.set(c, cur);
    });
    const clientBreakdown = Array.from(clientMap.entries())
      .map(([client, info]) => ({
        client,
        count: info.count,
        total: info.total,
        pct: periodMoneyIn > 0 ? (info.total / periodMoneyIn) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const catMap = new Map<string, { count: number; total: number }>();
    statementRows.filter((r) => r.sourceType === 'out').forEach((r) => {
      const cat = r.categoryOrStream || 'Uncategorized';
      const cur = catMap.get(cat) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.moneyOut;
      catMap.set(cat, cur);
    });
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, info]) => ({
        category,
        count: info.count,
        total: info.total,
        pct: periodMoneyOut > 0 ? (info.total / periodMoneyOut) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const vendorMap = new Map<string, { count: number; total: number }>();
    statementRows.filter((r) => r.sourceType === 'out').forEach((r) => {
      const v = r.payeeOrVendor || 'Unspecified';
      const cur = vendorMap.get(v) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.moneyOut;
      vendorMap.set(v, cur);
    });
    const vendorBreakdown = Array.from(vendorMap.entries())
      .map(([vendor, info]) => ({
        vendor,
        count: info.count,
        total: info.total,
        pct: periodMoneyOut > 0 ? (info.total / periodMoneyOut) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const balanceCarriedForward = Math.max(0, closingBalance);

    return {
      clientBreakdown,
      categoryBreakdown,
      vendorBreakdown,
      balanceCarriedForward,
      periodInCount: statementRows.filter((r) => r.sourceType === 'in').length,
      periodOutCount: statementRows.filter((r) => r.sourceType === 'out').length,
    };
  }, [statementRows, periodMoneyIn, periodMoneyOut, closingBalance]);

  // Voucher details dialog calculations
  const dialogTransactions = useMemo(() => {
    if (!dialogVoucher) return [];
    return ledgerEntries.filter((e) => e.voucherNo === dialogVoucher);
  }, [dialogVoucher, ledgerEntries]);

  const vatRate = payrollVariables?.vatRate ?? 7.5;

  const computeLineVat = (amt: number, mode?: string, rate: number = vatRate) => {
    if (!mode || mode === 'No' || !amt || amt <= 0) {
      return { vatAmount: 0, amountForVat: amt || 0, grossAmount: amt || 0 };
    }
    if (mode === 'Yes') {
      const vatAmount = (amt * rate) / 100;
      return { vatAmount, amountForVat: amt, grossAmount: amt + vatAmount };
    }
    if (mode === 'Add') {
      const vatAmount = (amt * rate) / (100 + rate);
      const amountForVat = amt - vatAmount;
      return { vatAmount, amountForVat, grossAmount: amt };
    }
    return { vatAmount: 0, amountForVat: amt || 0, grossAmount: amt || 0 };
  };

  const dialogNetTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = computeLineVat(amt, mode, curr.vatRate || vatRate);
      if (mode === 'No') return acc + amt;
      return acc + (curr.amountForVat ?? calc.amountForVat);
    }, 0);
  }, [dialogTransactions, vatRate]);

  const dialogVatTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = computeLineVat(amt, mode, curr.vatRate || vatRate);
      return acc + (curr.vatAmount ?? calc.vatAmount);
    }, 0);
  }, [dialogTransactions, vatRate]);

  const dialogGrossTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = computeLineVat(amt, mode, curr.vatRate || vatRate);
      return acc + calc.grossAmount;
    }, 0);
  }, [dialogTransactions, vatRate]);

  // Export Minimalist Statement to Excel
  const handleExportMinimalistExcel = () => {
    if (displayRows.length === 0) {
      toast.error('No records to export for this period.');
      return;
    }

    const exportRows: Record<string, any>[] = displayRows.map((r, idx) => ({
      '#': idx + 1,
      Date: formatDisplayDate(r.date),
      Description: r.voucherNo ? `${r.description} [${r.voucherNo}]` : r.description,
      'Revenue In (NGN)': r.moneyIn || '',
      'Expense Out (NGN)': r.moneyOut || '',
      'Net Balance (NGN)': r.balance,
      'Client / Source': r.client,
      'Category / Stream': r.categoryOrStream,
      'Payee / Vendor': r.payeeOrVendor,
      Ref: r.ref,
    }));

    exportRows.push({
      '#': '',
      Date: '',
      Description: `TOTAL / CLOSING BALANCE (${periodLabel.toUpperCase()})`,
      'Revenue In (NGN)': periodMoneyIn,
      'Expense Out (NGN)': periodMoneyOut,
      'Net Balance (NGN)': closingBalance,
      'Client / Source': '',
      'Category / Stream': '',
      'Payee / Vendor': '',
      Ref: '',
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Statement');
    XLSX.writeFile(wb, `Profit_And_Loss_${filterYears.join('_')}_${filterMonths.join('_')}.xlsx`);
  };

  const [revenueBasis, setRevenueBasis] = useState<'accrual' | 'cash'>('accrual');
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [showZeroAccounts, setShowZeroAccounts] = useState<boolean>(false);

  // Scrutiny Filters
  const [scrutinyFlagFilter, setScrutinyFlagFilter] = useState<
    'ALL' | 'UNALLOCATED' | 'HIGH_VALUE' | 'MISSING_META' | 'DIRECT_NO_SITE'
  >('ALL');
  const [scrutinySearch, setScrutinySearch] = useState('');
  const [scrutinyCategoryFilter, setScrutinyCategoryFilter] = useState('ALL');

  // Drilldown modal state
  const [drilldownState, setDrilldownState] = useState<{
    isOpen: boolean;
    title: string;
    code: string;
    entries: DrillEntry[];
  }>({ isOpen: false, title: '', code: '', entries: [] });

  // Company details for formal header
  const [companyDetails, setCompanyDetails] = useState({
    name: 'DEWATERING CONSTRUCTION ETC LIMITED',
    address: '59C Fola Jinadu Crescent, Gbagada Phase 1, Lagos',
    rc: '1405875',
    tin: '20545295-0001',
  });

  React.useEffect(() => {
    supabase
      .from('app_settings')
      .select('company_details')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data?.company_details && Object.keys(data.company_details).length > 0) {
          setCompanyDetails((prev) => ({ ...prev, ...data.company_details }));
        }
      });
  }, []);

  // Active Chart of Accounts & Category Mapping from Store Variables
  const activeChartOfAccounts = useMemo<ChartAccount[]>(() => {
    const list =
      payrollVariables?.chartOfAccounts && payrollVariables.chartOfAccounts.length > 0
        ? payrollVariables.chartOfAccounts
        : DCEL_CHART_OF_ACCOUNTS;
    return [...list].sort((a, b) => a.code.localeCompare(b.code));
  }, [payrollVariables?.chartOfAccounts]);

  const activeCategoryCoaMap = useMemo<Record<string, string>>(
    () => ({
      ...DEFAULT_CATEGORY_COA_MAP,
      ...(payrollVariables?.categoryCoaMap || {}),
    }),
    [payrollVariables?.categoryCoaMap]
  );

  const coaByCode = useMemo(() => {
    const map = new Map<string, ChartAccount>();
    activeChartOfAccounts.forEach((acc) => map.set(acc.code, acc));
    return map;
  }, [activeChartOfAccounts]);

  const handleQuickAssignCoa = (categoryName: string, accountCode: string) => {
    const nextMap = { ...activeCategoryCoaMap };
    if (!accountCode) {
      delete nextMap[categoryName];
    } else {
      nextMap[categoryName] = accountCode;
    }
    updatePayrollVariables({ categoryCoaMap: nextMap });
    if (
      categoryName &&
      !ledgerCategories.some((c) => c.name.toLowerCase() === categoryName.toLowerCase())
    ) {
      addLedgerCategory({ id: crypto.randomUUID(), name: categoryName });
    }
    toast.success(
      accountCode
        ? `Allocated "${categoryName}" to CoA [${accountCode}]`
        : `Cleared CoA allocation for "${categoryName}"`
    );
  };

// isInSelectedPeriod is declared above

  // Filtered datasets
  const periodInvoices = useMemo(
    () => invoices.filter((inv) => isInSelectedPeriod(inv.date, inv.client)),
    [invoices, filterYears, filterMonths, filterClient]
  );

  const periodPayments = useMemo(
    () => payments.filter((p) => isInSelectedPeriod(p.date, p.client)),
    [payments, filterYears, filterMonths, filterClient]
  );

  const periodExpenses = useMemo(
    () =>
      ledgerEntries.filter((e) => {
        const resolvedClient =
          e.client ||
          sites.find((s) => s.name?.toLowerCase() === e.site?.trim().toLowerCase())?.client ||
          '';
        return isInSelectedPeriod(e.date, resolvedClient);
      }),
    [ledgerEntries, sites, filterYears, filterMonths, filterClient]
  );

  // Build Profit & Loss Statement Data & Scrutiny Metrics
  const pnlData = useMemo(() => {
    // 1. REVENUE LINES (4000 - 4099)
    const revMap = new Map<string, CoaStatementLine>();
    const ensureRevLine = (code: string, fallbackName: string) => {
      if (!revMap.has(code)) {
        const acc = coaByCode.get(code);
        revMap.set(code, {
          code,
          name: acc?.name || fallbackName,
          section: 'REVENUE',
          amount: 0,
          count: 0,
          entries: [],
          categoryBreakdowns: [],
        });
      }
      return revMap.get(code)!;
    };

    // Initialize standard revenue accounts from CoA
    activeChartOfAccounts
      .filter((a) => a.type === 'INCOME' || a.category === 'REVENUE')
      .forEach((a) => ensureRevLine(a.code, a.name));

    let totalDiscountsGranted = 0;
    const discountEntries: DrillEntry[] = [];

    // Helper to resolve whether an invoice/payment belongs to Dewatering, Waterproofing, Allied, etc.
    const resolveServiceCode = (party?: string, siteNameOrProject?: string, siteId?: string, description?: string): { code: string; name: string } => {
      const clientLow = (party || '').toLowerCase();
      const siteLow = (siteNameOrProject || '').toLowerCase();
      const descLow = (description || '').toLowerCase();

      // 1. Check linked site
      const siteObj = sites.find(s => (siteId && s.id === siteId) || s.name.trim().toLowerCase() === siteLow);
      if (siteObj?.projectType && siteObj.projectType.trim().toUpperCase() !== 'DEWATERING') {
        const pt = siteObj.projectType.trim().toUpperCase();
        if (pt.includes('WATERPROOF')) return { code: '4010', name: 'Revenue — Waterproofing Services' };
        if (pt.includes('ALLIED') || pt.includes('TILING') || pt.includes('JETTING') || pt.includes('GROUND')) return { code: '4020', name: 'Revenue — Allied & Ground Improvement Services' };
        if (pt.includes('SALES')) return { code: '4030', name: 'Revenue — Equipment Sales' };
        if (pt.includes('MAINTENANCE')) return { code: '4040', name: 'Revenue — Equipment Maintenance & Overhaul' };
      }

      // 2. Check pendingSites questionnaires
      const q = (pendingSites || []).find(ps =>
        (siteId && ps.siteId === siteId) ||
        (ps.siteName?.trim().toLowerCase() === siteLow && ps.clientName?.trim().toLowerCase() === clientLow) ||
        (ps.siteName?.trim().toLowerCase() === siteLow)
      );
      const qBuilt = (
        q?.phase1?.whatIsBeingBuilt ||
        (q as any)?.service ||
        (q as any)?.serviceName ||
        (q as any)?.data?.phase1?.whatIsBeingBuilt ||
        ''
      ).toLowerCase();
      if (qBuilt.includes('waterproof')) return { code: '4010', name: 'Revenue — Waterproofing Services' };
      if (qBuilt.includes('allied') || qBuilt.includes('tiling') || qBuilt.includes('jetting')) return { code: '4020', name: 'Revenue — Allied & Ground Improvement Services' };

      // 3. Check client or explicit descriptions
      if (clientLow.includes('first bank') || siteLow.includes('waterproof') || descLow.includes('waterproof')) {
        return { code: '4010', name: 'Revenue — Waterproofing Services' };
      }
      if (descLow.includes('allied') || descLow.includes('ground improvement') || descLow.includes('jetting') || descLow.includes('tiling')) {
        return { code: '4020', name: 'Revenue — Allied & Ground Improvement Services' };
      }
      if (descLow.includes('equipment sale') || descLow.includes('sale of equipment') || descLow.includes('pump sale')) {
        return { code: '4030', name: 'Revenue — Equipment Sales' };
      }
      if (descLow.includes('maintenance') || descLow.includes('overhaul') || descLow.includes('repair service')) {
        return { code: '4040', name: 'Revenue — Equipment Maintenance & Overhaul' };
      }
      if (descLow.includes('spare part') || descLow.includes('spares sale')) {
        return { code: '4050', name: 'Revenue — Spare Parts Sales' };
      }

      // Default: Dewatering Services (Code 4000)
      return { code: '4000', name: 'Revenue — Dewatering Services' };
    };

    if (revenueBasis === 'accrual') {
      periodInvoices.forEach((inv) => {
        const lines = invoiceLines(inv);
        const { code, name } = resolveServiceCode(inv.client, inv.siteName || inv.project, inv.siteId, (inv as any).description);

        const addInvSlice = (sliceAmount: number, label: string) => {
          if (sliceAmount <= 0) return;
          const row = ensureRevLine(code, name);
          row.amount += sliceAmount;
          row.count += 1;

          const entry: DrillEntry = {
            id: `${inv.id}-${code}-${label.replace(/\s+/g, '_')}`,
            date: inv.date,
            ref: inv.invoiceNumber || 'INV',
            party: inv.client,
            site: inv.siteName || inv.project,
            category: label,
            description: `${label} — ${inv.siteName || inv.project || inv.client}`,
            amount: sliceAmount,
            side: 'credit',
            details: inv as unknown as Record<string, unknown>,
          };

          // Track category breakdown inside this account
          let cat = row.categoryBreakdowns.find(
            (c) => c.categoryName.toLowerCase() === label.toLowerCase()
          );
          if (!cat) {
            cat = { categoryName: label, amount: 0, count: 0, entries: [] };
            row.categoryBreakdowns.push(cat);
          }
          cat.amount += sliceAmount;
          cat.count += 1;
          cat.entries.push(entry);
          row.entries.push(entry);
        };

        if (code === '4010') {
          // Waterproofing project: All installation is Waterproofing Installation!
          if (lines.installation > 0) addInvSlice(lines.installation, 'Waterproofing Installation & Application');
          if (lines.rental > 0) addInvSlice(lines.rental, 'Waterproofing Equipment & Material Billing');
          if (lines.mob > 0) addInvSlice(lines.mob, 'Mobilisation & Logistics');
          if (lines.diesel > 0) addInvSlice(lines.diesel, 'Site Diesel Supply');
          if (lines.tech > 0) addInvSlice(lines.tech, 'Technician & Application Labor');
          if (lines.damages > 0) addInvSlice(lines.damages, 'Damages & Ancillary Recovery');
          const itemizedSum = lines.rental + lines.installation + lines.mob + lines.diesel + lines.tech + lines.damages;
          if (lines.subtotal > itemizedSum) {
            addInvSlice(lines.subtotal - itemizedSum, 'Waterproofing Contract Billing');
          }
        } else if (code === '4000') {
          // Dewatering project: Dewatering installation is kept strictly under Dewatering!
          if (lines.rental > 0) addInvSlice(lines.rental, 'Dewatering Equipment Rental Fleet');
          if (lines.installation > 0) addInvSlice(lines.installation, 'Dewatering Installation & Piping Setup');
          if (lines.mob > 0) addInvSlice(lines.mob, 'Mobilisation & Demobilisation');
          if (lines.diesel > 0) addInvSlice(lines.diesel, 'Site Diesel Supply');
          if (lines.tech > 0) addInvSlice(lines.tech, 'Field Operations & Technicians Supervision');
          if (lines.damages > 0) addInvSlice(lines.damages, 'Damages & Ancillary Recovery');
          const itemizedSum = lines.rental + lines.installation + lines.mob + lines.diesel + lines.tech + lines.damages;
          if (lines.subtotal > itemizedSum) {
            addInvSlice(lines.subtotal - itemizedSum, 'General Dewatering Operations Billing');
          }
        } else {
          // Other specialized service streams (Allied, Equipment Sales, Maintenance, Spare parts)
          addInvSlice(lines.subtotal, name);
        }

        if (lines.discount > 0) {
          totalDiscountsGranted += lines.discount;
          discountEntries.push({
            id: `${inv.id}-disc`,
            date: inv.date,
            ref: inv.invoiceNumber || 'INV',
            party: inv.client,
            site: inv.siteName || inv.project,
            category: 'Discount',
            description: `Invoice Discount Allowed — ${inv.invoiceNumber || inv.siteName || inv.project}`,
            amount: lines.discount,
            side: 'debit',
            details: inv as unknown as Record<string, unknown>,
          });
        }
      });
    } else {
      // Cash basis: recognized from collected client payments
      periodPayments.forEach((p) => {
        const val = p.amount || 0;
        const pRef = (p as { reference?: string }).reference;
        if (val > 0) {
          const { code, name } = resolveServiceCode(p.client, p.site, undefined, (p as any).notes);
          const row = ensureRevLine(code, name);
          row.amount += val;
          row.count += 1;
          const entry: DrillEntry = {
            id: p.id,
            date: p.date,
            ref: pRef || p.invoiceNumber || 'PMT',
            party: p.client,
            site: p.site,
            bank: p.paidTo,
            description: `Payment Received (${p.paidTo || 'Bank'}) — ${name}`,
            amount: val,
            side: 'credit',
            details: p as unknown as Record<string, unknown>,
          };
          row.entries.push(entry);

          const catName = 'Client Collections';
          let cat = row.categoryBreakdowns.find(
            (c) => c.categoryName.toLowerCase() === catName.toLowerCase()
          );
          if (!cat) {
            cat = { categoryName: catName, amount: 0, count: 0, entries: [] };
            row.categoryBreakdowns.push(cat);
          }
          cat.amount += val;
          cat.count += 1;
          cat.entries.push(entry);
        }
        if ((p.discount || 0) > 0) {
          totalDiscountsGranted += p.discount || 0;
          discountEntries.push({
            id: `${p.id}-disc`,
            date: p.date,
            ref: pRef || 'PMT-DISC',
            party: p.client,
            site: p.site,
            description: 'Settlement Discount Granted',
            amount: p.discount || 0,
            side: 'debit',
            details: p as unknown as Record<string, unknown>,
          });
        }
      });
    }

    // 2. EXPENSE LEDGER CLASSIFICATION (Direct Costs vs OPEX vs Non-P&L Capital/Tax)
    const directCostMap = new Map<string, CoaStatementLine>();
    const opexMap = new Map<string, CoaStatementLine>();
    const nonPnlMap = new Map<string, CoaStatementLine>();

    activeChartOfAccounts
      .filter((a) => a.category === 'DIRECT_COST')
      .forEach((a) => {
        directCostMap.set(a.code, {
          code: a.code,
          name: a.name,
          section: 'DIRECT_COST',
          amount: 0,
          count: 0,
          entries: [],
          categoryBreakdowns: [],
        });
      });

    activeChartOfAccounts
      .filter((a) => a.category === 'OPERATING_EXPENSE')
      .forEach((a) => {
        opexMap.set(a.code, {
          code: a.code,
          name: a.name,
          section: 'OPERATING_EXPENSE',
          amount: 0,
          count: 0,
          entries: [],
          categoryBreakdowns: [],
        });
      });

    const addExpenseToCoaLine = (
      targetMap: Map<string, CoaStatementLine>,
      code: string,
      name: string,
      section: CoaStatementLine['section'],
      catName: string,
      drill: DrillEntry
    ) => {
      if (!targetMap.has(code)) {
        targetMap.set(code, {
          code,
          name,
          section,
          amount: 0,
          count: 0,
          entries: [],
          categoryBreakdowns: [],
        });
      }
      const line = targetMap.get(code)!;
      line.amount += drill.amount;
      line.count += 1;
      line.entries.push(drill);

      let catGroup = line.categoryBreakdowns.find(
        (c) => c.categoryName.toLowerCase() === catName.toLowerCase()
      );
      if (!catGroup) {
        catGroup = { categoryName: catName, amount: 0, count: 0, entries: [] };
        line.categoryBreakdowns.push(catGroup);
      }
      catGroup.amount += drill.amount;
      catGroup.count += 1;
      catGroup.entries.push(drill);
    };

    periodExpenses.forEach((e) => {
      const amt = e.amount || 0;
      if (amt <= 0) return;
      const catName = (e.category || 'Uncategorized').trim();
      const mappedCode = resolveCategoryAccountCode(catName, activeCategoryCoaMap);
      const coaAcc = mappedCode ? coaByCode.get(mappedCode) : undefined;

      const drill: DrillEntry = {
        id: e.id,
        date: e.date,
        ref: e.voucherNo || 'VCH',
        party: e.vendor || e.client || '—',
        site: e.site,
        category: catName,
        bank: e.bank,
        description: `[${catName}] ${e.description || 'Expense Voucher'}`,
        amount: amt,
        side: 'debit',
        details: e as unknown as Record<string, unknown>,
      };

      if (coaAcc) {
        if (coaAcc.category === 'DIRECT_COST') {
          addExpenseToCoaLine(directCostMap, coaAcc.code, coaAcc.name, 'DIRECT_COST', catName, drill);
        } else if (coaAcc.category === 'OPERATING_EXPENSE') {
          addExpenseToCoaLine(opexMap, coaAcc.code, coaAcc.name, 'OPERATING_EXPENSE', catName, drill);
        } else if (coaAcc.type === 'INCOME' || coaAcc.category === 'REVENUE') {
          addExpenseToCoaLine(revMap, coaAcc.code, coaAcc.name, 'REVENUE', catName, drill);
        } else {
          // Asset (1300 Fixed Assets), Liability (2100 VAT), or Equity
          addExpenseToCoaLine(nonPnlMap, coaAcc.code, coaAcc.name, 'NON_PNL', catName, drill);
        }
      } else {
        // Unallocated category -> goes into 5999 Suspense / Unallocated Operating Expenses so P&L is 100% complete
        addExpenseToCoaLine(
          opexMap,
          '5999',
          'Unallocated / Suspense Operating Expenses',
          'OPERATING_EXPENSE',
          catName,
          drill
        );
      }
    });

    // Sort category breakdowns descending by spend
    const finalizeLines = (map: Map<string, CoaStatementLine>) =>
      Array.from(map.values())
        .map((line) => ({
          ...line,
          categoryBreakdowns: [...line.categoryBreakdowns].sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => a.code.localeCompare(b.code));

    const revenueLines = finalizeLines(revMap);
    const directCostLines = finalizeLines(directCostMap);
    const opexLines = finalizeLines(opexMap);
    const nonPnlLines = finalizeLines(nonPnlMap);

    const grossTurnover = revenueLines.reduce((s, r) => s + r.amount, 0);
    const netRevenue = Math.max(0, grossTurnover - totalDiscountsGranted);
    const totalDirectCosts = directCostLines.reduce((s, r) => s + r.amount, 0);
    const grossProfit = netRevenue - totalDirectCosts;
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const totalOpex = opexLines.reduce((s, r) => s + r.amount, 0);
    const netOperatingProfit = grossProfit - totalOpex;
    const netMarginPct = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

    const totalNonPnlDisbursements = nonPnlLines.reduce((s, r) => s + r.amount, 0);
    const totalLedgerDisbursements = totalDirectCosts + totalOpex + totalNonPnlDisbursements;

    return {
      revenueLines,
      totalDiscountsGranted,
      discountEntries,
      grossTurnover,
      netRevenue,
      directCostLines,
      totalDirectCosts,
      grossProfit,
      grossMarginPct,
      opexLines,
      totalOpex,
      netOperatingProfit,
      netMarginPct,
      nonPnlLines,
      totalNonPnlDisbursements,
      totalLedgerDisbursements,
    };
  }, [
    periodInvoices,
    periodPayments,
    periodExpenses,
    revenueBasis,
    activeChartOfAccounts,
    activeCategoryCoaMap,
    coaByCode,
  ]);

  // ── EXPENSE LEDGER SCRUTINY ANALYTICS ───────────────────────────────
  const scrutinyAnalytics = useMemo(() => {
    const totalExpenseAmt = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const avgVoucherAmt =
      periodExpenses.length > 0 ? totalExpenseAmt / periodExpenses.length : 0;
    const highValueThreshold = Math.max(500000, avgVoucherAmt * 2.5);

    // Group by category
    const catMap = new Map<
      string,
      {
        category: string;
        coaCode: string | undefined;
        coaName: string;
        coaSection: string;
        count: number;
        total: number;
        maxAmount: number;
        maxVendor: string;
        missingVendorCount: number;
        missingSiteCount: number;
        entries: DrillEntry[];
      }
    >();

    // Include all defined categories so user can see 0-spend categories too if needed
    ledgerCategories.forEach((c) => {
      const code = resolveCategoryAccountCode(c.name, activeCategoryCoaMap);
      const acc = code ? coaByCode.get(code) : undefined;
      catMap.set(c.name, {
        category: c.name,
        coaCode: code,
        coaName: acc ? acc.name : 'Unallocated',
        coaSection: acc ? acc.category : 'UNALLOCATED',
        count: 0,
        total: 0,
        maxAmount: 0,
        maxVendor: '—',
        missingVendorCount: 0,
        missingSiteCount: 0,
        entries: [],
      });
    });

    periodExpenses.forEach((e) => {
      const catName = (e.category || 'Uncategorized').trim();
      const amt = e.amount || 0;
      const code = resolveCategoryAccountCode(catName, activeCategoryCoaMap);
      const acc = code ? coaByCode.get(code) : undefined;

      if (!catMap.has(catName)) {
        catMap.set(catName, {
          category: catName,
          coaCode: code,
          coaName: acc ? acc.name : 'Unallocated',
          coaSection: acc ? acc.category : 'UNALLOCATED',
          count: 0,
          total: 0,
          maxAmount: 0,
          maxVendor: '—',
          missingVendorCount: 0,
          missingSiteCount: 0,
          entries: [],
        });
      }

      const row = catMap.get(catName)!;
      row.count += 1;
      row.total += amt;
      if (amt > row.maxAmount) {
        row.maxAmount = amt;
        row.maxVendor = e.vendor || e.client || '—';
      }
      if (!e.vendor || !e.vendor.trim()) row.missingVendorCount += 1;
      if (!e.site || !e.site.trim()) row.missingSiteCount += 1;
      row.entries.push({
        id: e.id,
        date: e.date,
        ref: e.voucherNo || 'VCH',
        party: e.vendor || e.client || '—',
        site: e.site,
        category: catName,
        bank: e.bank,
        description: e.description || catName,
        amount: amt,
        side: 'debit',
        details: e as unknown as Record<string, unknown>,
      });
    });

    const categoryRows = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
    const unallocatedCategories = categoryRows.filter((c) => !c.coaCode);
    const unallocatedSpend = unallocatedCategories.reduce((s, c) => s + c.total, 0);

    // Enrich individual vouchers with scrutiny flags
    const enrichedVouchers = periodExpenses
      .map((e) => {
        const catName = (e.category || 'Uncategorized').trim();
        const code = resolveCategoryAccountCode(catName, activeCategoryCoaMap);
        const acc = code ? coaByCode.get(code) : undefined;
        const flags: string[] = [];

        if (!code) flags.push('UNALLOCATED');
        if ((e.amount || 0) >= highValueThreshold) flags.push('HIGH_VALUE');
        if (!e.vendor?.trim() || !e.voucherNo?.trim() || !e.description?.trim()) {
          flags.push('MISSING_META');
        }
        if (acc?.category === 'DIRECT_COST' && !e.site?.trim() && !e.client?.trim()) {
          flags.push('DIRECT_NO_SITE');
        }

        return {
          entry: e,
          catName,
          coaCode: code,
          coaName: acc?.name || 'Unallocated',
          coaCategory: acc?.category || 'UNALLOCATED',
          flags,
        };
      })
      .sort((a, b) => (b.entry.amount || 0) - (a.entry.amount || 0));

    const largestVoucher = enrichedVouchers[0]?.entry || null;
    const flaggedCount = enrichedVouchers.filter((v) => v.flags.length > 0).length;
    const hygieneScore =
      periodExpenses.length > 0
        ? Math.max(
          0,
          Math.round(((periodExpenses.length - flaggedCount) / periodExpenses.length) * 100)
        )
        : 100;

    return {
      totalExpenseAmt,
      avgVoucherAmt,
      highValueThreshold,
      categoryRows,
      unallocatedCategories,
      unallocatedSpend,
      enrichedVouchers,
      largestVoucher,
      flaggedCount,
      hygieneScore,
    };
  }, [periodExpenses, ledgerCategories, activeCategoryCoaMap, coaByCode]);

  const toggleExpandCode = (code: string) => {
    setExpandedCodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const expandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      [...pnlData.directCostLines, ...pnlData.opexLines, ...pnlData.nonPnlLines].forEach((l) => {
        next[l.code] = true;
      });
    }
    setExpandedCodes(next);
  };

  const openDrilldown = (title: string, code: string, entries: DrillEntry[]) => {
    if (!entries || entries.length === 0) return;
    setDrilldownState({ isOpen: true, title, code, entries });
  };

  // Export Profit & Loss + Expense Scrutiny to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Statement of Profit or Loss
    const pnlRows: any[] = [
      { Code: '', Account: companyDetails.name, Category_Breakdown: '', Vouchers: '', Amount_NGN: '' },
      {
        Code: '',
        Account: 'STATEMENT OF PROFIT OR LOSS AND EXPENSE SCRUTINY',
        Category_Breakdown: `Basis: ${revenueBasis.toUpperCase()}`,
        Vouchers: '',
        Amount_NGN: '',
      },
      { Code: '', Account: '', Category_Breakdown: '', Vouchers: '', Amount_NGN: '' },
      { Code: 'SECTION I', Account: 'OPERATING REVENUE (TURNOVER)', Category_Breakdown: '', Vouchers: '', Amount_NGN: '' },
    ];

    pnlData.revenueLines
      .filter((r) => showZeroAccounts || r.amount > 0)
      .forEach((r) => {
        pnlRows.push({
          Code: r.code,
          Account: r.name,
          Category_Breakdown: 'Operating Revenue',
          Vouchers: r.count,
          Amount_NGN: r.amount,
        });
      });

    if (pnlData.totalDiscountsGranted > 0) {
      pnlRows.push({
        Code: '4060',
        Account: 'Less: Discounts Allowed',
        Category_Breakdown: 'Contra-Revenue',
        Vouchers: pnlData.discountEntries.length,
        Amount_NGN: -pnlData.totalDiscountsGranted,
      });
    }

    pnlRows.push(
      {
        Code: '',
        Account: 'TOTAL OPERATING REVENUE (A)',
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: pnlData.netRevenue,
      },
      { Code: '', Account: '', Category_Breakdown: '', Vouchers: '', Amount_NGN: '' },
      {
        Code: 'SECTION II',
        Account: 'COST OF SALES / DIRECT OPERATIONAL COSTS (COGS)',
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: '',
      }
    );

    pnlData.directCostLines
      .filter((r) => showZeroAccounts || r.amount > 0)
      .forEach((r) => {
        pnlRows.push({
          Code: r.code,
          Account: r.name,
          Category_Breakdown: r.categoryBreakdowns.map((c) => `${c.categoryName} (₦${fmt(c.amount)})`).join('; '),
          Vouchers: r.count,
          Amount_NGN: r.amount,
        });
      });

    pnlRows.push(
      {
        Code: '',
        Account: 'TOTAL COST OF SALES / DIRECT COSTS (B)',
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: pnlData.totalDirectCosts,
      },
      {
        Code: '',
        Account: `GROSS PROFIT (A - B) [${pnlData.grossMarginPct.toFixed(1)}% Margin]`,
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: pnlData.grossProfit,
      },
      { Code: '', Account: '', Category_Breakdown: '', Vouchers: '', Amount_NGN: '' },
      {
        Code: 'SECTION III',
        Account: 'OPERATING EXPENSES (ADMINISTRATIVE & SELLING OVERHEADS)',
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: '',
      }
    );

    pnlData.opexLines
      .filter((r) => showZeroAccounts || r.amount > 0)
      .forEach((r) => {
        pnlRows.push({
          Code: r.code,
          Account: r.name,
          Category_Breakdown: r.categoryBreakdowns.map((c) => `${c.categoryName} (₦${fmt(c.amount)})`).join('; '),
          Vouchers: r.count,
          Amount_NGN: r.amount,
        });
      });

    pnlRows.push(
      {
        Code: '',
        Account: 'TOTAL OPERATING EXPENSES (C)',
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: pnlData.totalOpex,
      },
      {
        Code: '',
        Account: `NET PROFIT / (LOSS) FOR THE PERIOD (A - B - C) [${pnlData.netMarginPct.toFixed(1)}% Margin]`,
        Category_Breakdown: '',
        Vouchers: '',
        Amount_NGN: pnlData.netOperatingProfit,
      }
    );

    const wsPnl = XLSX.utils.json_to_sheet(pnlRows);
    XLSX.utils.book_append_sheet(wb, wsPnl, 'Profit_And_Loss');

    // Sheet 2: Expense Category Scrutiny
    const scrutinyRows = scrutinyAnalytics.categoryRows.map((c) => ({
      Ledger_Category: c.category,
      CoA_Code: c.coaCode || 'UNALLOCATED',
      CoA_Account_Title: c.coaName,
      Statement_Section: c.coaSection,
      Voucher_Count: c.count,
      Total_Spend_NGN: c.total,
      Share_Of_Total_Expense_Pct:
        scrutinyAnalytics.totalExpenseAmt > 0
          ? Number(((c.total / scrutinyAnalytics.totalExpenseAmt) * 100).toFixed(2))
          : 0,
      Share_Of_Revenue_Pct:
        pnlData.netRevenue > 0 ? Number(((c.total / pnlData.netRevenue) * 100).toFixed(2)) : 0,
      Max_Single_Voucher_NGN: c.maxAmount,
      Largest_Vendor: c.maxVendor,
      Missing_Vendor_Count: c.missingVendorCount,
    }));
    const wsScrutiny = XLSX.utils.json_to_sheet(scrutinyRows);
    XLSX.utils.book_append_sheet(wb, wsScrutiny, 'Expense_Category_Scrutiny');

    XLSX.writeFile(
      wb,
      `DCEL_Profit_And_Loss_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const monthLabels = filterMonths.includes('All') || filterMonths.length === 0
    ? 'All Months'
    : filterMonths.map((m) => {
      const idx = parseInt(m, 10);
      return !isNaN(idx) && FULL_MONTHS[idx - 1] ? FULL_MONTHS[idx - 1] : m;
    }).join(', ');
  const yearLabels = filterYears.map(String).includes('All') || filterYears.length === 0
    ? 'All Years'
    : filterYears.join(', ');
  const periodBadgeText = `${monthLabels} • ${yearLabels}`;

  return (
    <div className="space-y-6">
      {/* Top Mode & Action Bar (Clean, Minimalist Single-Row Strip) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-1.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 shadow-2xs">
        {/* Left: Subview Switcher & Basis Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subview Pills */}
          <div className="inline-flex rounded-sm bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 h-7 items-center">
            <button
              type="button"
              onClick={() => setActiveSubView('minimalist')}
              className={cn(
                'px-2 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1',
                activeSubView === 'minimalist'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              <ReceiptText className="h-3 w-3" />
              <span>Cash P&amp;L</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('statement')}
              className={cn(
                'px-2 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1',
                activeSubView === 'statement'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              <FileText className="h-3 w-3" />
              <span>Statutory CoA</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('scrutiny')}
              className={cn(
                'px-2 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1',
                activeSubView === 'scrutiny'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              <ShieldAlert className="h-3 w-3 text-amber-500" />
              <span>Scrutiny</span>
              {scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-xs bg-amber-500 px-1 text-[9px] font-extrabold text-white">
                  {scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length}
                </span>
              )}
            </button>
          </div>

          {/* Revenue Basis Selector for Statutory View */}
          {activeSubView === 'statement' && (
            <div className="inline-flex rounded-sm bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 h-7 items-center">
              <span className="px-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Basis:
              </span>
              <button
                type="button"
                onClick={() => setRevenueBasis('accrual')}
                className={cn(
                  'px-1.5 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors',
                  revenueBasis === 'accrual'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                Accrual
              </button>
              <button
                type="button"
                onClick={() => setRevenueBasis('cash')}
                className={cn(
                  'px-1.5 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors',
                  revenueBasis === 'cash'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                Cash
              </button>
            </div>
          )}
        </div>

        {/* Right Toolbar Controls (Single-Row, Minimalist) */}
        {activeSubView === 'minimalist' ? (
          <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            {/* Search */}
            <div className="relative">
              <Search className="h-3 w-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 w-28 xl:w-36 pl-6 pr-5 text-[11px] rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            {/* Active Period Display (Synced with Account Report Filter) */}
            <div
              title={`Report Period: ${fullPeriodLabel} (controlled by Account Report Filters above)`}
              className="h-7 px-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100"
            >
              <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{periodLabel}</span>
            </div>

            {/* Type Filter Pills */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-sm border border-slate-200 dark:border-slate-700 h-7 items-center">
              {(['all', 'in', 'out'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'px-1.5 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors',
                    typeFilter === t
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  {t === 'in' ? 'Revenue' : t === 'out' ? 'Expenses' : 'All'}
                </button>
              ))}
            </div>

            {/* Sort */}
            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'))}
              title={sortOrder === 'asc' ? 'Chronological (Oldest First)' : 'Reverse Chronological (Newest First)'}
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>

            {/* Excel */}
            <button
              type="button"
              onClick={handleExportMinimalistExcel}
              title="Export Statement to Excel"
              className="h-7 w-7 inline-flex items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {/* Summary */}
            <button
              type="button"
              onClick={() => setSummaryModalOpen(true)}
              title={`View ${periodLabel} Summary`}
              className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <PieChart className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Summary</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            {activeSubView === 'statement' && (
              <>
                {/* Zero CoA Lines Toggle */}
                <button
                  type="button"
                  onClick={() => setShowZeroAccounts((v) => !v)}
                  title={showZeroAccounts ? 'Hide Zero CoA Lines' : 'Show All CoA Lines'}
                  className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <SlidersHorizontal className="h-3 w-3 text-slate-400" />
                  <span>{showZeroAccounts ? 'Hide Zero' : 'Show All'}</span>
                </button>

                {/* Expand / Collapse Categories */}
                <button
                  type="button"
                  onClick={() => expandAll(Object.keys(expandedCodes).length === 0)}
                  title={Object.keys(expandedCodes).length > 0 ? 'Collapse Categories' : 'Expand Allocated Categories'}
                  className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Layers className="h-3 w-3 text-slate-400" />
                  <span>{Object.keys(expandedCodes).length > 0 ? 'Collapse' : 'Expand'}</span>
                </button>
              </>
            )}

            {/* Excel Export */}
            <button
              type="button"
              onClick={handleExportExcel}
              title="Export P&L and Scrutiny to Excel (.xlsx)"
              className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Excel</span>
            </button>
          </div>
        )}
      </div>

      {activeSubView === 'minimalist' ? (
        /* ── VIEW 0: MINIMALIST CASH FLOW P&L STATEMENT (PETTY CASH STYLE) ─── */
        <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-none overflow-hidden select-text shadow-xs">
          {/* Main Full-Bleed Excel-Style Statement Grid */}
          <div className="overflow-auto relative max-h-[calc(100vh-250px)] min-h-[500px]">
            <table className="w-full border-collapse text-left font-sans text-[12px]">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 shadow-2xs">
                <tr className="h-8 text-[11px] font-bold uppercase tracking-wider">
                  <th className="w-10 px-2 py-1.5 text-center border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    #
                  </th>
                  <th className="w-24 px-2.5 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-3 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    Description / Particulars
                  </th>
                  <th className="w-32 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                    Revenue In (₦)
                  </th>
                  <th className="w-32 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 whitespace-nowrap">
                    Expense Out (₦)
                  </th>
                  <th className="w-36 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-white whitespace-nowrap">
                    Net Balance (₦)
                  </th>
                  <th className="w-36 px-2.5 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                    Client / Source
                  </th>
                  <th className="w-36 px-2.5 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                    Category / Payee
                  </th>
                  <th className="w-24 px-2 py-1.5 text-center bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                    Ref
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No client payments or ledger expenses recorded for{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{fullPeriodLabel}</span>.
                      Use the period filter above to view other months or select{' '}
                      <span className="font-semibold text-blue-600">All Time</span>.
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, index) => {
                    const isBf = row.sourceType === 'bf';

                    return (
                      <tr
                        key={row.id || index}
                        className={cn(
                          'h-7 leading-none transition-colors border-b border-slate-200/80 dark:border-slate-800/80',
                          isBf
                            ? 'bg-blue-50/60 dark:bg-blue-950/20 font-semibold'
                            : index % 2 === 0
                            ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                            : 'bg-slate-50/40 dark:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/70'
                        )}
                      >
                        {/* 1. Row # */}
                        <td className="px-2 py-1 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {isBf ? '—' : index + 1}
                        </td>

                        {/* 2. Date */}
                        <td className="px-2.5 py-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                          {formatDisplayDate(row.date)}
                        </td>

                        {/* 3. Description */}
                        <td
                          className="px-3 py-1 text-[11px] text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 truncate max-w-md"
                          title={row.description}
                        >
                          <div className="flex items-center gap-1.5">
                            {isBf && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                Balance b/f
                              </span>
                            )}
                            <span className="truncate">{row.description}</span>
                          </div>
                        </td>

                        {/* 4. Revenue In (₦) */}
                        <td className="px-2.5 py-1 text-right font-mono text-[11px] text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/10 whitespace-nowrap">
                          {row.moneyIn > 0 ? (
                            <span className="font-semibold">₦{fmtAmount(row.moneyIn)}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        {/* 5. Expense Out (₦) */}
                        <td className="px-2.5 py-1 text-right font-mono text-[11px] text-rose-700 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800 bg-rose-50/30 dark:bg-rose-950/10 whitespace-nowrap">
                          {row.moneyOut > 0 ? (
                            <span className="font-semibold">₦{fmtAmount(row.moneyOut)}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        {/* 6. Running Net Balance (₦) */}
                        <td className="px-2.5 py-1 text-right font-mono text-[11px] border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 whitespace-nowrap">
                          <span
                            className={cn(
                              'font-bold',
                              row.balance >= 0
                                ? 'text-slate-900 dark:text-white'
                                : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            ₦{fmtAmount(row.balance)}
                          </span>
                        </td>

                        {/* 7. Client / Source */}
                        <td
                          className="px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[140px] truncate"
                          title={row.client}
                        >
                          {row.client}
                        </td>

                        {/* 8. Category / Payee */}
                        <td
                          className="px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[140px] truncate"
                          title={`${row.categoryOrStream}${row.payeeOrVendor !== '—' ? ` · ${row.payeeOrVendor}` : ''}`}
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {row.categoryOrStream}
                          </span>
                          {row.payeeOrVendor && row.payeeOrVendor !== '—' && (
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({row.payeeOrVendor})
                            </span>
                          )}
                        </td>

                        {/* 9. Ref Column */}
                        <td className="px-1.5 py-1 text-center whitespace-nowrap">
                          {isBf ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              B/F
                            </span>
                          ) : row.voucherNo ? (
                            <button
                              type="button"
                              onClick={() => setDialogVoucher(row.voucherNo!)}
                              className="inline-flex items-center gap-0.5 font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                              title={`Click to view Ledger Voucher ${row.voucherNo}`}
                            >
                              <Lock className="h-2.5 w-2.5 shrink-0" />
                              <span>{row.voucherNo.replace(/^VN/, '')}</span>
                            </button>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-500">
                              {row.ref}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Sticky Statement Summary Footer */}
              <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 text-[11px] font-bold">
                <tr className="h-8">
                  <td
                    colSpan={3}
                    className="px-3 py-1.5 text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {fullPeriodLabel.toUpperCase()} — TOTALS ({statementRows.filter(r => !r.isBroughtForward).length} entries)
                      </span>
                      <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                        Basis: Client Payments (In) &amp; Ledger (Out)
                      </span>
                    </div>
                  </td>

                  {/* Period Total Revenue In */}
                  <td className="px-2.5 py-1.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-300 border-r border-slate-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-emerald-950/50">
                    ₦{fmtAmount(periodMoneyIn)}
                  </td>

                  {/* Period Total Expenses Out */}
                  <td className="px-2.5 py-1.5 text-right font-mono font-bold text-rose-800 dark:text-rose-300 border-r border-slate-300 dark:border-slate-700 bg-rose-100/70 dark:bg-rose-950/50">
                    ₦{fmtAmount(periodMoneyOut)}
                  </td>

                  {/* Closing Balance / Net Profit */}
                  <td className="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white border-r border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-700">
                    ₦{fmtAmount(closingBalance)}
                  </td>

                  <td colSpan={3} className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 font-semibold text-[10px]">
                    Net Margin: {netProfitMargin.toFixed(1)}% · Closing Net: ₦{fmtAmount(closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : activeSubView === 'statement' ? (
        /* ── VIEW 1: MINIMALIST STATUTORY COA STATEMENT OF PROFIT OR LOSS ── */
        <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-none overflow-hidden select-text shadow-xs">
          {/* Compact Document Header Strip */}
          <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Chart of Accounts Statement
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                {companyDetails.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-500">
                Basis: <strong className="text-slate-700 dark:text-slate-200">{revenueBasis === 'accrual' ? 'Accrual (Invoices)' : 'Cash (Receipts)'}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500">
                Period: <strong className="text-slate-700 dark:text-slate-200">{periodBadgeText}</strong>
              </span>
              {filterClient && filterClient !== 'ALL' && filterClient !== 'All' && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    Client: {filterClient}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-auto relative max-h-[calc(100vh-250px)] min-h-[500px]">
            <table className="w-full border-collapse text-left font-sans text-[12px]">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 shadow-2xs">
                <tr className="h-8 text-[11px] font-bold uppercase tracking-wider">
                  <th className="w-28 px-3 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    CoA Code
                  </th>
                  <th className="px-3 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    Account Title &amp; Allocated Categories
                  </th>
                  <th className="w-20 px-2 py-1.5 text-center border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    Vouchers
                  </th>
                  <th className="w-24 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    % of Rev
                  </th>
                  <th className="w-40 px-3 py-1.5 text-right bg-slate-100 dark:bg-slate-800">
                    Amount (₦)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {/* SECTION I: OPERATING REVENUE */}
                <tr className="bg-emerald-50/70 dark:bg-emerald-950/40 border-y border-emerald-200/80 dark:border-emerald-800/80">
                  <td colSpan={5} className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                    I. Operating Revenue / Turnover ({revenueBasis === 'accrual' ? 'Billed Invoices' : 'Cash Receipts'})
                  </td>
                </tr>
                {pnlData.revenueLines
                  .filter((line) => showZeroAccounts || line.amount > 0)
                  .map((line) => {
                    const pctRev =
                      pnlData.netRevenue > 0 ? (line.amount / pnlData.netRevenue) * 100 : 0;
                    return (
                      <tr
                        key={line.code}
                        onClick={() => openDrilldown(line.name, line.code, line.entries)}
                        className={cn(
                          'h-7 leading-none transition-colors border-b border-slate-200/80 dark:border-slate-800/80',
                          line.amount > 0
                            ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 cursor-pointer'
                            : 'opacity-50'
                        )}
                      >
                        <td className="px-3 py-1 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          {line.code}
                        </td>
                        <td className="px-3 py-1 font-semibold text-[11px] text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <span>{line.name}</span>
                          {line.amount > 0 && (
                            <ArrowUpRight className="h-3 w-3 text-slate-400" />
                          )}
                        </td>
                        <td className="px-2 py-1 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800">
                          {line.count > 0 ? line.count : '—'}
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800">
                          {line.amount > 0 ? `${pctRev.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-1 text-right font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                          {fmtAccounting(line.amount)}
                        </td>
                      </tr>
                    );
                  })}

                {pnlData.totalDiscountsGranted > 0 && (
                  <tr
                    onClick={() =>
                      openDrilldown(
                        'Discounts Allowed',
                        '4060',
                        pnlData.discountEntries
                      )
                    }
                    className="h-7 hover:bg-rose-50/40 dark:hover:bg-rose-950/30 cursor-pointer text-rose-700 dark:text-rose-400 border-b border-slate-200/80 dark:border-slate-800/80"
                  >
                    <td className="px-3 py-1 font-mono text-[11px] font-bold border-r border-slate-200 dark:border-slate-800">4060</td>
                    <td className="px-3 py-1 font-semibold text-[11px] border-r border-slate-200 dark:border-slate-800">
                      Less: Invoice &amp; Settlement Discounts Allowed
                    </td>
                    <td className="px-2 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-slate-800">
                      {pnlData.discountEntries.length}
                    </td>
                    <td className="px-2.5 py-1 text-right font-mono text-[11px] border-r border-slate-200 dark:border-slate-800">—</td>
                    <td className="px-3 py-1 text-right font-mono font-bold text-[11px]">
                      ({fmt(pnlData.totalDiscountsGranted)})
                    </td>
                  </tr>
                )}

                {/* TOTAL SECTION I */}
                <tr className="h-8 bg-emerald-100/70 dark:bg-emerald-950/60 border-t-2 border-b border-emerald-300 dark:border-emerald-700 font-bold text-[11px] text-emerald-950 dark:text-emerald-200">
                  <td className="px-3 py-1.5 font-mono border-r border-emerald-200 dark:border-emerald-800">TOTAL I</td>
                  <td className="px-3 py-1.5 uppercase tracking-wide border-r border-emerald-200 dark:border-emerald-800">
                    Total Net Operating Revenue (Turnover)
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono border-r border-emerald-200 dark:border-emerald-800">
                    {pnlData.revenueLines.reduce((s, l) => s + l.count, 0)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono border-r border-emerald-200 dark:border-emerald-800">100.0%</td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold text-sm text-emerald-900 dark:text-emerald-300">
                    ₦{fmt(pnlData.netRevenue)}
                  </td>
                </tr>

                {/* SECTION II: COST OF SALES / DIRECT COSTS */}
                <tr className="bg-amber-50/70 dark:bg-amber-950/40 border-y border-amber-200/80 dark:border-amber-800/80">
                  <td colSpan={5} className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    II. Less: Cost of Sales / Direct Operational Costs (COGS)
                  </td>
                </tr>

                {pnlData.directCostLines
                  .filter((line) => showZeroAccounts || line.amount > 0)
                  .map((line) => {
                    const isExpanded = Boolean(expandedCodes[line.code]);
                    const pctRev =
                      pnlData.netRevenue > 0 ? (line.amount / pnlData.netRevenue) * 100 : 0;
                    return (
                      <React.Fragment key={line.code}>
                        <tr
                          className={cn(
                            'h-7 leading-none transition-colors border-b border-slate-200/80 dark:border-slate-800/80',
                            line.amount > 0 ? 'hover:bg-amber-50/40 dark:hover:bg-amber-950/30' : 'opacity-50'
                          )}
                        >
                          <td className="px-3 py-1 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => toggleExpandCode(line.code)}
                              className="inline-flex items-center gap-1 hover:text-blue-600"
                            >
                              {line.categoryBreakdowns.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )
                              ) : (
                                <span className="w-3.5" />
                              )}
                              {line.code}
                            </button>
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="px-3 py-1 font-semibold text-[11px] text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{line.name}</span>
                              {line.categoryBreakdowns.map((cb) => (
                                <span
                                  key={cb.categoryName}
                                  className="inline-flex items-center rounded-xs bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-medium text-amber-900 dark:text-amber-200"
                                >
                                  {cb.categoryName}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800">
                            {line.count > 0 ? line.count : '—'}
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800">
                            {line.amount > 0 && pnlData.netRevenue > 0
                              ? `${pctRev.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="px-3 py-1 text-right font-mono font-bold text-[11px] text-amber-900 dark:text-amber-200 cursor-pointer bg-amber-50/20 dark:bg-amber-950/10"
                          >
                            {fmtAccounting(line.amount)}
                          </td>
                        </tr>
                        {isExpanded &&
                          line.categoryBreakdowns.map((cb) => (
                            <tr
                              key={`${line.code}-${cb.categoryName}`}
                              onClick={() =>
                                openDrilldown(
                                  `${line.name} — ${cb.categoryName}`,
                                  line.code,
                                  cb.entries
                                )
                              }
                              className="h-6 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 cursor-pointer text-[11px] text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800"
                            >
                              <td className="px-3 py-0.5 font-mono text-[10px] text-slate-400 text-right border-r border-slate-200 dark:border-slate-800">
                                ↳
                              </td>
                              <td className="px-3 py-0.5 pl-6 font-medium text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                                Ledger Category: <span className="font-bold">{cb.categoryName}</span>
                              </td>
                              <td className="px-2 py-0.5 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                {cb.count}
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono text-[10px] text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                {pnlData.netRevenue > 0
                                  ? `${((cb.amount / pnlData.netRevenue) * 100).toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td className="px-3 py-0.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                                {fmt(cb.amount)}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                {/* TOTAL SECTION II */}
                <tr className="h-8 bg-amber-100/70 dark:bg-amber-950/60 border-t-2 border-b border-amber-300 dark:border-amber-700 font-bold text-[11px] text-amber-950 dark:text-amber-200">
                  <td className="px-3 py-1.5 font-mono border-r border-amber-200 dark:border-amber-800">TOTAL II</td>
                  <td className="px-3 py-1.5 uppercase tracking-wide border-r border-amber-200 dark:border-amber-800">
                    Total Cost of Sales / Direct Operational Costs
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono border-r border-amber-200 dark:border-amber-800">
                    {pnlData.directCostLines.reduce((s, l) => s + l.count, 0)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono border-r border-amber-200 dark:border-amber-800">
                    {pnlData.netRevenue > 0
                      ? `${((pnlData.totalDirectCosts / pnlData.netRevenue) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold text-sm text-amber-950 dark:text-amber-300">
                    (₦{fmt(pnlData.totalDirectCosts)})
                  </td>
                </tr>

                {/* GROSS PROFIT HIGHLIGHT BAR */}
                <tr className="h-8 bg-slate-900 dark:bg-slate-800 text-white font-bold text-[11px]">
                  <td className="px-3 py-1.5 font-mono text-blue-300 border-r border-slate-700">GROSS PROFIT</td>
                  <td className="px-3 py-1.5 uppercase tracking-wider border-r border-slate-700">
                    Gross Profit / (Loss) From Operations (I − II)
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-slate-300 border-r border-slate-700">—</td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-emerald-300 border-r border-slate-700">
                    {pnlData.grossMarginPct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold text-sm text-white">
                    ₦{fmtAccounting(pnlData.grossProfit)}
                  </td>
                </tr>

                {/* SECTION III: OPERATING EXPENSES (OPEX) */}
                <tr className="bg-rose-50/70 dark:bg-rose-950/40 border-y border-rose-200/80 dark:border-rose-800/80">
                  <td colSpan={5} className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
                    III. Less: Operating Expenses (Administrative, Payroll &amp; General Overheads)
                  </td>
                </tr>

                {pnlData.opexLines
                  .filter((line) => showZeroAccounts || line.amount > 0)
                  .map((line) => {
                    const isExpanded = Boolean(expandedCodes[line.code]);
                    const isSuspense = line.code === '5999';
                    const pctRev =
                      pnlData.netRevenue > 0 ? (line.amount / pnlData.netRevenue) * 100 : 0;

                    return (
                      <React.Fragment key={line.code}>
                        <tr
                          className={cn(
                            'h-7 leading-none transition-colors border-b border-slate-200/80 dark:border-slate-800/80',
                            isSuspense
                              ? 'bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/60'
                              : line.amount > 0
                              ? 'hover:bg-rose-50/40 dark:hover:bg-rose-950/30'
                              : 'opacity-50'
                          )}
                        >
                          <td className="px-3 py-1 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => toggleExpandCode(line.code)}
                              className="inline-flex items-center gap-1 hover:text-blue-600"
                            >
                              {line.categoryBreakdowns.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-rose-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )
                              ) : (
                                <span className="w-3.5" />
                              )}
                              {line.code}
                            </button>
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="px-3 py-1 font-semibold text-[11px] text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={isSuspense ? 'text-amber-900 dark:text-amber-300 font-bold' : ''}>
                                {line.name}
                              </span>
                              {isSuspense && (
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setActiveSubView('scrutiny');
                                    setScrutinyFlagFilter('UNALLOCATED');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xs bg-amber-200 dark:bg-amber-950/80 px-1.5 py-0.2 text-[9px] font-bold text-amber-950 dark:text-amber-200 hover:bg-amber-300"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Allocate in Scrutiny →
                                </button>
                              )}
                              {line.categoryBreakdowns.map((cb) => (
                                <span
                                  key={cb.categoryName}
                                  className="inline-flex items-center rounded-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  {cb.categoryName}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800">
                            {line.count > 0 ? line.count : '—'}
                          </td>
                          <td className="px-2.5 py-1 text-right font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800">
                            {line.amount > 0 && pnlData.netRevenue > 0
                              ? `${pctRev.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="px-3 py-1 text-right font-mono font-bold text-[11px] text-rose-800 dark:text-rose-300 cursor-pointer bg-rose-50/20 dark:bg-rose-950/10"
                          >
                            {fmtAccounting(line.amount)}
                          </td>
                        </tr>
                        {isExpanded &&
                          line.categoryBreakdowns.map((cb) => (
                            <tr
                              key={`${line.code}-${cb.categoryName}`}
                              onClick={() =>
                                openDrilldown(
                                  `${line.name} — ${cb.categoryName}`,
                                  line.code,
                                  cb.entries
                                )
                              }
                              className="h-6 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 cursor-pointer text-[11px] text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800"
                            >
                              <td className="px-3 py-0.5 font-mono text-[10px] text-slate-400 text-right border-r border-slate-200 dark:border-slate-800">
                                ↳
                              </td>
                              <td className="px-3 py-0.5 pl-6 font-medium text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                                Ledger Category: <span className="font-bold">{cb.categoryName}</span>
                              </td>
                              <td className="px-2 py-0.5 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                {cb.count}
                              </td>
                              <td className="px-2.5 py-0.5 text-right font-mono text-[10px] text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                {pnlData.netRevenue > 0
                                  ? `${((cb.amount / pnlData.netRevenue) * 100).toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td className="px-3 py-0.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                                {fmt(cb.amount)}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                {/* TOTAL SECTION III */}
                <tr className="h-8 bg-rose-100/70 dark:bg-rose-950/60 border-t-2 border-b border-rose-300 dark:border-rose-700 font-bold text-[11px] text-rose-950 dark:text-rose-200">
                  <td className="px-3 py-1.5 font-mono border-r border-rose-200 dark:border-rose-800">TOTAL III</td>
                  <td className="px-3 py-1.5 uppercase tracking-wide border-r border-rose-200 dark:border-rose-800">
                    Total Operating Expenses (OPEX)
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono border-r border-rose-200 dark:border-rose-800">
                    {pnlData.opexLines.reduce((s, l) => s + l.count, 0)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono border-r border-rose-200 dark:border-rose-800">
                    {pnlData.netRevenue > 0
                      ? `${((pnlData.totalOpex / pnlData.netRevenue) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold text-sm text-rose-950 dark:text-rose-300">
                    (₦{fmt(pnlData.totalOpex)})
                  </td>
                </tr>

                {/* NET PROFIT / LOSS FINAL DOUBLE-UNDERLINED ROW */}
                <tr
                  className={cn(
                    'h-9 border-t-2 border-b-2 font-bold text-[12px]',
                    pnlData.netOperatingProfit >= 0
                      ? 'bg-emerald-950 dark:bg-emerald-900 text-white border-emerald-400'
                      : 'bg-rose-950 dark:bg-rose-900 text-white border-rose-400'
                  )}
                >
                  <td className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-emerald-300 border-r border-emerald-700/60">
                    NET PROFIT
                  </td>
                  <td className="px-3 py-2 uppercase tracking-wider text-xs border-r border-emerald-700/60">
                    Net Operating Profit / (Loss) For The Period (I − II − III)
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-300 border-r border-emerald-700/60">—</td>
                  <td className="px-2.5 py-2 text-right font-mono text-[11px] text-emerald-300 border-r border-emerald-700/60">
                    {pnlData.netMarginPct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-extrabold text-sm underline decoration-double underline-offset-4">
                    ₦{fmtAccounting(pnlData.netOperatingProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Non-P&L Ledger Reconciliation Footnote (CapEx / VAT Remittances) */}
          {pnlData.nonPnlLines.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Reconciliation Note: Non-P&amp;L Balance Sheet Disbursements in Expense Ledger
                </div>
                <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                  Total Ledger Vouchers Disbursed: ₦{fmt(pnlData.totalLedgerDisbursements)}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Allocated to Balance Sheet accounts (Fixed Assets / CapEx or Tax Liabilities) and excluded from P&amp;L OPEX:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {pnlData.nonPnlLines.map((line) => (
                  <div
                    key={line.code}
                    onClick={() => openDrilldown(line.name, line.code, line.entries)}
                    className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[11px]"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-500 mr-1.5">
                        [{line.code}]
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{line.name}</span>
                      <div className="text-[10px] text-slate-400">
                        {line.categoryBreakdowns.map((c) => c.categoryName).join(', ')}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      ₦{fmt(line.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── VIEW 2: EXPENSE LEDGER SCRUTINY & AUDIT INSPECTOR ─────────────── */
        <div className="space-y-6">
          {/* Scrutiny Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`rounded-xl border p-4 ${scrutinyAnalytics.unallocatedSpend > 0
                ? 'border-amber-300 bg-amber-50/60'
                : 'border-emerald-200 bg-emerald-50/40'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Unallocated CoA Spend
                </span>
                {scrutinyAnalytics.unallocatedSpend > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </div>
              <div className="mt-2 text-xl font-extrabold font-mono text-slate-900">
                <NairaSign />
                {fmt(scrutinyAnalytics.unallocatedSpend)}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length === 0
                  ? '100% of active expense categories allocated to CoA'
                  : `${scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length
                  } unallocated category(s) need CoA mapping`}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Top Expense Category Driver
              </div>
              <div className="mt-1.5 text-base font-extrabold text-slate-900 truncate">
                {scrutinyAnalytics.categoryRows[0]?.category || '—'}
              </div>
              <div className="mt-1 text-sm font-mono font-bold text-rose-700">
                <NairaSign />
                {fmt(scrutinyAnalytics.categoryRows[0]?.total || 0)}
                {scrutinyAnalytics.totalExpenseAmt > 0 && (
                  <span className="ml-1.5 text-xs text-slate-500 font-normal">
                    (
                    {(
                      ((scrutinyAnalytics.categoryRows[0]?.total || 0) /
                        scrutinyAnalytics.totalExpenseAmt) *
                      100
                    ).toFixed(1)}
                    % of spend)
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Single Largest Voucher
              </div>
              <div className="mt-1.5 text-lg font-extrabold font-mono text-slate-900">
                <NairaSign />
                {fmt(scrutinyAnalytics.largestVoucher?.amount || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500 truncate">
                {scrutinyAnalytics.largestVoucher
                  ? `${scrutinyAnalytics.largestVoucher.category} • ${scrutinyAnalytics.largestVoucher.vendor ||
                  scrutinyAnalytics.largestVoucher.description
                  }`
                  : 'No vouchers in period'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Ledger Audit Hygiene
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  {scrutinyAnalytics.hygieneScore}% Clean
                </span>
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-900">
                {scrutinyAnalytics.flaggedCount} Flagged
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Out of {periodExpenses.length} total vouchers (High-value threshold: ₦
                {fmt(scrutinyAnalytics.highValueThreshold)})
              </div>
            </div>
          </div>

          {/* Category-Level Scrutiny & Interactive CoA Allocation Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  1. Category Spend Scrutiny &amp; Chart of Accounts Allocation
                </h3>
                <p className="text-xs text-slate-500">
                  Audit every expense category's weight against revenue and re-allocate where each category flows in the Chart of Accounts.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                Total Period Ledger Spend: <NairaSign />
                {fmt(scrutinyAnalytics.totalExpenseAmt)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 text-left">Ledger Category</th>
                    <th className="py-2.5 px-4 text-left min-w-[270px]">
                      Allocated Chart of Account (CoA)
                    </th>
                    <th className="py-2.5 px-3 text-center">Statement Section</th>
                    <th className="py-2.5 px-3 text-right">Vouchers</th>
                    <th className="py-2.5 px-4 text-right">Total Spend (₦)</th>
                    <th className="py-2.5 px-3 text-right">% of Spend</th>
                    <th className="py-2.5 px-3 text-right">% of Rev</th>
                    <th className="py-2.5 px-4 text-right">Max Voucher (₦)</th>
                    <th className="py-2.5 px-3 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scrutinyAnalytics.categoryRows
                    .filter((row) => showZeroAccounts || row.count > 0 || !row.coaCode)
                    .map((row) => {
                      const pctSpend =
                        scrutinyAnalytics.totalExpenseAmt > 0
                          ? (row.total / scrutinyAnalytics.totalExpenseAmt) * 100
                          : 0;
                      const pctRev =
                        pnlData.netRevenue > 0 ? (row.total / pnlData.netRevenue) * 100 : 0;

                      return (
                        <tr key={row.category} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 font-bold text-slate-800">
                            <button
                              type="button"
                              onClick={() =>
                                openDrilldown(
                                  `Category Scrutiny: ${row.category}`,
                                  row.coaCode || 'UNALLOC',
                                  row.entries
                                )
                              }
                              className="hover:text-blue-600 text-left inline-flex items-center gap-1"
                            >
                              {row.category}
                              {row.count > 0 && <ArrowUpRight className="h-3 w-3 text-slate-400" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={row.coaCode || ''}
                              onChange={(e) => handleQuickAssignCoa(row.category, e.target.value)}
                              className={`h-7 w-full rounded border px-2 text-[11px] font-semibold ${row.coaCode
                                ? 'border-slate-200 bg-white text-slate-800'
                                : 'border-amber-400 bg-amber-50 text-amber-900'
                                }`}
                            >
                              <option value="">⚠ Unallocated — Assign CoA Code</option>
                              <optgroup label="Direct Costs / COGS (5000s)">
                                {activeChartOfAccounts
                                  .filter((a) => a.category === 'DIRECT_COST')
                                  .map((a) => (
                                    <option key={a.code} value={a.code}>
                                      [{a.code}] {a.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Operating Expenses / OPEX (5100s)">
                                {activeChartOfAccounts
                                  .filter((a) => a.category === 'OPERATING_EXPENSE')
                                  .map((a) => (
                                    <option key={a.code} value={a.code}>
                                      [{a.code}] {a.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Fixed Assets / CapEx (1300s)">
                                {activeChartOfAccounts
                                  .filter((a) => a.category === 'FIXED_ASSET')
                                  .map((a) => (
                                    <option key={a.code} value={a.code}>
                                      [{a.code}] {a.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Tax &amp; Liabilities (2000s)">
                                {activeChartOfAccounts
                                  .filter((a) => a.type === 'LIABILITY')
                                  .map((a) => (
                                    <option key={a.code} value={a.code}>
                                      [{a.code}] {a.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Revenue / Income (4000s)">
                                {activeChartOfAccounts
                                  .filter((a) => a.type === 'INCOME')
                                  .map((a) => (
                                    <option key={a.code} value={a.code}>
                                      [{a.code}] {a.name}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${row.coaSection === 'DIRECT_COST'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : row.coaSection === 'OPERATING_EXPENSE'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : row.coaSection === 'UNALLOCATED'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                            >
                              {row.coaSection === 'DIRECT_COST'
                                ? 'P&L • COGS'
                                : row.coaSection === 'OPERATING_EXPENSE'
                                  ? 'P&L • OPEX'
                                  : row.coaSection === 'UNALLOCATED'
                                    ? 'UNALLOCATED'
                                    : `BS • ${row.coaSection}`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {row.count}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {fmt(row.total)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {pctSpend.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {pnlData.netRevenue > 0 ? `${pctRev.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {row.maxAmount > 0 ? fmt(row.maxAmount) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {row.missingVendorCount > 0 ? (
                              <span
                                className="inline-flex items-center rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                title={`${row.missingVendorCount} voucher(s) missing Vendor name`}
                              >
                                {row.missingVendorCount} no-vendor
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[10px]">✓ OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Voucher Scrutiny & Anomaly Inspector */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  2. Voucher-by-Voucher Expense Ledger Scrutiny
                </h3>
                <p className="text-xs text-slate-500">
                  Inspect individual expense vouchers sorted by value, or filter by audit anomalies (high-value outliers, missing vendor/voucher metadata, or unallocated categories).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={scrutinyCategoryFilter}
                  onChange={(e) => setScrutinyCategoryFilter(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  {scrutinyAnalytics.categoryRows
                    .filter((c) => c.count > 0)
                    .map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.category} ({c.count})
                      </option>
                    ))}
                </select>
                <div className="relative w-60">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <Input
                    value={scrutinySearch}
                    onChange={(e) => setScrutinySearch(e.target.value)}
                    placeholder="Search voucher, vendor, desc..."
                    className="h-8 pl-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Scrutiny Filter Pills */}
            <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: `All Vouchers (${scrutinyAnalytics.enrichedVouchers.length})` },
                  {
                    id: 'HIGH_VALUE',
                    label: `High-Value Outliers (${scrutinyAnalytics.enrichedVouchers.filter((v) =>
                      v.flags.includes('HIGH_VALUE')
                    ).length
                      })`,
                  },
                  {
                    id: 'UNALLOCATED',
                    label: `Unallocated CoA (${scrutinyAnalytics.enrichedVouchers.filter((v) =>
                      v.flags.includes('UNALLOCATED')
                    ).length
                      })`,
                  },
                  {
                    id: 'MISSING_META',
                    label: `Missing Vendor / Voucher # (${scrutinyAnalytics.enrichedVouchers.filter((v) =>
                      v.flags.includes('MISSING_META')
                    ).length
                      })`,
                  },
                  {
                    id: 'DIRECT_NO_SITE',
                    label: `Direct Cost Missing Site (${scrutinyAnalytics.enrichedVouchers.filter((v) =>
                      v.flags.includes('DIRECT_NO_SITE')
                    ).length
                      })`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setScrutinyFlagFilter(pill.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${scrutinyFlagFilter === pill.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Date</th>
                    <th className="py-2.5 px-3 text-left">Voucher #</th>
                    <th className="py-2.5 px-4 text-left">Category &amp; CoA</th>
                    <th className="py-2.5 px-4 text-left">Description</th>
                    <th className="py-2.5 px-4 text-left">Vendor / Client / Site</th>
                    <th className="py-2.5 px-3 text-left">Scrutiny Flags</th>
                    <th className="py-2.5 px-4 text-right">Amount (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scrutinyAnalytics.enrichedVouchers
                    .filter(
                      (v) =>
                        scrutinyFlagFilter === 'ALL' || v.flags.includes(scrutinyFlagFilter)
                    )
                    .filter(
                      (v) =>
                        scrutinyCategoryFilter === 'ALL' ||
                        v.catName.toLowerCase() === scrutinyCategoryFilter.toLowerCase()
                    )
                    .filter((v) => {
                      if (!scrutinySearch.trim()) return true;
                      const q = scrutinySearch.toLowerCase();
                      return (
                        (v.entry.description || '').toLowerCase().includes(q) ||
                        (v.entry.vendor || '').toLowerCase().includes(q) ||
                        (v.entry.voucherNo || '').toLowerCase().includes(q) ||
                        (v.entry.client || '').toLowerCase().includes(q) ||
                        (v.entry.site || '').toLowerCase().includes(q) ||
                        v.catName.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 250)
                    .map(({ entry, catName, coaCode, coaName, flags }) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono whitespace-nowrap text-slate-600">
                          {formatDisplayDate(entry.date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                          {entry.voucherNo || (
                            <span className="text-amber-600 italic">No VCH#</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-800">{catName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {coaCode ? `[${coaCode}] ${coaName}` : '⚠ Unallocated CoA'}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-[280px]">
                          {entry.description || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {entry.vendor || (
                              <span className="text-amber-600 italic">No Vendor</span>
                            )}
                          </div>
                          {(entry.client || entry.site) && (
                            <div className="text-[10px] text-slate-400">
                              {[entry.client, entry.site].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {flags.length === 0 ? (
                              <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                Verified
                              </span>
                            ) : (
                              flags.map((f) => (
                                <span
                                  key={f}
                                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${f === 'HIGH_VALUE'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : f === 'UNALLOCATED'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                >
                                  {f === 'HIGH_VALUE'
                                    ? 'High Value'
                                    : f === 'UNALLOCATED'
                                      ? 'Unallocated CoA'
                                      : f === 'MISSING_META'
                                        ? 'Missing Info'
                                        : 'No Site/Client'}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          <NairaSign />
                          {fmt(entry.amount || 0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* ── Monthly Summary & Reconciliation Modal (Identical to Petty Cash) ── */}
      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                <PieChart className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Profit &amp; Loss Summary — {periodLabel}
                </DialogTitle>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {fullPeriodLabel} · Period statement reconciliation &amp; breakdowns
                </p>
              </div>
            </div>
            <DialogClose />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 4 Reconciliation KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Opening Balance b/f */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Opening Balance (b/f)
                </div>
                <div className="mt-1 text-base font-bold font-mono text-slate-900 dark:text-white">
                  ₦{fmtAmount(balanceBroughtForward)}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={periodStartDate ? `Prior to ${periodLabel}` : 'Initial'}>
                  {periodStartDate ? `Prior to ${periodLabel}` : 'Initial balance'}
                </div>
              </div>

              {/* 2. Total Revenue In */}
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Total Revenue (In)
                </div>
                <div className="mt-1 text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  ₦{fmtAmount(periodMoneyIn)}
                </div>
                <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                  {summaryData.periodInCount} {summaryData.periodInCount === 1 ? 'payment' : 'payments'}
                </div>
              </div>

              {/* 3. Total Expenses Out */}
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Total Expenses (Out)
                </div>
                <div className="mt-1 text-base font-bold font-mono text-rose-700 dark:text-rose-300">
                  ₦{fmtAmount(periodMoneyOut)}
                </div>
                <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                  {summaryData.periodOutCount} {summaryData.periodOutCount === 1 ? 'voucher' : 'vouchers'}
                </div>
              </div>

              {/* 4. Closing Balance / Net Profit */}
              <div className={cn(
                "p-3 rounded-lg border",
                closingBalance >= 0
                  ? "border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20"
              )}>
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  closingBalance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"
                )}>
                  Closing Net Balance
                </div>
                <div className={cn(
                  "mt-1 text-base font-bold font-mono",
                  closingBalance >= 0 ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"
                )}>
                  ₦{fmtAmount(closingBalance)}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={`Net Margin: ${netProfitMargin.toFixed(1)}%`}>
                  Margin: {netProfitMargin.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Next Month Balance b/f Highlight Card */}
            <div className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">
                  Balance carried forward to <strong className="text-slate-900 dark:text-white">subsequent period</strong>:
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                ₦{fmtAmount(summaryData.balanceCarriedForward)}
              </span>
            </div>

            {/* Client Revenue Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Revenue by Client ({summaryData.clientBreakdown.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Total: ₦{fmtAmount(periodMoneyIn)}
                </span>
              </div>

              {summaryData.clientBreakdown.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                  No client payments recorded for this period.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-3">Client</th>
                        <th className="py-1.5 px-2 text-center w-16">Count</th>
                        <th className="py-1.5 px-3 text-right w-28">Amount (₦)</th>
                        <th className="py-1.5 px-3 text-right w-20">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData.clientBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-medium truncate max-w-[280px]">
                            {item.client}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500">
                            {item.count}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {fmtAmount(item.total)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                            {item.pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expenses by Category Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Expenses by Category ({summaryData.categoryBreakdown.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Total: ₦{fmtAmount(periodMoneyOut)}
                </span>
              </div>

              {summaryData.categoryBreakdown.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                  No ledger expenses recorded for this period.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-3">Category</th>
                        <th className="py-1.5 px-2 text-center w-16">Count</th>
                        <th className="py-1.5 px-3 text-right w-28">Amount (₦)</th>
                        <th className="py-1.5 px-3 text-right w-20">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData.categoryBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-medium truncate max-w-[280px]">
                            {item.category}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500">
                            {item.count}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                            {fmtAmount(item.total)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                            {item.pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expenses by Vendor Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Expenses by Vendor / Beneficiary ({summaryData.vendorBreakdown.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Total: ₦{fmtAmount(periodMoneyOut)}
                </span>
              </div>

              {summaryData.vendorBreakdown.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                  No vendor records found for this period.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-3">Vendor / Beneficiary</th>
                        <th className="py-1.5 px-2 text-center w-16">Count</th>
                        <th className="py-1.5 px-3 text-right w-28">Amount (₦)</th>
                        <th className="py-1.5 px-3 text-right w-20">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData.vendorBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-medium truncate max-w-[280px]">
                            {item.vendor}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500">
                            {item.count}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {fmtAmount(item.total)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                            {item.pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Ledger Voucher Dialog (Read-Only) ─────────────────────────────── */}
      {dialogVoucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          onClick={() => setDialogVoucher(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 sm:rounded-md shadow-2xl w-full h-full sm:h-auto sm:max-h-[85vh] max-w-4xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="bg-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">
                  Voucher Transactions
                </p>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-xl tracking-wide font-mono">
                    {dialogVoucher}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white border border-white/20">
                    Read-Only
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-blue-200 text-[10px] uppercase font-bold tracking-wider">
                      Subtotal
                    </p>
                    <p className="text-white font-bold text-sm tabular-nums">
                      ₦{fmtAmount(dialogNetTotal)}
                    </p>
                  </div>
                  {dialogVatTotal > 0 && (
                    <div>
                      <p className="text-emerald-200 text-[10px] uppercase font-bold tracking-wider">
                        VAT ({vatRate}%)
                      </p>
                      <p className="text-emerald-300 font-extrabold text-sm tabular-nums">
                        ₦{fmtAmount(dialogVatTotal)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-blue-200 text-[10px] uppercase font-bold tracking-wider">
                      Total Amount
                    </p>
                    <p className="text-white font-extrabold text-lg tabular-nums">
                      ₦{fmtAmount(dialogGrossTotal)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDialogVoucher(null)}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bank / Date meta row */}
            {dialogTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs shrink-0">
                <div className="flex justify-between sm:block">
                  <span className="text-slate-500">Paid From (Bank): </span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {dialogTransactions[0].bank}
                  </strong>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-slate-500">Entered by: </span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {dialogTransactions[0].enteredBy}
                  </strong>
                </div>
                <div className="text-slate-500 sm:ml-auto font-semibold">
                  {dialogTransactions.length} transaction
                  {dialogTransactions.length !== 1 ? 's' : ''} in voucher
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="overflow-y-auto flex-1 bg-white dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold text-slate-600 dark:text-slate-300 w-8">
                      #
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Date
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Description
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-32">
                      Category
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Client
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Site
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Amount
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-300 w-20">
                      Vatable
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 w-28">
                      VAT
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Vendor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dialogTransactions.map((t, idx) => {
                    const lineVat = t.vatAmount ?? (t.amount * (t.vatRate ?? vatRate)) / 100;
                    return (
                      <tr
                        key={t.id || `t-${idx}`}
                        className={cn(
                          'border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors',
                          idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/40 dark:bg-slate-900/50'
                        )}
                      >
                        <td className="py-2.5 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                          {t.date ? formatDisplayDate(t.date) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-100 font-medium">
                          {t.description || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{t.client || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{t.site || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          ₦{fmtAmount(t.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            t.vatMode === 'Yes' || t.vatMode === 'Add' || t.isVatable
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {t.vatMode || (t.isVatable ? 'Yes' : 'No')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {lineVat > 0 ? `₦${fmtAmount(lineVat)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{t.vendor || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <TransactionDrilldownDialog
        open={drilldownState.isOpen}
        onClose={() => setDrilldownState((prev) => ({ ...prev, isOpen: false }))}
        title={drilldownState.title}
        subtitle={drilldownState.code ? `Chart of Account Code: ${drilldownState.code}` : undefined}
        entries={drilldownState.entries}
      />
    </div>
  );
}