import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Calendar, FileText, 
  Wrench, Activity, Clock, Shield, AlertCircle, 
  TrendingUp, BarChart3, Download, Filter, 
  ChevronRight, MapPin, Tag, User, DollarSign, Package, History
} from 'lucide-react';
import { MaintenanceAsset, MaintenanceSession, MaintenanceAssetLog } from '../types/operations';
import { useOperations } from '../contexts/OperationsContext';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { cn } from '@/src/lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line, Legend 
} from 'recharts';

interface MaintenanceAssetDetailViewProps {
  asset: MaintenanceAsset;
  onBack: () => void;
}

export function MaintenanceAssetDetailView({ asset, onBack }: MaintenanceAssetDetailViewProps) {
  const { maintenanceSessions } = useOperations();
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | 'all'>('1y');

  // Filter sessions for this specific asset
  const assetSessions = useMemo(() => {
    return maintenanceSessions
      .filter(s => s.assets.some(a => a.assetId === asset.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceSessions, asset.id]);

  // Aggregate logs specifically for this asset from the sessions
  const logs: MaintenanceAssetLog[] = useMemo(() => {
    return assetSessions.map(s => {
      const assetLog = s.assets.find(a => a.assetId === asset.id);
      return {
        ...assetLog!,
        date: s.date, // Add date from session for easier sorting/filtering
        technician: s.technician,
        type: s.type
      } as any;
    });
  }, [assetSessions, asset.id]);

  // Analytics Calculation
  const stats = useMemo(() => {
    const totalCost = logs.reduce((acc, log) => acc + (log.cost || 0), 0);
    const avgCost = logs.length > 0 ? totalCost / logs.length : 0;
    const partsCount = logs.reduce((acc, log) => acc + (log.parts?.length || 0), 0);
    const shutdowns = logs.filter(log => log.shutdown).length;
    
    return { totalCost, avgCost, partsCount, shutdowns };
  }, [logs]);

  // Chart Data
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataMap: Record<string, number> = {};
    
    const now = new Date();
    const monthsToShow = timeRange === '6m' ? 6 : (timeRange === '1y' ? 12 : 24);
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      dataMap[key] = 0;
    }

    logs.forEach(log => {
      const d = new Date(log.date!);
      const key = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (dataMap[key] !== undefined) {
        dataMap[key] += (log.cost || 0);
      }
    });

    return Object.entries(dataMap).map(([name, cost]) => ({ name, cost }));
  }, [logs, timeRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
      case 'due_soon': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'overdue': return 'text-rose-500 bg-rose-50 border-rose-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">{asset.name}</h1>
              <Badge variant="outline" className={cn("rounded-full px-3 py-0.5 font-bold uppercase text-[10px]", getStatusColor(asset.status))}>
                {asset.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-2 mt-1">
              <Tag className="h-3.5 w-3.5" /> S/N: {asset.serialNumber || 'N/A'} • <MapPin className="h-3.5 w-3.5" /> {asset.site}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold text-xs uppercase tracking-wider text-slate-600 bg-white shadow-sm">
            <Download className="h-4 w-4" /> Export Report
          </Button>
          <Button className="h-10 rounded-xl gap-2 font-bold text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md">
            <Activity className="h-4 w-4" /> Run Diagnosis
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Maintenance Cost', value: `₦${stats.totalCost.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Average Cost / Session', value: `₦${Math.round(stats.avgCost).toLocaleString()}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Parts Replaced', value: stats.partsCount, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Recorded Shutdowns', value: stats.shutdowns, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0", stat.bg, stat.color)}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                <p className="text-xl font-bold text-slate-800">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Analytics Chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 p-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-700">Cost Trend Analysis</CardTitle>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['6m', '1y', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={cn(
                      "px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all",
                      timeRange === r ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      tickFormatter={(val) => `₦${val >= 1000 ? (val/1000) + 'k' : val}`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      labelStyle={{ fontWeight: 800, marginBottom: '4px', fontSize: '12px' }}
                      itemStyle={{ fontWeight: 600, fontSize: '12px' }}
                    />
                    <Bar 
                      dataKey="cost" 
                      fill="#3b82f6" 
                      radius={[6, 6, 0, 0]} 
                      barSize={timeRange === 'all' ? 12 : 24} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Logs List */}
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                  <History className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-700">Maintenance History</CardTitle>
              </div>
            </CardHeader>
            <div className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <div className="p-20 text-center text-slate-300">
                   <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                   <p className="text-sm font-bold">No history recorded yet</p>
                </div>
              ) : logs.map((log, i) => (
                <div key={i} className="p-6 hover:bg-slate-50/50 transition-colors group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                        {new Date(log.date as any).getDate()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800">{formatDisplayDate(log.date!)}</p>
                          <Badge variant="outline" className="text-[10px] font-black uppercase px-2 py-0 h-5 border-slate-200 text-slate-500">
                            {log.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                          <User className="h-3 w-3" /> {log.technician} • <MapPin className="h-3 w-3" /> {log.location || 'On-Site'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800">₦{(log.cost || 0).toLocaleString()}</p>
                      {log.shutdown && (
                        <Badge className="bg-rose-50 text-rose-600 border-rose-100 font-bold text-[9px] uppercase px-1.5 h-4 mt-1">Shutdown</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50/70 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Work Done</p>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">{log.workDone || 'No detailed work description provided.'}</p>
                    </div>
                    
                    {log.parts && log.parts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Parts & Materials</p>
                        <div className="flex flex-wrap gap-2">
                          {log.parts.map((part, pi) => (
                            <div key={pi} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-2 py-1 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-700">{part.name}</span>
                              <span className="text-[10px] font-bold text-blue-500">x{part.quantity}</span>
                              <div className="w-[1px] h-3 bg-slate-100" />
                              <span className="text-[10px] font-bold text-slate-400">₦{part.cost.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log.remark && (
                      <div className="pt-2 border-t border-slate-200/50 mt-2">
                        <p className="text-[10px] font-italic text-slate-400">Note: {log.remark}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Asset Details & Specs */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-6 bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Shield className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-700">Specifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {[
                { label: 'Category', value: asset.category, icon: Wrench },
                { label: 'Serial Number', value: asset.serialNumber || 'Not Set', icon: Tag },
                { label: 'Assigned Site', value: asset.site, icon: MapPin },
                { label: 'Service Interval', value: `${asset.serviceIntervalMonths} Months`, icon: Clock },
                { label: 'Next Due Date', value: formatDisplayDate(asset.nextServiceDate), icon: Calendar, highlight: asset.status !== 'ok' },
                { label: 'Service Pattern', value: asset.pattern, icon: Activity },
                { label: 'Total Records', value: asset.totalMaintenanceRecords, icon: History },
              ].map((spec, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                      <spec.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{spec.label}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-black text-slate-700",
                    spec.highlight && (asset.status === 'overdue' ? 'text-rose-500' : 'text-amber-500')
                  )}>
                    {spec.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-[#1e293b] text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wrench className="h-24 w-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Quick Actions</h4>
              <div className="grid grid-cols-1 gap-3">
                <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider gap-2">
                  <Wrench className="h-4 w-4" /> Schedule Service
                </Button>
                <Button variant="outline" className="w-full h-11 rounded-xl bg-slate-800 border-slate-700 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider gap-2">
                  <FileText className="h-4 w-4" /> Upload Document
                </Button>
                <Button variant="outline" className="w-full h-11 rounded-xl bg-slate-800 border-slate-700 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider gap-2">
                  <User className="h-4 w-4" /> Change Operator
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
