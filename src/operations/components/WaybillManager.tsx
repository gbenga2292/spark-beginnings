import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Truck, 
  ArrowRightLeft,
  Calendar,
  User,
  Package,
  FileCheck,
  ChevronRight,
  Printer,
  FileSearch,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Waybill, WaybillStatus, WaybillType } from '../types';

export function WaybillManager() {
  const { waybills, updateWaybillStatus } = useOperations();
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | WaybillType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredWaybills = waybills.filter(w => {
    const matchesSearch = w.siteName?.toLowerCase().includes(search.toLowerCase()) || 
                         w.driverName?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || w.type === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusInfo = (status: WaybillStatus) => {
    switch (status) {
      case 'outstanding': return { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock };
      case 'sent_to_site': return { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Truck };
      case 'partial_returned': return { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: ArrowRightLeft };
      case 'return_completed': return { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 };
      case 'open': return { color: 'text-slate-600 bg-slate-50 border-slate-200', icon: FileCheck };
      default: return { color: 'text-slate-600 bg-slate-50 border-slate-200', icon: Clock };
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logistics & Waybills</h2>
          <p className="text-sm text-slate-500">Track and manage asset movement between inventory and sites.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setShowCreateModal(true)}
             className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm"
           >
             <Plus className="h-4 w-4" />
             Create Waybill
           </button>
        </div>
      </div>

       {/* Stats Overview */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pending Logistics', count: waybills.filter(w => w.status === 'outstanding').length, color: 'text-amber-600' },
            { label: 'Assets on Site', count: waybills.filter(w => w.status === 'sent_to_site').length, color: 'text-blue-600' },
            { label: 'Returns in Progress', count: waybills.filter(w => w.status === 'partial_returned').length, color: 'text-orange-600' },
            { label: 'Today\'s Movements', count: waybills.filter(w => new Date(w.issueDate).toDateString() === new Date().toDateString()).length, color: 'text-indigo-600' },
          ].map((stat, i) => (
            <div key={i} className={cn(
              "px-6 py-4 rounded-xl border flex items-center justify-between",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 hover:border-slate-300"
            )}>
               <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
               <span className={cn("text-xl font-black", stat.color)}>{stat.count}</span>
            </div>
          ))}
       </div>

      {/* Filters Bar */}
      <div className={cn(
        "flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border",
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search site, driver or vehicle..." 
            className={cn(
              "w-full pl-10 pr-4 py-2 text-sm rounded-lg border transition-all focus:ring-1 focus:ring-indigo-500",
              isDark ? "bg-slate-950 border-slate-700 text-slate-200" : "bg-white border-slate-200"
            )}
          />
        </div>
        <div className="flex items-center gap-2">
           <Filter className="h-4 w-4 text-slate-400" />
           <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setFilter('all')}
                className={cn("px-3 py-1 text-xs rounded-md font-semibold font-medium transition-all", filter === 'all' ? "bg-white dark:bg-slate-700 shadow-xs text-indigo-600" : "text-slate-500")}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('waybill')}
                className={cn("px-3 py-1 text-xs rounded-md font-semibold font-medium transition-all", filter === 'waybill' ? "bg-white dark:bg-slate-700 shadow-xs text-indigo-600" : "text-slate-500")}
              >
                Waybills
              </button>
              <button 
                onClick={() => setFilter('return')}
                className={cn("px-3 py-1 text-xs rounded-md font-semibold font-medium transition-all", filter === 'return' ? "bg-white dark:bg-slate-700 shadow-xs text-indigo-600" : "text-slate-500")}
              >
                Returns
              </button>
           </div>
        </div>
      </div>

      {/* Waybills List */}
      <div className="space-y-4">
         {filteredWaybills.map((wb) => {
           const status = getStatusInfo(wb.status);
           return (
             <div key={wb.id} className={cn(
               "group rounded-2xl border p-5 transition-all hover:shadow-md relative overflow-hidden",
               isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
             )}>
                {/* Accent bar for type */}
                <div className={cn(
                  "absolute top-0 left-0 bottom-0 w-1",
                  wb.type === 'waybill' ? "bg-green-500" : "bg-blue-500"
                )} />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                   <div className="flex items-start gap-5">
                      <div className={cn(
                        "p-3 rounded-xl",
                        wb.type === 'waybill' ? "bg-green-50 dark:bg-green-900/20 text-green-600" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                      )}>
                         {wb.type === 'waybill' ? <Truck className="h-6 w-6" /> : <ArrowRightLeft className="h-6 w-6" />}
                      </div>
                      <div className="space-y-1">
                         <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg">{wb.id}</h3>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-widest",
                              status.color
                            )}>
                               <status.icon className="inline h-3 w-3 mr-1" />
                               {wb.status.replace('_', ' ')}
                            </span>
                         </div>
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 underline decoration-indigo-300 decoration-2 underline-offset-2 tracking-tight">
                               {wb.siteName}
                            </span>
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(wb.issueDate).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {wb.driverName}</span>
                         </div>
                      </div>
                   </div>

                   <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex items-center gap-2 p-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                         <Package className="h-4 w-4 text-slate-400" />
                         <span className="text-sm font-black text-slate-600 dark:text-slate-400 underline decoration-slate-300 underline-offset-4">{wb.items.length} Items Listed</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="flex items-center gap-2 p-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-xs font-bold transition-all hover:border-indigo-300">
                            <FileSearch className="h-3.5 w-3.5 text-indigo-500" />
                            Details
                         </button>
                         <button className="flex items-center gap-2 p-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-xs font-bold transition-all hover:border-indigo-300">
                            <Printer className="h-3.5 w-3.5 text-slate-500" />
                            Print
                         </button>
                         <button className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                            <MoreVertical className="h-4 w-4 text-slate-400" />
                         </button>
                      </div>
                   </div>
                </div>

                {/* Quick breakdown of items on hover/expanded */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-4 overflow-x-auto no-scrollbar">
                   {wb.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 shrink-0">
                         <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 rounded">{item.quantity}</span>
                         <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize">{item.assetName}</span>
                      </div>
                   ))}
                </div>
             </div>
           );
         })}
      </div>
    </div>
  );
}
