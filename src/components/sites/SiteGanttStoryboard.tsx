import { useState, useMemo, useEffect, useRef } from 'react';
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
    activeDays?: number;
    offDays?: number;
    machineName?: string;
    dieselLitres?: number;
    reason?: string;
    narration?: string;
    loggedBy?: string;
    source: 'waybill' | 'journal' | 'machinelog' | 'holdperiod' | 'manual';
    rawId?: string;
    isSwapped?: boolean;
    swapReason?: string;
    predecessorName?: string;
    successorName?: string;
  };
}

export function SiteGanttStoryboard({ site }: Props) {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dailyMachineLogs, waybills, siteHoldPeriods, sitePumpDates, assets, maintenanceAssets } = useOperations();
  const { siteJournalEntries, dailyJournals, siteTimelineEvents = [], addSiteTimelineEvent, deleteSiteTimelineEvent } = useAppStore();

  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [activeBar, setActiveBar] = useState<TimelineBar | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'feed'>('gantt');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState<'days' | 'weeks' | 'months'>('days');
  const [userZoomSelected, setUserZoomSelected] = useState(false);

  // Drag-to-Scroll (Hand Pan) State & Handlers
  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const scrollLeftRef = useRef(0);
  const scrollTopRef = useRef(0);
  const hasDragged = useRef(false);

  const handleGanttMouseDown = (e: React.MouseEvent) => {
    // Only capture primary left-clicks and ignore clicks with modifier keys
    if (e.button !== 0 || e.ctrlKey || e.metaKey || window.matchMedia('(pointer: coarse)').matches) return;

    const target = e.target as HTMLElement;
    // Don't hijack interaction if clicking interactive controls like inputs or buttons inside modals
    if (target.closest('input, select, textarea, [role="dialog"]')) return;

    const container = ganttScrollRef.current;
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
    (sitePumpDates || []).filter(p => p.siteId === site.id).forEach(p => {
      const assetObj = assets.find(a => a.id === p.assetId) || maintenanceAssets.find(ma => ma.id === p.assetId);
      if (assetObj?.name) set.add(assetObj.name);
    });
    siteLogs.forEach(l => {
      if (l.assetName) set.add(l.assetName);
    });
    return Array.from(set);
  }, [sitePumpDates, site.id, assets, maintenanceAssets, siteLogs]);

  // 2. Synthesize Multi-Track Timeline Bars
  const timelineBars = useMemo(() => {
    const bars: TimelineBar[] = [];

    // ── Track 1: Mobilisation & Setup ──
    const mobWaybills = siteWaybills.filter(w => w.type === 'waybill');
    const mobJournals = siteJournals.filter(j => 
      j.dewateringStage === 'mobilization' || 
      /mobilis|mobiliz|site setup|convoy/i.test(j.narration || '')
    );
    const mobLogs = siteLogs.filter(l => 
      (l as any).operationalStage === 'Initial Setup' || 
      /setup|mobilis|mobiliz/i.test(l.issuesOnSite || '')
    );

    if (mobWaybills.length > 0) {
      let currentMobGroup: typeof mobWaybills = [];
      let mobBatchIndex = 1;

      const flushMobGroup = () => {
        if (currentMobGroup.length === 0) return;
        const firstWb = currentMobGroup[0];
        const lastWb = currentMobGroup[currentMobGroup.length - 1];
        const start = parseISO(firstWb.sentToSiteDate || firstWb.issueDate);
        const end = parseISO(lastWb.sentToSiteDate || lastWb.issueDate);
        const isInitial = mobBatchIndex === 1;
        const isSwapDelivery = currentMobGroup.some(w => /swap|replace/i.test(w.purpose || ''));
        const spanDays = Math.max(1, differenceInDays(end, start) + 1);

        bars.push({
          id: `mob-group-${firstWb.id}`,
          lane: 'mobilisation',
          title: isInitial 
            ? `Site Mobilisation & Setup` 
            : isSwapDelivery
            ? `Machine Swap Delivery`
            : `Equipment Delivery #${mobBatchIndex}`,
          subtitle: `${currentMobGroup.length} waybill(s) • ${format(start, 'dd MMM')}`,
          startDate: start,
          endDate: end < start ? start : end,
          flatBgClass: isInitial ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white',
          flatBorderClass: isInitial ? 'border-blue-700' : 'border-blue-600',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
          status: 'completed',
          details: {
            durationDays: spanDays,
            narration: currentMobGroup.map(w => w.purpose || `Waybill #${(w as any).waybillNumber || w.id.slice(0, 6)}`).join(' | '),
            source: 'waybill',
            rawId: firstWb.id,
          }
        });

        mobBatchIndex++;
        currentMobGroup = [];
      };

      mobWaybills.forEach(wb => {
        if (currentMobGroup.length === 0) {
          currentMobGroup.push(wb);
        } else {
          const lastDate = parseISO(currentMobGroup[currentMobGroup.length - 1].sentToSiteDate || currentMobGroup[currentMobGroup.length - 1].issueDate);
          const thisDate = parseISO(wb.sentToSiteDate || wb.issueDate);
          if (differenceInDays(thisDate, lastDate) > 2) {
            flushMobGroup();
          }
          currentMobGroup.push(wb);
        }
      });
      flushMobGroup();
    } else if (mobJournals.length > 0 || mobLogs.length > 0) {
      const dates = [
        ...mobJournals.map(j => parseISO(j.journalDate)),
        ...mobLogs.map(l => parseISO(l.date))
      ].sort((a, b) => a.getTime() - b.getTime());

      if (dates.length > 0) {
        const start = dates[0];
        const end = dates[dates.length - 1];
        bars.push({
          id: `mob-log-${start.getTime()}`,
          lane: 'mobilisation',
          title: 'Site Setup & Mobilisation',
          startDate: start,
          endDate: end < start ? start : end,
          flatBgClass: 'bg-blue-600 text-white',
          flatBorderClass: 'border-blue-700',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
          status: 'completed',
          details: {
            durationDays: Math.max(1, differenceInDays(end, start) + 1),
            narration: 'Site mobilization recorded in daily records',
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

    // ── Track 3: Machine Operations (Unified Continuous Operational Bar) ──
    interface MachineSlot {
      assetId: string;
      assetName: string;
      configured?: (typeof sitePumpDates)[0];
    }
    const machinesOnSite = new Map<string, MachineSlot>();

    // 1. Load from configured sitePumpDates
    (sitePumpDates || []).filter(p => p.siteId === site.id).forEach(p => {
      const assetObj = assets.find(a => a.id === p.assetId) || maintenanceAssets.find(ma => ma.id === p.assetId);
      const name = assetObj?.name || 'Equipment';
      machinesOnSite.set(p.assetId, {
        assetId: p.assetId,
        assetName: name,
        configured: p,
      });
    });

    // 2. Add machines that have daily logs
    siteLogs.forEach(l => {
      const aId = l.assetId || l.assetName || 'Equipment';
      if (!machinesOnSite.has(aId)) {
        const matchingAsset = assets.find(a => a.name === l.assetName) || maintenanceAssets.find(ma => ma.name === l.assetName);
        const configuredMatch = matchingAsset ? (sitePumpDates || []).find(p => p.siteId === site.id && p.assetId === matchingAsset.id) : undefined;
        machinesOnSite.set(aId, {
          assetId: matchingAsset?.id || aId,
          assetName: l.assetName || 'Equipment',
          configured: configuredMatch,
        });
      }
    });

    // Filter by selected machine if not 'all'
    const targetMachines = Array.from(machinesOnSite.values()).filter(m => {
      if (selectedMachine === 'all') return true;
      return m.assetName === selectedMachine || m.assetId === selectedMachine;
    });

    targetMachines.forEach((machine) => {
      const { assetId, assetName, configured } = machine;
      const mLogs = siteLogs
        .filter(l => (l.assetId && l.assetId === assetId) || l.assetName === assetName)
        .sort((a, b) => a.date.localeCompare(b.date));

      // Determine Master Start Date
      let start: Date | null = null;
      if (configured?.pumpStartDate) {
        start = parseISO(configured.pumpStartDate);
      } else if (mLogs.length > 0) {
        start = parseISO(mLogs[0].date);
      }

      if (!start) return;

      // Determine Master End Date
      let end: Date | null = null;
      if (configured?.pumpStopDate) {
        end = parseISO(configured.pumpStopDate);
      } else if (site.status === 'Ended' && site.endDate) {
        end = parseISO(site.endDate);
      } else if (mLogs.length > 0) {
        const lastLogDate = parseISO(mLogs[mLogs.length - 1].date);
        end = lastLogDate;
      } else {
        end = addDays(start, 7);
      }

      if (end < start) end = start;

      // Calculate Net Running Stats over this machine's tenure
      const activeDays = mLogs.reduce((acc, l) => {
        const day = l.operationalDay ?? (l.isActive ? 'full' : 'none');
        return acc + (day === 'full' ? 1 : day === 'half' ? 0.5 : 0);
      }, 0);

      const offDays = mLogs.filter(l => {
        const day = l.operationalDay ?? (l.isActive ? 'full' : 'none');
        return day === 'none';
      }).length;

      const totalDiesel = mLogs.reduce((sum, l) => sum + (Number(l.dieselUsage) || 0), 0);
      const totalSpanDays = Math.max(1, differenceInDays(end, start) + 1);

      // Check Machine Swap / Lineage Relationships
      const predecessorId = configured?.replacedAssetId;
      const immediatePredecessor = predecessorId
        ? assets.find(a => a.id === predecessorId) || maintenanceAssets.find(ma => ma.id === predecessorId)
        : null;

      const successorRecord = (sitePumpDates || []).find(p => p.siteId === site.id && p.replacedAssetId === assetId);
      const successorMachine = successorRecord
        ? assets.find(a => a.id === successorRecord.assetId) || maintenanceAssets.find(ma => ma.id === successorRecord.assetId)
        : null;

      const isSwapped = !!immediatePredecessor;
      const isReplaced = !!successorRecord;

      // Build Subtitle
      const subtitleParts: string[] = [assetName];
      if (totalDiesel > 0) subtitleParts.push(`${totalDiesel.toLocaleString()}L`);
      if (isSwapped) subtitleParts.push(`🔄 Swapped in (Replaced ${immediatePredecessor?.name || 'Unit'})`);
      if (isReplaced) subtitleParts.push(`➡️ Swapped out (Replaced by ${successorMachine?.name || 'New Unit'})`);

      // ── Continuous Operational Pumping Bar ──
      bars.push({
        id: `pumping-${assetId}`,
        lane: 'pumping',
        title: `Active Pumping (${totalSpanDays}d Span · ${activeDays}d Active${offDays > 0 ? ` · ${offDays}d Off` : ''})`,
        subtitle: subtitleParts.join(' • '),
        startDate: start,
        endDate: end,
        flatBgClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        flatBorderClass: 'border-emerald-700 shadow-xs',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
        status: (site.status !== 'Ended' && (!configured?.pumpStopDate || isWithinInterval(new Date(), { start, end }))) ? 'active' : 'completed',
        details: {
          durationDays: totalSpanDays,
          activeDays,
          offDays,
          machineName: assetName,
          dieselLitres: totalDiesel,
          loggedBy: mLogs[0]?.supervisorOnSite,
          source: 'machinelog',
          rawId: mLogs[0]?.id,
          isSwapped,
          swapReason: configured?.swapReason,
          predecessorName: immediatePredecessor?.name,
          successorName: successorMachine?.name,
          narration: isSwapped 
            ? `Swapped into operation (replacing ${immediatePredecessor?.name || 'previous unit'})${configured?.swapReason ? `: ${configured.swapReason}` : ''}`
            : isReplaced
            ? `Swapped out of operation on ${successorRecord?.pumpStartDate ? format(parseISO(successorRecord.pumpStartDate), 'dd MMM yyyy') : 'site'} (replaced by ${successorMachine?.name || 'next unit'})`
            : undefined,
        }
      });

      // ── Track 4: Stoppage & Off-Days (Event Overlays) ──
      let downtimeGroup: typeof mLogs = [];
      const flushDowntimeGroup = () => {
        if (downtimeGroup.length === 0) return;
        const dStart = parseISO(downtimeGroup[0].date);
        const dEnd = parseISO(downtimeGroup[downtimeGroup.length - 1].date);
        const reasons = Array.from(new Set(
          downtimeGroup
            .map(l => l.downtimeEntries?.map(d => d.reason).join(', ') || l.issuesOnSite || 'Machine Stoppage')
            .filter(Boolean)
        )).join('; ');

        bars.push({
          id: `downtime-${assetId}-${downtimeGroup[0].id}`,
          lane: 'downtime',
          title: `Machine Stoppage (${downtimeGroup.length}d)`,
          subtitle: `${assetName}${reasons ? `: ${reasons.slice(0, 35)}` : ''}`,
          startDate: dStart,
          endDate: dEnd < dStart ? dStart : dEnd,
          flatBgClass: 'bg-rose-600 hover:bg-rose-700 text-white',
          flatBorderClass: 'border-rose-700 shadow-xs',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700',
          status: 'interrupted',
          details: {
            durationDays: Math.max(1, differenceInDays(dEnd, dStart) + 1),
            machineName: assetName,
            reason: reasons || 'Turned off / Stoppage',
            source: 'machinelog',
            rawId: downtimeGroup[0].id,
            loggedBy: downtimeGroup[0].supervisorOnSite,
          }
        });
        downtimeGroup = [];
      };

      mLogs.forEach(log => {
        const isOff = !log.isActive || log.operationalDay === 'none';
        if (isOff) {
          if (downtimeGroup.length > 0) {
            const prevDate = parseISO(downtimeGroup[downtimeGroup.length - 1].date);
            const currDate = parseISO(log.date);
            if (differenceInDays(currDate, prevDate) > 2) {
              flushDowntimeGroup();
            }
          }
          downtimeGroup.push(log);
        } else {
          flushDowntimeGroup();
        }
      });
      flushDowntimeGroup();
    });

    // ── Track 5: Site Holds / Suspensions ──
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

    // ── Track 6: Demobilisation & Recovery ──
    const returnWaybills = siteWaybills.filter(w => w.type === 'return');
    const demobLogs = siteLogs.filter(l => 
      (l as any).operationalStage === 'Completion / Demobilization'
    );
    const demobJournals = siteJournals.filter(j => 
      (j.dewateringStage as any) === 'demobilization' || (j.dewateringStage as any) === 'Completion / Demobilization'
    );

    // 1. Group return waybills by clustered dates (gap <= 2 days)
    if (returnWaybills.length > 0) {
      let currentReturnGroup: typeof returnWaybills = [];
      let returnBatchIndex = 1;

      const flushReturnGroup = () => {
        if (currentReturnGroup.length === 0) return;
        const firstWb = currentReturnGroup[0];
        const lastWb = currentReturnGroup[currentReturnGroup.length - 1];
        const start = parseISO(firstWb.sentToSiteDate || firstWb.issueDate);
        const end = parseISO(lastWb.sentToSiteDate || lastWb.issueDate);
        const isSwapReturn = currentReturnGroup.some(w => /swap|replac/i.test(w.purpose || ''));
        const spanDays = Math.max(1, differenceInDays(end, start) + 1);

        bars.push({
          id: `demob-group-${firstWb.id}`,
          lane: 'demob',
          title: isSwapReturn
            ? `Swapped Machine Return (${firstWb.items?.[0]?.assetName || 'Equipment'})`
            : returnWaybills.length === currentReturnGroup.length && site.status === 'Ended'
            ? `Site Demobilisation & Recovery`
            : `Equipment Return / Retrieval #${returnBatchIndex}`,
          subtitle: `${currentReturnGroup.length} return waybill(s) • ${format(start, 'dd MMM')}`,
          startDate: start,
          endDate: end < start ? start : end,
          flatBgClass: isSwapReturn ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white',
          flatBorderClass: isSwapReturn ? 'border-indigo-600' : 'border-indigo-700',
          badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
          status: site.status === 'Ended' ? 'completed' : 'active',
          details: {
            durationDays: spanDays,
            narration: currentReturnGroup.map(w => w.purpose || `Return Waybill #${(w as any).waybillNumber || w.id.slice(0, 6)}`).join(' | '),
            source: 'waybill',
            rawId: firstWb.id,
          }
        });

        returnBatchIndex++;
        currentReturnGroup = [];
      };

      returnWaybills.forEach(wb => {
        if (currentReturnGroup.length === 0) {
          currentReturnGroup.push(wb);
        } else {
          const lastDate = parseISO(currentReturnGroup[currentReturnGroup.length - 1].sentToSiteDate || currentReturnGroup[currentReturnGroup.length - 1].issueDate);
          const thisDate = parseISO(wb.sentToSiteDate || wb.issueDate);
          if (differenceInDays(thisDate, lastDate) > 2) {
            flushReturnGroup();
          }
          currentReturnGroup.push(wb);
        }
      });
      flushReturnGroup();
    }

    // 2. Operational demobilisation stages from daily logs / journals (clustered consecutive days)
    if (demobLogs.length > 0 || demobJournals.length > 0) {
      const dates = Array.from(new Set([
        ...demobLogs.map(l => l.date),
        ...demobJournals.map(j => j.journalDate)
      ])).sort();

      let currentStageGroup: string[] = [];
      const flushStageGroup = () => {
        if (currentStageGroup.length === 0) return;
        const start = parseISO(currentStageGroup[0]);
        const end = parseISO(currentStageGroup[currentStageGroup.length - 1]);
        const spanDays = Math.max(1, differenceInDays(end, start) + 1);

        bars.push({
          id: `demob-stage-${currentStageGroup[0]}`,
          lane: 'demob',
          title: `Demobilisation Operational Work`,
          subtitle: `${spanDays} day(s) on-site extraction & packing`,
          startDate: start,
          endDate: end < start ? start : end,
          flatBgClass: 'bg-indigo-700 text-white',
          flatBorderClass: 'border-indigo-800',
          badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
          status: 'completed',
          details: {
            durationDays: spanDays,
            narration: 'Wellpoint extraction and equipment packing logged in daily operations',
            source: 'machinelog',
          }
        });
        currentStageGroup = [];
      };

      dates.forEach(d => {
        if (currentStageGroup.length === 0) {
          currentStageGroup.push(d);
        } else {
          const lastDate = parseISO(currentStageGroup[currentStageGroup.length - 1]);
          const thisDate = parseISO(d);
          if (differenceInDays(thisDate, lastDate) > 2) {
            flushStageGroup();
          }
          currentStageGroup.push(d);
        }
      });
      flushStageGroup();
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

      const styleMap: Record<SiteTimelineEventType, { bg: string; border: string; badge: string }> = {
        mobilisation: {
          bg: 'bg-blue-600 text-white',
          border: 'border-blue-700',
          badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
        },
        jetting: {
          bg: 'bg-sky-600 text-white',
          border: 'border-sky-700',
          badge: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700',
        },
        rejetting: {
          bg: 'bg-teal-600 text-white',
          border: 'border-teal-700',
          badge: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
        },
        machine_operation: {
          bg: 'bg-emerald-600 text-white',
          border: 'border-emerald-700',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
        },
        machine_downtime: {
          bg: 'bg-rose-600 text-white',
          border: 'border-rose-700',
          badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700',
        },
        hold: {
          bg: 'bg-amber-500 text-white',
          border: 'border-amber-600',
          badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
        },
        demobilisation: {
          bg: 'bg-indigo-600 text-white',
          border: 'border-indigo-700',
          badge: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
        },
        milestone: {
          bg: 'bg-slate-700 text-white',
          border: 'border-slate-800',
          badge: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200',
        },
        custom: {
          bg: 'bg-slate-700 text-white',
          border: 'border-slate-800',
          badge: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200',
        },
      };

      const style = styleMap[ev.eventType] || styleMap.milestone;

      bars.push({
        id: `manual-${ev.id}`,
        lane: laneMap[ev.eventType] || 'jetting',
        title: ev.title,
        subtitle: ev.notes?.slice(0, 30),
        startDate: start,
        endDate: end < start ? start : end,
        flatBgClass: style.bg,
        flatBorderClass: style.border,
        badgeClass: style.badge,
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
  }, [siteWaybills, siteJournals, siteLogs, siteHolds, manualEvents, selectedMachine, site.status, site.endDate, sitePumpDates, assets, maintenanceAssets]);

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
    const uniquePumpingDates = new Set(
      siteLogs.filter(l => l.isActive && l.operationalDay !== 'none').map(l => l.date)
    );
    const uniqueDowntimeDates = new Set(
      siteLogs.filter(l => !l.isActive || l.operationalDay === 'none').map(l => l.date)
    );
    const totalPumpingDays = uniquePumpingDates.size;
    const totalDowntimeDays = uniqueDowntimeDates.size;
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
      notes: manualForm.notes,
      loggedBy: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString(),
    };

    addSiteTimelineEvent(newEvent);
    toast.success('Milestone event saved');
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

  // Helper to compute percentage and pixel position on horizontal timeline
  const getBarLayout = (barStart: Date, barEnd: Date) => {
    const totalMs = maxDate.getTime() - minDate.getTime();
    if (totalMs <= 0) return { left: '0%', width: '100%', leftPx: 0, approxPx: 100 };

    const startOffset = Math.max(0, barStart.getTime() - minDate.getTime());
    const endOffset = Math.min(totalMs, addDays(barEnd, 1).getTime() - minDate.getTime());

    const leftPercent = (startOffset / totalMs) * 100;
    const widthPercent = Math.max(0.6, ((endOffset - startOffset) / totalMs) * 100);
    const leftPx = (startOffset / totalMs) * gridContainerWidth;
    const approxPx = Math.max(36, (widthPercent / 100) * gridContainerWidth);

    return {
      left: `${leftPercent.toFixed(3)}%`,
      width: `${widthPercent.toFixed(3)}%`,
      leftPx,
      approxPx,
    };
  };

  // Sub-track bin-packing helper to eliminate overlapping sibling bars (pixel & time aware)
  const packLaneBars = (bars: TimelineBar[]) => {
    if (bars.length === 0) return { barsWithTrack: [], totalTracks: 1 };
    const sorted = [...bars].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const trackEndPixels: number[] = [];
    const barsWithTrack: { bar: TimelineBar; trackIndex: number; left: string; width: string; approxPx: number }[] = [];

    const minBarWidthPx = 38;
    const gapBufferPx = 6;

    sorted.forEach((b) => {
      const { left, width, leftPx, approxPx } = getBarLayout(b.startDate, b.endDate);
      const renderedWidth = Math.max(minBarWidthPx, approxPx);
      const rightPx = leftPx + renderedWidth;

      let assigned = -1;
      for (let i = 0; i < trackEndPixels.length; i++) {
        if (leftPx >= trackEndPixels[i] + gapBufferPx) {
          assigned = i;
          trackEndPixels[i] = rightPx;
          break;
        }
      }

      if (assigned === -1) {
        assigned = trackEndPixels.length;
        trackEndPixels.push(rightPx);
      }

      barsWithTrack.push({ bar: b, trackIndex: assigned, left, width, approxPx });
    });

    return {
      barsWithTrack,
      totalTracks: Math.max(1, trackEndPixels.length),
    };
  };

  // Machine-aware sub-track packing helper: gives each machine its own dedicated row(s)
  const packMachineLaneBars = (laneBars: TimelineBar[], availableMachines: string[]) => {
    if (laneBars.length === 0) return { barsWithTrack: [], totalTracks: 1, machineRows: [] };

    // Get unique machines present in these bars, preserving availableMachines order
    const machinesInBars = Array.from(new Set(laneBars.map(b => b.details.machineName).filter(Boolean))) as string[];
    const orderedMachines = availableMachines.filter(m => machinesInBars.includes(m));
    if (orderedMachines.length === 0 && machinesInBars.length > 0) {
      orderedMachines.push(...machinesInBars);
    }
    const fallbackBars = laneBars.filter(b => !b.details.machineName);

    const barsWithTrack: { bar: TimelineBar; trackIndex: number; left: string; width: string; approxPx: number; machineName?: string }[] = [];
    const machineRows: { machineName: string; startTrack: number; trackCount: number }[] = [];

    let currentTrackOffset = 0;

    orderedMachines.forEach(machineName => {
      const machineBars = laneBars.filter(b => b.details.machineName === machineName);
      if (machineBars.length === 0) return;

      // In downtime/stoppage lane, strictly keep 1 single clean row per machine (no vertical stacking)
      if (laneBars[0]?.lane === 'downtime') {
        machineBars.forEach(b => {
          const { left, width, approxPx } = getBarLayout(b.startDate, b.endDate);
          barsWithTrack.push({
            bar: b,
            trackIndex: currentTrackOffset,
            left,
            width,
            approxPx,
            machineName,
          });
        });
        machineRows.push({
          machineName,
          startTrack: currentTrackOffset,
          trackCount: 1,
        });
        currentTrackOffset += 1;
        return;
      }

      const { barsWithTrack: packed, totalTracks } = packLaneBars(machineBars);

      packed.forEach(p => {
        barsWithTrack.push({
          ...p,
          trackIndex: currentTrackOffset + p.trackIndex,
          machineName,
        });
      });

      machineRows.push({
        machineName,
        startTrack: currentTrackOffset,
        trackCount: totalTracks,
      });

      currentTrackOffset += totalTracks;
    });

    if (fallbackBars.length > 0) {
      const { barsWithTrack: packed, totalTracks } = packLaneBars(fallbackBars);
      packed.forEach(p => {
        barsWithTrack.push({
          ...p,
          trackIndex: currentTrackOffset + p.trackIndex,
          machineName: 'General',
        });
      });
      machineRows.push({
        machineName: 'General',
        startTrack: currentTrackOffset,
        trackCount: totalTracks,
      });
      currentTrackOffset += totalTracks;
    }

    return {
      barsWithTrack,
      totalTracks: Math.max(1, currentTrackOffset),
      machineRows,
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

      {/* ── Main Gantt Chart Grid (Flat Clean UI with Hand Drag-to-Scroll) ── */}
      {viewMode === 'gantt' ? (
        <div
          ref={ganttScrollRef}
          onMouseDown={handleGanttMouseDown}
          className={cn(
            "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-auto style-scroll relative",
            isDragging ? "cursor-grabbing select-none" : "cursor-grab",
            isFullscreen ? "max-h-[calc(100vh-140px)]" : "max-h-[calc(100vh-230px)] min-h-[520px]"
          )}
        >
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
                    <div 
                      className="sticky top-12 px-2 py-0.5 rounded-md bg-orange-500 text-white text-[9.5px] font-black uppercase tracking-wider shadow-md whitespace-nowrap z-20 flex items-center justify-center pointer-events-auto"
                      style={{
                        transform: parseFloat(todayPercent) > 90 ? 'translateX(-85%)' : parseFloat(todayPercent) < 10 ? 'translateX(-15%)' : 'translateX(-50%)'
                      }}
                    >
                      TODAY
                    </div>
                  </div>
                )}

                {lanes.map((lane) => {
                  const laneBars = timelineBars.filter(b => b.lane === lane.id);
                  const isMachineLane = lane.id === 'pumping' || lane.id === 'downtime';
                  const { barsWithTrack, totalTracks, machineRows } = isMachineLane
                    ? packMachineLaneBars(laneBars, machineOptions)
                    : { ...packLaneBars(laneBars), machineRows: [] };

                  const trackRowHeight = 42;
                  const laneMinHeight = Math.max(64, totalTracks * trackRowHeight + 16);

                  return (
                    <div
                      key={lane.id}
                      style={{ minHeight: `${laneMinHeight}px` }}
                      className="grid grid-cols-[230px_1fr] transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                    >
                      {/* Lane Label */}
                      <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between bg-white dark:bg-slate-900">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100">
                            {lane.icon}
                            <span>{lane.name}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{lane.desc}</span>
                        </div>

                        {/* Dedicated Machine Row Indicators on the left if multiple machines */}
                        {isMachineLane && machineRows.length > 1 && (
                          <div className="mt-2 space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                            {machineRows.map(mr => (
                              <div key={mr.machineName} className="flex items-center gap-1.5 text-[10.5px] text-slate-600 dark:text-slate-300 truncate">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  lane.id === 'pumping' ? "bg-emerald-500" : "bg-rose-500"
                                )} />
                                <span className="truncate font-semibold">{mr.machineName}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lane Timeline Track with vertical day grid guides */}
                      <div className="relative p-2 flex items-center" style={{ minHeight: `${laneMinHeight}px` }}>
                        {/* Sub-row horizontal guidelines if multiple tracks */}
                        {totalTracks > 1 && (
                          <div className="absolute inset-0 pointer-events-none">
                            {Array.from({ length: totalTracks }).map((_, rIdx) => (
                              <div
                                key={rIdx}
                                style={{ top: `${rIdx * trackRowHeight}px`, height: `${trackRowHeight}px` }}
                                className="absolute left-0 right-0 border-b border-slate-100/80 dark:border-slate-800/40 flex items-center px-3"
                              >
                                {isMachineLane && machineRows.length > 1 && (
                                  <span className="text-[9.5px] font-bold text-slate-300/80 dark:text-slate-600 select-none uppercase tracking-wider">
                                    {machineRows.find(mr => mr.startTrack === rIdx)?.machineName || ''}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Background Date Grid Alignment Guides */}
                        {zoomScale === 'days' && (
                          <div className="absolute inset-0 flex pointer-events-none opacity-40">
                            {calendarDays.map((day, idx) => {
                              const isWk = day.getDay() === 0 || day.getDay() === 6;
                              return (
                                <div
                                  key={idx}
                                  style={{ width: `${(1 / calendarDays.length) * 100}%` }}
                                  className={cn(
                                    "h-full border-r border-slate-100 dark:border-slate-800/40",
                                    isWk && "bg-slate-50/60 dark:bg-slate-800/20"
                                  )}
                                />
                              );
                            })}
                          </div>
                        )}
                        {zoomScale === 'weeks' && (
                          <div className="absolute inset-0 flex pointer-events-none opacity-40">
                            {calendarWeeks.map((_, idx) => (
                              <div
                                key={idx}
                                style={{ width: `${(7 / calendarDays.length) * 100}%` }}
                                className="h-full border-r border-slate-200/60 dark:border-slate-800/50"
                              />
                            ))}
                          </div>
                        )}

                        {barsWithTrack.length === 0 ? (
                          <div className="text-xs text-slate-400 italic pl-3 select-none">
                            No records in this phase
                          </div>
                        ) : (
                          barsWithTrack.map(({ bar, trackIndex, left, width, approxPx }) => {
                            const topOffset = trackIndex * trackRowHeight + 6;
                            const isMicro = approxPx < 44;
                            const isCompact = approxPx >= 44 && approxPx < 85;
                            const isMedium = approxPx >= 85 && approxPx < 165;

                            const tooltipText = `${bar.title} (${bar.details.durationDays}d)\n${format(bar.startDate, 'MMM d, yyyy')} – ${format(bar.endDate, 'MMM d, yyyy')}${bar.subtitle ? `\n${bar.subtitle}` : ''}${bar.details.reason ? `\nReason: ${bar.details.reason}` : ''}`;

                            return (
                              <button
                                key={bar.id}
                                onClick={(e) => {
                                  if (hasDragged.current) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
                                  setActiveBar(bar);
                                }}
                                title={tooltipText}
                                style={{
                                  left,
                                  width,
                                  top: `${topOffset}px`,
                                  minWidth: '38px',
                                  height: '32px'
                                }}
                                className={cn(
                                  "absolute rounded-lg px-2 flex items-center justify-between gap-1.5 font-sans",
                                  "border text-left shadow-xs transition-all hover:brightness-105 hover:shadow-md hover:z-20 cursor-pointer overflow-hidden select-none active:scale-[0.98]",
                                  bar.flatBgClass,
                                  bar.flatBorderClass
                                )}
                              >
                                {isMicro ? (
                                  /* Micro Pill (< 44px): Clean Centered Duration Badge with Dot */
                                  <div className="w-full flex items-center justify-center gap-1 font-bold text-[10px] text-white whitespace-nowrap">
                                    {bar.status === 'active' && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                                    )}
                                    <span>{bar.details.durationDays}d</span>
                                  </div>
                                ) : isCompact ? (
                                  /* Compact Pill (44px - 85px): Short Text or Clean Badge */
                                  <div className="w-full flex items-center justify-between gap-1 min-w-0">
                                    <span className="text-[10.5px] font-bold truncate text-white min-w-0">
                                      {bar.title.replace(/Campaign #\d+/, '').replace('Site ', '').replace('Machine ', '').replace('Initial ', '').trim()}
                                    </span>
                                    <span className="text-[9.5px] font-extrabold px-1 py-0.5 rounded bg-black/25 text-white shrink-0 font-mono">
                                      {bar.details.durationDays}d
                                    </span>
                                  </div>
                                ) : isMedium ? (
                                  /* Medium Pill (85px - 165px): Title + Duration Badge */
                                  <>
                                    <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs font-bold truncate text-white">
                                      {bar.status === 'active' && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                                      )}
                                      <span className="truncate whitespace-nowrap">{bar.title}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/25 text-white shrink-0 font-mono">
                                      {bar.details.durationDays}d
                                    </span>
                                  </>
                                ) : (
                                  /* Full Pill (> 165px): Title + Subtitle + Duration Badge */
                                  <>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold truncate leading-tight flex items-center gap-1.5 text-white">
                                        {bar.status === 'active' && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block shrink-0" />
                                        )}
                                        <span className="truncate whitespace-nowrap">{bar.title}</span>
                                      </div>
                                      {bar.subtitle && (
                                        <div className="text-[10px] opacity-90 truncate leading-tight font-normal text-white/90 whitespace-nowrap mt-0.5">
                                          {bar.subtitle}
                                        </div>
                                      )}
                                    </div>

                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/25 text-white whitespace-nowrap shrink-0 font-mono">
                                      {bar.details.durationDays}d
                                    </span>
                                  </>
                                )}
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

              {activeBar.details.activeDays !== undefined && (
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Span</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{activeBar.details.durationDays}d</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Active Days</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{activeBar.details.activeDays}d</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Off / Stoppage</span>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300">{activeBar.details.offDays || 0}d</span>
                  </div>
                </div>
              )}

              {activeBar.details.isSwapped && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                  <span className="text-[10px] uppercase font-bold block mb-0.5">🔄 Machine Swap Record</span>
                  <p className="text-xs font-medium">
                    Swapped into site to replace <strong>{activeBar.details.predecessorName || 'previous machine'}</strong>
                    {activeBar.details.swapReason ? ` (${activeBar.details.swapReason})` : ''}
                  </p>
                </div>
              )}

              {activeBar.details.successorName && (
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300">
                  <span className="text-[10px] uppercase font-bold block mb-0.5">➡️ Machine Lineage Notice</span>
                  <p className="text-xs font-medium">
                    Later swapped out and replaced by <strong>{activeBar.details.successorName}</strong>
                  </p>
                </div>
              )}

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
