import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  X, 
  Package, 
  Plus,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Button } from '@/src/components/ui/button';

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

    restockAssets(validItems.map(i => ({
      assetId: i.assetId,
      quantity: i.quantity,
      totalCost: i.totalCost
    })));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col border-0 animate-in zoom-in-95 duration-300",
        isDark ? "bg-slate-900" : "bg-white"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-4">
           <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-slate-800" />
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Restock Assets</h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-slate-400" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6">
           {/* Section Container */}
           <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100">
                 <h3 className="font-bold text-slate-800">Restock Items</h3>
              </div>
              
              <div className="p-0">
                 {/* Table Header */}
                 <div className="grid grid-cols-[2fr,1fr,1.5fr,1fr] gap-4 px-8 py-4 border-b border-slate-50">
                    <span className="text-sm font-bold text-slate-800">Asset</span>
                    <span className="text-sm font-bold text-slate-800 text-center">Quantity</span>
                    <span className="text-sm font-bold text-slate-800 text-center">Total Cost</span>
                    <span className="text-sm font-bold text-slate-800 text-center">Unit Cost</span>
                 </div>

                 {/* Table Content */}
                 <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto no-scrollbar">
                    {items.map((item) => {
                       const unitCost = item.quantity > 0 ? (item.totalCost / item.quantity).toFixed(2) : "0.00";
                       return (
                          <div key={item.id} className="grid grid-cols-[2fr,1fr,1.5fr,1fr] gap-6 px-8 py-6 items-center">
                             {/* Asset Select */}
                             <div className="relative group">
                                <select 
                                   value={item.assetId}
                                   onChange={e => handleUpdateItem(item.id, 'assetId', e.target.value)}
                                   className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 border-2 outline-none font-bold text-slate-800 appearance-none transition-all"
                                >
                                   <option value="">Select asset</option>
                                   {assets.map(a => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                   ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                             </div>

                             {/* Quantity */}
                             <div className="relative">
                                <input 
                                   type="number"
                                   placeholder="Qty"
                                   value={item.quantity || ''}
                                   onChange={e => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                                   className="w-full h-14 px-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 border-0 outline-none font-bold text-slate-800 transition-all text-center"
                                />
                             </div>

                             {/* Total Cost */}
                             <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                <input 
                                   type="number"
                                   placeholder="Cost"
                                   value={item.totalCost || ''}
                                   onChange={e => handleUpdateItem(item.id, 'totalCost', Number(e.target.value))}
                                   className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 border-0 outline-none font-bold text-slate-800 transition-all"
                                />
                             </div>

                             {/* Unit Cost Display */}
                             <div className="text-center">
                                <span className="font-black text-slate-800">₦{unitCost}</span>
                             </div>
                          </div>
                       );
                    })}
                 </div>

                 {/* Add Another Asset Button */}
                 <button 
                    onClick={handleAddItem}
                    className="w-[calc(100%-4rem)] mx-8 my-6 h-14 rounded-2xl bg-slate-50 border-slate-100 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 font-bold text-slate-700"
                 >
                    <Plus className="h-5 w-5" />
                    Add Another Asset
                 </button>
              </div>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-0 flex justify-end gap-4">
           <Button 
              variant="secondary" 
              onClick={onClose}
              className="px-10 h-14 rounded-2xl bg-slate-50 text-slate-800 font-black uppercase text-xs tracking-widest hover:bg-slate-100"
           >
              Cancel
           </Button>
           <Button 
              onClick={handleRestock}
              disabled={items.some(i => !i.assetId || i.quantity <= 0)}
              className="px-10 h-14 rounded-2xl bg-blue-300 text-white font-black uppercase text-xs tracking-widest hover:bg-blue-400 transition-all shadow-xl shadow-blue-500/10 disabled:opacity-50"
           >
              Restock Assets
           </Button>
        </div>
      </div>
    </div>
  );
}
