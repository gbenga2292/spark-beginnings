import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { BarChart2, Wrench, Activity, Fuel, Clock, AlertCircle } from 'lucide-react';
import { Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';

interface MachineItem {
  id: string;
  name: string;
}

interface SiteMachineAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site;
  machines: MachineItem[];
}

export function SiteMachineAnalyticsModal({ isOpen, onClose, site, machines }: SiteMachineAnalyticsModalProps) {
  const { dailyMachineLogs } = useOperations();

  const siteLogs = useMemo(() =>
    dailyMachineLogs.filter(l => l.siteId === site.id),
    [dailyMachineLogs, site.id]
  );

  const stats = useMemo(() => {
    const totalLogs = siteLogs.length;
    const activeDays = siteLogs.filter(l => l.isActive).length;
    const inactiveDays = totalLogs - activeDays;
    const totalDiesel = siteLogs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0);
    const logsWithIssues = siteLogs.filter(l => l.issuesOnSite && l.issuesOnSite.trim()).length;

    // Per-machine stats
    const machineStats = machines.map(m => {
      const mLogs = siteLogs.filter(l => l.assetId === m.id);
      const active = mLogs.filter(l => l.isActive).length;
      const diesel = mLogs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0);
      const utilisation = mLogs.length > 0 ? Math.round((active / mLogs.length) * 100) : 0;
      return { name: m.name, total: mLogs.length, active, diesel, utilisation };
    }).sort((a, b) => b.total - a.total);

    return { totalLogs, activeDays, inactiveDays, totalDiesel, logsWithIssues, machineStats };
  }, [siteLogs, machines]);

  const kpis = [
    { label: 'Total Log Entries', value: stats.totalLogs, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Active Days', value: stats.activeDays, icon: Wrench, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Total Diesel (L)', value: stats.totalDiesel.toLocaleString(), icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Days with Issues', value: stats.logsWithIssues, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose} fullScreenMobile={true}>
      <DialogContent className="w-full h-[100dvh] max-h-[100dvh] max-w-full sm:max-w-3xl sm:h-auto sm:max-h-[90vh] bg-white dark:bg-slate-950 p-0 border-0 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-500" />
            Machine Analytics — {site.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-slate-950/30">

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
                <div className={`h-9 w-9 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-tight">{kpi.label}</p>
                <p className="text-xl font-black text-slate-800 dark:text-white">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Per-machine breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Per Machine Breakdown</h3>
            </div>
            {stats.machineStats.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No machine log data available for this site yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.machineStats.map((m, i) => (
                  <div key={i} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{m.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{m.total} logs · {m.diesel.toFixed(1)}L diesel</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Utilisation</p>
                        <p className={`text-sm font-bold ${m.utilisation >= 80 ? 'text-emerald-600' : m.utilisation >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>
                          {m.utilisation}%
                        </p>
                      </div>
                      <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.utilisation >= 80 ? 'bg-emerald-500' : m.utilisation >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                          style={{ width: `${m.utilisation}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Issues */}
          {siteLogs.filter(l => l.issuesOnSite?.trim()).length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Recent Issues</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {siteLogs
                  .filter(l => l.issuesOnSite?.trim())
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((log, i) => (
                    <div key={i} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{log.assetName}</p>
                        <span className="text-[10px] text-slate-400">· {new Date(log.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{log.issuesOnSite}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <Button onClick={onClose} variant="outline">Close Analytics</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
