import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { 
  Clock, 
  Search, 
  Download, 
  Filter, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  Landmark, 
  Building2, 
  HardHat, 
  ArrowRightLeft,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAppStore, Invoice, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { usePriv } from '@/src/hooks/usePriv';
import { buildSettlementMap } from '@/src/lib/settlementUtils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import * as XLSX from 'xlsx';

export interface SiteOwedMetric {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  siteName: string;
  siteId: string;
  isSiteEnded: boolean;
  siteStatus: string;
  invoiceDate: string;
  startDate: string;
  endDate: string;
  billedDays: number;
  loggedDays: number;
  daysOwed: number;
  dailyRate: number;
  rentalCost: number;
  totalInvoiceAmount: number;
  creditValue: number;
  paidAmount: number;
  isFullyPaid: boolean;
  settlementStatus: string;
  assetsSummary: string;
  hasBaselineApplied?: boolean;
  baselineCompletedDays?: number;
}

export interface ClientOwedMetric {
  clientName: string;
  totalSites: number;
  totalInvoices: number;
  totalBilledDays: number;
  totalLoggedDays: number;
  totalDaysOwed: number;
  totalRentalCost: number;
  totalCreditValue: number;
  totalPrepaidCreditValue: number;
  sites: SiteOwedMetric[];
}

export function OwedServicesReport() {
  const invoices = useAppStore(state => state.invoices) || [];
  const sites = useAppStore(state => state.sites) || [];
  const payments = useAppStore(state => state.payments) || [];
  const clientProfiles = useAppStore(state => state.clientProfiles) || [];
  const { dailyMachineLogs, assets } = useOperations();
  const priv = usePriv('financialReports');
  const hideAmounts = priv.canViewAmounts === false;

  // View & Filter State
  const [viewMode, setViewMode] = useState<'site' | 'client'>('site');
  const [onlyOwed, setOnlyOwed] = useState<boolean>(true);
  const [paidOnly, setPaidOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  // Baseline Cutoff State: Assume all logs prior to and including this date are completed
  const [baselineCutoffDate, setBaselineCutoffDate] = useState<string>('2026-06-30');
  const [enableBaselineCutoff, setEnableBaselineCutoff] = useState<boolean>(true);

  const formatCurrency = (val: number) => {
    if (hideAmounts) return '***';
    return '₦' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDays = (val: number) => {
    const formatted = Number(val.toFixed(1));
    return formatted % 1 === 0 ? formatted.toString() : formatted.toFixed(1);
  };

  // Settlement Map for invoices
  const settlementMap = useMemo(() => {
    return buildSettlementMap(invoices, payments);
  }, [invoices, payments]);

  // Asset Map for fast label lookup
  const assetMap = useMemo(() => {
    const map = new Map<string, string>();
    assets?.forEach(a => {
      if (a.id) map.set(a.id, a.name || a.serialNumber || 'Machine');
    });
    return map;
  }, [assets]);

  // Site map
  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach(s => {
      if (s.id) map.set(s.id, s);
      if (s.name) map.set(s.name.trim().toLowerCase(), s);
    });
    return map;
  }, [sites]);

  // Core reconciliation calculation
  const siteMetrics: SiteOwedMetric[] = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return invoices.map(inv => {
      const clientName = (inv.client || 'Unknown Client').trim();
      const rawSiteName = (inv.siteName || (inv as any).site || 'General Site').trim();
      const normalizedSiteName = rawSiteName.toLowerCase();
      
      const realSite = siteMap.get(inv.siteId) || siteMap.get(normalizedSiteName);
      const siteId = inv.siteId || realSite?.id || '';
      const siteStatus = realSite?.status || 'Active';
      const isSiteEnded = siteStatus.toLowerCase() === 'ended' || siteStatus.toLowerCase() === 'demobilized' || siteStatus.toLowerCase() === 'completed';

      const billedDays = Number(inv.duration) || 0;
      const dailyRate = Number(inv.dailyRentalCost) || (billedDays > 0 && inv.rentalCost ? Math.round(Number(inv.rentalCost) / billedDays) : 0);
      const rentalCost = Number(inv.rentalCost) || (billedDays * dailyRate);
      const totalInvoiceAmount = Number(inv.totalCharge ?? inv.amount ?? 0);

      // Settlement lookup
      const settlement = settlementMap.get(inv.id);
      const paidAmount = settlement ? settlement.cashPaid + settlement.whtCredited : 0;
      const isFullyPaid = settlement ? settlement.isPaid : (totalInvoiceAmount > 0 && paidAmount >= totalInvoiceAmount);
      const settlementStatus = settlement?.status || (isFullyPaid ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Unpaid');

      // Linked asset labels
      const linkedAssetIds = inv.linkedAssetIds || [];
      const assetLabels = linkedAssetIds
        .map(id => assetMap.get(id))
        .filter(Boolean)
        .join(', ');
      const assetsSummary = assetLabels || (inv.noOfMachine ? `${inv.noOfMachine} Unit(s)` : 'Assigned Machinery');

      // Daily machine logs calculation
      const startDateStr = (inv as any).startDate || inv.date || '';
      const endDateStr = (inv as any).endDate || inv.dueDate || '';
      const relevantLogs = (dailyMachineLogs || []).filter(l => {
        const matchesSiteId = siteId && l.siteId === siteId;
        const logSite = (l.siteName || (l as any).site_name || '').trim().toLowerCase();
        const matchesSiteName = logSite && (logSite === normalizedSiteName || (logSite.length > 3 && normalizedSiteName.includes(logSite)) || (normalizedSiteName.length > 3 && logSite.includes(normalizedSiteName)));
        const matchesDate = startDateStr ? (l.date >= startDateStr && l.date <= todayStr) : (l.date <= todayStr);
        const matchesAsset = linkedAssetIds.length === 0 || linkedAssetIds.includes(l.assetId);
        return (matchesSiteId || matchesSiteName) && matchesDate && matchesAsset;
      });

      let loggedDays = 0;
      let hasBaselineApplied = false;
      let baselineCompletedDays = 0;

      if (enableBaselineCutoff && baselineCutoffDate) {
        // Case A: Invoice ended on or before cutoff date -> assume 100% completed
        if (endDateStr && endDateStr <= baselineCutoffDate) {
          loggedDays = billedDays;
          hasBaselineApplied = true;
          baselineCompletedDays = billedDays;
        } else if (startDateStr && startDateStr <= baselineCutoffDate) {
          // Case B: Invoice starts on/before cutoff date but ends after cutoff date
          const start = new Date(startDateStr);
          const cutoff = new Date(baselineCutoffDate);
          let daysBeforeCutoff = 0;
          if (!isNaN(start.getTime()) && !isNaN(cutoff.getTime())) {
            daysBeforeCutoff = Math.max(0, Math.floor((cutoff.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          }
          const autoCompletedDays = Math.min(billedDays, daysBeforeCutoff);
          hasBaselineApplied = true;
          baselineCompletedDays = autoCompletedDays;

          // Count logs recorded strictly AFTER baselineCutoffDate
          const postLogs = relevantLogs.filter(l => l.date > baselineCutoffDate);
          let countedPost = 0;
          if (postLogs.length > 0) {
            const logsByDate = new Map<string, typeof postLogs>();
            postLogs.forEach(l => {
              if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
              logsByDate.get(l.date)!.push(l);
            });
            logsByDate.forEach(dateLogs => {
              const contributions = dateLogs.map(l => {
                const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (status === 'full') return 1.0;
                if (status === 'half') return 0.5;
                return 0.0;
              });
              countedPost += Math.min(...contributions);
            });
          }
          loggedDays = Math.min(billedDays, autoCompletedDays + countedPost);
        } else {
          // Case C: Invoice started strictly after cutoff date -> count real machine logs
          if (relevantLogs.length > 0) {
            const logsByDate = new Map<string, typeof relevantLogs>();
            relevantLogs.forEach(l => {
              if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
              logsByDate.get(l.date)!.push(l);
            });
            let counted = 0;
            logsByDate.forEach(dateLogs => {
              const contributions = dateLogs.map(l => {
                const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (status === 'full') return 1.0;
                if (status === 'half') return 0.5;
                return 0.0;
              });
              counted += Math.min(...contributions);
            });
            loggedDays = Math.max(0, counted);
          }
        }
      } else {
        // Cutoff disabled -> purely log-based calculation
        if (relevantLogs.length > 0) {
          const logsByDate = new Map<string, typeof relevantLogs>();
          relevantLogs.forEach(l => {
            if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
            logsByDate.get(l.date)!.push(l);
          });
          let counted = 0;
          logsByDate.forEach(dateLogs => {
            const contributions = dateLogs.map(l => {
              const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
              if (status === 'full') return 1.0;
              if (status === 'half') return 0.5;
              return 0.0;
            });
            counted += Math.min(...contributions);
          });
          loggedDays = Math.max(0, counted);
        }
      }

      // If site has ended and there were no detailed machine logs logged, fallback to billedDays only if not demobilized early
      const daysOwed = Math.max(0, billedDays - loggedDays);

      // Financial credit value calculation
      // If dailyRate is known, creditValue = daysOwed * dailyRate.
      // Otherwise, proportional unearned portion of rentalCost.
      let creditValue = 0;
      if (billedDays > 0) {
        creditValue = (daysOwed / billedDays) * rentalCost;
      } else if (daysOwed > 0 && dailyRate > 0) {
        creditValue = daysOwed * dailyRate;
      }

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber || 'INV-DRAFT',
        clientName,
        siteName: rawSiteName,
        siteId,
        isSiteEnded,
        siteStatus,
        invoiceDate: inv.date || '',
        startDate: startDateStr,
        endDate: endDateStr,
        billedDays,
        loggedDays,
        daysOwed,
        dailyRate,
        rentalCost,
        totalInvoiceAmount,
        creditValue,
        paidAmount,
        isFullyPaid,
        settlementStatus,
        assetsSummary,
        hasBaselineApplied,
        baselineCompletedDays
      };
    });
  }, [invoices, siteMap, settlementMap, assetMap, dailyMachineLogs, baselineCutoffDate, enableBaselineCutoff]);

  // Filtered Site Metrics
  const filteredSiteMetrics = useMemo(() => {
    return siteMetrics.filter(m => {
      // Owed toggle: only show items where we owe days
      if (onlyOwed && m.daysOwed <= 0) return false;

      // Paid credit toggle: only show where invoice was fully settled (pure cash credit)
      if (paidOnly && !m.isFullyPaid) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesClient = m.clientName.toLowerCase().includes(q);
        const matchesSite = m.siteName.toLowerCase().includes(q);
        const matchesInvoice = m.invoiceNumber.toLowerCase().includes(q);
        if (!matchesClient && !matchesSite && !matchesInvoice) return false;
      }

      return true;
    });
  }, [siteMetrics, onlyOwed, paidOnly, searchTerm]);

  // Client Aggregated Metrics
  const clientMetrics: ClientOwedMetric[] = useMemo(() => {
    const map = new Map<string, ClientOwedMetric>();

    // Group from full siteMetrics to retain client integrity
    siteMetrics.forEach(m => {
      if (!map.has(m.clientName)) {
        map.set(m.clientName, {
          clientName: m.clientName,
          totalSites: 0,
          totalInvoices: 0,
          totalBilledDays: 0,
          totalLoggedDays: 0,
          totalDaysOwed: 0,
          totalRentalCost: 0,
          totalCreditValue: 0,
          totalPrepaidCreditValue: 0,
          sites: []
        });
      }

      const client = map.get(m.clientName)!;
      client.totalInvoices += 1;
      client.totalBilledDays += m.billedDays;
      client.totalLoggedDays += m.loggedDays;
      client.totalDaysOwed += m.daysOwed;
      client.totalRentalCost += m.rentalCost;
      client.totalCreditValue += m.creditValue;
      if (m.isFullyPaid) {
        client.totalPrepaidCreditValue += m.creditValue;
      }
      client.sites.push(m);
    });

    // Count distinct sites per client
    map.forEach(client => {
      const distinctSites = new Set(client.sites.map(s => s.siteName.toLowerCase()));
      client.totalSites = distinctSites.size;
    });

    const list = Array.from(map.values());

    // Apply filters
    return list.filter(c => {
      if (onlyOwed && c.totalDaysOwed <= 0) return false;
      if (paidOnly && c.totalPrepaidCreditValue <= 0) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesClient = c.clientName.toLowerCase().includes(q);
        const matchesAnySite = c.sites.some(s => s.siteName.toLowerCase().includes(q));
        if (!matchesClient && !matchesAnySite) return false;
      }
      return true;
    });
  }, [siteMetrics, onlyOwed, paidOnly, searchTerm]);

  // Global KPIs based on filtered set
  const kpiData = useMemo(() => {
    const totalDaysOwed = filteredSiteMetrics.reduce((sum, s) => sum + s.daysOwed, 0);
    const totalPrepaidCredit = filteredSiteMetrics.reduce((sum, s) => sum + (s.isFullyPaid ? s.creditValue : 0), 0);
    const totalPotentialCredit = filteredSiteMetrics.reduce((sum, s) => sum + s.creditValue, 0);
    const sitesWithOwed = filteredSiteMetrics.filter(s => s.daysOwed > 0).length;
    const clientsWithOwed = new Set(filteredSiteMetrics.filter(s => s.daysOwed > 0).map(s => s.clientName)).size;

    return {
      totalDaysOwed,
      totalPrepaidCredit,
      totalPotentialCredit,
      sitesWithOwed,
      clientsWithOwed
    };
  }, [filteredSiteMetrics]);

  // Toggle client accordion in client view
  const toggleClientExpand = (clientName: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredSiteMetrics.map(m => ({
      'Client Name': m.clientName,
      'Site Name': m.siteName,
      'Site Status': m.siteStatus,
      'Invoice #': m.invoiceNumber,
      'Invoice Date': m.invoiceDate ? formatDisplayDate(m.invoiceDate) : '',
      'Period Start': m.startDate ? formatDisplayDate(m.startDate) : '',
      'Period End': m.endDate ? formatDisplayDate(m.endDate) : '',
      'Billed Days': m.billedDays,
      'Logged Operating Days': m.loggedDays,
      'Days Owed': m.daysOwed,
      'Daily Rental Rate (NGN)': m.dailyRate,
      'Total Rental Billed (NGN)': m.rentalCost,
      'Credit Value (NGN)': Math.round(m.creditValue),
      'Payment Status': m.settlementStatus,
      'Is Fully Prepaid Credit': m.isFullyPaid ? 'YES' : 'NO',
      'Assigned Assets': m.assetsSummary
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Owed Services');
    XLSX.writeFile(wb, `Owed_Services_Reconciliation_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Metric Cards (Minimalist & Crisp) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Days Owed */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service Days Owed</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-800">
                {formatDays(kpiData.totalDaysOwed)} <span className="text-xs font-normal text-slate-500">Days</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Machine duration billed but not yet logged on site
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Prepaid Cash Credit Value */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Prepaid Credit Balance</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-emerald-600">
                {formatCurrency(kpiData.totalPrepaidCredit)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Fully paid invoices ready for rollover / future project credit
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Potential Credit Value */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Credit Value</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-800">
                {formatCurrency(kpiData.totalPotentialCredit)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Total monetary value across all billed owed days
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Affected Sites & Clients */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Impacted Entities</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-800">
                {kpiData.sitesWithOwed} <span className="text-xs font-normal text-slate-500">Sites</span>
                <span className="text-slate-300 mx-2">|</span>
                {kpiData.clientsWithOwed} <span className="text-xs font-normal text-slate-500">Clients</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Projects with outstanding service allocations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Minimalist Filter & Controls Strip ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-md bg-slate-100 p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode('site')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'site'
                  ? 'bg-white text-slate-800 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              View by Site
            </button>
            <button
              onClick={() => setViewMode('client')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'client'
                  ? 'bg-white text-slate-800 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              View by Client
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Toggle: Only Owed */}
          <button
            onClick={() => setOnlyOwed(!onlyOwed)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              onlyOwed
                ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Only Owed Services</span>
            {onlyOwed && <CheckCircle2 className="w-3 h-3 text-amber-600" />}
          </button>

          {/* Toggle: Prepaid Credit Only */}
          <button
            onClick={() => setPaidOnly(!paidOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              paidOnly
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Prepaid Credit Only</span>
            {paidOnly && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Baseline Cutoff Control */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-slate-200 bg-slate-50/70">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-500 font-medium">Log Baseline:</span>
            <input
              type="date"
              value={baselineCutoffDate}
              onChange={e => setBaselineCutoffDate(e.target.value)}
              className="text-xs font-mono font-semibold text-slate-800 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
              title="Assumes machine logs on or before this cutoff date are 100% completed"
            />
            <button
              type="button"
              onClick={() => setEnableBaselineCutoff(!enableBaselineCutoff)}
              className={`ml-1 text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                enableBaselineCutoff 
                  ? 'bg-blue-600 text-white font-semibold' 
                  : 'bg-slate-200 text-slate-500'
              }`}
              title={enableBaselineCutoff ? "Baseline cutoff active (pre-July assumed completed)" : "Click to enable baseline cutoff"}
            >
              {enableBaselineCutoff ? 'Active' : 'Off'}
            </button>
          </div>
        </div>

        {/* Right Search & Action */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search client, site, or invoice..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs border-slate-200 focus-visible:ring-blue-500"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="h-8 text-xs gap-1.5 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            title="Export reconciliation sheet to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* ── Table View: By Site ── */}
      {viewMode === 'site' && (
        <Card className="border-slate-200 shadow-xs overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-[180px] font-semibold text-slate-600 text-xs py-2.5">Client & Site</TableHead>
                  <TableHead className="w-[130px] font-semibold text-slate-600 text-xs py-2.5">Invoice / Period</TableHead>
                  <TableHead className="w-[140px] font-semibold text-slate-600 text-xs py-2.5">Machinery / Assets</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Billed Days</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Logged Days</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Days Owed</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Daily Rate</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Credit Value (₦)</TableHead>
                  <TableHead className="w-[130px] text-center font-semibold text-slate-600 text-xs py-2.5">Credit Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs">
                {filteredSiteMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">No owed service records found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting the filter toggles or search keyword</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSiteMetrics.map(m => {
                    const usagePercent = m.billedDays > 0 ? Math.min(100, Math.round((m.loggedDays / m.billedDays) * 100)) : 100;
                    return (
                      <TableRow key={m.invoiceId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Client & Site */}
                        <TableCell className="py-3">
                          <div className="font-semibold text-slate-900 leading-snug">{m.clientName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-slate-500 font-medium">{m.siteName}</span>
                            {m.isSiteEnded ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                Demobilized
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active Site
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Invoice & Period */}
                        <TableCell className="py-3">
                          <div className="font-mono font-medium text-slate-800">{m.invoiceNumber}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {m.startDate ? formatDisplayDate(m.startDate) : (m.invoiceDate ? formatDisplayDate(m.invoiceDate) : 'N/A')}
                          </div>
                        </TableCell>

                        {/* Machinery */}
                        <TableCell className="py-3 text-slate-600">
                          <span className="truncate block max-w-[150px]" title={m.assetsSummary}>
                            {m.assetsSummary}
                          </span>
                        </TableCell>

                        {/* Billed Days */}
                        <TableCell className="py-3 text-right font-mono font-medium text-slate-700">
                          {formatDays(m.billedDays)}d
                        </TableCell>

                        {/* Logged Days */}
                        <TableCell className="py-3 text-right font-mono">
                          <div className="font-semibold text-slate-800 flex items-center justify-end gap-1">
                            <span>{formatDays(m.loggedDays)}d</span>
                            {m.hasBaselineApplied && (
                              <span 
                                className="text-[10px] px-1 py-0.2 rounded bg-blue-50 text-blue-700 font-normal border border-blue-200"
                                title="Pre-July baseline applied: logged days automatically completed up to June 30"
                              >
                                Baseline
                              </span>
                            )}
                          </div>
                          <div className="w-16 ml-auto mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${usagePercent >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </TableCell>

                        {/* Days Owed */}
                        <TableCell className="py-3 text-right font-mono">
                          {m.daysOwed > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              +{formatDays(m.daysOwed)}d
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">0d (Completed)</span>
                          )}
                        </TableCell>

                        {/* Daily Rate */}
                        <TableCell className="py-3 text-right font-mono text-slate-600">
                          {m.dailyRate > 0 ? formatCurrency(m.dailyRate) : '—'}
                        </TableCell>

                        {/* Credit Value (₦) */}
                        <TableCell className="py-3 text-right font-mono font-bold">
                          {m.creditValue > 0 ? (
                            <span className={m.isFullyPaid ? 'text-emerald-600' : 'text-slate-800'}>
                              {formatCurrency(m.creditValue)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">₦0.00</span>
                          )}
                        </TableCell>

                        {/* Credit Status Badge */}
                        <TableCell className="py-3 text-center">
                          {m.isFullyPaid ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Prepaid Credit</span>
                            </div>
                          ) : m.paidAmount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Partially Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                              Unpaid Invoice
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Table View: By Client (Grouped & Expandable) ── */}
      {viewMode === 'client' && (
        <Card className="border-slate-200 shadow-xs overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-8 py-2.5"></TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs py-2.5">Client Name</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600 text-xs py-2.5">Sites Involved</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Total Billed Days</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Total Logged Days</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Total Days Owed</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Total Rental Value</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 text-xs py-2.5">Prepaid Credit Balance (₦)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs">
                {clientMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">No client service balances found</p>
                      <p className="text-xs text-slate-400 mt-1">Try toggling filters or search parameters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  clientMetrics.map(c => {
                    const isExpanded = !!expandedClients[c.clientName];
                    return (
                      <React.Fragment key={c.clientName}>
                        <TableRow 
                          onClick={() => toggleClientExpand(c.clientName)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <TableCell className="py-3 text-center pl-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400 inline" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                            )}
                          </TableCell>

                          <TableCell className="py-3 font-bold text-slate-900">
                            {c.clientName}
                          </TableCell>

                          <TableCell className="py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                              {c.totalSites} {c.totalSites === 1 ? 'Site' : 'Sites'} ({c.totalInvoices} inv)
                            </span>
                          </TableCell>

                          <TableCell className="py-3 text-right font-mono text-slate-700">
                            {formatDays(c.totalBilledDays)}d
                          </TableCell>

                          <TableCell className="py-3 text-right font-mono text-slate-700">
                            {formatDays(c.totalLoggedDays)}d
                          </TableCell>

                          <TableCell className="py-3 text-right font-mono">
                            {c.totalDaysOwed > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                +{formatDays(c.totalDaysOwed)}d
                              </span>
                            ) : (
                              <span className="text-slate-400">0d</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 text-right font-mono text-slate-600">
                            {formatCurrency(c.totalRentalCost)}
                          </TableCell>

                          <TableCell className="py-3 text-right font-mono font-bold">
                            {c.totalPrepaidCreditValue > 0 ? (
                              <span className="text-emerald-600 font-bold">
                                {formatCurrency(c.totalPrepaidCreditValue)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">₦0.00</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Drilldown for this client */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/50">
                            <TableCell colSpan={8} className="p-0 border-t-0">
                              <div className="py-3 px-6 bg-slate-50/80 border-y border-slate-200/60">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                  Site & Invoice Breakdown for {c.clientName}
                                </div>
                                <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
                                  <Table>
                                    <TableHeader className="bg-slate-100/60 text-[11px]">
                                      <TableRow>
                                        <TableHead className="py-2 text-slate-600">Site Name</TableHead>
                                        <TableHead className="py-2 text-slate-600">Invoice #</TableHead>
                                        <TableHead className="py-2 text-slate-600">Site Status</TableHead>
                                        <TableHead className="py-2 text-right text-slate-600">Billed Days</TableHead>
                                        <TableHead className="py-2 text-right text-slate-600">Logged Days</TableHead>
                                        <TableHead className="py-2 text-right text-slate-600">Days Owed</TableHead>
                                        <TableHead className="py-2 text-right text-slate-600">Daily Rate</TableHead>
                                        <TableHead className="py-2 text-right text-slate-600">Credit Value (₦)</TableHead>
                                        <TableHead className="py-2 text-center text-slate-600">Payment Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs divide-y divide-slate-100">
                                      {c.sites.map(siteItem => (
                                        <TableRow key={siteItem.invoiceId}>
                                          <TableCell className="py-2 font-medium text-slate-800">
                                            {siteItem.siteName}
                                          </TableCell>
                                          <TableCell className="py-2 font-mono text-slate-600">
                                            {siteItem.invoiceNumber}
                                          </TableCell>
                                          <TableCell className="py-2">
                                            {siteItem.isSiteEnded ? (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                                                Demobilized
                                              </span>
                                            ) : (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                                                Active
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell className="py-2 text-right font-mono">
                                            {formatDays(siteItem.billedDays)}d
                                          </TableCell>
                                          <TableCell className="py-2 text-right font-mono">
                                            {formatDays(siteItem.loggedDays)}d
                                          </TableCell>
                                          <TableCell className="py-2 text-right font-mono">
                                            {siteItem.daysOwed > 0 ? (
                                              <span className="text-amber-700 font-bold">+{formatDays(siteItem.daysOwed)}d</span>
                                            ) : (
                                              <span className="text-slate-400">0d</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="py-2 text-right font-mono text-slate-600">
                                            {siteItem.dailyRate > 0 ? formatCurrency(siteItem.dailyRate) : '—'}
                                          </TableCell>
                                          <TableCell className="py-2 text-right font-mono font-semibold">
                                            {siteItem.creditValue > 0 ? (
                                              <span className={siteItem.isFullyPaid ? 'text-emerald-600' : 'text-slate-800'}>
                                                {formatCurrency(siteItem.creditValue)}
                                              </span>
                                            ) : (
                                              '₦0.00'
                                            )}
                                          </TableCell>
                                          <TableCell className="py-2 text-center">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                              siteItem.isFullyPaid 
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {siteItem.settlementStatus}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Contextual Rollover Note Banner ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-slate-800">Prepaid Service Credit Policy:</span> When machinery is demobilized from a site before the billed duration elapses and the client has fully settled the invoice, the remaining days constitute a verified credit balance. This balance can be preserved and applied towards upcoming projects or future service invoices for that client.
        </div>
      </div>
    </div>
  );
}
