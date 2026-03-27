import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  X, 
  Package, 
  Save,
  ChevronDown,
  Info,
  Lightbulb,
  Cpu,
  Zap
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Asset, AssetCategory, AssetType, AssetStatus, AssetCondition } from '../types';

interface AssetFormProps {
  onClose: () => void;
  assetToEdit?: Asset; 
}

export function AssetForm({ onClose, assetToEdit }: AssetFormProps) {
  const { addAsset, updateAsset } = useOperations();
  const { isDark } = useTheme();

  const [name, setName] = useState(assetToEdit?.name || '');
  const [description, setDescription] = useState(assetToEdit?.description || '');
  const [unitOfMeasurement, setUnitOfMeasurement] = useState(assetToEdit?.unitOfMeasurement || 'pcs - Pieces');
  const [quantity, setQuantity] = useState(assetToEdit?.quantity || 0);
  const [cost, setCost] = useState(assetToEdit?.cost || 0);
  const [category, setCategory] = useState<AssetCategory>(assetToEdit?.category || 'dewatering');
  const [assetType, setAssetType] = useState<AssetType>(assetToEdit?.type || 'equipment');
  const [lowStockLevel, setLowStockLevel] = useState(assetToEdit?.lowStockLevel || 10);
  const [criticalStockLevel, setCriticalStockLevel] = useState(assetToEdit?.criticalStockLevel || 5);
  const [location, setLocation] = useState(assetToEdit?.location || '');
  const [customLocation, setCustomLocation] = useState('');
  const [isCustomLoc, setIsCustomLoc] = useState(false);
  
  // Equipment specific fields
  const [powerSource, setPowerSource] = useState(assetToEdit?.powerSource || '');
  const [requiresLogging, setRequiresLogging] = useState(assetToEdit?.requiresLogging || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const finalLocation = isCustomLoc ? customLocation : location;

    const assetData: Omit<Asset, 'id' | 'availableQuantity' | 'reservedQuantity' | 'missingQuantity' | 'damagedQuantity' | 'usedQuantity'> = {
      name,
      description,
      unitOfMeasurement,
      quantity,
      cost,
      category,
      type: assetType,
      lowStockLevel,
      criticalStockLevel,
      location: finalLocation,
      powerSource: assetType === 'equipment' ? powerSource : undefined,
      requiresLogging: assetType === 'equipment' ? requiresLogging : undefined,
      status: assetToEdit?.status || 'active',
      condition: assetToEdit?.condition || 'good',
    };

    if (assetToEdit) {
      updateAsset(assetToEdit.id, assetData);
    } else {
      addAsset(assetData as any);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className={cn(
        "w-full max-w-3xl max-h-[95vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col border-0 animate-in zoom-in-95 duration-300",
        isDark ? "bg-slate-900" : "bg-white"
      )}>
        {/* Close Button */}
        <button onClick={onClose} className="absolute right-8 top-8 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10">
           <X className="h-5 w-5 text-slate-400" />
        </button>

        <div className="flex-1 overflow-y-auto no-scrollbar p-10 pb-6">
           {/* Top Branding Section */}
           <div className="flex flex-col items-center text-center mb-10">
              <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4 transition-transform hover:scale-110">
                 <Package className="h-8 w-8" />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-blue-600 uppercase">
                {assetToEdit ? 'Edit Asset' : 'Add New Asset'}
              </h1>
              <p className="text-slate-400 font-medium mt-1">Add a new item to your inventory</p>
           </div>

           <form onSubmit={handleSubmit} className="space-y-10">
              {/* Asset Information Section */}
              <div className="space-y-6">
                 <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight ml-1">Asset Information</h2>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Asset Name *</label>
                    <input 
                       value={name}
                       onChange={e => setName(e.target.value)}
                       placeholder="Enter asset name"
                       className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Unit of Measurement *</label>
                    <div className="relative group">
                       <select 
                          value={unitOfMeasurement}
                          onChange={e => setUnitOfMeasurement(e.target.value)}
                          className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 appearance-none transition-all shadow-sm"
                       >
                          <option value="pcs - Pieces">pcs - Pieces</option>
                          <option value="kg - Kilograms">kg - Kilograms</option>
                          <option value="lit - Liters">lit - Liters</option>
                          <option value="meters - Meters">meters - Meters</option>
                          <option value="custom">Type a custom unit...</option>
                       </select>
                       <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                    </div>
                    <p className="text-[10px] text-orange-500 font-bold flex items-center gap-1 mt-1 ml-1 overflow-visible">
                       <Lightbulb className="h-3.5 w-3.5 fill-orange-500/20" />
                       You can select from the list or type a custom unit
                    </p>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Description</label>
                    <textarea 
                       value={description}
                       onChange={e => setDescription(e.target.value)}
                       placeholder="Enter asset description"
                       rows={4}
                       className="w-full p-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-medium text-slate-700 transition-all shadow-sm resize-none"
                    />
                 </div>
              </div>

              {/* Grid Fields (Quantity, Cost, Category, etc.) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Quantity</label>
                    <input 
                       type="number"
                       value={quantity}
                       onChange={e => setQuantity(Number(e.target.value))}
                       className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Cost</label>
                    <input 
                       type="number"
                       value={cost}
                       onChange={e => setCost(Number(e.target.value))}
                       className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Category</label>
                    <div className="relative group">
                       <select 
                          value={category}
                          onChange={e => setCategory(e.target.value as AssetCategory)}
                          className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 appearance-none transition-all shadow-sm"
                       >
                          <option value="dewatering">Dewatering</option>
                          <option value="waterproofing">Waterproofing</option>
                          <option value="tiling">Tiling</option>
                          <option value="ppe">Safety PPE</option>
                       </select>
                       <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Low Stock Level</label>
                    <input 
                       type="number"
                       value={lowStockLevel}
                       onChange={e => setLowStockLevel(Number(e.target.value))}
                       className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Critical Stock Level</label>
                    <input 
                       type="number"
                       value={criticalStockLevel}
                       onChange={e => setCriticalStockLevel(Number(e.target.value))}
                       className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 ml-1">Type</label>
                    <div className="relative group">
                       <select 
                          value={assetType}
                          onChange={e => setAssetType(e.target.value as AssetType)}
                          className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 appearance-none transition-all shadow-sm"
                       >
                          <option value="equipment">Equipment</option>
                          <option value="tools">Tools</option>
                          <option value="consumable">Consumable</option>
                          <option value="reusables">Reuseables</option>
                       </select>
                       <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                    </div>
                 </div>
              </div>

              {/* Location Section */}
              <div className="space-y-4">
                 <label className="text-xs font-bold text-slate-900 ml-1">Location</label>
                 <div className="relative group">
                    <select 
                       value={isCustomLoc ? 'custom' : location}
                       onChange={e => {
                          if (e.target.value === 'custom') {
                             setIsCustomLoc(true);
                             setLocation('');
                          } else {
                             setIsCustomLoc(false);
                             setLocation(e.target.value);
                          }
                       }}
                       className={cn(
                          "w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white outline-none font-bold transition-all shadow-sm appearance-none",
                          isCustomLoc ? "border-blue-500 focus:border-blue-600 border-2" : "border-transparent focus:border-blue-500"
                       )}
                    >
                       <option value="">Select asset location</option>
                       <option value="Store A">Store A</option>
                       <option value="Site B">Site B</option>
                       <option value="Main Store">Main Store</option>
                       <option value="custom">Custom Location</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                 </div>
                 {isCustomLoc && (
                    <input 
                       value={customLocation}
                       onChange={e => setCustomLocation(e.target.value)}
                       placeholder="Enter custom location"
                       className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm animate-in slide-in-from-top-1 duration-200"
                    />
                 )}
              </div>

              {/* Equipment Special Section - Only if type is equipment */}
              {assetType === 'equipment' && (
                 <div className="p-8 rounded-[2rem] bg-blue-50/30 border border-blue-100/50 space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                       <Cpu className="h-5 w-5 text-blue-600 fill-blue-600/10" />
                       <h3 className="font-bold text-slate-800">Equipment Operational Details</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 ml-1">Power Source</label>
                          <div className="relative group">
                             <select 
                                value={powerSource}
                                onChange={e => setPowerSource(e.target.value)}
                                className="w-full h-14 px-6 rounded-2xl bg-white border-transparent focus:border-blue-500 outline-none font-bold text-slate-800 appearance-none transition-all shadow-sm"
                             >
                                <option value="">Select power source</option>
                                <option value="Electricity">Electricity</option>
                                <option value="Diesel">Diesel</option>
                                <option value="Petrol">Petrol</option>
                                <option value="Battery">Battery</option>
                                <option value="Solar">Solar</option>
                             </select>
                             <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 ml-1">Requires Daily Logging</label>
                          <div className="relative group">
                             <select 
                                value={requiresLogging ? 'yes' : 'no'}
                                onChange={e => setRequiresLogging(e.target.value === 'yes')}
                                className="w-full h-14 px-6 rounded-2xl bg-white border-transparent focus:border-blue-500 outline-none font-bold text-slate-800 appearance-none transition-all shadow-sm"
                             >
                                <option value="no">No - Hide from Machines section</option>
                                <option value="yes">Yes - Show in Machines section</option>
                             </select>
                             <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-1 ml-1">
                             Only equipment that requires daily logging will appear in the Machines section at sites.
                          </p>
                       </div>
                    </div>
                 </div>
              )}
           </form>
        </div>

        {/* Footer with Submit Button */}
        <div className="p-10 pt-4">
           <button 
              onClick={handleSubmit}
              disabled={!name}
              className="w-full h-16 rounded-[1.25rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
           >
              <Save className="h-5 w-5" />
              {assetToEdit ? 'Save Changes' : 'Add Asset'}
           </button>
        </div>
      </div>
    </div>
  );
}
