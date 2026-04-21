import { useState, useMemo } from 'react';
import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { generateId, cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';
import { Search, Plus, Calendar as CalendarIcon, MapPin, AlignLeft, Edit, Trash2, BookOpen, ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay } from 'date-fns';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function DailyJournal() {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { 
    dailyJournals, 
    siteJournalEntries, 
    sites, 
    addDailyJournal, 
    updateDailyJournal, 
    deleteDailyJournal 
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<DailyJournalType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formGeneralNotes, setFormGeneralNotes] = useState('');
  const [formSiteNarrations, setFormSiteNarrations] = useState<Record<string, string>>({});

  const activeSites = useMemo(() => sites.filter(s => s.status === 'Active' && !s.name.toLowerCase().includes('dcel office')), [sites]);

  const filteredJournals = useMemo(() => {
    return dailyJournals
      .filter((j) => {
        const dMatch = j.date.includes(searchTerm);
        const lMatch = j.loggedBy.toLowerCase().includes(searchTerm.toLowerCase());
        const nMatch = j.generalNotes.toLowerCase().includes(searchTerm.toLowerCase());
        return dMatch || lMatch || nMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailyJournals, searchTerm]);

  const handleOpenModal = (journal?: DailyJournalType) => {
    if (journal) {
      setEditingId(journal.id);
      setFormDate(journal.date);
      setFormGeneralNotes(journal.generalNotes);
      
      const relatedEntries = siteJournalEntries.filter(e => e.journalId === journal.id);
      const narrations: Record<string, string> = {};
      relatedEntries.forEach(entry => {
        narrations[entry.siteId] = entry.narration;
      });
      setFormSiteNarrations(narrations);
      setIsViewModalOpen(false);
      setIsModalOpen(true);
    } else {
      setEditingId(null);
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormGeneralNotes('');
      setFormSiteNarrations({});
      setIsModalOpen(true);
    }
  };

  const handleOpenViewModal = (journal: DailyJournalType) => {
    setSelectedJournal(journal);
    setIsViewModalOpen(true);
  };

  // Setup PageHeader
  const headerButtons = useMemo(() => (
    <div className="flex items-center gap-4">
      <div className={cn("flex items-center rounded-md border p-1", isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200")}>
        <button
          onClick={() => setViewMode('calendar')}
          className={cn("flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors", viewMode === 'calendar' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700", isDark && viewMode === 'calendar' ? "bg-slate-800 text-blue-400" : "")}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Calendar</span>
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={cn("flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors", viewMode === 'grid' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700", isDark && viewMode === 'grid' ? "bg-slate-800 text-blue-400" : "")}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">List</span>
        </button>
      </div>
      <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
        <Plus className="h-4 w-4 sm:mr-2" /> 
        <span className="hidden sm:inline">Add Today's Journal</span>
      </Button>
    </div>
  ), [viewMode, isDark]);

  useSetPageTitle('Daily Journal', 'Manage daily operations narrative', headerButtons, [viewMode, isDark]);

  const handleSave = () => {
    if (!formDate.trim()) return toast.error('Date is required');
    if (!formGeneralNotes.trim()) return toast.error('General office notes are required');

    // Ensure all active sites have a narration
    for (const site of activeSites) {
      if (!formSiteNarrations[site.id]?.trim()) {
        return toast.error(`Narration required for active site: ${site.name}`);
      }
    }

    if (editingId) {
      // Update
      const newEntries: SiteJournalEntry[] = activeSites
        .filter(site => formSiteNarrations[site.id]?.trim())
        .map(site => ({
          id: generateId(),
          journalId: editingId,
          siteId: site.id,
          siteName: site.name,
          clientName: site.client,
          narration: formSiteNarrations[site.id]
        }));

      updateDailyJournal(
        editingId, 
        { date: formDate, generalNotes: formGeneralNotes },
        newEntries
      );
      toast.success('Journal entry updated');
    } else {
      // Create
      const newJournalId = generateId();
      const newJournal: DailyJournalType = {
        id: newJournalId,
        date: formDate,
        generalNotes: formGeneralNotes,
        loggedBy: currentUser?.name || 'System',
        createdAt: new Date().toISOString()
      };

      const newEntries: SiteJournalEntry[] = activeSites
        .filter(site => formSiteNarrations[site.id]?.trim())
        .map(site => ({
          id: generateId(),
          journalId: newJournalId,
          siteId: site.id,
          siteName: site.name,
          clientName: site.client,
          narration: formSiteNarrations[site.id]
        }));

      addDailyJournal(newJournal, newEntries);
      toast.success('Daily journal entry created');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this journal entry? This will also remove the updates from the specific Site Diaries.')) {
      deleteDailyJournal(id);
      toast.success('Journal deleted');
      if (selectedJournal?.id === id) setIsViewModalOpen(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-4 sm:p-6 pt-0 sm:pt-2">
        {viewMode === 'grid' && (
          <div className="mb-6 relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Search by date, notes, or author..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {viewMode === 'calendar' ? (
          <div className="flex flex-col h-full bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
              <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-7 border-b bg-slate-50 dark:bg-slate-950 dark:border-slate-800 min-w-[700px]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)] min-w-[700px]">
                {(() => {
                  const start = startOfMonth(currentMonth);
                  const end = endOfMonth(currentMonth);
                  const days = eachDayOfInterval({ start, end });
                  const startDayOfWeek = start.getDay();
                  const blanks = Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`blank-${i}`} className="border-b border-r bg-slate-50/50 dark:bg-slate-900/50 dark:border-slate-800" />
                  ));
                  
                  const dayCells = days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayJournals = dailyJournals.filter(j => j.date === dateStr);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isSameDay(day, new Date());
                    
                    return (
                      <div 
                        key={day.toISOString()} 
                        className={cn(
                          "relative border-b border-r p-2 hover:bg-slate-50 transition-colors flex flex-col group dark:border-slate-800 dark:hover:bg-slate-800/50",
                          !isCurrentMonth && "bg-slate-50/50 text-slate-400 dark:bg-slate-900/50",
                          isTodayDate && "bg-blue-50/30 dark:bg-blue-900/10"
                        )}
                        onClick={() => {
                          if (dayJournals.length > 0) {
                            handleOpenViewModal(dayJournals[0]);
                          } else {
                            setEditingId(null);
                            setFormDate(dateStr);
                            setFormGeneralNotes('');
                            setFormSiteNarrations({});
                            setIsModalOpen(true);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                            isTodayDate ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-300"
                          )}>
                            {format(day, 'd')}
                          </span>
                          <button 
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                            title="Add Entry"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                              setFormDate(dateStr);
                              setFormGeneralNotes('');
                              setFormSiteNarrations({});
                              setIsModalOpen(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
                          {dayJournals.map(journal => {
                            const relatedEntries = siteJournalEntries.filter(e => e.journalId === journal.id);
                            return (
                              <div key={journal.id} className="bg-blue-100/50 border border-blue-200 text-blue-800 text-xs p-1.5 rounded dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">
                                <div className="font-semibold mb-0.5 line-clamp-1">{journal.generalNotes || 'Journal Entry'}</div>
                                {relatedEntries.length > 0 && (
                                  <div className="text-[10px] opacity-80 flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {relatedEntries.length} sites updated
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                  
                  return [...blanks, ...dayCells];
                })()}
              </div>
            </div>
          </div>
        ) : filteredJournals.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200">
            <BookOpen className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">No journal entries found</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add Today's Journal" to create the first one.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            {filteredJournals.map(journal => (
              <div 
                key={journal.id} 
                className={cn(
                  "group flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4 shadow-sm transition-all hover:border-blue-300 cursor-pointer", 
                  isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800/80" : "bg-white border-slate-200 hover:bg-blue-50/30"
                )} 
                onClick={() => handleOpenViewModal(journal)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 whitespace-nowrap sm:w-48 shrink-0">
                    <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                      {new Date(journal.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0 border-l-2 border-slate-100 dark:border-slate-800 pl-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      <span className="font-medium text-slate-900 dark:text-slate-200 mr-2">Office Notes:</span> 
                      {journal.generalNotes}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:w-32 justify-end">
                    <div className="flex -space-x-2">
                       {/* Visual indicator for sites */}
                       {Array.from({ length: Math.min(3, siteJournalEntries.filter(e => e.journalId === journal.id).length) }).map((_, i) => (
                         <div key={i} className="h-6 w-6 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-100 flex items-center justify-center">
                           <MapPin className="h-3 w-3 text-emerald-600" />
                         </div>
                       ))}
                    </div>
                    {siteJournalEntries.filter(e => e.journalId === journal.id).length > 0 && (
                      <span className="text-xs font-semibold text-slate-500">
                        {siteJournalEntries.filter(e => e.journalId === journal.id).length} Sites
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleOpenViewModal(journal); }}>
                    <BookOpen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleOpenModal(journal); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50" onClick={(e) => { e.stopPropagation(); handleDelete(journal.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className={cn("max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0", isDark ? "bg-slate-900" : "bg-white")}>
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{editingId ? "Edit Journal Entry" : "New Daily Journal"}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
                <Input 
                  type="date" 
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <AlignLeft className="h-4 w-4 text-blue-600" />
                General Office / Company Notes
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formGeneralNotes}
                onChange={e => setFormGeneralNotes(e.target.value)}
                rows={4}
                placeholder="What happened in the office today? General company announcements, visitor logs, HR updates, etc."
                className={cn(
                  "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600",
                  isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200"
                )}
              />
            </div>

            <div className="border-t pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                  Active Site Updates
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  A narration is mandated for every active site below before you can save the daily journal.
                </p>
              </div>

              {activeSites.length === 0 ? (
                <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-800">There are currently no active sites.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSites.map(site => (
                    <div key={site.id} className={cn("rounded-lg border p-4 shadow-sm", isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200")}>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {site.name} <span className="text-slate-500 font-normal ml-1">({site.client})</span>
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                      </div>
                      <textarea
                        value={formSiteNarrations[site.id] || ''}
                        onChange={e => setFormSiteNarrations(prev => ({ ...prev, [site.id]: e.target.value }))}
                        rows={3}
                        placeholder={`What happened at ${site.name} today? Equipment status, manpower, progress...`}
                        className={cn(
                          "w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600",
                          isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200"
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900 mt-auto">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Journal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0", isDark ? "bg-slate-900 border-slate-700" : "bg-white")}>
          <DialogHeader className="px-6 py-4 border-b flex-row justify-between items-center space-y-0 sticky top-0 bg-inherit z-10">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-500" />
                Journal for {selectedJournal ? new Date(selectedJournal.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (selectedJournal) handleOpenModal(selectedJournal);
                }}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" /> Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (selectedJournal) handleDelete(selectedJournal.id);
                }}
                className="flex items-center gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-rose-200"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 space-y-8 bg-slate-50/50 dark:bg-slate-900/50">
            {selectedJournal && (
              <>
                {/* General Notes Section */}
                <section className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                    <AlignLeft className="h-4 w-4 text-blue-500" /> General Office / Company Notes
                  </h3>
                  <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedJournal.generalNotes}
                  </div>
                </section>

                {/* Site Narrations Section */}
                {siteJournalEntries.filter(e => e.journalId === selectedJournal.id).length > 0 ? (
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-500" /> Active Site Updates
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {siteJournalEntries.filter(e => e.journalId === selectedJournal.id).map(entry => (
                        <div key={entry.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b dark:border-slate-700 border-dashed">
                            <MapPin className="h-4 w-4 text-emerald-600 opacity-70" />
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">{entry.siteName}</h4>
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pl-1">
                            {entry.narration || <span className="italic text-slate-400">No specific updates recorded.</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 flex flex-col items-center justify-center">
                     <BookOpen className="h-10 w-10 opacity-20 mb-3" />
                     <p>No site-specific updates logged for this day.</p>
                  </section>
                )}

                <div className="pt-4 mt-8 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-400 dark:text-slate-500 text-center">
                  Logged by <span className="font-medium text-slate-600 dark:text-slate-400">{selectedJournal.loggedBy}</span>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
