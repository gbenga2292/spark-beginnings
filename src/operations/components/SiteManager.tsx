import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  MapPin, 
  Search, 
  TrendingUp, 
  Package, 
  Truck, 
  History, 
  PieChart,
  Target,
  ArrowRightLeft,
  Calendar,
  ChevronRight,
  MoreVertical,
  Activity
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

export function SiteManager() {
  const { waybills, assets } = useOperations();
  const { isDark } = useTheme();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Derive unique sites from waybills for this prototype
  const sites = Array.from(new Set(waybills.map(w => w.siteId))).map(id => {
    const wb = waybills.find(w => w.siteId === id);
    return { id, name: wb?.siteName || 'Unknown Site' };
  });

  const selectedSite = selectedSiteId ? sites.find(s => s.id === selectedSiteId) : null;
  const siteWaybills = waybills.filter(w => w.siteId === selectedSiteId);
  
  // Calculate site inventory
  const siteInventory = siteWaybills.flatMap(w => w.items).reduce((acc, item) => {
    const existing = acc.find(a => a.assetId === item.assetId);
    if (existing) existing.quantity += item.quantity;
    else acc.push({ ...item });
    return acc;
  }, [] as { assetId: string, assetName: string, quantity: number }[]);

  return (
    <div className="p-6 h-full flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Site Operations</h2>
          <p className="text-sm text-slate-500">Track asset allocation and movement for specific project sites.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        {/* Sites Sidebar */}
        <div className={cn(
          "lg:col-span-1 rounded-2xl border flex flex-col overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
           <div className="p-4 border-b bg-slate-50 opacity-80 dark:bg-slate-800/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Active Project Sites</h3>
           </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sites.map(site => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all border",
                    selectedSiteId === site.id 
                      ? (isDark ? "bg-indigo-900/40 border-indigo-700/50 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm")
                      : (isDark ? "bg-transparent border-transparent text-slate-400 hover:bg-slate-800" : "bg-transparent border-transparent text-slate-600 hover:bg-slate-50")
                  )}
                >
                  <MapPin className={cn("h-4 w-4", selectedSiteId === site.id ? "text-indigo-500" : "text-slate-400")} />
                  <span className="text-sm font-semibold truncate text-left">{site.name}</span>
                </button>
              ))}
           </div>
           <div className="p-4 border-t mt-auto">
              <button className="w-full flex items-center justify-center gap-2 p-2 px-3 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-all">
                 <Target className="h-3.5 w-3.5" />
                 Register New Project
              </button>
           </div>
        </div>

        {/* Site Details Main Area */}
        <div className="lg:col-span-3 space-y-6 overflow-y-auto pr-2 no-scrollbar">
          {selectedSite ? (
            <>
              {/* Site Header Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 {[
                   { label: 'Waybills Total', value: siteWaybills.length, icon: Truck, color: 'indigo' },
                   { label: 'Assets on Site', value: siteInventory.length, icon: Package, color: 'blue' },
                   { label: 'Outstanding Returns', value: siteWaybills.filter(w => w.type === 'return' && w.status === 'outstanding').length, icon: ArrowRightLeft, color: 'amber' },
                 ].map((stat, i) => (
                    <div key={i} className={cn(
                      "p-5 rounded-2xl border transition-all",
                      isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                    )}>
                       <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-bold tracking-tight">{stat.label}</span>
                          <stat.icon className={cn("h-4 w-4", `text-${stat.color}-500`)} />
                       </div>
                       <h3 className="text-2xl font-black">{stat.value}</h3>
                    </div>
                 ))}
              </div>

              {/* Site Inventory & Logs */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 {/* Inventory Table */}
                 <div className={cn(
                   "rounded-2xl border overflow-hidden",
                   isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                 )}>
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                       <h3 className="font-bold flex items-center gap-2">
                          <Package className="h-4 w-4 text-indigo-500" />
                          Site Inventory
                       </h3>
                       <button className="text-xs font-bold text-indigo-600">Audit Site</button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                       <table className="w-full text-xs text-left">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 font-bold uppercase tracking-wider text-slate-400 z-10 border-b">
                             <tr>
                                <th className="px-5 py-3">Asset</th>
                                <th className="px-5 py-3 text-right">Quantity</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {siteInventory.map((item, idx) => (
                               <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-300 capitalize underline underline-offset-4 decoration-indigo-200">{item.assetName}</td>
                                  <td className="px-5 py-3 text-right">
                                     <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-black">{item.quantity}</span>
                                  </td>
                               </tr>
                             ))}
                             {siteInventory.length === 0 && (
                               <tr>
                                  <td colSpan={2} className="px-5 py-8 text-center text-slate-400 italic">No assets currently at this site.</td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Activity History */}
                 <div className={cn(
                   "rounded-2xl border p-6 overflow-hidden flex flex-col",
                   isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                 )}>
                    <h3 className="font-bold mb-6 flex items-center gap-2">
                       <History className="h-4 w-4 text-indigo-500" />
                       Recent Waybills
                    </h3>
                    <div className="space-y-4 flex-1">
                       {siteWaybills.slice(0, 4).map(wb => (
                         <div key={wb.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-2 border-transparent hover:border-indigo-100 group">
                            <div className={cn(
                              "mt-1 p-2 rounded-lg",
                              wb.type === 'waybill' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                            )}>
                               {wb.type === 'waybill' ? <Truck className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-0.5">
                                  <p className="font-bold text-sm truncate">{wb.id}</p>
                                  <span className="text-[10px] text-slate-400 font-bold">{new Date(wb.issueDate).toLocaleDateString()}</span>
                               </div>
                               <p className="text-xs text-slate-500 line-clamp-1 truncate uppercase tracking-tight">{wb.items.map(i => i.assetName).join(', ')}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all self-center" />
                         </div>
                       ))}
                       {siteWaybills.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center py-12 text-slate-300">
                            <Activity className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-sm italic">No recent activity detected.</p>
                         </div>
                       )}
                    </div>
                    {siteWaybills.length > 0 && (
                       <button className="mt-4 w-full py-2 text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all">VIEW SITE TRANSACTION LOG</button>
                    )}
                 </div>
              </div>
            </>
          ) : (
            <div className={cn(
              "h-full rounded-2xl border flex flex-col items-center justify-center p-12 text-center",
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
               <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-full mb-4">
                  <MapPin className="h-12 w-12 text-slate-300" />
               </div>
               <h3 className="text-xl font-black text-slate-700 dark:text-slate-300 mb-2">No Site Selected</h3>
               <p className="text-sm text-slate-400 max-w-xs">Choose a project site from the left menu to view its real-time inventory and logistics history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
