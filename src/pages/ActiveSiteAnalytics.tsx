import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  BarChart3, Fuel, Clock, AlertTriangle, Activity, 
  CheckCircle2, Check, ArrowLeft, Calendar, Wrench, Sparkles, 
  Download, ExternalLink, ChevronDown, Layers, Filter,
  ShieldAlert, Droplets, Zap, TrendingUp, AlertCircle, HardHat,
  RefreshCw, ArrowRight, X, Globe, Archive, Search, LayoutGrid, List,
  SlidersHorizontal, Bell, Maximize2, Minimize2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  ComposedChart, Line, ReferenceLine
} from 'recharts';
import { useAppStore, Site, DewateringStage } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useTheme } from '@/src/hooks/useTheme';
import { useSetPageTitle, useAutoCollapseSidebar } from '@/src/contexts/PageContext';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/src/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import { DailyLogManager } from './DailyLogManager';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';

/**
 * Formats a refill date relative to the current date:
 * - Today: "Today, 08/09/2026"
 * - Yesterday: "Yesterday, 07/09/2026"
 * - Earlier this week (2..6 days ago in current calendar week): "Wednesday, 02/09/2026"
 * - Last week (within previous calendar week, or 7..13 days ago): "Last Wednesday, 26/08/2026"
 * - Older than last week (>= 14 days ago / past months / historical): "Wednesday, 23/01/2026"
 */
function formatLastRefilledDate(dateInput: any): string {
  if (!dateInput) return 'No refill recorded';
  const normalized = normalizeDate(dateInput);
  if (!normalized) return 'No refill recorded';

  const [yStr, mStr, dStr] = normalized.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);
  const targetDate = new Date(year, month, day);
  if (isNaN(targetDate.getTime())) return '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const dayName = targetDate.toLocaleDateString('en-GB', { weekday: 'long' });
  const formattedDate = `${dStr.padStart(2, '0')}/${mStr.padStart(2, '0')}/${yStr}`;

  if (diffDays === 0) {
    return `Today, ${formattedDate}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${formattedDate}`;
  }

  // Calculate start of current calendar week (Monday 00:00:00)
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = (currentDayOfWeek + 6) % 7;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - daysSinceMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  // "Last [DayName]" is strictly for dates in the previous week (previous calendar week or 7-13 days ago)
  const isLastCalendarWeek = targetDate >= startOfLastWeek && targetDate < startOfThisWeek;
  const isSevenToThirteenDaysAgo = diffDays >= 7 && diffDays <= 13;

  if (isLastCalendarWeek || isSevenToThirteenDaysAgo) {
    return `Last ${dayName}, ${formattedDate}`;
  }

  // If earlier in the current week or further back in time (historical/months ago), output day name without "Last"
  return `${dayName}, ${formattedDate}`;
}

// Palette colors (strictly adhering to no-purple / no-generic design system)
const CHART_COLORS = {
  emerald: '#10b981',
  emeraldLight: '#34d399',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  rose: '#f43f5e',
  slate: '#64748b',
  slateDark: '#334155',
  slateLight: '#e2e8f0'
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f43f5e',
};

// Distinct machine label cleaner (removes redundant "Dewatering" prefixes while preserving distinguishing numbers/specs)
export function formatMachineShortName(fullName: string): string {
  if (!fullName) return 'Machine';
  let clean = fullName.replace(/^dewatering\s+/i, '').trim();
  clean = clean.replace(/^pump\s+pump/i, 'Pump');
  clean = clean.replace(/dewatering\s+pump/i, 'Pump');
  clean = clean.replace(/dewatering/i, '').trim();

  // If still very long, shorten neatly while keeping distinguishing identifiers
  if (clean.length > 22) {
    const parts = clean.split(/\s*[-–/]\s*/);
    if (parts.length > 1) {
      clean = `${parts[0]} (${parts[1].slice(0, 10)})`;
    } else {
      clean = clean.slice(0, 20) + '…';
    }
  }
  return clean;
}

export function stageBadgeColor(stage?: DewateringStage) {
  switch (stage) {
    case 'mobilization':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900';
    case 'installation':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900';
    case 'operation':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
    case 'demobilisation':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    default:
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900';
  }
}

export function getFuelEfficiencyStatus(actual: number, expected: number): {
  status: 'optimal' | 'mild_elevation' | 'high_consumption' | 'low_consumption' | 'unbenchmarked';
  label: string;
  badgeCls: string;
  variancePercent: number;
} {
  if (!expected || expected <= 0) {
    return {
      status: 'unbenchmarked',
      label: 'Unbenchmarked',
      badgeCls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      variancePercent: 0,
    };
  }

  const diff = actual - expected;
  const pct = Math.round((diff / expected) * 100);

  if (pct > 20) {
    return {
      status: 'high_consumption',
      label: `+${pct}% High Fuel`,
      badgeCls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      variancePercent: pct,
    };
  }
  if (pct > 10) {
    return {
      status: 'mild_elevation',
      label: `+${pct}% Elevated`,
      badgeCls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      variancePercent: pct,
    };
  }
  if (pct < -20) {
    return {
      status: 'low_consumption',
      label: `${pct}% Low Burn`,
      badgeCls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
      variancePercent: pct,
    };
  }
  return {
    status: 'optimal',
    label: `${pct >= 0 ? '+' : ''}${pct}% Optimal`,
    badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    variancePercent: pct,
  };
}

