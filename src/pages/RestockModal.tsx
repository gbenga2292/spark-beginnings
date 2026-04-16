import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { X, Package, Plus, ChevronDown, Trash2 } from 'lucide-react';
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
    { id: crypto.randomUUID(), assetId: preselectedAssetId || '', quantity: 0, totalCost: 0 },
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

  const selectCls =
    'w-full h-9 pl-3 pr-8 rounded-xl text-sm font-medium appearance-none outline-none ' +
    'bg-background border border-border text-foreground ' +
    'focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer';

  const inputCls =
    'h-9 px-3 rounded-xl text-sm font-bold text-center outline-none w-full ' +
    'bg-background border border-border text-foreground ' +
    'focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-none">
                Restock Assets
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add stock to one or more assets
              </p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>

        {/* Column Headers */}
        <div className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-2 px-6 pt-4 pb-1">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Asset</span>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Qty</span>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Cost (₦)</span>
          <span className="w-6" />
        </div>

        {/* Items */}
        <div className="px-6 pb-2 space-y-2 max-h-[45vh] overflow-y-auto no-scrollbar">
          {items.map(item => {
            const unitCost = item.quantity > 0 ? item.totalCost / item.quantity : 0;
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
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>

                {/* Qty */}
                <input
                  type="number"
                  min={1}
                  placeholder="0"
                  value={item.quantity || ''}
                  onChange={e => handleUpdate(item.id, 'quantity', Number(e.target.value))}
                  className={inputCls}
                />

                {/* Cost + derived unit cost */}
                <div className="space-y-0.5">
                  <input
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={item.totalCost || ''}
                    onChange={e => handleUpdate(item.id, 'totalCost', Number(e.target.value))}
                    className={inputCls + ' text-left'}
                  />
                  {unitCost > 0 && (
                    <p className="text-[10px] text-primary font-semibold text-right pr-1">
                      ₦{unitCost.toFixed(2)}/unit
                    </p>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={items.length === 1}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-0 transition-all"
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
          className="mx-6 mb-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add another asset
        </button>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/30">
          <p className="text-[11px] text-muted-foreground font-medium">
            {items.filter(i => i.assetId && i.quantity > 0).length} item(s) ready
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleRestock}
              disabled={!isValid}
              className="h-9 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm disabled:opacity-40 transition-all hover:bg-primary/90"
            >
              Restock
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
