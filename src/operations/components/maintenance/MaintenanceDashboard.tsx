import React from 'react';
import { useOperations } from '../../contexts/OperationsContext';
import { 
  Plus, 
  Settings2, 
  Wrench,
  Clock,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  TrendingDown,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

export function MaintenanceDashboard() {
  const { getMaintenanceStats } = useOperations();
  const stats = getMaintenanceStats();

  const mainStats = [
    { label: 'Total Machines', value: stats.totalMachines + stats.totalVehicles, sub: `${stats.totalActive} active`, icon: BarChart3, color: 'text-slate-900', bgColor: 'bg-white' },
    { label: 'Due Soon', value: stats.dueSoon, sub: 'Next 14 days', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-50/50' },
    { label: 'Overdue', value: stats.overdue, sub: 'Requires attention', icon: AlertCircle, color: 'text-rose-500', bgColor: 'bg-rose-50/50' },
    { label: 'This Month', value: '₦0', sub: 'Maintenance cost', icon: Info, color: 'text-slate-900', bgColor: 'bg-white' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStats.map((stat, i) => (
          <Card key={i} className={cn("rounded-3xl border-slate-100 shadow-sm overflow-hidden", stat.bgColor)}>
            <CardContent className="p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className={cn("text-4xl font-black mt-2", stat.color)}>{stat.value}</h3>
                  <p className={cn("text-xs font-bold mt-2", stat.color === 'text-slate-900' ? 'text-slate-400' : stat.color)}>{stat.sub}</p>
                </div>
                <stat.icon className={cn("h-5 w-5 opacity-20", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activity Summary */}
        <Card className="rounded-3xl border-slate-100 shadow-sm bg-white p-8">
          <h3 className="text-lg font-black text-slate-900 mb-8">This Month's Activity</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Total Downtime</span>
              <div className="flex items-center gap-2">
                <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">0h</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Unscheduled Maintenance</span>
              <div className="flex items-center gap-2">
                <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">0</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className="rounded-3xl border-slate-100 shadow-sm bg-white p-8">
          <h3 className="text-lg font-black text-slate-900 mb-8">Service Status Distribution</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-bold text-slate-500">OK</span>
              </div>
              <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">
                {stats.statusDistribution.ok}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-500">Due Soon</span>
              </div>
              <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">
                {stats.statusDistribution.dueSoon}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <span className="text-sm font-bold text-slate-500">Overdue</span>
              </div>
              <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black text-slate-600">
                {stats.statusDistribution.overdue}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
