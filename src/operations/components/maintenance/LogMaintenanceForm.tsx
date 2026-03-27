import React, { useState } from 'react';
import { useOperations } from '../../contexts/OperationsContext';
import { 
  Calendar, 
  Settings2, 
  Plus, 
  Trash2, 
  PlusCircle, 
  User, 
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Truck,
  HardHat
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';
import { SelectAssetsModal } from './SelectAssetsModal';
import { MaintenanceLogType, MaintenanceAsset } from '../../types';

export function LogMaintenanceForm() {
  const { logMaintenance, maintenanceAssets } = useOperations();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<MaintenanceLogType>('scheduled');
  const [technician, setTechnician] = useState('');
  const [generalRemark, setGeneralRemark] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetRemarks, setAssetRemarks] = useState<Record<string, string>>({});
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);

  const selectedAssets = maintenanceAssets.filter(a => selectedAssetIds.includes(a.id));

  const handleLog = () => {
    if (!technician || selectedAssetIds.length === 0) {
      toast.error('Please provide technician and at least one machine.');
      return;
    }

    logMaintenance({
      date,
      type,
      technician,
      generalRemark,
      assets: selectedAssets.map(a => ({
        assetId: a.id,
        assetName: a.name,
        remark: assetRemarks[a.id] || ''
      }))
    });

    toast.success(`Successfully logged maintenance for ${selectedAssetIds.length} assets.`);
    
    // Reset form
    setDate(new Date().toISOString().split('T')[0]);
    setType('scheduled');
    setTechnician('');
    setGeneralRemark('');
    setSelectedAssetIds([]);
    setAssetRemarks({});
  };

  const removeAsset = (id: string) => {
    setSelectedAssetIds(prev => prev.filter(aid => aid !== id));
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maintenance Date *</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                <Input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-slate-50 border-transparent font-medium" 
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maintenance Type *</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full h-14 rounded-2xl bg-slate-50 border-transparent px-6 font-medium text-slate-600 outline-none"
              >
                <option value="scheduled">Scheduled / Preventive</option>
                <option value="repair">Repair / Fix</option>
                <option value="routine">Routine Check</option>
                <option value="emergency">Emergency Response</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Technician / Done By *</label>
              <Input 
                placeholder="Select Technician"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="h-14 rounded-2xl bg-slate-50 border-transparent px-6 font-medium" 
              />
            </div>

            <div className="md:col-span-3 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">General Remark</label>
              <textarea 
                placeholder="General notes for this maintenance session..."
                value={generalRemark}
                onChange={(e) => setGeneralRemark(e.target.value)}
                className="w-full h-24 rounded-2xl bg-slate-50 border-transparent p-6 font-medium text-slate-600 outline-none resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between">
           <div>
              <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-tight">Machines for Maintenance</CardTitle>
              <CardDescription className="font-bold text-xs mt-1">Select the equipment handled in this session</CardDescription>
           </div>
           <Button 
             variant="outline" 
             onClick={() => setIsSelectModalOpen(true)}
             className="rounded-xl border-slate-100 font-black text-[10px] uppercase tracking-widest text-blue-600 gap-2 h-12 shadow-sm"
           >
              <PlusCircle className="h-4 w-4" /> Add Machines
           </Button>
        </CardHeader>
        <CardContent className="p-10">
          {selectedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
               <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                  <Plus className="h-8 w-8 text-slate-300" />
               </div>
               <p className="text-slate-400 font-bold text-sm">No machines added yet</p>
               <p className="text-slate-300 text-xs font-bold mt-1">Click "Add Machines" to select machines for maintenance</p>
            </div>
          ) : (
            <div className="space-y-6">
               {selectedAssets.map(asset => (
                 <div key={asset.id} className="flex items-center gap-6 p-6 rounded-3xl border border-slate-100 bg-white group hover:shadow-lg transition-all">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                       {asset.category === 'machine' ? <Activity className="h-6 w-6 text-blue-600" /> : <Truck className="h-6 w-6 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                       <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{asset.name}</h4>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{asset.site} • {asset.id}</span>
                    </div>
                    <div className="flex-1">
                       <Input 
                         placeholder="Specific remarks for this machine..."
                         value={assetRemarks[asset.id] || ''}
                         onChange={(e) => setAssetRemarks(prev => ({ ...prev, [asset.id]: e.target.value }))}
                         className="h-12 rounded-xl bg-slate-50 border-transparent border-0 px-4 text-xs font-bold" 
                       />
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => removeAsset(asset.id)}
                      className="h-12 w-12 rounded-xl text-rose-500 hover:bg-rose-50"
                    >
                       <XCircle className="h-5 w-5" />
                    </Button>
                 </div>
               ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 mt-8">
         <Button variant="outline" className="h-14 rounded-2xl px-10 font-bold text-slate-500">Cancel</Button>
         <Button 
           onClick={handleLog}
           disabled={selectedAssetIds.length === 0}
           className="h-14 rounded-2xl px-10 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 gap-3"
         >
            <CheckCircle2 className="h-4 w-4" /> Save Maintenance Logs ({selectedAssetIds.length})
         </Button>
      </div>

      <SelectAssetsModal 
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        selectedIds={selectedAssetIds}
        onSelect={setSelectedAssetIds}
      />
    </div>
  );
}
