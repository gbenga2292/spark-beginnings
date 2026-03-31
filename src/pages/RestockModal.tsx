import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { X, Package, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';

interface RestockModalProps {
  onClose: () => void;
}

interface RestockItem {
  id: string;
  assetId: string;
  quantity: number;
  totalCost: number;
}

export function RestockModal({ onClose }: RestockModalProps) {
  const { assets, restockAssets } = useOperations();
  const { isDark } = useTheme();
  const [items, setItems] = useState<RestockItem[]>([
    { id: Math.random().toString(36).substr(2, 9), assetId: '', quantity: 0, totalCost: 0 }
  ]);

  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(36).substr(2, 9), assetId: '', quantity: 0, totalCost: 0 }]);
  };

  const handleUpdateItem = (id: string, field: keyof RestockItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRestock = () => {
    const validItems = items.filter(i => i.assetId && i.quantity > 0);
    if (validItems.length === 0) return;
    restockAssets(validItems.map(i => ({ assetId: i.assetId, quantity: i.quantity, totalCost: i.totalCost })));
    onClose();
  };

  const selectClass = "w-full h-11 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-950 border border-transparent focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-sm text-slate-700 dark:text-slate-200 appearance-none";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-slate-800 dark:text-white" />
            <DialogTitle className="text-lg font-bold">Restock Assets</DialogTitle>
          </div>
          <DialogClose className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[65vh] no-scrollbar p-6">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[2fr,1fr,1.5fr,1fr] gap-4 px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quantity</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Cost</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Cost</span>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {items.map((item) => {
                const unitCost = item.quantity > 0 ? (item.totalCost / item.quantity).toFixed(2) : "0.00";
                return (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1.5fr,1fr] gap-4 p-4 md:px-6 md:py-4 items-center">
                    <div className="relative">
                      <select value={item.assetId} onChange={e => handleUpdateItem(item.id, 'assetId', e.target.value)} className={selectClass}>
                        <option value="">Select asset</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <Input type="number" placeholder="Qty" value={item.quantity || ''}
                      onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                      className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-bold text-sm text-center" />
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₦</span>
                      <Input type="number" placeholder="Cost" value={item.totalCost || ''}
                        onChange={e => handleUpdateItem(item.id, 'totalCost', Number(e.target.value))}
                        className="h-11 pl-8 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-bold text-sm" />
                    </div>
                    <div className="text-center">
                      <span className="font-black text-slate-800 dark:text-white text-sm">₦{unitCost}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleAddItem}
              className="w-full py-4 flex items-center justify-center gap-2 font-bold text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800">
              <Plus className="h-4 w-4" /> Add Another Asset
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-xl font-bold text-xs uppercase text-slate-500">Cancel</Button>
          <Button onClick={handleRestock} disabled={items.some(i => !i.assetId || i.quantity <= 0)}
            className="h-10 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase shadow-sm disabled:opacity-50">
            Restock Assets
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
