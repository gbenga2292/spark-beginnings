import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Calendar, MapPin, Camera, Play, Video, Eye, Trash2, Check } from 'lucide-react';
import { useAppStore, DailyJournal as DailyJournalType, SiteJournalEntry } from "@/src/store/appStore";
import { useUserStore } from "@/src/store/userStore";
import { useOperations } from "@/src/contexts/OperationsContext";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/src/components/ui/dialog";
import { toast } from "@/src/components/ui/toast";
import { format } from "date-fns";
import { DailyLogManager } from "@/src/pages/DailyLogManager";
import { CustomCamera } from "@/src/components/ui/CustomCamera";

interface CreateDailyJournalDialogProps {
  onClose: () => void;
  initialDate?: string; // e.g. "2026-06-09"
}

function SiteLogCard({
  entry,
  idx,
  onRemove,
  onChangeNarration,
  formDate,
  onOpenMachineLog,
}: {
  entry: Partial<SiteJournalEntry>;
  idx: number;
  onRemove: () => void;
  onChangeNarration: (val: string) => void;
  formDate: string;
  onOpenMachineLog: (machine: { id: string; name: string }, siteId: string, siteName: string) => void;
}) {
  const { waybills, assets } = useOperations();
  const [activeTab, setActiveTab] = useState<'general' | 'machines'>('general');
  const [mediaPreviews, setMediaPreviews] = useState<{ url: string; type: 'image' | 'video'; name: string }[]>([]);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const currentUser = useUserStore(s => s.getCurrentUser());

  const handleCapturedFile = (file: File) => {
    // @ts-ignore
    const currentPending = entry.pendingFiles || [];
    const newFiles = [...currentPending, file];
    // @ts-ignore
    entry.pendingFiles = newFiles;
    onChangeNarration(entry.narration || '');

    const newPreview = {
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
      name: file.name
    };

    setMediaPreviews(prev => [...prev, newPreview]);
  };

  const removeMedia = (index: number) => {
    // @ts-ignore
    const currentPending = entry.pendingFiles || [];
    // @ts-ignore
    entry.pendingFiles = currentPending.filter((_, i) => i !== index);
    onChangeNarration(entry.narration || '');

    setMediaPreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const machineItems = useMemo(() => {
    if (!entry.siteId) return [];
    const siteWaybills = waybills.filter(w => w.siteId === entry.siteId && w.type === 'waybill' && w.status !== 'outstanding');
    return assets.filter(a => a.type === 'equipment' && a.requiresLogging && siteWaybills.some(w => w.items.some(i => i.assetId === a.id)));
  }, [waybills, assets, entry.siteId]);

  return (
    <div className="bg-[#141622] border border-[#2a2e3d] rounded-xl p-4 shadow-sm relative overflow-hidden text-white">
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
      <div className="flex items-start justify-between mb-3 pl-2 pr-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-white">{entry.siteName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/60 font-medium w-fit">
            {entry.clientName}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      {machineItems.length > 0 && (
        <div className="flex border-b border-white/5 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'general' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            General Notes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('machines')}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'machines' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            Machine Logs ({machineItems.length})
          </button>
        </div>
      )}

      {activeTab === 'general' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Site Activity Notes</label>
            <textarea
              value={entry.narration || ''}
              onChange={e => onChangeNarration(e.target.value)}
              placeholder="Enter activity description, progress, delays, etc…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0f111a] text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm resize-none"
            />
          </div>

          {/* Media Capture Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-white/40 uppercase">Photos & Videos</span>
              <button
                type="button"
                onClick={() => setShowCustomCamera(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all text-xs font-semibold"
              >
                <Camera className="w-3.5 h-3.5" /> Capture
              </button>
            </div>

            {mediaPreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {mediaPreviews.map((preview, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black/40 border border-white/10 group">
                    {preview.type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white/75" />
                      </div>
                    ) : (
                      <img src={preview.url} alt="captured" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 rounded-full text-white transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-white/40 uppercase block mb-1">Log equipment hours</span>
          <div className="grid grid-cols-1 gap-2">
            {machineItems.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenMachineLog(m, entry.siteId!, entry.siteName!)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#0f111a] border border-white/5 hover:border-indigo-500/40 text-left transition-all"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">Click to log pumping/running details</p>
                </div>
                <div className="h-7 px-2.5 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/70">
                  Open Log
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCustomCamera && (
        <CustomCamera
          onCapture={handleCapturedFile}
          onClose={() => setShowCustomCamera(false)}
        />
      )}
    </div>
  );
}

export function CreateDailyJournalDialog({ onClose, initialDate = "" }: CreateDailyJournalDialogProps) {
  const { dailyJournals, sites, addDailyJournal } = useAppStore();
  const { dailyMachineLogs } = useOperations();
  const currentUser = useUserStore(s => s.getCurrentUser());

  const [formDate, setFormDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [formEntries, setFormEntries] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [machineLogContext, setMachineLogContext] = useState<any | null>(null);

  const activeSites = useMemo(() => sites.filter(s => s.status === 'Active'), [sites]);

  const generateId = () => crypto.randomUUID();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate.trim()) return toast.error('Date is required');
    if (formEntries.length === 0) return toast.error('Add at least one site log');

    const hasAnyContent = formEntries.some(entry => {
      const hasNarration = entry.narration && entry.narration.trim().length > 0;
      const hasMachines = entry.siteId && dailyMachineLogs.some(l => l.siteId === entry.siteId && l.date === formDate);
      // @ts-ignore
      const hasFiles = entry.pendingFiles && entry.pendingFiles.length > 0;
      return hasNarration || hasMachines || hasFiles;
    });

    if (!hasAnyContent) {
      return toast.error('Please fill in notes, attach media, or log machine activity before publishing.');
    }

    setIsSubmitting(true);
    const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';

    try {
      const journalId = generateId();
      const uploadPromises: Promise<any>[] = [];

      formEntries.forEach((entry) => {
        // @ts-ignore
        if (entry.pendingFiles && entry.pendingFiles.length > 0) {
          // @ts-ignore
          entry.pendingFiles.forEach((file: File) => {
            const formData = new FormData();
            formData.append('media', file);
            formData.append('site_id', entry.siteId!);
            formData.append('journal_id', journalId);
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

      await addDailyJournal({
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
        narration: e.narration || '',
        createdAt: new Date().toISOString(),
        loggedBy: currentUser?.name || 'System'
      })));

      toast.success('Log published successfully');
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save log or upload media');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-[#0f111a] border border-[#2a2e3d] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] text-white"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-r from-amber-500/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">New Daily Log</h2>
              <p className="text-[11px] text-white/50">Publish site activity updates for a date</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-white/50 hover:text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-[#0f111a]">
          {/* Date Selector */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Log Date</span>
            <div className="relative inline-flex h-9 px-3 items-center justify-between rounded-lg border border-white/10 bg-[#141622] hover:bg-white/5 transition-all cursor-pointer">
              <span className="text-xs font-medium text-white pr-6">
                {formDate ? formDate.split('-').reverse().join('/') : 'dd/mm/yyyy'}
              </span>
              <Calendar className="h-3.5 w-3.5 text-white/50 absolute right-3 pointer-events-none" />
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Add Site Selection */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide mb-1.5">
              Add Site Activity
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                className="flex-1 h-11 rounded-xl border border-white/10 bg-[#141622] px-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select active site...</option>
                {activeSites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.client})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const s = sites.find(x => x.id === selectedSiteId);
                  if (s) {
                    setFormEntries(p => [
                      ...p,
                      {
                        siteId: s.id,
                        siteName: s.name,
                        clientName: s.client,
                        narration: '',
                        loggedBy: currentUser?.name || 'System',
                        createdAt: new Date().toISOString(),
                        pendingFiles: []
                      }
                    ]);
                    setSelectedSiteId('');
                  }
                }}
                disabled={!selectedSiteId}
                className="h-11 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          {/* Activity Cards List */}
          {formEntries.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-2xl py-12 text-center bg-white/5">
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-6 w-6 text-white/30" />
              </div>
              <p className="text-sm font-semibold text-white/80">No site activity added yet</p>
              <p className="text-xs text-white/40 mt-1">Select an active site above to begin logging</p>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide">
                Logged Activities ({formEntries.length})
              </label>
              {formEntries.map((entry, idx) => (
                <SiteLogCard
                  key={entry.siteId || idx}
                  entry={entry}
                  idx={idx}
                  onRemove={() => setFormEntries(p => p.filter((_, i) => i !== idx))}
                  onChangeNarration={(val) => {
                    const n = [...formEntries];
                    n[idx].narration = val;
                    setFormEntries(n);
                  }}
                  formDate={formDate}
                  onOpenMachineLog={(machine, siteId, siteName) => {
                    setMachineLogContext({ assetId: machine.id, assetName: machine.name, siteId, siteName });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/5 bg-[#0f111a] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || formEntries.length === 0}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-md text-white"
          >
            {isSubmitting ? "Publishing..." : "Publish Log"}
          </button>
        </div>
      </motion.div>

      {/* Embedded Machine Log dialog */}
      {machineLogContext && (
        <Dialog open={!!machineLogContext} onOpenChange={(o) => !o && setMachineLogContext(null)} fullScreenMobile>
          <DialogContent className="max-w-none w-full h-[100dvh] max-h-[100dvh] sm:h-[90vh] sm:max-w-5xl sm:max-h-[90vh] p-0 !rounded-none sm:!rounded-xl border-0 sm:border !m-0 sm:!m-auto overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
            <DailyLogManager
              assetId={machineLogContext.assetId}
              assetName={machineLogContext.assetName}
              siteId={machineLogContext.siteId}
              siteName={machineLogContext.siteName}
              initialDate={formDate}
              isEmbedded
              onBack={() => setMachineLogContext(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
