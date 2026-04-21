import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '@/src/store/appStore';
import { Calendar, BookOpen, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

export function SiteDiary() {
  const { siteId } = useParams();
  const { siteJournalEntries, dailyJournals, sites } = useAppStore();

  const site = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  const entries = useMemo(() => {
    if (!siteId) return [];
    return siteJournalEntries
      .filter(e => e.siteId === siteId)
      .map(entry => {
        const journal = dailyJournals.find(j => j.id === entry.journalId);
        return {
          ...entry,
          date: journal?.date || '',
          loggedBy: journal?.loggedBy || 'Unknown'
        };
      })
      .filter(e => e.date !== '')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [siteJournalEntries, dailyJournals, siteId]);

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <h2 className="text-xl font-bold text-slate-800">Site not found</h2>
        <Link to="/sites" className="text-emerald-600 hover:underline mt-2">Return to Sites</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b bg-white px-6 py-4 shadow-sm">
        <Link to="/sites" className="mr-4 text-slate-400 hover:text-slate-600 self-center">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-600" /> {site.name} Diary
          </h1>
          <p className="flex items-center text-sm font-medium text-slate-500 mt-1">
            <Building2 className="mr-1.5 h-4 w-4" /> Client: {site.client}
          </p>
        </div>
      </div>

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
                      <span className="font-bold text-slate-800 text-base">
                        {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">by {entry.loggedBy}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed text-[15px]">
                      {entry.narration}
                    </p>
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
