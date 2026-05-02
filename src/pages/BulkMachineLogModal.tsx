import { useState, useEffect } from 'react';
import { useOperations } from '@/src/contexts/OperationsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Wrench, User, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/src/store/appStore';
import { cn } from '@/src/lib/utils';

interface BulkMachineLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  machines: { id: string; name: string }[];
  date: string;
}

export function BulkMachineLogModal({ isOpen, onClose, siteId, siteName, machines, date }: BulkMachineLogModalProps) {
  const { logDailyActivity } = useOperations();
  const { employees } = useAppStore();

  const dewateringStaff = employees.filter(e => 
    (e.department === 'Dewatering' || e.department?.toLowerCase() === 'dewatering') && 
    e.staffType === 'FIELD'
  );

  const [machineData, setMachineData] = useState<Record<string, { isActive: boolean; dieselUsage: string }>>({});
  const [supervisorOnSite, setSupervisorOnSite] = useState('');
  const [issuesOnSite, setIssuesOnSite] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const areAllInactive = machines.length > 0 && machines.every(m => machineData[m.id] && !machineData[m.id].isActive);

  useEffect(() => {
    if (isOpen) {
      const initData: Record<string, { isActive: boolean; dieselUsage: string }> = {};
      machines.forEach(m => {
        initData[m.id] = { isActive: true, dieselUsage: '' };
      });
      setMachineData(initData);
      setSupervisorOnSite('');
      setIssuesOnSite('');
      setMaintenanceDetails('');
      setClientFeedback('');
    }
  }, [isOpen, machines]);

  const handleToggleActive = (id: string, active: boolean) => {
    setMachineData(p => ({ ...p, [id]: { ...p[id], isActive: active, dieselUsage: active ? p[id].dieselUsage : '' } }));
  };

  const handleDieselChange = (id: string, val: string) => {
    setMachineData(p => ({ ...p, [id]: { ...p[id], dieselUsage: val } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const promises = machines.map(m => {
        const data = machineData[m.id] || { isActive: true, dieselUsage: '' };
        return logDailyActivity({
          assetId: m.id,
          assetName: m.name,
          siteId,
          siteName,
          date,
          isActive: data.isActive,
          dieselUsage: parseFloat(data.dieselUsage) || 0,
          issuesOnSite,
          clientFeedback: data.isActive ? clientFeedback : '',
          maintenanceDetails: data.isActive ? maintenanceDetails : '',
          supervisorOnSite: data.isActive ? supervisorOnSite : '',
          downtimeEntries: []
        });
      });

      await Promise.all(promises);
      toast.success(`Successfully logged ${machines.length} machines.`);
      onClose();
    } catch (error) {
      toast.error('Failed to save bulk machine logs.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} fullScreenMobile={true}>
      <DialogContent className="w-full h-[100dvh] max-h-[100dvh] max-w-full sm:max-w-3xl sm:h-[90vh] sm:max-h-[90vh] p-0 border-0 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-950">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-500" />
            Bulk Log Machines
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">Logging {machines.length} machines for {date}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Machine Status & Diesel</h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {machines.map(m => {
                const data = machineData[m.id] || { isActive: true, dieselUsage: '' };
                return (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 bg-white dark:bg-slate-950 gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{m.name}</p>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <div className="flex p-1 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-md flex-1 sm:flex-none sm:w-40 shrink-0">
                        <button type="button" onClick={() => handleToggleActive(m.id, true)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded transition-all", data.isActive ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm border border-slate-200/50 dark:bg-slate-600" : "text-slate-500 hover:text-slate-700")}>
                          ACTIVE
                        </button>
                        <button type="button" onClick={() => handleToggleActive(m.id, false)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold rounded transition-all", !data.isActive ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm border border-slate-200/50 dark:bg-slate-600" : "text-slate-500 hover:text-slate-700")}>
                          INACTIVE
                        </button>
                      </div>
                      {data.isActive && (
                        <div className="w-24 shrink-0 ml-auto sm:ml-0">
                          <Input type="number" min="0" step="0.1" value={data.dieselUsage} onChange={e => handleDieselChange(m.id, e.target.value)} placeholder="Diesel (L)" className="h-8 text-xs font-semibold text-right" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Common Log Details</h4>
            
            {!areAllInactive && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Supervisor on Site</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select value={supervisorOnSite} onChange={(e) => setSupervisorOnSite(e.target.value)} className="w-full h-10 pl-9 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all appearance-none">
                    <option value="">Select Supervisor...</option>
                    {dewateringStaff.map(staff => <option key={staff.id} value={`${staff.firstname} ${staff.surname}`}>{staff.firstname} {staff.surname}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className={cn("grid gap-4", !areAllInactive ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Issues on Site / General Note</Label>
                <Textarea value={issuesOnSite} onChange={e => setIssuesOnSite(e.target.value)} placeholder={areAllInactive ? "Describe why machines are inactive (e.g. rain, holiday, site closed)..." : "Notes applied to all selected machines..."} className="min-h-[80px] text-sm" />
              </div>
              {!areAllInactive && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Maintenance Performed</Label>
                  <Textarea value={maintenanceDetails} onChange={e => setMaintenanceDetails(e.target.value)} placeholder="Repairs done today..." className="min-h-[80px] text-sm" />
                </div>
              )}
            </div>

            {!areAllInactive && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Client Feedback</Label>
                <Textarea value={clientFeedback} onChange={e => setClientFeedback(e.target.value)} placeholder="Client remarks..." className="min-h-[60px] text-sm" />
              </div>
            )}
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
            {isSubmitting ? 'Logging...' : 'Log All Machines'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
