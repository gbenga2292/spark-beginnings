import { useState, useMemo, useEffect } from 'react';
import {
  format, parseISO, differenceInDays, addDays, subDays, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday, isWithinInterval, eachWeekOfInterval
} from 'date-fns';
import {
  Clock, Play, Pause, Wrench, Truck, Droplets, Fuel, Plus, Layers, Eye,
  Maximize2, Minimize2, Check, Trash2, ChevronRight, AlertTriangle, CheckCircle2,
  Filter, Sparkles, X, Calendar
} from 'lucide-react';
import { useAppStore, Site, DewateringStage, SiteTimelineEvent, SiteTimelineEventType } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useTheme } from '@/src/hooks/useTheme';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { cn, generateId } from '@/src/lib/utils';
import { toast } from '@/src/components/ui/toast';
import { useUserStore } from '@/src/store/userStore';

interface Props {
  site: Site;
}

interface TimelineBar {
  id: string;
  lane: 'mobilisation' | 'jetting' | 'pumping' | 'downtime' | 'hold' | 'demob';
  title: string;
  subtitle?: string;
  startDate: Date;
  endDate: Date;
  flatBgClass: string;
  flatBorderClass: string;
  badgeClass: string;
  status: 'completed' | 'active' | 'upcoming' | 'interrupted';
  details: {
    durationDays: number;
    machineName?: string;
    dieselLitres?: number;
    reason?: string;
    narration?: string;
    loggedBy?: string;
    source: 'waybill' | 'journal' | 'machinelog' | 'holdperiod' | 'manual';
    rawId?: string;
  };
}

