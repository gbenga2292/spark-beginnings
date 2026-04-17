import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, Search, Eye, Edit2, Trash2, Truck, ArrowRightLeft, ListFilter
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Waybill, WaybillStatus } from '../types/operations';
import { WaybillDetailView } from './WaybillDetailView';
import { WaybillForm } from './WaybillForm';

import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';

import { useSetPageTitle } from '@/src/contexts/PageContext';

function WaybillManagerHeader({ onCreate }: { onCreate: () => void }) {
  useSetPageTitle(
    'Logistics Management',
    'Track and manage asset deliveries (Waybills) and site returns',
    <div className="hidden sm:flex items-center gap-2">
      <Button size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700 text-white h-9" onClick={onCreate}>
        <Plus className="h-4 w-4" /> Create Waybill
      </Button>
    </div>
  );
  return null;
}

export function WaybillManager() {
  const { waybills, updateWaybillStatus, deleteWaybill } = useOperations();
  const { isDark } = useTheme();
  const [waybillSearch, setWaybillSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingWaybill, setViewingWaybill] = useState<Waybill | null>(null);
  const [activeTab, setActiveTab] = useState<'waybill' | 'return'>('waybill');

  const outgoingWaybills = waybills.filter(w => w.type === 'waybill');
  const incomingReturns = waybills.filter(w => w.type === 'return');


  const filteredOutgoing = outgoingWaybills.filter(w => 
    w.id.toLowerCase().includes(waybillSearch.toLowerCase()) ||
    w.driverName?.toLowerCase().includes(waybillSearch.toLowerCase()) ||
    w.vehicle?.toLowerCase().includes(waybillSearch.toLowerCase())
  );

  const filteredIncoming = incomingReturns.filter(w => 
    w.id.toLowerCase().includes(returnSearch.toLowerCase()) ||
    w.driverName?.toLowerCase().includes(returnSearch.toLowerCase()) ||
    w.vehicle?.toLowerCase().includes(returnSearch.toLowerCase())
  );

  const getStatusBadge = (status: WaybillStatus) => {
    switch (status) {
      case 'outstanding': return <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 font-semibold px-2 py-0.5 rounded-full text-[11px]">Outstanding</Badge>;
      case 'sent_to_site': return <Badge variant="outline" className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 font-semibold px-2 py-0.5 rounded-full text-[11px]">Sent to Site</Badge>;
      case 'return_completed': return <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 font-semibold px-2 py-0.5 rounded-full text-[11px]">Completed</Badge>;
      default: return <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 font-semibold px-2 py-0.5 rounded-full text-[11px]">{status}</Badge>;
    }
  };

  const currentItems = activeTab === 'waybill' ? filteredOutgoing : filteredIncoming;
  const currentSearch = activeTab === 'waybill' ? waybillSearch : returnSearch;
  const setCurrentSearch = activeTab === 'waybill' ? setWaybillSearch : setReturnSearch;

  // ── Full-page detail view (replaces list entirely) ────────────────────
  if (viewingWaybill) {
    return <WaybillDetailView waybill={viewingWaybill} onClose={() => setViewingWaybill(null)} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <WaybillManagerHeader onCreate={() => setShowCreateModal(true)} />
      {showCreateModal && <WaybillForm onClose={() => setShowCreateModal(false)} />}

      {/* Mobile Actions */}
      <div className="flex sm:hidden flex-wrap gap-2 px-1">
        <Button className="flex-1 gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" /> Create Waybill
        </Button>
      </div>

      {/* Table Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              {activeTab === 'waybill' ? 'Waybills' : 'Returns'} <span className="text-slate-400 font-normal">({currentItems.length})</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
              {[
                { id: 'waybill' as const, label: 'Waybills', count: outgoingWaybills.length },
                { id: 'return' as const, label: 'Returns', count: incomingReturns.length },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold",
                    activeTab === tab.id ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                  )}>{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search by ID, driver, or vehicle..." className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm"
                value={currentSearch} onChange={e => setCurrentSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-teal-700 border-b border-teal-800 text-teal-50 uppercase text-[11px] tracking-wider font-bold">
                <th className="px-5 py-4 whitespace-nowrap">{activeTab === 'waybill' ? 'Waybill' : 'Return'} ID</th>
                <th className="px-5 py-4 whitespace-nowrap">Driver & Vehicle</th>
                <th className="px-5 py-4 whitespace-nowrap">{activeTab === 'waybill' ? 'Destination' : 'Source Site'}</th>
                <th className="px-5 py-4 whitespace-nowrap">Date</th>
                <th className="px-5 py-4 whitespace-nowrap">Status</th>
                <th className="px-5 py-4 min-w-[150px]">Items Summary</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border dark:border-slate-700">
                        <Truck className="h-5 w-5 text-slate-400" />
                      </div>
                      <p>No {activeTab === 'waybill' ? 'waybills' : 'returns'} found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((wb) => (
                  <tr key={wb.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{wb.id}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{wb.driverName}</span>
                        <span className="text-xs text-slate-400 font-medium">{wb.vehicle || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">{wb.siteName}</span>
                        <span className="text-xs text-slate-400">{activeTab === 'waybill' ? 'from Warehouse' : 'Return to Warehouse'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                      {formatDisplayDate(wb.issueDate)}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(wb.status)}</td>
                    <td className="px-5 py-4 max-w-xs text-slate-600 dark:text-slate-400 text-xs">
                      {wb.items.map(i => `${i.quantity} ${i.assetName}`).join(', ')}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                          onClick={() => setViewingWaybill(wb)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {activeTab === 'waybill' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                              onClick={() => deleteWaybill(wb.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
