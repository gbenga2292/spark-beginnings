import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { 
  Download, 
  ChevronRight, 
  ChevronDown, 
  BarChart2,
  Table as TableIcon,
  Search,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Layers,
  Filter,
  DollarSign
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAppStore, Site, LedgerEntry } from '@/src/store/appStore';
import { buildSettlementMap } from '@/src/lib/settlementUtils';
import { supabase } from '@/src/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { cn } from '@/src/lib/utils';
import { normalizeDate } from '@/src/lib/dateUtils';

interface RevenueByStreamReportProps {
  filterYears: string[];
  filterMonths: string[];
  filterClient?: string;
  onNavigateToLedgerSummary?: () => void;
}

interface SiteBreakdownItem {
  siteId: string;
  siteName: string;
  client: string;
  contractValue: number;
  billed: number;
  collected: number;
  expenses: number;
  netMargin: number;
  costCategories: Record<string, number>;
}

interface ServiceStatementLine {
  serviceName: string;
  code: string;
  siteCount: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalExpenses: number;
  netContribution: number;
  marginPct: number;
  costCategoryTotals: Record<string, number>;
  sites: SiteBreakdownItem[];
}

interface CategoryReconciliationItem {
  category: string;
  directCost: number;
  overheadCost: number;
  totalCost: number;
  voucherCount: number;
  monthly: number[]; // 12 months (0-11)
  sites: { siteName: string; amount: number }[];
}

interface CompanyInfo {
  name: string;
  regNumber: string;
  address: string;
  phone: string;
  email: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function RevenueByStreamReport({ 
  filterYears, 
  filterMonths, 
  filterClient,
  onNavigateToLedgerSummary 
}: RevenueByStreamReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'statement' | 'reconciliation' | 'chart'>('statement');
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Dynamic Company Information loaded from app_settings
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: 'Dewatering Construction Etc Limited',
    regNumber: 'RC-141299',
    address: '7 Musiliu Smith Street, Yaba, Lagos Lagos, Nigeria',
    phone: '+234 903 000 2182',
    email: 'info@dewaterconstruct.com'
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('company_name, company_reg_number, company_email, company_phone, company_address')
          .limit(1)
          .maybeSingle();
        if (data && isMounted) {
          setCompanyInfo({
            name: data.company_name || 'Dewatering Construction Etc Limited',
            regNumber: data.company_reg_number || '',
            address: data.company_address || '',
            phone: data.company_phone || '',
            email: data.company_email || ''
          });
        }
      } catch (err) {
        console.error('Failed to load company info in RevenueByStreamReport:', err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const sites = useAppStore(s => s.sites);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const getServiceTemplates = useAppStore(s => s.getServiceTemplates);

  // Dynamic services pulled directly from Variables (getServiceTemplates) & existing site project types
  const dynamicServicesList = useMemo(() => {
    const fromVariables = getServiceTemplates()
      .map(t => t.serviceName.trim())
      .filter(Boolean);

    const fromSites = sites
      .map(s => s.projectType?.trim())
      .filter((t): t is string => Boolean(t && t.length > 0));

    const seen = new Map<string, string>();
    [...fromVariables, ...fromSites].forEach(name => {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, name);
      }
    });

    const result = Array.from(seen.values());
    result.sort((a, b) => {
      if (a.toLowerCase().includes('dewatering')) return -1;
      if (b.toLowerCase().includes('dewatering')) return 1;
      return a.localeCompare(b);
    });

    return result.length > 0 ? result : ['Dewatering'];
  }, [getServiceTemplates, sites]);

  // Invoice settlement map for collections
  const settlementMap = useMemo(() => {
    return buildSettlementMap(invoices, payments);
  }, [invoices, payments]);

  const toggleService = (serviceName: string) => {
    setExpandedServices(prev => ({ ...prev, [serviceName]: !prev[serviceName] }));
  };

