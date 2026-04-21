import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { TaskContext } from '../contexts/AppDataContext';
import { useAuth } from '../hooks/useAuth';
import { Plus, Search, ShieldAlert, FileText, CheckCircle2, AlertCircle, Clock, Save, X, Download, History } from 'lucide-react';
import { toast } from '../components/ui/toast';
import { differenceInDays, format, parseISO } from 'date-fns';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function HmoManagement() {
  const { user } = useAuth();
  const { employees, updateEmployee } = useAppStore();
  const taskContext = useContext(TaskContext);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewHistoryEmp, setViewHistoryEmp] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'renewals'>('directory');
  

  // Smartly calculate HMO details using what provides we have
  const getHmoDetails = (emp: any) => {
    let start = emp.lashmaRegistrationDate || '';
    let end = emp.lashmaExpiryDate || '';
    let dur = emp.lashmaDuration;

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
         const dEnd = new Date(end);
         if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
           dur = Math.round(differenceInDays(dEnd, dStart) / 30);
         }
       } catch {}
    }
    
    return { start: start || null, end: end || null, dur: dur || null };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  // Get active directory
  // Get active directory (only OFFICE and FIELD staff)
  const activeEmployees = useMemo(() => {
    return employees.filter(e => 
      e.status !== 'Terminated' && 
      e.status !== 'Onboarding' && 
      (e.staffType === 'OFFICE' || e.staffType === 'FIELD')
    );
  }, [employees]);

  // Handle task sync logic
  useEffect(() => {
    if (!taskContext) return;
    
    // Find or define HMO Renewal Main Task
    let hmoMainTask = taskContext.mainTasks.find(t => t.title === 'HMO Renewal');
    
    const syncTasks = async () => {
      let mainTaskId = hmoMainTask?.id;
      
      // If we need to create tasks but the MainTask is missing, create it.
      for (const emp of activeEmployees) {
        const { start, end } = getHmoDetails(emp);
        if (!start || !end) continue;
        
        const daysToExpiry = differenceInDays(new Date(end), new Date());
        
        // If expiry is within 30 days or overdue, ensure a task exists
        if (daysToExpiry <= 30) {
          if (!mainTaskId) {
            try {
              const newTask = await taskContext.createMainTask({
                title: 'HMO Renewal',
                description: 'Manage employee HMO policy renewals',
                is_project: false,
                skipAutoSubtask: true
              }, []);
              if (newTask) {
                 mainTaskId = newTask.id;
              }
            } catch (e) {
              console.error('Failed to auto-create HMO main task', e);
            }
          }
          
          if (!mainTaskId) return;

          // Check if subtask exists
          const title = `HMO Renewal - ${emp.surname} ${emp.firstname}`;
          
          // Check if there is an active subtask for this employee
          const existingSubtask = taskContext.subtasks.find(
             s => (s.mainTaskId === mainTaskId || s.main_task_id === mainTaskId) && 
                  s.title.includes(emp.firstname) && 
                  s.title.includes(emp.surname) &&
                  s.status !== 'completed'
          );
          
           const hrUser = taskContext.users.find((u: any) =>
             (u.department || '').toLowerCase().includes('hr') ||
             (u.department || '').toLowerCase().includes('human resource')
           );

           if (!existingSubtask) {
              try {
                 await taskContext.addSubtask({
                    title,
                    description: JSON.stringify({ refType: 'hmo', employeeId: emp.id }),
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
      }
    };
    
    // De-bounce task creation to not hammer backend
    const timeout = setTimeout(() => {
      syncTasks();
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [employees, taskContext]);

  // Derived filtered directory
  const filteredDirectory = activeEmployees.filter(e => {
    const term = searchTerm.toLowerCase();
    const name = `${e.firstname} ${e.surname}`.toLowerCase();
    return name.includes(term) || (e.lashmaPolicyNumber || '').toLowerCase().includes(term);
  });

  // Calculate pending renewals manually from employees data since subtasks might have delay or out of sync
  const pendingRenewals = useMemo(() => {
    return activeEmployees.filter(e => {
      const { start, end } = getHmoDetails(e);
      if (!start || !end) return false;
      return differenceInDays(new Date(end), new Date()) <= 30;
    });
  }, [activeEmployees]);

  const handleExportCSV = () => {
    const dataToExport = activeTab === 'directory' ? filteredDirectory : pendingRenewals;
    const headers = ['Employee Name', 'Policy Number', 'Start Date', 'Duration (Months)', 'End Date', 'Status'];
    
    const csvRows = [headers.join(',')];
    
    dataToExport.forEach(emp => {
      const { start, end, dur } = getHmoDetails(emp);
        
      let status = 'Active';
      if (!end) status = 'Unknown';
      else {
        const diff = differenceInDays(new Date(end), new Date());
        if (diff < 0) status = 'Expired';
        else if (diff <= 30) status = 'Expiring Soon';
      }
      
      const row = [
        `"${emp.firstname} ${emp.surname}"`,
        `"${emp.lashmaPolicyNumber || ''}"`,
        `"${formatDate(start)}"`,
        `"${dur || ''}"`,
        `"${formatDate(end)}"`,
        `"${status}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `HMO_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">LASHMA / HMO Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track employee health insurance policies and manage renewals</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2 bg-white shadow-sm text-slate-700">
            <Download className="h-4 w-4" />
            Export Context
          </Button>
        </div>
      </div>

      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'directory' 
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Policy Directory
        </button>
        <button
          onClick={() => setActiveTab('renewals')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'renewals' 
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Pending Renewals
          {pendingRenewals.length > 0 && (
            <span className="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 px-1.5 py-0.5 rounded-full text-xs ml-1">
              {pendingRenewals.length}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee or policy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Policy Number</th>
                <th className="px-5 py-3">Start Date</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">End Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'directory' ? filteredDirectory : pendingRenewals).length === 0 ? (
                 <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                       No employees found in this view.
                    </td>
                 </tr>
              ) : (
                (activeTab === 'directory' ? filteredDirectory : pendingRenewals).map(emp => {
                  const { start, end, dur } = getHmoDetails(emp);
                    
                  let isExpiringSoon = false;
                  let isExpired = false;
                  
                  if (end) {
                    const diff = differenceInDays(new Date(end), new Date());
                    if (diff < 0) isExpired = true;
                    else if (diff <= 30) isExpiringSoon = true;
                  }

                  return (
                    <tr key={emp.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                        {emp.firstname} {emp.surname}
                      </td>
                      <td className="px-5 py-3">
                        {emp.lashmaPolicyNumber || <span className="text-slate-300 italic">Not set</span>}
                      </td>
                      <td className="px-5 py-3">
                        {formatDate(start) || <span className="text-slate-300 italic">Not set</span>}
                      </td>
                      <td className="px-5 py-3">
                        {dur ? `${dur} months` : '-'}
                      </td>
                      <td className="px-5 py-3">
                        {formatDate(end) || '-'}
                      </td>
                      <td className="px-5 py-3">
                        {!end ? (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                             Unknown
                           </span>
                        ) : isExpired ? (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                             <AlertCircle className="h-3.5 w-3.5" />
                             Expired
                           </span>
                        ) : isExpiringSoon ? (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                             <Clock className="h-3.5 w-3.5" />
                             Expiring Soon
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                             <CheckCircle2 className="h-3.5 w-3.5" />
                             Active
                           </span>
                        )}
                       </td>
                       <td className="px-5 py-3 text-right">
                         <button
                           onClick={() => setViewHistoryEmp(emp)}
                           className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium text-xs px-2 py-1.5 inline-flex items-center gap-1"
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
      </div>

      {/* History Modal */}
      {viewHistoryEmp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl w-full max-w-lg">
             <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <History className="text-slate-400 h-5 w-5" /> 
                  HMO Renewal Log
                </h3>
                <button onClick={() => setViewHistoryEmp(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
             </div>
             
             <p className="text-sm text-slate-500 mb-4">Historical record of HMO policy renewals for <span className="font-semibold text-slate-700 dark:text-slate-300">{viewHistoryEmp.firstname} {viewHistoryEmp.surname}</span></p>
             
             <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {/* Note: Wait, Employee object doesn't have a renewal log array right now.
                    We will simulate the view with the current details until we add a proper log table. */}
                {viewHistoryEmp.lashmaRegistrationDate || viewHistoryEmp.lashmaExpiryDate ? (
                   <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                     <p className="text-xs text-slate-400 mb-1">Current Active / Latest Entry</p>
                     <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Policy: {viewHistoryEmp.lashmaPolicyNumber || 'N/A'}</p>
                          <p className="text-xs font-medium text-slate-500">
                            {formatDate(getHmoDetails(viewHistoryEmp).start) || 'N/A'} - {formatDate(getHmoDetails(viewHistoryEmp).end) || 'N/A'} ({getHmoDetails(viewHistoryEmp).dur || '-'} months)
                          </p>
                        </div>
                     </div>
                   </div>
                ) : (
                   <div className="text-center py-6 text-slate-400 text-sm italic">
                     No renewal history found.
                   </div>
                )}
             </div>
             
             <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-3">
                <Button variant="outline" onClick={() => setViewHistoryEmp(null)}>Close</Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
