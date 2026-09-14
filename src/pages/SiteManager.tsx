import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '../contexts/OperationsContext';
import {
  MapPin, Building2, Search, MoreVertical, Package, FileText,
  ListFilter, CheckCircle2, Clock, XCircle, Activity, Eye, PauseCircle,
  LayoutGrid, List
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { cn } from '@/src/lib/utils';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { SiteInventoryView } from './SiteInventoryView';
import { filterOperationalSites } from '@/src/lib/siteUtils';
import { useLocation } from 'react-router-dom';
import { MetricHeroCard } from '@/src/components/ui/MetricHeroCard';

/* ── Status palette config ─────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  Active: {
    cardBorder: 'border-slate-200 dark:border-slate-800',
    cardBg: 'bg-white dark:bg-slate-900',
    iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    pulse: true,
    Icon: CheckCircle2,
    label: 'Active',
    stripColor: 'bg-emerald-500',
  },
  Inactive: {
    cardBorder: 'border-slate-200 dark:border-slate-800',
    cardBg: 'bg-white dark:bg-slate-900',
    iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    pulse: false,
    Icon: Clock,
    label: 'Pending',
    stripColor: 'bg-amber-500',
  },
  Ended: {
    cardBorder: 'border-slate-200 dark:border-slate-800',
    cardBg: 'bg-white dark:bg-slate-900',
    iconBg: 'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    badgeBg: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    pulse: false,
    Icon: XCircle,
    label: 'Ended',
    stripColor: 'bg-slate-400 dark:bg-slate-600',
  },
} as const;

type SiteStatus = keyof typeof STATUS_CONFIG;

export function SiteManager() {
  const sites = useAppStore(s => s.sites);
  const operationalSites = useMemo(() => filterOperationalSites(sites), [sites]);
  const pendingSites = useAppStore(s => s.pendingSites);
  const consumableLogs = useAppStore(s => s.consumableLogs);
  const { waybills, siteHoldPeriods } = useOperations();
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [inventorySite, setInventorySite] = useState<{ site: Site; q: SiteQuestionnaire | null; initialMachineId?: string } | null>(null);

  // Auto-open site+machine when navigated from Operations Dashboard
  useEffect(() => {
    const state = location.state as { siteId?: string; assetId?: string } | null;
    if (state?.siteId) {
      const target = operationalSites.find(s => s.id === state.siteId);
      if (target) {
        const q = pendingSites.find(ps => ps.siteName === target.name || ps.siteId === target.id) || null;
        setInventorySite({ site: target, q, initialMachineId: state.assetId });
      }
    }
  // Only run on mount / when location.state changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const activeCount = operationalSites.filter(s => s.status === 'Active').length;
  const inactiveCount = operationalSites.filter(s => s.status !== 'Active' && s.status !== 'Ended').length;
  const totalCount = operationalSites.length;

  useSetPageTitle(
    inventorySite ? null : 'Site Management',
    inventorySite ? '' : `${activeCount} of ${totalCount} sites currently active`,
    inventorySite ? null : (
      <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto items-center">
        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-md border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm transition-all",
              viewMode === 'list'
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            )}
            title="List View"
          >
            <List className="h-3.5 w-3.5" />
            <span>List</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm transition-all",
              viewMode === 'grid'
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            )}
            title="Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Grid</span>
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-md border border-slate-200 dark:border-slate-800">
          {(['All', 'Active', 'Inactive'] as const).map(tab => {
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-sm transition-all font-mono",
                  isActive
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search site name or client..."
            className="pl-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-8 text-xs focus-visible:ring-1 focus-visible:ring-blue-600 rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
    ),
    [statusFilter, searchTerm, inventorySite, activeCount, totalCount, viewMode]
  );

  const filteredSites = operationalSites
    .filter(s => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.client.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = false;
      if (statusFilter === 'All') {
        matchesStatus = true;
      } else if (statusFilter === 'Inactive') {
        matchesStatus = s.status.toLowerCase() === 'inactive' || s.status.toLowerCase() === 'ended';
      } else {
        matchesStatus = s.status.toLowerCase() === statusFilter.toLowerCase();
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Prioritize Active sites first, then Inactive/Pending, then Ended
      const getStatusRank = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'active') return 0;
        if (s === 'inactive' || s === 'pending') return 1;
        if (s === 'ended') return 2;
        return 3;
      };
      const rankDiff = getStatusRank(a.status) - getStatusRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });

  const getSiteStats = (site: Site) => {
    const siteWaybills = waybills.filter(w =>
      (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
      (w.status !== 'outstanding' || w.type === 'return')
    );

    // Build site inventory by aggregating all waybill items
    const inventoryMap = new Map<string, number>();
    siteWaybills
      .filter(w => w.type === 'waybill' && w.status !== 'outstanding')
      .forEach(wb => {
        wb.items.forEach(item => {
          const current = inventoryMap.get(item.assetId) || 0;
          inventoryMap.set(item.assetId, current + item.quantity);
        });
      });

    // Subtract completed returns
    siteWaybills
      .filter(w => w.type === 'return')
      .forEach(wb => {
        wb.items.forEach(item => {
          if (wb.status === 'return_completed') {
            const current = inventoryMap.get(item.assetId) || 0;
            inventoryMap.set(item.assetId, Math.max(0, current - item.quantity));
          }
        });
      });

    // Subtract consumed usages
    const siteConsumableLogs = consumableLogs?.filter(log => log.siteId === site.id) || [];
    siteConsumableLogs.forEach(log => {
      const current = inventoryMap.get(log.assetId) || 0;
      inventoryMap.set(log.assetId, Math.max(0, current - log.quantityUsed));
    });

    const activeItemsCount = Array.from(inventoryMap.values()).filter(qty => qty > 0).length;
    return { waybills: siteWaybills.length, items: activeItemsCount };
  };

  if (inventorySite) {
    return (
      <SiteInventoryView
        site={inventorySite.site}
        questionnaire={inventorySite.q}
        initialMachineId={inventorySite.initialMachineId}
        initialTab={inventorySite.initialMachineId ? 'machines' : undefined}
        onBack={() => setInventorySite(null)}
        onSiteChange={(newSite) => {
          const newQ = pendingSites.find(ps => ps.siteName === newSite.name || ps.siteId === newSite.id) || null;
          setInventorySite({ site: newSite, q: newQ });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto pb-10">

      {/* ── Summary Stat Hero Card ────────────────────────── */}
      <MetricHeroCard
        primary={{
          label: "Operational Sites",
          value: totalCount,
          period: `${activeCount} active, ${inactiveCount} pending/inactive across all clients`,
          delta: `${Math.round((activeCount / (totalCount || 1)) * 100)}% active`,
          deltaType: 'positive',
        }}
        secondary={[
          {
            label: "Active Sites",
            value: activeCount,
            period: "Operational",
          },
          {
            label: "Pending Sites",
            value: inactiveCount,
            period: "Awaiting / Inactive",
          },
          {
            label: "Ended Sites",
            value: operationalSites.filter(s => s.status === 'Ended').length,
            period: "Decommissioned",
          }
        ]}
      />

      {/* ── Content View (List or Grid) ────────────────────── */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/75 dark:bg-slate-800/40 hover:bg-slate-50/75 dark:hover:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <TableHead className="font-bold text-[11px] uppercase tracking-wider font-mono text-slate-500 py-2.5">Site Name</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider font-mono text-slate-500 py-2.5">Client</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider font-mono text-slate-500 py-2.5">Status</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider font-mono text-slate-500 text-center py-2.5">Items</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-wider font-mono text-slate-500 text-center py-2.5">Waybills</TableHead>
                <TableHead className="w-[80px] text-right font-bold text-[11px] uppercase tracking-wider font-mono text-slate-500 py-2.5 pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.map((site) => {
                const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
                const stats = getSiteStats(site);
                const status = (site.status as SiteStatus) in STATUS_CONFIG ? (site.status as SiteStatus) : 'Inactive';
                const cfg = STATUS_CONFIG[status];
                const StatusIcon = cfg.Icon;
                const activeHold = siteHoldPeriods?.find(h => (h.siteId === site.id || h.siteName === site.name) && !h.holdEnd);
                const holdDays = activeHold ? Math.max(1, Math.round((new Date().getTime() - new Date(activeHold.holdStart).getTime()) / 86400000)) : 0;

                return (
                  <TableRow
                    key={site.id}
                    className="cursor-pointer group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60"
                    onClick={() => setInventorySite({ site, q: q || null })}
                  >
                    {/* Site Name */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-sm flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 uppercase truncate group-hover:text-blue-600 transition-colors" title={site.name}>
                          {site.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Client */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-xs font-normal text-slate-600 dark:text-slate-300 truncate max-w-[160px]" title={site.client}>
                          {site.client}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold uppercase font-mono tracking-wider px-2 py-0.5 rounded-sm border',
                          cfg.badgeBg
                        )}>
                          {cfg.pulse && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                          )}
                          <StatusIcon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </span>
                        {activeHold && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase font-mono tracking-wider px-2 py-0.5 rounded-sm border bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800" title={`On Hold: ${activeHold.holdNote}`}>
                            <PauseCircle className="h-2.5 w-2.5" />
                            On Hold ({holdDays}d)
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Items */}
                    <TableCell className="py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums px-2 py-0.5 rounded-sm border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                        <Package className="h-3 w-3 text-slate-400" />
                        {stats.items}
                      </span>
                    </TableCell>

                    {/* Waybills */}
                    <TableCell className="py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums px-2 py-0.5 rounded-sm border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                        <FileText className="h-3 w-3 text-slate-400" />
                        {stats.waybills}
                      </span>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="py-2.5 text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 gap-1 rounded-sm transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInventorySite({ site, q: q || null });
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredSites.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
              <MapPin className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium">No matching sites found.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Site Grid ──────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSites.map((site) => {
            const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
            const stats = getSiteStats(site);
            const status = (site.status as SiteStatus) in STATUS_CONFIG ? (site.status as SiteStatus) : 'Inactive';
            const cfg = STATUS_CONFIG[status];
            const StatusIcon = cfg.Icon;

            return (
              <Card
                key={site.id}
                className={cn(
                  'border border-slate-200 dark:border-slate-800 overflow-hidden rounded-md cursor-pointer group relative bg-white dark:bg-slate-900 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-colors'
                )}
                onClick={() => setInventorySite({ site, q: q || null })}
              >
                {/* Colored top strip */}
                <div className={cn('h-1 w-full', cfg.stripColor)} />

                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex gap-2.5 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-sm flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                        <MapPin className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase truncate leading-tight mb-1" title={site.name}>
                          {site.name}
                        </h3>

                        {/* Status badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[9px] font-bold uppercase font-mono tracking-wider px-1.5 py-0.5 rounded-sm border',
                            cfg.badgeBg
                          )}>
                            {cfg.pulse && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                            )}
                            <StatusIcon className="h-2 w-2" />
                            {cfg.label}
                          </span>
                          {(() => {
                            const activeHold = siteHoldPeriods?.find(h => (h.siteId === site.id || h.siteName === site.name) && !h.holdEnd);
                            const holdDays = activeHold ? Math.max(1, Math.round((new Date().getTime() - new Date(activeHold.holdStart).getTime()) / 86400000)) : 0;
                            if (!activeHold) return null;
                            return (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase font-mono tracking-wider px-1.5 py-0.5 rounded-sm border bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800" title={`On Hold: ${activeHold.holdNote}`}>
                                <PauseCircle className="h-2 w-2" />
                                On Hold ({holdDays}d)
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Open button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInventorySite({ site, q: q || null });
                      }}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Client */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate" title={site.client}>
                      {site.client}
                    </span>
                  </div>

                  {/* Scope description */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[32px] line-clamp-2 mb-3">
                    {q?.phase4?.scopeOfWorkSummary || 'Project assessment and technical proposal pending detailed documentation.'}
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono tabular-nums">{stats.items}</span>
                        <span className="text-[10px] text-slate-400">items</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono tabular-nums">{stats.waybills}</span>
                        <span className="text-[10px] text-slate-400">waybills</span>
                      </div>
                    </div>

                    {/* "Go" arrow that appears on hover */}
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 transition-all opacity-0 group-hover:opacity-100">
                      <Eye className="h-3 w-3" />
                      View
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredSites.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center gap-2 text-slate-400">
              <MapPin className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium">No matching sites found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
