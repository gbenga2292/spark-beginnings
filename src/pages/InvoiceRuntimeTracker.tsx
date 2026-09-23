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
  const { maintenanceAssets, dailyMachineLogs: allMachineLogs, sitePumpDates } = useOperations();
  const [expanded, setExpanded] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const linkedIds: string[] = invoice.linkedAssetIds ?? [];
  const invoiceDuration = invoice.duration ?? 0;
  const invoiceStartDate = invoice.date ?? '';

  const isAuxOnly = (Number(invoice.noOfMachine || 0) === 0) && (invoice.auxiliaryEquipment?.length || 0) > 0;
  const auxNames = useMemo(() => 
    (invoice.auxiliaryEquipment || []).map(a => (a.name || '').trim().toLowerCase()).filter(Boolean)
  , [invoice.auxiliaryEquipment]);

  const invoiceSiteName = (invoice.siteName || (invoice as any).site || '').trim().toLowerCase();
  const invoiceSiteId = (invoice.siteId || '').trim().toLowerCase();

  /** All effective linked machine IDs including automatic successors from machine swaps */
  const effectiveLinkedIds = useMemo(() => {
    const ids = new Set<string>(linkedIds);
    sitePumpDates.forEach(pd => {
      if (pd.replacedAssetId && ids.has(pd.replacedAssetId)) {
        if (!invoice.siteId || pd.siteId === invoice.siteId) {
          ids.add(pd.assetId);
        }
      }
    });

    // If no explicit linked IDs and it's an auxiliary-only invoice, auto-link matching maintenance assets
    if (ids.size === 0 && isAuxOnly && auxNames.length > 0) {
      maintenanceAssets.forEach(a => {
        const aSite = (a.site || '').trim().toLowerCase();
        const matchSite = aSite === invoiceSiteId || aSite === invoiceSiteName ||
          (invoiceSiteName && aSite.includes(invoiceSiteName)) || (invoiceSiteName && invoiceSiteName.includes(aSite));
        if (matchSite) {
          const aName = (a.name || '').toLowerCase();
          if (auxNames.some(aux => aName.includes(aux) || aux.includes(aName))) {
            ids.add(a.id);
          }
        }
      });
    }

    return Array.from(ids);
  }, [linkedIds, sitePumpDates, invoice.siteId, isAuxOnly, auxNames, maintenanceAssets, invoiceSiteId, invoiceSiteName]);

  /** Logs for linked machines, on or after invoice start date, for this site */
  const relevantLogs = useMemo(() => {
    if (!effectiveLinkedIds.length || !invoiceStartDate) return [];
    return allMachineLogs.filter(l => {
      const lSiteId = (l.siteId || '').trim().toLowerCase();
      const lSiteName = (l.siteName || (l as any).site_name || '').trim().toLowerCase();
      const matchSite = (lSiteId && (lSiteId === invoiceSiteId)) ||
        (invoiceSiteName && lSiteName === invoiceSiteName) ||
        (invoiceSiteName && invoiceSiteName.length > 3 && lSiteName.includes(invoiceSiteName)) ||
        (invoiceSiteName && lSiteName.length > 3 && invoiceSiteName.includes(lSiteName));
      if (!matchSite) return false;

      return effectiveLinkedIds.includes(l.assetId) && l.date >= invoiceStartDate;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [allMachineLogs, effectiveLinkedIds, invoiceStartDate, invoiceSiteName, invoiceSiteId]);

  const machineConfigs: any[] = invoice.machineConfigs ?? [];
  const totalContractedDays = useMemo(() => {
    if (isAuxOnly && invoice.auxiliaryEquipment && invoice.auxiliaryEquipment.length > 0) {
      return invoice.auxiliaryEquipment.reduce((sum, c) => {
        const d = parseFloat(String(c.duration ?? 0)) || invoiceDuration;
        return sum + d;
      }, 0);
    }
    if (machineConfigs.length > 0) {
      const firstDur = parseFloat(String(machineConfigs[0]?.duration ?? 0)) || invoiceDuration;
      let total = machineConfigs.reduce((sum, c) => {
        const d = c.sameDurationAsFirst ? firstDur : (parseFloat(String(c.duration ?? 0)) || firstDur || invoiceDuration);
        return sum + d;
      }, 0);
      if (invoice.noOfMachine && invoice.noOfMachine > machineConfigs.length) {
        total += (invoice.noOfMachine - machineConfigs.length) * (firstDur || invoiceDuration);
      }
      return total;
    }
    const count = invoice.noOfMachine || 1;
    return count * invoiceDuration;
  }, [isAuxOnly, invoice.auxiliaryEquipment, machineConfigs, invoice.noOfMachine, invoiceDuration]);

  /** Consumed days = sum of day fractions per log */
  const consumedDays = useMemo(() => {
    return relevantLogs.reduce((acc, l) => acc + dayValue(l), 0);
  }, [relevantLogs]);

  const remainingDays = Math.max(0, totalContractedDays - consumedDays);
  const progressPct = totalContractedDays > 0 ? Math.min(100, (consumedDays / totalContractedDays) * 100) : 0;

  /** Projected end = today + remaining days divided by active machine count */
  const activeMachineCount = Math.max(1, effectiveLinkedIds.length || (invoice.noOfMachine || 1));
  const todayStr = new Date().toISOString().split('T')[0];
  const projectedEndDate = remainingDays > 0 ? addDays(todayStr, Math.ceil(remainingDays / activeMachineCount)) : todayStr;
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
    <div className="border border-blue-100 dark:border-blue-900/40 rounded-xl overflow-hidden bg-blue-50/30 dark:bg-blue-950/20">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Runtime Tracker</span>
          {linkedIds.length > 0 && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-bold px-2 py-0">
              {linkedIds.length} machine{linkedIds.length > 1 ? 's' : ''} linked
            </Badge>
          )}
          {remainingDays === 0 && totalContractedDays > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0">
              COMPLETED
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {linkedIds.length > 0 && totalContractedDays > 0 && (
            <span className="text-xs font-bold text-blue-500 tabular-nums">
              {consumedDays.toFixed(1)} / {totalContractedDays} days
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-blue-100 dark:border-blue-900/30 pt-4">

          {/* No machines linked yet */}
          {linkedIds.length === 0 && (
            <div className="flex flex-col items-center py-6 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Link className="h-5 w-5 text-blue-400" />
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
                        <Button size="sm" variant="ghost" onClick={() => handleToggleLink(m.id)} className="h-6 text-blue-600">Link</Button>
                     </div>
                   ))}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 mt-2"
                onClick={() => setShowLinkPanel(v => !v)}
              >
                {showLinkPanel ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} 
                {showLinkPanel ? "Close Panel" : "Manage Links"}
              </Button>
            </div>
          )}

          {/* Progress section */}
          {linkedIds.length > 0 && totalContractedDays > 0 && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Days Consumed</span>
                  <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">
                    {consumedDays.toFixed(1)} / {totalContractedDays} days ({progressPct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progressPct >= 100 ? "bg-emerald-500" :
                      progressPct >= 70 ? "bg-amber-500" : "bg-blue-500"
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-blue-600">{consumedDays.toFixed(1)}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Used</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-slate-700 dark:text-slate-200">{remainingDays.toFixed(1)}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Remaining</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-slate-700 dark:text-slate-200">{totalContractedDays}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Contracted</p>
                </div>
              </div>

              {/* Site machines list */}
              {siteMachines.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site Machines ({siteMachines.length})</p>
                  <div className="space-y-1">
                    {siteMachines.map((a, idx) => {
                      const machineLogs = relevantLogs.filter(l => l.assetId === a.id);
                      const machineConsumed = machineLogs.reduce((s, l) => s + dayValue(l), 0);
                      const pumpDateRec = (sitePumpDates || []).find(pd => 
                        (!invoice.siteId || pd.siteId === invoice.siteId) && pd.assetId === a.id
                      );
                      const isStopped = Boolean(pumpDateRec?.pumpStopDate);
                      const invoicedCount = invoice.noOfMachine || machineConfigs.length || 1;
                      const hasSwaps = siteMachines.length > invoicedCount || isStopped;
                      const firstDur = parseFloat(String(machineConfigs[0]?.duration ?? 0)) || invoiceDuration;
                      const cfg = !hasSwaps ? machineConfigs[idx] : undefined;
                      const machineDuration = cfg
                        ? (cfg.sameDurationAsFirst ? firstDur : (parseFloat(String(cfg.duration ?? 0)) || firstDur || invoiceDuration))
                        : invoiceDuration;
                      const isOver = machineDuration > 0 && machineConsumed > machineDuration;
                      const overDays = isOver ? machineConsumed - machineDuration : 0;

                      return (
                        <div key={a.id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn("font-medium truncate", isStopped ? "text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-200")}>
                              {a.name}
                            </span>
                            {a.serialNumber && <span className="text-[10px] text-slate-400 ml-1">S/N: {a.serialNumber}</span>}
                            {isStopped && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                                Swapped Out
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                              {hasSwaps 
                                ? `${machineConsumed.toFixed(1)}d logged`
                                : `${machineConsumed.toFixed(1)} / ${machineDuration} days logged`}
                            </span>
                            {isOver && !hasSwaps && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                +{overDays.toFixed(1)}d
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
              className="text-xs font-semibold text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"
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
                            ? "bg-blue-100 text-blue-700 hover:bg-rose-100 hover:text-rose-700"
                            : "bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
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
