import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { computeWorkDays, MONTH_INDEX } from '@/src/lib/workdays';
import { toast } from '@/src/components/ui/toast';

export function Variables() {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const positions = useAppStore((state) => state.positions);
  const departments = useAppStore((state) => state.departments);
  const clients = useAppStore((state) => state.clients);
  const addPosition = useAppStore((state) => state.addPosition);
  const removePosition = useAppStore((state) => state.removePosition);
  const addDepartment = useAppStore((state) => state.addDepartment);
  const removeDepartment = useAppStore((state) => state.removeDepartment);
  const addClient = useAppStore((state) => state.addClient);
  const removeClient = useAppStore((state) => state.removeClient);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const updatePayrollVariables = useAppStore((state) => state.updatePayrollVariables);
  const monthValues = useAppStore((state) => state.monthValues);
  const updateMonthValue = useAppStore((state) => state.updateMonthValue);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const addPublicHoliday = useAppStore((state) => state.addPublicHoliday);
  const removePublicHoliday = useAppStore((state) => state.removePublicHoliday);
  const payeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const updatePayeTaxVariables = useAppStore((state) => state.updatePayeTaxVariables);
  const addPayeTaxExtraCondition = useAppStore((state) => state.addPayeTaxExtraCondition);
  const updatePayeTaxExtraCondition = useAppStore((state) => state.updatePayeTaxExtraCondition);
  const removePayeTaxExtraCondition = useAppStore((state) => state.removePayeTaxExtraCondition);
  const addTaxBracket = useAppStore((state) => state.addTaxBracket);
  const updateTaxBracket = useAppStore((state) => state.updateTaxBracket);
  const removeTaxBracket = useAppStore((state) => state.removeTaxBracket);
  const departmentTasksList = useAppStore((state) => state.departmentTasksList);
  const updateDepartmentTasks = useAppStore((state) => state.updateDepartmentTasks);

  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState('');
  const [newBracketLabel, setNewBracketLabel] = useState('');
  const [newBracketUpTo, setNewBracketUpTo] = useState('');
  const [newBracketRate, setNewBracketRate] = useState('');

  const [taskDeptFilter, setTaskDeptFilter] = useState('ALL');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [taskDirection, setTaskDirection] = useState<'onboarding' | 'offboarding'>('onboarding');

  // Payroll year is always the current year
  const payrollYear = new Date().getFullYear();

  // Build a set of holiday date strings for workday computation
  const holidayDateStrings = useMemo(
    () => publicHolidays.map(h => h.date),
    [publicHolidays]
  );

  const monthsList = [
    { key: 'jan', label: 'January' },
    { key: 'feb', label: 'February' },
    { key: 'mar', label: 'March' },
    { key: 'apr', label: 'April' },
    { key: 'may', label: 'May' },
    { key: 'jun', label: 'June' },
    { key: 'jul', label: 'July' },
    { key: 'aug', label: 'August' },
    { key: 'sep', label: 'September' },
    { key: 'oct', label: 'October' },
    { key: 'nov', label: 'November' },
    { key: 'dec', label: 'December' },
  ];

  const [newPosition, setNewPosition] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newClient, setNewClient] = useState('');

  const handleAddHoliday = () => {
    if (!newDate || !newName) return;
    addPublicHoliday({ id: Math.random().toString(36).slice(2), date: newDate, name: newName });
    setNewDate('');
    setNewName('');
  };

  const handleRemoveHoliday = (id: string) => {
    removePublicHoliday(id);
  };

  const handleAddPosition = () => {
    if (newPosition && !positions.includes(newPosition)) {
      addPosition(newPosition);
      setNewPosition('');
    }
  };

  const handleAddDepartment = () => {
    if (newDepartment && !departments.includes(newDepartment)) {
      addDepartment(newDepartment);
      setNewDepartment('');
    }
  };

  const handleSave = () => {
    // In a real app, this would save to the backend/store
    toast.success('Variables saved successfully!');
  };

  const handleAddTask = () => {
    if (!newTaskTitle || !newTaskAssignee) return;
    const currentTasks = departmentTasksList.find(d => d.department === taskDeptFilter) ||
      { department: taskDeptFilter, onboardingTasks: [], offboardingTasks: [] };

    if (taskDirection === 'onboarding') {
      currentTasks.onboardingTasks.push({ title: newTaskTitle, assignee: newTaskAssignee });
    } else {
      currentTasks.offboardingTasks.push({ title: newTaskTitle, assignee: newTaskAssignee });
    }
    updateDepartmentTasks(currentTasks);
    setNewTaskTitle('');
    setNewTaskAssignee('');
  };

  const handleRemoveTask = (title: string, direction: 'onboarding' | 'offboarding') => {
    const currentTasks = departmentTasksList.find(d => d.department === taskDeptFilter);
    if (!currentTasks) return;

    if (direction === 'onboarding') {
      currentTasks.onboardingTasks = currentTasks.onboardingTasks.filter(t => t.title !== title);
    } else {
      currentTasks.offboardingTasks = currentTasks.offboardingTasks.filter(t => t.title !== title);
    }
    updateDepartmentTasks(currentTasks);
  };

  const currentTaskView = departmentTasksList.find(d => d.department === taskDeptFilter) ||
    { department: taskDeptFilter, onboardingTasks: [], offboardingTasks: [] };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-400">
            System Variables
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Configure global application variables, templates, and statutory parameters.</p>
        </div>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold gap-2 transition-all">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* --- LEFT COLUMN --- */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Public Holidays</CardTitle>
              <CardDescription>Dates defined here are used to calculate OT in the Daily Register.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-2 mb-4">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  placeholder="Holiday Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddHoliday} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead className="w-16 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publicHolidays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-slate-500 py-4">No holidays defined.</TableCell>
                      </TableRow>
                    ) : (
                      publicHolidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell className="font-medium">{holiday.date}</TableCell>
                          <TableCell>{holiday.name}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveHoliday(holiday.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* --- MOVED POSITIONS --- */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Positions</CardTitle>
              <CardDescription>Manage available job positions for employees.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="New Position" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} className="flex-1" />
                <Button onClick={handleAddPosition} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {positions.map(pos => (
                  <div key={pos} className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                    {pos}
                    <button onClick={() => removePosition(pos)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* --- MOVED DEPARTMENTS --- */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>Manage available departments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="New Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1" />
                <Button onClick={handleAddDepartment} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {departments.map(dep => (
                  <div key={dep} className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                    {dep}
                    <button onClick={() => removeDepartment(dep)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* --- MOVED TASK TEMPLATES --- */}
          <Card className="shadow-sm border-slate-200 border-t-4 border-t-indigo-500">
            <CardHeader className="bg-indigo-50/30 rounded-t-lg border-b border-indigo-100">
              <CardTitle className="text-indigo-900">Task Templates</CardTitle>
              <CardDescription>Configure default onboarding/offboarding tasks by department.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex gap-2 mb-4">
                <select className="flex-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer" value={taskDeptFilter} onChange={(e) => setTaskDeptFilter(e.target.value)}>
                  <option value="ALL">ALL DEPARTMENTS (Always added)</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="w-40 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer" value={taskDirection} onChange={(e) => setTaskDirection(e.target.value as 'onboarding' | 'offboarding')}>
                  <option value="onboarding">Onboarding</option>
                  <option value="offboarding">Offboarding</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Task Title (e.g. Provide Laptop)" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1" />
                <Input placeholder="Assignee (e.g. IT)" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} className="w-32" />
                <Button variant="outline" onClick={handleAddTask} className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead>Task Title</TableHead>
                      <TableHead className="w-40">Assignee</TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskDirection === 'onboarding' ? (
                      currentTaskView.onboardingTasks.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4">No specific onboarding tasks.</TableCell></TableRow>
                      ) : (
                        currentTaskView.onboardingTasks.map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell className="text-slate-500">{t.assignee}</TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'onboarding')}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    ) : (
                      currentTaskView.offboardingTasks.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4">No specific offboarding tasks.</TableCell></TableRow>
                      ) : (
                        currentTaskView.offboardingTasks.map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell className="text-slate-500">{t.assignee}</TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'offboarding')}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div> {/* END LEFT COLUMN */}

        {/* --- RIGHT COLUMN --- */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Payroll Breakdown Variables (%)</CardTitle>
              <CardDescription>Adjust the percentage breakdown for components of basic salary and automated deductions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Basic Salary</label>
                  <Input
                    type="number"
                    value={payrollVariables.basic}
                    onChange={e => updatePayrollVariables({ basic: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Housing</label>
                  <Input
                    type="number"
                    value={payrollVariables.housing}
                    onChange={e => updatePayrollVariables({ housing: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Transport</label>
                  <Input
                    type="number"
                    value={payrollVariables.transport}
                    onChange={e => updatePayrollVariables({ transport: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Other Allowances</label>
                  <Input
                    type="number"
                    value={payrollVariables.otherAllowances}
                    onChange={e => updatePayrollVariables({ otherAllowances: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Employee Pension Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={payrollVariables.employeePensionRate}
                    onChange={e => updatePayrollVariables({ employeePensionRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Deducted from employee salary (default 8%)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Employer Pension Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={payrollVariables.employerPensionRate}
                    onChange={e => updatePayrollVariables({ employerPensionRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Company's contribution to pension (default 10%)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Withholding Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(payrollVariables.withholdingTaxRate * 100).toFixed(1)}
                    onChange={e => updatePayrollVariables({ withholdingTaxRate: Number(e.target.value) / 100 })}
                  />
                  <p className="text-xs text-slate-400">Applied when employee has Withholding Tax</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">NSITF Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={payrollVariables.nsitfRate}
                    onChange={e => updatePayrollVariables({ nsitfRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Company's NSITF contribution (1% by default)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">VAT Rate (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={payrollVariables.vatRate}
                    onChange={e => updatePayrollVariables({ vatRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Value Added Tax (7.5% by default)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Config (Workdays &amp; OT Rate)</CardTitle>
              <CardDescription>
                Work days are <strong>auto-computed</strong> from the current year ({payrollYear}) and Public Holidays above (Mon–Sat, excluding Sundays &amp; holidays). Only the OT Rate and TT Allowance % are editable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Start of Mth</TableHead>
                      <TableHead>End of Mth</TableHead>
                      <TableHead className="text-center">Work Days</TableHead>
                      <TableHead>OT Rate</TableHead>
                      <TableHead>TT Allow %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthsList.map(({ key, label }, idx) => {
                      const monthNum = MONTH_INDEX[key];
                      const startDate = new Date(payrollYear, monthNum - 1, 1);
                      const endDate = new Date(payrollYear, monthNum, 0);
                      const computedWorkDays = computeWorkDays(payrollYear, monthNum, holidayDateStrings);
                      const data = monthValues[key] || { workDays: 0, overtimeRate: 0.5 };
                      const ttAllowance = payrollVariables.otherAllowances;
                      const formatDate = (d: Date) =>
                        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-slate-500 text-xs font-mono">{formatDate(startDate)}</TableCell>
                          <TableCell className="text-slate-500 text-xs font-mono">{formatDate(endDate)}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center h-8 w-16 rounded bg-indigo-50 text-indigo-700 font-bold text-sm">
                              {computedWorkDays}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              className="w-24 h-8"
                              value={data.overtimeRate}
                              onChange={e => updateMonthValue(key, { workDays: computedWorkDays, overtimeRate: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center justify-center h-8 w-16 rounded bg-slate-50 text-slate-600 font-semibold text-sm">
                              {ttAllowance}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── PAYE Tax Variables ─────────────────────────────────── */}
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50/50 rounded-t-lg border-b border-amber-100">
              <CardTitle className="text-amber-900">PAYE Tax Variables (NIGERIATAX)</CardTitle>
              <CardDescription>
                These values drive the <code className="text-xs bg-amber-100 px-1 rounded">NIGERIATAX()</code> function.
                CRA = <em>CRA Base + Pension Contribution</em>. Taxable = AnnualGross &minus; CRA.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">

              {/* CRA & Pension Rate */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Consolidated Relief Allowance (CRA)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">CRA Base (₦)</label>
                    <Input type="number" value={payeTaxVariables.craBase}
                      onChange={e => updatePayeTaxVariables({ craBase: Number(e.target.value) })} />
                    <p className="text-xs text-slate-400">Fixed statutory amount (default ₦800,000)</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Rent Relief Rate (%)</label>
                    <Input type="number" step="0.1" value={(payeTaxVariables.rentReliefRate * 100).toFixed(1)}
                      onChange={e => updatePayeTaxVariables({ rentReliefRate: Number(e.target.value) / 100 })} />
                    <p className="text-xs text-slate-400">Applied to input Rent to compute Relief (default 20%)</p>
                  </div>
                </div>
              </div>

              {/* Tax Brackets — fully dynamic, add/remove/edit */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Tax Brackets (Annual Taxable Income)</p>
                <div className="border rounded-md overflow-hidden mb-3">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Up To (₦) <span className="text-slate-400 font-normal text-xs italic">— blank = top bracket</span></TableHead>
                        <TableHead>Rate (%)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...payeTaxVariables.taxBrackets]
                        .sort((a, b) => {
                          if (a.upTo === null) return 1;
                          if (b.upTo === null) return -1;
                          return a.upTo - b.upTo;
                        })
                        .map(b => (
                          <TableRow key={b.id}>
                            <TableCell>
                              <Input className="h-8 w-36" value={b.label}
                                onChange={e => updateTaxBracket(b.id, { label: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-36"
                                placeholder="(top bracket)"
                                value={b.upTo !== null ? b.upTo : ''}
                                onChange={e => updateTaxBracket(b.id, { upTo: e.target.value === '' ? null : Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.1" className="h-8 w-24"
                                value={(b.rate * 100).toFixed(1)}
                                onChange={e => updateTaxBracket(b.id, { rate: Number(e.target.value) / 100 })} />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                onClick={() => removeTaxBracket(b.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Add new bracket row */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Label</label>
                    <Input placeholder="e.g. Next ₦9m" value={newBracketLabel}
                      onChange={e => setNewBracketLabel(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Up To (₦) <span className="text-slate-400 font-normal italic">blank=top</span></label>
                    <Input type="number" placeholder="11200000" className="w-36" value={newBracketUpTo}
                      onChange={e => setNewBracketUpTo(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Rate (%)</label>
                    <Input type="number" step="0.1" placeholder="18" className="w-24" value={newBracketRate}
                      onChange={e => setNewBracketRate(e.target.value)} />
                  </div>
                  <Button variant="outline" className="gap-1 shrink-0" onClick={() => {
                    if (!newBracketLabel || !newBracketRate) return;
                    addTaxBracket({
                      id: Math.random().toString(36).slice(2),
                      label: newBracketLabel,
                      upTo: newBracketUpTo !== '' ? Number(newBracketUpTo) : null,
                      rate: Number(newBracketRate) / 100,
                    });
                    setNewBracketLabel(''); setNewBracketUpTo(''); setNewBracketRate('');
                  }}>
                    <Plus className="h-4 w-4" /> Add Bracket
                  </Button>
                </div>
              </div>

              {/* Extra Conditions */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Extra CRA Conditions / Allowable Deductions</p>
                <p className="text-xs text-slate-400 mb-3">Amounts here are added to the CRA (reduce taxable income) when enabled.</p>
                <div className="flex gap-2 mb-3">
                  <Input placeholder="Label (e.g. Life Insurance Relief)" value={newExtraLabel}
                    onChange={e => setNewExtraLabel(e.target.value)} className="flex-1" />
                  <Input type="number" placeholder="₦ Amount" value={newExtraAmount}
                    onChange={e => setNewExtraAmount(e.target.value)} className="w-36" />
                  <Button variant="outline" className="gap-1" onClick={() => {
                    if (!newExtraLabel || !newExtraAmount) return;
                    addPayeTaxExtraCondition({ id: Math.random().toString(36).slice(2), label: newExtraLabel, amount: Number(newExtraAmount), enabled: true });
                    setNewExtraLabel(''); setNewExtraAmount('');
                  }}><Plus className="h-4 w-4" /> Add</Button>
                </div>
                {payeTaxVariables.extraConditions.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4 border rounded-md">No extra conditions. Add one above.</p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Amount (₦)</TableHead>
                          <TableHead className="text-center">Enabled</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payeTaxVariables.extraConditions.map(cond => (
                          <TableRow key={cond.id}>
                            <TableCell className="font-medium">{cond.label}</TableCell>
                            <TableCell>
                              <Input type="number" className="w-32 h-8" value={cond.amount}
                                onChange={e => updatePayeTaxExtraCondition(cond.id, { amount: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <input type="checkbox" checked={cond.enabled}
                                onChange={e => updatePayeTaxExtraCondition(cond.id, { enabled: e.target.checked })}
                                className="h-4 w-4 accent-indigo-600" />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                onClick={() => removePayeTaxExtraCondition(cond.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

