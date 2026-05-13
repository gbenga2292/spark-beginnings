import { useState, useMemo } from 'react';
import {
  Clock, Link, RefreshCw, Calendar, TrendingUp,
  ChevronDown, ChevronUp, X, Plus, Info
} from 'lucide-react';
import { Invoice } from '@/src/store/appStore';
import { DailyMachineLog, OperationalDay } from '@/src/types/operations';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { toast } from 'sonner';
import { useOperations } from '@/src/contexts/OperationsContext';
import { supabase } from '@/src/integrations/supabase/client';

interface InvoiceRuntimeTrackerProps {
  invoice: Invoice;
  onSyncDates: (newDate: string) => void;
}

/** Convert operationalDay to numeric day fraction */
function dayValue(log: DailyMachineLog): number {
  const d = log.operationalDay ?? (log.isActive ? 'full' : 'none');
  if (d === 'full') return 1;
  if (d === 'half') return 0.5;
  return 0;
}

function dayLabel(op?: OperationalDay, isActive?: boolean): string {
  const d = op ?? (isActive ? 'full' : 'none');
  if (d === 'full') return 'Full Day';
  if (d === 'half') return 'Half Day';
  return 'No Day';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function InvoiceRuntimeTracker({ invoice, onSyncDates }: InvoiceRuntimeTrackerProps) {
  const { maintenanceAssets, dailyMachineLogs: allMachineLogs } = useOperations();
  const [expanded, setExpanded] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const linkedIds: string[] = invoice.linkedAssetIds ?? [];
  const invoiceDuration = invoice.duration ?? 0;
  const invoiceStartDate = invoice.date ?? '';

  /** Logs for linked machines, on or after invoice start date */
  const relevantLogs = useMemo(() => {
    if (!linkedIds.length || !invoiceStartDate) return [];
    return allMachineLogs.filter(
      l => linkedIds.includes(l.assetId) && l.date >= invoiceStartDate
    ).sort((a, b) => a.date.localeCompare(b.date));
  }, [allMachineLogs, linkedIds, invoiceStartDate]);

  /** Consumed days = sum of day fractions per log */
  const consumedDays = useMemo(() => {
    return relevantLogs.reduce((acc, l) => acc + dayValue(l), 0);
  }, [relevantLogs]);

  const remainingDays = Math.max(0, invoiceDuration - consumedDays);
  const progressPct = invoiceDuration > 0 ? Math.min(100, (consumedDays / invoiceDuration) * 100) : 0;

  /** Projected end = today + remaining days */
  const todayStr = new Date().toISOString().split('T')[0];
  const projectedEndDate = remainingDays > 0 ? addDays(todayStr, Math.ceil(remainingDays)) : todayStr;
  const newReminderDate = addDays(projectedEndDate, -3);

  const reminderChanged = newReminderDate !== invoice.reminderDate;

  const handleSyncReminder = () => {
    onSyncDates(projectedEndDate);
  };

  /** Toggle a machine linked to this invoice */
  const handleToggleLink = async (assetId: string) => {
    const current = invoice.linkedAssetIds ?? [];
    const updated = current.includes(assetId)
      ? current.filter(id => id !== assetId)
      : [...current, assetId];
    
    // We'll use the supabase client directly for internal link updates to avoid prop drilling updateInvoice
    const { error } = await supabase
      .from('billing_invoices')
      .update({ linked_asset_ids: updated })
      .eq('id', invoice.id);
      
    if (error) {
      toast.error("Failed to link machine: " + error.message);
    } else {
      toast.success("Machine links updated");
      // Note: Ideally we'd trigger a reload in the store here, 
      // but for now the user will see it on next refresh or if Billing handles it.
    }
  };

  // Machines on this invoice's site
  const siteMachines = useMemo(() => {
    const siteName = (invoice.siteName || '').trim().toLowerCase();
    const siteId = (invoice.siteId || '').trim().toLowerCase();
    
    return maintenanceAssets?.filter(a => {
      const aSite = (a.site || '').trim().toLowerCase();
      return aSite === siteName || aSite === siteId;
    }) ?? [];
  }, [maintenanceAssets, invoice.siteName, invoice.siteId]);

  return (
    <div className="border border-indigo-100 dark:border-indigo-900/40 rounded-xl overflow-hidden bg-indigo-50/30 dark:bg-indigo-950/20">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Runtime Tracker</span>
          {linkedIds.length > 0 && (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] font-bold px-2 py-0">
              {linkedIds.length} machine{linkedIds.length > 1 ? 's' : ''} linked
            </Badge>
          )}
          {remainingDays === 0 && invoiceDuration > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0">
              COMPLETED
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {linkedIds.length > 0 && invoiceDuration > 0 && (
            <span className="text-xs font-bold text-indigo-500 tabular-nums">
              {consumedDays.toFixed(1)} / {invoiceDuration} days
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-indigo-400" /> : <ChevronDown className="h-4 w-4 text-indigo-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-indigo-100 dark:border-indigo-900/30 pt-4">

          {/* No machines linked yet */}
          {linkedIds.length === 0 && (
            <div className="flex flex-col items-center py-6 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Link className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No machines linked</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  {siteMachines.length > 0 
                    ? `Found ${siteMachines.length} machines on this site. Link them to start tracking runtime.`
                    : "No machines found assigned to this site in Operations. Link machines manually to track runtime."
                  }
                </p>
              </div>
              
              {siteMachines.length > 0 && !showLinkPanel && (
                <div className="w-full max-w-xs space-y-2 mt-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Machines</p>
                   {siteMachines.slice(0, 3).map(m => (
                     <div key={m.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-xs">
                        <span className="font-medium text-slate-600 truncate">{m.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleToggleLink(m.id)} className="h-6 text-indigo-600">Link</Button>
                     </div>
                   ))}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 mt-2"
                onClick={() => setShowLinkPanel(v => !v)}
              >
                {showLinkPanel ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} 
                {showLinkPanel ? "Close Panel" : "Manage Links"}
              </Button>
            </div>
          )}

          {/* Progress section */}
          {linkedIds.length > 0 && invoiceDuration > 0 && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Days Consumed</span>
                  <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">
                    {consumedDays.toFixed(1)} / {invoiceDuration} days ({progressPct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progressPct >= 100 ? "bg-emerald-500" :
                      progressPct >= 70 ? "bg-amber-500" : "bg-indigo-500"
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-indigo-600">{consumedDays.toFixed(1)}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Used</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-slate-700 dark:text-slate-200">{remainingDays.toFixed(1)}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Remaining</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-slate-700 dark:text-slate-200">{invoiceDuration}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Contracted</p>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Projected End</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatDisplayDate(projectedEndDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Suggested Reminder</span>
                  </div>
                  <span className={cn("text-xs font-bold", reminderChanged ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>
                    {formatDisplayDate(newReminderDate)}
                    {reminderChanged && <span className="ml-1 text-[10px] text-amber-500">(changed)</span>}
                  </span>
                </div>
                {invoice.reminderDate && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Info className="h-3.5 w-3.5" />
                      <span>Current Reminder</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{formatDisplayDate(invoice.reminderDate)}</span>
                  </div>
                )}
              </div>

              {/* Sync button */}
              {reminderChanged && (
                <Button
                  size="sm"
                  className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleSyncReminder}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync Reminder & End Date to Invoice
                </Button>
              )}
            </div>
          )}

          {/* Link panel toggle */}
          {linkedIds.length > 0 && (
            <button
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mt-1"
              onClick={() => setShowLinkPanel(v => !v)}
            >
              <Link className="h-3 w-3" />
              {showLinkPanel ? 'Hide' : 'Manage'} Linked Machines
            </button>
          )}

          {/* Machine link panel */}
          {showLinkPanel && siteMachines.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machines on {invoice.siteName}</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {siteMachines.map(asset => {
                  const isLinked = linkedIds.includes(asset.id);
                  return (
                    <div key={asset.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{asset.name}</span>
                      <button
                        onClick={() => handleToggleLink(asset.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all",
                          isLinked
                            ? "bg-indigo-100 text-indigo-700 hover:bg-rose-100 hover:text-rose-700"
                            : "bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                        )}
                      >
                        {isLinked ? <><X className="h-3 w-3" /> Unlink</> : <><Plus className="h-3 w-3" /> Link</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showLinkPanel && siteMachines.length === 0 && (
            <p className="text-xs text-slate-400 italic">No maintenance assets found for this site.</p>
          )}

          {/* Log breakdown table */}
          {relevantLogs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Log Breakdown</p>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  <span>Date</span>
                  <span>Machine</span>
                  <span className="text-right">Day Type</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                  {relevantLogs.map(log => {
                    const day = log.operationalDay ?? (log.isActive ? 'full' : 'none');
                    return (
                      <div key={log.id} className="grid grid-cols-3 px-3 py-2 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">{formatDisplayDate(log.date)}</span>
                        <span className="text-slate-500 dark:text-slate-400 truncate">{log.assetName}</span>
                        <span className="text-right">
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold",
                            day === 'full' ? "bg-emerald-50 text-emerald-700" :
                            day === 'half' ? "bg-amber-50 text-amber-700" :
                            "bg-rose-50 text-rose-700"
                          )}>
                            {dayLabel(log.operationalDay, log.isActive)}
                            {day !== 'none' && <span className="ml-1 opacity-60">+{dayValue(log)}</span>}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
