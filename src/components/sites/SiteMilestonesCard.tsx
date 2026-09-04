import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  Truck, Droplets, Zap, Calendar, Edit3, Plus,
  Trash2, Layers, ShieldCheck, RotateCcw, Sparkles, ChevronRight,
  History, Clock, User, ArrowRight, CheckCircle2
} from 'lucide-react';
import { useAppStore, Site, SiteTimelineEvent, SiteTimelineEventType, MilestoneHistoryItem } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { cn, generateId } from '@/src/lib/utils';
import { toast } from 'sonner';

interface Props {
  site: Site;
  className?: string;
}

interface CoreStageDef {
  type: SiteTimelineEventType;
  shortLabel: string;
  title: string;
  defaultTitle: string;
  icon: any;
  accent: {
    text: string;
    bg: string;
    border: string;
  };
}

const CORE_STAGES: CoreStageDef[] = [
  {
    type: 'mobilisation',
    shortLabel: 'Mob',
    title: 'Mobilisation',
    defaultTitle: 'Site Mobilisation',
    icon: Truck,
    accent: {
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50/70 dark:bg-blue-950/30',
      border: 'border-blue-200/80 dark:border-blue-800/50',
    },
  },
  {
    type: 'jetting',
    shortLabel: 'Jetting',
    title: 'Jetting & Install',
    defaultTitle: 'Wellpoint Jetting',
    icon: Droplets,
    accent: {
      text: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50/70 dark:bg-sky-950/30',
      border: 'border-sky-200/80 dark:border-sky-800/50',
    },
  },
  {
    type: 'machine_operation',
    shortLabel: 'Pumping',
    title: 'Operations',
    defaultTitle: 'Pumping Operations',
    icon: Zap,
    accent: {
      text: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
      border: 'border-emerald-200/80 dark:border-emerald-800/50',
    },
  },
  {
    type: 'demobilisation',
    shortLabel: 'Demob',
    title: 'Demobilisation',
    defaultTitle: 'Site Demobilisation',
    icon: Truck,
    accent: {
      text: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50/70 dark:bg-indigo-950/30',
      border: 'border-indigo-200/80 dark:border-indigo-800/50',
    },
  },
];

// Helper to format dates with year clearly
const formatMilestoneDateWithYear = (startStr: string, endStr?: string) => {
  try {
    const s = parseISO(startStr);
    if (!endStr || endStr === startStr) {
      return format(s, 'dd MMM yyyy');
    }
    const e = parseISO(endStr);
    if (s.getFullYear() === e.getFullYear()) {
      return `${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')}`;
    }
    return `${format(s, 'dd MMM yyyy')} – ${format(e, 'dd MMM yyyy')}`;
  } catch {
    return startStr;
  }
};

