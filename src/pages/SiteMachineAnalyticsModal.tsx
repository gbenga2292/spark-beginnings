import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { BarChart2, Wrench, Activity, Fuel, AlertCircle } from 'lucide-react';
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function SiteMachineAnalyticsModal({ isOpen, onClose, site, machines }: SiteMachineAnalyticsModalProps) {
  const { dailyMachineLogs } = useOperations();

  const [selectedMachineId, setSelectedMachineId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const siteLogs = useMemo(() =>
    dailyMachineLogs.filter(l => l.siteId === site.id),
    [dailyMachineLogs, site.id]
  );

  const availableYears = useMemo(() => {
    const years = new Set(siteLogs.map(l => new Date(l.date).getFullYear().toString()));
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [siteLogs]);

  const filteredLogs = useMemo(() => {
    return siteLogs.filter(l => {
      const d = new Date(l.date);
      const machineMatch = selectedMachineId === 'all' || l.assetId === selectedMachineId;
      const yearMatch = d.getFullYear().toString() === selectedYear;
      const monthMatch = selectedMonth === 'all' || d.getMonth().toString() === selectedMonth;
      return machineMatch && yearMatch && monthMatch;
    });
  }, [siteLogs, selectedMachineId, selectedYear, selectedMonth]);

  const stats = useMemo(() => {
    const totalLogs = filteredLogs.length;
    const activeDays = filteredLogs.filter(l => l.isActive).length;
    const totalDiesel = filteredLogs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0);
    const logsWithIssues = filteredLogs.filter(l => l.issuesOnSite?.trim()).length;

    // Per-machine diesel breakdown (for filtered period)
    const machineList = selectedMachineId === 'all' ? machines : machines.filter(m => m.id === selectedMachineId);
    const machineStats = machineList.map(m => {
      const mLogs = filteredLogs.filter(l => l.assetId === m.id);
      const active = mLogs.filter(l => l.isActive).length;
      const diesel = mLogs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0);
      const utilisation = mLogs.length > 0 ? Math.round((active / mLogs.length) * 100) : 0;
      const halfDays = mLogs.filter(l => l.operationalDay === 'half').length;
      const offDays = mLogs.filter(l => l.operationalDay === 'none' || !l.isActive).length;
      return { name: m.name, total: mLogs.length, active, diesel, utilisation, halfDays, offDays };
    }).sort((a, b) => b.total - a.total);

    // Diesel chart data
    let dieselChartEntries: { label: string; value: number; isAvg?: boolean }[] = [];

    if (selectedMonth === 'all') {
      // 12-month average diesel per day on site
      dieselChartEntries = MONTHS.map((monthName, mIdx) => {
        const mLogs = filteredLogs.filter(l => new Date(l.date).getMonth() === mIdx);
        const avg = mLogs.length > 0
          ? mLogs.reduce((acc, l) => acc + (Number(l.dieselUsage) || 0), 0) / mLogs.length
          : 0;
        return { label: MONTHS[mIdx], value: avg, isAvg: true };
      });
    } else {
      // Per-day within the selected month
      const byDay: Record<string, number> = {};
      filteredLogs.forEach(l => {
        const key = new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        byDay[key] = (byDay[key] || 0) + (Number(l.dieselUsage) || 0);
      });
      dieselChartEntries = Object.entries(byDay)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([label, value]) => ({ label, value }));
    }

    return { totalLogs, activeDays, totalDiesel, logsWithIssues, machineStats, dieselChartEntries };
  }, [filteredLogs, machines, selectedMachineId]);

  const kpis = [
    { label: 'Total Log Entries', value: stats.totalLogs, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Active Days', value: stats.activeDays, icon: Wrench, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Total Diesel (L)', value: stats.totalDiesel.toFixed(1), icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Days with Issues', value: stats.logsWithIssues, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  const dieselChartEntries = stats.dieselChartEntries;
  const maxDiesel = Math.max(...dieselChartEntries.map(e => e.value), 1);

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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
            <select
              value={selectedMachineId}
              onChange={e => setSelectedMachineId(e.target.value)}
              className="h-8 px-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Machines</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="h-8 px-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="h-8 px-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Months</option>
              {MONTHS.map((m, i) => <option key={i} value={i.toString()}>{m}</option>)}
            </select>
            <span className="text-xs text-slate-400 font-medium ml-auto">{stats.totalLogs} log{stats.totalLogs !== 1 ? 's' : ''} in view</span>
          </div>

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

          {/* Diesel chart — always shown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {selectedMonth === 'all'
                    ? `Avg Diesel/Day by Month — ${selectedYear}`
                    : `Daily Diesel Usage — ${MONTHS[Number(selectedMonth)]} ${selectedYear}`}
                </h3>
              </div>
              {selectedMonth === 'all' && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Avg L/day on site</span>
              )}
            </div>
            <div className="h-36 flex items-end gap-1.5 px-1">
              {dieselChartEntries.map((entry, i) => {
                const h = entry.value > 0 ? Math.max(6, (entry.value / maxDiesel) * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                    <div className="relative w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-colors ${
                          entry.value > 0
                            ? 'bg-amber-400 hover:bg-amber-500'
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                        style={{ height: h > 0 ? `${h}%` : '4px' }}
                      />
                      {entry.value > 0 && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {entry.isAvg ? `avg ${entry.value.toFixed(1)}L` : `${entry.value.toFixed(1)}L`}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">{entry.label}</span>
                  </div>
                );
              })}
              {dieselChartEntries.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-xs">No data</div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span>Total: <strong className="text-amber-600">{stats.totalDiesel.toFixed(1)} L</strong></span>
              <span>
                {selectedMonth === 'all' ? 'Peak month:' : 'Avg/day:'}
                <strong className="text-amber-600 ml-1">
                  {selectedMonth === 'all'
                    ? `${dieselChartEntries.reduce((a, b) => a.value > b.value ? a : b, { label: '—', value: 0 }).label}`
                    : `${filteredLogs.length > 0 ? (stats.totalDiesel / filteredLogs.length).toFixed(1) : '0'} L`}
                </strong>
              </span>
            </div>
          </div>

          {/* Per-machine breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Per Machine Breakdown</h3>
            </div>
            {stats.machineStats.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No machine log data available for this selection.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.machineStats.map((m, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                    {/* Day type breakdown */}
                    <div className="mt-3 flex gap-4">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                        {m.active - m.halfDays} Full
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                        {m.halfDays} Half
                      </span>
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">
                        {m.offDays} Off
                      </span>
                      {m.diesel > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full flex items-center gap-1 ml-auto">
                          <Fuel className="h-2.5 w-2.5" /> {m.diesel.toFixed(1)} L
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Issues */}
          {filteredLogs.filter(l => l.issuesOnSite?.trim()).length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Recent Issues</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs
                  .filter(l => l.issuesOnSite?.trim())
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((log, i) => (
                    <div key={i} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{log.assetName}</p>
                        <span className="text-[10px] text-slate-400">· {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
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
