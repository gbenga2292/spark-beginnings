import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  X, 
  Plus, 
  Trash2, 
  Truck, 
  ArrowRightLeft, 
  Calendar, 
  User, 
  MapPin, 
  Package,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { WaybillType, WaybillStatus } from '../types';

interface WaybillFormProps {
  onClose: () => void;
  initialType?: WaybillType;
}

export function WaybillForm({ onClose, initialType = 'waybill' }: WaybillFormProps) {
  const { assets, createWaybill } = useOperations();
  const { isDark } = useTheme();

  const [type, setType] = useState<WaybillType>(initialType);
  const [siteName, setSiteName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [items, setItems] = useState<{ assetId: string; assetName: string; quantity: number }[]>([]);
  
  const [searchAsset, setSearchAsset] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const addItem = () => {
    const asset = assets.find(a => a.id === selectedAssetId);
    if (asset) {
      if (items.find(i => i.assetId === asset.id)) return;
      setItems([...items, { assetId: asset.id, assetName: asset.name, quantity: 1 }]);
      setSelectedAssetId('');
      setSearchAsset('');
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.assetId !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setItems(items.map(i => i.assetId === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName || !driverName || items.length === 0) return;

    createWaybill({
      siteId: 'site-' + Math.random().toString(36).substr(2, 5),
      siteName,
      type,
      issueDate: new Date().toISOString(),
      driverName,
      vehicle: vehicleNumber,
      items
    });
    onClose();
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchAsset.toLowerCase()) && 
    !items.find(i => i.assetId === a.id)
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col",
        isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                 {type === 'waybill' ? <Truck className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
              </div>
              <div>
                 <h2 className="text-xl font-bold tracking-tight">Generate New {type === 'waybill' ? 'Waybill' : 'Return Sheet'}</h2>
                 <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Asset Movement & Logistics documentation</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X className="h-5 w-5 text-slate-400" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Left Column: Details */}
              <div className="space-y-8">
                 <div className="space-y-6">
                    <h3 className="text-sm font-black uppercase text-indigo-600 tracking-wider">Logistics Details</h3>
                    
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Destination Site</label>
                       <div className="relative">
                          <input 
                             value={siteName}
                             onChange={e => setSiteName(e.target.value)}
                             required
                             placeholder="e.g. Dangote Refinery Project"
                             className={cn(
                               "w-full h-12 pl-10 pr-4 rounded-xl border font-bold transition-all focus:ring-2 focus:ring-indigo-100 outline-none",
                               isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 focus:border-indigo-500"
                             )}
                          />
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Driver Name</label>
                          <div className="relative">
                             <input 
                                value={driverName}
                                onChange={e => setDriverName(e.target.value)}
                                required
                                placeholder="Full Name"
                                className={cn(
                                  "w-full h-12 pl-10 pr-4 rounded-xl border font-bold transition-all outline-none",
                                  isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200"
                                )}
                             />
                             <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Vehicle Plate</label>
                          <div className="relative">
                             <input 
                                value={vehicleNumber}
                                onChange={e => setVehicleNumber(e.target.value)}
                                required
                                placeholder="ABC-123-XY"
                                className={cn(
                                  "w-full h-12 pl-10 pr-4 rounded-xl border font-bold transition-all outline-none",
                                  isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200"
                                )}
                             />
                             <Truck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-4">
                    <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                       Generating this waybill will mark the selected assets as "On Site" and release them from central inventory once confirmed.
                    </p>
                 </div>
              </div>

              {/* Right Column: Items Selection */}
              <div className="space-y-6">
                 <h3 className="text-sm font-black uppercase text-indigo-600 tracking-wider">Asset Selection</h3>
                 
                 <div className="space-y-4">
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                          <input 
                             value={searchAsset}
                             onChange={e => setSearchAsset(e.target.value)}
                             placeholder="Search inventory..."
                             className={cn(
                               "w-full h-12 pl-10 pr-4 rounded-xl border font-bold text-sm outline-none",
                               isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200"
                             )}
                          />
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          
                          {searchAsset && filteredAssets.length > 0 && (
                             <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto rounded-xl border bg-white dark:bg-slate-800 shadow-xl p-1">
                                {filteredAssets.map(a => (
                                   <button 
                                      key={a.id}
                                      type="button"
                                      onClick={() => { setSelectedAssetId(a.id); setSearchAsset(a.name); }}
                                      className="w-full text-left p-2.5 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                                   >
                                      <span>{a.name}</span>
                                      <span className="text-[10px] text-slate-400">STOCK: {a.availableQuantity}</span>
                                   </button>
                                ))}
                             </div>
                          )}
                       </div>
                       <button 
                          type="button"
                          onClick={addItem}
                          disabled={!selectedAssetId}
                          className="h-12 w-12 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/10"
                       >
                          <Plus className="h-5 w-5" />
                       </button>
                    </div>

                    {/* Selected Items List */}
                    <div className="space-y-3 pt-2">
                       {items.map(item => (
                          <div key={item.assetId} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 dark:bg-slate-800/30 dark:border-slate-800 animate-in slide-in-from-right-4">
                             <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-bold truncate max-w-[150px]">{item.assetName}</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border shadow-xs">
                                   <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center font-bold text-slate-400 hover:bg-slate-50 rounded">-</button>
                                   <span className="w-8 h-6 flex items-center justify-center text-xs font-black text-indigo-600">{item.quantity}</span>
                                   <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center font-bold text-slate-400 hover:bg-slate-50 rounded">+</button>
                                </div>
                                <button type="button" onClick={() => removeItem(item.assetId)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                   <Trash2 className="h-4 w-4" />
                                </button>
                             </div>
                          </div>
                       ))}
                       {items.length === 0 && (
                          <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                             <Package className="h-10 w-10 text-slate-200 mx-auto mb-2 opacity-50" />
                             <p className="text-xs text-slate-400 italic">No assets selected yet.</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </form>

        {/* Footer Actions */}
        <div className="p-6 border-t flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
           <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-black text-xs uppercase text-slate-500 hover:bg-white transition-all"
           >
              Cancel
           </button>
           <button 
              onClick={handleSubmit}
              disabled={items.length === 0 || !siteName || !driverName}
              className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase transition-all shadow-lg hover:shadow-indigo-500/20 disabled:grayscale disabled:opacity-50 flex items-center gap-2"
           >
              <CheckCircle2 className="h-4 w-4" />
              Finalize Document
           </button>
        </div>
      </div>
    </div>
  );
}
