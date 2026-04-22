import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore, Site } from '@/src/store/appStore';
import { SiteQuestionnaire } from '@/src/types/SiteQuestionnaire';
import {
  ArrowLeft, Package, Wrench, Layers, Truck, Activity,
  MapPin, Building2, User, Phone, Calendar, Info, X,
  FileText, ArrowRightLeft, RotateCcw, ChevronRight
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { WaybillForm } from './WaybillForm';
import { CreateReturnWaybill } from './CreateReturnWaybill';
import { SiteTransactionsView } from './SiteTransactionsView';

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
  const { waybills, assets, maintenanceAssets } = useOperations();
  const [activeTab, setActiveTab] = useState<TabId>('materials');
  const [showReturnWaybill, setShowReturnWaybill] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

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

  const allItems = Array.from(inventoryMap.values()).filter(i => i.quantity > 0);

  // Filter by tab
  const materialItems = allItems.filter(i =>
    !['consumable', 'equipment'].includes(i.type || '') &&
    i.type !== 'consumable'
  );
  const machineItems = assets.filter(a => a.type === 'equipment' && allItems.find(i => i.assetId === a.id));
  const consumableItems = allItems.filter(i => i.type === 'consumable');

  const tabs: { id: TabId; label: string; count: number; icon: React.ElementType }[] = [
    { id: 'materials', label: 'Materials', count: allItems.length, icon: Package },
    { id: 'machines', label: 'Machines', count: maintenanceAssets.filter(m => m.site === site.name).length, icon: Wrench },
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

  if (showReturnWaybill) {
    return (
      <CreateReturnWaybill
        site={site}
        inventoryItems={allItems}
        onBack={() => setShowReturnWaybill(false)}
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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 dark:text-white">{site.name}</h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    site.status === 'Active'
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  )}
                >
                  {site.status.toLowerCase()}
                </Badge>
              </div>
              {questionnaire?.contactPersonPhone && (
                <p className="text-xs text-slate-400 font-medium">{questionnaire.contactPersonPhone}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 text-xs font-semibold"
            onClick={() => setShowReturnWaybill(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Return Waybill
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 text-xs font-semibold"
            onClick={() => setShowTransactions(true)}
          >
            <Activity className="h-3.5 w-3.5" /> Transactions
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowReportDialog(true)}
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 shrink-0">
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

            {/* Machines Tab */}
            {activeTab === 'machines' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {maintenanceAssets.filter(m => m.category === 'machine').length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Wrench className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No machines assigned to this site</p>
                  </div>
                ) : maintenanceAssets.filter(m => m.category === 'machine').map(machine => (
                  <div
                    key={machine.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{machine.name}</p>
                        <p className="text-xs text-slate-400">
                          Last service: {machine.lastServiceDate}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        machine.status === 'ok' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        machine.status === 'due_soon' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-rose-50 text-rose-700 border-rose-200"
                      )}
                    >
                      {machine.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Consumables Tab */}
            {activeTab === 'consumables' && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {consumableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Layers className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium text-slate-400">No consumables recorded</p>
                  </div>
                ) : consumableItems.map(item => (
                  <div
                    key={item.assetId}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 shrink-0">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{item.assetName}</p>
                        <p className="text-xs text-slate-400 capitalize">consumable</p>
                      </div>
                    </div>
                    <div className="text-right">
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
                ))}
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
                          <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">{wb.id}</p>
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
    </div>
  );
}

