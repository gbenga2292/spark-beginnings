import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { UserPlus, ArrowRight, Check, ArrowLeft, Info } from 'lucide-react';
import { useAppStore, Employee, MonthlySalary, OnboardingTask } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';

export function NewHire() {
  const departments = useAppStore((state) => state.departments);
  const positions = useAppStore((state) => state.positions);
  const departmentTasksList = useAppStore((state) => state.departmentTasksList);
  const addEmployee = useAppStore((state) => state.addEmployee);
  const navigate = useNavigate();
  const { createMainTask, addReminder } = useAppData();
  const { user } = useAuth();

  const [newHireData, setNewHireData] = useState<Partial<Employee>>({
    firstname: '',
    surname: '',
    department: '',
    position: '',
    staffType: 'INTERNAL',
    startDate: '',
    tentativeStartDate: '',
    probationPeriod: undefined,
    noOfGuarantors: 1,
    monthlySalaries: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 }
  });

  const handleStartNewHire = async () => {
    if (!newHireData.firstname || !newHireData.surname || !newHireData.tentativeStartDate || !newHireData.department || !newHireData.position) {
      toast.error('Please fill in all basic employee details and tentative start date.');
      return;
    }

    const noOfGuarantors = newHireData.noOfGuarantors ?? 1;

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

    const start = new Date(newHireData.tentativeStartDate as string);
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

    // Create MainTask in Task ecosystem
    let onboardingMainTaskId = undefined;
    if (createMainTask && user) {
      try {
        const subTasksForCreation = combinedTasks.map((task, index) => {
          const taskDate = new Date(start);
          taskDate.setDate(start.getDate() + index);
          return {
            title: task.title,
            description: `Onboarding task for ${newHireData.firstname} ${newHireData.surname}`,
            status: index === 0 ? 'in_progress' : 'not_started',
            deadline: taskDate.toISOString(),
            priority: 'medium',
            assignedTo: user.id, // assign to the creator (HR) for now
          };
        });

        const mTask = await createMainTask(
          {
            title: `Onboarding: ${newHireData.firstname} ${newHireData.surname}`,
            description: `Auto-generated onboarding workflow for ${newHireData.department} - ${newHireData.position}`,
            assignedTo: user.id,
            priority: 'high',
            deadline: start.toISOString(),
          },
          subTasksForCreation
        );
        onboardingMainTaskId = mTask?.id;
        
        // Also fire a global reminder in the Task manager
        if (addReminder) {
          const reminderStart = new Date(start);
          // Set reminder to fire at 8:00 AM on the start date
          reminderStart.setHours(8, 0, 0, 0);
          await addReminder({
            title: `Start Date: ${newHireData.firstname} ${newHireData.surname}`,
            body: `${newHireData.firstname} ${newHireData.surname} is tentatively starting today (${newHireData.department} - ${newHireData.position}). Please ensure workspace readiness.`,
            remindAt: reminderStart.toISOString(),
            frequency: 'once',
            recipientIds: [user.id],
            createdBy: user.id,
            isActive: true,
            sendEmail: false,
            mainTaskId: onboardingMainTaskId
          });
        }
      } catch (err) {
        console.error("Failed to create onboarding main task", err);
      }
    }

    // Initialize guarantor slots
    const guarantorSlots = Array.from({ length: noOfGuarantors }, () => ({ name: '', phone: '', verified: false }));

    const finalEmployee: Employee = {
      id: crypto.randomUUID(),
      employeeCode: `EMP-${Date.now().toString().slice(-6)}`,
      surname: (newHireData.surname as string).toUpperCase(),
      firstname: (newHireData.firstname as string).toUpperCase(),
      department: newHireData.department as string,
      staffType: newHireData.staffType as 'INTERNAL' | 'EXTERNAL',
      position: newHireData.position as string,
      startDate: newHireData.tentativeStartDate as string, // used as the main date until verified
      tentativeStartDate: newHireData.tentativeStartDate as string,
      verifiedStartDate: '',
      endDate: '',
      yearlyLeave: 20,
      bankName: '', accountNo: '', taxId: '', pensionNumber: '', payeNumber: '',
      payeTax: true, withholdingTax: false,
      status: 'Onboarding',
      monthlySalaries: newHireData.monthlySalaries as MonthlySalary,
      onboardingTasks: newTasks,
      onboardingMainTaskId,
      probationPeriod: newHireData.probationPeriod,
      noOfGuarantors,
      onboardingChecklist: {
        emailFormsSent: false,
        emailFormsAcknowledged: false,
        formsReturned: false,
        guarantorFormsReturned: false,
        personalEmployeeFormReturned: false,
        passportReturned: false,
        guarantors: guarantorSlots,
        passportPhotos: false,
        addressVerification: false,
        educationalCredentials: false,
        bankName: '',
        accountNo: '',
        accountDetailsVerified: false,
        pensionVerified: false,
        pensionNumberInput: '',
        payeVerified: false,
        payeNumberInput: '',
        verifiedStartDate: '',
        employmentLettersIssued: false,
        orientationDone: false,
        ppeHandbookIssued: false,
      },
    };

    addEmployee(finalEmployee);
    toast.success('Onboarding process started! The employee has been saved as pending.');
    navigate('/onboarding');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10 w-full animate-in fade-in duration-300 pt-6">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" onClick={() => navigate('/onboarding')} className="gap-2 text-slate-500 hover:text-slate-800 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      <Card className="border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-400"></div>
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 pt-6 px-6 flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-indigo-500" /> Start New Hire
            </CardTitle>
            <CardDescription className="mt-1 pb-0">Configure basic details to generate the onboarding roadmap and save as a pending employee.</CardDescription>
          </div>
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

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Staff Type</label>
              <select className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={newHireData.staffType} onChange={(e) => setNewHireData({ ...newHireData, staffType: e.target.value as 'INTERNAL' | 'EXTERNAL' })}>
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                Tentative Start Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                value={newHireData.tentativeStartDate}
                onChange={(e) => setNewHireData({ ...newHireData, tentativeStartDate: e.target.value })}
              />
              <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" /> This is a tentative date. The verified start date will be confirmed during onboarding.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Probation Period (Days)</label>
              <Input
                type="number"
                min={0}
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder="e.g. 90"
                value={newHireData.probationPeriod ?? ''}
                onChange={(e) => setNewHireData({ ...newHireData, probationPeriod: e.target.value ? Number(e.target.value) : undefined })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Leave blank if not applicable.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                No. of Guarantors Required <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={5}
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder="e.g. 2"
                value={newHireData.noOfGuarantors ?? 1}
                onChange={(e) => setNewHireData({ ...newHireData, noOfGuarantors: Math.max(1, Number(e.target.value)) })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Number of guarantor forms the employee must submit.</p>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-4 mt-6 items-center">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 h-10 w-10 flex items-center justify-center shrink-0">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm text-indigo-900 leading-relaxed">
              This profile will be saved to the database immediately with a <strong>Pending Onboarding</strong> status. The employee will not appear on active payroll or attendance until all required onboarding tasks are completed and they are formally activated.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <Button variant="ghost" className="text-slate-500 hover:text-slate-700 font-medium" onClick={() => navigate('/onboarding')}>Cancel</Button>
            <Button onClick={handleStartNewHire} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-indigo-200">
              <ArrowRight className="h-4 w-4" /> Save Pending Hire
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

