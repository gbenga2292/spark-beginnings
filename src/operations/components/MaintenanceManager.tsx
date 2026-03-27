import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  ClipboardList, 
  Settings2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  History, 
  Wrench, 
  Plus, 
  ChevronRight,
  MoreHorizontal,
  Activity,
  User,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

export function MaintenanceManager() {
  const { assets } = useOperations();
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');

  // Mock maintenance history
  const maintenanceLogs = [
    { id: 'MT-004', asset: '6" Dewatering Pump', cost: '$120.00', date: 'Oct 15, 2023', tech: 'Samuel Okon', type: 'scheduled', status: 'completed' },
    { id: 'MT-003', asset: 'Drilling Rig #1', cost: '$450.00', date: 'Oct 12, 2023', tech: 'Umar Sani', type: 'repair', status: 'completed' },
    { id: 'MT-002', asset: 'Submersible Pump 2"', cost: '$45.00', date: 'Oct 10, 2023', tech: 'Grace Eniola', type: 'routine', status: 'completed' },
  ];

  const upcomingMaintenance = [
    { id: 'MT-005', asset: 'Diesel Generator #1', date: 'Oct 28, 2023', type: 'scheduled' },
    { id: 'MT-006', asset: 'Vehicle A (Toyota Hiace)', date: 'Nov 02, 2023', type: 'routine' },
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-8 animate-in zoom-in-95 duration-500 overflow-y-auto no-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Machine Maintenance</h2>
          <p className="text-sm text-slate-500 font-medium">Track service records, schedule maintenance, and manage unit conditions.</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm">
             <Plus className="h-4 w-4" />
             Log New Service
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Log History */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
           <div className={cn(
             "rounded-3xl border flex-1 flex flex-col overflow-hidden",
             isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
           )}>
              <div className="px-6 py-5 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                 <h3 className="font-bold text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-500" />
                    Service History
                 </h3>
                 <div className="relative w-48">
                    <input 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search logs..." 
                      className={cn("w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                 </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto no-scrollbar">
                 {maintenanceLogs.map((log) => (
                    <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group relative">
                       <div className={cn(
                         "absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 opacity-0 group-hover:opacity-100",
                         log.type === 'repair' ? "bg-rose-500" : "bg-indigo-500"
                       )} />
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                             <div className={cn(
                               "mt-1 p-2.5 rounded-xl border-dashed border-2",
                               isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-300 group-hover:border-indigo-200 group-hover:text-indigo-400"
                             )}>
                                <Activity className="h-5 w-5" />
                             </div>
                             <div>
                                <div className="flex items-center gap-3 mb-1">
                                   <p className="font-bold text-lg leading-none">{log.asset}</p>
                                   <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded leading-none">{log.id}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium font-bold uppercase tracking-tight">
                                   <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {log.date}</span>
                                   <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {log.tech}</span>
                                   <span className="text-slate-300">•</span>
                                   <span className={cn(
                                     "capitalize font-black",
                                     log.type === 'repair' ? "text-rose-500" : "text-indigo-500"
                                   )}>{log.type === 'repair' ? <span>Urgent Repair</span> : <span>{log.type}</span>}</span>
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-6">
                             <div className="text-right">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1 leading-none">Maintenance Cost</p>
                                <p className="font-black text-slate-700 dark:text-slate-300 text-lg leading-none tracking-tight">{log.cost}</p>
                             </div>
                             <button className="p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-white dark:border-slate-800 dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-indigo-600">
                                <ArrowUpRight className="h-4 w-4" />
                             </button>
                          </div>
                       </div>
                    </div>
                 ))}
                 {maintenanceLogs.length > 5 && (
                    <button className="w-full py-6 text-xs font-black text-slate-400 bg-slate-50 dark:bg-slate-800/20 hover:bg-slate-100 transition-all uppercase tracking-widest">
                       VIEW COMPLETE SERVICE ARCHIVE
                    </button>
                 )}
              </div>
           </div>
        </div>

        {/* Sidebar Schedule & Summaries */}
        <div className="space-y-6">
           {/* Upcoming / Schedule */}
           <div className={cn(
             "rounded-3xl border p-6 flex flex-col relative group overflow-hidden bg-slate-900",
             "ring-4 ring-slate-950 shadow-2xl"
           )}>
              <div className="absolute top-0 right-0 p-6">
                 <Zap className="h-5 w-5 text-indigo-500 animate-pulse" />
              </div>
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white">
                 <Clock className="h-5 w-5 text-indigo-400" />
                 Upcoming
              </h3>
              <div className="space-y-5 flex-1 relative z-10">
                 {upcomingMaintenance.map((item) => (
                    <div key={item.id} className="p-4 rounded-2xl bg-slate-800/50 hover:bg-slate-800 transition-all border border-slate-700 group cursor-pointer relative">
                       <p className="text-[10px] font-black uppercase text-indigo-400 mb-1 tracking-widest opacity-80">{item.type} Checkup</p>
                       <h4 className="font-bold text-slate-200 group-hover:text-white transition-colors text-sm mb-2">{item.asset}</h4>
                       <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{item.date}</span>
                       </div>
                       <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-all translate-x-1 opacity-0 group-hover:opacity-100" />
                    </div>
                 ))}
                 <button className="w-full py-4 text-xs font-black text-indigo-400 bg-indigo-900/20 hover:bg-indigo-900/40 rounded-2xl transition-all border border-indigo-900/30 uppercase tracking-widest mt-4">
                    MANAGE MASTER SCHEDULE
                 </button>
              </div>
           </div>

           {/* Health Summary Card */}
           <div className={cn(
             "rounded-3xl border p-6 overflow-hidden",
             isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
           )}>
              <h3 className="font-bold mb-6 flex items-center gap-2">
                 <ShieldCheck className="h-5 w-5 text-emerald-500" />
                 Fleet Health
              </h3>
              <div className="space-y-6">
                 {[
                   { label: 'Equipment Available', val: '92%', status: 'optimal' },
                   { label: 'Mean Time Between Repairs', val: '22 Days', status: 'optimal' },
                   { label: 'Active Service Requests', val: '3 Units', status: 'warning' },
                 ].map((stat, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-tight leading-none">{stat.label}</span>
                       <span className={cn(
                         "text-sm font-black",
                         stat.status === 'warning' ? "text-amber-600" : "text-emerald-600"
                       )}>{stat.val}</span>
                    </div>
                 ))}
                 <div className="pt-6 border-t">
                    <div className="flex justify-between text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                       <span>Service Budget Used</span>
                       <span className="text-indigo-600">64%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 rounded-full" style={{ width: '64%' }} />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
