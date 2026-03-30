import { useOperations } from '../contexts/OperationsContext';
import { Package, Truck, ArrowRightLeft, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function Dashboard() {
  const { assets, waybills, getAssetAnalytics } = useOperations();
  const { isDark } = useTheme();
  const stats = getAssetAnalytics();

  useSetPageTitle(
    'Operations Overview',
    'Real-time analytics and activity for inventory, logistics, and site assets'
  );

  const cards = [
    { title: 'Total Assets', value: stats.totalAssets, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { title: 'Active Waybills', value: stats.activeWaybills, icon: Truck, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { title: 'Pending Returns', value: waybills.filter(w => w.type === 'return' && w.status === 'outstanding').length, icon: ArrowRightLeft, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { title: 'Low Stock Alerts', value: assets.filter(a => a.availableQuantity < 5).length, icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {cards.map((card, i) => (
          <div 
            key={i} 
            className={cn(
              "p-5 sm:p-6 rounded-2xl border transition-all hover:shadow-md",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <TrendingUp className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{card.title}</p>
              <h3 className="text-xl sm:text-2xl font-black mt-1 text-slate-900 dark:text-white">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Waybills */}
        <div className={cn(
          "lg:col-span-2 rounded-2xl border overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border border-slate-100"
        )}>
          <div className="px-6 py-5 border-b flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Logistics Activity</h3>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-bold uppercase tracking-wider">View All</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {waybills.slice(0, 5).map((wb) => (
              <div key={wb.id} className="px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={cn(
                    "p-2 sm:p-2.5 rounded-xl flex-shrink-0",
                    wb.type === 'waybill' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                  )}>
                    {wb.type === 'waybill' ? <Truck className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{wb.siteName}</p>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 uppercase tracking-tight truncate">
                       <Clock className="h-3 w-3" /> {new Date(wb.issueDate).toLocaleDateString()} • {wb.driverName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 ml-4">
                  <span className={cn(
                    "hidden sm:inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase border-0",
                    wb.status === 'sent_to_site' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                  )}>
                    {wb.status.replace(/_/g, ' ')}
                  </span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{wb.items.length}</p>
                    <p className="text-[9px] font-bold text-slate-400 mb-0 leading-none">Items</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions / Categories */}
        <div className={cn(
          "rounded-2xl border p-6 border-slate-100",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white"
        )}>
           <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Asset Distribution</h3>
           <div className="space-y-5">
              {Object.entries(stats.categoriesCount).map(([cat, count]) => (
                <div key={cat} className="space-y-2">
                   <div className="flex justify-between text-xs font-bold">
                      <span className="capitalize text-slate-400 uppercase tracking-wider">{cat}</span>
                      <span className="text-slate-900 dark:text-slate-200">{count as number}</span>
                   </div>
                   <div className="h-2 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full" 
                        style={{ width: `${((count as number) / Math.max(stats.totalAssets, 1)) * 100}%` }}
                      ></div>
                   </div>
                </div>
              ))}
           </div>

           <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
              <button className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest border border-slate-100 dark:border-slate-700">
                 <Package className="h-4 w-4" />
                 Register New Asset
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

