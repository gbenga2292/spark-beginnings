import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  X, 
  Package, 
  Tag, 
  Layers, 
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { AssetCategory, AssetStatus, AssetCondition, AssetType } from '../types';

interface AssetFormProps {
  onClose: () => void;
  assetToEdit?: any; 
}

export function AssetForm({ onClose, assetToEdit }: AssetFormProps) {
  const { addAsset } = useOperations();
  const { isDark } = useTheme();

  const [name, setName] = useState(assetToEdit?.name || '');
  const [category, setCategory] = useState<AssetCategory>(assetToEdit?.category || 'ppe');
  const [assetType, setAssetType] = useState<AssetType>(assetToEdit?.type || 'equipment');
  const [quantity, setQuantity] = useState(assetToEdit?.quantity || 1);
  const [unitOfMeasurement, setUnitOfMeasurement] = useState(assetToEdit?.unitOfMeasurement || 'pcs');
  const [condition, setCondition] = useState<AssetCondition>(assetToEdit?.condition || 'good');
  const [description, setDescription] = useState(assetToEdit?.description || '');

  const categories: { id: AssetCategory; label: string }[] = [
    { id: 'dewatering', label: 'Dewatering' },
    { id: 'waterproofing', label: 'Waterproofing' },
    { id: 'tiling', label: 'Tiling' },
    { id: 'ppe', label: 'Safety PPE' },
    { id: 'office', label: 'Office Supplies' },
  ];

  const types: { id: AssetType; label: string }[] = [
    { id: 'equipment', label: 'Equipment' },
    { id: 'tools', label: 'Hand Tools' },
    { id: 'consumable', label: 'Consumable' },
    { id: 'non-consumable', label: 'Non-Consumable' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || quantity <= 0) return;

    addAsset({
      name,
      category,
      type: assetType,
      quantity,
      unitOfMeasurement,
      status: 'active',
      condition,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col",
        isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                 <Package className="h-5 w-5" />
              </div>
              <div>
                 <h2 className="text-xl font-bold tracking-tight">{assetToEdit ? 'Edit Asset' : 'Register New Asset'}</h2>
                 <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Inventory Tracking System</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X className="h-5 w-5 text-slate-400" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8">
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Asset Name</label>
                    <div className="relative">
                       <input 
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="e.g. 6-inch Dewatering Pump"
                          className={cn(
                            "w-full h-12 pl-10 pr-4 rounded-xl border font-bold text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-100",
                            isDark ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-indigo-500" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                          )}
                       />
                       <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Category</label>
                    <select 
                       value={category}
                       onChange={e => setCategory(e.target.value as AssetCategory)}
                       className={cn(
                         "w-full h-12 px-4 rounded-xl border font-bold text-sm outline-none transition-all",
                         isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                       )}
                    >
                       {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                       ))}
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Quantity</label>
                    <div className="relative">
                       <input 
                          type="number"
                          value={quantity}
                          onChange={e => setQuantity(parseInt(e.target.value))}
                          className={cn(
                            "w-full h-12 pl-10 pr-4 rounded-xl border font-bold text-sm outline-none",
                            isDark ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-indigo-500" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                          )}
                       />
                       <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Unit</label>
                    <input 
                       value={unitOfMeasurement}
                       onChange={e => setUnitOfMeasurement(e.target.value)}
                       placeholder="pcs / kg / lit"
                       className={cn(
                         "w-full h-12 px-4 rounded-xl border font-bold text-sm outline-none",
                         isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                       )}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Asset Type</label>
                    <select 
                       value={assetType}
                       onChange={e => setAssetType(e.target.value as AssetType)}
                       className={cn(
                         "w-full h-12 px-4 rounded-xl border font-bold text-sm outline-none transition-all",
                         isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                       )}
                    >
                       {types.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                       ))}
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description (Optional)</label>
                 <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Enter asset details, model, or condition..."
                    className={cn(
                      "w-full p-4 rounded-xl border font-medium text-sm outline-none",
                      isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                    )}
                 />
              </div>

              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all cursor-pointer">
                 <ImageIcon className="h-6 w-6" />
                 <span className="text-xs font-bold uppercase tracking-wider italic">Click to upload photo of Asset</span>
              </div>
           </div>

           <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                 Warning: Adding items to inventory will affect your asset financial records. Make sure the serial numbers are unique.
              </p>
           </div>
        </form>

        <div className="p-6 border-t flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
           <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-black text-xs uppercase text-slate-500 hover:bg-white transition-all"
           >
              Cancel
           </button>
           <button 
              onClick={handleSubmit}
              disabled={!name || quantity <= 0}
              className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase transition-all shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
           >
              <CheckCircle2 className="h-4 w-4" />
              Save Record
           </button>
        </div>
      </div>
    </div>
  );
}
