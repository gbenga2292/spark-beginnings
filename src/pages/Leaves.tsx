
import { useState, useMemo, useRef } from 'react';
import logoSrc from '/logo/logo-2.png';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { CalendarDays, CheckCircle2, Printer, Eye, X, Plus, Edit, Trash2, Ban, Search, ListFilter, CalendarClock, FileText, ShieldCheck, Clock, XCircle, MoreVertical, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { useAppStore, LeaveRecord } from '@/src/store/appStore';
import { useNavigate } from 'react-router-dom';
import { usePriv } from '@/src/hooks/usePriv';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { parseISO, format, isWithinInterval } from 'date-fns';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { filterAndSortEmployeesExcludingCEO, getPositionIndex } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { addWorkDays } from '@/src/lib/workdays';

/* ─────────────────────────────────── helpers ─── */

function isOnLeave(leave: LeaveRecord, date: Date): boolean {
  if (leave.status === 'Cancelled') return false;
  if (leave.dateReturned) return false; // Employee has already returned — not on leave
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
    leaveTypes, updateEmployee, departments, publicHolidays
  } = useAppStore();

  // Approver options — all active system users
  const approverOptions = users.filter((u: any) => !u.isDeleted);

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('leaves');

  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === 'Active' || e.status === 'On Leave'),
    [employees]
  );

  // All permanent/regular staff (no Adhoc, no Non-Employee) – used for Staff dropdowns and Leave Summary
  const internalEmployees = useMemo(() => {
    const filtered = activeEmployees.filter(e => e.staffType === 'FIELD' || e.staffType === 'OFFICE');
    return filterAndSortEmployeesExcludingCEO(filtered);
  }, [activeEmployees]);

  /* ── filter state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('All');

  /* ── form state ── */
  
  const [formId, setFormId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [dateReturned, setDateReturned] = useState('');
  const [canBeContacted, setCanBeContacted] = useState<'Yes' | 'No'>('No');
  const [supervisor, setSupervisor] = useState('');
  const [nasFilePath, setNasFilePath] = useState<string>('');
  const [approverId, setApproverId] = useState('');

  /* ── preview form editable state (savable) ── */
  const [previewPersonResponsibleId, setPreviewPersonResponsibleId] = useState('');
  const [previewKeyDuties, setPreviewKeyDuties] = useState<[string, string, string]>(['', '', '']);
  const [previewEmpSigStatus, setPreviewEmpSigStatus] = useState<'Signed' | 'Unsigned'>('Unsigned');
  const [previewEmpSigDate, setPreviewEmpSigDate] = useState('');
  const [previewSupSigStatus, setPreviewSupSigStatus] = useState<'Signed' | 'Unsigned'>('Unsigned');
  const [previewSupSigDate, setPreviewSupSigDate] = useState('');
  const [previewMgmtSigStatus, setPreviewMgmtSigStatus] = useState<'Signed' | 'Unsigned'>('Unsigned');
  const [previewMgmtSigDate, setPreviewMgmtSigDate] = useState('');
  const [previewHrFrom, setPreviewHrFrom] = useState('');
  const [previewHrTo, setPreviewHrTo] = useState('');
  const [previewHrSigStatus, setPreviewHrSigStatus] = useState<'Signed' | 'Unsigned'>('Unsigned');
  const [previewHrSigDate, setPreviewHrSigDate] = useState('');
  const [previewFormDateReturned, setPreviewFormDateReturned] = useState('');

  // Calculate if form is locked due to leave start date reached
  const isStartDateReached = !!formId && !!startDate && new Date(startDate).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0);
  const hasAllPermissions = priv.canAdd && priv.canEdit && priv.canDelete;
  const isFormLockedForUser = isStartDateReached && !hasAllPermissions;

  /* ── print / preview state ── */
  const [showFormOverlay, setShowFormOverlay] = useState(false);
  const [previewLeaveFormNumber, setPreviewLeaveFormNumber] = useState('');
  const printRef = useRef<HTMLDivElement>(null);


  const expectedEndDate = useMemo(() => {
    const holidayDates = (publicHolidays || []).map((h: any) => h.date);
    const selectedEmp = activeEmployees.find(e => e.id === staffId);
    const selectedDept = departments.find(d => d.name === selectedEmp?.department);
    const workDays = selectedDept?.workDaysPerWeek || 5;
    return addWorkDays(startDate, parseInt(duration) || 0, holidayDates, workDays);
  }, [startDate, duration, publicHolidays, staffId, activeEmployees, departments]);

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
    setSupervisor(''); setApproverId(''); setNasFilePath('');
  };

  const resetPreviewFormState = (leave?: LeaveRecord | null) => {
    setPreviewLeaveFormNumber(leave?.leaveNumber || '');
    setPreviewPersonResponsibleId(leave?.personResponsibleId || '');
    const kd = leave?.keyDuties || [];
    setPreviewKeyDuties([kd[0]||'', kd[1]||'', kd[2]||'']);
    setPreviewEmpSigStatus(leave?.employeeSignature?.signed || 'Unsigned');
    setPreviewEmpSigDate(leave?.employeeSignature?.date || '');
    setPreviewSupSigStatus(leave?.supervisorSignature?.signed || 'Unsigned');
    setPreviewSupSigDate(leave?.supervisorSignature?.date || '');
    setPreviewMgmtSigStatus(leave?.managementSignature?.signed || 'Unsigned');
    setPreviewMgmtSigDate(leave?.managementSignature?.date || '');
    setPreviewHrFrom(leave?.hrApprovedFrom || '');
    setPreviewHrTo(leave?.hrApprovedTo || '');
    setPreviewHrSigStatus(leave?.hrSignature?.signed || 'Unsigned');
    setPreviewHrSigDate(leave?.hrSignature?.date || '');
    setPreviewFormDateReturned(leave?.formDateReturned || '');
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
    setNasFilePath(leave.nasFilePath || '');
    resetPreviewFormState(leave);
    setShowFormOverlay(true);
  };

  /* auto-sync employee status when a leave is added/updated */
  const syncEmployeeStatus = (empId: string) => {
    const today = new Date();
    const currentState = useAppStore.getState();
    const currentLeaves = currentState.leaves;
    const currentEmployees = currentState.employees;

    const empActiveLeaves = currentLeaves.filter(
      l => l.employeeId === empId && l.status !== 'Cancelled' && isOnLeave(l, today)
    );
    const emp = currentEmployees.find(e => e.id === empId);
    if (!emp) return;
    const shouldBeOnLeave = empActiveLeaves.length > 0;
    if (shouldBeOnLeave && emp.status !== 'On Leave') currentState.updateEmployee(empId, { status: 'On Leave' });
    if (!shouldBeOnLeave && emp.status === 'On Leave') currentState.updateEmployee(empId, { status: 'Active' });
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
      const existing = leaves.find(l => l.id === formId);
      let nextLeaveNumber = existing?.leaveNumber || previewLeaveFormNumber;
      if (!nextLeaveNumber && startDate) {
        const dateObj = new Date(startDate);
        if (!isNaN(dateObj.getTime())) {
          const yy = format(dateObj, 'yy');
          const mm = format(dateObj, 'MM');
          const leavesInMonth = leaves.filter(l => {
            const d = new Date(l.startDate);
            return !isNaN(d.getTime()) && format(d, 'yy-MM') === `${yy}-${mm}`;
          });
          let maxSeq = 0;
          leavesInMonth.forEach(l => {
            if (l.leaveNumber && l.leaveNumber.startsWith(`LA${yy}-${mm}-`)) {
              const seqStr = l.leaveNumber.split('-')[2];
              const seq = parseInt(seqStr, 10);
              if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
          });
          nextLeaveNumber = `LA${yy}-${mm}-${String(maxSeq + 1).padStart(2, '0')}`;
        }
      }

      updateLeave(formId, {
        leaveType, startDate, duration: parseInt(duration),
        expectedEndDate: endDate, reason,
        // Merge form's date returned into the main dateReturned field
        dateReturned: previewFormDateReturned || dateReturned,
        canBeContacted,
        nasFilePath, supervisor, management: approverName,
        approvedById: approverId || undefined,

        personResponsibleId: previewPersonResponsibleId,
        keyDuties: previewKeyDuties as any,
        formDateReturned: previewFormDateReturned,
        employeeSignature: { signed: previewEmpSigStatus, date: previewEmpSigDate },
        supervisorSignature: { signed: previewSupSigStatus, date: previewSupSigDate },
        managementSignature: { signed: previewMgmtSigStatus, date: previewMgmtSigDate },
        hrSignature: { signed: previewHrSigStatus, date: previewHrSigDate },
        hrApprovedFrom: previewHrFrom,
        hrApprovedTo: previewHrTo,
        leaveNumber: nextLeaveNumber
      });
      toast.success('Leave entry updated!');
      setTimeout(() => syncEmployeeStatus(staffId), 100);
      setShowFormOverlay(false);
    } else {
      if (!approverId) {
        toast.error('Please select an approver before submitting.');
        return;
      }

      let nextLeaveNumber = '';
      if (startDate) {
        const dateObj = new Date(startDate);
        if (!isNaN(dateObj.getTime())) {
          const yy = format(dateObj, 'yy');
          const mm = format(dateObj, 'MM');
          const leavesInMonth = leaves.filter(l => {
            const d = new Date(l.startDate);
            return !isNaN(d.getTime()) && format(d, 'yy-MM') === `${yy}-${mm}`;
          });
          let maxSeq = 0;
          leavesInMonth.forEach(l => {
            if (l.leaveNumber && l.leaveNumber.startsWith(`LA${yy}-${mm}-`)) {
              const seqStr = l.leaveNumber.split('-')[2];
              const seq = parseInt(seqStr, 10);
              if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
          });
          nextLeaveNumber = `LA${yy}-${mm}-${String(maxSeq + 1).padStart(2, '0')}`;
        }
      }

      // Resolve HoD: highest-ranked employee in same dept (lowest index = most senior)
      const empDept = emp.department;
      const deptPeers = employees.filter(e => e.department === empDept && e.id !== staffId && e.status === 'Active' && e.position !== 'CEO');
      const hodEmp = deptPeers.sort((a, b) => getPositionIndex(a.position) - getPositionIndex(b.position))[0];

      // Find if line manager is a system user
      const lmEmp = emp.lineManager ? employees.find(e => e.id === emp.lineManager) : null;
      const lmSystemUser = lmEmp ? approverOptions.find((u: any) =>
        u.name?.toLowerCase().includes(lmEmp.firstname.toLowerCase()) ||
        u.name?.toLowerCase().includes(lmEmp.surname.toLowerCase())
      ) : null;

      const newLeave: LeaveRecord = {
        id: crypto.randomUUID(),
        employeeId: staffId,
        employeeName: empName,
        leaveType, startDate, duration: parseInt(duration),
        expectedEndDate: endDate, reason, dateReturned,
        canBeContacted, status: 'Active',
        nasFilePath, supervisor, management: approverName,
        approvedById: approverId,
        approvedByName: approverName,
        approvalStatus: 'Pending',
        leaveNumber: nextLeaveNumber,
        workflowStep: 1,
        hodEmployeeId: hodEmp?.id,

        personResponsibleId: previewPersonResponsibleId,
        keyDuties: previewKeyDuties as any,
        formDateReturned: previewFormDateReturned,
        employeeSignature: { signed: previewEmpSigStatus, date: previewEmpSigDate },
        hrApprovedFrom: previewHrFrom,
        hrApprovedTo: previewHrTo,
      };
      addLeave(newLeave);
      setTimeout(() => syncEmployeeStatus(staffId), 100);

      try {
        const today430 = new Date();
        today430.setHours(16, 30, 0, 0);

        // Create the main approval task (parent)
        const mainTask = await createMainTask({
          title: `Leave Approval Workflow — ${empName} (${leaveType}, ${duration} days)`,
          description: `Sequential 4-step approval: LM → HoD → Management → HR.\nSubmitted by ${currentUser?.user_metadata?.name || 'HR'} on ${format(new Date(), 'dd/MM/yyyy')}.`,
          createdBy: currentUser?.id,
          teamId: 'dcel-team',
          workspaceId: 'dcel-team',
          assignedTo: lmSystemUser?.id || approverId,
          deadline: today430.toISOString(),
        });

        if (mainTask?.id) {
          // Step 1: Line Manager subtask
          const lmDesc = JSON.stringify({
            refType: 'leave',
            refId: newLeave.id,
            workflowStep: 1,
            empName,
            leaveType,
            duration,
            hodUserId: hodEmp?.id,  // pass HoD so step 1 approval can create step 2
          });
          const lmSub = await addSubtask({
            title: `[Step 1/4] Line Manager Approval — ${empName} ${leaveType} Leave`,
            description: lmDesc,
            mainTaskId: mainTask.id,
            assignedTo: lmSystemUser?.id || null,
            status: 'not_started',
            priority: 'high',
            deadline: today430.toISOString(),
          });
          if ((lmSub as any)?.id) {
            updateLeave(newLeave.id, {
              approvalTaskId: mainTask.id,
              lineManagerTaskId: (lmSub as any).id,
            });
          }
        }
      } catch (e) {
        console.error('Failed to create leave approval task:', e);
      }

      toast.success(`Leave filed! Step 1 of 4 — awaiting Line Manager approval.`);
      setShowFormOverlay(false);
    }
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

  /* ── NAS file path picker ── */
  const handleNasFileSelect = (e: React.ChangeEvent<HTMLInputElement>, leaveId?: string) => {
    // We only capture the file name/path — no base64 encoding.
    // On Windows/NAS the `e.target.value` gives the local/UNC path entered by the user.
    // Using a regular text input for the path keeps us storage-safe.
    const path = e.target.value;
    if (leaveId) {
      updateLeave(leaveId, { nasFilePath: path });
      toast.success('NAS file path saved.');
    } else {
      setNasFilePath(path);
    }
  };

  /* Open NAS file from stored path */
  const handleOpenNasFile = (path: string) => {
    if (!path) return;
    // On company PCs a UNC path like \\server\folder\file.pdf opens in Windows Explorer
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  /* Save the preview form's signature & detail data back to the leave record */
  /* ── print ── */
  const handlePrint = (emptySignatures = false) => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Staff Leave Application Form</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: white; }
        .a4-page { width: 210mm; padding: 20mm 18mm; break-after: page; }
        .a4-page:last-of-type { break-after: auto; }
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
        .hide-on-print { display: none !important; }
        .show-on-print { display: inline-block !important; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .a4-page { break-after: page; }
          .a4-page:last-of-type { break-after: auto; }
        }
        ${emptySignatures === true ? `
          .sig-value, .sig-date { display: none !important; }
          .sig-empty-dash { display: inline-block !important; }
        ` : `
          .sig-empty-dash { display: none !important; }
        `}
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  const openPrintPreview = (leave: LeaveRecord) => {
    handleEdit(leave);
  };

  useSetPageTitle(
    'Staff Leave Management',
    'File, track, and manage employee leave requests',
    <div className="hidden sm:flex items-center gap-2">
      {priv.canViewSummary && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9"
          onClick={() => navigate('/leave-summary')}
        >
          <CalendarClock className="h-4 w-4" /> Summary
        </Button>
      )}
      {priv.canAdd && (
        <Button
          size="sm"
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white h-9"
          onClick={() => { resetForm(); resetPreviewFormState(); setShowFormOverlay(true); }}
        >
          <Plus className="h-4 w-4" /> File Leave
        </Button>
      )}
    </div>
  );

  /* ─────────────────────────────── render ──── */
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

      {/* ── Mobile Actions ── */}
      <div className="flex sm:hidden flex-wrap gap-2 px-1">
        {priv.canAdd && (
          <Button
            className="flex-1 gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            onClick={() => { resetForm(); resetPreviewFormState(); setShowFormOverlay(true); }}
          >
            <Plus className="h-4 w-4" /> File Leave
          </Button>
        )}
        {priv.canViewSummary && (
          <Button
            variant="outline"
            className="flex-1 gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 shadow-sm"
            onClick={() => navigate('/leave-summary')}
          >
            <CalendarClock className="h-4 w-4" /> Summary
          </Button>
        )}
      </div>

      {/* ─── Leave Records Table ─── */}
      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]">
        <div className="border-b border-slate-100 dark:border-slate-800/60 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Leave Records <span className="text-slate-400 dark:text-slate-500 font-normal">({filteredLeaves.length})</span></p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
              {(['All', 'Active', 'Completed', 'Cancelled'] as const).map(tab => (
                <button
                  key={tab}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${filterView === tab ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  onClick={() => setFilterView(tab)}
                >{tab}</button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search staff or reason..." className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-teal-700 border-b border-teal-800 dark:bg-teal-950/40 dark:border-teal-900/40 text-teal-50 dark:text-teal-100 uppercase text-[11px] tracking-wider font-bold">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border dark:border-slate-700/50">
                        <CalendarDays className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="dark:text-slate-400">No leave records found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeaves.map(leave => (
                  <tr key={leave.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${leave.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200 uppercase text-xs">{leave.employeeName}</td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2 py-1 text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/30 rounded-full whitespace-nowrap">
                        {leave.leaveType || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {leave.startDate ? format(parseISO(leave.startDate), 'dd-MMM-yy') : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-200">{leave.duration}</td>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {leave.expectedEndDate ? format(parseISO(leave.expectedEndDate), 'dd-MMM-yy') : '—'}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {leave.dateReturned ? format(parseISO(leave.dateReturned), 'dd-MMM-yy') : '—'}
                    </td>
                    <td className="px-5 py-4 max-w-xs text-slate-700 dark:text-slate-300 text-xs">{leave.reason}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-xs font-bold ${leave.canBeContacted === 'Yes' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`}>{leave.canBeContacted}</span>
                    </td>
                    {/* Approver column */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {leave.approvedByName ? (
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          {leave.approvalStatus === 'Approved'
                            ? <ShieldCheck className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            : leave.approvalStatus === 'Rejected'
                            ? <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            : <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                          {leave.approvedByName}
                        </div>
                      ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {leave.approvalStatus === 'Approved' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30" variant="outline">Approved</Badge>
                      ) : leave.approvalStatus === 'Rejected' ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30" variant="outline">Rejected</Badge>
                      ) : leave.approvalStatus === 'Pending' ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30" variant="outline">Pending</Badge>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {(() => {
                        const isUpcoming = leave.startDate && new Date(leave.startDate).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0);
                        const statusLabel = leave.status === 'Cancelled' ? 'Cancelled' : leave.dateReturned ? 'Completed' : isUpcoming ? 'Upcoming' : 'On Leave';
                        let badgeClass = '';
                        if (statusLabel === 'Cancelled') badgeClass = 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30';
                        else if (statusLabel === 'Completed') badgeClass = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30';
                        else if (statusLabel === 'Upcoming') badgeClass = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30';
                        else badgeClass = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30';

                        return (
                          <Badge className={badgeClass} variant="outline">
                            {statusLabel}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {leave.nasFilePath ? (
                        <button
                          className="text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 mx-auto text-xs font-semibold"
                          onClick={() => handleOpenNasFile(leave.nasFilePath!)}
                        >
                          <Eye className="h-4 w-4" /> Open
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 dark:border-slate-700">
                            <DropdownMenuItem className="text-slate-600 cursor-pointer gap-2" onClick={() => openPrintPreview(leave)}>
                              <Printer className="h-4 w-4" /> Print Preview
                            </DropdownMenuItem>
                            
                            {priv.canEdit && (
                              <DropdownMenuItem className="text-indigo-600 focus:text-indigo-600 cursor-pointer gap-2" onClick={() => handleEdit(leave)}>
                                <Edit className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                            )}

                            {priv.canDelete && leave.status !== 'Cancelled' && (
                              <DropdownMenuItem className="text-amber-600 focus:text-amber-600 cursor-pointer gap-2" onClick={() => handleCancel(leave)}>
                                <Ban className="h-4 w-4" /> Cancel Leave
                              </DropdownMenuItem>
                            )}

                            {priv.canDelete && (
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-600 cursor-pointer gap-2" onClick={() => handleDelete(leave)}>
                                <Trash2 className="h-4 w-4" /> Delete (Admin)
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>



      {/* --- Print Preview Modal --- */}
      {showFormOverlay && (() => {
        const emp = employees.find(e => e.id === staffId);
        const lineManagerEmp = emp?.lineManager ? employees.find(e => e.id === emp.lineManager) : null;
        const lineManagerName = lineManagerEmp
          ? `${lineManagerEmp.surname} ${lineManagerEmp.firstname}`
          : (supervisor || '');
        
        // Resolve live leave record (for workflow step display when viewing existing)
        const liveLeave = formId ? leaves.find(l => l.id === formId) : null;
        const wfStep = liveLeave?.workflowStep ?? (formId ? 1 : 0);
        const wfRejected = wfStep === -1;

        const leaveTypeOptions = ['Annual', 'Emergency', 'Maternity/Paternity', 'Study', 'Others'];
        const isLeaveElapsed = expectedEndDate
          ? new Date(expectedEndDate).setHours(0, 0, 0, 0) <= Date.now()
          : false;
        const isPreviewLocked = (!!formId && isLeaveElapsed && !hasAllPermissions) || isFormLockedForUser;
        const isLocked = isPreviewLocked;

        /** Helper: render a workflow approval row */
        const WfSigRow = ({
          label, stepNum, sigData, isManual = false,
          manualSigned, setManualSigned, manualDate, setManualDate,
        }: {
          label: string; stepNum: number;
          sigData?: { signed: 'Signed' | 'Unsigned'; date?: string };
          isManual?: boolean;
          manualSigned?: 'Signed' | 'Unsigned'; setManualSigned?: (v: 'Signed' | 'Unsigned') => void;
          manualDate?: string; setManualDate?: (v: string) => void;
        }) => {
          const isSigned = sigData?.signed === 'Signed' || manualSigned === 'Signed';
          const sigDate = sigData?.date || manualDate || '';
          const isPendingStep = !wfRejected && wfStep === stepNum && !!formId;
          const isFutureStep = !wfRejected && wfStep < stepNum && !!formId;
          const bgColor = wfRejected ? '#fff1f1' : isSigned ? '#f0fdf4' : isPendingStep ? '#fffbeb' : '#fafafa';
          const borderColor = wfRejected ? '#fca5a5' : isSigned ? '#86efac' : isPendingStep ? '#fcd34d' : '#d1d5db';
          const statusText = wfRejected ? '— Rejected' : isSigned ? 'Signed ✓' : isPendingStep ? 'Awaiting Approval…' : isFutureStep ? 'Pending' : 'Unsigned';
          const statusColor = wfRejected ? '#dc2626' : isSigned ? '#16a34a' : isPendingStep ? '#d97706' : '#9ca3af';

          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10, padding: '5px 8px', background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 'bold', flexShrink: 0, paddingBottom: 1, whiteSpace: 'nowrap' }}>{label}:</span>
              {isManual && !isPreviewLocked ? (
                <select className="sig-value" value={manualSigned} onChange={e => setManualSigned!(e.target.value as 'Signed' | 'Unsigned')}
                  style={{ border: 'none', flex: 1, minHeight: 14, fontSize: 9, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1, color: statusColor, fontWeight: isSigned ? 'bold' : 'normal' }}>
                  <option value="Unsigned">Unsigned</option>
                  <option value="Signed">Signed</option>
                </select>
              ) : (
                <span className="sig-value" style={{ flex: 1, minHeight: 14, fontSize: 9, paddingBottom: 1, color: statusColor, fontWeight: isSigned ? 'bold' : 'normal', fontStyle: isPendingStep ? 'italic' : 'normal' }}>
                  {statusText}
                </span>
              )}
              <span className="sig-empty-dash" style={{ display: 'none', flex: 1, borderBottom: '1px solid #111', minHeight: 14 }}></span>
              <span style={{ fontSize: 9, flexShrink: 0, paddingBottom: 1, marginLeft: 8 }}>Date:</span>
              {isManual && !isPreviewLocked ? (
                <input className="sig-date" type="date" value={manualDate} onChange={e => setManualDate!(e.target.value)}
                  style={{ border: 'none', borderBottom: '1px solid #999', width: 90, fontSize: 9, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1 }} />
              ) : (
                <span className="sig-date" style={{ fontSize: 9, minWidth: 80, paddingBottom: 1, color: '#555' }}>
                  {sigDate ? format(parseISO(sigDate), 'dd/MM/yyyy') : ''}
                </span>
              )}
              <span className="sig-empty-dash" style={{ display: 'none', minWidth: 80, width: 80, borderBottom: '1px solid #111', minHeight: 14 }}></span>
            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
              {/* Modal header */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-teal-600" /> Staff Leave Application Form
                  {isPreviewLocked && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">LOCKED — Leave Elapsed</span>
                  )}
                  {wfRejected && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">REJECTED</span>
                  )}
                  {wfStep === 5 && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">FULLY APPROVED ✓</span>
                  )}
                  {formId && wfStep > 0 && wfStep < 5 && !wfRejected && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Step {wfStep}/4 Pending</span>
                  )}
                </h2>
                <div className="flex gap-2">
                  <button type="button" onClick={handleCreateOrUpdate}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {formId ? 'Update Leave' : 'Submit Application'}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2 h-9 text-sm">
                        <Printer className="h-4 w-4" /> Print <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <DropdownMenuItem onClick={() => handlePrint(false)} className="gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <Printer className="h-4 w-4" /> Normal Print
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrint(true)} className="gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <FileText className="h-4 w-4" /> Print (Empty Signatures)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowFormOverlay(false)}>
                    <X className="h-5 w-5 text-slate-500" />
                  </Button>
                </div>
              </div>

              {/* Scrollable A4 area */}
              <div className="overflow-y-auto flex-1 bg-gray-300 p-6 flex flex-col gap-6">
                <div ref={printRef}>
                  <div className="a4-page bg-white shadow-lg mx-auto" style={{ width: 794, padding: '12px 24px 16px', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#111' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <img src={logoSrc} alt="logo" style={{ height: 44, objectFit: 'contain' }} />
                      <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 'bold' }}>
                        Form No: {previewLeaveFormNumber || 'Unassigned'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', margin: '4px 0 8px', letterSpacing: '0.6px', borderBottom: '2px solid #111', paddingBottom: 4 }}>STAFF LEAVE APPLICATION FORM</div>

                    {/* 1. Employee Details - auto-populated */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, padding: '2px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>1. Employee Details</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Employee Full Name:</span>
                      {isLocked ? (
                        <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>{emp?.surname} {emp?.firstname}</span>
                      ) : (
                        <>
                          <select className="hide-on-print" value={staffId} onChange={e => setStaffId(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', paddingBottom: 1, appearance: 'none' }}>
                            <option value="">Select Staff...</option>
                            {internalEmployees.map((e: any) => (
                              <option key={e.id} value={e.id}>{e.surname} {e.firstname}</option>
                            ))}
                          </select>
                          <span className="show-on-print" style={{ display: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>
                            {emp ? `${emp.surname} ${emp.firstname}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                    {([
                      ['Supervisor / Line Manager', lineManagerName],
                      ['Phone Number', emp?.phone || ''],
                      ['Email Address', emp?.email || ''],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 7 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}:</span>
                        <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Management Staff:</span>
                      {isLocked ? (
                        <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>{approverOptions.find((u: any) => u.id === approverId)?.name || ''}</span>
                      ) : (
                        <>
                          <select className="hide-on-print" value={approverId} onChange={e => setApproverId(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', paddingBottom: 1, appearance: 'none', cursor: 'pointer' }}>
                            <option value="">Select Approver...</option>
                            {approverOptions.map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <span className="show-on-print" style={{ display: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>
                            {approverId ? approverOptions.find((u: any) => u.id === approverId)?.name : ''}
                          </span>
                        </>
                      )}
                    </div>

                    {/* 2. Leave Details */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '10px 0 6px', padding: '2px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>2. Leave Details</div>
                    <div style={{ fontSize: 10, marginBottom: 6 }}>Type of Leave:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {leaveTypeOptions.map(opt => {
                        const matched = (leaveType || '').toLowerCase().includes(opt.toLowerCase());
                        return (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, cursor: isLocked ? 'default' : 'pointer' }}>
                            <input type="radio" checked={matched} onChange={() => !isLocked && setLeaveType(opt)} style={{ display: 'none' }} />
                            <span style={{ width: 11, height: 11, border: '1px solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: matched ? '#111' : 'white', color: 'white', fontSize: 8 }}>{matched ? '\u2713' : ''}</span>
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, marginBottom: 4 }}>Reason For Leave:</div>
                    {isLocked ? (
                      <div style={{ border: '1px solid #111', minHeight: 32, padding: 4, fontSize: 10, marginBottom: 8 }}>{reason}</div>
                    ) : (
                      <textarea value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', border: '1px solid #111', minHeight: 32, padding: 4, fontSize: 10, marginBottom: 8, resize: 'none', background: 'transparent' }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Leave Start Date:</span>
                        {isLocked ? (
                          <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>{startDate ? format(parseISO(startDate), 'dd/MM/yyyy') : ''}</span>
                        ) : (
                          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1 }} />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: 0.5 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Duration (Days):</span>
                        {isLocked ? (
                          <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>{duration}</span>
                        ) : (
                          <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1 }} />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Date returning:</span>
                        <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1, color: '#444' }}>{expectedEndDate ? format(parseISO(expectedEndDate), 'dd/MM/yyyy') : ''}</span>
                      </div>
                    </div>

                    {/* 3. Handover Details */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '10px 0 6px', padding: '2px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>3. Handover Details</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>Person Responsible During Absence:</span>
                      {isPreviewLocked ? (
                        <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>
                          {employees.find(e => e.id === previewPersonResponsibleId)?.surname} {employees.find(e => e.id === previewPersonResponsibleId)?.firstname}
                        </span>
                      ) : (
                        <>
                          <select
                            className="hide-on-print"
                            value={previewPersonResponsibleId}
                            onChange={e => setPreviewPersonResponsibleId(e.target.value)}
                            style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, outline: 'none', background: 'transparent', fontSize: 10, paddingBottom: 1, appearance: 'none' }}
                          >
                            <option value="">Select an employee...</option>
                            {employees.map(e => (
                              <option key={e.id} value={e.id}>{e.surname} {e.firstname}</option>
                            ))}
                          </select>
                          <span className="show-on-print" style={{ display: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1 }}>
                            {previewPersonResponsibleId ? `${employees.find(e => e.id === previewPersonResponsibleId)?.surname} ${employees.find(e => e.id === previewPersonResponsibleId)?.firstname}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 10, marginBottom: 4 }}>Key Duties Handed Over:</div>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        {isPreviewLocked ? (
                          <div style={{ borderBottom: '1px solid #111', minHeight: 14, fontSize: 10 }}>{previewKeyDuties[i]}</div>
                        ) : (
                          <input
                            type="text"
                            value={previewKeyDuties[i]}
                            onChange={e => {
                              const newDuties = [...previewKeyDuties] as [string, string, string];
                              newDuties[i] = e.target.value;
                              setPreviewKeyDuties(newDuties);
                            }}
                            style={{ border: 'none', borderBottom: '1px solid #111', width: '100%', outline: 'none', background: 'transparent', fontSize: 10 }}
                          />
                        )}
                      </div>
                    ))}

                    {/* 5. Contact During Leave */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '10px 0 6px', padding: '2px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>5. Contact During Leave</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, marginBottom: 8 }}>
                      <span>Can be Contacted:</span>
                      {(['Yes', 'No'] as const).map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: isLocked ? 'default' : 'pointer' }}>
                          <input type="radio" checked={canBeContacted === opt} onChange={() => !isLocked && setCanBeContacted(opt)} style={{ display: 'none' }} />
                          <span style={{ width: 11, height: 11, border: '1px solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: canBeContacted === opt ? '#111' : 'white', color: 'white', fontSize: 8 }}>{canBeContacted === opt ? '\u2713' : ''}</span>
                          {opt}
                        </label>
                      ))}
                    </div>

                    {/* 6. Signatures — sequential approval workflow */}
                    <div style={{ fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', margin: '16px 0 10px', padding: '2px 6px', background: '#f0f0f0', borderLeft: '3px solid #333' }}>6. Signatures</div>
                    <div style={{ fontSize: 9, color: '#555', marginBottom: 8, fontStyle: 'italic' }}>
                      Approval workflow: Employee → Line Manager → Head of Department → Management → HR
                    </div>

                    {/* Step 0: Employee — always manual */}
                    <WfSigRow label="Employee Signature" stepNum={0} isManual={true}
                      sigData={liveLeave?.employeeSignature}
                      manualSigned={previewEmpSigStatus} setManualSigned={setPreviewEmpSigStatus}
                      manualDate={previewEmpSigDate} setManualDate={setPreviewEmpSigDate} />

                    {/* Step 1: Line Manager — manual (LM may not be a system user) */}
                    <WfSigRow label="Line Manager / Supervisor Approval" stepNum={1} isManual={true}
                      sigData={liveLeave?.supervisorSignature}
                      manualSigned={previewSupSigStatus} setManualSigned={setPreviewSupSigStatus}
                      manualDate={previewSupSigDate} setManualDate={setPreviewSupSigDate} />

                    {/* Step 2: Head of Department — auto-driven by task */}
                    <WfSigRow label="Head of Department Approval" stepNum={2}
                      sigData={liveLeave?.hodSignature} />

                    {/* Step 3: Management — auto-driven by task */}
                    <WfSigRow label="Management Approval" stepNum={3}
                      sigData={liveLeave?.managementSignature} />

                    {/* HR Section */}
                    <div style={{ borderTop: '1px solid #555', margin: '16px 0 10px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 8 }}>To be Completed by Human Resources</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 10, flexShrink: 0, paddingBottom: 1, whiteSpace: 'nowrap' }}>Leave approved from:</span>
                      {isPreviewLocked
                        ? <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1, paddingLeft: 4 }}>{previewHrFrom ? format(parseISO(previewHrFrom), 'dd/MM/yyyy') : ''}</span>
                        : <input type="date" value={previewHrFrom} onChange={e => setPreviewHrFrom(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1 }} />
                      }
                      <span style={{ fontSize: 10, flexShrink: 0, paddingBottom: 1 }}>to</span>
                      {isPreviewLocked
                        ? <span style={{ borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1, paddingLeft: 4 }}>{previewHrTo ? format(parseISO(previewHrTo), 'dd/MM/yyyy') : ''}</span>
                        : <input type="date" value={previewHrTo} onChange={e => setPreviewHrTo(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1 }} />
                      }
                    </div>

                    {/* Step 4: HR — auto-driven by task */}
                    <WfSigRow label="HR &amp; Admin Manager Signature" stepNum={4}
                      sigData={liveLeave?.hrSignature} />

                    {/* Leave Acknowledgement */}
                    <div style={{ borderTop: '1px solid #555', margin: '16px 0 10px' }} />
                    <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 8 }}>Leave Acknowledgement:</div>
                    <div style={{ fontSize: 10, lineHeight: 1.6, marginBottom: 10 }}>
                      I <span style={{ borderBottom: '1px solid #111', display: 'inline-block', minWidth: 130, marginBottom: -2, padding: '0 4px', fontWeight: 'bold' }}>{emp?.surname} {emp?.firstname}</span> hereby notify the Human Resources and Administrative department that I have resumed duty as of:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 10, marginBottom: 8 }}>
                      <span style={{ flexShrink: 0, paddingBottom: 1 }}>Date Returned:</span>
                      <input className="hide-on-print" type="date" value={previewFormDateReturned} onChange={e => setPreviewFormDateReturned(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, outline: 'none', background: 'transparent', cursor: 'pointer', paddingBottom: 1 }} />
                      <span className="show-on-print" style={{ display: 'none', borderBottom: '1px solid #111', flex: 1, minHeight: 14, fontSize: 10, paddingBottom: 1, paddingLeft: 4 }}>
                        {previewFormDateReturned ? format(parseISO(previewFormDateReturned), 'dd/MM/yyyy') : ''}
                      </span>
                    </div>

                    {/* NAS File Reference */}
                    {nasFilePath && (
                      <div className="mt-3 flex items-center gap-2 p-2 rounded bg-indigo-50 border border-indigo-200">
                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span style={{ fontSize: 9, color: '#444' }}>NAS: {nasFilePath}</span>
                        <button type="button" onClick={() => handleOpenNasFile(nasFilePath!)} className="ml-auto text-[9px] font-bold text-indigo-600 hover:underline">Open on PC</button>
                      </div>
                    )}

                    {/* Elapsed lock notice */}
                    {isPreviewLocked && (
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                        <Ban className="h-3.5 w-3.5" /> This form is read-only. The leave period has elapsed. Contact an admin to edit.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

