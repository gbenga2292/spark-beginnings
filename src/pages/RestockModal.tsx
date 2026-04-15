import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { X, Package, Plus, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';

interface RestockModalProps {
  onClose: () => void;
  preselectedAssetId?: string;
}

interface RestockItem {
  id: string;
  assetId: string;
  quantity: number;
  totalCost: number;
}

export function RestockModal({ onClose, preselectedAssetId }: RestockModalProps) {
  const { assets, restockAssets } = useOperations();
  const [items, setItems] = useState<RestockItem[]>([
    { id: crypto.randomUUID(), assetId: preselectedAssetId || '', quantity: 0, totalCost: 0 }
  ]);

  const handleAddItem = () =>
    setItems(prev => [...prev, { id: crypto.randomUUID(), assetId: '', quantity: 0, totalCost: 0 }]);

  const handleRemoveItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const handleUpdate = (id: string, field: keyof RestockItem, value: any) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const handleRestock = () => {
    const valid = items.filter(i => i.assetId && i.quantity > 0);
    if (!valid.length) return;
    restockAssets(valid.map(i => ({ assetId: i.assetId, quantity: i.quantity, totalCost: i.totalCost })));
    onClose();
  };

  const isValid = items.some(i => i.assetId && i.quantity > 0);

  const selectCls = [
    'w-full h-9 pl-3 pr-8 rounded-lg text-sm font-medium appearance-none outline-none',
    'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
    'text-slate-700 dark:text-slate-200',
    'focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500',
    'transition-all',
  ].join(' ');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-800 dark:text-white leading-none">Restock Assets</DialogTitle>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">Inventory Management</p>
            </div>
          </div>
          <DialogClose className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors">
            <X className="h-3.5 w-3.5" />
          </DialogClose>
        </DialogHeader>

        {/* Column Headers */}
        <div className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-2 px-5 pt-3 pb-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cost (₦)</span>
          <span className="w-6" />
        </div>

        {/* Items */}
        <div className="px-5 pb-2 space-y-2 max-h-[45vh] overflow-y-auto no-scrollbar">
          {items.map(item => {
            const unitCost = item.quantity > 0 ? (item.totalCost / item.quantity) : 0;
            return (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-2 items-center">
                {/* Asset select */}
                <div className="relative">
                  <select
                    value={item.assetId}
                    onChange={e => handleUpdate(item.id, 'assetId', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select asset</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Qty */}
                <input
                  type="number"
                  min={1}
                  placeholder="0"
                  value={item.quantity || ''}
                  onChange={e => handleUpdate(item.id, 'quantity', Number(e.target.value))}
                  className={cn(
                    'h-9 px-2 rounded-lg text-sm font-bold text-center outline-none',
                    'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
                    'focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all w-full'
                  )}
                />

                {/* Cost + derived unit cost */}
                <div className="space-y-0.5">
                  <input
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={item.totalCost || ''}
                    onChange={e => handleUpdate(item.id, 'totalCost', Number(e.target.value))}
                    className={cn(
                      'h-9 px-2 rounded-lg text-sm font-bold outline-none w-full',
                      'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
                      'focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all'
                    )}
                  />
                  {unitCost > 0 && (
                    <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold text-right pr-1">
                      ₦{unitCost.toFixed(2)}/unit
                    </p>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={items.length === 1}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-0 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add row */}
        <button
          onClick={handleAddItem}
          className="mx-5 mb-3 flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add another asset
        </button>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-medium">
            {items.filter(i => i.assetId && i.quantity > 0).length} item(s) ready
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-8 px-4 rounded-lg font-bold text-xs text-slate-500 border-slate-200 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestock}
              disabled={!isValid}
              className="h-8 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-all"
            >
              Restock
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
