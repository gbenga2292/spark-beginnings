import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Clock, FileText, UserPlus, UserMinus, Users, Building, Activity, CalendarDays, Check, Search, AlertCircle, FastForward } from 'lucide-react';
import { useAppStore, Employee, OnboardingTask } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useNavigate } from 'react-router-dom';

export function Onboarding() {
  const employees = useAppStore((state) => state.employees);
  const updateEmployee = useAppStore((state) => state.updateEmployee);

  const priv = usePriv('onboarding');
  const navigate = useNavigate();

  const [leftTab, setLeftTab] = useState<'Active' | 'Pending' | 'Terminated'>('Active');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  // The centrally managed selected employee for viewing roadmap
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const selectedEmployee = useMemo(() => employees.find(e => e.id === selectedEmployeeId) || null, [employees, selectedEmployeeId]);

  const [activeTaskType, setActiveTaskType] = useState<'Onboarding' | 'History' | 'Offboarding' | null>(null);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);
  const pendingEmployees = useMemo(() => employees.filter(e => e.status === 'Onboarding'), [employees]);
  const terminatedEmployees = useMemo(() => employees.filter(e => e.status === 'Terminated'), [employees]);

  const filteredActiveEmployees = useMemo(() => {
    if (!employeeSearchQuery) return activeEmployees;
    const q = employeeSearchQuery.toLowerCase();
    return activeEmployees.filter(e => e.firstname.toLowerCase().includes(q) || e.surname.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
  }, [activeEmployees, employeeSearchQuery]);

  const filteredPendingEmployees = useMemo(() => {
    if (!employeeSearchQuery) return pendingEmployees;
    const q = employeeSearchQuery.toLowerCase();
    return pendingEmployees.filter(e => e.firstname.toLowerCase().includes(q) || e.surname.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
  }, [pendingEmployees, employeeSearchQuery]);

  const filteredTerminatedEmployees = useMemo(() => {
    if (!employeeSearchQuery) return terminatedEmployees;
    const q = employeeSearchQuery.toLowerCase();
    return terminatedEmployees.filter(e => e.firstname.toLowerCase().includes(q) || e.surname.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
  }, [terminatedEmployees, employeeSearchQuery]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployeeId(emp.id);
    if (emp.status === 'Onboarding') {
      setActiveTaskType('Onboarding');
    } else if (emp.status === 'Active') {
      if (emp.onboardingTasks && emp.onboardingTasks.some(t => t.status !== 'Completed')) {
        // They are active but still have pending onboarding tasks!
        setActiveTaskType('Onboarding');
      } else {
        setActiveTaskType('History');
      }
    } else if (emp.status === 'Terminated') {
      setActiveTaskType('Offboarding');
    }
  };

  const hasIncompleteTasks = (tasks?: OnboardingTask[]) => {
    if (!tasks || tasks.length === 0) return false;
    return tasks.some(t => t.status !== 'Completed');
  };

  const handleForceActivate = async (emp: Employee) => {
    const startD = new Date(emp.startDate);
    const today = new Date();
    
    // Normalize to midnight for fair comparison
    startD.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    if (startD > today) {
        const confirm = await showConfirm(`This employee's official start date (${emp.startDate}) is in the future. Are you sure you want to activate them now?`, { confirmLabel: "Activate Anyway" });
        if (!confirm) return;
    }

    updateEmployee(emp.id, { status: 'Active' });
    toast.success(`${emp.firstname} ${emp.surname} has been formally activated! Unfinished tasks will remain flagged.`);
  };

  const toggleTaskStatus = (taskId: string, type: 'onboarding' | 'offboarding') => {
    if (!selectedEmployee) return;

    let targetTasks = type === 'onboarding' ? selectedEmployee.onboardingTasks : selectedEmployee.offboardingTasks;
    if (!targetTasks) return;

    const updatedTasks = targetTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status: task.status === 'Completed' ? 'Pending' :
            task.status === 'In Progress' ? 'Completed' : 'In Progress'
        } as OnboardingTask;
      }
      return task;
    });

    if (type === 'onboarding') {
        const allCompleted = updatedTasks.every(t => t.status === 'Completed');
        let newStatus = selectedEmployee.status;
        
        if (allCompleted && selectedEmployee.status === 'Onboarding') {
            newStatus = 'Active';
            toast.success(`All tasks completed! ${selectedEmployee.firstname} ${selectedEmployee.surname} has transitioned to Active!`);
        }

        updateEmployee(selectedEmployee.id, { 
            onboardingTasks: updatedTasks,
            status: newStatus 
        });
    } else {
        updateEmployee(selectedEmployee.id, { 
            offboardingTasks: updatedTasks
        });
        const allCompleted = updatedTasks.every(t => t.status === 'Completed');
        if (allCompleted) {
             toast.success(`Offboarding completely finished for ${selectedEmployee.firstname} ${selectedEmployee.surname}!`);
        }
    }
  };

  const renderTasks = () => {
    if (!selectedEmployee) return [];
    if (activeTaskType === 'Onboarding' || activeTaskType === 'History') {
       // history is just fully completed onboarding tasks conceptually
       // fallback if no tasks were persisted
       if (!selectedEmployee.onboardingTasks || selectedEmployee.onboardingTasks.length === 0) {
           // Provide dynamic fake history mapping if they are active but old schema
           return [];
       }
       return selectedEmployee.onboardingTasks;
    } else if (activeTaskType === 'Offboarding') {
       return selectedEmployee.offboardingTasks || [];
    }
    return [];
  };

  const displayTasks = renderTasks();
  const completedTasks = displayTasks.filter(t => t.status === 'Completed').length;
  const totalTasks = displayTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in slide-in-from-top-2 fade-in duration-500">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
            Lifecycle & Flow
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage onboarding, offboarding, and seamless employee transitions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {priv.canAdd && (
            <Button variant="outline" className="gap-2 shadow-sm whitespace-nowrap" onClick={() => navigate('/onboarding/contract')}>
              <FileText className="h-4 w-4 text-indigo-500" />
              Generate Contract
            </Button>
          )}
          {priv.canAdd && (
            <Button
              className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all sm:whitespace-nowrap"
              onClick={() => navigate('/onboarding/new')}
            >
              <UserPlus className="h-4 w-4" />
              Start New Hire
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-top-4 fade-in duration-500" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Total Employed', value: employees.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Staff', value: activeEmployees.length, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Hires', value: pendingEmployees.length, icon: CalendarDays, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Terminated', value: terminatedEmployees.length, icon: UserMinus, color: 'text-rose-600', bg: 'bg-rose-50' },
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

      {/* Main Split Interface */}
      <div className="grid gap-6 md:grid-cols-12 items-start opacity-100">

        {/* Left Column: Employees */}
        <Card className="md:col-span-5 lg:col-span-4 border-none shadow-sm bg-white overflow-hidden flex flex-col h-[600px] animate-in slide-in-from-left-4 fade-in duration-500" style={{ animationDelay: '200ms' }}>
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-5 space-y-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
              <span>{leftTab === 'Active' ? 'Active' : leftTab === 'Pending' ? 'Pending' : 'Offboarding'} Directory</span>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5">
                {leftTab === 'Active' ? activeEmployees.length : leftTab === 'Pending' ? pendingEmployees.length : terminatedEmployees.length}
              </Badge>
            </CardTitle>
            <div className="flex p-1 bg-slate-200/50 rounded-lg max-w-full">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${leftTab === 'Active' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setLeftTab('Active')}
              >
                Active
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors relative ${leftTab === 'Pending' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setLeftTab('Pending')}
              >
                Pending
                {pendingEmployees.length > 0 && <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-rose-500 shadow-sm animate-pulse"></span>}
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors relative ${leftTab === 'Terminated' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setLeftTab('Terminated')}
              >
                Offboarding
                {terminatedEmployees.some(e => hasIncompleteTasks(e.offboardingTasks)) && <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-amber-500 shadow-sm animate-pulse"></span>}
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={`Search ${leftTab.toLowerCase()} employees...`}
                className="pl-9 bg-slate-50/50 border-slate-200/60 h-9 text-sm focus-visible:ring-indigo-500/50 rounded-lg shadow-inner"
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* ACTIVE TAB LISTING */}
            {leftTab === 'Active' && (
              filteredActiveEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center space-y-3">
                  <Building className="h-10 w-10 text-slate-200" />
                  <p className="text-sm">No active employees to list.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredActiveEmployees.map((emp) => {
                    const hasPendingTasks = hasIncompleteTasks(emp.onboardingTasks);
                    return (
                    <div key={emp.id} className={`p-4 hover:bg-slate-50 transition-colors group relative cursor-pointer ${selectedEmployeeId === emp.id ? 'bg-indigo-50/50 outline outline-1 outline-indigo-200' : ''}`} onClick={() => handleSelectEmployee(emp)}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0 border border-indigo-100/50 shadow-sm relative">
                          {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                          {hasPendingTasks && (
                              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center">
                                  <AlertCircle className="h-2.5 w-2.5 text-white" />
                              </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                             {emp.surname} {emp.firstname}
                             {hasPendingTasks && <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 border-amber-200 text-amber-600 bg-amber-50">Tasks Pending</Badge>}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )
            )}

            {/* PENDING TAB LISTING */}
            {leftTab === 'Pending' && (
              filteredPendingEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center space-y-3">
                  <UserPlus className="h-10 w-10 text-slate-200" />
                  <p className="text-sm">No pending hires currently active.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredPendingEmployees.map(emp => (
                    <div key={emp.id} className={`p-4 hover:bg-slate-50 transition-colors group relative cursor-pointer ${selectedEmployeeId === emp.id ? 'bg-amber-50/50 outline outline-1 outline-amber-200' : ''}`} onClick={() => handleSelectEmployee(emp)}>
                        <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-amber-100 to-yellow-50 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0 border border-amber-100/50 shadow-sm">
                            {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold text-slate-800 text-sm truncate">{emp.surname} {emp.firstname}</p>
                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p>
                        </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                        <Badge variant="outline" className="w-full flex justify-center text-amber-600 border-amber-200 bg-amber-50 h-8 text-xs font-semibold shadow-sm">
                            <Clock className="h-3 w-3 mr-1.5" /> Awaiting Activation
                        </Badge>
                        </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* TERMINATED LISTING */}
            {leftTab === 'Terminated' && (
              filteredTerminatedEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center space-y-3">
                  <UserMinus className="h-10 w-10 text-slate-200" />
                  <p className="text-sm">No offboarding/terminated employees.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTerminatedEmployees.map((emp) => {
                    const hasPendingTasks = hasIncompleteTasks(emp.offboardingTasks);
                    return (
                    <div key={emp.id} className={`p-4 hover:bg-slate-50 transition-colors group relative cursor-pointer ${selectedEmployeeId === emp.id ? 'bg-red-50/50 outline outline-1 outline-red-200' : ''}`} onClick={() => handleSelectEmployee(emp)}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 shadow-sm relative grayscale">
                          {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                          {hasPendingTasks && (
                              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <AlertCircle className="h-2.5 w-2.5 text-white" />
                              </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className={`font-semibold text-sm truncate flex items-center gap-2 ${hasPendingTasks ? 'text-slate-800' : 'text-slate-500'}`}>
                             {emp.surname} {emp.firstname}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5 truncate">{emp.position}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Badge variant="outline" className={`w-full flex justify-center h-8 text-xs font-semibold shadow-sm ${hasPendingTasks ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                            {hasPendingTasks ? (
                              <><Clock className="h-3 w-3 mr-1.5" /> Offboarding Incomplete</>
                            ) : (
                              <><Check className="h-3 w-3 mr-1.5" /> Completely Offboarded</>
                            )}
                        </Badge>
                      </div>
                    </div>
                  )})}
                </div>
              )
            )}

          </CardContent>
        </Card>

        {/* Right Column: Roadmap / Progress View */}
        <Card className="md:col-span-7 lg:col-span-8 border-none shadow-lg bg-white overflow-hidden min-h-[600px] flex flex-col ring-1 ring-slate-100 relative animate-in slide-in-from-right-4 fade-in duration-500" style={{ animationDelay: '300ms' }}>

          {activeTaskType === 'Onboarding' && <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/[0.03] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>}
          {activeTaskType === 'Offboarding' && <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/[0.04] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>}

          <CardHeader className="border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Badge variant="outline" className={`rounded-md font-bold text-[10px] tracking-widest uppercase border-0 text-white shadow-sm ${activeTaskType === 'History' ? 'bg-emerald-500' : activeTaskType === 'Offboarding' ? 'bg-rose-500' : activeTaskType === 'Onboarding' ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                {activeTaskType || 'Action Center'}
              </Badge>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-800 flex items-center flex-wrap gap-2">
                    Milestone Progress
                    {selectedEmployee && <span className={`text-lg font-medium px-3 py-1 rounded-lg ${selectedEmployee.status === 'Onboarding' ? 'text-indigo-500 bg-indigo-50' : selectedEmployee.status === 'Terminated' ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50'}`}>
                        ({selectedEmployee.firstname} {selectedEmployee.surname})
                    </span>}
                  </CardTitle>
                  {totalTasks > 0 && (
                    <p className="text-sm font-medium text-slate-400 mt-1">
                      {completedTasks} of {totalTasks} milestones completed
                    </p>
                  )}
                  {selectedEmployee?.status === 'Onboarding' && (
                    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg max-w-lg">
                        <p className="text-xs text-indigo-800 font-medium">Scheduled Start Date: <span className="font-bold underline">{selectedEmployee.startDate}</span></p>
                        <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2 h-8 text-xs font-semibold shadow-sm w-full"
                            onClick={() => handleForceActivate(selectedEmployee)}
                        >
                            <FastForward className="w-3.5 h-3.5 mr-1" /> Force Activate Now (Keep Tasks Pending)
                        </Button>
                    </div>
                  )}
                </div>
                {/* Start Offboarding Button -> Redirects to the StartOffboarding page */}
                {selectedEmployee && selectedEmployee.status === 'Active' && priv.canDelete && (
                  <Button className="shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold shadow-sm w-fit mr-4 transition-transform hover:-translate-y-0.5" onClick={() => {
                    navigate('/onboarding/offboard');
                  }}>
                    <UserMinus className="h-4 w-4 mr-2" /> Start Offboarding
                  </Button>
                )}
              </div>
            </div>

            {totalTasks > 0 && (
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-3xl font-black tracking-tighter" style={{ color: activeTaskType === 'History' ? '#10b981' : activeTaskType === 'Offboarding' ? '#f43f5e' : '#4f46e5' }}>{progress}%</span>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div className={`h-full transition-all duration-700 ease-out ${activeTaskType === 'History' ? 'bg-emerald-500' : activeTaskType === 'Offboarding' ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-6 sm:p-8 flex-1 bg-slate-50/30">
            {totalTasks > 0 ? (
              <div className="space-y-0 relative ml-2">
                <div className="absolute top-6 bottom-6 left-5 w-0.5 bg-slate-200 rounded-full"></div>

                {displayTasks.map((task, index) => (
                  <div key={task.id} className="relative pl-14 pr-4 py-4 hover:bg-white rounded-2xl transition-all group">

                    <button
                      className={`absolute left-2.5 top-5 h-6 w-6 rounded-full flex items-center justify-center border-2 bg-white transition-all shadow-sm transform group-hover:scale-110
                        ${task.status === 'Completed'
                          ? 'border-emerald-500 text-emerald-500'
                          : task.status === 'In Progress'
                            ? (activeTaskType === 'Offboarding' ? 'border-rose-400 text-rose-400' : 'border-amber-400 text-amber-500')
                            : 'border-slate-300 text-transparent hover:border-slate-400'
                        }`}
                      onClick={() => activeTaskType !== 'History' && toggleTaskStatus(task.id, activeTaskType === 'Offboarding' ? 'offboarding' : 'onboarding')}
                    >
                      {task.status === 'Completed' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      {task.status === 'In Progress' && <div className="h-2 w-2 rounded-full bg-current"></div>}
                    </button>

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
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-6 border-0 shadow-sm ${task.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                          task.status === 'In Progress' ? (activeTaskType === 'Offboarding' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600') :
                            'bg-slate-100 text-slate-400'
                          }`}>
                          {task.status}
                        </Badge>
                        {activeTaskType !== 'History' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-semibold px-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 ml-auto transition-colors"
                            onClick={() => toggleTaskStatus(task.id, activeTaskType === 'Offboarding' ? 'offboarding' : 'onboarding')}
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
                  <div className="absolute inset-0 border-2 border-dashed border-slate-300 rounded-full animate-[spin_10s_linear_infinite]"></div>
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                {selectedEmployee ? (
                  <>
                     <h3 className="text-xl font-bold text-slate-700 mb-2">No tasks generated.</h3>
                     <p className="text-slate-500 text-sm max-w-sm mb-8 leading-relaxed">
                        This employee does not have any tracked onboarding or offboarding checklists recorded in the system.
                     </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">No active roadmap mapped.</h3>
                    <p className="text-slate-500 text-sm max-w-sm mb-8 leading-relaxed">
                        Navigate the directory on the left or initialize a process below to track checklists in real-time.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-colors" onClick={() => navigate('/onboarding/new')}>
                            Start New Hire Overview
                        </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style>{`
        /* Enhanced Scrollbar for Visibility and Usability */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
          margin: 4px 0;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
          border: 2px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
