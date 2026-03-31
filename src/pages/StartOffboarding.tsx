import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Save, UserMinus, Trash2, ArrowLeft } from 'lucide-react';
import { useAppStore, OnboardingTask } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { useNavigate } from 'react-router-dom';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function StartOffboarding() {
  const employees = useAppStore((state) => state.employees);
  const departmentTasksList = useAppStore((state) => state.departmentTasksList);
  const updateEmployee = useAppStore((state) => state.updateEmployee);
  const navigate = useNavigate();

  const [offboardEmployeeId, setOffboardEmployeeId] = useState('');
  const [offboardEndDate, setOffboardEndDate] = useState('');

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);

  const handleStartOffboarding = () => {
    if (!offboardEmployeeId || !offboardEndDate) {
      toast.error('Please select an employee and their official end date.');
      return;
    }

    const emp = employees.find(e => e.id === offboardEmployeeId);
    if (!emp) return;

    // Validation: make sure we don't terminate someone before they even start
    const startD = new Date(emp.startDate);
    const endD = new Date(offboardEndDate);
    if (endD < startD) {
      toast.error('Termination date cannot be before their official start date.');
      return;
    }

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
        date: formatDisplayDate(taskDate),
      };
    });

    updateEmployee(emp.id, { 
      status: 'Terminated', 
      endDate: offboardEndDate,
      offboardingTasks: offboardTasks 
    });

    toast.success(`${emp.firstname} ${emp.surname} has been terminated. Offboarding checklist initialized.`);
    navigate('/onboarding');
  };

  useSetPageTitle(
    'Initiate Offboarding',
    "Gracefully wrap up an employee's tenure. Selecting them here will remove them from active systems",
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate('/onboarding')} className="gap-2 border-slate-200 h-9">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Button onClick={handleStartOffboarding} className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 h-9 px-4 shadow-sm">
        <Save className="h-4 w-4" /> Terminate
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-10 w-full animate-in fade-in duration-300">
      {/* Mobile-only Action Bar */}
      <div className="flex md:hidden items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/onboarding')} className="gap-2 border-slate-200 h-9">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={handleStartOffboarding} size="sm" className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 h-9 px-4">
          <Save className="h-4 w-4" /> Terminate
        </Button>
      </div>

      <Card className="border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-rose-400"></div>
        <CardContent className="p-8">
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
              <strong>Attention:</strong> Triggering this action will immediately transition the employee to <strong>Terminated</strong>, ripping them from active payroll and attendance grids if the end date is immediate or has passed.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
            <Button variant="ghost" className="text-slate-500 hover:text-slate-700 font-medium" onClick={() => navigate('/onboarding')}>Cancel</Button>
            <Button onClick={handleStartOffboarding} className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-red-200">
              <Save className="h-4 w-4" /> Terminate & Load Roadmap
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

