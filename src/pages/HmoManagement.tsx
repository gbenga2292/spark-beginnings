import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { TaskContext } from '@/src/contexts/AppDataContext';
import { useAuth } from '../hooks/useAuth';
import { Search, ShieldAlert, FileText, CheckCircle2, AlertCircle, Clock, X, Download, Upload, History } from 'lucide-react';
import { toast } from '../components/ui/toast';
import { differenceInDays, format, parseISO } from 'date-fns';
import { Button } from '../components/ui/button';
import { useSetPageTitle } from '../contexts/PageContext';

// ---------------------------------------------------------------------------
// Helpers (pure — defined outside component to prevent recreation on render)
// ---------------------------------------------------------------------------

function getHmoDetails(emp: any) {
  let start: string = emp.lashmaRegistrationDate || '';
  let end: string   = emp.lashmaExpiryDate || '';
  let dur: number | null = emp.lashmaDuration ?? null;

  if (start && dur && !end) {
    try {
      const d = new Date(start);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + dur);
        end = d.toISOString().split('T')[0];
      }
    } catch {}
  } else if (start && end && !dur) {
    try {
      const dStart = new Date(start);
      const dEnd   = new Date(end);
      if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
        dur = Math.round(differenceInDays(dEnd, dStart) / 30);
      }
    } catch {}
  }

  return { start: start || null, end: end || null, dur: dur || null };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy'); }
  catch { return dateStr; }
}

