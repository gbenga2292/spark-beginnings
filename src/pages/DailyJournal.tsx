import React, { useState, useMemo, useEffect, useRef, ChangeEvent } from 'react';
import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { generateId, cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';
import { 
  Search, Plus, Calendar, MapPin, X, ChevronLeft, ChevronRight, List,
  FileText, Download, Filter, Wrench, CheckCircle2, AlertTriangle, 
  Package, Image as ImageIcon, Video, UploadCloud, FileVideo, Eye, Camera, Play, ArrowLeft
} from 'lucide-react';
import { MediaViewer, type MediaItem } from '@/src/components/ui/MediaViewer';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from 'date-fns';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { DiaryDetailView } from './DiaryDetailView';
import { useOperations } from '../contexts/OperationsContext';
import { DailyLogManager } from './DailyLogManager';
import { jsPDF } from 'jspdf';
import logoSrc from '@/logo/logo-2.png';
import { PdfViewer } from '@/src/components/PdfViewer';

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
  
  // Media State
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{ url: string; type: 'image' | 'video'; name: string }[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useUserStore(s => s.getCurrentUser());

  const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

  const fetchUploadedMedia = async () => {
    if (!entry.siteId || !formDate) return;
    try {
      // Use journalId (session ID) for precise matching in the form view
      const url = entry.journalId 
        ? `${MEDIA_SERVER_URL}/list.php?journal_id=${entry.journalId}`
        : `${MEDIA_SERVER_URL}/list.php?site_id=${entry.siteId}&asset_id=JOURNAL&log_date=${formDate}`;
        
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setUploadedMedia(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch media:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Get current pending files from parent or local state
    // @ts-ignore
    const currentPending = entry.pendingFiles || [];
    const newFiles = [...currentPending, ...files];
    
    // Update parent's state for this card
    // @ts-ignore
    entry.pendingFiles = newFiles;
    onChangeNarration(entry.narration || ''); // Trigger parent re-render

    const newPreviews = files.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
      name: file.name
    }));
    
    setMediaPreviews(prev => {
      const updated = [...prev, ...newPreviews];
      // Emulate WhatsApp: auto-open the previewer to the newly captured image
      setLightboxIndex(uploadedMedia.length + prev.length);
      return updated;
    });

    // Reset input so same file can be chosen again if needed
    e.target.value = '';
  };

  const removeMedia = (index: number) => {
    // @ts-ignore
    const currentPending = entry.pendingFiles || [];
    // @ts-ignore
    entry.pendingFiles = currentPending.filter((_, i) => i !== index);
    onChangeNarration(entry.narration || ''); // Trigger parent re-render

    setMediaPreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDeleteMedia = async (id: number) => {
    if (!confirm('Are you sure you want to delete this media?')) return;
    try {
      const response = await fetch(`${MEDIA_SERVER_URL}/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        toast.success('Media deleted');
        fetchUploadedMedia();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete media');
    }
  };


  useEffect(() => {
    fetchUploadedMedia();
  }, [entry.siteId, formDate, entry.journalId]);


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
          <div className="flex items-center gap-2 flex-wrap w-full">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{entry.siteName}</span>
            <div className="flex items-center gap-1.5 ml-10 sm:ml-16">
              <button 
                type="button"
                title="Take Photo or Video"
                onClick={() => cameraInputRef.current?.click()}
                className="h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 active:scale-90 transition-transform shadow-sm"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <button 
                type="button"
                title="Add from Gallery"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 w-7 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition-transform shadow-sm"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium w-fit mt-1 sm:mt-0">
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
          <div className="space-y-4">
            {/* Hidden file inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
            />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
            />

            {/* Media Storage Section - Images above text area, completely hidden if empty */}
            {(uploadedMedia.length > 0 || mediaPreviews.length > 0) && (
              <div className="pt-1 pb-2">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Photos & Videos</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    {uploadedMedia.length + mediaPreviews.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {/* Uploaded â€” clickable to open lightbox */}
                  {uploadedMedia.map((m, i) => (
                    <div
                      key={`up-${i}`}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                      onClick={() => setLightboxIndex(i)}
                    >
                      {m.file_type === 'image' ? (
                        <img src={m.url} className="w-full h-full object-cover" alt="site-media" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                          <FileVideo className="h-6 w-6 text-white/50" />
                          <span className="text-[8px] text-white/30 mt-1 truncate px-1 w-full text-center">{m.file_name}</span>
                        </div>
                      )}
                      {/* Video play icon overlay */}
                      {m.file_type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="h-9 w-9 rounded-full bg-black/60 flex items-center justify-center">
                            <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setLightboxIndex(i); }}
                          className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteMedia(m.id); }}
                          className="h-7 w-7 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="absolute top-1 left-1 bg-emerald-500 rounded-full p-0.5 text-white">
                        <CheckCircle2 className="h-2 w-2" />
                      </div>
                    </div>
                  ))}
                  {/* Pending previews */}
                  {mediaPreviews.map((p, i) => (
                    <div key={`pre-${i}`} className="group relative aspect-square rounded-lg overflow-hidden bg-indigo-50/50 border-2 border-dashed border-indigo-200 dark:border-indigo-800/50">
                      {p.type === 'image' ? (
                        <img src={p.url} className="w-full h-full object-cover opacity-60" alt="preview" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 opacity-60">
                          <FileVideo className="h-5 w-5 text-indigo-400" />
                        </div>
                      )}
                      <button type="button" onClick={() => removeMedia(i)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm">
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-indigo-600 py-0.5 text-[7px] font-black text-white text-center">AUTO-UPLOAD ON PUBLISH</div>
                    </div>
                  ))}
                  {/* Add more tile */}
                  <div
                    className="aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="h-4 w-4 text-slate-400" />
                    <span className="text-[8px] text-slate-400 font-bold">Add</span>
                  </div>
                </div>
              </div>
            )}

            <textarea value={entry.narration || ''} onChange={e => onChangeNarration(e.target.value)}
              rows={4} placeholder="Type your field notes here..."
              className="w-full text-base sm:text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-950 transition-all placeholder:text-slate-400" />

            {/* WhatsApp-style fullscreen media viewer */}
            {lightboxIndex !== null && (uploadedMedia.length > 0 || mediaPreviews.length > 0) && (
              <MediaViewer
                items={[
                  ...uploadedMedia.map((m: any) => ({
                    id: m.id,
                    url: m.url,
                    file_type: m.file_type as 'image' | 'video',
                    file_name: m.file_name,
                  })),
                  ...mediaPreviews.map((p: any) => ({
                    url: p.url,
                    file_type: p.type,
                    file_name: p.name,
                  }))
                ]}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onAddMedia={() => cameraInputRef.current?.click()}
              />
            )}
          </div>

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

  // Main Save Logic with Auto-Upload
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSave = async () => {
    if (!formDate.trim()) return toast.error('Date is required');
    if (formEntries.length === 0) return toast.error('Add at least one site log');

    // Validation
    const hasAnyContent = formEntries.some(e => {
      const hasNarration = e.narration && e.narration.trim().length > 0;
      const hasMachines = e.siteId && dailyMachineLogs.some(l => l.siteId === e.siteId && l.date === formDate);
      return hasNarration || hasMachines;
    });
    if (!hasAnyContent) {
      return toast.error('Please fill in notes or log machine activity before publishing.');
    }

    setIsPublishing(true);
    const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

    try {
      const journalId = editingId || generateId();
      
      // Step 1: Upload media for each card that has pending files
      const uploadPromises: Promise<any>[] = [];
      
      formEntries.forEach((entry) => {
        // @ts-ignore - we'll add pendingFiles to the entry object temporarily
        if (entry.pendingFiles && entry.pendingFiles.length > 0) {
          // @ts-ignore
          entry.pendingFiles.forEach((file: File) => {
            const formData = new FormData();
            formData.append('media', file);
            formData.append('site_id', entry.siteId!);
            formData.append('journal_id', journalId); // Link to specific session
            formData.append('site_name', entry.siteName!);
            formData.append('log_date', formDate);
            formData.append('uploaded_by', currentUser?.id || 'unknown');
            formData.append('uploaded_by_name', currentUser?.name || 'Unknown');

            uploadPromises.push(
              fetch(`${MEDIA_SERVER_URL}/upload.php`, {
                method: 'POST',
                body: formData,
              }).then(r => {
                if (!r.ok) throw new Error(`Upload failed for ${file.name}`);
                return r.json();
              })
            );
          });
        }
      });

      if (uploadPromises.length > 0) {
        toast.info(`Uploading ${uploadPromises.length} files...`);
        await Promise.all(uploadPromises);
      }

      // Step 2: Save Journal to Store (Supabase)
      if (editingId) {
        updateDailyJournal(editingId, { date: formDate }, formEntries.map(e => ({ 
          id: e.id || generateId(), 
          journalId: editingId, 
          siteId: e.siteId!, 
          siteName: e.siteName!, 
          clientName: e.clientName!, 
          narration: e.narration!, 
          createdAt: e.createdAt || new Date().toISOString(), 
          loggedBy: e.loggedBy || currentUser?.name || 'System' 
        })));
        toast.success('Log and media updated');
      } else {
        addDailyJournal({ 
          id: journalId, 
          date: formDate, 
          generalNotes: '', 
          loggedBy: currentUser?.name || 'System', 
          createdAt: new Date().toISOString() 
        }, formEntries.map(e => ({ 
          id: generateId(), 
          journalId: journalId, 
          siteId: e.siteId!, 
          siteName: e.siteName!, 
          clientName: e.clientName!, 
          narration: e.narration!, 
          createdAt: new Date().toISOString(), 
          loggedBy: currentUser?.name || 'System' 
        })));
        toast.success('Log published successfully');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save log or upload media');
    } finally {
      setIsPublishing(false);
    }
  };

  const openModal = (journal?: DailyJournalType, date?: string) => {
    if (journal) {
      setEditingId(journal.id); setFormDate(journal.date);
      setFormEntries(siteJournalEntries.filter(e => e.journalId === journal.id).map(e => ({ ...e, pendingFiles: [] } as any)));
    } else {
      setEditingId(null); setFormDate(date || new Date().toISOString().split('T')[0]); setFormEntries([]);
    }
    setIsModalOpen(true);
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
        doc.text(`Session ${ji + 1}  Â·  ${journal.loggedBy}${journal.createdAt ? '  ' + format(new Date(journal.createdAt), 'HH:mm') : ''}`, 14, y);
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
      doc.text(`Page ${idx + 1} Â· Dewatering Construction Etc Limited Â· Generated ${format(new Date(), 'PPP')}`, W / 2, H - 10, { align: 'center' });
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

  useSetPageTitle(
    showPdfPreview ? 'PDF Preview' : 'Site Diary',
    showPdfPreview ? 'Review report content before downloading' : 'Daily field activity register',
    showPdfPreview ? (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowPdfPreview(false)} className="h-8 sm:h-9 px-2 sm:px-4 gap-2 font-bold text-xs uppercase tracking-tight">
          <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Back</span>
        </Button>
        <Button size="sm" onClick={() => {
          const doc = generateDiaryPdf(matchingExportJournals.length > 0 ? matchingExportJournals : [{date: pdfExportDate, journals: dailyJournals.filter(j => j.date === pdfExportDate)}]);
          doc.save(`SiteDiary-Report.pdf`);
        }}
          className="h-8 sm:h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 sm:px-5 shadow-sm uppercase tracking-tight">
          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">Download PDF</span>
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 md:gap-3">
        {currentUser?.privileges?.dailyJournal?.canExport && (
          <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} className="h-8 sm:h-9 px-2 sm:px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight">
            <FileText className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Export Report</span>
          </Button>
        )}
        {!diaryDate && (
          <>
            <div className="flex items-center rounded border border-slate-200 bg-white p-0.5 shadow-sm">
              {(['list', 'calendar'] as const).map(v => (
                <button key={v} onClick={() => { setViewMode(v); setDiaryDate(null); }}
                  className={cn('px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded transition-all', viewMode === v && !diaryDate ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                  title={v === 'list' ? 'Switch to List' : 'Switch to Calendar'}
                >
                  {v === 'list' ? <span className="hidden sm:inline">List</span> : <span className="hidden sm:inline">Calendar</span>}
                  {v === 'list' ? <List className="h-4 w-4 sm:hidden" /> : <Calendar className="h-4 w-4 sm:hidden" />}
                </button>
              ))}
            </div>
            {currentUser?.privileges?.dailyJournal?.canAdd && (
              <Button size="sm" onClick={() => openModal(undefined, diaryDate || undefined)}
                className="hidden sm:flex h-8 sm:h-9 px-2 sm:px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs tracking-tight shadow-sm active:scale-95">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Log</span>
              </Button>
            )}
          </>
        )}
      </div>
    ), 
    [viewMode, diaryDate, dailyJournals, currentUser, showPdfPreview, matchingExportJournals, pdfExportDate]
  );

  if (showPdfPreview) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-100px)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex-1 overflow-hidden relative p-0 sm:p-4">
          <div className="w-full h-full rounded-none sm:rounded-xl overflow-hidden shadow-md bg-white border border-slate-200 dark:border-slate-800">
            <PdfViewer src={pdfDataUri} className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

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
        {renderModal()} {renderDeleteConfirm()} {renderExportModal()} {renderMachineLogModal()}
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
        <div key={ds} className={cn('border-b border-r border-border p-1 sm:p-2 flex flex-col min-h-[70px] sm:min-h-[100px] group relative', isT && 'bg-blue-50/50 dark:bg-blue-950/20')}>
          <div className="flex items-center justify-center sm:justify-between mb-1">
            <span className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors mx-auto sm:mx-0', isT ? 'bg-blue-600 text-white' : 'text-muted-foreground group-hover:text-blue-600')}>
              {format(day, 'd')}
            </span>
            {currentUser?.privileges?.dailyJournal?.canAdd && (
              <button onClick={e => { e.stopPropagation(); openModal(undefined, ds); }}
                className="hidden sm:flex w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm text-xs">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {dayJs.length > 0 && (
            <button onClick={() => setDiaryDate(ds)} className="mt-auto sm:mt-1 text-left w-full">
              {/* Desktop View */}
              <div className="hidden sm:block text-[10px] font-medium px-1.5 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 transition-colors truncate">
                {entryCount} log{entryCount !== 1 ? 's' : ''}{' \u2022 '}{dayJs.length} session{dayJs.length !== 1 ? 's' : ''}
              </div>
              {/* Mobile View */}
              <div className="sm:hidden flex items-center justify-center">
                <div className="flex items-center justify-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0"></div>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 leading-none">{entryCount}</span>
                </div>
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
                      {entries.length} log points{' \u2022 '}{group.journals.length} session{group.journals.length !== 1 ? 's' : ''}
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
          <DialogHeader className="pl-4 pr-10 sm:px-6 py-3 sm:py-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex-shrink-0 relative">
            <div className="flex items-center justify-start gap-4">
              <DialogTitle className="text-sm sm:text-lg font-bold truncate shrink-0">{editingId ? 'Edit Log' : 'New Log'}</DialogTitle>
              <div className="relative inline-flex h-8 sm:h-10 w-[115px] sm:w-[130px] shrink-0 items-center justify-between rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 sm:px-3 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
                <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formDate ? `${formDate.split('-')[2]}/${formDate.split('-')[1]}/${formDate.split('-')[0]}` : 'dd/mm/yyyy'}
                </span>
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-6 bg-white dark:bg-slate-950">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Add Site Activity</label>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}
                  className="w-full sm:flex-1 h-11 rounded-md border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700">
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
              {showPublishReminder ? 'âš ï¸ Publish Log' : 'Publish Log'}
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


  function renderExportModal() {
    return (
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="w-full max-w-sm sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          {/* Header */}
          <DialogHeader className="px-5 py-4 sm:px-6 sm:py-5 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              Export Diary Report
            </DialogTitle>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium text-left">
              Configure your report parameters before generating a PDF.
            </p>
          </DialogHeader>

          {/* Body */}
          <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 bg-white dark:bg-slate-950">
            {/* Date Range â€” stacks on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> From Date
                </label>
                <Input
                  type="date"
                  value={exportFilters.startDate}
                  onChange={e => setExportFilters(f => ({ ...f, startDate: e.target.value }))}
                  className="h-11 text-sm font-medium bg-slate-50 dark:bg-slate-900 border-slate-200 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> To Date
                </label>
                <Input
                  type="date"
                  value={exportFilters.endDate}
                  onChange={e => setExportFilters(f => ({ ...f, endDate: e.target.value }))}
                  className="h-11 text-sm font-medium bg-slate-50 dark:bg-slate-900 border-slate-200 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Site Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Filter by Site
              </label>
              <select
                value={exportFilters.siteId}
                onChange={e => setExportFilters(f => ({ ...f, siteId: e.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.client})</option>)}
              </select>
            </div>

            {/* Author Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Filter className="h-3 w-3" /> Filter by Author
              </label>
              <select
                value={exportFilters.author}
                onChange={e => setExportFilters(f => ({ ...f, author: e.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Authors</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Logs Found Banner */}
            <div className={cn(
              "p-3 sm:p-4 rounded-xl border flex items-center justify-between transition-all",
              matchingExportJournals.length > 0
                ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50"
                : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800"
            )}>
              <div className="flex items-center gap-2.5">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  matchingExportJournals.length > 0
                    ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-300"
                    : "bg-slate-200 text-slate-400 dark:bg-slate-800"
                )}>
                  <FileText className="h-4 w-4" />
                </div>
                <span className={cn("text-sm font-bold",
                  matchingExportJournals.length > 0 ? "text-indigo-900 dark:text-indigo-200" : "text-slate-400"
                )}>
                  Logs Found
                </span>
              </div>
              <span className={cn("text-xl font-black",
                matchingExportJournals.length > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
              )}>
                {matchingExportJournals.length}
                <span className="text-sm font-semibold ml-1">day{matchingExportJournals.length !== 1 ? 's' : ''}</span>
              </span>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 sm:justify-end mt-0 pt-0">
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(false)}
              className="h-11 sm:h-10 w-full sm:w-auto font-semibold order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunExport}
              disabled={matchingExportJournals.length === 0}
              className="h-11 sm:h-10 w-full sm:w-auto px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md gap-2 order-1 sm:order-2"
            >
              <FileText className="h-4 w-4 shrink-0" />
              Generate Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mobile "New Log" Action Button */}
      <div className="sm:hidden">
        {currentUser?.privileges?.dailyJournal?.canAdd && (
          <Button onClick={() => openModal(undefined, diaryDate || undefined)} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md rounded-xl text-base">
            <Plus className="h-5 w-5" /> New Log
          </Button>
        )}
      </div>
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
      {renderExportModal()}
      {renderMachineLogModal()}
    </div>
  );
}
