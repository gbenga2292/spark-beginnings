import { useState, useMemo } from 'react';
import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { generateId, cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';
import { Search, Plus, Calendar, MapPin, X, ChevronLeft, ChevronRight, FileText, Download, Filter, Wrench, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from 'date-fns';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { DiaryDetailView } from './DiaryDetailView';
import { useOperations } from '../contexts/OperationsContext';
import { DailyLogManager } from './DailyLogManager';
import { jsPDF } from 'jspdf';
import logoSrc from '@/logo/logo-2.png';

import { BulkConsumableLogModal } from './BulkConsumableLogModal';
import { BulkMachineLogModal } from './BulkMachineLogModal';

function SiteLogCard({ 
  entry, 
  idx, 
  onRemove, 
  onChangeNarration, 
  formDate,
  onOpenMachineLog
}: { 
  entry: Partial<SiteJournalEntry>; 
  idx: number; 
  onRemove: () => void; 
  onChangeNarration: (val: string) => void;
  formDate: string;
  onOpenMachineLog: (machine: {id: string, name: string}, siteId: string, siteName: string) => void;
}) {
  const { waybills, assets, dailyMachineLogs } = useOperations();
  const { consumableLogs } = useAppStore();
  const [activeTab, setActiveTab] = useState<'general' | 'machines' | 'consumables'>('general');
  const [isBulkConsumableOpen, setIsBulkConsumableOpen] = useState(false);
  const [isBulkMachineOpen, setIsBulkMachineOpen] = useState(false);

  const machineItems = useMemo(() => {
    if (!entry.siteId) return [];
    const siteWaybills = waybills.filter(w => w.siteId === entry.siteId && w.type === 'waybill' && w.status !== 'outstanding');
    return assets.filter(a => a.type === 'equipment' && a.requiresLogging && siteWaybills.some(w => w.items.some(i => i.assetId === a.id)));
  }, [waybills, assets, entry.siteId]);

  const consumableItems = useMemo(() => {
    if (!entry.siteId) return [];
    const siteWaybills = waybills.filter(w => w.siteId === entry.siteId && w.type === 'waybill' && w.status !== 'outstanding');
    
    const itemsMap = new Map();
    siteWaybills.forEach(w => {
      w.items.forEach(i => {
        const asset = assets.find(a => a.id === i.assetId);
        if (asset && asset.type === 'consumable') {
          if (itemsMap.has(i.assetId)) {
            itemsMap.get(i.assetId).quantity += i.quantity;
          } else {
            itemsMap.set(i.assetId, {
              assetId: i.assetId,
              assetName: asset.name,
              quantity: i.quantity,
              unit: asset.unitOfMeasurement || 'pcs'
            });
          }
        }
      });
    });
    
    return Array.from(itemsMap.values());
  }, [waybills, assets, entry.siteId]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
      <div className="flex items-start sm:items-center justify-between mb-3 pl-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pr-6">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{entry.siteName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium w-fit">
            {entry.clientName}
          </span>
        </div>
        <button onClick={onRemove} className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={cn("mb-3 border-b border-slate-100 dark:border-slate-800", machineItems.length === 0 && consumableItems.length === 0 ? "hidden" : `grid grid-cols-${machineItems.length > 0 && consumableItems.length > 0 ? 3 : 2}`)}>
        <button
          className={cn("flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors border-b-2", activeTab === 'general' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}
          onClick={() => setActiveTab('general')}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          Notes
        </button>
        {machineItems.length > 0 && (
          <button
            className={cn("flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors border-b-2", activeTab === 'machines' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}
            onClick={() => setActiveTab('machines')}
          >
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            Machines
            <span className={cn("text-[9px] font-black px-1 rounded-full", activeTab === 'machines' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{machineItems.length}</span>
          </button>
        )}
        {consumableItems.length > 0 && (
          <button
            className={cn("flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors border-b-2", activeTab === 'consumables' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}
            onClick={() => setActiveTab('consumables')}
          >
            <Package className="h-3.5 w-3.5 shrink-0" />
            Stock
            <span className={cn("text-[9px] font-black px-1 rounded-full", activeTab === 'consumables' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{consumableItems.length}</span>
          </button>
        )}
      </div>

      <div className="pl-2">
        {activeTab === 'general' ? (
          <textarea value={entry.narration || ''} onChange={e => onChangeNarration(e.target.value)}
            rows={4} placeholder="Type your field notes here..."
            className="w-full text-base sm:text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-950 transition-all placeholder:text-slate-400" />
        ) : activeTab === 'machines' ? (
          <div className="space-y-2">
            {machineItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No machines currently logged at this site.</p>
            ) : (
              <>
                {machineItems.length > 1 && (
                  <div className="flex justify-end mb-3">
                    <Button onClick={() => setIsBulkMachineOpen(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs">
                      Bulk Log Machines
                    </Button>
                  </div>
                )}
                {machineItems.map(m => {
                  const hasLog = dailyMachineLogs.some(l => l.assetId === m.id && l.date === formDate);
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.name}</p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          {hasLog ? <><CheckCircle2 className="h-3 w-3 text-emerald-500"/> Logged for {formatDateDisplay(formDate)}</> : <><AlertTriangle className="h-3 w-3 text-amber-500"/> Not logged yet</>}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant={hasLog ? "outline" : "default"}
                      className={cn("h-8 text-xs font-bold px-4", hasLog ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/30" : "bg-indigo-600 hover:bg-indigo-700 text-white")}
                      onClick={() => onOpenMachineLog({ id: m.id, name: m.name }, entry.siteId!, entry.siteName!)}
                    >
                      {hasLog ? 'Edit Log' : 'Start Log'}
                    </Button>
                  </div>
                );
              })}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {consumableItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No consumables currently on this site.</p>
            ) : (
              <>
                <div className="flex justify-end mb-3">
                  <Button onClick={() => setIsBulkConsumableOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs">
                    Bulk Log Consumables Usage
                  </Button>
                </div>
                {consumableItems.map(c => {
                  const hasLog = consumableLogs.some(l => l.assetId === c.assetId && l.siteId === entry.siteId && l.date === formDate);
                  return (
                    <div key={c.assetId} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.assetName}</p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            {hasLog ? <><CheckCircle2 className="h-3 w-3 text-emerald-500"/> Logged for {formatDateDisplay(formDate)}</> : <><AlertTriangle className="h-3 w-3 text-amber-500"/> Available: {c.quantity} {c.unit}</>}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant={hasLog ? "outline" : "default"}
                        className={cn("h-8 text-xs font-bold px-4", hasLog ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/30" : "bg-emerald-600 hover:bg-emerald-700 text-white")}
                        onClick={() => setIsBulkConsumableOpen(true)}
                      >
                        {hasLog ? 'Edit Usage' : 'Log Usage'}
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      <BulkConsumableLogModal
        isOpen={isBulkConsumableOpen}
        onClose={() => setIsBulkConsumableOpen(false)}
        site={{ id: entry.siteId!, name: entry.siteName!, client: entry.clientName! } as any}
        consumables={consumableItems}
      />
      <BulkMachineLogModal
        isOpen={isBulkMachineOpen}
        onClose={() => setIsBulkMachineOpen(false)}
        siteId={entry.siteId!}
        siteName={entry.siteName!}
        machines={machineItems.map(m => ({ id: m.id, name: m.name }))}
        date={formDate}
      />
    </div>
  );
}

function formatDateDisplay(d: string) {
  try {
    return format(new Date(d + 'T00:00:00'), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

export function DailyJournal() {
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dailyJournals, siteJournalEntries, sites, addDailyJournal, updateDailyJournal, deleteDailyJournal, deleteSiteJournalEntry } = useAppStore();
  const { dailyMachineLogs } = useOperations();

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
  const [machineLogContext, setMachineLogContext] = useState<{ assetId: string, assetName: string, siteId: string, siteName: string } | null>(null);

  // Export Filter States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

    // Check that at least one entry has content (notes or machine/consumable logs)
    const hasAnyContent = formEntries.some(e => {
      const hasNarration = e.narration && e.narration.trim().length > 0;
      const hasMachines = e.siteId && dailyMachineLogs.some(l => l.siteId === e.siteId && l.date === formDate);
      return hasNarration || hasMachines;
    });
    if (!hasAnyContent) {
      return toast.error('Please fill in notes or log machine activity for at least one site before publishing.');
    }
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
          doc.text(`${entry.siteName}(${entry.clientName})`, 22, y);
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 140);
          doc.text(`Client: ${entry.clientName}`, 22, y + 4.5); 
          y += 10;

          const siteLogs = dailyMachineLogs.filter(l => l.siteId === entry.siteId && l.date === journal.date);
          const machineNarrative = siteLogs.map(ml => 
            `[${ml.assetName}]: ${ml.isActive ? 'Operational' : 'Inactive'}${ml.isActive && ml.dieselUsage > 0 ? `. ${ml.dieselUsage}L of diesel filled` : ''}.${ml.issuesOnSite ? ` Note: ${ml.issuesOnSite}` : ''}`
          ).join('\n');
          
          const combinedNarration = [entry.narration, machineNarrative].filter(Boolean).join('\n\n');

          if (combinedNarration) {
            doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(60, 60, 80);
            const lines = doc.splitTextToSize(combinedNarration, W - 40);
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
    <div className="relative flex items-center gap-2">
      {/* ── Desktop Controls ── */}
      <div className="hidden sm:flex items-center gap-3">
        {currentUser?.privileges?.dailyJournal?.canExport && (
          <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} className="h-9 px-3 sm:px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight">
            <FileText className="w-4 h-4 shrink-0" /> <span>Export Report</span>
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
                <Plus className="w-4 h-4" /><span>New Log</span>
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── Mobile Controls ── */}
      <div className="flex sm:hidden items-center gap-2">
        {!diaryDate && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setViewMode(viewMode === 'list' ? 'calendar' : 'list'); setDiaryDate(null); }}
              className="h-9 w-9 border-slate-200 text-slate-600 p-0"
              title={viewMode === 'list' ? 'Switch to Calendar' : 'Switch to List'}
            >
              {viewMode === 'list' ? <Calendar className="h-4 w-4" /> : <div className="font-bold text-[10px]">List</div>}
            </Button>
            {currentUser?.privileges?.dailyJournal?.canAdd && (
              <Button size="sm" onClick={() => openModal(undefined, diaryDate || undefined)}
                className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white p-0"
                title="New Log"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
        {currentUser?.privileges?.dailyJournal?.canExport && (
          <button
            className={`h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 shadow-sm transition-colors ${mobileMenuOpen ? 'bg-slate-100 text-blue-600' : 'bg-white text-slate-600'}`}
            onClick={(e) => { e.stopPropagation(); setMobileMenuOpen(o => !o); }}
          >
            <span className="text-lg font-black leading-none tracking-tighter">⋮</span>
          </button>
        )}
      </div>

    </div>
  ), [viewMode, diaryDate, dailyJournals, currentUser]);

  const mobileDropdownPanel = mobileMenuOpen && (
    <div className="sm:hidden relative z-[100]">
      <div className="fixed inset-0 bg-transparent cursor-default touch-none" onPointerDown={(e) => { e.stopPropagation(); setMobileMenuOpen(false); }} />
      <div className="fixed top-16 right-3 w-48 bg-white border border-slate-200 rounded-md shadow-md p-1 animate-in fade-in zoom-in-95 duration-100">
        {currentUser?.privileges?.dailyJournal?.canExport && (
          <button onPointerDown={(e) => { e.stopPropagation(); setIsExportModalOpen(true); setMobileMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-sm text-left transition-colors active:bg-slate-100">
            <FileText className="h-4 w-4 text-blue-600" /> Export Report
          </button>
        )}
      </div>
    </div>
  );

  // Diary detail page
  if (diaryDate) {
    return (
      <>
        {mobileDropdownPanel}
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
        {renderModal()} {renderDeleteConfirm()} {renderPdfPreview()} {renderExportModal()} {renderMachineLogModal()}
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
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 sm:p-4 hover:shadow-md transition-all flex flex-col gap-3 group">
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{format(new Date(group.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
                      {isSameDay(new Date(group.date + 'T00:00:00'), new Date()) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 flex-shrink-0">Today</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {entries.length} log points • {group.journals.length} session{group.journals.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-8 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
              
              <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 w-full overflow-hidden">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug truncate sm:whitespace-normal">
                  {[...new Set(entries.map(e => `${e.siteName} (${entries.find(x => x.siteName === e.siteName)?.clientName || 'Unknown'})`))].join(' • ')}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderModal() {
    const hasMachineActivity = formEntries.some(e =>
      e.siteId && dailyMachineLogs.some(l => l.siteId === e.siteId && l.date === formDate)
    );
    const hasTypedNotes = formEntries.some(e => e.narration && e.narration.trim().length > 0);
    const showPublishReminder = formEntries.length > 0 && (hasMachineActivity || hasTypedNotes);
    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} fullScreenMobile>
        <DialogContent className="max-w-none w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-w-2xl sm:max-h-[90vh] flex flex-col overflow-hidden p-0 !rounded-none sm:!rounded-xl border-0 sm:border !m-0 sm:!m-auto">
          <DialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-slate-50 dark:bg-slate-900 flex-shrink-0">
            <DialogTitle className="text-lg font-bold">{editingId ? 'Edit Log Session' : 'New Log Session'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-6 bg-white dark:bg-slate-950">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Date</label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="h-11 w-full sm:max-w-xs text-base sm:text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Add Site Activity</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}
                  className="flex-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700">
                  <option value="">Select site...</option>
                  {activeSites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.client})</option>)}
                </select>
                <Button onClick={() => {
                  const s = sites.find(x => x.id === selectedSiteId);
                  if (s) { setFormEntries(p => [...p, { siteId: s.id, siteName: s.name, clientName: s.client, narration: '', loggedBy: currentUser?.name || 'System', createdAt: new Date().toISOString() }]); setSelectedSiteId(''); }
                }} disabled={!selectedSiteId} className="h-11 w-full sm:w-auto px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0 shadow-sm">
                  <Plus className="h-4 w-4 sm:mr-1" /> Add
                </Button>
              </div>
            </div>
            {formEntries.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl py-12 text-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <MapPin className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No site activity added yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Select a site above to begin logging</p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Logged Activities ({formEntries.length})</label>
                {formEntries.map((entry, idx) => (
                  <SiteLogCard 
                    key={entry.siteId || idx}
                    entry={entry}
                    idx={idx}
                    onRemove={() => setFormEntries(p => p.filter((_, i) => i !== idx))}
                    onChangeNarration={(val) => { const n = [...formEntries]; n[idx].narration = val; setFormEntries(n); }}
                    formDate={formDate}
                    onOpenMachineLog={(machine, siteId, siteName) => {
                      setMachineLogContext({ assetId: machine.id, assetName: machine.name, siteId, siteName });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="px-4 sm:px-6 py-4 border-t border-border bg-slate-50 dark:bg-slate-900 shrink-0 flex-col sm:flex-row gap-3 sm:justify-end pb-safe">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-11 sm:h-10 w-full sm:w-auto font-semibold">Cancel</Button>
            <Button onClick={handleSave} className={cn("h-11 sm:h-10 w-full sm:w-auto px-8 text-white font-bold shadow-md", showPublishReminder ? "bg-amber-500 hover:bg-amber-600 animate-pulse" : "bg-blue-600 hover:bg-blue-700")}>
              {showPublishReminder ? '⚠️ Publish Log' : 'Publish Log'}
            </Button>
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

  function renderMachineLogModal() {
    return (
      <Dialog open={!!machineLogContext} onOpenChange={(o) => !o && setMachineLogContext(null)} fullScreenMobile>
        <DialogContent className="max-w-none w-full h-[100dvh] max-h-[100dvh] sm:h-[90vh] sm:max-w-5xl sm:max-h-[90vh] p-0 !rounded-none sm:!rounded-xl border-0 sm:border !m-0 sm:!m-auto overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
          {machineLogContext && (
            <DailyLogManager
              assetId={machineLogContext.assetId}
              assetName={machineLogContext.assetName}
              siteId={machineLogContext.siteId}
              siteName={machineLogContext.siteName}
              initialDate={formDate}
              isEmbedded={true}
              onBack={() => setMachineLogContext(null)}
            />
          )}
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
      {mobileDropdownPanel}
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
      {renderMachineLogModal()}
    </div>
  );
}
