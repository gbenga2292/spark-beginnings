import React, { useState } from 'react';
import { useOperations } from '../../contexts/OperationsContext';
import { 
  X, 
  Search, 
  MapPin, 
  CheckCircle2, 
  Truck,
  HardHat,
  Monitor,
  Activity,
  Check
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { MaintenanceAsset } from '../../types';

interface SelectAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}

export function SelectAssetsModal({ isOpen, onClose, selectedIds, onSelect }: SelectAssetsModalProps) {
  const { maintenanceAssets } = useOperations();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAssets = maintenanceAssets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter(aid => aid !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-white animate-in zoom-in-95 duration-500">
        <DialogHeader className="p-10 pb-4 border-b border-slate-50 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
             <div>
                <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">Select Machines</DialogTitle>
                <p className="text-slate-400 font-bold text-xs mt-1">Search and pick the machines for this maintenance session</p>
             </div>
             <DialogClose className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all">
                <X className="h-5 w-5" />
             </DialogClose>
          </div>
          <div className="relative mt-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
            <Input 
              placeholder="Search machines..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 rounded-2xl bg-slate-50 border-transparent font-medium shadow-sm transition-all focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </DialogHeader>
        
        <div className="max-h-[500px] overflow-y-auto p-10 pt-4 space-y-4 no-scrollbar">
          {filteredAssets.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
               <Search className="h-14 w-14 text-slate-200 mb-6" />
               <h3 className="text-lg font-black text-slate-900">No results found</h3>
               <p className="text-slate-400 font-bold text-sm mt-1">Try searching for a different name or S/N</p>
            </div>
          ) : (
            filteredAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => toggleSelect(asset.id)}
                className={cn(
                  "w-full flex items-center gap-6 p-6 rounded-3xl border transition-all text-left group",
                  selectedIds.includes(asset.id) 
                    ? "bg-blue-50/50 border-blue-200 ring-2 ring-blue-100" 
                    : "bg-white border-slate-50 hover:border-slate-200 hover:shadow-lg"
                )}
              >
                <div className={cn(
                   "h-12 w-12 rounded-2xl flex items-center justify-center transition-all",
                   selectedIds.includes(asset.id) ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600"
                )}>
                   {selectedIds.includes(asset.id) ? (
                      <Check className="h-6 w-6 stroke-[3px]" />
                   ) : (
                      asset.category === 'machine' ? <Activity className="h-6 w-6" /> : <Truck className="h-6 w-6" />
                   )}
                </div>
                <div className="flex-1">
                  <h4 className={cn(
                    "font-black text-slate-900 uppercase tracking-tight",
                    selectedIds.includes(asset.id) && "text-blue-700"
                  )}>{asset.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{asset.site} • {asset.id}</span>
                </div>
                {asset.isActive && (
                  <Badge className="bg-blue-100 text-blue-600 border-0 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full">
                    active
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="p-8 border-t border-slate-50 bg-slate-50/10 flex items-center justify-between">
           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedIds.length} assets selected</span>
           <Button 
             onClick={onClose}
             className="h-14 rounded-2xl px-10 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 gap-3"
           >
              Done Selection
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
