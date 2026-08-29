import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { 
  ArrowRightLeft, Wrench, Truck, Calendar, 
  CheckCircle2, AlertCircle, Info, Fuel, X
} from 'lucide-react';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useAppStore, Site } from '@/src/store/appStore';
import { getPositionIndex } from '@/src/lib/hierarchy';

interface SwapMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site;
  outgoingMachine: { id: string; name: string };
  onSuccess?: () => void;
}

const SWAP_REASONS = [
  'Routine Maintenance / Service Due',
  'Breakdown / Mechanical Fault',
  'Electrical / Pump Overheating',
  'Capacity / Spec Upgrade',
  'Site Request / Rotation',
  'Other'
] as const;

export function SwapMachineModal({
  isOpen,
  onClose,
  site,
  outgoingMachine,
  onSuccess,
}: SwapMachineModalProps) {
  const { 
    assets, 
    maintenanceAssets, 
    dailyMachineLogs, 
    waybills, 
    vehicles, 
    swapSiteMachine 
  } = useOperations();
  const { employees } = useAppStore();

  const todayStr = new Date().toISOString().split('T')[0];

  const [incomingAssetId, setIncomingAssetId] = useState('');
  const [swapDate, setSwapDate] = useState(todayStr);
  const [swapReason, setSwapReason] = useState<string>(SWAP_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [createWaybills, setCreateWaybills] = useState(true);
  const [linkInvoices, setLinkInvoices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Driver options sorted by driver position
  const driverOptions = useMemo(() => {
    return employees
      .filter(e => e.status === 'Active' || e.status === 'On Leave')
      .sort((a, b) => {
        const aIsDriver = (a.position || '').toLowerCase().includes('driver') ? 1 : 0;
        const bIsDriver = (b.position || '').toLowerCase().includes('driver') ? 1 : 0;
        if (aIsDriver !== bIsDriver) return bIsDriver - aIsDriver;
        const rankA = getPositionIndex(a.position);
        const rankB = getPositionIndex(b.position);
        if (rankA !== rankB) return rankA - rankB;
        return `${a.firstname} ${a.surname}`.localeCompare(`${b.firstname} ${b.surname}`);
      })
      .map(e => `${e.firstname} ${e.surname}`);
  }, [employees]);

  // Outgoing machine stats on this site
  const outgoingStats = useMemo(() => {
    const logs = dailyMachineLogs.filter(l => l.assetId === outgoingMachine.id && l.siteId === site.id);
    const activeDays = logs.reduce((acc, l) => {
      const day = l.operationalDay ?? (l.isActive ? 'full' : 'none');
      return acc + (day === 'full' ? 1 : day === 'half' ? 0.5 : 0);
    }, 0);
    const dieselSum = logs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0);
    const mAsset = maintenanceAssets.find(ma => ma.id === outgoingMachine.id);

    return {
      logCount: logs.length,
      activeDays,
      dieselSum,
      mAsset,
    };
  }, [dailyMachineLogs, outgoingMachine.id, site.id, maintenanceAssets]);

  // Available equipment candidates
  const candidateMachines = useMemo(() => {
    return assets.filter(a => {
      if (a.id === outgoingMachine.id) return false;
      const isMachine = a.type === 'equipment' || a.requiresLogging;
      return isMachine;
    });
  }, [assets, outgoingMachine.id]);

  const selectedIncomingAsset = assets.find(a => a.id === incomingAssetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomingAssetId) {
      setErrorMsg('Please select a replacement machine.');
      return;
    }

    if (!swapDate) {
      setErrorMsg('Please specify the swap date.');
      return;
    }

    const finalReason = swapReason === 'Other' ? (customReason || 'Other') : swapReason;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await swapSiteMachine({
        siteId: site.id,
        siteName: site.name,
        outgoingAssetId: outgoingMachine.id,
        outgoingAssetName: outgoingMachine.name,
        incomingAssetId,
        incomingAssetName: selectedIncomingAsset?.name || 'Replacement Machine',
        swapDate,
        swapReason: finalReason,
        driverName: driverName || undefined,
        vehicleNo: vehicleNo || undefined,
        createWaybills,
        linkInvoices,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during machine swap.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        
        {/* ── Fixed Header with margins ────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-start justify-between gap-4 bg-white dark:bg-slate-900">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              Swap / Replace Machine
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Swap <span className="font-semibold text-slate-700 dark:text-slate-300">{outgoingMachine.name}</span> on <span className="font-semibold text-slate-700 dark:text-slate-300">{site.name}</span> with a replacement machine while preserving complete maintenance and diesel history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable Body with generous padding / margins ───── */}
        <form id="swap-machine-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Outgoing Machine Summary */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outgoing Machine (Demobilizing)</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{outgoingMachine.name}</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-[10px] font-bold px-2 py-0.5">
                Returning
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
              <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <p className="text-[10px] font-medium text-slate-400">Days Logged</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{outgoingStats.logCount}d</p>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <p className="text-[10px] font-medium text-slate-400">Active Pumping</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{outgoingStats.activeDays} days</p>
              </div>
              <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <p className="text-[10px] font-medium text-slate-400">Diesel Used</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{outgoingStats.dieselSum} L</p>
              </div>
            </div>
          </div>

          {/* 2. Replacement Machine Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Incoming Replacement Machine <span className="text-rose-500">*</span>
            </Label>
            <select
              value={incomingAssetId}
              onChange={e => setIncomingAssetId(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
            >
              <option value="">-- Select Replacement Machine --</option>
              {candidateMachines.map(m => {
                const mAsset = maintenanceAssets.find(ma => ma.id === m.id);
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} {mAsset ? `(${mAsset.status.replace('_', ' ')})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Swap Date & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Effective Swap Date <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="date"
                value={swapDate}
                onChange={e => setSwapDate(e.target.value)}
                required
                className="h-10 text-sm rounded-xl shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Reason for Replacement <span className="text-rose-500">*</span>
              </Label>
              <select
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
              >
                {SWAP_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {swapReason === 'Other' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Specify Custom Reason</Label>
              <Input
                type="text"
                placeholder="Describe reason for machine swap..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="h-10 text-sm rounded-xl shadow-sm"
              />
            </div>
          )}

          {/* 4. Logistics (Driver & Vehicle) */}
          <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Logistics & Transportation (Optional)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Assigned Driver</Label>
                <select
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-background border border-border rounded-lg outline-none shadow-sm"
                >
                  <option value="">-- Select Driver --</option>
                  {driverOptions.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Transport Vehicle</Label>
                <select
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-background border border-border rounded-lg outline-none shadow-sm"
                >
                  <option value="">-- Select Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.registration_number || v.name}>
                      {v.name} ({v.registration_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 5. Automation Checkboxes with good margins */}
          <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={createWaybills}
                onChange={e => setCreateWaybills(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 dark:text-slate-200">Auto-generate 2-way Waybills</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Creates an Outbound Dispatch Waybill for the incoming machine and a Return Waybill for the outgoing machine.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={linkInvoices}
                onChange={e => setLinkInvoices(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 dark:text-slate-200">Continue Active Site Invoice Runtime</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Auto-links the replacement machine to active site invoices so runtime tracking continues without interruption.
                </p>
              </div>
            </label>
          </div>
        </form>

        {/* ── Fixed Footer with generous margins and padding ───── */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="swap-machine-form"
            disabled={isSubmitting || !incomingAssetId}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 font-semibold px-5 text-xs shadow-sm"
          >
            {isSubmitting ? (
              <>Processing Swap...</>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4" />
                Execute Machine Swap
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