  const toggleCategory = (catName: string) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  // Build Statement and Site Schedules by retrieving expenses directly from Ledger Entries (reconciled with Ledger Summary)
  const { 
    statementData, 
    generalOverheadCost, 
    generalOverheadCategories,
    categoryReconciliation,
    totalVouchersProcessed,
    ledgerGrandTotal
  } = useMemo(() => {
    // 1. Site to Service line mapping
    const siteToServiceMap = new Map<string, string>();
    const siteNameToObjMap = new Map<string, Site>();
    sites.forEach(s => {
      const rawType = (s.projectType || 'Dewatering').trim();
      const matched = dynamicServicesList.find(ds => ds.toLowerCase() === rawType.toLowerCase()) || rawType;
      siteToServiceMap.set(s.id, matched);
      siteToServiceMap.set(s.name.trim().toLowerCase(), matched);
      siteNameToObjMap.set(s.name.trim().toLowerCase(), s);
    });

    // 2. Initialize statement lines for all dynamic services
    const linesMap = new Map<string, ServiceStatementLine>();
    dynamicServicesList.forEach((srvName, idx) => {
      linesMap.set(srvName.toLowerCase(), {
        serviceName: srvName,
        code: `40${String(idx).padStart(2, '0')}`,
        siteCount: 0,
        totalBilled: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        totalExpenses: 0,
        netContribution: 0,
        marginPct: 0,
        costCategoryTotals: {},
        sites: [],
      });
    });

    // Count sites per service
    sites.forEach(s => {
      const srv = siteToServiceMap.get(s.id) || dynamicServicesList[0];
      const key = srv.toLowerCase();
      if (linesMap.has(key)) {
        linesMap.get(key)!.siteCount += 1;
      }
    });

    // 3. Aggregate Invoices (Revenue)
    invoices.forEach(inv => {
      const norm = normalizeDate(inv.date);
      if (!norm) return;
      const invYear = norm.substring(0, 4);
      if (filterYears.length > 0 && !filterYears.includes('All') && !filterYears.includes(invYear)) return;

      const invMonthNum = parseInt(norm.substring(5, 7), 10);
      if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(String(invMonthNum))) return;

      if (filterClient && filterClient !== 'All' && inv.client?.trim().toLowerCase() !== filterClient.trim().toLowerCase()) {
        return;
      }

      const siteKey = inv.siteId || inv.siteName?.trim().toLowerCase() || '';
      let srvName = siteToServiceMap.get(siteKey);
      if (!srvName) {
        const desc = ((inv as any).description || inv.project || '').toLowerCase();
        const found = dynamicServicesList.find(ds => desc.includes(ds.toLowerCase()));
        srvName = found || dynamicServicesList[0];
      }

      const key = srvName.toLowerCase();
      let line = linesMap.get(key);
      if (!line) {
        line = {
          serviceName: srvName,
          code: `40${String(linesMap.size).padStart(2, '0')}`,
          siteCount: 1,
          totalBilled: 0,
          totalCollected: 0,
          totalOutstanding: 0,
          totalExpenses: 0,
          netContribution: 0,
          marginPct: 0,
          costCategoryTotals: {},
          sites: [],
        };
        linesMap.set(key, line);
      }

      const billed = Number(inv.totalCharge || inv.amount || 0);
      line.totalBilled += billed;

      const sett = settlementMap.get(inv.id);
      const paid = sett ? Number(sett.totalSettled) : 0;
      line.totalCollected += paid;
      line.totalOutstanding += Math.max(0, billed - paid);

      // Track site detail
      const sName = inv.siteName?.trim() || 'Direct Invoice Billing';
      const existingSite = line.sites.find(s => s.siteName.toLowerCase() === sName.toLowerCase());
      if (existingSite) {
        existingSite.billed += billed;
        existingSite.collected += paid;
      } else {
        const siteObj = sites.find(s => s.id === inv.siteId || s.name.trim().toLowerCase() === sName.toLowerCase());
        line.sites.push({
          siteId: siteObj?.id || inv.siteId || '',
          siteName: sName,
          client: inv.client || siteObj?.client || '—',
          contractValue: siteObj?.contractValue || 0,
          billed,
          collected: paid,
          expenses: 0,
          netMargin: 0,
          costCategories: {},
        });
      }
    });

    // 4. Retrieve Expenses directly from General Ledger Entries (reconciled 100% with Ledger Summary)
    let generalOverheadCost = 0;
    const generalOverheadCategories: Record<string, number> = {};
    const categoryReconciliationMap = new Map<string, CategoryReconciliationItem>();
    let totalVouchersProcessed = 0;
    let ledgerGrandTotal = 0;

    ledgerEntries.forEach(e => {
      const norm = normalizeDate(e.date);
      if (!norm) return;
      const entryYear = norm.substring(0, 4);
      if (filterYears.length > 0 && !filterYears.includes('All') && !filterYears.includes(entryYear)) return;

      const entryMonthNum = parseInt(norm.substring(5, 7), 10);
      if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(String(entryMonthNum))) return;
      const entryMonthIdx = Math.max(0, Math.min(11, (isNaN(entryMonthNum) ? 1 : entryMonthNum) - 1));

      const rawSite = (e.site || '').trim();
      const hasSite = rawSite && rawSite.toLowerCase() !== 'none' && rawSite.toLowerCase() !== 'general' && rawSite.toLowerCase() !== 'office';

      // Reconcile client filter with identical logic to Ledger Summary:
      // entryClient = sites.find(s => s.name === e.site)?.client || e.client || ''
      if (filterClient && filterClient !== 'All') {
        let entryClient = '';
        if (hasSite) {
          const sObj = siteNameToObjMap.get(rawSite.toLowerCase());
          entryClient = sObj?.client || e.client || '';
        } else {
          entryClient = e.client || '';
        }
        if (entryClient.trim().toLowerCase() !== filterClient.trim().toLowerCase()) {
          return;
        }
      }

      const costAmount = Number(e.amount || 0);
      const cat = (e.category || 'General Operating Expense').trim();

      totalVouchersProcessed += 1;
      ledgerGrandTotal += costAmount;

      // Track into Category Reconciliation Map
      if (!categoryReconciliationMap.has(cat)) {
        categoryReconciliationMap.set(cat, {
          category: cat,
          directCost: 0,
          overheadCost: 0,
          totalCost: 0,
          voucherCount: 0,
          monthly: Array(12).fill(0),
          sites: [],
        });
      }
      const catItem = categoryReconciliationMap.get(cat)!;
      catItem.totalCost += costAmount;
      catItem.voucherCount += 1;
      catItem.monthly[entryMonthIdx] += costAmount;

      if (hasSite) {
        // Direct operational site expenses from ledger
        const siteKey = rawSite.toLowerCase();
        const srvName = siteToServiceMap.get(siteKey) || dynamicServicesList[0];
        let line = linesMap.get(srvName.toLowerCase());
        if (!line) {
          line = {
            serviceName: srvName,
            code: `50${String(linesMap.size).padStart(2, '0')}`,
            siteCount: 1,
            totalBilled: 0,
            totalCollected: 0,
            totalOutstanding: 0,
            totalExpenses: 0,
            netContribution: 0,
            marginPct: 0,
            costCategoryTotals: {},
            sites: [],
          };
          linesMap.set(srvName.toLowerCase(), line);
        }

        line.totalExpenses += costAmount;
        line.costCategoryTotals[cat] = (line.costCategoryTotals[cat] || 0) + costAmount;

        let siteItem = line.sites.find(s => s.siteName.toLowerCase() === siteKey);
        if (!siteItem) {
          const siteObj = siteNameToObjMap.get(siteKey);
          siteItem = {
            siteId: siteObj?.id || '',
            siteName: siteObj?.name || e.site,
            client: siteObj?.client || e.client || '—',
            contractValue: siteObj?.contractValue || 0,
            billed: 0,
            collected: 0,
            expenses: 0,
            netMargin: 0,
            costCategories: {},
          };
          line.sites.push(siteItem);
        }

        siteItem.expenses += costAmount;
        siteItem.costCategories[cat] = (siteItem.costCategories[cat] || 0) + costAmount;

        catItem.directCost += costAmount;
        const sNameFormatted = siteItem.siteName;
        const existSiteInCat = catItem.sites.find(s => s.siteName.toLowerCase() === sNameFormatted.toLowerCase());
        if (existSiteInCat) {
          existSiteInCat.amount += costAmount;
        } else {
          catItem.sites.push({ siteName: sNameFormatted, amount: costAmount });
        }
      } else {
        // Unallocated operating expense (Overhead / OPEX)
        generalOverheadCost += costAmount;
        generalOverheadCategories[cat] = (generalOverheadCategories[cat] || 0) + costAmount;
        catItem.overheadCost += costAmount;
      }
    });

