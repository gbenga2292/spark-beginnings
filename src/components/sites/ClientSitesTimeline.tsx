import { useState, useMemo, useEffect, useRef } from 'react';
import {
  format, parseISO, differenceInDays, addDays, subDays, startOfMonth, endOfMonth,
  eachDayOfInterval, isToday, isWithinInterval, eachWeekOfInterval
} from 'date-fns';
import {
  Clock, CheckCircle2, AlertTriangle, Building2, MapPin, ExternalLink,
  Minimize2, Maximize2, PauseCircle, PlayCircle, Filter, Calendar, ArrowUpDown,
  ArrowUp, ArrowDown, LayoutGrid, Search, X, RotateCw, RotateCcw, Smartphone
} from 'lucide-react';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useTheme } from '@/src/hooks/useTheme';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

interface Props {
  selectedClient: string;
  onOpenSite360?: (site: Site) => void;
}

interface SiteProjectBar {
  id: string;
  siteId: string;
  siteName: string;
  clientName: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  status: 'Active' | 'Ended' | 'On Hold' | 'Pending';
  flatBgClass: string;
  flatBorderClass: string;
  activePumpingDays: number;
  totalDiesel: number;
  machinesUsed: string[];
  holdNote?: string;
  location?: string;
  siteObj: Site;
}

type ZoomScale = 'fit' | 'months' | 'weeks' | 'days';
type DatePreset = 'all' | '30days' | '90days' | '6months' | 'thisYear';
type SortOrder = 'asc' | 'desc';

