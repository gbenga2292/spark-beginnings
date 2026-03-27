import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Package, 
  AlertTriangle,
  ChevronRight,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  FileText
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Asset, AssetCategory, AssetCondition } from '../types';

export function AssetManager() {
  const { assets, updateAsset, deleteAsset } = useOperations();
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || a.category === filter;
    return matchesSearch && matchesFilter;
  });

  const getConditionColor = (condition: AssetCondition) => {
    switch (condition) {
      case 'good': return 'text-green-600 bg-green-50';
      case 'fair': return 'text-amber-600 bg-amber-50';
      case 'poor': return 'text-orange-600 bg-orange-50';
      case 'damaged': return 'text-rose-600 bg-rose-50';
      case 'missing': return 'text-slate-600 bg-slate-100';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assets & Inventory</h2>
          <p className="text-sm text-slate-500">Manage your operational assets and track their status.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-slate-200/50 dark:bg-slate-800 rounded-lg p-1 shrink-0">
             <button 
               onClick={() => setViewMode('table')}
               className={cn("p-1.5 rounded-md transition-all", viewMode === 'table' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-700")}
             >
               <List className="h-4 w-4" />
             </button>
             <button 
               onClick={() => setViewMode('grid')}
               className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-700")}
             >
               <LayoutGrid className="h-4 w-4" />
             </button>
           </div>
           <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm">
             <Plus className="h-4 w-4" />
             Add Asset
           </button>
        </div>
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
            placeholder="Search assets..." 
            className={cn(
              "w-full pl-10 pr-4 py-2 text-sm rounded-lg border transition-all focus:ring-1 focus:ring-indigo-500",
              isDark ? "bg-slate-950 border-slate-700 text-slate-200" : "bg-white border-slate-200"
            )}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className={cn(
              "text-sm px-3 py-2 rounded-lg border bg-transparent pr-8",
              isDark ? "border-slate-700 text-slate-200" : "border-slate-200"
            )}
          >
            <option value="all">All Categories</option>
            <option value="dewatering">Dewatering</option>
            <option value="waterproofing">Waterproofing</option>
            <option value="tiling">Tiling</option>
            <option value="ppe">PPE</option>
          </select>
        </div>
      </div>

      {/* Assets Display */}
      {viewMode === 'table' ? (
        <div className={cn(
          "rounded-2xl border overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className={cn(
                  "border-b uppercase text-[10px] font-bold tracking-wider",
                  isDark ? "bg-slate-950 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
                )}>
                  <th className="px-6 py-4">Asset Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:scale-110 transition-transform">
                          <Package className="h-4 w-4 text-indigo-500" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{asset.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize text-slate-500">{asset.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize text-slate-500">{asset.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center gap-2">
                          <span className="font-bold underline decoration-indigo-300 decoration-2 underline-offset-2">{asset.availableQuantity}</span>
                          <span className="text-slate-400">/ {asset.quantity} {asset.unitOfMeasurement}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={cn(
                         "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                         getConditionColor(asset.condition)
                       )}>
                         {asset.condition}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
                         <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                         <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-blue-600"><FileText className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {filteredAssets.map(asset => (
             <div key={asset.id} className={cn(
               "p-6 rounded-2xl border hover:shadow-lg transition-all relative overflow-hidden group",
               isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
             )}>
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <MoreVertical className="h-5 w-5 text-slate-400 cursor-pointer" />
                </div>
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl w-fit">
                    <Package className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{asset.name}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">{asset.category} • {asset.type}</p>
                  </div>
                  <div className="flex items-end justify-between">
                     <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-wider">Availability</p>
                        <div className="flex items-baseline gap-1">
                           <span className="text-2xl font-black text-indigo-600">{asset.availableQuantity}</span>
                           <span className="text-sm text-slate-400 font-medium">/ {asset.quantity} {asset.unitOfMeasurement}</span>
                        </div>
                     </div>
                     <div className={cn(
                       "px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1",
                       getConditionColor(asset.condition)
                     )}>
                       {asset.condition === 'damaged' && <AlertTriangle className="h-3 w-3" />}
                       {asset.condition}
                     </div>
                  </div>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
