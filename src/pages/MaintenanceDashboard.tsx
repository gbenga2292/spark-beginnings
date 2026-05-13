import React, { useState, useMemo } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { BarChart3, Clock, AlertCircle, CheckCircle2, Info, Package, DollarSign, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export function MaintenanceDashboard() {
  const { maintenanceSessions, maintenanceAssets } = useOperations();
  const { isDark } = useTheme();
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const filteredSessions = useMemo(() => {
    return maintenanceSessions.filter(s => {
      if (period === 'all') return true;
      const d = new Date(s.date);
      if (period === 'month') {
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }
      if (period === 'year') {
        return d.getFullYear() === selectedYear;
      }
      return true;
    });
  }, [maintenanceSessions, period, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const totalMachines = maintenanceAssets.filter(a => a.category === 'machine').length;
    const totalVehicles = maintenanceAssets.filter(a => a.category === 'vehicle').length;
    
    let dueSoon = 0;
    let overdue = 0;
    let ok = 0;
    
    maintenanceAssets.forEach(a => {
      if (a.status === 'due_soon') dueSoon++;
      else if (a.status === 'overdue') overdue++;
      else ok++;
    });

    const periodCost = filteredSessions.reduce((acc, s) => acc + s.assets.reduce((a, ast) => a + (ast.cost || 0), 0), 0);
    const unscheduled = filteredSessions.filter(s => s.type === 'repair' || s.type === 'emergency').length;
    const shutdowns = filteredSessions.reduce((acc, s) => acc + s.assets.filter(a => a.shutdown).length, 0);

    return {
      totalMachines, totalVehicles, totalActive: totalMachines + totalVehicles,
      dueSoon, overdue, ok,
      periodCost, unscheduled, shutdowns
    };
  }, [maintenanceAssets, filteredSessions]);

  const topCostingMachines = useMemo(() => {
    const costs: Record<string, number> = {};
    const names: Record<string, string> = {};
    filteredSessions.forEach(s => {
      s.assets.forEach(a => {
        costs[a.assetId] = (costs[a.assetId] || 0) + (a.cost || 0);
        names[a.assetId] = a.assetName;
      });
    });
    return Object.entries(costs)
      .map(([id, cost]) => ({ name: names[id], cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [filteredSessions]);

  const topPartsUsed = useMemo(() => {
    const partsCount: Record<string, number> = {};
    const partsName: Record<string, string> = {};
    filteredSessions.forEach(s => {
      s.assets.forEach(a => {
        a.parts?.forEach(p => {
          partsCount[p.id] = (partsCount[p.id] || 0) + (p.quantity || 1);
          partsName[p.id] = p.name;
        });
      });
    });
    return Object.entries(partsCount)
      .map(([id, count]) => ({ name: partsName[id], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredSessions]);

  const mainStats = [
    { label: 'Total Equipment', value: stats.totalMachines + stats.totalVehicles, sub: `${stats.totalActive} active`, icon: BarChart3, color: 'text-blue-600' },
    { label: 'Due Soon', value: stats.dueSoon, sub: 'Next 14 days', icon: Clock, color: 'text-amber-500' },
    { label: 'Overdue', value: stats.overdue, sub: 'Requires attention', icon: AlertCircle, color: 'text-rose-500' },
    { label: period === 'all' ? 'Total Cost' : period === 'year' ? 'This Year' : 'This Month', value: `₦${stats.periodCost.toLocaleString()}`, sub: 'Maintenance cost', icon: DollarSign, color: 'text-emerald-600' },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between w-full overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {period !== 'all' && (
            <>
              {period === 'month' && (
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="h-8 sm:h-[34px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-semibold px-2 sm:px-3 outline-none text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {Array.from({ length: 12 }).map((_, i) => {
                    const d = new Date(); d.setMonth(i);
                    return <option key={i} value={i}>{d.toLocaleString('default', { month: 'short' })}</option>;
                  })}
                </select>
              )}
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-8 sm:h-[34px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-semibold px-2 sm:px-3 outline-none text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </>
          )}
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 ml-2">
          {(['month', 'year', 'all'] as const).map(r => (
            <button key={r} onClick={() => setPeriod(r)}
              className={cn(
                'px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-md text-[10px] sm:text-[11px] font-bold uppercase transition-all',
                period === r ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              )}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {mainStats.map((stat, i) => (
          <Card key={i} className={cn(
            "rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md",
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className={cn("text-2xl sm:text-3xl font-bold mt-1", stat.color)}>{stat.value}</h3>
                  <p className="text-xs font-medium mt-1 text-slate-400">{stat.sub}</p>
                </div>
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800/50", stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Highest Costing Machines Chart */}
        <Card className={cn("rounded-xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
          <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Highest Costing Machines
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <div className="h-[250px]">
              {topCostingMachines.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCostingMachines} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₦${v >= 1000 ? (v/1000)+'k' : v}`} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={100} />
                    <Tooltip
                      cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                      contentStyle={{ borderRadius: '10px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, backgroundColor: isDark ? '#0f172a' : '#fff', fontSize: '12px', fontWeight: 600 }}
                      formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Cost']}
                    />
                    <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm font-medium text-slate-400">
                  No cost data for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Most Used Parts */}
        <Card className={cn("rounded-xl border shadow-sm", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
          <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              Most Used Parts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <div className="h-auto min-h-[250px] flex flex-col sm:flex-row items-center gap-6 sm:gap-0 pt-2 sm:pt-0">
              {topPartsUsed.length > 0 ? (
                <>
                  <div className="w-full sm:flex-1 h-[200px] sm:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={topPartsUsed} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count">
                          {topPartsUsed.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '10px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, backgroundColor: isDark ? '#0f172a' : '#fff', fontSize: '12px', fontWeight: 600 }}
                          formatter={(value: number) => [value, 'Quantity']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:flex-1 space-y-3 sm:pl-4">
                    {topPartsUsed.map((part, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[100px]" title={part.name}>{part.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800 dark:text-white">{part.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full text-center text-sm font-medium text-slate-400">
                  No parts used in this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Summary */}
        <Card className={cn("rounded-xl border shadow-sm p-5 sm:p-6", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-5">Period Activity</h3>
          <div className="space-y-4">
            {[
              { label: 'Unscheduled Repairs', value: stats.unscheduled },
              { label: 'Machine Shutdowns', value: stats.shutdowns },
              { label: 'Total Sessions', value: filteredSessions.length },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between group">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 group-hover:text-foreground transition-colors">{item.label}</span>
                <span className={cn(
                  "px-4 py-1 rounded-full text-xs font-bold",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-50 text-slate-600 border border-slate-100"
                )}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className={cn("rounded-xl border shadow-sm p-5 sm:p-6", isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-5">Current Fleet Status</h3>
          <div className="space-y-4">
            {[
              { icon: CheckCircle2, label: 'OK (Active & Maintained)', color: 'text-emerald-500', value: stats.ok },
              { icon: Clock, label: 'Due Soon (Next 14 Days)', color: 'text-amber-500', value: stats.dueSoon },
              { icon: AlertCircle, label: 'Overdue (Action Required)', color: 'text-rose-500', value: stats.overdue },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className={cn("h-4 w-4", item.color)} />
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                )}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
