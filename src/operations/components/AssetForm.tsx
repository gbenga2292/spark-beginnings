import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { X, Package, Save, ChevronDown, Lightbulb, Cpu } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Asset, AssetCategory, AssetType } from '../types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';

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
  const [powerSource, setPowerSource] = useState(assetToEdit?.powerSource || '');
  const [requiresLogging, setRequiresLogging] = useState(assetToEdit?.requiresLogging || false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name) return;
    const finalLocation = isCustomLoc ? customLocation : location;
    const assetData: Omit<Asset, 'id' | 'availableQuantity' | 'reservedQuantity' | 'missingQuantity' | 'damagedQuantity' | 'usedQuantity'> = {
      name, description, unitOfMeasurement, quantity, cost, category,
      type: assetType, lowStockLevel, criticalStockLevel, location: finalLocation,
      powerSource: assetType === 'equipment' ? powerSource : undefined,
      requiresLogging: assetType === 'equipment' ? requiresLogging : undefined,
      status: assetToEdit?.status || 'active',
      condition: assetToEdit?.condition || 'good',
    };
    if (assetToEdit) updateAsset(assetToEdit.id, assetData);
    else addAsset(assetData as any);
    onClose();
  };

  const selectClass = "w-full h-11 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-950 border border-transparent focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-sm text-slate-700 dark:text-slate-200 appearance-none";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{assetToEdit ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Inventory Management</p>
            </div>
          </div>
          <DialogClose className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[65vh] no-scrollbar p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Asset Information */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-blue-600 uppercase tracking-wider">Asset Information</h2>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Asset Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter asset name"
                  className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent focus-visible:ring-blue-500 font-medium text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Unit of Measurement *</label>
                <div className="relative">
                  <select value={unitOfMeasurement} onChange={e => setUnitOfMeasurement(e.target.value)} className={selectClass}>
                    <option value="pcs - Pieces">pcs - Pieces</option>
                    <option value="kg - Kilograms">kg - Kilograms</option>
                    <option value="lit - Liters">lit - Liters</option>
                    <option value="meters - Meters">meters - Meters</option>
                    <option value="custom">Type a custom unit...</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-orange-500 font-bold flex items-center gap-1 ml-1">
                  <Lightbulb className="h-3 w-3 fill-orange-500/20" /> Select from list or type custom
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter asset description" rows={3}
                  className="w-full p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950 border border-transparent focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-sm text-slate-700 dark:text-slate-200 resize-none" />
              </div>
            </div>

            {/* Grid Fields */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Quantity</label>
                <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                  className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Cost</label>
                <Input type="number" value={cost} onChange={e => setCost(Number(e.target.value))}
                  className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Category</label>
                <div className="relative">
                  <select value={category} onChange={e => setCategory(e.target.value as AssetCategory)} className={selectClass}>
                    <option value="dewatering">Dewatering</option>
                    <option value="waterproofing">Waterproofing</option>
                    <option value="tiling">Tiling</option>
                    <option value="ppe">Safety PPE</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Low Stock</label>
                <Input type="number" value={lowStockLevel} onChange={e => setLowStockLevel(Number(e.target.value))}
                  className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Critical Stock</label>
                <Input type="number" value={criticalStockLevel} onChange={e => setCriticalStockLevel(Number(e.target.value))}
                  className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Type</label>
                <div className="relative">
                  <select value={assetType} onChange={e => setAssetType(e.target.value as AssetType)} className={selectClass}>
                    <option value="equipment">Equipment</option>
                    <option value="tools">Tools</option>
                    <option value="consumable">Consumable</option>
                    <option value="reusables">Reuseables</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Location</label>
              <div className="relative">
                <select value={isCustomLoc ? 'custom' : location}
                  onChange={e => { if (e.target.value === 'custom') { setIsCustomLoc(true); setLocation(''); } else { setIsCustomLoc(false); setLocation(e.target.value); } }}
                  className={selectClass}>
                  <option value="">Select asset location</option>
                  <option value="Store A">Store A</option>
                  <option value="Site B">Site B</option>
                  <option value="Main Store">Main Store</option>
                  <option value="custom">Custom Location</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
              {isCustomLoc && (
                <Input value={customLocation} onChange={e => setCustomLocation(e.target.value)} placeholder="Enter custom location"
                  className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm mt-2" />
              )}
            </div>

            {/* Equipment Details */}
            {assetType === 'equipment' && (
              <div className="p-5 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">Equipment Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Power Source</label>
                    <div className="relative">
                      <select value={powerSource} onChange={e => setPowerSource(e.target.value)} className={selectClass}>
                        <option value="">Select power source</option>
                        <option value="Electricity">Electricity</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Petrol">Petrol</option>
                        <option value="Battery">Battery</option>
                        <option value="Solar">Solar</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Daily Logging</label>
                    <div className="relative">
                      <select value={requiresLogging ? 'yes' : 'no'} onChange={e => setRequiresLogging(e.target.value === 'yes')} className={selectClass}>
                        <option value="no">No - Hide from Machines</option>
                        <option value="yes">Yes - Show in Machines</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <Button onClick={() => handleSubmit()} disabled={!name}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs tracking-widest gap-2 shadow-sm disabled:opacity-50">
            <Save className="h-4 w-4" /> {assetToEdit ? 'Save Changes' : 'Add Asset'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
