import { useState, useMemo, useEffect } from 'react';
import {
  format, parseISO, differenceInDays, addDays, subDays, startOfMonth, endOfMonth,
  eachDayOfInterval, isToday, isWithinInterval, eachWeekOfInterval
} from 'date-fns';
import {
  Clock, CheckCircle2, AlertTriangle, Building2, MapPin, ExternalLink,
  Minimize2, Maximize2, PauseCircle, PlayCircle, Filter, Calendar, ArrowUpDown,
  ArrowUp, ArrowDown
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

type ZoomScale = 'months' | 'weeks' | 'days';
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
  const [zoomScale, setZoomScale] = useState<ZoomScale>('months');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [userZoomSelected, setUserZoomSelected] = useState(false);

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const isAll = selectedClient === 'ALL' || selectedClient === 'All Clients' || !selectedClient;

  // 1. Filter target sites
  const targetSites = useMemo(() => {
    return sites.filter(s => {
      if (!s.client || s.client.toUpperCase() === 'DCEL') return false;
      const matchesClient = isAll || s.client.trim().toLowerCase() === selectedClient.trim().toLowerCase();
      if (!matchesClient) return false;

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
  }, [sites, selectedClient, isAll, siteFilter, searchQuery]);

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
      if (totalDaysSpan <= 45) {
        setZoomScale('days');
      } else if (totalDaysSpan <= 180) {
        setZoomScale('weeks');
      } else {
        setZoomScale('months');
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
    if (calendarDays.length === 0) return [];
    const groups: { label: string; year: string; count: number; startIdx: number }[] = [];
    let currentLabel = '';
    let currentYear = '';
    let count = 0;
    let startIdx = 0;

    calendarDays.forEach((day, idx) => {
      const label = format(day, 'MMM');
      const year = format(day, 'yyyy');
      const full = `${label} ${year}`;
      if (full !== currentLabel) {
        if (currentLabel) {
          groups.push({
            label: currentLabel.split(' ')[0],
            year: currentYear,
            count,
            startIdx,
          });
        }
        currentLabel = full;
        currentYear = year;
        count = 1;
        startIdx = idx;
      } else {
        count++;
      }
    });
    if (count > 0) {
      groups.push({
        label: currentLabel.split(' ')[0],
        year: currentYear,
        count,
        startIdx,
      });
    }
    return groups;
  }, [calendarDays]);

  // Dynamic Content Width for horizontal scrolling
  const gridContainerWidth = useMemo(() => {
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

  // Summary Metrics
  const summary = useMemo(() => {
    const activeCount = targetSites.filter(s => s.status === 'Active').length;
    const endedCount = targetSites.filter(s => s.status === 'Ended').length;
    let totalPumping = 0;
    let totalDiesel = 0;

    targetSites.forEach(s => {
      const logs = dailyMachineLogs.filter(l => l.siteId === s.id);
      totalPumping += logs.filter(l => l.isActive && l.operationalDay !== 'none').length;
      totalDiesel += logs.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
    });

    return {
      totalSites: targetSites.length,
      activeCount,
      endedCount,
      totalPumping,
      totalDiesel,
    };
  }, [targetSites, dailyMachineLogs]);

  return (
    <div className={cn(
      "space-y-5 transition-all duration-200",
      isFullscreen && "fixed inset-0 z-50 p-4 md:p-6 bg-slate-100/95 dark:bg-slate-950/98 backdrop-blur-xl overflow-y-auto"
    )}>
      {/* ── Single Compact Header & Control Bar (One Succinct Row) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        
        {/* Left Side: Client Identity & Compact KPI Badges */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Client Title */}
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white shrink-0 pr-1">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="truncate max-w-[180px]">{isAll ? 'All Clients' : selectedClient}</span>
            <span className="text-[11px] font-semibold text-slate-400">({summary.totalSites})</span>
          </div>

          {/* Compact Metric Badges (Pills) */}
          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {summary.activeCount} Active
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700">
              {summary.endedCount} Ended
            </span>

            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold text-[11px] border border-sky-200 dark:border-sky-800">
              {summary.totalPumping}d Pumping
            </span>

            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold text-[11px] border border-indigo-200 dark:border-indigo-800">
              {summary.totalDiesel.toLocaleString()}L Fuel
            </span>
          </div>
        </div>

        {/* Right Side: Search, Filter, Sort, Range, Scale, Fullscreen */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Search */}
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search site..."
            className="h-7 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 w-[120px] sm:w-[140px] px-2"
          />

          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs shrink-0">
            {(['all', 'active', 'ended'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSiteFilter(f)}
                className={cn(
                  "px-2 py-0.5 rounded-md font-semibold text-[11px] capitalize transition-colors",
                  siteFilter === f
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sort By Start Date Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className={cn(
              "flex items-center gap-1 h-7 px-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer shrink-0",
              isDark ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            )}
            title={`Sort by Start Date: currently ${sortOrder === 'asc' ? 'Earliest First (Chronological)' : 'Newest First'}`}
          >
            <ArrowUpDown className="w-3 h-3 text-indigo-500 shrink-0" />
            <span className="hidden sm:inline">Start Date:</span>
            <span>{sortOrder === 'asc' ? 'Earliest' : 'Newest'}</span>
          </button>

          {/* Period Range Presets */}
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value as DatePreset)}
            className="h-7 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
          >
            <option value="all">All-Time</option>
            <option value="30days">Last 30d</option>
            <option value="90days">Last 90d</option>
            <option value="6months">Last 6m</option>
            <option value="thisYear">This Year</option>
          </select>

          {/* Scale Control */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs shrink-0">
            {(['months', 'weeks', 'days'] as const).map(scale => (
              <button
                key={scale}
                onClick={() => {
                  setZoomScale(scale);
                  setUserZoomSelected(true);
                }}
                className={cn(
                  "px-2 py-0.5 rounded-md font-semibold text-[11px] capitalize transition-colors",
                  zoomScale === scale
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {scale === 'days' ? 'Days' : scale === 'weeks' ? 'Weeks' : 'Months'}
              </button>
            ))}
          </div>

          {/* Full Page Button */}
          <Button
            onClick={() => setIsFullscreen(!isFullscreen)}
            variant="outline"
            size="sm"
            className="rounded-lg text-[11px] gap-1 font-semibold border-slate-200 dark:border-slate-700 h-7 px-2"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3 h-3 text-amber-600" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 text-slate-500" />
                <span className="hidden sm:inline">Full Page</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Multi-Site Master Gantt Chart (One Bar Per Site) ── */}
      <div className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-auto style-scroll relative",
        isFullscreen ? "max-h-[calc(100vh-140px)]" : "max-h-[calc(100vh-230px)] min-h-[520px]"
      )}>
        <div style={{ minWidth: `${gridContainerWidth + 240}px` }}>
          
          {/* Sticky Header: Months & Granular Intervals (Fixed at Top) */}
          <div className="grid grid-cols-[240px_1fr] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs bg-slate-100 dark:bg-slate-800">
            {/* Sticky Top-Left Corner Box (Fixed on both X and Y axes) */}
            <div className="p-3 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 flex items-center justify-between sticky left-0 top-0 z-40 bg-slate-100 dark:bg-slate-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Sites ({targetSites.length})</span>
                </div>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded"
                  title={`Toggle Sort (${sortOrder === 'asc' ? 'Earliest Start First' : 'Newest Start First'})`}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />}
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

                {zoomScale === 'months' && (
                  <div className="flex text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/60 py-1 px-2">
                    <span className="text-center w-full uppercase font-bold tracking-widest text-[9px]">
                      Project Duration ({sortOrder === 'asc' ? 'Sorted Chronologically: Earliest ➔ Newest' : 'Sorted: Newest ➔ Earliest'})
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
                            onClick={() => onOpenSite360?.(bar.siteObj)}
                            className="font-bold text-xs text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left truncate flex items-center gap-1"
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
                          onClick={() => setSelectedBar(bar)}
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
