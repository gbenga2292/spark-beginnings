import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { ArrowLeft, MapPin, Edit, Trash2, BookOpen, Plus, FileText } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { useOperations } from '../contexts/OperationsContext';

interface DiaryDetailViewProps {
  date: string;
  onBack: () => void;
  onAddSession: (date: string) => void;
  onEditJournal: (journal: DailyJournalType) => void;
  onDeleteJournal: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onExportPdf: (date: string) => void;
}

export function DiaryDetailView({
  date, onBack, onAddSession, onEditJournal, onDeleteJournal, onDeleteEntry, onExportPdf,
}: DiaryDetailViewProps) {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dailyJournals, siteJournalEntries } = useAppStore();
  const { dailyMachineLogs } = useOperations();

  const diaryDate = new Date(date + 'T00:00:00');
  const journals = dailyJournals.filter(j => j.date === date)
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  const allEntries = siteJournalEntries.filter(e => journals.some(j => j.id === e.journalId));
  const uniqueSites = [...new Set(allEntries.map(e => `${e.siteName}|${e.clientName}`))].map(str => {
    const [site, client] = str.split('|');
    return { site, client };
  });
  const isToday = isSameDay(diaryDate, new Date());

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-semibold transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Calendar
        </button>
      </div>

      {/* Diary card */}
      <div className={cn(
        'relative rounded-lg overflow-hidden shadow-sm border',
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      )}>
        {/* Header */}
        <div className={cn('px-4 sm:px-6 py-5 border-b', isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50')}>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Site Diary
                </p>
                {isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">Today</span>}
              </div>
              <h1 className={cn('text-xl sm:text-2xl font-black tracking-tight leading-tight', isDark ? 'text-white' : 'text-slate-800')}>
                {format(diaryDate, 'EEEE, MMMM d, yyyy')}
              </h1>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-1">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {journals.length} session{journals.length !== 1 ? 's' : ''} • {allEntries.length} log point{allEntries.length !== 1 ? 's' : ''}
              </p>
              {uniqueSites.length > 0 && (
                <div className="flex items-start gap-1.5 mt-1 bg-teal-50/50 dark:bg-teal-900/10 p-2.5 rounded-lg border border-teal-100 dark:border-teal-800/30">
                  <MapPin className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-teal-800 dark:text-teal-300 leading-snug">
                    {uniqueSites.map(s => `${s.site} (${s.client})`).join(' • ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
          {journals.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className={cn('font-medium text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>No entries for this day yet.</p>
              {currentUser?.privileges?.dailyJournal?.canAdd && (
                <button onClick={() => onAddSession(date)} className="mt-4 px-4 py-2 rounded-md bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm">
                  + Add First Entry
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {journals.map((journal, ji) => {
                const jEntries = allEntries.filter(e => e.journalId === journal.id);
                const isAuthor = journal.loggedBy === currentUser?.name;
                const canEdit = isAuthor;
                return (
                  <div key={journal.id} className="relative">
                    {/* Session header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-sm font-bold text-teal-700 dark:text-teal-400 flex-shrink-0 border border-teal-200 dark:border-teal-800/50 shadow-sm">
                        S{ji + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                          <span className={cn('text-sm font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>
                            Session {ji + 1}
                          </span>
                          <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
                            by <span className="font-bold text-teal-600 dark:text-teal-400">{journal.loggedBy}</span>
                            {journal.createdAt && ` • ${format(new Date(journal.createdAt), 'HH:mm')}`}
                          </span>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => onEditJournal(journal)} className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-teal-900/30 transition-colors shadow-sm">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDeleteJournal(journal.id)} className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-900/30 transition-colors shadow-sm">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Site entries */}
                    <div className="ml-3 sm:ml-12 pl-6 sm:pl-0 border-l-2 border-slate-100 dark:border-slate-800 sm:border-0 space-y-3">
                      {jEntries.map(entry => {
                        const isEntryAuthor = (entry.loggedBy || journal.loggedBy) === currentUser?.name;
                        const canDel = isEntryAuthor;
                        return (
                          <div key={entry.id} className={cn(
                            'rounded-xl p-4 group relative overflow-hidden',
                            isDark ? 'bg-slate-800/40' : 'bg-slate-50 shadow-sm border border-slate-100'
                          )}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-l-xl" />
                            <div className="flex items-start justify-between gap-3 pl-1">
                              <div className="flex-1 min-w-0">
                                <div className="mb-2">
                                  <span className={cn('font-bold text-sm block leading-tight', isDark ? 'text-slate-200' : 'text-slate-800')}>
                                    {entry.siteName}
                                  </span>
                                  <span className="text-xs font-medium text-slate-500">
                                    {entry.clientName}
                                  </span>
                                </div>
                                {entry.narration ? (
                                  <p className={cn('text-sm mt-2 leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>
                                    {entry.narration}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400 italic mt-2">No general note recorded.</p>
                                )}
                                {(() => {
                                  const machineLogs = dailyMachineLogs.filter(l => l.siteId === entry.siteId && l.date === date);
                                  if (machineLogs.length === 0) return null;
                                  return (
                                    <div className="mt-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200/50 dark:border-slate-700/50">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Machine Log Narrative</p>
                                      <ul className="space-y-1.5 list-none">
                                        {machineLogs.map(ml => (
                                          <li key={ml.id} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed relative pl-4">
                                            <div className={cn("absolute left-0 top-2 h-1.5 w-1.5 rounded-full", ml.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">{ml.assetName}</span> is {ml.isActive ? 'operational' : 'inactive'}
                                            {ml.isActive && ml.dieselUsage > 0 ? ` and ${ml.dieselUsage}L of diesel was filled on it` : ''}.
                                            {ml.issuesOnSite ? ` Note: ${ml.issuesOnSite}` : ''}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  );
                                })()}
                                
                                {entry.loggedBy && entry.loggedBy !== journal.loggedBy && (
                                  <p className="text-[10px] text-slate-400 mt-3 font-medium">Logged by {entry.loggedBy}</p>
                                )}
                              </div>
                              {canDel && (
                                <button onClick={() => onDeleteEntry(entry.id)}
                                  className="sm:opacity-0 sm:group-hover:opacity-100 h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0 bg-white dark:bg-slate-800 shadow-sm">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add session button */}
          {journals.length > 0 && (
            <button onClick={() => onAddSession(date)}
              className="w-full sm:w-auto sm:ml-12 mt-6 flex items-center justify-center gap-2 h-11 px-6 rounded-xl border-2 border-dashed border-teal-200 dark:border-teal-800/50 text-sm font-bold text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20 transition-all bg-white dark:bg-slate-900/50 shadow-sm">
              <Plus className="h-4 w-4" /> Add Another Session
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={cn('px-6 py-4 border-t text-xs font-medium hidden sm:block', isDark ? 'border-slate-800 text-slate-500 bg-slate-900/50' : 'border-slate-100 text-slate-400 bg-slate-50/50')}>
          Dewatering Construction Etc Limited · Site Diary
        </div>
      </div>
    </div>
  );
}
