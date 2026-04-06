import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '@/src/store/appStore';
import { 
  X, Plus, Trash2, Truck, FileText,
  MapPin, Package, Search, CheckCircle2, ChevronDown
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { WaybillType } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Dialog, DialogContent, DialogClose } from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';

interface WaybillFormProps {
  onClose: () => void;
  initialType?: WaybillType;
  prefillSiteName?: string;
}

const SERVICES = ['Dewatering', 'Waterproofing', 'Jetting', 'Tiling', 'General'] as const;

export function WaybillForm({ onClose, initialType = 'waybill', prefillSiteName = '' }: WaybillFormProps) {
  const { assets, createWaybill, vehicles } = useOperations();
  const { sites, employees } = useAppStore();

  const [purpose, setPurpose] = useState('Operational Activities');
  const [siteName, setSiteName] = useState(prefillSiteName);
  const [driverName, setDriverName] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [service, setService] = useState('Dewatering');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [items, setItems] = useState<{ assetId: string; assetName: string; quantity: number; type: string }[]>([]);
  const [searchAsset, setSearchAsset] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [itemMode, setItemMode] = useState<'single' | 'bulk'>('single');
  const [bulkText, setBulkText] = useState('');

  const driverOptions = [
    ...employees.filter(e => ['Driver', 'Foreman', 'Site Supervisor', 'Assistant Supervisor'].includes(e.position || ''))
      .map(e => `${e.firstname} ${e.surname}`),
  ];
  const uniqueDrivers = Array.from(new Set(driverOptions));

  const vehicleOptions = vehicles.map(v => v.name);
  const siteOptions = sites.map(s => s.name);

  const filteredAssets = assets.filter(a =>
    a.name.toLowerCase().includes(searchAsset.toLowerCase()) &&
    !items.find(i => i.assetId === a.id)
  );

  const addItem = () => {
    const asset = assets.find(a => a.id === selectedAssetId);
    if (asset) {
      setItems([...items, { assetId: asset.id, assetName: asset.name, quantity: 1, type: asset.type }]);
      setSelectedAssetId('');
      setSearchAsset('');
    }
  };

  const addBulkItems = () => {
    const lines = bulkText.split('\n').filter(l => l.trim());
    const newItems: typeof items = [];
    lines.forEach(line => {
      const match = line.match(/^(.+?)\s+[x×]\s*(\d+)/i) || line.match(/^(\d+)\s+(.+)/);
      if (match) {
        const name = (match[1] || match[2]).trim();
        const qty = parseInt(match[2] || match[1]);
        const asset = assets.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
        if (asset && !items.find(i => i.assetId === asset.id)) {
          newItems.push({ assetId: asset.id, assetName: asset.name, quantity: qty || 1, type: asset.type });
        } else {
          // Add as manual item
          newItems.push({ assetId: `manual-${Date.now()}-${Math.random()}`, assetName: name, quantity: qty || 1, type: 'consumable' });
        }
      }
    });
    if (newItems.length) {
      setItems(prev => [...prev, ...newItems]);
      setBulkText('');
      setItemMode('single');
    }
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.assetId !== id));
  const updateQuantity = (id: string, qty: number) =>
    setItems(items.map(i => i.assetId === id ? { ...i, quantity: Math.max(1, qty) } : i));

  const handleSubmit = () => {
    if (!siteName || !driverName) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one item to the waybill');
      return;
    }
    createWaybill({
      siteId: sites.find(s => s.name === siteName)?.id || `site-${Date.now()}`,
      siteName,
      type: initialType,
      issueDate: new Date().toISOString(),
      driverName,
      vehicle: vehicleName,
      items: items.map(i => ({ assetId: i.assetId, assetName: i.assetName, quantity: i.quantity })),
    });
    toast.success(`Waybill created successfully for ${siteName}`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl p-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-8 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg mb-3">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {initialType === 'waybill' ? 'Create Waybill' : 'Create Return Sheet'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Issue assets for delivery to project sites</p>
          <DialogClose className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6">
          {/* Waybill Information */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Waybill Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Purpose */}
              <div className="space-y-1.5 md:col-span-1 row-span-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Purpose *</Label>
                <textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="e.g. Operational Activities"
                />
              </div>

              {/* Driver Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Driver Name *</Label>
                <div className="relative">
                  <select
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                  >
                    <option value="">Select Driver</option>
                    {uniqueDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Vehicle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vehicle *</Label>
                <div className="relative">
                  <select
                    value={vehicleName}
                    onChange={e => setVehicleName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                  >
                    <option value="">Select Vehicle</option>
                    {vehicleOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Site */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Site *</Label>
                <div className="relative">
                  <select
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                  >
                    <option value="">Select Site</option>
                    {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Expected Return Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expected Return Date</Label>
                <Input
                  type="date"
                  value={expectedReturnDate}
                  onChange={e => setExpectedReturnDate(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              {/* Service */}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service *</Label>
                <div className="relative">
                  <select
                    value={service}
                    onChange={e => setService(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none max-w-xs"
                  >
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Items to Issue */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Items to Issue</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-300"
                >
                  <FileText className="h-3 w-3" /> Add from Request
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('single')}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded transition-all",
                    itemMode === 'single' ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  Single Item
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('bulk')}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded transition-all",
                    itemMode === 'bulk' ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  Bulk Input
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!selectedAssetId}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-all disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>
            </div>

            {/* Single item search */}
            {itemMode === 'single' && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input
                  value={searchAsset}
                  onChange={e => { setSearchAsset(e.target.value); setSelectedAssetId(''); }}
                  placeholder="Search inventory by name..."
                  className="pl-10 h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
                {searchAsset && filteredAssets.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1">
                    {filteredAssets.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { setSelectedAssetId(a.id); setSearchAsset(a.name); }}
                        className="w-full text-left p-2.5 rounded-lg text-xs font-medium hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{a.name}</span>
                          <span className="ml-2 text-slate-400 capitalize">{a.type}</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-500">
                          {a.availableQuantity} {a.unitOfMeasurement}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bulk input */}
            {itemMode === 'bulk' && (
              <div className="mb-3 space-y-2">
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={4}
                  placeholder={"Enter items, one per line:\nBlind Pipes x 10\nSuction Pipe x 5\nTee Connectors x 2"}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <Button type="button" size="sm" onClick={addBulkItems} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
                  Parse & Add Items
                </Button>
              </div>
            )}

            {/* Items list */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden min-h-[120px]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300 dark:text-slate-600">
                  <FileText className="h-10 w-10 mb-2" />
                  <p className="text-sm font-medium">No items added yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, idx) => (
                    <div key={item.assetId} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.assetName}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{item.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm">−</button>
                          <span className="w-8 h-7 flex items-center justify-center text-xs font-black text-blue-600 border-x border-slate-200 dark:border-slate-700">
                            {item.quantity}
                          </span>
                          <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm">+</button>
                        </div>
                        <button type="button" onClick={() => removeItem(item.assetId)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/20">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-xl font-semibold text-xs uppercase text-slate-500">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={items.length === 0 || !siteName || !driverName}
            className="h-10 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase gap-2 shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Create Waybill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
