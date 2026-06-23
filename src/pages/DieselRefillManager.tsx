import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fuel, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2, Save,
  Building2, Calendar, Droplets, Package, AlertCircle, CheckCircle2,
  Info, ChevronRight, Gauge, BarChart3, List
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { DieselRefill, DieselRefillAllocation } from '@/src/types/operations';

const fmt = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const fmtCurrency = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];

function useAllActiveMachines() {
  const { assets, waybills } = useOperations();
  const sites = useAppStore(s => s.sites);
  return useMemo(() => {
    const locations = new Map<string, { quantity: number; siteId: string }>();

    const sorted = [...waybills].sort((a, b) => new Date(a.sentToSiteDate || a.issueDate).getTime() - new Date(b.sentToSiteDate || b.issueDate).getTime());

    sorted.forEach(wb => {
      if (wb.type === 'waybill' && ['sent_to_site', 'partial_returned', 'open'].includes(wb.status)) {
        wb.items.forEach(item => {
          locations.set(item.assetId, { quantity: (locations.get(item.assetId)?.quantity || 0) + item.quantity, siteId: wb.siteId || '' });
        });
      } else if (wb.type === 'return') {
        wb.items.forEach(item => {
          const cur = locations.get(item.assetId);
          if (cur) {
            const newQty = Math.max(0, cur.quantity - item.quantity);
            if (newQty === 0) locations.delete(item.assetId);
            else locations.set(item.assetId, { quantity: newQty, siteId: cur.siteId });
          }
        });
      }
    });

    return assets
      .filter(a => a.type === 'equipment' && a.requiresLogging && locations.has(a.id))
      .map(a => {
         const loc = locations.get(a.id)!;
         const site = sites.find(s => s.id === loc.siteId);
         return {
           assetId: a.id,
           assetName: a.name,
           siteId: site?.id || '',
           siteName: site?.name || 'Unknown Site',
         };
      });
  }, [assets, waybills, sites]);
}

