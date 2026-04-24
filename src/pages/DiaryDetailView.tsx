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
  const sites = [...new Set(allEntries.map(e => e.siteName))];
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
        'relative rounded-2xl overflow-hidden shadow-xl',
        isDark ? 'bg-slate-900 border border-slate-700' : 'bg-[#fffdf5] border border-amber-200'
      )}>
        {/* Left red margin line */}
        {!isDark && <div className="absolute left-[72px] top-0 bottom-0 w-[1.5px] bg-red-300/50 pointer-events-none z-0" />}

        {/* Lined background (subtle) */}
        {!isDark && (
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e8e0c8 31px, #e8e0c8 32px)',
            backgroundPositionY: '80px',
            opacity: 0.4,
          }} />
        )}

        {/* Header */}
        <div className={cn('relative z-10 px-8 pt-8 pb-6 border-b', isDark ? 'border-slate-700' : 'border-amber-200')}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 mb-1">
                Site Diary
              </p>
              <h1 className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-slate-800')} style={{ fontFamily: 'Georgia, serif' }}>
                {format(diaryDate, 'EEEE')}
              </h1>
              <p className={cn('text-lg mt-1', isDark ? 'text-slate-400' : 'text-slate-600')} style={{ fontFamily: 'Georgia, serif' }}>
                {format(diaryDate, 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-4',
                isDark ? 'bg-indigo-900/40 border-indigo-700 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700'
              )}>
                {format(diaryDate, 'd')}
              </div>
              {isToday && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-widest">Today</span>}
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2 mt-5">
            {[
              `${journals.length} session${journals.length !== 1 ? 's' : ''}`,
              `${allEntries.length} log point${allEntries.length !== 1 ? 's' : ''}`,
            ].map(t => (
              <span key={t} className={cn('text-xs font-semibold px-3 py-1.5 rounded-full', isDark ? 'bg-slate-800 text-slate-300' : 'bg-white/80 border border-amber-200 text-slate-600')}>
                {t}
              </span>
            ))}
            {sites.slice(0, 4).map(site => (
              <span key={site} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30">
                <MapPin className="h-3 w-3" />{site}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="relative z-10 px-8 py-8 space-y-10">
          {journals.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className={cn('font-medium text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>No entries for this day yet.</p>
              {currentUser?.privileges?.dailyJournal?.canAdd && (
                <button onClick={() => onAddSession(date)} className="mt-4 px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors">
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
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow">
                      {ji + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>
                        Session {ji + 1}
                      </span>
                      <span className={cn('text-xs ml-2', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        by <span className="font-semibold text-indigo-600 dark:text-indigo-400">{journal.loggedBy}</span>
                        {journal.createdAt && ` · ${format(new Date(journal.createdAt), 'HH:mm')}`}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => onEditJournal(journal)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDeleteJournal(journal.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Site entries */}
                  <div className="ml-11 space-y-4">
                    {jEntries.map(entry => {
                      const isEntryAuthor = (entry.loggedBy || journal.loggedBy) === currentUser?.name;
                      const canDel = isEntryAuthor;
                      return (
                        <div key={entry.id} className={cn(
                          'relative rounded-xl p-5 border-l-4 border-l-emerald-400 group',
                          isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white/80 border border-amber-100 shadow-sm'
                        )}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-slate-800')}>
                                  {entry.siteName}
                                </span>
                                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                                  {entry.clientName}
                                </span>
                              </div>
                              {entry.narration ? (
                                <p className={cn('text-sm leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')} style={{ fontFamily: 'Georgia, serif' }}>
                                  {entry.narration}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No narration recorded.</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-2">Logged by {entry.loggedBy || journal.loggedBy}</p>
                            </div>
                            {canDel && (
                              <button onClick={() => onDeleteEntry(entry.id)}
                                className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
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
              className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors ml-11">
              <Plus className="h-3.5 w-3.5" /> Add another session for this day
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={cn('relative z-10 px-8 py-4 border-t text-xs font-medium', isDark ? 'border-slate-700 text-slate-500' : 'border-amber-200 text-slate-400')}>
          Dewatering Construction Etc Limited · Site Diary
        </div>
      </div>
    </div>
  );
}
