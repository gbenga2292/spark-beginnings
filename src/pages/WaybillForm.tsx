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
    <div className="max-w-4xl mx-auto pb-10 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                {initialType === 'waybill' ? 'Create Waybill' : 'Create Return Sheet'}
              </h2>
              <p className="text-muted-foreground font-bold text-xs mt-0.5">Issue assets for delivery to project sites</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-8">
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
                    {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
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
                    itemMode === 'single' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Single Item
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('bulk')}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                    itemMode === 'bulk' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Bulk Input
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!selectedAssetId}
                  className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg transition-all hover:bg-primary/90 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>
            </div>

            {/* Single item search */}
            {itemMode === 'single' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchAsset}
                  onChange={e => { setSearchAsset(e.target.value); setSelectedAssetId(''); }}
                  placeholder="Search inventory by name..."
                  className="pl-10 h-10 rounded-xl border-border bg-background text-sm"
                />
                {searchAsset && filteredAssets.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-1 pb-1">
                    {filteredAssets.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => { setSelectedAssetId(a.id); setSearchAsset(a.name); }}
                        className="w-full text-left p-2.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors flex items-center justify-between text-foreground"
                      >
                        <div>
                          <span className="font-bold">{a.name}</span>
                          <span className="ml-2 text-muted-foreground capitalize">{a.type}</span>
                        </div>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-bold text-muted-foreground">
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
              <div className="space-y-2">
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  rows={4}
                  placeholder={`Enter items, one per line:\nBlind Pipes x 10\nSuction Pipe x 5\nTee Connectors x 2`}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
                <Button type="button" size="sm" onClick={addBulkItems} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 font-bold rounded-lg px-4">
                  Parse & Add Items
                </Button>
              </div>
            )}

            {/* Items list */}
            <div className="rounded-xl border border-border overflow-hidden bg-background min-h-[120px]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm font-bold opacity-50 uppercase tracking-widest">No items added yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <div key={item.assetId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{item.assetName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{item.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex bg-card rounded-lg border border-border overflow-hidden">
                          <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground font-black text-sm transition-colors">−</button>
                          <span className="w-8 h-7 flex items-center justify-center text-xs font-black text-foreground border-x border-border">
                            {item.quantity}
                          </span>
                          <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground font-black text-sm transition-colors">+</button>
                        </div>
                        <button type="button" onClick={() => removeItem(item.assetId)}
                          className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
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
        <div className="p-5 border-t border-border flex justify-end gap-3 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-xl font-black text-xs uppercase text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={items.length === 0 || !siteName || !driverName}
            className="h-10 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest gap-2 shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Create Waybill
          </Button>
        </div>
      </div>
    </div>
  );
}
