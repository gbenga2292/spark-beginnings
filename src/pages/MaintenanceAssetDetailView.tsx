import React, { useState, useMemo } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { 
  ArrowLeft, Calendar, FileText, 
  Wrench, Activity, Clock, Shield, AlertCircle, 
  TrendingUp, BarChart3, Download, 
  MapPin, Tag, User, DollarSign, Package, History,
  ChevronRight, CheckCircle2, X
} from 'lucide-react';
import { MaintenanceAsset, MaintenanceSession, MaintenanceAssetLog } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { cn } from '@/src/lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';

interface MaintenanceAssetDetailViewProps {
  asset: MaintenanceAsset;
  onBack: () => void;
  onLogService?: () => void;
}

export function MaintenanceAssetDetailView({ asset, onBack, onLogService }: MaintenanceAssetDetailViewProps) {
  const { maintenanceSessions } = useOperations();
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | 'all'>('1y');
  const [showLogDialog, setShowLogDialog] = useState(false);

  const assetSessions = useMemo(() => {
    return maintenanceSessions
      .filter(s => s.assets.some(a => a.assetId === asset.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceSessions, asset.id]);

  const logs: any[] = useMemo(() => {
    return assetSessions.map(s => {
      const assetLog = s.assets.find(a => a.assetId === asset.id);
      return { ...assetLog!, date: s.date, technician: s.technician, type: s.type };
    });
  }, [assetSessions, asset.id]);

  const stats = useMemo(() => {
    const totalCost = logs.reduce((acc, log) => acc + (Number(log.cost) || 0), 0);
    const avgCost = logs.length > 0 ? totalCost / logs.length : 0;
    const partsCount = logs.reduce((acc, log) => acc + (log.parts?.length || 0), 0);
    const shutdowns = logs.filter(log => log.shutdown).length;
    return { totalCost, avgCost, partsCount, shutdowns };
  }, [logs]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataMap: Record<string, number> = {};
    const now = new Date();
    const monthsToShow = timeRange === '6m' ? 6 : timeRange === '1y' ? 12 : 24;
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} '${d.getFullYear().toString().substring(2)}`;
      dataMap[key] = 0;
    }
    logs.forEach(log => {
      const d = new Date(log.date!);
      const key = `${months[d.getMonth()]} '${d.getFullYear().toString().substring(2)}`;
      if (dataMap[key] !== undefined) dataMap[key] += (Number(log.cost) || 0);
    });
    return Object.entries(dataMap).map(([name, cost]) => ({ name, cost }));
  }, [logs, timeRange]);

  const statusConfig = {
    ok: { label: 'OK', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    due_soon: { label: 'Due Soon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    overdue: { label: 'Overdue', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  }[asset.status] ?? { label: asset.status, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' };

  useSetPageTitle(
    asset.name,
    `${asset.category} · ${asset.site}`,
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-semibold" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>
      <span className={cn('hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', statusConfig.color, statusConfig.bg, statusConfig.border)}>
        {statusConfig.label}
      </span>
      <Button size="sm" onClick={onLogService} className="h-8 gap-1.5 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
        <Wrench className="h-3.5 w-3.5" /> Log Service
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Cost', value: `₦${stats.totalCost.toLocaleString()}`, icon: DollarSign, accent: 'emerald' },
          { label: 'Avg / Session', value: `₦${Math.round(stats.avgCost).toLocaleString()}`, icon: TrendingUp, accent: 'blue' },
          { label: 'Parts Replaced', value: stats.partsCount, icon: Package, accent: 'amber' },
          { label: 'Shutdowns', value: stats.shutdowns, icon: AlertCircle, accent: 'rose' },
        ].map(({ label, value, icon: Icon, accent }, i) => (
          <div key={i} className={cn(
            'flex items-center gap-3 p-4 rounded-xl border bg-white shadow-sm',
            'hover:shadow-md transition-shadow duration-200'
          )}>
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
              accent === 'emerald' && 'bg-emerald-50 text-emerald-600',
              accent === 'blue' && 'bg-blue-50 text-blue-600',
              accent === 'amber' && 'bg-amber-50 text-amber-600',
              accent === 'rose' && 'bg-rose-50 text-rose-600',
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              <p className="text-lg font-bold text-slate-800 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Chart + History */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          
          {/* Cost Trend */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-slate-700">Cost Trend</span>
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                {(['6m', '1y', 'all'] as const).map(r => (
                  <button key={r} onClick={() => setTimeRange(r)}
                    className={cn(
                      'px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all',
                      timeRange === r ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    )}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      tickFormatter={v => `₦${v >= 1000 ? (v/1000)+'k' : v}`} />
                    <Tooltip
                      cursor={{ stroke: '#e2e8f0', strokeWidth: 1.5 }}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0,0,0,0.08)', padding: '10px 14px', fontSize: '12px' }}
                      labelStyle={{ fontWeight: 700, color: '#475569', marginBottom: '2px' }}
                      itemStyle={{ fontWeight: 600, color: '#3b82f6' }}
                    />
                    <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2.5}
                      fillOpacity={1} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Maintenance */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <History className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-sm font-bold text-slate-700">Recent Maintenance</span>
                {logs.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {logs.length} session{logs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {logs.length > 3 && (
                <button onClick={() => setShowLogDialog(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                  View All <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400">No maintenance recorded yet</p>
                <Button size="sm" onClick={onLogService}
                  className="mt-1 h-8 gap-1.5 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  <Wrench className="h-3.5 w-3.5" /> Log First Service
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {logs.slice(0, 3).map((log, i) => (
                  <LogEntry key={i} log={log} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Specs */}
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <span className="text-sm font-bold text-slate-700">Specifications</span>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Category', value: asset.category, icon: Wrench },
                { label: 'Serial No.', value: asset.serialNumber || 'Not Set', icon: Tag },
                { label: 'Site', value: asset.site, icon: MapPin },
                { label: 'Interval', value: `${asset.serviceIntervalMonths} Months`, icon: Clock },
                { label: 'Next Service', value: formatDisplayDate(asset.nextServiceDate), icon: Calendar,
                  highlight: asset.status !== 'ok' },
                { label: 'Pattern', value: asset.pattern, icon: Activity },
                { label: 'Total Records', value: String(asset.totalMaintenanceRecords), icon: History },
              ].map(({ label, value, icon: Icon, highlight }, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                  </div>
                  <span className={cn(
                    'text-xs font-bold capitalize',
                    highlight
                      ? asset.status === 'overdue' ? 'text-rose-500' : 'text-amber-500'
                      : 'text-slate-700'
                  )}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 rounded-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
              <Wrench className="h-28 w-28 text-white" />
            </div>
            <div className="p-5 relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Quick Actions</p>
              <div className="flex flex-col gap-2">
                <Button onClick={onLogService}
                  className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-2">
                  <Wrench className="h-4 w-4" /> Log New Service
                </Button>
                <Button onClick={() => setShowLogDialog(true)}
                  variant="outline"
                  className="w-full h-10 rounded-lg bg-slate-700 border-slate-600 hover:bg-slate-600 text-white font-bold text-xs gap-2">
                  <History className="h-4 w-4" /> View Full History
                </Button>
                <Button variant="outline"
                  className="w-full h-10 rounded-lg bg-slate-700 border-slate-600 hover:bg-slate-600 text-white font-bold text-xs gap-2">
                  <Download className="h-4 w-4" /> Export Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Log History Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-800">Maintenance History</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{asset.name} · {logs.length} sessions recorded</p>
            </div>
            <button onClick={() => setShowLogDialog(false)}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <Clock className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400 font-medium">No history yet</p>
              </div>
            ) : logs.map((log, i) => (
              <LogEntry key={i} log={log} detailed />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogEntry({ log, detailed = false }: { log: any; detailed?: boolean }) {
  const typeColors: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-600 border-blue-100',
    repair: 'bg-rose-50 text-rose-600 border-rose-100',
    routine: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    emergency: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className="px-6 py-4 hover:bg-slate-50/60 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-black text-slate-500">{new Date(log.date).getDate()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">{formatDisplayDate(log.date)}</span>
              <span className={cn('text-[10px] font-bold border px-2 py-0.5 rounded-full capitalize', typeColors[log.type] ?? 'bg-slate-50 text-slate-500 border-slate-100')}>
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
            </div>
            {(detailed || log.workDone) && log.workDone && (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md">{log.workDone}</p>
            )}
            {detailed && log.parts?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {log.parts.map((p: any, pi: number) => (
                  <span key={pi} className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {p.name} <span className="text-blue-500">×{p.quantity}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-slate-800">₦{(log.cost || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
