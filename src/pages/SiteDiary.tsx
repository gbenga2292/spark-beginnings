import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useAppStore } from '@/src/store/appStore';
import type { SiteJournalEntry, DailyJournal } from '@/src/store/appStore';
import { fetchSiteDiaryEntriesPaginated } from '@/src/lib/supabaseService';
import { Calendar, BookOpen, Image as ImageIcon, FileVideo, Play, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { MediaViewer, type MediaItem } from '@/src/components/ui/MediaViewer';

const PAGE_SIZE = 20;
const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function SiteDiary() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { commLogs, sites } = useAppStore();

  // Local paginated state — keeps journal data out of the global store bloat
  const [localEntries, setLocalEntries] = useState<SiteJournalEntry[]>([]);
  const [localJournals, setLocalJournals] = useState<DailyJournal[]>([]);
  const [nextPage, setNextPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const site = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  // Reset + load first page whenever the site changes
  useEffect(() => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    setLocalEntries([]);
    setLocalJournals([]);
    setNextPage(0);
    setHasMore(false);
    setTotal(0);

    fetchSiteDiaryEntriesPaginated(siteId, 0, PAGE_SIZE)
      .then(({ siteJournalEntries, dailyJournals, hasMore: hm, total: t }) => {
        setLocalEntries(siteJournalEntries);
        setLocalJournals(dailyJournals);
        setHasMore(hm);
        setTotal(t);
        setNextPage(1);
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

    fetchSiteDiaryEntriesPaginated(siteId, nextPage, PAGE_SIZE)
      .then(({ siteJournalEntries, dailyJournals, hasMore: hm, total: t }) => {
        setLocalEntries(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          return [...prev, ...siteJournalEntries.filter(e => !existingIds.has(e.id))];
        });
        setLocalJournals(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          return [...prev, ...dailyJournals.filter(j => !existingIds.has(j.id))];
        });
        setHasMore(hm);
        setTotal(t);
        setNextPage(p => p + 1);
      })
      .catch(err => console.error('SiteDiary loadMore error:', err))
      .finally(() => setIsLoadingMore(false));
  }, [siteId, nextPage, hasMore, isLoadingMore]);

  // Combine: internal comm logs (from store) + paginated journal entries (local)
  const entries = useMemo(() => {
    if (!siteId) return [];

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
          type: 'Journal' as const,
        };
      })
      .filter(e => Boolean(e.date));

    return [...internalLogs, ...journalEntries].sort(
      (a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()
    );
  }, [commLogs, localEntries, localJournals, siteId]);

  useSetPageTitle(
    site ? `${site.name} (${site.client})` : 'Site Diary',
    site ? `Client: ${site.client}` : 'View aggregated daily journal entries',
    null,
    [site],
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
                  fetchSiteDiaryEntriesPaginated(siteId!, 0, PAGE_SIZE)
                    .then(({ siteJournalEntries, dailyJournals, hasMore: hm, total: t }) => {
                      setLocalEntries(siteJournalEntries);
                      setLocalJournals(dailyJournals);
                      setHasMore(hm);
                      setTotal(t);
                      setNextPage(1);
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
              <p className="text-sm text-slate-400 mt-2">Updates are aggregated from the company's Daily Journal.</p>
            </div>
          ) : (
            <>
              {/* Entry count banner */}
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-600">{entries.length}</span>
                  {total > 0 && localEntries.length < total && (
                    <> of <span className="font-bold text-slate-600">{total + commLogs.filter(e => e.siteId === siteId && e.isInternal).length}</span></>
                  )} entries
                </p>
              </div>

              {/* Timeline */}
              <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-0.5 before:bg-slate-200">
                {entries.map(entry => (
                  <div key={entry.id} className="relative flex gap-4 pl-12">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute left-0 top-1 h-[34px] w-[34px] rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm",
                      entry.type === 'Journal' ? "bg-emerald-500" : "bg-indigo-500"
                    )}>
                      <Calendar className="h-4 w-4 text-white" />
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
                            {entry.timestamp && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1">
                                {format(new Date(entry.timestamp), 'HH:mm')}
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                              entry.type === 'Journal'
                                ? "bg-blue-100 text-blue-600"
                                : "bg-indigo-100 text-indigo-600"
                            )}>
                              {entry.type}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 font-medium italic">by {entry.loggedBy}</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed text-[15px]">
                        {entry.narration}
                      </p>
                      {entry.type === 'Journal' && siteId && (
                        <EntryMediaStrip siteId={siteId} date={entry.date} journalId={entry.journalId} />
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
                      <><ChevronDown className="h-4 w-4" /> Load More Entries</>
                    )}
                  </Button>
                </div>
              )}

              {/* All loaded indicator */}
              {!hasMore && entries.length > PAGE_SIZE && (
                <div className="flex justify-center mt-8">
                  <p className="text-xs text-slate-400 font-medium bg-slate-100 px-4 py-2 rounded-full">
                    All {entries.length} entries loaded
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