// ── Refill Form ───────────────────────────────────────────────────────────────
interface RefillFormProps {
  editing?: DieselRefill | null;
  onClose: () => void;
  onSave: (refill: Omit<DieselRefill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

function RefillForm({ editing, onClose, onSave }: RefillFormProps) {
  const { isDark } = useTheme();
  const sites = useAppStore(s => s.sites);
  const { dailyMachineLogs, logDailyActivity } = useOperations();

  const [date, setDate] = useState(editing?.date || today());
  const [totalLitres, setTotalLitres] = useState(editing?.totalLitres?.toString() || '');
  const [pricePerLitre, setPricePerLitre] = useState(editing?.pricePerLitre?.toString() || '');
  const [purchasedBy, setPurchasedBy] = useState(editing?.purchasedBy || '');
  const [supplier, setSupplier] = useState(editing?.supplier || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const activeSites = useMemo(() => sites.filter(s => s.status === 'Active'), [sites]);
  const allActiveMachines = useAllActiveMachines();

  const [allocations, setAllocations] = useState<DieselRefillAllocation[]>(() => {
    if (editing?.machineAllocations?.length) {
      return editing.machineAllocations.map(a => ({
        ...a,
        refillDate: a.refillDate || editing.date
      }));
    }
    return [];
  });

  const [selectedMachineToAdd, setSelectedMachineToAdd] = useState('');

  const handleDateChange = (newDate: string) => {
    const prevDate = date;
    setDate(newDate);
    setAllocations(prev => prev.map(a => {
      if (!a.refillDate || a.refillDate === prevDate) {
        const existingLog = dailyMachineLogs.find(
          l => l.assetId === a.assetId && l.siteId === a.siteId && l.date === newDate
        );
        return {
          ...a,
          refillDate: newDate,
          actualUsed: existingLog?.dieselUsage ?? 0
        };
      }
      return a;
    }));
  };

  const handleRowDateChange = (idx: number, newRowDate: string) => {
    const alloc = allocations[idx];
    const existingLog = dailyMachineLogs.find(
      l => l.assetId === alloc.assetId && l.siteId === alloc.siteId && l.date === newRowDate
    );
    setAllocations(prev => prev.map((a, i) => i === idx ? {
      ...a,
      refillDate: newRowDate,
      actualUsed: existingLog?.dieselUsage ?? 0
    } : a));
  };

  const addMachine = (machineId: string) => {
    if (!machineId) return;
    if (allocations.some(a => a.assetId === machineId)) return;
    
    const machine = allActiveMachines.find(m => m.assetId === machineId);
    if (!machine) return;

    const existingLog = dailyMachineLogs.find(
      l => l.assetId === machine.assetId && l.siteId === machine.siteId && l.date === date
    );

    setAllocations(prev => [...prev, {
      assetId: machine.assetId,
      assetName: machine.assetName,
      siteId: machine.siteId,
      siteName: machine.siteName,
      allocatedLitres: 0,
      actualUsed: existingLog?.dieselUsage ?? 0,
      notes: '',
      refillDate: date
    }]);
    setSelectedMachineToAdd('');
  };

  const quickAddFromSite = (siteId: string) => {
    if (!siteId) return;
    const machinesOnSite = allActiveMachines.filter(m => m.siteId === siteId);
    const toAdd = machinesOnSite.filter(m => !allocations.some(a => a.assetId === m.assetId));
    
    const newAllocs = toAdd.map(m => {
      const existingLog = dailyMachineLogs.find(
        l => l.assetId === m.assetId && l.siteId === m.siteId && l.date === date
      );
      return {
        assetId: m.assetId,
        assetName: m.assetName,
        siteId: m.siteId,
        siteName: m.siteName,
        allocatedLitres: 0,
        actualUsed: existingLog?.dieselUsage ?? 0,
        notes: '',
        refillDate: date
      };
    });

    if (newAllocs.length > 0) {
      setAllocations(prev => [...prev, ...newAllocs]);
    } else {
      toast.info('No new active machines found on this site.');
    }
  };

  const totalAllocated = allocations.reduce((s, a) => s + (Number(a.allocatedLitres) || 0), 0);
  const totalActual = allocations.reduce((s, a) => s + (Number(a.actualUsed) || 0), 0);
  const totalL = Number(totalLitres) || 0;
  const remaining = totalL - totalAllocated;
  const totalCost = totalL > 0 && Number(pricePerLitre) > 0 ? totalL * Number(pricePerLitre) : undefined;

  const updateAlloc = (idx: number, field: keyof DieselRefillAllocation, value: any) => {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };
  
  const removeAlloc = (idx: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!date || !totalLitres) {
      toast.error('Date and total litres are required');
      return;
    }
    if (allocations.length === 0) {
      toast.error('Add at least one machine allocation');
      return;
    }
    if (remaining < -0.001) {
      toast.error('Allocated litres exceed total purchased');
      return;
    }
    setIsSaving(true);
    try {
      for (const alloc of allocations) {
        const targetDate = alloc.refillDate || date;
        if (alloc.actualUsed > 0 || alloc.allocatedLitres > 0) {
          const existingLog = dailyMachineLogs.find(
            l => l.assetId === alloc.assetId && l.siteId === alloc.siteId && l.date === targetDate
          );
          await logDailyActivity({
            assetId: alloc.assetId,
            assetName: alloc.assetName,
            siteId: alloc.siteId || '',
            siteName: alloc.siteName || '',
            date: targetDate,
            isActive: existingLog?.isActive ?? true,
            operationalDay: existingLog?.operationalDay ?? 'full',
            downtimeEntries: existingLog?.downtimeEntries ?? [],
            maintenanceDetails: existingLog?.maintenanceDetails,
            clientFeedback: existingLog?.clientFeedback,
            issuesOnSite: existingLog?.issuesOnSite,
            dieselUsage: Number(alloc.actualUsed) || 0,
            supervisorOnSite: existingLog?.supervisorOnSite,
            loggedBy: existingLog?.loggedBy,
          });
        }
      }

      const computedSiteId = allocations.every(a => a.siteId === allocations[0].siteId) ? allocations[0].siteId : 'multiple';
      const computedSiteName = allocations.every(a => a.siteId === allocations[0].siteId) ? allocations[0].siteName : 'Multiple Sites';

      await onSave({
        date,
        siteId: computedSiteId || 'multiple',
        siteName: computedSiteName || 'Multiple Sites',
        totalLitres: Number(totalLitres),
        pricePerLitre: pricePerLitre ? Number(pricePerLitre) : undefined,
        totalCost,
        purchasedBy: purchasedBy || undefined,
        supplier: supplier || undefined,
        notes: notes || undefined,
        machineAllocations: allocations,
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const inp = cn(
    'w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors',
    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );
  const label = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block';

  return (
    <div className={cn('flex flex-col gap-5 p-5 rounded-2xl border shadow-xl max-h-[90vh] overflow-y-auto style-scroll', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Fuel className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className={cn('font-bold text-base', isDark ? 'text-white' : 'text-slate-900')}>
              {editing ? 'Edit Diesel Refill' : 'Log Diesel Refill'}
            </h2>
            <p className="text-xs text-slate-500">Record a bulk diesel purchase and distribute to any machines</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Purchase Details */}
      <div className={cn('p-4 rounded-xl border', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-amber-50/50 border-amber-100')}>
        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">Purchase Details</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={label}>Date *</label>
            <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={label}>Total Litres *</label>
            <input type="number" min="0" step="0.5" value={totalLitres} onChange={e => setTotalLitres(e.target.value)} placeholder="e.g. 60" className={inp} />
          </div>
          <div>
            <label className={label}>Price / Litre (₦)</label>
            <input type="number" min="0" step="0.01" value={pricePerLitre} onChange={e => setPricePerLitre(e.target.value)} placeholder="e.g. 950" className={inp} />
          </div>
          <div>
            <label className={label}>Total Cost</label>
            <div className={cn('rounded-xl border px-3 py-2 text-sm font-semibold h-10 flex items-center', isDark ? 'bg-slate-700 border-slate-600 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')}>
              {totalCost ? fmtCurrency(totalCost) : '—'}
            </div>
          </div>
          <div className="col-span-2">
            <label className={label}>Purchased By & Supplier</label>
            <div className="flex gap-2">
              <input type="text" value={purchasedBy} onChange={e => setPurchasedBy(e.target.value)} placeholder="Person / driver" className={inp} />
              <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Fuel station" className={inp} />
            </div>
          </div>
          <div className="col-span-2">
            <label className={label}>General Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional global notes" className={inp} />
          </div>
        </div>
      </div>

      {/* Machine Allocations */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Machines Being Refilled</p>
            {totalL > 0 && (
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                remaining < -0.001 ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                remaining < 0.001 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              )}>
                {remaining < -0.001 ? `${fmt(Math.abs(remaining))}L over` :
                 remaining < 0.001 ? 'Fully allocated' :
                 `${fmt(remaining)}L remaining to allocate`}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <select
              value=""
              onChange={e => quickAddFromSite(e.target.value)}
              className={cn('h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
            >
              <option value="">+ Quick Add from Site...</option>
              {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={selectedMachineToAdd}
              onChange={e => addMachine(e.target.value)}
              className={cn('h-8 rounded-lg border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
            >
              <option value="">+ Add Specific Machine...</option>
              {allActiveMachines.map(m => (
                <option key={m.assetId} value={m.assetId}>{m.assetName} ({m.siteName})</option>
              ))}
            </select>
          </div>
        </div>

        {allocations.length === 0 ? (
          <div className={cn('flex items-center gap-2 p-4 rounded-xl border text-sm', isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}>
            <Info className="w-4 h-4 shrink-0" />
            No machines added yet. Select machines or add from a site to log their refill.
          </div>
        ) : (
          <div className={cn('rounded-xl border overflow-x-auto', isDark ? 'border-slate-700' : 'border-slate-200')}>
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[750px]">
              <thead className={cn('text-xs font-bold uppercase tracking-wider', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500')}>
                <tr>
                  <th className="px-4 py-2">Machine & Site</th>
                  <th className="px-4 py-2 w-32">Refill Date</th>
                  <th className="px-4 py-2 w-28 text-right">Bought (L)</th>
                  <th className="px-4 py-2 w-28 text-right">Actual Used (L)</th>
                  <th className="px-4 py-2 w-24 text-right">Remains (L)</th>
                  <th className="px-4 py-2">Machine Note</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                {allocations.map((alloc, idx) => {
                  const bought = Number(alloc.allocatedLitres) || 0;
                  const used = Number(alloc.actualUsed) || 0;
                  const balance = bought - used;
                  return (
                    <tr key={alloc.assetId} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                      <td className="px-4 py-3">
                        <p className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-slate-900')}>{alloc.assetName}</p>
                        <p className="text-[10px] text-slate-400">{alloc.siteName}</p>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={alloc.refillDate || date}
                          onChange={e => handleRowDateChange(idx, e.target.value)}
                          className={cn('rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-full', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number" min="0" step="0.5"
                          value={alloc.allocatedLitres || ''}
                          onChange={e => updateAlloc(idx, 'allocatedLitres', Number(e.target.value))}
                          placeholder="0"
                          className={cn('rounded-lg border px-2 py-1.5 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
                        />
                      </td>
                      <td className="px-4 py-2 relative group">
                        <input
                          type="number" min="0" step="0.5"
                          value={alloc.actualUsed || ''}
                          onChange={e => updateAlloc(idx, 'actualUsed', Number(e.target.value))}
                          placeholder="0"
                          className={cn('rounded-lg border px-2 py-1.5 text-sm text-right w-full focus:outline-none focus:ring-1 focus:ring-emerald-500', isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800')}
                        />
                        <span className="absolute -top-0 -right-0 text-[8px] font-bold bg-emerald-500 text-white rounded-full px-1 py-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity">SYNCS</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={cn('text-sm font-bold', balance > 0 ? 'text-blue-500' : balance < 0 ? 'text-red-500' : 'text-slate-400')}>
                          {balance > 0 ? `+${fmt(balance)}` : fmt(balance)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={alloc.notes || ''}
                          onChange={e => updateAlloc(idx, 'notes', e.target.value)}
                          placeholder="Optional..."
                          className={cn('rounded-lg border px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200')}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeAlloc(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className={cn('border-t font-bold text-sm', isDark ? 'bg-slate-800/60 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700')}>
                <tr>
                  <td className="px-4 py-2 text-xs uppercase text-slate-500">Totals</td>
                  <td className="px-4 py-2 text-right">{fmt(totalAllocated)}L</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{fmt(totalActual)}L</td>
                  <td className="px-4 py-2 text-right">{fmt(totalAllocated - totalActual)}L</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className={cn('text-xs mt-2 flex items-center gap-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          "Actual Used" automatically syncs with the Daily Machine Log for the selected date.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">Cancel</Button>
        <Button
          onClick={handleSave} disabled={isSaving}
          className="flex-[2] h-9 text-sm bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving…' : editing ? 'Update Refill' : 'Save Refill'}
        </Button>
      </div>
    </div>
  );
}

// ── Refill Card ───────────────────────────────────────────────────────────────
interface RefillCardProps {
  refill: DieselRefill;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

function RefillCard({ refill, onEdit, onDelete, canEdit, canDelete }: RefillCardProps) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { dailyMachineLogs } = useOperations();

  // Read live actualUsed from daily logs for each allocation
  const enrichedAllocations = useMemo(() => {
    return refill.machineAllocations.map(alloc => {
      const targetDate = alloc.refillDate || refill.date;
      const log = dailyMachineLogs.find(l => l.assetId === alloc.assetId && l.siteId === refill.siteId && l.date === targetDate);
      return { ...alloc, actualUsed: log?.dieselUsage ?? alloc.actualUsed };
    });
  }, [refill, dailyMachineLogs]);

  const totalActual = enrichedAllocations.reduce((s, a) => s + (a.actualUsed || 0), 0);
  const totalAlloc = enrichedAllocations.reduce((s, a) => s + (a.allocatedLitres || 0), 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn('rounded-2xl border shadow-sm overflow-hidden transition-colors', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className={cn('p-2.5 rounded-xl shrink-0', isDark ? 'bg-amber-500/10' : 'bg-amber-50')}>
          <Fuel className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('font-bold text-sm truncate', isDark ? 'text-white' : 'text-slate-900')}>
              {refill.siteName}
            </p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700 border border-amber-100')}>
              {fmt(refill.totalLitres)}L
            </span>
            {refill.machineAllocations.length > 0 && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>
                {refill.machineAllocations.length} machine{refill.machineAllocations.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(refill.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {refill.totalCost && (
              <span className="text-xs text-slate-500">{fmtCurrency(refill.totalCost)}</span>
            )}
            {refill.purchasedBy && (
              <span className="text-xs text-slate-500">by {refill.purchasedBy}</span>
            )}
          </div>
          {/* Mini usage bar */}
          {refill.totalLitres > 0 && enrichedAllocations.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Allocated: {fmt(totalAlloc)}L</span>
                <span className="text-emerald-500">Used: {fmt(totalActual)}L</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, (totalAlloc / refill.totalLitres) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button className="p-1.5 text-slate-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: machine breakdown */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('border-t px-4 pb-4 pt-3', isDark ? 'border-slate-800' : 'border-slate-100')}>
              {enrichedAllocations.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No machine allocations recorded.</p>
              ) : (
                <>
                  <div className={cn('rounded-xl overflow-hidden border', isDark ? 'border-slate-800' : 'border-slate-100')}>
                    <div className={cn('grid grid-cols-[1fr_90px_90px_80px] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider', isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400')}>
                      <span>Machine</span>
                      <span className="text-right">Allocated</span>
                      <span className="text-right text-emerald-500">Actual Used</span>
                      <span className="text-right">Balance</span>
                    </div>
                    {enrichedAllocations.map(alloc => {
                      const balance = (alloc.allocatedLitres || 0) - (alloc.actualUsed || 0);
                      return (
                        <div key={alloc.assetId} className={cn('grid grid-cols-[1fr_90px_90px_80px] gap-2 items-center px-3 py-2.5 border-t text-sm', isDark ? 'border-slate-800' : 'border-slate-100')}>
                          <div>
                            <p className={cn('font-medium', isDark ? 'text-slate-200' : 'text-slate-700')}>{alloc.assetName}</p>
                            {alloc.refillDate && alloc.refillDate !== refill.date && (
                              <p className="text-[10px] text-amber-500 font-medium">
                                Refilled: {new Date(alloc.refillDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </p>
                            )}
                          </div>
                          <span className="text-right text-slate-500">{fmt(alloc.allocatedLitres)}L</span>
                          <span className="text-right text-emerald-600 font-semibold">{fmt(alloc.actualUsed)}L</span>
                          <span className={cn('text-right font-semibold text-xs', balance > 0 ? 'text-blue-500' : balance < 0 ? 'text-red-500' : 'text-slate-400')}>
                            {balance > 0 ? `+${fmt(balance)}` : fmt(balance)}L
                          </span>
                        </div>
                      );
                    })}
                    <div className={cn('grid grid-cols-[1fr_90px_90px_80px] gap-2 px-3 py-2 border-t font-bold text-sm', isDark ? 'bg-slate-800/60 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-700')}>
                      <span className="text-xs text-slate-500 uppercase">Total</span>
                      <span className="text-right">{fmt(totalAlloc)}L</span>
                      <span className="text-right text-emerald-600">{fmt(totalActual)}L</span>
                      <span className={cn('text-right text-xs', (totalAlloc - totalActual) > 0 ? 'text-blue-500' : 'text-slate-500')}>
                        {fmt(totalAlloc - totalActual)}L
                      </span>
                    </div>
                  </div>
                  {(refill.supplier || refill.notes) && (
                    <div className="mt-2 flex gap-4">
                      {refill.supplier && <p className="text-xs text-slate-400">Supplier: <span className="font-medium">{refill.supplier}</span></p>}
                      {refill.notes && <p className="text-xs text-slate-400">Note: <span className="font-medium">{refill.notes}</span></p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DieselRefillManager() {
  const { isDark } = useTheme();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { dieselRefills, addDieselRefill, updateDieselRefill, deleteDieselRefill } = useOperations();
  const sites = useAppStore(s => s.sites);

  const canAdd = currentUser?.privileges?.opsDiesel?.canAdd ?? false;
  const canEdit = currentUser?.privileges?.opsDiesel?.canEdit ?? false;
  const canDelete = currentUser?.privileges?.opsDiesel?.canDelete ?? false;

  const [showForm, setShowForm] = useState(false);
  const [editingRefill, setEditingRefill] = useState<DieselRefill | null>(null);
  const [filterSite, setFilterSite] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [view, setView] = useState<'logs' | 'analytics'>('logs');

  useSetPageTitle(
    'Diesel Refill',
    'Track diesel purchases and machine consumption',
    canAdd ? (
      <Button
        onClick={() => { setEditingRefill(null); setShowForm(true); }}
        className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Log Refill
      </Button>
    ) : undefined
  );

  const activeSites = useMemo(() => {
    const siteIds = new Set(dieselRefills.map(r => r.siteId));
    return sites.filter(s => siteIds.has(s.id));
  }, [dieselRefills, sites]);

  const filtered = useMemo(() => {
    return dieselRefills.filter(r => {
      if (filterSite && r.siteId !== filterSite) return false;
      if (filterMonth && !r.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [dieselRefills, filterSite, filterMonth]);

  // Summary stats
  const totalThisMonth = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return dieselRefills.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.totalLitres, 0);
  }, [dieselRefills]);

  const totalSpentThisMonth = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return dieselRefills.filter(r => r.date.startsWith(m) && r.totalCost).reduce((s, r) => s + (r.totalCost || 0), 0);
  }, [dieselRefills]);

  const inp = cn('h-8 rounded-xl border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200');

  return (
    <div className="flex flex-col h-full overflow-y-auto style-scroll p-3 sm:p-4 lg:p-6 gap-4 max-w-5xl mx-auto">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Fuel, label: 'This Month', value: `${fmt(totalThisMonth)}L`, color: 'amber' },
          { icon: Droplets, label: 'Total Cost (Mo)', value: totalSpentThisMonth > 0 ? fmtCurrency(totalSpentThisMonth) : '—', color: 'orange' },
          { icon: Package, label: 'Total Refills', value: dieselRefills.length.toString(), color: 'indigo' },
          { icon: Building2, label: 'Sites Covered', value: new Set(dieselRefills.map(r => r.siteId)).size.toString(), color: 'teal' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={cn('p-3 sm:p-4 rounded-2xl border shadow-sm', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
            <div className={cn(`p-1.5 rounded-lg w-fit mb-2`, `bg-${color}-500/10`)}>
              <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
            </div>
            <p className={cn('text-lg sm:text-xl font-bold', isDark ? 'text-white' : 'text-slate-900')}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className={inp}>
          <option value="">All Sites</option>
          {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className={inp}
        />
        {(filterSite || filterMonth) && (
          <button onClick={() => { setFilterSite(''); setFilterMonth(''); }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setView('logs')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            view === 'logs' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <List className="w-4 h-4" /> Refill Logs
        </button>
        <button
          onClick={() => setView('analytics')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            view === 'analytics' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <BarChart3 className="w-4 h-4" /> Machine Analytics
        </button>
      </div>

      {/* Refill Form (inline) */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <RefillForm
              editing={editingRefill}
              onClose={() => { setShowForm(false); setEditingRefill(null); }}
              onSave={async (data) => {
                if (editingRefill) {
                  await updateDieselRefill(editingRefill.id, data);
                } else {
                  await addDieselRefill(data);
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {view === 'logs' ? (
        filtered.length === 0 ? (
          <div className={cn('flex flex-col items-center justify-center py-16 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
            <div className="p-4 rounded-2xl bg-amber-500/10 mb-3">
              <Fuel className="w-8 h-8 text-amber-500" />
            </div>
            <p className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>No diesel refills yet</p>
            <p className="text-sm text-slate-500 mt-1">
              {canAdd ? 'Click "Log Refill" to record a purchase' : 'No refill records found'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {filtered.map(refill => (
                <RefillCard
                  key={refill.id}
                  refill={refill}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={() => { setEditingRefill(refill); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  onDelete={async () => {
                    if (confirm(`Delete refill of ${fmt(refill.totalLitres)}L for ${refill.siteName}?`)) {
                      await deleteDieselRefill(refill.id);
                    }
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )
      ) : (
        <MachineAnalyticsView refills={filtered} />
      )}
    </div>
  );
}

// ── Machine Analytics View ──────────────────────────────────────────────────
function MachineAnalyticsView({ refills }: { refills: DieselRefill[] }) {
  const { isDark } = useTheme();
  const { dailyMachineLogs } = useOperations();
  const sites = useAppStore(s => s.sites);

  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null);

  const activeSites = useMemo(() => {
    const set = new Set<string>();
    refills.forEach(r => set.add(r.siteId));
    dailyMachineLogs.forEach(l => { if ((l.dieselUsage || 0) > 0) set.add(l.siteId); });
    return sites.filter(s => set.has(s.id));
  }, [refills, dailyMachineLogs, sites]);

  const analyticsByMachine = useMemo(() => {
    const machineMap = new Map<string, any>();
    
    // First, gather all relevant history entries from refills
    refills.forEach(r => {
      if (selectedSiteId !== 'all' && r.siteId !== selectedSiteId) return;

      r.machineAllocations.forEach(a => {
        const dateStr = a.refillDate || r.date;
        if (dateFrom && dateStr < dateFrom) return;
        if (dateTo && dateStr > dateTo) return;

        if (!machineMap.has(a.assetId)) {
          machineMap.set(a.assetId, {
            assetId: a.assetId,
            assetName: a.assetName,
            activeDays: 0,
            historyMap: new Map(),
          });
        }
        const m = machineMap.get(a.assetId);
        if (!m.historyMap.has(dateStr)) {
            m.historyMap.set(dateStr, { 
                date: dateStr, 
                siteName: r.siteName, 
                allocated: 0, 
                used: 0,
                hasRefillRecord: true 
            });
        } else {
            m.historyMap.get(dateStr).hasRefillRecord = true;
        }
        m.historyMap.get(dateStr).allocated += (a.allocatedLitres || 0);
      });
    });

    // Next, process daily logs
    dailyMachineLogs.forEach(l => {
      if (selectedSiteId !== 'all' && l.siteId !== selectedSiteId) return;
      
      const inDateRange = (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo);
      const isUsage = (l.dieselUsage || 0) > 0;
      
      // Calculate active days for average even if no usage on that day, 
      // but only within date range if specified.
      const isActiveDay = inDateRange && (l.operationalDay === 'full' || l.operationalDay === 'half' || (!l.operationalDay && l.isActive));

      if (isUsage || isActiveDay) {
        if (!machineMap.has(l.assetId)) {
          machineMap.set(l.assetId, {
            assetId: l.assetId,
            assetName: l.assetName,
            activeDays: 0,
            historyMap: new Map(),
          });
        }
        const m = machineMap.get(l.assetId);

        if (isUsage && inDateRange) {
            const dateStr = l.date;
            if (!m.historyMap.has(dateStr)) {
                // No refill record exists! Auto-set allocated (bought) as used (dieselUsage)
                m.historyMap.set(dateStr, { 
                    date: dateStr, 
                    siteName: l.siteName || '', 
                    allocated: l.dieselUsage || 0,
                    used: l.dieselUsage || 0,
                    hasRefillRecord: false 
                });
            } else {
                const histEntry = m.historyMap.get(dateStr);
                histEntry.used += (l.dieselUsage || 0);
                // If it doesn't have an actual refill record, keep allocated in sync with used
                if (!histEntry.hasRefillRecord) {
                    histEntry.allocated = histEntry.used;
                }
            }
        }
      }
    });

    // Now, calculate the average usage based on active days within the refill/usage range
    return Array.from(machineMap.values())
      .map(m => {
        const history: any[] = Array.from(m.historyMap.values()).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Find the date range of refills/usages for this machine
        // These are dates where there is either a refill or a daily log with usage
        const trackedDates = history
          .filter((h: any) => h.allocated > 0 || h.used > 0)
          .map((h: any) => h.date);

        let activeDaysCount = 0;

        if (trackedDates.length > 0) {
          const minDate = trackedDates.reduce((min, d) => d < min ? d : min, trackedDates[0]);
          const maxDate = trackedDates.reduce((max, d) => d > max ? d : max, trackedDates[0]);

          // Count active days specifically inbetween the refill/usage range [minDate, maxDate]
          dailyMachineLogs.forEach(l => {
            if (l.assetId === m.assetId) {
              if (selectedSiteId !== 'all' && l.siteId !== selectedSiteId) return;
              const inDateRange = (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo);
              if (inDateRange && l.date >= minDate && l.date <= maxDate) {
                const isActiveDay = l.operationalDay === 'full' || l.operationalDay === 'half' || (!l.operationalDay && l.isActive);
                if (isActiveDay) {
                  activeDaysCount += 1;
                }
              }
            }
          });
        }

        const totalAllocated = history.reduce((sum: number, h: any) => sum + h.allocated, 0);
        const totalUsed = history.reduce((sum: number, h: any) => sum + h.used, 0);
        const avgUsage = activeDaysCount > 0 ? (totalUsed / activeDaysCount) : 0;
        
        // Calculate cumulative balance for history items (oldest to newest)
        let currentBalance = 0;
        const historyAsc = [...history].reverse();
        const historyWithBal = historyAsc.map((h: any) => {
            currentBalance += (h.allocated - h.used);
            return { ...h, cumulativeBalance: currentBalance };
        }).reverse();

        return {
          ...m,
          activeDays: activeDaysCount,
          totalAllocated,
          totalUsed,
          balance: totalAllocated - totalUsed,
          avgUsage,
          history: historyWithBal
        };
      })
      .filter(m => m.history.length > 0) // Only show machines with actual history
      .sort((a, b) => b.totalUsed - a.totalUsed); // Sort by highest usage first

  }, [refills, dailyMachineLogs, selectedSiteId, dateFrom, dateTo]);

  const inp = cn('h-9 rounded-xl border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200');

  if (analyticsByMachine.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Render Filters First Even If Empty */}
        <div className={cn('p-4 rounded-2xl border flex flex-wrap gap-3 items-center', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-2 mr-auto">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Gauge className="w-5 h-5 text-amber-500 shrink-0" />
            </div>
            <h3 className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-slate-900')}>Machine Analytics</h3>
          </div>
          <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)} className={inp}>
            <option value="all">All Sites</option>
            {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} title="From Date" />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} title="To Date" />
          </div>
          {(dateFrom || dateTo || selectedSiteId !== 'all') && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedSiteId('all'); }} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          )}
        </div>

        <div className={cn('flex flex-col items-center justify-center py-16 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
          <div className="p-4 rounded-2xl bg-slate-500/10 mb-3">
            <BarChart3 className="w-8 h-8 text-slate-500" />
          </div>
          <p className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>No machine analytics</p>
          <p className="text-sm text-slate-500 mt-1">Adjust your filters or record diesel refills to see analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className={cn('p-4 rounded-2xl border flex flex-wrap gap-3 items-center', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
        <div className="flex items-center gap-2 mr-auto">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Gauge className="w-5 h-5 text-amber-500 shrink-0" />
          </div>
          <h3 className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-slate-900')}>Machine Analytics</h3>
        </div>
        <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)} className={inp}>
          <option value="all">All Sites</option>
          {activeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} title="From Date" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} title="To Date" />
        </div>
        {(dateFrom || dateTo || selectedSiteId !== 'all') && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedSiteId('all'); }} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {analyticsByMachine.map(machine => {
          const isExpanded = expandedMachine === machine.assetId;
          const toggle = () => setExpandedMachine(isExpanded ? null : machine.assetId);
          
          return (
            <motion.div
              key={machine.assetId}
              layout
              className={cn('rounded-2xl border shadow-sm overflow-hidden transition-colors', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}
            >
              {/* Header */}
              <div onClick={toggle} className="cursor-pointer p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl shrink-0', isDark ? 'bg-indigo-500/10' : 'bg-indigo-50')}>
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className={cn('font-bold text-base', isDark ? 'text-white' : 'text-slate-900')}>{machine.assetName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{machine.history.length} record{machine.history.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4 flex-1 md:justify-end">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bought</span>
                    <span className={cn('font-semibold text-sm', isDark ? 'text-blue-400' : 'text-blue-600')}>{fmt(machine.totalAllocated)}L</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Used</span>
                    <span className={cn('font-semibold text-sm', isDark ? 'text-emerald-400' : 'text-emerald-600')}>{fmt(machine.totalUsed)}L</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Left (Bal)</span>
                    <span className={cn('font-semibold text-sm', machine.balance > 0 ? 'text-blue-500' : machine.balance < 0 ? 'text-red-500' : 'text-slate-500')}>
                      {machine.balance > 0 ? `+${fmt(machine.balance)}` : fmt(machine.balance)}L
                    </span>
                  </div>
                  <div className={cn('ml-2 px-3 py-1.5 rounded-xl border flex items-center gap-1.5', isDark ? 'bg-amber-950/30 border-amber-900/50' : 'bg-amber-50 border-amber-200')}>
                     <Gauge className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                     <div className="flex flex-col text-left">
                        <span className={cn('text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5', isDark ? 'text-amber-500/70' : 'text-amber-700/70')}>Avg Usage</span>
                        <span className={cn('text-xs font-black leading-none', isDark ? 'text-amber-400' : 'text-amber-700')}>{fmt(machine.avgUsage)}L/d</span>
                     </div>
                  </div>
                  <button className="ml-2 p-1.5 text-slate-400 shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={cn('border-t', isDark ? 'border-slate-800' : 'border-slate-100')}>
                      <div className="overflow-x-auto max-h-[400px] style-scroll">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                          <thead className={cn('text-xs uppercase tracking-wider sticky top-0 z-10', isDark ? 'bg-slate-800/90 backdrop-blur-sm text-slate-400' : 'bg-slate-50/90 backdrop-blur-sm text-slate-500')}>
                            <tr>
                              <th className="px-6 py-3 font-bold">Date</th>
                              <th className="px-6 py-3 font-bold">Site</th>
                              <th className="px-6 py-3 font-bold text-right">Bought (L)</th>
                              <th className="px-6 py-3 font-bold text-right">Used (L)</th>
                              <th className="px-6 py-3 font-bold text-right">Record Bal</th>
                              <th className="px-6 py-3 font-bold text-right text-indigo-500">Cumulative Bal</th>
                            </tr>
                          </thead>
                          <tbody className={cn('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                            {machine.history.map((h: any, i: number) => {
                              const recBal = h.allocated - h.used;
                              return (
                                <tr key={i} className={cn('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                                  <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{h.siteName}</td>
                                  <td className="px-6 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                    {h.allocated > 0 ? `${fmt(h.allocated)}L` : '—'}
                                  </td>
                                  <td className="px-6 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                    {h.used > 0 ? `${fmt(h.used)}L` : '—'}
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    <span className={cn('text-xs font-medium', recBal > 0 ? 'text-blue-500' : recBal < 0 ? 'text-red-500' : 'text-slate-400')}>
                                      {recBal > 0 ? `+${fmt(recBal)}` : fmt(recBal)}L
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    <span className={cn('font-bold', h.cumulativeBalance > 0 ? 'text-indigo-500 dark:text-indigo-400' : h.cumulativeBalance < 0 ? 'text-red-500' : 'text-slate-400')}>
                                      {h.cumulativeBalance > 0 ? `+${fmt(h.cumulativeBalance)}` : fmt(h.cumulativeBalance)}L
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