export function SiteMilestonesCard({ site, className }: Props) {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const {
    siteTimelineEvents = [],
    siteJournalEntries = [],
    dailyJournals = [],
    addSiteTimelineEvent,
    updateSiteTimelineEvent,
    deleteSiteTimelineEvent,
    updateSite,
  } = useAppStore();

  const { dailyMachineLogs = [], waybills = [], sitePumpDates = [] } = useOperations();

  // Dialog Edit State
  const [editingStage, setEditingStage] = useState<CoreStageDef | null>(null);
  const [editingCustomEvent, setEditingCustomEvent] = useState<SiteTimelineEvent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCustomModal, setIsCustomModal] = useState(false);

  // Form State
  const [formMode, setFormMode] = useState<'single' | 'range'>('range');
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [existingEventId, setExistingEventId] = useState<string | null>(null);

  // 1. GATHER RAW RECORDS FOR AUTO-EXTRAPOLATION
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

  const configuredPumps = useMemo(() => {
    return (sitePumpDates || []).filter(p => p.siteId === site.id);
  }, [sitePumpDates, site.id]);

  // 2. AUTO-EXTRAPOLATION ENGINE PER STAGE
  const autoExtrapolated = useMemo(() => {
    // Stage 1: Mobilisation
    const mobWbs = siteWaybills.filter(w => w.type === 'waybill');
    const mobJrnls = siteJournals.filter(j => j.dewateringStage === 'mobilization' || /mobilis|mobiliz|setup|convoy/i.test(j.narration || ''));
    const mobLogs = siteLogs.filter(l => (l as any).operationalStage === 'Initial Setup' || /setup|mobilis|mobiliz/i.test(l.issuesOnSite || ''));
    
    let mobStart: string | null = null;
    let mobEnd: string | null = null;
    let mobSource = '';

    if (mobWbs.length > 0) {
      const dates = mobWbs.map(w => w.sentToSiteDate || w.issueDate).filter(Boolean).sort();
      if (dates.length > 0) {
        mobStart = dates[0];
        mobEnd = dates[dates.length - 1];
        mobSource = `${mobWbs.length} Waybill(s)`;
      }
    } else if (mobJrnls.length > 0 || mobLogs.length > 0) {
      const dates = [...mobJrnls.map(j => j.journalDate), ...mobLogs.map(l => l.date)].filter(Boolean).sort();
      if (dates.length > 0) {
        mobStart = dates[0];
        mobEnd = dates[dates.length - 1];
        mobSource = 'Journals & Logs';
      }
    } else if (site.startDate) {
      mobStart = site.startDate;
      mobEnd = site.startDate;
      mobSource = 'Site Start Date';
    }

    // Stage 2: Jetting & Installation
    const jetJrnls = siteJournals.filter(j => 
      j.dewateringStage === 'jetting' || 
      j.dewateringStage === 'rejetting' || 
      j.dewateringStage === 'installation' ||
      /jetting|re-jet|rejet|wellpoint install/i.test(j.narration || '')
    );
    let jetStart: string | null = null;
    let jetEnd: string | null = null;
    let jetSource = '';

    if (jetJrnls.length > 0) {
      const dates = jetJrnls.map(j => j.journalDate).filter(Boolean).sort();
      jetStart = dates[0];
      jetEnd = dates[dates.length - 1];
      jetSource = `${jetJrnls.length} Journal(s)`;
    }

    // Stage 3: Operations / Pumping
    let opStart: string | null = null;
    let opEnd: string | null = null;
    let opSource = '';

    const pumpDatesList = configuredPumps.map(p => p.pumpStartDate).filter(Boolean).sort();
    if (pumpDatesList.length > 0) {
      opStart = pumpDatesList[0];
      const stops = configuredPumps.map(p => p.pumpStopDate).filter(Boolean).sort();
      opEnd = stops.length > 0 ? stops[stops.length - 1] : (site.endDate || null);
      opSource = 'Pump Dates';
    } else if (siteLogs.length > 0) {
      opStart = siteLogs[0].date;
      opEnd = site.status === 'Ended' && site.endDate ? site.endDate : siteLogs[siteLogs.length - 1].date;
      opSource = `${siteLogs.length} Machine Log(s)`;
    } else if (site.startDate) {
      opStart = site.startDate;
      opEnd = site.endDate || null;
      opSource = 'Site Duration';
    }

    // Stage 4: Demobilisation & Recovery
    const retWbs = siteWaybills.filter(w => w.type === 'return');
    const demobJrnls = siteJournals.filter(j => j.dewateringStage === 'demobilisation' || /demobilis|demobiliz|retriev|closing/i.test(j.narration || ''));
    let demobStart: string | null = null;
    let demobEnd: string | null = null;
    let demobSource = '';

    if (retWbs.length > 0) {
      const dates = retWbs.map(w => w.sentToSiteDate || w.issueDate).filter(Boolean).sort();
      if (dates.length > 0) {
        demobStart = dates[0];
        demobEnd = dates[dates.length - 1];
        demobSource = `${retWbs.length} Return Waybill(s)`;
      }
    } else if (demobJrnls.length > 0) {
      const dates = demobJrnls.map(j => j.journalDate).filter(Boolean).sort();
      demobStart = dates[0];
      demobEnd = dates[dates.length - 1];
      demobSource = 'Demob Journals';
    } else if (site.endDate && site.status === 'Ended') {
      demobStart = site.endDate;
      demobEnd = site.endDate;
      demobSource = 'Site End Date';
    }

    return {
      mobilisation: { start: mobStart, end: mobEnd || mobStart, source: mobSource },
      jetting: { start: jetStart, end: jetEnd || jetStart, source: jetSource },
      machine_operation: { start: opStart, end: opEnd || opStart, source: opSource },
      demobilisation: { start: demobStart, end: demobEnd || demobStart, source: demobSource },
    };
  }, [siteWaybills, siteJournals, siteLogs, configuredPumps, site.startDate, site.endDate, site.status]);

  // 3. Filter manual events for this site
  const siteEvents = useMemo(() => {
    return siteTimelineEvents.filter(e => e.siteId === site.id);
  }, [siteTimelineEvents, site.id]);

  const stageMap = useMemo(() => {
    const map = new Map<SiteTimelineEventType, SiteTimelineEvent>();
    siteEvents.forEach(ev => {
      if (CORE_STAGES.some(s => s.type === ev.eventType)) {
        map.set(ev.eventType, ev);
      }
    });
    return map;
  }, [siteEvents]);

  // Custom (non-core) events
  const customEvents = useMemo(() => {
    return siteEvents.filter(ev => !CORE_STAGES.some(s => s.type === ev.eventType));
  }, [siteEvents]);

  // Active event being edited in modal (for version history display)
  const activeModalEvent = useMemo(() => {
    if (editingCustomEvent) return editingCustomEvent;
    if (editingStage) return stageMap.get(editingStage.type) || null;
    return null;
  }, [editingStage, editingCustomEvent, stageMap]);

  const activeModalAuto = useMemo(() => {
    if (editingStage) return autoExtrapolated[editingStage.type as keyof typeof autoExtrapolated] || null;
    return null;
  }, [editingStage, autoExtrapolated]);

  // Open Edit Modal for a Core Stage
  const handleOpenEditCoreStage = (stage: CoreStageDef) => {
    const existing = stageMap.get(stage.type);
    const auto = autoExtrapolated[stage.type as keyof typeof autoExtrapolated];

    setEditingStage(stage);
    setIsCustomModal(false);
    setEditingCustomEvent(null);

    if (existing) {
      setExistingEventId(existing.id);
      setFormTitle(existing.title || stage.defaultTitle);
      setFormStartDate(existing.startDate || format(new Date(), 'yyyy-MM-dd'));
      setFormEndDate(existing.endDate || existing.startDate || format(new Date(), 'yyyy-MM-dd'));
      setFormMode(existing.endDate && existing.endDate !== existing.startDate ? 'range' : 'single');
      setFormNotes(existing.notes || '');
    } else {
      setExistingEventId(null);
      setFormTitle(stage.defaultTitle);
      const fallbackStart = auto?.start || (stage.type === 'demobilisation' && site.endDate ? site.endDate : site.startDate || format(new Date(), 'yyyy-MM-dd'));
      const fallbackEnd = auto?.end || fallbackStart;
      setFormStartDate(fallbackStart);
      setFormEndDate(fallbackEnd);
      setFormMode(fallbackEnd && fallbackEnd !== fallbackStart ? 'range' : 'single');
      setFormNotes('');
    }
    setShowEditModal(true);
  };

  // Open Edit Modal for a Custom Event
  const handleOpenEditCustom = (event?: SiteTimelineEvent) => {
    setEditingStage(null);
    setIsCustomModal(true);
    if (event) {
      setEditingCustomEvent(event);
      setExistingEventId(event.id);
      setFormTitle(event.title);
      setFormStartDate(event.startDate);
      setFormEndDate(event.endDate || event.startDate);
      setFormMode(event.endDate && event.endDate !== event.startDate ? 'range' : 'single');
      setFormNotes(event.notes || '');
    } else {
      setEditingCustomEvent(null);
      setExistingEventId(null);
      setFormTitle('');
      setFormStartDate(format(new Date(), 'yyyy-MM-dd'));
      setFormEndDate(format(new Date(), 'yyyy-MM-dd'));
      setFormMode('single');
      setFormNotes('');
    }
    setShowEditModal(true);
  };

  // Save Modal with Version History
  const handleSaveModal = () => {
    if (!formStartDate) {
      toast.error('Please specify a valid date');
      return;
    }

    const start = formStartDate;
    const end = formMode === 'range' ? (formEndDate || formStartDate) : formStartDate;

    if (formMode === 'range' && end < start) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    const title = formTitle.trim() || (editingStage ? editingStage.defaultTitle : 'Site Milestone');
    const eventType: SiteTimelineEventType = editingStage ? editingStage.type : (editingCustomEvent?.eventType || 'milestone');
    const nowIso = new Date().toISOString();
    const actor = currentUser?.name || 'Admin';

    if (existingEventId) {
      const existing = siteEvents.find(e => e.id === existingEventId);
      const historyItem: MilestoneHistoryItem = {
        id: generateId(),
        timestamp: nowIso,
        changedBy: actor,
        action: 'date_updated',
        startDate: start,
        endDate: end,
        prevStartDate: existing?.startDate,
        prevEndDate: existing?.endDate,
        notes: formNotes.trim() || undefined,
      };

      updateSiteTimelineEvent(existingEventId, {
        title,
        startDate: start,
        endDate: end,
        notes: formNotes.trim(),
        loggedBy: actor,
        updatedAt: nowIso,
        history: [...(existing?.history || []), historyItem],
      });
      toast.success(`${title} updated`);
    } else {
      const historyItem: MilestoneHistoryItem = {
        id: generateId(),
        timestamp: nowIso,
        changedBy: actor,
        action: 'manual_override',
        startDate: start,
        endDate: end,
        prevStartDate: activeModalAuto?.start || undefined,
        prevEndDate: activeModalAuto?.end || undefined,
        source: activeModalAuto?.source || undefined,
        notes: formNotes.trim() || undefined,
      };

      const newEvent: SiteTimelineEvent = {
        id: generateId(),
        siteId: site.id,
        siteName: site.name,
        title,
        eventType,
        startDate: start,
        endDate: end,
        notes: formNotes.trim(),
        loggedBy: actor,
        createdAt: nowIso,
        updatedAt: nowIso,
        history: [historyItem],
      };
      addSiteTimelineEvent(newEvent);
      toast.success(`${title} recorded`);
    }

    // Proactively sync site.startDate if mobilisation was set and site has no startDate
    if (eventType === 'mobilisation' && (!site.startDate || site.startDate > start)) {
      updateSite(site.id, { startDate: start });
    }
    // Proactively sync site.endDate if demobilisation was set and site is marked ended
    if (eventType === 'demobilisation' && end) {
      updateSite(site.id, { endDate: end });
    }

    setShowEditModal(false);
  };

  // Reset to Auto-Extrapolated inside Modal
  const handleResetToAutoInModal = () => {
    if (!existingEventId) return;
    const title = editingStage ? editingStage.title : 'Milestone';
    deleteSiteTimelineEvent(existingEventId);
    toast.success(`Reset ${title} back to auto-extrapolated records`);
    setShowEditModal(false);
  };

  return (
    <div className={cn("space-y-1.5 mb-2.5", className)}>
      {/* ── Succinct Minimalist 4-Stage Horizontal Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {CORE_STAGES.map((stage) => {
          const manualEvent = stageMap.get(stage.type);
          const auto = autoExtrapolated[stage.type as keyof typeof autoExtrapolated];

          const isOverride = !!manualEvent && !!manualEvent.startDate;
          const activeStart = isOverride ? manualEvent.startDate : auto?.start;
          const activeEnd = isOverride ? (manualEvent.endDate || manualEvent.startDate) : (auto?.end || auto?.start);

          const hasData = !!activeStart;
          const isRange = hasData && activeEnd && activeEnd !== activeStart;
          const Icon = stage.icon;

          let durationDays = 1;
          if (hasData) {
            try {
              const sDate = parseISO(activeStart!);
              const eDate = parseISO(activeEnd!);
              durationDays = Math.max(1, differenceInDays(eDate, sDate) + 1);
            } catch {
              durationDays = 1;
            }
          }

          const dateDisplayWithYear = hasData ? formatMilestoneDateWithYear(activeStart!, activeEnd || activeStart) : '';

          return (
            <div
              key={stage.type}
              onClick={() => handleOpenEditCoreStage(stage)}
              title={isOverride ? `Manual Override by ${manualEvent.loggedBy || 'Admin'} • Click to view version control & history` : hasData ? `Auto-extrapolated from ${auto?.source} • Click to view or adjust` : `Click to record date`}
              className={cn(
                "group relative cursor-pointer px-3 py-2 rounded-lg border transition-all duration-150 flex items-center justify-between gap-2 select-none",
                hasData
                  ? "bg-white hover:bg-slate-50/90 dark:bg-slate-900 dark:hover:bg-slate-800/80 border-slate-200/80 dark:border-slate-800 shadow-2xs"
                  : "bg-slate-50/40 dark:bg-slate-950/30 border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/50"
              )}
            >
              {/* Left: Icon & Stage Details */}
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("p-1.5 rounded-md shrink-0 transition-transform group-hover:scale-105", stage.accent.bg, stage.accent.text)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {stage.title}
                    </span>
                  </div>

                  {hasData ? (
                    <div className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 truncate">
                      <span>{dateDisplayWithYear}</span>
                      {isRange && (
                        <span className="text-[10px] text-slate-400 font-sans ml-1">({durationDays}d)</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Not recorded</span>
                  )}
                </div>
              </div>

              {/* Right: Subtle Badge & Edit Icon */}
              <div className="flex items-center gap-1 shrink-0">
                {hasData ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isOverride ? 'Manual' : 'Auto'}
                    </span>
                    <Edit3 className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                    <Plus className="w-3 h-3" /> Set
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Custom Milestones Minimal Chips (if any exist) ── */}
      {customEvents.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Custom:
          </span>
          {customEvents.map(ev => {
            const dateStr = formatMilestoneDateWithYear(ev.startDate, ev.endDate);
            return (
              <div
                key={ev.id}
                onClick={() => handleOpenEditCustom(ev)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{ev.title}:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{dateStr}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteSiteTimelineEvent(ev.id); }}
                  className="text-slate-400 hover:text-rose-600 ml-0.5"
                  title="Remove milestone"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => handleOpenEditCustom()}
            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 ml-1"
          >
            + Add Another
          </button>
        </div>
      )}

      {/* ── Edit / Set Milestone Dialog (with Version Control & Audit Trail) ── */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 space-y-1 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{editingStage ? `${editingStage.title}` : (editingCustomEvent ? 'Edit Milestone' : 'Add Milestone')}</span>
              </DialogTitle>
              {activeModalEvent && (
                <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  Manual Record
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Adjust the date or date range for this milestone. Changes are tracked in version control history.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain style-scroll">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Milestone Title
              </label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Wellpoint Jetting Campaign"
                className="text-xs h-9 px-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Mode Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Date Format
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormMode('single')}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded-lg transition-all",
                    formMode === 'single'
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  Single Date (1 Day)
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode('range')}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded-lg transition-all",
                    formMode === 'range'
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  Date Range (Start &rarr; End)
                </button>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formMode === 'range' ? 'Start Date' : 'Milestone Date'}
                </label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={e => {
                    setFormStartDate(e.target.value);
                    if (formMode === 'single' || !formEndDate || formEndDate < e.target.value) {
                      setFormEndDate(e.target.value);
                    }
                  }}
                  className="text-xs h-9 px-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono rounded-lg"
                />
              </div>

              {formMode === 'range' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={formEndDate}
                    min={formStartDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="text-xs h-9 px-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Notes / Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Remarks / Change Reason <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="e.g. Adjusted based on client supervisor sign-off"
                rows={2}
                className="text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg resize-none"
              />
            </div>

            {/* ── Version Control & Audit Trail Section ── */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Version Control & Change History</span>
                </span>
                {existingEventId && (
                  <button
                    type="button"
                    onClick={handleResetToAutoInModal}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset to Auto Records
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3 space-y-2.5 text-xs">
                {/* 1. Base Extrapolated Record */}
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Auto-Extrapolated Record:
                    </p>
                    {activeModalAuto?.start ? (
                      <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        {formatMilestoneDateWithYear(activeModalAuto.start, activeModalAuto.end)} <span className="font-sans text-slate-400">({activeModalAuto.source})</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No operational records found for this stage yet.</p>
                    )}
                  </div>
                </div>

                {/* 2. Overrides & Change History Items */}
                {activeModalEvent?.history && activeModalEvent.history.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modification Log ({activeModalEvent.history.length})</p>
                    <div className="space-y-2 max-h-36 overflow-y-auto style-scroll">
                      {activeModalEvent.history.slice().reverse().map((item) => (
                        <div key={item.id} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {item.changedBy}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {format(parseISO(item.timestamp), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                            {formatMilestoneDateWithYear(item.startDate, item.endDate)}
                          </p>
                          {item.notes && (
                            <p className="text-[10px] text-slate-500 italic">"{item.notes}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activeModalEvent ? (
                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500">
                    Set by <strong className="text-slate-700 dark:text-slate-300">{activeModalEvent.loggedBy || 'Admin'}</strong>
                    {activeModalEvent.createdAt && (
                      <span> on {format(parseISO(activeModalEvent.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                    )}
                    {activeModalEvent.notes && <p className="italic mt-0.5">"{activeModalEvent.notes}"</p>}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="p-3.5 px-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(false)}
              className="text-xs h-8 px-3.5 border-slate-200 dark:border-slate-700 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveModal}
              className="text-xs h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs"
            >
              Save Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
