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
      <DialogContent aria-describedby={undefined} className="max-w-xl p-0 overflow-hidden rounded-xl bg-card border-border shadow-2xl transition-all">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Select Machines</DialogTitle>
              <p className="text-muted-foreground font-semibold text-xs mt-0.5">Pick machines for this maintenance session</p>
            </div>
            <DialogClose className="h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search machines..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-background border-border font-medium text-sm rounded-lg" />
          </div>
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2 no-scrollbar">
          {filteredAssets.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Search className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-sm font-bold text-foreground">No results found</h3>
              <p className="text-muted-foreground font-medium text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredAssets.map((asset) => (
              <button key={asset.id} onClick={() => toggleSelect(asset.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
                  selectedIds.includes(asset.id)
                    ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                    : "bg-card border-border hover:border-border/80 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 hover:shadow-sm"
                )}>
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                  selectedIds.includes(asset.id) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                  {selectedIds.includes(asset.id) ? <Check className="h-5 w-5 stroke-[3px]" /> :
                    asset.category === 'machine' ? <Activity className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "font-semibold text-sm uppercase tracking-tight truncate",
                    selectedIds.includes(asset.id) ? "text-primary" : "text-foreground"
                  )}>{asset.name}</h4>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {asset.site} {asset.serialNumber ? `• S/N: ${asset.serialNumber}` : ''}
                  </span>
                </div>
                {asset.isActive && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md shrink-0">active</Badge>
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-border flex items-center justify-between bg-card">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{selectedIds.length} selected</span>
          <Button onClick={onClose}
            className="h-10 rounded-xl px-6 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-colors">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
