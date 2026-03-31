import React, { useState } from 'react';
import { useOperations } from '../../contexts/OperationsContext';
import { Calendar, Plus, PlusCircle, Activity, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/components/ui/toast';
import { SelectAssetsModal } from './SelectAssetsModal';
import { MaintenanceLogType } from '../../types';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';

export function LogMaintenanceForm() {
  const { logMaintenance, maintenanceAssets } = useOperations();
  const { isDark } = useTheme();
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
      date, type, technician, generalRemark,
      assets: selectedAssets.map(a => ({ assetId: a.id, assetName: a.name, remark: assetRemarks[a.id] || '' }))
    });
    toast.success(`Successfully logged maintenance for ${selectedAssetIds.length} assets.`);
    setDate(new Date().toISOString().split('T')[0]);
    setType('scheduled');
    setTechnician('');
    setGeneralRemark('');
    setSelectedAssetIds([]);
    setAssetRemarks({});
  };

  const selectClass = "w-full h-11 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-950 border border-transparent focus:ring-2 focus:ring-blue-500/20 outline-none font-medium text-sm text-slate-700 dark:text-slate-200 appearance-none";

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <Card className={cn(
        "rounded-2xl border shadow-sm overflow-hidden",
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      )}>
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

      <Card className={cn(
        "rounded-2xl border shadow-sm overflow-hidden",
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      )}>
        <CardHeader className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Machines for Maintenance</CardTitle>
            <CardDescription className="font-bold text-xs mt-0.5">Select the equipment handled in this session</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setIsSelectModalOpen(true)} size="sm"
            className="rounded-xl border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-widest text-blue-600 gap-1.5 h-9">
            <PlusCircle className="h-3.5 w-3.5" /> Add Machines
          </Button>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          {selectedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 sm:p-16 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border-2 border-dashed border-slate-100 dark:border-slate-800">
              <Plus className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-400 font-bold text-sm">No machines added yet</p>
              <p className="text-slate-300 dark:text-slate-600 text-xs font-bold mt-1">Click "Add Machines" to select</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedAssets.map(asset => (
                <div key={asset.id} className={cn(
                  "flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 rounded-xl border group hover:shadow-sm transition-all",
                  isDark ? "border-slate-800 bg-slate-800/30" : "border-slate-100 bg-white"
                )}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      {asset.category === 'machine' ? <Activity className="h-4 w-4 text-blue-600" /> : <Truck className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">{asset.name}</h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{asset.site} • {asset.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input placeholder="Specific remarks..." value={assetRemarks[asset.id] || ''}
                      onChange={(e) => setAssetRemarks(prev => ({ ...prev, [asset.id]: e.target.value }))}
                      className="h-9 rounded-lg bg-slate-50/50 dark:bg-slate-950 border-transparent text-xs font-bold flex-1 sm:w-48" />
                    <Button variant="ghost" onClick={() => setSelectedAssetIds(prev => prev.filter(id => id !== asset.id))}
                      size="icon" className="h-9 w-9 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" className="h-10 rounded-xl px-6 font-bold text-sm text-slate-500">Cancel</Button>
        <Button onClick={handleLog} disabled={selectedAssetIds.length === 0}
          className="h-10 rounded-xl px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest shadow-sm gap-2 disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" /> Save Logs ({selectedAssetIds.length})
        </Button>
      </div>

      <SelectAssetsModal isOpen={isSelectModalOpen} onClose={() => setIsSelectModalOpen(false)}
        selectedIds={selectedAssetIds} onSelect={setSelectedAssetIds} />
    </div>
  );
}
