import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { Package, Truck, ArrowRightLeft, AlertCircle, TrendingUp, Clock, Wrench, HardHat, Bell, CalendarRange, ChevronRight, ExternalLink, Fuel } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { useTheme } from '@/src/hooks/useTheme';
import { cn, formatUnit } from '@/src/lib/utils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { isInternalSite } from '@/src/lib/siteUtils';
import { AssetForm } from './AssetForm';
import { useState, useMemo } from 'react';
import { usePriv } from '@/src/hooks/usePriv';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, parseISO, eachDayOfInterval } from 'date-fns';

export function Dashboard() {
  const {
    assets, waybills, checkouts, maintenanceAssets,
    getAssetAnalytics, getMaintenanceStats,
    dailyMachineLogs, sitePumpDates,
  } = useOperations();
  const { isDark } = useTheme();
  const [showAssetForm, setShowAssetForm] = useState(false);
  const navigate = useNavigate();
  const sites = useAppStore(s => s.sites);
  const [logTab, setLogTab] = useState<'active' | 'pending'>('active');

  const opsWaybills  = usePriv('opsWaybills');
  const opsCheckout  = usePriv('opsCheckout');
  const opsMaintenance = usePriv('opsMaintenance');
  const opsInventory = usePriv('opsInventory');
  const opsDiesel = usePriv('opsDiesel');

  const stats = getAssetAnalytics();
  const maintenanceStats = getMaintenanceStats();

  useSetPageTitle(
    'Operations Overview',
    'Real-time analytics and activity for inventory, logistics, and site assets'
  );

  const pendingReturnsCount = waybills.filter(w => w.type === 'return' && w.status === 'outstanding').length;

  const cards = [
    { title: 'Total Assets',     value: stats.totalAssets,          icon: Package,       color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30'   },
    { title: 'Active Waybills',  value: stats.activeWaybills,       icon: Truck,         color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30'},
    { title: 'Active Checkouts', value: stats.activeCheckouts || 0, icon: HardHat,       color: 'text-teal-600',   bg: 'bg-teal-100 dark:bg-teal-900/30'   },
    { title: 'Pending Returns',  value: pendingReturnsCount,        icon: ArrowRightLeft, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30'  },
    { title: 'Overdue Maint.',   value: maintenanceStats.overdue,   icon: Wrench,        color: 'text-rose-600',   bg: 'bg-rose-100 dark:bg-rose-900/30'   },
  ];

  if (showAssetForm) {
    return <AssetForm onClose={() => setShowAssetForm(false)} />;
  }

  // Triage items
  const lowStockAssets     = assets.filter(a => a.availableQuantity < (a.lowStockLevel || 5));
  const overdueMaintenance = maintenanceAssets.filter(a => a.status === 'overdue');
  const overdueCheckouts   = checkouts.filter(c => {
    if (c.status === 'returned') return false;
    return new Date() > new Date(c.expectedReturnDate);
  });

  // ── Pending Machine Log Notifications ────────────────────────────────────
  // A machine has a "pending log" when there are un-logged days within its
  // configured pump period (pumpStartDate → pumpStopDate or today).
  const pendingLogNotifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Index logs by siteId+assetId → Set of logged date strings (YYYY-MM-DD)
    const loggedDatesMap = new Map<string, Set<string>>();
    dailyMachineLogs.forEach(log => {
      const key = `${log.siteId}::${log.assetId}`;
      if (!loggedDatesMap.has(key)) loggedDatesMap.set(key, new Set());
      loggedDatesMap.get(key)!.add(log.date.substring(0, 10));
    });

    // Build site inventory to track active machines currently on site
    const siteInventoryMap = new Map<string, Map<string, { quantity: number; firstDispatchDate: string }>>();
    waybills.forEach(wb => {
      if (wb.status === 'outstanding') return;
      const sId = wb.siteId || '';
      if (!sId) return;

      if (!siteInventoryMap.has(sId)) {
        siteInventoryMap.set(sId, new Map());
      }
      const inv = siteInventoryMap.get(sId)!;

      if (wb.type === 'waybill') {
        wb.items.forEach(item => {
          const assetMeta = assets.find(a => a.id === item.assetId);
          if (assetMeta?.type !== 'equipment' || !assetMeta?.requiresLogging) return;

          const dateStr = wb.sentToSiteDate ? wb.sentToSiteDate.substring(0, 10) : (wb.issueDate ? wb.issueDate.substring(0, 10) : '');
          const existing = inv.get(item.assetId);
          if (existing) {
            existing.quantity += item.quantity;
            if (dateStr && (!existing.firstDispatchDate || dateStr < existing.firstDispatchDate)) {
              existing.firstDispatchDate = dateStr;
            }
          } else {
            inv.set(item.assetId, {
              quantity: item.quantity,
              firstDispatchDate: dateStr,
            });
          }
        });
      } else if (wb.type === 'return') {
        wb.items.forEach(item => {
          const assetMeta = assets.find(a => a.id === item.assetId);
          if (assetMeta?.type !== 'equipment' || !assetMeta?.requiresLogging) return;

          const existing = inv.get(item.assetId);
          if (existing) {
            if (wb.status === 'return_completed') {
              existing.quantity = Math.max(0, existing.quantity - item.quantity);
            }
          }
        });
      }
    });

    const pumpPeriods: {
      siteId: string;
      assetId: string;
      pumpStartDate: string;
      pumpStopDate: string | null;
    }[] = [];

    // 1. Add all configured pump dates
    sitePumpDates.forEach(pd => {
      if (pd.pumpStartDate) {
        pumpPeriods.push({
          siteId: pd.siteId,
          assetId: pd.assetId,
          pumpStartDate: pd.pumpStartDate,
          pumpStopDate: pd.pumpStopDate,
        });
      }
    });

    // 2. Add active machines currently on site that aren't configured in sitePumpDates
    siteInventoryMap.forEach((inv, sId) => {
      inv.forEach((info, aId) => {
        if (info.quantity <= 0) return;
        const alreadyConfigured = pumpPeriods.some(p => p.siteId === sId && p.assetId === aId);
        if (!alreadyConfigured) {
          const machineLogs = dailyMachineLogs.filter(l => l.siteId === sId && l.assetId === aId);
          const earliestLog = machineLogs.length > 0
            ? machineLogs.reduce((acc, log) => !acc || log.date < acc ? log.date : acc, machineLogs[0].date)
            : '';

          const startDate = info.firstDispatchDate || earliestLog || null;
          if (startDate) {
            pumpPeriods.push({
              siteId: sId,
              assetId: aId,
              pumpStartDate: startDate.substring(0, 10),
              pumpStopDate: null,
            });
          }
        }
      });
    });

    const notifications: {
      siteId: string;
      siteName: string;
      assetId: string;
      assetName: string;
      pumpStart: Date;
      pumpStop: Date | null;  // actual configured pumpStopDate (or null if ongoing)
      missingDays: number;
      lastLogDate: Date | null;
      gapDays: number;       // days since last log to effective end
      siteStatus: 'Active' | 'Inactive' | 'Ended';
    }[] = [];

    pumpPeriods.forEach(pd => {
      const pumpStart = parseISO(pd.pumpStartDate);
      const pumpStop = pd.pumpStopDate ? parseISO(pd.pumpStopDate) : null;
      // Effective end: use pumpStop if set, otherwise today. Cap at today to prevent future warnings.
      const effectiveEnd = pumpStop && pumpStop < today ? pumpStop : today;

      // Only report machines whose pump period has started
      if (pumpStart > today) return;

      const key = `${pd.siteId}::${pd.assetId}`;
      const loggedDates = loggedDatesMap.get(key) || new Set<string>();

      // Count days in the pump range that have no log
      const daysInRange = eachDayOfInterval({ start: pumpStart, end: effectiveEnd });
      const missingDays = daysInRange.filter(d => {
        const ds = format(d, 'yyyy-MM-dd');
        return !loggedDates.has(ds);
      }).length;

      if (missingDays === 0) return; // fully logged — no notification

      // Find the last log within the pump range
      const logsInRange = Array.from(loggedDates)
        .filter(ds => ds >= pd.pumpStartDate && ds <= format(effectiveEnd, 'yyyy-MM-dd'))
        .sort();
      const lastLogDate = logsInRange.length > 0 ? parseISO(logsInRange[logsInRange.length - 1]) : null;

      // Gap = days from last log (or pump start if none) to effective end
      const gapFrom = lastLogDate || pumpStart;
      const gapDays = Math.max(0, differenceInDays(effectiveEnd, gapFrom));

      const siteMeta = sites.find(s => s.id === pd.siteId);
      const siteStatus = siteMeta?.status || 'Active';

      // Find asset & site name from logs or assets list
      const logSample = dailyMachineLogs.find(l => l.assetId === pd.assetId && l.siteId === pd.siteId);
      const assetMeta = assets.find(a => a.id === pd.assetId);
      const assetName = logSample?.assetName || assetMeta?.name || pd.assetId;
      const siteName  = siteMeta?.name || logSample?.siteName || pd.siteId;

      notifications.push({
        siteId: pd.siteId,
        siteName,
        assetId: pd.assetId,
        assetName,
        pumpStart,
        pumpStop,
        missingDays,
        lastLogDate,
        gapDays,
        siteStatus,
      });
    });

    // Sort: most missing days first
    return notifications.sort((a, b) => b.missingDays - a.missingDays);
  }, [dailyMachineLogs, sitePumpDates, assets, sites, waybills]);

  const activeNotifications = useMemo(() => {
    return pendingLogNotifications.filter(n => n.siteStatus === 'Active');
  }, [pendingLogNotifications]);

  const pendingNotifications = useMemo(() => {
    return pendingLogNotifications.filter(n => n.siteStatus === 'Inactive' || n.siteStatus === 'Ended');
  }, [pendingLogNotifications]);

  const displayNotifications = useMemo(() => {
    return logTab === 'active' ? activeNotifications : pendingNotifications;
  }, [logTab, activeNotifications, pendingNotifications]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

      {/* 1. At-a-Glance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {cards.map((card, i) => (
          <div
            key={i}
            className={cn(
              'p-4 sm:p-5 rounded-xl border transition-all hover:shadow-md',
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn('p-2 rounded-lg', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
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

      {/* 2. Quick Actions */}
      <div className={cn(
        'flex flex-wrap gap-3 p-4 rounded-xl border shadow-sm items-center',
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
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
        {opsDiesel?.canAdd && (
          <button onClick={() => navigate('/operations/diesel')} className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 rounded-lg text-sm font-medium transition-colors">
            <Fuel className="h-4 w-4" /> Diesel Refill
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

        {/* Left: Recent Logistics (2/3) */}
        <div className={cn(
          'lg:col-span-2 rounded-xl border overflow-hidden shadow-sm flex flex-col',
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
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
                .map(wb => (
                  <div
                    key={wb.id}
                    onClick={() => opsWaybills?.canView && navigate('/operations/waybills')}
                    className={cn(
                      'px-5 py-4 flex items-center justify-between transition-colors',
                      opsWaybills?.canView ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50' : ''
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg flex-shrink-0',
                        wb.type === 'waybill' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
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
                        'hidden sm:inline-flex text-[11px] font-semibold rounded-full px-2',
                        wb.status === 'sent_to_site'
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 border-blue-200'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200'
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

        {/* Right: Attention Required (1/3) */}
        <div className={cn(
          'rounded-xl border overflow-hidden shadow-sm flex flex-col',
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <div className="px-5 py-4 border-b border-rose-100 dark:border-rose-900/30 flex items-center bg-rose-50/30 dark:bg-rose-900/10">
            <h3 className="font-semibold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Attention Required
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[400px]">
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
            {lowStockAssets.map(a => (
              <div key={a.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-orange-500"><Package className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.name}</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Low stock alert</p>
                    <p className="text-xs text-slate-500 mt-1">Available: {a.availableQuantity} {formatUnit(a.unitOfMeasurement)}</p>
                  </div>
                </div>
              </div>
            ))}
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

      {/* 4. Pending Machine Log Notifications ─────────────────────────────── */}
      <div className={cn(
        'rounded-xl border overflow-hidden shadow-sm',
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      )}>
        {/* Header */}
        <div className={cn(
          'px-5 py-4 border-b flex items-center justify-between',
          pendingLogNotifications.length > 0
            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'
            : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-lg',
              pendingLogNotifications.length > 0
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            )}>
              <Bell className="h-4 w-4" />
            </div>
            <h3 className={cn(
              'font-semibold text-sm',
              pendingLogNotifications.length > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-700 dark:text-slate-200'
            )}>
              Pending Machine Log Notifications
            </h3>
            {pendingLogNotifications.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {pendingLogNotifications.length}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Click a row to open the machine's log page
          </p>
        </div>

        {/* Tabs Bar */}
        <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            onClick={() => setLogTab('active')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
              logTab === 'active'
                ? "bg-emerald-600 text-white shadow-sm font-black"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            )}
          >
            <span>Active Sites</span>
            <span className={cn(
              "px-1.5 py-0.5 text-[10px] rounded-full font-black",
              logTab === 'active' ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {activeNotifications.length}
            </span>
          </button>
          <button
            onClick={() => setLogTab('pending')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
              logTab === 'pending'
                ? "bg-amber-500 text-white shadow-sm font-black"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            )}
          >
            <span>Inactive Sites</span>
            <span className={cn(
              "px-1.5 py-0.5 text-[10px] rounded-full font-black",
              logTab === 'pending' ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {pendingNotifications.length}
            </span>
          </button>
        </div>

        {/* Body */}
        {displayNotifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 mb-1">
              <Bell className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">All machines are up to date</p>
            <p className="text-xs text-slate-400">No pending log notifications for this category.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-80">
            {displayNotifications.map((notif, i) => {
              const urgency =
                notif.missingDays >= 7
                  ? { color: 'text-rose-600 dark:text-rose-400',  bg: 'hover:bg-rose-50/60 dark:hover:bg-rose-900/10',   pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',    icon: 'bg-rose-100 dark:bg-rose-900/30 text-rose-500',   label: 'Critical' }
                  : notif.missingDays >= 4
                  ? { color: 'text-amber-600 dark:text-amber-400', bg: 'hover:bg-amber-50/60 dark:hover:bg-amber-900/10', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-500', label: 'Overdue'  }
                  : { color: 'text-orange-500 dark:text-orange-400', bg: 'hover:bg-orange-50/40 dark:hover:bg-orange-900/10', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500', label: 'Pending' };

              return (
                <button
                  key={i}
                  className={cn(
                    'w-full text-left px-5 py-3.5 flex items-center justify-between transition-colors group',
                    urgency.bg
                  )}
                  onClick={() =>
                    navigate('/operations/sites', {
                      state: { siteId: notif.siteId, assetId: notif.assetId },
                    })
                  }
                  title={`Click to open ${notif.assetName} log on ${notif.siteName}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Icon */}
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', urgency.icon)}>
                      <CalendarRange className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      {/* Machine name */}
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {notif.assetName}
                      </p>
                      {/* Site */}
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <span className="font-semibold">Site:</span> {notif.siteName}
                      </p>
                      {/* Pump date range */}
                      <p className={cn('text-[11px] font-semibold mt-0.5 flex items-center gap-1 flex-wrap', urgency.color)}>
                        <Clock className="h-3 w-3 shrink-0" />
                        Pump period: {format(notif.pumpStart, 'dd MMM yyyy')}
                        <span className="text-slate-400 font-normal mx-0.5">→</span>
                        {notif.pumpStop ? format(notif.pumpStop, 'dd MMM yyyy') : `${format(new Date(), 'dd MMM yyyy')} (Today)`}
                        {notif.lastLogDate && (
                          <span className="text-slate-400 font-normal ml-1">
                            · Last log: {format(notif.lastLogDate, 'dd MMM')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right badges */}
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className={cn('inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-full', urgency.pill)}>
                        {urgency.label}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">{notif.missingDays} day{notif.missingDays !== 1 ? 's' : ''} missing</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
