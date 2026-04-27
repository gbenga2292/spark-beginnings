import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { ArrowLeft, MapPin, Edit, Trash2, BookOpen, Plus, FileText } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

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
        <div className={cn('px-6 pt-6 pb-4 border-b', isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50')}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">
                Site Diary
              </p>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-slate-800')}>
                {format(diaryDate, 'EEEE, MMMM d, yyyy')}
              </h1>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold border-2',
                isDark ? 'bg-teal-900/40 border-teal-700 text-teal-300' : 'bg-teal-50 border-teal-200 text-teal-700'
              )}>
                {format(diaryDate, 'd')}
              </div>
              {isToday && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white uppercase tracking-wider">Today</span>}
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              `${journals.length} session${journals.length !== 1 ? 's' : ''}`,
              `${allEntries.length} log point${allEntries.length !== 1 ? 's' : ''}`,
            ].map(t => (
              <span key={t} className={cn('text-xs font-medium px-3 py-1 rounded-md border', isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
                {t}
              </span>
            ))}
            {uniqueSites.map(item => (
              <span key={`${item.site}-${item.client}`} className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800/30">
                <MapPin className="h-3.5 w-3.5" />{item.site}({item.client})
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
          {journals.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className={cn('font-medium text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>No entries for this day yet.</p>
              {currentUser?.privileges?.dailyJournal?.canAdd && (
                <button onClick={() => onAddSession(date)} className="mt-4 px-4 py-2 rounded-md bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors">
                  + Add First Entry
                </button>
              )}
            </div>
          ) : (
            journals.map((journal, ji) => {
              const jEntries = allEntries.filter(e => e.journalId === journal.id);
              const isAuthor = journal.loggedBy === currentUser?.name;
              const canEdit = isAuthor;
              return (
                <div key={journal.id}>
                  {/* Session header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-xs font-bold text-teal-700 dark:text-teal-400 flex-shrink-0">
                      S{ji + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
                        Session {ji + 1}
                      </span>
                      <span className={cn('text-xs ml-2', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        by <span className="font-semibold text-teal-600 dark:text-teal-400">{journal.loggedBy}</span>
                        {journal.createdAt && ` · ${format(new Date(journal.createdAt), 'HH:mm')}`}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => onEditJournal(journal)} className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDeleteJournal(journal.id)} className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Site entries */}
                  <div className="ml-11 space-y-3">
                    {jEntries.map(entry => {
                      const isEntryAuthor = (entry.loggedBy || journal.loggedBy) === currentUser?.name;
                      const canDel = isEntryAuthor;
                      return (
                        <div key={entry.id} className={cn(
                          'rounded-md p-4 border-l-[3px] border-l-teal-500 group',
                          isDark ? 'bg-slate-800/50 border border-slate-800' : 'bg-slate-50 border border-slate-100 shadow-sm'
                        )}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-slate-800')}>
                                  {entry.siteName}({entry.clientName})
                                </span>
                              </div>
                              {entry.narration ? (
                                <p className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-600')}>
                                  {entry.narration}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No narration recorded.</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-2">Logged by {entry.loggedBy || journal.loggedBy}</p>
                            </div>
                            {canDel && (
                              <button onClick={() => onDeleteEntry(entry.id)}
                                className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0">
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
            })
          )}

          {/* Add session button */}
          {journals.length > 0 && (
            <button onClick={() => onAddSession(date)}
              className="flex items-center gap-2 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors ml-11">
              <Plus className="h-3.5 w-3.5" /> Add another session for this day
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={cn('px-6 py-4 border-t text-xs font-medium', isDark ? 'border-slate-800 text-slate-500 bg-slate-900/50' : 'border-slate-100 text-slate-400 bg-slate-50/50')}>
          Dewatering Construction Etc Limited · Site Diary
        </div>
      </div>
    </div>
  );
}