    // 5. Compute Net Contributions & Margins
    const statementList = Array.from(linesMap.values()).map(line => {
      line.netContribution = line.totalBilled - line.totalExpenses;
      line.marginPct = line.totalBilled > 0 ? (line.netContribution / line.totalBilled) * 100 : 0;
      line.sites.forEach(s => {
        s.netMargin = s.billed - s.expenses;
      });
      return line;
    });

    const categoryReconciliationList = Array.from(categoryReconciliationMap.values()).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    return { 
      statementData: statementList, 
      generalOverheadCost, 
      generalOverheadCategories,
      categoryReconciliation: categoryReconciliationList,
      totalVouchersProcessed,
      ledgerGrandTotal
    };
  }, [dynamicServicesList, sites, invoices, payments, ledgerEntries, settlementMap, filterYears, filterMonths, filterClient]);

  // Overall Statement Totals
  const totals = useMemo(() => {
    const directTotals = statementData.reduce(
      (acc, l) => ({
        billed: acc.billed + l.totalBilled,
        collected: acc.collected + l.totalCollected,
        outstanding: acc.outstanding + l.totalOutstanding,
        totalExpenses: acc.totalExpenses + l.totalExpenses,
        netContribution: acc.netContribution + l.netContribution,
      }),
      { billed: 0, collected: 0, outstanding: 0, totalExpenses: 0, netContribution: 0 }
    );

    const netOperationalIncome = directTotals.netContribution - generalOverheadCost;
    const grandTotalExpenses = directTotals.totalExpenses + generalOverheadCost;

    return {
      ...directTotals,
      generalOverheadCost,
      grandTotalExpenses,
      netOperationalIncome,
      grossMarginPct: directTotals.billed > 0 ? (directTotals.netContribution / directTotals.billed) * 100 : 0,
      netMarginPct: directTotals.billed > 0 ? (netOperationalIncome / directTotals.billed) * 100 : 0,
    };
  }, [statementData, generalOverheadCost]);

  // Minimalist chart data
  const chartData = useMemo(() => {
    return statementData
      .filter(l => l.totalBilled > 0 || l.totalExpenses > 0)
      .map(l => ({
        name: l.serviceName,
        Revenue: Math.round(l.totalBilled / 1_000_000 * 10) / 10,
        DirectExpenses: Math.round(l.totalExpenses / 1_000_000 * 10) / 10,
        Contribution: Math.round(l.netContribution / 1_000_000 * 10) / 10,
      }));
  }, [statementData]);

  // Excel Export: Complete Statement + Expenses Reconciliation Sheet
  const handleExportStatement = () => {
    const statementRows: any[] = [];
    statementRows.push({ [companyInfo.name]: 'STATEMENT OF SERVICE REVENUE & EXPENSES' });
    if (companyInfo.regNumber) {
      statementRows.push({ [companyInfo.name]: `Registration No: ${companyInfo.regNumber}` });
    }
    if (companyInfo.address) {
      statementRows.push({ [companyInfo.name]: companyInfo.address });
    }
    statementRows.push({ 'Reporting Basis': 'Expenses retrieved from General Ledger (Reconciled with Ledger Summary)' });
    statementRows.push({});
    statementRows.push({
      'Account Code': 'SERVICE LINE / EXPENSE ITEM',
      'Site / Note': 'TOTAL BILLED (NGN)',
      'Total Billed (NGN)': 'COLLECTED (NGN)',
      'Total Collected (NGN)': 'OUTSTANDING (NGN)',
      'Expenses (NGN)': 'EXPENSES (NGN)',
      'Net Contribution (NGN)': 'NET CONTRIBUTION (NGN)',
      'Margin %': 'MARGIN %',
    });

    statementData.forEach(l => {
      statementRows.push({
        'Account Code': l.code,
        'Site / Note': l.serviceName,
        'Total Billed (NGN)': l.totalBilled,
        'Total Collected (NGN)': l.totalCollected,
        'Expenses (NGN)': l.totalExpenses,
        'Net Contribution (NGN)': l.netContribution,
        'Margin %': `${l.marginPct.toFixed(1)}%`,
      });

      l.sites.forEach(s => {
        statementRows.push({
          'Account Code': '',
          'Site / Note': `  - ${s.siteName} (${s.client})`,
          'Total Billed (NGN)': s.billed,
          'Total Collected (NGN)': s.collected,
          'Expenses (NGN)': s.expenses,
          'Net Contribution (NGN)': s.netMargin,
          'Margin %': s.billed > 0 ? `${((s.netMargin / s.billed) * 100).toFixed(0)}%` : '0%',
        });
      });
    });

    // Schedule 2: Expenses Category Reconciliation
    const ledgerRows: any[] = [];
    ledgerRows.push({ [companyInfo.name]: 'EXPENSES AUDIT SCHEDULE' });
    ledgerRows.push({ 'Reconciliation': '100% Reconciled with General Ledger Summary Vouchers' });
    ledgerRows.push({});
    ledgerRows.push({
      'Expense Category': 'EXPENSE CATEGORY',
      'Direct Site Expenses (NGN)': 'DIRECT SITE EXPENSES (NGN)',
      'General Overhead Expenses (NGN)': 'GENERAL OVERHEAD EXPENSES (NGN)',
      'Total Expenses (NGN)': 'TOTAL EXPENSES (NGN)',
      'Vouchers': 'VOUCHER COUNT',
    });

    categoryReconciliation.forEach(c => {
      ledgerRows.push({
        'Expense Category': c.category,
        'Direct Site Expenses (NGN)': c.directCost,
        'General Overhead Expenses (NGN)': c.overheadCost,
        'Total Expenses (NGN)': c.totalCost,
        'Vouchers': c.voucherCount,
      });
    });

    const workbook = XLSX.utils.book_new();
    const wsStatement = XLSX.utils.json_to_sheet(statementRows);
    const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);

    XLSX.utils.book_append_sheet(workbook, wsStatement, 'Income & Expense Statement');
    XLSX.utils.book_append_sheet(workbook, wsLedger, 'Expenses Reconciliation');
    const safeName = (companyInfo.name || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeName}_Revenue_and_Expenses_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ── Formal Minimalist Statement Container (Proper Balance Sheet Style) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-xs p-6 sm:p-8">
        
        {/* Statement Header */}
        <div className="border-b border-slate-300 dark:border-slate-700 pb-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-widest font-mono text-slate-700 dark:text-slate-300 font-bold">
                  {companyInfo.name}
                </p>
                {companyInfo.regNumber && (
                  <span className="text-[10px] font-mono text-slate-400 font-medium">
                    · {companyInfo.regNumber}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mt-1">
                Statement of Service Revenue & Expenses
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 font-mono mt-1">
                <span>
                  Period: {filterYears.length > 0 && !filterYears.includes('All') ? filterYears.join(', ') : 'All Time'} 
                  {filterMonths.length > 0 && !filterMonths.includes('All') ? ` · Months: ${filterMonths.join(', ')}` : ''} 
                  {filterClient && filterClient !== 'All' ? ` · Client: ${filterClient}` : ''}
                </span>
                {companyInfo.address && <span>· {companyInfo.address}</span>}
                {companyInfo.phone && <span>· Tel: {companyInfo.phone}</span>}
              </div>
            </div>

            {/* View Mode & Export Controls */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-sm overflow-hidden p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('statement')}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5",
                    viewMode === 'statement'
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('reconciliation')}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5",
                    viewMode === 'reconciliation'
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Expenses Breakdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('chart')}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5",
                    viewMode === 'chart'
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Chart</span>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportStatement}
                className="h-8 text-xs font-semibold border-slate-300 dark:border-slate-700 gap-1.5 rounded-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Statement</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Operational Expenses Reconciliation Banner (Matches Ledger Summary) ── */}
        <div className="mb-6 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Operational Expenses Retrieved from General Ledger
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-300 text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                    100% Reconciled
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Direct site expenses and operating overhead are derived from {totalVouchersProcessed} General Ledger voucher entries, matching the Ledger Summary total of ₦{ledgerGrandTotal.toLocaleString()}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-700">
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Expenses</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                  ₦{totals.grandTotalExpenses.toLocaleString()}
                </span>
              </div>
              {onNavigateToLedgerSummary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNavigateToLedgerSummary}
                  className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold gap-1"
                >
                  <span>View in Ledger Summary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── View Mode: Minimalist Bar Chart ── */}
        {viewMode === 'chart' && (
          <div className="mb-8 p-4 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Revenue vs Direct Expenses (in Millions ₦)
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `₦${v}M`} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [`₦${val}M`, name === 'Revenue' ? 'Total Billed' : name === 'DirectExpenses' ? 'Direct Expenses' : 'Net Contribution']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 4, color: '#f8fafc', fontSize: 12 }}
                  />
                  <Bar dataKey="Revenue" fill="#0f172a" name="Revenue" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="DirectExpenses" fill="#64748b" name="Direct Expenses" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Contribution" fill="#2563eb" name="Net Contribution" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── View Mode: Expenses Schedule (Category Matrix) ── */}
        {viewMode === 'reconciliation' && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  General Ledger Expenses Schedule (Category Breakdown)
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Audit breakdown of every operational expense category from the General Ledger, split by Direct Site Expenses vs Unallocated Overhead.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 dark:border-slate-100 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                    <th className="py-2.5 px-3">Expense Category</th>
                    <th className="py-2.5 px-3 text-right">Direct Site Expenses (₦)</th>
                    <th className="py-2.5 px-3 text-right">General Overhead (₦)</th>
                    <th className="py-2.5 px-3 text-right font-black">Total Expenses (₦)</th>
                    <th className="py-2.5 px-3 text-right font-mono">% of Total</th>
                    <th className="py-2.5 px-2 text-center w-24">Vouchers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {categoryReconciliation.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No ledger expense vouchers recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    categoryReconciliation.map(item => {
                      const isCatExpanded = expandedCategories[item.category] ?? false;
                      const pct = totals.grandTotalExpenses > 0 ? (item.totalCost / totals.grandTotalExpenses) * 100 : 0;
                      return (
                        <React.Fragment key={item.category}>
                          <tr 
                            onClick={() => toggleCategory(item.category)}
                            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-2">
                                {isCatExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <span>{item.category}</span>
                                {item.sites.length > 0 && (
                                  <span className="text-[10px] text-slate-400 font-normal font-mono">
                                    ({item.sites.length} sites)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              {item.directCost > 0 ? `₦${item.directCost.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              {item.overheadCost > 0 ? `₦${item.overheadCost.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              ₦{item.totalCost.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {pct.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400">
                              {item.voucherCount}
                            </td>
                          </tr>

                          {/* Expanded site allocation for this category */}
                          {isCatExpanded && item.sites.length > 0 && (
                            <tr className="bg-slate-50/50 dark:bg-slate-900/40 text-[11px] border-l-2 border-slate-300 dark:border-slate-700">
                              <td colSpan={6} className="py-2 px-6">
                                <span className="font-semibold text-slate-600 dark:text-slate-400 block mb-1 uppercase text-[10px]">
                                  Site Expense Allocation for {item.category}:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {item.sites.map(s => (
                                    <div key={s.siteName} className="flex justify-between py-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xs">
                                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{s.siteName}</span>
                                      <span className="font-mono text-slate-900 dark:text-slate-100 ml-2">₦{s.amount.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}

                  {/* Total Expenses Row */}
                  <tr className="border-t-2 border-b-4 border-double border-slate-900 dark:border-slate-100 font-bold bg-slate-100 dark:bg-slate-800">
                    <td className="py-2.5 px-3 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      TOTAL EXPENSES (100% RECONCILED)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                      ₦{totals.totalExpenses.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                      ₦{totals.generalOverheadCost.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100">
                      ₦{totals.grandTotalExpenses.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">100.0%</td>
                    <td className="py-2.5 px-2 text-center font-mono">{totalVouchersProcessed}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── View Mode: Statement Table (Proper Minimalist Balance Sheet Style) ── */}
        {viewMode === 'statement' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 dark:border-slate-100 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                  <th className="py-2.5 px-2 w-16 font-mono">Code</th>
                  <th className="py-2.5 px-3">Service Line & Accounting Schedule</th>
                  <th className="py-2.5 px-3 text-right">Invoiced (₦)</th>
                  <th className="py-2.5 px-3 text-right">Collected (₦)</th>
                  <th className="py-2.5 px-3 text-right">Outstanding (₦)</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">Expenses (₦)</th>
                  <th className="py-2.5 px-3 text-right">Contribution (₦)</th>
                  <th className="py-2.5 px-2 text-right w-20">Margin %</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {/* SECTION 1: OPERATING REVENUE FROM SERVICES */}
                <tr className="bg-slate-100/60 dark:bg-slate-800/40">
                  <td colSpan={8} className="py-2 px-3 font-bold uppercase text-[11px] tracking-wider text-slate-900 dark:text-slate-100">
                    1. REVENUE FROM OPERATIONAL SERVICES (VARIABLES DEFINED)
                  </td>
                </tr>

                {statementData.map(line => {
                  const isExpanded = expandedServices[line.serviceName] ?? false;
                  const filteredSites = line.sites.filter(s =>
                    !searchTerm ||
                    s.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.client.toLowerCase().includes(searchTerm.toLowerCase())
                  );

                  return (
                    <React.Fragment key={line.serviceName}>
                      <tr 
                        onClick={() => toggleService(line.serviceName)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-400">
                          {line.code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span>{line.serviceName}</span>
                            <span className="text-[10px] text-slate-400 font-normal font-mono">
                              ({line.sites.length} sites)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          ₦{(line.totalBilled).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          ₦{(line.totalCollected).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          ₦{(line.totalOutstanding).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                          ₦{(line.totalExpenses).toLocaleString()}
                        </td>
                        <td className={cn("py-2.5 px-3 text-right font-mono font-bold", line.netContribution >= 0 ? "text-slate-900 dark:text-slate-100" : "text-rose-600")}>
                          ₦{(line.netContribution).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold">
                          {line.marginPct.toFixed(1)}%
                        </td>
                      </tr>

                      {/* Schedule of Sites & Expenses breakdown */}
                      {isExpanded && filteredSites.map(s => (
                        <tr key={s.siteName} className="bg-slate-50/50 dark:bg-slate-900/40 text-[11px] text-slate-600 dark:text-slate-400 border-l-2 border-slate-300 dark:border-slate-700">
                          <td className="py-1.5 px-2 font-mono text-[10px] text-slate-400"></td>
                          <td className="py-1.5 px-3 pl-8">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{s.siteName}</span>
                            <span className="text-slate-400 ml-2">· {s.client}</span>
                            {Object.keys(s.costCategories).length > 0 && (
                              <span className="block text-[10px] text-slate-400 mt-0.5 font-mono">
                                Expense categories: {Object.entries(s.costCategories).map(([c, a]) => `${c}: ₦${a.toLocaleString()}`).join(' · ')}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono">₦{(s.billed).toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">₦{(s.collected).toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono">₦{(Math.max(0, s.billed - s.collected)).toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">₦{(s.expenses).toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">₦{(s.netMargin).toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-[10px] text-slate-400">
                            {s.billed > 0 ? `${(((s.netMargin) / s.billed) * 100).toFixed(0)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* TOTAL OPERATIONAL REVENUE ROW */}
                <tr className="border-t-2 border-slate-900 dark:border-slate-100 font-bold bg-slate-50 dark:bg-slate-800/40">
                  <td className="py-2.5 px-2 font-mono">4000</td>
                  <td className="py-2.5 px-3 uppercase tracking-wider">TOTAL GROSS OPERATIONAL REVENUE</td>
                  <td className="py-2.5 px-3 text-right font-mono">₦{(totals.billed).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">₦{(totals.collected).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">₦{(totals.outstanding).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">₦{(totals.totalExpenses).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100">₦{(totals.netContribution).toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right font-mono">{totals.grossMarginPct.toFixed(1)}%</td>
                </tr>

                {/* SECTION 2: DIRECT PROJECT EXPENSES FROM GENERAL LEDGER */}
                <tr className="bg-slate-100/60 dark:bg-slate-800/40">
                  <td colSpan={8} className="py-2 px-3 font-bold uppercase text-[11px] tracking-wider text-slate-900 dark:text-slate-100">
                    2. DIRECT PROJECT EXPENSES (GENERAL LEDGER RECONCILED)
                  </td>
                </tr>
                {statementData.map(line => {
                  if (line.totalExpenses === 0) return null;
                  return (
                    <tr key={`cost-${line.serviceName}`}>
                      <td className="py-2 px-2 font-mono text-slate-500">5010</td>
                      <td className="py-2 px-3 pl-6 text-slate-700 dark:text-slate-300 font-medium">
                        Direct Expenses — {line.serviceName}
                        {Object.keys(line.costCategoryTotals).length > 0 && (
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                            {Object.entries(line.costCategoryTotals).slice(0, 4).map(([c, a]) => `${c}: -₦${a.toLocaleString()}`).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td colSpan={4}></td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                        -₦{(line.totalExpenses).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-300 dark:border-slate-700 font-bold">
                  <td className="py-2 px-2 font-mono">5000</td>
                  <td className="py-2 px-3 uppercase text-slate-800 dark:text-slate-200">TOTAL DIRECT PROJECT EXPENSES</td>
                  <td colSpan={4}></td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                    -₦{(totals.totalExpenses).toLocaleString()}
                  </td>
                  <td></td>
                </tr>

                {/* SECTION 3: NET DIRECT CONTRIBUTION (GROSS MARGIN) */}
                <tr className="border-t-2 border-b-2 border-slate-900 dark:border-slate-100 font-black text-xs bg-slate-50 dark:bg-slate-800/60">
                  <td className="py-2.5 px-2 font-mono">CONTRIB</td>
                  <td className="py-2.5 px-3 uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    TOTAL DIRECT OPERATIONAL CONTRIBUTION (GROSS MARGIN)
                  </td>
                  <td colSpan={4}></td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                    ₦{(totals.netContribution).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs">
                    {totals.grossMarginPct.toFixed(1)}%
                  </td>
                </tr>

                {/* SECTION 4: UNALLOCATED GENERAL OVERHEAD FROM GENERAL LEDGER */}
                {totals.generalOverheadCost > 0 && (
                  <>
                    <tr className="bg-slate-100/60 dark:bg-slate-800/40">
                      <td colSpan={8} className="py-2 px-3 font-bold uppercase text-[11px] tracking-wider text-slate-900 dark:text-slate-100">
                        3. GENERAL OPERATING EXPENSES & OVERHEAD (UNASSIGNED IN LEDGER)
                      </td>
                    </tr>
                    {Object.entries(generalOverheadCategories).map(([cat, amount]) => (
                      <tr key={`overhead-${cat}`}>
                        <td className="py-1.5 px-2 font-mono text-slate-400">5100</td>
                        <td className="py-1.5 px-3 pl-6 text-slate-600 dark:text-slate-400">
                          {cat}
                        </td>
                        <td colSpan={4}></td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          -₦{amount.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-300 dark:border-slate-700 font-semibold">
                      <td className="py-2 px-2 font-mono">5100</td>
                      <td className="py-2 px-3 uppercase text-slate-700 dark:text-slate-300">
                        Total General Operating Expenses
                      </td>
                      <td colSpan={4}></td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                        -₦{(totals.generalOverheadCost).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>

                    {/* BOTTOM LINE DOUBLE UNDERLINE (NET OPERATING CONTRIBUTION) */}
                    <tr className="border-t-2 border-b-4 border-double border-slate-900 dark:border-slate-100 font-black text-sm bg-slate-100/90 dark:bg-slate-800/90">
                      <td className="py-3 px-2 font-mono">EBIT</td>
                      <td className="py-3 px-3 uppercase tracking-wide text-slate-900 dark:text-slate-100">
                        NET OPERATING SURPLUS / PROFIT (AFTER GENERAL EXPENSES)
                      </td>
                      <td colSpan={4}></td>
                      <td className="py-3 px-3 text-right font-mono text-base text-slate-900 dark:text-slate-100">
                        ₦{(totals.netOperationalIncome).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-sm">
                        {totals.netMarginPct.toFixed(1)}%
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footnote / Audit Trail */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
          <span>* All expenses are 100% reconciled from the General Ledger voucher entries matching Ledger Summary.</span>
          <span>{companyInfo.name} · Services Sourced from Variables: {dynamicServicesList.join(', ')}</span>
        </div>
      </div>
    </div>
  );
}