/** Derive expiry status from an HMO end date (null-safe). */
function getExpiryStatus(end: string | null) {
  if (!end) return 'unknown' as const;
  const diff = differenceInDays(new Date(end), new Date());
  if (diff < 0)    return 'expired'       as const;
  if (diff <= 30)  return 'expiring-soon' as const;
  return 'active' as const;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HmoManagement() {
  const { user } = useAuth();
  const { employees, updateEmployee } = useAppStore();
  const taskContext = useContext(TaskContext);

  const [searchTerm, setSearchTerm]       = useState('');
  const [viewHistoryEmp, setViewHistoryEmp] = useState<any>(null);
  const [activeTab, setActiveTab]         = useState<'directory' | 'renewals'>('directory');

  // Close modal – stable reference so child buttons never cause re-renders
  const closeModal = useCallback(() => setViewHistoryEmp(null), []);

  // -------------------------------------------------------------------------
  // Derived data — memoized so re-render only happens when inputs change
  // -------------------------------------------------------------------------

  const activeEmployees = useMemo(() =>
    employees.filter(e =>
      e.status !== 'Terminated' &&
      e.status !== 'Onboarding' &&
      (e.staffType === 'OFFICE' || e.staffType === 'FIELD')
    ),
  [employees]);

  const filteredDirectory = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return activeEmployees;
    return activeEmployees.filter(e => {
      const name = `${e.firstname} ${e.surname}`.toLowerCase();
      return name.includes(term) || (e.lashmaPolicyNumber || '').toLowerCase().includes(term);
    });
  }, [activeEmployees, searchTerm]);

  const pendingRenewals = useMemo(() =>
    activeEmployees.filter(e => {
      const { start, end } = getHmoDetails(e);
      if (!start || !end) return false;
      return differenceInDays(new Date(end), new Date()) <= 30;
    }),
  [activeEmployees]);

  // The visible set for the current tab — cheap computation, no memo needed
  const visibleRows = activeTab === 'directory' ? filteredDirectory : pendingRenewals;

  // -------------------------------------------------------------------------
  // Task sync — debounced, deps are stable references
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!taskContext) return;

    const syncTasks = async () => {
      let hmoMainTask = taskContext.mainTasks.find((t: any) => t.title === 'HMO Renewal');
      let mainTaskId  = hmoMainTask?.id;

      for (const emp of activeEmployees) {
        const { start, end } = getHmoDetails(emp);
        if (!start || !end) continue;

        const daysToExpiry = differenceInDays(new Date(end), new Date());
        if (daysToExpiry > 30) continue;

        if (!mainTaskId) {
          try {
            const newTask = await taskContext.createMainTask({
              title: 'HMO Renewal',
              description: 'Manage employee HMO policy renewals',
              is_project: false,
              skipAutoSubtask: true,
              is_hr_task: true,
            }, []);
            if (newTask) mainTaskId = newTask.id;
          } catch (e) {
            console.error('Failed to auto-create HMO main task', e);
          }
        }

        if (!mainTaskId) return;

        const existingSubtask = taskContext.subtasks.find((s: any) => {
          const isRelated = (s.mainTaskId === mainTaskId || s.main_task_id === mainTaskId);
          if (!isRelated || s.is_deleted || s.status === 'completed') return false;

          // Metadata match
          try {
            if (s.description && s.description.trim().startsWith('{')) {
              const meta = JSON.parse(s.description);
              if (meta.refType === 'hmo' && meta.employeeId === emp.id) return true;
            }
          } catch (e) {}

          // Title match fallback
          return s.title === `HMO Renewal - ${emp.surname} ${emp.firstname}`;
        });

        if (!existingSubtask) {
          const hrUser = taskContext.users.find((u: any) =>
            (u.department || '').toLowerCase().includes('hr') ||
            (u.department || '').toLowerCase().includes('human resource')
          );
          try {
            await taskContext.addSubtask({
              title: `HMO Renewal - ${emp.surname} ${emp.firstname}`,
              description: JSON.stringify({ 
                refType: 'hmo', 
                employeeId: emp.id,
                narration: `HMO Policy for ${emp.surname} ${emp.firstname} is due for renewal on ${formatDate(end)}. Please process with LASHMA.`
              }),
              priority: daysToExpiry < 0 ? 'urgent' : 'high',
              deadline: end,
              mainTaskId,
              assignedTo: hrUser?.id || null,
            });
          } catch (e) {
            console.error('Failed to auto-create HMO subtask', e);
          }
        }
      }
    };

    const timeout = setTimeout(syncTasks, 2000);
    return () => clearTimeout(timeout);
  }, [activeEmployees, taskContext]);

  // -------------------------------------------------------------------------
  // Export CSV
  // -------------------------------------------------------------------------
  const handleExportCSV = useCallback(() => {
    const dataToExport = activeTab === 'directory' ? filteredDirectory : pendingRenewals;
    const headers = ['Employee Name', 'Policy Number', 'Start Date', 'Duration (Months)', 'End Date', 'Status'];
    const csvRows  = [headers.join(',')];

    dataToExport.forEach(emp => {
      const { start, end, dur } = getHmoDetails(emp);
      const status = !end ? 'Unknown'
        : differenceInDays(new Date(end), new Date()) < 0  ? 'Expired'
        : differenceInDays(new Date(end), new Date()) <= 30 ? 'Expiring Soon'
        : 'Active';

      csvRows.push([
        `"${emp.firstname} ${emp.surname}"`,
        `"${emp.lashmaPolicyNumber || ''}"`,
        `"${formatDate(start)}"`,
        `"${dur || ''}"`,
        `"${formatDate(end)}"`,
        `"${status}"`,
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `HMO_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [activeTab, filteredDirectory, pendingRenewals]);

  // Set global page header
  useSetPageTitle(
    'LASHMA / HMO Management',
    'Track employee health insurance policies and manage renewals',
    <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-xs h-9 rounded-md shadow-none">
      <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
      Export CSV
    </Button>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6">
      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-md w-fit mb-6">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'directory'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Policy Directory
        </button>
        <button
          onClick={() => setActiveTab('renewals')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'renewals'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Pending Renewals
          {pendingRenewals.length > 0 && (
            <span className="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 px-1.5 py-0.2 rounded-sm text-[10px] font-bold ml-1">
              {pendingRenewals.length}
            </span>
          )}
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-none">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search employee or policy..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-500 dark:text-slate-400">
            <thead className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Policy Number</th>
                <th className="px-5 py-3 hidden md:table-cell">Start Date</th>
                <th className="px-5 py-3 hidden md:table-cell">Duration</th>
                <th className="px-5 py-3">End Date</th>
                <th className="px-5 py-3 hidden sm:table-cell">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No employees found in this view.
                  </td>
                </tr>
              ) : (
                visibleRows.map(emp => {
                  const { start, end, dur } = getHmoDetails(emp);
                  const expiryStatus        = getExpiryStatus(end);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {emp.firstname} {emp.surname}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        {emp.lashmaPolicyNumber || <span className="text-slate-400 italic">Not set</span>}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {formatDate(start) || <span className="text-slate-400 italic">Not set</span>}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">{dur ? `${dur} months` : '-'}</td>
                      <td className="px-5 py-3">{formatDate(end) || '-'}</td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <StatusBadge status={expiryStatus} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setViewHistoryEmp(emp)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-xs px-2 py-1 inline-flex items-center gap-1 rounded transition-colors"
                        >
                          <History className="h-3.5 w-3.5" /> History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {visibleRows.map(emp => {
            const { start, end, dur } = getHmoDetails(emp);
            const expiryStatus        = getExpiryStatus(end);

            return (
              <div key={`mobile-${emp.id}`} className="p-4 flex flex-col gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{emp.firstname} {emp.surname}</span>
                    <span className="text-[11px] text-slate-500 font-mono tracking-tight mt-0.5">{emp.lashmaPolicyNumber || 'No Policy Set'}</span>
                  </div>
                  <button
                    onClick={() => setViewHistoryEmp(emp)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-xs px-2 py-1 inline-flex items-center gap-1 rounded transition-colors"
                  >
                    <History className="h-3.5 w-3.5" /> History
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Start Date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(start) || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">End Date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(end) || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Duration</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{dur ? `${dur} months` : '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                    <div className="mt-0.5">
                      <StatusBadge status={expiryStatus} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History Modal */}
      {viewHistoryEmp && (
        <HmoHistoryModal emp={viewHistoryEmp} onClose={closeModal} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — small pure component keeps table rows lean
// ---------------------------------------------------------------------------
type ExpiryStatus = 'unknown' | 'expired' | 'expiring-soon' | 'active';

function StatusBadge({ status }: { status: ExpiryStatus }) {
  switch (status) {
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40">
          <AlertCircle className="h-3 w-3" /> Expired
        </span>
      );
    case 'expiring-soon':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40">
          <Clock className="h-3 w-3" /> Expiring Soon
        </span>
      );
    case 'active':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40">
          <CheckCircle2 className="h-3 w-3" /> Active
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
          Unknown
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// HmoHistoryModal — extracted so it only mounts when needed and is memoized
// ---------------------------------------------------------------------------
const HmoHistoryModal = React.memo(function HmoHistoryModal({
  emp,
  onClose,
}: {
  emp: any;
  onClose: () => void;
}) {
  const { start, end, dur } = getHmoDetails(emp);
  const hasHistory = emp.lashmaRegistrationDate || emp.lashmaExpiryDate;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 p-5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-lg">
        {/* Modal header */}
        <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <History className="text-blue-600 dark:text-blue-400 h-4 w-4" />
            HMO Renewal Log
          </h3>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Historical record of HMO policy renewals for{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {emp.firstname} {emp.surname}
          </span>
        </p>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {hasHistory ? (
            <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-md bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Current Active / Latest Entry</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    Policy: {emp.lashmaPolicyNumber || 'N/A'}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatDate(start) || 'N/A'} – {formatDate(end) || 'N/A'}{dur ? ` (${dur} months)` : ''}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs italic">
              No renewal history found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-md text-xs h-8 shadow-none border-slate-200 dark:border-slate-700">Close</Button>
        </div>
      </div>
    </div>
  );
});
