import { useState, useEffect, useMemo } from 'react';
import { useOperations } from '@/src/contexts/OperationsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Wrench, User, ChevronDown, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/src/store/appStore';
import { cn } from '@/src/lib/utils';
import { OperationalDay } from '@/src/types/operations';
import { POSITION_HIERARCHY } from '@/src/lib/hierarchy';

interface BulkMachineLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  machines: { id: string; name: string }[];
  date: string;
}

export function BulkMachineLogModal({ isOpen, onClose, siteId, siteName, machines, date }: BulkMachineLogModalProps) {
  const { logDailyActivity, dailyMachineLogs, sitePumpDates } = useOperations();
  const { employees, attendanceRecords } = useAppStore();

  const dewateringStaff = employees.filter(e => 
    (e.department === 'Dewatering' || e.department?.toLowerCase() === 'dewatering') && 
    e.staffType === 'FIELD'
  );

  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(date);
  const [machineData, setMachineData] = useState<Record<string, { operationalDay: OperationalDay; dieselUsage: string }>>({});
  const [supervisorOnSite, setSupervisorOnSite] = useState('');
  const [issuesOnSite, setIssuesOnSite] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reusable callback to find the auto supervisor for a specific date
  const findAutoSupervisorForDate = (targetDate: string) => {
    if (!targetDate || !siteName) return '';

    // Get attendance records for this date and site
    const siteRecords = attendanceRecords.filter(r => 
      r.date === targetDate && 
      ((r.day === 'Yes' && r.daySite === siteName) || 
       (r.night === 'Yes' && r.nightSite === siteName))
    );

    if (siteRecords.length === 0) return '';

    // Map to employees and filter to only include dewateringStaff
    const dewateringStaffIds = new Set(dewateringStaff.map(s => s.id));
    const dewateringStaffNames = new Set(dewateringStaff.map(s => `${s.firstname} ${s.surname}`.toUpperCase()));

    const matchedStaff = siteRecords
      .map(r => {
        const emp = employees.find(e => 
          e.id === r.staffId || 
          `${e.firstname} ${e.surname}`.toUpperCase() === r.staffName.toUpperCase()
        );
        return { record: r, employee: emp };
      })
      .filter(x => 
        x.employee && 
        (dewateringStaffIds.has(x.employee.id) || 
         dewateringStaffNames.has(`${x.employee.firstname} ${x.employee.surname}`.toUpperCase()))
      );

    if (matchedStaff.length === 0) return '';

    // Helper to get shift priority (lower number = higher priority)
    // Night shift takes priority
    const getShiftPriority = (r: typeof attendanceRecords[0]) => {
      if (r.night === 'Yes' && r.nightSite === siteName) return 1;
      if (r.day === 'Yes' && r.daySite === siteName) return 2;
      return 3;
    };

    // Helper to normalize position index
    const getNormalizedPositionIndex = (pos?: string) => {
      if (!pos) return 999;
      let normalized = pos;
      if (normalized === 'Assistant Site Supervisor') {
        normalized = 'Assistant Supervisor';
      }
      const idx = POSITION_HIERARCHY.indexOf(normalized);
      return idx === -1 ? 999 : idx;
    };

    // Sort staff
    const sorted = [...matchedStaff].sort((a, b) => {
      // 1. Shift Priority
      const shiftA = getShiftPriority(a.record);
      const shiftB = getShiftPriority(b.record);
      if (shiftA !== shiftB) return shiftA - shiftB;

      // 2. Position Hierarchy
      const posA = getNormalizedPositionIndex(a.employee?.position || a.record.position);
      const posB = getNormalizedPositionIndex(b.employee?.position || b.record.position);
      if (posA !== posB) return posA - posB;

      // 3. Start Date Seniority
      const dateA = a.employee?.startDate ? new Date(a.employee.startDate).getTime() : Infinity;
      const dateB = b.employee?.startDate ? new Date(b.employee.startDate).getTime() : Infinity;
      return dateA - dateB;
    });

    const bestMatch = sorted[0];
    if (bestMatch && bestMatch.employee) {
      return `${bestMatch.employee.firstname} ${bestMatch.employee.surname}`;
    }
    return '';
  };

  // Auto-sync supervisor when startDate or attendanceRecords changes
  useEffect(() => {
    if (isOpen && startDate) {
      const autoSelected = findAutoSupervisorForDate(startDate);
      if (autoSelected) {
        setSupervisorOnSite(autoSelected);
      }
    }
  }, [startDate, isOpen, attendanceRecords]);

  const handleSyncSupervisor = () => {
    const autoSelected = findAutoSupervisorForDate(startDate);
    if (autoSelected) {
      setSupervisorOnSite(autoSelected);
      toast.success(`Supervisor synced from attendance: ${autoSelected}`);
    } else {
      const displayDate = new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      toast.info(`No attendance record found for ${displayDate} at "${siteName}".`);
    }
  };

  const areAllNoDay = machines.length > 0 && machines.every(m => machineData[m.id]?.operationalDay === 'none');

  // Check for existing logs in the current range
  const existingLoggedDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    const datesWithLogs = new Set<string>();
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    const datesToCheck: string[] = [];
    if (currentDate <= lastDate) {
      while (currentDate <= lastDate) {
        datesToCheck.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const machineIds = machines.map(m => m.id);

    dailyMachineLogs.forEach(log => {
      if (
        machineIds.includes(log.assetId) &&
        log.siteId === siteId &&
        datesToCheck.includes(log.date)
      ) {
        datesWithLogs.add(log.date);
      }
    });

    return Array.from(datesWithLogs).sort();
  }, [startDate, endDate, machines, dailyMachineLogs, siteId]);

  useEffect(() => {
    if (isOpen) {
      setStartDate(date);
      setEndDate(date);
      const initData: Record<string, { operationalDay: OperationalDay; dieselUsage: string }> = {};
      machines.forEach(m => {
        initData[m.id] = { operationalDay: 'full', dieselUsage: '' };
      });
      setMachineData(initData);
      const autoSelected = findAutoSupervisorForDate(date);
      setSupervisorOnSite(autoSelected || '');
      setIssuesOnSite('');
      setMaintenanceDetails('');
      setClientFeedback('');
    }
  }, [isOpen, machines]);

  const handleSetOpDay = (id: string, day: OperationalDay) => {
    setMachineData(p => ({
      ...p,
      [id]: { ...p[id], operationalDay: day, dieselUsage: day === 'none' ? '' : p[id].dieselUsage }
    }));
  };

  const handleDieselChange = (id: string, val: string) => {
    setMachineData(p => ({ ...p, [id]: { ...p[id], dieselUsage: val } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const datesToLog: string[] = [];
      let currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      
      // Prevent infinite loops if end date is before start date
      if (currentDate > lastDate) {
        toast.error('End date must be after or equal to start date.');
        setIsSubmitting(false);
        return;
      }

      while (currentDate <= lastDate) {
        datesToLog.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const promises = datesToLog.flatMap(logDate => {
        return machines.flatMap(m => {
          // Skip if date is outside the configured pump date range
          const pd = sitePumpDates?.find(p => p.assetId === m.id && p.siteId === siteId);
          if (pd && pd.pumpStartDate) {
            if (logDate < pd.pumpStartDate) return [];
            if (pd.pumpStopDate && logDate > pd.pumpStopDate) return [];
          }

          const data = machineData[m.id] || { operationalDay: 'full' as OperationalDay, dieselUsage: '' };
          const isActive = data.operationalDay !== 'none';
          return [logDailyActivity({
            assetId: m.id,
            assetName: m.name,
            siteId,
            siteName,
            date: logDate,
            isActive,
            operationalDay: data.operationalDay,
            dieselUsage: parseFloat(data.dieselUsage) || 0,
            issuesOnSite,
            clientFeedback: isActive ? clientFeedback : '',
            maintenanceDetails: isActive ? maintenanceDetails : '',
            supervisorOnSite: isActive ? supervisorOnSite : '',
            downtimeEntries: []
          })];
        });
      });

      await Promise.all(promises);
      toast.success(`Successfully logged ${machines.length} machines for ${datesToLog.length} day(s).`);
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-3">
             <div className="flex items-center gap-2">
               <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">From Date:</Label>
               <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-36 bg-white dark:bg-slate-950" required />
             </div>
             <div className="flex items-center gap-2">
               <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">To Date:</Label>
               <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="h-8 text-xs w-36 bg-white dark:bg-slate-950" required />
             </div>
          </div>
          {existingLoggedDates.length > 0 && (
            <div className="mt-3 p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-400">
                <span className="font-bold">Note:</span> Logs already exist for some machines on: 
                <span className="font-semibold ml-1">{existingLoggedDates.map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}</span>.
                Saving will duplicate or overwrite.
              </div>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Machine Status & Diesel</h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {machines.map(m => {
                const data = machineData[m.id] || { operationalDay: 'full' as OperationalDay, dieselUsage: '' };
                const isActive = data.operationalDay !== 'none';
                return (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 bg-white dark:bg-slate-950 gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{m.name}</p>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <div className="flex flex-col">
                        <div className="flex p-1 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-md flex-1 sm:flex-none gap-0.5">
                          <button type="button" onClick={() => handleSetOpDay(m.id, 'full')}
                            className={cn("flex-1 flex items-center justify-center gap-1 py-1 px-3 text-[10px] font-bold rounded transition-all",
                              data.operationalDay === 'full' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50")}>
                            <CheckCircle2 className="h-3 w-3" /> FULL DAY
                          </button>
                          <button type="button" onClick={() => handleSetOpDay(m.id, 'half')}
                            className={cn("flex-1 flex items-center justify-center gap-1 py-1 px-3 text-[10px] font-bold rounded transition-all",
                              data.operationalDay === 'half' ? "bg-amber-400 text-white shadow-sm" : "text-slate-500 hover:text-amber-600 hover:bg-amber-50")}>
                            <Clock className="h-3 w-3" /> HALF DAY
                          </button>
                          <button type="button" onClick={() => handleSetOpDay(m.id, 'none')}
                            className={cn("flex-1 flex items-center justify-center gap-1 py-1 px-3 text-[10px] font-bold rounded transition-all",
                              data.operationalDay === 'none' ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-rose-600 hover:bg-rose-50")}>
                            <AlertTriangle className="h-3 w-3" /> OFF
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium text-center">machine worked period</p>
                      </div>
                      {isActive && (
                        <div className="w-24 shrink-0 ml-auto sm:ml-0 flex flex-col">
                          <Input type="number" min="0" step="0.1" value={data.dieselUsage} onChange={e => handleDieselChange(m.id, e.target.value)} placeholder="Diesel (L)" className="h-8 text-xs font-semibold text-right" />
                          <p className="text-[9px] text-slate-400 mt-1 font-medium text-center italic">diesel filled</p>
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
            
            {!areAllNoDay && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Supervisor on Site</Label>
                  <button
                    type="button"
                    onClick={handleSyncSupervisor}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"
                  >
                    <Clock className="h-3 w-3 animate-pulse" /> Sync with Attendance
                  </button>
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select value={supervisorOnSite} onChange={(e) => setSupervisorOnSite(e.target.value)} className="w-full h-10 pl-9 pr-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all appearance-none">
                    <option value="">Select Supervisor...</option>
                    {dewateringStaff.map(staff => <option key={staff.id} value={`${staff.firstname} ${staff.surname}`}>{staff.firstname} {staff.surname}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className={cn("grid gap-4", !areAllNoDay ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Issues on Site / General Note</Label>
                <Textarea value={issuesOnSite} onChange={e => setIssuesOnSite(e.target.value)} placeholder={areAllNoDay ? "Describe why machines are off today (e.g. rain, holiday, site closed)..." : "Notes applied to all selected machines..."} className="min-h-[80px] text-sm" />
              </div>
              {!areAllNoDay && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Maintenance Performed</Label>
                  <Textarea value={maintenanceDetails} onChange={e => setMaintenanceDetails(e.target.value)} placeholder="Repairs done today..." className="min-h-[80px] text-sm" />
                </div>
              )}
            </div>

            {!areAllNoDay && (
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
