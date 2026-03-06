import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { CheckCircle2, Circle, Clock, FileText, Mail, UserPlus, Plus, X, Trash2, Save } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';

interface OnboardingTask {
  id: string;
  title: string;
  assignee: string;
  status: 'Completed' | 'In Progress' | 'Pending';
  date: string;
  position: string;
}

export function Onboarding() {
  const employees = useAppStore((state) => state.employees);
  const sites = useAppStore((state) => state.sites);
  const [showNewHireForm, setShowNewHireForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([]);

  // Get active employees for display
  const activeEmployees = employees.filter(e => e.status === 'Active').slice(0, 2);

  // Default tasks for new hires
  const defaultTasks = [
    { title: 'Send Offer Letter', assignee: 'HR Team' },
    { title: 'Background Check', assignee: 'External Agency' },
    { title: 'IT Equipment Setup', assignee: 'IT Support' },
    { title: 'Welcome Email & Accounts', assignee: 'IT Support' },
    { title: 'First Day Orientation', assignee: 'HR Team' },
    { title: 'Assign to Site', assignee: 'Operations' },
    { title: 'Create Payroll Profile', assignee: 'Finance' },
  ];

  const handleStartNewHire = () => {
    if (!selectedEmployee || !startDate) {
      toast.error('Please select an employee and start date');
      return;
    }

    const emp = employees.find(e => e.id === selectedEmployee);
    if (!emp) return;

    // Create tasks for the new hire with string dates
    const newTasks: OnboardingTask[] = defaultTasks.map((task, index) => {
      const start = new Date(startDate);
      const taskDate = new Date(start);
      taskDate.setDate(start.getDate() + index);
      return {
        id: `task-${Date.now()}-${index}`,
        title: task.title,
        assignee: task.assignee,
        status: index === 0 ? 'In Progress' : 'Pending',
        date: taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        position: emp.position
      };
    });

    setOnboardingTasks([...onboardingTasks, ...newTasks]);
    setShowNewHireForm(false);
    setSelectedEmployee('');
    setStartDate('');
  };

  const toggleTaskStatus = (taskId: string) => {
    setOnboardingTasks(tasks => tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status: task.status === 'Completed' ? 'Pending' :
            task.status === 'In Progress' ? 'Completed' : 'In Progress'
        };
      }
      return task;
    }));
  };

  const [contractEmployee, setContractEmployee] = useState<string>('');

  const handleGenerateContract = () => {
    if (!contractEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    const emp = employees.find(e => e.id === contractEmployee);
    if (!emp) return;
    const contractContent = `
EMPLOYMENT CONTRACT
================================================================================
DCEL NIGERIA LIMITED
================================================================================

This Employment Contract ("Contract") is entered into as of ${new Date().toLocaleDateString()}

BETWEEN:
DCEL Nigeria Limited ("the Company")
AND:
${emp.surname} ${emp.firstname} ("the Employee")

POSITION AND DUTIES
-------------------
Position: ${emp.position}
Department: ${emp.department}
Start Date: ${emp.startDate || 'To be determined'}

COMPENSATION
------------
The Employee shall be entitled to the following compensation:
- Monthly Salary: ₦${(emp.monthlySalaries.jan || 0).toLocaleString()}
- Annual Salary: ₦${Object.values(emp.monthlySalaries).reduce((a: number, b: number) => a + b, 0).toLocaleString()}

TAX AND DEDUCTIONS
-----------------
- PAYE Tax: ${emp.payeTax ? 'Applicable' : 'Not Applicable'}
- Withholding Tax: ${emp.withholdingTax ? 'Applicable' : 'Not Applicable'}
- Pension Number: ${emp.pensionNumber || 'N/A'}

BANK DETAILS
------------
Bank Name: ${emp.bankName || 'N/A'}
Account Number: ${emp.accountNo || 'N/A'}

LEAVE ENTITLEMENT
-----------------
Annual Leave: ${emp.yearlyLeave} days

TERMS AND CONDITIONS
-------------------
1. This Contract is subject to the terms and conditions of the Company's 
   Employee Handbook and policies as may be amended from time to time.

2. Either party may terminate this Contract by giving the required notice 
   period as specified in the Company's policies.

3. The Employee agrees to maintain confidentiality of all Company information.

4. This Contract shall be governed by the laws of the Federal Republic of 
   Nigeria.

--------------------------------------------------------------------------------

Signed for and on behalf of the Company:
_______________________________________
Authorized Signatory

Date: ___________________

--------------------------------------------------------------------------------

Signed by the Employee:
_______________________________________
${emp.surname} ${emp.firstname}

Date: ___________________

================================================================================
Generated by DCEL HR System on ${new Date().toLocaleString()}
================================================================================
    `.trim();

    const blob = new Blob([contractContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Employment_Contract_${emp.surname}_${emp.firstname.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Contract generated for ${emp.surname} ${emp.firstname}!`);
  };

  const completedTasks = onboardingTasks.filter(t => t.status === 'Completed').length;
  const totalTasks = onboardingTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Onboarding & Offboarding</h1>
          <p className="text-slate-500 mt-2">Manage employee transitions, tasks, and documentation.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={handleGenerateContract}>
            <FileText className="h-4 w-4" />
            Generate Contract (Word)
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowNewHireForm(true)}>
            <UserPlus className="h-4 w-4" />
            Start New Hire
          </Button>
        </div>
      </div>

      {/* New Hire Form */}
      {showNewHireForm && (
        <Card className="border-t-4 border-t-indigo-600 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4 flex flex-row justify-between items-center">
            <CardTitle className="text-indigo-900 text-xl">Start New Hire Onboarding</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowNewHireForm(false)}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Employee</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} - {emp.position}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Default Onboarding Tasks:</h4>
              <ul className="text-sm text-slate-500 space-y-1">
                {defaultTasks.map((task, i) => (
                  <li key={i}>• {task.title} (Assigned to: {task.assignee})</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline" onClick={() => setShowNewHireForm(false)}>Cancel</Button>
              <Button onClick={handleStartNewHire} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Save className="h-4 w-4" /> Start Onboarding
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Active Employees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{emp.surname} {emp.firstname}</p>
                    <p className="text-xs text-slate-500">{emp.position}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-indigo-600 border-indigo-200">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle>Onboarding Progress</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {totalTasks > 0 ? `${completedTasks} of ${totalTasks} tasks completed (${progress}%)` : 'No active onboarding'}
              </p>
            </div>
            {totalTasks > 0 && (
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-4 w-4" /> Send Reminder
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            {totalTasks > 0 ? (
              <div className="space-y-6">
                {onboardingTasks.map((task, index) => (
                  <div key={task.id} className="flex items-start gap-4 relative">
                    {index !== onboardingTasks.length - 1 && (
                      <div className="absolute left-2.5 top-6 bottom-[-1.5rem] w-px bg-slate-200" />
                    )}
                    <button
                      className="relative z-10 mt-0.5"
                      onClick={() => toggleTaskStatus(task.id)}
                    >
                      {task.status === 'Completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 bg-white cursor-pointer" />
                      ) : task.status === 'In Progress' ? (
                        <Clock className="h-5 w-5 text-amber-500 bg-white cursor-pointer" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300 bg-white cursor-pointer hover:text-indigo-500" />
                      )}
                    </button>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium text-sm cursor-pointer ${task.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-900'}`}
                          onClick={() => toggleTaskStatus(task.id)}>
                          {task.title}
                        </p>
                        <span className="text-xs text-slate-500">{task.date}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Assigned to: {task.assignee}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <UserPlus className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No active onboarding. Click "Start New Hire" to begin.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Statistics */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{employees.length}</div>
            <p className="text-xs text-slate-500 mt-1">In system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {employees.filter(e => e.status === 'Active').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Currently working</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">On Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {employees.filter(e => e.status === 'On Leave').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">On leave</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Terminated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {employees.filter(e => e.status === 'Terminated').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">No longer active</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
