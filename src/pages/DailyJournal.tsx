import { useState, useMemo } from 'react';
import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { generateId, cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';
import { Search, Plus, Calendar, MapPin, X, ChevronLeft, ChevronRight, FileText, Download, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from 'date-fns';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { DiaryDetailView } from './DiaryDetailView';
import { jsPDF } from 'jspdf';
import logoSrc from '@/logo/logo-2.png';

export function DailyJournal() {
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dailyJournals, siteJournalEntries, sites, addDailyJournal, updateDailyJournal, deleteDailyJournal, deleteSiteJournalEntry } = useAppStore();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEntries, setFormEntries] = useState<Partial<SiteJournalEntry>[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'journal' | 'entry' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState('');
  const [pdfExportDate, setPdfExportDate] = useState('');

  // Export Filter States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    siteId: '',
    author: ''
  });

  const activeSites = useMemo(() => sites.filter(s => s.status === 'Active'), [sites]);
  const authors = useMemo(() => [...new Set(dailyJournals.map(j => j.loggedBy))], [dailyJournals]);

  const grouped = useMemo(() => {
    const groups: Record<string, DailyJournalType[]> = {};
    dailyJournals.forEach(j => { if (!groups[j.date]) groups[j.date] = []; groups[j.date].push(j); });
    return Object.keys(groups)
      .filter(d => !searchTerm || d.includes(searchTerm) || groups[d].some(j => j.loggedBy.toLowerCase().includes(searchTerm.toLowerCase())))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(d => ({ date: d, journals: groups[d] }));
  }, [dailyJournals, searchTerm]);

  // Logic to find journals matching the advanced export filters
  const matchingExportJournals = useMemo(() => {
    const matching = dailyJournals.filter(j => {
      const isDateInRange = j.date >= exportFilters.startDate && j.date <= exportFilters.endDate;
      const matchesAuthor = !exportFilters.author || j.loggedBy === exportFilters.author;
      
      const dayEntries = siteJournalEntries.filter(e => e.journalId === j.id);
      const matchesSite = !exportFilters.siteId || dayEntries.some(e => e.siteId === exportFilters.siteId);
      
      return isDateInRange && matchesAuthor && matchesSite;
    });
    
    // Group by date for the report
    const groups: Record<string, DailyJournalType[]> = {};
    matching.forEach(j => { if (!groups[j.date]) groups[j.date] = []; groups[j.date].push(j); });
    return Object.keys(groups).sort().map(d => ({ date: d, journals: groups[d] }));
  }, [dailyJournals, siteJournalEntries, exportFilters]);

  const openModal = (journal?: DailyJournalType, date?: string) => {
    if (journal) {
      setEditingId(journal.id); setFormDate(journal.date);
      setFormEntries(siteJournalEntries.filter(e => e.journalId === journal.id).map(e => ({ ...e })));
    } else {
      setEditingId(null); setFormDate(date || new Date().toISOString().split('T')[0]); setFormEntries([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formDate.trim()) return toast.error('Date is required');
    if (formEntries.length === 0) return toast.error('Add at least one site log');
    if (editingId) {
      updateDailyJournal(editingId, { date: formDate, generalNotes: '' }, formEntries.map(e => ({ id: e.id || generateId(), journalId: editingId, siteId: e.siteId!, siteName: e.siteName!, clientName: e.clientName!, narration: e.narration!, createdAt: e.createdAt || new Date().toISOString(), loggedBy: e.loggedBy || currentUser?.name || 'System' })));
      toast.success('Log updated');
    } else {
      const id = generateId();
      addDailyJournal({ id, date: formDate, generalNotes: '', loggedBy: currentUser?.name || 'System', createdAt: new Date().toISOString() }, formEntries.map(e => ({ id: generateId(), journalId: id, siteId: e.siteId!, siteName: e.siteName!, clientName: e.clientName!, narration: e.narration!, createdAt: new Date().toISOString(), loggedBy: currentUser?.name || 'System' })));
      toast.success('Log published');
    }
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    deleteConfirm.type === 'journal' ? deleteDailyJournal(deleteConfirm.id) : deleteSiteJournalEntry(deleteConfirm.id);
    toast.success('Deleted'); setDeleteConfirm(null);
  };

  const generateDiaryPdf = (groupedJournals: {date: string, journals: DailyJournalType[]}[], reportTitle?: string) => {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    groupedJournals.forEach((group, idx) => {
      if (idx > 0) doc.addPage();
      
      // Watermark (logo, 10% opacity, centred)
      try {
        doc.saveGraphicsState();
        // @ts-ignore
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        doc.addImage(logoSrc, 'PNG', W / 2 - 45, H / 2 - 17, 90, 34);
        doc.restoreGraphicsState();
      } catch (_) {}

      // Logo top-left
      try { doc.addImage(logoSrc, 'PNG', 14, 10, 50, 18); } catch (_) {}

      // Header
      const dateObj = new Date(group.date + 'T00:00:00');
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.5);
      doc.line(14, 32, W - 14, 32);
      
      doc.setFontSize(18); doc.setFont('times', 'bold'); doc.setTextColor(30, 30, 50);
      doc.text('SITE DIARY', W / 2, 42, { align: 'center' });
      
      doc.setFontSize(11); doc.setFont('times', 'italic'); doc.setTextColor(80, 80, 120);
      doc.text(`${format(dateObj, 'EEEE, MMMM d, yyyy')}`, W / 2, 48, { align: 'center' });
      
      if (reportTitle) {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 170);
        doc.text(reportTitle, W - 14, 15, { align: 'right' });
      }

      doc.setLineWidth(0.3); doc.line(14, 52, W - 14, 52);

      let y = 62;
      group.journals.forEach((journal, ji) => {
        const jEntries = siteJournalEntries.filter(e => e.journalId === journal.id && (!exportFilters.siteId || e.siteId === exportFilters.siteId));
        if (jEntries.length === 0) return;

        if (y > H - 40) { doc.addPage(); y = 30; }

        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(99, 102, 241);
        doc.text(`Session ${ji + 1}  ·  ${journal.loggedBy}${journal.createdAt ? '  ' + format(new Date(journal.createdAt), 'HH:mm') : ''}`, 14, y);
        y += 3; doc.setDrawColor(220, 220, 240); doc.setLineWidth(0.1); doc.line(14, y, W - 14, y); y += 7;

        jEntries.forEach(entry => {
          if (y > H - 30) { doc.addPage(); y = 30; }
          doc.setFillColor(52, 211, 153); doc.circle(17, y - 1.5, 1.2, 'F');
          doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50);
          doc.text(entry.siteName, 22, y);
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 140);
          doc.text(`Client: ${entry.clientName}`, 22, y + 4.5); 
          y += 10;

          if (entry.narration) {
            doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(60, 60, 80);
            const lines = doc.splitTextToSize(entry.narration, W - 40);
            lines.forEach((line: string) => {
              if (y > H - 25) { doc.addPage(); y = 30; }
              doc.text(line, 22, y); y += 5;
            });
          }
          y += 5;
        });
        y += 5;
      });

      // Footer
      doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(180, 180, 200);
      doc.text(`Page ${idx + 1} · Dewatering Construction Etc Limited · Generated ${format(new Date(), 'PPP')}`, W / 2, H - 10, { align: 'center' });
    });

    return doc;
  };

  const handleRunExport = () => {
    if (matchingExportJournals.length === 0) return toast.error('No logs found for selected criteria');
    const title = `Report: ${exportFilters.startDate} to ${exportFilters.endDate}`;
    setPdfDataUri(generateDiaryPdf(matchingExportJournals, title).output('datauristring'));
    setShowPdfPreview(true);
    setIsExportModalOpen(false);
  };

  useSetPageTitle('Site Diary', 'Daily field activity register', (
    <div className="flex items-center gap-3">
      {currentUser?.privileges?.dailyJournal?.canExport && (
        <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} className="h-9 px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight">
          <FileText className="w-4 h-4" /> Export Report
        </Button>
      )}
      {!diaryDate && (
        <>
          <div className="flex items-center rounded border border-slate-200 bg-white p-0.5 shadow-sm">
            {(['list', 'calendar'] as const).map(v => (
              <button key={v} onClick={() => { setViewMode(v); setDiaryDate(null); }}
                className={cn('px-3 py-1.5 text-xs font-medium rounded transition-all', viewMode === v && !diaryDate ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {v === 'list' ? 'List' : 'Calendar'}
              </button>
            ))}
          </div>
          {currentUser?.privileges?.dailyJournal?.canAdd && (
            <Button size="sm" onClick={() => openModal(undefined, diaryDate || undefined)}
              className="h-9 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs tracking-tight shadow-sm active:scale-95">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Log</span>
            </Button>
          )}
        </>
      )}
    </div>
  ), [viewMode, diaryDate, dailyJournals, currentUser]);

  // Diary detail page
  if (diaryDate) {
    return (
      <>
        <DiaryDetailView
          date={diaryDate}
          onBack={() => setDiaryDate(null)}
          onAddSession={openModal.bind(null, undefined)}
          onEditJournal={openModal}
          onDeleteJournal={id => setDeleteConfirm({ id, type: 'journal' })}
          onDeleteEntry={id => setDeleteConfirm({ id, type: 'entry' })}
          onExportPdf={() => {
            const single = dailyJournals.filter(j => j.date === diaryDate);
            const grouped = [{ date: diaryDate, journals: single }];
            setPdfDataUri(generateDiaryPdf(grouped).output('datauristring'));
            setPdfExportDate(diaryDate);
            setShowPdfPreview(true);
          }}
        />
        {renderModal()} {renderDeleteConfirm()} {renderPdfPreview()} {renderExportModal()}
      </>
    );
  }

  function renderCalendar() {
    const start = startOfMonth(currentMonth), end = endOfMonth(currentMonth);
    const blanks = Array.from({ length: start.getDay() }).map((_, i) => (
      <div key={`b${i}`} className="border-b border-r border-border bg-muted/20 min-h-[100px]" />
    ));
    const cells = eachDayOfInterval({ start, end }).map(day => {
      const ds = format(day, 'yyyy-MM-dd');
      const dayJs = dailyJournals.filter(j => j.date === ds);
      const entryCount = siteJournalEntries.filter(e => dayJs.some(j => j.id === e.journalId)).length;
      const isT = isSameDay(day, new Date());
      return (
        <div key={ds} className={cn('border-b border-r border-border p-2 flex flex-col min-h-[100px] group relative', isT && 'bg-blue-50/50 dark:bg-blue-950/20')}>
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors', isT ? 'bg-blue-600 text-white' : 'text-muted-foreground group-hover:text-blue-600')}>
              {format(day, 'd')}
            </span>
            {currentUser?.privileges?.dailyJournal?.canAdd && (
              <button onClick={e => { e.stopPropagation(); openModal(undefined, ds); }}
                className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm text-xs">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {dayJs.length > 0 && (
            <button onClick={() => setDiaryDate(ds)} className="mt-1 text-left w-full">
              <div className="text-[10px] font-medium px-1.5 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 transition-colors">
                {entryCount} log{entryCount !== 1 ? 's' : ''} · {dayJs.length} session{dayJs.length !== 1 ? 's' : ''}
              </div>
            </button>
          )}
        </div>
      );
    });
    return [...blanks, ...cells];
  }

  function renderListView() {
    return grouped.length === 0 ? (
      <div className="text-center py-24 bg-card border border-border rounded-lg">
        <p className="text-sm font-medium text-muted-foreground">No diary entries yet</p>
        {currentUser?.privileges?.dailyJournal?.canAdd && (
          <button onClick={() => openModal()} className="mt-4 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">New Log</button>
        )}
      </div>
    ) : (
      <div className="space-y-2">
        {grouped.map(group => {
          const entries = siteJournalEntries.filter(e => group.journals.some(j => j.id === e.journalId));
          return (
            <button key={group.date} onClick={() => setDiaryDate(group.date)}
              className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:shadow-sm transition-all flex items-center gap-4">
              <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{format(new Date(group.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
                  {isSameDay(new Date(group.date + 'T00:00:00'), new Date()) && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">TODAY</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{entries.length} log points · {group.journals.length} session{group.journals.length !== 1 ? 's' : ''}</span>
                  {[...new Set(entries.map(e => e.siteName))].map(s => (
                    <span key={s} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <MapPin className="h-3 w-3" />{s}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-1 text-slate-500 flex-shrink-0">
                {entries.length} entries
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderModal() {
    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 py-5 border-b border-border">
            <DialogTitle className="text-lg font-bold">{editingId ? 'Edit Log Session' : 'New Log Session'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Date</label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="h-10 max-w-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Add Site Activity</label>
              <div className="flex gap-2">
                <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}
                  className="flex-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700">
                  <option value="">Select site...</option>
                  {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button onClick={() => {
                  const s = sites.find(x => x.id === selectedSiteId);
                  if (s) { setFormEntries(p => [...p, { siteId: s.id, siteName: s.name, clientName: s.client, narration: '', loggedBy: currentUser?.name || 'System', createdAt: new Date().toISOString() }]); setSelectedSiteId(''); }
                }} disabled={!selectedSiteId} className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
            {formEntries.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-lg py-10 text-center">
                <MapPin className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No sites added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formEntries.map((entry, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{entry.siteName}</span>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{entry.clientName}</span>
                      </div>
                      <button onClick={() => setFormEntries(p => p.filter((_, i) => i !== idx))} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea value={entry.narration || ''} onChange={e => { const n = [...formEntries]; n[idx].narration = e.target.value; setFormEntries(n); }}
                      rows={3} placeholder={`Field notes for ${entry.siteName}...`}
                      className="w-full text-sm border border-slate-200 rounded-md p-3 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-background" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-9">Cancel</Button>
            <Button onClick={handleSave} className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white">Publish Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderDeleteConfirm() {
    return (
      <Dialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base font-bold">Confirm Deletion</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            {deleteConfirm?.type === 'journal' ? 'This will permanently remove this session and all its entries.' : 'This will permanently remove this site log entry.'}
          </p>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="h-9">Cancel</Button>
            <Button onClick={confirmDelete} className="h-9 bg-red-600 hover:bg-red-700 text-white font-bold">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderPdfPreview() {
    return (
      <Dialog open={showPdfPreview} onOpenChange={o => !o && setShowPdfPreview(false)}>
        <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-sm">PDF Preview</p>
                <p className="text-xs text-muted-foreground">Review report content before downloading</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => {
                const doc = generateDiaryPdf(matchingExportJournals.length > 0 ? matchingExportJournals : [{date: pdfExportDate, journals: dailyJournals.filter(j => j.date === pdfExportDate)}]);
                doc.save(`SiteDiary-Report.pdf`);
              }}
                className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
              <button onClick={() => setShowPdfPreview(false)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
            <embed src={pdfDataUri} type="application/pdf" className="w-full h-full border-0" title="Diary PDF Preview" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderExportModal() {
    return (
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b border-border m-0">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileText className="h-4 w-4" />
              </div>
              Export Diary Report
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2 font-medium text-left">Configure your report parameters before generating a PDF.</p>
          </DialogHeader>
          
          <div className="px-6 py-6 space-y-5 bg-white dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> From Date
                </label>
                <Input type="date" value={exportFilters.startDate} onChange={e => setExportFilters(f => ({ ...f, startDate: e.target.value }))} className="h-10 text-sm font-medium bg-slate-50 dark:bg-slate-900 border-slate-200 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> To Date
                </label>
                <Input type="date" value={exportFilters.endDate} onChange={e => setExportFilters(f => ({ ...f, endDate: e.target.value }))} className="h-10 text-sm font-medium bg-slate-50 dark:bg-slate-900 border-slate-200 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Filter by Site
              </label>
              <select value={exportFilters.siteId} onChange={e => setExportFilters(f => ({ ...f, siteId: e.target.value }))}
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 dark:text-slate-300">
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.client})</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Filter className="h-3 w-3" /> Filter by Author
              </label>
              <select value={exportFilters.author} onChange={e => setExportFilters(f => ({ ...f, author: e.target.value }))}
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 dark:text-slate-300">
                <option value="">All Authors</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className={cn("p-4 rounded-xl border flex items-center justify-between transition-all mt-6", matchingExportJournals.length > 0 ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50 shadow-sm" : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800")}>
              <div className="flex items-center gap-3">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", matchingExportJournals.length > 0 ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-300" : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>
                  <FileText className="h-4 w-4" />
                </div>
                <span className={cn("text-sm font-bold", matchingExportJournals.length > 0 ? "text-indigo-900 dark:text-indigo-200" : "text-slate-500 dark:text-slate-400")}>
                  Logs Found
                </span>
              </div>
              <span className={cn("text-xl font-black", matchingExportJournals.length > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")}>
                {matchingExportJournals.length} day{matchingExportJournals.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-border flex items-center justify-end gap-2 m-0 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsExportModalOpen(false)} className="h-10 px-4 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200">Cancel</Button>
            <Button onClick={handleRunExport} disabled={matchingExportJournals.length === 0} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all gap-2 rounded-lg">
              Generate Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search (list view only) */}
      {viewMode === 'list' && (
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by date or author..." className="pl-9 h-10 text-sm border-slate-200 bg-white shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 p-1 rounded-full hover:bg-slate-100"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[minmax(100px,1fr)]">
            {renderCalendar()}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && renderListView()}

      {renderModal()}
      {renderDeleteConfirm()}
      {renderPdfPreview()}
      {renderExportModal()}
    </div>
  );
}
