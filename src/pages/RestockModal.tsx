import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { X, Package, Plus, ChevronDown, Trash2, Calendar, Truck, Layers, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';
import { packsToUnits, formatDualUnit } from '@/src/lib/unitConversions';

interface RestockModalProps {
  onClose: () => void;
  preselectedAssetId?: string;
}

interface RestockItem {
  id: string;
  assetId: string;
  inputMode: 'units' | 'packs';
  packQuantity?: number;
  quantity: number;
  totalCost: number;
  batchNumber?: string;
  expiryDate?: string;
  supplier?: string;
  showDetails?: boolean;
}

export function RestockModal({ onClose, preselectedAssetId }: RestockModalProps) {
  const { assets, restockAssets } = useOperations();
  const [items, setItems] = useState<RestockItem[]>([
    { 
      id: crypto.randomUUID(), 
      assetId: preselectedAssetId || '', 
      inputMode: 'units',
      quantity: 0, 
      totalCost: 0,
      batchNumber: '',
      expiryDate: '',
      supplier: '',
      showDetails: false
    },
  ]);

  const handleAddItem = () =>
    setItems(prev => [...prev, { 
      id: crypto.randomUUID(), 
      assetId: '', 
      inputMode: 'units',
      quantity: 0, 
      totalCost: 0,
      batchNumber: '',
      expiryDate: '',
      supplier: '',
      showDetails: false
    }]);

  const handleRemoveItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const handleUpdate = (id: string, field: keyof RestockItem, value: any) =>
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      
      // Auto-compute quantity if inputMode is packs
      if (field === 'packQuantity' || field === 'inputMode' || field === 'assetId') {
        const asset = assets.find(a => a.id === updated.assetId);
        if (updated.inputMode === 'packs' && asset?.packSize) {
          updated.quantity = packsToUnits(updated.packQuantity || 0, 0, asset.packSize);
        }
      }
      return updated;
    }));

  const handleRestock = () => {
    const valid = items.filter(i => i.assetId && i.quantity > 0);
    if (!valid.length) return;
    restockAssets(valid.map(i => ({ 
      assetId: i.assetId, 
      quantity: i.quantity, 
      totalCost: i.totalCost,
      batchNumber: i.batchNumber || undefined,
      expiryDate: i.expiryDate || undefined,
      supplier: i.supplier || undefined
    })));
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
        className="max-w-2xl p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
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
                Add stock deliveries with dual-unit and FIFO batch tracking
              </p>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>

        {/* Column Headers */}
        <div className="grid grid-cols-[2fr_1.3fr_1.5fr_auto] gap-2 px-6 pt-4 pb-1">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Asset</span>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Qty / Packs</span>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Cost (₦)</span>
          <span className="w-6" />
        </div>

        {/* Items */}
        <div className="px-6 pb-2 space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar">
          {items.map(item => {
            const asset = assets.find(a => a.id === item.assetId);
            const unitCost = item.quantity > 0 ? item.totalCost / item.quantity : 0;
            const hasPackaging = Boolean(asset?.packUnit && asset?.packSize && asset.packSize > 1);

            return (
              <div key={item.id} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                <div className="grid grid-cols-[2fr_1.3fr_1.5fr_auto] gap-2 items-center">
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

                  {/* Qty & Packaging Input */}
                  <div>
                    {hasPackaging ? (
                      <div className="space-y-1">
                        <div className="flex rounded-lg overflow-hidden border border-border bg-background p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleUpdate(item.id, 'inputMode', 'units')}
                            className={`flex-1 py-0.5 font-bold rounded ${item.inputMode === 'units' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Units
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdate(item.id, 'inputMode', 'packs')}
                            className={`flex-1 py-0.5 font-bold rounded ${item.inputMode === 'packs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            {asset?.packUnit || 'Packs'}
                          </button>
                        </div>
                        {item.inputMode === 'packs' ? (
                          <input
                            type="number"
                            min={1}
                            placeholder={`# of ${asset?.packUnit || 'Packs'}`}
                            value={item.packQuantity || ''}
                            onChange={e => handleUpdate(item.id, 'packQuantity', Number(e.target.value))}
                            className={inputCls}
                          />
                        ) : (
                          <input
                            type="number"
                            min={1}
                            placeholder="0"
                            value={item.quantity || ''}
                            onChange={e => handleUpdate(item.id, 'quantity', Number(e.target.value))}
                            className={inputCls}
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={item.quantity || ''}
                        onChange={e => handleUpdate(item.id, 'quantity', Number(e.target.value))}
                        className={inputCls}
                      />
                    )}
                  </div>

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

                {/* Sub-bar with conversions & Details toggle */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground border-t border-border/40">
                  <span>
                    {item.quantity > 0 && asset && (
                      <span className="font-semibold text-foreground">
                        Total Stock: {formatDualUnit(item.quantity, asset.unitOfMeasurement, asset.packUnit, asset.packSize)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdate(item.id, 'showDetails', !item.showDetails)}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <Hash className="h-3 w-3" />
                    {item.showDetails ? 'Hide Batch & Supplier' : '+ Batch / Expiry / Supplier'}
                  </button>
                </div>

                {/* Batch & Supplier detail drawer */}
                {item.showDetails && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 bg-background/50 p-2.5 rounded-lg text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Batch #</label>
                      <input
                        type="text"
                        placeholder="e.g. BATCH-2026-08"
                        value={item.batchNumber || ''}
                        onChange={e => handleUpdate(item.id, 'batchNumber', e.target.value)}
                        className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs w-full outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={item.expiryDate || ''}
                        onChange={e => handleUpdate(item.id, 'expiryDate', e.target.value)}
                        className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs w-full outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Supplier</label>
                      <input
                        type="text"
                        placeholder="Supplier name"
                        value={item.supplier || ''}
                        onChange={e => handleUpdate(item.id, 'supplier', e.target.value)}
                        className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs w-full outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}
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
