import React, { useState } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore, Site } from '@/src/store/appStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { toast } from '@/src/components/ui/toast';
import { Circle, CheckCircle2, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface SiteItem {
  assetId: string;
  assetName: string;
  quantity: number;
  unit?: string;
  type?: string;
  lastUpdated?: string;
}

interface CreateReturnWaybillProps {
  site: Site;
  inventoryItems: SiteItem[];
  onBack: () => void;
}

const SERVICES = ['Dewatering', 'Waterproofing', 'Jetting', 'Tiling', 'General'] as const;

export function CreateReturnWaybill({ site, inventoryItems, onBack }: CreateReturnWaybillProps) {
  const { createWaybill, vehicles } = useOperations();
  const { employees } = useAppStore();

  const [purpose, setPurpose] = useState('Material Return');
  const [driverName, setDriverName] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [service, setService] = useState('Dewatering');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [returnTo, setReturnTo] = useState('Office');
  const [addSignature, setAddSignature] = useState(false);

  // Key: assetId, Value: quantity to return
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

  const driverOptions = [
    ...employees.filter(e => ['Driver', 'Foreman', 'Site Supervisor', 'Assistant Supervisor'].includes(e.position || ''))
      .map(e => `${e.firstname} ${e.surname}`),
  ];
  const uniqueDrivers = Array.from(new Set(driverOptions));
  const vehicleOptions = vehicles.map(v => v.name);

  const toggleItem = (item: SiteItem) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[item.assetId]) {
        delete copy[item.assetId];
      } else {
        copy[item.assetId] = item.quantity; // default to returning all
      }
      return copy;
    });
  };

  const updateItemReturnQty = (assetId: string, qty: number, maxQty: number) => {
    if (qty < 1) qty = 1;
    if (qty > maxQty) qty = maxQty;
    setSelectedItems(prev => ({ ...prev, [assetId]: qty }));
  };

  const handleSubmit = () => {
    const itemIds = Object.keys(selectedItems);
    if (itemIds.length === 0) {
      toast.error('Select at least one item to return');
      return;
    }
    if (!driverName || !vehicleName) {
      toast.error('Please select both Driver and Vehicle');
      return;
    }

    const itemsToReturn = itemIds.map(id => {
      const asset = inventoryItems.find(i => i.assetId === id);
      return {
        assetId: id,
        assetName: asset?.assetName || 'Unknown',
        quantity: selectedItems[id]
      };
    });

    createWaybill({
      siteId: site.id,
      siteName: site.name,
      type: 'return',
      issueDate: new Date().toISOString(),
      driverName,
      vehicle: vehicleName,
      items: itemsToReturn,
    });
    
    toast.success('Return waybill created successfully!');
    onBack();
  };

  useSetPageTitle(
    `Create Return Waybill - ${site.name}`,
    'Create a return waybill for materials from this site',
    (
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="gap-2 text-slate-600 font-bold h-9"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold h-9"
        >
          <Package className="h-4 w-4" /> Create Return
        </Button>
      </div>
    ),
    [site.name, onBack, handleSubmit]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/30">

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 space-y-8">
          {/* Driver & Vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Driver *</Label>
              <div className="relative">
                <select
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-800 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                >
                  <option value="">Select Driver</option>
                  {uniqueDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Vehicle *</Label>
              <div className="relative">
                <select
                  value={vehicleName}
                  onChange={e => setVehicleName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-800 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                >
                  <option value="">Select Vehicle</option>
                  {vehicleOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Purpose, Service, Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Purpose</Label>
              <Input
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="h-11 rounded-xl shadow-none border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-800 focus-visible:bg-white focus-visible:ring-blue-500/20 focus-visible:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Service</Label>
              <div className="relative">
                <select
                  value={service}
                  onChange={e => setService(e.target.value)}
                  className="w-full h-11 rounded-xl border shadow-none border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-800 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                >
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Expected Return Date</Label>
              <Input
                type="date"
                value={expectedReturnDate}
                onChange={e => setExpectedReturnDate(e.target.value)}
                className="h-11 rounded-xl shadow-none border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-800 focus-visible:bg-white focus-visible:ring-blue-500/20 focus-visible:border-blue-500"
              />
            </div>
          </div>

          {/* Materials */}
          <div className="space-y-4 pt-2">
            <h3 className="text-[15px] font-bold text-slate-800">Select Materials to Return</h3>
            <div className="space-y-3">
              {inventoryItems.filter(i => i.quantity > 0).length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-slate-400 font-medium">No returnable materials currently logged at this site.</p>
                </div>
              ) : inventoryItems.filter(i => i.quantity > 0).map(item => {
                const isSelected = !!selectedItems[item.assetId];
                return (
                  <label 
                    key={item.assetId} 
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl cursor-pointer transition-all gap-4",
                      isSelected 
                        ? "border-blue-200 bg-blue-50/30" 
                        : "border-slate-200 hover:border-blue-200 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0" onClick={() => toggleItem(item)}>
                        {isSelected ? <CheckCircle2 className="h-5 w-5 text-blue-500" /> : <Circle className="h-5 w-5 text-slate-300" />}
                      </div>
                      <div onClick={() => toggleItem(item)}>
                        <p className="text-sm font-bold text-slate-800">{item.assetName}</p>
                        <p className="text-xs font-medium text-slate-500">At Site: {item.quantity} {item.unit || 'pcs'}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                        <Label className="text-xs font-bold text-slate-500">Qty to Return:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={selectedItems[item.assetId] || 1}
                          onChange={(e) => updateItemReturnQty(item.assetId, parseInt(e.target.value) || 1, item.quantity)}
                          className="w-20 h-9 font-bold text-center"
                        />
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 md:w-1/3">
            <Label className="text-xs font-bold text-slate-700">Return To</Label>
            <div className="relative">
              <select
                value={returnTo}
                onChange={e => setReturnTo(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-800 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
              >
                <option value="Office">Office</option>
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Other Site">Other Site</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer w-fit pt-2">
            <div onClick={() => setAddSignature(!addSignature)}>
              {addSignature ? <CheckCircle2 className="h-5 w-5 text-blue-500" /> : <Circle className="h-5 w-5 text-slate-300" />}
            </div>
            <span className="text-sm font-bold text-slate-700 select-none pb-0.5" onClick={() => setAddSignature(!addSignature)}>Add my signature to return waybill PDF</span>
          </label>

          </div>
        </div>
      </div>
    </div>
  );
}
