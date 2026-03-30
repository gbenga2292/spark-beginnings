import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, 
  Search, 
  Eye,
  Edit2,
  Trash2,
  Send,
  Calendar,
  User,
  Package,
  Truck,
  ArrowRightLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Waybill, WaybillStatus, WaybillType } from '../types';
import { WaybillDetailView } from './WaybillDetailView';

import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs"

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function WaybillManager() {
  const { waybills, updateWaybillStatus, deleteWaybill } = useOperations();
  const { isDark } = useTheme();
  const [waybillSearch, setWaybillSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingWaybill, setViewingWaybill] = useState<Waybill | null>(null);
  const [activeTab, setActiveTab] = useState<'waybill' | 'return'>('waybill');

  useSetPageTitle(
    'Logistics Management',
    'Track and manage asset deliveries (Waybills) and site returns',
    <div className="flex items-center gap-2">
      <Button 
        size="sm" 
        className="gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-4 w-4" /> Create Waybill
      </Button>
    </div>
  );

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
      case 'outstanding': return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 font-bold px-3 py-0.5 rounded-full text-[10px] uppercase">Outstanding</Badge>;
      case 'sent_to_site': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-bold px-3 py-0.5 rounded-full text-[10px] uppercase">Sent to Site</Badge>;
      case 'return_completed': return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 font-bold px-3 py-0.5 rounded-full text-[10px] uppercase">Completed</Badge>;
      default: return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold px-3 py-0.5 rounded-full text-[10px] uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      {viewingWaybill && (
        <WaybillDetailView 
          waybill={viewingWaybill} 
          onClose={() => setViewingWaybill(null)} 
        />
      )}
      
      {/* Compact Tabs */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 items-center overflow-x-auto no-scrollbar gap-1 w-fit">
        {[
          { id: 'waybill', label: 'Waybills', count: outgoingWaybills.length },
          { id: 'return', label: 'Returns', count: incomingReturns.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 uppercase tracking-wider",
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600'
            )}
          >
            {tab.label}
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px]",
              activeTab === tab.id ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <Tabs className="w-full">
        <TabsContent active={activeTab === 'waybill'} className="space-y-6 animate-in slide-in-from-left-4 duration-300">
          <Card className="shadow-sm border border-slate-100 bg-white dark:bg-slate-900 p-4">
            <div className="relative w-full max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input 
                  value={waybillSearch}
                  onChange={(e) => setWaybillSearch(e.target.value)}
                  placeholder="Search waybills by ID, driver, or vehicle..." 
                  className="pl-10 bg-slate-50/50 border-transparent dark:bg-slate-950 focus-visible:ring-blue-500 font-medium text-sm h-11 rounded-xl"
                />
            </div>
          </Card>

          <div className="rounded-xl border border-slate-100/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 border-b-slate-100 dark:border-slate-800 h-12">
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400 pl-6 w-[120px]">Waybill ID</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Driver & Vehicle</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Destination</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Date</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Items Summary</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOutgoing.map((wb) => (
                    <TableRow key={wb.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 border-b-slate-50 dark:border-slate-800 h-16">
                      <TableCell className="pl-6">
                        <span className="font-black text-slate-900 dark:text-white">{wb.id}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{wb.driverName}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase">{wb.vehicle || 'L200'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{wb.siteName}</span>
                           <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">from DCEL Warehouse</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-[11px]">
                          <span className="font-bold text-slate-800 dark:text-slate-300">{new Date(wb.issueDate).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(wb.status)}
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-500 truncate block max-w-[150px]">
                          {wb.items.map(i => `${i.quantity} ${i.assetName}`).join(', ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 rounded-lg"
                            onClick={() => setViewingWaybill(wb)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 rounded-lg"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg" onClick={() => deleteWaybill(wb.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent active={activeTab === 'return'} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <Card className="shadow-sm border border-slate-100 bg-white dark:bg-slate-900 p-4">
            <div className="relative w-full max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input 
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  placeholder="Search returns by ID, driver, or vehicle..." 
                  className="pl-10 bg-slate-50/50 border-transparent dark:bg-slate-950 focus-visible:ring-blue-500 font-medium text-sm h-11 rounded-xl"
                />
            </div>
          </Card>

          <div className="rounded-xl border border-slate-100/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 border-b-slate-100 dark:border-slate-800 h-12">
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400 pl-6 w-[120px]">Return ID</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Driver & Vehicle</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Source Site</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Date</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Items Summary</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-400 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncoming.map((rb) => (
                    <TableRow key={rb.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 border-b-slate-50 dark:border-slate-800 h-16">
                      <TableCell className="pl-6">
                        <span className="font-black text-slate-900 dark:text-white">{rb.id}</span>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{rb.driverName}</span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase">{rb.vehicle || 'SIENNA'}</span>
                         </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{rb.siteName}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Return to Warehouse</span>
                         </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-[11px]">
                          <span className="font-bold text-slate-800 dark:text-slate-300">{new Date(rb.issueDate).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(rb.status)}
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-500 truncate block max-w-[150px]">
                          {rb.items.map(i => `${i.quantity} ${i.assetName}`).join(', ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 rounded-lg" 
                          onClick={() => setViewingWaybill(rb)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
