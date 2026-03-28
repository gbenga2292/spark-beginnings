import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { Search, Plus, ArrowLeft, Save, Pencil, Trash2, AlertTriangle, Eye, ShieldAlert, CheckCircle2, CheckSquare, BellRing, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAppStore, DisciplinaryRecord, Employee } from '@/src/store/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useUserStore } from '@/src/store/userStore';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { filterAndSortEmployeesExcludingCEO } from '@/src/lib/hierarchy';

export default function PerformanceConduct() {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);

  // For the 'Notice' functionality inside the single-page layout
  const [showNotices, setShowNotices] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const employees = useAppStore(s => s.employees);
  const records = useAppStore(s => s.disciplinaryRecords);
  const hrVariables = useAppStore(s => s.hrVariables);
  const { addDisciplinaryRecord, updateDisciplinaryRecord, deleteDisciplinaryRecord, updateEmployee } = useAppStore();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const priv = usePriv('disciplinary');

  const internalEmployees = filterAndSortEmployeesExcludingCEO(
    employees.filter(e => (e.status === 'Active' || e.status === 'On Leave') && e.staffType !== 'NON-EMPLOYEE')
  );

  const emptyForm: Partial<DisciplinaryRecord> = {
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Behavioral',
    severity: hrVariables?.actionLevels?.[0] || 'Verbal Warning',
    points: 0,
    description: '',
    reportedBy: '',
    queryIssued: false,
    queryDeadline: '',
    queryReplied: false,
    queryReplyText: '',
    workflowState: 'Reported',
    initialResult: 'Pending',
    committeeMeetingDate: '',
    finalResult: 'Pending',
    suspensionStartDate: '',
    suspensionEndDate: '',
    actionTaken: '', // Legacy mapped to summary
    status: 'Active',
    acknowledged: false,
    visibleToEmployee: true,
  };
  const [formData, setFormData] = useState<Partial<DisciplinaryRecord>>(emptyForm);

  const calculateWorkflowState = (data: Partial<DisciplinaryRecord>): NonNullable<DisciplinaryRecord['workflowState']> => {
    if (data.status === 'Closed') return 'Closed';
    if (data.initialResult === 'Committee' && data.finalResult === 'Pending') return 'Committee';
    if (data.initialResult !== 'Pending' && data.initialResult !== 'Committee') return 'Closed';
    if (data.queryIssued) {
      if (data.queryReplied) return 'Under Review';
      return 'Query Issued';
    }
    return 'Reported';
  };

  const handleSave = () => {
    if (!formData.employeeId || !formData.date || !formData.type || !formData.severity) {
      toast.error('Please fill in all required basic fields.');
      return;
    }

    // Auto calculate state
    const newState = calculateWorkflowState(formData);
    const updatedStatus = newState === 'Closed' ? 'Closed' : 'Active';

    const record: DisciplinaryRecord = {
      ...(formData as DisciplinaryRecord),
      workflowState: newState,
      status: updatedStatus,
      id: crypto.randomUUID(),
      createdBy: currentUser?.name || 'System',
    };

    addDisciplinaryRecord(record);
    handleTerminalAction(record);

    setIsAdding(false);
    setFormData(emptyForm);
    toast.success('Disciplinary log created.');
  };

  const handleUpdate = () => {
    if (!editingId) return;

    const newState = calculateWorkflowState(formData);
    const updatedStatus = newState === 'Closed' ? 'Closed' : 'Active';

    const recordToUpdate = {
      ...formData,
      workflowState: newState,
      status: updatedStatus,
    };

    updateDisciplinaryRecord(editingId, recordToUpdate as Partial<DisciplinaryRecord>);
    handleTerminalAction(recordToUpdate as DisciplinaryRecord);

    setIsEditing(false);
    setEditingId(null);
    setFormData(emptyForm);
    toast.success('Disciplinary log updated.');
  };

  const handleTerminalAction = (record: Partial<DisciplinaryRecord>) => {
    if (!record.employeeId) return;
    const emp = employees.find(e => e.id === record.employeeId);
    if (!emp) return;

    if (record.finalResult === 'Termination' && emp.status !== 'Terminated') {
      updateEmployee(emp.id, { status: 'Terminated' });
      toast.success('Employee status changed to Terminated. Proceed to Offboarding module manually if needed.');
      // Auto-populate offboarding could trigger here, handled by app logic
    }
    if (record.finalResult === 'Suspension') {
      // Currently handled externally or manually adjusting registers
    }
  };

  const startEdit = (record: DisciplinaryRecord) => {
    setFormData({ ...emptyForm, ...record });
    setEditingId(record.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Are you sure you want to delete this event log?', { variant: 'danger' });
    if (ok) {
      deleteDisciplinaryRecord(id);
      toast.success('Event deleted.');
    }
  };

  const renderForm = () => (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full relative">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setIsAdding(false); setIsEditing(false); setFormData(emptyForm); }} className="hover:bg-slate-100 rounded-full h-8 w-8">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </Button>
          <h2 className="text-xl font-bold text-slate-900 font-mono tracking-tight uppercase">
            {isEditing ? 'Performance Event Review' : 'Log Professional Performance Action'}
          </h2>
        </div>
        <Button onClick={isEditing ? handleUpdate : handleSave} className="bg-rose-600 hover:bg-rose-700 text-white px-5 h-9">
          <Save className="h-4 w-4 mr-2" /> Save Progress
        </Button>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full pb-32 space-y-4">

        {/* Step 1: Core Incident */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl px-6 py-4">
            <CardTitle className="text-slate-800 text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <span className="flex items-center justify-center bg-slate-200 text-slate-600 h-6 w-6 rounded-full text-xs">1</span>
              Performance/Incident Report
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5 px-6 pb-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Involved</label>
              <div className="h-10 flex items-center px-3 bg-slate-100 border border-slate-200 rounded-md text-sm font-medium text-slate-700">
                {internalEmployees.find(e => e.id === formData.employeeId)?.surname} {internalEmployees.find(e => e.id === formData.employeeId)?.firstname}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reported By</label>
              <Input placeholder="Manager, Colleague, System..." value={formData.reportedBy} onChange={e => setFormData({ ...formData, reportedBy: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date of Incident</label>
              <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Incident Type</label>
              <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-indigo-500/20" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                <option value="Attendance">Attendance Issue</option>
                <option value="Behavioral">Behavioral Misconduct</option>
                <option value="Performance">Poor Performance</option>
                <option value="Accolade">Positive Accolade (Merit)</option>
                <option value="Safety Violation">Safety Violation</option>
                <option value="Other">Other Event</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Record Points / Weight</label>
              <div className="flex gap-2 items-center">
                <Input type="number" step="1" className={formData.points && formData.points > 0 ? 'border-emerald-200 bg-emerald-50/20 text-emerald-700 font-bold' : formData.points && formData.points < 0 ? 'border-rose-200 bg-rose-50/20 text-rose-700 font-bold' : ''} value={formData.points || 0} onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} />
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">(Merit: +1, Demerit: -1)</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Action/Sanction Level</label>
              <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-indigo-500/20" value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
                {formData.points && formData.points > 0 ? (
                  <>
                    <option value="Commendation">Commendation Letter</option>
                    <option value="Bonus Recommendation">Bonus Recommendation</option>
                    <option value="Promotion Factor">Promotion Factor</option>
                    <option value="Verbal Praise">Verbal Praise</option>
                  </>
                ) : hrVariables?.actionLevels?.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Description of Incident</label>
              <textarea className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none" rows={4} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Provide a highly detailed narrative of the infraction..." />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Query Process */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl px-6 py-4">
            <CardTitle className="text-slate-800 text-sm font-black uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center bg-slate-200 text-slate-600 h-6 w-6 rounded-full text-xs">2</span>
                Query Process (Due Process)
              </div>
              <label className="flex items-center gap-2 mt-1 sm:mt-0 font-semibold text-rose-700 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-600" checked={formData.queryIssued} onChange={(e) => setFormData({ ...formData, queryIssued: e.target.checked, queryReplied: e.target.checked ? formData.queryReplied : false })} />
                Issue Query to Employee
              </label>
            </CardTitle>
          </CardHeader>
          {formData.queryIssued && (
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5 px-6 pb-6 bg-rose-50/10">
              <div className="space-y-2 md:col-span-2 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2"><BellRing className="h-4 w-4" /> Pending Employee Notice</h4>
                <p className="text-xs text-yellow-700 mt-1">This incident now sits in the "Notices" queue awaiting the employee's defense query reply. Provide a deadline for their response.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Query Reply Deadline</label>
                <Input type="datetime-local" value={formData.queryDeadline || ''} onChange={e => setFormData({ ...formData, queryDeadline: e.target.value })} />
              </div>
              <div className="space-y-2 flex items-end pb-2">
                <label className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-md w-full font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-600" checked={formData.queryReplied} onChange={(e) => setFormData({ ...formData, queryReplied: e.target.checked })} />
                  Has Employee Replied?
                </label>
              </div>

              {formData.queryReplied && (
                <div className="space-y-2 md:col-span-2 mt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee's Reply / Defense Statement</label>
                  <textarea className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none" rows={3} value={formData.queryReplyText || ''} onChange={e => setFormData({ ...formData, queryReplyText: e.target.value })} placeholder="Document the employee's written response to the query here..." />
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Step 3: Initial Resolution / Triage */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl px-6 py-4">
            <CardTitle className="text-slate-800 text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <span className="flex items-center justify-center bg-slate-200 text-slate-600 h-6 w-6 rounded-full text-xs">3</span>
              Disposition & Committee Hand-off
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5 px-6 pb-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Disciplinary Verdict</label>
              <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-rose-500/20 font-bold" value={formData.initialResult || 'Pending'} onChange={e => setFormData({ ...formData, initialResult: e.target.value as any })}>
                <option value="Pending" disabled>-- Select Verdict --</option>
                <option value="Warning">Warning (Verbal/Written)</option>
                <option value="Committee">Escalate to Disciplinary Committee</option>
                <option value="No Consequence">No Consequence (Exonerated)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">If "No Consequence", the record is kept but no evaluation penalty applies.</p>
            </div>

            {formData.initialResult === 'Committee' && (
              <>
                <div className="space-y-2 md:col-span-2 bg-slate-100 p-4 border border-slate-200 rounded-lg mt-4 shadow-inner">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">Committee Escalation Path</h4>
                  <p className="text-xs text-slate-600 mt-1 mb-4">You have escalated this to an official Disciplinary Committee. Track their meeting and outcome here.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Committee Meeting Date</label>
                      <Input type="date" value={formData.committeeMeetingDate || ''} onChange={e => setFormData({ ...formData, committeeMeetingDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Final Committee Result</label>
                      <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-rose-500/20 font-bold" value={formData.finalResult || 'Pending'} onChange={e => setFormData({ ...formData, finalResult: e.target.value as any })}>
                        <option value="Pending" disabled>-- Awaiting Outcome --</option>
                        <option value="Warning">Warning Issued</option>
                        <option value="Suspension">Suspension</option>
                        <option value="Termination">Termination of Employment</option>
                        <option value="No Consequence">No Consequence (Exonerated)</option>
                      </select>
                    </div>

                    {formData.finalResult === 'Suspension' && (
                      <div className="space-y-2 md:col-span-2 bg-white p-3 border border-slate-200 rounded-md grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Suspension Start Date</label>
                          <Input type="date" value={formData.suspensionStartDate || ''} onChange={e => setFormData({ ...formData, suspensionStartDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Suspension End Date</label>
                          <Input type="date" value={formData.suspensionEndDate || ''} onChange={e => setFormData({ ...formData, suspensionEndDate: e.target.value })} />
                        </div>
                      </div>
                    )}

                    {formData.finalResult === 'Termination' && (
                      <div className="space-y-2 md:col-span-2 bg-red-50 p-4 border border-red-200 rounded-md">
                        <h4 className="font-bold text-red-900 text-sm">Automated Termination Notice</h4>
                        <p className="text-xs text-red-800 mt-1">Saving this record will instantly switch this employee's active status to "Terminated", blocking further access and flagging them for standard offboarding procedures.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2 mt-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Final Administration Notes</label>
              <textarea className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500/20 outline-none" rows={2} value={formData.actionTaken || ''} onChange={e => setFormData({ ...formData, actionTaken: e.target.value })} placeholder="Any concluding formal remarks on the resolution..." />
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );

  const selectedEmp = internalEmployees.find(e => e.id === selectedEmployeeId);
  const empRecords = records.filter(r => r.employeeId === selectedEmployeeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Notice logic
  const noticeRecords = records.filter(r => r.queryIssued && !r.queryReplied && r.status !== 'Closed' && r.status !== 'Expired');
  const activeCount = internalEmployees.filter(emp => records.some(r => r.employeeId === emp.id && r.status === 'Active')).length;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 relative">
      {!(isAdding || isEditing) && (
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-400">
              Performance & Conduct
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest text-[10px]">Staff Merits & Demerits &bull; Due Process &bull; Active Evaluation</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className={`relative ${showNotices ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800' : 'bg-white hover:bg-slate-50'}`} onClick={() => { setShowNotices(!showNotices); setSelectedEmployeeId(null); setIsAdding(false); setIsEditing(false); setSidebarCollapsed(false); }}>
              <BellRing className="h-4 w-4 mr-2" />
              Pending Notices
              {noticeRecords.length > 0 && <span className="absolute -top-2 -right-2 h-5 w-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">{noticeRecords.length}</span>}
            </Button>
            <Button variant="outline" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="bg-white hover:bg-slate-50 px-3">
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4 mr-2 text-slate-500" /> : <PanelLeftClose className="h-4 w-4 mr-2 text-slate-500" />}
              {sidebarCollapsed ? 'Expand Directory' : 'Collapse Directory'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Left Sidebar Layout */}
        {!(isAdding || isEditing) && !sidebarCollapsed && (
          <div className={`w-80 flex-shrink-0 border-r border-slate-200 flex flex-col transition-colors ${showNotices ? 'bg-amber-50/30' : 'bg-slate-50/50'}`}>
            <div className="p-4 border-b border-slate-200 bg-white space-y-3">
              <div className="flex justify-between items-center">
                <h2 className={`font-bold flex items-center gap-2 ${showNotices ? 'text-amber-700' : 'text-slate-800'}`}>
                  {showNotices ? <BellRing className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5 text-rose-600" />}
                  {showNotices ? 'Notices Queue' : 'Active Directory'}
                </h2>
                {!showNotices && activeCount > 0 && <Badge variant="destructive" className="px-1.5 py-0 min-w-[20px] justify-center">{activeCount}</Badge>}
              </div>

              {!showNotices && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search employee..." className="pl-9 bg-slate-50 h-9" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} />
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm focus:ring-rose-500/20"
                    value={filterDepartment}
                    onChange={e => setFilterDepartment(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {Array.from(new Set(internalEmployees.map(e => e.department).filter(Boolean))).sort().map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {showNotices ? (
                // Display Pending Notice Items directly in the sidebar so they act like tickets
                noticeRecords.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                    All active queries have been replied to or processed.
                  </div>
                ) : (
                  noticeRecords.map(record => {
                    const emp = internalEmployees.find(e => e.id === record.employeeId);
                    const isPastDeadline = record.queryDeadline && new Date(record.queryDeadline) < new Date();
                    return (
                      <div key={record.id} onClick={() => { setSelectedEmployeeId(record.employeeId); startEdit(record); setShowNotices(false); }} className={`p-4 border-b border-amber-100 cursor-pointer hover:bg-amber-50/50 block w-full text-left bg-white transition-all hover:shadow-sm`}>
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className={`text-[10px] ${isPastDeadline ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                            {isPastDeadline ? 'DEADLINE LAPSED' : 'PENDING REPLY'}
                          </Badge>
                          <span className="text-[10px] font-mono text-slate-500">{record.date}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm truncate">{emp?.surname} {emp?.firstname}</h4>
                        <p className="text-xs text-slate-600 truncate mt-1">Type: {record.type}</p>
                        {record.queryDeadline && <p className={`text-[10px] mt-2 font-semibold ${isPastDeadline ? 'text-rose-500' : 'text-amber-600'}`}>Due: {new Date(record.queryDeadline).toLocaleString()}</p>}
                      </div>
                    );
                  })
                )
              ) : (
                // Standard Employee List Layout
                internalEmployees
                  .filter(e => filterDepartment ? e.department === filterDepartment : true)
                  .filter(e => `${e.surname} ${e.firstname}`.toLowerCase().includes(employeeSearch.toLowerCase()))
                  .map(emp => {
                    const hasActiveEvent = records.some(r => r.employeeId === emp.id && r.status === 'Active');
                    const isSelected = selectedEmployeeId === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => { setSelectedEmployeeId(emp.id); setIsAdding(false); setIsEditing(false); }}
                        className={`p-3 border-b border-slate-100 cursor-pointer transition-colors flex items-center justify-between ${isSelected ? 'bg-rose-50 border-l-4 border-l-rose-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-slate-200">
                            <AvatarFallback className={`${isSelected ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'} font-bold text-[10px]`}>
                              {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className={`text-sm font-bold truncate max-w-[160px] ${isSelected ? 'text-rose-900' : 'text-slate-700'}`}>{emp.surname} {emp.firstname}</h4>
                            <p className={`text-[10px] font-medium uppercase mt-0.5 ${isSelected ? 'text-rose-600' : 'text-slate-500'}`}>{emp.position}</p>
                          </div>
                        </div>
                        {hasActiveEvent && (
                          <div className={`h-2 w-2 rounded-full shadow-sm shrink-0 ${records.find(r => r.employeeId === emp.id && r.status === 'Active' && r.points && r.points > 0) ? 'bg-emerald-500' : 'bg-rose-500'}`} title="Active/Recent Event"></div>
                        )}
                      </div>
                    )
                  })
              )}
              {!showNotices && internalEmployees.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-500">No employees found.</div>
              )}
            </div>
          </div>
        )}

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden relative">
          {showNotices && !isEditing ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-8 bg-amber-50/10">
              <div className="h-24 w-24 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200 shadow-sm">
                <BellRing className="h-10 w-10 text-amber-500" />
              </div>
              <div className="text-center max-w-sm">
                <h3 className="font-bold text-xl text-amber-800">Notice Queue</h3>
                <p className="text-sm mt-2 text-amber-700/80 leading-relaxed">Select a pending notice ticket from the left sidebar. This will instantly open the due process form so you can track the reply and escalate if necessary.</p>
              </div>
            </div>
          ) : !selectedEmployeeId && !showNotices ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-8">
              <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
                <ShieldAlert className="h-10 w-10 text-slate-300" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="font-bold text-xl text-slate-600">Action Center</h3>
                <p className="text-sm mt-2 text-slate-500 leading-relaxed">Select an employee from the directory on the left to review their record or begin a new Due Process log. Toggle "Pending Notices" at the top to track active queries.</p>
              </div>
            </div>
          ) : (isAdding || isEditing) ? (
            renderForm()
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shrink-0 shadow-sm">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedEmp?.surname} {selectedEmp?.firstname}</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wider text-[11px]">{selectedEmp?.position} &bull; {selectedEmp?.department}</p>
                </div>
                {priv.canAdd && (
                  <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-sm px-6" onClick={() => { setFormData({ ...emptyForm, employeeId: selectedEmployeeId }); setIsAdding(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Log Performance Action
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {empRecords.length === 0 ? (
                  <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mb-4 border border-green-100">
                      <AlertTriangle className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">Clean Record</h3>
                    <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">There are currently no disciplinary logs or actions recorded for this employee. They are in good standing.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="w-28">Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Process State</TableHead>
                          <TableHead>Global Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {empRecords.map(r => (
                          <TableRow key={r.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-mono text-[11px] text-slate-500">{r.date}</TableCell>
                            <TableCell>
                              <div className="font-semibold text-slate-800 text-sm">{r.type}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{r.severity}</div>
                            </TableCell>
                            <TableCell>
                              <div className={`font-mono text-xs font-black ${r.points && r.points > 0 ? 'text-emerald-700' : r.points && r.points < 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                {r.points && r.points > 0 ? `+${r.points}` : r.points || 0}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-bold tracking-tight uppercase ${r.workflowState === 'Reported' ? 'text-slate-500' : r.workflowState === 'Query Issued' ? 'text-amber-500 bg-amber-50' : r.workflowState === 'Under Review' ? 'text-indigo-500 bg-indigo-50' : r.workflowState === 'Committee' ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                {r.workflowState || 'Legacy Action'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.status === 'Active' ? 'default' : 'outline'} className="text-[10px]">{r.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setViewingRecord({ ...r, employeeName: `${selectedEmp?.surname} ${selectedEmp?.firstname}` })}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {priv.canEdit && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => startEdit(r as any)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {priv.canDelete && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(r.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Generic Viewer Dialog for legacy/quick view */}
        <Dialog open={!!viewingRecord} onClose={() => setViewingRecord(null)} title="Disciplinary Details">
          {viewingRecord && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{viewingRecord.employeeName}</h4>
                  <p className="text-sm text-slate-500">{viewingRecord.date} • {viewingRecord.type}</p>
                </div>
                <Badge variant={viewingRecord.severity.includes('Warning') ? 'warning' : 'destructive'}>{viewingRecord.severity}</Badge>
              </div>

              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Narrative of Event</h5>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">
                  {viewingRecord.description || 'No description provided.'}
                </div>
              </div>

              {viewingRecord.queryIssued && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-sm">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Query Issued</h5>
                  <p className="text-amber-800 mb-2">Deadline: {viewingRecord.queryDeadline ? new Date(viewingRecord.queryDeadline).toLocaleString() : 'Not Set'}</p>
                  {viewingRecord.queryReplied ? (
                    <div className="bg-white p-3 rounded border border-amber-200 mt-2">
                      <p className="text-xs font-bold text-slate-500 mb-1">Employee Reply:</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{viewingRecord.queryReplyText}</p>
                    </div>
                  ) : <p className="text-rose-600 font-bold text-xs mt-2">Awaiting Reply...</p>}
                </div>
              )}

              {viewingRecord.initialResult && viewingRecord.initialResult !== 'Pending' && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Initial Disposition</h5>
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg text-sm text-indigo-900 font-bold">
                    {viewingRecord.initialResult}
                  </div>
                </div>
              )}

              {viewingRecord.initialResult === 'Committee' && viewingRecord.finalResult && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Final Disciplinary Finding</h5>
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg space-y-2 text-sm text-rose-900 font-bold">
                    <p>Committee Decision: {viewingRecord.finalResult}</p>
                    {viewingRecord.committeeMeetingDate && <p className="text-xs text-rose-700 mt-1 font-normal">Meeting Date: {viewingRecord.committeeMeetingDate}</p>}
                    {viewingRecord.finalResult === 'Suspension' && (
                      <p className="text-xs p-2 bg-white rounded mt-2">Suspended from: {viewingRecord.suspensionStartDate} to {viewingRecord.suspensionEndDate}</p>
                    )}
                  </div>
                </div>
              )}

              {viewingRecord.actionTaken && (
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Closure Remarks</h5>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                    {viewingRecord.actionTaken}
                  </div>
                </div>
              )}

              <div className="pt-2 text-xs text-slate-400 border-t border-slate-100 flex items-center justify-between mt-6">
                <span>Process State: {viewingRecord.workflowState || 'Closed'}</span>
                <Badge variant={viewingRecord.status === 'Active' ? 'default' : 'outline'}>{viewingRecord.status}</Badge>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </div>
  );
}

