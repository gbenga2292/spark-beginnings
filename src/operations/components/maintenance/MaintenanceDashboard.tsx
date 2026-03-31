import React from 'react';
import { useOperations } from '../../contexts/OperationsContext';
import { BarChart3, Clock, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

export function MaintenanceDashboard() {
  const { getMaintenanceStats } = useOperations();
  const { isDark } = useTheme();
  const stats = getMaintenanceStats();

  const mainStats = [
    { label: 'Total Equipment', value: stats.totalMachines + stats.totalVehicles, sub: `${stats.totalActive} active`, icon: BarChart3, color: 'text-teal-600' },
    { label: 'Due Soon', value: stats.dueSoon, sub: 'Next 14 days', icon: Clock, color: 'text-amber-500' },
    { label: 'Overdue', value: stats.overdue, sub: 'Requires attention', icon: AlertCircle, color: 'text-rose-500' },
    { label: 'This Month', value: '₦0', sub: 'Maintenance cost', icon: Info, color: 'text-slate-800 dark:text-white' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {mainStats.map((stat, i) => (
          <Card key={i} className={cn(
            "rounded-xl border shadow-sm overflow-hidden",
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <h3 className={cn("text-2xl sm:text-3xl font-bold mt-1", stat.color)}>{stat.value}</h3>
                  <p className="text-xs font-medium mt-1 text-slate-400">{stat.sub}</p>
                </div>
                <stat.icon className={cn("h-4 w-4 opacity-30", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Summary */}
        <Card className={cn(
          "rounded-xl border shadow-sm p-5 sm:p-6",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-5">This Month's Activity</h3>
          <div className="space-y-4">
            {[
              { label: 'Total Downtime', value: '0h' },
              { label: 'Unscheduled Maintenance', value: '0' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold",
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                )}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className={cn(
          "rounded-xl border shadow-sm p-5 sm:p-6",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-5">Service Status Distribution</h3>
          <div className="space-y-4">
            {[
              { icon: CheckCircle2, label: 'OK', color: 'text-emerald-500', value: stats.statusDistribution.ok },
              { icon: Clock, label: 'Due Soon', color: 'text-amber-500', value: stats.statusDistribution.dueSoon },
              { icon: AlertCircle, label: 'Overdue', color: 'text-rose-500', value: stats.statusDistribution.overdue },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className={cn("h-4 w-4", item.color)} />
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold",
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
