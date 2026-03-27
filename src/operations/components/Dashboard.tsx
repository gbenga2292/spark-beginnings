import { useOperations } from '../contexts/OperationsContext';
import { Package, Truck, ArrowRightLeft, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';

export function Dashboard() {
  const { assets, waybills, getAssetAnalytics } = useOperations();
  const { isDark } = useTheme();
  const stats = getAssetAnalytics();

  const cards = [
    { title: 'Total Assets', value: stats.totalAssets, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { title: 'Active Waybills', value: stats.activeWaybills, icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { title: 'Pending Returns', value: waybills.filter(w => w.type === 'return' && w.status === 'outstanding').length, icon: ArrowRightLeft, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { title: 'Low Stock Alerts', value: assets.filter(a => a.availableQuantity < 5).length, icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div 
            key={i} 
            className={cn(
              "p-6 rounded-2xl border transition-all hover:shadow-md",
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
              <p className="text-sm font-medium text-slate-500 uppercase tracking-tight">{card.title}</p>
              <h3 className="text-2xl font-bold mt-1">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Waybills */}
        <div className={cn(
          "lg:col-span-2 rounded-2xl border overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-lg">Recent Logistics Activity</h3>
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {waybills.slice(0, 5).map((wb) => (
              <div key={wb.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-full",
                    wb.type === 'waybill' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                  )}>
                    {wb.type === 'waybill' ? <Truck className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium">{wb.siteName}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                       <Clock className="h-3 w-3" /> {new Date(wb.issueDate).toLocaleDateString()} • {wb.driverName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                    wb.status === 'sent_to_site' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {wb.status.replace('_', ' ')}
                  </span>
                  <p className="text-sm font-semibold">{wb.items.length} Items</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions / Categories */}
        <div className={cn(
          "rounded-2xl border p-6",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
           <h3 className="font-semibold text-lg mb-6">Asset Distribution</h3>
           <div className="space-y-4">
              {Object.entries(stats.categoriesCount).map(([cat, count]) => (
                <div key={cat} className="space-y-2">
                   <div className="flex justify-between text-sm">
                      <span className="capitalize text-slate-500">{cat}</span>
                      <span className="font-semibold">{count as number}</span>
                   </div>
                   <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${((count as number) / stats.totalAssets) * 100}%` }}
                      ></div>
                   </div>
                </div>
              ))}
           </div>

           <div className="mt-8 pt-6 border-t">
              <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm font-semibold">
                 <Package className="h-4 w-4" />
                 Register New Asset
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
