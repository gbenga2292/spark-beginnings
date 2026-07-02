import React, { useMemo, useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '../store/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { isInternalSite } from '../lib/siteUtils';
import {
  Activity, Wrench, Package, Building2, MapPin, AlertCircle,
  AlertTriangle, TrendingDown, TrendingUp, ChevronDown, ChevronUp,
  CalendarDays, Fuel, Clock, FileText, X, Filter,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusBadge = (status: string) => {
  switch (status) {
    case 'overdue':    return <Badge className="bg-rose-100 text-rose-700 border-rose-200 border">Overdue</Badge>;
    case 'due_soon':   return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">Due Soon</Badge>;
    case 'in_service': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">In Service</Badge>;
    default:           return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">OK</Badge>;
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MachineReconciliation() {
  const { maintenanceAssets, waybills, assets, dailyMachineLogs, sitePumpDates, dieselRefills } = useOperations();
  const { pendingSites, sites, invoices } = useAppStore();

  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

  // ── Date filter ─────────────────────────────────────────────────────────────
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo]     = useState<string>('');
  const hasDateFilter = !!(filterFrom && filterTo);
  const clearFilter = () => { setFilterFrom(''); setFilterTo(''); };

  const toggleExpand = (id: string) => {
    setExpandedMachines(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Invoice lookup: latest per site (filtered by date if active) ───────────
  const latestInvoiceForSite = useMemo(() => {
    const map = new Map<string, { noOfMachine: number; invoiceNumber: string; invoiceStart: string; invoiceEnd: string }>();
    const sorted = [...invoices].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    sorted.forEach(inv => {
      const key = (inv.siteName || '').toLowerCase().trim();
      if (!key) return;
      if (hasDateFilter) {
        const invStart = inv.date || '';
        const invEnd   = inv.dueDate || inv.date || '';
        if (!rangesOverlap(invStart, invEnd, filterFrom, filterTo)) return;
      }
      if (!map.has(key)) {
        map.set(key, {
          noOfMachine:   inv.noOfMachine || 0,
          invoiceNumber: inv.invoiceNumber,
          invoiceStart:  inv.date || '',
          invoiceEnd:    inv.dueDate || inv.date || '',
        });
      }
    });
    return map;
  }, [invoices, hasDateFilter, filterFrom, filterTo]);

  // ── Stat card numbers ──────────────────────────────────────────────────────
  const totalMachines    = maintenanceAssets.length;
  const activeOnSite     = maintenanceAssets.filter(m => !isInternalSite({ name: m.site }) && m.site !== 'Warehouse' && m.isActive).length;
  const idle             = maintenanceAssets.filter(m => (isInternalSite({ name: m.site }) || m.site === 'Warehouse') && m.isActive).length;
  const underMaintenance = maintenanceAssets.filter(m => !m.isActive || m.status === 'overdue').length;

  // ── Active sites map ────────────────────────────────────────────────────────
  const activeSitesMap = useMemo(() => {
    const map = new Map<string, {
      siteName: string; machinesOnSite: number; status: string; expectedMachines: number;
      invoiceNumber?: string; invoiceStart?: string; invoiceEnd?: string;
      activeMachinesInPeriod?: number;
    }>();
    sites.forEach(s => {
      if (s.status === 'Active' && !isInternalSite(s)) {
        const onboarding = pendingSites.find(p => 
          p.siteId === s.id ||
          p.id === s.id || 
          (p.siteName?.trim().toLowerCase() === s.name.trim().toLowerCase() && 
           p.clientName?.trim().toLowerCase() === s.client.trim().toLowerCase())
        );
        if (onboarding && onboarding.phase1?.whatIsBeingBuilt && onboarding.phase1.whatIsBeingBuilt.trim().toLowerCase() !== 'dewatering') {
          return;
        }
        // Prefer latest matching invoice; fall back to onboarding data
        const invData = latestInvoiceForSite.get(s.name.toLowerCase().trim());
        const expectedMachines = invData
          ? invData.noOfMachine
          : (onboarding ? parseInt(onboarding.phase3?.totalPumpsRequired || '0', 10) || 0 : 0);

        const siteWaybills = waybills.filter(w =>
          (w.siteName?.toLowerCase() === s.name.toLowerCase() || w.siteId === s.id) &&
          (w.status !== 'outstanding' || w.type === 'return')
        );
        const inventoryMap = new Map<string, number>();
        siteWaybills
          .filter(w => w.type === 'waybill' && w.status !== 'outstanding')
          .forEach(wb => wb.items.forEach(item =>
            inventoryMap.set(item.assetId, (inventoryMap.get(item.assetId) || 0) + item.quantity)
          ));
        siteWaybills
          .filter(w => w.type === 'return')
          .forEach(wb => wb.items.forEach(item => {
            if (wb.status === 'return_completed') {
              inventoryMap.set(item.assetId, Math.max(0, (inventoryMap.get(item.assetId) || 0) - item.quantity));
            }
          }));
        let machinesOnSite = 0;
        inventoryMap.forEach((qty, assetId) => {
          if (qty > 0) {
            const a = assets.find(a => a.id === assetId);
            if (a && a.type === 'equipment' && a.requiresLogging) machinesOnSite += 1;
          }
        });

        // Count unique machines with active logs in the date filter period
        let activeMachinesInPeriod: number | undefined;
        if (hasDateFilter) {
          const activeAssetIds = new Set<string>();
          dailyMachineLogs.forEach(log => {
            if (
              log.siteName?.toLowerCase() === s.name.toLowerCase() &&
              log.isActive &&
              log.date >= filterFrom &&
              log.date <= filterTo
            ) activeAssetIds.add(log.assetId);
          });
          activeMachinesInPeriod = activeAssetIds.size;
        }

        map.set(s.name, {
          siteName: s.name, machinesOnSite, status: s.status, expectedMachines,
          invoiceNumber: invData?.invoiceNumber,
          invoiceStart: invData?.invoiceStart,
          invoiceEnd: invData?.invoiceEnd,
          activeMachinesInPeriod,
        });
      }
    });
    return Array.from(map.values());
  }, [sites, pendingSites, waybills, assets, latestInvoiceForSite, hasDateFilter, filterFrom, filterTo, dailyMachineLogs]);

  // ── Pending sites ───────────────────────────────────────────────────────────
  const pendingSitesList = useMemo(() =>
    pendingSites
      .filter(s => s.status === 'Pending' && s.phase1?.whatIsBeingBuilt?.trim().toLowerCase() === 'dewatering')
      .map(s => ({
        id: s.id,
        siteName: s.siteName || 'Unknown Site',
        client: s.clientName || 'Unknown Client',
        pumpsRequired: parseInt(s.phase3?.totalPumpsRequired || '0', 10) || 0,
      })),
  [pendingSites]);

  const totalRequiredPumps = pendingSitesList.reduce((acc, c) => acc + c.pumpsRequired, 0);

  // ── Site discrepancies ──────────────────────────────────────────────────────
  const discrepancies = useMemo(() =>
    activeSitesMap
      .filter(s => s.expectedMachines > 0 && s.machinesOnSite !== s.expectedMachines)
      .map(s => ({ ...s, delta: s.machinesOnSite - s.expectedMachines })),
  [activeSitesMap]);

  // ── Per-machine data: active days broken down by site ──────────────────────
  const perMachineData = useMemo(() => {
    return maintenanceAssets.map(machine => {
      const machineLogs = dailyMachineLogs.filter(l => {
        if (l.assetId !== machine.id) return false;
        if (hasDateFilter && (l.date < filterFrom || l.date > filterTo)) return false;
        return true;
      });

      const siteMap = new Map<string, {
        siteId: string; siteName: string;
        activeDays: number; totalLoggedDays: number;
        firstLog: string; lastLog: string;
      }>();

      machineLogs.forEach(log => {
        const existing = siteMap.get(log.siteId) ?? {
          siteId: log.siteId, siteName: log.siteName,
          activeDays: 0, totalLoggedDays: 0,
          firstLog: log.date, lastLog: log.date,
        };
        existing.totalLoggedDays += 1;
        if (log.isActive) {
          existing.activeDays += log.operationalDay === 'half' ? 0.5 : log.operationalDay === 'none' ? 0 : 1;
        }
        if (log.date < existing.firstLog) existing.firstLog = log.date;
        if (log.date > existing.lastLog)  existing.lastLog  = log.date;
        siteMap.set(log.siteId, existing);
      });

      const pumpDateMap = Object.fromEntries(
        sitePumpDates.filter(pd => pd.assetId === machine.id).map(pd => [pd.siteId, pd])
      );

      const siteHistory = Array.from(siteMap.values())
        .map(s => ({
          ...s,
          pumpStartDate: pumpDateMap[s.siteId]?.pumpStartDate ?? s.firstLog,
          pumpStopDate:  pumpDateMap[s.siteId]?.pumpStopDate  ?? null,
          isCurrent:     machine.site === s.siteName,
        }))
        .sort((a, b) => b.lastLog.localeCompare(a.lastLog));

      const totalActiveDays = siteHistory.reduce((sum, s) => sum + s.activeDays, 0);

      return { machine, siteHistory, totalActiveDays };
    }).filter(d => !hasDateFilter || d.siteHistory.length > 0);
  }, [maintenanceAssets, dailyMachineLogs, sitePumpDates, hasDateFilter, filterFrom, filterTo]);

  // ── Overdue / due-soon list ─────────────────────────────────────────────────
  const overdueList = useMemo(() =>
    maintenanceAssets
      .filter(m => m.status === 'overdue' || m.status === 'due_soon')
      .sort((a, b) => (a.status === 'overdue' ? -1 : 1)),
  [maintenanceAssets]);

  // ── Diesel summary per site ─────────────────────────────────────────────────
  const dieselSummary = useMemo(() => {
    const siteMap = new Map<string, { siteName: string; refilled: number; logged: number }>();
    dieselRefills.forEach(r => {
      if (hasDateFilter && r.date && (r.date < filterFrom || r.date > filterTo)) return;
      const e = siteMap.get(r.siteId) ?? { siteName: r.siteName, refilled: 0, logged: 0 };
      e.refilled += r.totalLitres;
      siteMap.set(r.siteId, e);
    });
    dailyMachineLogs.forEach(l => {
      if (!l.siteId) return;
      if (hasDateFilter && (l.date < filterFrom || l.date > filterTo)) return;
      const e = siteMap.get(l.siteId) ?? { siteName: l.siteName, refilled: 0, logged: 0 };
      e.logged += l.dieselUsage || 0;
      siteMap.set(l.siteId, e);
    });
    return Array.from(siteMap.values()).filter(s => s.refilled > 0 || s.logged > 0);
  }, [dieselRefills, dailyMachineLogs, hasDateFilter, filterFrom, filterTo]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header + Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Machine Reconciliation</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Overview of machine allocations, active days, requirements, and service statuses.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Filter className="h-3 w-3" /> From
            </label>
            <Input
              type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="h-8 text-sm w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">To</label>
            <Input
              type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="h-8 text-sm w-36"
            />
          </div>
          {hasDateFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilter} className="h-8 gap-1 text-slate-500">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Active filter banner */}
      {hasDateFilter && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300">
          <CalendarDays className="h-4 w-4 flex-shrink-0" />
          Showing data for <strong className="mx-1">{fmt(filterFrom)}</strong> → <strong className="mx-1">{fmt(filterTo)}</strong>.
          &nbsp;Expected machines sourced from latest invoice overlapping this period.
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMachines}</div>
            <p className="text-xs text-slate-500">Dewatering / logged assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (On Site)</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activeOnSite}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Idle (Warehouse)</CardTitle>
            <MapPin className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{idle}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance / Inactive</CardTitle>
            <Wrench className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{underMaintenance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Sites</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pendingSitesList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Machines Required</CardTitle>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalRequiredPumps}</div>
            <p className="text-xs text-slate-500">For pending sites</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Discrepancy Alerts ─────────────────────────────────────────────── */}
      {discrepancies.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Site Discrepancies ({discrepancies.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {discrepancies.map(d => (
              <div
                key={d.siteName}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  d.delta < 0
                    ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                    : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                }`}
              >
                {d.delta < 0
                  ? <TrendingDown className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  : <TrendingUp   className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-sm font-semibold ${d.delta < 0 ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {d.siteName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {d.machinesOnSite} on site · {d.expectedMachines} expected ·{' '}
                    <span className={`font-bold ${d.delta < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {d.delta > 0 ? '+' : ''}{d.delta}
                    </span>
                  </p>
                  {d.invoiceNumber && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Inv {d.invoiceNumber}
                      {d.invoiceStart && <> · {fmt(d.invoiceStart)} – {fmt(d.invoiceEnd || '')}</>}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Sites & Pending Side-by-Side ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Sites & Machines Onsite</CardTitle>
            {hasDateFilter && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                "In Period" = machines with active logs between {fmt(filterFrom)} – {fmt(filterTo)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {activeSitesMap.length > 0 ? (
              <div className="rounded-md border dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        Expected
                        {hasDateFilter && <span className="block text-[10px] font-normal text-indigo-500">(Invoice)</span>}
                      </TableHead>
                      <TableHead className="text-right">On Site</TableHead>
                      {hasDateFilter && (
                        <TableHead className="text-right">
                          In Period
                          <span className="block text-[10px] font-normal text-indigo-500">(Active)</span>
                        </TableHead>
                      )}
                      {hasDateFilter && (
                        <TableHead className="text-left text-[11px] text-slate-400">Invoice</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSitesMap.map((site, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{site.siteName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                            {site.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-600 font-medium">{site.expectedMachines}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={site.machinesOnSite > 0 ? 'default' : 'secondary'}>
                            {site.machinesOnSite}
                          </Badge>
                        </TableCell>
                        {hasDateFilter && (
                          <TableCell className="text-right">
                            {site.activeMachinesInPeriod !== undefined ? (
                              <Badge
                                variant="outline"
                                className={
                                  site.activeMachinesInPeriod === site.expectedMachines
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                    : site.activeMachinesInPeriod < site.expectedMachines
                                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                                    : 'text-amber-700 bg-amber-50 border-amber-200'
                                }
                              >
                                {site.activeMachinesInPeriod}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        )}
                        {hasDateFilter && (
                          <TableCell className="text-left">
                            {site.invoiceNumber ? (
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <FileText className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                                <span className="font-medium text-indigo-600">{site.invoiceNumber}</span>
                                <span className="text-slate-400 hidden sm:inline">
                                  {fmt(site.invoiceStart || '')}–{fmt(site.invoiceEnd || '')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">No invoice</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">No active sites found.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pending Sites & Required Machines</CardTitle></CardHeader>
          <CardContent>
            {pendingSitesList.length > 0 ? (
              <div className="rounded-md border dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Pumps Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSitesList.map(site => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">{site.siteName}</TableCell>
                        <TableCell>{site.client}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-bold border-purple-200 text-purple-700 bg-purple-50">
                            {site.pumpsRequired}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">No pending sites.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Per-Machine Active Days by Site ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                Machine Active Days by Site
                {hasDateFilter && (
                  <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 ml-2 text-xs">
                    {fmt(filterFrom)} – {fmt(filterTo)}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {hasDateFilter
                  ? 'Showing machines with logs in the selected date range only.'
                  : 'Click a row to expand per-site active day history. Machines that visited multiple sites are separated.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm" className="text-xs"
                onClick={() => setExpandedMachines(new Set(maintenanceAssets.map(m => m.id)))}
              >
                Expand All
              </Button>
              <Button
                variant="ghost" size="sm" className="text-xs"
                onClick={() => setExpandedMachines(new Set())}
              >
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {perMachineData.length > 0 ? (
            <div className="rounded-md border dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="w-8" />
                    <TableHead>Machine</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Current Site</TableHead>
                    <TableHead>Service Status</TableHead>
                    <TableHead className="text-right">{hasDateFilter ? 'Active Days (Period)' : 'Total Active Days'}</TableHead>
                    <TableHead className="text-right">Sites Visited</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perMachineData.map(({ machine, siteHistory, totalActiveDays }) => {
                    const isExpanded = expandedMachines.has(machine.id);
                    const hasSiteHistory = siteHistory.length > 0;

                    return (
                      <React.Fragment key={machine.id}>
                        {/* Main machine row */}
                        <TableRow
                          className={`cursor-pointer transition-colors ${
                            isExpanded
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                          }`}
                          onClick={() => hasSiteHistory && toggleExpand(machine.id)}
                        >
                          <TableCell className="text-center">
                            {hasSiteHistory ? (
                              isExpanded
                                ? <ChevronUp   className="h-4 w-4 text-indigo-500 mx-auto" />
                                : <ChevronDown className="h-4 w-4 text-slate-400 mx-auto" />
                            ) : (
                              <span className="text-slate-300 text-xs mx-auto block text-center">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{machine.name}</TableCell>
                          <TableCell className="text-slate-500 text-sm font-mono">
                            {machine.serialNumber || '—'}
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${
                              machine.site === 'Warehouse' ? 'text-amber-600' : 'text-emerald-700'
                            }`}>
                              {machine.site}
                            </span>
                          </TableCell>
                          <TableCell>{statusBadge(machine.status)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-800 dark:text-slate-100">
                            {totalActiveDays > 0 ? totalActiveDays.toFixed(1) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-slate-500 text-sm">
                            {siteHistory.length}
                          </TableCell>
                        </TableRow>

                        {/* Expanded: per-site breakdown */}
                        {isExpanded && siteHistory.length > 0 && (
                          <TableRow className="bg-indigo-50/40 dark:bg-indigo-950/10">
                            <TableCell colSpan={7} className="p-0">
                              <div className="mx-6 my-3 rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-indigo-100/70 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                                      <th className="text-left px-4 py-2 font-medium">Site</th>
                                      <th className="text-left px-4 py-2 font-medium">Period</th>
                                      <th className="text-right px-4 py-2 font-medium">Days Logged</th>
                                      <th className="text-right px-4 py-2 font-medium">Active Days</th>
                                      <th className="text-right px-4 py-2 font-medium">Utilisation</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {siteHistory.map((sh, idx) => {
                                      const utilPct = sh.totalLoggedDays > 0
                                        ? Math.round((sh.activeDays / sh.totalLoggedDays) * 100)
                                        : 0;

                                      return (
                                        <tr
                                          key={idx}
                                          className={`border-t border-indigo-100 dark:border-indigo-900 ${
                                            sh.isCurrent ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''
                                          }`}
                                        >
                                          <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                            <div className="flex items-center gap-2">
                                              {sh.siteName}
                                              {sh.isCurrent && (
                                                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 border py-0 px-1.5">
                                                  Current
                                                </Badge>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-500">
                                            <div className="flex items-center gap-1 text-xs">
                                              <Clock className="h-3 w-3 flex-shrink-0" />
                                              {fmt(sh.pumpStartDate)}
                                              {' → '}
                                              {sh.pumpStopDate
                                                ? fmt(sh.pumpStopDate)
                                                : <span className="text-emerald-600 font-semibold">Present</span>
                                              }
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 text-right text-slate-600">{sh.totalLoggedDays}</td>
                                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">
                                            {sh.activeDays.toFixed(1)}
                                          </td>
                                          <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full ${
                                                    utilPct >= 80 ? 'bg-emerald-500'
                                                    : utilPct >= 50 ? 'bg-amber-400'
                                                    : 'bg-rose-400'
                                                  }`}
                                                  style={{ width: `${utilPct}%` }}
                                                />
                                              </div>
                                              <span className="text-xs text-slate-600 w-8 text-right">{utilPct}%</span>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              {hasDateFilter
                ? 'No machines with logged activity in the selected date range.'
                : 'No machines with logged activity found.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Overdue Maintenance ───────────────────────────────────────────── */}
      {overdueList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-rose-500" />
              Maintenance Alerts ({overdueList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Current Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Service</TableHead>
                    <TableHead>Next Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueList.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold">{m.name}</TableCell>
                      <TableCell className="text-slate-500 font-mono text-sm">{m.serialNumber || '—'}</TableCell>
                      <TableCell className="text-sm">{m.site}</TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell className="text-sm text-slate-600">{m.lastServiceDate ? fmt(m.lastServiceDate) : '—'}</TableCell>
                      <TableCell className="text-sm font-medium text-rose-600">{fmt(m.nextServiceDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Diesel Summary ────────────────────────────────────────────────── */}
      {dieselSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-amber-500" />
              Diesel Usage vs. Refills {hasDateFilter ? `(${fmt(filterFrom)} – ${fmt(filterTo)})` : '(All Time)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Refilled (L)</TableHead>
                    <TableHead className="text-right">Logged Usage (L)</TableHead>
                    <TableHead className="text-right">Delta (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dieselSummary.map((row, i) => {
                    const delta = row.refilled - row.logged;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.siteName}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.refilled.toFixed(0)}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.logged.toFixed(0)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(0)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
