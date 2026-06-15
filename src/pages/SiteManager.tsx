import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '../contexts/OperationsContext';
import {
  MapPin, Building2, Search, MoreVertical, Package, FileText,
  ListFilter, CheckCircle2, Clock, XCircle, Activity, Eye
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
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
  const { waybills } = useOperations();
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');
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
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
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
    [statusFilter, searchTerm, inventorySite, activeCount, totalCount]
  );

  const filteredSites = operationalSites.filter(s => {
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
  });

  const getSiteStats = (siteName: string) => {
    const siteWaybills = waybills.filter(w =>
      (w.siteName ?? '').toLowerCase().includes(siteName.toLowerCase()) &&
      (w.status !== 'outstanding' || w.type === 'return')
    );
    const uniqueItemsCount = new Set(siteWaybills.flatMap(w => w.items.map(i => i.assetId))).size;
    return { waybills: siteWaybills.length, items: uniqueItemsCount };
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


      {/* ── Site Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredSites.map((site) => {
          const q = pendingSites.find(ps => ps.siteName === site.name || ps.siteId === site.id);
          const stats = getSiteStats(site.name);
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
                      <div className="flex items-center gap-2">
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
    </div>
  );
}
