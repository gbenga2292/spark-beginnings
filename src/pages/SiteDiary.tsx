import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import type { SiteJournalEntry, DailyJournal } from '@/src/store/appStore';
import type { DailyMachineLog } from '@/src/types/operations';
import { fetchSiteDiaryEntriesByYear, fetchSiteDiaryEntries, db } from '@/src/lib/supabaseService';
import { useNetworkStore } from '@/src/store/networkStore';
import { toast } from '@/src/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/src/components/ui/dialog';
import { cacheSet } from '@/src/lib/offlineCache';
import { Calendar, BookOpen, Image as ImageIcon, FileVideo, Play, ChevronDown, Loader2, Wrench, RefreshCw, Download, Upload, Sparkles, Copy, Check, Printer, Filter, Bot, Activity, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { MediaViewer, type MediaItem } from '@/src/components/ui/MediaViewer';

const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

const renderFormattedChatMessage = (content: string) => {
  if (!content) return null;

  const renderInlineText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            return <strong key={i} className="font-extrabold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
            return <em key={i} className="italic text-indigo-600 dark:text-indigo-200">{part.slice(1, -1)}</em>;
          }
          const cleanPart = part.replace(/\*\*/g, '').replace(/#/g, '');
          return <span key={i}>{cleanPart}</span>;
        })}
      </>
    );
  };

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed font-sans">
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('#') || (/^\*\*[^*]+\*\*:?$/.test(trimmed) && trimmed.length < 60)) {
          const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/#/g, '').trim();
          return (
            <div key={idx} className="text-xs font-black tracking-wider text-indigo-700 dark:text-indigo-300 uppercase mt-3.5 mb-1.5 border-b border-indigo-200 dark:border-indigo-700/50 pb-1 flex items-center gap-1.5">
              <span>{cleanHeader}</span>
            </div>
          );
        }

        if (/^[-*•](\s+|$)/.test(trimmed) || /^\d+[\.\)](\s+|$)/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
          if (!bulletText) return null;
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 my-1 text-slate-800 dark:text-slate-100">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm select-none leading-none mt-0.5">•</span>
              <div className="flex-1">
                {renderInlineText(bulletText)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="my-1 text-slate-700 dark:text-indigo-50">
            {renderInlineText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// ─── Media thumbnail strip ────────────────────────────────────────────────────

function EntryMediaStrip({ siteId, date, journalId }: { siteId: string; date: string; journalId?: string }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = journalId
      ? `${MEDIA_SERVER_URL}/list.php?journal_id=${journalId}`
      : `${MEDIA_SERVER_URL}/list.php?site_id=${siteId}&asset_id=JOURNAL&log_date=${date}`;

    fetch(url)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (!cancelled && Array.isArray(data)) {
          setMedia(
            data.map((m: any) => ({
              id: m.id,
              url: m.url,
              file_type: m.file_type as 'image' | 'video',
              file_name: m.file_name,
            }))
          );
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [siteId, date, journalId]);

  if (media.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-1.5 mb-2">
        <ImageIcon className="h-3 w-3 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {media.length} Attachment{media.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {media.map((m, i) => (
          <div
            key={m.id ?? i}
            onClick={() => setLightboxIndex(i)}
            className="relative h-16 w-16 rounded-lg overflow-hidden cursor-pointer group border border-slate-200 bg-slate-100 flex-shrink-0"
          >
            {m.file_type === 'image' ? (
              <img src={m.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800">
                <FileVideo className="h-5 w-5 text-white/50" />
              </div>
            )}
            {m.file_type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-7 w-7 rounded-full bg-black/60 flex items-center justify-center">
                  <Play className="h-3 w-3 text-white fill-white ml-0.5" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
      {lightboxIndex !== null && (
        <MediaViewer items={media} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}

// ─── Machine Log Details Card ────────────────────────────────────────────────

function MachineLogDetails({ log }: { log: DailyMachineLog }) {
  const [isDowntimeOpen, setIsDowntimeOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Primary Row: Machine Info and Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Machine</span>
          <span className="font-bold text-slate-800 text-base">{log.assetName}</span>
        </div>
        
        <div className="flex gap-2">
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-md border",
            log.isActive 
              ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
              : "bg-red-50 border-red-200 text-red-700"
          )}>
            {log.isActive ? 'Active' : 'Inactive'}
          </span>
          {log.operationalDay && (
            <span className="text-xs font-bold px-2 py-1 rounded-md border bg-slate-100 border-slate-200 text-slate-700 uppercase">
              {log.operationalDay} Day
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row: Diesel & Supervisor */}
      <div className="grid grid-cols-2 gap-4">
        {log.dieselUsage > 0 && (
          <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
            <span className="text-amber-500 font-bold text-base">⛽</span>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Diesel Used</span>
              <span className="font-bold text-slate-700 text-sm">{log.dieselUsage} Litres</span>
            </div>
          </div>
        )}
        {log.supervisorOnSite && (
          <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
            <span className="text-blue-500 font-bold text-base">👤</span>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Supervisor</span>
              <span className="font-bold text-slate-700 text-sm">{log.supervisorOnSite}</span>
            </div>
          </div>
        )}
      </div>

      {/* Details/Notes sections */}
      {log.issuesOnSite && (
        <div className="bg-red-50/40 p-3 rounded-lg border border-red-100/50">
          <span className="text-[10px] font-bold uppercase text-red-600 block mb-1">Issues On Site</span>
          <p className="text-slate-700 text-sm leading-relaxed">{log.issuesOnSite}</p>
        </div>
      )}

      {log.maintenanceDetails && (
        <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100/50">
          <span className="text-[10px] font-bold uppercase text-blue-600 block mb-1">Maintenance Details</span>
          <p className="text-slate-700 text-sm leading-relaxed">{log.maintenanceDetails}</p>
        </div>
      )}

      {log.clientFeedback && (
        <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100/50">
          <span className="text-[10px] font-bold uppercase text-emerald-600 block mb-1">Client Feedback</span>
          <p className="text-slate-700 text-sm leading-relaxed">{log.clientFeedback}</p>
        </div>
      )}

      {/* Downtime section */}
      {log.downtimeEntries && log.downtimeEntries.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsDowntimeOpen(!isDowntimeOpen)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              ⚠️ {log.downtimeEntries.length} Downtime {log.downtimeEntries.length === 1 ? 'Record' : 'Records'}
            </span>
            <span className="text-xs text-slate-400 font-bold uppercase">
              {isDowntimeOpen ? 'Hide' : 'Show'}
            </span>
          </button>
          {isDowntimeOpen && (
            <div className="p-3 bg-white border-t border-slate-200 space-y-2.5 divide-y divide-slate-100">
              {log.downtimeEntries.map((d: any, idx: number) => (
                <div key={d.id || idx} className="pt-2 first:pt-0 flex justify-between items-start gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{d.reason}</span>
                    <span className={cn(
                      "text-[9px] font-bold uppercase px-1 py-0.5 rounded mt-1 inline-block",
                      d.severity === 'high' && "bg-red-100 text-red-700",
                      d.severity === 'medium' && "bg-amber-100 text-amber-700",
                      d.severity === 'low' && "bg-slate-100 text-slate-700"
                    )}>
                      {d.severity} severity
                    </span>
                  </div>
                  <span className="font-bold text-slate-600 flex-shrink-0">{d.durationHours} hrs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SiteDiary() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { commLogs, sites } = useAppStore();
  // dailyMachineLogs from OperationsContext is already loaded with proper auth at app start.
  // Using it here avoids a separate query that fails silently due to RLS on operations_daily_logs.
  const { dailyMachineLogs: allMachineLogs } = useOperations();

  // Local state for year-by-year diary logs (journal entries only)
  const [localEntries, setLocalEntries] = useState<SiteJournalEntry[]>([]);
  const [localJournals, setLocalJournals] = useState<DailyJournal[]>([]);
  // Track which year window has been loaded so we can filter allMachineLogs accordingly
  const [oldestLoadedYear, setOldestLoadedYear] = useState<number>(new Date().getFullYear());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<{ journals: DailyJournal[], entries: SiteJournalEntry[] }>({ journals: [], entries: [] });
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // AI Summary State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPreset, setAiPreset] = useState<'all' | '7days' | '30days' | 'thisMonth' | 'custom'>('all');
  const [aiStartDate, setAiStartDate] = useState('');
  const [aiEndDate, setAiEndDate] = useState('');
  const [aiScope, setAiScope] = useState({
    journals: true,
    machineLogs: true,
    internalNotes: true,
  });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const { connectionStatus } = useNetworkStore();

  const handleSync = useCallback(async () => {
    if (!siteId) return;
    if (connectionStatus === 'offline') {
      toast.warning('You are offline. Connect to the internet to sync diary logs.');
      return;
    }
    setIsSyncing(true);
    toast.info('Syncing all site diary logs...');
    try {
      // 1. Fetch remote Supabase records
      const { siteJournalEntries, dailyJournals } = await fetchSiteDiaryEntries(siteId);

      // 2. Identify local-only entries in the global Zustand store (IndexedDB cache)
      const cachedEntries = useAppStore.getState().siteJournalEntries.filter(e => e.siteId === siteId);
      const cachedJournalIds = new Set(cachedEntries.map(e => e.journalId));
      const cachedJournals = useAppStore.getState().dailyJournals.filter(j => cachedJournalIds.has(j.id));

      const dbEntryIds = new Set(siteJournalEntries.map(e => e.id));
      const localOnlyEntries = cachedEntries.filter(e => !dbEntryIds.has(e.id));
      const dbJournalIds = new Set(dailyJournals.map(j => j.id));
      const localOnlyJournals = cachedJournals.filter(j => !dbJournalIds.has(j.id));

      if (localOnlyJournals.length > 0 || localOnlyEntries.length > 0) {
        setPendingUploads({ journals: localOnlyJournals, entries: localOnlyEntries });
        setIsComparisonOpen(true);
      } else {
        // No local-only entries, proceed with regular pull sync
        setLocalEntries(siteJournalEntries);
        setLocalJournals(dailyJournals);
        setHasMore(false);
        if (siteJournalEntries.length > 0) {
          const oldest = siteJournalEntries.reduce((min, e) => {
            const y = new Date(e.createdAt).getFullYear();
            return y < min ? y : min;
          }, new Date().getFullYear());
          setCurrentYear(oldest);
          setOldestLoadedYear(oldest);
        }
        toast.success(`Synced ${siteJournalEntries.length} diary entr${siteJournalEntries.length === 1 ? 'y' : 'ies'} successfully.`);
      }
    } catch (err) {
      console.error('SiteDiary handleSync error:', err);
      toast.error('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [siteId, connectionStatus]);

  const handleUploadPending = useCallback(async () => {
    if (!siteId) return;
    setIsComparisonOpen(false);
    setIsSyncing(true);
    toast.info('Uploading offline entries...');
    try {
      // Insert all local-only journals + entries
      for (const journal of pendingUploads.journals) {
        const journalEntries = pendingUploads.entries.filter(e => e.journalId === journal.id);
        await db.insertDailyJournal(journal, journalEntries);
      }

      // Re-fetch all entries to update the view & local store cache
      const { siteJournalEntries, dailyJournals } = await fetchSiteDiaryEntries(siteId);

      // Update global Zustand store so we have a unified state
      useAppStore.setState((s) => {
        const otherEntries = s.siteJournalEntries.filter(e => e.siteId !== siteId);
        const otherJournals = s.dailyJournals.filter(j => !s.siteJournalEntries.some(e => e.siteId === siteId && e.journalId === j.id));
        const nextState = {
          siteJournalEntries: [...otherEntries, ...siteJournalEntries],
          dailyJournals: [...otherJournals, ...dailyJournals],
        };
        cacheSet('appData', { ...s, ...nextState }).catch(err => console.warn('cacheSet failed:', err));
        return nextState;
      });

      // Update component state
      setLocalEntries(siteJournalEntries);
      setLocalJournals(dailyJournals);
      setHasMore(false);
      if (siteJournalEntries.length > 0) {
        const oldest = siteJournalEntries.reduce((min, e) => {
          const y = new Date(e.createdAt).getFullYear();
          return y < min ? y : min;
        }, new Date().getFullYear());
        setCurrentYear(oldest);
        setOldestLoadedYear(oldest);
      }

      toast.success(`Successfully uploaded ${pendingUploads.journals.length} offline sessions and synced.`);
      setPendingUploads({ journals: [], entries: [] });
    } catch (err) {
      console.error('handleUploadPending error:', err);
      toast.error('Failed to upload offline entries. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [siteId, pendingUploads]);

  const handleDiscardPending = useCallback(async () => {
    if (!siteId) return;
    setIsComparisonOpen(false);
    setIsSyncing(true);
    toast.info('Discarding offline entries and syncing...');
    try {
      // Remove pending entries/journals from global Zustand store
      useAppStore.setState((s) => {
        const filteredEntries = s.siteJournalEntries.filter(e => !pendingUploads.entries.some(p => p.id === e.id));
        const filteredJournals = s.dailyJournals.filter(j => !pendingUploads.journals.some(p => p.id === j.id));
        const nextState = {
          siteJournalEntries: filteredEntries,
          dailyJournals: filteredJournals,
        };
        cacheSet('appData', { ...s, ...nextState }).catch(err => console.warn('cacheSet failed:', err));
        return nextState;
      });

      // Fetch from Supabase
      const { siteJournalEntries, dailyJournals } = await fetchSiteDiaryEntries(siteId);
      setLocalEntries(siteJournalEntries);
      setLocalJournals(dailyJournals);
      setHasMore(false);
      if (siteJournalEntries.length > 0) {
        const oldest = siteJournalEntries.reduce((min, e) => {
          const y = new Date(e.createdAt).getFullYear();
          return y < min ? y : min;
        }, new Date().getFullYear());
        setCurrentYear(oldest);
        setOldestLoadedYear(oldest);
      }
      toast.success('Offline entries discarded. Database state synced.');
      setPendingUploads({ journals: [], entries: [] });
    } catch (err) {
      console.error('handleDiscardPending error:', err);
      toast.error('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [siteId, pendingUploads]);

  const site = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  // Reset + load first year whenever the site changes
  useEffect(() => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    setLocalEntries([]);
    setLocalJournals([]);
    const startYear = new Date().getFullYear();
    setCurrentYear(startYear);
    setOldestLoadedYear(startYear);
    setHasMore(false);
    fetchSiteDiaryEntriesByYear(siteId, startYear)
      .then(({ siteJournalEntries, dailyJournals, hasMore: hm }) => {
        setLocalEntries(siteJournalEntries);
        setLocalJournals(dailyJournals);
        setHasMore(hm);
      })
      .catch(err => {
        console.error('SiteDiary fetch error:', err);
        setError('Failed to load diary entries. Please try again.');
      })
      .finally(() => setIsLoading(false));
  }, [siteId]);

  const loadMore = useCallback(() => {
    if (!siteId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const targetYear = currentYear - 1;

    fetchSiteDiaryEntriesByYear(siteId, targetYear)
      .then(({ siteJournalEntries, dailyJournals, hasMore: hm }) => {
        setLocalEntries(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          return [...prev, ...siteJournalEntries.filter(e => !existingIds.has(e.id))];
        });
        setLocalJournals(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          return [...prev, ...dailyJournals.filter(j => !existingIds.has(j.id))];
        });
        setHasMore(hm);
        setCurrentYear(targetYear);
        setOldestLoadedYear(targetYear);
      })
      .catch(err => console.error('SiteDiary loadMore error:', err))
      .finally(() => setIsLoadingMore(false));
  }, [siteId, currentYear, hasMore, isLoadingMore]);

  // Combine: internal comm logs + local journal entries + machine logs from OperationsContext
  const entries = useMemo(() => {
    if (!siteId) return [];

    const newestYear = new Date().getFullYear();
    const yearStart = `${oldestLoadedYear}-01-01`;
    const yearEnd = `${newestYear}-12-31`;

    const internalLogs = commLogs
      .filter(e => e.siteId === siteId && e.isInternal === true)
      .map(entry => ({
        id: entry.id,
        journalId: undefined as string | undefined,
        date: entry.date,
        timestamp: entry.createdAt,
        loggedBy: entry.loggedBy || 'Unknown',
        narration: entry.notes,
        type: 'Comm Log' as const,
        machineLog: undefined as DailyMachineLog | undefined,
      }));

    const journalEntries = localEntries
      .map(entry => {
        const parent = localJournals.find(j => j.id === entry.journalId);
        return {
          id: entry.id,
          journalId: entry.journalId,
          date: parent?.date || entry.createdAt.split('T')[0],
          timestamp: entry.createdAt,
          loggedBy: entry.loggedBy || 'Unknown',
          narration: entry.narration,
          progressPercentage: entry.progressPercentage,
          dewateringStage: entry.dewateringStage,
          type: 'Journal' as const,
          machineLog: undefined as DailyMachineLog | undefined,
        };
      })
      .filter(e => Boolean(e.date));

    // Filter machine logs from the context by site and the loaded year window.
    // Only keep them as separate timeline items if there is no manual journal entry on that date.
    const machineEntries = allMachineLogs
      .filter(log => log.siteId === siteId && log.date >= yearStart && log.date <= yearEnd && !journalEntries.some(j => j.date === log.date))
      .map(log => ({
        id: log.id,
        journalId: undefined,
        date: log.date,
        timestamp: log.created_at || `${log.date}T00:00:00Z`,
        loggedBy: log.loggedBy || 'System',
        narration: '',
        type: 'Machine Log' as const,
        machineLog: log,
      }));

    return [...internalLogs, ...journalEntries, ...machineEntries].sort(
      (a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()
    );
  }, [commLogs, localEntries, localJournals, allMachineLogs, siteId, oldestLoadedYear]);

  // ─── Export: downloads all loaded journal entries for this site as JSON ──────
  const handleExport = useCallback(async () => {
    if (!siteId || !site) return;
    setIsExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        siteId,
        siteName: site.name,
        dailyJournals: localJournals,
        siteJournalEntries: localEntries,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SiteDiary_${site.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${localEntries.length} diary entries.`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [siteId, site, localJournals, localEntries]);

  // ─── Import: reads JSON, skips duplicates by ID, inserts only new entries ────
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importInputRef.current) importInputRef.current.value = '';
    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      if (!payload?.dailyJournals || !payload?.siteJournalEntries) {
        toast.error('Invalid file format. Please use a file exported from this app.');
        return;
      }

      const journals: DailyJournal[] = payload.dailyJournals;
      const entries: SiteJournalEntry[] = payload.siteJournalEntries;

      if (journals.length === 0) {
        toast.info('No journal entries found in this file.');
        return;
      }

      // Simpler approach: use the supabase client directly
      const { supabase } = await import('@/src/integrations/supabase/client');
      const { data: existingRows } = await supabase
        .from('daily_journals')
        .select('id')
        .in('id', journals.map(j => j.id));

      const existingIds = new Set((existingRows ?? []).map((r: any) => r.id));
      const newJournals = journals.filter(j => !existingIds.has(j.id));
      const newEntries = entries.filter(e => newJournals.some(j => j.id === e.journalId));

      if (newJournals.length === 0) {
        toast.info('All entries in this file already exist in the database. Nothing to import.');
        return;
      }

      // Insert new journals + their entries one by one so FK constraint is satisfied
      let inserted = 0;
      for (const journal of newJournals) {
        const journalEntries = newEntries.filter(e => e.journalId === journal.id);
        await db.insertDailyJournal(journal, journalEntries);
        inserted++;
      }

      toast.success(`Imported ${inserted} new journal entr${inserted === 1 ? 'y' : 'ies'} (${journals.length - newJournals.length} skipped as duplicates).`);

      // Refresh the view
      await handleSync();
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Import failed. The file may be corrupted or in an invalid format.');
    } finally {
      setIsImporting(false);
    }
  }, [handleSync]);

  const handleGenerateAiSummary = useCallback(() => {
    setIsGeneratingAi(true);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let startLimit = '';
    let endLimit = todayStr;

    if (aiPreset === '7days') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startLimit = d.toISOString().split('T')[0];
    } else if (aiPreset === '30days') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startLimit = d.toISOString().split('T')[0];
    } else if (aiPreset === 'thisMonth') {
      startLimit = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (aiPreset === 'custom') {
      startLimit = aiStartDate;
      endLimit = aiEndDate || todayStr;
    }

    const filtered = entries.filter(entry => {
      if (startLimit && entry.date < startLimit) return false;
      if (endLimit && entry.date > endLimit) return false;
      if (entry.type === 'Journal' && !aiScope.journals) return false;
      if (entry.type === 'Machine Log' && !aiScope.machineLogs) return false;
      if (entry.type === 'Comm Log' && !aiScope.internalNotes) return false;
      return true;
    });

    if (filtered.length === 0) {
      setAiSummary('⚠️ **No logs found** matching the selected date range and filter criteria. Please broaden your dates.');
      setIsGeneratingAi(false);
      return;
    }

    const formatPrettyDate = (dStr: string) => {
      try {
        const [y, m, d] = dStr.split('-').map(Number);
        if (y && m && d) {
          const dateObj = new Date(y, m - 1, d);
          return dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
        return dStr;
      } catch {
        return dStr;
      }
    };

    const dates = Array.from(new Set(filtered.map(e => e.date))).sort();
    const firstDateLabel = formatPrettyDate(dates[0]);
    const lastDateLabel = formatPrettyDate(dates[dates.length - 1]);

    const journalLogs = filtered.filter(e => e.type === 'Journal');
    const machineLogs = filtered.filter(e => e.type === 'Machine Log' && e.machineLog);
    const internalLogs = filtered.filter(e => e.type === 'Comm Log');

    let fullDays = 0;
    let halfDays = 0;
    let inactiveDays = 0;
    const machinesSeen = new Set<string>();
    const standbyRemarks = new Set<string>();

    machineLogs.forEach(entry => {
      const log = entry.machineLog!;
      const mName = (log as any).machineName || (log as any).machine_name || log.assetName || log.assetId;
      if (mName) machinesSeen.add(mName);
      const status = log.operationalDay ?? (log.isActive ? 'full' : 'none');
      if (status === 'full') fullDays++;
      else if (status === 'half') halfDays++;
      else inactiveDays++;

      const dReason = (log as any).downtimeReason || (log as any).downtime_reason;
      const rem = (log as any).remarks || (log as any).comments || log.issuesOnSite;
      if (dReason) standbyRemarks.add(String(dReason).trim());
      if (rem) standbyRemarks.add(String(rem).trim());
    });

    const loggedBySet = new Set<string>();
    filtered.forEach(e => {
      if (e.loggedBy && e.loggedBy.toLowerCase() !== 'system' && e.loggedBy.toLowerCase() !== 'unknown') {
        loggedBySet.add(e.loggedBy);
      }
    });

    const fieldNotes: string[] = [];
    journalLogs.forEach(j => {
      if (j.narration && j.narration.trim().length > 2) {
        fieldNotes.push(j.narration.trim());
      }
    });

    // Group logs by date in descending order (latest first)
    const dateMap = new Map<string, typeof filtered>();
    filtered.forEach(entry => {
      const arr = dateMap.get(entry.date) || [];
      arr.push(entry);
      dateMap.set(entry.date, arr);
    });
    const sortedDatesDesc = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

    const timelineNarrative: string[] = [];
    sortedDatesDesc.forEach(d => {
      const dayLogs = dateMap.get(d) || [];
      const prettyDate = formatPrettyDate(d);

      const jLogs = dayLogs.filter(e => e.type === 'Journal');
      const mLogs = dayLogs.filter(e => e.type === 'Machine Log' && e.machineLog);
      const cLogs = dayLogs.filter(e => e.type === 'Comm Log');

      const narrativeParts: string[] = [];

      jLogs.forEach(j => {
        const stageStr = (j as any).dewateringStage ? `[Stage: ${(j as any).dewateringStage}] ` : '';
        const progStr = (j as any).progressPercentage !== undefined ? `(${ (j as any).progressPercentage}% progress) ` : '';
        const author = j.loggedBy && j.loggedBy !== 'Unknown' ? `by ${j.loggedBy}` : '';
        const authorSuffix = author ? ` (${author})` : '';
        if (j.narration && j.narration.trim()) {
          narrativeParts.push(`• **${prettyDate}**${authorSuffix}: ${stageStr}${progStr}"${j.narration.trim()}"`);
        } else {
          narrativeParts.push(`• **${prettyDate}**${authorSuffix}: Daily field journal logged.`);
        }
      });

      if (mLogs.length > 0 && jLogs.length === 0) {
        const mSummaries = mLogs.map(ml => {
          const log = ml.machineLog!;
          const name = log.assetName || (log as any).machineName || log.assetId;
          const status = log.operationalDay === 'full' ? 'ran full day' : log.operationalDay === 'half' ? 'ran half day' : (log.isActive ? 'active' : 'on standby (inactive)');
          const diesel = log.dieselUsage > 0 ? ` with ${log.dieselUsage}L diesel consumed` : '';
          const remarks = log.issuesOnSite ? ` (Notes: ${log.issuesOnSite})` : ((log as any).remarks ? ` (${(log as any).remarks})` : '');
          return `${name} was ${status}${diesel}${remarks}`;
        }).join('; ');
        narrativeParts.push(`• **${prettyDate}** [Equipment Update]: ${mSummaries}.`);
      }

      cLogs.forEach(c => {
        if (c.narration && c.narration.trim()) {
          narrativeParts.push(`• **${prettyDate}** [Internal Note]: ${c.narration.trim()}`);
        }
      });

      if (narrativeParts.length > 0) {
        timelineNarrative.push(narrativeParts.join('\n'));
      }
    });

    const totalDaysCount = dates.length;
    const activeRate = totalDaysCount > 0 ? Math.round(((fullDays + halfDays * 0.5) / Math.max(1, machineLogs.length || 1)) * 100) : 0;
    
    const isInactiveOrStandby = (machineLogs.length === 0 && journalLogs.length > 0 && fieldNotes.some(n => n.toLowerCase().includes('inactive') || n.toLowerCase().includes('standby'))) || (activeRate === 0 && fullDays === 0);

    const overallNarrativeParagraph = isInactiveOrStandby
      ? `During this period, the site remained primarily on **standby / inactive status**. No active dewatering pump operations or diesel consumption were logged on site.`
      : (activeRate > 70) 
        ? `Operations on site were **actively progressing** during this period, with steady machine runtime and daily routine tracking recorded.` 
        : `Site operations were **intermittent / in a standby phase**, with activity recorded on select dates while other days remained idle.`;

    const siteTitle = site ? `${site.name}` : 'Site';
    const clientTitle = site?.client ? ` (Client: ${site.client})` : '';

    const markdown = [
      `Here is your executive site briefing for **${siteTitle}**${clientTitle} covering **${firstDateLabel}** to **${lastDateLabel}**:`,
      ``,
      `### 📋 Executive Status & Overview`,
      `${overallNarrativeParagraph} A total of **${filtered.length} log entry/entries** were documented across **${totalDaysCount} active date(s)**, recorded by **${loggedBySet.size > 0 ? Array.from(loggedBySet).join(', ') : 'the operations team'}**.`,
      ``,
      `### 🗓️ Day-by-Day Field Update`,
      timelineNarrative.length > 0 ? timelineNarrative.join('\n\n') : `• *No specific activity narratives were entered for these dates.*`,
      ``,
      `### 🚜 Equipment & Machinery Status`,
      machinesSeen.size > 0
        ? [
            `• **Stationed Equipment:** ${Array.from(machinesSeen).join(', ')}`,
            `• **Runtime Summary:** ${fullDays} full operational day(s), ${halfDays} half day(s), and ${inactiveDays} standby/off day(s).`,
            standbyRemarks.size > 0 ? `• **Standby / Downtime Notes:** ${Array.from(standbyRemarks).slice(0, 3).join('; ')}` : `• **Status:** Stationed equipment is in standby readiness.`
          ].join('\n')
        : `• No heavy machinery logs recorded for this timeframe.`,
      ``,
      `### 💡 Key Action Points`,
      `1. **Site Verification:** ${isInactiveOrStandby ? `Follow up with ${site?.client || 'the client'} regarding their scheduled start date to align pump mobilization and standby charges.` : 'Ensure daily machine logs continue to be submitted to maintain contract runtime tracking.'}`,
      `2. **Resource Auditing:** Verify diesel refills and technician attendance match on-site logs prior to invoice finalization.`
    ].join('\n');

    setTimeout(() => {
      setAiSummary(markdown);
      setIsGeneratingAi(false);
    }, 300);
  }, [entries, aiPreset, aiStartDate, aiEndDate, aiScope, site]);

  const handleCopySummary = () => {
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary.replace(/###/g, '').replace(/####/g, '').replace(/\*\*/g, ''));
    setIsCopied(true);
    toast.success('AI summary copied to clipboard.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrintSummary = () => {
    if (!aiSummary) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head>
          <title>${site?.name || 'Site'} — AI Executive Briefing</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            h1 { font-size: 20px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
            h2 { font-size: 15px; color: #4338ca; margin-top: 24px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
            p, li { font-size: 13px; margin: 4px 0; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; }
            .badge { background: #eef2ff; color: #4338ca; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0;border:none;padding:0;">${site?.name || 'Site'} — AI Executive Briefing</h1>
              <p style="margin:4px 0 0 0;color:#64748b;">Client: ${site?.client || 'N/A'}</p>
            </div>
            <span class="badge">DCEL AI INTELLIGENCE</span>
          </div>
          <div>${aiSummary.replace(/\n/g, '<br/>').replace(/### (.*?)/g, '<h2>$1</h2>').replace(/#### (.*?)/g, '<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      {/* AI Summarize */}
      <Button
        id="site-diary-ai-summary-btn"
        size="sm"
        onClick={() => {
          setShowAiModal(true);
          if (!aiSummary) {
            handleGenerateAiSummary();
          }
        }}
        className="h-8 gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Summarize with AI</span>
        <span className="sm:hidden">AI Summary</span>
      </Button>
      {/* Import */}
      <label
        id="site-diary-import-btn"
        className={cn(
          'flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-semibold transition-all cursor-pointer active:scale-95',
          'border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400',
          'dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20',
          isImporting && 'opacity-70 cursor-not-allowed pointer-events-none'
        )}
      >
        {isImporting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Download className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{isImporting ? 'Importing…' : 'Import'}</span>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
          disabled={isImporting}
        />
      </label>

      {/* Export */}
      <Button
        id="site-diary-export-btn"
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={isExporting || localEntries.length === 0}
        className={cn(
          'h-8 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-400',
          'dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
          'font-semibold text-xs transition-all active:scale-95',
          (isExporting || localEntries.length === 0) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isExporting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Upload className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export'}</span>
      </Button>

      {/* Sync */}
      <Button
        id="site-diary-sync-btn"
        size="sm"
        variant="outline"
        onClick={handleSync}
        disabled={isSyncing}
        className={cn(
          'h-8 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400',
          'dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20',
          'font-semibold text-xs transition-all active:scale-95',
          isSyncing && 'opacity-70 cursor-not-allowed'
        )}
      >
        <RefreshCw
          className={cn('h-3.5 w-3.5 transition-transform duration-500', isSyncing && 'animate-spin')}
        />
        {isSyncing ? 'Syncing…' : 'Sync Now'}
      </Button>
    </div>
  );

  useSetPageTitle(
    site ? `${site.name} (${site.client})` : 'Site Diary',
    site ? `Client: ${site.client}` : 'View aggregated daily journal entries',
    headerActions,
    [site, isSyncing, handleSync, isExporting, isImporting, localEntries.length, handleExport, handleImportFile],
    () => navigate(-1)
  );

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <h2 className="text-xl font-bold text-slate-800">Site not found</h2>
        <Button variant="link" onClick={() => navigate('/sites')} className="text-emerald-600 hover:underline mt-2">
          Return to Sites
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl">

          {/* Loading skeleton */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-4" />
              <p className="text-slate-500 font-medium text-lg">Loading site diary...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-red-500 font-medium">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  const startYear = new Date().getFullYear();
                  setCurrentYear(startYear);
                  setOldestLoadedYear(startYear);
                  fetchSiteDiaryEntriesByYear(siteId!, startYear)
                    .then(({ siteJournalEntries, dailyJournals, hasMore: hm }) => {
                      setLocalEntries(siteJournalEntries);
                      setLocalJournals(dailyJournals);
                      setHasMore(hm);
                    })
                    .catch(() => setError('Failed to load. Please try again.'))
                    .finally(() => setIsLoading(false));
                }}
              >
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen className="h-16 w-16 text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium text-lg">No diary entries found for this site.</p>
              <p className="text-sm text-slate-400 mt-2">Updates are aggregated from the company's Daily Journal and Machine Logs.</p>
            </div>
          ) : (
            <>
              {/* Entry count banner & AI Action */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-600">{entries.length}</span> logs (Years: {currentYear} to {new Date().getFullYear()})
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAiModal(true);
                    if (!aiSummary) handleGenerateAiSummary();
                  }}
                  className="h-7 px-2.5 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30 gap-1.5 shadow-xs transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  <span>AI Log Digest</span>
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-0.5 before:bg-slate-200">
                {entries.map(entry => (
                  <div key={entry.id} className="relative flex gap-4 pl-12">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute left-0 top-1 h-[34px] w-[34px] rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm text-white",
                      entry.type === 'Journal' && "bg-emerald-500",
                      entry.type === 'Comm Log' && "bg-blue-500",
                      entry.type === 'Machine Log' && "bg-amber-500"
                    )}>
                      {entry.type === 'Machine Log' ? (
                        <Wrench className="h-4 w-4" />
                      ) : (
                        <Calendar className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content card */}
                    <div className="bg-white border text-sm border-slate-200 rounded-lg p-5 shadow-sm w-full">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-base">
                            {new Date(entry.date).toLocaleDateString(undefined, {
                              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {entry.timestamp && entry.type !== 'Machine Log' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1">
                                {format(new Date(entry.timestamp), 'HH:mm')}
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                              entry.type === 'Journal' && "bg-emerald-100 text-emerald-600",
                              entry.type === 'Comm Log' && "bg-blue-100 text-blue-600",
                              entry.type === 'Machine Log' && "bg-amber-100 text-amber-700"
                            )}>
                              {entry.type}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 font-medium italic">by {entry.loggedBy}</span>
                      </div>
                      
                      {entry.type === 'Machine Log' && entry.machineLog ? (
                        <MachineLogDetails log={entry.machineLog} />
                      ) : (
                        <div className="space-y-3">
                          {((entry as any).dewateringStage || (entry as any).progressPercentage !== undefined) && (
                            <div className="flex flex-wrap items-center gap-2">
                              {(entry as any).dewateringStage && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                                  Stage: {(entry as any).dewateringStage}
                                </span>
                              )}
                              {(entry as any).progressPercentage !== undefined && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                  Progress: {(entry as any).progressPercentage}%
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed text-[15px]">
                            {entry.narration}
                          </p>
                        </div>
                      )}
                      
                      {entry.type === 'Journal' && siteId && (
                        <>
                          <EntryMediaStrip siteId={siteId} date={entry.date} journalId={entry.journalId} />
                          {(() => {
                            const matchingMachineLogs = allMachineLogs.filter(l => 
                              (l.siteId === siteId || (site && l.siteName && l.siteName.toLowerCase().trim() === site.name.toLowerCase().trim())) && 
                              l.date === entry.date
                            );
                            if (matchingMachineLogs.length === 0) return null;
                            return (
                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  On-Site Equipment Logs ({matchingMachineLogs.length})
                                </p>
                                <div className="space-y-3">
                                  {matchingMachineLogs.map(ml => (
                                    <MachineLogDetails key={ml.id} log={ml} />
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More button */}
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
                    ) : (
                      <><ChevronDown className="h-4 w-4" /> Load Previous Year</>
                    )}
                  </Button>
                </div>
              )}

              {/* All loaded indicator */}
              {!hasMore && entries.length > 0 && (
                <div className="flex justify-center mt-8">
                  <p className="text-xs text-slate-400 font-medium bg-slate-100 px-4 py-2 rounded-full">
                    All logs loaded
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {renderComparisonModal()}
      {renderAiSummaryModal()}
    </div>
  );

  function renderAiSummaryModal() {
    return (
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  AI Operations & Diary Digest
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {site?.name} ({site?.client}) — Automated intelligence synthesis
                </DialogDescription>
              </div>
            </div>
            <DialogClose className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors" />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 style-scroll">
            {/* Filter Configuration Toolbar */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-500" /> Reporting Timeframe:
                </span>
                
                {/* Date Preset Buttons */}
                <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  {[
                    { id: 'all', label: 'All Logs' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: 'thisMonth', label: 'This Month' },
                    { id: '30days', label: 'Last 30 Days' },
                    { id: 'custom', label: 'Custom Range' },
                  ].map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setAiPreset(preset.id as any);
                      }}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                        aiPreset === preset.id
                          ? "bg-indigo-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Pickers */}
              {aiPreset === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">From:</span>
                    <Input
                      type="date"
                      value={aiStartDate}
                      onChange={e => setAiStartDate(e.target.value)}
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">To:</span>
                    <Input
                      type="date"
                      value={aiEndDate}
                      onChange={e => setAiEndDate(e.target.value)}
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Scope Checkboxes & Generate Trigger */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aiScope.journals}
                      onChange={e => setAiScope(s => ({ ...s, journals: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Field Journals</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aiScope.machineLogs}
                      onChange={e => setAiScope(s => ({ ...s, machineLogs: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Machine Operations</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aiScope.internalNotes}
                      onChange={e => setAiScope(s => ({ ...s, internalNotes: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Internal Notes</span>
                  </label>
                </div>

                <Button
                  size="sm"
                  onClick={handleGenerateAiSummary}
                  disabled={isGeneratingAi}
                  className="h-8 px-3.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm active:scale-95"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate AI Brief</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* AI Summary Content Output */}
            {isGeneratingAi ? (
              <div className="py-16 text-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 animate-pulse">
                  <Sparkles className="w-6 h-6 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Analyzing field journals & equipment logs...</p>
                <p className="text-xs text-slate-400">Synthesizing operational highlights, runtime patterns, and standby reasons.</p>
              </div>
            ) : aiSummary ? (
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm space-y-3 text-xs leading-relaxed font-sans">
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200">
                  {renderFormattedChatMessage(aiSummary)}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium">Select your date range and click Generate AI Brief.</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                disabled={!aiSummary || isGeneratingAi}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{isCopied ? 'Copied!' : 'Copy Summary'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintSummary}
                disabled={!aiSummary || isGeneratingAi}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print / PDF</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAiModal(false)}
              className="h-8 text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderComparisonModal() {
    return (
      <Dialog open={isComparisonOpen} onOpenChange={setIsComparisonOpen} fullScreenMobile>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Sync Comparison (Pending Uploads)</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The following logs exist on this device but are missing from the database.
              </DialogDescription>
            </div>
            <DialogClose className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors" />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-white dark:bg-slate-950">
            <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-950/20 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
              <strong>Offline Logs Detected:</strong> We found <strong>{pendingUploads.journals.length}</strong> unsynced field activity session(s). Choose <strong>Upload & Sync</strong> to merge these logs into the company database, or <strong>Discard Local Logs</strong> to overwrite the local cache with the database state.
            </div>

            <div className="space-y-3">
              {pendingUploads.entries.map((entry) => {
                const journal = pendingUploads.journals.find(j => j.id === entry.journalId);
                const dateLabel = journal ? new Date(journal.date + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                }) : 'Unknown Date';
                
                return (
                  <div key={entry.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 transition-all flex flex-col gap-2">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{dateLabel}</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-0.5">Local Log Entry</span>
                      </div>
                      <span className="text-xs text-slate-400 italic">by {entry.loggedBy}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-line font-normal italic">
                      "{entry.narration || 'No narrative provided.'}"
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/20">
            <Button
              variant="outline"
              onClick={() => setIsComparisonOpen(false)}
              className="h-9 px-4 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            
            <Button
              variant="outline"
              onClick={handleDiscardPending}
              className="h-9 px-4 text-xs font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-400 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/20"
            >
              Discard Local Logs
            </Button>
            
            <Button
              onClick={handleUploadPending}
              className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
            >
              Upload & Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

