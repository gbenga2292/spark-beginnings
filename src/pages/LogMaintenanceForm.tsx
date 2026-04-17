import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { Calendar, Plus, PlusCircle, Activity, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Label } from '@/src/components/ui/label';
import { toast } from '@/src/components/ui/toast';
import { SelectAssetsModal } from './SelectAssetsModal';
import { MaintenanceLogType } from '@/src/types/operations';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

export function LogMaintenanceForm() {
  const { logMaintenance, maintenanceAssets, assets } = useOperations();
  const { isDark } = useTheme();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<MaintenanceLogType>('scheduled');
  const [technician, setTechnician] = useState('');
  const [generalRemark, setGeneralRemark] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  
  // Advanced State for individual machines
  const [assetData, setAssetData] = useState<Record<string, any>>({});
  
  // Dialog States
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [isInventoryPartModalOpen, setIsInventoryPartModalOpen] = useState(false);
  const [isCustomPartModalOpen, setIsCustomPartModalOpen] = useState(false);
  
  // Form State for Modals
  const [inventoryPartFilter, setInventoryPartFilter] = useState('');
  const [customPartForm, setCustomPartForm] = useState({ name: '', qty: 1, cost: '' });
  
  const reusables = assets.filter(a => a.type === 'reusable' || a.category === 'consumable');

  const updateAssetData = (id: string, field: string, value: any) => {
    setAssetData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

  const selectedAssets = maintenanceAssets.filter(a => selectedAssetIds.includes(a.id));

  const handleLog = () => {
    if (!technician || selectedAssetIds.length === 0) {
      toast.error('Please provide technician and at least one machine.');
      return;
    }
    logMaintenance({
      date, type, technician, generalRemark,
      assets: selectedAssets.map(a => ({ assetId: a.id, assetName: a.name, remark: assetData[a.id]?.remark || '' }))
    });
    toast.success(`Successfully logged maintenance for ${selectedAssetIds.length} assets.`);
    setDate(new Date().toISOString().split('T')[0]);
    setType('scheduled');
    setTechnician('');
    setGeneralRemark('');
    setSelectedAssetIds([]);
    setAssetData({});
  };

  const handleAddInventoryPart = (assetId: string, part: any) => {
    const existingParts = assetData[assetId]?.parts || [];
    updateAssetData(assetId, 'parts', [...existingParts, { ...part, type: 'inventory', addedQty: 1 }]);
    setIsInventoryPartModalOpen(false);
    toast.success(`${part.name} added to parts!`);
  };

  const handleAddCustomPart = () => {
    if (!activeAssetId || !customPartForm.name || customPartForm.qty <= 0) return;
    const existingParts = assetData[activeAssetId]?.parts || [];
    updateAssetData(activeAssetId, 'parts', [...existingParts, { 
      type: 'custom', 
      name: customPartForm.name, 
      quantity: customPartForm.qty, 
      cost: parseFloat(customPartForm.cost) || 0 
    }]);
    setCustomPartForm({ name: '', qty: 1, cost: '' });
    setIsCustomPartModalOpen(false);
    toast.success(`Custom part added!`);
  };

  const removePart = (assetId: string, idxToRemove: number) => {
    const existingParts = assetData[assetId]?.parts || [];
    updateAssetData(assetId, 'parts', existingParts.filter((_: any, idx: number) => idx !== idxToRemove));
  };

  const selectClass = "w-full h-11 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-950 border border-transparent focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-sm text-slate-700 dark:text-slate-200 appearance-none";

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-border shadow-sm overflow-hidden bg-card transition-all">
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maintenance Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maintenance Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className={selectClass}>
                <option value="scheduled">Scheduled / Preventive</option>
                <option value="repair">Repair / Fix</option>
                <option value="routine">Routine Check</option>
                <option value="emergency">Emergency Response</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Technician *</label>
              <Input placeholder="Select Technician" value={technician} onChange={(e) => setTechnician(e.target.value)}
                className="h-11 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-transparent font-medium text-sm" />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">General Remark</label>
              <textarea placeholder="General notes for this session..." value={generalRemark} onChange={(e) => setGeneralRemark(e.target.value)}
                className="w-full h-20 rounded-xl bg-slate-50/50 dark:bg-slate-950 border border-transparent p-4 font-medium text-sm text-slate-700 dark:text-slate-200 outline-none resize-none" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border shadow-sm overflow-hidden bg-card transition-all">
        <CardHeader className="p-5 sm:p-6 border-b border-border flex flex-row items-center justify-between space-y-0 bg-slate-50/50">
          <div>
            <CardTitle className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Machines for Maintenance</CardTitle>
            <CardDescription className="font-bold text-xs mt-0.5">Select the equipment handled in this session</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setIsSelectModalOpen(true)} size="sm"
            className="rounded-xl border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-widest text-blue-600 gap-1.5 h-9">
            <PlusCircle className="h-3.5 w-3.5" /> Add Machines
          </Button>
        </CardHeader>
        <div className="px-5 sm:px-6 pb-6">
          {selectedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 sm:p-16 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 mt-2">
              <Plus className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-400 font-bold text-sm">No machines added yet</p>
              <p className="text-slate-300 dark:text-slate-600 text-xs font-medium mt-1">Click "Add Machines" to select</p>
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {selectedAssets.map(asset => (
                <div key={asset.id} className="flex flex-col p-6 rounded-xl border border-border shadow-sm space-y-6 bg-card transition-all">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       {asset.name}
                    </h4>
                    <div className="flex items-center gap-4">
                       <Badge className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 text-xs font-semibold h-7 leading-none pt-0.5">
                         {asset.status === 'ok' ? 'active' : asset.status}
                       </Badge>
                       <Button variant="ghost" size="icon" onClick={() => setSelectedAssetIds(prev => prev.filter(id => id !== asset.id))} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full h-8 w-8">
                         <XCircle className="h-5 w-5" />
                       </Button>
                    </div>
                  </div>
                  
                  {/* Form fields for this asset */}
                  <div className="space-y-6">
                     <div className="space-y-2">
                       <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Maintenance Performed *</label>
                       <textarea 
                          placeholder="Describe the maintenance work done..." 
                          value={assetData[asset.id]?.workDone || ''}
                          onChange={(e) => updateAssetData(asset.id, 'workDone', e.target.value)}
                          className="w-full h-24 rounded-lg bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-medium" 
                       />
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Location</label>
                          <select 
                            value={assetData[asset.id]?.location || ''}
                            onChange={(e) => updateAssetData(asset.id, 'location', e.target.value)}
                            className="w-full h-11 rounded-lg bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium px-3 outline-none appearance-none"
                            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                          >
                             <option value="" disabled>Select Location...</option>
                             <option value="On-Site">On-Site</option>
                             <option value="Workshop">Workshop</option>
                             <option value="External Vendor">External Vendor</option>
                          </select>
                       </div>
                       <div className="flex flex-col justify-center space-y-2 pt-1 md:pt-6">
                           <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={assetData[asset.id]?.shutdown || false}
                                onChange={(e) => updateAssetData(asset.id, 'shutdown', e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                              />
                              Record Shutdown / Downtime
                           </label>
                           <p className="text-[11px] text-slate-400 font-medium pl-7">Check this if the machine was shut down for maintenance</p>
                       </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Next Maintenance Date</label>
                        <div className="relative">
                           <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                           <Input 
                             type="date" 
                             value={assetData[asset.id]?.nextDate || ''}
                             onChange={(e) => updateAssetData(asset.id, 'nextDate', e.target.value)}
                             className="h-11 pl-11 rounded-lg bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300" 
                           />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">Defaults to standard cycle, but you can override it here.</p>
                     </div>
                     
                     <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Parts Replaced</label>
                        
                        {/* Display Added Parts */}
                        {assetData[asset.id]?.parts?.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {assetData[asset.id].parts.map((part: any, idx: number) => (
                              <div key={idx} className="flex flex-row items-center justify-between p-3 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/50 text-sm">
                                <div>
                                  <span className="font-semibold text-foreground">{part.name}</span>
                                  <span className="text-muted-foreground ml-2">x{part.quantity || part.addedQty}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {part.type === 'custom' && part.cost > 0 && (
                                    <span className="font-medium text-muted-foreground">₦{part.cost.toLocaleString()}</span>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => removePart(asset.id, idx)} className="h-6 w-6 text-rose-500 rounded-md hover:bg-rose-100">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="h-14 rounded-lg bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center px-5 gap-6 border-dashed">
                           <button onClick={() => { setActiveAssetId(asset.id); setIsInventoryPartModalOpen(true); }} className="flex items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors">
                             <Plus className="h-3.5 w-3.5" /> From Inventory
                           </button>
                           <button onClick={() => { setActiveAssetId(asset.id); setIsCustomPartModalOpen(true); }} className="flex items-center gap-2 text-[13px] font-bold text-orange-600 hover:text-orange-700 transition-colors">
                             <Plus className="h-3.5 w-3.5" /> Custom Part
                           </button>
                        </div>
                     </div>

                     <div className="space-y-2 pt-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Machine-Specific Remark (optional)</label>
                        <Input 
                          placeholder="Specific notes for this machine (overrides general remark)" 
                          value={assetData[asset.id]?.remark || ''}
                          onChange={(e) => updateAssetData(asset.id, 'remark', e.target.value)}
                          className="h-11 rounded-lg bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500" 
                        />
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button variant="outline" className="h-11 rounded-xl px-6 font-bold text-sm text-foreground hover:bg-secondary">Cancel</Button>
        <Button onClick={handleLog} disabled={selectedAssetIds.length === 0}
          className="h-11 rounded-xl px-8 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm shadow-sm gap-2 disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" /> SAVE LOGS {selectedAssetIds.length > 0 && `(${selectedAssetIds.length})`}
        </Button>
      </div>

      <SelectAssetsModal isOpen={isSelectModalOpen} onClose={() => setIsSelectModalOpen(false)}
        selectedIds={selectedAssetIds} onSelect={setSelectedAssetIds} />

      {/* Inventory Part Modal */}
      <Dialog open={isInventoryPartModalOpen} onOpenChange={setIsInventoryPartModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Select Reusable Part</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input 
              placeholder="Search inventory..." 
              value={inventoryPartFilter}
              onChange={(e) => setInventoryPartFilter(e.target.value)}
              className="bg-background border-border h-11 rounded-xl"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {reusables.filter((r: any) => r.name.toLowerCase().includes(inventoryPartFilter.toLowerCase())).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground font-medium">No matching items found.</p>
                </div>
              ) : (
                reusables.filter((r: any) => r.name.toLowerCase().includes(inventoryPartFilter.toLowerCase())).map((item: any) => (
                  <button 
                    key={item.id} 
                    onClick={() => { if (activeAssetId) handleAddInventoryPart(activeAssetId, item); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-secondary/50 text-left transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{item.name}</h4>
                      <p className="text-[11px] text-muted-foreground uppercase">{item.type} • Stock: {item.quantity || 0}</p>
                    </div>
                    <PlusCircle className="h-4 w-4 text-primary" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Custom Part Modal */}
      <Dialog open={isCustomPartModalOpen} onOpenChange={setIsCustomPartModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-card border-border p-6 shadow-xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              Add Custom Part 
              <span className="font-semibold text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">(Not in Inventory)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Part Name <span className="text-rose-500">*</span></Label>
              <Input 
                placeholder="e.g., Brake Pads, Oil Filter" 
                value={customPartForm.name}
                onChange={e => setCustomPartForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-background border-border h-11 rounded-xl font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quantity <span className="text-rose-500">*</span></Label>
                <Input 
                  type="number" 
                  min="1"
                  value={customPartForm.qty}
                  onChange={e => setCustomPartForm(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                  className="bg-background border-border h-11 rounded-xl font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cost (₦) <span className="text-rose-500">*</span></Label>
                <Input 
                  type="text" 
                  placeholder="e.g. 5000"
                  value={customPartForm.cost}
                  onChange={e => setCustomPartForm(prev => ({ ...prev, cost: e.target.value }))}
                  className="bg-background border-border h-11 rounded-xl font-medium"
                />
              </div>
            </div>
            <Button onClick={handleAddCustomPart} disabled={!customPartForm.name} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide rounded-xl mt-4 transition-all">
              Add Custom Part
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
