import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Activity, Layers, User, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { ConsumableUsageLog } from '@/src/types/operations';
import { Site } from '@/src/store/appStore';

interface SiteItem {
  assetId: string;
  assetName: string;
  quantity: number;
  unit?: string;
}

interface SiteConsumablesAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site;
  consumables: SiteItem[];
  logs: ConsumableUsageLog[];
}

export function SiteConsumablesAnalyticsModal({ isOpen, onClose, site, consumables, logs }: SiteConsumablesAnalyticsModalProps) {
  
  // Calculate analytics
  const totalLogs = logs.length;
  
  // Top Consumed Items
  const itemUsageMap = logs.reduce((acc, log) => {
    if (!acc[log.assetName]) acc[log.assetName] = 0;
    acc[log.assetName] += log.quantityUsed;
    return acc;
  }, {} as Record<string, number>);
  
  const topItems = Object.entries(itemUsageMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Top Consumers (Employees)
  const consumerMap = logs.reduce((acc, log) => {
    if (!acc[log.usedBy]) acc[log.usedBy] = 0;
    acc[log.usedBy] += 1; // Count by number of times they logged, or could be by quantity but quantity is unit-dependent
    return acc;
  }, {} as Record<string, number>);

  const topConsumers = Object.entries(consumerMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Total current value/quantity sum is less meaningful if units differ, 
  // but we can show how many distinct items we track.
  const totalDistinctItems = consumables.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white dark:bg-slate-950 p-0 border-0 shadow-2xl rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Consumables Analytics - {site.name}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 max-h-[80vh] overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30 space-y-6">
          
          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Total Logs</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{totalLogs}</p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Tracked Items</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{totalDistinctItems}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center shrink-0">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Unique Consumers</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{Object.keys(consumerMap).length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Consumed Items */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Most Consumed Items</h3>
              </div>
              <div className="p-5 flex-1">
                {topItems.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
                ) : (
                  <div className="space-y-4">
                    {topItems.map(([name, qty], index) => {
                      // find unit
                      const unit = consumables.find(c => c.assetName === name)?.unit || 'pcs';
                      // simple progress bar relative to max
                      const maxQty = topItems[0][1];
                      const width = `${Math.max(5, (qty / maxQty) * 100)}%`;
                      
                      return (
                        <div key={name} className="space-y-1.5">
                          <div className="flex justify-between text-sm font-semibold">
                            <span className="text-slate-700 dark:text-slate-300 truncate pr-4">
                              <span className="text-slate-400 text-xs mr-2">#{index + 1}</span> 
                              {name}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 shrink-0">{qty} <span className="text-xs font-normal text-slate-400">{unit}</span></span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Consumers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Most Active Consumers</h3>
                <span className="ml-auto text-xs font-normal text-slate-400">(by log frequency)</span>
              </div>
              <div className="p-5 flex-1">
                {topConsumers.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
                ) : (
                  <div className="space-y-4">
                    {topConsumers.map(([name, count], index) => {
                      const maxCount = topConsumers[0][1];
                      const width = `${Math.max(5, (count / maxCount) * 100)}%`;
                      
                      return (
                        <div key={name} className="space-y-1.5">
                          <div className="flex justify-between text-sm font-semibold">
                            <span className="text-slate-700 dark:text-slate-300 truncate pr-4">
                              <span className="text-slate-400 text-xs mr-2">#{index + 1}</span> 
                              {name}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 shrink-0">{count} <span className="text-xs font-normal text-slate-400">logs</span></span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Recent Consumption Log</h3>
            </div>
            {logs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No logs recorded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3 font-bold">Date</th>
                      <th className="px-5 py-3 font-bold">Item</th>
                      <th className="px-5 py-3 font-bold">Qty</th>
                      <th className="px-5 py-3 font-bold">Used By</th>
                      <th className="px-5 py-3 font-bold">Task</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(log => {
                      const unit = consumables.find(c => c.assetId === log.assetId)?.unit || 'pcs';
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-5 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                            {new Date(log.date).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {log.assetName}
                          </td>
                          <td className="px-5 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                            {log.quantityUsed} <span className="font-normal text-xs text-slate-400">{unit}</span>
                          </td>
                          <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                            {log.usedBy}
                          </td>
                          <td className="px-5 py-3 text-slate-500 truncate max-w-[200px]">
                            {log.usedFor || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button onClick={onClose} variant="outline">Close Analytics</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
