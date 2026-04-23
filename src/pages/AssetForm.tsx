import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOperations } from '../contexts/OperationsContext';
import { X, Package, Save, ChevronDown, Lightbulb, Cpu } from 'lucide-react';
import { Asset, AssetCategory, AssetType } from '../types/operations';

interface AssetFormProps {
  onClose: () => void;
  assetToEdit?: Asset;
}

export function AssetForm({ onClose, assetToEdit }: AssetFormProps) {
  const { addAsset, updateAsset } = useOperations();

  const [name, setName]                     = useState(assetToEdit?.name || '');
  const [description, setDescription]       = useState(assetToEdit?.description || '');
  const [unitOfMeasurement, setUnit]        = useState(assetToEdit?.unitOfMeasurement || 'pcs - Pieces');
  const [quantity, setQuantity]             = useState(assetToEdit?.quantity || 0);
  const [cost, setCost]                     = useState(assetToEdit?.cost || 0);
  const [category, setCategory]             = useState<AssetCategory>(assetToEdit?.category || 'dewatering');
  const [assetType, setAssetType]           = useState<AssetType>(assetToEdit?.type || 'equipment');
  const [lowStockLevel, setLowStock]        = useState(assetToEdit?.lowStockLevel || 10);
  const [criticalStockLevel, setCritical]   = useState(assetToEdit?.criticalStockLevel || 5);
  const [location, setLocation]             = useState(assetToEdit?.location || '');
  const [customLocation, setCustomLocation] = useState('');
  const [isCustomLoc, setIsCustomLoc]       = useState(false);
  const [powerSource, setPowerSource]       = useState(assetToEdit?.powerSource || '');
  const [requiresLogging, setLogging]       = useState(assetToEdit?.requiresLogging || false);
  const [serialNumber, setSerialNumber]     = useState(assetToEdit?.serialNumber || '');
  const [serviceInterval, setServiceInterval] = useState(assetToEdit?.serviceIntervalMonths || 2);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name) return;
    const finalLocation = isCustomLoc ? customLocation : location;
    const assetData: Omit<Asset, 'id' | 'availableQuantity' | 'reservedQuantity' | 'missingQuantity' | 'damagedQuantity' | 'usedQuantity'> = {
      name, description, unitOfMeasurement, quantity, cost, category,
      type: assetType, lowStockLevel, criticalStockLevel, location: finalLocation,
      powerSource: assetType === 'equipment' ? powerSource : undefined,
      requiresLogging: assetType === 'equipment' ? requiresLogging : undefined,
      serialNumber: assetType === 'equipment' ? serialNumber : undefined,
      serviceIntervalMonths: assetType === 'equipment' ? serviceInterval : undefined,
      status: assetToEdit?.status || 'active',
      condition: assetToEdit?.condition || 'good',
    };
    if (assetToEdit) updateAsset(assetToEdit.id, assetData);
    else addAsset(assetData as any);
    onClose();
  };

  /* ── Shared field classes matching Task dialog style ──────────── */
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50";
  const selectCls = "w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none cursor-pointer";
  const labelCls = "block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 pt-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[85vh] flex flex-col"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {assetToEdit ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {assetToEdit ? 'Update asset details below' : 'Fill in asset details to add to inventory'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto flex-1 no-scrollbar">

          {/* Asset Information section */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 flex items-center gap-2">
              <span className="h-px flex-1 bg-primary/10" />
              Asset Information
              <span className="h-px flex-1 bg-primary/10" />
            </p>

            {/* Name */}
            <div>
              <label className={labelCls}>Asset Name <span className="text-red-400">*</span></label>
              <input
                required
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 6″ Dewatering Pump"
                className={inputCls}
              />
            </div>

            {/* Unit of Measurement */}
            <div>
              <label className={labelCls}>Unit of Measurement <span className="text-red-400">*</span></label>
              <div className="relative">
                <select value={unitOfMeasurement} onChange={e => setUnit(e.target.value)} className={selectCls}>
                  <option value="pcs - Pieces">pcs - Pieces</option>
                  <option value="kg - Kilograms">kg - Kilograms</option>
                  <option value="lit - Liters">lit - Liters</option>
                  <option value="meters - Meters">meters - Meters</option>
                  <option value="custom">Type a custom unit...</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1 mt-1.5">
                <Lightbulb className="h-3 w-3 fill-amber-400/30" /> Select from list or type custom
              </p>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional notes about this asset…"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Quantities & Classification */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 flex items-center gap-2">
              <span className="h-px flex-1 bg-primary/10" />
              Quantities & Classification
              <span className="h-px flex-1 bg-primary/10" />
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Quantity</label>
                <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cost (₦)</label>
                <input type="number" value={cost} onChange={e => setCost(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <div className="relative">
                  <select value={category} onChange={e => setCategory(e.target.value as AssetCategory)} className={selectCls}>
                    <option value="dewatering">Dewatering</option>
                    <option value="waterproofing">Waterproofing</option>
                    <option value="tiling">Tiling</option>
                    <option value="ppe">Safety PPE</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Low Stock Alert</label>
                <input type="number" value={lowStockLevel} onChange={e => setLowStock(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Critical Stock</label>
                <input type="number" value={criticalStockLevel} onChange={e => setCritical(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Asset Type</label>
                <div className="relative">
                  <select value={assetType} onChange={e => setAssetType(e.target.value as AssetType)} className={selectCls}>
                    <option value="equipment">Equipment</option>
                    <option value="tools">Tools</option>
                    <option value="consumable">Consumable</option>
                    <option value="reusables">Reusables</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            <div className="relative">
              <select
                value={isCustomLoc ? 'custom' : location}
                onChange={e => {
                  if (e.target.value === 'custom') { setIsCustomLoc(true); setLocation(''); }
                  else { setIsCustomLoc(false); setLocation(e.target.value); }
                }}
                className={selectCls}
              >
                <option value="">Select asset location</option>
                <option value="Store A">Store A</option>
                <option value="Site B">Site B</option>
                <option value="Main Store">Main Store</option>
                <option value="custom">Custom Location...</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {isCustomLoc && (
              <input
                value={customLocation}
                onChange={e => setCustomLocation(e.target.value)}
                placeholder="Enter custom location"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          {/* Equipment Details (conditional) */}
          {assetType === 'equipment' && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/50 border-b border-border">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">Equipment Details</span>
              </div>
              <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Power Source</label>
                  <div className="relative">
                    <select value={powerSource} onChange={e => setPowerSource(e.target.value)} className={selectCls}>
                      <option value="">Select power source</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol</option>
                      <option value="Battery">Battery</option>
                      <option value="Solar">Solar</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Daily Logging</label>
                  <div className="relative">
                    <select value={requiresLogging ? 'yes' : 'no'} onChange={e => setLogging(e.target.value === 'yes')} className={selectCls}>
                      <option value="no">No – Hide from Machines</option>
                      <option value="yes">Yes – Show in Machines</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Serial Number</label>
                  <input
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="e.g. KSF164HM"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Service Interval (Months)</label>
                  <input
                    type="number"
                    value={serviceInterval}
                    onChange={e => setServiceInterval(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {assetToEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
