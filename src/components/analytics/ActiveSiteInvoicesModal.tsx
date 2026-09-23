import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Receipt,
  X,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowRight,
  Layers,
  Users,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { Invoice } from '@/src/store/appStore';
import {
  useActiveSiteInvoices,
  ActiveSiteInvoiceSummary,
  ActiveSiteInvoiceDetail,
} from '@/src/hooks/useActiveSiteInvoices';

interface ActiveSiteInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInvoice?: (invoice: Invoice) => void;
  onSelectSite?: (siteId: string) => void;
}

function fmtMoney(amount: number): string {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ActiveSiteInvoicesModal({
  isOpen,
  onClose,
  onSelectInvoice,
  onSelectSite,
}: ActiveSiteInvoicesModalProps) {
  const { activeSiteInvoices, totalActiveSites, concurrentSitesCount, lapsedSitesCount } =
    useActiveSiteInvoices();

  const [groupBy, setGroupBy] = useState<'site' | 'client'>('site');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'overrun' | 'dueSoon' | 'safe'>('all');

  // Client groupings
  const clientGroups = useMemo(() => {
    const clientMap = new Map<string, { displayName: string; sites: ActiveSiteInvoiceSummary[] }>();
    activeSiteInvoices.forEach((s) => {
      const raw = (s.clientName || 'Other Clients').trim() || 'Other Clients';
      const key = raw.toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, { displayName: raw, sites: [] });
      }
      clientMap.get(key)!.sites.push(s);
    });

    const groups = Array.from(clientMap.values()).map(({ displayName, sites }) => {
      const totalBilledDays = sites.reduce((sum, s) => sum + s.totalBilledDays, 0);
      const totalLoggedDays = Number(
        sites.reduce((sum, s) => sum + s.totalLoggedDays, 0).toFixed(1)
      );
      const totalUnloggedDays = Number(
        sites.reduce((sum, s) => sum + (s.totalUnloggedDays || 0), 0).toFixed(1)
      );
      const totalProjectedDays = Number(
        sites.reduce((sum, s) => sum + (s.totalProjectedDays || s.totalLoggedDays), 0).toFixed(1)
      );
      const activeMachinesCount = sites.reduce((sum, s) => sum + s.activeMachinesCount, 0);
      const isOverrun = totalBilledDays > 0 && totalProjectedDays > totalBilledDays;
      const overrunDays = isOverrun ? Number((totalProjectedDays - totalBilledDays).toFixed(1)) : 0;
      const remainingDays = isOverrun
        ? 0
        : Math.max(0, Number((totalBilledDays - totalProjectedDays).toFixed(1)));
      const minRunway = Math.min(...sites.map((s) => s.calendarRunwayDays));
      const calendarRunwayDays = isFinite(minRunway)
        ? minRunway
        : Math.ceil(remainingDays / Math.max(1, activeMachinesCount));
      const progressPct =
        totalBilledDays > 0
          ? Math.min(100, (totalProjectedDays / totalBilledDays) * 100)
          : 0;
      const hasAnyOverrun = sites.some((s) => s.isOverrun || s.calendarRunwayDays < 0);
      const invoicesCount = sites.reduce((sum, s) => sum + s.invoices.length, 0);

      let urgencyBadgeClass =
        'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      let urgencyLabel = `${calendarRunwayDays}d runway`;

      if (hasAnyOverrun || isOverrun || calendarRunwayDays < 0) {
        urgencyBadgeClass =
          'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        const calDays = Math.max(1, Math.abs(calendarRunwayDays));
        urgencyLabel = `+${calDays}d Overdue`;
      } else if (calendarRunwayDays <= 0 || remainingDays === 0) {
        urgencyBadgeClass =
          'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        urgencyLabel = 'Due Today';
      } else if (calendarRunwayDays === 1) {
        urgencyBadgeClass =
          'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        urgencyLabel = 'Due Tomorrow';
      } else if (calendarRunwayDays <= 3) {
        urgencyBadgeClass =
          'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        urgencyLabel = `Due in ${calendarRunwayDays}d`;
      }

      return {
        clientName: displayName,
        sites,
        totalSites: sites.length,
        totalBilledDays,
        totalLoggedDays,
        totalUnloggedDays,
        totalProjectedDays,
        remainingDays,
        overrunDays,
        isOverrun: hasAnyOverrun || isOverrun,
        activeMachinesCount,
        calendarRunwayDays,
        progressPct,
        invoicesCount,
        urgencyBadgeClass,
        urgencyLabel,
      };
    });

    return groups.sort((a, b) => {
      if (a.isOverrun && !b.isOverrun) return -1;
      if (!a.isOverrun && b.isOverrun) return 1;
      if (a.isOverrun && b.isOverrun) return b.overrunDays - a.overrunDays;
      return a.calendarRunwayDays - b.calendarRunwayDays;
    });
  }, [activeSiteInvoices]);

  // Counts for filter pills
  const counts = useMemo(() => {
    if (groupBy === 'site') {
      let overrun = 0;
      let dueSoon = 0;
      let safe = 0;

      activeSiteInvoices.forEach((s) => {
        if (s.isOverrun) {
          overrun += 1;
        } else if (s.calendarRunwayDays <= 3) {
          dueSoon += 1;
        } else {
          safe += 1;
        }
      });

      return {
        all: activeSiteInvoices.length,
        overrun,
        dueSoon,
        safe,
      };
    } else {
      let overrun = 0;
      let dueSoon = 0;
      let safe = 0;

      clientGroups.forEach((c) => {
        if (c.isOverrun) {
          overrun += 1;
        } else if (c.calendarRunwayDays <= 3) {
          dueSoon += 1;
        } else {
          safe += 1;
        }
      });

      return {
        all: clientGroups.length,
        overrun,
        dueSoon,
        safe,
      };
    }
  }, [groupBy, activeSiteInvoices, clientGroups]);

  // Filtered Site list
  const displayedSites = useMemo(() => {
    if (!isOpen || groupBy !== 'site') return [];

    return activeSiteInvoices.filter((item) => {
      // Urgency filter
      if (urgencyFilter === 'overrun') {
        if (!item.isOverrun) return false;
      } else if (urgencyFilter === 'dueSoon') {
        if (item.isOverrun || item.calendarRunwayDays > 3) return false;
      } else if (urgencyFilter === 'safe') {
        if (item.isOverrun || item.calendarRunwayDays <= 3) return false;
      }

      // Search filter
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase().trim();
        const matchesSite = item.siteName.toLowerCase().includes(q);
        const matchesClient = item.clientName.toLowerCase().includes(q);
        const matchesInvoice = item.invoices.some((inv) =>
          inv.invoiceNumber.toLowerCase().includes(q)
        );
        const matchesMachine = item.siteMachines.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.serialNumber && m.serialNumber.toLowerCase().includes(q))
        );

        if (!matchesSite && !matchesClient && !matchesInvoice && !matchesMachine) {
          return false;
        }
      }

      return true;
    });
  }, [isOpen, groupBy, activeSiteInvoices, urgencyFilter, deferredSearch]);

  // Filtered Client list
  const displayedClients = useMemo(() => {
    if (!isOpen || groupBy !== 'client') return [];

    return clientGroups.filter((group) => {
      // Urgency filter
      if (urgencyFilter === 'overrun') {
        if (!group.isOverrun) return false;
      } else if (urgencyFilter === 'dueSoon') {
        if (group.isOverrun || group.calendarRunwayDays > 3) return false;
      } else if (urgencyFilter === 'safe') {
        if (group.isOverrun || group.calendarRunwayDays <= 3) return false;
      }

      // Search filter
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase().trim();
        const matchesClient = group.clientName.toLowerCase().includes(q);
        const matchesSite = group.sites.some((s) => s.siteName.toLowerCase().includes(q));
        const matchesInvoice = group.sites.some((s) =>
          s.invoices.some((inv) => inv.invoiceNumber.toLowerCase().includes(q))
        );
        const matchesMachine = group.sites.some((s) =>
          s.siteMachines.some(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              (m.serialNumber && m.serialNumber.toLowerCase().includes(q))
          )
        );

        if (!matchesClient && !matchesSite && !matchesInvoice && !matchesMachine) {
          return false;
        }
      }

      return true;
    });
  }, [isOpen, groupBy, clientGroups, urgencyFilter, deferredSearch]);

  // Fleet wide totals
  const fleetTotals = useMemo(() => {
    const totalBilled = activeSiteInvoices.reduce((sum, s) => sum + s.totalBilledDays, 0);
    const totalLogged = Number(
      activeSiteInvoices.reduce((sum, s) => sum + s.totalLoggedDays, 0).toFixed(1)
    );
    const totalOverrunDays = Number(
      activeSiteInvoices.reduce((sum, s) => sum + s.overrunDays, 0).toFixed(1)
    );
    const totalMachines = activeSiteInvoices.reduce((sum, s) => sum + s.activeMachinesCount, 0);

    return {
      totalBilled,
      totalLogged,
      totalOverrunDays,
      totalMachines,
    };
  }, [activeSiteInvoices]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                Active Site Invoices & Overrun Tracker
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Cumulative Site Pool tracking &middot; {totalActiveSites} Active Site
                {totalActiveSites === 1 ? '' : 's'}
                {lapsedSitesCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1.5">
                    &middot; {lapsedSitesCount} requiring invoice extension
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          {/* Grouping Toggle: By Site vs By Client */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300/80 dark:border-slate-700 text-xs w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setGroupBy('site')}
              className={cn(
                'px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center cursor-pointer',
                groupBy === 'site'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              )}
            >
              <span>By Site</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                {activeSiteInvoices.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('client')}
              className={cn(
                'px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 flex-1 sm:flex-initial justify-center cursor-pointer',
                groupBy === 'client'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              )}
            >
              <span>By Client</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                {clientGroups.length}
              </span>
            </button>
          </div>

          {/* Filters: Search and Urgency Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  groupBy === 'site'
                    ? 'Search site, client, machine, invoice...'
                    : 'Search client, site, machine...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-48 sm:w-60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Urgency Filter Pills */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setUrgencyFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  urgencyFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <span>All</span>
                <span className="text-[10px] opacity-70">({counts.all})</span>
              </button>
              <button
                type="button"
                onClick={() => setUrgencyFilter('overrun')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  urgencyFilter === 'overrun'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                )}
              >
                <span>🚨 Overrun</span>
                <span
                  className={cn(
                    'text-[10px] px-1 rounded-full font-bold',
                    urgencyFilter === 'overrun'
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  )}
                >
                  {counts.overrun}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setUrgencyFilter('dueSoon')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  urgencyFilter === 'dueSoon'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                )}
              >
                <span>⚠️ Due Soon</span>
                <span
                  className={cn(
                    'text-[10px] px-1 rounded-full font-bold',
                    urgencyFilter === 'dueSoon'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  )}
                >
                  {counts.dueSoon}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setUrgencyFilter('safe')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                  urgencyFilter === 'safe'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <span>Safe</span>
                <span className="text-[10px] opacity-70">({counts.safe})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body: Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4">
          {/* Empty State */}
          {(groupBy === 'site' && displayedSites.length === 0) ||
          (groupBy === 'client' && displayedClients.length === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2.5 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
              <Receipt className="h-9 w-9 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No active site invoices found matching this filter.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Try adjusting your search keywords or switching between All, Overrun, Due Soon, and
                Safe urgency views.
              </p>
              {(searchQuery || urgencyFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setUrgencyFilter('all');
                  }}
                  className="text-xs h-8 mt-2 font-semibold text-blue-600 dark:text-blue-400"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : groupBy === 'site' ? (
            /* By Site View */
            displayedSites.map((siteItem) => (
              <div
                key={siteItem.siteId}
                className={cn(
                  'border rounded-xl p-4 sm:p-5 bg-white dark:bg-slate-900 shadow-xs transition-all space-y-4',
                  siteItem.isOverrun
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                )}
              >
                {/* Site Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'w-3 h-3 rounded-full shrink-0',
                        siteItem.isOverrun
                          ? 'bg-rose-500 ring-4 ring-rose-500/20'
                          : siteItem.hasActiveInvoices
                          ? 'bg-blue-500 ring-4 ring-blue-500/20'
                          : 'bg-slate-300 dark:bg-slate-700'
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {siteItem.siteName}
                        </h4>
                        {siteItem.clientName && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {siteItem.clientName}
                          </span>
                        )}
                        {siteItem.concurrentCount > 1 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {siteItem.invoiceRelationLabel || `${siteItem.concurrentCount} Invoices`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {siteItem.isOverrun
                            ? `Overrun since: ${formatDisplayDate(
                                siteItem.latestLiveEndDate || siteItem.latestScheduledEndDate
                              )}`
                            : `Live Contract Target: ${formatDisplayDate(
                                siteItem.latestLiveEndDate || siteItem.latestScheduledEndDate
                              )}`}
                        </span>
                        {siteItem.earliestStartDate && (
                          <>
                            <span>&middot;</span>
                            <span>Started: {formatDisplayDate(siteItem.earliestStartDate)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <span
                      className={cn(
                        'text-xs font-bold px-2.5 py-1 rounded-md border inline-flex items-center gap-1',
                        siteItem.urgencyBadgeClass
                      )}
                    >
                      {siteItem.urgencyLabel}
                    </span>
                    {onSelectSite && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onSelectSite(siteItem.siteId);
                        }}
                        className="h-8 text-xs px-2.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="View site analytics"
                      >
                        Site View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Contracted / Billed
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {siteItem.totalBilledDays.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {siteItem.invoices.length} invoice
                      {siteItem.invoices.length === 1 ? '' : 's'} pool
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Logged Runtime
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {siteItem.totalLoggedDays.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Fleet logged usage</p>
                  </div>

                  <div
                    className={cn(
                      'border rounded-lg p-2.5',
                      siteItem.isOverrun
                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                        : 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                    )}
                  >
                    <p
                      className={cn(
                        'text-[11px] font-medium',
                        siteItem.isOverrun
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      )}
                    >
                      {siteItem.isOverrun ? 'Unbilled Overrun' : 'Remaining Pool'}
                    </p>
                    <p
                      className={cn(
                        'text-sm sm:text-base font-black tabular-nums mt-0.5',
                        siteItem.isOverrun
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      )}
                    >
                      {siteItem.isOverrun
                        ? `+${siteItem.overrunDays.toFixed(1)}`
                        : siteItem.remainingDays.toFixed(1)}{' '}
                      <span className="text-xs font-normal opacity-80">days</span>
                    </p>
                    <p
                      className={cn(
                        'text-[10px] mt-0.5',
                        siteItem.isOverrun
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {siteItem.isOverrun ? 'Invoice extension due' : 'Within contracted quota'}
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Fleet Runway
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {siteItem.calendarRunwayDays}{' '}
                      <span className="text-xs font-normal text-slate-400">cal. days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {siteItem.activeMachinesCount} active machine
                      {siteItem.activeMachinesCount === 1 ? '' : 's'}/day
                    </p>
                  </div>
                </div>

                {/* Visual Quota Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <span>Contract Capacity Consumed</span>
                      {siteItem.isOverrun && (
                        <span className="text-rose-600 dark:text-rose-400 font-bold text-[10px] bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.2 rounded">
                          +{siteItem.overrunDays.toFixed(1)}d over capacity
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'font-bold tabular-nums',
                        siteItem.isOverrun
                          ? 'text-rose-600 dark:text-rose-400'
                          : siteItem.progressPct >= 85
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {siteItem.totalBilledDays > 0
                        ? `${Math.round((siteItem.totalLoggedDays / siteItem.totalBilledDays) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        siteItem.isOverrun
                          ? 'bg-rose-500'
                          : siteItem.progressPct >= 85
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      )}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            siteItem.totalLoggedDays > 0 ? 3 : 0,
                            siteItem.totalBilledDays > 0
                              ? (siteItem.totalLoggedDays / siteItem.totalBilledDays) * 100
                              : 0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Sub-sections: Invoices & Machine Fleet */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                  {/* Linked Invoices */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        Linked Invoices ({siteItem.invoices.length})
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {siteItem.invoices.map((inv) => (
                        <div
                          key={inv.invoiceNumber}
                          onClick={() => onSelectInvoice?.(inv.invoice)}
                          className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xs cursor-pointer transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                                {inv.invoiceNumber}
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border',
                                  inv.invoice.status?.toLowerCase() === 'paid'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                )}
                              >
                                {inv.invoice.status || 'Active'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {inv.startDate && inv.scheduledEndDate
                                ? `${formatDisplayDate(inv.startDate)} — ${formatDisplayDate(
                                    inv.scheduledEndDate
                                  )}`
                                : `${inv.duration} days`}
                              &middot; {inv.machineCount} mac &middot;{' '}
                              <strong className="text-slate-700 dark:text-slate-300">
                                {inv.totalContractedDays}d pool
                              </strong>
                            </p>
                          </div>

                          <div className="text-right shrink-0 pl-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums block">
                              ₦{fmtMoney(Number(inv.invoice.totalCharge || inv.invoice.amount || 0))}
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-0.5 mt-0.5">
                              View <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operating Machines on Site */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        Operating Fleet Roster ({siteItem.siteMachines.length})
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {siteItem.siteMachines.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2 text-center">
                          No machine logs recorded yet for this site.
                        </p>
                      ) : (
                        siteItem.siteMachines.map((m) => {
                          const displayConsumed = m.slotConsumedDays !== undefined ? m.slotConsumedDays : m.consumedDays;
                          return (
                            <div
                              key={m.id}
                              className="rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs overflow-hidden"
                            >
                              <div className="flex items-center justify-between p-1.5 sm:p-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      'w-2 h-2 rounded-full shrink-0',
                                      m.isStopped ? 'bg-amber-500' : 'bg-emerald-500'
                                    )}
                                  />
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">
                                      {m.name}
                                    </span>
                                    {m.serialNumber && (
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        SN: {m.serialNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="flex items-center gap-1 font-mono tabular-nums text-xs justify-end">
                                    <span className={cn(
                                      "font-bold",
                                      (m.isOver || (siteItem.isOverrun && !m.isStopped))
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-slate-900 dark:text-slate-100"
                                    )}>
                                      {displayConsumed.toFixed(1)}
                                    </span>
                                    {m.contractedDays > 0 ? (
                                      <>
                                        <span className="text-slate-400 text-[10px]">/</span>
                                        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                                          {m.contractedDays.toFixed(1)} days
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">d logged</span>
                                    )}
                                    {m.isOver && !m.isStopped && (
                                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 ml-1">
                                        +{m.overDays.toFixed(1)}d
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Sub-line for predecessor swaps (Option 1) */}
                              {m.predecessors && m.predecessors.length > 0 && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 px-2 pb-1.5 font-mono border-t border-slate-100 dark:border-slate-800 pt-1">
                                  <span className="text-slate-300 dark:text-slate-600">↳</span>
                                  <span>
                                    {m.consumedDays.toFixed(1)}d current (+ {m.predecessors.map(p => `${p.consumedDays.toFixed(1)}d ex-${p.name.replace(/^dewatering\s+/i, '')}`).join(', ')})
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* By Client View */
            displayedClients.map((clientGroup) => (
              <div
                key={clientGroup.clientName}
                className={cn(
                  'border rounded-xl p-4 sm:p-5 bg-white dark:bg-slate-900 shadow-xs transition-all space-y-4',
                  clientGroup.isOverrun
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                )}
              >
                {/* Client Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'w-3 h-3 rounded-full shrink-0',
                        clientGroup.isOverrun
                          ? 'bg-rose-500 ring-4 ring-rose-500/20'
                          : 'bg-blue-500 ring-4 ring-blue-500/20'
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {clientGroup.clientName}
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {clientGroup.totalSites} Dewatering Site
                          {clientGroup.totalSites === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {clientGroup.invoicesCount} Total Invoices &middot;{' '}
                        {clientGroup.activeMachinesCount} Operating Machine
                        {clientGroup.activeMachinesCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'text-xs font-bold px-2.5 py-1 rounded-md border inline-flex items-center gap-1 shrink-0 self-start sm:self-center',
                      clientGroup.urgencyBadgeClass
                    )}
                  >
                    {clientGroup.urgencyLabel}
                  </span>
                </div>

                {/* Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Total Billed
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {clientGroup.totalBilledDays.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Across all client sites</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Total Logged
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {clientGroup.totalLoggedDays.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Combined machine runtime</p>
                  </div>

                  <div
                    className={cn(
                      'border rounded-lg p-2.5',
                      clientGroup.isOverrun
                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                        : 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                    )}
                  >
                    <p
                      className={cn(
                        'text-[11px] font-medium',
                        clientGroup.isOverrun
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      )}
                    >
                      {clientGroup.isOverrun ? 'Overrun Days' : 'Remaining Pool'}
                    </p>
                    <p
                      className={cn(
                        'text-sm sm:text-base font-black tabular-nums mt-0.5',
                        clientGroup.isOverrun
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      )}
                    >
                      {clientGroup.isOverrun
                        ? `+${clientGroup.overrunDays.toFixed(1)}`
                        : clientGroup.remainingDays.toFixed(1)}{' '}
                      <span className="text-xs font-normal opacity-80">days</span>
                    </p>
                    <p
                      className={cn(
                        'text-[10px] mt-0.5',
                        clientGroup.isOverrun
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {clientGroup.isOverrun ? 'Unbilled excess' : 'Contracted capacity'}
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Client Runway
                    </p>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {clientGroup.calendarRunwayDays}{' '}
                      <span className="text-xs font-normal text-slate-400">cal. days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {clientGroup.activeMachinesCount} active machine
                      {clientGroup.activeMachinesCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {/* Individual Sites under this Client */}
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    Sites Breakdown ({clientGroup.sites.length})
                  </p>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/40 dark:bg-slate-900/40">
                    {clientGroup.sites.map((s) => (
                      <div key={s.siteId} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full shrink-0',
                                s.isOverrun ? 'bg-rose-500' : 'bg-blue-500'
                              )}
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {s.siteName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-md border',
                                s.urgencyBadgeClass
                              )}
                            >
                              {s.urgencyLabel}
                            </span>
                            {onSelectSite && (
                              <button
                                onClick={() => {
                                  onClose();
                                  onSelectSite(s.siteId);
                                }}
                                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                View <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {s.totalLoggedDays.toFixed(1)}d logged / {s.totalBilledDays.toFixed(1)}
                            d billed
                          </span>
                          <span
                            className={cn(
                              'font-bold tabular-nums',
                              s.isOverrun
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-700 dark:text-slate-300'
                            )}
                          >
                            {s.totalBilledDays > 0
                              ? `${Math.round((s.totalLoggedDays / s.totalBilledDays) * 100)}%`
                              : '0%'}
                          </span>
                        </div>

                        {/* Linked invoices pills */}
                        {s.invoices.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {s.invoices.map((inv) => (
                              <button
                                key={inv.invoiceNumber}
                                onClick={() => onSelectInvoice?.(inv.invoice)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:border-blue-400 transition-colors cursor-pointer"
                              >
                                <span>{inv.invoiceNumber}</span>
                                <span className="text-[10px] text-slate-400">
                                  ({inv.totalContractedDays}d)
                                </span>
                                <ArrowUpRight className="w-3 h-3 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span>
              Fleet Total:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {fleetTotals.totalLogged.toFixed(1)}d
              </strong>{' '}
              logged of{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {fleetTotals.totalBilled.toFixed(1)}d
              </strong>{' '}
              billed
            </span>
            {fleetTotals.totalOverrunDays > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                &middot; +{fleetTotals.totalOverrunDays.toFixed(1)}d fleet unbilled overrun
              </span>
            )}
            <span>
              &middot; {fleetTotals.totalMachines} active machine
              {fleetTotals.totalMachines === 1 ? '' : 's'} running
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold px-4 rounded-lg cursor-pointer shrink-0 self-end sm:self-center"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
