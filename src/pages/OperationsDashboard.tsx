import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useOperations } from '../contexts/OperationsContext';
import { Package, Truck, ArrowRightLeft, AlertCircle, TrendingUp, Clock, Wrench, HardHat } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { isInternalSite } from '@/src/lib/siteUtils';
import { AssetForm } from './AssetForm';
import { useState } from 'react';
import { usePriv } from '@/src/hooks/usePriv';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { assets, waybills, checkouts, maintenanceAssets, getAssetAnalytics, getMaintenanceStats } = useOperations();
  const { isDark } = useTheme();
  const [showAssetForm, setShowAssetForm] = useState(false);
  const navigate = useNavigate();

  const opsWaybills = usePriv('opsWaybills');
  const opsCheckout = usePriv('opsCheckout');
  const opsMaintenance = usePriv('opsMaintenance');
  const opsInventory = usePriv('opsInventory');

  const stats = getAssetAnalytics();
  const maintenanceStats = getMaintenanceStats();

  useSetPageTitle(
    'Operations Overview',
    'Real-time analytics and activity for inventory, logistics, and site assets'
  );

  const pendingReturnsCount = waybills.filter(w => w.type === 'return' && w.status === 'outstanding').length;
  
  const cards = [
    { title: 'Total Assets', value: stats.totalAssets, icon: Package, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'Active Waybills', value: stats.activeWaybills, icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { title: 'Active Checkouts', value: stats.activeCheckouts || 0, icon: HardHat, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    { title: 'Pending Returns', value: pendingReturnsCount, icon: ArrowRightLeft, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { title: 'Overdue Maint.', value: maintenanceStats.overdue, icon: Wrench, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  ];

  if (showAssetForm) {
    return <AssetForm onClose={() => setShowAssetForm(false)} />;
  }

  // Triage items
  const lowStockAssets = assets.filter(a => a.availableQuantity < (a.lowStockLevel || 5));
  const overdueMaintenance = maintenanceAssets.filter(a => a.status === 'overdue');
  const overdueCheckouts = checkouts.filter(c => {
    if (c.status === 'returned') return false;
    const expected = new Date(c.expectedReturnDate);
    return new Date() > expected;
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* 1. At a Glance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {cards.map((card, i) => (
          <div 
            key={i} 
            className={cn(
              "p-4 sm:p-5 rounded-xl border transition-all hover:shadow-md",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <card.icon className={cn("h-4 w-4", card.color)} />
              </div>
              <TrendingUp className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{card.title}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Quick Actions Bar */}
      <div className={cn(
        "flex flex-wrap gap-3 p-4 rounded-xl border shadow-sm items-center",
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <span className="text-sm font-semibold text-slate-500 mr-2">Quick Actions:</span>
        {opsWaybills?.canAdd && (
          <button onClick={() => navigate('/operations/waybills')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition-colors">
            <Truck className="h-4 w-4" /> Create Waybill
          </button>
        )}
        {opsCheckout?.canAdd && (
          <button onClick={() => navigate('/operations/checkout')} className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 rounded-lg text-sm font-medium transition-colors">
            <HardHat className="h-4 w-4" /> Quick Checkout
          </button>
        )}
        {opsMaintenance?.canAdd && (
          <button onClick={() => navigate('/operations/maintenance')} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-lg text-sm font-medium transition-colors">
            <Wrench className="h-4 w-4" /> Log Maintenance
          </button>
        )}
        {opsInventory?.canAdd && (
          <button onClick={() => setShowAssetForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg text-sm font-medium transition-colors">
            <Package className="h-4 w-4" /> Add Asset
          </button>
        )}
      </div>

      {/* 3. Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Activity (2/3) */}
        <div className={cn(
          "lg:col-span-2 rounded-xl border overflow-hidden shadow-sm flex flex-col",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Recent Logistics Activity</h3>
            {opsWaybills?.canView && (
              <button onClick={() => navigate('/operations/waybills')} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">View All Waybills</button>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {waybills.filter(wb => !isInternalSite({ name: wb.siteName })).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No recent logistics activity.</div>
            ) : (
              waybills
                .filter(wb => !isInternalSite({ name: wb.siteName }))
                .slice(0, 6)
                .map((wb) => (
                <div key={wb.id} 
                  onClick={() => opsWaybills?.canView && navigate('/operations/waybills')}
                  className={cn(
                    "px-5 py-4 flex items-center justify-between transition-colors",
                    opsWaybills?.canView ? "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50" : ""
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg flex-shrink-0",
                      wb.type === 'waybill' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
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
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 border-blue-200"
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
              ))
            )}
          </div>
        </div>

        {/* Right Column: Attention Required / Triage (1/3) */}
        <div className={cn(
          "rounded-xl border overflow-hidden shadow-sm flex flex-col",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="px-5 py-4 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between bg-rose-50/30 dark:bg-rose-900/10">
            <h3 className="font-semibold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Attention Required
            </h3>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[400px]">
            {/* Overdue Maintenance */}
            {overdueMaintenance.map(m => (
              <div key={m.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-rose-500"><Wrench className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{m.name}</p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Overdue for maintenance</p>
                    <p className="text-xs text-slate-500 mt-1">S/N: {m.serialNumber}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Overdue Checkouts */}
            {overdueCheckouts.map(c => (
              <div key={c.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-amber-500"><HardHat className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{c.employeeName}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Overdue tool return</p>
                    <p className="text-xs text-slate-500 mt-1">{c.quantity}x {c.assetName}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Low Stock Alerts */}
            {lowStockAssets.map(a => (
              <div key={a.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-orange-500"><Package className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.name}</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Low stock alert</p>
                    <p className="text-xs text-slate-500 mt-1">Available: {a.availableQuantity} {a.unitOfMeasurement}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {overdueMaintenance.length === 0 && overdueCheckouts.length === 0 && lowStockAssets.length === 0 && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mb-3">
                  <Package className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No pending alerts requiring attention.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
