import React, { useState, useMemo } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import {
  ArrowLeft, Clock, User, MapPin, Wrench, Package,
  DollarSign, AlertCircle, ChevronDown, ChevronUp,
  Activity, History, Truck, Trash2
} from 'lucide-react';
import { MaintenanceAsset } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { useUserStore } from '../store/userStore';
import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { cn } from '@/src/lib/utils';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { LogMaintenanceForm } from './LogMaintenanceForm';

interface MaintenanceLogViewProps {
  asset: MaintenanceAsset;
  onBack: () => void;
  onLogService?: () => void;
}

const typeColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-600 border-blue-100',
  repair:    'bg-rose-50 text-rose-600 border-rose-100',
  routine:   'bg-emerald-50 text-emerald-600 border-emerald-100',
  emergency: 'bg-amber-50 text-amber-600 border-amber-100',
};

export function MaintenanceLogView({ asset, onBack, onLogService }: MaintenanceLogViewProps) {
  const { 
    maintenanceSessions, dailyMachineLogs, vehicleTrips, 
    deleteDailyLog, deleteVehicleTripRecord 
  } = useOperations();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'maintenance' | 'operational'>('maintenance');

  const logs = useMemo(() => {
    return maintenanceSessions
      .filter(s => s.assets.some(a => a.assetId === asset.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(s => {
        const al = s.assets.find(a => a.assetId === asset.id)!;
        return { ...al, date: s.date, technician: s.technician, type: s.type, sessionId: s.id };
      });
  }, [maintenanceSessions, asset.id]);

  const operationalLogs = useMemo(() => {
    if (asset.category === 'machine') {
      return dailyMachineLogs
        .filter(log => log.assetId === asset.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      return vehicleTrips
        .filter(trip => trip.vehicle_id === asset.id)
        .sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime());
    }
  }, [asset.id, asset.category, dailyMachineLogs, vehicleTrips]);

  const totalCost = logs.reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  const totalParts = logs.reduce((acc, l) => acc + (l.parts?.length || 0), 0);
  const shutdowns = logs.filter(l => l.shutdown).length;

  // Only "Log New Service" lives in the system header
  useSetPageTitle(
    'Maintenance Log',
    `${asset.name} · All recorded sessions`,
    <Button size="sm" onClick={onLogService}
      className="h-8 gap-1.5 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
      <Wrench className="h-3.5 w-3.5" /> Log New Service
    </Button>
  );

  const operationalTabLabel = asset.category === 'machine' ? 'Machine Log' : 'Movement Log';

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── Back button + Tab switcher (top of page) ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-0 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-9 rounded-xl font-bold shrink-0 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex gap-8 px-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('maintenance')}
            className={cn(
              'pb-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2',
              activeTab === 'maintenance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            )}
          >
            <Wrench className="h-4 w-4" />
            <span>Maintenance Log</span>
          </button>
          <button
            onClick={() => setActiveTab('operational')}
            className={cn(
              'pb-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2',
              activeTab === 'operational'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            )}
          >
            {asset.category === 'machine' ? <Activity className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            <span>{operationalTabLabel}</span>
          </button>
        </div>
      </div>

      {/* ── TAB: Maintenance Log ── */}
      {activeTab === 'maintenance' && (
        <>
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Sessions', value: logs.length,                            icon: Clock,         accent: 'blue'    },
              { label: 'Total Cost',     value: `₦${totalCost.toLocaleString()}`,        icon: DollarSign,    accent: 'emerald' },
              { label: 'Parts Used',     value: totalParts,                              icon: Package,       accent: 'amber'   },
              { label: 'Shutdowns',      value: shutdowns,                               icon: AlertCircle,   accent: 'rose'    },
            ].map(({ label, value, icon: Icon, accent }, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-border/60 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                  accent === 'blue'    && 'bg-blue-50    text-blue-600',
                  accent === 'emerald' && 'bg-emerald-50 text-emerald-600',
                  accent === 'amber'   && 'bg-amber-50   text-amber-600',
                  accent === 'rose'    && 'bg-rose-50    text-rose-600',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Log Entries */}
          <div className="bg-white dark:bg-slate-900 border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">All Sessions</span>
              {logs.length > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  Showing {logs.length} record{logs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                  <Clock className="h-7 w-7 text-slate-200 dark:text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-400">No maintenance recorded yet</p>
                  <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Click "Log New Service" to add the first record</p>
                </div>
                <Button size="sm" onClick={onLogService}
                  className="mt-2 h-9 gap-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
                  <Wrench className="h-3.5 w-3.5" /> Log First Service
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {logs.map((log, i) => {
                  const isExpanded = expandedIdx === i;
                  return (
                    <div key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Row Header */}
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        className="w-full px-6 py-4 flex items-center gap-4 text-left"
                      >
                        {/* Date Badge */}
                        <div className="h-11 w-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">
                            {new Date(log.date).getDate()}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                            {new Date(log.date).toLocaleString('en', { month: 'short' })}
                          </span>
                        </div>

                        {/* Main Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatDisplayDate(log.date)}</span>
                            <span className={cn('text-[10px] font-bold border px-2 py-0.5 rounded-full capitalize',
                              typeColors[log.type] ?? 'bg-slate-50 text-slate-500 border-slate-100')}>
                              {log.type}
                            </span>
                            {log.shutdown && (
                              <span className="text-[10px] font-bold border px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border-rose-100">
                                Shutdown
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-medium flex-wrap">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.technician}</span>
                            {log.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{log.location}</span>}
                            {log.parts?.length > 0 && (
                              <span className="flex items-center gap-1"><Package className="h-3 w-3" />{log.parts.length} part{log.parts.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>

                        {/* Cost + Expand */}
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">₦{(log.cost || 0).toLocaleString()}</span>
                          <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            {isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                              : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            }
                          </div>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-6 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="ml-[60px] space-y-4">
                            {log.workDone && (
                              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Work Done</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{log.workDone}</p>
                              </div>
                            )}

                            {log.parts?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Parts & Materials</p>
                                <div className="flex flex-wrap gap-2">
                                  {log.parts.map((p: any, pi: number) => (
                                    <div key={pi} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 shadow-sm">
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                                      <span className="text-xs font-bold text-blue-500">×{p.quantity}</span>
                                      {p.cost > 0 && (
                                        <>
                                          <span className="w-px h-3 bg-slate-100 dark:bg-slate-700" />
                                          <span className="text-xs font-semibold text-slate-400">₦{p.cost.toLocaleString()}</span>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {log.remark && (
                              <p className="text-xs text-slate-400 italic">Note: {log.remark}</p>
                            )}

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => setEditingSessionId(log.sessionId)}
                              >
                                <Wrench className="h-3.5 w-3.5" /> Edit Full Log
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: Machine Log / Movement Log ── */}
      {activeTab === 'operational' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5">
              <Activity className="h-4 w-4 text-blue-500" />
              {asset.category === 'machine' ? 'Operational History' : 'Trip & Movement History'}
            </h3>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full">
              {operationalLogs.length} Records
            </span>
          </div>

          {operationalLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                <History className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-slate-400">No logs available</p>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                When this {asset.category} is logged on sites, its history will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {operationalLogs.map((log: any, idx) => (
                <div key={idx} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {asset.category === 'machine'
                            ? formatDisplayDate(log.date)
                            : formatDisplayDate(log.departure_time)}
                        </span>

                        {asset.category === 'machine' ? (
                          <>
                            <span className="text-[10px] font-bold border px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border-blue-100">
                              Site: {log.siteName || log.site_name}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold border px-2 py-0.5 rounded-full",
                              (log.operationalDay === 'full' || (!log.operationalDay && log.isActive)) ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              log.operationalDay === 'half' ? "bg-amber-50 text-amber-600 border-amber-100" :
                              "bg-slate-100 text-slate-500 border-slate-200"
                            )}>
                              {log.operationalDay === 'full' ? 'Full Day' : 
                               log.operationalDay === 'half' ? 'Half Day' : 
                               log.operationalDay === 'none' ? 'None' : 
                               (log.isActive ? 'Full Day' : 'None')}
                            </span>
                            {log.dieselUsage > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                <Activity className="h-3 w-3" /> {log.dieselUsage}L Diesel
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold border px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border-blue-100">
                              {log.route || 'No Route'}
                            </span>
                            {log.distance && (
                              <span className="text-[10px] font-bold border px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border-slate-200">
                                {log.distance} km
                              </span>
                            )}
                            {log.fuel_volume > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                <Activity className="h-3 w-3" /> {log.fuel_volume}L Fuel
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {((asset.category === 'machine' && log.issuesOnSite) || (asset.category === 'vehicle' && log.notes)) && (
                        <p className="text-xs text-slate-500 mt-1.5 max-w-lg leading-relaxed">
                          <span className="font-semibold">Notes:</span> {log.issuesOnSite || log.notes}
                        </p>
                      )}
                    </div>

                    {currentUser?.privileges?.operations?.canDeleteLogs && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        onClick={async () => {
                          if (!window.confirm('Are you sure you want to delete this operational log?')) return;
                          try {
                            if (asset.category === 'machine') {
                              await deleteDailyLog(log.id);
                            } else {
                              await deleteVehicleTripRecord(log.id);
                            }
                            toast.success('Log deleted successfully');
                          } catch (err) {
                            toast.error('Failed to delete log');
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Session Dialog */}
      {editingSessionId && (
        <Dialog open={!!editingSessionId} onOpenChange={(o) => !o && setEditingSessionId(null)}>
          <DialogContent className="max-w-5xl p-0 h-[90vh] overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <LogMaintenanceForm
                editSessionId={editingSessionId}
                onSuccess={() => setEditingSessionId(null)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
