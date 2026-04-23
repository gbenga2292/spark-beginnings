import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Calendar, Clock, AlertTriangle, 
  CheckCircle2, Fuel, User, MessageSquare, 
  BarChart3, History, Plus, Save, Trash2, Edit2, Wrench, Activity,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '../store/appStore';
import { DailyMachineLog, DowntimeEntry } from '../types/operations';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/src/components/ui/dialog';
import { toast } from 'sonner';

interface DailyLogManagerProps {
  assetId: string;
  assetName: string;
  siteId: string;
  siteName: string;
  onBack: () => void;
}

export function DailyLogManager({ assetId, assetName, siteId, siteName, onBack }: DailyLogManagerProps) {
  const { dailyMachineLogs, logDailyActivity, waybills } = useOperations();
  const { employees } = useAppStore();
  const [view, setView] = useState<'history' | 'form' | 'analytics' | 'calendar'>('history');
  const [selectedLog, setSelectedLog] = useState<DailyMachineLog | null>(null);
  
  // Dewatering field staff for supervisor dropdown
  const dewateringStaff = employees.filter(e => 
    (e.department === 'Dewatering' || e.department?.toLowerCase() === 'dewatering') && 
    e.staffType === 'FIELD'
  );
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isActive, setIsActive] = useState(true);
  const [dieselUsage, setDieselUsage] = useState<string>('0');
  const [supervisorOnSite, setSupervisorOnSite] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [issuesOnSite, setIssuesOnSite] = useState('');
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([]);
  const [showDowntimeDialog, setShowDowntimeDialog] = useState(false);
  
  // Downtime Form State
  const [dtReason, setDtReason] = useState('');
  const [dtDuration, setDtDuration] = useState('1');
  const [dtSeverity, setDtSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  const logs = useMemo(() => {
    return dailyMachineLogs
      .filter(l => l.assetId === assetId && l.siteId === siteId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailyMachineLogs, assetId, siteId]);

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

  const handleSaveLog = async () => {
    try {
      await logDailyActivity({
        assetId,
        assetName,
        siteId,
        siteName,
        date,
        isActive,
        dieselUsage: Number(dieselUsage),
        supervisorOnSite,
        clientFeedback,
        maintenanceDetails,
        issuesOnSite,
        downtimeEntries
      });
      setView('history');
      resetForm();
    } catch (err) {
      // Error handled in context
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setIsActive(true);
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
    setIsActive(log.isActive);
    setDieselUsage(log.dieselUsage.toString());
    setSupervisorOnSite(log.supervisorOnSite || '');
    setClientFeedback(log.clientFeedback || '');
    setMaintenanceDetails(log.maintenanceDetails || '');
    setIssuesOnSite(log.issuesOnSite || '');
    setDowntimeEntries(log.downtimeEntries || []);
    setView('form');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {assetName}
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100 px-2 py-0">Daily Logs</Badge>
            </h2>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Site: {siteName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant={view === 'history' ? 'default' : 'outline'} 
            size="sm" 
            className="gap-2 h-9 text-xs font-semibold px-4 rounded-xl transition-all"
            onClick={() => setView('history')}
          >
            <History className="h-3.5 w-3.5" /> History
          </Button>
          <Button 
            variant={view === 'analytics' ? 'default' : 'outline'} 
            size="sm" 
            className="gap-2 h-9 text-xs font-semibold px-4 rounded-xl transition-all"
            onClick={() => setView('analytics')}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </Button>
          <Button 
            variant={view === 'calendar' ? 'default' : 'outline'} 
            size="sm" 
            className="gap-2 h-9 text-xs font-semibold px-4 rounded-xl transition-all"
            onClick={() => setView('calendar')}
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </Button>
          <Button 
            className="gap-2 h-9 text-xs font-bold px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all"
            onClick={() => {
              resetForm();
              setView('form');
            }}
          >
            <Plus className="h-3.5 w-3.5" /> New Log
          </Button>
        </div>
      </div>

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
                <Card key={log.id} className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all rounded-3xl group overflow-hidden border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 shrink-0">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-800 dark:text-white">{formatDisplayDate(log.date)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={cn(
                            "text-[10px] font-bold px-2 py-0 rounded-full",
                            log.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                          )}>
                            {log.isActive ? 'OPERATIONAL' : 'DOWN'}
                          </Badge>
                          {log.downtimeEntries.length > 0 && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0 rounded-full bg-amber-50 text-amber-700 border-amber-100">
                              {log.downtimeEntries.length} DOWNTIME INCIDENTS
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600" onClick={() => editLog(log)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supervisor</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" /> {log.supervisorOnSite || 'N/A'}
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
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 space-y-3 border border-slate-100 dark:border-slate-800">
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
                            <span className="font-bold text-slate-700 dark:text-slate-200">Maintenance:</span> {log.maintenanceDetails}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {view === 'form' && (
          <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-8 space-y-8">
                {/* Basic Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Log Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                        className="pl-10 h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Operational Status</label>
                    <div className="flex p-1 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <button 
                        onClick={() => setIsActive(true)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                          isActive ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> ACTIVE
                      </button>
                      <button 
                        onClick={() => setIsActive(false)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                          !isActive ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> DOWN
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Diesel Usage (L)</label>
                    <div className="relative">
                      <Fuel className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        type="number" 
                        value={dieselUsage} 
                        onChange={e => setDieselUsage(e.target.value)}
                        className="pl-10 h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Supervisor Field */}
                <div className="space-y-3">
                  <Label className="text-[13px] font-bold text-slate-700 dark:text-slate-300 ml-1">Supervisor on Site</Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <select
                      value={supervisorOnSite}
                      onChange={(e) => setSupervisorOnSite(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Supervisor</option>
                      {dewateringStaff.map(staff => (
                        <option key={staff.id} value={`${staff.firstname} ${staff.surname}`}>
                          {staff.firstname} {staff.surname}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Plus className="h-3.5 w-3.5 rotate-45" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Issues on Site</label>
                    <Textarea 
                      value={issuesOnSite} 
                      onChange={e => setIssuesOnSite(e.target.value)}
                      className="min-h-[100px] bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 p-4"
                      placeholder="Describe any environmental or site-specific issues..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Maintenance Performed</label>
                    <Textarea 
                      value={maintenanceDetails} 
                      onChange={e => setMaintenanceDetails(e.target.value)}
                      className="min-h-[100px] bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 p-4"
                      placeholder="Any onsite repairs or maintenance done today?"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Client Feedback</label>
                  <Textarea 
                    value={clientFeedback} 
                    onChange={e => setClientFeedback(e.target.value)}
                    className="min-h-[80px] bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 p-4"
                    placeholder="What did the client say about the machine performance?"
                  />
                </div>

                {/* Downtime Section */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-rose-500" />
                      <h3 className="font-bold text-slate-800 dark:text-white">Downtime Incidents</h3>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 h-9 text-xs font-bold rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/30 dark:hover:bg-rose-900/20"
                      onClick={() => setShowDowntimeDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Incident
                    </Button>
                  </div>

                  {downtimeEntries.length === 0 ? (
                    <div className="py-8 px-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-xs font-medium text-slate-400">No downtime incidents recorded for this period.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {downtimeEntries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 group animate-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                              entry.severity === 'high' ? "bg-rose-100 text-rose-600" :
                              entry.severity === 'medium' ? "bg-amber-100 text-amber-600" :
                              "bg-blue-100 text-blue-600"
                            )}>
                              <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-white">{entry.reason}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {entry.durationHours} Hours · {entry.severity} Severity
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                            onClick={() => setDowntimeEntries(downtimeEntries.filter(e => e.id !== entry.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  variant="outline" 
                  className="h-11 px-8 rounded-xl font-bold border-slate-200"
                  onClick={() => setView('history')}
                >
                  Cancel
                </Button>
                <Button 
                  className="h-11 px-10 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2"
                  onClick={handleSaveLog}
                >
                  <Save className="h-4 w-4" /> {selectedLog ? 'Update Log' : 'Save Daily Log'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-12">
            <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[32px] shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Operation Schedule</h3>
                  <p className="text-sm text-slate-400 mt-1">Timeline of machine presence and daily logging.</p>
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
              <div className="flex items-center gap-6 mb-8 px-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/20" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Arrived on Site</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Log Submitted</span>
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

                    days.push(
                      <div 
                        key={i} 
                        className={cn(
                          "h-24 rounded-3xl border p-3 flex flex-col justify-between transition-all group relative overflow-hidden",
                          hasLog ? "bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20" : 
                          isArrivalDate ? "bg-orange-50/50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/20" :
                          "bg-slate-50/30 border-slate-100 dark:bg-slate-800/20 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-sm"
                        )}
                      >
                        <span className={cn(
                          "text-sm font-bold",
                          hasLog ? "text-blue-600" : isArrivalDate ? "text-orange-600" : "text-slate-400 dark:text-slate-600"
                        )}>
                          {i}
                        </span>

                        <div className="flex gap-1">
                          {isArrivalDate && (
                            <div className="h-2 w-2 rounded-full bg-orange-500 shadow-sm animate-pulse" />
                          )}
                          {hasLog && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-sm" />
                          )}
                        </div>

                        {/* Hover Overlay */}
                        {(hasLog || isArrivalDate) && (
                          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer px-2 text-center" onClick={() => hasLog && editLog(hasLog)}>
                            <p className="text-[10px] font-bold text-slate-800 dark:text-white leading-tight">
                              {isArrivalDate && "Arrived on Site"}
                              {isArrivalDate && hasLog && <br />}
                              {hasLog && `Logged: ${hasLog.dieselUsage}L Diesel`}
                            </p>
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
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-4">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">
                  {logs.length > 0 ? ((logs.filter(l => l.isActive).length / logs.length) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Uptime</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 mb-4">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">
                  {logs.reduce((acc, l) => acc + l.downtimeEntries.reduce((a, e) => a + e.durationHours, 0), 0)}
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Downtime (Hrs)</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 mb-4">
                  <Fuel className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">
                  {logs.reduce((acc, l) => acc + l.dieselUsage, 0).toFixed(1)}
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Diesel (L)</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 mb-4">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{logs.length}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Days on Site</p>
              </Card>
            </div>

            <Card className="p-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[32px] shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" /> Operational Trends
              </h3>
              
              <div className="h-64 flex items-end gap-2 px-4">
                {logs.slice(0, 14).reverse().map((log, i) => {
                  const downtimeHours = log.downtimeEntries.reduce((a, e) => a + e.durationHours, 0);
                  const uptimeHeight = Math.max(10, 100 - (downtimeHours * 5));
                  
                  return (
                    <div key={log.id} className="flex-1 flex flex-col items-center gap-2 group relative">
                      <div 
                        className={cn(
                          "w-full rounded-t-xl transition-all duration-500 group-hover:scale-x-110",
                          log.isActive ? "bg-blue-500 shadow-lg shadow-blue-500/20" : "bg-rose-400"
                        )}
                        style={{ height: `${uptimeHeight}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {log.isActive ? 'Active' : 'Down'} · {downtimeHours}h DT
                        </div>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 rotate-45 mt-2 origin-left">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-12 grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Issues</h4>
                  <div className="space-y-2">
                    {logs.filter(l => l.issuesOnSite).slice(0, 3).map(l => (
                      <div key={l.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800">
                        <p className="font-bold text-slate-500 mb-1">{formatDisplayDate(l.date)}</p>
                        <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{l.issuesOnSite}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Client Sentiment</h4>
                  <div className="space-y-2">
                    {logs.filter(l => l.clientFeedback).slice(0, 3).map(l => (
                      <div key={l.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800">
                        <p className="font-bold text-slate-500 mb-1">{formatDisplayDate(l.date)}</p>
                        <p className="text-slate-600 dark:text-slate-400 italic line-clamp-2">"{l.clientFeedback}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
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
    </div>
  );
}
