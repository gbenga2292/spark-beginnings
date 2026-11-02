import React, { useMemo, useState } from 'react';
import { useAppStore, Invoice } from '@/src/store/appStore';
import { formatDisplayDate } from '@/src/lib/dateUtils';
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
  Layers,
  ShieldAlert,
  FileText,
  ArrowUpRight,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { supabase } from '@/src/lib/supabase';
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
  filterYears: number[];
  filterMonths: string[];
  filterClient: string;
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
  const payrollVariables = useAppStore((s) => s.payrollVariables);
  const updatePayrollVariables = useAppStore((s) => s.updatePayrollVariables);
  const addLedgerCategory = useAppStore((s) => s.addLedgerCategory);

  const [activeSubView, setActiveSubView] = useState<'statement' | 'scrutiny'>('statement');
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

  // Period matching helper
  const inPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const yr = d.getFullYear();
    const mo = FULL_MONTHS[d.getMonth()];
    if (filterYears.length > 0 && !filterYears.includes(yr)) return false;
    if (filterMonths.length > 0 && !filterMonths.includes(mo)) return false;
    return true;
  };

  // Filtered datasets
  const periodInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inPeriod(inv.date) && (filterClient === 'ALL' || inv.client === filterClient)
      ),
    [invoices, filterYears, filterMonths, filterClient]
  );

  const periodPayments = useMemo(
    () =>
      payments.filter(
        (p) => inPeriod(p.date) && (filterClient === 'ALL' || p.client === filterClient)
      ),
    [payments, filterYears, filterMonths, filterClient]
  );

  const periodExpenses = useMemo(
    () =>
      ledgerEntries.filter(
        (e) =>
          inPeriod(e.date) &&
          (filterClient === 'ALL' || !e.client || e.client === filterClient)
      ),
    [ledgerEntries, filterYears, filterMonths, filterClient]
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

    if (revenueBasis === 'accrual') {
      periodInvoices.forEach((inv) => {
        const lines = invoiceLines(inv);
        const addInvSlice = (code: string, fallbackName: string, val: number, label: string) => {
          if (val <= 0) return;
          const row = ensureRevLine(code, fallbackName);
          row.amount += val;
          row.count += 1;
          row.entries.push({
            id: `${inv.id}-${code}`,
            date: inv.date,
            ref: inv.invoiceNumber || 'INV',
            party: inv.client,
            site: inv.site,
            category: inv.status,
            description: `${label} — ${inv.site || inv.client}`,
            amount: val,
            side: 'credit',
            details: inv as unknown as Record<string, unknown>,
          });
        };

        addInvSlice('4000', 'Equipment Rental Revenue', lines.rental, 'Equipment & Auxiliary Rental');
        addInvSlice('4010', 'Dewatering & Installation Revenue', lines.installation, 'System Installation');
        addInvSlice('4020', 'Mobilisation & Demobilisation Income', lines.mob, 'Mobilisation & Demobilisation');
        addInvSlice('4030', 'Diesel Supply & Recovery Income', lines.diesel, 'Diesel Supply / Recovery');
        addInvSlice('4040', 'Technician & Supervision Fees', lines.tech, 'Technician Supervision');
        if (lines.damages > 0) {
          addInvSlice('4050', 'Damages & Ancillary Recovery', lines.damages, 'Damages Recovery');
        }
        if (lines.discount > 0) {
          totalDiscountsGranted += lines.discount;
          discountEntries.push({
            id: `${inv.id}-disc`,
            date: inv.date,
            ref: inv.invoiceNumber || 'INV',
            party: inv.client,
            site: inv.site,
            category: 'Discount',
            description: `Invoice Discount Allowed — ${inv.invoiceNumber || inv.site}`,
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
        if (val > 0) {
          const row = ensureRevLine('4000', 'Cash Receipts from Client Operations');
          row.amount += val;
          row.count += 1;
          row.entries.push({
            id: p.id,
            date: p.date,
            ref: p.reference || p.invoiceNumber || 'PMT',
            party: p.client,
            site: p.site,
            bank: p.paidTo,
            description: `Payment Received (${p.paidTo || 'Bank'})`,
            amount: val,
            side: 'credit',
            details: p as unknown as Record<string, unknown>,
          });
        }
        if ((p.discount || 0) > 0) {
          totalDiscountsGranted += p.discount || 0;
          discountEntries.push({
            id: `${p.id}-disc`,
            date: p.date,
            ref: p.reference || 'PMT-DISC',
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

  const periodBadgeText = `${
    filterMonths.length > 0 ? filterMonths.join(', ') : 'All Months'
  } • ${filterYears.length > 0 ? filterYears.join(', ') : 'All Years'}`;

  return (
    <div className="space-y-6">
      {/* Top Mode & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubView('statement')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeSubView === 'statement'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Profit &amp; Loss Statement
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('scrutiny')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeSubView === 'scrutiny'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              Expense Ledger Scrutiny
              {scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length}
                </span>
              )}
            </button>
          </div>

          {/* Revenue Basis Switch */}
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 p-1 border border-slate-200 text-xs">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Revenue Basis:
            </span>
            <button
              type="button"
              onClick={() => setRevenueBasis('accrual')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                revenueBasis === 'accrual'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Accrual (Billed Invoices)
            </button>
            <button
              type="button"
              onClick={() => setRevenueBasis('cash')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                revenueBasis === 'cash'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Cash (Payments Received)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSubView === 'statement' && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowZeroAccounts((v) => !v)}
                className="h-8 text-xs border-slate-200 text-slate-600"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                {showZeroAccounts ? 'Hide Zero CoA Lines' : 'Show All CoA Lines'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => expandAll(Object.keys(expandedCodes).length === 0)}
                className="h-8 text-xs border-slate-200 text-slate-600"
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                {Object.keys(expandedCodes).length > 0
                  ? 'Collapse Categories'
                  : 'Expand Allocated Categories'}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-8 text-xs border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 font-bold"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            Export P&amp;L &amp; Scrutiny (.xlsx)
          </Button>
        </div>
      </div>

      {/* Executive KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Operating Revenue
            </span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              4000–4060
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900 font-mono">
            <NairaSign />
            {fmt(pnlData.netRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {revenueBasis === 'accrual'
              ? `${periodInvoices.length} billed invoice(s)`
              : `${periodPayments.length} payment receipt(s)`}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Direct Costs (COGS)
            </span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              5000–5060
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-950 font-mono">
            <NairaSign />
            {fmt(pnlData.totalDirectCosts)}
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">
            {pnlData.netRevenue > 0
              ? `${((pnlData.totalDirectCosts / pnlData.netRevenue) * 100).toFixed(1)}% of Revenue`
              : 'Direct site & fleet costs'}
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Gross Profit
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                pnlData.grossProfit >= 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {pnlData.grossMarginPct.toFixed(1)}% Margin
            </span>
          </div>
          <div
            className={`mt-2 text-xl font-extrabold font-mono ${
              pnlData.grossProfit >= 0 ? 'text-blue-950' : 'text-rose-700'
            }`}
          >
            <NairaSign />
            {fmtAccounting(pnlData.grossProfit)}
          </div>
          <div className="mt-1 text-[11px] text-blue-700 font-medium">
            Turnover less Direct Costs
          </div>
        </div>

        <div className="rounded-xl border border-rose-200/80 bg-rose-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Operating Expenses
            </span>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
              5100–5170
            </span>
          </div>
          <div className="mt-2 text-xl font-extrabold text-rose-950 font-mono">
            <NairaSign />
            {fmt(pnlData.totalOpex)}
          </div>
          <div className="mt-1 text-[11px] text-rose-700 font-medium">
            {pnlData.netRevenue > 0
              ? `${((pnlData.totalOpex / pnlData.netRevenue) * 100).toFixed(1)}% of Revenue`
              : 'Admin, payroll & overheads'}
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 shadow-xs ${
            pnlData.netOperatingProfit >= 0
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-rose-300 bg-rose-50/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                pnlData.netOperatingProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              Net Profit / (Loss)
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                pnlData.netOperatingProfit >= 0
                  ? 'bg-emerald-200/70 text-emerald-900'
                  : 'bg-rose-200/70 text-rose-900'
              }`}
            >
              {pnlData.netOperatingProfit >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {pnlData.netMarginPct.toFixed(1)}%
            </span>
          </div>
          <div
            className={`mt-2 text-xl font-extrabold font-mono ${
              pnlData.netOperatingProfit >= 0 ? 'text-emerald-900' : 'text-rose-800'
            }`}
          >
            <NairaSign />
            {fmtAccounting(pnlData.netOperatingProfit)}
          </div>
          <div
            className={`mt-1 text-[11px] font-medium ${
              pnlData.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {pnlData.netOperatingProfit >= 0 ? 'Net Operating Surplus' : 'Net Operating Deficit'}
          </div>
        </div>
      </div>

      {activeSubView === 'statement' ? (
        /* ── VIEW 1: FORMAL STATEMENT OF PROFIT OR LOSS ───────────────────── */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Corporate Document Header */}
          <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-widest">
                  <Building2 className="h-4 w-4" />
                  {companyDetails.name}
                </div>
                <h2 className="text-xl font-extrabold tracking-tight mt-1">
                  STATEMENT OF PROFIT OR LOSS (INCOME STATEMENT)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prepared in accordance with the DCEL Chart of Accounts • Click any account or category row to inspect vouchers
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-1.5">
                <span className="inline-flex items-center rounded-md bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-bold text-slate-200">
                  Period: {periodBadgeText}
                </span>
                {filterClient !== 'ALL' && (
                  <span className="inline-flex items-center rounded-md bg-blue-900/60 border border-blue-700 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200">
                    Client Filter: {filterClient}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6 text-left w-[120px]">CoA Code</th>
                  <th className="py-3 px-4 text-left">Account Title &amp; Allocated Ledger Categories</th>
                  <th className="py-3 px-4 text-right w-[110px]">Vouchers</th>
                  <th className="py-3 px-4 text-right w-[110px]">% of Rev</th>
                  <th className="py-3 px-6 text-right w-[190px]">Amount (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* SECTION I: OPERATING REVENUE */}
                <tr className="bg-emerald-50/60 border-y border-emerald-200/70">
                  <td colSpan={5} className="py-2.5 px-6 text-xs font-extrabold uppercase tracking-wider text-emerald-900">
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
                        className={`transition-colors ${
                          line.amount > 0
                            ? 'hover:bg-emerald-50/40 cursor-pointer'
                            : 'opacity-60'
                        }`}
                      >
                        <td className="py-2.5 px-6 font-mono text-xs font-bold text-slate-600">
                          {line.code}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                          <span>{line.name}</span>
                          {line.amount > 0 && (
                            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                          {line.count > 0 ? line.count : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                          {line.amount > 0 ? `${pctRev.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-6 text-right font-mono font-bold text-slate-900">
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
                    className="hover:bg-rose-50/40 cursor-pointer text-rose-700"
                  >
                    <td className="py-2.5 px-6 font-mono text-xs font-bold">4060</td>
                    <td className="py-2.5 px-4 font-semibold">
                      Less: Invoice &amp; Settlement Discounts Allowed
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs">
                      {pnlData.discountEntries.length}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs">—</td>
                    <td className="py-2.5 px-6 text-right font-mono font-bold">
                      ({fmt(pnlData.totalDiscountsGranted)})
                    </td>
                  </tr>
                )}

                <tr className="bg-emerald-100/50 border-t-2 border-emerald-300 font-extrabold text-emerald-950">
                  <td className="py-3 px-6 font-mono text-xs">TOTAL I</td>
                  <td className="py-3 px-4 uppercase text-xs tracking-wide">
                    Total Net Operating Revenue (Turnover)
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    {pnlData.revenueLines.reduce((s, l) => s + l.count, 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">100.0%</td>
                  <td className="py-3 px-6 text-right font-mono text-sm">
                    <NairaSign />
                    {fmt(pnlData.netRevenue)}
                  </td>
                </tr>

                {/* SECTION II: COST OF SALES / DIRECT COSTS */}
                <tr className="bg-amber-50/60 border-y border-amber-200/70">
                  <td colSpan={5} className="py-2.5 px-6 text-xs font-extrabold uppercase tracking-wider text-amber-900">
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
                          className={`transition-colors ${
                            line.amount > 0 ? 'hover:bg-amber-50/40' : 'opacity-60'
                          }`}
                        >
                          <td className="py-2.5 px-6 font-mono text-xs font-bold text-slate-600">
                            <button
                              type="button"
                              onClick={() => toggleExpandCode(line.code)}
                              className="inline-flex items-center gap-1 hover:text-blue-600"
                            >
                              {line.categoryBreakdowns.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )
                              ) : (
                                <span className="w-3.5" />
                              )}
                              {line.code}
                            </button>
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="py-2.5 px-4 font-semibold text-slate-800 cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{line.name}</span>
                              {line.categoryBreakdowns.map((cb) => (
                                <span
                                  key={cb.categoryName}
                                  className="inline-flex items-center rounded bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
                                >
                                  {cb.categoryName}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                            {line.count > 0 ? line.count : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                            {line.amount > 0 && pnlData.netRevenue > 0
                              ? `${pctRev.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="py-2.5 px-6 text-right font-mono font-bold text-slate-800 cursor-pointer"
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
                              className="bg-slate-50/80 hover:bg-blue-50/40 cursor-pointer text-xs text-slate-600"
                            >
                              <td className="py-1.5 px-6 font-mono text-[11px] text-slate-400 text-right">
                                ↳
                              </td>
                              <td className="py-1.5 px-4 pl-8 font-medium text-slate-700">
                                Ledger Category: <span className="font-bold">{cb.categoryName}</span>
                              </td>
                              <td className="py-1.5 px-4 text-right font-mono text-[11px]">
                                {cb.count}
                              </td>
                              <td className="py-1.5 px-4 text-right font-mono text-[11px]">
                                {pnlData.netRevenue > 0
                                  ? `${((cb.amount / pnlData.netRevenue) * 100).toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td className="py-1.5 px-6 text-right font-mono font-semibold text-slate-700">
                                {fmt(cb.amount)}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                <tr className="bg-amber-100/50 border-t-2 border-amber-300 font-extrabold text-amber-950">
                  <td className="py-3 px-6 font-mono text-xs">TOTAL II</td>
                  <td className="py-3 px-4 uppercase text-xs tracking-wide">
                    Total Cost of Sales / Direct Operational Costs
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    {pnlData.directCostLines.reduce((s, l) => s + l.count, 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    {pnlData.netRevenue > 0
                      ? `${((pnlData.totalDirectCosts / pnlData.netRevenue) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-sm">
                    (<NairaSign />
                    {fmt(pnlData.totalDirectCosts)})
                  </td>
                </tr>

                {/* GROSS PROFIT HIGHLIGHT BAR */}
                <tr className="bg-slate-900 text-white font-extrabold">
                  <td className="py-3.5 px-6 font-mono text-xs text-blue-300">GROSS PROFIT</td>
                  <td className="py-3.5 px-4 uppercase text-xs tracking-wider">
                    Gross Profit / (Loss) From Operations (I − II)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-300">—</td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-emerald-300">
                    {pnlData.grossMarginPct.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-base text-white">
                    <NairaSign />
                    {fmtAccounting(pnlData.grossProfit)}
                  </td>
                </tr>

                {/* SECTION III: OPERATING EXPENSES (OPEX) */}
                <tr className="bg-rose-50/60 border-y border-rose-200/70">
                  <td colSpan={5} className="py-2.5 px-6 text-xs font-extrabold uppercase tracking-wider text-rose-900">
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
                          className={`transition-colors ${
                            isSuspense
                              ? 'bg-amber-50/70 hover:bg-amber-100/60'
                              : line.amount > 0
                              ? 'hover:bg-rose-50/40'
                              : 'opacity-60'
                          }`}
                        >
                          <td className="py-2.5 px-6 font-mono text-xs font-bold text-slate-600">
                            <button
                              type="button"
                              onClick={() => toggleExpandCode(line.code)}
                              className="inline-flex items-center gap-1 hover:text-blue-600"
                            >
                              {line.categoryBreakdowns.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )
                              ) : (
                                <span className="w-3.5" />
                              )}
                              {line.code}
                            </button>
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="py-2.5 px-4 font-semibold text-slate-800 cursor-pointer"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={isSuspense ? 'text-amber-900 font-bold' : ''}>
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
                                  className="inline-flex items-center gap-1 rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-950 hover:bg-amber-300"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Allocate in Scrutiny →
                                </button>
                              )}
                              {line.categoryBreakdowns.map((cb) => (
                                <span
                                  key={cb.categoryName}
                                  className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200"
                                >
                                  {cb.categoryName}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                            {line.count > 0 ? line.count : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                            {line.amount > 0 && pnlData.netRevenue > 0
                              ? `${pctRev.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td
                            onClick={() => openDrilldown(line.name, line.code, line.entries)}
                            className="py-2.5 px-6 text-right font-mono font-bold text-slate-800 cursor-pointer"
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
                              className="bg-slate-50/80 hover:bg-blue-50/40 cursor-pointer text-xs text-slate-600"
                            >
                              <td className="py-1.5 px-6 font-mono text-[11px] text-slate-400 text-right">
                                ↳
                              </td>
                              <td className="py-1.5 px-4 pl-8 font-medium text-slate-700">
                                Ledger Category: <span className="font-bold">{cb.categoryName}</span>
                              </td>
                              <td className="py-1.5 px-4 text-right font-mono text-[11px]">
                                {cb.count}
                              </td>
                              <td className="py-1.5 px-4 text-right font-mono text-[11px]">
                                {pnlData.netRevenue > 0
                                  ? `${((cb.amount / pnlData.netRevenue) * 100).toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td className="py-1.5 px-6 text-right font-mono font-semibold text-slate-700">
                                {fmt(cb.amount)}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                <tr className="bg-rose-100/50 border-t-2 border-rose-300 font-extrabold text-rose-950">
                  <td className="py-3 px-6 font-mono text-xs">TOTAL III</td>
                  <td className="py-3 px-4 uppercase text-xs tracking-wide">
                    Total Operating Expenses (OPEX)
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    {pnlData.opexLines.reduce((s, l) => s + l.count, 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs">
                    {pnlData.netRevenue > 0
                      ? `${((pnlData.totalOpex / pnlData.netRevenue) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-sm">
                    (<NairaSign />
                    {fmt(pnlData.totalOpex)})
                  </td>
                </tr>

                {/* NET PROFIT / LOSS FINAL DOUBLE-UNDERLINED ROW */}
                <tr
                  className={`border-t-4 border-double font-extrabold text-base ${
                    pnlData.netOperatingProfit >= 0
                      ? 'bg-emerald-950 text-white border-emerald-400'
                      : 'bg-rose-950 text-white border-rose-400'
                  }`}
                >
                  <td className="py-4 px-6 font-mono text-xs uppercase tracking-wider text-emerald-300">
                    NET PROFIT
                  </td>
                  <td className="py-4 px-4 uppercase tracking-wider text-sm">
                    Net Operating Profit / (Loss) For The Period (I − II − III)
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-xs text-slate-300">—</td>
                  <td className="py-4 px-4 text-right font-mono text-xs text-emerald-300">
                    {pnlData.netMarginPct.toFixed(1)}%
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-lg underline decoration-double underline-offset-4">
                    <NairaSign />
                    {fmtAccounting(pnlData.netOperatingProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Non-P&L Ledger Reconciliation Footnote (CapEx / VAT Remittances) */}
          {pnlData.nonPnlLines.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reconciliation Note: Non-P&amp;L Balance Sheet Disbursements in Expense Ledger
                </div>
                <div className="text-xs font-mono font-semibold text-slate-600">
                  Total Ledger Vouchers Disbursed: <NairaSign />
                  {fmt(pnlData.totalLedgerDisbursements)}
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                The following ledger categories are allocated to Balance Sheet accounts (Fixed Assets / CapEx or Tax Liabilities) and are therefore excluded from Profit &amp; Loss Operating Expenses:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {pnlData.nonPnlLines.map((line) => (
                  <div
                    key={line.code}
                    onClick={() => openDrilldown(line.name, line.code, line.entries)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:border-blue-300 cursor-pointer"
                  >
                    <div>
                      <span className="font-mono font-bold text-blue-700 mr-1.5">
                        [{line.code}]
                      </span>
                      <span className="font-semibold text-slate-800">{line.name}</span>
                      <div className="text-[10px] text-slate-400">
                        Categories: {line.categoryBreakdowns.map((c) => c.categoryName).join(', ')}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900">
                      <NairaSign />
                      {fmt(line.amount)}
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
              className={`rounded-xl border p-4 ${
                scrutinyAnalytics.unallocatedSpend > 0
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
                  : `${
                      scrutinyAnalytics.unallocatedCategories.filter((c) => c.count > 0).length
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
                  ? `${scrutinyAnalytics.largestVoucher.category} • ${
                      scrutinyAnalytics.largestVoucher.vendor ||
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
                              className={`h-7 w-full rounded border px-2 text-[11px] font-semibold ${
                                row.coaCode
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
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                row.coaSection === 'DIRECT_COST'
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
                    label: `High-Value Outliers (${
                      scrutinyAnalytics.enrichedVouchers.filter((v) =>
                        v.flags.includes('HIGH_VALUE')
                      ).length
                    })`,
                  },
                  {
                    id: 'UNALLOCATED',
                    label: `Unallocated CoA (${
                      scrutinyAnalytics.enrichedVouchers.filter((v) =>
                        v.flags.includes('UNALLOCATED')
                      ).length
                    })`,
                  },
                  {
                    id: 'MISSING_META',
                    label: `Missing Vendor / Voucher # (${
                      scrutinyAnalytics.enrichedVouchers.filter((v) =>
                        v.flags.includes('MISSING_META')
                      ).length
                    })`,
                  },
                  {
                    id: 'DIRECT_NO_SITE',
                    label: `Direct Cost Missing Site (${
                      scrutinyAnalytics.enrichedVouchers.filter((v) =>
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
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    scrutinyFlagFilter === pill.id
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
                                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    f === 'HIGH_VALUE'
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
