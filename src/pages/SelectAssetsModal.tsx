import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { X, Search, Activity, Truck, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

interface SelectAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}

export function SelectAssetsModal({ isOpen, onClose, selectedIds, onSelect }: SelectAssetsModalProps) {
  const { maintenanceAssets } = useOperations();
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAssets = maintenanceAssets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) onSelect(selectedIds.filter(aid => aid !== id));
    else onSelect([...selectedIds, id]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">Select Machines</DialogTitle>
              <p className="text-slate-400 font-bold text-xs mt-0.5">Pick machines for this maintenance session</p>
            </div>
            <DialogClose className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input placeholder="Search machines..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm" />
          </div>
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2 no-scrollbar">
          {filteredAssets.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Search className="h-10 w-10 text-slate-200 dark:text-slate-700 mb-4" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">No results found</h3>
              <p className="text-slate-400 font-bold text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredAssets.map((asset) => (
              <button key={asset.id} onClick={() => toggleSelect(asset.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
                  selectedIds.includes(asset.id)
                    ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-800"
                    : isDark ? "bg-slate-800/30 border-slate-800 hover:border-slate-700" : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                )}>
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                  selectedIds.includes(asset.id) ? "bg-blue-600 text-white" : isDark ? "bg-slate-800 text-slate-500" : "bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600"
                )}>
                  {selectedIds.includes(asset.id) ? <Check className="h-5 w-5 stroke-[3px]" /> :
                    asset.category === 'machine' ? <Activity className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "font-black text-sm uppercase tracking-tight truncate",
                    selectedIds.includes(asset.id) ? "text-blue-700 dark:text-blue-400" : "text-slate-900 dark:text-white"
                  )}>{asset.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{asset.site} • {asset.id}</span>
                </div>
                {asset.isActive && (
                  <Badge className="bg-blue-100 dark:bg-blue-900/20 text-blue-600 border-0 font-black uppercase text-[9px] px-2 py-0.5 rounded-full shrink-0">active</Badge>
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedIds.length} selected</span>
          <Button onClick={onClose}
            className="h-10 rounded-xl px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest shadow-sm">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
