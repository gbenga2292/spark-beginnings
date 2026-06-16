import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Calendar, Clock, AlertTriangle, 
  CheckCircle2, Fuel, User, MessageSquare, 
  BarChart3, History, Plus, Save, Trash2, Edit2, Wrench, Activity,
  ChevronLeft, ChevronRight, ChevronDown, Eye, Lock,
  Image as ImageIcon, Video, X, UploadCloud, FileVideo, Camera
} from 'lucide-react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore, AttendanceRecord } from '../store/appStore';
import { useUserStore } from '../store/userStore';
import { DailyMachineLog, DowntimeEntry, OperationalDay } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

import { Textarea } from '@/src/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/src/components/ui/dialog';
import { toast } from 'sonner';
import { CustomCamera } from '../components/ui/CustomCamera';
import { POSITION_HIERARCHY } from '@/src/lib/hierarchy';

interface DailyLogManagerProps {
  assetId: string;
  assetName: string;
  siteId: string;
  siteName: string;
  initialDate?: string;
  isEmbedded?: boolean;
  onBack: () => void;
}

export function DailyLogManager({ assetId, assetName, siteId, siteName, initialDate, isEmbedded, onBack }: DailyLogManagerProps) {
  const { dailyMachineLogs, logDailyActivity, deleteDailyLog, waybills, sitePumpDates } = useOperations();
  const { employees, attendanceRecords } = useAppStore();
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId));
  
  const [view, setView] = useState<'history' | 'form' | 'analytics' | 'calendar' | 'detail'>(initialDate ? 'form' : 'history');
  const [viewingLog, setViewingLog] = useState<DailyMachineLog | null>(null);
  const [analyticsYear, setAnalyticsYear] = useState<string>(new Date().getFullYear().toString());
  const [analyticsMonth, setAnalyticsMonth] = useState<string>('all');
  
  const [selectedLog, setSelectedLog] = useState<DailyMachineLog | null>(() => {
    if (!initialDate) return null;
    return dailyMachineLogs.find(l => l.assetId === assetId && l.siteId === siteId && l.date === initialDate) || null;
  });
  
  // Dewatering field staff for supervisor dropdown
  const dewateringStaff = employees.filter(e => 
    (e.department === 'Dewatering' || e.department?.toLowerCase() === 'dewatering') && 
    e.staffType === 'FIELD'
  );
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Form State
  const [date, setDate] = useState(() => selectedLog?.date || initialDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');

  // Derive initial operationalDay from existing log, defaulting to 'full'
  const deriveOpDay = (log: DailyMachineLog | null): OperationalDay => {
    if (!log) return 'full';
    if (log.operationalDay) return log.operationalDay;
    return log.isActive ? 'full' : 'none';
  };
  const [operationalDay, setOperationalDay] = useState<OperationalDay>(() => deriveOpDay(selectedLog));
  // isActive is derived from operationalDay
  const isActive = operationalDay !== 'none';
  const [dieselUsage, setDieselUsage] = useState<string>(selectedLog ? selectedLog.dieselUsage.toString() : '0');
  const [supervisorOnSite, setSupervisorOnSite] = useState(selectedLog?.supervisorOnSite || '');

  // Reusable callback to find the auto supervisor for a specific date
  const findAutoSupervisorForDate = React.useCallback((targetDate: string) => {
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
    const getShiftPriority = (r: AttendanceRecord) => {
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
  }, [siteName, attendanceRecords, employees, dewateringStaff]);

  // Auto-select supervisor based on attendance when date/site changes
  React.useEffect(() => {
    // Only auto-select when creating a new log or if the supervisor is currently empty
    if (selectedLog && date === selectedLog.date) return;

    const autoSelected = findAutoSupervisorForDate(date);
    if (autoSelected) {
      setSupervisorOnSite(autoSelected);
    }
  }, [date, selectedLog, findAutoSupervisorForDate]);

  const handleSyncSupervisor = () => {
    const autoSelected = findAutoSupervisorForDate(date);
    if (autoSelected) {
      setSupervisorOnSite(autoSelected);
      toast.success(`Supervisor synced from attendance: ${autoSelected}`);
    } else {
      toast.info(`No attendance record found for ${formatDisplayDate(date)} at "${siteName}".`);
    }
  };


  const [clientFeedback, setClientFeedback] = useState(selectedLog?.clientFeedback || '');
  const [maintenanceDetails, setMaintenanceDetails] = useState(selectedLog?.maintenanceDetails || '');
  const [issuesOnSite, setIssuesOnSite] = useState(selectedLog?.issuesOnSite || '');
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>(selectedLog?.downtimeEntries || []);
  const [showDowntimeDialog, setShowDowntimeDialog] = useState(false);
  
  // Downtime Form State
  const [dtReason, setDtReason] = useState('');
  const [dtDuration, setDtDuration] = useState('1');
  const [dtSeverity, setDtSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  
  // Media State
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{ url: string; type: 'image' | 'video'; name: string }[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Constants - Replace with your actual deployment URL
  const MEDIA_SERVER_URL = 'https://media.dcel-suite.com'; 


  const logs = useMemo(() => {
    return dailyMachineLogs
      .filter(l => l.assetId === assetId && l.siteId === siteId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailyMachineLogs, assetId, siteId]);

  // Background Auto-sync for historical logs with missing supervisor when attendance becomes available
  React.useEffect(() => {
    if (!logs.length || !attendanceRecords.length || !employees.length) return;

    // Find the first log that has no supervisor, but has a matching attendance record supervisor
    const logToSync = logs.find(log => {
      if (log.supervisorOnSite) return false; // Already has supervisor, don't overwrite

      const calculated = findAutoSupervisorForDate(log.date);
      return !!calculated;
    });

    if (logToSync) {
      const calculateAndSync = async () => {
        const supervisor = findAutoSupervisorForDate(logToSync.date);
        if (supervisor) {
          try {
            await logDailyActivity({
              ...logToSync,
              supervisorOnSite: supervisor
            });
            toast.success(`Auto-synced supervisor for ${formatDisplayDate(logToSync.date)} to match attendance: ${supervisor}`);
          } catch (e) {
            console.error('Failed auto-syncing supervisor:', e);
          }
        }
      };

      calculateAndSync();
    }
  }, [logs, attendanceRecords, employees, findAutoSupervisorForDate, logDailyActivity]);

  // Derive effective pump start/stop dates
  // Configured pump dates override the automatic fallback from earliest log
  const pumpDateConfig = useMemo(() => {
    const configured = sitePumpDates?.find(p => p.assetId === assetId && p.siteId === siteId);
    const earliestLogDate = logs.length > 0
      ? logs.reduce((acc, log) => log.date < acc ? log.date : acc, logs[0].date)
      : null;

    const effectiveStart = configured?.pumpStartDate || earliestLogDate || null;
    const effectiveStop = configured?.pumpStopDate || null;
    const isConfigured = !!configured?.pumpStartDate;

    return { effectiveStart, effectiveStop, isConfigured, configured };
  }, [sitePumpDates, assetId, siteId, logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const d = new Date(l.date);
      const yearMatch = d.getFullYear().toString() === analyticsYear;
      const monthMatch = analyticsMonth === 'all' || d.getMonth().toString() === analyticsMonth;
      return yearMatch && monthMatch;
    });
  }, [logs, analyticsYear, analyticsMonth]);

  const availableYears = useMemo(() => {
    const years = new Set(logs.map(l => new Date(l.date).getFullYear().toString()));
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [logs]);

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const dieselChartData = useMemo(() => {
    if (analyticsMonth === 'all') {
      // 12 monthly bars showing avg diesel/day on site for the selected year
      return MONTHS_SHORT.map((label, mIdx) => {
        const mLogs = filteredLogs.filter(l => new Date(l.date).getMonth() === mIdx);
        const avg = mLogs.length > 0
          ? mLogs.reduce((acc, l) => acc + (l.dieselUsage || 0), 0) / mLogs.length
          : 0;
        return { label, value: avg, isAvg: true };
      });
    }
    // Per-day within the selected month
    const map: Record<string, number> = {};
    filteredLogs.forEach(l => {
      const key = new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      map[key] = (map[key] || 0) + (l.dieselUsage || 0);
    });
    return Object.entries(map)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([label, value]) => ({ label, value, isAvg: false }));
  }, [filteredLogs, analyticsMonth]);

  const handleAddDowntime = () => {
    if (!dtReason) return;
    const newEntry: DowntimeEntry = {
      id: crypto.randomUUID(),
      reason: dtReason,
      durationHours: Number(dtDuration),
      severity: dtSeverity,
      timestamp: new Date().toISOString()
    };
    setDowntimeEntries([...downtimeEntries, newEntry]);
    setDtReason('');
    setDtDuration('1');
    setShowDowntimeDialog(false);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteDailyLog(logId);
      toast.success('Log deleted successfully');
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error('Failed to delete log');
    }
  };

  const fetchUploadedMedia = async (sId: string, aId: string, lDate: string) => {
    try {
      const response = await fetch(`${MEDIA_SERVER_URL}/list.php?site_id=${sId}&asset_id=${aId}&log_date=${lDate}`);
      if (response.ok) {
        const data = await response.json();
        setUploadedMedia(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch media:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setMediaFiles(prev => [...prev, ...files]);
    
    const newPreviews = files.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
      name: file.name
    }));
    setMediaPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleCapture = (file: File) => {
    setMediaFiles(prev => [...prev, file]);
    setMediaPreviews(prev => [...prev, {
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
      name: file.name
    }]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };


  const handleSaveLog = async () => {
    try {
      // Build list of dates to log
      const start = new Date(date);
      const end = endDate && endDate >= date ? new Date(endDate) : new Date(date);
      const datesToLog: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToLog.push(d.toISOString().split('T')[0]);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const futureDates = datesToLog.filter(d => d > todayStr);
      if (futureDates.length > 0) {
        toast.error('Cannot log activity for future dates.');
        return;
      }

      // Validate against configured pump date range
      if (pumpDateConfig.effectiveStart) {
        const beforeRange = datesToLog.filter(d => d < pumpDateConfig.effectiveStart!);
        if (beforeRange.length > 0) {
          toast.error(`Cannot log before pump start date (${new Date(pumpDateConfig.effectiveStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}).`);
          return;
        }
      }
      if (pumpDateConfig.effectiveStop) {
        const afterRange = datesToLog.filter(d => d > pumpDateConfig.effectiveStop!);
        if (afterRange.length > 0) {
          toast.error(`Cannot log after pump stop date (${new Date(pumpDateConfig.effectiveStop).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}).`);
          return;
        }
      }

      // Filter out dates that already have a log (when not editing)
      const existingDates = new Set(logs.map(l => l.date));
      const newDates = selectedLog ? datesToLog : datesToLog.filter(d => !existingDates.has(d));
      const skipped = datesToLog.length - newDates.length;

      if (newDates.length === 0) {
        toast.error('All dates in this range already have logs. Please change the date range.');
        return;
      }

      for (const logDate of newDates) {
        await logDailyActivity({
          assetId,
          assetName,
          siteId,
          siteName,
          date: logDate,
          isActive,
          operationalDay,
          dieselUsage: Number(dieselUsage),
          supervisorOnSite,
          clientFeedback,
          maintenanceDetails,
          issuesOnSite,
          downtimeEntries,
          loggedBy: currentUser?.name || 'Unknown'
        });
      }

      // Handle Media Upload if any (attach to start date only)
      if (mediaFiles.length > 0) {
        setIsUploading(true);
        try {
          const uploadPromises = mediaFiles.map(async (file) => {
            const formData = new FormData();
            formData.append('media', file);
            formData.append('site_id', siteId);
            formData.append('site_name', siteName);
            formData.append('asset_id', assetId);
            formData.append('asset_name', assetName);
            formData.append('log_date', date);
            formData.append('uploaded_by', currentUser?.id || 'unknown');
            formData.append('uploaded_by_name', currentUser?.name || 'Unknown');
            const response = await fetch(`${MEDIA_SERVER_URL}/upload.php`, {
              method: 'POST',
              body: formData,
            });
            if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
            return response.json();
          });
          await Promise.all(uploadPromises);
          toast.success(`${mediaFiles.length} media files uploaded to MySQL storage`);
          setMediaFiles([]);
          setMediaPreviews([]);
          fetchUploadedMedia(siteId, assetId, date);
        } catch (uploadErr) {
          console.error('Media upload error:', uploadErr);
          toast.error('Log saved, but media upload failed. Please check connection.');
        } finally {
          setIsUploading(false);
        }
      }

      if (skipped > 0) {
        toast.success(`${newDates.length} log${newDates.length !== 1 ? 's' : ''} saved. ${skipped} date${skipped !== 1 ? 's' : ''} skipped (already logged).`);
      } else {
        toast.success(`${newDates.length} log${newDates.length !== 1 ? 's' : ''} saved successfully`);
      }
      if (isEmbedded) {
        onBack();
      } else {
        setView('history');
        resetForm();
      }
    } catch (err) {
      // Error handled in context
    }
  };

  const resetForm = () => {
    setDate(initialDate || new Date().toISOString().split('T')[0]);
    setEndDate('');
    setOperationalDay('full');
    setDieselUsage('0');
    setSupervisorOnSite('');
    setClientFeedback('');
    setMaintenanceDetails('');
    setIssuesOnSite('');
    setDowntimeEntries([]);
    setSelectedLog(null);
  };

  const editLog = (log: DailyMachineLog) => {
    setSelectedLog(log);
    setDate(log.date);
    setEndDate('');
    setOperationalDay(deriveOpDay(log));
    setDieselUsage(log.dieselUsage.toString());
    setSupervisorOnSite(log.supervisorOnSite || '');
    setClientFeedback(log.clientFeedback || '');
    setMaintenanceDetails(log.maintenanceDetails || '');
    setIssuesOnSite(log.issuesOnSite || '');
    setDowntimeEntries(log.downtimeEntries || []);
    fetchUploadedMedia(log.siteId, log.assetId, log.date);
    setView('form');
  };


  const openDetailView = (log: DailyMachineLog) => {
    setViewingLog(log);
    setView('detail');
  };

  // inside component, right before return:
  useSetPageTitle(
    assetName,
    `Site: ${siteName}`,
    <div className="flex items-center gap-1.5 sm:gap-3">
      {!isEmbedded && (
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
          <button 
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all", 
              view === 'history' 
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            )}
            onClick={() => setView('history')}
          >
            History
          </button>
          <button 
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all", 
              view === 'analytics' 
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            )}
            onClick={() => setView('analytics')}
          >
            Analytics
          </button>
          <button 
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all", 
              view === 'calendar' 
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            )}
            onClick={() => setView('calendar')}
          >
            Calendar
          </button>
        </div>
      )}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back</span>
      </Button>
      {!isEmbedded && view !== 'form' && view !== 'detail' && (
        <Button 
          size="sm"
          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 rounded-lg shadow-sm font-bold text-xs"
          onClick={() => {
            resetForm();
            setView('form');
          }}
        >
          <Plus className="h-3.5 w-3.5" /> <span>File Log</span>
        </Button>
      )}
    </div>,
    [view, assetName, siteName, isEmbedded]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {view === 'history' && (
          <div className="max-w-4xl mx-auto space-y-4 pb-12">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-300 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6">
                  <History className="h-10 w-10 text-slate-200" />
                </div>
                <p className="text-base font-semibold text-slate-500 dark:text-slate-400">No logs found for this machine</p>
                <p className="text-sm text-slate-300 mt-2 max-w-xs text-center">Start logging daily operations to track performance and maintenance trends on this site.</p>
                <Button 
                  variant="outline" 
                  className="mt-8 gap-2 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => setView('form')}
                >
                  Create First Log
                </Button>
              </div>
            ) : (
              logs.map(log => (
                <Card key={log.id} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all rounded-lg group overflow-hidden">
                  <div className="flex justify-between items-start p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-800 dark:text-white">{formatDisplayDate(log.date)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            {(() => {
                              const day = log.operationalDay ?? (log.isActive ? 'full' : 'none');
                              return (
                                <Badge className={cn(
                                  "text-[10px] font-bold px-2 py-0 rounded-full",
                                  day === 'full' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                  day === 'half' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                  "bg-rose-50 text-rose-700 border-rose-100"
                                )}>
                                  {day === 'full' ? 'FULL DAY' : day === 'half' ? 'HALF DAY' : 'OFF'}
                                </Badge>
                              );
                            })()}
                            {log.downtimeEntries.length > 0 && (
                              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0 rounded-full bg-amber-50 text-amber-700 border-amber-100">
                                {log.downtimeEntries.length} DOWNTIME INCIDENTS
                              </Badge>
                            )}
                          </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => editLog(log)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {currentUser?.privileges?.operations?.canDeleteLogs && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" 
                          onClick={() => setDeleteConfirmId(log.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supervisor</p>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" /> {log.supervisorOnSite || '—'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diesel Usage</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Fuel className="h-3.5 w-3.5 text-slate-400" /> {log.dieselUsage} L
                      </p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Feedback</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic line-clamp-1">
                        "{log.clientFeedback || 'No feedback provided'}"
                      </p>
                    </div>
                  </div>

                  {(log.issuesOnSite || log.maintenanceDetails) && (
                    <div className="px-4 pb-4">
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 space-y-2 border border-slate-100 dark:border-slate-800">
                        {log.issuesOnSite && (
                        <div className="flex gap-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-bold text-slate-700 dark:text-slate-200">Site Issues:</span> {log.issuesOnSite}
                          </p>
                        </div>
                      )}
                      {log.maintenanceDetails && (
                        <div className="flex gap-3">
                          <Wrench className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">Maintenance:</span> {log.maintenanceDetails}
                          </p>
                        </div>
                      )}
                    </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {view === 'form' && (
          <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden rounded-lg">
              <div className="p-6 space-y-6">
                {/* Pump Range Info Bar */}
                {pumpDateConfig.effectiveStart && (
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs",
                    pumpDateConfig.isConfigured
                      ? "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40"
                      : "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40"
                  )}>
                    <Calendar className={cn("h-3.5 w-3.5 shrink-0", pumpDateConfig.isConfigured ? "text-blue-500" : "text-amber-500")} />
                    <div className="flex-1 min-w-0">
                      <span className={cn("font-semibold", pumpDateConfig.isConfigured ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300")}>
                        {pumpDateConfig.isConfigured ? 'Configured Pump Range: ' : 'Auto-detected Range: '}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {new Date(pumpDateConfig.effectiveStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {pumpDateConfig.effectiveStop
                          ? ` — ${new Date(pumpDateConfig.effectiveStop).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ' — Ongoing'}
                      </span>
                    </div>
                    {!pumpDateConfig.isConfigured && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50 text-[9px] font-bold px-1.5 py-0 rounded shrink-0">
                        Fallback
                      </Badge>
                    )}
                  </div>
                )}

                {/* Date Range + Day Type + Diesel */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                      {selectedLog ? 'Log Date' : 'From Date'}
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        type="date" 
                        value={date}
                        min={pumpDateConfig.effectiveStart || undefined}
                        max={pumpDateConfig.effectiveStop
                          ? (pumpDateConfig.effectiveStop < new Date().toISOString().split('T')[0] ? pumpDateConfig.effectiveStop : new Date().toISOString().split('T')[0])
                          : new Date().toISOString().split('T')[0]}
                        onChange={e => { setDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(''); }}
                        className="pl-9 h-10 border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* End Date — hidden when editing */}
                  {!selectedLog && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">To Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                          type="date" 
                          value={endDate} 
                          min={date}
                          max={pumpDateConfig.effectiveStop
                            ? (pumpDateConfig.effectiveStop < new Date().toISOString().split('T')[0] ? pumpDateConfig.effectiveStop : new Date().toISOString().split('T')[0])
                            : new Date().toISOString().split('T')[0]}
                          onChange={e => setEndDate(e.target.value)}
                          className="pl-9 h-10 border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {endDate && endDate >= date && (() => {
                        const start = new Date(date);
                        const end = new Date(endDate);
                        const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                        const existingCount = logs.filter(l => l.date >= date && l.date <= endDate).length;
                        const newCount = total - existingCount;
                        return (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/20">{newCount} new</span>
                            {existingCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/20">{existingCount} will skip</span>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Day Type */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Day Type</label>
                    <div className="flex flex-col">
                      <div className="flex p-1 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-md gap-1">
                        <button
                          onClick={() => setOperationalDay('full')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded transition-all",
                            operationalDay === 'full'
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> FULL DAY
                        </button>
                        <button
                          onClick={() => setOperationalDay('half')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded transition-all",
                            operationalDay === 'half'
                              ? "bg-amber-400 text-white shadow-sm"
                              : "text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" /> HALF DAY
                        </button>
                        <button
                          onClick={() => setOperationalDay('none')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded transition-all",
                            operationalDay === 'none'
                              ? "bg-rose-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> OFF
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium text-center">machine worked period</p>
                    </div>
                  </div>

                  {/* Diesel */}
                  {isActive && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Diesel Usage (L)</label>
                      <div className="relative">
                        <Fuel className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                          type="number" 
                          value={dieselUsage} 
                          onChange={e => setDieselUsage(e.target.value)}
                          className="pl-9 h-10 border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-medium text-center italic">diesel filled</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Supervisor Field */}
                {isActive && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Supervisor on Site</label>
                      <button
                        type="button"
                        onClick={handleSyncSupervisor}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"
                      >
                        <Clock className="h-3 w-3 animate-pulse" /> Sync with Attendance
                      </button>
                    </div>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <select
                        value={supervisorOnSite}
                        onChange={(e) => setSupervisorOnSite(e.target.value)}
                        className="w-full h-10 pl-9 pr-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Select Supervisor</option>
                        {dewateringStaff.map(staff => (
                          <option key={staff.id} value={`${staff.firstname} ${staff.surname}`}>
                            {staff.firstname} {staff.surname}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )}

                <div className={cn("grid gap-6", isActive ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Issues on Site / General Note</label>
                    <Textarea 
                      value={issuesOnSite} 
                      onChange={e => setIssuesOnSite(e.target.value)}
                      className="min-h-[100px] border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 p-3"
                      placeholder="Describe any general notes, environmental, or site-specific issues..."
                    />
                  </div>
                  {isActive && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Maintenance Performed</label>
                      <Textarea 
                        value={maintenanceDetails} 
                        onChange={e => setMaintenanceDetails(e.target.value)}
                        className="min-h-[100px] border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 p-3"
                        placeholder="Any onsite repairs or maintenance done today?"
                      />
                    </div>
                  )}
                </div>

                {isActive && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Client Feedback</label>
                    <Textarea 
                      value={clientFeedback} 
                      onChange={e => setClientFeedback(e.target.value)}
                      className="min-h-[80px] border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 p-3"
                      placeholder="What did the client say about the machine performance?"
                    />
                  </div>
                )}

                {/* Media Upload Section */}
                <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-blue-500" />
                      <h3 className="font-semibold text-slate-800 dark:text-white">Photos & Videos</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 w-8 p-0 rounded-md border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/30 dark:hover:bg-blue-900/20"
                        onClick={() => setShowCamera(true)}
                        title="Take Photo/Video"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 h-8 text-xs font-medium rounded-md border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:hover:bg-blue-900/20"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Media
                      </Button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      multiple 
                      accept="image/*,video/*" 
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* Combined Media Display: Uploaded + Previews */}
                  {(mediaPreviews.length > 0 || uploadedMedia.length > 0) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {/* Already Uploaded Media */}
                      {uploadedMedia.map((media, idx) => (
                        <div key={`uploaded-${idx}`} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {media.file_type === 'image' ? (
                            <img src={media.url} alt="Uploaded" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                              <FileVideo className="h-8 w-8 text-white/50" />
                              <span className="text-[9px] text-white/40 mt-1 truncate px-2 w-full text-center">{media.file_name}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                             <a 
                               href={media.url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                             >
                               <Eye className="h-4 w-4" />
                             </a>
                             <span className="text-[8px] text-white/70 font-medium">Uploaded</span>
                          </div>
                          <div className="absolute top-2 right-2 bg-blue-600/80 backdrop-blur-md p-1 rounded-full text-white">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          </div>
                          {media.file_type === 'video' && (
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1">
                              <Video className="h-2.5 w-2.5" /> VIDEO
                            </div>
                          )}
                        </div>
                      ))}

                      {/* New Previews (To be uploaded) */}
                      {mediaPreviews.map((preview, idx) => (
                        <div key={`preview-${idx}`} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-blue-200 dark:border-blue-800/50">
                          {preview.type === 'image' ? (
                            <img src={preview.url} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                              <FileVideo className="h-8 w-8 text-white/50" />
                              <span className="text-[9px] text-white/40 mt-1 truncate px-2 w-full text-center">{preview.name}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMedia(idx);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="absolute bottom-2 left-2 right-2 bg-blue-600/90 py-1 rounded text-[8px] font-bold text-white text-center">
                            READY TO UPLOAD
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="py-10 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-500">Click or drag photos and videos here</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Supports JPG, PNG, MP4, MOV</p>
                    </div>
                  )}

                </div>
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 rounded-b-lg">
                {selectedLog && currentUser?.privileges?.operations?.canDeleteLogs && (
                  <Button 
                    variant="ghost" 
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 gap-2 w-full sm:w-auto sm:mr-auto font-bold text-xs"
                    onClick={() => setDeleteConfirmId(selectedLog.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete This Log
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="rounded-md border-slate-200 w-full sm:w-auto"
                  onClick={() => isEmbedded ? onBack() : setView('history')}
                >
                  Cancel
                </Button>
                <Button 
                  className="rounded-md bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full sm:w-auto"
                  onClick={handleSaveLog}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isUploading ? 'Uploading Media...' : (selectedLog ? 'Update Log' : 'Save Daily Log')}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {view === 'calendar' && (
          <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <Card className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">Operation Schedule</h3>
                  <p className="text-sm text-slate-500 mt-1">Timeline of machine presence and daily logging.</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-sm"
                    onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-slate-700 shadow-sm"
                    onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-8 px-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/20" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Arrived on Site</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Full Day</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/20" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Half Day</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-400 shadow-sm shadow-rose-400/20" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Off / Down</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest pb-4">
                    {day}
                  </div>
                ))}
                
                {(() => {
                  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
                  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
                  
                  const days = [];
                  for (let i = 0; i < firstDayOfMonth; i++) {
                    days.push(<div key={`empty-${i}`} className="h-24 rounded-3xl" />);
                  }
                  
                  for (let i = 1; i <= daysInMonth; i++) {
                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const hasLog = logs.find(l => l.date === dateStr);
                    const isArrivalDate = waybills.some(w => 
                      (w.siteId === siteId || w.siteName === siteName) && 
                      w.type === 'waybill' && 
                      w.items.some(it => it.assetId === assetId) &&
                      w.sentToSiteDate?.startsWith(dateStr)
                    );
                    const opDay = hasLog ? (hasLog.operationalDay ?? (hasLog.isActive ? 'full' : 'none')) : null;
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isFuture = dateStr > todayStr;
                    const isOutsidePumpRange = !!((pumpDateConfig.effectiveStart && dateStr < pumpDateConfig.effectiveStart) ||
                                                (pumpDateConfig.effectiveStop && dateStr > pumpDateConfig.effectiveStop));
                    const isDisabled = isFuture || isOutsidePumpRange;

                    days.push(
                      <div 
                        key={i} 
                        className={cn(
                          "h-24 rounded-3xl border p-3 flex flex-col justify-between transition-all group relative overflow-hidden",
                          isDisabled 
                            ? "bg-slate-100/10 border-slate-100/50 dark:bg-slate-900/10 dark:border-slate-800/30 opacity-40 pointer-events-none select-none"
                            : cn(
                                opDay === 'full' ? "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/20" :
                                opDay === 'half' ? "bg-amber-50/60 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20" :
                                opDay === 'none' ? "bg-rose-50/40 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20" :
                                isArrivalDate ? "bg-orange-50/50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/20" :
                                "bg-slate-50/30 border-slate-100 dark:bg-slate-800/20 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                              )
                        )}
                        onClick={() => {
                          if (isDisabled) return;
                          if (hasLog) {
                            editLog(hasLog);
                          } else {
                            resetForm();
                            setDate(dateStr);
                            setView('form');
                          }
                        }}
                      >
                        <span className={cn(
                          "text-sm font-bold",
                          isDisabled ? "text-slate-300 dark:text-slate-700" :
                          opDay === 'full' ? "text-emerald-700" :
                          opDay === 'half' ? "text-amber-600" :
                          opDay === 'none' ? "text-rose-500" :
                          isArrivalDate ? "text-orange-600" : "text-slate-400 dark:text-slate-600"
                        )}>
                          {i}
                        </span>

                        <div className="flex flex-col gap-0.5">
                          {opDay && (
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-wider leading-none",
                              opDay === 'full' ? "text-emerald-600" :
                              opDay === 'half' ? "text-amber-500" : "text-rose-400"
                            )}>
                              {opDay === 'full' ? 'Full Day' : opDay === 'half' ? 'Half Day' : 'Off'}
                            </span>
                          )}
                          <div className="flex gap-1">
                            {isArrivalDate && (
                              <div className="h-2 w-2 rounded-full bg-orange-500 shadow-sm animate-pulse" />
                            )}
                            {opDay === 'full' && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />}
                            {opDay === 'half' && <div className="h-2 w-2 rounded-full bg-amber-400 shadow-sm" />}
                            {opDay === 'none' && <div className="h-2 w-2 rounded-full bg-rose-400 shadow-sm" />}
                          </div>
                        </div>

                        {/* Hover Overlay */}
                        {!isDisabled && (
                          <div 
                            className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-[1.5px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer px-2 text-center"
                          >
                            <div className="space-y-0.5">
                              {hasLog ? (
                                <>
                                  <p className={cn(
                                    "text-[10px] font-black",
                                    opDay === 'full' ? "text-emerald-700" : opDay === 'half' ? "text-amber-600" : "text-rose-500"
                                  )}>
                                    {opDay === 'full' ? 'FULL DAY' : opDay === 'half' ? 'HALF DAY' : 'OFF'}
                                  </p>
                                  {hasLog.dieselUsage > 0 && (
                                    <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300">{hasLog.dieselUsage}L Diesel</p>
                                  )}
                                  <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Edit Log</p>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto mb-0.5" />
                                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400">LOG DAY</p>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
            </Card>
          </div>
        )}

        {view === 'analytics' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={analyticsYear}
                onChange={e => setAnalyticsYear(e.target.value)}
                className="h-9 px-3 text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={analyticsMonth}
                onChange={e => setAnalyticsMonth(e.target.value)}
                className="h-9 px-3 text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Months</option>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <option key={i} value={i.toString()}>{m}</option>
                ))}
              </select>
              <span className="text-xs text-slate-400 font-medium">{filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} in view</span>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-4">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">
                  {filteredLogs.length > 0 ? ((filteredLogs.filter(l => l.isActive).length / filteredLogs.length) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Uptime</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 mb-4">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">
                  {filteredLogs.reduce((acc, l) => acc + l.downtimeEntries.reduce((a, e) => a + e.durationHours, 0), 0)}
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Downtime (Hrs)</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 mb-4">
                  <Fuel className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">
                  {filteredLogs.reduce((acc, l) => acc + l.dieselUsage, 0).toFixed(1)}
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Diesel (L)</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 mb-4">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{filteredLogs.length}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Days on Site</p>
              </Card>
            </div>

            {/* Operational Trends */}
            <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[32px] shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" /> Operational Trends
              </h3>
              <div className="h-48 flex items-end gap-1.5 px-2">
                {filteredLogs.slice(0, 20).reverse().map((log, i) => {
                  const downtimeHours = log.downtimeEntries.reduce((a, e) => a + e.durationHours, 0);
                  const uptimeHeight = Math.max(10, 100 - (downtimeHours * 5));
                  return (
                    <div key={log.id} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                      <div className="relative w-full flex-1 flex items-end">
                        <div 
                          className={cn(
                            "w-full rounded-t-lg transition-all duration-500",
                            log.isActive ? "bg-blue-500 shadow-lg shadow-blue-500/20" : "bg-rose-400"
                          )}
                          style={{ height: `${uptimeHeight}%` }}
                        >
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {log.isActive ? 'Active' : 'Down'} · {downtimeHours}h DT
                          </div>
                        </div>
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 rotate-45 mt-1 origin-left">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">No data for selected period</div>
                )}
              </div>
            </Card>

            {/* Diesel Usage Chart */}
            <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[32px] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-amber-500" />
                  {analyticsMonth === 'all' ? `Avg Diesel/Day by Month — ${analyticsYear}` : `Daily Diesel — ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(analyticsMonth)]} ${analyticsYear}`}
                </h3>
                {analyticsMonth === 'all' && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Avg L/day on site</span>
                )}
              </div>
              <div className="h-48 flex items-end gap-1.5 px-2">
                {dieselChartData.map((entry, i) => {
                  const maxVal = Math.max(...dieselChartData.map(e => e.value), 1);
                  const h = entry.value > 0 ? Math.max(8, (entry.value / maxVal) * 100) : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                      <div className="relative w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t-lg transition-colors ${entry.value > 0 ? 'bg-amber-400 hover:bg-amber-500' : 'bg-slate-100 dark:bg-slate-800'}`}
                          style={{ height: h > 0 ? `${h}%` : '4px' }}
                        />
                        {entry.value > 0 && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {entry.isAvg ? `avg ${entry.value.toFixed(1)}L` : `${entry.value.toFixed(1)}L`}
                          </div>
                        )}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 mt-1 truncate w-full text-center">{entry.label}</div>
                    </div>
                  );
                })}
                {dieselChartData.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">No diesel usage logged for selected period</div>
                )}
              </div>
              <div className="mt-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-4">
                <span>Total: <strong className="text-amber-600">{filteredLogs.reduce((a, l) => a + l.dieselUsage, 0).toFixed(1)} L</strong></span>
                <span>{analyticsMonth === 'all' ? 'Peak month:' : 'Avg/day:'}
                  <strong className="text-amber-600 ml-1">
                    {analyticsMonth === 'all'
                      ? dieselChartData.reduce((a, b) => a.value > b.value ? a : b, { label: '—', value: 0 }).label
                      : `${filteredLogs.length > 0 ? (filteredLogs.reduce((a, l) => a + l.dieselUsage, 0) / filteredLogs.length).toFixed(1) : '0'} L`}
                  </strong>
                </span>
              </div>
            </Card>

            {/* Issues & Feedback */}
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Issues</h4>
                <div className="space-y-2">
                  {filteredLogs.filter(l => l.issuesOnSite).slice(0, 3).map(l => (
                    <div key={l.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-500 mb-1">{formatDisplayDate(l.date)}</p>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{l.issuesOnSite}</p>
                    </div>
                  ))}
                  {filteredLogs.filter(l => l.issuesOnSite).length === 0 && <p className="text-xs text-slate-300">No issues in this period</p>}
                </div>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Client Sentiment</h4>
                <div className="space-y-2">
                  {filteredLogs.filter(l => l.clientFeedback).slice(0, 3).map(l => (
                    <div key={l.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-500 mb-1">{formatDisplayDate(l.date)}</p>
                      <p className="text-slate-600 dark:text-slate-400 italic line-clamp-2">"{l.clientFeedback}"</p>
                    </div>
                  ))}
                  {filteredLogs.filter(l => l.clientFeedback).length === 0 && <p className="text-xs text-slate-300">No feedback in this period</p>}
                </div>
              </Card>
            </div>
          </div>
        )}

        {showCamera && (
          <CustomCamera 
            onCapture={handleCapture}
            onClose={() => setShowCamera(false)}
          />
        )}
      </div>

      {/* Downtime Dialog */}
      <Dialog open={showDowntimeDialog} onOpenChange={setShowDowntimeDialog}>
        <DialogContent className="sm:max-w-[425px] p-6 rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-rose-500" /> Record Downtime
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Specify the reason and duration for machine downtime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Reason for Downtime</label>
              <Input 
                value={dtReason} 
                onChange={e => setDtReason(e.target.value)}
                className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Engine Overheating, Hose Burst"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Duration (Hours)</label>
                <Input 
                  type="number" 
                  value={dtDuration} 
                  onChange={e => setDtDuration(e.target.value)}
                  className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Severity</label>
                <select 
                  value={dtSeverity}
                  onChange={e => setDtSeverity(e.target.value as any)}
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20"
              onClick={handleAddDowntime}
            >
              Add Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl bg-white dark:bg-slate-900 p-6 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-500" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 pt-2">
              Are you sure you want to permanently delete this operational log? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs" 
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs" 
              onClick={() => deleteConfirmId && handleDeleteLog(deleteConfirmId)}
            >
              Delete Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
