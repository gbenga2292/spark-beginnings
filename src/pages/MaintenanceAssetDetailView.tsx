import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { 
  ArrowLeft, Calendar, FileText, 
  Wrench, Activity, Clock, Shield, AlertCircle, 
  TrendingUp, BarChart3, Download, 
  MapPin, Tag, User, DollarSign, Package, History,
  ChevronRight, CheckCircle2, X, Trash2, Award
} from 'lucide-react';
import { MaintenanceAsset, MaintenanceSession, MaintenanceAssetLog } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { useUserStore } from '../store/userStore';
import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent } from '@/src/components/ui/dialog';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { cn } from '@/src/lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';

const MaintenanceDocumentModal = lazy(() => import('@/src/components/maintenance/MaintenanceDocumentModal').then(m => ({ default: m.MaintenanceDocumentModal })));
const MaintenanceCertificateModal = lazy(() => import('@/src/components/maintenance/MaintenanceCertificateModal').then(m => ({ default: m.MaintenanceCertificateModal })));

interface MaintenanceAssetDetailViewProps {
  asset: MaintenanceAsset;
  onBack: () => void;
  onLogService?: () => void;
  onEditService?: (sessionId: string) => void;
}

export function MaintenanceAssetDetailView({ asset, onBack, onLogService, onEditService }: MaintenanceAssetDetailViewProps) {
  const { 
    maintenanceSessions, dailyMachineLogs, vehicleTrips,
    deleteDailyLog, deleteVehicleTripRecord
  } = useOperations();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | 'all'>('1y');
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'maintenance' | 'operational'>('maintenance');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 100;

  const assetSessions = useMemo(() => {
    return maintenanceSessions
      .filter(s => s.assets.some(a => a.assetId === asset.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceSessions, asset.id]);

  const logs: any[] = useMemo(() => {
    return assetSessions.map(s => {
      const assetLog = s.assets.find(a => a.assetId === asset.id);
      return { ...assetLog!, date: s.date, technician: s.technician, type: s.type, generalRemark: s.generalRemark, sessionId: s.id };
    });
  }, [assetSessions, asset.id]);

  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logsPerPage;
    return logs.slice(start, start + logsPerPage);
  }, [logs, logPage]);

  const totalLogPages = Math.ceil(logs.length / logsPerPage);

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
      <span className={cn('hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', statusConfig.color, statusConfig.bg, statusConfig.border)}>
        {statusConfig.label}
      </span>
      <Button size="sm" onClick={onLogService} className="h-8 gap-1.5 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
        <Wrench className="h-3.5 w-3.5" /> Log Service
      </Button>
    </div>
  );

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

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Back & Tabs Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-2 overflow-x-auto scrollbar-hide shrink-0 pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
        <Button variant="outline" size="sm" className="gap-2 h-8 rounded-md font-medium shrink-0 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0">
           <button 
             onClick={() => setActiveTab('maintenance')}
             className={cn("px-3 py-1 rounded-sm text-[11px] sm:text-xs font-bold uppercase transition-all whitespace-nowrap", 
               activeTab === 'maintenance' ? 'bg-background text-blue-600 dark:text-blue-400 font-bold shadow-none' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
             )}
           >
              Maintenance Log
           </button>
           <button 
             onClick={() => setActiveTab('operational')}
             className={cn("px-3 py-1 rounded-sm text-[11px] sm:text-xs font-bold uppercase transition-all whitespace-nowrap",
               activeTab === 'operational' ? 'bg-background text-blue-600 dark:text-blue-400 font-bold shadow-none' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
             )}
           >
              {asset.category === 'machine' ? 'Machine Log' : 'Movement Log'}
           </button>
        </div>
      </div>

      {activeTab === 'maintenance' ? (
        <>
          {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Cost', value: `₦${stats.totalCost.toLocaleString()}`, icon: DollarSign, accent: 'emerald' },
          { label: 'Avg / Session', value: `₦${Math.round(stats.avgCost).toLocaleString()}`, icon: TrendingUp, accent: 'blue' },
          { label: 'Parts Replaced', value: stats.partsCount, icon: Package, accent: 'amber' },
          { label: 'Shutdowns', value: stats.shutdowns, icon: AlertCircle, accent: 'rose' },
        ].map(({ label, value, icon: Icon, accent }, i) => (
          <div key={i} className="flex items-center gap-3 p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-card shadow-none">
            <div className={cn(
              'h-9 w-9 rounded-md flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800',
              accent === 'emerald' && 'bg-emerald-50/60 text-emerald-600 dark:bg-emerald-950/40',
              accent === 'blue' && 'bg-blue-50/60 text-blue-600 dark:bg-blue-950/40',
              accent === 'amber' && 'bg-amber-50/60 text-amber-600 dark:bg-amber-950/40',
              accent === 'rose' && 'bg-rose-50/60 text-rose-600 dark:bg-rose-950/40',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Chart + History */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          
          {/* Cost Trend */}
          <div className="bg-card rounded-md border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Cost Trend</span>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                {(['6m', '1y', 'all'] as const).map(r => (
                  <button key={r} onClick={() => setTimeRange(r)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-sm text-[10px] font-bold uppercase transition-all',
                      timeRange === r ? 'bg-background text-blue-600 dark:text-blue-400 shadow-none' : 'text-slate-400 hover:text-slate-600'
                    )}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
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
                      contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: 'none', padding: '8px 12px', fontSize: '12px' }}
                      labelStyle={{ fontWeight: 700, color: '#475569', marginBottom: '2px' }}
                      itemStyle={{ fontWeight: 600, color: '#2563eb' }}
                    />
                    <Area type="monotone" dataKey="cost" stroke="#2563eb" strokeWidth={2}
                      fillOpacity={1} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Maintenance */}
          <div className="bg-card rounded-md border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Recent Maintenance</span>
                {logs.length > 0 && (
                  <span className="text-[10px] font-bold font-mono tabular-nums text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                    {logs.length} session{logs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {logs.length > 3 && (
                <button onClick={() => setShowLogDialog(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                  View All <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="h-10 w-10 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-xs font-semibold text-slate-400">No maintenance recorded yet</p>
                <Button size="sm" onClick={onLogService}
                  className="mt-1 h-8 gap-1.5 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-none">
                  <Wrench className="h-3.5 w-3.5" /> Log First Service
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.slice(0, 3).map((log, i) => (
                  <LogEntry key={i} log={log} onClick={() => setSelectedLog(log)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Specs */}
        <div className="flex flex-col gap-5">
          <div className="bg-card rounded-md border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Specifications</span>
            </div>
            <div className="p-4 sm:p-5 space-y-2.5">
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
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold font-mono tabular-nums capitalize',
                    highlight
                      ? asset.status === 'overdue' ? 'text-rose-500' : 'text-amber-500'
                      : 'text-slate-800 dark:text-slate-200'
                  )}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-md border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Quick Actions</p>
            <div className="flex flex-col gap-2">
              <Button onClick={onLogService}
                className="w-full h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs gap-2 shadow-none">
                <Wrench className="h-4 w-4" /> Log New Service
              </Button>
              <Button onClick={() => setShowLogDialog(true)}
                variant="outline"
                className="w-full h-9 rounded-md border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs gap-2">
                <History className="h-4 w-4" /> View Full History
              </Button>
              <Button variant="outline"
                className="w-full h-9 rounded-md border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs gap-2"
                onClick={() => setShowDocumentModal(true)}
              >
                <Download className="h-4 w-4" /> Export Report
              </Button>
              <Button variant="outline"
                className="w-full h-9 rounded-md border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/40 dark:text-emerald-400 font-medium text-xs gap-2"
                onClick={() => setShowCertificateModal(true)}
              >
                <Award className="h-4 w-4" /> Generate Certificate
              </Button>
            </div>
          </div>
        </div>
      </div>
        </>
      ) : (
        <div className="bg-card rounded-md border border-slate-200 dark:border-slate-800 shadow-none overflow-hidden flex flex-col">
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" /> 
              {asset.category === 'machine' ? 'Operational History' : 'Trip & Movement History'}
            </h3>
            <span className="text-[10px] font-bold font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-sm">
              {operationalLogs.length} Records
            </span>
          </div>
          
          {operationalLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="h-10 w-10 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3">
                <History className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-400">No logs available</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                When this {asset.category} is logged on sites, its history will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {operationalLogs.map((log: any, idx) => (
                <div key={idx} className="px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {asset.category === 'machine' ? formatDisplayDate(log.date) : formatDisplayDate(log.departure_time)}
                        </span>
                        {asset.category === 'machine' ? (
                          <>
                            <span className="text-[10px] font-bold border px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400">
                              Site: {log.siteName || log.site_name}
                            </span>
                            {log.isActive ? (
                              <span className="text-[10px] font-bold border px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600 border-emerald-100">Active</span>
                            ) : (
                              <span className="text-[10px] font-bold border px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-500 border-slate-200">Inactive</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold border px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-600 border-blue-100">
                              {log.route || 'No Route'}
                            </span>
                            {log.distance && (
                              <span className="text-[10px] font-bold border px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border-slate-200 font-mono tabular-nums">
                                {log.distance} km
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 mt-1.5">
                        {asset.category === 'machine' && log.dieselUsage > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums font-medium text-slate-500">
                            <Activity className="h-3 w-3" /> Diesel: {log.dieselUsage}L
                          </div>
                        )}
                        {asset.category === 'vehicle' && log.fuel_volume > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums font-medium text-slate-500">
                            <Activity className="h-3 w-3" /> Fuel: {log.fuel_volume}L
                          </div>
                        )}
                      </div>
                      
                      {((asset.category === 'machine' && log.issuesOnSite) || (asset.category === 'vehicle' && log.notes)) && (
                        <p className="text-xs text-slate-500 mt-1.5 max-w-lg leading-relaxed">
                          <span className="font-semibold">Notes:</span> {log.issuesOnSite || log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Log History Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-md border border-slate-200 dark:border-slate-800 shadow-xl bg-card">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Maintenance History</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{asset.name} · <span className="font-mono tabular-nums">{logs.length}</span> sessions recorded</p>
            </div>
            <button onClick={() => setShowLogDialog(false)}
              className="h-7 w-7 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <Clock className="h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400 font-medium">No history yet</p>
              </div>
            ) : paginatedLogs.map((log, i) => (
              <LogEntry key={i} log={log} detailed onClick={() => setSelectedLog(log)} />
            ))}
          </div>
          {totalLogPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Showing {((logPage - 1) * logsPerPage) + 1} to {Math.min(logPage * logsPerPage, logs.length)} of {logs.length}
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={logPage === 1}
                  onClick={() => setLogPage(p => Math.max(1, p - 1))}
                  className="h-8 text-xs font-medium rounded-md"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300 bg-background border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md">
                  {logPage} / {totalLogPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={logPage === totalLogPages}
                  onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                  className="h-8 text-xs font-medium rounded-md"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Selected Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-md border border-slate-200 dark:border-slate-800 shadow-xl bg-card">
          {selectedLog && (
            <>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center",
                    selectedLog.type === 'repair' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40' :
                    selectedLog.type === 'routine' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40' :
                    selectedLog.type === 'emergency' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40' :
                    'bg-blue-100 text-blue-600 dark:bg-blue-950/40'
                  )}>
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Maintenance Details</h2>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                      <span className="font-mono tabular-nums">{formatDisplayDate(selectedLog.date)}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className="capitalize">{selectedLog.type}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEditService && selectedLog.sessionId && (
                    <Button 
                      onClick={() => onEditService(selectedLog.sessionId)}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 font-medium text-xs px-3 rounded-md"
                    >
                      <Wrench className="h-3.5 w-3.5" /> Edit Log
                    </Button>
                  )}
                  <button onClick={() => setSelectedLog(null)}
                    className="h-7 w-7 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-md p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Technician</p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-blue-500" />
                      {selectedLog.technician}
                    </p>
                  </div>
                  <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-md p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cost</p>
                    <p className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      ₦{(selectedLog.cost || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-md p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-500" />
                      {selectedLog.location || asset.site}
                    </p>
                  </div>
                  <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-md p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      {selectedLog.shutdown ? (
                        <span className="text-rose-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Shutdown</span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Operational</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(selectedLog.workDone || selectedLog.remark || selectedLog.generalRemark) && (
                    <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-md p-4">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" /> Work Description
                      </h3>
                      {selectedLog.workDone && (
                        <div className="mb-3 last:mb-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Done</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedLog.workDone}</p>
                        </div>
                      )}
                      {selectedLog.remark && (
                        <div className="mb-3 last:mb-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Asset Remark</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedLog.remark}</p>
                        </div>
                      )}
                      {selectedLog.generalRemark && (
                        <div className="last:mb-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Session General Remark</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedLog.generalRemark}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-md p-4">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-400" /> Parts & Consumables Used
                    </h3>
                    {!selectedLog.parts || selectedLog.parts.length === 0 ? (
                      <div className="py-6 flex flex-col items-center justify-center text-center">
                        <Package className="h-7 w-7 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400 font-medium">No parts recorded for this service</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-800 bg-card rounded-md overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="px-3.5 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-500">Part Name</th>
                              <th className="px-3.5 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-500 text-center w-20">Qty</th>
                              <th className="px-3.5 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-500 text-right">Unit Cost</th>
                              <th className="px-3.5 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-500 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                            {selectedLog.parts.map((p: any, idx: number) => {
                              const totalPartCost = p.cost * p.quantity;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="px-3.5 py-2.5 font-sans font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                                  <td className="px-3.5 py-2.5 text-center text-slate-600 dark:text-slate-400">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-sm font-semibold text-xs">
                                      {p.quantity}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right text-slate-600 dark:text-slate-400">₦{p.cost.toLocaleString()}</td>
                                  <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-white">₦{totalPartCost.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                            <tr>
                              <td colSpan={3} className="px-3.5 py-2.5 text-right font-bold font-sans text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider">Total Parts Cost</td>
                              <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                                ₦{selectedLog.parts.reduce((sum: number, p: any) => sum + (p.cost * p.quantity), 0).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {showDocumentModal && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"><div className="rounded-md bg-slate-900/95 text-white px-4 py-2 text-xs">Loading document preview...</div></div>}>
          <MaintenanceDocumentModal
            asset={asset}
            sessions={assetSessions}
            isOpen={showDocumentModal}
            onClose={() => setShowDocumentModal(false)}
          />
        </Suspense>
      )}

      {showCertificateModal && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"><div className="rounded-md bg-slate-900/95 text-white px-4 py-2 text-xs">Loading certificate editor...</div></div>}>
          <MaintenanceCertificateModal
            asset={asset}
            sessions={assetSessions}
            isOpen={showCertificateModal}
            onClose={() => setShowCertificateModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function LogEntry({ log, detailed = false, onClick }: { log: any; detailed?: boolean; onClick?: () => void }) {
  const typeColors: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400',
    repair: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400',
    routine: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400',
    emergency: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400',
  };

  return (
    <div 
      className={cn("px-4 sm:px-6 py-3.5 transition-colors", onClick ? "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 active:bg-slate-100" : "hover:bg-slate-50/60")}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold font-mono tabular-nums text-slate-600 dark:text-slate-400">{new Date(log.date).getDate()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatDisplayDate(log.date)}</span>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0 rounded-sm capitalize', typeColors[log.type] ?? 'bg-slate-50 text-slate-500 border-slate-100')}>
                {log.type}
              </span>
              {log.shutdown && (
                <span className="text-[10px] font-bold uppercase tracking-wider border px-1.5 py-0 rounded-sm bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400">
                  Shutdown
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.technician}</span>
              {log.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{log.location}</span>}
            </div>
            {(detailed || log.workDone) && log.workDone && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md">{log.workDone}</p>
            )}
            {detailed && log.parts?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {log.parts.map((p: any, pi: number) => (
                  <span key={pi} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-2 py-0.5 text-[10px] font-medium font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {p.name} <span className="text-blue-600 dark:text-blue-400">×{p.quantity}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">₦{(log.cost || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
