import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Dialog } from '@/src/components/ui/dialog';
import { Search, Plus, ArrowLeft, Save, Pencil, Trash2, ClipboardList, Eye, UserCheck, PanelLeftClose, PanelLeftOpen, Users } from 'lucide-react';
import { useAppStore, EvaluationRecord } from '@/src/store/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useUserStore } from '@/src/store/userStore';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { filterAndSortEmployeesExcludingCEO } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useTheme } from '@/src/hooks/useTheme';

export function Evaluations() {
  const { isDark } = useTheme();
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  const employees = useAppStore(s => s.employees);
  const records = useAppStore(s => s.evaluations);
  const { addEvaluation, updateEvaluation, deleteEvaluation } = useAppStore();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const priv = usePriv('evaluations');

  const internalEmployees = filterAndSortEmployeesExcludingCEO(
    employees.filter(e => e.staffType?.toLowerCase().includes('internal') || ['OFFICE', 'FIELD'].includes(e.staffType))
  );

  const emptyForm: Partial<EvaluationRecord> = {
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Probation',
    overallScore: 50,
    scores: {},
    managerNotes: '',
    status: 'Draft',
    acknowledged: false,
  };
  const [formData, setFormData] = useState<Partial<EvaluationRecord>>(emptyForm);

  const handleSave = () => {
    if (!formData.employeeId || !formData.date || !formData.type) {
      toast.error('Please fill in all required fields.');
      return;
    }
    const record: EvaluationRecord = {
      ...(formData as EvaluationRecord),
      id: crypto.randomUUID(),
      createdBy: currentUser?.name || 'System',
    };
    addEvaluation(record);
    setIsAdding(false);
    setFormData(emptyForm);
    toast.success('Performance evaluation recorded.');
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateEvaluation(editingId, formData as Partial<EvaluationRecord>);
    setIsEditing(false);
    setEditingId(null);
    setFormData(emptyForm);
    toast.success('Evaluation updated successfully.');
  };

  const startEdit = (record: EvaluationRecord) => {
    setFormData(record);
    setEditingId(record.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Are you sure you want to delete this evaluation?', { variant: 'danger' });
    if (ok) {
      deleteEvaluation(id);
      toast.success('Evaluation deleted.');
    }
  };

  const renderForm = () => (
    <div className={`flex flex-col h-full overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setIsAdding(false); setIsEditing(false); setFormData(emptyForm); }} className="hover:bg-slate-100 rounded-full h-8 w-8">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </Button>
          <h2 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {isEditing ? 'Edit Evaluation' : 'New Performance Evaluation'}
          </h2>
        </div>
        <Button onClick={isEditing ? handleUpdate : handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 h-9">
          <Save className="h-4 w-4 mr-2" /> Save Evaluation
        </Button>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full pb-20 space-y-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl">
            <CardTitle className="text-slate-800">Evaluation Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee</label>
              <div className="h-10 flex items-center px-3 bg-slate-100 border border-slate-200 rounded-md text-sm font-medium text-slate-700">
                {internalEmployees.find(e => e.id === formData.employeeId)?.surname} {internalEmployees.find(e => e.id === formData.employeeId)?.firstname}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date of Review</label>
              <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Evaluation Type</label>
              <select className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-indigo-500/20" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                <option value="Probation">Probation Review</option>
                <option value="Annual">Annual Review</option>
                <option value="Quarterly">Quarterly Check-In</option>
                <option value="Ad-hoc">Ad-hoc Performance Note</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Score (0-100)</label>
              <Input type="number" min="0" max="100" value={formData.overallScore} onChange={e => setFormData({ ...formData, overallScore: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Review Status</label>
              <select className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-indigo-500/20" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                <option value="Draft">Draft</option>
                <option value="Review">In Review</option>
                <option value="Acknowledged">Acknowledged by Employee</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Manager Notes</label>
              <textarea className="flex w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" rows={5} value={formData.managerNotes} onChange={e => setFormData({ ...formData, managerNotes: e.target.value })} placeholder="Provide constructive feedback, areas of improvement, and goals..." />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const selectedEmp = internalEmployees.find(e => e.id === selectedEmployeeId);
  const empRecords = records.filter(r => r.employeeId === selectedEmployeeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activeCount = internalEmployees.filter(emp => records.some(r => r.employeeId === emp.id && r.status === 'Review')).length;

  useSetPageTitle(
    'Performance Center',
    'Select an employee from the directory to review or document performance evaluations',
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
      className="bg-white hover:bg-slate-50 px-3 h-9"
    >
      {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4 mr-2 text-slate-500" /> : <PanelLeftClose className="h-4 w-4 mr-2 text-slate-500" />}
      {sidebarCollapsed ? 'Expand' : 'Collapse'}
    </Button>
  );

  const EmployeeList = () => (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}>
      <div className={`p-4 border-b space-y-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex justify-between items-center">
          <h2 className={`font-bold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            <UserCheck className="h-5 w-5 text-indigo-600" />
            Active Directory
          </h2>
          {activeCount > 0 && <Badge variant="default" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-1.5 py-0 min-w-[20px] justify-center">{activeCount}</Badge>}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search employee..." className="pl-9 bg-slate-50 h-9" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} />
        </div>
        <select
          className={`h-9 w-full rounded-md border px-3 text-sm focus:ring-indigo-500/20 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
          value={filterDepartment}
          onChange={e => setFilterDepartment(e.target.value)}
        >
          <option value="">All Departments</option>
          {Array.from(new Set(internalEmployees.map(e => e.department).filter(Boolean))).sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {internalEmployees
          .filter(e => filterDepartment ? e.department === filterDepartment : true)
          .filter(e => `${e.surname} ${e.firstname}`.toLowerCase().includes(employeeSearch.toLowerCase()))
          .map(emp => {
            const hasReviewEvent = records.some(r => r.employeeId === emp.id && r.status === 'Review');
            const isSelected = selectedEmployeeId === emp.id;
            return (
              <div
                key={emp.id}
                onClick={() => { setSelectedEmployeeId(emp.id); setIsAdding(false); setIsEditing(false); setIsMobileListOpen(false); }}
                className={`p-3 border-b cursor-pointer transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                    : `border-l-4 border-l-transparent ${isDark ? 'bg-slate-900 border-slate-700/50 hover:bg-slate-800' : 'bg-white border-slate-100 hover:bg-slate-50'}`
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className={`h-9 w-9 border ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                    <AvatarFallback className={`font-bold text-[10px] ${
                      isSelected ? 'bg-indigo-200 text-indigo-800' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className={`text-sm font-bold truncate max-w-[160px] ${
                      isSelected ? 'text-indigo-900' : isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}>{emp.surname} {emp.firstname}</h4>
                    <p className={`text-[10px] font-medium uppercase mt-0.5 ${
                      isSelected ? 'text-indigo-600' : isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>{emp.position}</p>
                  </div>
                </div>
                {hasReviewEvent && (
                  <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm shrink-0" title="In Review"></div>
                )}
              </div>
            )
          })
        }
        {internalEmployees.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">No employees found.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">

      {/* Mobile employee drawer overlay */}
      {isMobileListOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileListOpen(false)} />
          <div className={`relative z-10 w-80 max-w-[85vw] h-full flex flex-col shadow-2xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <span className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Employee Directory</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMobileListOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmployeeList />
            </div>
          </div>
        </div>
      )}

      <div className={`flex flex-1 min-h-0 rounded-2xl shadow-sm border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Left Sidebar - hidden on mobile */}
        {!(isAdding || isEditing) && !sidebarCollapsed && (
        <div className={`hidden md:flex w-80 flex-shrink-0 border-r flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}>
          <EmployeeList />
        </div>
        )}

        {/* Right Content Area */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-50/50'}`}>
          {!selectedEmployeeId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-8">
                <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
                  <UserCheck className="h-10 w-10 text-slate-300" />
                </div>
                <div className="text-center max-w-sm">
                  <h3 className="font-bold text-xl text-slate-600">Action Center</h3>
                  <p className="text-sm mt-2 text-slate-500 leading-relaxed">Select an employee from the directory to review their performance or log a new evaluation.</p>
                </div>
                <Button className="md:hidden mt-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsMobileListOpen(true)}>
                  <Users className="h-4 w-4 mr-2" /> Browse Employees
                </Button>
            </div>
          ) : isAdding || isEditing ? (
            renderForm()
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className={`border-b p-4 md:p-6 flex justify-between items-center shrink-0 shadow-sm gap-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Button variant="ghost" size="icon" className="flex md:hidden shrink-0 h-8 w-8" onClick={() => setIsMobileListOpen(true)}>
                      <Users className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                      <h2 className={`text-lg md:text-2xl font-bold tracking-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{selectedEmp?.surname} {selectedEmp?.firstname}</h2>
                      <p className="text-[10px] md:text-[11px] font-medium text-slate-500 mt-0.5 uppercase tracking-wider">{selectedEmp?.position} &bull; {selectedEmp?.department}</p>
                    </div>
                  </div>
                  {priv.canAdd && (
                    <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-sm px-3 md:px-6 shrink-0" onClick={() => { setFormData({...emptyForm, employeeId: selectedEmployeeId}); setIsAdding(true); }}>
                      <Plus className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Log Evaluation</span>
                    </Button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {empRecords.length === 0 ? (
                    <div className={`border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
                          <ClipboardList className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className={`font-bold text-lg ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>No Evaluations</h3>
                        <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">This employee does not have any recorded performance evaluations yet.</p>
                    </div>
                  ) : (
                    <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                              <TableRow className="bg-slate-50/80">
                                <TableHead className="w-28">Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {empRecords.map(r => (
                                <TableRow key={r.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono text-[11px] text-slate-500">{r.date}</TableCell>
                                    <TableCell className="font-semibold text-slate-800 text-sm">{r.type}</TableCell>
                                    <TableCell>
                                      <span className={`font-bold ${r.overallScore >= 70 ? 'text-emerald-600' : r.overallScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                        {r.overallScore}%
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={r.status === 'Acknowledged' ? 'default' : r.status === 'Review' ? 'secondary' : 'outline'} className="text-[10px]">{r.status}</Badge>
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
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>

        <Dialog open={!!viewingRecord} onClose={() => setViewingRecord(null)} title="Evaluation Details">
          {viewingRecord && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{viewingRecord.employeeName}</h4>
                  <p className="text-sm text-slate-500">{viewingRecord.date} • {viewingRecord.type}</p>
                </div>
                <span className={`text-2xl font-black ${viewingRecord.overallScore >= 70 ? 'text-emerald-500' : viewingRecord.overallScore >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {viewingRecord.overallScore}%
                </span>
              </div>
              
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Manager Notes / Feedback</h5>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">
                  {viewingRecord.managerNotes || 'No notes provided.'}
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-400 border-t border-slate-100 flex items-center justify-between">
                <span>Recorded by: {viewingRecord.createdBy || 'System'}</span>
                <Badge variant={viewingRecord.status === 'Acknowledged' ? 'default' : viewingRecord.status === 'Review' ? 'secondary' : 'outline'}>{viewingRecord.status}</Badge>
              </div>
            </div>
          )}
        </Dialog>
      </div>

      {/* Mobile FAB to open employee list */}
      {!selectedEmployeeId && !isMobileListOpen && (
        <button
          onClick={() => setIsMobileListOpen(true)}
          className="fixed bottom-6 right-6 z-40 md:hidden flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
        >
          <Users className="h-5 w-5" />
          <span className="text-sm font-semibold">Employees</span>
        </button>
      )}
    </div>
  );
}

