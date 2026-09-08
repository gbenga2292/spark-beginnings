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

/* ── Status palette config ─────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  Active: {
    gradient: 'from-emerald-500 to-green-400',
    cardBorder: 'border-emerald-200 dark:border-emerald-800/60',
    cardBg: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/30',
    iconBg: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    pulse: true,
    Icon: CheckCircle2,
    label: 'Active',
    stripColor: 'bg-emerald-400',
    glowClass: 'hover:shadow-emerald-200/60 dark:hover:shadow-emerald-900/40',
  },
  Inactive: {
    gradient: 'from-amber-500 to-orange-400',
    cardBorder: 'border-amber-200 dark:border-amber-800/60',
    cardBg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30',
    iconBg: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    pulse: false,
    Icon: Clock,
    label: 'Pending',
    stripColor: 'bg-amber-400',
    glowClass: 'hover:shadow-amber-200/60 dark:hover:shadow-amber-900/40',
  },
  Ended: {
    gradient: 'from-slate-400 to-slate-500',
    cardBorder: 'border-slate-200 dark:border-slate-700',
    cardBg: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-800/40',
    iconBg: 'bg-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600',
    pulse: false,
    Icon: XCircle,
    label: 'Ended',
    stripColor: 'bg-slate-300 dark:bg-slate-600',
    glowClass: 'hover:shadow-slate-200/60 dark:hover:shadow-slate-900/40',
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
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-border">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              viewMode === 'list'
                ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="List View"
          >
            <List className="h-4 w-4" />
            <span>List</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              viewMode === 'grid'
                ? "bg-white dark:bg-slate-900 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Grid</span>
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex bg-slate-50/80 dark:bg-secondary p-1 rounded-xl border border-border">
          {(['All', 'Active', 'Inactive'] as const).map(tab => {
            const isActive = statusFilter === tab;
            const tabColor =
              tab === 'Active' ? (isActive ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30') :
              tab === 'Inactive' ? (isActive ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30') :
              (isActive ? 'bg-slate-700 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-slate-800/50');
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-all ${tabColor}`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search site name or client..."
            className="pl-9 bg-background border-border h-10 text-sm focus-visible:ring-blue-500/50 rounded-xl shadow-sm font-medium"
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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

      {/* ── Summary Stat Pills ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Active */}
        <div className="flex items-center gap-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl p-4 shadow-lg shadow-emerald-200/60 dark:shadow-emerald-900/40">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-white leading-none">{activeCount}</p>
            <p className="text-xs font-semibold text-emerald-100 mt-0.5">Active Sites</p>
          </div>
        </div>
        {/* Pending / Inactive */}
        <div className="flex items-center gap-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 shadow-lg shadow-amber-200/60 dark:shadow-amber-900/40">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-white leading-none">{inactiveCount}</p>
            <p className="text-xs font-semibold text-amber-100 mt-0.5">Pending Sites</p>
          </div>
        </div>
        {/* Total */}
        <div className="flex items-center gap-3 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 shadow-lg shadow-slate-300/40 dark:shadow-slate-900/60">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-white leading-none">{totalCount}</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">Total Sites</p>
          </div>
        </div>
      </div>

      {/* ── Content View (List or Grid) ────────────────────── */}
      {viewMode === 'list' ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 hover:bg-slate-50/80 dark:hover:bg-slate-900/80 border-b border-border">
                <TableHead className="font-bold text-xs uppercase text-muted-foreground py-3">Site Name</TableHead>
                <TableHead className="font-bold text-xs uppercase text-muted-foreground py-3">Client</TableHead>
                <TableHead className="font-bold text-xs uppercase text-muted-foreground py-3">Status</TableHead>
                <TableHead className="font-bold text-xs uppercase text-muted-foreground text-center py-3">Items</TableHead>
                <TableHead className="font-bold text-xs uppercase text-muted-foreground text-center py-3">Waybills</TableHead>
                <TableHead className="w-[100px] text-right font-bold text-xs uppercase text-muted-foreground py-3 pr-6">Action</TableHead>
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
                    className="cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => setInventorySite({ site, q: q || null })}
                  >
                    {/* Site Name */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br',
                          cfg.gradient
                        )}>
                          <MapPin className="h-4 w-4 text-white drop-shadow-sm" />
                        </div>
                        <span className="font-bold text-sm text-foreground uppercase truncate group-hover:text-primary transition-colors" title={site.name}>
                          {site.name}
                        </span>
                      </div>
                    </TableCell>

                    {/* Client */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="text-xs font-semibold text-muted-foreground truncate max-w-[160px]" title={site.client}>
                          {site.client}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 shadow-sm" title={`On Hold: ${activeHold.holdNote}`}>
                            <PauseCircle className="h-2.5 w-2.5" />
                            On Hold ({holdDays}d)
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Items */}
                    <TableCell className="py-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-foreground">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        {stats.items}
                      </span>
                    </TableCell>

                    {/* Waybills */}
                    <TableCell className="py-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-foreground">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {stats.waybills}
                      </span>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="py-3.5 text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 gap-1 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInventorySite({ site, q: q || null });
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredSites.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">No matching sites found.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Site Grid ──────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                  'border shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden rounded-xl cursor-pointer group relative',
                  cfg.cardBorder,
                  cfg.cardBg,
                  cfg.glowClass
                )}
                onClick={() => setInventorySite({ site, q: q || null })}
              >
                {/* Colored top strip */}
                <div className={cn('h-1.5 w-full', cfg.stripColor)} />

                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-3 min-w-0 flex-1">
                      {/* Gradient icon circle */}
                      <div className={cn(
                        'h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-md bg-gradient-to-br',
                        cfg.gradient
                      )}>
                        <MapPin className="h-5 w-5 text-white drop-shadow" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-foreground uppercase truncate leading-tight mb-1.5" title={site.name}>
                          {site.name}
                        </h3>

                        {/* Status badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
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
                          {(() => {
                            const activeHold = siteHoldPeriods?.find(h => (h.siteId === site.id || h.siteName === site.name) && !h.holdEnd);
                            const holdDays = activeHold ? Math.max(1, Math.round((new Date().getTime() - new Date(activeHold.holdStart).getTime()) / 86400000)) : 0;
                            if (!activeHold) return null;
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 shadow-sm" title={`On Hold: ${activeHold.holdNote}`}>
                                <PauseCircle className="h-2.5 w-2.5" />
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
                      className={cn(
                        'h-8 w-8 rounded-full transition-all opacity-0 group-hover:opacity-100',
                        status === 'Active'
                          ? 'text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                          : status === 'Ended'
                          ? 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInventorySite({ site, q: q || null });
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Client */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground truncate" title={site.client}>
                      {site.client}
                    </span>
                  </div>

                  {/* Scope description */}
                  <div className="text-xs text-muted-foreground leading-relaxed min-h-[36px] line-clamp-2 mb-4">
                    {q?.phase4?.scopeOfWorkSummary || 'Project assessment and technical proposal pending detailed documentation.'}
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="text-xs font-bold text-muted-foreground">{stats.items}</span>
                        <span className="text-[10px] text-muted-foreground/60">items</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="text-xs font-bold text-muted-foreground">{stats.waybills}</span>
                        <span className="text-[10px] text-muted-foreground/60">waybills</span>
                      </div>
                    </div>

                    {/* "Go" arrow that appears on hover */}
                    <div className={cn(
                      'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-all translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
                      status === 'Active' ? 'text-emerald-600' : status === 'Ended' ? 'text-slate-500' : 'text-amber-600'
                    )}>
                      <Eye className="h-3 w-3" />
                      View
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredSites.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">No matching sites found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
