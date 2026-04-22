import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useOperations } from '../contexts/OperationsContext';
import { Package, Truck, ArrowRightLeft, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { AssetForm } from './AssetForm';
import { useState } from 'react';

export function Dashboard() {
  const { assets, waybills, getAssetAnalytics } = useOperations();
  const { isDark } = useTheme();
  const [showAssetForm, setShowAssetForm] = useState(false);
  const stats = getAssetAnalytics();

  useSetPageTitle(
    'Operations Overview',
    'Real-time analytics and activity for inventory, logistics, and site assets'
  );

  const cards = [
    { title: 'Total Assets', value: stats.totalAssets, icon: Package, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    { title: 'Active Waybills', value: stats.activeWaybills, icon: Truck, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    { title: 'Pending Returns', value: waybills.filter(w => w.type === 'return' && w.status === 'outstanding').length, icon: ArrowRightLeft, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { title: 'Low Stock Alerts', value: assets.filter(a => a.availableQuantity < 5).length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  if (showAssetForm) {
    return <AssetForm onClose={() => setShowAssetForm(false)} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {cards.map((card, i) => (
          <div 
            key={i} 
            className={cn(
              "p-5 sm:p-6 rounded-xl border transition-all hover:shadow-md",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <TrendingUp className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{card.title}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Waybills */}
        <div className={cn(
          "lg:col-span-2 rounded-xl border overflow-hidden shadow-sm",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Recent Logistics Activity</h3>
            <button className="text-xs text-teal-600 hover:text-teal-700 font-semibold">View All</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {waybills.slice(0, 5).map((wb) => (
              <div key={wb.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg flex-shrink-0",
                    wb.type === 'waybill' ? "bg-teal-100 dark:bg-teal-900/30 text-teal-600" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                  )}>
                    {wb.type === 'waybill' ? <Truck className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{wb.siteName}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDisplayDate(wb.issueDate)} • {wb.driverName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <Badge variant="outline" className={cn(
                    "hidden sm:inline-flex text-[11px] font-semibold rounded-full px-2",
                    wb.status === 'sent_to_site'
                      ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 border-teal-200"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200"
                  )}>
                    {wb.status.replace(/_/g, ' ')}
                  </Badge>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{wb.items.length}</p>
                    <p className="text-xs text-slate-400">Items</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Asset Distribution */}
        <div className={cn(
          "rounded-xl border p-5 sm:p-6 shadow-sm",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-6">Asset Distribution</h3>
          <div className="space-y-4">
            {Object.entries(stats.categoriesCount).map(([cat, count]) => (
              <div key={cat} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="capitalize text-slate-500">{cat}</span>
                  <span className="text-slate-800 dark:text-slate-200">{count as number}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 rounded-full" 
                    style={{ width: `${((count as number) / Math.max(stats.totalAssets, 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setShowAssetForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Package className="h-4 w-4" />
              Register New Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
