import React, { useState, useMemo } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import {
  ArrowLeft, Clock, User, MapPin, Wrench, Package,
  DollarSign, TrendingUp, AlertCircle, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import { MaintenanceAsset } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { cn } from '@/src/lib/utils';

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
  const { maintenanceSessions } = useOperations();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const logs = useMemo(() => {
    return maintenanceSessions
      .filter(s => s.assets.some(a => a.assetId === asset.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(s => {
        const al = s.assets.find(a => a.assetId === asset.id)!;
        return { ...al, date: s.date, technician: s.technician, type: s.type };
      });
  }, [maintenanceSessions, asset.id]);

  const totalCost = logs.reduce((acc, l) => acc + (Number(l.cost) || 0), 0);
  const totalParts = logs.reduce((acc, l) => acc + (l.parts?.length || 0), 0);
  const shutdowns = logs.filter(l => l.shutdown).length;

  useSetPageTitle(
    'Maintenance Log',
    `${asset.name} · All recorded sessions`,
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-semibold" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>
      <Button size="sm" onClick={onLogService}
        className="h-8 gap-1.5 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
        <Wrench className="h-3.5 w-3.5" /> Log New Service
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions', value: logs.length, icon: Clock, accent: 'blue' },
          { label: 'Total Cost', value: `₦${totalCost.toLocaleString()}`, icon: DollarSign, accent: 'emerald' },
          { label: 'Parts Used', value: totalParts, icon: Package, accent: 'amber' },
          { label: 'Shutdowns', value: shutdowns, icon: AlertCircle, accent: 'rose' },
        ].map(({ label, value, icon: Icon, accent }, i) => (
          <div key={i} className="bg-white border border-border/60 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
              accent === 'blue'    && 'bg-blue-50 text-blue-600',
              accent === 'emerald' && 'bg-emerald-50 text-emerald-600',
              accent === 'amber'   && 'bg-amber-50 text-amber-600',
              accent === 'rose'    && 'bg-rose-50 text-rose-600',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              <p className="text-base font-bold text-slate-800 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Log Entries */}
      <div className="bg-white border border-border/60 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">All Sessions</span>
          {logs.length > 0 && (
            <span className="text-xs text-slate-400 font-medium">
              Showing {logs.length} record{logs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
              <Clock className="h-7 w-7 text-slate-200" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-400">No maintenance recorded yet</p>
              <p className="text-xs text-slate-300 mt-1">Click "Log New Service" to add the first record</p>
            </div>
            <Button size="sm" onClick={onLogService}
              className="mt-2 h-9 gap-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
              <Wrench className="h-3.5 w-3.5" /> Log First Service
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map((log, i) => {
              const isExpanded = expandedIdx === i;
              return (
                <div key={i} className="hover:bg-slate-50/50 transition-colors">
                  {/* Row Header */}
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    className="w-full px-6 py-4 flex items-center gap-4 text-left"
                  >
                    {/* Date Badge */}
                    <div className="h-11 w-11 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-black text-slate-700 leading-none">
                        {new Date(log.date).getDate()}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                        {new Date(log.date).toLocaleString('en', { month: 'short' })}
                      </span>
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{formatDisplayDate(log.date)}</span>
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
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.technician}</span>
                        {log.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{log.location}</span>}
                        {log.parts?.length > 0 && (
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{log.parts.length} part{log.parts.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* Cost + Expand */}
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-black text-slate-800">₦{(log.cost || 0).toLocaleString()}</span>
                      <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
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
                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Work Done</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{log.workDone}</p>
                          </div>
                        )}

                        {log.parts?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Parts & Materials</p>
                            <div className="flex flex-wrap gap-2">
                              {log.parts.map((p: any, pi: number) => (
                                <div key={pi} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 shadow-sm">
                                  <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                  <span className="text-xs font-bold text-blue-500">×{p.quantity}</span>
                                  {p.cost > 0 && (
                                    <>
                                      <span className="w-px h-3 bg-slate-100" />
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
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