export function ClientSitesTimeline({ selectedClient, onOpenSite360 }: Props) {
  const { isDark } = useTheme();
  const { sites } = useAppStore();
  const { dailyMachineLogs, waybills, siteHoldPeriods } = useOperations();

  const [siteFilter, setSiteFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBar, setSelectedBar] = useState<SiteProjectBar | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState<ZoomScale>('fit');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [userZoomSelected, setUserZoomSelected] = useState(false);
  const [viewType, setViewType] = useState<'cards' | 'gantt'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'gantt';
  });

  // Drag-to-Scroll (Hand Pan) State & Handlers
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const scrollLeftRef = useRef(0);
  const scrollTopRef = useRef(0);
  const hasDragged = useRef(false);

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Only capture primary left-clicks and ignore clicks with modifier keys
    if (e.button !== 0 || e.ctrlKey || e.metaKey || window.matchMedia('(pointer: coarse)').matches) return;

    const target = e.target as HTMLElement;
    // Don't hijack interaction if clicking interactive controls like inputs or modals
    if (target.closest('input, select, textarea, [role="dialog"]')) return;

    const container = timelineScrollRef.current;
    if (!container) return;

    dragStartX.current = e.pageX - container.offsetLeft;
    dragStartY.current = e.pageY - container.offsetTop;
    scrollLeftRef.current = container.scrollLeft;
    scrollTopRef.current = container.scrollTop;
    hasDragged.current = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.pageX - container.offsetLeft;
      const y = moveEvent.pageY - container.offsetTop;
      const walkX = x - dragStartX.current;
      const walkY = y - dragStartY.current;

      if (!hasDragged.current && (Math.abs(walkX) > 4 || Math.abs(walkY) > 4)) {
        hasDragged.current = true;
        setIsDragging(true);
      }

      if (hasDragged.current) {
        moveEvent.preventDefault();
        container.scrollLeft = scrollLeftRef.current - walkX;
        container.scrollTop = scrollTopRef.current - walkY;
      }
    };

    const onMouseUp = () => {
      setTimeout(() => {
        setIsDragging(false);
        hasDragged.current = false;
      }, 50);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Fullscreen / 90-degree landscape toggle
  const toggleFullscreen = async () => {
    if (isFullscreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      if ('orientation' in screen && 'unlock' in (screen.orientation as any)) {
        try {
          (screen.orientation as any).unlock();
        } catch {}
      }
      setIsFullscreen(false);
    } else {
      setIsFullscreen(true);
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen().catch(() => {});
        if ('orientation' in screen && 'lock' in (screen.orientation as any)) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch {}
        }
      }
    }
  };

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const isAll = selectedClient === 'ALL' || selectedClient === 'All Clients' || !selectedClient;

  // Base client sites
  const clientSites = useMemo(() => {
    return sites.filter(s => {
      if (!s.client || s.client.toUpperCase() === 'DCEL') return false;
      return isAll || s.client.trim().toLowerCase() === selectedClient.trim().toLowerCase();
    });
  }, [sites, selectedClient, isAll]);

  // 1. Filter target sites
  const targetSites = useMemo(() => {
    return clientSites.filter(s => {
      if (siteFilter === 'active' && s.status !== 'Active') return false;
      if (siteFilter === 'ended' && s.status !== 'Ended') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchClient = (s.client || '').toLowerCase().includes(q);
        return matchName || matchClient;
      }
      return true;
    });
  }, [clientSites, siteFilter, searchQuery]);

  // 2. Synthesize ONE clean continuous project bar per site (StartDate -> EndDate)
  const siteBars = useMemo(() => {
    const bars: SiteProjectBar[] = [];
    const now = new Date();

    targetSites.forEach(site => {
      const logs = dailyMachineLogs.filter(l => l.siteId === site.id || l.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase());
      const siteWbs = waybills.filter(w => w.siteId === site.id || w.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase());
      const activeHold = siteHoldPeriods.find(h => (h.siteId === site.id || h.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase()) && !h.holdEnd);

      // Resolve Start Date
      let start: Date;
      if (site.startDate) {
        start = parseISO(site.startDate);
      } else if (logs.length > 0) {
        const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
        start = parseISO(sorted[0].date);
      } else if (siteWbs.length > 0) {
        const sorted = [...siteWbs].sort((a, b) => (a.sentToSiteDate || a.issueDate).localeCompare(b.sentToSiteDate || b.issueDate));
        start = parseISO(sorted[0].sentToSiteDate || sorted[0].issueDate);
      } else {
        start = subDays(now, 30);
      }

      // Resolve End Date
      let end: Date;
      if (site.endDate) {
        end = parseISO(site.endDate);
      } else if (site.status === 'Ended') {
        if (logs.length > 0) {
          const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
          end = parseISO(sorted[0].date);
        } else {
          end = addDays(start, 30);
        }
      } else {
        // Active or ongoing
        end = now;
      }

      if (isNaN(start.getTime())) start = subDays(now, 30);
      if (isNaN(end.getTime()) || end < start) end = start;

      const durationDays = Math.max(1, differenceInDays(end, start) + 1);
      const activePumpingDays = logs.filter(l => l.isActive && l.operationalDay !== 'none').length;
      const totalDiesel = logs.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
      const machinesUsed = Array.from(new Set(logs.map(l => l.assetName).filter(Boolean)));

      // Status resolution & clean solid flat theme
      let status: 'Active' | 'Ended' | 'On Hold' | 'Pending';
      let flatBgClass: string;
      let flatBorderClass: string;

      if (activeHold) {
        status = 'On Hold';
        flatBgClass = 'bg-amber-500 hover:bg-amber-600 text-white';
        flatBorderClass = 'border-amber-600';
      } else if (site.status === 'Ended') {
        status = 'Ended';
        flatBgClass = 'bg-slate-700 hover:bg-slate-600 text-white';
        flatBorderClass = 'border-slate-800';
      } else if (site.status === 'Active' || !site.status) {
        status = 'Active';
        flatBgClass = 'bg-emerald-600 hover:bg-emerald-500 text-white';
        flatBorderClass = 'border-emerald-700';
      } else {
        status = 'Pending';
        flatBgClass = 'bg-blue-600 hover:bg-blue-500 text-white';
        flatBorderClass = 'border-blue-700';
      }

      bars.push({
        id: `site-bar-${site.id}`,
        siteId: site.id,
        siteName: site.name,
        clientName: site.client,
        startDate: start,
        endDate: end,
        durationDays,
        status,
        flatBgClass,
        flatBorderClass,
        activePumpingDays,
        totalDiesel,
        machinesUsed,
        holdNote: activeHold?.holdNote,
        location: site.address,
        siteObj: site,
      });
    });

    // Sort by Start Date
    return bars.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.startDate.getTime() - b.startDate.getTime();
      }
      return b.startDate.getTime() - a.startDate.getTime();
    });
  }, [targetSites, dailyMachineLogs, waybills, siteHoldPeriods, sortOrder]);

  // 3. Compute Overall Calendar Bounds with Date Presets
  const { minDate, maxDate, totalDaysSpan } = useMemo(() => {
    const now = new Date();
    let allStarts: number[] = siteBars.map(b => b.startDate.getTime());
    let allEnds: number[] = siteBars.map(b => b.endDate.getTime());
    allEnds.push(now.getTime());

    let rawStart = allStarts.length > 0 ? new Date(Math.min(...allStarts)) : subDays(now, 60);
    let rawEnd = allEnds.length > 0 ? new Date(Math.max(...allEnds)) : addDays(now, 30);

    // Apply Preset Filter if selected
    if (datePreset === '30days') {
      rawStart = subDays(now, 30);
      rawEnd = addDays(now, 7);
    } else if (datePreset === '90days') {
      rawStart = subDays(now, 90);
      rawEnd = addDays(now, 14);
    } else if (datePreset === '6months') {
      rawStart = subDays(now, 180);
      rawEnd = addDays(now, 20);
    } else if (datePreset === 'thisYear') {
      rawStart = new Date(now.getFullYear(), 0, 1);
      rawEnd = new Date(now.getFullYear(), 11, 31);
    }

    const min = startOfMonth(subDays(rawStart, 5));
    const max = endOfMonth(addDays(rawEnd, 5));
    const totalDays = differenceInDays(max, min) + 1;

    return {
      minDate: min,
      maxDate: max,
      totalDaysSpan: totalDays,
    };
  }, [siteBars, datePreset]);

  // Auto-tune Zoom Scale on initial load if user hasn't explicitly toggled it
  useEffect(() => {
    if (!userZoomSelected) {
      if (totalDaysSpan <= 30) {
        setZoomScale('days');
      } else if (totalDaysSpan <= 90) {
        setZoomScale('weeks');
      } else {
        setZoomScale('fit');
      }
    }
  }, [totalDaysSpan, userZoomSelected]);

  // Calendar Days array
  const calendarDays = useMemo(() => {
    try {
      return eachDayOfInterval({ start: minDate, end: maxDate });
    } catch {
      return [];
    }
  }, [minDate, maxDate]);

  // Calendar Weeks array
  const calendarWeeks = useMemo(() => {
    try {
      return eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 });
    } catch {
      return [];
    }
  }, [minDate, maxDate]);

  // Calendar Months array
  const calendarMonths = useMemo(() => {
    const groups: { label: string; year: string; count: number; startIdx: number }[] = [];
    let currentMonth = '';
    let currentYear = '';
    let currentCount = 0;
    let startIdx = 0;

    calendarDays.forEach((day, idx) => {
      const mStr = format(day, 'MMM');
      const yStr = format(day, 'yyyy');
      if (mStr !== currentMonth || yStr !== currentYear) {
        if (currentCount > 0) {
          groups.push({
            label: currentMonth,
            year: currentYear,
            count: currentCount,
            startIdx,
          });
        }
        currentMonth = mStr;
        currentYear = yStr;
        currentCount = 1;
        startIdx = idx;
      } else {
        currentCount++;
      }
    });

    if (currentCount > 0) {
      groups.push({
        label: currentMonth,
        year: currentYear,
        count: currentCount,
        startIdx,
      });
    }
    return groups;
  }, [calendarDays]);

  // Dynamic Content Width for horizontal scrolling
  const gridContainerWidth = useMemo(() => {
    if (zoomScale === 'fit') {
      return 0;
    }
    if (zoomScale === 'days') {
      return Math.max(920, calendarDays.length * 36);
    }
    if (zoomScale === 'weeks') {
      return Math.max(920, calendarWeeks.length * 80);
    }
    return Math.max(920, calendarMonths.length * 150);
  }, [zoomScale, calendarDays, calendarWeeks, calendarMonths]);

  // Compute Today line position
  const todayPercent = useMemo(() => {
    const totalMs = maxDate.getTime() - minDate.getTime();
    const todayMs = new Date().getTime() - minDate.getTime();
    if (totalMs <= 0 || todayMs < 0 || todayMs > totalMs) return null;
    return `${((todayMs / totalMs) * 100).toFixed(2)}%`;
  }, [minDate, maxDate]);

  const getBarLayout = (barStart: Date, barEnd: Date) => {
    const totalMs = maxDate.getTime() - minDate.getTime();
    if (totalMs <= 0) return { left: '0%', width: '100%' };

    const startOffset = Math.max(0, barStart.getTime() - minDate.getTime());
    const endOffset = Math.min(totalMs, addDays(barEnd, 1).getTime() - minDate.getTime());

    const leftPercent = (startOffset / totalMs) * 100;
    const widthPercent = Math.max(1.5, ((endOffset - startOffset) / totalMs) * 100);

    return {
      left: `${leftPercent.toFixed(2)}%`,
      width: `${widthPercent.toFixed(2)}%`,
    };
  };

  // Summary Metrics (based on client's portfolio)
  const summary = useMemo(() => {
    const totalSites = clientSites.length;
    const activeCount = clientSites.filter(s => s.status === 'Active').length;
    const endedCount = clientSites.filter(s => s.status === 'Ended').length;
    let totalPumping = 0;
    let totalDiesel = 0;

    clientSites.forEach(s => {
      const logs = dailyMachineLogs.filter(l => l.siteId === s.id);
      totalPumping += logs.filter(l => l.isActive && l.operationalDay !== 'none').length;
      totalDiesel += logs.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
    });

    return {
      totalSites,
      activeCount,
      endedCount,
      totalPumping,
      totalDiesel,
    };
  }, [clientSites, dailyMachineLogs]);

  return (
    <div className={cn(
      "space-y-4 transition-all duration-200",
      isFullscreen && (
        "fixed z-[100] m-0 bg-slate-100 dark:bg-slate-950 border-none " +
        "md:inset-0 md:w-screen md:h-screen md:flex md:flex-col md:p-5 md:overflow-hidden md:rotate-0 " +
        "landscape:inset-0 landscape:w-screen landscape:h-screen landscape:flex landscape:flex-col landscape:p-3 landscape:overflow-hidden landscape:rotate-0 " +
        "portrait:top-1/2 portrait:left-1/2 portrait:w-[100vh] portrait:h-[100vw] portrait:-translate-x-1/2 portrait:-translate-y-1/2 portrait:rotate-90 portrait:flex portrait:flex-col portrait:p-3 portrait:overflow-hidden"
      )
    )}>
      {/* Floating Exit Button for Fullscreen / 90° Rotated View */}
      {isFullscreen && (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="fixed top-3 right-3 z-[120] rounded-full shadow-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 px-3 h-8 cursor-pointer"
          onClick={toggleFullscreen}
          title="Exit Landscape Mode"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="portrait:inline landscape:inline md:hidden">Exit 90°</span>
          <span className="hidden md:inline">Exit Full Page</span>
        </Button>
      )}

      {/* ── Control Bar: Structured 2-Tier Layout for Clean Hierarchy ── */}
      <div className={cn(
        "rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs p-3 space-y-3",
        isFullscreen && "p-2.5 space-y-2 rounded-xl"
      )}>
        {/* Tier 1: Primary View Switcher & Contextual Tools (Autofit on single row) */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5">
          {/* Left: Cards vs Gantt Switcher + Status Chips */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* View Switcher Toggle */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setViewType('cards')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer",
                  viewType === 'cards'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-sky-500" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewType('gantt')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer",
                  viewType === 'gantt'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Gantt</span>
              </button>
            </div>

            {/* KPI Badges */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <Building2 className="w-3 h-3 text-sky-500" />
                <span>{summary.totalSites} Sites</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-500/20 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{summary.activeCount} Active</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 font-medium text-[11px] border border-slate-300/40 dark:border-slate-700 whitespace-nowrap">
                <span>{summary.endedCount} Ended</span>
              </span>
              {summary.totalPumping > 0 && (
                <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium text-[11px] border border-sky-500/20 whitespace-nowrap">
                  <span>{summary.totalPumping}d Pumping</span>
                </span>
              )}
              {summary.totalDiesel > 0 && (
                <span className="hidden 2xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-[11px] border border-amber-500/20 whitespace-nowrap">
                  <span>{summary.totalDiesel.toLocaleString()}L Fuel</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Gantt Viewport Tools */}
          {viewType === 'gantt' && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 ml-auto">
              {/* Preset Selector */}
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value as DatePreset)}
                className="h-7.5 text-xs font-semibold px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
              >
                <option value="all">All-Time</option>
                <option value="30days">Last 30d</option>
                <option value="90days">Last 90d</option>
                <option value="6months">Last 6m</option>
                <option value="thisYear">This Year</option>
              </select>

              {/* Zoom Scale Segmented Buttons with Auto-Fit */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0">
                {(['fit', 'months', 'weeks', 'days'] as const).map(scale => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => {
                      setZoomScale(scale);
                      setUserZoomSelected(true);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] capitalize transition-all cursor-pointer whitespace-nowrap",
                      zoomScale === scale
                        ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {scale === 'fit' ? 'Auto-Fit' : scale === 'days' ? 'Days' : scale === 'weeks' ? 'Weeks' : 'Months'}
                  </button>
                ))}
              </div>

              {/* Full Page / Rotate 90° Button */}
              <Button
                type="button"
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-lg text-xs gap-1.5 font-bold transition-colors h-7.5 px-2.5",
                  isFullscreen
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                    : "border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 shadow-xs"
                )}
                title={isFullscreen ? "Exit Landscape View" : "Rotate 90° for Landscape Gantt View"}
              >
                {isFullscreen ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span className="sm:hidden">Exit 90°</span>
                    <span className="hidden sm:inline">Exit Full Page</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span className="sm:hidden">Rotate 90°</span>
                    <span className="hidden sm:inline">Full Page</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Tier 2: Search Bar, Status Filter Tabs & Sorting (Hidden in fullscreen on mobile for max chart space) */}
        {!isFullscreen && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            {/* Left: Search Input & Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Input with Search Icon & Clear Button */}
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search site..."
                  className="h-8 pl-8 pr-7 text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-lg w-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0">
                {(['all', 'active', 'ended'] as const).map(f => {
                  const count = f === 'all' ? summary.totalSites : f === 'active' ? summary.activeCount : summary.endedCount;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSiteFilter(f)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs capitalize transition-colors cursor-pointer",
                        siteFilter === f
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <span>{f}</span>
                      <span className={cn(
                        "text-[10px] px-1 py-0.2 rounded-full font-mono font-bold",
                        siteFilter === f
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          : "text-slate-400"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Sort Order Button & Active Count Indicator */}
            <div className="flex items-center gap-2.5 shrink-0 ml-auto">
              {(searchQuery || siteFilter !== 'all') && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  Showing {targetSites.length} of {summary.totalSites}
                </span>
              )}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                  isDark
                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
                title={`Sort by Start Date: currently ${sortOrder === 'asc' ? 'Earliest First (Chronological)' : 'Newest First'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="hidden sm:inline">Start Date:</span>
                <span className="font-bold text-slate-900 dark:text-white">{sortOrder === 'asc' ? 'Earliest' : 'Newest'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Portrait Quick Rotate Prompt Banner (shown in Gantt view when not rotated) */}
      {viewType === 'gantt' && !isFullscreen && (
        <div
          onClick={toggleFullscreen}
          className="sm:hidden flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-300/60 dark:border-sky-800 text-xs cursor-pointer hover:bg-sky-500/15 transition-all shadow-xs group"
        >
          <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-semibold min-w-0">
            <div className="p-1 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0 group-hover:rotate-90 transition-transform duration-300">
              <RotateCw className="w-4 h-4" />
            </div>
            <span className="truncate">Rotate 90° for full landscape view</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-xs shrink-0 flex items-center gap-1">
            <Smartphone className="w-3 h-3 rotate-90" />
            Rotate 90°
          </span>
        </div>
      )}

      {/* ── Cards View for Mobile & Compact Screens ── */}
      {viewType === 'cards' && (
        <div className="space-y-3">
          {siteBars.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No sites found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search or filters</p>
            </div>
          ) : (
            siteBars.map(bar => (
              <div
                key={bar.id}
                onClick={() => setSelectedBar(bar)}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-2.5"
              >
                {/* Site Header: Name, Status & Duration */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {bar.siteName}
                      </h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border inline-flex items-center gap-1",
                        bar.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" :
                        bar.status === 'On Hold' ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" :
                        "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      )}>
                        {bar.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        {bar.status}
                      </span>
                    </div>
                    {isAll && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{bar.clientName}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                      {bar.durationDays}d
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">duration</span>
                  </div>
                </div>

                {/* Timeline Dates and Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {format(bar.startDate, 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      ➔ {format(bar.endDate, 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                    <div
                      className={cn("h-full rounded-full transition-all", bar.status === 'Active' ? "bg-emerald-500" : bar.status === 'On Hold' ? "bg-amber-500" : "bg-slate-500")}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Operational Quick Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Pumping</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        {bar.activePumpingDays} Days
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-amber-500 font-bold text-xs shrink-0">⛽</span>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Fuel</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        {bar.totalDiesel.toLocaleString()} L
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                {onOpenSite360 && (
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSite360(bar.siteObj);
                      }}
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Open Site 360</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Multi-Site Master Gantt Chart (One Bar Per Site) ── */}
      {viewType === 'gantt' && (
      <div
        ref={timelineScrollRef}
        onMouseDown={handleTimelineMouseDown}
        className={cn(
          "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-auto style-scroll relative",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab",
          isFullscreen ? "flex-1 min-h-0 h-full" : "max-h-[calc(100vh-230px)] min-h-[420px] sm:min-h-[520px]"
        )}
      >
        <div style={{ minWidth: zoomScale === 'fit' ? '100%' : `${gridContainerWidth + 240}px` }}>
          
          {/* Sticky Header: Months & Granular Intervals (Fixed at Top) */}
          <div className="grid grid-cols-[240px_1fr] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs bg-slate-100 dark:bg-slate-800">
            {/* Sticky Top-Left Corner Box (Fixed on both X and Y axes) */}
            <div className="p-3 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 flex items-center justify-between sticky left-0 top-0 z-40 bg-slate-100 dark:bg-slate-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Sites ({targetSites.length})</span>
                </div>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-1 rounded cursor-pointer"
                  title={sortOrder === 'desc' ? 'Sorted by Newest Start Date (click for Earliest first)' : 'Sorted by Earliest Start Date (click for Newest first)'}
                >
                  {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-sky-500" /> : <ArrowUp className="w-3.5 h-3.5 text-sky-500" />}
                </button>
              </div>

              <div className="relative flex flex-col bg-slate-100 dark:bg-slate-800">
                {/* ── Month Top Row ── */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                  {calendarMonths.map((m, idx) => (
                    <div
                      key={idx}
                      style={{ width: `${(m.count / calendarDays.length) * 100}%` }}
                      className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-700 text-center uppercase tracking-wider truncate bg-slate-100 dark:bg-slate-800"
                    >
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">{m.label}</span>{' '}
                      <span className="font-normal text-slate-400 text-[10px]">{m.year}</span>
                    </div>
                  ))}
                </div>

                {/* ── Zoom Sub-Row: WEEKS or DAYS ── */}
                {zoomScale === 'days' && (
                  <div className="flex text-[10px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-800/90">
                    {calendarDays.map((day, idx) => {
                      const dayIsToday = isToday(day);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div
                          key={idx}
                          style={{ width: `${(1 / calendarDays.length) * 100}%` }}
                          className={cn(
                            "py-1.5 text-center border-r border-slate-200/80 dark:border-slate-700/60 select-none flex flex-col items-center justify-center",
                            dayIsToday && "bg-orange-100 text-orange-800 font-bold dark:bg-orange-950/40 dark:text-orange-300",
                            isWeekend && !dayIsToday && "bg-slate-100/60 dark:bg-slate-800/40 text-slate-400"
                          )}
                        >
                          <span className="leading-tight text-[11px] font-bold">{format(day, 'd')}</span>
                          <span className="text-[9px] opacity-70 leading-none">{format(day, 'EEE')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {zoomScale === 'weeks' && (
                  <div className="flex text-[10px] font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/90">
                    {calendarWeeks.map((weekStart, idx) => {
                      const weekEnd = addDays(weekStart, 6);
                      const isCurrentWeek = isWithinInterval(new Date(), { start: weekStart, end: weekEnd });
                      return (
                        <div
                          key={idx}
                          style={{ width: `${(7 / calendarDays.length) * 100}%` }}
                          className={cn(
                            "py-1.5 px-1 text-center border-r border-slate-200/80 dark:border-slate-700/60 truncate select-none",
                            isCurrentWeek && "bg-orange-50 text-orange-800 font-bold dark:bg-orange-950/30 dark:text-orange-300"
                          )}
                        >
                          <span>{format(weekStart, 'd')}–{format(weekEnd, 'd MMM')}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(zoomScale === 'months' || zoomScale === 'fit') && (
                  <div className="flex text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/60 py-1 px-2">
                    <span className="text-center w-full uppercase font-bold tracking-widest text-[9px]">
                      {zoomScale === 'fit' ? 'Auto-Fit Timeline' : 'Monthly Timeline'} ({sortOrder === 'asc' ? 'Sorted Chronologically: Earliest ➔ Newest' : 'Sorted: Newest ➔ Earliest'})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sites Rows */}
            <div className="relative divide-y divide-slate-100 dark:divide-slate-800/80">
              {/* Vertical TODAY Line */}
              {todayPercent && (
                <div
                  style={{ left: `calc(240px + (100% - 240px) * ${parseFloat(todayPercent) / 100})` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-orange-500 z-10 pointer-events-none"
                >
                  <div className="sticky top-14 -translate-x-1/2 px-2 py-0.5 rounded bg-orange-500 text-white text-[9px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
                    TODAY
                  </div>
                </div>
              )}

              {siteBars.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  No sites found matching the selected client or filter criteria.
                </div>
              ) : (
                siteBars.map(bar => {
                  const { left, width } = getBarLayout(bar.startDate, bar.endDate);

                  return (
                    <div
                      key={bar.id}
                      className="grid grid-cols-[240px_1fr] min-h-[58px] transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20 group"
                    >
                      {/* Sticky Left Site Header Column */}
                      <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center bg-white dark:bg-slate-900 sticky left-0 z-20 shadow-xs">
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            onClick={(e) => {
                              if (hasDragged.current) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                              }
                              onOpenSite360?.(bar.siteObj);
                            }}
                            className="font-bold text-xs text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left truncate flex items-center gap-1 cursor-pointer"
                          >
                            <span className="truncate">{bar.siteName}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-indigo-500" />
                          </button>

                          <Badge
                            className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0 h-4 rounded shrink-0",
                              bar.status === 'Active'
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : bar.status === 'On Hold'
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}
                          >
                            {bar.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                          <span className="truncate">{isAll ? bar.clientName : (bar.location || 'Site')}</span>
                          <span className="font-semibold text-slate-500">{bar.durationDays}d</span>
                        </div>
                      </div>

                      {/* Single Continuous Project Bar (Start Date -> End Date) */}
                      <div className="relative py-2.5 px-1 flex items-center min-h-[52px]">
                        <button
                          onClick={(e) => {
                            if (hasDragged.current) {
                              e.preventDefault();
                              e.stopPropagation();
                              return;
                            }
                            setSelectedBar(bar);
                          }}
                          style={{ left, width }}
                          title={`${bar.siteName} (${bar.durationDays} Days): ${format(bar.startDate, 'MMM d, yyyy')} ➔ ${format(bar.endDate, 'MMM d, yyyy')}`}
                          className={cn(
                            "absolute h-8 rounded-lg px-2.5 flex items-center justify-between gap-2",
                            "border text-left shadow-xs transition-all hover:brightness-110 hover:z-20 cursor-pointer overflow-hidden",
                            bar.flatBgClass,
                            bar.flatBorderClass
                          )}
                        >
                          <div className="min-w-0 flex-1 truncate flex items-center gap-2">
                            <span className="text-[11px] font-bold truncate leading-tight">
                              {bar.siteName}
                            </span>
                            <span className="text-[10px] opacity-85 truncate hidden md:inline">
                              · {format(bar.startDate, 'MMM d, yyyy')} ➔ {format(bar.endDate, 'MMM d, yyyy')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {bar.activePumpingDays > 0 && (
                              <span className="text-[9px] font-semibold px-1 rounded bg-black/20 text-white hidden sm:inline">
                                {bar.activePumpingDays}d pumping
                              </span>
                            )}
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/30 text-white">
                              {bar.durationDays} Days
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Site Project Summary Detail Modal ── */}
      {selectedBar && (
        <Dialog open={!!selectedBar} onOpenChange={() => setSelectedBar(null)}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl shadow-lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold px-2.5 py-0.5 rounded-md border uppercase",
                  selectedBar.status === 'Active' ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                  selectedBar.status === 'On Hold' ? "bg-amber-100 text-amber-800 border-amber-300" :
                  "bg-slate-100 text-slate-700 border-slate-300"
                )}>
                  {selectedBar.status}
                </span>
                <span className="text-xs text-slate-500 font-semibold">{selectedBar.clientName}</span>
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {selectedBar.siteName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 py-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Project Timeline</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {format(selectedBar.startDate, 'MMM d, yyyy')} ➔ {format(selectedBar.endDate, 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Duration</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{selectedBar.durationDays} Days</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Active Pumping</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{selectedBar.activePumpingDays} Days</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Diesel</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{selectedBar.totalDiesel.toLocaleString()} L</span>
                </div>
              </div>

              {selectedBar.machinesUsed.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Equipment Deployed</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedBar.machinesUsed.join(', ')}</p>
                </div>
              )}

              {selectedBar.holdNote && (
                <div>
                  <span className="text-amber-600 block text-[10px] uppercase font-bold mb-1">Hold / Suspension Note</span>
                  <p className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 leading-relaxed">
                    {selectedBar.holdNote}
                  </p>
                </div>
              )}

              {selectedBar.location && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Location</span>
                  <p className="text-slate-700 dark:text-slate-300">{selectedBar.location}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between w-full">
              {onOpenSite360 ? (
                <Button
                  onClick={() => {
                    setSelectedBar(null);
                    onOpenSite360(selectedBar.siteObj);
                  }}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 rounded-lg font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Site 360
                </Button>
              ) : <div />}

              <Button
                onClick={() => setSelectedBar(null)}
                variant="outline"
                size="sm"
                className="rounded-lg border-slate-300 dark:border-slate-700 text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