export function SiteGanttStoryboard({ site }: Props) {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dailyMachineLogs, waybills, siteHoldPeriods } = useOperations();
  const { siteJournalEntries, dailyJournals, siteTimelineEvents = [], addSiteTimelineEvent, deleteSiteTimelineEvent } = useAppStore();

  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [activeBar, setActiveBar] = useState<TimelineBar | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'feed'>('gantt');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState<'days' | 'weeks' | 'months'>('days');
  const [userZoomSelected, setUserZoomSelected] = useState(false);

  // Escape key handler for full page mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Manual Event Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualForm, setManualForm] = useState<{
    title: string;
    eventType: SiteTimelineEventType;
    startDate: string;
    endDate: string;
    notes: string;
  }>({
    title: '',
    eventType: 'jetting',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  // 1. Gather all site data
  const siteLogs = useMemo(() => {
    return dailyMachineLogs
      .filter(l => l.siteId === site.id || l.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyMachineLogs, site.id, site.name]);

  const siteJournals = useMemo(() => {
    return siteJournalEntries
      .filter(e => e.siteId === site.id || e.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase())
      .map(entry => {
        const j = dailyJournals.find(dj => dj.id === entry.journalId);
        return {
          ...entry,
          journalDate: j?.date || entry.createdAt?.split('T')[0] || format(new Date(), 'yyyy-MM-dd'),
        };
      })
      .sort((a, b) => a.journalDate.localeCompare(b.journalDate));
  }, [siteJournalEntries, dailyJournals, site.id, site.name]);

  const siteWaybills = useMemo(() => {
    return waybills
      .filter(w => w.siteId === site.id || w.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase())
      .sort((a, b) => (a.issueDate || '').localeCompare(b.issueDate || ''));
  }, [waybills, site.id, site.name]);

  const siteHolds = useMemo(() => {
    return siteHoldPeriods
      .filter(h => h.siteId === site.id || h.siteName?.trim().toLowerCase() === site.name.trim().toLowerCase())
      .sort((a, b) => a.holdStart.localeCompare(b.holdStart));
  }, [siteHoldPeriods, site.id, site.name]);

  const manualEvents = useMemo(() => {
    return siteTimelineEvents
      .filter(e => e.siteId === site.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [siteTimelineEvents, site.id]);

  // Unique machines on this site
  const machineOptions = useMemo(() => {
    const set = new Set<string>();
    siteLogs.forEach(l => {
      if (l.assetName) set.add(l.assetName);
    });
    return Array.from(set);
  }, [siteLogs]);

  // 2. Synthesize Multi-Track Timeline Bars
  const timelineBars = useMemo(() => {
    const bars: TimelineBar[] = [];

    // ── Track 1: Mobilisation ──
    const mobWaybills = siteWaybills.filter(w => w.type === 'waybill');
    if (mobWaybills.length > 0) {
      const firstMob = mobWaybills[0];
      const start = parseISO(firstMob.sentToSiteDate || firstMob.issueDate);
      const end = mobWaybills.length > 1 
        ? parseISO(mobWaybills[mobWaybills.length - 1].issueDate) 
        : addDays(start, 2);
      bars.push({
        id: `mob-${firstMob.id}`,
        lane: 'mobilisation',
        title: 'Site Mobilisation & Setup',
        subtitle: `${mobWaybills.length} waybill(s) sent`,
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: 'bg-blue-600 text-white',
        flatBorderClass: 'border-blue-700',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
        status: 'completed',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          narration: firstMob.purpose || 'Equipment dispatched and staging on site',
          source: 'waybill',
          rawId: firstMob.id,
        }
      });
    } else {
      const mobJournals = siteJournals.filter(j => j.dewateringStage === 'mobilization');
      if (mobJournals.length > 0) {
        const start = parseISO(mobJournals[0].journalDate);
        const end = parseISO(mobJournals[mobJournals.length - 1].journalDate);
        bars.push({
          id: `mob-journal-${mobJournals[0].id}`,
          lane: 'mobilisation',
          title: 'Site Mobilisation',
          startDate: start,
          endDate: end < start ? start : end,
          flatBgClass: 'bg-blue-600 text-white',
          flatBorderClass: 'border-blue-700',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
          status: 'completed',
          details: {
            durationDays: Math.max(1, differenceInDays(end, start) + 1),
            narration: mobJournals[0].narration,
            source: 'journal',
          }
        });
      }
    }

    // ── Track 2: Jetting & Re-jetting Intervals ──
    const jettingEntries = siteJournals.filter(j => 
      j.dewateringStage === 'jetting' || 
      j.dewateringStage === 'rejetting' || 
      j.dewateringStage === 'installation' ||
      /jetting|re-jet|rejet|wellpoint install/i.test(j.narration || '')
    );

    let currentJetGroup: typeof jettingEntries = [];
    let jetIndex = 1;

    const flushJetGroup = () => {
      if (currentJetGroup.length === 0) return;
      const start = parseISO(currentJetGroup[0].journalDate);
      const end = parseISO(currentJetGroup[currentJetGroup.length - 1].journalDate);
      const isRejet = currentJetGroup.some(g => g.dewateringStage === 'rejetting' || /re-jet|rejet/i.test(g.narration || '')) || jetIndex > 1;
      
      bars.push({
        id: `jet-${currentJetGroup[0].id}`,
        lane: 'jetting',
        title: isRejet ? `Re-Jetting Campaign #${jetIndex}` : `Initial Wellpoint Jetting`,
        subtitle: `${currentJetGroup.length} day(s)`,
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: isRejet ? 'bg-teal-600 text-white' : 'bg-sky-600 text-white',
        flatBorderClass: isRejet ? 'border-teal-700' : 'border-sky-700',
        badgeClass: isRejet
          ? 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700'
          : 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700',
        status: 'completed',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          narration: currentJetGroup.map(g => g.narration).filter(Boolean).join(' | '),
          loggedBy: currentJetGroup[0].loggedBy,
          source: 'journal',
        }
      });
      jetIndex++;
      currentJetGroup = [];
    };

    jettingEntries.forEach((entry) => {
      if (currentJetGroup.length === 0) {
        currentJetGroup.push(entry);
      } else {
        const lastDate = parseISO(currentJetGroup[currentJetGroup.length - 1].journalDate);
        const thisDate = parseISO(entry.journalDate);
        if (differenceInDays(thisDate, lastDate) > 3) {
          flushJetGroup();
        }
        currentJetGroup.push(entry);
      }
    });
    flushJetGroup();

    // ── Track 3: Machine Operations (Continuous Running vs Stoppages) ──
    const filteredLogs = selectedMachine === 'all' 
      ? siteLogs 
      : siteLogs.filter(l => l.assetName === selectedMachine);

    let activeRun: typeof filteredLogs = [];
    let downtimeRun: typeof filteredLogs = [];

    const flushActiveRun = () => {
      if (activeRun.length === 0) return;
      const start = parseISO(activeRun[0].date);
      const end = parseISO(activeRun[activeRun.length - 1].date);
      const totalDiesel = activeRun.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
      const machineNames = Array.from(new Set(activeRun.map(l => l.assetName))).join(', ');

      bars.push({
        id: `pumping-${activeRun[0].id}`,
        lane: 'pumping',
        title: `Active Pumping (${activeRun.length}d)`,
        subtitle: `${machineNames} • ${totalDiesel.toLocaleString()}L`,
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: 'bg-emerald-600 text-white',
        flatBorderClass: 'border-emerald-700',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
        status: isWithinInterval(new Date(), { start, end }) ? 'active' : 'completed',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          machineName: machineNames,
          dieselLitres: totalDiesel,
          loggedBy: activeRun[0].supervisorOnSite,
          source: 'machinelog',
        }
      });
      activeRun = [];
    };

    const flushDowntimeRun = () => {
      if (downtimeRun.length === 0) return;
      const start = parseISO(downtimeRun[0].date);
      const end = parseISO(downtimeRun[downtimeRun.length - 1].date);
      const reasons = downtimeRun
        .map(l => l.downtimeEntries?.map(d => d.reason).join(', ') || l.issuesOnSite || 'Machine Stoppage')
        .filter(Boolean)
        .join('; ');

      bars.push({
        id: `downtime-${downtimeRun[0].id}`,
        lane: 'downtime',
        title: `Machine Stoppage (${downtimeRun.length}d)`,
        subtitle: reasons.slice(0, 35) + (reasons.length > 35 ? '...' : ''),
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: 'bg-rose-500 text-white',
        flatBorderClass: 'border-rose-600',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700',
        status: 'interrupted',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          reason: reasons,
          source: 'machinelog',
        }
      });
      downtimeRun = [];
    };

    filteredLogs.forEach((log) => {
      const isRunning = log.isActive && log.operationalDay !== 'none';
      if (isRunning) {
        flushDowntimeRun();
        activeRun.push(log);
      } else {
        flushActiveRun();
        downtimeRun.push(log);
      }
    });
    flushActiveRun();
    flushDowntimeRun();

    // ── Track 4: Site Holds / Suspensions ──
    siteHolds.forEach((hold) => {
      const start = parseISO(hold.holdStart);
      const end = hold.holdEnd ? parseISO(hold.holdEnd) : new Date();
      bars.push({
        id: `hold-${hold.id}`,
        lane: 'hold',
        title: `Site Suspended / On Hold`,
        subtitle: hold.holdNote.slice(0, 35) + (hold.holdNote.length > 35 ? '...' : ''),
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: 'bg-amber-500 text-white',
        flatBorderClass: 'border-amber-600',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
        status: hold.holdEnd ? 'completed' : 'active',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          reason: hold.holdNote,
          narration: hold.resumeNote ? `Resumed: ${hold.resumeNote}` : 'Currently suspended',
          loggedBy: hold.createdBy,
          source: 'holdperiod',
          rawId: hold.id,
        }
      });
    });

    // ── Track 5: Demobilisation ──
    const returnWaybills = siteWaybills.filter(w => w.type === 'return');
    if (returnWaybills.length > 0) {
      const start = parseISO(returnWaybills[0].issueDate);
      const end = parseISO(returnWaybills[returnWaybills.length - 1].issueDate);
      bars.push({
        id: `demob-${returnWaybills[0].id}`,
        lane: 'demob',
        title: `Demobilisation & Recovery`,
        subtitle: `${returnWaybills.length} return waybill(s)`,
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: 'bg-indigo-600 text-white',
        flatBorderClass: 'border-indigo-700',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
        status: site.status === 'Ended' ? 'completed' : 'active',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          narration: 'Equipment retrieved and returned from site',
          source: 'waybill',
        }
      });
    }

    // ── Track Manual Events ──
    manualEvents.forEach((ev) => {
      const start = parseISO(ev.startDate);
      const end = ev.endDate ? parseISO(ev.endDate) : start;
      const laneMap: Record<SiteTimelineEventType, TimelineBar['lane']> = {
        mobilisation: 'mobilisation',
        jetting: 'jetting',
        rejetting: 'jetting',
        machine_operation: 'pumping',
        machine_downtime: 'downtime',
        hold: 'hold',
        demobilisation: 'demob',
        milestone: 'jetting',
        custom: 'jetting',
      };

      bars.push({
        id: `manual-${ev.id}`,
        lane: laneMap[ev.eventType] || 'jetting',
        title: ev.title,
        subtitle: ev.notes?.slice(0, 30),
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: ev.eventType === 'rejetting' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-white',
        flatBorderClass: 'border-slate-800',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200',
        status: 'completed',
        details: {
          durationDays: Math.max(1, differenceInDays(end, start) + 1),
          narration: ev.notes,
          loggedBy: ev.loggedBy,
          source: 'manual',
          rawId: ev.id,
        }
      });
    });

    return bars.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [siteWaybills, siteJournals, siteLogs, siteHolds, manualEvents, selectedMachine, site.status]);

  // 3. Compute Project Time Bounds
  const { minDate, maxDate, totalDaysSpan } = useMemo(() => {
    if (timelineBars.length === 0) {
      const today = new Date();
      return {
        minDate: startOfMonth(subDays(today, 15)),
        maxDate: endOfMonth(addDays(today, 15)),
        totalDaysSpan: 30,
      };
    }
    const allStarts = timelineBars.map(b => b.startDate.getTime());
    const allEnds = timelineBars.map(b => b.endDate.getTime());
    allEnds.push(new Date().getTime());

    const earliest = new Date(Math.min(...allStarts));
    const latest = new Date(Math.max(...allEnds));

    const min = startOfMonth(subDays(earliest, 3));
    const max = endOfMonth(addDays(latest, 4));
    const totalDays = differenceInDays(max, min) + 1;

    return {
      minDate: min,
      maxDate: max,
      totalDaysSpan: totalDays,
    };
  }, [timelineBars]);

  // Auto-tune Zoom Scale based on date span if user hasn't explicitly set it
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

  // Day columns
  const calendarDays = useMemo(() => {
    try {
      return eachDayOfInterval({ start: minDate, end: maxDate });
    } catch {
      return [];
    }
  }, [minDate, maxDate]);

  // Week columns
  const calendarWeeks = useMemo(() => {
    try {
      return eachWeekOfInterval({ start: minDate, end: maxDate }, { weekStartsOn: 1 });
    } catch {
      return [];
    }
  }, [minDate, maxDate]);

  // Month Groups for the header
  const calendarMonths = useMemo(() => {
    if (calendarDays.length === 0) return [];
    const groups: { label: string; year: string; count: number; startIdx: number }[] = [];
    let currentLabel = '';
    let currentYear = '';
    let count = 0;
    let startIdx = 0;

    calendarDays.forEach((day, idx) => {
      const label = format(day, 'MMMM');
      const year = format(day, 'yyyy');
      const full = `${label} ${year}`;
      if (full !== currentLabel) {
        if (currentLabel) {
          groups.push({ label: currentLabel.split(' ')[0], year: currentYear, count, startIdx });
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
      groups.push({ label: currentLabel.split(' ')[0], year: currentYear, count, startIdx });
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
    return Math.max(920, calendarMonths.length * 140);
  }, [zoomScale, calendarDays, calendarWeeks, calendarMonths]);

  // 4. Calculate KPIs
  const kpis = useMemo(() => {
    const totalPumpingDays = siteLogs.filter(l => l.isActive && l.operationalDay !== 'none').length;
    const totalDowntimeDays = siteLogs.filter(l => !l.isActive || l.operationalDay === 'none').length;
    const totalDiesel = siteLogs.reduce((sum, l) => sum + (l.dieselUsage || 0), 0);
    const jettingCount = timelineBars.filter(b => b.lane === 'jetting').length;
    const holdCount = siteHolds.length;
    const projectSpan = timelineBars.length > 0
      ? differenceInDays(
          site.status === 'Ended' && site.endDate ? parseISO(site.endDate) : new Date(),
          timelineBars[0].startDate
        ) + 1
      : 0;

    return {
      projectSpan: Math.max(0, projectSpan),
      totalPumpingDays,
      totalDowntimeDays,
      totalDiesel,
      jettingCount,
      holdCount,
    };
  }, [siteLogs, timelineBars, siteHolds, site.status, site.endDate]);

  // Save manual milestone
  const handleSaveManualEvent = () => {
    if (!manualForm.title.trim()) {
      toast.error('Please enter an event title');
      return;
    }
    const newEvent: SiteTimelineEvent = {
      id: generateId(),
      siteId: site.id,
      siteName: site.name,
      title: manualForm.title.trim(),
      eventType: manualForm.eventType,
      startDate: manualForm.startDate,
      endDate: manualForm.endDate || manualForm.startDate,
      notes: manualForm.notes.trim(),
      loggedBy: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString(),
    };

    addSiteTimelineEvent(newEvent);
    toast.success('Milestone event recorded on Storyboard');
    setShowAddModal(false);
    setManualForm({
      title: '',
      eventType: 'jetting',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
  };

  const handleDeleteEvent = (id?: string) => {
    if (!id) return;
    deleteSiteTimelineEvent(id);
    toast.success('Milestone event removed');
    setActiveBar(null);
  };

  // Helper to compute percentage position on horizontal timeline
  const getBarLayout = (barStart: Date, barEnd: Date) => {
    const totalMs = maxDate.getTime() - minDate.getTime();
    if (totalMs <= 0) return { left: '0%', width: '100%' };

    const startOffset = Math.max(0, barStart.getTime() - minDate.getTime());
    const endOffset = Math.min(totalMs, addDays(barEnd, 1).getTime() - minDate.getTime());

    const leftPercent = (startOffset / totalMs) * 100;
    const widthPercent = Math.max(1.8, ((endOffset - startOffset) / totalMs) * 100);

    return {
      left: `${leftPercent.toFixed(2)}%`,
      width: `${widthPercent.toFixed(2)}%`,
    };
  };

  // Compute Today line position
  const todayPercent = useMemo(() => {
    const totalMs = maxDate.getTime() - minDate.getTime();
    const todayMs = new Date().getTime() - minDate.getTime();
    if (totalMs <= 0 || todayMs < 0 || todayMs > totalMs) return null;
    return `${((todayMs / totalMs) * 100).toFixed(2)}%`;
  }, [minDate, maxDate]);

  // Lanes Definition
  const lanes = [
    {
      id: 'mobilisation',
      name: '1. Mobilisation & Setup',
      icon: <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      desc: 'Crew dispatched, equipment delivered & setup',
    },
    {
      id: 'jetting',
      name: '2. Jetting & Re-Jetting',
      icon: <Droplets className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
      desc: 'Initial wellpoint jetting & re-jetting campaigns',
    },
    {
      id: 'pumping',
      name: '3. Machine Operations',
      icon: <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      desc: 'Active pumping runs & fuel usage',
    },
    {
      id: 'downtime',
      name: '4. Stoppage & Off-Days',
      icon: <Pause className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
      desc: 'Machine turned off, rain stoppage or repairs',
    },
    {
      id: 'hold',
      name: '5. Client Holds / Suspensions',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      desc: 'Formal site hold periods & excavation delays',
    },
    {
      id: 'demob',
      name: '6. Demobilisation',
      icon: <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      desc: 'Equipment retrieval & site closeout',
    },
  ] as const;

  return (
    <div className={cn(
      "space-y-5 transition-all duration-200",
      isFullscreen && "fixed inset-0 z-50 p-4 md:p-6 bg-slate-100/95 dark:bg-slate-950/98 backdrop-blur-xl overflow-y-auto"
    )}>
      {/* ── Single Compact Header & Control Bar (One Succinct Row) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        
        {/* Left Side: Site Identity & Compact KPI Badges */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Site Title */}
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white shrink-0 pr-1">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center font-bold text-white text-[11px]">
              {site.name.charAt(0)}
            </div>
            <span className="truncate max-w-[160px]">{site.name}</span>
            {site.client && (
              <span className="text-[11px] font-normal text-slate-400 truncate max-w-[120px]">· {site.client}</span>
            )}
          </div>

          {/* Compact Metric Badges (Pills) */}
          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700">
              <Clock className="w-3 h-3 text-slate-400" />
              {kpis.projectSpan}d on Site
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800">
              <Play className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
              {kpis.totalPumpingDays}d Pumping
            </span>

            {kpis.totalDowntimeDays > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-semibold text-[11px] border border-rose-200 dark:border-rose-800">
                <Pause className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                {kpis.totalDowntimeDays}d Stopped
              </span>
            )}

            {kpis.jettingCount > 0 && (
              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold text-[11px] border border-sky-200 dark:border-sky-800">
                <Droplets className="w-3 h-3 text-sky-500" />
                {kpis.jettingCount} Jetting
              </span>
            )}

            {kpis.holdCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold text-[11px] border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                {kpis.holdCount} Holds
              </span>
            )}

            <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold text-[11px] border border-indigo-200 dark:border-indigo-800">
              <Fuel className="w-3 h-3 text-indigo-500" />
              {kpis.totalDiesel.toLocaleString()}L
            </span>
          </div>
        </div>

        {/* Right Side: Machine Filter, View Toggle, Scale, Add Event, Fullscreen */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Machine Filter Dropdown */}
          {machineOptions.length > 1 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px]">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={selectedMachine}
                onChange={e => setSelectedMachine(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-white font-semibold focus:outline-none cursor-pointer h-6 text-[11px]"
              >
                <option value="all">All Machines ({machineOptions.length})</option>
                {machineOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setViewMode('gantt')}
              className={cn(
                "px-2 py-0.5 rounded-md font-semibold text-[11px] transition-all flex items-center gap-1",
                viewMode === 'gantt'
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Layers className="w-3 h-3" />
              Gantt
            </button>
            <button
              onClick={() => setViewMode('feed')}
              className={cn(
                "px-2 py-0.5 rounded-md font-semibold text-[11px] transition-all flex items-center gap-1",
                viewMode === 'feed'
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Eye className="w-3 h-3" />
              Feed
            </button>
          </div>

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

          {/* Add Milestone Button */}
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-[11px] gap-1 h-7 px-2.5 shadow-xs"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Record Milestone</span>
          </Button>

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

      {/* ── Main Gantt Chart Grid (Flat Clean UI) ── */}
      {viewMode === 'gantt' ? (
        <div className={cn(
          "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-auto style-scroll relative",
          isFullscreen ? "max-h-[calc(100vh-140px)]" : "max-h-[calc(100vh-230px)] min-h-[520px]"
        )}>
          <div style={{ minWidth: `${gridContainerWidth + 230}px` }}>
            {/* Timeline Header (Months & Days) */}
            <div className="grid grid-cols-[230px_1fr] border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-30 shadow-xs">
              <div className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 sticky left-0 top-0 z-40 shadow-xs">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Operational Lane
              </div>

                <div className="relative flex flex-col">
                  {/* Month Row */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                    {calendarMonths.map((m, idx) => (
                      <div
                        key={idx}
                        style={{ width: `${(m.count / calendarDays.length) * 100}%` }}
                        className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 text-center uppercase tracking-wider truncate bg-slate-100/80 dark:bg-slate-800"
                      >
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">{m.label}</span>{' '}
                        <span className="font-normal text-slate-400 text-[10px]">{m.year}</span>
                      </div>
                    ))}
                  </div>

                  {/* Day Ticks Row */}
                  {zoomScale === 'days' && (
                    <div className="flex text-[10px] font-medium text-slate-500">
                      {calendarDays.map((day, idx) => {
                        const dayIsToday = isToday(day);
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        return (
                          <div
                            key={idx}
                            style={{ width: `${(1 / calendarDays.length) * 100}%` }}
                            className={cn(
                              "py-1.5 text-center border-r border-slate-100 dark:border-slate-800/60 select-none flex flex-col items-center justify-center",
                              dayIsToday && "bg-orange-100 text-orange-800 font-bold dark:bg-orange-950/40 dark:text-orange-300",
                              isWeekend && !dayIsToday && "bg-slate-100/50 dark:bg-slate-800/30 text-slate-400"
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
                    <div className="flex text-[10px] font-semibold text-slate-500">
                      {calendarWeeks.map((weekStart, idx) => {
                        const weekEnd = addDays(weekStart, 6);
                        const isCurrentWeek = isWithinInterval(new Date(), { start: weekStart, end: weekEnd });
                        return (
                          <div
                            key={idx}
                            style={{ width: `${(7 / calendarDays.length) * 100}%` }}
                            className={cn(
                              "py-1.5 px-1 text-center border-r border-slate-100 dark:border-slate-800/60 truncate select-none",
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
                    <div className="flex text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/40 py-1 px-2">
                      <span className="text-center w-full uppercase font-bold tracking-widest text-[9px]">
                        Quarterly & Monthly Overview Scale
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lanes Body */}
              <div className="relative divide-y divide-slate-100 dark:divide-slate-800/80">
                {/* Vertical "TODAY" Line (Crisp Flat Orange Marker) */}
                {todayPercent && (
                  <div
                    style={{ left: `calc(230px + (100% - 230px) * ${parseFloat(todayPercent) / 100})` }}
                    className="absolute top-0 bottom-0 w-[2px] bg-orange-500 z-10 pointer-events-none"
                  >
                    <div className="sticky top-12 -translate-x-1/2 px-2 py-0.5 rounded bg-orange-500 text-white text-[9px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
                      TODAY
                    </div>
                  </div>
                )}

                {lanes.map((lane) => {
                  const laneBars = timelineBars.filter(b => b.lane === lane.id);

                  return (
                    <div
                      key={lane.id}
                      className="grid grid-cols-[230px_1fr] min-h-[64px] transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                    >
                      {/* Lane Label */}
                      <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100">
                          {lane.icon}
                          <span>{lane.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{lane.desc}</span>
                      </div>

                      {/* Lane Timeline Track with vertical day grid guides */}
                      <div className="relative py-2.5 px-1 flex items-center min-h-[58px]">
                        {laneBars.length === 0 ? (
                          <div className="text-xs text-slate-400 italic pl-3 select-none">
                            No records in this phase
                          </div>
                        ) : (
                          laneBars.map((bar) => {
                            const { left, width } = getBarLayout(bar.startDate, bar.endDate);

                            return (
                              <button
                                key={bar.id}
                                onClick={() => setActiveBar(bar)}
                                style={{ left, width }}
                                className={cn(
                                  "absolute h-9 rounded-lg px-2.5 flex items-center justify-between gap-1.5",
                                  "border text-left shadow-xs transition-all hover:brightness-105 hover:z-20 cursor-pointer",
                                  bar.flatBgClass,
                                  bar.flatBorderClass
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold truncate leading-tight flex items-center gap-1.5">
                                    {bar.status === 'active' && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                                    )}
                                    <span className="truncate">{bar.title}</span>
                                  </div>
                                  {bar.subtitle && (
                                    <div className="text-[10px] opacity-90 truncate leading-tight font-normal">
                                      {bar.subtitle}
                                    </div>
                                  )}
                                </div>

                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/20 text-white whitespace-nowrap">
                                  {bar.details.durationDays}d
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
      ) : (
        /* ── Chronological Story Feed View (Flat) ── */
        <div className="space-y-4">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Operational Log History for {site.name}
          </div>

          {timelineBars.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400">
              No operational events logged yet for this site.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
              {timelineBars.map((bar) => (
                <div key={bar.id} className="relative group">
                  <div className="absolute -left-6 top-2 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-950 shadow-xs" />

                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-400 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-md border", bar.badgeClass)}>
                          {bar.lane.toUpperCase()}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{bar.title}</h4>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {format(bar.startDate, 'MMM d, yyyy')}
                        {!isSameDay(bar.startDate, bar.endDate) && ` ➔ ${format(bar.endDate, 'MMM d, yyyy')}`}
                        <span className="ml-1.5 font-bold text-indigo-600 dark:text-indigo-400">({bar.details.durationDays} days)</span>
                      </span>
                    </div>

                    {bar.details.narration && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        {bar.details.narration}
                      </p>
                    )}

                    {bar.details.reason && (
                      <p className="mt-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800">
                        <strong>Reason / Stoppage:</strong> {bar.details.reason}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      {bar.details.machineName && (
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3.5 h-3.5 text-slate-400" /> Machine: <strong>{bar.details.machineName}</strong>
                        </span>
                      )}
                      {bar.details.dieselLitres !== undefined && bar.details.dieselLitres > 0 && (
                        <span className="flex items-center gap-1">
                          <Fuel className="w-3.5 h-3.5 text-indigo-600" /> Diesel: <strong>{bar.details.dieselLitres.toLocaleString()}L</strong>
                        </span>
                      )}
                      {bar.details.loggedBy && (
                        <span>Logged by: <strong>{bar.details.loggedBy}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Event Detail Modal (Flat) ── */}
      {activeBar && (
        <Dialog open={!!activeBar} onOpenChange={() => setActiveBar(null)}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl shadow-lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-md border", activeBar.badgeClass)}>
                  {activeBar.lane.toUpperCase()}
                </span>
                {activeBar.status === 'active' && (
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">ACTIVE NOW</Badge>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {activeBar.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 py-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Timeline Period</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {format(activeBar.startDate, 'MMM d, yyyy')} ➔ {format(activeBar.endDate, 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Duration</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{activeBar.details.durationDays} Days</span>
                </div>
              </div>

              {activeBar.details.machineName && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Equipment / Machine</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{activeBar.details.machineName}</p>
                </div>
              )}

              {activeBar.details.dieselLitres !== undefined && activeBar.details.dieselLitres > 0 && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Diesel Consumption</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">{activeBar.details.dieselLitres.toLocaleString()} Litres</p>
                </div>
              )}

              {activeBar.details.narration && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Narration & Notes</span>
                  <p className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {activeBar.details.narration}
                  </p>
                </div>
              )}

              {activeBar.details.reason && (
                <div>
                  <span className="text-rose-600 block text-[10px] uppercase font-bold mb-1">Stoppage / Downtime Reason</span>
                  <p className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 leading-relaxed">
                    {activeBar.details.reason}
                  </p>
                </div>
              )}

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Source: <strong className="uppercase">{activeBar.details.source}</strong></span>
                {activeBar.details.loggedBy && <span>By: {activeBar.details.loggedBy}</span>}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between w-full">
              {activeBar.details.source === 'manual' && activeBar.details.rawId ? (
                <Button
                  onClick={() => handleDeleteEvent(activeBar.details.rawId)}
                  variant="destructive"
                  size="sm"
                  className="rounded-lg text-xs gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Milestone
                </Button>
              ) : (
                <div />
              )}
              <Button
                onClick={() => setActiveBar(null)}
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

      {/* ── Add Manual Milestone / Jetting Dialog (Flat) ── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Record Operational Milestone or Jetting
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Event Type
              </label>
              <select
                value={manualForm.eventType}
                onChange={e => setManualForm(f => ({ ...f, eventType: e.target.value as SiteTimelineEventType }))}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="jetting">🌊 Initial Jetting</option>
                <option value="rejetting">🔄 Re-Jetting Campaign</option>
                <option value="mobilisation">🚚 Mobilisation / Additional Setup</option>
                <option value="machine_operation">⚙️ Operational Pumping Window</option>
                <option value="machine_downtime">⏸️ Machine Stoppage / Maintenance</option>
                <option value="hold">⚠️ Site Suspension / Hold</option>
                <option value="demobilisation">📦 Demobilisation / Recovery</option>
                <option value="milestone">🚩 Project Milestone</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Event Title / Description
              </label>
              <Input
                value={manualForm.title}
                onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Re-Jetting 16 Wellpoints on South Wall"
                className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 h-10 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={manualForm.startDate}
                  onChange={e => setManualForm(f => ({ ...f, startDate: e.target.value }))}
                  className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 h-10 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={manualForm.endDate}
                  onChange={e => setManualForm(f => ({ ...f, endDate: e.target.value }))}
                  className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 h-10 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Notes & Field Remarks
              </label>
              <Textarea
                value={manualForm.notes}
                onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Details of operation, soil conditions, supervisor notes..."
                className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 rounded-lg resize-none h-20 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => setShowAddModal(false)}
              variant="outline"
              size="sm"
              className="rounded-lg border-slate-300 dark:border-slate-700 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveManualEvent}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Save to Storyboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