export function ActiveSiteAnalytics() {
  useAutoCollapseSidebar();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useTheme();

  const { sites, pendingSites = [] } = useAppStore();
  const { 
    dailyMachineLogs = [], 
    sitePumpDates = [], 
    waybills = [], 
    assets = [], 
    maintenanceAssets = [],
    siteHoldPeriods = [],
    persistSitePumpDates
  } = useOperations();

  // Helper to determine if a site is a dewatering project (strictly excludes pure waterproofing, tiling, etc.)
  const isDewateringSite = useCallback((s: Site) => {
    if (!s) return false;
    const clientLower = s.client?.trim().toLowerCase() || '';
    const nameLower = s.name?.trim().toLowerCase() || '';

    // 1. Check linked onboarding questionnaire in pendingSites
    const q = (pendingSites || []).find(
      ps => (ps.siteId && ps.siteId === s.id) ||
        (ps.siteName?.trim().toLowerCase() === nameLower && ps.clientName?.trim().toLowerCase() === clientLower)
    );
    if (q) {
      const rawService = (
        q.phase1?.whatIsBeingBuilt ||
        (q as any).service ||
        (q as any).serviceName ||
        ''
      ).trim().toLowerCase();

      if (rawService) {
        if (rawService.includes('dewatering')) return true;
        // Explicitly set to a non-dewatering service (e.g. 'Waterproofing', 'Tiling', etc.)
        return false;
      }
    }

    // 2. Clients known exclusively for non-dewatering projects (e.g. First Bank is all waterproofing)
    if (clientLower.includes('first bank')) {
      return false;
    }

    // 3. Explicit service field on site object if present
    if ((s as any).service && !(s as any).service.toLowerCase().includes('dewatering')) {
      return false;
    }

    return true;
  }, [pendingSites]);

  // Active sites filter (excluding sites on hold, DCEL client, Site Office, and non-dewatering projects)
  const activeSites = useMemo(() => {
    return (sites || [])
      .filter(s => {
        if (s.status !== 'Active') return false;

        // Exclude DCEL client
        const clientLower = s.client?.trim().toLowerCase();
        if (clientLower === 'dcel') return false;

        // Exclude Site Office / Office
        const nameLower = s.name?.trim().toLowerCase();
        if (
          nameLower === 'office' ||
          nameLower.includes('site office') ||
          nameLower.includes('office (dcel)') ||
          nameLower.includes('dcel office')
        ) {
          return false;
        }

        // Only show dewatering type projects
        if (!isDewateringSite(s)) return false;

        // Exclude sites that are currently on hold
        const isOnHold = (siteHoldPeriods || []).some(
          h => (h.siteId === s.id || h.siteName?.trim().toLowerCase() === nameLower) && !h.holdEnd
        );
        return !isOnHold;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, siteHoldPeriods, isDewateringSite]);

  // Historical / Inactive / Ended / On-Hold sites toggle
  const paramSiteId = searchParams.get('siteId');
  const [showHistoricalSites, setShowHistoricalSites] = useState<boolean>(() => {
    if (paramSiteId && paramSiteId !== 'all') {
      const targetSite = (sites || []).find(s => s.id === paramSiteId);
      if (targetSite && targetSite.status !== 'Active') return true;
    }
    return false;
  });

  const historicalSites = useMemo(() => {
    return (sites || [])
      .filter(s => {
        // Exclude DCEL client
        const clientLower = s.client?.trim().toLowerCase();
        if (clientLower === 'dcel') return false;

        // Exclude Site Office / Office
        const nameLower = s.name?.trim().toLowerCase();
        if (
          nameLower === 'office' ||
          nameLower.includes('site office') ||
          nameLower.includes('office (dcel)') ||
          nameLower.includes('dcel office')
        ) {
          return false;
        }

        // Must be a dewatering type project
        if (!isDewateringSite(s)) return false;

        // Must be non-active (Ended / Inactive) OR currently on hold
        const isNotActiveStatus = s.status !== 'Active';
        const isOnHold = (siteHoldPeriods || []).some(
          h => (h.siteId === s.id || h.siteName?.trim().toLowerCase() === nameLower) && !h.holdEnd
        );

        return isNotActiveStatus || isOnHold;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, siteHoldPeriods, isDewateringSite]);

  // Selected site: 'all' represents Portfolio Overview, or a specific site id
  const initialSiteId = paramSiteId ? paramSiteId : (activeSites.length > 1 ? 'all' : (activeSites[0]?.id ?? 'all'));
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId);

  // Sync selectedSiteId if URL query changes
  React.useEffect(() => {
    const qSite = searchParams.get('siteId');
    if (qSite && qSite !== selectedSiteId) {
      if (qSite === 'all' || activeSites.some(s => s.id === qSite) || (sites || []).some(s => s.id === qSite)) {
        setSelectedSiteId(qSite);
      }
    }
  }, [searchParams, activeSites, sites, selectedSiteId]);

  const isPortfolioMode = selectedSiteId === 'all';

  // Current site when viewing a single site
  const currentSite = useMemo(() => {
    if (selectedSiteId === 'all') return null;
    return activeSites.find(s => s.id === selectedSiteId) || (sites || []).find(s => s.id === selectedSiteId) || null;
  }, [activeSites, sites, selectedSiteId]);

  // Filters
  const [selectedMachineId, setSelectedMachineId] = useState<string>('all');
  const [varianceMachineFilter, setVarianceMachineFilter] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'year' | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [fleetChartFilter, setFleetChartFilter] = useState<'all' | 'active' | 'offsite'>('all');
  
  // Historical Archive Search, Filter, View Mode, and Pagination States
  const [archiveSearch, setArchiveSearch] = useState('');
  const deferredArchiveSearch = useDeferredValue(archiveSearch);
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<'all' | 'ended' | 'onhold'>('all');
  const [archiveViewMode, setArchiveViewMode] = useState<'table' | 'cards'>('table');
  const [archiveVisibleCount, setArchiveVisibleCount] = useState<number>(12);
  const [portfolioTab, setPortfolioTab] = useState<'active' | 'archive' | 'both'>('active');

  // Full Screen Chart Mode
  const [fullScreenChart, setFullScreenChart] = useState<string | null>(null);

  const toggleFullScreenChart = async (chartId: string) => {
    if (fullScreenChart === chartId) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      setFullScreenChart(null);
    } else {
      setFullScreenChart(chartId);
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen().catch(() => {});
      }
    }
  };

  React.useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setFullScreenChart(null);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── Progressive Chart Rendering ──
  // Defers SVG/Recharts rendering until after the first paint so the page
  // header and KPI cards appear instantly when navigating from the sidebar.
  const [chartsReady, setChartsReady] = React.useState(false);
  React.useEffect(() => {
    // Double-RAF ensures the browser has committed the first frame before
    // we trigger the (heavier) chart mount.
    let raf1: number;
    let raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setChartsReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [selectedSiteId]); // reset on site change so new charts also fade in

  // Refill Forecast Notification Bell & Modal
  const [isRefillForecastModalOpen, setIsRefillForecastModalOpen] = useState<boolean>(false);
  const [refillForecastScope, setRefillForecastScope] = useState<'current' | 'fleet'>('current');
  const [refillForecastSearch, setRefillForecastSearch] = useState<string>('');
  const deferredRefillForecastSearch = useDeferredValue(refillForecastSearch);
  const [refillForecastUrgencyFilter, setRefillForecastUrgencyFilter] = useState<'all' | 'urgent' | 'tomorrow' | 'safe'>('all');

  // Modal / sub-view for Machine Daily Register
  const [activeRegisterMachine, setActiveRegisterMachine] = useState<{ id: string; name: string } | null>(null);

  // Modal for editing Pump Dates & Replacement Lineage
  const [editingPumpDateMachine, setEditingPumpDateMachine] = useState<{
    id: string;
    name: string;
    startDate: string;
    stopDate: string;
    replacedAssetId: string;
    swapReason: string;
  } | null>(null);
  const [isSavingPumpDates, setIsSavingPumpDates] = useState(false);
  const [pumpDateModalError, setPumpDateModalError] = useState<string | null>(null);

  // Hold periods for this site
  const siteHolds = useMemo(() => {
    if (!currentSite || !siteHoldPeriods) return [];
    return (siteHoldPeriods || []).filter(h => h.siteId === currentSite.id);
  }, [siteHoldPeriods, currentSite]);

  const isCurrentlyOnHold = siteHolds.some(h => !h.holdEnd);

  // Calculate waybill inventory for current site to determine deployed machines
  const siteWaybills = useMemo(() => {
    if (!currentSite) return [];
    return (waybills || []).filter(w =>
      (w.siteName?.toLowerCase() === currentSite.name.toLowerCase() || w.siteId === currentSite.id) &&
      w.status !== 'outstanding'
    );
  }, [waybills, currentSite]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    siteWaybills.filter(w => w.type === 'waybill' && w.status !== 'outstanding').forEach(wb => {
      wb.items.forEach(item => {
        map.set(item.assetId, (map.get(item.assetId) || 0) + item.quantity);
      });
    });
    siteWaybills.filter(w => w.type === 'return').forEach(wb => {
      wb.items.forEach(item => {
        const cur = map.get(item.assetId) || 0;
        map.set(item.assetId, Math.max(0, cur - item.quantity));
      });
    });
    return map;
  }, [siteWaybills]);

  // All machines associated with this site (currently on site or logged in daily logs or pump dates)
  const siteMachines = useMemo(() => {
    if (!currentSite) return [];
    const map = new Map<string, { 
      id: string; 
      name: string; 
      isCurrentlyOnSite: boolean;
      startDate: string;
      stopDate: string | null;
      isReplaced: boolean;
      replacementName?: string;
    }>();

    // 1. Equipment in current inventory
    (assets || [])
      .filter(a => a.type === 'equipment' && a.requiresLogging && (inventoryMap.get(a.id) || 0) > 0)
      .forEach(a => {
        map.set(a.id, { 
          id: a.id, 
          name: a.name, 
          isCurrentlyOnSite: true,
          startDate: '',
          stopDate: null,
          isReplaced: false
        });
      });

    // 2. Equipment with pump dates configured
    (sitePumpDates || [])
      .filter(pd => pd.siteId === currentSite.id)
      .forEach(pd => {
        const asset = (assets || []).find(a => a.id === pd.assetId) || (maintenanceAssets || []).find(m => m.id === pd.assetId);
        const name = asset?.name || 'Unknown Pump';
        const isCurrentlyOnSite = !pd.pumpStopDate;

        // Check if replaced
        const successorRecord = (sitePumpDates || []).find(p => p.siteId === currentSite.id && p.replacedAssetId === pd.assetId);
        const successorAsset = successorRecord 
          ? (assets || []).find(a => a.id === successorRecord.assetId) || (maintenanceAssets || []).find(m => m.id === successorRecord.assetId)
          : null;

        map.set(pd.assetId, { 
          id: pd.assetId, 
          name, 
          isCurrentlyOnSite: isCurrentlyOnSite && !successorRecord,
          startDate: pd.pumpStartDate,
          stopDate: pd.pumpStopDate || null,
          isReplaced: !!successorRecord,
          replacementName: successorAsset?.name
        });
      });

    // 3. Equipment appearing in daily machine logs for this site
    (dailyMachineLogs || [])
      .filter(l => l.siteId === currentSite.id)
      .forEach(l => {
        if (!map.has(l.assetId)) {
          const invQty = inventoryMap.get(l.assetId) || 0;
          map.set(l.assetId, { 
            id: l.assetId, 
            name: l.assetName || 'Equipment', 
            isCurrentlyOnSite: invQty > 0,
            startDate: '',
            stopDate: null,
            isReplaced: false
          });
        }
      });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentSite, assets, maintenanceAssets, inventoryMap, sitePumpDates, dailyMachineLogs]);

  const activeSiteMachines = useMemo(() => siteMachines.filter(m => m.isCurrentlyOnSite), [siteMachines]);
  const takenOutSiteMachines = useMemo(() => siteMachines.filter(m => !m.isCurrentlyOnSite), [siteMachines]);

  // Scoped machines based on header machine filter (all, active only, offsite only, or individual machine)
  const scopedFilterMachines = useMemo(() => {
    if (selectedMachineId === 'active_only') {
      return activeSiteMachines;
    }
    if (selectedMachineId === 'offsite_only') {
      return takenOutSiteMachines;
    }
    if (selectedMachineId !== 'all') {
      return siteMachines.filter(m => m.id === selectedMachineId);
    }
    return siteMachines;
  }, [siteMachines, activeSiteMachines, takenOutSiteMachines, selectedMachineId]);

  // ── Multi-Site Portfolio Aggregator (Option A) ──
  const allActiveSitesPortfolio = useMemo(() => {
    if (!activeSites.length) {
      return {
        siteMetricsList: [],
        siteMetricsMap: new Map<string, any>(),
        totals: {
          activeSitesCount: 0,
          totalActivePumps: 0,
          totalDieselRefilled: 0,
          totalExpectedDiesel: 0,
          netVarianceLitres: 0,
          fleetDailyAvg: 0,
          totalDowntimeCount: 0,
          totalLostHours: 0,
          sitesOnHoldCount: 0,
        },
        comparativeChartData: [],
      };
    }

    const now = new Date();

    const siteMetricsList = activeSites.map(site => {
      // Hold status
      const isOnHold = (siteHoldPeriods || []).some(h => h.siteId === site.id && !h.holdEnd);

      // Waybills & inventory to discover machines
      const siteWb = (waybills || []).filter(w =>
        (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
        w.status !== 'outstanding'
      );
      const invMap = new Map<string, number>();
      siteWb.filter(w => w.type === 'waybill').forEach(wb => {
        wb.items.forEach(item => {
          invMap.set(item.assetId, (invMap.get(item.assetId) || 0) + item.quantity);
        });
      });
      siteWb.filter(w => w.type === 'return').forEach(wb => {
        wb.items.forEach(item => {
          const cur = invMap.get(item.assetId) || 0;
          invMap.set(item.assetId, Math.max(0, cur - item.quantity));
        });
      });

      // Machines deployed on this site
      const pumpConfigs = (sitePumpDates || []).filter(pd => pd.siteId === site.id);
      const sLogs = (dailyMachineLogs || []).filter(l => l.siteId === site.id);

      const machineIdSet = new Set<string>();
      (assets || []).filter(a => a.type === 'equipment' && a.requiresLogging && (invMap.get(a.id) || 0) > 0).forEach(a => machineIdSet.add(a.id));
      pumpConfigs.forEach(pd => machineIdSet.add(pd.assetId));
      sLogs.forEach(l => machineIdSet.add(l.assetId));

      const pumpDurationList: Array<{
        id: string;
        name: string;
        shortName: string;
        isActive: boolean;
        startDate: string | null;
        startDateFormatted: string | null;
        stopDate: string | null;
        daysDuration: number;
        activeLogDays: number;
      }> = [];

      const allPumpStartDates: string[] = [];

      let activePumpsCount = 0;
      machineIdSet.forEach(mId => {
        const pd = pumpConfigs.find(p => p.assetId === mId);
        const mLogs = sLogs.filter(l => l.assetId === mId);
        const hasExplicitStop = !!pd?.pumpStopDate;
        const isReplaced = pumpConfigs.some(p => p.replacedAssetId === mId);
        const isCurrentlyActive = !hasExplicitStop && !isReplaced && (
          (pd?.pumpStartDate && !pd?.pumpStopDate) ||
          (invMap.get(mId) || 0) > 0
        );
        if (isCurrentlyActive) {
          activePumpsCount++;
        }

        const assetObj = (assets || []).find(a => a.id === mId) || (maintenanceAssets || []).find(ma => ma.id === mId);
        const rawName = assetObj?.name || mLogs[0]?.assetName || 'Pump';
        const shortName = (assetObj as any)?.shortName || formatMachineShortName(rawName);

        const earliestMLog = mLogs.reduce((earliest, l) => (!earliest || l.date < earliest ? l.date : earliest), '');
        const startDate = pd?.pumpStartDate || earliestMLog || '';
        const stopDate = pd?.pumpStopDate || null;

        if (startDate) {
          allPumpStartDates.push(startDate);
        }

        const activeLogDays = mLogs.reduce((acc, l) => {
          const op = l.operationalDay ?? (l.isActive ? 'full' : 'none');
          if (op === 'full') return acc + 1;
          if (op === 'half') return acc + 0.5;
          return acc;
        }, 0);

        let daysDuration = 0;
        if (startDate) {
          const start = new Date(startDate);
          const end = stopDate ? new Date(stopDate) : now;
          const diff = Math.max(0, end.getTime() - start.getTime());
          daysDuration = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + (stopDate ? 1 : 0));
        } else {
          daysDuration = activeLogDays || mLogs.length;
        }

        let startDateFormatted: string | null = null;
        if (startDate) {
          const parts = startDate.split('T')[0].split('-');
          if (parts.length === 3) {
            startDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            startDateFormatted = startDate;
          }
        }

        pumpDurationList.push({
          id: mId,
          name: rawName,
          shortName,
          isActive: isCurrentlyActive,
          startDate: startDate || null,
          startDateFormatted,
          stopDate,
          daysDuration,
          activeLogDays,
        });
      });

      // Sort: active pumps first, then longest duration
      pumpDurationList.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.daysDuration - a.daysDuration;
      });

      // Site-wide earliest pump start date (from logs or configured pump start date)
      const earliestSiteLog = sLogs.reduce((earliest, l) => (!earliest || l.date < earliest ? l.date : earliest), '');
      if (earliestSiteLog) {
        allPumpStartDates.push(earliestSiteLog);
      }
      allPumpStartDates.sort();

      const earliestPumpStartDate = allPumpStartDates[0] || site.startDate || null;
      let earliestPumpDays: number | null = null;
      let earliestPumpStartDateFormatted: string | null = null;

      if (earliestPumpStartDate) {
        const start = new Date(earliestPumpStartDate);
        const diff = Math.max(0, now.getTime() - start.getTime());
        earliestPumpDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        const parts = earliestPumpStartDate.split('T')[0].split('-');
        if (parts.length === 3) {
          earliestPumpStartDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          earliestPumpStartDateFormatted = earliestPumpStartDate;
        }
      }

      // Logs filtered by time range
      const siteFilteredLogs = sLogs.filter(log => {
        const logDate = new Date(log.date);
        if (timeRange === '30d') {
          const cutoff = new Date();
          cutoff.setDate(now.getDate() - 30);
          if (logDate < cutoff) return false;
        } else if (timeRange === '90d') {
          const cutoff = new Date();
          cutoff.setDate(now.getDate() - 90);
          if (logDate < cutoff) return false;
        } else if (timeRange === 'year') {
          if (logDate.getFullYear().toString() !== selectedYear) return false;
        }
        return true;
      });

      const totalDiesel = siteFilteredLogs.reduce((sum, l) => sum + (Number(l.dieselUsage) || 0), 0);
      
      let fullDays = 0;
      let halfDays = 0;
      let offDays = 0;
      let activeDays = 0;
      let expectedDiesel = 0;

      siteFilteredLogs.forEach(l => {
        const op = l.operationalDay ?? (l.isActive ? 'full' : 'none');
        const rawAsset = (assets || []).find(a => a.id === l.assetId);
        const burnRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;

        if (op === 'full') {
          fullDays++;
          activeDays += 1.0;
          expectedDiesel += burnRate * 1.0;
        } else if (op === 'half') {
          halfDays++;
          activeDays += 0.5;
          expectedDiesel += burnRate * 0.5;
        } else {
          offDays++;
        }
      });

      const dailyAvgBurn = activeDays > 0 ? Number((totalDiesel / activeDays).toFixed(1)) : 0;
      const roundedExpected = Number(expectedDiesel.toFixed(1));
      const varianceLitres = Number((totalDiesel - roundedExpected).toFixed(1));

      let downtimeCount = 0;
      let lostHours = 0;
      siteFilteredLogs.forEach(l => {
        if (l.downtimeEntries && l.downtimeEntries.length > 0) {
          downtimeCount += l.downtimeEntries.length;
          lostHours += l.downtimeEntries.reduce((acc, d) => acc + (Number(d.durationHours) || 0), 0);
        } else if (l.issuesOnSite?.trim() || l.maintenanceDetails?.trim()) {
          downtimeCount += 1;
        }
      });

      const fuelEfficiency = getFuelEfficiencyStatus(totalDiesel, roundedExpected);

      // Latest refill recorded for this site
      const siteRefillLogs = sLogs
        .filter(l => (Number(l.dieselUsage) || 0) > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      const latestRefillLog = siteRefillLogs[0] || null;
      const lastRefillDate = latestRefillLog?.date || null;
      const lastRefillLitres = latestRefillLog ? Number(latestRefillLog.dieselUsage) : 0;
      const lastRefilledFormatted = lastRefillDate ? formatLastRefilledDate(lastRefillDate) : null;

      return {
        id: site.id,
        name: site.name,
        client: site.client || null,
        stage: site.currentDewateringStage || 'Active',
        startDate: site.startDate || null,
        isOnHold,
        activePumpsCount,
        totalMachinesCount: machineIdSet.size,
        logCount: siteFilteredLogs.length,
        totalDiesel: Number(totalDiesel.toFixed(1)),
        expectedDiesel: roundedExpected,
        varianceLitres,
        dailyAvgBurn,
        activeDays: Number(activeDays.toFixed(1)),
        fullDays,
        halfDays,
        offDays,
        downtimeCount,
        lostHours: Number(lostHours.toFixed(1)),
        fuelEfficiency,
        lastRefillDate,
        lastRefillLitres,
        lastRefilledFormatted,
        earliestPumpDays,
        earliestPumpStartDate,
        earliestPumpStartDateFormatted,
        pumpDurationList,
      };
    });

    const siteMetricsMap = new Map<string, typeof siteMetricsList[0]>();
    siteMetricsList.forEach(sm => siteMetricsMap.set(sm.id, sm));

    const totalActiveSites = siteMetricsList.length;
    const totalActivePumps = siteMetricsList.reduce((sum, s) => sum + s.activePumpsCount, 0);
    const totalDieselRefilled = Number(siteMetricsList.reduce((sum, s) => sum + s.totalDiesel, 0).toFixed(1));
    const totalExpectedDiesel = Number(siteMetricsList.reduce((sum, s) => sum + s.expectedDiesel, 0).toFixed(1));
    const netVarianceLitres = Number((totalDieselRefilled - totalExpectedDiesel).toFixed(1));
    const totalActiveDays = siteMetricsList.reduce((sum, s) => sum + s.activeDays, 0);
    const fleetDailyAvg = totalActiveDays > 0 ? Number((totalDieselRefilled / totalActiveDays).toFixed(1)) : 0;
    const totalDowntimeCount = siteMetricsList.reduce((sum, s) => sum + s.downtimeCount, 0);
    const totalLostHours = Number(siteMetricsList.reduce((sum, s) => sum + s.lostHours, 0).toFixed(1));
    const sitesOnHoldCount = siteMetricsList.filter(s => s.isOnHold).length;

    // Find latest refill across all active sites
    const allActiveRefills = siteMetricsList
      .filter(s => s.lastRefillDate)
      .sort((a, b) => (b.lastRefillDate || '').localeCompare(a.lastRefillDate || ''));
    const latestFleetRefill = allActiveRefills[0] || null;
    const latestFleetRefillFormatted = latestFleetRefill?.lastRefillDate
      ? latestFleetRefill.lastRefilledFormatted
      : null;

    const comparativeChartData = siteMetricsList.map(s => ({
      name: s.name.length > 15 ? `${s.name.slice(0, 14)}…` : s.name,
      fullName: s.name,
      siteId: s.id,
      client: s.client,
      activePumps: s.activePumpsCount,
      dieselRefilled: s.totalDiesel,
      expectedDiesel: s.expectedDiesel,
      variance: s.varianceLitres,
      dailyAvgBurn: s.dailyAvgBurn,
      activeDays: s.activeDays,
      lostHours: s.lostHours,
      downtimes: s.downtimeCount,
      lastRefilledFormatted: s.lastRefilledFormatted,
    }));

    return {
      siteMetricsList,
      siteMetricsMap,
      totals: {
        activeSitesCount: totalActiveSites,
        totalActivePumps,
        totalDieselRefilled,
        totalExpectedDiesel,
        netVarianceLitres,
        fleetDailyAvg,
        totalDowntimeCount,
        totalLostHours,
        sitesOnHoldCount,
        latestFleetRefillFormatted,
      },
      comparativeChartData,
    };
  }, [activeSites, siteHoldPeriods, waybills, sitePumpDates, dailyMachineLogs, assets, timeRange, selectedYear]);

  // Historical site metrics calculation (only computed when toggle is on)
  const historicalSiteMetrics = useMemo(() => {
    if (!showHistoricalSites || !historicalSites.length) return [];
    const now = new Date();

    return historicalSites.map(site => {
      const isOnHold = (siteHoldPeriods || []).some(
        h => (h.siteId === site.id || h.siteName?.toLowerCase() === site.name.toLowerCase()) && !h.holdEnd
      );

      const siteWb = (waybills || []).filter(w =>
        (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
        w.status !== 'outstanding'
      );
      const invMap = new Map<string, number>();
      siteWb.filter(w => w.type === 'waybill').forEach(wb => {
        wb.items.forEach(item => {
          invMap.set(item.assetId, (invMap.get(item.assetId) || 0) + item.quantity);
        });
      });
      siteWb.filter(w => w.type === 'return').forEach(wb => {
        wb.items.forEach(item => {
          const cur = invMap.get(item.assetId) || 0;
          invMap.set(item.assetId, Math.max(0, cur - item.quantity));
        });
      });

      const pumpConfigs = (sitePumpDates || []).filter(pd => pd.siteId === site.id);
      const sLogs = (dailyMachineLogs || []).filter(l => l.siteId === site.id);

      const machineIdSet = new Set<string>();
      (assets || []).filter(a => a.type === 'equipment' && a.requiresLogging && (invMap.get(a.id) || 0) > 0).forEach(a => machineIdSet.add(a.id));
      pumpConfigs.forEach(pd => machineIdSet.add(pd.assetId));
      sLogs.forEach(l => machineIdSet.add(l.assetId));

      const pumpDurationList: Array<{
        id: string;
        name: string;
        shortName: string;
        isActive: boolean;
        startDate: string | null;
        startDateFormatted: string | null;
        stopDate: string | null;
        daysDuration: number;
        activeLogDays: number;
      }> = [];

      const allPumpStartDates: string[] = [];
      const siteEndDateObj = site.endDate ? new Date(site.endDate) : now;

      machineIdSet.forEach(mId => {
        const pd = pumpConfigs.find(p => p.assetId === mId);
        const mLogs = sLogs.filter(l => l.assetId === mId);
        const hasExplicitStop = !!pd?.pumpStopDate;
        const isReplaced = pumpConfigs.some(p => p.replacedAssetId === mId);
        const isCurrentlyActive = !hasExplicitStop && !isReplaced && (
          (pd?.pumpStartDate && !pd?.pumpStopDate) ||
          (invMap.get(mId) || 0) > 0
        );

        const assetObj = (assets || []).find(a => a.id === mId) || (maintenanceAssets || []).find(ma => ma.id === mId);
        const rawName = assetObj?.name || mLogs[0]?.assetName || 'Pump';
        const shortName = (assetObj as any)?.shortName || formatMachineShortName(rawName);

        const earliestMLog = mLogs.reduce((earliest, l) => (!earliest || l.date < earliest ? l.date : earliest), '');
        const startDate = pd?.pumpStartDate || earliestMLog || '';
        const stopDate = pd?.pumpStopDate || null;

        if (startDate) {
          allPumpStartDates.push(startDate);
        }

        const activeLogDays = mLogs.reduce((acc, l) => {
          const op = l.operationalDay ?? (l.isActive ? 'full' : 'none');
          if (op === 'full') return acc + 1;
          if (op === 'half') return acc + 0.5;
          return acc;
        }, 0);

        let daysDuration = 0;
        if (startDate) {
          const start = new Date(startDate);
          const end = stopDate ? new Date(stopDate) : siteEndDateObj;
          const diff = Math.max(0, end.getTime() - start.getTime());
          daysDuration = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + (stopDate ? 1 : 0));
        } else {
          daysDuration = activeLogDays || mLogs.length;
        }

        let startDateFormatted: string | null = null;
        if (startDate) {
          const parts = startDate.split('T')[0].split('-');
          if (parts.length === 3) {
            startDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            startDateFormatted = startDate;
          }
        }

        pumpDurationList.push({
          id: mId,
          name: rawName,
          shortName,
          isActive: isCurrentlyActive,
          startDate: startDate || null,
          startDateFormatted,
          stopDate,
          daysDuration,
          activeLogDays,
        });
      });

      pumpDurationList.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.daysDuration - a.daysDuration;
      });

      const earliestSiteLog = sLogs.reduce((earliest, l) => (!earliest || l.date < earliest ? l.date : earliest), '');
      if (earliestSiteLog) {
        allPumpStartDates.push(earliestSiteLog);
      }
      allPumpStartDates.sort();

      const earliestPumpStartDate = allPumpStartDates[0] || site.startDate || null;
      let earliestPumpDays: number | null = null;
      let earliestPumpStartDateFormatted: string | null = null;

      if (earliestPumpStartDate) {
        const start = new Date(earliestPumpStartDate);
        const diff = Math.max(0, siteEndDateObj.getTime() - start.getTime());
        earliestPumpDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        const parts = earliestPumpStartDate.split('T')[0].split('-');
        if (parts.length === 3) {
          earliestPumpStartDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          earliestPumpStartDateFormatted = earliestPumpStartDate;
        }
      }

      const siteFilteredLogs = sLogs.filter(log => {
        const logDate = new Date(log.date);
        if (timeRange === '30d') {
          const cutoff = new Date();
          cutoff.setDate(now.getDate() - 30);
          if (logDate < cutoff) return false;
        } else if (timeRange === '90d') {
          const cutoff = new Date();
          cutoff.setDate(now.getDate() - 90);
          if (logDate < cutoff) return false;
        } else if (timeRange === 'year') {
          if (logDate.getFullYear().toString() !== selectedYear) return false;
        }
        return true;
      });

      const totalDiesel = siteFilteredLogs.reduce((sum, l) => sum + (Number(l.dieselUsage) || 0), 0);
      let activeDays = 0;
      let expectedDiesel = 0;

      siteFilteredLogs.forEach(l => {
        const op = l.operationalDay ?? (l.isActive ? 'full' : 'none');
        const rawAsset = (assets || []).find(a => a.id === l.assetId);
        const burnRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;

        if (op === 'full') {
          activeDays += 1.0;
          expectedDiesel += burnRate * 1.0;
        } else if (op === 'half') {
          activeDays += 0.5;
          expectedDiesel += burnRate * 0.5;
        }
      });

      const dailyAvgBurn = activeDays > 0 ? Number((totalDiesel / activeDays).toFixed(1)) : 0;
      const roundedExpected = Number(expectedDiesel.toFixed(1));
      const varianceLitres = Number((totalDiesel - roundedExpected).toFixed(1));

      let downtimeCount = 0;
      let lostHours = 0;
      siteFilteredLogs.forEach(l => {
        if (l.downtimeEntries && l.downtimeEntries.length > 0) {
          downtimeCount += l.downtimeEntries.length;
          lostHours += l.downtimeEntries.reduce((acc, d) => acc + (Number(d.durationHours) || 0), 0);
        } else if (l.issuesOnSite?.trim() || l.maintenanceDetails?.trim()) {
          downtimeCount += 1;
        }
      });

      const fuelEfficiency = getFuelEfficiencyStatus(totalDiesel, roundedExpected);

      const siteRefillLogs = sLogs
        .filter(l => (Number(l.dieselUsage) || 0) > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      const latestRefillLog = siteRefillLogs[0] || null;
      const lastRefillDate = latestRefillLog?.date || null;
      const lastRefillLitres = latestRefillLog ? Number(latestRefillLog.dieselUsage) : 0;
      const lastRefilledFormatted = lastRefillDate ? formatLastRefilledDate(lastRefillDate) : null;

      return {
        id: site.id,
        name: site.name,
        client: site.client || null,
        status: site.status,
        stage: site.currentDewateringStage || site.status,
        startDate: site.startDate || null,
        endDate: site.endDate || null,
        isOnHold,
        totalMachinesCount: machineIdSet.size,
        logCount: siteFilteredLogs.length,
        totalDiesel: Number(totalDiesel.toFixed(1)),
        expectedDiesel: roundedExpected,
        varianceLitres,
        dailyAvgBurn,
        activeDays: Number(activeDays.toFixed(1)),
        downtimeCount,
        lostHours: Number(lostHours.toFixed(1)),
        fuelEfficiency,
        lastRefillDate,
        lastRefillLitres,
        lastRefilledFormatted,
        earliestPumpDays,
        earliestPumpStartDate,
        earliestPumpStartDateFormatted,
        pumpDurationList,
      };
    });
  }, [showHistoricalSites, historicalSites, siteHoldPeriods, waybills, sitePumpDates, dailyMachineLogs, assets, timeRange, selectedYear]);

  // Filtered historical site metrics based on search query and status filter
  const filteredHistoricalSites = useMemo(() => {
    return historicalSiteMetrics.filter(s => {
      const q = deferredArchiveSearch.trim().toLowerCase();
      const matchesSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.client && s.client.toLowerCase().includes(q)) ||
        (s.stage && s.stage.toLowerCase().includes(q));

      const matchesStatus = 
        archiveStatusFilter === 'all' ||
        (archiveStatusFilter === 'ended' && s.status === 'Ended') ||
        (archiveStatusFilter === 'onhold' && s.isOnHold);

      return matchesSearch && matchesStatus;
    });
  }, [historicalSiteMetrics, deferredArchiveSearch, archiveStatusFilter]);

  // Aggregate stats across historical sites for KPI strip when viewing archive
  const historicalTotals = useMemo(() => {
    const totalDiesel = historicalSiteMetrics.reduce((sum, s) => sum + s.totalDiesel, 0);
    const totalExpected = historicalSiteMetrics.reduce((sum, s) => sum + s.expectedDiesel, 0);
    const totalDays = historicalSiteMetrics.reduce((sum, s) => sum + s.activeDays, 0);
    const totalMachines = historicalSiteMetrics.reduce((sum, s) => sum + s.totalMachinesCount, 0);
    const totalLogs = historicalSiteMetrics.reduce((sum, s) => sum + s.logCount, 0);
    const totalVariance = Number((totalDiesel - totalExpected).toFixed(1));
    const avgDaily = totalDays > 0 ? Number((totalDiesel / totalDays).toFixed(1)) : 0;

    const latestRefillSite = [...historicalSiteMetrics]
      .filter(s => !!s.lastRefillDate)
      .sort((a, b) => (b.lastRefillDate || '').localeCompare(a.lastRefillDate || ''))[0];

    return {
      totalSites: historicalSiteMetrics.length,
      totalDiesel: Number(totalDiesel.toFixed(1)),
      totalDays: Number(totalDays.toFixed(1)),
      totalMachines,
      totalLogs,
      totalVariance,
      avgDaily,
      latestRefillFormatted: latestRefillSite?.lastRefilledFormatted || null,
    };
  }, [historicalSiteMetrics]);

  // Raw logs for this site
  const siteLogs = useMemo(() => {
    if (!currentSite) return [];
    return (dailyMachineLogs || []).filter(l => l.siteId === currentSite.id);
  }, [dailyMachineLogs, currentSite]);

  // Date filtering helper
  const filteredLogs = useMemo(() => {
    if (!siteLogs.length) return [];
    const now = new Date();

    return siteLogs.filter(log => {
      const logDate = new Date(log.date);

      // Machine filter
      if (selectedMachineId === 'active_only') {
        const activeIds = new Set(activeSiteMachines.map(m => m.id));
        if (!activeIds.has(log.assetId)) return false;
      } else if (selectedMachineId === 'offsite_only') {
        const offsiteIds = new Set(takenOutSiteMachines.map(m => m.id));
        if (!offsiteIds.has(log.assetId)) return false;
      } else if (selectedMachineId !== 'all' && log.assetId !== selectedMachineId) {
        return false;
      }

      // Time range filter
      if (timeRange === '30d') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 30);
        if (logDate < cutoff) return false;
      } else if (timeRange === '90d') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 90);
        if (logDate < cutoff) return false;
      } else if (timeRange === 'year') {
        if (logDate.getFullYear().toString() !== selectedYear) return false;
      }

      return true;
    });
  }, [siteLogs, selectedMachineId, activeSiteMachines, takenOutSiteMachines, timeRange, selectedYear]);

  // Machine deployment & operational days analytics
  const machineFleetStats = useMemo(() => {
    if (!currentSite) return [];

    let targetFleet = siteMachines;
    if (selectedMachineId === 'active_only') {
      targetFleet = activeSiteMachines;
    } else if (selectedMachineId === 'offsite_only') {
      targetFleet = takenOutSiteMachines;
    } else if (selectedMachineId !== 'all') {
      targetFleet = siteMachines.filter(m => m.id === selectedMachineId);
    }

    return targetFleet.map(machine => {
      const mLogs = siteLogs.filter(l => l.assetId === machine.id);
      
      // Calculate active operational days
      const activeDays = mLogs.reduce((acc, l) => {
        const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
        if (opDay === 'full') return acc + 1;
        if (opDay === 'half') return acc + 0.5;
        return acc;
      }, 0);

      const offDays = mLogs.filter(l => {
        const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
        return opDay === 'none';
      }).length;

      const halfDays = mLogs.filter(l => l.operationalDay === 'half').length;
      const fullDays = mLogs.filter(l => (l.operationalDay === 'full' || (!l.operationalDay && l.isActive))).length;

      // Pump dates & deployment configuration
      const pumpConfig = (sitePumpDates || []).find(pd => pd.siteId === currentSite.id && pd.assetId === machine.id);
      
      // Check Machine Replacement Lineage (Predecessor & Successor)
      const predecessorId = pumpConfig?.replacedAssetId;
      const predecessorAsset = predecessorId
        ? (assets || []).find(a => a.id === predecessorId) || (maintenanceAssets || []).find(ma => ma.id === predecessorId)
        : null;

      const successorRecord = (sitePumpDates || []).find(p => p.siteId === currentSite.id && p.replacedAssetId === machine.id);
      const successorAsset = successorRecord
        ? (assets || []).find(a => a.id === successorRecord.assetId) || (maintenanceAssets || []).find(ma => ma.id === successorRecord.assetId)
        : null;

      const swapReason = pumpConfig?.swapReason || successorRecord?.swapReason || null;

      // Earliest known deployment date: pumpStartDate or earliest log or waybill date
      const earliestLog = mLogs.reduce((earliest, l) => (!earliest || l.date < earliest ? l.date : earliest), '' as string);
      const machineWaybill = (siteWaybills || []).find(w => w.type === 'waybill' && (w.items || []).some(i => i.assetId === machine.id));
      const waybillDate = machineWaybill?.sentToSiteDate || machineWaybill?.issueDate || '';

      const startDate = pumpConfig?.pumpStartDate || earliestLog || waybillDate || currentSite.startDate || '';
      const stopDate = pumpConfig?.pumpStopDate || null;

      // Active vs Taken Out vs Replaced
      const hasExplicitStop = !!pumpConfig?.pumpStopDate;
      const isReplaced = !!successorRecord;
      const isCurrentlyActive = !hasExplicitStop && !isReplaced && (
        (pumpConfig?.pumpStartDate && !pumpConfig?.pumpStopDate) ||
        (inventoryMap.get(machine.id) || 0) > 0 ||
        machine.isCurrentlyOnSite
      );

      const status: 'active' | 'taken_out' | 'replaced' = isCurrentlyActive 
        ? 'active' 
        : isReplaced 
        ? 'replaced' 
        : 'taken_out';

      const statusLabel = status === 'active' 
        ? 'Active on Site' 
        : status === 'replaced' 
        ? 'Replaced / Swapped Out' 
        : 'Taken Out / Demobilized';

      // Calculate total calendar days on site
      let calendarDaysOnSite = 0;
      if (startDate) {
        const start = new Date(startDate);
        const end = stopDate ? new Date(stopDate) : new Date();
        const diffTime = Math.max(0, end.getTime() - start.getTime());
        calendarDaysOnSite = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + (stopDate ? 1 : 0));
      } else {
        calendarDaysOnSite = mLogs.length || 0;
      }

      // Total diesel
      const totalDiesel = mLogs.reduce((sum, l) => sum + (Number(l.dieselUsage) || 0), 0);
      const avgDieselPerActiveDay = activeDays > 0 ? (totalDiesel / activeDays) : 0;

      // Downtime incidents & hours
      let downtimeCount = 0;
      let downtimeHours = 0;
      mLogs.forEach(l => {
        if (l.downtimeEntries && l.downtimeEntries.length > 0) {
          downtimeCount += l.downtimeEntries.length;
          downtimeHours += l.downtimeEntries.reduce((sum, d) => sum + (Number(d.durationHours) || 0), 0);
        } else if (l.issuesOnSite?.trim() || l.maintenanceDetails?.trim()) {
          downtimeCount += 1;
        }
      });

      // Utilization rate
      const utilization = calendarDaysOnSite > 0 
        ? Math.min(100, Math.round((activeDays / calendarDaysOnSite) * 100)) 
        : 0;

      // Maintenance asset matching
      const maintAsset = maintenanceAssets.find(ma => 
        ma.id === machine.id || ma.name.toLowerCase().trim() === machine.name.toLowerCase().trim()
      );

      // Raw asset matching for benchmark metrics
      const rawAsset = (assets || []).find(a => 
        a.id === machine.id || a.name.toLowerCase().trim() === machine.name.toLowerCase().trim()
      );

      const expectedDailyBurnRate = Number(rawAsset?.expectedDailyBurnRate) || 0;
      const tankCapacityLitres = Number(rawAsset?.tankCapacityLitres) || 0;
      const isBenchmarked = expectedDailyBurnRate > 0;
      const expectedDiesel = isBenchmarked ? Number(((fullDays * 1.0 + halfDays * 0.5) * expectedDailyBurnRate).toFixed(1)) : 0;
      const varianceLitres = isBenchmarked ? Number((totalDiesel - expectedDiesel).toFixed(1)) : 0;
      const fuelEfficiency = getFuelEfficiencyStatus(totalDiesel, expectedDiesel);

      // Tank gauge calculations based on Dipstick readings & Refill logs
      const sortedLogsDesc = [...mLogs].sort((a, b) => b.date.localeCompare(a.date));
      const lastDipstickLog = sortedLogsDesc.find(l => l.dipstickLevelLitres != null && Number(l.dipstickLevelLitres) >= 0);
      const lastDipstickDate = lastDipstickLog?.date || null;
      const lastDipstickLitres = lastDipstickLog?.dipstickLevelLitres != null ? Number(lastDipstickLog.dipstickLevelLitres) : null;

      const lastRefillLog = sortedLogsDesc.find(l => (Number(l.dieselUsage) || 0) > 0);
      const lastRefillDate = lastRefillLog?.date || null;
      const lastRefillLitres = Number(lastRefillLog?.dieselUsage) || 0;
      const wasLastRefillFull = !!lastRefillLog?.isTankFilledToFull;

      const effectiveTankCapacity = tankCapacityLitres > 0 
        ? tankCapacityLitres 
        : (lastRefillLitres > 0 ? lastRefillLitres : (lastDipstickLitres || 0));

      let estimatedRemainingLitres = 0;
      let isDipstickVerified = false;

      if (isCurrentlyActive && effectiveTankCapacity > 0) {
        // Scenario A: A dipstick reading is available and occurred on or after the last refill
        if (lastDipstickDate && (!lastRefillDate || lastDipstickDate >= lastRefillDate)) {
          let activeDaysSinceDip = 0;
          mLogs.forEach(l => {
            if (l.date > lastDipstickDate) {
              const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
              if (opDay === 'full') activeDaysSinceDip += 1;
              else if (opDay === 'half') activeDaysSinceDip += 0.5;
            }
          });
          const todayStr = new Date().toISOString().split('T')[0];
          const hasTodayLog = mLogs.some(l => l.date === todayStr);
          if (isCurrentlyActive && todayStr > lastDipstickDate && !hasTodayLog) {
            activeDaysSinceDip += 1;
          }
          const burnedSinceDip = expectedDailyBurnRate > 0 ? (activeDaysSinceDip * expectedDailyBurnRate) : 0;
          estimatedRemainingLitres = Math.max(0, Math.min(effectiveTankCapacity, Math.round((lastDipstickLitres || 0) - burnedSinceDip)));
          isDipstickVerified = (activeDaysSinceDip === 0);
        } 
        // Scenario B: Refill occurred after the last dipstick (or no dipstick available)
        else if (lastRefillDate) {
          let activeDaysSinceRefill = 0;
          mLogs.forEach(l => {
            if (l.date > lastRefillDate) {
              const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
              if (opDay === 'full') activeDaysSinceRefill += 1;
              else if (opDay === 'half') activeDaysSinceRefill += 0.5;
            }
          });
          const todayStr = new Date().toISOString().split('T')[0];
          const hasTodayLog = mLogs.some(l => l.date === todayStr);
          if (isCurrentlyActive && todayStr > lastRefillDate && !hasTodayLog) {
            activeDaysSinceRefill += 1;
          }
          const burnedSinceRefill = expectedDailyBurnRate > 0 ? (activeDaysSinceRefill * expectedDailyBurnRate) : 0;
          
          // Deplete previous dipstick reading by operational days before refill
          let remainingFromDipstick = 0;
          if (lastDipstickLitres != null && lastDipstickDate && lastDipstickDate < lastRefillDate) {
            let daysBetween = 0;
            mLogs.forEach(l => {
              if (l.date > lastDipstickDate && l.date < lastRefillDate) {
                const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (opDay === 'full') daysBetween += 1;
                else if (opDay === 'half') daysBetween += 0.5;
              }
            });
            remainingFromDipstick = Math.max(0, lastDipstickLitres - (daysBetween * (expectedDailyBurnRate || 0)));
          }

          // If explicitly marked full tank, start from 100% capacity
          // Otherwise, if previous dipstick exists, add refill to depleted dipstick
          const baseline = wasLastRefillFull 
            ? effectiveTankCapacity 
            : (lastDipstickLitres != null 
                ? Math.min(effectiveTankCapacity, remainingFromDipstick + lastRefillLitres)
                : (tankCapacityLitres > 0 ? Math.min(effectiveTankCapacity, lastRefillLitres) : effectiveTankCapacity));
                
          estimatedRemainingLitres = Math.max(0, Math.round(baseline - burnedSinceRefill));
        }
      }

      const hasTelemetryAnchor = (lastRefillLog != null || lastDipstickLog != null);

      const fuelPercentage = (isCurrentlyActive && effectiveTankCapacity > 0 && hasTelemetryAnchor)
        ? Math.min(100, Math.max(0, Math.round((estimatedRemainingLitres / effectiveTankCapacity) * 100)))
        : 0;

      const runwayDays = (isCurrentlyActive && expectedDailyBurnRate > 0 && estimatedRemainingLitres > 0)
        ? (estimatedRemainingLitres / expectedDailyBurnRate)
        : 0;
      const runwayHours = Math.round(runwayDays * 24);

      let fuelLevelStatus: 'optimal' | 'good' | 'low' | 'critical' | 'unbenchmarked' = 'optimal';
      if (!isCurrentlyActive || !hasTelemetryAnchor || effectiveTankCapacity <= 0) {
        fuelLevelStatus = 'unbenchmarked';
      } else if (!isBenchmarked && tankCapacityLitres <= 0) {
        fuelLevelStatus = 'unbenchmarked';
      } else if (fuelPercentage <= 15) {
        fuelLevelStatus = 'critical';
      } else if (fuelPercentage <= 35) {
        fuelLevelStatus = 'low';
      } else if (fuelPercentage <= 70) {
        fuelLevelStatus = 'good';
      } else {
        fuelLevelStatus = 'optimal';
      }

      const shortName = formatMachineShortName(machine.name);
      const chartLabel = `${shortName} ${isCurrentlyActive ? '🟢' : '⚪ (Offsite)'}`;

      return {
        id: machine.id,
        name: machine.name,
        shortName,
        chartLabel,
        isCurrentlyActive,
        isCurrentlyOnSite: isCurrentlyActive,
        status,
        statusLabel,
        predecessorId,
        predecessorName: predecessorAsset?.name || null,
        successorName: successorAsset?.name || null,
        swapReason,
        startDate,
        stopDate,
        calendarDaysOnSite,
        logCount: mLogs.length,
        activeDays,
        fullDays,
        halfDays,
        offDays,
        totalDiesel,
        avgDieselPerActiveDay,
        expectedDailyBurnRate,
        tankCapacityLitres,
        isBenchmarked,
        expectedDiesel,
        varianceLitres,
        fuelEfficiency,
        lastRefillDate,
        lastRefillLitres,
        lastDipstickDate,
        lastDipstickLitres,
        isDipstickVerified,
        effectiveTankCapacity,
        estimatedRemainingLitres,
        fuelPercentage,
        runwayHours,
        runwayDays,
        fuelLevelStatus,
        downtimeCount,
        downtimeHours,
        utilization,
        serviceStatus: maintAsset?.status || 'ok',
        nextServiceDate: maintAsset?.nextServiceDate || null,
      };
    }).sort((a, b) => {
      if (a.isCurrentlyActive && !b.isCurrentlyActive) return -1;
      if (!a.isCurrentlyActive && b.isCurrentlyActive) return 1;
      return b.activeDays - a.activeDays;
    });
  }, [currentSite, siteMachines, activeSiteMachines, takenOutSiteMachines, selectedMachineId, siteLogs, sitePumpDates, siteWaybills, maintenanceAssets, assets, inventoryMap]);

  // Aggregated Site Metrics
  const siteAggregates = useMemo(() => {
    const totalDiesel = filteredLogs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0);
    
    const activeDays = filteredLogs.reduce((acc, l) => {
      const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
      if (opDay === 'full') return acc + 1;
      if (opDay === 'half') return acc + 0.5;
      return acc;
    }, 0);

    const fullDays = filteredLogs.filter(l => (l.operationalDay === 'full' || (!l.operationalDay && l.isActive))).length;
    const halfDays = filteredLogs.filter(l => l.operationalDay === 'half').length;
    const offDays = filteredLogs.filter(l => {
      const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
      return opDay === 'none';
    }).length;

    // Downtime breakdown
    let totalDowntimes = 0;
    let totalDowntimeHours = 0;
    const severityCounts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    const allDowntimesList: Array<{
      id: string;
      machineName: string;
      date: string;
      reason: string;
      durationHours: number;
      severity: string;
    }> = [];

    filteredLogs.forEach(l => {
      if (l.downtimeEntries && l.downtimeEntries.length > 0) {
        l.downtimeEntries.forEach(d => {
          totalDowntimes++;
          totalDowntimeHours += Number(d.durationHours) || 0;
          const sev = (d.severity || 'medium').toLowerCase();
          severityCounts[sev] = (severityCounts[sev] || 0) + 1;
          allDowntimesList.push({
            id: d.id || `${l.id}-${d.timestamp}`,
            machineName: l.assetName,
            date: l.date,
            reason: d.reason || 'Operational disruption',
            durationHours: Number(d.durationHours) || 0,
            severity: sev,
          });
        });
      } else if (l.issuesOnSite?.trim()) {
        totalDowntimes++;
        severityCounts.medium++;
        allDowntimesList.push({
          id: `${l.id}-issue`,
          machineName: l.assetName,
          date: l.date,
          reason: l.issuesOnSite,
          durationHours: 0,
          severity: 'medium',
        });
      }
    });

    // Total machine days deployed across fleet
    const totalFleetDaysOnSite = machineFleetStats.reduce((sum, m) => sum + m.calendarDaysOnSite, 0);
    const overallUtilization = totalFleetDaysOnSite > 0
      ? Math.min(100, Math.round((activeDays / totalFleetDaysOnSite) * 100))
      : 0;

    const avgDailyDiesel = activeDays > 0 ? (totalDiesel / activeDays) : 0;
    const totalExpectedDiesel = Number(machineFleetStats.reduce((sum, m) => sum + (m.expectedDiesel || 0), 0).toFixed(1));
    const hasBenchmarkData = machineFleetStats.some(m => m.isBenchmarked);
    const overallVarianceLitres = hasBenchmarkData ? Number((totalDiesel - totalExpectedDiesel).toFixed(1)) : 0;
    const overallFuelEfficiency = getFuelEfficiencyStatus(totalDiesel, totalExpectedDiesel);

    // Latest refill for site/machine
    const refillLogs = [...filteredLogs]
      .filter(l => (Number(l.dieselUsage) || 0) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    const latestRefill = refillLogs[0] || [...siteLogs].filter(l => (Number(l.dieselUsage) || 0) > 0).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    const lastRefillDate = latestRefill?.date || null;
    const lastRefillLitres = latestRefill ? Number(latestRefill.dieselUsage) : 0;
    const lastRefilledFormatted = lastRefillDate ? formatLastRefilledDate(lastRefillDate) : 'No refill recorded';

    return {
      totalDiesel,
      activeDays,
      fullDays,
      halfDays,
      offDays,
      totalDowntimes,
      totalDowntimeHours,
      severityCounts,
      allDowntimesList,
      totalFleetDaysOnSite,
      overallUtilization,
      avgDailyDiesel,
      totalExpectedDiesel,
      hasBenchmarkData,
      overallVarianceLitres,
      overallFuelEfficiency,
      machineCount: machineFleetStats.length,
      activeFleetCount: machineFleetStats.filter(m => m.isCurrentlyActive).length,
      takenOutFleetCount: machineFleetStats.filter(m => !m.isCurrentlyActive).length,
      lastRefillDate,
      lastRefillLitres,
      lastRefilledFormatted,
    };
  }, [filteredLogs, machineFleetStats, siteLogs]);

  // CSV Export helper
  const handleExportCSV = useCallback(() => {
    if (selectedSiteId === 'all') {
      const headers = ['Site Name', 'Client', 'Stage', 'Active Pumps', 'Total Diesel Refilled (L)', 'Expected Burn (L)', 'Variance (L)', 'Daily Avg Burn (L/Day)', 'Active Operating Days', 'Last Refill Date', 'Downtimes', 'Lost Hours', 'Fuel Efficiency'];
      const rows = allActiveSitesPortfolio.siteMetricsList.map(s => [
        `"${s.name}"`,
        `"${s.client || '—'}"`,
        `"${s.stage}"`,
        s.activePumpsCount,
        s.totalDiesel,
        s.expectedDiesel,
        `${s.varianceLitres > 0 ? '+' : ''}${s.varianceLitres}`,
        s.dailyAvgBurn,
        s.activeDays,
        `"${s.lastRefilledFormatted || '—'}"`,
        s.downtimeCount,
        s.lostHours,
        `"${s.fuelEfficiency.label}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `All_Active_Sites_Portfolio_Analytics.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!currentSite) return;
    const headers = ['Machine', 'Status', 'Pump Start Date', 'Pump Stop Date', 'Days On Site', 'Active Days', 'Diesel Refilled (L)', 'Expected Burn (L)', 'Variance (L)', 'Fuel Efficiency', 'Avg L/Day', 'Downtimes', 'Lost Hours', 'Utilization (%)'];
    const rows = machineFleetStats.map(m => [
      `"${m.name}"`,
      m.statusLabel,
      m.startDate || '—',
      m.stopDate || (m.isCurrentlyActive ? 'Present (Active)' : '—'),
      m.calendarDaysOnSite,
      m.activeDays,
      m.totalDiesel.toFixed(1),
      m.isBenchmarked ? m.expectedDiesel.toFixed(1) : 'Unbenchmarked',
      m.isBenchmarked ? `${m.varianceLitres > 0 ? '+' : ''}${m.varianceLitres.toFixed(1)}` : '—',
      m.fuelEfficiency.label,
      m.avgDieselPerActiveDay.toFixed(1),
      m.downtimeCount,
      m.downtimeHours.toFixed(1),
      `${m.utilization}%`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentSite.name.replace(/\s+/g, '_')}_Machine_Analytics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selectedSiteId, allActiveSitesPortfolio, currentSite, machineFleetStats]);

  // Handle open pump dates modal
  const handleOpenEditPumpDates = (m: { id: string; name: string; startDate?: string; stopDate?: string | null; predecessorId?: string | null; swapReason?: string | null }) => {
    const existing = (sitePumpDates || []).find(p => p.assetId === m.id && p.siteId === currentSite?.id);
    const rawStart = existing?.pumpStartDate || m.startDate || '';
    const rawStop = existing?.pumpStopDate || m.stopDate || '';
    setEditingPumpDateMachine({
      id: m.id,
      name: m.name,
      startDate: rawStart.includes('T') ? rawStart.split('T')[0] : rawStart,
      stopDate: rawStop.includes('T') ? rawStop.split('T')[0] : rawStop,
      replacedAssetId: existing?.replacedAssetId || m.predecessorId || '',
      swapReason: existing?.swapReason || m.swapReason || ''
    });
    setPumpDateModalError(null);
  };

  const handleSavePumpDatesModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPumpDateMachine || !currentSite) return;

    if (editingPumpDateMachine.stopDate && !editingPumpDateMachine.startDate) {
      setPumpDateModalError('Pump Start Date is required if Pump Stop Date is set.');
      return;
    }

    if (editingPumpDateMachine.startDate && editingPumpDateMachine.stopDate && editingPumpDateMachine.stopDate < editingPumpDateMachine.startDate) {
      setPumpDateModalError('Pump Stop Date cannot be earlier than Pump Start Date.');
      return;
    }

    setIsSavingPumpDates(true);
    try {
      await persistSitePumpDates(
        editingPumpDateMachine.id,
        currentSite.id,
        editingPumpDateMachine.startDate,
        editingPumpDateMachine.stopDate || null,
        editingPumpDateMachine.replacedAssetId || null,
        editingPumpDateMachine.swapReason || null
      );
      setEditingPumpDateMachine(null);
    } catch (err: any) {
      setPumpDateModalError(err.message || 'Failed to update pump dates.');
    } finally {
      setIsSavingPumpDates(false);
    }
  };

  // ── Set Page Title & Header Controls in Top Navigation Bar ──
  const headerTitleNode = useMemo(() => (
    <div className="flex items-center gap-2 min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40 min-w-0"
            title="Switch Active Dewatering Site"
          >
            {selectedSiteId === 'all' ? (
              <span className="truncate max-w-[210px] sm:max-w-[280px] md:max-w-[360px] flex items-center gap-1.5 text-cyan-800 dark:text-cyan-300">
                <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>All Active Sites ({activeSites.length})</span>
              </span>
            ) : (
              <span className="truncate max-w-[190px] sm:max-w-[280px] md:max-w-[360px] lg:max-w-[460px]">
                {currentSite ? `${currentSite.name}${currentSite.client ? ` (${currentSite.client})` : ''}` : 'Select Active Site'}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 sm:w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 shadow-xl rounded-xl">
          {/* Top Pinned: All Active Sites Portfolio Overview */}
          <DropdownMenuItem
            onClick={() => {
              setSelectedSiteId('all');
              setSearchParams({ siteId: 'all' });
            }}
            className={cn(
              "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800",
              selectedSiteId === 'all' && "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 font-bold"
            )}
          >
            <div className="flex flex-col min-w-0">
              <span className="truncate font-bold flex items-center gap-1.5 text-cyan-800 dark:text-cyan-300">
                <Globe className="w-3.5 h-3.5 text-cyan-500" />
                All Active Sites (Portfolio Overview)
              </span>
              <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                {allActiveSitesPortfolio.totals.activeSitesCount} sites • {allActiveSitesPortfolio.totals.totalActivePumps} active pumps • Fleet rollup
              </span>
            </div>
            {selectedSiteId === 'all' && <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Active Dewatering Sites ({activeSites.length})
          </div>
          {activeSites.map(s => {
            const isSelected = s.id === selectedSiteId;
            const siteData = allActiveSitesPortfolio.siteMetricsMap.get(s.id);
            return (
              <DropdownMenuItem
                key={s.id}
                onClick={() => {
                  setSelectedSiteId(s.id);
                  setSearchParams({ siteId: s.id });
                }}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800",
                  isSelected && "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 font-bold"
                )}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-semibold">{s.name}</span>
                    {siteData?.isOnHold && (
                      <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        Hold
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate">
                    {s.client && <span>{s.client}</span>}
                    {siteData && <span>• 🟢 {siteData.activePumpsCount} pumps</span>}
                    {s.currentDewateringStage && <span>• {s.currentDewateringStage}</span>}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />}
              </DropdownMenuItem>
            );
          })}

          {/* Historical & Inactive Sites Toggle & Archive List */}
          <DropdownMenuSeparator />
          <div 
            onClick={(e) => {
              e.preventDefault();
              setShowHistoricalSites(prev => {
                const next = !prev;
                if (next && isPortfolioMode) {
                  setPortfolioTab('archive');
                } else if (!next && isPortfolioMode) {
                  setPortfolioTab('active');
                }
                return next;
              });
            }}
            className="px-2.5 py-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors select-none"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <Archive className="w-3.5 h-3.5 text-slate-400" />
              <span>Show Inactive & Ended Sites</span>
              {historicalSites.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  {historicalSites.length}
                </span>
              )}
            </div>
            <div className={cn(
              "w-7 h-4 rounded-full transition-colors relative p-0.5 flex items-center shrink-0",
              showHistoricalSites ? "bg-cyan-600" : "bg-slate-300 dark:bg-slate-600"
            )}>
              <div className={cn(
                "w-3 h-3 rounded-full bg-white transition-transform shadow-xs",
                showHistoricalSites ? "translate-x-3" : "translate-x-0"
              )} />
            </div>
          </div>

          {showHistoricalSites && (
            <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Archive className="w-3 h-3 text-slate-400" />
                <span>Ended & Inactive Sites Archive ({historicalSites.length})</span>
              </div>
              {historicalSites.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400 italic">No inactive sites on record</div>
              ) : (
                historicalSites.map(s => {
                  const isSelected = s.id === selectedSiteId;
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => {
                        setSelectedSiteId(s.id);
                        setSearchParams({ siteId: s.id });
                      }}
                      className={cn(
                        "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                        isSelected && "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                      )}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold">{s.name}</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.2 rounded font-bold uppercase",
                            s.status === 'Ended' 
                              ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          )}>
                            {s.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                          {s.client && <span>{s.client}</span>}
                          {s.endDate && <span>• Ended: {formatDisplayDate(s.endDate)}</span>}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />}
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* On Hold Badge for specific site */}
      {selectedSiteId !== 'all' && isCurrentlyOnHold && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0 leading-none animate-pulse select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          On Hold
        </span>
      )}
    </div>
  ), [selectedSiteId, currentSite, isCurrentlyOnHold, activeSites, historicalSites, showHistoricalSites, allActiveSitesPortfolio]);

  // ── REFILL FORECAST ENGINE: 1-Day Safety Buffer Next Refill Dates ──
  const fleetRefillForecast = useMemo(() => {
    const list: Array<{
      siteId: string;
      siteName: string;
      machineId: string;
      machineName: string;
      shortName: string;
      tankCapacityLitres: number;
      benchmarkBurnRate: number;
      lastRefillDate: string | null;
      lastRefillLitres: number;
      lastDipstickDate: string | null;
      lastDipstickLitres: number | null;
      estimatedRemainingLitres: number;
      fuelPercentage: number;
      isDipstickVerified: boolean;
      runwayDays: number;
      daysUntilRefill: number;
      targetRefillDate: string | null;
      targetRefillFormatted: string;
      urgency: 'critical' | 'today' | 'tomorrow' | 'soon' | 'safe' | 'unbenchmarked';
      urgencyLabel: string;
      urgencyBadgeClass: string;
    }> = [];

    (activeSites || []).forEach(site => {
      // Waybills & inventory to discover machines on this site
      const siteWb = (waybills || []).filter(w =>
        (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
        w.status !== 'outstanding'
      );
      const invMap = new Map<string, number>();
      siteWb.filter(w => w.type === 'waybill').forEach(wb => {
        wb.items.forEach(item => {
          invMap.set(item.assetId, (invMap.get(item.assetId) || 0) + item.quantity);
        });
      });
      siteWb.filter(w => w.type === 'return').forEach(wb => {
        wb.items.forEach(item => {
          const cur = invMap.get(item.assetId) || 0;
          invMap.set(item.assetId, Math.max(0, cur - item.quantity));
        });
      });

      const pumpConfigs = (sitePumpDates || []).filter(pd => pd.siteId === site.id);
      const sLogs = (dailyMachineLogs || []).filter(l => l.siteId === site.id);

      const machineIdSet = new Set<string>();
      (assets || []).filter(a => a.type === 'equipment' && a.requiresLogging && (invMap.get(a.id) || 0) > 0).forEach(a => machineIdSet.add(a.id));
      pumpConfigs.forEach(pd => machineIdSet.add(pd.assetId));
      sLogs.forEach(l => machineIdSet.add(l.assetId));

      machineIdSet.forEach(mId => {
        const pd = pumpConfigs.find(p => p.assetId === mId);
        const hasExplicitStop = !!pd?.pumpStopDate;
        const isReplaced = pumpConfigs.some(p => p.replacedAssetId === mId);
        const isCurrentlyActive = !hasExplicitStop && !isReplaced && (
          (pd?.pumpStartDate && !pd?.pumpStopDate) ||
          (invMap.get(mId) || 0) > 0
        );

        if (!isCurrentlyActive) return;

        const rawAsset = (assets || []).find(a => a.id === mId || a.name?.toLowerCase().trim() === mId.toLowerCase().trim());
        const maintAsset = (maintenanceAssets || []).find(m => m.id === mId);
        const machineName = rawAsset?.name || maintAsset?.name || sLogs.find(l => l.assetId === mId)?.assetName || 'Pump Unit';
        const benchmarkBurnRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;
        const tankCapacityLitres = Number(rawAsset?.tankCapacityLitres) || 0;

        const mLogs = sLogs.filter(l => l.assetId === mId).sort((a, b) => b.date.localeCompare(a.date));
        const lastDipstickLog = mLogs.find(l => l.dipstickLevelLitres != null && Number(l.dipstickLevelLitres) >= 0);
        const lastDipstickDate = lastDipstickLog?.date || null;
        const lastDipstickLitres = lastDipstickLog?.dipstickLevelLitres != null ? Number(lastDipstickLog.dipstickLevelLitres) : null;

        const lastRefillLog = mLogs.find(l => (Number(l.dieselUsage) || 0) > 0);
        const lastRefillDate = lastRefillLog?.date || null;
        const lastRefillLitres = Number(lastRefillLog?.dieselUsage) || 0;
        const wasLastRefillFull = !!lastRefillLog?.isTankFilledToFull;

        const effectiveTankCapacity = tankCapacityLitres > 0 
          ? tankCapacityLitres 
          : (lastRefillLitres > 0 ? lastRefillLitres : (lastDipstickLitres || 120));

        let estimatedRemainingLitres = 0;
        let isDipstickVerified = false;
        const hasTelemetryAnchor = (lastRefillLog != null || lastDipstickLog != null);

        if (hasTelemetryAnchor && effectiveTankCapacity > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const hasTodayLog = mLogs.some(l => l.date === todayStr);

          if (lastDipstickDate && (!lastRefillDate || lastDipstickDate >= lastRefillDate)) {
            let activeDaysSinceDip = 0;
            mLogs.forEach(l => {
              if (l.date > lastDipstickDate) {
                const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (opDay === 'full') activeDaysSinceDip += 1;
                else if (opDay === 'half') activeDaysSinceDip += 0.5;
              }
            });
            if (isCurrentlyActive && todayStr > lastDipstickDate && !hasTodayLog) {
              activeDaysSinceDip += 1;
            }
            const burnedSinceDip = activeDaysSinceDip * benchmarkBurnRate;
            estimatedRemainingLitres = Math.max(0, Math.min(effectiveTankCapacity, Math.round((lastDipstickLitres || 0) - burnedSinceDip)));
            isDipstickVerified = (activeDaysSinceDip === 0);
          } else if (lastRefillDate) {
            let activeDaysSinceRefill = 0;
            mLogs.forEach(l => {
              if (l.date > lastRefillDate) {
                const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (opDay === 'full') activeDaysSinceRefill += 1;
                else if (opDay === 'half') activeDaysSinceRefill += 0.5;
              }
            });
            if (isCurrentlyActive && todayStr > lastRefillDate && !hasTodayLog) {
              activeDaysSinceRefill += 1;
            }
            const burnedSinceRefill = activeDaysSinceRefill * benchmarkBurnRate;

            let remainingFromDipstick = 0;
            if (lastDipstickLitres != null && lastDipstickDate && lastDipstickDate < lastRefillDate) {
              let daysBetween = 0;
              mLogs.forEach(l => {
                if (l.date > lastDipstickDate && l.date < lastRefillDate) {
                  const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                  if (opDay === 'full') daysBetween += 1;
                  else if (opDay === 'half') daysBetween += 0.5;
                }
              });
              remainingFromDipstick = Math.max(0, lastDipstickLitres - (daysBetween * benchmarkBurnRate));
            }

            const baseline = wasLastRefillFull 
              ? effectiveTankCapacity 
              : (lastDipstickLitres != null 
                  ? Math.min(effectiveTankCapacity, remainingFromDipstick + lastRefillLitres)
                  : (tankCapacityLitres > 0 ? Math.min(effectiveTankCapacity, lastRefillLitres) : effectiveTankCapacity));
            estimatedRemainingLitres = Math.max(0, Math.round(baseline - burnedSinceRefill));
          }
        }

        const fuelPercentage = (hasTelemetryAnchor && effectiveTankCapacity > 0)
          ? Math.min(100, Math.max(0, Math.round((estimatedRemainingLitres / effectiveTankCapacity) * 100)))
          : 0;

        const runwayDays = (hasTelemetryAnchor && benchmarkBurnRate > 0 && estimatedRemainingLitres > 0)
          ? (estimatedRemainingLitres / benchmarkBurnRate)
          : 0;

        let urgency: 'critical' | 'today' | 'tomorrow' | 'soon' | 'safe' | 'unbenchmarked' = 'safe';
        let urgencyLabel = '';
        let urgencyBadgeClass = '';
        let targetRefillDate: string | null = null;
        let targetRefillFormatted = 'No telemetry';
        let daysUntilRefill = 0;

        if (!hasTelemetryAnchor) {
          urgency = 'unbenchmarked';
          urgencyLabel = 'No Logs';
          urgencyBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
          targetRefillFormatted = 'Check Dipstick';
        } else if (runwayDays <= 0) {
          urgency = 'critical';
          urgencyLabel = 'Overdue / Empty';
          urgencyBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800';
          targetRefillFormatted = 'Immediate Refill';
          daysUntilRefill = 0;
          targetRefillDate = new Date().toISOString().split('T')[0];
        } else {
          // 1-Day safety buffer: scheduled when runway reaches 1 day remaining
          daysUntilRefill = Math.max(0, Math.floor(runwayDays - 1.0));
          const target = new Date();
          target.setDate(target.getDate() + daysUntilRefill);
          targetRefillDate = target.toISOString().split('T')[0];
          targetRefillFormatted = formatDisplayDate(targetRefillDate);

          if (daysUntilRefill === 0 || runwayDays <= 1.0) {
            urgency = 'today';
            urgencyLabel = 'Today';
            urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
          } else if (daysUntilRefill === 1) {
            urgency = 'tomorrow';
            urgencyLabel = 'Tomorrow';
            urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
          } else if (daysUntilRefill <= 3) {
            urgency = 'soon';
            urgencyLabel = `In ${daysUntilRefill} days`;
            urgencyBadgeClass = 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
          } else {
            urgency = 'safe';
            urgencyLabel = `In ${daysUntilRefill} days`;
            urgencyBadgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
          }
        }

        const shortName = formatMachineShortName(machineName);

        list.push({
          siteId: site.id,
          siteName: site.name,
          machineId: mId,
          machineName,
          shortName,
          tankCapacityLitres: effectiveTankCapacity,
          benchmarkBurnRate,
          lastRefillDate,
          lastRefillLitres,
          lastDipstickDate,
          lastDipstickLitres,
          estimatedRemainingLitres,
          fuelPercentage,
          isDipstickVerified,
          runwayDays: Number(runwayDays.toFixed(1)),
          daysUntilRefill,
          targetRefillDate,
          targetRefillFormatted,
          urgency,
          urgencyLabel,
          urgencyBadgeClass,
        });
      });
    });

    const urgencyRank: Record<string, number> = {
      critical: 0,
      today: 1,
      tomorrow: 2,
      soon: 3,
      safe: 4,
      unbenchmarked: 5,
    };

    return list.sort((a, b) => {
      const rankDiff = (urgencyRank[a.urgency] ?? 99) - (urgencyRank[b.urgency] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      if (a.daysUntilRefill !== b.daysUntilRefill) return a.daysUntilRefill - b.daysUntilRefill;
      return a.fuelPercentage - b.fuelPercentage;
    });
  }, [activeSites, sitePumpDates, dailyMachineLogs, waybills, assets, maintenanceAssets]);

  const currentSiteRefillForecast = useMemo(() => {
    if (!currentSite) return [];
    return fleetRefillForecast.filter(item => item.siteId === currentSite.id);
  }, [fleetRefillForecast, currentSite]);

  // Counts of immediate refill alerts (Overdue / Today) vs advance warnings (Tomorrow) — single pass O(N)
  const { urgentRefillCount, tomorrowRefillCount } = useMemo(() => {
    const activeList = currentSite ? currentSiteRefillForecast : fleetRefillForecast;
    let urgent = 0;
    let tomorrow = 0;
    for (let i = 0; i < activeList.length; i++) {
      const u = activeList[i].urgency;
      if (u === 'critical' || u === 'today') {
        urgent++;
      } else if (u === 'tomorrow') {
        tomorrow++;
      }
    }
    return { urgentRefillCount: urgent, tomorrowRefillCount: tomorrow };
  }, [currentSite, currentSiteRefillForecast, fleetRefillForecast]);

  const activeForecastList = useMemo(() => {
    return (refillForecastScope === 'current' && currentSite) 
      ? currentSiteRefillForecast 
      : fleetRefillForecast;
  }, [refillForecastScope, currentSite, currentSiteRefillForecast, fleetRefillForecast]);

  // Gated: zero computation while modal is closed
  const activeForecastCounts = useMemo(() => {
    if (!isRefillForecastModalOpen) {
      return { all: 0, dueToday: 0, dueTomorrow: 0, safe: 0 };
    }
    let dueToday = 0;
    let dueTomorrow = 0;
    let safe = 0;
    for (let i = 0; i < activeForecastList.length; i++) {
      const u = activeForecastList[i].urgency;
      if (u === 'critical' || u === 'today') {
        dueToday++;
      } else if (u === 'tomorrow') {
        dueTomorrow++;
      } else if (u === 'soon' || u === 'safe') {
        safe++;
      }
    }
    return {
      all: activeForecastList.length,
      dueToday,
      dueTomorrow,
      safe
    };
  }, [isRefillForecastModalOpen, activeForecastList]);

  const displayedRefillForecast = useMemo(() => {
    if (!isRefillForecastModalOpen) return [];

    return activeForecastList.filter(item => {
      if (refillForecastUrgencyFilter === 'urgent') {
        if (item.urgency !== 'critical' && item.urgency !== 'today') return false;
      } else if (refillForecastUrgencyFilter === 'tomorrow') {
        if (item.urgency !== 'tomorrow') return false;
      } else if (refillForecastUrgencyFilter === 'safe') {
        if (item.urgency !== 'soon' && item.urgency !== 'safe') return false;
      }

      if (deferredRefillForecastSearch.trim()) {
        const query = deferredRefillForecastSearch.toLowerCase().trim();
        const matchesMachine = item.machineName.toLowerCase().includes(query) || item.shortName.toLowerCase().includes(query);
        const matchesSite = item.siteName.toLowerCase().includes(query);
        if (!matchesMachine && !matchesSite) return false;
      }

      return true;
    });
  }, [isRefillForecastModalOpen, activeForecastList, refillForecastUrgencyFilter, deferredRefillForecastSearch]);

  const renderRefillForecastModal = () => {
    if (!isRefillForecastModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Next Refill Date Forecast
                </h3>
              </div>
            </div>
            <button
              onClick={() => setIsRefillForecastModalOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Controls Bar */}
          <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            {/* Scope Switcher */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300/80 dark:border-slate-700 text-xs overflow-x-auto w-full sm:w-auto">
              {currentSite && (
                <button
                  type="button"
                  onClick={() => setRefillForecastScope('current')}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0",
                    refillForecastScope === 'current'
                      ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span>Current Site: {currentSite.name}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    refillForecastScope === 'current'
                      ? "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    {currentSiteRefillForecast.length}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setRefillForecastScope('fleet')}
                className={cn(
                  "px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0",
                  refillForecastScope === 'fleet' || !currentSite
                    ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <span>All Active Sites</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  refillForecastScope === 'fleet' || !currentSite
                    ? "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}>
                  {fleetRefillForecast.length}
                </span>
              </button>
            </div>

            {/* Filters: Search and Urgency Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search machine or site..."
                  value={refillForecastSearch}
                  onChange={e => setRefillForecastSearch(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 w-44 sm:w-56"
                />
                {refillForecastSearch && (
                  <button
                    onClick={() => setRefillForecastSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Urgency Filter Pills with Count Badges */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setRefillForecastUrgencyFilter('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                    refillForecastUrgencyFilter === 'all'
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  <span>All</span>
                  <span className="text-[10px] opacity-70">({activeForecastCounts.all})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefillForecastUrgencyFilter('urgent')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                    refillForecastUrgencyFilter === 'urgent'
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-rose-600 dark:text-rose-400 hover:text-rose-700"
                  )}
                >
                  <span>🚨 Today / Overdue</span>
                  <span className={cn(
                    "text-[10px] px-1 rounded-full font-bold",
                    refillForecastUrgencyFilter === 'urgent'
                      ? "bg-white/20 text-white"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  )}>
                    {activeForecastCounts.dueToday}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefillForecastUrgencyFilter('tomorrow')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                    refillForecastUrgencyFilter === 'tomorrow'
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-amber-600 dark:text-amber-400 hover:text-amber-700"
                  )}
                >
                  <span>⚠️ Tomorrow</span>
                  <span className={cn(
                    "text-[10px] px-1 rounded-full font-bold",
                    refillForecastUrgencyFilter === 'tomorrow'
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  )}>
                    {activeForecastCounts.dueTomorrow}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefillForecastUrgencyFilter('safe')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                    refillForecastUrgencyFilter === 'safe'
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  <span>Safe</span>
                  <span className="text-[10px] opacity-70">({activeForecastCounts.safe})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Forecast Table List */}
          <div className="overflow-y-auto flex-1 p-3 sm:p-5">
            {displayedRefillForecast.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Fuel className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  No machine refill forecasts found matching this filter.
                </p>
                {(refillForecastSearch || refillForecastUrgencyFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRefillForecastSearch('');
                      setRefillForecastUrgencyFilter('all');
                    }}
                    className="text-xs h-7 mt-1 font-semibold text-cyan-600"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto bg-white dark:bg-slate-900 shadow-xs">
                <Table className="min-w-[760px] w-full">
                  <TableHeader className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
                    <TableRow className="bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900">
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Site</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Machine / Unit</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Fuel Level & Remaining</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Rated Burn</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Last Refill Date</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 bg-slate-100 dark:bg-slate-900">Estimated Next Refill</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 text-right bg-slate-100 dark:bg-slate-900">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {displayedRefillForecast.map(item => {
                      const isCurrentSelectedSite = currentSite?.id === item.siteId;
                      return (
                        <TableRow 
                          key={`${item.siteId}-${item.machineId}`}
                          className={cn(
                            "transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40",
                            item.urgency === 'critical' || item.urgency === 'today' ? "bg-rose-50/25 dark:bg-rose-950/15" : ""
                          )}
                        >
                          {/* Site Column */}
                          <TableCell className="py-3 font-semibold text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                              <span className="truncate max-w-[160px] sm:max-w-[200px]" title={item.siteName}>
                                {item.siteName}
                              </span>
                            </div>
                          </TableCell>

                          {/* Machine Column */}
                          <TableCell className="py-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span>{item.shortName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={item.machineName}>
                              {item.machineName}
                            </div>
                          </TableCell>

                          {/* Fuel Level & Gauge Column */}
                          <TableCell className="py-3 min-w-[180px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {item.estimatedRemainingLitres}L <span className="text-slate-400 font-normal">/ {item.tankCapacityLitres}L</span>
                                </span>
                                <span className={cn(
                                  "font-bold text-[10px]",
                                  item.fuelPercentage <= 15 
                                    ? "text-rose-600 dark:text-rose-400" 
                                    : item.fuelPercentage <= 35 
                                    ? "text-amber-600 dark:text-amber-400" 
                                    : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {item.fuelPercentage}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    item.fuelPercentage <= 15 
                                      ? "bg-rose-500" 
                                      : item.fuelPercentage <= 35 
                                      ? "bg-amber-500" 
                                      : "bg-emerald-500"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(3, item.fuelPercentage))}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>
                                  {item.isDipstickVerified ? '✓ Dipstick verified' : (item.lastRefillDate ? 'Refill calculated' : 'No anchor')}
                                </span>
                                <span>Runway: {item.runwayDays}d</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Benchmark Rate Column */}
                          <TableCell className="py-3 text-slate-700 dark:text-slate-300">
                            <div className="font-semibold">{item.benchmarkBurnRate} L/day</div>
                            <div className="text-[10px] text-slate-400">Rated Benchmark</div>
                          </TableCell>

                          {/* Last Refill Date Column */}
                          <TableCell className="py-3">
                            {item.lastRefillDate ? (
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                  {formatLastRefilledDate(item.lastRefillDate)}
                                </div>
                                {item.lastRefillLitres > 0 && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {item.lastRefillLitres}L refilled
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No refill recorded</span>
                            )}
                          </TableCell>

                          {/* Estimated Next Refill Date Column */}
                          <TableCell className="py-3">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {item.targetRefillFormatted}
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 leading-tight",
                                item.urgencyBadgeClass
                              )}>
                                {item.urgencyLabel}
                              </span>
                              {item.daysUntilRefill > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  (-1d safety buffer)
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Action Column */}
                          <TableCell className="py-3 text-right">
                            {isCurrentSelectedSite ? (
                              <span className="inline-block text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-1 rounded-md border border-cyan-200 dark:border-cyan-800">
                                Current Site
                              </span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSiteId(item.siteId);
                                  setIsRefillForecastModalOpen(false);
                                }}
                                className="h-7 text-xs px-2.5 font-semibold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 transition-all"
                                title={`Switch view to ${item.siteName}`}
                              >
                                <span>View Site</span>
                                <ArrowRight className="w-3 h-3 ml-1 text-slate-400" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefillForecastModalOpen(false)}
              className="h-8 text-xs font-semibold px-4 rounded-lg"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const headerActionsNode = useMemo(() => (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Machine Filter Dropdown: Only when viewing single site */}
      {selectedSiteId !== 'all' && (
        <div className="flex items-center gap-1.5">
          <select
            value={selectedMachineId}
            onChange={e => {
              setSelectedMachineId(e.target.value);
              setVarianceMachineFilter([]);
            }}
            className={cn(
              "h-8 px-2 text-xs font-semibold rounded-lg focus:ring-2 focus:ring-cyan-500 cursor-pointer max-w-[170px] sm:max-w-[270px] truncate transition-colors border",
              selectedMachineId === 'active_only'
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 shadow-xs"
                : selectedMachineId === 'offsite_only'
                ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 shadow-xs"
                : selectedMachineId !== 'all'
                ? "bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-700 shadow-xs"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            )}
            title="Filter by machine or fleet status"
          >
            <option value="all">All Machines ({siteMachines.length})</option>
            {activeSiteMachines.length > 0 && (
              <option value="active_only">
                🟢 Currently Active on Site ({activeSiteMachines.length})
              </option>
            )}
            {takenOutSiteMachines.length > 0 && (
              <option value="offsite_only">
                ⚪ Taken Out / Replaced ({takenOutSiteMachines.length})
              </option>
            )}
            {activeSiteMachines.length > 0 && (
              <optgroup label="── Active Units ──">
                {activeSiteMachines.map(m => (
                  <option key={m.id} value={m.id}>
                    🟢 {m.name} {m.startDate ? `(Since ${formatDisplayDate(m.startDate)})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {takenOutSiteMachines.length > 0 && (
              <optgroup label="── Offsite / Replaced Units ──">
                {takenOutSiteMachines.map(m => (
                  <option key={m.id} value={m.id}>
                    ⚪ {m.name} {m.stopDate ? `(Ended ${formatDisplayDate(m.stopDate)})` : m.isReplaced ? '(Replaced)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {selectedMachineId !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setSelectedMachineId('all');
                setVarianceMachineFilter([]);
              }}
              className="h-8 px-2 text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1 shrink-0"
              title="Reset machine filter to All Machines"
            >
              <span>Reset</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}


      {/* Time Range Filter Pills */}
      <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
        {(['all', 'year', '90d', '30d'] as const).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={cn(
              'px-2 py-1 rounded-md text-[11px] font-semibold transition-all',
              timeRange === range
                ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {range === 'all' ? 'All Time' : range === 'year' ? selectedYear : range === '90d' ? '90d' : '30d'}
          </button>
        ))}
      </div>

      {/* Refill Forecast Notification Bell */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          setRefillForecastScope(isPortfolioMode ? 'fleet' : 'current');
          setIsRefillForecastModalOpen(true);
        }}
        className={cn(
          "relative h-8 px-2 sm:px-2.5 gap-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0",
          urgentRefillCount > 0
            ? "border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100/80 shadow-xs"
            : tomorrowRefillCount > 0
            ? "border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 shadow-xs"
            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        )}
        title={
          urgentRefillCount > 0 || tomorrowRefillCount > 0
            ? `${urgentRefillCount > 0 ? `${urgentRefillCount} refill alert (due today/overdue)` : ''}${urgentRefillCount > 0 && tomorrowRefillCount > 0 ? ', ' : ''}${tomorrowRefillCount > 0 ? `${tomorrowRefillCount} due tomorrow` : ''}`
            : "View Estimated Next Refill Dates (1-Day Safety Buffer)"
        }
      >
        <Bell className={cn(
          "w-3.5 h-3.5 shrink-0", 
          urgentRefillCount > 0 
            ? "text-rose-600 dark:text-rose-400 animate-bounce" 
            : tomorrowRefillCount > 0
            ? "text-amber-500 dark:text-amber-400"
            : "text-slate-400 dark:text-slate-500"
        )} />
        <span className="hidden md:inline">Refill Forecast</span>
        {urgentRefillCount > 0 ? (
          <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs leading-none">
            {urgentRefillCount}
          </span>
        ) : tomorrowRefillCount > 0 ? (
          <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs leading-none">
            {tomorrowRefillCount}
          </span>
        ) : null}
      </Button>

      {/* Site 360 */}
      {selectedSiteId !== 'all' && currentSite && (
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 px-2.5 gap-1.5 text-xs font-semibold rounded-lg text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
          onClick={() => navigate(`/client-360?siteId=${currentSite.id}`)}
          title="Open Site 360"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
          <span className="hidden xl:inline">Site 360</span>
        </Button>
      )}
    </div>
  ), [selectedSiteId, selectedMachineId, siteMachines, activeSiteMachines, takenOutSiteMachines, timeRange, selectedYear, currentSite, navigate, handleExportCSV, showHistoricalSites, historicalSites, portfolioTab, isPortfolioMode, urgentRefillCount, tomorrowRefillCount]);

  useSetPageTitle(
    activeRegisterMachine ? null : headerTitleNode,
    null,
    activeRegisterMachine ? null : headerActionsNode,
    [selectedSiteId, currentSite?.name, selectedMachineId, timeRange, selectedYear, isCurrentlyOnHold, activeSites.length, siteMachines.length, activeRegisterMachine]
  );


  // ── Chart 1B: Refill Interval Cycles & Variance (Diff) Engine ──
  const refillIntervalCycles = useMemo(() => {
    if (!currentSite) return [];

    const targetMachines = scopedFilterMachines.filter(m => {
      if (varianceMachineFilter.length > 0 && !varianceMachineFilter.includes(m.id)) return false;
      return true;
    });

    const cycles: Array<{
      id: string;
      machineId: string;
      machineName: string;
      machineShortName: string;
      refillDate: string;
      previousRefillDate: string;
      dateFormatted: string;
      intervalLabel: string;
      calendarDays: number;
      activeDays: number;
      offDays: number;
      refilledLitres: number;
      dipstickLitres: number | null;
      previousDipstickLitres: number | null;
      isDipstickVerified: boolean;
      actualBurn: number;
      dailyAvgBurn: number;
      benchmarkRate: number;
      expectedBurn: number;
      diffLitres: number;
      status: 'optimal' | 'mild_overburn' | 'high_overburn' | 'initial_fill';
      efficiencyPct: number;
    }> = [];

    targetMachines.forEach(machine => {
      const rawAsset = (assets || []).find(a => 
        a.id === machine.id || a.name.toLowerCase().trim() === machine.name.toLowerCase().trim()
      );
      const benchmarkRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;
      const tankCapacity = Number(rawAsset?.tankCapacityLitres) || 0;

      const mLogs = (siteLogs || [])
        .filter(l => l.assetId === machine.id)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (!mLogs.length) return;

      const refillEvents: Array<{
        logIndex: number;
        log: typeof mLogs[0];
        date: string;
        refilled: number;
        dipstick: number | null;
        isFull: boolean;
      }> = [];

      mLogs.forEach((l, idx) => {
        const refilled = Number(l.dieselUsage) || 0;
        const dipstick = l.dipstickLevelLitres != null && Number(l.dipstickLevelLitres) > 0 
          ? Number(l.dipstickLevelLitres) 
          : (l.isTankFilledToFull && tankCapacity > 0 ? tankCapacity : null);
        
        if (refilled > 0) {
          refillEvents.push({
            logIndex: idx,
            log: l,
            date: l.date,
            refilled,
            dipstick,
            isFull: !!l.isTankFilledToFull
          });
        }
      });

      for (let i = 0; i < refillEvents.length; i++) {
        const currentRefill = refillEvents[i];
        const prevRefill = i > 0 ? refillEvents[i - 1] : null;

        const prevDate = prevRefill ? prevRefill.date : (machine.startDate || mLogs[0]?.date || currentRefill.date);
        
        const intervalLogs = mLogs.filter(l => {
          if (prevRefill) {
            return l.date > prevDate && l.date <= currentRefill.date;
          }
          return l.date <= currentRefill.date;
        });

        let activeDays = 0;
        let offDays = 0;

        if (intervalLogs.length > 0) {
          intervalLogs.forEach(l => {
            const op = l.operationalDay ?? (l.isActive ? 'full' : 'none');
            if (op === 'full') activeDays += 1.0;
            else if (op === 'half') activeDays += 0.5;
            else offDays += 1.0;
          });
        } else {
          const dStart = new Date(prevDate);
          const dEnd = new Date(currentRefill.date);
          const calDiff = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)));
          activeDays = calDiff;
        }

        const effectiveActiveDays = Math.max(0.5, activeDays);
        const dStart = new Date(prevDate);
        const dEnd = new Date(currentRefill.date);
        const calendarDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)));

        let actualBurn = currentRefill.refilled;
        let isDipstickVerified = false;

        if (prevRefill && prevRefill.dipstick != null && currentRefill.dipstick != null) {
          const calculatedDelta = prevRefill.dipstick + currentRefill.refilled - currentRefill.dipstick;
          actualBurn = Math.max(0, calculatedDelta);
          isDipstickVerified = true;
        }

        const dailyAvgBurn = Number((actualBurn / effectiveActiveDays).toFixed(1));
        const expectedBurn = Number((effectiveActiveDays * benchmarkRate).toFixed(1));
        const diffLitres = Number((actualBurn - expectedBurn).toFixed(1));

        let status: 'optimal' | 'mild_overburn' | 'high_overburn' | 'initial_fill' = 'optimal';
        if (!prevRefill) {
          status = 'initial_fill';
        } else if (diffLitres > expectedBurn * 0.15) {
          status = 'high_overburn';
        } else if (diffLitres > 0) {
          status = 'mild_overburn';
        } else {
          status = 'optimal';
        }

        const efficiencyPct = expectedBurn > 0 
          ? Math.round((actualBurn / expectedBurn) * 100)
          : 100;

        const intervalLabel = prevRefill 
          ? `${formatDisplayDate(prevDate)} → ${formatDisplayDate(currentRefill.date)}` 
          : `Initial Tank Baseline (${formatDisplayDate(currentRefill.date)})`;

        cycles.push({
          id: `${machine.id}-${currentRefill.date}-${i}`,
          machineId: machine.id,
          machineName: machine.name,
          machineShortName: formatMachineShortName(machine.name),
          refillDate: currentRefill.date,
          previousRefillDate: prevDate,
          dateFormatted: formatDisplayDate(currentRefill.date),
          intervalLabel,
          calendarDays,
          activeDays: Number(activeDays.toFixed(1)),
          offDays: Number(offDays.toFixed(1)),
          refilledLitres: currentRefill.refilled,
          dipstickLitres: currentRefill.dipstick,
          previousDipstickLitres: prevRefill?.dipstick ?? null,
          isDipstickVerified,
          actualBurn: Number(actualBurn.toFixed(1)),
          dailyAvgBurn,
          benchmarkRate,
          expectedBurn,
          diffLitres,
          status,
          efficiencyPct
        });
      }
    });

    return cycles.sort((a, b) => a.refillDate.localeCompare(b.refillDate));
  }, [currentSite, scopedFilterMachines, siteLogs, varianceMachineFilter, assets]);

  // Filtered refill cycles based on date range
  const filteredRefillCycles = useMemo(() => {
    if (!refillIntervalCycles.length) return [];
    const now = new Date();
    return refillIntervalCycles.filter(cycle => {
      const d = new Date(cycle.refillDate);
      if (timeRange === '30d') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 30);
        if (d < cutoff) return false;
      } else if (timeRange === '90d') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 90);
        if (d < cutoff) return false;
      } else if (timeRange === 'year') {
        if (d.getFullYear().toString() !== selectedYear) return false;
      }
      return true;
    });
  }, [refillIntervalCycles, timeRange, selectedYear]);

  // Summary rollups for refill intervals
  const refillCyclesSummary = useMemo(() => {
    if (!filteredRefillCycles.length) {
      return {
        totalCycles: 0,
        totalRefilled: 0,
        totalActualBurn: 0,
        totalExpectedBurn: 0,
        netDiff: 0,
        avgDailyUsage: 0,
        avgActiveIntervalDays: 0,
        dipstickVerifiedCount: 0
      };
    }

    const totalCycles = filteredRefillCycles.length;
    const totalRefilled = filteredRefillCycles.reduce((s, c) => s + c.refilledLitres, 0);
    const totalActualBurn = filteredRefillCycles.reduce((s, c) => s + c.actualBurn, 0);
    const totalExpectedBurn = filteredRefillCycles.reduce((s, c) => s + c.expectedBurn, 0);
    const totalActiveDays = filteredRefillCycles.reduce((s, c) => s + c.activeDays, 0);
    const netDiff = Number((totalActualBurn - totalExpectedBurn).toFixed(1));
    const avgDailyUsage = totalActiveDays > 0 ? Number((totalActualBurn / totalActiveDays).toFixed(1)) : 0;
    const avgActiveIntervalDays = Number((totalActiveDays / totalCycles).toFixed(1));
    const dipstickVerifiedCount = filteredRefillCycles.filter(c => c.isDipstickVerified).length;

    return {
      totalCycles,
      totalRefilled: Number(totalRefilled.toFixed(1)),
      totalActualBurn: Number(totalActualBurn.toFixed(1)),
      totalExpectedBurn: Number(totalExpectedBurn.toFixed(1)),
      netDiff,
      avgDailyUsage,
      avgActiveIntervalDays,
      dipstickVerifiedCount
    };
  }, [filteredRefillCycles]);

  // ── Chart 2: Machine Operational Days Stacked Comparison ──
  const machineDaysChartData = useMemo(() => {
    let list = machineFleetStats;
    if (fleetChartFilter === 'active') {
      list = list.filter(m => m.isCurrentlyActive);
    } else if (fleetChartFilter === 'offsite') {
      list = list.filter(m => !m.isCurrentlyActive);
    }

    return list.map(m => ({
      name: m.shortName,
      chartLabel: m.chartLabel,
      fullName: m.name,
      fullDays: m.fullDays,
      halfDays: m.halfDays,
      offDays: m.offDays,
      utilization: m.utilization,
      totalDays: m.calendarDaysOnSite,
      isCurrentlyActive: m.isCurrentlyActive,
      status: m.status,
      statusLabel: m.statusLabel,
      startDate: m.startDate,
      stopDate: m.stopDate,
      successorName: m.successorName,
      predecessorName: m.predecessorName,
      swapReason: m.swapReason,
    }));
  }, [machineFleetStats, fleetChartFilter]);

  // ── Chart 3: Downtime & Lost Hours by Machine ──
  const machineDowntimeChartData = useMemo(() => {
    return machineFleetStats
      .filter(m => m.downtimeCount > 0 || m.downtimeHours > 0)
      .map(m => ({
        name: m.shortName,
        chartLabel: m.chartLabel,
        fullName: m.name,
        incidents: m.downtimeCount,
        lostHours: Number(m.downtimeHours.toFixed(1)),
        isCurrentlyActive: m.isCurrentlyActive,
        status: m.status,
        statusLabel: m.statusLabel,
        startDate: m.startDate,
        stopDate: m.stopDate,
        successorName: m.successorName,
        predecessorName: m.predecessorName,
        swapReason: m.swapReason,
      }));
  }, [machineFleetStats]);

  // ── Chart 4: Operational Day Status Donut ──
  const operationalStatusDonutData = useMemo(() => {
    const total = siteAggregates.fullDays + siteAggregates.halfDays + siteAggregates.offDays;
    if (total === 0) return [];
    return [
      { name: 'Full Active Days', value: siteAggregates.fullDays, color: CHART_COLORS.emerald },
      { name: 'Half Running Days', value: siteAggregates.halfDays, color: CHART_COLORS.amber },
      { name: 'Standby / Idle Days', value: siteAggregates.offDays, color: CHART_COLORS.slate },
    ].filter(d => d.value > 0);
  }, [siteAggregates]);

  // ── Chart 5: Downtime Severity Donut ──
  const downtimeSeverityDonutData = useMemo(() => {
    const total = siteAggregates.totalDowntimes;
    if (total === 0) return [];
    return [
      { name: 'Low Impact', value: siteAggregates.severityCounts.low || 0, color: SEVERITY_COLORS.low },
      { name: 'Medium Impact', value: siteAggregates.severityCounts.medium || 0, color: SEVERITY_COLORS.medium },
      { name: 'Critical / High', value: siteAggregates.severityCounts.high || 0, color: SEVERITY_COLORS.high },
    ].filter(d => d.value > 0);
  }, [siteAggregates]);

  const displayedHistoricalSites = useMemo(() => {
    return filteredHistoricalSites.slice(0, archiveVisibleCount);
  }, [filteredHistoricalSites, archiveVisibleCount]);

  // Sub-view: embedded DailyLogManager
  if (activeRegisterMachine && currentSite) {
    return (
      <div className="space-y-4">
        <DailyLogManager
          assetId={activeRegisterMachine.id}
          assetName={activeRegisterMachine.name}
          siteId={currentSite.id}
          siteName={currentSite.name}
          onBack={() => setActiveRegisterMachine(null)}
        />
      </div>
    );
  }

  // ── RENDER: Option A Portfolio Overview (All Active Sites & Historical Archive) ──
  if (isPortfolioMode || !currentSite) {
    const isShowingArchiveOnly = portfolioTab === 'archive';
    const isShowingBoth = portfolioTab === 'both';
    const isShowingActive = portfolioTab === 'active' || isShowingBoth;
    const isShowingArchive = portfolioTab === 'archive' || isShowingBoth || (showHistoricalSites && portfolioTab !== 'active');

    return (
      <div className="space-y-6 pb-12 max-w-7xl mx-auto px-2 sm:px-4">
        {/* Portfolio KPI Strip: 6 Cards (Adapts to Active vs Archive View) */}
        {isShowingArchiveOnly ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Archived Sites */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Archived Sites</span>
                  <Archive className="w-4 h-4 text-slate-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {historicalTotals.totalSites}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Ended & completed
                </p>
              </CardContent>
            </Card>

            {/* 2. Total Logged Units */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Units</span>
                  <HardHat className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {historicalTotals.totalMachines}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Machines logged on sites
                </p>
              </CardContent>
            </Card>

            {/* 3. Total Diesel Refilled */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Diesel</span>
                  <Fuel className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  {historicalTotals.totalDiesel} <span className="text-xs font-normal">L</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Historical fuel volume
                </p>
                {historicalTotals.latestRefillFormatted && (
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mt-1 truncate" title={`Latest refill: ${historicalTotals.latestRefillFormatted}`}>
                    Last: {historicalTotals.latestRefillFormatted}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 4. Total Operating Days */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Operating Days</span>
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {historicalTotals.totalDays} <span className="text-xs font-normal">Days</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Avg: {historicalTotals.avgDaily} L/d
                </p>
              </CardContent>
            </Card>

            {/* 5. Net Variance */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Net Variance</span>
                  <Activity className="w-4 h-4 text-cyan-500" />
                </div>
                <div className={cn(
                  "mt-2 text-2xl font-extrabold",
                  historicalTotals.totalVariance > 0 
                    ? "text-rose-600 dark:text-rose-400" 
                    : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {historicalTotals.totalVariance > 0 ? `+${historicalTotals.totalVariance}` : historicalTotals.totalVariance} <span className="text-xs font-normal">L</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {historicalTotals.totalVariance > 0 ? 'Portfolio overburn' : 'Fuel saved under target'}
                </p>
              </CardContent>
            </Card>

            {/* 6. Total Audit Logs */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Audit Logs</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {historicalTotals.totalLogs}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Historical shift logs
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Active Sites */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Active Sites</span>
                  <Globe className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {allActiveSitesPortfolio.totals.activeSitesCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Active & operational
                </p>
              </CardContent>
            </Card>

            {/* 2. Deployed Active Pumps */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Fleet Pumps</span>
                  <Clock className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {allActiveSitesPortfolio.totals.totalActivePumps}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Active on dewatering duty
                </p>
              </CardContent>
            </Card>

            {/* 3. Total Diesel Refilled */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Inflow</span>
                  <Fuel className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  {allActiveSitesPortfolio.totals.totalDieselRefilled} <span className="text-xs font-normal">L</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Refilled across fleet
                </p>
                {allActiveSitesPortfolio.totals.latestFleetRefillFormatted && (
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mt-1 truncate" title={`Latest refill: ${allActiveSitesPortfolio.totals.latestFleetRefillFormatted}`}>
                    Last: {allActiveSitesPortfolio.totals.latestFleetRefillFormatted}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 4. Fleet Daily Avg Burn */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Daily Avg Burn</span>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {allActiveSitesPortfolio.totals.fleetDailyAvg} <span className="text-xs font-normal">L/d</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Target: 18.0 L/day
                </p>
              </CardContent>
            </Card>

            {/* 5. Net Portfolio Variance */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Net Variance</span>
                  <Activity className="w-4 h-4 text-cyan-500" />
                </div>
                <div className={cn(
                  "mt-2 text-2xl font-extrabold",
                  allActiveSitesPortfolio.totals.netVarianceLitres > 0 
                    ? "text-rose-600 dark:text-rose-400" 
                    : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {allActiveSitesPortfolio.totals.netVarianceLitres > 0 ? `+${allActiveSitesPortfolio.totals.netVarianceLitres}` : allActiveSitesPortfolio.totals.netVarianceLitres} <span className="text-xs font-normal">L</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {allActiveSitesPortfolio.totals.netVarianceLitres > 0 ? 'Fleet overburn' : 'Fuel saved under target'}
                </p>
              </CardContent>
            </Card>

            {/* 6. Downtimes & Lost Hours */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Downtimes</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {allActiveSitesPortfolio.totals.totalDowntimeCount}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {allActiveSitesPortfolio.totals.totalLostHours} lost hours recorded
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Portfolio View Selector Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                setPortfolioTab('active');
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                portfolioTab === 'active'
                  ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              <span>Active Sites</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-bold">
                {allActiveSitesPortfolio.siteMetricsList.length}
              </span>
            </button>

            <button
              onClick={() => {
                setShowHistoricalSites(true);
                setPortfolioTab('archive');
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                portfolioTab === 'archive'
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              <span>Historical Archive</span>
              {historicalSites.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  {historicalSites.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setShowHistoricalSites(true);
                setPortfolioTab('both');
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                portfolioTab === 'both'
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <span>All Combined</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                {allActiveSitesPortfolio.siteMetricsList.length + historicalSites.length}
              </span>
            </button>
          </div>
        </div>

        {/* SECTION: Active Sites Matrix & Comparative Charts (Rendered when viewing Active or Both) */}
        {isShowingActive && (
          <div className="space-y-6">
            {/* Active Sites Comparative Matrix Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-600" />
                    Active Sites Comparative Matrix ({allActiveSitesPortfolio.siteMetricsList.length} Sites)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Side-by-side operational status, running pump count, fuel burn rates, and direct drilldown
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {allActiveSitesPortfolio.siteMetricsList.map(site => (
                  <Card 
                    key={site.id} 
                    className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {site.name}
                            </h3>
                            {site.isOnHold && (
                              <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                On Hold
                              </Badge>
                            )}
                          </div>
                          {site.client && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              Client: <span className="font-medium text-slate-700 dark:text-slate-300">{site.client}</span>
                            </p>
                          )}
                        </div>

                        <Badge variant="outline" className="text-[10px] shrink-0 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                          {site.stage}
                        </Badge>
                      </div>

                      {/* Metrics 4-Box Grid */}
                      <div className="p-5 grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Deployed Pumps</span>
                          <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                            {site.activePumpsCount} Active
                          </span>
                          <span className="text-[10px] text-slate-400">{site.totalMachinesCount} total on record</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Diesel Refilled</span>
                            <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 block mt-0.5">
                              {site.totalDiesel} L
                            </span>
                            <span className="text-[10px] text-slate-400 block">Target: {site.expectedDiesel} L</span>
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1 truncate" title={`Last refill: ${site.lastRefilledFormatted || 'No refill recorded'}`}>
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{site.lastRefilledFormatted || 'No refill'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Avg Burn</span>
                          <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                            {site.dailyAvgBurn} L/d
                          </span>
                          <span className="text-[10px] text-slate-400 block">{site.activeDays} operating days</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Pump Active Duration</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                              {site.earliestPumpDays != null ? `${site.earliestPumpDays} Days` : '—'}
                            </span>
                            {site.earliestPumpDays != null && (
                              <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                                to date
                              </span>
                            )}
                          </div>
                          <span 
                            className="text-[10px] text-slate-400 block truncate"
                            title={site.earliestPumpStartDateFormatted ? `Earliest pump start date: ${site.earliestPumpStartDateFormatted}` : 'No pump logs on record'}
                          >
                            {site.earliestPumpStartDateFormatted ? `Since ${site.earliestPumpStartDateFormatted}` : 'No logs recorded'}
                          </span>
                        </div>
                      </div>

                      {/* Downtime Alert Strip if any */}
                      {site.downtimeCount > 0 && (
                        <div className="px-5 pb-3">
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] border border-rose-200/60 dark:border-rose-800/60">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{site.downtimeCount} downtime incidents ({site.lostHours}h lost)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Action Footer */}
                    <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-2xl mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {site.logCount} daily log entries
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSiteId(site.id);
                          setSearchParams({ siteId: site.id });
                        }}
                        className="h-8 px-3 text-xs font-bold rounded-xl text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                      >
                        Inspect Site Analytics
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Cross-Site Comparative Visualizations (Charts 1 & 2 in 2-column grid) */}
            {!chartsReady ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[0, 1].map(i => (
                  <div key={i} className="h-80 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-pulse" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Diesel Telemetry by Site */}
              <Card 
                style={fullScreenChart === 'portfolio-diesel' ? undefined : { contentVisibility: 'auto', containIntrinsicSize: '0 380px' }}
                className={cn(
                "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden transition-all",
                fullScreenChart === 'portfolio-diesel' && "fixed inset-0 z-[120] m-0 rounded-none border-none w-screen h-screen flex flex-col p-4 sm:p-6 overflow-auto bg-white dark:bg-slate-900"
              )}>
                {fullScreenChart === 'portfolio-diesel' && (
                  <Button
                    variant="default"
                    size="icon"
                    className="fixed top-4 right-4 z-[130] rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 w-11 h-11"
                    onClick={() => toggleFullScreenChart('portfolio-diesel')}
                    title="Exit Full Screen"
                  >
                    <Minimize2 className="h-5 w-5" />
                  </Button>
                )}
                <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-amber-500" />
                    Cross-Site Diesel Refilled vs. Expected Burn (Litres)
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    onClick={() => toggleFullScreenChart('portfolio-diesel')}
                    title="Full Screen"
                    aria-label="Full Screen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className={cn("p-5 pt-6", fullScreenChart === 'portfolio-diesel' && "flex-1 flex flex-col min-h-0")}>
                  {allActiveSitesPortfolio.comparativeChartData.length > 0 ? (
                    <div className={cn("w-full min-w-0", fullScreenChart === 'portfolio-diesel' ? "flex-1 min-h-[500px]" : "h-72")}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={allActiveSitesPortfolio.comparativeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke={isDark ? '#94a3b8' : '#64748b'} 
                            fontSize={11}
                            tickLine={false}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis 
                            stroke={isDark ? '#94a3b8' : '#64748b'} 
                            fontSize={11}
                            tickLine={false}
                            tickFormatter={v => `${v}L`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                              borderColor: isDark ? '#334155' : '#e2e8f0',
                              borderRadius: '0.75rem',
                              fontSize: '12px',
                              color: isDark ? '#ffffff' : '#0f172a'
                            }}
                            formatter={(val: any, name: string) => [
                              `${val} Litres`,
                              name === 'dieselRefilled' ? 'Diesel Refilled' : 'Expected Burn'
                            ]}
                          />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="dieselRefilled" name="Diesel Refilled (L)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={35} isAnimationActive={false} />
                          <Bar dataKey="expectedDiesel" name="Expected Burn (L)" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={35} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                      No site telemetry recorded yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart 2: Deployed Pumps & Operating Days by Site */}
              <Card 
                style={fullScreenChart === 'portfolio-pumps' ? undefined : { contentVisibility: 'auto', containIntrinsicSize: '0 380px' }}
                className={cn(
                "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden transition-all",
                fullScreenChart === 'portfolio-pumps' && "fixed inset-0 z-[120] m-0 rounded-none border-none w-screen h-screen flex flex-col p-4 sm:p-6 overflow-auto bg-white dark:bg-slate-900"
              )}>
                {fullScreenChart === 'portfolio-pumps' && (
                  <Button
                    variant="default"
                    size="icon"
                    className="fixed top-4 right-4 z-[130] rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 w-11 h-11"
                    onClick={() => toggleFullScreenChart('portfolio-pumps')}
                    title="Exit Full Screen"
                  >
                    <Minimize2 className="h-5 w-5" />
                  </Button>
                )}
                <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    Active Pumps & Operational Days by Site
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    onClick={() => toggleFullScreenChart('portfolio-pumps')}
                    title="Full Screen"
                    aria-label="Full Screen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className={cn("p-5 pt-6", fullScreenChart === 'portfolio-pumps' && "flex-1 flex flex-col min-h-0")}>
                  {allActiveSitesPortfolio.comparativeChartData.length > 0 ? (
                    <div className={cn("w-full min-w-0", fullScreenChart === 'portfolio-pumps' ? "flex-1 min-h-[500px]" : "h-72")}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={allActiveSitesPortfolio.comparativeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke={isDark ? '#94a3b8' : '#64748b'} 
                            fontSize={11}
                            tickLine={false}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis 
                            stroke={isDark ? '#94a3b8' : '#64748b'} 
                            fontSize={11}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                              borderColor: isDark ? '#334155' : '#e2e8f0',
                              borderRadius: '0.75rem',
                              fontSize: '12px',
                              color: isDark ? '#ffffff' : '#0f172a'
                            }}
                          />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="activePumps" name="Active Pumps Count" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} isAnimationActive={false} />
                          <Bar dataKey="activeDays" name="Active Operating Days" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={35} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                      No site deployment data recorded yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            )} {/* end chartsReady ternary */}

            {/* Active Sites Performance & Telemetry Summary Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <List className="w-4 h-4 text-cyan-600" />
                    Active Sites Performance & Telemetry Summary
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                      {allActiveSitesPortfolio.siteMetricsList.length} Sites
                    </span>
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-xs">
                <Table className="min-w-[760px] w-full">
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60">
                    <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs py-3">Site & Client</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs py-3">Status & Stage</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right py-3">Equipment & Days</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right py-3">Total Diesel</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right py-3">Daily Avg Burn</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right py-3">Variance</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs py-3">Last Refilled</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-center py-3">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allActiveSitesPortfolio.siteMetricsList.map(site => (
                      <TableRow 
                        key={site.id} 
                        className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <TableCell className="py-3 font-medium">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {site.name}
                          </div>
                          {site.client && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                              Client: {site.client}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold uppercase",
                              site.isOnHold 
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                            )}>
                              {site.isOnHold ? 'On Hold' : 'Active'}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {site.stage}
                              {site.startDate && ` • Started ${formatDisplayDate(site.startDate)}`}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                            {site.totalMachinesCount} Units
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {site.activeDays} operating days
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 block">
                            {site.totalDiesel} L
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Target: {site.expectedDiesel} L
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                            {site.dailyAvgBurn} L/d
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {site.logCount} logs
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className={cn(
                            "font-bold text-xs block",
                            site.varianceLitres > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {site.varianceLitres > 0 ? `+${site.varianceLitres}` : site.varianceLitres} L
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {site.varianceLitres > 0 ? 'Over target' : 'Fuel saved'}
                          </span>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate max-w-[160px]" title={site.lastRefilledFormatted || 'No refill recorded'}>
                              {site.lastRefilledFormatted || 'No refill'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSiteId(site.id);
                              setSearchParams({ siteId: site.id });
                            }}
                            className="h-7 px-2.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-lg"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: Historical & Ended Sites Archive (Full Width, Searchable, Table & Card Views) */}
        {isShowingArchive && (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5">
            {/* Archive Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Historical & Ended Sites Archive
                    <Badge variant="outline" className="text-xs px-2 py-0.5 font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                      {historicalSiteMetrics.length} Sites Total
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Completed and inactive dewatering sites archived for audit, review, and historical telemetry comparison
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowHistoricalSites(false);
                  setPortfolioTab('active');
                }}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Hide Archive
              </Button>
            </div>

            {/* Archive Search & Filter Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              {/* Search input */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={archiveSearch}
                  onChange={e => {
                    setArchiveSearch(e.target.value);
                    setArchiveVisibleCount(12);
                  }}
                  placeholder={`Search ${historicalSiteMetrics.length} archived sites (name, client, stage)...`}
                  className="pl-9 pr-8 h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
                {archiveSearch && (
                  <button
                    onClick={() => setArchiveSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Chips & View Mode Toggle */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
                  {(['all', 'ended', 'onhold'] as const).map(filterKey => {
                    const count = filterKey === 'all' 
                      ? historicalSiteMetrics.length 
                      : filterKey === 'ended' 
                      ? historicalSiteMetrics.filter(s => s.status === 'Ended').length 
                      : historicalSiteMetrics.filter(s => s.isOnHold).length;

                    const label = filterKey === 'all' ? 'All' : filterKey === 'ended' ? 'Ended' : 'On Hold';

                    return (
                      <button
                        key={filterKey}
                        onClick={() => {
                          setArchiveStatusFilter(filterKey);
                          setArchiveVisibleCount(12);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1",
                          archiveStatusFilter === filterKey
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                        )}
                      >
                        <span>{label}</span>
                        <span className="text-[10px] opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* View Switcher: Table vs Cards */}
                <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <button
                    onClick={() => setArchiveViewMode('table')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all text-xs flex items-center gap-1",
                      archiveViewMode === 'table'
                        ? "bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-2xs font-semibold"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                    title="Compact Table Audit View"
                  >
                    <List className="w-4 h-4" />
                    <span className="text-[11px] hidden sm:inline">Table</span>
                  </button>
                  <button
                    onClick={() => setArchiveViewMode('cards')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all text-xs flex items-center gap-1",
                      archiveViewMode === 'cards'
                        ? "bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-2xs font-semibold"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                    title="Card Matrix View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-[11px] hidden sm:inline">Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Archive Content: Table View */}
            {filteredHistoricalSites.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No archived sites found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {archiveSearch ? `No sites matching "${archiveSearch}"` : 'No ended or inactive sites found for current filters.'}
                </p>
                {archiveSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setArchiveSearch('')}
                    className="mt-3 text-xs text-cyan-600 hover:text-cyan-700"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            ) : archiveViewMode === 'table' ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-800/60">
                    <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">Site & Client</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">Status & Stage</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right">Equipment & Days</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right">Total Diesel</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right">Daily Avg Burn</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-right">Variance</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">Last Refilled</TableHead>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedHistoricalSites.map(site => (
                      <TableRow 
                        key={site.id} 
                        className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <TableCell className="py-3 font-medium">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {site.name}
                          </div>
                          {site.client && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                              Client: {site.client}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold uppercase",
                              site.status === 'Ended'
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                            )}>
                              {site.isOnHold ? 'On Hold' : site.status}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {site.stage}
                              {site.endDate && ` • Ended ${formatDisplayDate(site.endDate)}`}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                            {site.totalMachinesCount} Units
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {site.activeDays} operating days
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 block">
                            {site.totalDiesel} L
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Target: {site.expectedDiesel} L
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                            {site.dailyAvgBurn} L/d
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {site.logCount} logs
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <span className={cn(
                            "font-bold text-xs block",
                            site.varianceLitres > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {site.varianceLitres > 0 ? `+${site.varianceLitres}` : site.varianceLitres} L
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {site.varianceLitres > 0 ? 'Over target' : 'Fuel saved'}
                          </span>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate max-w-[160px]" title={site.lastRefilledFormatted || 'No refill recorded'}>
                              {site.lastRefilledFormatted || 'No refill'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSiteId(site.id);
                              setSearchParams({ siteId: site.id });
                            }}
                            className="h-7 px-2.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-lg"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Archive Content: Cards Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayedHistoricalSites.map(site => (
                  <Card 
                    key={site.id} 
                    className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={site.name}>
                              {site.name}
                            </h3>
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold uppercase",
                              site.status === 'Ended'
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                            )}>
                              {site.isOnHold ? 'On Hold' : site.status}
                            </Badge>
                          </div>
                          {site.client && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              Client: <span className="font-medium text-slate-700 dark:text-slate-300">{site.client}</span>
                            </p>
                          )}
                          {site.endDate && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              Ended: {formatDisplayDate(site.endDate)}
                            </p>
                          )}
                        </div>

                        <Badge variant="outline" className="text-[10px] shrink-0 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                          {site.stage}
                        </Badge>
                      </div>

                      {/* Metrics 4-Box Grid */}
                      <div className="p-5 grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Logged Units</span>
                          <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                            {site.totalMachinesCount} Units
                          </span>
                          <span className="text-[10px] text-slate-400">{site.activeDays} operating days</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Diesel</span>
                            <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 block mt-0.5">
                              {site.totalDiesel} L
                            </span>
                            <span className="text-[10px] text-slate-400 block">Target: {site.expectedDiesel} L</span>
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1 truncate" title={`Last refill: ${site.lastRefilledFormatted || 'None'}`}>
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{site.lastRefilledFormatted || 'No refill'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Avg Burn</span>
                          <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                            {site.dailyAvgBurn} L/d
                          </span>
                          <span className="text-[10px] text-slate-400 block">Recorded average</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Pump Active Duration</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                              {site.earliestPumpDays != null ? `${site.earliestPumpDays} Days` : '—'}
                            </span>
                            {site.earliestPumpDays != null && (
                              <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                                {site.endDate ? 'total' : 'to date'}
                              </span>
                            )}
                          </div>
                          <span 
                            className="text-[10px] text-slate-400 block truncate"
                            title={site.earliestPumpStartDateFormatted ? `Earliest pump start date: ${site.earliestPumpStartDateFormatted}` : 'No pump logs on record'}
                          >
                            {site.earliestPumpStartDateFormatted ? `Since ${site.earliestPumpStartDateFormatted}` : 'No logs recorded'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-2xl mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {site.logCount} daily log entries
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSiteId(site.id);
                          setSearchParams({ siteId: site.id });
                        }}
                        className="h-8 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-cyan-300 border-slate-200 dark:border-slate-700 rounded-xl group"
                      >
                        <span>Inspect Record</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination / Show More for Archive */}
            {filteredHistoricalSites.length > archiveVisibleCount && (
              <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400">
                  Showing {displayedHistoricalSites.length} of {filteredHistoricalSites.length} sites
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setArchiveVisibleCount(prev => prev + 12)}
                  className="text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700"
                >
                  Show 12 More
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setArchiveVisibleCount(filteredHistoricalSites.length)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Show All ({filteredHistoricalSites.length})
                </Button>
              </div>
            )}
          </div>
        )}

        {renderRefillForecastModal()}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Historical Archive Notice if viewing ended/inactive site */}
      {currentSite && currentSite.status !== 'Active' && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Historical Record ({currentSite.status} Site)
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  {currentSite.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                This project has concluded. Reviewing all historical pump deployments, diesel telemetry, and maintenance records.
                {currentSite.endDate && ` Concluded on ${formatDisplayDate(currentSite.endDate)}.`}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedSiteId(activeSites[0]?.id || 'all');
              setSearchParams({ siteId: activeSites[0]?.id || 'all' });
            }}
            className="h-7 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300"
          >
            ← Back to Active Sites
          </Button>
        </div>
      )}
      
      {/* Mobile-only secondary filter strip for tiny screens */}
      <div className="sm:hidden flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs overflow-x-auto">
          {(['all', 'year', '90d', '30d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all',
                timeRange === range
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-500'
              )}
            >
              {range === 'all' ? 'All Time' : range === 'year' ? selectedYear : range === '90d' ? '90d' : '30d'}
            </button>
          ))}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportCSV}
          className="h-7 px-2 text-xs font-semibold rounded-lg shrink-0"
        >
          <Download className="w-3 h-3 mr-1" /> Export
        </Button>
      </div>

      {/* ── Top 5 Executive KPI Metric Tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Metric 1: Days Machine on Site */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fleet Days on Site
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-800 dark:text-white">
              {siteAggregates.totalFleetDaysOnSite}
              <span className="text-xs font-normal text-slate-400 ml-1">days</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Across {siteAggregates.machineCount} deployed unit{siteAggregates.machineCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Metric 2: Active Operational Days & Utilization */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Running Days
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {siteAggregates.activeDays}
              <span className="text-xs font-normal text-slate-400 ml-1">days</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {siteAggregates.overallUtilization}% fleet running utilization
            </p>
          </div>
        </div>

        {/* Metric 3: Total Diesel Refilled & Benchmark Telemetry */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Diesel Refilled (Actual)
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {siteAggregates.totalDiesel.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                <span className="text-xs font-normal text-slate-400 ml-1">L</span>
              </p>
              {siteAggregates.hasBenchmarkData && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none', siteAggregates.overallFuelEfficiency.badgeCls)}>
                  {siteAggregates.overallFuelEfficiency.label}
                </span>
              )}
            </div>

            {/* Last Refilled Date badge */}
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 px-2 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">
                Last Refill: <strong>{siteAggregates.lastRefilledFormatted}</strong>
                {siteAggregates.lastRefillLitres > 0 && ` (${siteAggregates.lastRefillLitres}L)`}
              </span>
            </div>

            {siteAggregates.hasBenchmarkData ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Expected: <strong className="text-slate-700 dark:text-slate-200">{siteAggregates.totalExpectedDiesel.toLocaleString()} L</strong> ({siteAggregates.overallVarianceLitres >= 0 ? `+${siteAggregates.overallVarianceLitres}` : siteAggregates.overallVarianceLitres} L variance)
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Avg {siteAggregates.avgDailyDiesel.toFixed(1)} L / active day
              </p>
            )}
          </div>
        </div>

        {/* Metric 4: Machine Downtime Incidents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Downtime Incidents
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {siteAggregates.totalDowntimes}
              <span className="text-xs font-normal text-slate-400 ml-1">event{siteAggregates.totalDowntimes !== 1 ? 's' : ''}</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {siteAggregates.totalDowntimeHours.toFixed(1)} total hours halted
            </p>
          </div>
        </div>

        {/* Metric 5: Active Fleet on Site */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Deployed Fleet
            </span>
            <div className="h-8 w-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-800 dark:text-white">
              {siteAggregates.activeFleetCount}
              <span className="text-xs font-normal text-slate-400 ml-1">/ {siteAggregates.machineCount} units</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Stationed on active site
            </p>
          </div>
        </div>
      </div>

      {/* ── VISUAL SECTION: Live Machine Fuel Tank Gauges ── */}
      {machineFleetStats.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Fuel className="h-4 w-4 text-amber-500" />
                Live Machine Fuel Tank Telemetry
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Site Status:</span>
              <span className={cn('font-bold px-2 py-0.5 rounded-full border text-[11px]', siteAggregates.overallFuelEfficiency.badgeCls)}>
                {siteAggregates.overallFuelEfficiency.label}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {machineFleetStats.filter(m => m.isCurrentlyActive).length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Fuel className="h-8 w-8 mx-auto mb-2 opacity-40 text-amber-500" />
                <p className="text-sm font-semibold">No equipment currently active on site</p>
                <p className="text-xs text-slate-400 mt-1">Deploy equipment or log operational activity to view live fuel telemetry.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {machineFleetStats
                  .filter(m => m.isCurrentlyActive)
                  .map(m => {
                    return (
                      <div 
                        key={m.id}
                        className="bg-slate-50/70 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        {/* Card Top: Unit Name & Status Badge */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate" title={m.name}>
                                {m.shortName}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn(
                                  'h-2 w-2 rounded-full shrink-0',
                                  m.isCurrentlyActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                )} />
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  {m.isCurrentlyActive ? 'Ready & Active' : 'Standby / Offsite'}
                                </span>
                              </div>
                            </div>

                            {/* Level Badge matching reference image */}
                            <span className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 uppercase tracking-wider flex items-center gap-1',
                              m.fuelLevelStatus === 'critical'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                : m.fuelLevelStatus === 'low'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                : m.fuelLevelStatus === 'good'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                                : m.fuelLevelStatus === 'optimal'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            )}>
                              {(m.fuelLevelStatus === 'critical' || m.fuelLevelStatus === 'low') && (
                                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              )}
                              {m.fuelLevelStatus === 'critical'
                                ? 'CRITICAL'
                                : m.fuelLevelStatus === 'low'
                                ? 'LOW LEVEL'
                                : m.fuelLevelStatus === 'good'
                                ? 'NORMAL'
                                : m.fuelLevelStatus === 'optimal'
                                ? 'OPTIMAL'
                                : 'UNRATED'}
                            </span>
                          </div>

                          {/* Center Visual: Realistic Tank Gauge */}
                          <div className="py-4 flex justify-center">
                            <div className="relative w-24 h-44 rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-900 overflow-hidden shadow-inner flex flex-col justify-end">
                              
                              {/* Horizontal Calibration Lines matching reference image */}
                              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 px-1 z-20 opacity-40 dark:opacity-30">
                                <div className="border-b border-slate-600 dark:border-slate-400 w-1/3" />
                                <div className="border-b border-slate-600 dark:border-slate-400 w-1/2" />
                                <div className="border-b border-slate-600 dark:border-slate-400 w-1/3" />
                                <div className="border-b border-slate-600 dark:border-slate-400 w-1/2" />
                                <div className="border-b border-slate-600 dark:border-slate-400 w-1/3" />
                              </div>

                              {/* Centered Large Bold Percentage */}
                              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                <span className="text-2xl font-black text-slate-900 dark:text-white drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] select-none">
                                  {m.fuelPercentage}%
                                </span>
                              </div>

                              {/* Fuel Liquid Level Fill with Amber/Brown Liquid matching image */}
                              <div 
                                className={cn(
                                  'w-full transition-all duration-700 relative z-10',
                                  m.fuelLevelStatus === 'critical'
                                    ? 'bg-gradient-to-t from-rose-700 to-rose-500'
                                    : m.fuelLevelStatus === 'low'
                                    ? 'bg-gradient-to-t from-amber-800 to-amber-600'
                                    : 'bg-gradient-to-t from-amber-700 to-amber-500'
                                )}
                                style={{ height: `${Math.max(4, m.fuelPercentage)}%` }}
                              >
                                {/* Meniscus / Surface shine */}
                                <div className="w-full h-1 bg-white/30" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Telemetry Box matching reference image */}
                        <div className="bg-white dark:bg-slate-900/90 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800 text-[11px] shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider flex items-center gap-1">
                              {m.isDipstickVerified ? 'DIPSTICK FUEL' : 'EST. FUEL'}
                              {m.isDipstickVerified && (
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 inline-block" title="Dipstick Verified" />
                              )}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {m.effectiveTankCapacity > 0 ? `${m.estimatedRemainingLitres}L / ${m.effectiveTankCapacity}L` : `${m.estimatedRemainingLitres}L`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">
                              EST. RUNWAY
                            </span>
                            <span className={cn(
                              'font-bold',
                              m.runwayHours <= 0 ? 'text-slate-400 dark:text-slate-500' : m.runwayHours <= 12 ? 'text-rose-600 dark:text-rose-400 font-black' : m.runwayHours <= 24 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            )}>
                              {m.runwayHours > 0 ? `~${m.runwayHours} hrs (${m.runwayDays.toFixed(1)}d)` : '--'}
                            </span>
                          </div>

                          <div className="border-t border-slate-100 dark:border-slate-800 pt-1 flex items-center justify-between">
                            <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">
                              LAST REFILL
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {m.lastRefillDate ? `${formatDisplayDate(m.lastRefillDate)}${m.lastRefillLitres > 0 ? ` (${m.lastRefillLitres}L)` : ''}` : 'None logged'}
                            </span>
                          </div>

                          {m.lastDipstickDate && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-1 flex items-center justify-between text-[10px]">
                              <span className="text-cyan-600 dark:text-cyan-400 font-semibold uppercase text-[9px] tracking-wider">
                                LAST DIPSTICK
                              </span>
                              <span className="font-bold text-cyan-700 dark:text-cyan-300">
                                {m.lastDipstickLitres}L ({formatDisplayDate(m.lastDipstickDate)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── VISUAL SECTION 1+ : Charts (deferred after first paint) ── */}
      {!chartsReady ? (
        <div className="space-y-6">
          {/* Chart skeleton placeholders — shown only for the 2 animation frames before charts mount */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-80 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-pulse"
            />
          ))}
        </div>
      ) : (
      <>
      {/* ── VISUAL SECTION 1: Diesel Consumption Trend Graph ── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Fuel className="h-4 w-4 text-amber-500" />
                Diesel Telemetry: Refill Interval Variance & Daily Average Diesel Usage (L/Day)
              </CardTitle>
              {siteAggregates.lastRefilledFormatted && siteAggregates.lastRefilledFormatted !== 'No refill recorded' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3 text-amber-500" />
                  Last Refilled: {siteAggregates.lastRefilledFormatted}
                  {siteAggregates.lastRefillLitres > 0 && ` (${siteAggregates.lastRefillLitres}L)`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Daily Avg Burn (L/Day)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-4 border-t-2 border-dashed border-cyan-500 inline-block" />
                <span>Rated Benchmark (18 L/d)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                <span>Variance (Diff)</span>
              </div>
            </div>

            {/* Next Refill Forecast Trigger Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefillForecastScope(isPortfolioMode ? 'fleet' : 'current');
                setIsRefillForecastModalOpen(true);
              }}
              className="h-7 px-2.5 text-xs font-semibold rounded-lg border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center gap-1.5 shrink-0"
              title="Open Next Refill Forecast (1-Day Safety Buffer)"
            >
              <Bell className="w-3 h-3 text-amber-500" />
              <span>Refill Forecast</span>
              {urgentRefillCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white leading-none">
                  {urgentRefillCount}
                </span>
              ) : tomorrowRefillCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-none">
                  {tomorrowRefillCount}
                </span>
              ) : null}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-6 space-y-6">
          {/* Variance Mode Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Refill Cycles</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {refillCyclesSummary.totalCycles} <span className="text-[10px] font-normal text-slate-400">refills</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Avg Refill Interval</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {refillCyclesSummary.avgActiveIntervalDays} <span className="text-[10px] font-normal text-slate-400">active days</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Refilled</span>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {refillCyclesSummary.totalRefilled} <span className="text-[10px] font-normal text-slate-400">Litres</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Daily Avg Burn Rate</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {refillCyclesSummary.avgDailyUsage} <span className="text-[10px] font-normal text-slate-400">L/day</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Net Variance (Diff)</span>
              <p className={cn(
                "text-sm font-bold",
                refillCyclesSummary.netDiff > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              )}>
                {refillCyclesSummary.netDiff > 0 ? `+${refillCyclesSummary.netDiff}` : refillCyclesSummary.netDiff} L
                <span className="text-[10px] font-normal text-slate-400 ml-1">
                  {refillCyclesSummary.netDiff > 0 ? '(overburn)' : '(saved)'}
                </span>
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Dipstick Verified</span>
              <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                {refillCyclesSummary.dipstickVerifiedCount} / {refillCyclesSummary.totalCycles}
                <span className="text-[10px] font-normal text-slate-400 ml-1">cycles</span>
              </p>
            </div>
          </div>

          {/* Variance & Avg Burn Mode: ComposedChart with Daily Avg Burn Bars & Benchmark Line */}
          <div className="space-y-6">
              {/* Interactive Machine / Pump Checkbox & Filter Bar */}
              {scopedFilterMachines.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-50/90 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mr-1">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      Filter Pumps:
                    </span>

                    {/* All Pumps Button */}
                    <button
                      type="button"
                      onClick={() => setVarianceMachineFilter([])}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                        varianceMachineFilter.length === 0 || varianceMachineFilter.length === scopedFilterMachines.length
                          ? "bg-cyan-600 text-white border-cyan-700 shadow-xs"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      {selectedMachineId === 'active_only' ? 'All Active Pumps' : 'All Pumps'} ({scopedFilterMachines.length})
                    </button>

                    {/* Individual Pump Checkboxes */}
                    {scopedFilterMachines.map(m => {
                      const isChecked = varianceMachineFilter.length === 0 || varianceMachineFilter.includes(m.id);
                      const isOnly = varianceMachineFilter.length === 1 && varianceMachineFilter[0] === m.id;

                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all select-none cursor-pointer",
                            isChecked
                              ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-cyan-500/80 dark:border-cyan-500/60 shadow-xs ring-1 ring-cyan-500/20"
                              : "bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
                          )}
                          onClick={() => {
                            if (varianceMachineFilter.length === 0) {
                              setVarianceMachineFilter(scopedFilterMachines.filter(x => x.id !== m.id).map(x => x.id));
                            } else if (varianceMachineFilter.includes(m.id)) {
                              const next = varianceMachineFilter.filter(id => id !== m.id);
                              setVarianceMachineFilter(next.length === 0 ? [] : next);
                            } else {
                              const next = [...varianceMachineFilter, m.id];
                              setVarianceMachineFilter(next.length === scopedFilterMachines.length ? [] : next);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer pointer-events-none"
                          />
                          <span className={cn("h-2 w-2 rounded-full shrink-0", m.isCurrentlyOnSite ? "bg-emerald-500" : "bg-slate-400")} />
                          <span>{formatMachineShortName(m.name)}</span>
                          {!m.isCurrentlyOnSite && (
                            <span className="text-[9px] text-slate-400 font-normal">(Ended)</span>
                          )}
                          <button
                            type="button"
                            title={`Show only ${formatMachineShortName(m.name)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setVarianceMachineFilter([m.id]);
                            }}
                            className={cn(
                              "text-[10px] px-1 rounded transition-colors ml-0.5",
                              isOnly
                                ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-bold"
                                : "text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                          >
                            only
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {varianceMachineFilter.length > 0 && varianceMachineFilter.length < scopedFilterMachines.length && (
                    <button
                      type="button"
                      onClick={() => setVarianceMachineFilter([])}
                      className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
                    >
                      Show All {selectedMachineId === 'active_only' ? 'Active' : ''} Pumps
                    </button>
                  )}
                </div>
              )}

              {filteredRefillCycles.length > 0 ? (
                <>
                  <div className="h-72 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ComposedChart data={filteredRefillCycles} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                        <XAxis 
                          dataKey="dateFormatted" 
                          stroke={isDark ? '#94a3b8' : '#64748b'} 
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis 
                          stroke={isDark ? '#94a3b8' : '#64748b'} 
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={v => `${v} L/d`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                            borderColor: isDark ? '#334155' : '#e2e8f0',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                            color: isDark ? '#ffffff' : '#0f172a'
                          }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const c = payload[0].payload;
                            return (
                              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl space-y-2 text-xs min-w-[240px]">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{c.machineShortName}</span>
                                  <span className="text-[10px] text-slate-400">{c.refillDate}</span>
                                </div>
                                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Refill Interval:</span>
                                    <span className="font-semibold">{c.intervalLabel}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Active Operational Days:</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.activeDays} days ({c.offDays} off)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Diesel Refilled:</span>
                                    <span className="font-semibold text-amber-600">{c.refilledLitres} L</span>
                                  </div>
                                  {c.dipstickLitres != null && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Post-Fill Dipstick:</span>
                                      <span className="font-semibold text-cyan-600">{c.dipstickLitres} L</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Actual Burn:</span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                      {c.actualBurn} L {c.isDipstickVerified ? '✓ (Dipstick)' : '(Refilled)'}
                                    </span>
                                  </div>
                                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1 flex justify-between font-bold">
                                    <span className="text-slate-700 dark:text-slate-200">Daily Average Burn:</span>
                                    {c.status === 'initial_fill' ? (
                                      <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Initial Starting Fill</span>
                                    ) : (
                                      <span className={cn(
                                        c.dailyAvgBurn > c.benchmarkRate ? "text-rose-600" : "text-emerald-600"
                                      )}>
                                        {c.dailyAvgBurn} L/day
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Target Benchmark:</span>
                                    <span className="font-medium">{c.benchmarkRate} L/day ({c.expectedBurn} L)</span>
                                  </div>
                                  <div className="flex justify-between font-bold">
                                    <span className="text-slate-400">Variance (Diff):</span>
                                    {c.status === 'initial_fill' ? (
                                      <span className="text-cyan-600 dark:text-cyan-400">Tank Baseline</span>
                                    ) : (
                                      <span className={cn(
                                        c.diffLitres > 0 ? "text-rose-600" : "text-emerald-600"
                                      )}>
                                        {c.diffLitres > 0 ? `+${c.diffLitres}` : c.diffLitres} L
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine 
                          y={refillIntervalCycles[0]?.benchmarkRate || 18} 
                          stroke="#06b6d4" 
                          strokeDasharray="4 4" 
                          strokeWidth={2}
                          label={{
                            value: `Target: ${refillIntervalCycles[0]?.benchmarkRate || 18} L/d`,
                            position: 'top',
                            fill: '#06b6d4',
                            fontSize: 10,
                            fontWeight: 'bold'
                          }}
                        />
                        <Bar 
                          dataKey="dailyAvgBurn" 
                          name="Daily Avg Burn (L/Day)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={45}
                          isAnimationActive={false}
                        >
                          {filteredRefillCycles.map((entry, index) => {
                            if (entry.status === 'initial_fill') {
                              return <Cell key={`cell-${index}`} fill="#06b6d4" />;
                            }
                            const isHigh = entry.dailyAvgBurn > entry.benchmarkRate * 1.15;
                            const isMild = entry.dailyAvgBurn > entry.benchmarkRate;
                            const fillColor = isHigh ? '#f43f5e' : isMild ? '#f59e0b' : '#10b981';
                            return <Cell key={`cell-${index}`} fill={fillColor} />;
                          })}
                        </Bar>
                        <Line 
                          type="monotone" 
                          dataKey="diffLitres" 
                          name="Variance Diff (L)"
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          dot={{ r: 4, fill: '#3b82f6' }}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Refill Intervals & Variance Audit Table (Matching User's Excel Workflow) */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Refill Intervals Audit Log & Variance (Diff) Table
                        </span>
                        <Badge variant="outline" className="text-[10px] font-semibold bg-white dark:bg-slate-900">
                          {filteredRefillCycles.length} Intervals
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>Target = <strong className="text-slate-700 dark:text-slate-300">Active Days × 18 L/day</strong></span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>Diff = <strong className="text-slate-700 dark:text-slate-300">Actual Burn - Target</strong> (Minus = Fuel Saved, Plus = Overburn)</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100/90 dark:bg-slate-800/90 sticky top-0 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-2.5 pl-3">Refill Date</th>
                            <th className="p-2.5">Machine</th>
                            <th className="p-2.5">Interval Span</th>
                            <th className="p-2.5 text-center">Off Days</th>
                            <th className="p-2.5 text-center">Active Days</th>
                            <th className="p-2.5 text-right">Refilled (L)</th>
                            <th className="p-2.5 text-right">Dipstick (L)</th>
                            <th className="p-2.5 text-right">Actual Burn (L)</th>
                            <th className="p-2.5 text-right">Daily Avg (L/Day)</th>
                            <th className="p-2.5 text-right">Est. Target</th>
                            <th className="p-2.5 text-right">Diff (L)</th>
                            <th className="p-2.5 pr-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {filteredRefillCycles.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="p-2.5 pl-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {c.dateFormatted}
                              </td>
                              <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={c.machineName}>
                                {c.machineShortName}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {c.intervalLabel}
                              </td>
                              <td className="p-2.5 text-center text-slate-400">
                                {c.offDays}
                              </td>
                              <td className="p-2.5 text-center font-bold text-cyan-600 dark:text-cyan-400">
                                {c.activeDays}
                              </td>
                              <td className="p-2.5 text-right font-bold text-amber-600">
                                {c.refilledLitres} L
                              </td>
                              <td className="p-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {c.dipstickLitres != null ? (
                                  <span className="font-semibold">{c.dipstickLitres} L</span>
                                ) : (
                                  <span className="text-slate-400 italic">Unrecorded</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                                {c.actualBurn} L
                                {c.isDipstickVerified && (
                                  <span className="text-[10px] text-cyan-500 font-normal ml-1" title="Calculated from dipstick level delta">
                                    ✓
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-bold">
                                {c.status === 'initial_fill' ? (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs italic font-normal">Initial Fill</span>
                                ) : (
                                  <span className={cn(
                                    c.dailyAvgBurn > c.benchmarkRate ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                  )}>
                                    {c.dailyAvgBurn} L/d
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right text-slate-500">
                                {c.expectedBurn} L
                              </td>
                              <td className="p-2.5 text-right font-bold">
                                {c.status === 'initial_fill' ? (
                                  <span className="text-slate-400 dark:text-slate-500 text-[11px] font-normal italic">Baseline</span>
                                ) : (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[11px]",
                                    c.diffLitres > 0 
                                      ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300" 
                                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  )}>
                                    {c.diffLitres > 0 ? `+${c.diffLitres}` : c.diffLitres} L
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 pr-3 text-center">
                                {c.status === 'initial_fill' ? (
                                  <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                                    Initial Fill
                                  </Badge>
                                ) : c.status === 'optimal' ? (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                    Optimal
                                  </Badge>
                                ) : c.status === 'mild_overburn' ? (
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                    Mild Diff
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800">
                                    High Burn
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Fuel className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-medium">No refill interval cycles recorded for the selected machine(s).</p>
                  {varianceMachineFilter.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVarianceMachineFilter([])}
                      className="text-xs h-7 mt-1 font-semibold text-cyan-600"
                    >
                      Show All Pumps
                    </Button>
                  )}
                </div>
              )}
            </div>
        </CardContent>
      </Card>

      {/* ── VISUAL SECTION 2: Machine Days & Downtime Graphs (Side by Side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Graph 2A: Days on Site & Running Status per Machine */}
        <Card 
          style={fullScreenChart === 'site-operational-days' ? undefined : { contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}
          className={cn(
          "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden transition-all",
          fullScreenChart === 'site-operational-days' && "fixed inset-0 z-[120] m-0 rounded-none border-none w-screen h-screen flex flex-col p-4 sm:p-6 overflow-auto bg-white dark:bg-slate-900"
        )}>
          {fullScreenChart === 'site-operational-days' && (
            <Button
              variant="default"
              size="icon"
              className="fixed top-4 right-4 z-[130] rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 w-11 h-11"
              onClick={() => toggleFullScreenChart('site-operational-days')}
              title="Exit Full Screen"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          )}
          <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                Operational Days by Machine (Full vs Half vs Off)
              </CardTitle>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Fleet Status Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setFleetChartFilter('all')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                    fleetChartFilter === 'all' 
                      ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  All ({machineFleetStats.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFleetChartFilter('active')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                    fleetChartFilter === 'active' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:text-emerald-600'
                  )}
                >
                  Active ({siteAggregates.activeFleetCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFleetChartFilter('offsite')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold transition-all',
                    fleetChartFilter === 'offsite' 
                      ? 'bg-slate-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  Taken Out ({siteAggregates.takenOutFleetCount})
                </button>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                onClick={() => toggleFullScreenChart('site-operational-days')}
                title="Full Screen"
                aria-label="Full Screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn("p-5 pt-6", fullScreenChart === 'site-operational-days' && "flex-1 flex flex-col min-h-0")}>
            {machineDaysChartData.length > 0 ? (
              <div className={cn("w-full min-w-0", fullScreenChart === 'site-operational-days' ? "flex-1 min-h-[500px]" : "h-80")}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={machineDaysChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                    <XAxis 
                      dataKey="chartLabel" 
                      stroke={isDark ? '#94a3b8' : '#64748b'} 
                      fontSize={10} 
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke={isDark ? '#94a3b8' : '#64748b'} 
                      fontSize={11} 
                      tickLine={false}
                      tickFormatter={v => `${v}d`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderRadius: '0.875rem',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        padding: '12px 14px'
                      }}
                      formatter={(val: any, name: any) => [
                        `${val} Days`, 
                        name === 'fullDays' ? 'Full Day Running (1.0)' : name === 'halfDays' ? 'Half Day Running (0.5)' : 'Standby / Off'
                      ]}
                      labelFormatter={(label, items) => {
                        const item = items?.[0]?.payload;
                        if (!item) return label;
                        return (
                          <div className="space-y-1.5 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between gap-2">
                              <span>{item.fullName}</span>
                              <span className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                                item.isCurrentlyActive 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' 
                                  : item.status === 'replaced'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              )}>
                                {item.isCurrentlyActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                {item.statusLabel}
                              </span>
                            </div>
                            
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Pumping Period: </span>
                              {item.startDate ? formatDisplayDate(item.startDate) : 'Start unrecorded'} 
                              {' → '} 
                              {item.isCurrentlyActive ? 'Present (Active)' : (item.stopDate ? formatDisplayDate(item.stopDate) : 'Stopped')}
                              <span className="ml-1 text-slate-400 font-medium">({item.totalDays} calendar days)</span>
                            </div>

                            {item.successorName && (
                              <div className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/50 px-2 py-1 rounded-md border border-blue-200/60 dark:border-blue-900/60">
                                <strong>🔄 Swapped out:</strong> Replaced by <strong>{item.successorName}</strong>
                                {item.swapReason ? <span className="italic block text-[10px] mt-0.5">"{item.swapReason}"</span> : null}
                              </div>
                            )}
                            {item.predecessorName && (
                              <div className="text-[11px] text-cyan-700 dark:text-cyan-300 bg-cyan-50/90 dark:bg-cyan-950/50 px-2 py-1 rounded-md border border-cyan-200/60 dark:border-cyan-900/60">
                                <strong>⬅️ Swapped in:</strong> Replaced <strong>{item.predecessorName}</strong>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      formatter={(val) => val === 'fullDays' ? 'Full (1.0)' : val === 'halfDays' ? 'Half (0.5)' : 'Off / Standby'}
                    />
                    <Bar dataKey="fullDays" stackId="a" fill={CHART_COLORS.emerald} radius={[0, 0, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="halfDays" stackId="a" fill={CHART_COLORS.amber} radius={[0, 0, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="offDays" stackId="a" fill={CHART_COLORS.slate} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                No machine operational logs available for this filter.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graph 2B: Machine Downtime & Halts (Incidents & Lost Hours) */}
        <Card 
          style={fullScreenChart === 'site-downtime' ? undefined : { contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}
          className={cn(
          "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden transition-all",
          fullScreenChart === 'site-downtime' && "fixed inset-0 z-[120] m-0 rounded-none border-none w-screen h-screen flex flex-col p-4 sm:p-6 overflow-auto bg-white dark:bg-slate-900"
        )}>
          {fullScreenChart === 'site-downtime' && (
            <Button
              variant="default"
              size="icon"
              className="fixed top-4 right-4 z-[130] rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 w-11 h-11"
              onClick={() => toggleFullScreenChart('site-downtime')}
              title="Exit Full Screen"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          )}
          <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Downtime Incidents & Lost Hours
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              onClick={() => toggleFullScreenChart('site-downtime')}
              title="Full Screen"
              aria-label="Full Screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className={cn("p-5 pt-6", fullScreenChart === 'site-downtime' && "flex-1 flex flex-col min-h-0")}>
            {machineDowntimeChartData.length > 0 ? (
              <div className={cn("w-full min-w-0", fullScreenChart === 'site-downtime' ? "flex-1 min-h-[500px]" : "h-80")}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={machineDowntimeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                    <XAxis 
                      dataKey="chartLabel" 
                      stroke={isDark ? '#94a3b8' : '#64748b'} 
                      fontSize={10} 
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke={isDark ? '#94a3b8' : '#64748b'} 
                      fontSize={11} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderRadius: '0.875rem',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        padding: '12px 14px'
                      }}
                      formatter={(val: any, name: any) => [
                        name === 'incidents' ? `${val} Events` : `${val} Hours Lost`,
                        name === 'incidents' ? 'Incidents Count' : 'Lost Hours'
                      ]}
                      labelFormatter={(label, items) => {
                        const item = items?.[0]?.payload;
                        if (!item) return label;
                        return (
                          <div className="space-y-1 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between gap-2">
                              <span>{item.fullName}</span>
                              <span className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                                item.isCurrentlyActive 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' 
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              )}>
                                {item.isCurrentlyActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                {item.statusLabel}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {item.startDate ? formatDisplayDate(item.startDate) : 'Start unrecorded'} 
                              {' → '} 
                              {item.isCurrentlyActive ? 'Present (Active)' : (item.stopDate ? formatDisplayDate(item.stopDate) : 'Stopped')}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      formatter={(val) => val === 'incidents' ? 'Incidents Count' : 'Lost Hours (h)'}
                    />
                    <Bar dataKey="incidents" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="lostHours" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-400 gap-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-60" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Zero Unresolved Downtimes</p>
                <p className="text-xs text-slate-400">All machines operating smoothly with no logged incidents.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── VISUAL SECTION 3: Donut Distributions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut 3A: Operational Status Breakdown */}
        <Card 
          style={fullScreenChart === 'site-duty-pie' ? undefined : { contentVisibility: 'auto', containIntrinsicSize: '0 320px' }}
          className={cn(
          "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden transition-all",
          fullScreenChart === 'site-duty-pie' && "fixed inset-0 z-[120] m-0 rounded-none border-none w-screen h-screen flex flex-col p-4 sm:p-6 overflow-auto bg-white dark:bg-slate-900"
        )}>
          {fullScreenChart === 'site-duty-pie' && (
            <Button
              variant="default"
              size="icon"
              className="fixed top-4 right-4 z-[130] rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 w-11 h-11"
              onClick={() => toggleFullScreenChart('site-duty-pie')}
              title="Exit Full Screen"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          )}
          <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              Fleet Duty Cycle & Running Distribution
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              onClick={() => toggleFullScreenChart('site-duty-pie')}
              title="Full Screen"
              aria-label="Full Screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className={cn("p-5 flex flex-col sm:flex-row items-center justify-around gap-4", fullScreenChart === 'site-duty-pie' && "flex-1 min-h-0")}>
            {operationalStatusDonutData.length > 0 ? (
              <>
                <div className={cn("shrink-0 min-w-0", fullScreenChart === 'site-duty-pie' ? "h-96 w-96" : "h-52 w-52")}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={operationalStatusDonutData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {operationalStatusDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          borderRadius: '0.75rem',
                          fontSize: '12px'
                        }}
                        formatter={(val: any) => [`${val} Days`, 'Quantity']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 min-w-[160px]">
                  {operationalStatusDonutData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white">{d.value}d</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                    Total Duty Days: <strong className="text-slate-700 dark:text-slate-200">{siteAggregates.fullDays + siteAggregates.halfDays + siteAggregates.offDays}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                No duty cycle data logged.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut 3B: Downtime Severity Breakdown */}
        <Card 
          style={fullScreenChart === 'site-severity-pie' ? undefined : { contentVisibility: 'auto', containIntrinsicSize: '0 320px' }}
          className={cn(
          "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden transition-all",
          fullScreenChart === 'site-severity-pie' && "fixed inset-0 z-[120] m-0 rounded-none border-none w-screen h-screen flex flex-col p-4 sm:p-6 overflow-auto bg-white dark:bg-slate-900"
        )}>
          {fullScreenChart === 'site-severity-pie' && (
            <Button
              variant="default"
              size="icon"
              className="fixed top-4 right-4 z-[130] rounded-full shadow-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 w-11 h-11"
              onClick={() => toggleFullScreenChart('site-severity-pie')}
              title="Exit Full Screen"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          )}
          <CardHeader className="p-5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              Downtime Severity Categorization
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              onClick={() => toggleFullScreenChart('site-severity-pie')}
              title="Full Screen"
              aria-label="Full Screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className={cn("p-5 flex flex-col sm:flex-row items-center justify-around gap-4", fullScreenChart === 'site-severity-pie' && "flex-1 min-h-0")}>
            {downtimeSeverityDonutData.length > 0 ? (
              <>
                <div className={cn("shrink-0 min-w-0", fullScreenChart === 'site-severity-pie' ? "h-96 w-96" : "h-52 w-52")}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={downtimeSeverityDonutData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {downtimeSeverityDonutData.map((entry, index) => (
                          <Cell key={`sev-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          borderRadius: '0.75rem',
                          fontSize: '12px'
                        }}
                        formatter={(val: any) => [`${val} Events`, 'Count']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 min-w-[160px]">
                  {downtimeSeverityDonutData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white">{d.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                    Total Incidents: <strong className="text-rose-600">{siteAggregates.totalDowntimes}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                No downtime incidents recorded.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION: Machine Deployment & Swap Timeline (Active vs Replaced / Demobilized) ── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              Site Machine Deployments, Pump Dates & Swap Lineage
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {siteAggregates.activeFleetCount} Active on Site
            </span>
            {siteAggregates.takenOutFleetCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                ⚪ {siteAggregates.takenOutFleetCount} Taken Out / Swapped
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1: Currently Active Pumps on Site */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Currently Active on Site ({machineFleetStats.filter(m => m.isCurrentlyActive).length})
                </h4>
                <span className="text-[11px] text-slate-400">Pumping operational</span>
              </div>

              {machineFleetStats.filter(m => m.isCurrentlyActive).length > 0 ? (
                <div className="space-y-2.5">
                  {machineFleetStats.filter(m => m.isCurrentlyActive).map(m => (
                    <div 
                      key={m.id}
                      className="p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2 mt-0.5">
                            <span>Pump Start: <strong>{m.startDate ? formatDisplayDate(m.startDate) : 'Not configured'}</strong></span>
                            <span>•</span>
                            <span>{m.calendarDaysOnSite} days on site</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditPumpDates(m)}
                          className="h-6 px-2 text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-md"
                          title="Edit Pump Start / Stop Dates"
                        >
                          <Calendar className="w-3 h-3 mr-1" /> Dates
                        </Button>
                      </div>

                      {/* Predecessor Swap note */}
                      {m.predecessorName && (
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded-md border border-blue-200/60 dark:border-blue-900/60 flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />
                          <span>Brought in to replace: <strong>{m.predecessorName}</strong></span>
                          {m.swapReason && <span className="text-slate-400 italic">({m.swapReason})</span>}
                        </div>
                      )}

                      {/* Quick Operational Metrics */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/40 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Active Duty</span>
                          <strong className="text-slate-700 dark:text-slate-200">{m.activeDays}d ({m.utilization}%)</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Diesel Burned</span>
                          <strong className="text-amber-600 dark:text-amber-400">{m.totalDiesel.toFixed(0)} L</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Downtime</span>
                          <strong className={m.downtimeCount > 0 ? "text-rose-600" : "text-slate-400"}>
                            {m.downtimeCount} events ({m.downtimeHours.toFixed(1)}h)
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  No pumps currently designated active on this site.
                </div>
              )}
            </div>

            {/* Column 2: Swapped Out / Taken Out Machines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Taken Out / Swapped Offsite ({machineFleetStats.filter(m => !m.isCurrentlyActive).length})
                </h4>
                <span className="text-[11px] text-slate-400">Demobilized / Replaced</span>
              </div>

              {machineFleetStats.filter(m => !m.isCurrentlyActive).length > 0 ? (
                <div className="space-y-2.5">
                  {machineFleetStats.filter(m => !m.isCurrentlyActive).map(m => (
                    <div 
                      key={m.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                            <span>
                              {m.startDate ? formatDisplayDate(m.startDate) : 'Start unrecorded'} 
                              {' → '} 
                              <strong>{m.stopDate ? formatDisplayDate(m.stopDate) : 'Stopped'}</strong>
                            </span>
                            <span>•</span>
                            <span>{m.calendarDaysOnSite} days served</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditPumpDates(m)}
                          className="h-6 px-2 text-[10px] font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 rounded-md"
                          title="Edit Pump Start / Stop Dates"
                        >
                          <Calendar className="w-3 h-3 mr-1" /> Dates
                        </Button>
                      </div>

                      {/* Successor Replacement note */}
                      {m.successorName ? (
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-900/50">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>Taken out & replaced by: <strong>{m.successorName}</strong></span>
                          </div>
                          {m.swapReason && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 ml-4">
                              Reason: "{m.swapReason}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Demobilized / taken out of active site rotation.</span>
                        </div>
                      )}

                      {/* Quick Operational Metrics */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Active Delivered</span>
                          <strong className="text-slate-700 dark:text-slate-200">{m.activeDays}d ({m.utilization}%)</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Diesel Burned</span>
                          <strong className="text-amber-600 dark:text-amber-400">{m.totalDiesel.toFixed(0)} L</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Downtime</span>
                          <strong className={m.downtimeCount > 0 ? "text-rose-600" : "text-slate-400"}>
                            {m.downtimeCount} events ({m.downtimeHours.toFixed(1)}h)
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  No demobilized or swapped machines on this site.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 4: Machine Fleet Matrix & Lineage Table ── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Machine Fleet Performance & Daily Register Access
            </CardTitle>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {machineFleetStats.length} Unit{machineFleetStats.length !== 1 ? 's' : ''} on Record
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {machineFleetStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Machine Unit & Lineage</th>
                    <th className="py-3 px-3">Days on Site</th>
                    <th className="py-3 px-3">Active Days</th>
                    <th className="py-3 px-3">Diesel Refilled</th>
                    <th className="py-3 px-3">Expected vs Variance</th>
                    <th className="py-3 px-3">Downtimes</th>
                    <th className="py-3 px-3">Utilization</th>
                    <th className="py-3 px-3">Maintenance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {machineFleetStats.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2 flex-wrap">
                          <span>{m.name}</span>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                            m.isCurrentlyActive 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' 
                              : m.status === 'replaced'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          )}>
                            {m.isCurrentlyActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            {m.statusLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                          <span>
                            Pump Dates: <strong>{m.startDate ? formatDisplayDate(m.startDate) : '—'}</strong>
                            {' → '}
                            <strong>{m.isCurrentlyActive ? 'Present (Active)' : (m.stopDate ? formatDisplayDate(m.stopDate) : 'Ended')}</strong>
                          </span>
                          {m.successorName && (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              • ➡️ Replaced by: {m.successorName}
                            </span>
                          )}
                          {m.predecessorName && (
                            <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                              • ⬅️ Replaced: {m.predecessorName}
                            </span>
                          )}
                          {m.expectedDailyBurnRate > 0 && (
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                              • ⛽ Rated: {m.expectedDailyBurnRate} L/day {m.tankCapacityLitres > 0 ? `(${m.tankCapacityLitres}L tank)` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {m.calendarDaysOnSite} days
                      </td>

                      <td className="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        {m.activeDays} days
                        <div className="text-[10px] text-slate-400 font-normal">
                          {m.fullDays} full · {m.halfDays} half
                        </div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-amber-600 dark:text-amber-400">
                        {m.totalDiesel.toFixed(1)} L
                        <div className="text-[10px] text-slate-400 font-normal">
                          avg {m.avgDieselPerActiveDay.toFixed(1)} L/d
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {m.isBenchmarked ? (
                          <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                              {m.expectedDiesel.toFixed(1)} L
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({m.expectedDailyBurnRate} L/d)
                              </span>
                            </div>
                            <div className="mt-0.5">
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block leading-none', m.fuelEfficiency.badgeCls)}>
                                {m.fuelEfficiency.label} ({m.varianceLitres >= 0 ? `+${m.varianceLitres}` : m.varianceLitres} L)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Unbenchmarked
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className={cn('font-semibold', m.downtimeCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')}>
                          {m.downtimeCount} incidents
                        </span>
                        {m.downtimeHours > 0 && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {m.downtimeHours.toFixed(1)} hrs lost
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-bold text-xs',
                            m.utilization >= 75 ? 'text-emerald-600' : m.utilization >= 45 ? 'text-amber-600' : 'text-slate-400'
                          )}>
                            {m.utilization}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                'h-full rounded-full',
                                m.utilization >= 75 ? 'bg-emerald-500' : m.utilization >= 45 ? 'bg-amber-400' : 'bg-slate-400'
                              )}
                              style={{ width: `${m.utilization}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          m.serviceStatus === 'overdue' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                          m.serviceStatus === 'due_soon' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        )}>
                          {m.serviceStatus === 'overdue' && <AlertCircle className="w-3 h-3" />}
                          {m.serviceStatus === 'due_soon' && <Clock className="w-3 h-3" />}
                          {m.serviceStatus === 'ok' && <CheckCircle2 className="w-3 h-3" />}
                          {m.serviceStatus.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditPumpDates(m)}
                            className="h-7 px-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Configure Pump Start & Stop Dates"
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            Dates
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveRegisterMachine({ id: m.id, name: m.name })}
                            className="h-7 px-2.5 text-xs font-semibold rounded-lg text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                          >
                            Open Register
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No machines deployed or configured on this site yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 5: Recent Downtime Log & Root-Cause Analysis ── */}
      {siteAggregates.allDowntimesList.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Downtime Events Log & Failure Reasons
              </CardTitle>
            </div>
            <Badge variant="destructive" className="text-xs">
              {siteAggregates.allDowntimesList.length} Incident{siteAggregates.allDowntimesList.length !== 1 ? 's' : ''}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {siteAggregates.allDowntimesList.map((dt, idx) => (
                <div key={dt.id || idx} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 p-1.5 rounded-lg shrink-0',
                      dt.severity === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                      dt.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    )}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{dt.machineName}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{formatDisplayDate(dt.date)}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {dt.reason}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      dt.severity === 'high' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                      dt.severity === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    )}>
                      {dt.severity}
                    </Badge>
                    {dt.durationHours > 0 && (
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
                        {dt.durationHours} hrs halted
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── MODAL: Configure Pump Dates & Replacement Lineage ── */}
      {editingPumpDateMachine && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-500" />
                  Configure Pump Dates & Swaps
                </h3>
              </div>
              <button
                onClick={() => setEditingPumpDateMachine(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePumpDatesModal} className="p-5 space-y-4">
              {pumpDateModalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pumpDateModalError}</span>
                </div>
              )}

              {/* Machine Banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Machine Unit</span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{editingPumpDateMachine.name}</div>
                </div>
                <Badge variant="outline" className="text-xs font-semibold">
                  {currentSite?.name}
                </Badge>
              </div>

              {/* Pump Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pump Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={(editingPumpDateMachine.startDate || '').split('T')[0]}
                  onChange={e => setEditingPumpDateMachine({ ...editingPumpDateMachine, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Pump Stop Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pump Stop / End Date
                </label>
                <input
                  type="date"
                  value={(editingPumpDateMachine.stopDate || '').split('T')[0]}
                  onChange={e => setEditingPumpDateMachine({ ...editingPumpDateMachine, stopDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Replaced Predecessor Machine */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Replaced Predecessor Unit (Machine Swap)
                </label>
                <select
                  value={editingPumpDateMachine.replacedAssetId}
                  onChange={e => setEditingPumpDateMachine({ ...editingPumpDateMachine, replacedAssetId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  <option value="">None (Initial unit deployment)</option>
                  {siteMachines
                    .filter(m => m.id !== editingPumpDateMachine.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        Replaced: {m.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Swap Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Swap / Demobilization Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mechanical fault, capacity upgrade, or basement phase complete"
                  value={editingPumpDateMachine.swapReason}
                  onChange={e => setEditingPumpDateMachine({ ...editingPumpDateMachine, swapReason: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingPumpDateMachine(null)}
                  disabled={isSavingPumpDates}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingPumpDates}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold gap-1.5"
                >
                  {isSavingPumpDates ? 'Saving...' : 'Save Pump Dates'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      </>
      )} {/* end chartsReady ternary */}

      {renderRefillForecastModal()}
    </div>
  );
}
