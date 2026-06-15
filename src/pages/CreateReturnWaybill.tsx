import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore, Site } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { toast } from '@/src/components/ui/toast';
import { Circle, CheckCircle2, ChevronDown, Package, Search } from 'lucide-react';
import { cn, formatUnit } from '@/src/lib/utils';
import { getPositionIndex } from '@/src/lib/hierarchy';
import { Waybill } from '../types/operations';

export interface SiteItem {
  assetId: string;
  assetName: string;
  quantity: number;
  unit?: string;
  type?: string;
  lastUpdated?: string;
  pendingReturnQuantity?: number;
}

interface CreateReturnWaybillProps {
  site?: Site;
  inventoryItems?: SiteItem[];
  onBack: () => void;
  editWaybill?: Waybill;
}

const SERVICES = ['Dewatering', 'Waterproofing', 'Jetting', 'Tiling', 'General'] as const;

export function CreateReturnWaybill({ site, inventoryItems, onBack, editWaybill }: CreateReturnWaybillProps) {
  const { createWaybill, updateWaybill, vehicles, waybills, assets } = useOperations();
  const { employees, consumableLogs } = useAppStore();
  const sites = useAppStore(s => s.sites);
  const currentUser = useUserStore(s => s.getCurrentUser());

  const resolvedSite = site || (editWaybill ? sites.find(s => s.id === editWaybill.siteId) : null);

  const resolvedInventoryItems = useMemo(() => {
    if (inventoryItems) return inventoryItems;
    if (!resolvedSite) return [];

    // All waybills for this site
    const siteWaybills = waybills.filter(w =>
      (w.siteName?.toLowerCase() === resolvedSite.name.toLowerCase() ||
      w.siteId === resolvedSite.id) &&
      (w.status !== 'outstanding' || w.type === 'return')
    );

    // Build site inventory by aggregating all waybill items
    const inventoryMap = new Map<string, SiteItem>();
    siteWaybills
      .filter(w => w.type === 'waybill' && w.status !== 'outstanding')
      .forEach(wb => {
        wb.items.forEach(item => {
          const existing = inventoryMap.get(item.assetId);
          const assetMeta = assets.find(a => a.id === item.assetId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.lastUpdated = wb.issueDate;
          } else {
            inventoryMap.set(item.assetId, {
              assetId: item.assetId,
              assetName: item.assetName,
              quantity: item.quantity,
              unit: assetMeta?.unitOfMeasurement || 'pcs',
              type: assetMeta?.type || 'non-consumable',
              lastUpdated: wb.issueDate,
              pendingReturnQuantity: 0,
            });
          }
        });
      });

    // Subtract returns and track pending returns
    siteWaybills
      .filter(w => w.type === 'return')
      .forEach(wb => {
        wb.items.forEach(item => {
          const existing = inventoryMap.get(item.assetId);
          if (existing) {
            if (wb.status === 'return_completed') {
              existing.quantity = Math.max(0, existing.quantity - item.quantity);
            } else {
              if (!editWaybill || wb.id !== editWaybill.id) {
                existing.pendingReturnQuantity = (existing.pendingReturnQuantity || 0) + item.quantity;
              }
            }
          }
        });
      });

    // Subtract consumed usages
    const siteConsumableLogs = consumableLogs.filter(log => log.siteId === resolvedSite.id);
    siteConsumableLogs.forEach(log => {
      const existing = inventoryMap.get(log.assetId);
      if (existing) {
        existing.quantity = Math.max(0, existing.quantity - log.quantityUsed);
      }
    });

    return Array.from(inventoryMap.values()).filter(i => i.quantity > 0);
  }, [inventoryItems, resolvedSite, waybills, assets, consumableLogs, editWaybill]);

  const [purpose, setPurpose] = useState('Material Return');
  const [driverName, setDriverName] = useState(editWaybill?.driverName || '');
  const [driverSearch, setDriverSearch] = useState('');
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);
  const driverComboRef = useRef<HTMLDivElement>(null);
  const [vehicleName, setVehicleName] = useState(editWaybill?.vehicle || '');
  const [service, setService] = useState('Dewatering');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [returnTo, setReturnTo] = useState('Office');
  const [addSignature, setAddSignature] = useState(() => {
    if (editWaybill) {
      return !!editWaybill.signature;
    }
    return !!currentUser?.signature;
  });

  // Close driver dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (driverComboRef.current && !driverComboRef.current.contains(e.target as Node)) {
        setDriverDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Key: assetId, Value: quantity to return
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(() => {
    if (editWaybill) {
      const initial: Record<string, number> = {};
      editWaybill.items.forEach(item => {
        initial[item.assetId] = item.quantity;
      });
      return initial;
    }
    return {};
  });

  const returnableItems = resolvedInventoryItems.filter(i => (i.quantity - (i.pendingReturnQuantity || 0)) > 0);
  const allSelected = returnableItems.length > 0 && returnableItems.every(i => !!selectedItems[i.assetId]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedItems({});
    } else {
      const nextSelected: Record<string, number> = {};
      returnableItems.forEach(item => {
        nextSelected[item.assetId] = item.quantity - (item.pendingReturnQuantity || 0);
      });
      setSelectedItems(nextSelected);
    }
  };

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

  // Filtered list based on what the user has typed
  const filteredDrivers = uniqueDrivers.filter(d =>
    d.toLowerCase().includes(driverSearch.toLowerCase())
  );

  const vehicleOptions = vehicles.map(v => v.name);

  const toggleItem = (item: SiteItem) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[item.assetId]) {
        delete copy[item.assetId];
      } else {
        copy[item.assetId] = item.quantity - (item.pendingReturnQuantity || 0); // default to returning all available
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
    if (!resolvedSite) {
      toast.error('Site information is missing');
      return;
    }

    const itemsToReturn = itemIds.map(id => {
      const asset = resolvedInventoryItems.find(i => i.assetId === id);
      return {
        assetId: id,
        assetName: asset?.assetName || 'Unknown',
        quantity: selectedItems[id]
      };
    });

    if (editWaybill) {
      updateWaybill(editWaybill.id, {
        driverName,
        vehicle: vehicleName,
        items: itemsToReturn,
        signature: addSignature ? (editWaybill.signature || currentUser?.signature || '') : '',
      });
      toast.success('Return waybill updated successfully!');
    } else {
      createWaybill({
        siteId: resolvedSite.id,
        siteName: resolvedSite.name,
        type: 'return',
        issueDate: new Date().toISOString(),
        driverName,
        vehicle: vehicleName,
        items: itemsToReturn,
        signature: addSignature ? (currentUser?.signature || '') : '',
      } as any);
      toast.success('Return waybill created successfully!');
    }
    onBack();
  };

  const isEditing = !!editWaybill;

  useSetPageTitle(
    isEditing ? `Edit Return Waybill - ${resolvedSite?.name}` : `Create Return Waybill - ${resolvedSite?.name}`,
    isEditing ? `Editing return waybill ${editWaybill?.id}` : 'Create a return waybill for materials from this site',
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
          <Package className="h-4 w-4" /> {isEditing ? 'Save Changes' : 'Create Return'}
        </Button>
      </div>
    ),
    [resolvedSite?.name, onBack, handleSubmit, isEditing, editWaybill?.id]
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
              <div className="relative" ref={driverComboRef}>
                {/* Combobox input — shows selected name or lets user type */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Select or type driver name…"
                    value={driverDropdownOpen ? driverSearch : driverName}
                    onFocus={() => {
                      setDriverSearch(driverName);
                      setDriverDropdownOpen(true);
                    }}
                    onChange={e => {
                      setDriverSearch(e.target.value);
                      setDriverName(e.target.value);
                      setDriverDropdownOpen(true);
                    }}
                    onBlur={() => {
                      // small delay so click on option registers first
                      setTimeout(() => setDriverDropdownOpen(false), 150);
                    }}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-10 text-sm font-semibold text-slate-800 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <ChevronDown
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer transition-transform",
                      driverDropdownOpen && "rotate-180"
                    )}
                    onMouseDown={e => {
                      e.preventDefault();
                      setDriverDropdownOpen(prev => !prev);
                      if (!driverDropdownOpen) setDriverSearch('');
                    }}
                  />
                </div>

                {/* Dropdown list */}
                {driverDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      {filteredDrivers.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 font-medium">
                          No match — "{driverSearch}" will be used as the driver name.
                        </div>
                      ) : (
                        filteredDrivers.map(d => (
                          <button
                            key={d}
                            type="button"
                            onMouseDown={() => {
                              setDriverName(d);
                              setDriverSearch(d);
                              setDriverDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-blue-50 hover:text-blue-700",
                              driverName === d ? "bg-blue-50 text-blue-700" : "text-slate-800"
                            )}
                          >
                            {d}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
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
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-800">Select Materials to Return</h3>
              {returnableItems.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors select-none"
                >
                  {allSelected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4 text-blue-600" />
                      Select All
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {resolvedInventoryItems.filter(i => (i.quantity - (i.pendingReturnQuantity || 0)) > 0).length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-slate-400 font-medium">No returnable materials currently logged at this site.</p>
                </div>
              ) : resolvedInventoryItems.filter(i => (i.quantity - (i.pendingReturnQuantity || 0)) > 0).map(item => {
                const isSelected = !!selectedItems[item.assetId];
                const availableToReturn = item.quantity - (item.pendingReturnQuantity || 0);
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
                        <p className="text-xs font-medium text-slate-500">
                          At Site: {item.quantity} {formatUnit(item.unit)}
                          {item.pendingReturnQuantity && item.pendingReturnQuantity > 0 ? ` (${item.pendingReturnQuantity} pending return)` : ''}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                        <Label className="text-xs font-bold text-slate-500">Qty to Return:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={availableToReturn}
                          value={selectedItems[item.assetId] || 1}
                          onChange={(e) => updateItemReturnQty(item.assetId, parseInt(e.target.value) || 1, availableToReturn)}
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

          <div 
            onClick={() => {
              if (!addSignature && !currentUser?.signature) {
                toast.error('Please upload your signature in Profile settings first.');
                return;
              }
              setAddSignature(!addSignature);
            }}
            className="flex items-center gap-2 cursor-pointer w-fit pt-2 select-none"
          >
            {addSignature ? <CheckCircle2 className="h-5 w-5 text-blue-500" /> : <Circle className="h-5 w-5 text-slate-300" />}
            <span className="text-sm font-bold text-slate-700 pb-0.5">Add my signature to return waybill PDF</span>
          </div>

          </div>
        </div>
      </div>
    </div>
  );
}
