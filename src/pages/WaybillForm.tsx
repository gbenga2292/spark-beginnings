import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { 
  X, Plus, Trash2, Truck, ArrowRightLeft, 
  MapPin, Package, Search, CheckCircle2, AlertCircle, User
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { WaybillType } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/src/components/ui/dialog';

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
  const [vehicle, setVehicle] = useState('');
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

  const removeItem = (id: string) => setItems(items.filter(i => i.assetId !== id));
  const updateQuantity = (id: string, qty: number) => setItems(items.map(i => i.assetId === id ? { ...i, quantity: Math.max(1, qty) } : i));

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!siteName || !driverName || items.length === 0) return;
    createWaybill({
      siteId: 'site-' + Math.random().toString(36).substr(2, 5),
      siteName, type,
      issueDate: new Date().toISOString(),
      driverName, vehicle, items
    });
    onClose();
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchAsset.toLowerCase()) && 
    !items.find(i => i.assetId === a.id)
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm">
              {type === 'waybill' ? <Truck className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Generate New {type === 'waybill' ? 'Waybill' : 'Return Sheet'}</DialogTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Asset Movement & Logistics</p>
            </div>
          </div>
          <DialogClose className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[65vh] no-scrollbar p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              <h3 className="text-xs font-black uppercase text-blue-600 tracking-wider">Logistics Details</h3>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Destination Site *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input value={siteName} onChange={e => setSiteName(e.target.value)} required placeholder="e.g. Dangote Refinery Project"
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent focus-visible:ring-blue-500 font-medium text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Driver Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)} required placeholder="Full Name"
                      className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Vehicle Plate</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="ABC-123-XY"
                      className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm" />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                  This waybill will mark selected assets as "On Site" and release them from central inventory once confirmed.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <h3 className="text-xs font-black uppercase text-blue-600 tracking-wider">Asset Selection</h3>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input value={searchAsset} onChange={e => setSearchAsset(e.target.value)} placeholder="Search inventory..."
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm" />
                  
                  {searchAsset && filteredAssets.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1">
                      {filteredAssets.map(a => (
                        <button key={a.id} type="button"
                          onClick={() => { setSelectedAssetId(a.id); setSearchAsset(a.name); }}
                          className="w-full text-left p-2.5 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between">
                          <span className="text-slate-700 dark:text-slate-200">{a.name}</span>
                          <span className="text-[10px] text-slate-400">STOCK: {a.availableQuantity}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="button" onClick={addItem} disabled={!selectedAssetId} size="icon"
                  className="h-11 w-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.assetId} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{item.assetName}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-sm">-</button>
                        <span className="w-7 h-6 flex items-center justify-center text-xs font-black text-blue-600">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.assetId, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-sm">+</button>
                      </div>
                      <button type="button" onClick={() => removeItem(item.assetId)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                    <Package className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 italic">No assets selected yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/20">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-xl font-bold text-xs uppercase text-slate-500">Cancel</Button>
          <Button onClick={() => handleSubmit()} disabled={items.length === 0 || !siteName || !driverName}
            className="h-10 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase gap-2 shadow-sm disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Finalize Document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
