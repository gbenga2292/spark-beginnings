
import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { CalendarDays, Filter, ChevronDown, CheckCircle2, UserCheck, Mail, Phone, Download, Printer, Eye, X, Upload, Plus, Edit, Trash2, Ban, Search, ListFilter, CalendarClock, FileText, ShieldCheck, Clock, XCircle } from 'lucide-react';
import { useAppStore, LeaveRecord } from '@/src/store/appStore';
import { useNavigate } from 'react-router-dom';
import { usePriv } from '@/src/hooks/usePriv';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { addDays, parseISO, format, isWithinInterval } from 'date-fns';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';

/* ─────────────────────────────────── helpers ─── */
function calcExpectedEnd(startDate: string, duration: number): string {
  if (!startDate || !duration || duration < 1) return '';
  return format(addDays(parseISO(startDate), duration), 'yyyy-MM-dd');
}

function isOnLeave(leave: LeaveRecord, date: Date): boolean {
  if (leave.status === 'Cancelled') return false;
  try {
    return isWithinInterval(date, {
      start: parseISO(leave.startDate),
      end: parseISO(leave.expectedEndDate),
    });
  } catch { return false; }
}

/* ─────────────────────────────────── component ─ */
export function Leaves() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { users, createMainTask, addSubtask } = useAppData();
  const {
    employees, leaves, addLeave, updateLeave, deleteLeave,
    leaveTypes, updateEmployee, departments,
  } = useAppStore();

  // Approver options — all active system users except current user
  const approverOptions = users.filter((u: any) => u.id !== currentUser?.id && !u.isDeleted);

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('leaves');

  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === 'Active' || e.status === 'On Leave'),
    [employees]
  );

  // Internal staff only (no Adhoc) – used for Staff, Supervisor, Management dropdowns and Leave Summary
  const internalEmployees = useMemo(() => {
    const internalDeptNames = departments.filter(d => d.staffType === 'OFFICE').map(d => d.name);
    return activeEmployees.filter(e => e.position !== 'Adhoc Staff' && internalDeptNames.includes(e.department));
  }, [activeEmployees, departments]);

  /* ── filter state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('All');

  /* ── form state ── */
  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [dateReturned, setDateReturned] = useState('');
  const [canBeContacted, setCanBeContacted] = useState<'Yes' | 'No'>('No');
  const [supervisor, setSupervisor] = useState('');
  const [uploadedFile, setUploadedFile] = useState<string | undefined>(undefined);
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>(undefined);
  const [approverId, setApproverId] = useState('');

  /* ── print / preview state ── */
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewLeave, setPreviewLeave] = useState<LeaveRecord | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  /* ── file upload preview ── */
  const [filePreviewLeave, setFilePreviewLeave] = useState<LeaveRecord | null>(null);

  const expectedEndDate = useMemo(
    () => calcExpectedEnd(startDate, parseInt(duration) || 0),
    [startDate, duration]
  );

  /* ── derived data ── */
  const filteredLeaves = useMemo(() => {
    let result = leaves;
    if (filterView === 'Active') result = result.filter(l => !l.dateReturned && l.status !== 'Cancelled');
    else if (filterView === 'Completed') result = result.filter(l => !!l.dateReturned);
    else if (filterView === 'Cancelled') result = result.filter(l => l.status === 'Cancelled');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.employeeName.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q) ||
        (l.leaveType || '').toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leaves, filterView, searchQuery]);

  /* leave summary per employee — internal staff only */
  const leaveSummary = useMemo(() => {
    return internalEmployees.map(emp => {
      const empLeaves = leaves.filter(l => l.employeeId === emp.id && l.status !== 'Cancelled');
      const totalTaken = empLeaves.reduce((s, l) => s + l.duration, 0);
      const entitlement = emp.yearlyLeave || 20;
      const remaining = entitlement - totalTaken;
      const isCurrentlyOnLeave = empLeaves.some(l => isOnLeave(l, new Date()));
      return { emp, totalTaken, remaining, entitlement, isCurrentlyOnLeave };
    });
  }, [internalEmployees, leaves]);

  /* ── form helpers ── */
  const resetForm = () => {
    setFormId(null); setStaffId(''); setLeaveType(''); setStartDate('');
    setDuration(''); setReason(''); setDateReturned(''); setCanBeContacted('No');
    setSupervisor(''); setApproverId('');
    setUploadedFile(undefined); setUploadedFileName(undefined);
  };

  const handleEdit = (leave: LeaveRecord) => {
    setFormId(leave.id);
    setStaffId(leave.employeeId);
    setLeaveType(leave.leaveType || '');
    setStartDate(leave.startDate);
    setDuration(leave.duration.toString());
    setReason(leave.reason);
    setDateReturned(leave.dateReturned || '');
    setCanBeContacted(leave.canBeContacted);
    setSupervisor(leave.supervisor || '');
    setApproverId(leave.approvedById || '');
    setUploadedFile(leave.uploadedFile);
    setUploadedFileName(leave.uploadedFileName);
    setShowForm(true);
  };

  /* auto-sync employee status when a leave is added/updated */
  const syncEmployeeStatus = (empId: string) => {
    const today = new Date();
    const empActiveLeaves = leaves.filter(
      l => l.employeeId === empId && l.status !== 'Cancelled' && isOnLeave(l, today)
    );
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const shouldBeOnLeave = empActiveLeaves.length > 0;
    if (shouldBeOnLeave && emp.status !== 'On Leave') updateEmployee(empId, { status: 'On Leave' });
    if (!shouldBeOnLeave && emp.status === 'On Leave') updateEmployee(empId, { status: 'Active' });
  };

  const handleCreateOrUpdate = async () => {
    if (!staffId || !startDate || !duration || !reason || !leaveType) {
      toast.error('Please fill in all required fields (Staff, Type, Start Date, Duration, Reason).');
      return;
    }
    const emp = employees.find(e => e.id === staffId);
    if (!emp) { toast.error('Employee not found.'); return; }

    const endDate = expectedEndDate;

    const approver = approverId ? approverOptions.find((u: any) => u.id === approverId) : null;
    const approverName = approver?.name || 'Unknown';
    const empName = `${emp.surname} ${emp.firstname}`;

    if (formId) {
      // Editing: don't change approval workflow
      updateLeave(formId, {
        leaveType, startDate, duration: parseInt(duration),
        expectedEndDate: endDate, reason, dateReturned, canBeContacted,
        uploadedFile, uploadedFileName, supervisor, management: approverName,
      });
      toast.success('Leave entry updated!');
      setTimeout(() => syncEmployeeStatus(staffId), 100);
    } else {
      if (!approverId) {
        toast.error('Please select an approver before submitting.');
        return;
      }

      const newLeave: LeaveRecord = {
        id: crypto.randomUUID(),
        employeeId: staffId,
        employeeName: empName,
        leaveType, startDate, duration: parseInt(duration),
        expectedEndDate: endDate, reason, dateReturned,
        canBeContacted, status: 'Active',
        uploadedFile, uploadedFileName, supervisor, management: approverName,
        approvedById: approverId,
        approvedByName: approverName,
        approvalStatus: 'Pending',
      };
      addLeave(newLeave);
      setTimeout(() => syncEmployeeStatus(staffId), 100);

      // Create approval task for the selected approver
      try {
        const today430 = new Date();
        today430.setHours(16, 30, 0, 0);

        const mainTask = await createMainTask({
          title: `Approve Leave Request for ${empName}`,
          description: `${leaveType} leave (${duration} days from ${startDate}) — submitted by ${currentUser?.user_metadata?.name || 'HR'}.`,
          createdBy: currentUser?.id,
          teamId: 'dcel-team',
          workspaceId: 'dcel-team',
          assignedTo: approverId,
          deadline: today430.toISOString(),
        });
        if (mainTask?.id) {
          const subtaskDesc = JSON.stringify({ refType: 'leave', refId: newLeave.id, employeeName: empName, leaveType, duration });
          const sub = await addSubtask({
            title: `Approve: ${empName} — ${duration}-day ${leaveType} Leave`,
            description: subtaskDesc,
            mainTaskId: mainTask.id,
            assignedTo: approverId,
            status: 'not_started',
            priority: 'high',
            deadline: today430.toISOString(),
          });
          if ((sub as any)?.id) {
            updateLeave(newLeave.id, { approvalTaskId: (sub as any).id });
          }
        }
      } catch (e) {
        console.error('Failed to create leave approval task:', e);
      }

      toast.success(`Leave filed! Pending approval from ${approverName}.`);
      // Offer immediate print preview
      setPreviewLeave(newLeave);
      setShowPrintPreview(true);
    }
    setShowForm(false);
    resetForm();
  };

  const handlePreviewCurrentForm = () => {
    if (!staffId) {
      toast.error('Please select an employee first to preview the form.');
      return;
    }
    const emp = employees.find(e => e.id === staffId);
    
    // Construct a temporary leave object for preview
    const tempLeave: LeaveRecord = {
      id: formId || `PREVIEW`,
      employeeId: staffId,
      employeeName: emp ? `${emp.surname} ${emp.firstname}` : '',
      leaveType: leaveType || '',
      startDate: startDate || '',
      duration: duration ? parseInt(duration) : 0,
      expectedEndDate: expectedEndDate || '',
      reason: reason || '',
      dateReturned: dateReturned || '',
      canBeContacted: canBeContacted || 'Yes',
      status: 'Active',
      supervisor, management: approverId ? approverOptions.find((u: any) => u.id === approverId)?.name || '' : '',
    };
    
    setPreviewLeave(tempLeave);
    setShowPrintPreview(true);
  };

  const handleDelete = async (leave: LeaveRecord) => {
    const ok = await showConfirm(`Permanently delete leave for ${leave.employeeName}?`, { variant: 'danger' });
    if (!ok) return;
    deleteLeave(leave.id);
    syncEmployeeStatus(leave.employeeId);
    toast.success('Leave record deleted.');
  };

  const handleCancel = async (leave: LeaveRecord) => {
    const ok = await showConfirm(`Cancel leave request for ${leave.employeeName}?`, { confirmLabel: 'Yes, Cancel it' });
    if (!ok) return;
    updateLeave(leave.id, { status: 'Cancelled' });
    syncEmployeeStatus(leave.employeeId);
    toast.success('Leave cancelled.');
  };

  /* ── file upload ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, leaveId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (leaveId) {
        updateLeave(leaveId, { uploadedFile: base64, uploadedFileName: file.name });
        toast.success('File uploaded and saved.');
      } else {
        setUploadedFile(base64);
        setUploadedFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  /* ── print ── */
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Staff Leave Application Form</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: white; }
        .a4-page { width: 210mm; min-height: 297mm; padding: 20mm 18mm; page-break-after: always; }
        .a4-page:last-child { page-break-after: auto; }
        .logo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .logo-header img { height: 52px; }
        .form-title { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 12px 0 20px; letter-spacing: 0.6px; border-bottom: 2px solid #111; padding-bottom: 6px; }
        .section-heading { font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 16px 0 8px; padding: 3px 6px; background: #f0f0f0; border-left: 3px solid #333; }
        .field-row { margin-bottom: 11px; display: flex; align-items: flex-end; gap: 8px; }
        .field-label { font-size: 10px; white-space: nowrap; flex-shrink: 0; }
        .field-line { border-bottom: 1px solid #111; flex: 1; height: 15px; display: inline-block; font-size: 10px; }
        .reason-box { border: 1px solid #111; min-height: 48px; width: 100%; margin-top: 4px; padding: 3px; font-size: 10px; }
        .checkbox-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; font-size: 10px; }
        .checkbox-row span { display: flex; align-items: center; gap: 3px; margin-right: 8px; }
        .two-col-sig { display: flex; gap: 24px; }
        .two-col-sig .col { flex: 1; }
        .sig-row { display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-end; }
        .sig-row .label { font-size: 10px; flex-shrink: 0; white-space: nowrap; }
        .sig-row .sig-line { flex: 1; border-bottom: 1px solid #111; height: 14px; }
        .approval-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 6px; font-size: 10px; }
        .approval-row .line { border-bottom: 1px solid #111; height: 14px; flex: 1; }
        .divider { border-top: 1px solid #555; margin: 16px 0; }
        .hr-title { font-size: 10px; font-weight: bold; margin-bottom: 8px; }
        .ack-text { font-size: 10px; line-height: 1.7; margin-bottom: 8px; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .a4-page { page-break-after: always; }
          .a4-page:last-child { page-break-after: auto; }
        }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  const openPrintPreview = (leave: LeaveRecord) => {
    setPreviewLeave(leave);
    setShowPrintPreview(true);
  };

  /* ─────────────────────────────── render ──── */
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-teal-400">
            Staff Leave Management
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">File, track, and manage employee leave requests.</p>
        </div>
        <div className="flex gap-3">
          {priv.canViewSummary && (
            <Button
              variant="outline"
              className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
              onClick={() => navigate('/leave-summary')}
            >
              <CalendarClock className="h-4 w-4" /> Go to Summary
            </Button>
          )}
          {priv.canAdd && (
            <Button
              className="gap-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-md"
              onClick={() => { resetForm(); setShowForm(true); }}
            >
              <Plus className="h-4 w-4" /> File Leave Entry
            </Button>
          )}
        </div>
      </div>

      {/* ── Leave Form Overlay ── */}
      {showForm && (
        <Card className="border-none shadow-2xl ring-1 ring-black/5 bg-white relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10 w-full max-w-2xl mx-auto">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-400" />
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 pt-6 px-6 sm:px-8 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-teal-500" />
                {formId ? 'Edit Leave Form' : 'New Leave Form'}
              </CardTitle>
              <CardDescription className="mt-1">Fill out this form to log an employee absence.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => { setShowForm(false); resetForm(); }}>
              <X className="h-5 w-5 text-slate-500" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Staff Selector */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff <span className="text-rose-500">*</span></label>
                <select
                  className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={staffId} onChange={e => setStaffId(e.target.value)} disabled={!!formId}
                >
                  <option value="" disabled>— Select Staff Member —</option>
                  {internalEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} ({emp.department})</option>
                  ))}
                </select>
              </div>

              {/* Leave Type */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Leave Type <span className="text-rose-500">*</span></label>
                <select
                  className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={leaveType} onChange={e => setLeaveType(e.target.value)}
                >
                  <option value="" disabled>— Select Leave Type —</option>
                  {(() => {
                    const DEFAULT_LEAVE_TYPES = ['Annual', 'Emergency', 'Maternity/Paternity', 'Study', 'Others'];
                    const extras = leaveTypes.filter(t => !DEFAULT_LEAVE_TYPES.includes(t));
                    return [...DEFAULT_LEAVE_TYPES, ...extras].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ));
                  })()}
                </select>
              </div>

              {/* Supervisor / Line Manager - auto-filled from employee record */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Supervisor / Line Manager</label>
                {(() => {
                  const selectedEmp = internalEmployees.find(e => e.id === staffId);
                  const lineManagerEmp = selectedEmp?.lineManager
                    ? internalEmployees.find(e => e.id === selectedEmp.lineManager)
                    : null;
                  const lineManagerName = lineManagerEmp
                    ? `${lineManagerEmp.surname} ${lineManagerEmp.firstname} (${lineManagerEmp.position})`
                    : '';
                  return (
                    <div className={`flex h-11 w-full items-center rounded-md border px-3 text-sm ${
                      lineManagerName
                        ? 'border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed'
                        : 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      {lineManagerName || (staffId ? 'No line manager set for this employee' : '— Select staff first —')}
                    </div>
                  );
                })()}
              </div>

              {/* Management / Approver */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Management / Approver <span className="text-rose-500">*</span></label>
                {formId && approverId ? (
                  <div className="flex h-11 w-full items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 cursor-not-allowed">
                     {approverOptions.find((u: any) => u.id === approverId)?.name || 'Unknown'}
                  </div>
                ) : (
                  <select
                    className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
                    value={approverId} onChange={e => setApproverId(e.target.value)} disabled={!!formId}
                  >
                    <option value="">— Select Approver —</option>
                    {approverOptions.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dates */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Start of Leave <span className="text-rose-500">*</span></label>
                <Input type="date" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-teal-500/30" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration (Days) <span className="text-rose-500">*</span></label>
                <Input type="number" min="1" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-teal-500/30" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 5" />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Expected End of Leave</label>
                <Input className="h-11 bg-slate-100 border-slate-200 text-slate-500 font-medium cursor-not-allowed" value={expectedEndDate} disabled readOnly placeholder="Auto-calculated..." />
              </div>

              {/* Reason */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason for Leave <span className="text-rose-500">*</span></label>
                <textarea
                  className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 p-3 h-24 focus:bg-white focus:ring-2 focus:ring-teal-500/20 outline-none transition-all resize-none"
                  value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter details..."
                />
              </div>

              {/* Return Date + Contactable */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  Date Returned <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-700 text-[10px] font-bold">OPTIONAL</span>
                </label>
                <Input type="date" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-teal-500/30" value={dateReturned} onChange={e => setDateReturned(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Can be contacted?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="radio" className="accent-teal-600 w-4 h-4" checked={canBeContacted === 'Yes'} onChange={() => setCanBeContacted('Yes')} /> Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="radio" className="accent-teal-600 w-4 h-4" checked={canBeContacted === 'No'} onChange={() => setCanBeContacted('No')} /> No
                  </label>
                </div>
              </div>

              {/* File Upload */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Upload Leave Form (JPG / PDF)</label>
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all">
                  <Upload className="h-5 w-5 text-teal-500" />
                  <span className="text-sm text-slate-600">
                    {uploadedFileName ? <span className="font-semibold text-teal-700">{uploadedFileName}</span> : 'Click to upload a signed leave form'}
                  </span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleFileUpload(e)} />
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 font-medium sm:mr-auto h-11" onClick={resetForm}>Clear Form</Button>
              <Button variant="outline" className="text-slate-600 h-11" onClick={() => setShowForm(false)}>View Entries</Button>
              <Button onClick={handlePreviewCurrentForm} className="bg-slate-800 hover:bg-slate-900 text-white font-semibold h-11 px-6 shadow-sm gap-2">
                <Printer className="h-4 w-4" /> Preview Form
              </Button>
              <Button onClick={handleCreateOrUpdate} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold h-11 px-8 shadow-md gap-2">
                <FileText className="h-4 w-4" /> {formId ? 'Update Entry' : 'Submit for Approval'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Leave Records Table ─── */}
      <Card className="border-none shadow-sm overflow-hidden bg-white flex-1 flex flex-col min-h-[500px]">
        <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 text-sm">Leave Records <span className="text-slate-400 font-normal">({filteredLeaves.length})</span></p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 p-1 rounded-lg">
              {(['All', 'Active', 'Completed', 'Cancelled'] as const).map(tab => (
                <button
                  key={tab}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${filterView === tab ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setFilterView(tab)}
                >{tab}</button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search staff or reason..." className="pl-9 bg-white border-slate-200 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-teal-700 border-b border-teal-800 text-teal-50 uppercase text-[11px] tracking-wider font-bold">
                <th className="px-5 py-4 whitespace-nowrap">Name</th>
                <th className="px-5 py-4 whitespace-nowrap">Leave Type</th>
                <th className="px-5 py-4 whitespace-nowrap">Start</th>
                <th className="px-5 py-4 whitespace-nowrap">Days</th>
                <th className="px-5 py-4 whitespace-nowrap">Expected End</th>
                <th className="px-5 py-4 whitespace-nowrap">Returned</th>
                <th className="px-5 py-4 min-w-[200px]">Reason</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Contact</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Approver</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Approval</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Status</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">File</th>
                <th className="px-5 py-4 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border">
                        <CalendarDays className="h-5 w-5 text-slate-400" />
                      </div>
                      <p>No leave records found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeaves.map(leave => (
                  <tr key={leave.id} className={`hover:bg-slate-50/80 transition-colors group ${leave.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-4 font-bold text-slate-800 uppercase text-xs">{leave.employeeName}</td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2 py-1 text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-full whitespace-nowrap">
                        {leave.leaveType || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-600 whitespace-nowrap">
                      {leave.startDate ? format(parseISO(leave.startDate), 'dd-MMM-yy') : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-700">{leave.duration}</td>
                    <td className="px-5 py-4 font-medium text-slate-600 whitespace-nowrap">
                      {leave.expectedEndDate ? format(parseISO(leave.expectedEndDate), 'dd-MMM-yy') : '—'}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-600 whitespace-nowrap">
                      {leave.dateReturned ? format(parseISO(leave.dateReturned), 'dd-MMM-yy') : '—'}
                    </td>
                    <td className="px-5 py-4 max-w-xs text-slate-700 text-xs">{leave.reason}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-xs font-bold ${leave.canBeContacted === 'Yes' ? 'text-teal-600' : 'text-slate-400'}`}>{leave.canBeContacted}</span>
                    </td>
                    {/* Approver column */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {leave.approvedByName ? (
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-600">
                          {leave.approvalStatus === 'Approved'
                            ? <ShieldCheck className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            : leave.approvalStatus === 'Rejected'
                            ? <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            : <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                          {leave.approvedByName}
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    {/* Approval Status column */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {leave.approvalStatus === 'Approved' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Approved</Badge>
                      ) : leave.approvalStatus === 'Rejected' ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Rejected</Badge>
                      ) : leave.approvalStatus === 'Pending' ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Pending</Badge>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <Badge className={
                        leave.status === 'Cancelled' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        leave.dateReturned ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      } variant="outline">
                        {leave.status === 'Cancelled' ? 'Cancelled' : leave.dateReturned ? 'Completed' : 'On Leave'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {leave.uploadedFile ? (
                        <button
                          className="text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 mx-auto text-xs font-semibold"
                          onClick={() => setFilePreviewLeave(leave)}
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
                      ) : (
                        <label className="cursor-pointer text-slate-400 hover:text-teal-600 flex items-center justify-center gap-1 mx-auto text-xs font-semibold transition-colors">
                          <Upload className="h-4 w-4" /> Upload
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleFileUpload(e, leave.id)} />
                        </label>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-teal-700 hover:bg-teal-50" title="Print Preview" onClick={() => openPrintPreview(leave)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        {priv.canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit" onClick={() => handleEdit(leave)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {priv.canEdit && leave.status !== 'Cancelled' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Cancel Leave" onClick={() => handleCancel(leave)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {priv.canDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete (Admin only)" onClick={() => handleDelete(leave)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>



      {/* ─── Print Preview Modal ─── */}
      {showPrintPreview && previewLeave && (() => {
        const lv = previewLeave;
        const emp = employees.find(e => e.id === lv.employeeId);
        const leaveTypeOptions = ['Annual', 'Emergency', 'Maternity/Paternity', 'Study', 'Others'];
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-teal-600" /> Staff Annual Leave Application Form — Preview
                </h2>
                <div className="flex gap-2">
                  <Button onClick={handlePrint} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 h-9 text-sm">
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowPrintPreview(false)}>
                    <X className="h-5 w-5 text-slate-500" />
                  </Button>
                </div>
              </div>

              {/* Scrollable preview area — two A4 sheets */}
              <div className="overflow-y-auto flex-1 bg-gray-300 p-6 flex flex-col gap-6">
                <div ref={printRef}>

                  {/* â•â•â•â•â•â•â•â•â•â• PAGE 1 â•â•â•â•â•â•â•â•â•â• */}
                  <div className="a4-page bg-white shadow-lg mx-auto" style={{ width: 794, minHeight: 1123, padding: '40px 48px', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#111' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <img src="/logo/logo-2.png" alt="logo" style={{ height: 52 }} />
                      <img src="/logo/logo-2.png" alt="logo" style={{ height: 52, opacity: 0 }} />
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', margin: '10px 0 20px', letterSpacing: '0.6px', borderBottom: '2px solid #111', paddingBottom: 6 }}>STAFF ANNUAL LEAVE APPLICATION FORM</div>

                    {/* 1. Employee Details */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, padding: '3px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>1. Employee Details</div>
                    {[['Employee Full Name', lv.employeeName], ['Supervisor / Line Manager', lv.supervisor || ''], ['Management Staff', lv.management || '']].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 11 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
                        <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15, fontSize: 10, paddingBottom: 1 }}>{val}</span>
                      </div>
                    ))}

                    {/* Phone & Email */}
                    {[['Phone Number', ''], ['Email Address', '']].map(([label]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 11 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
                        <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                      </div>
                    ))}

                    {/* 2. Leave Details */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '16px 0 8px', padding: '3px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>2. Leave Details</div>
                    <div style={{ fontSize: 10, marginBottom: 6 }}>Type of Leave:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {leaveTypeOptions.map(opt => {
                        const matched = (lv.leaveType || '').toLowerCase().includes(opt.toLowerCase());
                        return (
                          <span key={opt} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                            <span style={{ width: 11, height: 11, border: '1px solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: matched ? '#111' : 'white', color: 'white', fontSize: 8 }}>{matched ? '✓' : ''}</span>
                            {opt}
                          </span>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: 10, marginBottom: 4 }}>Reason For Leave:</div>
                    <div contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ border: '1px solid #111', minHeight: 56, padding: 4, fontSize: 10, marginBottom: 12 }}>{lv.reason}</div>

                    {[['Leave Start Date', lv.startDate ? format(parseISO(lv.startDate), 'dd/MM/yyyy') : ''], ['Leave End Date', lv.expectedEndDate ? format(parseISO(lv.expectedEndDate), 'dd/MM/yyyy') : ''], ['Date Returning to Work', lv.dateReturned ? format(parseISO(lv.dateReturned), 'dd/MM/yyyy') : '']].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 11 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
                        <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15, fontSize: 10, paddingBottom: 1 }}>{val}</span>
                      </div>
                    ))}

                    {/* 3. Handover Details */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '16px 0 8px', padding: '3px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>3. Handover Details</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 11 }}>
                      <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Person Responsible During Absence:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                    </div>
                    <div style={{ fontSize: 10, marginBottom: 4 }}>Key Duties Handed Over:</div>
                    {[1, 2, 3].map(i => (
                      <div key={i} contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', marginBottom: 10, minHeight: 15 }}></div>
                    ))}

                    {/* 5. Contact During Leave */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '16px 0 8px', padding: '3px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>5. Contact During Leave</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10 }}>
                      <span>Can be Contacted:</span>
                      {(['Yes', 'No'] as const).map(opt => (
                        <span key={opt} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 11, height: 11, border: '1px solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: lv.canBeContacted === opt ? '#111' : 'white', color: 'white', fontSize: 8 }}>{lv.canBeContacted === opt ? '✓' : ''}</span>
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* â•â•â•â•â•â•â•â•â•â• PAGE 2 â•â•â•â•â•â•â•â•â•â• */}
                  <div className="a4-page bg-white shadow-lg mx-auto" style={{ width: 794, minHeight: 1123, padding: '40px 48px', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#111' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <img src="/logo/logo-2.png" alt="logo" style={{ height: 52 }} />
                      <div style={{ fontSize: 10, color: '#555', textAlign: 'right' }}>Staff Annual Leave Application Form — Page 2</div>
                    </div>
                    <div style={{ borderBottom: '2px solid #111', marginBottom: 24 }} />

                    {/* 6. Signatures */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, padding: '3px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>6. Signatures</div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 10, flexShrink: 0 }}>Employee Signature:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 2, minHeight: 15 }}></span>
                      <span style={{ fontSize: 10, flexShrink: 0 }}>Date:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                    </div>

                    {(["Supervisor's", "Management's"] as const).map(who => (
                      <div key={who} style={{ marginBottom: 16, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 8 }}>
                          <span style={{ flexShrink: 0 }}>{who} Approval:</span>
                          <span>Approved</span>
                          <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14 }}></span>
                          <span style={{ flexShrink: 0 }}>Not Approved</span>
                          <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14 }}></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 10 }}>
                          <span style={{ flexShrink: 0 }}>{who.replace("'s", '')} Signature:</span>
                          <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 2, minHeight: 15 }}></span>
                          <span style={{ fontSize: 10, flexShrink: 0 }}>Date:</span>
                          <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                        </div>
                      </div>
                    ))}

                    {/* HR Section */}
                    <div style={{ borderTop: '1px solid #555', margin: '24px 0 12px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 10 }}>To be Completed by Human Resources</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 11, fontSize: 10 }}>
                      <span style={{ flexShrink: 0 }}>Leave approved from:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                      <span style={{ flexShrink: 0 }}>to</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                    </div>
                    {[['Human Resource & Admin Manager', ''], ['Date', '']].map(([label]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 11, fontSize: 10 }}>
                        <span style={{ flexShrink: 0 }}>{label}:</span>
                        <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                      </div>
                    ))}

                    {/* Leave Acknowledgement */}
                    <div style={{ borderTop: '1px solid #555', margin: '24px 0 12px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 10 }}>Leave Acknowledgement:</div>
                    <div style={{ fontSize: 10, lineHeight: 1.7, marginBottom: 10 }}>
                      I <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', display: 'inline-block', minWidth: 120, marginBottom: -2 }}>&nbsp;</span> hereby notify the Human Resources and Administrative department that I have resumed duty as of:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 10, marginBottom: 14 }}>
                      <span style={{ flexShrink: 0 }}>Employee's Signature:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 2, minHeight: 15 }}></span>
                      <span style={{ flexShrink: 0 }}>Date:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 10 }}>
                      <span style={{ flexShrink: 0 }}>Head of Dept/Line Manager Signature:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 2, minHeight: 15 }}></span>
                      <span style={{ flexShrink: 0 }}>Date:</span>
                      <span contentEditable suppressContentEditableWarning className="outline-none hover:bg-slate-200/50 cursor-text" style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 15 }}></span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Uploaded File Preview Modal ─── */}
      {filePreviewLeave && filePreviewLeave.uploadedFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setFilePreviewLeave(null)}>
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" /> {filePreviewLeave.uploadedFileName || 'Uploaded File'}
              </h2>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFilePreviewLeave(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-100">
              {filePreviewLeave.uploadedFile.startsWith('data:image') ? (
                <img src={filePreviewLeave.uploadedFile} alt="Uploaded leave form" className="max-w-full max-h-[70vh] rounded-lg shadow-lg" />
              ) : (
                <iframe src={filePreviewLeave.uploadedFile} className="w-full h-[70vh] rounded-lg border border-slate-200" title="PDF Preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

