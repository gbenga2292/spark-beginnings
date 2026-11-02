import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Building2, 
  MapPin, 
  CreditCard, 
  Maximize2, 
  Minimize2, 
  Download, 
  ArrowUpDown, 
  Filter, 
  Calendar, 
  Search, 
  Minus,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { useAppStore, LedgerEntry } from '@/src/store/appStore';
import { TransactionDrilldownDialog, DrillEntry } from '@/src/components/financial/TransactionDrilldownDialog';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import { cn } from '@/src/lib/utils';
import { normalizeDate } from '@/src/lib/dateUtils';

interface LedgerSummaryProps {
  filterYears: string[];
  filterMonths: string[];
  filterClient?: string;
}

type GroupDimension = 'category' | 'client' | 'site' | 'bank';
type SummaryTab = 'monthly-breakdown' | 'multi-year-compare';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${fmt(n)}`;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Distinct, high-contrast color per fiscal year
const YEAR_COLORS: Record<string, string> = {
  '2022': '#8b5cf6', // violet
  '2023': '#f59e0b', // amber
  '2024': '#10b981', // emerald
  '2025': '#2563eb', // strong blue
  '2026': '#ef4444', // red
  '2027': '#06b6d4', // cyan
  '2028': '#f97316', // orange
};
// Rotating fallback palette for years not explicitly listed above
const YEAR_COLOR_PALETTE = ['#2563eb','#ef4444','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const getYearColor = (yr: string, idx: number) =>
  YEAR_COLORS[yr] ?? YEAR_COLOR_PALETTE[idx % YEAR_COLOR_PALETTE.length];

export function LedgerSummaryReport({ filterYears, filterMonths, filterClient }: LedgerSummaryProps) {
  const ledgerEntries = useAppStore(state => state.ledgerEntries);
  const sites = useAppStore(state => state.sites);
  const loadedLedgerYears = useAppStore(state => state.loadedLedgerYears);
  const fetchLedgerYearIfNeeded = useAppStore(state => state.fetchLedgerYearIfNeeded);

  // Proactively make sure 2025 and 2026 are hydrated for comparison
  useEffect(() => {
    fetchLedgerYearIfNeeded(2025).catch(console.error);
    fetchLedgerYearIfNeeded(2026).catch(console.error);
  }, [fetchLedgerYearIfNeeded]);

  const [activeTab, setActiveTab] = useState<SummaryTab>('multi-year-compare');
  const [dimension, setDimension] = useState<GroupDimension>('category');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompareYears, setSelectedCompareYears] = useState<string[]>(['2025', '2026']);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [drilldown, setDrilldown] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    entries: DrillEntry[];
  }>({
    open: false,
    title: '',
    subtitle: '',
    entries: []
  });

  // Discover all distinct years available in the entire loaded ledger
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    ledgerEntries.forEach(e => {
      if (e.date) {
        const y = e.date.substring(0, 4);
        if (/^\d{4}$/.test(y)) yrs.add(y);
      }
    });
    // Ensure 2025 & 2026 are present in the list even if still streaming
    yrs.add('2025');
    yrs.add('2026');
    return Array.from(yrs).sort().reverse();
  }, [ledgerEntries]);

  // Keep selectedCompareYears populated with sensible defaults if available
  useEffect(() => {
    if (selectedCompareYears.length === 0 && availableYears.length >= 2) {
      setSelectedCompareYears(availableYears.slice(0, 2));
    }
  }, [availableYears, selectedCompareYears]);

  const toggleCompareYear = (yr: string) => {
    setSelectedCompareYears(prev => {
      if (prev.includes(yr)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(y => y !== yr);
      } else {
        const next = [...prev, yr].sort();
        // Fetch if not loaded
        fetchLedgerYearIfNeeded(Number(yr)).catch(console.error);
        return next;
      }
    });
  };

  // Helper function to extract grouping label based on active dimension
  const getGroupKey = (e: LedgerEntry): string => {
    if (dimension === 'category') return (e.category || 'Uncategorized').trim();
    if (dimension === 'client') return (e.client || 'DCEL Internal / Office').trim();
    if (dimension === 'site') return (e.site || 'Head Office').trim();
    if (dimension === 'bank') return (e.bank || 'Main Account').trim();
    return 'General';
  };

  // Client filter match logic
  const matchesClientFilter = (e: LedgerEntry): boolean => {
    if (!filterClient || filterClient === 'All') return true;
    let entryClient = e.client || '';
    if (!entryClient && e.site) {
      entryClient = sites.find(s => s.name === e.site)?.client || '';
    }
    return entryClient.trim().toLowerCase() === filterClient.trim().toLowerCase();
  };

  // Month filter match logic
  const matchesMonthFilter = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    if (filterMonths.length === 0 || filterMonths.includes('All')) return true;
    const norm = normalizeDate(dateStr);
    if (!norm) return false;
    const mthNum = String(parseInt(norm.substring(5, 7), 10));
    return filterMonths.includes(mthNum);
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     MULTI-YEAR COMPARISON COMPUTATION
     ───────────────────────────────────────────────────────────────────────────── */
  const comparisonData = useMemo(() => {
    const yearsToCompare = selectedCompareYears.slice().sort();
    
    // Group Map: groupKey -> { [year: string]: number }
    const groupTotals = new Map<string, Record<string, number>>();
    const groupEntries = new Map<string, Record<string, LedgerEntry[]>>();
    const yearGrandTotals: Record<string, number> = {};

    yearsToCompare.forEach(y => {
      yearGrandTotals[y] = 0;
    });

    ledgerEntries.forEach(entry => {
      if (!entry.date) return;
      const yr = entry.date.substring(0, 4);
      if (!yearsToCompare.includes(yr)) return;
      if (!matchesClientFilter(entry)) return;
      if (!matchesMonthFilter(entry.date)) return;

      const grp = getGroupKey(entry);
      const amt = Number(entry.amount || 0);

      if (!groupTotals.has(grp)) {
        const initRec: Record<string, number> = {};
        const initEnt: Record<string, LedgerEntry[]> = {};
        yearsToCompare.forEach(y => {
          initRec[y] = 0;
          initEnt[y] = [];
        });
        groupTotals.set(grp, initRec);
        groupEntries.set(grp, initEnt);
      }

      const rec = groupTotals.get(grp)!;
      const ent = groupEntries.get(grp)!;

      rec[yr] = (rec[yr] || 0) + amt;
      ent[yr] = ent[yr] || [];
      ent[yr].push(entry);

      yearGrandTotals[yr] = (yearGrandTotals[yr] || 0) + amt;
    });

    // Build rows
    const rows = Array.from(groupTotals.keys()).map(name => {
      const yearValues = groupTotals.get(name)!;
      const totalAll = Object.values(yearValues).reduce((a, b) => a + b, 0);

      // Variance calculation if comparing at least 2 years (e.g. latest vs previous)
      let diff = 0;
      let pctChange: number | null = null;
      if (yearsToCompare.length >= 2) {
        const prevYear = yearsToCompare[yearsToCompare.length - 2];
        const latestYear = yearsToCompare[yearsToCompare.length - 1];
        const prevVal = yearValues[prevYear] || 0;
        const latestVal = yearValues[latestYear] || 0;
        diff = latestVal - prevVal;
        if (prevVal > 0) {
          pctChange = ((latestVal - prevVal) / prevVal) * 100;
        } else if (latestVal > 0) {
          pctChange = 100;
        } else {
          pctChange = 0;
        }
      }

      return {
        name,
        yearValues,
        totalAll,
        diff,
        pctChange,
        entriesByYear: groupEntries.get(name)!
      };
    });

    // Filter by search
    const filteredRows = rows.filter(r => 
      !searchTerm.trim() || r.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );

    // Sort descending by highest total spend across compared years
    filteredRows.sort((a, b) => b.totalAll - a.totalAll);

    // Prepare chart data for top 12 items
    const chartData = filteredRows.slice(0, 12).map(r => {
      const point: any = { name: r.name };
      yearsToCompare.forEach(y => {
        point[y] = r.yearValues[y] || 0;
      });
      return point;
    });

    return {
      yearsToCompare,
      rows: filteredRows,
      yearGrandTotals,
      chartData
    };
  }, [ledgerEntries, selectedCompareYears, dimension, filterClient, filterMonths, searchTerm, sites]);

  /* ─────────────────────────────────────────────────────────────────────────────
     SINGLE-YEAR MONTHLY BREAKDOWN COMPUTATION (Legacy View Enhanced)
     ───────────────────────────────────────────────────────────────────────────── */
  const monthlyData = useMemo(() => {
    const activeYear = filterYears.includes('All') || filterYears.length === 0 
      ? (availableYears[0] || '2026') 
      : filterYears[0];

    const filtered = ledgerEntries.filter(e => {
      if (!e.date) return false;
      if (activeYear !== 'All' && !e.date.startsWith(activeYear)) return false;
      if (!matchesClientFilter(e)) return false;
      if (!matchesMonthFilter(e.date)) return false;
      return true;
    });

    const groups = new Map<string, { months: number[]; entries: LedgerEntry[]; total: number }>();

    filtered.forEach(e => {
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      const mth = d.getMonth();
      const grp = getGroupKey(e);
      const amt = Number(e.amount || 0);

      if (!groups.has(grp)) {
        groups.set(grp, { months: new Array(12).fill(0), entries: [], total: 0 });
      }
      const data = groups.get(grp)!;
      data.months[mth] += amt;
      data.entries.push(e);
      data.total += amt;
    });

    const rows = Array.from(groups.entries()).map(([name, data]) => ({
      name,
      months: data.months,
      entries: data.entries,
      total: data.total
    }));

    // Filter by search
    const filteredRows = rows.filter(r => 
      !searchTerm.trim() || r.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
    filteredRows.sort((a, b) => b.total - a.total);

    const grandTotal = filteredRows.reduce((s, r) => s + r.total, 0);

    return {
      activeYear,
      rows: filteredRows,
      grandTotal
    };
  }, [ledgerEntries, filterYears, filterMonths, filterClient, dimension, searchTerm, availableYears, sites]);

  // Drilldown opener
  const handleOpenDrilldown = (title: string, subtitle: string, rawEntries: LedgerEntry[]) => {
    const drillEntries: DrillEntry[] = rawEntries.map(e => ({
      id: e.id,
      date: e.date,
      ref: e.voucherNo || 'VOUCHER',
      description: e.description,
      party: e.vendor || e.enteredBy || undefined,
      client: e.client || undefined,
      site: e.site || undefined,
      category: e.category,
      bank: e.bank,
      amount: Number(e.amount || 0),
      side: 'debit',
      details: {
        'Voucher No': e.voucherNo,
        'Date': e.date,
        'Amount': `₦${fmt(Number(e.amount || 0))}`,
        'Category': e.category,
        'Paid From (Bank)': e.bank,
        'Client': e.client || '—',
        'Site': e.site || '—',
        'Vendor': e.vendor || '—',
        'Entered By': e.enteredBy || '—',
        'VAT Mode': e.vatMode || 'No',
        'VAT Amount': e.vatAmount ? `₦${fmt(Number(e.vatAmount))}` : '₦0.00'
      }
    }));

    setDrilldown({
      open: true,
      title,
      subtitle: `${subtitle} (${drillEntries.length} vouchers)`,
      entries: drillEntries
    });
  };

  // Export comparison to Excel
  const handleExportExcel = () => {
    if (activeTab === 'multi-year-compare') {
      const sheetData = comparisonData.rows.map(r => {
        const row: any = { [dimension.toUpperCase()]: r.name };
        comparisonData.yearsToCompare.forEach(y => {
          row[`${y} Amount (NGN)`] = r.yearValues[y] || 0;
        });
        row['Total All Years (NGN)'] = r.totalAll;
        if (comparisonData.yearsToCompare.length >= 2) {
          row['Variance (NGN)'] = r.diff;
          row['% Change'] = r.pctChange !== null ? `${r.pctChange.toFixed(1)}%` : '—';
        }
        return row;
      });

      // Total row
      const totalRow: any = { [dimension.toUpperCase()]: 'TOTAL' };
      comparisonData.yearsToCompare.forEach(y => {
        totalRow[`${y} Amount (NGN)`] = comparisonData.yearGrandTotals[y] || 0;
      });
      totalRow['Total All Years (NGN)'] = Object.values(comparisonData.yearGrandTotals).reduce((a, b) => a + b, 0);
      sheetData.push(totalRow);

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Multi-Year By ${dimension}`);
      XLSX.writeFile(wb, `DCEL_Ledger_MultiYear_Comparison_${dimension}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const sheetData = monthlyData.rows.map(r => {
        const row: any = { [dimension.toUpperCase()]: r.name };
        MONTH_NAMES.forEach((m, idx) => {
          row[m] = r.months[idx] || 0;
        });
        row['Total (NGN)'] = r.total;
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${monthlyData.activeYear} Monthly By ${dimension}`);
      XLSX.writeFile(wb, `DCEL_Ledger_Monthly_${monthlyData.activeYear}_${dimension}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  // Color palette for chart bars across years
  const YEAR_COLORS: Record<string, string> = {
    '2024': '#64748b',
    '2025': '#0284c7', // Sky Blue
    '2026': '#2563eb', // Royal Blue
    '2027': '#10b981', // Emerald
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          CANVAS CONTROLS & HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  General Ledger Expenditure Analytics & Multi-Year Canvas
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200">
                    Audited Vouchers
                  </Badge>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Compare multi-year spend trends across 2025 & 2026 or inspect monthly spending breakdowns by category, client, site, or bank.
                </p>
              </div>
            </div>
          </div>

          {/* Action Tabs & Export */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('multi-year-compare')}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                  activeTab === 'multi-year-compare'
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Multi-Year Comparison
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('monthly-breakdown')}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                  activeTab === 'monthly-breakdown'
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                Monthly Breakdown
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-1.5 text-xs font-medium border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Dimension & Search Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Dimension Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Group By:
            </span>
            {(
              [
                { id: 'category', label: 'Category', icon: Layers },
                { id: 'client', label: 'Client', icon: Building2 },
                { id: 'site', label: 'Site / Location', icon: MapPin },
                { id: 'bank', label: 'Disbursement Bank', icon: CreditCard },
              ] as const
            ).map(dim => {
              const Icon = dim.icon;
              return (
                <button
                  key={dim.id}
                  type="button"
                  onClick={() => setDimension(dim.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 border",
                    dimension === dim.id
                      ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-xs font-bold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {dim.label}
                </button>
              );
            })}
          </div>

          {/* Years selection pills (for multi-year compare) or Search */}
          <div className="flex items-center gap-2">
            {activeTab === 'multi-year-compare' && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-xs text-slate-400 font-medium">Compare:</span>
                {availableYears.map(yr => {
                  const isSelected = selectedCompareYears.includes(yr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => toggleCompareYear(yr)}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-full font-bold transition-all border",
                        isSelected
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent hover:border-slate-300"
                      )}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={`Search ${dimension}...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 text-xs h-8 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MULTI-YEAR COMPARISON TAB
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'multi-year-compare' && (
        <div className="space-y-6">
          {/* Top Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {comparisonData.yearsToCompare.map(yr => {
              const yrTotal = comparisonData.yearGrandTotals[yr] || 0;
              return (
                <Card key={yr} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <CardContent className="p-3.5 sm:p-4">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {yr} Total Spend
                    </p>
                    <h3 className="text-lg sm:text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                      {fmtCompact(yrTotal)}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      ₦{fmt(yrTotal)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            {/* Combined / Difference Card */}
            {comparisonData.yearsToCompare.length >= 2 && (() => {
              const y1 = comparisonData.yearsToCompare[comparisonData.yearsToCompare.length - 2];
              const y2 = comparisonData.yearsToCompare[comparisonData.yearsToCompare.length - 1];
              const val1 = comparisonData.yearGrandTotals[y1] || 0;
              const val2 = comparisonData.yearGrandTotals[y2] || 0;
              const diff = val2 - val1;
              const pct = val1 > 0 ? (diff / val1) * 100 : 0;
              const isUp = diff > 0;

              return (
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <CardContent className="p-3.5 sm:p-4">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {y2} vs {y1} Growth
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-lg sm:text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                        {fmtCompact(Math.abs(diff))}
                      </h3>
                      <span className={cn(
                        "text-xs font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded",
                        isUp ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                      )}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isUp ? 'Higher expenditure' : 'Lower expenditure'} in {y2}
                    </p>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Visual Comparison Chart */}
          {comparisonData.chartData.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <CardHeader className="py-3.5 px-4 sm:px-5 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span>Top 12 Spend Drivers: Multi-Year Side-by-Side</span>
                  <span className="text-xs font-normal text-slate-400">Values in NGN</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="h-72 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={comparisonData.chartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        angle={-25} 
                        textAnchor="end" 
                        interval={0} 
                        height={60} 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                      />
                      <YAxis 
                        tickFormatter={val => fmtCompact(val)} 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                      />
                      <RechartsTooltip 
                        formatter={(val: number, name: string) => [`₦${fmt(val)}`, `${name} Expenditure`]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      {comparisonData.yearsToCompare.map((yr, idx) => (
                        <Bar 
                          key={yr} 
                          dataKey={yr} 
                          name={`${yr} Spend`} 
                          fill={getYearColor(yr, idx)} 
                          radius={[4, 4, 0, 0]} 
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Multi-Year Comparison Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 py-3 px-4 sm:px-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 capitalize">
                  Comparative Analysis by {dimension}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Click any cell amount to inspect every matching voucher transaction.
                </CardDescription>
              </div>
              <div className="text-xs text-slate-400">
                Showing {comparisonData.rows.length} {dimension}s
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-semibold capitalize sticky left-0 z-30 bg-slate-900 min-w-[200px]">
                        {dimension}
                      </th>
                      {comparisonData.yearsToCompare.map(yr => (
                        <th key={yr} className="py-2.5 px-3 text-right font-semibold whitespace-nowrap min-w-[130px]">
                          {yr} Spend
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap min-w-[130px] bg-slate-950">
                        Total Combined
                      </th>
                      {comparisonData.yearsToCompare.length >= 2 && (
                        <>
                          <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap min-w-[110px]">
                            Variance
                          </th>
                          <th className="py-2.5 px-3 text-right font-semibold whitespace-nowrap min-w-[90px]">
                            % Change
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {comparisonData.rows.length === 0 ? (
                      <tr>
                        <td 
                          colSpan={comparisonData.yearsToCompare.length + 4} 
                          className="py-12 text-center text-slate-400 italic"
                        >
                          No expenses matching the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      comparisonData.rows.map((row, idx) => (
                        <tr 
                          key={row.name} 
                          className={cn(
                            "hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-900/40"
                          )}
                        >
                          {/* Dimension Label */}
                          <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200 sticky left-0 z-10 bg-inherit border-r border-slate-100 dark:border-slate-800">
                            {row.name}
                          </td>

                          {/* Year by Year Columns */}
                          {comparisonData.yearsToCompare.map(yr => {
                            const val = row.yearValues[yr] || 0;
                            const ent = row.entriesByYear[yr] || [];
                            return (
                              <td 
                                key={yr} 
                                className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap"
                              >
                                {val > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDrilldown(
                                      `${row.name} (${yr})`,
                                      `${yr} general ledger vouchers`,
                                      ent
                                    )}
                                    className="font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 hover:underline transition-colors"
                                  >
                                    ₦{fmt(val)}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Combined Total */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap bg-blue-50/30 dark:bg-blue-950/20">
                            <button
                              type="button"
                              onClick={() => {
                                const allEnt: LedgerEntry[] = [];
                                Object.values(row.entriesByYear).forEach(list => allEnt.push(...list));
                                handleOpenDrilldown(
                                  `${row.name} (All Compared Years)`,
                                  `Vouchers across ${comparisonData.yearsToCompare.join(', ')}`,
                                  allEnt
                                );
                              }}
                              className="hover:underline font-bold"
                            >
                              ₦{fmt(row.totalAll)}
                            </button>
                          </td>

                          {/* Variance & % Change Columns */}
                          {comparisonData.yearsToCompare.length >= 2 && (
                            <>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                <span className={cn(
                                  "font-medium",
                                  row.diff > 0 ? "text-amber-600 dark:text-amber-400" : row.diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                                )}>
                                  {row.diff > 0 ? `+₦${fmt(row.diff)}` : row.diff < 0 ? `-₦${fmt(Math.abs(row.diff))}` : '₦0.00'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                {row.pctChange !== null ? (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5",
                                      row.pctChange > 0 
                                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                                        : row.pctChange < 0 
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                          : "bg-slate-50 text-slate-600 border-slate-200"
                                    )}
                                  >
                                    {row.pctChange > 0 ? `+${row.pctChange.toFixed(1)}%` : `${row.pctChange.toFixed(1)}%`}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}

                    {/* Grand Total Row */}
                    {comparisonData.rows.length > 0 && (
                      <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                          TOTAL EXPENDITURE
                        </td>
                        {comparisonData.yearsToCompare.map(yr => (
                          <td key={yr} className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            ₦{fmt(comparisonData.yearGrandTotals[yr] || 0)}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-700 dark:text-blue-300 whitespace-nowrap bg-blue-100/50 dark:bg-blue-900/40">
                          ₦{fmt(Object.values(comparisonData.yearGrandTotals).reduce((a, b) => a + b, 0))}
                        </td>
                        {comparisonData.yearsToCompare.length >= 2 && (() => {
                          const y1 = comparisonData.yearsToCompare[comparisonData.yearsToCompare.length - 2];
                          const y2 = comparisonData.yearsToCompare[comparisonData.yearsToCompare.length - 1];
                          const t1 = comparisonData.yearGrandTotals[y1] || 0;
                          const t2 = comparisonData.yearGrandTotals[y2] || 0;
                          const d = t2 - t1;
                          const p = t1 > 0 ? (d / t1) * 100 : 0;
                          return (
                            <>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                {d > 0 ? `+₦${fmt(d)}` : d < 0 ? `-₦${fmt(Math.abs(d))}` : '₦0.00'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                <Badge variant="outline" className="text-[10px] font-bold">
                                  {p > 0 ? `+${p.toFixed(1)}%` : `${p.toFixed(1)}%`}
                                </Badge>
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SINGLE-YEAR MONTHLY BREAKDOWN TAB (Enhanced)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'monthly-breakdown' && (
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 py-3 px-4 sm:px-5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 capitalize">
                  {monthlyData.activeYear} Monthly Breakdown by {dimension}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Month-by-month expense pattern for {monthlyData.activeYear}. Click any amount to drill down.
                </CardDescription>
              </div>
              <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                Total: ₦{fmt(monthlyData.grandTotal)}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-semibold capitalize sticky left-0 z-30 bg-slate-900 min-w-[200px]">
                        {dimension}
                      </th>
                      {MONTH_NAMES.map((m, idx) => {
                        if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(String(idx + 1))) {
                          return null;
                        }
                        return (
                          <th key={m} className="py-2.5 px-2 text-right font-semibold whitespace-nowrap min-w-[85px]">
                            {m}
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-4 text-right font-semibold bg-slate-950 min-w-[120px]">
                        Full Year
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthlyData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-12 text-center text-slate-400 italic">
                          No records found for {monthlyData.activeYear}.
                        </td>
                      </tr>
                    ) : (
                      monthlyData.rows.map((row, idx) => (
                        <tr 
                          key={row.name}
                          className={cn(
                            "hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-900/40"
                          )}
                        >
                          <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200 sticky left-0 z-10 bg-inherit border-r border-slate-100 dark:border-slate-800">
                            {row.name}
                          </td>

                          {MONTH_NAMES.map((_, mi) => {
                            if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(String(mi + 1))) {
                              return null;
                            }
                            const val = row.months[mi];
                            const mthEntries = row.entries.filter(e => {
                              const d = new Date(e.date);
                              return !isNaN(d.getTime()) && d.getMonth() === mi;
                            });

                            return (
                              <td key={mi} className="py-2.5 px-2 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                                {val > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDrilldown(
                                      `${row.name} (${MONTH_NAMES[mi]} ${monthlyData.activeYear})`,
                                      `${MONTH_NAMES[mi]} expenditure`,
                                      mthEntries
                                    )}
                                    className="text-slate-800 dark:text-slate-200 hover:text-blue-600 hover:underline"
                                  >
                                    {fmt(val)}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">—</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap bg-blue-50/30 dark:bg-blue-950/20">
                            <button
                              type="button"
                              onClick={() => handleOpenDrilldown(
                                `${row.name} (${monthlyData.activeYear})`,
                                `Full year ${monthlyData.activeYear} vouchers`,
                                row.entries
                              )}
                              className="hover:underline font-bold"
                            >
                              ₦{fmt(row.total)}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Total Row */}
                    {monthlyData.rows.length > 0 && (
                      <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold">
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                          TOTAL
                        </td>
                        {MONTH_NAMES.map((_, mi) => {
                          if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(String(mi + 1))) {
                            return null;
                          }
                          const colTotal = monthlyData.rows.reduce((sum, r) => sum + (r.months[mi] || 0), 0);
                          return (
                            <td key={mi} className="py-3 px-2 text-right font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {colTotal > 0 ? fmt(colTotal) : '—'}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap bg-blue-100/50 dark:bg-blue-900/40">
                          ₦{fmt(monthlyData.grandTotal)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TRANSACTION DRILLDOWN DIALOG
          ───────────────────────────────────────────────────────────── */}
      <TransactionDrilldownDialog
        open={drilldown.open}
        onClose={() => setDrilldown(prev => ({ ...prev, open: false }))}
        title={drilldown.title}
        subtitle={drilldown.subtitle}
        entries={drilldown.entries}
        debitLabel="Expense Amount"
        creditLabel=""
      />
    </div>
  );
}
