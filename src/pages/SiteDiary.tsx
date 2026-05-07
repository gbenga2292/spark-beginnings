import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useAppStore } from '@/src/store/appStore';
import { Calendar, BookOpen, ArrowLeft, Building2, Image as ImageIcon, FileVideo, Play } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { MediaViewer, type MediaItem } from '@/src/components/ui/MediaViewer';

const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

function EntryMediaStrip({ siteId, date, journalId }: { siteId: string; date: string; journalId?: string }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = journalId 
      ? `${MEDIA_SERVER_URL}/list.php?journal_id=${journalId}`
      : `${MEDIA_SERVER_URL}/list.php?site_id=${siteId}&asset_id=JOURNAL&log_date=${date}`;

    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!cancelled && Array.isArray(data)) {
          setMedia(data.map((m: any) => ({ id: m.id, url: m.url, file_type: m.file_type as 'image' | 'video', file_name: m.file_name })));
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

export function SiteDiary() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { commLogs, sites, siteJournalEntries, dailyJournals } = useAppStore();

  const site = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  const entries = useMemo(() => {
    if (!siteId) return [];
    
    // Get internal comm logs
    const internalLogs = commLogs
      .filter(e => e.siteId === siteId && e.isInternal === true)
      .map(entry => ({
        id: entry.id,
        date: entry.date,
        timestamp: entry.createdAt,
        loggedBy: entry.loggedBy || 'Unknown',
        narration: entry.notes,
        type: 'Comm Log'
      }));

    // Get site journal entries
    const journalEntries = siteJournalEntries
      .filter(e => e.siteId === siteId)
      .map(entry => {
        const parent = dailyJournals.find(j => j.id === entry.journalId);
        return {
          id: entry.id,
          date: parent?.date || entry.createdAt.split('T')[0],
          timestamp: entry.createdAt,
          loggedBy: entry.loggedBy || 'Unknown',
          narration: entry.narration,
          type: 'Journal'
        };
      })
      .filter(e => e.date !== undefined);

    return [...internalLogs, ...journalEntries]
      .sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());
  }, [commLogs, siteJournalEntries, dailyJournals, siteId]);

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <h2 className="text-xl font-bold text-slate-800">Site not found</h2>
        <Button variant="link" onClick={() => navigate('/sites')} className="text-emerald-600 hover:underline mt-2">Return to Sites</Button>
      </div>
    );
  }

  useSetPageTitle(
    site ? `${site.name}(${site.client})` : 'Site Diary',
    site ? `Client: ${site.client}` : 'View aggregated daily journal entries',
    <Button 
      variant="outline" 
      size="sm" 
      className="gap-2 shrink-0 bg-white shadow-sm"
      onClick={() => navigate(`/sites?client=${encodeURIComponent(site.client)}`)}
    >
      <ArrowLeft className="h-4 w-4" /> Back to Sites
    </Button>
  );

  return (
    <div className="flex h-full flex-col">

      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen className="h-16 w-16 text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium text-lg">No diary entries found for this site.</p>
              <p className="text-sm text-slate-400 mt-2">Updates are aggregated from the company's Daily Journal.</p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[17px] before:w-0.5 before:bg-slate-200">
              {entries.map((entry) => (
                <div key={entry.id} className="relative flex gap-4 pl-12">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 h-[34px] w-[34px] rounded-full border-4 border-slate-50 bg-emerald-500 flex items-center justify-center shadow-sm">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  
                  {/* Content card */}
                  <div className="bg-white border text-sm border-slate-200 rounded-lg p-5 shadow-sm w-full">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-base">
                          {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {entry.timestamp && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1">
                              {format(new Date(entry.timestamp), 'HH:mm')}
                            </span>
                          )}
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                            entry.type === 'Journal' ? "bg-blue-100 text-blue-600" : "bg-indigo-100 text-indigo-600"
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
                    {/* Media — only journal entries have photos/videos */}
                    {entry.type === 'Journal' && siteId && (
                      <EntryMediaStrip siteId={siteId} date={entry.date} journalId={entry.id} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
