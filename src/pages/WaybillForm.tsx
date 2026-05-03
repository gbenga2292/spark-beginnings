import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { 
  X, Plus, Trash2, Truck, FileText, GripVertical,
  MapPin, Package, Search, CheckCircle2, ChevronDown
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { WaybillType, Waybill } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { toast } from '@/src/components/ui/toast';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { ArrowLeft } from 'lucide-react';
import { getPositionIndex } from '@/src/lib/hierarchy';

interface WaybillFormProps {
  onClose: () => void;
  initialType?: WaybillType;
  prefillSiteName?: string;
  editWaybill?: Waybill;
}

const SERVICES = ['Dewatering', 'Waterproofing', 'Jetting', 'Tiling', 'General'] as const;

export function WaybillForm({ onClose, initialType = 'waybill', prefillSiteName = '', editWaybill }: WaybillFormProps) {
  const { assets, createWaybill, updateWaybill, vehicles } = useOperations();
  const { sites, employees } = useAppStore();

  const isEditing = !!editWaybill;

  const [purpose, setPurpose] = useState('Operational Activities');
  const [siteName, setSiteName] = useState(editWaybill?.siteName || prefillSiteName);
  const [driverName, setDriverName] = useState(editWaybill?.driverName || '');
  const [vehicleName, setVehicleName] = useState(editWaybill?.vehicle || '');
  const [service, setService] = useState('Dewatering');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [itemMode, setItemMode] = useState<'single' | 'bulk'>('single');
  const [items, setItems] = useState<{ rowId: string; assetId: string; quantity: number }[]>(
    editWaybill
      ? editWaybill.items.map(i => ({ rowId: `row-${i.assetId}`, assetId: i.assetId, quantity: i.quantity }))
      : []
  );
  const [bulkText, setBulkText] = useState('');
  const [parsedItems, setParsedItems] = useState<{ id: string; originalText: string; quantity: number; matchedAssetId: string | null; isRematching?: boolean }[]>([]);

  const driverOptions = employees
    .filter(e => e.status === 'Active' || e.status === 'On Leave')
    .sort((a, b) => {
      const aIsDriver = (a.position || '').toLowerCase().includes('driver') ? 1 : 0;
      const bIsDriver = (b.position || '').toLowerCase().includes('driver') ? 1 : 0;
      if (aIsDriver !== bIsDriver) return bIsDriver - aIsDriver;

      const rankA = getPositionIndex(a.position);
      const rankB = getPositionIndex(b.position);
      if (rankA !== rankB) return rankA - rankB;
      return `${a.firstname} ${a.surname}`.localeCompare(`${b.firstname} ${b.surname}`);
    })
    .map(e => `${e.firstname} ${e.surname}`);
  
  const uniqueDrivers = Array.from(new Set(driverOptions));

  const vehicleOptions = vehicles.map(v => v.name);
  const siteOptions = sites.map(s => s.name);

  const addItem = () => setItems([...items, { rowId: `row-${Date.now()}-${Math.random()}`, assetId: '', quantity: 1 }]);
  const updateItemAsset = (rowId: string, assetId: string) => setItems(items.map(i => i.rowId === rowId ? { ...i, assetId } : i));
  const updateItemQuantity = (rowId: string, qty: number) => setItems(items.map(i => i.rowId === rowId ? { ...i, quantity: Math.max(1, qty) } : i));
  const removeItem = (rowId: string) => setItems(items.filter(i => i.rowId !== rowId));

  const handleParse = () => {
    const lines = bulkText.split('\n').filter(l => l.trim());
    const newParsed = lines.map(line => {
      let qty = 1;
      let name = line.trim();
      const matchEnd = name.match(/(.*?)\s+[xX*]?\s*(\d+)$/);
      const matchStart = name.match(/^(\d+)\s+[xX*]?\s*(.*)/);
      if (matchEnd) {
        name = matchEnd[1].trim();
        qty = parseInt(matchEnd[2], 10) || 1;
      } else if (matchStart) {
        qty = parseInt(matchStart[1], 10) || 1;
        name = matchStart[2].trim();
      }

      const lowerName = name.toLowerCase();
      let match = assets.find(a => a.name.toLowerCase() === lowerName);
      if (!match) {
        match = assets.find(a => a.name.toLowerCase().includes(lowerName) || lowerName.includes(a.name.toLowerCase()));
      }

      return {
        id: `parsed-${Date.now()}-${Math.random()}`,
        originalText: name,
        quantity: qty,
        matchedAssetId: match ? match.id : null,
        isRematching: false,
      };
    });
    setParsedItems(newParsed);
  };

  const handleImportBulk = () => {
    const validParsed = parsedItems.filter(p => p.matchedAssetId);
    const newItems = validParsed.map(p => ({
      rowId: `row-${Date.now()}-${Math.random()}`,
      assetId: p.matchedAssetId as string,
      quantity: p.quantity,
    }));
    setItems([...items, ...newItems]);
    setParsedItems([]);
    setBulkText('');
    setItemMode('single');
    toast.success(`Imported ${newItems.length} items successfully`);
  };

  const handleSubmit = () => {
    if (!siteName || !driverName) {
      toast.error('Please fill in all required fields');
      return;
    }
    const validItems = items.filter(i => i.assetId);
    if (validItems.length === 0) {
      toast.error('Add at least one valid item to the waybill');
      return;
    }
    const mappedItems = validItems.map(i => {
      const asset = assets.find(a => a.id === i.assetId);
      return { assetId: i.assetId, assetName: asset?.name || 'Unknown', quantity: i.quantity };
    });

    if (isEditing && editWaybill) {
      updateWaybill(editWaybill.id, {
        siteName,
        siteId: sites.find(s => s.name === siteName)?.id || editWaybill.siteId,
        driverName,
        vehicle: vehicleName,
        items: mappedItems,
      });
      toast.success(`Waybill ${editWaybill.id} updated successfully`);
    } else {
      createWaybill({
        siteId: sites.find(s => s.name === siteName)?.id || `site-${Date.now()}`,
        siteName,
        type: initialType,
        issueDate: new Date().toISOString(),
        driverName,
        vehicle: vehicleName,
        items: mappedItems,
      });
      toast.success(`Waybill created successfully for ${siteName}`);
    }
    onClose();
  };

  useSetPageTitle(
    isEditing ? 'Edit Waybill' : (initialType === 'waybill' ? 'Create Waybill' : 'Create Return Sheet'),
    isEditing ? `Editing ${editWaybill?.id}` : 'Issue assets for delivery to project sites',
    (
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          onClick={onClose} 
          className="gap-2 text-slate-600 font-bold h-9"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={items.length === 0 || !siteName || !driverName}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold h-9"
        >
          <CheckCircle2 className="h-4 w-4" /> 
          <span className="hidden sm:inline">{isEditing ? 'Update' : 'Create'} {initialType === 'waybill' ? 'Waybill' : 'Return Sheet'}</span>
          <span className="sm:hidden">{isEditing ? 'Update' : 'Create'}</span>
        </Button>
      </div>
    ),
    [initialType, isEditing, editWaybill, items, siteName, driverName, onClose] // Added items and other deps
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50/30 -mx-6 -my-6 sm:-mx-8 sm:-my-8">


      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto w-full p-6 sm:p-8">
        <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
        <div className="p-6 sm:p-8 space-y-8">
          {/* Waybill Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground"><MapPin className="h-4 w-4" /></div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Waybill Information
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Purpose */}
              <div className="space-y-1.5 md:col-span-1 row-span-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Purpose *</Label>
                <textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. Operational Activities"
                />
              </div>

              {/* Driver Name */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Driver Name *</Label>
                <div className="relative">
                  <select
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
                  >
                    <option value="">Select Driver</option>
                    {uniqueDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Vehicle */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Vehicle *</Label>
                <div className="relative">
                  <select
                    value={vehicleName}
                    onChange={e => setVehicleName(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
                  >
                    <option value="">Select Vehicle</option>
                    {vehicleOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Site */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Site *</Label>
                <div className="relative">
                  <select
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
                  >
                    <option value="">Select Site</option>
                    {sites.map(s => <option key={s.id} value={s.name}>{s.name} ({s.client})</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Expected Return Date */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Expected Return Date</Label>
                <Input
                  type="date"
                  value={expectedReturnDate}
                  onChange={e => setExpectedReturnDate(e.target.value)}
                  className="h-10 rounded-xl border-space-200 dark:border-slate-700 bg-background text-sm"
                />
              </div>

              {/* Service */}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Service *</Label>
                <div className="relative">
                  <select
                    value={service}
                    onChange={e => setService(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none max-w-xs"
                  >
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-border w-full" />

          {/* Items to Issue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-muted-foreground"><Package className="h-4 w-4" /></div>
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Items to Issue</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setItemMode('single')}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                    itemMode === 'single' ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-500 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  Single Items
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('bulk')}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                    itemMode === 'bulk' ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-500 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  Bulk Import
                </button>
                {itemMode === 'single' && (
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1.5 text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg transition-all hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                )}
              </div>
            </div>

            {itemMode === 'bulk' ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Paste items (one per line)</Label>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    rows={4}
                    placeholder={`DEWATERING PUMP`}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      onClick={handleParse} 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-6 rounded-lg shadow-sm"
                      disabled={!bulkText.trim()}
                    >
                      Parse
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => { setBulkText(''); setParsedItems([]); }} 
                      className="h-9 px-4 font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {parsedItems.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Parsed Preview</Label>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedItems.map(item => {
                          const matched = item.matchedAssetId ? assets.find(a => a.id === item.matchedAssetId) : null;
                          return (
                            <div key={item.id} className="p-3 sm:px-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                              <Input 
                                value={item.originalText} 
                                onChange={e => setParsedItems(parsedItems.map(p => p.id === item.id ? { ...p, originalText: e.target.value } : p))}
                                className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 sm:w-1/3" 
                              />
                              <Input 
                                type="number" 
                                min="1"
                                value={item.quantity} 
                                onChange={e => setParsedItems(parsedItems.map(p => p.id === item.id ? { ...p, quantity: parseInt(e.target.value) || 1 } : p))}
                                className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 w-24" 
                              />
                              <div className="flex-1 min-w-0">
                                {item.isRematching ? (
                                  <select
                                    value={item.matchedAssetId || ''}
                                    onChange={e => setParsedItems(parsedItems.map(p => p.id === item.id ? { ...p, matchedAssetId: e.target.value, isRematching: false } : p))}
                                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                                  >
                                    <option value="">Select correct asset...</option>
                                    {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.availableQuantity})</option>)}
                                  </select>
                                ) : matched ? (
                                  <div className="flex flex-col justify-center">
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{matched.name}</span>
                                    <span className="text-xs text-slate-500">Available: {matched.availableQuantity} {matched.unitOfMeasurement}</span>
                                  </div>
                                ) : (
                                  <div className="text-sm font-medium text-rose-500 flex items-center h-full">No match found</div>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center">
                                {!item.isRematching && (
                                  <Button 
                                    type="button" 
                                    onClick={() => setParsedItems(parsedItems.map(p => p.id === item.id ? { ...p, isRematching: true } : p))}
                                    className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg"
                                  >
                                    Rematch
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button 
                        type="button" 
                        onClick={handleImportBulk}
                        disabled={parsedItems.filter(p => p.matchedAssetId).length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-6 rounded-lg shadow-sm"
                      >
                        Import {parsedItems.filter(p => p.matchedAssetId).length} items
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                    <FileText className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm font-bold opacity-70 uppercase tracking-widest">No items added yet</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const selectedAsset = assets.find(a => a.id === item.assetId);
                    
                    return (
                      <div key={item.rowId} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm group transition-all">
                        <div className="absolute left-3 top-5 opacity-40 hover:opacity-100 transition-opacity hidden sm:block cursor-grab">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => removeItem(item.rowId)}
                          className="absolute right-4 top-4 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-1.5 rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:ml-6 pr-6 sm:pr-8">
                          <div className="space-y-1.5 sm:col-span-6">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Asset</Label>
                            <div className="relative">
                              <select
                                value={item.assetId}
                                onChange={(e) => updateItemAsset(item.rowId, e.target.value)}
                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                              >
                                <option value="">Select asset</option>
                                {assets.map(a => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.availableQuantity} {a.unitOfMeasurement})</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>

                          <div className="space-y-1.5 sm:col-span-3">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.rowId, parseInt(e.target.value) || 1)}
                              className="h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-medium focus-visible:ring-blue-500/30"
                            />
                          </div>

                          <div className="space-y-1.5 sm:col-span-3">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Available</Label>
                            <div className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900 flex items-center px-3 text-sm font-bold text-slate-500 cursor-not-allowed">
                              {selectedAsset ? `${selectedAsset.availableQuantity} ${selectedAsset.unitOfMeasurement}` : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
