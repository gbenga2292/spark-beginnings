import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore, Site } from '@/src/store/appStore';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import {
  ArrowLeft, Package, Wrench, Layers, Truck, Activity,
  MapPin, Building2, User, Phone, Calendar, Info, X,
  FileText, ArrowRightLeft, RotateCcw, ChevronRight, BarChart2, ClipboardList
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { ConsumableUsageLog } from '@/src/types/operations';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { WaybillForm } from './WaybillForm';
import { CreateReturnWaybill } from './CreateReturnWaybill';
import { SiteTransactionsView } from './SiteTransactionsView';
import { DailyLogManager } from './DailyLogManager';
import { ConsumableDetailView } from './ConsumableDetailView';
import { BulkConsumableLogModal } from './BulkConsumableLogModal';
import { SiteConsumablesAnalyticsModal } from './SiteConsumablesAnalyticsModal';
import { BulkMachineLogModal } from './BulkMachineLogModal';
import { SiteMachineAnalyticsModal } from './SiteMachineAnalyticsModal';

interface SiteInventoryViewProps {
  site: Site;
  questionnaire: SiteQuestionnaire | null;
  onBack: () => void;
}

type TabId = 'materials' | 'machines' | 'consumables' | 'waybills';

interface SiteItem {
  assetId: string;
  assetName: string;
  quantity: number;
  unit?: string;
  type?: string;
  lastUpdated?: string;
}

export function SiteInventoryView({ site, questionnaire, onBack }: SiteInventoryViewProps) {
  const { waybills, assets, maintenanceAssets, dailyMachineLogs } = useOperations();
  const [activeTab, setActiveTab] = useState<TabId>('materials');
  const [showReturnWaybill, setShowReturnWaybill] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<{ id: string, name: string } | null>(null);
  const [selectedConsumable, setSelectedConsumable] = useState<SiteItem | null>(null);
  const [showBulkLog, setShowBulkLog] = useState(false);
  const [showConsumablesAnalytics, setShowConsumablesAnalytics] = useState(false);
  const [showMachineBulkLog, setShowMachineBulkLog] = useState(false);
  const [showMachineAnalytics, setShowMachineAnalytics] = useState(false);

  const { consumableLogs, addConsumableLogs } = useAppStore();

  // All waybills for this site
  const siteWaybills = waybills.filter(w =>
    (w.siteName?.toLowerCase() === site.name.toLowerCase() ||
    w.siteId === site.id) &&
    w.status !== 'outstanding'
  );

  // Build site inventory by aggregating all waybill items
  const inventoryMap = new Map<string, SiteItem>();
  siteWaybills
    .filter(w => w.type === 'waybill' && w.status !== 'outstanding')
    .forEach(wb => {
      wb.items.forEach(item => {
        const existing = inventoryMap.get(item.assetId);
        const assetMeta = assets.find(a => a.id === item.assetId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.lastUpdated = wb.issueDate;
        } else {
          inventoryMap.set(item.assetId, {
            assetId: item.assetId,
            assetName: item.assetName,
            quantity: item.quantity,
            unit: assetMeta?.unitOfMeasurement || 'pcs',
            type: assetMeta?.type || 'non-consumable',
            lastUpdated: wb.issueDate,
          });
        }
      });
    });

  // Subtract returns
  siteWaybills
    .filter(w => w.type === 'return')
    .forEach(wb => {
      wb.items.forEach(item => {
        const existing = inventoryMap.get(item.assetId);
        if (existing) {
          existing.quantity = Math.max(0, existing.quantity - item.quantity);
        }
      });
    });

  // Subtract consumed usages
  const siteConsumableLogs = consumableLogs.filter(log => log.siteId === site.id);
  siteConsumableLogs.forEach(log => {
    const existing = inventoryMap.get(log.assetId);
    if (existing) {
      existing.quantity = Math.max(0, existing.quantity - log.quantityUsed);
    }
  });

  const allItems = Array.from(inventoryMap.values()).filter(i => i.quantity > 0);

  // Filter by tab
  const materialItems = allItems.filter(i =>
    !['consumable', 'equipment'].includes(i.type || '') &&
    i.type !== 'consumable'
  );
  const machineItems = assets.filter(a => 
    a.type === 'equipment' && 
    a.requiresLogging && 
    allItems.find(i => i.assetId === a.id)
  );
  const consumableItems = allItems.filter(i => i.type === 'consumable');

  const tabs: { id: TabId; label: string; count: number; icon: React.ElementType }[] = [
    { id: 'materials', label: 'Materials', count: materialItems.length, icon: Package },
    { id: 'machines', label: 'Machines', count: machineItems.length, icon: Wrench },
    { id: 'consumables', label: 'Consumables', count: consumableItems.length, icon: Layers },
    { id: 'waybills', label: 'Waybills', count: siteWaybills.length, icon: Truck },
  ];

  const services = questionnaire?.phase3?.dewateringMethods || ['Dewatering'];

  const handleDownloadMaterialsReport = () => {
    const headers = ['Asset ID', 'Asset Name', 'Category', 'Quantity', 'Unit', 'Last Updated'];
    const rows = allItems.map(item => [
      item.assetId,
      `"${item.assetName}"`,
      item.type || 'non-consumable',
      item.quantity,
      item.unit || 'pcs',
      item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString('en-GB') : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${site.name.replace(/\s+/g, '_')}_Materials_Report.csv`;
    a.click();
    setShowReportDialog(false);
  };

  const handleDownloadTransactionsReport = () => {
    const headers = ['Waybill ID', 'Type', 'Status', 'Date', 'Driver', 'Items Count'];
    const rows = siteWaybills.map(wb => [
      wb.id,
      wb.type,
      wb.status,
      wb.issueDate ? new Date(wb.issueDate).toLocaleDateString('en-GB') : '',
      `"${wb.driverName}"`,
      wb.items.length
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${site.name.replace(/\s+/g, '_')}_Transactions_Report.csv`;
    a.click();
    setShowReportDialog(false);
  };

  const currentMachines = machineItems;
  const historyMachines = assets.filter(a => 
    a.type === 'equipment' && 
    a.requiresLogging && 
    siteWaybills.some(w => w.type === 'waybill' && w.items.some(i => i.assetId === a.id)) &&
    !currentMachines.find(c => c.id === a.id)
  );

  useSetPageTitle(
    site.name,
    questionnaire?.contactPersonPhone ? `Contact: ${questionnaire.contactPersonPhone}` : 'Site Overview',
    <div className="flex items-center gap-1 sm:gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-2" onClick={() => setShowReturnWaybill(true)} title="Return Waybill">
        <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Return</span>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-2" onClick={() => setShowTransactions(true)} title="Transactions">
        <Activity className="h-4 w-4" /> <span className="hidden sm:inline">Transactions</span>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setShowReportDialog(true)} title="Generate Report">
        <FileText className="h-4 w-4" />
      </Button>
    </div>
  );

  if (showReturnWaybill) {
    return (
      <CreateReturnWaybill
        site={site}
        inventoryItems={allItems}
        onBack={() => setShowReturnWaybill(false)}
      />
    );
  }

  if (selectedMachine) {
    return (
      <DailyLogManager
        assetId={selectedMachine.id}
        assetName={selectedMachine.name}
        siteId={site.id}
        siteName={site.name}
        onBack={() => setSelectedMachine(null)}
      />
    );
  }

  if (selectedConsumable) {
    return (
      <ConsumableDetailView
        item={selectedConsumable}
        site={site}
        logs={siteConsumableLogs.filter(l => l.assetId === selectedConsumable.assetId)}
        onBack={() => setSelectedConsumable(null)}
      />
    );
  }

  if (showTransactions) {
    return (
      <SiteTransactionsView
        site={site}
        onBack={() => setShowTransactions(false)}
      />
    );
  }

  const renderMachineItem = (machine: any, isHistory = false) => {
    const mAsset = maintenanceAssets.find(ma => ma.id === machine.id);
    return (
      <div
        key={machine.id}
        onClick={() => setSelectedMachine({ id: machine.id, name: machine.name })}
        className={cn(
          "flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group",
          isHistory && "opacity-60 hover:opacity-100"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-110 transition-transform">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{machine.name}</p>
            <p className="text-xs text-slate-400">
              S/N: {machine.serialNumber || 'N/A'} {isHistory ? '· Previously on site' : (mAsset ? `· Next service: ${new Date(mAsset.nextServiceDate).toLocaleDateString()}` : '')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mAsset && !isHistory && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold px-2 py-0.5",
                mAsset.status === 'ok' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                mAsset.status === 'due_soon' ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-rose-50 text-rose-700 border-rose-200"
              )}
            >
              {mAsset.status.replace('_', ' ')}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="bg-card rounded-xl shadow-sm border border-border flex flex-col overflow-hidden mt-2">
        {/* Tabs */}
        <div className="flex overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-1 py-4 mr-6 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[11px] font-bold px-1.5 py-0.5 rounded",
                  activeTab === tab.id
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Materials Tab */}
            {activeTab === 'materials' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {allItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Package className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No materials recorded at this site</p>
                    <p className="text-xs text-slate-300 mt-1">Create a waybill to start tracking</p>
                  </div>
                ) : allItems.map(item => (
                  <div
                    key={item.assetId}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{item.assetName}</p>
                        <p className="text-xs text-slate-400 capitalize">{item.type || 'non-consumable'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {item.quantity} <span className="text-slate-400 font-normal text-xs">{item.unit || 'pcs'}</span>
                        </p>
                        {item.lastUpdated && (
                          <p className="text-[10px] text-slate-400">
                            {new Date(item.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'machines' && (
              <div className="p-6">
                {/* Action bar — identical style to consumables */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Site Machines</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
                      onClick={() => setShowMachineBulkLog(true)}
                      title="Bulk Log"
                    >
                      <ClipboardList className="h-4 w-4" /> <span className="hidden sm:inline">Bulk Log</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
                      onClick={() => setShowMachineAnalytics(true)}
                      title="Site Analytics"
                    >
                      <BarChart2 className="h-4 w-4" /> <span className="hidden sm:inline">Site Analytics</span>
                    </Button>
                  </div>
                </div>

                {currentMachines.length === 0 && historyMachines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Wrench className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No machines assigned to this site</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Current on Site */}
                    {currentMachines.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Current on Site</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {currentMachines.map(machine => {
                            const mAsset = maintenanceAssets.find(ma => ma.id === machine.id);
                            const machineLogCount = dailyMachineLogs.filter(l => l.assetId === machine.id && l.siteId === site.id).length;
                            return (
                              <div
                                key={machine.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                              >
                                {/* Card Header */}
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 shrink-0">
                                    <Wrench className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{machine.name}</h4>
                                    <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">S/N: {machine.serialNumber || 'N/A'}</p>
                                  </div>
                                  {mAsset && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 shrink-0",
                                        mAsset.status === 'ok' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                        mAsset.status === 'due_soon' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        "bg-rose-50 text-rose-700 border-rose-200"
                                      )}
                                    >
                                      {mAsset.status.replace('_', ' ')}
                                    </Badge>
                                  )}
                                </div>

                                {/* Stats row */}
                                <div className="p-4 grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                  <div className="flex flex-col items-center justify-center px-2">
                                    <p className="text-xs text-slate-500 mb-1">Next Service</p>
                                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center">
                                      {mAsset ? new Date(mAsset.nextServiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-center justify-center px-2">
                                    <p className="text-xs text-slate-500 mb-1">Interval</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                      {mAsset ? `${mAsset.serviceIntervalMonths}mo` : '—'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-center justify-center px-2">
                                    <p className="text-xs text-slate-500 mb-1">Log Days</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{machineLogCount}</p>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 px-3 rounded-lg font-medium shadow-sm"
                                    onClick={() => setSelectedMachine({ id: machine.id, name: machine.name })}
                                  >
                                    View Logs
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* History */}
                    {historyMachines.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">History — Previously on Site</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {historyMachines.map(machine => (
                            <div
                              key={machine.id}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm opacity-60 hover:opacity-90 transition-opacity"
                            >
                              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                  <Wrench className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{machine.name}</h4>
                                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">S/N: {machine.serialNumber || 'N/A'}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 shrink-0 text-slate-500 border-slate-300">
                                  Past
                                </Badge>
                              </div>
                              <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">
                                <p className="text-xs text-slate-400 text-center">Previously deployed to this site</p>
                              </div>
                              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 text-slate-600 border-slate-200 w-full"
                                  onClick={() => setSelectedMachine({ id: machine.id, name: machine.name })}
                                >
                                  View History
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Consumables Tab */}
            {activeTab === 'consumables' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Site Consumables</h3>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
                      onClick={() => setShowBulkLog(true)}
                      title="Bulk Log"
                    >
                      <ClipboardList className="h-4 w-4" /> <span className="hidden sm:inline">Bulk Log</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
                      onClick={() => setShowConsumablesAnalytics(true)}
                      title="Site Analytics"
                    >
                      <BarChart2 className="h-4 w-4" /> <span className="hidden sm:inline">Site Analytics</span>
                    </Button>
                  </div>
                </div>

                {consumableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Layers className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No consumables recorded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {consumableItems.map(item => {
                      const itemLogs = siteConsumableLogs.filter(l => l.assetId === item.assetId);
                      const totalUsed = itemLogs.reduce((acc, log) => acc + log.quantityUsed, 0);

                      return (
                        <div
                          key={item.assetId}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shrink-0">
                              <Layers className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.assetName}</h4>
                              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Consumable</p>
                            </div>
                          </div>
                          
                          <div className="p-4 grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex flex-col items-center justify-center px-2">
                              <p className="text-xs text-slate-500 mb-1">At Site</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.quantity} <span className="text-[10px] font-normal text-slate-400">{item.unit || 'pcs'}</span></p>
                            </div>
                            <div className="flex flex-col items-center justify-center px-2">
                              <p className="text-xs text-slate-500 mb-1">Total Used</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{totalUsed} <span className="text-[10px] font-normal text-slate-400">{item.unit || 'pcs'}</span></p>
                            </div>
                            <div className="flex flex-col items-center justify-center px-2">
                              <p className="text-xs text-slate-500 mb-1">Usage Count</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{itemLogs.length}</p>
                            </div>
                          </div>

                          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                            <Button 
                              size="sm" 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 px-3 rounded-lg font-medium shadow-sm"
                              onClick={() => setSelectedConsumable(item)}
                            >
                              + Log Usage
                            </Button>
                            <div className="flex items-center gap-1.5">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-50 hover:text-blue-600"
                                onClick={() => setSelectedConsumable(item)}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-50 hover:text-amber-600"
                                onClick={() => setSelectedConsumable(item)}
                              >
                                <Activity className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Waybills Tab */}
            {activeTab === 'waybills' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {siteWaybills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Truck className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No waybills for this site yet</p>
                  </div>
                ) : siteWaybills.map(wb => (
                  <div
                    key={wb.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                        wb.type === 'waybill'
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                          : "bg-amber-50 dark:bg-amber-900/20 text-amber-500"
                      )}>
                        {wb.type === 'waybill' ? <Truck className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">REF-{wb.id.substring(0, 8).toUpperCase()}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0",
                              wb.status === 'outstanding' ? "bg-amber-50 text-amber-700 border-amber-200" :
                              wb.status === 'sent_to_site' ? "bg-blue-50 text-blue-700 border-blue-200" :
                              "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}
                          >
                            {wb.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {wb.driverName} · {formatDisplayDate(wb.issueDate)} · {wb.items.length} item{wb.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {/* 
        Return Waybill is now handled at the top level 
        of this component when showReturnWaybill is true 
      */}

      {/* Report Generation Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl text-center text-slate-800">Generate Report</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <button 
              onClick={handleDownloadMaterialsReport}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-all text-blue-700"
            >
              <Package className="h-6 w-6" />
              <span className="font-semibold text-sm">Materials On Site</span>
            </button>
            <button 
              onClick={handleDownloadTransactionsReport}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-700"
            >
              <Activity className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-sm">Site Transactions</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkConsumableLogModal
        isOpen={showBulkLog}
        onClose={() => setShowBulkLog(false)}
        site={site}
        consumables={consumableItems}
      />

      <SiteConsumablesAnalyticsModal
        isOpen={showConsumablesAnalytics}
        onClose={() => setShowConsumablesAnalytics(false)}
        site={site}
        consumables={consumableItems}
        logs={siteConsumableLogs}
      />

      <BulkMachineLogModal
        isOpen={showMachineBulkLog}
        onClose={() => setShowMachineBulkLog(false)}
        siteId={site.id}
        siteName={site.name}
        machines={currentMachines.map(m => ({ id: m.id, name: m.name }))}
        date={new Date().toISOString().split('T')[0]}
      />

      <SiteMachineAnalyticsModal
        isOpen={showMachineAnalytics}
        onClose={() => setShowMachineAnalytics(false)}
        site={site}
        machines={[...currentMachines, ...historyMachines].map(m => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}

