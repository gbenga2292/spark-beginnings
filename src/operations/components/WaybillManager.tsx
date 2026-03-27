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
      case 'outstanding': return <Badge className="bg-amber-400 hover:bg-amber-500 text-white border-0 font-bold px-4 py-1 rounded-full">Outstanding</Badge>;
      case 'sent_to_site': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 font-bold px-4 py-1 rounded-full">Sent to Site</Badge>;
      case 'return_completed': return <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 font-bold px-4 py-1 rounded-full">Completed</Badge>;
      default: return <Badge className="bg-slate-400 text-white border-0 font-bold px-4 py-1 rounded-full">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-10 pb-20 px-8 mt-4 animate-in fade-in duration-500">
      {viewingWaybill && (
        <WaybillDetailView 
          waybill={viewingWaybill} 
          onClose={() => setViewingWaybill(null)} 
        />
      )}
      
      <Tabs className="w-full">
        <TabsList className="bg-slate-50 border border-slate-100 p-1.5 rounded-2xl h-16 w-fit mb-12 shadow-sm">
          <TabsTrigger 
            active={activeTab === 'waybill'} 
            onClick={() => setActiveTab('waybill')}
            className={cn(
               "rounded-xl px-14 h-full font-black uppercase text-[11px] tracking-widest transition-all duration-300",
               activeTab === 'waybill' ? "bg-blue-600 text-white shadow-xl shadow-blue-500/20" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Waybills
          </TabsTrigger>
          <TabsTrigger 
            active={activeTab === 'return'} 
            onClick={() => setActiveTab('return')}
            className={cn(
               "rounded-xl px-14 h-full font-black uppercase text-[11px] tracking-widest transition-all duration-300",
               activeTab === 'return' ? "bg-blue-600 text-white shadow-xl shadow-blue-500/20" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Returns
          </TabsTrigger>
        </TabsList>

        <TabsContent active={activeTab === 'waybill'} className="space-y-8 animate-in slide-in-from-left-4 duration-300">
          <div className="flex flex-col gap-4">
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="w-fit bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-bold flex items-center gap-2 px-6 h-12 rounded-xl"
            >
              <Plus className="h-5 w-5" />
              Create Waybill
            </Button>
            
            <div>
              <h1 className="text-4xl font-black tracking-tight text-blue-600">Waybill Management</h1>
              <p className="text-slate-400 font-medium mt-1">Track and manage asset deliveries and returns</p>
            </div>
          </div>

          <Card className="shadow-none border border-slate-100 bg-white p-4 rounded-2xl">
            <div className="relative w-full max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                <Input 
                  value={waybillSearch}
                  onChange={(e) => setWaybillSearch(e.target.value)}
                  placeholder="Search waybills by ID, driver, or vehicle..." 
                  className="pl-12 bg-slate-50/50 border-transparent focus-visible:ring-blue-500 font-medium text-sm h-14 rounded-2xl"
                />
            </div>
          </Card>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-slate-100 h-14">
                  <TableHead className="font-bold text-xs uppercase text-slate-400 pl-8">Waybill ID</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Driver</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">From</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Vehicle</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Created On</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">To</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Items</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400 text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOutgoing.map((wb) => (
                  <TableRow key={wb.id} className="hover:bg-slate-50/30 border-b-slate-50 h-20">
                    <TableCell className="pl-8">
                      <span className="font-black text-slate-900">{wb.id}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{wb.driverName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-500 text-xs uppercase">DCEL Warehouse</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-700">{wb.vehicle || 'L200'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-[11px]">
                        <span className="font-bold text-slate-800">{new Date(wb.issueDate).toLocaleDateString()}</span>
                        <span className="text-slate-400 font-medium whitespace-nowrap">by Hubert Davies</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-700">{wb.siteName}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(wb.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-slate-600 truncate block max-w-[120px]">
                        {wb.items.map(i => `${i.quantity}x ${i.assetName}`).join(', ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          onClick={() => setViewingWaybill(wb)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600"><Edit2 className="h-4 w-4" /></Button>
                        <Button className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-[11px] h-8 px-4 rounded-lg flex items-center gap-2">
                            <Send className="h-3 w-3" />
                            Send
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => deleteWaybill(wb.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent active={activeTab === 'return'} className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-blue-600">Returns Management</h1>
            <p className="text-slate-400 font-medium mt-1">Track and manage asset returns</p>
          </div>

          <Card className="shadow-none border border-slate-100 bg-white p-4 rounded-2xl">
            <div className="relative w-full max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                <Input 
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  placeholder="Search returns by ID, driver, or vehicle..." 
                  className="pl-12 bg-slate-50/50 border-transparent focus-visible:ring-blue-500 font-medium text-sm h-14 rounded-2xl"
                />
            </div>
          </Card>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-slate-100 h-14">
                  <TableHead className="font-bold text-xs uppercase text-slate-400 pl-8">Return ID</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Driver</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">To</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Vehicle</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Created On</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Return From</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400">Items</TableHead>
                  <TableHead className="font-bold text-xs uppercase text-slate-400 text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncoming.map((rb) => (
                  <TableRow key={rb.id} className="hover:bg-slate-50/30 border-b-slate-50 h-20">
                    <TableCell className="pl-8">
                      <span className="font-black text-slate-900">{rb.id}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-700">{rb.driverName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-500 text-xs uppercase">DCEL Warehouse</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-700 uppercase">{rb.vehicle || 'SIENNA'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-[11px]">
                        <span className="font-bold text-slate-800">{new Date(rb.issueDate).toLocaleDateString()}</span>
                        <span className="text-slate-400 font-medium whitespace-nowrap">Alonge Olatunde</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-700">{rb.siteName}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(rb.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-slate-600 truncate block max-w-[120px]">
                        {rb.items.map(i => `${i.quantity}x ${i.assetName}`).join(', ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setViewingWaybill(rb)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
