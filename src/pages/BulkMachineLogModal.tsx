import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOperations } from '@/src/contexts/OperationsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Wrench, User, ChevronDown, CheckCircle2, Clock, AlertTriangle, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/src/store/appStore';
import { cn } from '@/src/lib/utils';
import { OperationalDay, DowntimeEntry, DowntimeCategory } from '@/src/types/operations';
import { POSITION_HIERARCHY } from '@/src/lib/hierarchy';

interface BulkMachineLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  machines: { id: string; name: string }[];
  date: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

export function BulkMachineLogModal({ isOpen, onClose, siteId, siteName, machines, date, defaultStartDate, defaultEndDate }: BulkMachineLogModalProps) {
  const { logDailyActivity, dailyMachineLogs, sitePumpDates, assets } = useOperations();
  const { employees, attendanceRecords } = useAppStore();

  const dewateringStaff = employees.filter(e => 
    (e.department === 'Dewatering' || e.department?.toLowerCase() === 'dewatering') && 
    e.staffType === 'FIELD'
  );

  const [startDate, setStartDate] = useState(defaultStartDate || date);
  const [endDate, setEndDate] = useState(defaultEndDate || date);
  const [machineData, setMachineData] = useState<Record<string, { 
    operationalDay: OperationalDay; 
    dieselUsage: string;
    dipstickLevel: string;
    isTankFilledToFull: boolean;
    downtimeEntries?: DowntimeEntry[];
  }>>({});
  const [supervisorOnSite, setSupervisorOnSite] = useState('');
  const [issuesOnSite, setIssuesOnSite] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Downtime modal state for individual machines during bulk logging
  const [activeDowntimeMachine, setActiveDowntimeMachine] = useState<{ id: string; name: string } | null>(null);
  const [dtReason, setDtReason] = useState('');
  const [dtStartTime, setDtStartTime] = useState('10:00');
  const [dtEndTime, setDtEndTime] = useState('12:00');
  const [dtIsStillDown, setDtIsStillDown] = useState(false);
  const [dtDuration, setDtDuration] = useState('2.0');
  const [dtSeverity, setDtSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [dtCategory, setDtCategory] = useState<DowntimeCategory>('mechanical');
  const [dtNotes, setDtNotes] = useState('');
  const [dtUseManualDuration, setDtUseManualDuration] = useState(false);

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
      setStartDate(defaultStartDate || date);
      setEndDate(defaultEndDate || date);
      const initData: Record<string, { 
        operationalDay: OperationalDay; 
        dieselUsage: string;
        dipstickLevel: string;
        isTankFilledToFull: boolean;
        downtimeEntries?: DowntimeEntry[];
      }> = {};
      machines.forEach(m => {
        initData[m.id] = { operationalDay: 'full', dieselUsage: '', dipstickLevel: '', isTankFilledToFull: false, downtimeEntries: [] };
      });
      setMachineData(initData);
      const autoSelected = findAutoSupervisorForDate(defaultStartDate || date);
      setSupervisorOnSite(autoSelected || '');
      setIssuesOnSite('');
      setMaintenanceDetails('');
      setClientFeedback('');
      setActiveDowntimeMachine(null);
    }
  }, [isOpen, machines, defaultStartDate, defaultEndDate]);

  const calculateDowntimeDuration = useCallback((start: string, end: string, isStillDown: boolean) => {
    if (isStillDown) {
      if (!start) return { hours: 0, formatted: '0h 0m' };
      const [sH, sM] = start.split(':').map(Number);
      const startMins = (sH || 0) * 60 + (sM || 0);
      const shiftEndMins = 24 * 60;
      const diff = Math.max(0, shiftEndMins - startMins);
      const hrs = diff / 60;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return { hours: Number(hrs.toFixed(2)), formatted: `${h}h ${m > 0 ? `${m}m` : ''} (until shift end)` };
    }

    if (!start || !end) return { hours: 0, formatted: '0h 0m' };
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const startMins = (sH || 0) * 60 + (sM || 0);
    let endMins = (eH || 0) * 60 + (eM || 0);

    if (endMins < startMins) {
      endMins += 24 * 60;
    }

    const diff = endMins - startMins;
    const hrs = diff / 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return { hours: Number(hrs.toFixed(2)), formatted: `${h}h ${m > 0 ? `${m}m` : ''} (${hrs.toFixed(1)} hrs)` };
  }, []);

  useEffect(() => {
    if (!dtUseManualDuration) {
      const calc = calculateDowntimeDuration(dtStartTime, dtEndTime, dtIsStillDown);
      setDtDuration(calc.hours > 0 ? String(calc.hours) : '1.0');
    }
  }, [dtStartTime, dtEndTime, dtIsStillDown, dtUseManualDuration, calculateDowntimeDuration]);

  const handleOpenDowntimeModal = (machine: { id: string; name: string }) => {
    setActiveDowntimeMachine(machine);
    setDtReason('');
    setDtNotes('');
    setDtStartTime('10:00');
    setDtEndTime('12:00');
    setDtIsStillDown(false);
    setDtSeverity('medium');
    setDtCategory('mechanical');
    setDtUseManualDuration(false);
    setDtDuration('2.0');
  };

  const handleAddDowntimeToMachine = () => {
    if (!activeDowntimeMachine) return;
    if (!dtReason.trim()) {
      toast.error('Please specify a reason for the downtime.');
      return;
    }
    const duration = Number(dtDuration);
    if (isNaN(duration) || duration <= 0) {
      toast.error('Duration must be greater than 0.');
      return;
    }

    const newEntry: DowntimeEntry = {
      id: crypto.randomUUID(),
      reason: dtReason.trim(),
      durationHours: Number(duration.toFixed(2)),
      severity: dtSeverity,
      category: dtCategory,
      startTime: dtStartTime || undefined,
      endTime: dtIsStillDown ? undefined : (dtEndTime || undefined),
      isStillDown: dtIsStillDown,
      notes: dtNotes.trim() || undefined,
      timestamp: new Date().toISOString()
    };

    const machineId = activeDowntimeMachine.id;
    const currentEntries = machineData[machineId]?.downtimeEntries || [];
    const nextEntries = [...currentEntries, newEntry];
    const totalLostHrs = nextEntries.reduce((sum, d) => sum + d.durationHours, 0);

    let suggestedDay = machineData[machineId]?.operationalDay;
    if (totalLostHrs >= 12 && suggestedDay !== 'none') {
      suggestedDay = 'none';
      toast.info(`Total downtime is ${totalLostHrs.toFixed(1)}h. Automatically updated ${activeDowntimeMachine.name} to OFF.`);
    } else if (totalLostHrs >= 4 && suggestedDay === 'full') {
      suggestedDay = 'half';
      toast.info(`Total downtime is ${totalLostHrs.toFixed(1)}h. Automatically updated ${activeDowntimeMachine.name} to HALF DAY.`);
    }

    setMachineData(p => ({
      ...p,
      [machineId]: {
        ...p[machineId],
        downtimeEntries: nextEntries,
        operationalDay: suggestedDay
      }
    }));

    // Reset inputs for next entry
    setDtReason('');
    setDtNotes('');
    setDtIsStillDown(false);
    toast.success(`Downtime incident added to ${activeDowntimeMachine.name} (${duration} hrs).`);
  };

  const handleRemoveDowntimeFromMachine = (machineId: string, entryId: string) => {
    setMachineData(p => {
      const cur = p[machineId];
      if (!cur) return p;
      return {
        ...p,
        [machineId]: {
          ...cur,
          downtimeEntries: (cur.downtimeEntries || []).filter(e => e.id !== entryId)
        }
      };
    });
    toast.success('Downtime incident removed.');
  };

  const handleSetOpDay = (id: string, day: OperationalDay) => {
    setMachineData(p => ({
      ...p,
      [id]: { ...p[id], operationalDay: day, dieselUsage: day === 'none' ? '' : p[id].dieselUsage }
    }));
  };

  const handleDieselChange = (id: string, val: string) => {
    setMachineData(p => ({ ...p, [id]: { ...p[id], dieselUsage: val } }));
  };

  const handleDipstickChange = (id: string, val: string) => {
    setMachineData(p => ({ ...p, [id]: { ...p[id], dipstickLevel: val } }));
  };

  const handleToggleFullTank = (id: string) => {
    const asset = (assets || []).find(a => a.id === id);
    setMachineData(p => {
      const cur = p[id];
      const nextFull = !cur?.isTankFilledToFull;
      const nextDipstick = nextFull && asset?.tankCapacityLitres ? String(asset.tankCapacityLitres) : (cur?.dipstickLevel || '');
      return {
        ...p,
        [id]: {
          ...cur,
          isTankFilledToFull: nextFull,
          dipstickLevel: nextDipstick,
        }
      };
    });
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

          const data = machineData[m.id] || { 
            operationalDay: 'full' as OperationalDay, 
            dieselUsage: '', 
            dipstickLevel: '', 
            isTankFilledToFull: false, 
            downtimeEntries: [] as DowntimeEntry[] 
          };
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
            dipstickLevelLitres: data.dipstickLevel && data.dipstickLevel.trim() !== '' ? Number(data.dipstickLevel) : null,
            isTankFilledToFull: !!data.isTankFilledToFull,
            issuesOnSite,
            clientFeedback: isActive ? clientFeedback : '',
            maintenanceDetails: isActive ? maintenanceDetails : '',
            supervisorOnSite: isActive ? supervisorOnSite : '',
            downtimeEntries: data.downtimeEntries || []
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
      <DialogContent className="w-full h-[100dvh] max-h-[100dvh] max-w-full sm:max-w-3xl sm:h-[88vh] sm:max-h-[88vh] p-0 border-0 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-950">
        <DialogHeader className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm shrink-0 z-10">
          <DialogTitle className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-500" />
            Bulk Log Machines
          </DialogTitle>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">Site:</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/40">
              {siteName}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2.5">
             <div className="flex items-center gap-2">
               <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">From:</Label>
               <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-36 bg-white dark:bg-slate-950" required />
             </div>
             <div className="flex items-center gap-2">
               <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">To:</Label>
               <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="h-8 text-xs w-36 bg-white dark:bg-slate-950" required />
             </div>
          </div>
          {existingLoggedDates.length > 0 && (
            <div className="mt-2.5 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 dark:text-amber-400">
                <span className="font-bold">Note:</span> Logs already exist for some machines on: 
                <span className="font-semibold ml-1">{existingLoggedDates.map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}</span>.
                Saving will update existing logs.
              </div>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Machines ({machines.length})</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => machines.forEach(m => handleSetOpDay(m.id, 'full'))} className="text-[10px] h-6 px-2 font-bold">
                  All Full
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => machines.forEach(m => handleSetOpDay(m.id, 'none'))} className="text-[10px] h-6 px-2 font-bold text-rose-500 hover:text-rose-600">
                  All Off
                </Button>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {machines.map(m => {
                const data = machineData[m.id] || { 
                  operationalDay: 'full' as OperationalDay, 
                  dieselUsage: '', 
                  dipstickLevel: '', 
                  isTankFilledToFull: false, 
                  downtimeEntries: [] as DowntimeEntry[] 
                };
                const isActive = data.operationalDay !== 'none';
                const asset = (assets || []).find(a => a.id === m.id);
                return (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 bg-white dark:bg-slate-950 gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{m.name}</p>
                      {asset?.tankCapacityLitres ? (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                          Rated Tank: {asset.tankCapacityLitres}L
                        </span>
                      ) : null}
                    </div>
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
                        <p className="text-[9px] text-slate-400 mt-1 font-medium text-center">working period</p>
                      </div>
                      {isActive && (
                        <>
                          <div className="w-20 shrink-0 flex flex-col">
                            <Input type="number" min="0" step="0.1" value={data.dieselUsage} onChange={e => handleDieselChange(m.id, e.target.value)} placeholder="0" className="h-8 text-xs font-semibold text-right" />
                            <p className="text-[9px] text-slate-400 mt-1 font-medium text-center italic">Refill (L)</p>
                          </div>
                          <div className="w-20 shrink-0 flex flex-col">
                            <Input type="number" min="0" step="0.1" value={data.dipstickLevel} onChange={e => handleDipstickChange(m.id, e.target.value)} placeholder="0" className="h-8 text-xs font-semibold text-right text-cyan-600 dark:text-cyan-400 font-mono" />
                            <p className="text-[9px] text-slate-400 mt-1 font-medium text-center italic">Dipstick (L)</p>
                          </div>
                          <div className="shrink-0 flex flex-col justify-start">
                            <button
                              type="button"
                              onClick={() => handleToggleFullTank(m.id)}
                              className={cn(
                                "h-8 px-2 rounded border text-[10px] font-bold transition-all flex items-center gap-1",
                                data.isTankFilledToFull 
                                  ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" 
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                              )}
                            >
                              {data.isTankFilledToFull ? '✓ 100%' : 'Full?'}
                            </button>
                            <p className="text-[9px] text-transparent mt-1 select-none">.</p>
                          </div>
                        </>
                      )}

                      <div className="shrink-0 flex flex-col justify-start">
                        <button
                          type="button"
                          onClick={() => handleOpenDowntimeModal(m)}
                          className={cn(
                            "h-8 px-2.5 rounded border text-[10px] font-bold transition-all flex items-center gap-1.5",
                            data.downtimeEntries && data.downtimeEntries.length > 0
                              ? "bg-amber-500 text-white border-amber-600 shadow-sm hover:bg-amber-600"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                          )}
                          title="Record stops, breakdowns, or client standby for this machine"
                        >
                          <Clock className="h-3 w-3" />
                          <span>Downtime</span>
                          {data.downtimeEntries && data.downtimeEntries.length > 0 && (
                            <span className="px-1.5 py-0.2 bg-black/25 text-white rounded-full text-[9px] font-black">
                              {data.downtimeEntries.length}
                            </span>
                          )}
                        </button>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium text-center">
                          {data.downtimeEntries && data.downtimeEntries.length > 0
                            ? `${data.downtimeEntries.reduce((s, e) => s + e.durationHours, 0).toFixed(1)}h lost`
                            : 'stops/faults'}
                        </p>
                      </div>
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

        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Logging <strong className="text-slate-700 dark:text-slate-200">{machines.length}</strong> machine(s) across selected date range.
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="h-9 font-medium">Cancel</Button>
            <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm min-w-[140px]">
              {isSubmitting ? 'Logging...' : `Log ${machines.length} Machines`}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Machine-specific Downtime Dialog */}
      {activeDowntimeMachine && (
        <Dialog open={!!activeDowntimeMachine} onOpenChange={(open) => !open && setActiveDowntimeMachine(null)}>
          <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col p-0 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
            <DialogHeader className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Machine Downtime: {activeDowntimeMachine.name}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Record operational stops, mechanical breakdowns, or client delays for this unit.
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Existing Recorded Incidents */}
              {(() => {
                const entries = machineData[activeDowntimeMachine.id]?.downtimeEntries || [];
                const totalLost = entries.reduce((s, e) => s + e.durationHours, 0);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Recorded Incidents ({entries.length})
                      </Label>
                      {entries.length > 0 && (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          Total: {totalLost.toFixed(1)} hrs lost
                        </span>
                      )}
                    </div>

                    {entries.length === 0 ? (
                      <div className="text-center p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                        No downtime incidents added yet for this machine today.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {entries.map((entry) => {
                          const catBadge = {
                            mechanical: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', label: 'Mechanical DCEL' },
                            client_standby: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', label: 'Client Standby' },
                            weather: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800', label: 'Weather / Rain' },
                            routine_service: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', label: 'Routine Service' },
                            other: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', label: 'Other' },
                          }[entry.category || 'mechanical'];

                          return (
                            <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
                              <div className="space-y-1 flex-1 min-w-0 mr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border", catBadge.bg, catBadge.text, catBadge.border)}>
                                    {catBadge.label}
                                  </span>
                                  {entry.startTime && (
                                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                      {entry.startTime} → {entry.isStillDown ? 'Still Down' : (entry.endTime || 'End')}
                                    </span>
                                  )}
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {entry.durationHours} hrs
                                  </span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 font-medium truncate">
                                  {entry.reason}
                                </p>
                                {entry.notes && (
                                  <p className="text-[11px] text-slate-500 italic truncate">
                                    Note: {entry.notes}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveDowntimeFromMachine(activeDowntimeMachine.id, entry.id)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Add New Downtime Form */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Add Downtime Incident
                  </Label>
                </div>

                {/* Stop & Restart Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Machine Stopped At (24h)
                    </Label>
                    <Input
                      type="time"
                      value={dtStartTime}
                      onChange={e => setDtStartTime(e.target.value)}
                      className="h-9 bg-white dark:bg-slate-950 font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Machine Restarted At (24h)
                    </Label>
                    <Input
                      type="time"
                      value={dtEndTime}
                      disabled={dtIsStillDown}
                      onChange={e => setDtEndTime(e.target.value)}
                      className={cn("h-9 bg-white dark:bg-slate-950 font-mono text-sm", dtIsStillDown && "opacity-40 cursor-not-allowed")}
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dtIsStillDown}
                        onChange={e => setDtIsStillDown(e.target.checked)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Machine did not restart (ongoing breakdown / still down)
                      </span>
                    </label>
                  </div>

                  {/* Calculated Duration summary */}
                  <div className="sm:col-span-2 flex items-center justify-between bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-xs">
                      <span className="text-slate-500">Calculated Duration: </span>
                      <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                        {calculateDowntimeDuration(dtStartTime, dtEndTime, dtIsStillDown).formatted}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDtUseManualDuration(!dtUseManualDuration)}
                        className="text-[10px] text-cyan-600 dark:text-cyan-400 underline font-medium"
                      >
                        {dtUseManualDuration ? 'Auto calc' : 'Override hours'}
                      </button>
                      {dtUseManualDuration && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={dtDuration}
                            onChange={e => setDtDuration(e.target.value)}
                            className="h-7 w-16 text-xs text-right font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-400 font-medium">hrs</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Category & Severity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Fault Responsibility / Category
                    </Label>
                    <select
                      value={dtCategory}
                      onChange={e => setDtCategory(e.target.value as DowntimeCategory)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="mechanical">Mechanical DCEL Breakdown</option>
                      <option value="client_standby">Client Standby / Waiting</option>
                      <option value="weather">Inclement Weather / Heavy Rain</option>
                      <option value="routine_service">Routine Scheduled Service</option>
                      <option value="other">Other Site Issue</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Impact / Severity
                    </Label>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-md gap-1">
                      {(['low', 'medium', 'high'] as const).map(sev => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setDtSeverity(sev)}
                          className={cn(
                            "flex-1 py-1 text-[11px] font-bold rounded capitalize transition-all",
                            dtSeverity === sev
                              ? sev === 'high'
                                ? "bg-rose-500 text-white shadow-sm"
                                : sev === 'medium'
                                ? "bg-amber-500 text-white shadow-sm"
                                : "bg-emerald-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Reason suggestions */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Reason / Fault Description
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {[
                      "Pump impeller clogged",
                      "Discharge hose burst / leak",
                      "Client standby / site stoppage",
                      "Engine overheating / oil low",
                      "Routine oil & filter service",
                      "Heavy rainfall / flooded access"
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setDtReason(chip)}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={dtReason}
                    onChange={e => setDtReason(e.target.value)}
                    placeholder="e.g. Broken drive belt, awaiting client fuel delivery..."
                    className="h-9 text-xs"
                    required
                  />
                </div>

                {/* Action Taken / Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Corrective Action / Mechanic Notes (Optional)
                  </Label>
                  <Input
                    value={dtNotes}
                    onChange={e => setDtNotes(e.target.value)}
                    placeholder="e.g. Mechanic replaced hose clamp, primed pump..."
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleAddDowntimeToMachine}
                  className="w-full h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Record Incident For {activeDowntimeMachine.name}
                </Button>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveDowntimeMachine(null)}
                className="h-8 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
