import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { CheckCircle2, Circle, Clock, FileText, Mail, UserPlus, X, Save, UserMinus, Users, Building, Activity, CalendarDays, ArrowRight, Check, Trash2, Search } from 'lucide-react';
import { useAppStore, Employee, MonthlySalary } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import logoSrc from '../../logo/logo-2.png';
import { usePriv } from '@/src/hooks/usePriv';

interface OnboardingTask {
  id: string;
  title: string;
  assignee: string;
  status: 'Completed' | 'In Progress' | 'Pending';
  date: string;
}

export function Onboarding() {
  const employees = useAppStore((state) => state.employees);
  const departments = useAppStore((state) => state.departments);
  const positions = useAppStore((state) => state.positions);
  const departmentTasksList = useAppStore((state) => state.departmentTasksList);
  const addEmployee = useAppStore((state) => state.addEmployee);
  const updateEmployee = useAppStore((state) => state.updateEmployee);

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('onboarding');

  const [showNewHireForm, setShowNewHireForm] = useState(false);
  const [showOffboardForm, setShowOffboardForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractTab, setContractTab] = useState<'Active' | 'Onboarding'>('Active');
  const [leftTab, setLeftTab] = useState<'Active' | 'Pending'>('Active');
  const [offboardEmployeeId, setOffboardEmployeeId] = useState('');
  const [offboardEndDate, setOffboardEndDate] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [contractTempFields, setContractTempFields] = useState({
    offerDate: '',
    candidateTitle: 'Mr./Ms.',
    candidateName: '',
    candidateAddress: '',
    salutation: '',
    jobTitle: '',
    introText: '',
    dutiesText: '',
    compensationText: '',
    goodFaithText: '',
    confidentialityText: '',
    resumeDateText: '',
    workingDaysText: '',
    signatoryName: 'Hubert Olatokunbo Davies',
  });

  const [newHireData, setNewHireData] = useState<Partial<Employee>>({
    firstname: '',
    surname: '',
    department: '',
    position: '',
    staffType: 'INTERNAL',
    startDate: '',
    monthlySalaries: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 }
  });

  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([]);
  const [pendingNewHire, setPendingNewHire] = useState<Employee | null>(null);
  const [pendingOffboard, setPendingOffboard] = useState<Employee | null>(null);
  const [activeTaskType, setActiveTaskType] = useState<'Onboarding' | 'Offboarding' | null>(null);

  const [viewingHistoryEmployee, setViewingHistoryEmployee] = useState<Employee | null>(null);
  const [historyTasks, setHistoryTasks] = useState<OnboardingTask[]>([]);

  // Get active employees for display
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);
  const filteredActiveEmployees = useMemo(() => {
    if (!employeeSearchQuery) return activeEmployees;
    const q = employeeSearchQuery.toLowerCase();
    return activeEmployees.filter(e => e.firstname.toLowerCase().includes(q) || e.surname.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
  }, [activeEmployees, employeeSearchQuery]);

  const filteredPendingHire = useMemo(() => {
    if (!pendingNewHire) return null;
    if (!employeeSearchQuery) return pendingNewHire;
    const q = employeeSearchQuery.toLowerCase();
    if (pendingNewHire.firstname.toLowerCase().includes(q) || pendingNewHire.surname.toLowerCase().includes(q) || pendingNewHire.position.toLowerCase().includes(q)) return pendingNewHire;
    return null;
  }, [pendingNewHire, employeeSearchQuery]);

  const handleViewHistory = (emp: Employee) => {
    const baseTasks = departmentTasksList.find(d => d.department === 'ALL')?.onboardingTasks || [];
    const deptTasks = emp.department ?
      (departmentTasksList.find(d => d.department === emp.department)?.onboardingTasks || []) : [];

    const combinedTasks = [...baseTasks];
    deptTasks.forEach(dt => {
      if (!combinedTasks.find(bt => bt.title === dt.title)) combinedTasks.push(dt);
    });

    const completedTasks: OnboardingTask[] = combinedTasks.map((task, index) => {
      const taskDate = emp.startDate ? new Date(emp.startDate) : new Date();
      taskDate.setDate(taskDate.getDate() + index);
      return {
        id: `history-task-${emp.id}-${index}`,
        title: task.title,
        assignee: task.assignee,
        status: 'Completed',
        date: taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });

    setViewingHistoryEmployee(emp);
    setHistoryTasks(completedTasks);
  };

  const handleStartNewHire = () => {
    if (!newHireData.firstname || !newHireData.surname || !newHireData.startDate || !newHireData.department || !newHireData.position) {
      toast.error('Please fill in all basic employee details and start date.');
      return;
    }

    // Determine tasks based on department
    const baseTasks = departmentTasksList.find(d => d.department === 'ALL')?.onboardingTasks || [];
    const deptTasks = newHireData.department ?
      (departmentTasksList.find(d => d.department === newHireData.department)?.onboardingTasks || []) : [];

    // De-duplicate tasks by title
    const combinedTasks = [...baseTasks];
    deptTasks.forEach(dt => {
      if (!combinedTasks.find(bt => bt.title === dt.title)) combinedTasks.push(dt);
    });

    if (combinedTasks.length === 0) {
      toast.warning('No onboarding tasks configured for this department or the ALL default. Proceeding without tasks.');
    }

    const start = new Date(newHireData.startDate as string);
    const newTasks: OnboardingTask[] = combinedTasks.map((task, index) => {
      const taskDate = new Date(start);
      taskDate.setDate(start.getDate() + index);
      return {
        id: `task-${Date.now()}-${index}`,
        title: task.title,
        assignee: task.assignee,
        status: index === 0 ? 'In Progress' : 'Pending',
        date: taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });

    const finalEmployee: Employee = {
      id: `EMP-${Date.now().toString().slice(-6)}`,
      surname: (newHireData.surname as string).toUpperCase(),
      firstname: (newHireData.firstname as string).toUpperCase(),
      department: newHireData.department as string,
      staffType: newHireData.staffType as 'INTERNAL' | 'EXTERNAL',
      position: newHireData.position as string,
      startDate: newHireData.startDate as string,
      endDate: '',
      yearlyLeave: 20,
      bankName: '', accountNo: '', taxId: '', pensionNumber: '',
      payeTax: true, withholdingTax: false,
      status: 'Active',
      monthlySalaries: newHireData.monthlySalaries as MonthlySalary
    };

    setPendingNewHire(finalEmployee);
    setPendingOffboard(null);
    setActiveTaskType('Onboarding');
    setOnboardingTasks(newTasks);
    setShowNewHireForm(false);

    // Reset form
    setNewHireData({
      firstname: '', surname: '', department: '', position: '', staffType: 'INTERNAL', startDate: '',
      monthlySalaries: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 }
    });

    toast.success('Onboarding process started with department-specific tasks!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartOffboarding = () => {
    if (!offboardEmployeeId || !offboardEndDate) {
      toast.error('Please select an employee and their official end date.');
      return;
    }

    const emp = employees.find(e => e.id === offboardEmployeeId);
    if (!emp) return;

    // Immediately update their status to Terminated and set the end date so they disappear from active lists
    updateEmployee(emp.id, { status: 'Terminated', endDate: offboardEndDate });

    // Determine offboarding tasks
    const baseTasks = departmentTasksList.find(d => d.department === 'ALL')?.offboardingTasks || [];
    const deptTasks = emp.department ?
      (departmentTasksList.find(d => d.department === emp.department)?.offboardingTasks || []) : [];

    const combinedTasks = [...baseTasks];
    deptTasks.forEach(dt => {
      if (!combinedTasks.find(bt => bt.title === dt.title)) combinedTasks.push(dt);
    });

    const offboardTasks: OnboardingTask[] = combinedTasks.map((task, index) => {
      const taskDate = new Date();
      return {
        id: `off-task-${Date.now()}-${index}`,
        title: task.title,
        assignee: task.assignee,
        status: index === 0 ? 'In Progress' : 'Pending',
        date: taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });

    setPendingOffboard(emp);
    setPendingNewHire(null);
    setActiveTaskType('Offboarding');
    setOnboardingTasks(offboardTasks);
    setShowOffboardForm(false);
    setOffboardEmployeeId('');
    setOffboardEndDate('');
    toast.success(`${emp.firstname} ${emp.surname} has been terminated. Offboarding checklist initialized.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTaskStatus = (taskId: string) => {
    const updated = onboardingTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status: task.status === 'Completed' ? 'Pending' :
            task.status === 'In Progress' ? 'Completed' : 'In Progress'
        } as OnboardingTask;
      }
      return task;
    });

    setOnboardingTasks(updated);

    // Check if all are complete and we have a pending new hire or offboard
    const allCompleted = updated.every(t => t.status === 'Completed');
    if (allCompleted) {
      if (activeTaskType === 'Onboarding' && pendingNewHire) {
        addEmployee(pendingNewHire);
        toast.success(`${pendingNewHire.firstname} ${pendingNewHire.surname} has been formally added to employees list!`);
        setPendingNewHire(null);
        setActiveTaskType(null);
      } else if (activeTaskType === 'Offboarding' && pendingOffboard) {
        toast.success(`Offboarding completely finished for ${pendingOffboard.firstname} ${pendingOffboard.surname}!`);
        setPendingOffboard(null);
        setActiveTaskType(null);
      }
    }
  };

  const [contractEmployee, setContractEmployee] = useState<string>('');

  const handleGenerateContract = () => {
    if (!contractEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    let emp = employees.find(e => e.id === contractEmployee);
    if (!emp && pendingNewHire?.id === contractEmployee) {
      emp = pendingNewHire;
    }

    if (!emp) return;
    const contractContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Century Gothic', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; padding: 40px; }
  .logo-container { text-align: left; margin-bottom: 20px; }
  .logo-container img { height: 70px; }
  h1 { font-size: 12pt; text-decoration: underline; margin-bottom: 20px; text-transform: uppercase; border: none; }
  .address-block { margin-bottom: 20px; }
  .address-block p { margin: 2px 0; font-weight: bold; }
  .salutation { margin-bottom: 20px; }
  .body-text { margin-bottom: 15px; white-space: pre-wrap; text-align: justify; }
  .numbered-list { list-style-type: decimal; padding-left: 20px; margin-top: 10px; }
  .numbered-list li { margin-bottom: 15px; font-weight: bold;}
  .numbered-list li div { font-weight: normal; margin-top: 5px; white-space: pre-wrap; text-align: justify; }
  .signature-block { margin-top: 30px; }
  .employee-sign { margin-top: 40px; }
  .employee-sign div { margin-top: 25px; }
  .footer { font-size: 8pt; text-align: left; color: #666; margin-top: 60px; border-top: 1px solid #ccc; padding-top: 10px; }
</style>
</head>
<body>
  <div class="logo-container">
    <img src="${window.location.origin}${logoSrc}" alt="Logo" />
  </div>

  <div class="address-block">
    <p>${contractTempFields.offerDate}</p>
    <br/>
    <p>${contractTempFields.candidateTitle} ${contractTempFields.candidateName}</p>
    <p style="white-space: pre-wrap;">${contractTempFields.candidateAddress || 'Click to add address...'}</p>
  </div>

  <p class="salutation">${contractTempFields.salutation}</p>

  <h1>OFFER OF EMPLOYMENT</h1>

  <div class="body-text">${contractTempFields.introText}</div>

  <ol class="numbered-list">
    <li>Duties
        <div>${contractTempFields.dutiesText}</div>
    </li>
    <li>Compensation
        <div>${contractTempFields.compensationText}</div>
    </li>
    <li>Good Faith
        <div>${contractTempFields.goodFaithText}</div>
    </li>
    <li>Confidentiality
        <div>${contractTempFields.confidentialityText}</div>
    </li>
  </ol>

  <p style="text-align: justify;"><strong>${contractTempFields.resumeDateText}</strong></p>

  <div class="body-text">${contractTempFields.workingDaysText}</div>

  <div class="signature-block">
    <p>We wish you a successful working relationship with us.</p>
    <p>Yours sincerely,</p>
    <br/><br/><br/>
    <p><strong>${contractTempFields.signatoryName}</strong><br/>
    For: <strong>DEWATERING CONSTRUCTION ETC LIMITED</strong></p>
  </div>

  <div class="employee-sign">
    <p>The terms and conditions of this offer are agreed to by:</p>
    <div><strong>Name:</strong> __________________________________________</div>
    <div><strong>Signature:</strong> ______________________________________</div>
    <div><strong>Date:</strong> __________________________________________</div>
  </div>
</body>
</html>
    `.trim();

    const blob = new Blob([contractContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Employment_Contract_${emp.surname}_${emp.firstname.replace(/\s+/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Contract generated for ${emp.surname} ${emp.firstname}!`);
  };

  const displayTasks = viewingHistoryEmployee ? historyTasks : onboardingTasks;
  const completedTasks = displayTasks.filter(t => t.status === 'Completed').length;
  const totalTasks = displayTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

      {/* Header section with sleek solid styling */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
            Lifecycle & Flow
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage onboarding, offboarding, and seamless employee transitions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {priv.canAdd && (
            <Button variant="outline" className="gap-2 shadow-sm whitespace-nowrap" onClick={() => { setShowContractForm(true); setShowNewHireForm(false); setShowOffboardForm(false); }}>
              <FileText className="h-4 w-4 text-indigo-500" />
              Generate Contract
            </Button>
          )}
          {priv.canAdd && (
            <Button
              className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all sm:whitespace-nowrap"
              onClick={() => { setShowNewHireForm(true); setShowOffboardForm(false); setShowContractForm(false); }}
            >
              <UserPlus className="h-4 w-4" />
              Start New Hire
            </Button>
          )}
        </div>
      </div>

      {/* Top Stats Area - Sleek and modern */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Total Employed', value: employees.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Staff', value: activeEmployees.length, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'On Leave', value: employees.filter(e => e.status === 'On Leave').length, icon: CalendarDays, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Terminated', value: employees.filter(e => e.status === 'Terminated').length, icon: UserMinus, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 bg-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form Overlay Area (New Hire) */}
      {showNewHireForm && (
        <Card className="border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-400"></div>
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 pt-6 px-6 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-500" /> Start Onboarding
              </CardTitle>
              <CardDescription className="mt-1 pb-0">Configure basic details to generate the onboarding roadmap.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => setShowNewHireForm(false)}>
              <X className="h-5 w-5 text-slate-500" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">First Name <span className="text-rose-500">*</span></label>
                <Input className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors" placeholder="e.g. John" value={newHireData.firstname} onChange={(e) => setNewHireData({ ...newHireData, firstname: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Surname <span className="text-rose-500">*</span></label>
                <Input className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors" placeholder="e.g. Doe" value={newHireData.surname} onChange={(e) => setNewHireData({ ...newHireData, surname: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Department <span className="text-rose-500">*</span></label>
                <select className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={newHireData.department} onChange={(e) => setNewHireData({ ...newHireData, department: e.target.value })}>
                  <option value="" disabled>Select Department</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Dictates which specific task template is activated.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Position <span className="text-rose-500">*</span></label>
                <select className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={newHireData.position} onChange={(e) => setNewHireData({ ...newHireData, position: e.target.value })}>
                  <option value="" disabled>Select Position</option>
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Official Start Date <span className="text-rose-500">*</span></label>
                <Input type="date" className="h-11 md:max-w-[50%] bg-slate-50 border-slate-200 focus:bg-white transition-colors" value={newHireData.startDate} onChange={(e) => setNewHireData({ ...newHireData, startDate: e.target.value })} />
              </div>
            </div>

            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-4 mt-6 items-center">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 h-10 w-10 flex items-center justify-center shrink-0">
                <Check className="h-5 w-5" />
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed">
                This profile will remain in a secure <strong>Pending Limbo</strong>. The employee is not officially written to the company roster or payroll until their entire generated task list is fully checked off.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" className="text-slate-500 hover:text-slate-700 font-medium" onClick={() => setShowNewHireForm(false)}>Cancel</Button>
              <Button onClick={handleStartNewHire} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-indigo-200">
                <ArrowRight className="h-4 w-4" /> Save Details & Load Roadmap
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Overlay Area (Offboarding) */}
      {showOffboardForm && (
        <Card className="border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-rose-400"></div>
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 pt-6 px-6 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <UserMinus className="h-5 w-5 text-red-500" /> Initiate Offboarding
              </CardTitle>
              <CardDescription className="mt-1 pb-0">Gracefully wrap up an employee's tenure.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => setShowOffboardForm(false)}>
              <X className="h-5 w-5 text-slate-500" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Select Active Employee <span className="text-rose-500">*</span></label>
                <select className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-red-500/20"
                  value={offboardEmployeeId} onChange={(e) => setOffboardEmployeeId(e.target.value)}>
                  <option value="" disabled>--- Select an Employee ---</option>
                  {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} ({emp.position})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Official End Date <span className="text-rose-500">*</span></label>
                <Input type="date" className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors" value={offboardEndDate} onChange={(e) => setOffboardEndDate(e.target.value)} />
              </div>
            </div>

            <div className="p-4 bg-rose-50/80 rounded-xl border border-rose-200 flex gap-4 mt-6 items-center">
              <div className="bg-white p-2 text-rose-600 rounded-lg shadow-sm h-10 w-10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <p className="text-sm text-rose-900 leading-relaxed">
                <strong>Attention:</strong> Triggering this action will instantly transition the employee to <strong>Terminated</strong>, ripping them from active payroll and attendance grids immediately.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" className="text-slate-500 hover:text-slate-700 font-medium" onClick={() => setShowOffboardForm(false)}>Cancel</Button>
              <Button onClick={handleStartOffboarding} className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-red-200">
                <Save className="h-4 w-4" /> Terminate & Load Roadmap
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Generation Form */}
      {showContractForm && (
        <Card className="border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"></div>
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 pt-6 px-6 flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" /> Generate Employee Contract
              </CardTitle>
              <CardDescription className="mt-1 pb-0">Select an employee to generate a ready-to-print employment agreement.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200" onClick={() => setShowContractForm(false)}>
              <X className="h-5 w-5 text-slate-500" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 md:p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-6 max-w-xs">
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${contractTab === 'Active' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setContractTab('Active')}
              >
                Active Crew
              </button>
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${contractTab === 'Onboarding' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setContractTab('Onboarding')}
              >
                Pending Hire
              </button>
            </div>

            <div className="space-y-4 mb-6 max-w-xl">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Select Employee <span className="text-rose-500">*</span></label>
                <select className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={contractEmployee} onChange={(e) => {
                    const id = e.target.value;
                    setContractEmployee(id);
                    let found = activeEmployees.find(emp => emp.id === id);
                    if (!found && pendingNewHire?.id === id) found = pendingNewHire;
                    if (found) {
                      setContractTempFields({
                        offerDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                        candidateTitle: 'Mr/Ms.',
                        candidateName: `${found.firstname} ${found.surname}`,
                        candidateAddress: 'Please provide exact address...',
                        salutation: `Dear ${found.firstname.split(' ')[0]},`,
                        jobTitle: found.position,
                        introText: `Sequel to your interview and subsequent assessments we are pleased to offer you the position of ${found.position} with our organisation. Upon review of your qualifications and skills, we believe your skills and experience make you an excellent fit for our team.\n\nHowever, you should note with your new employment comes responsibility and it is expected that you discharge your duties accordingly. The success of the business must be paramount in your mind and while under employment, you are expected to continually find ways to advance the growth of the business.\n\nYou will be expected to abide by all rules and guidelines as well observe the necessary codes of conduct that have been put in place by your employers.`,
                        dutiesText: `Your duties as a ${found.position} shall include all functions as listed in the job description which will be handed to you upon assumption of duty:\n\nYou will be expected to perform all duties and follow all instructions as may be assigned or delegated to you from time to time; act in a manner which is reasonably necessary and proper in the interests of the Company.`,
                        compensationText: `You are entitled to a monthly gross compensation of ₦${(found.monthlySalaries?.jan || 0).toLocaleString()} only. By your authority, The Company will deduct and remit all statutory deductions and contributions required by law on your behalf.`,
                        goodFaithText: `You shall be required at all times to act loyally, faithfully and in the best interest of and to use your best endeavours to develop and expand the business of The Company.`,
                        confidentialityText: `You shall be required to sign a confidentiality agreement as soon as the offer is accepted by you.`,
                        resumeDateText: `You will be expected to resume on ${found.startDate ? new Date(found.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'a mutually agreed date'}.`,
                        workingDaysText: `Your working days will be Monday - Friday from 8:00am. If need be, you will be required to work weekends to meet with demanding timelines.\n\nPlease confirm your acceptance of this offer by signing and returning the attached form in advance.`,
                        signatoryName: 'Hubert Olatokunbo Davies'
                      });
                    }
                  }}>
                  <option value="" disabled>--- Select an Employee ---</option>
                  {contractTab === 'Active' && activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} ({emp.position})</option>)}
                  {contractTab === 'Onboarding' && pendingNewHire ? <option key={pendingNewHire.id} value={pendingNewHire.id}>{pendingNewHire.surname} {pendingNewHire.firstname}     ({pendingNewHire.position})</option> : null}
                  {contractTab === 'Onboarding' && !pendingNewHire && <option value="" disabled>No pending new hires</option>}
                </select>
              </div>

              {contractEmployee && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Offer Date</label>
                      <Input className="h-9 text-sm" value={contractTempFields.offerDate} onChange={e => setContractTempFields({ ...contractTempFields, offerDate: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 flex gap-2">
                      <div className="w-1/3 space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
                        <Input className="h-9 text-sm" value={contractTempFields.candidateTitle} onChange={e => setContractTempFields({ ...contractTempFields, candidateTitle: e.target.value })} />
                      </div>
                      <div className="w-2/3 space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Candidate Name</label>
                        <Input className="h-9 text-sm" value={contractTempFields.candidateName} onChange={e => setContractTempFields({ ...contractTempFields, candidateName: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Candidate Address</label>
                      <textarea className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 p-2 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.candidateAddress} onChange={e => setContractTempFields({ ...contractTempFields, candidateAddress: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Salutation</label>
                      <Input className="h-9 text-sm" value={contractTempFields.salutation} onChange={e => setContractTempFields({ ...contractTempFields, salutation: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Job Title</label>
                      <Input className="h-9 text-sm" value={contractTempFields.jobTitle} onChange={e => setContractTempFields({ ...contractTempFields, jobTitle: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-200/50 rounded-bl-full -z-0"></div>
                      <label className="text-xs font-bold uppercase tracking-wider text-yellow-800 flex items-center gap-1.5 relative z-10"><CalendarDays className="h-4 w-4" /> Start Date / Resume Date</label>
                      <p className="text-xs text-yellow-600 mb-2 font-medium relative z-10">Carefully verify the employee's official resumption date below:</p>
                      <Input className="h-9 text-sm bg-white border-yellow-300 focus-visible:ring-yellow-500/50 relative z-10 font-bold text-yellow-900" value={contractTempFields.resumeDateText} onChange={e => setContractTempFields({ ...contractTempFields, resumeDateText: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Signatory Name</label>
                      <Input className="h-9 text-sm" value={contractTempFields.signatoryName} onChange={e => setContractTempFields({ ...contractTempFields, signatoryName: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-4 shadow-sm border border-slate-100 p-4 rounded-xl bg-slate-50 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Introduction Paragraphs</label>
                      <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-32 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.introText} onChange={e => setContractTempFields({ ...contractTempFields, introText: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500"></div>1. Duties & Responsibilities</label>
                      <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-24 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.dutiesText} onChange={e => setContractTempFields({ ...contractTempFields, dutiesText: e.target.value })} />
                    </div>
                    <div className="space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full -z-0"></div>
                      <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 relative z-10"><div className="h-2 w-2 rounded-full bg-emerald-500"></div>2. Compensation (Salary Structure)</label>
                      <p className="text-xs text-emerald-600 mb-2 font-medium relative z-10">Verify the monthly basic pay matches the agreed matrix:</p>
                      <textarea className="w-full text-sm rounded-md border border-emerald-300 bg-white p-3 h-20 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all resize-none relative z-10 font-semibold text-emerald-900" value={contractTempFields.compensationText} onChange={e => setContractTempFields({ ...contractTempFields, compensationText: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500"></div>3. Good Faith</label>
                      <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.goodFaithText} onChange={e => setContractTempFields({ ...contractTempFields, goodFaithText: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500"></div>4. Confidentiality</label>
                      <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.confidentialityText} onChange={e => setContractTempFields({ ...contractTempFields, confidentialityText: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Working Days / Conclusion</label>
                      <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-24 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.workingDaysText} onChange={e => setContractTempFields({ ...contractTempFields, workingDaysText: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" className="text-slate-500 hover:text-slate-700 font-medium" onClick={() => setShowContractForm(false)}>Cancel</Button>
              <Button onClick={() => { handleGenerateContract(); setShowContractForm(false); setContractEmployee(''); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-indigo-200">
                <FileText className="h-4 w-4" /> Download Document
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Split Interface */}
      <div className="grid gap-6 md:grid-cols-12 items-start opacity-100">

        {/* Left Column: Active Employees (Compact Version) */}
        <Card className="md:col-span-5 lg:col-span-4 border-none shadow-sm bg-white overflow-hidden flex flex-col h-[600px]">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-5 space-y-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>{leftTab === 'Active' ? 'Active Employees' : 'Pending Employees'}</span>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5">{leftTab === 'Active' ? activeEmployees.length : (pendingNewHire ? 1 : 0)}</Badge>
            </CardTitle>
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg max-w-full">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${leftTab === 'Active' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setLeftTab('Active')}
              >
                Active Employees
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${leftTab === 'Pending' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setLeftTab('Pending')}
              >
                Pending Employees
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={`Search ${leftTab === 'Active' ? 'active' : 'pending'} employees...`}
                className="pl-9 bg-slate-50/50 border-slate-200/60 h-9 text-sm focus-visible:ring-indigo-500/50 rounded-lg shadow-inner"
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
            {leftTab === 'Active' ? (
              filteredActiveEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center space-y-3">
                  <Building className="h-10 w-10 text-slate-200" />
                  <p className="text-sm">No active employees to list.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredActiveEmployees.map((emp) => (
                    <div key={emp.id} className={`p-4 hover:bg-slate-50 transition-colors group relative cursor-pointer ${viewingHistoryEmployee?.id === emp.id ? 'bg-indigo-50/50 outline outline-1 outline-indigo-200' : ''}`} onClick={() => handleViewHistory(emp)}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0 border border-indigo-100/50 shadow-sm">
                          {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-semibold text-slate-800 text-sm truncate">{emp.surname} {emp.firstname}</p>
                          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              !filteredPendingHire ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center space-y-3">
                  <UserPlus className="h-10 w-10 text-slate-200" />
                  <p className="text-sm">No pending hires currently active.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <div key={filteredPendingHire.id} className={`p-4 hover:bg-slate-50 transition-colors group relative cursor-pointer ${!viewingHistoryEmployee && activeTaskType === 'Onboarding' ? 'bg-amber-50/50 outline outline-1 outline-amber-200' : ''}`} onClick={() => setViewingHistoryEmployee(null)}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-amber-100 to-yellow-50 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0 border border-amber-100/50 shadow-sm">
                        {filteredPendingHire.firstname.charAt(0)}{filteredPendingHire.surname.charAt(0)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-slate-800 text-sm truncate">{filteredPendingHire.surname} {filteredPendingHire.firstname}</p>
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5 truncate">{filteredPendingHire.position}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Badge variant="outline" className="w-full flex justify-center text-amber-600 border-amber-200 bg-amber-50 h-8 text-xs font-semibold shadow-sm">
                        <Clock className="h-3 w-3 mr-1.5" /> Pending Onboarding
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Right Column: Roadmap / Progress View */}
        <Card className="md:col-span-7 lg:col-span-8 border-none shadow-lg bg-white overflow-hidden min-h-[600px] flex flex-col ring-1 ring-slate-100 relative">

          {/* Decorative background blur */}
          {activeTaskType === 'Onboarding' && <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/[0.03] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>}
          {activeTaskType === 'Offboarding' && <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/[0.04] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>}

          <CardHeader className="border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Badge variant="outline" className={`rounded-md font-bold text-[10px] tracking-widest uppercase border-0 text-white ${viewingHistoryEmployee ? 'bg-emerald-500' : activeTaskType === 'Offboarding' ? 'bg-red-500' : activeTaskType === 'Onboarding' ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                {viewingHistoryEmployee ? 'Completed History' : activeTaskType || 'Waiting for action'}
              </Badge>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-800 flex items-center flex-wrap gap-2">
                    Roadmap Progress
                    {viewingHistoryEmployee && <span className="text-lg font-medium text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg">({viewingHistoryEmployee.firstname} {viewingHistoryEmployee.surname})</span>}
                    {!viewingHistoryEmployee && activeTaskType === 'Onboarding' && pendingNewHire && <span className="text-lg font-medium text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">({pendingNewHire.firstname} {pendingNewHire.surname})</span>}
                    {!viewingHistoryEmployee && activeTaskType === 'Offboarding' && pendingOffboard && <span className="text-lg font-medium text-red-500 bg-red-50 px-3 py-1 rounded-lg">({pendingOffboard.firstname} {pendingOffboard.surname})</span>}
                  </CardTitle>
                  {totalTasks > 0 && (
                    <p className="text-sm font-medium text-slate-400 mt-1">
                      {completedTasks} of {totalTasks} milestones completed
                    </p>
                  )}
                </div>
                {viewingHistoryEmployee && priv.canDelete && (
                  <Button className="shrink-0 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold shadow-sm w-fit mr-4" onClick={() => {
                    setOffboardEmployeeId(viewingHistoryEmployee.id);
                    setShowOffboardForm(true);
                    setShowNewHireForm(false);
                    setShowContractForm(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>
                    <UserMinus className="h-4 w-4 mr-2" /> Start Offboarding
                  </Button>
                )}
              </div>
            </div>

            {totalTasks > 0 && (
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-3xl font-black tracking-tighter" style={{ color: viewingHistoryEmployee ? '#10b981' : activeTaskType === 'Offboarding' ? '#ef4444' : '#4f46e5' }}>{progress}%</span>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-700 ease-out ${viewingHistoryEmployee ? 'bg-emerald-500' : activeTaskType === 'Offboarding' ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-6 sm:p-8 flex-1 bg-slate-50/30">
            {totalTasks > 0 ? (
              <div className="space-y-0 relative ml-2">
                {/* Visual Timeline Track */}
                <div className="absolute top-6 bottom-6 left-5 w-0.5 bg-slate-100 rounded-full"></div>

                {displayTasks.map((task, index) => (
                  <div key={task.id} className="relative pl-14 pr-4 py-4 hover:bg-white rounded-2xl transition-all group">

                    {/* Status Node */}
                    <button
                      className={`absolute left-2.5 top-5 h-6 w-6 rounded-full flex items-center justify-center border-2 bg-white transition-all shadow-sm transform group-hover:scale-110
                        ${task.status === 'Completed'
                          ? 'border-emerald-500 text-emerald-500'
                          : task.status === 'In Progress'
                            ? (activeTaskType === 'Offboarding' ? 'border-red-400 text-red-400' : 'border-amber-400 text-amber-500')
                            : 'border-slate-200 text-transparent hover:border-slate-300'
                        }`}
                      onClick={() => !viewingHistoryEmployee && toggleTaskStatus(task.id)}
                    >
                      {task.status === 'Completed' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      {task.status === 'In Progress' && <div className="h-2 w-2 rounded-full bg-current"></div>}
                    </button>

                    {/* Task Content Box */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-100 p-4 rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                      <div>
                        <h4 className={`text-sm font-bold transition-colors ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            <Users className="h-3 w-3 text-slate-400" />
                            {task.assignee}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.date}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-6 border-0 ${task.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                          task.status === 'In Progress' ? (activeTaskType === 'Offboarding' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600') :
                            'bg-slate-100 text-slate-400'
                          }`}>
                          {task.status}
                        </Badge>
                        {!viewingHistoryEmployee && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-semibold px-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 ml-auto"
                            onClick={() => toggleTaskStatus(task.id)}
                          >
                            {task.status === 'Completed' ? 'Undo' : 'Mark Done'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 px-6 h-full flex flex-col items-center justify-center">
                <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
                  <div className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-full animate-[spin_10s_linear_infinite]"></div>
                  <FileText className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">No active roadmap.</h3>
                <p className="text-slate-500 text-sm max-w-sm mb-8 leading-relaxed">
                  Start a New Hire or select an active employee from the left panel to begin an offboarding checklist.
                </p>
                <div className="flex gap-4">
                  <Button variant="outline" className="text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm" onClick={() => { setShowNewHireForm(true); setShowOffboardForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    Add Employee
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom styles for thinner scrollbar in the left pane */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e2e8f0;
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
