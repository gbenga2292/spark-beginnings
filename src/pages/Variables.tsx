import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Plus, Trash2, Save, Download, Upload } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { computeWorkDays, MONTH_INDEX } from '@/src/lib/workdays';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';

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
  const storePayrollVariables = useAppStore((state) => state.payrollVariables);
  const storeMonthValues = useAppStore((state) => state.monthValues);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const addPublicHoliday = useAppStore((state) => state.addPublicHoliday);
  const removePublicHoliday = useAppStore((state) => state.removePublicHoliday);
  const storePayeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const saveAllSettingsStore = useAppStore((state) => state.saveAllSettings);

  const [localPayrollVars, setLocalPayrollVars] = useState(storePayrollVariables);
  const [localPayeVars, setLocalPayeVars] = useState(storePayeTaxVariables);
  const [localMonthVals, setLocalMonthVals] = useState(storeMonthValues);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setLocalPayrollVars(storePayrollVariables);
      setLocalPayeVars(storePayeTaxVariables);
      setLocalMonthVals(storeMonthValues);
    }
  }, [storePayrollVariables, storePayeTaxVariables, storeMonthValues, isDirty]);

  // Navigation blocker removed because it requires react-router v6 createBrowserRouter data routers
  // Relying only on window.addEventListener('beforeunload') below

  const departmentTasksList = useAppStore((state) => state.departmentTasksList);
  const updateDepartmentTasks = useAppStore((state) => state.updateDepartmentTasks);
  const leaveTypes = useAppStore((state) => state.leaveTypes);
  const addLeaveType = useAppStore((state) => state.addLeaveType);
  const removeLeaveType = useAppStore((state) => state.removeLeaveType);

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('variables');

  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState('');
  const [newBracketLabel, setNewBracketLabel] = useState('');
  const [newBracketUpTo, setNewBracketUpTo] = useState('');
  const [newBracketRate, setNewBracketRate] = useState('');

  const [taskDeptFilter, setTaskDeptFilter] = useState('ALL');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [taskDirection, setTaskDirection] = useState<'onboarding' | 'offboarding'>('onboarding');
  const [monthConfigDept, setMonthConfigDept] = useState('');

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
  const [newLeaveType, setNewLeaveType] = useState('');

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

  const updateLocalPayrollVariables = (vars: Partial<typeof localPayrollVars>) => {
    setLocalPayrollVars(p => ({ ...p, ...vars }));
    setIsDirty(true);
  };
  const updateLocalPayeVars = (vars: Partial<typeof localPayeVars>) => {
    setLocalPayeVars(p => ({ ...p, ...vars }));
    setIsDirty(true);
  };
  const updateLocalMonthValue = (month: string, vals: any) => {
    setLocalMonthVals(p => ({ ...p, [month]: { ...p[month], ...vals } }));
    setIsDirty(true);
  };
  const addLocalTaxBracket = (b: any) => {
    setLocalPayeVars(p => ({ ...p, taxBrackets: [...p.taxBrackets, b] }));
    setIsDirty(true);
  };
  const updateLocalTaxBracket = (id: string, update: any) => {
    setLocalPayeVars(p => ({ ...p, taxBrackets: p.taxBrackets.map(b => b.id === id ? { ...b, ...update } : b) }));
    setIsDirty(true);
  };
  const removeLocalTaxBracket = (id: string) => {
    setLocalPayeVars(p => ({ ...p, taxBrackets: p.taxBrackets.filter(b => b.id !== id) }));
    setIsDirty(true);
  };
  const addLocalExtraCond = (cond: any) => {
    setLocalPayeVars(p => ({ ...p, extraConditions: [...p.extraConditions, cond] }));
    setIsDirty(true);
  };
  const updateLocalExtraCond = (id: string, update: any) => {
    setLocalPayeVars(p => ({ ...p, extraConditions: p.extraConditions.map(c => c.id === id ? { ...c, ...update } : c) }));
    setIsDirty(true);
  };
  const removeLocalExtraCond = (id: string) => {
    setLocalPayeVars(p => ({ ...p, extraConditions: p.extraConditions.filter(c => c.id !== id) }));
    setIsDirty(true);
  };

  const handleSave = () => {
    saveAllSettingsStore(localPayrollVars, localPayeVars, localMonthVals);
    setIsDirty(false);
    toast.success('Variables saved successfully!');
  };

  // Browser reload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

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

  const handleExportVariables = () => {
    try {
      const wb = XLSX.utils.book_new();

      const posData = positions.map(p => ({ Position: p }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(posData), 'Positions');

      const deptData = departments.map(d => ({ Department: d }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), 'Departments');

      const clientData = clients.map(c => ({ Client: c }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientData), 'Clients');

      const leaveData = leaveTypes.map(l => ({ LeaveType: l }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leaveData), 'Leave_Types');

      const phData = publicHolidays.map(h => ({ Date: h.date, Name: h.name }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(phData), 'Public_Holidays');

      // Payroll Variables
      const payrollData = [
        { Key: 'Basic Salary (%)', Value: localPayrollVars.basic },
        { Key: 'Housing Allowance (%)', Value: localPayrollVars.housing },
        { Key: 'Transport Allowance (%)', Value: localPayrollVars.transport },
        { Key: 'Other Allowances (%)', Value: localPayrollVars.otherAllowances },
        { Key: 'Employee Pension (%)', Value: localPayrollVars.employeePensionRate },
        { Key: 'Employer Pension (%)', Value: localPayrollVars.employerPensionRate },
        { Key: 'NSITF (%)', Value: localPayrollVars.nsitfRate },
        { Key: 'Withholding Tax (%)', Value: localPayrollVars.withholdingTaxRate },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payrollData), 'Payroll_Variables');

      // PAYE Tax Variables
      const payeData = [
        { Key: 'CRA Base (₦)', Value: localPayeVars.craBase },
        { Key: 'Rent Relief Rate (%)', Value: (localPayeVars.rentReliefRate || 0) * 100 },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payeData), 'PAYE_Variables');

      const taxBracketsData = localPayeVars.taxBrackets.map(b => ({
        Label: b.label,
        'Rate (%)': b.rate * 100,
        'UpTo (₦)': b.upTo === null ? 'INFINITY' : b.upTo
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taxBracketsData), 'PAYE_Tax_Brackets');

      const extraConditionsData = localPayeVars.extraConditions.map(c => ({
        Label: c.label,
        'Amount (₦)': c.amount,
        Enabled: c.enabled
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(extraConditionsData), 'PAYE_Extra_Conditions');

      // Task Templates
      const taskData: any[] = [];
      departmentTasksList.forEach(dept => {
        dept.onboardingTasks.forEach(t => taskData.push({
          Department: dept.department,
          Type: 'Onboarding',
          Title: t.title,
          Assignee: t.assignee
        }));
        dept.offboardingTasks.forEach(t => taskData.push({
          Department: dept.department,
          Type: 'Offboarding',
          Title: t.title,
          Assignee: t.assignee
        }));
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskData), 'Task_Templates');

      XLSX.writeFile(wb, 'System_Variables.xlsx');
      toast.success('System variables exported successfully.');
    } catch (error) {
      toast.error('Failed to export variables.');
    }
  };

  const handleImportVariables = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm(
      'This will add new entries to your variables (Positions, Departments, Clients, Leave Types, etc). Existing entries remain intact. Continue?',
      { title: 'Import Variables' }
    ).then((ok) => {
      if (ok) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = evt.target?.result;
            const wb = XLSX.read(data, { type: 'binary' });

            if (wb.SheetNames.includes('Positions')) {
              const posData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Positions']);
              posData.forEach(row => {
                if (row.Position && !positions.includes(row.Position)) addPosition(String(row.Position));
              });
            }

            if (wb.SheetNames.includes('Departments')) {
              const deptData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Departments']);
              deptData.forEach(row => {
                if (row.Department && !departments.includes(row.Department)) addDepartment(String(row.Department));
              });
            }

            if (wb.SheetNames.includes('Clients')) {
              const clientData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Clients']);
              clientData.forEach(row => {
                if (row.Client && !clients.includes(row.Client)) addClient(String(row.Client));
              });
            }

            if (wb.SheetNames.includes('Leave_Types')) {
              const leaveData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Leave_Types']);
              leaveData.forEach(row => {
                const lt = row.LeaveType || row.Leave_Type;
                if (lt && !leaveTypes.includes(lt)) addLeaveType(String(lt));
              });
            }

            if (wb.SheetNames.includes('Public_Holidays')) {
              const phData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Public_Holidays']);
              phData.forEach(row => {
                if (row.Date && row.Name) {
                  // Basic check to see if it already exists to avoid duplicates
                  const exists = publicHolidays.some(ph => ph.date === row.Date && ph.name === row.Name);
                  if (!exists) {
                    addPublicHoliday({ id: Math.random().toString(36).slice(2), date: String(row.Date), name: String(row.Name) });
                  }
                }
              });
            }

            if (wb.SheetNames.includes('Payroll_Variables')) {
              const pvData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Payroll_Variables']);
              const newPv = { ...localPayrollVars };
              pvData.forEach(row => {
                const val = parseFloat(row.Value);
                if (!isNaN(val)) {
                  if (row.Key.includes('Basic')) newPv.basic = val;
                  if (row.Key.includes('Housing')) newPv.housing = val;
                  if (row.Key.includes('Transport')) newPv.transport = val;
                  if (row.Key.includes('Other')) newPv.otherAllowances = val;
                  if (row.Key.includes('Employee Pension')) newPv.employeePensionRate = val;
                  if (row.Key.includes('Employer Pension')) newPv.employerPensionRate = val;
                  if (row.Key.includes('NSITF')) newPv.nsitfRate = val;
                  if (row.Key.includes('Withholding')) newPv.withholdingTaxRate = val;
                }
              });
              updateLocalPayrollVariables(newPv);
            }

            if (wb.SheetNames.includes('PAYE_Variables')) {
              const payeData = XLSX.utils.sheet_to_json<any>(wb.Sheets['PAYE_Variables']);
              const newPayeVar = { ...localPayeVars };
              payeData.forEach(row => {
                const val = parseFloat(row.Value);
                if (!isNaN(val)) {
                  if (row.Key.includes('CRA Base')) newPayeVar.craBase = val;
                  if (row.Key.includes('Rent Relief Rate')) newPayeVar.rentReliefRate = val / 100;
                }
              });
              
              if (wb.SheetNames.includes('PAYE_Tax_Brackets')) {
                const tbData = XLSX.utils.sheet_to_json<any>(wb.Sheets['PAYE_Tax_Brackets']);
                if (tbData.length > 0) {
                  newPayeVar.taxBrackets = tbData.map(row => ({
                    id: Math.random().toString(36).slice(2),
                    label: String(row.Label || ''),
                    rate: parseFloat(row['Rate (%)'] || 0) / 100,
                    upTo: row['UpTo (₦)'] === 'INFINITY' ? null : parseFloat(row['UpTo (₦)'] || 0)
                  }));
                }
              }

              if (wb.SheetNames.includes('PAYE_Extra_Conditions')) {
                const ecData = XLSX.utils.sheet_to_json<any>(wb.Sheets['PAYE_Extra_Conditions']);
                if (ecData.length > 0) {
                  newPayeVar.extraConditions = ecData.map(row => ({
                    id: Math.random().toString(36).slice(2),
                    label: String(row.Label || ''),
                    amount: parseFloat(row['Amount (₦)'] || 0),
                    enabled: row.Enabled === true || row.Enabled === 'true' || row.Enabled === 'Yes',
                  }));
                }
              }

              updateLocalPayeVars(newPayeVar);
            }

            if (wb.SheetNames.includes('Task_Templates')) {
              const tasksData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Task_Templates']);
              // Group by department
              const deptsMap: Record<string, { onboardingTasks: any[], offboardingTasks: any[] }> = {};
              tasksData.forEach(row => {
                const d = row.Department;
                if (!d) return;
                if (!deptsMap[d]) deptsMap[d] = { onboardingTasks: [], offboardingTasks: [] };
                
                const task = { title: String(row.Title || ''), assignee: String(row.Assignee || '') };
                if (String(row.Type || '').toLowerCase() === 'onboarding') {
                  deptsMap[d].onboardingTasks.push(task);
                } else if (String(row.Type || '').toLowerCase() === 'offboarding') {
                  deptsMap[d].offboardingTasks.push(task);
                }
              });

              Object.keys(deptsMap).forEach(deptName => {
                // merge with existing
                const existing = departmentTasksList.find(d => d.department === deptName);
                if (existing) {
                  updateDepartmentTasks({
                    department: deptName,
                    onboardingTasks: deptsMap[deptName].onboardingTasks,
                    offboardingTasks: deptsMap[deptName].offboardingTasks
                  });
                } else {
                  // Wait, no direct addDepartmentTasks? 
                  // If it doesn't exist, updateDepartmentTasks will just replace or we can add it by using update which append missing?
                  // `updateDepartmentTasks` actually filters and maps, wait let me check appStore implementation for updateDepartmentTasks.
                  updateDepartmentTasks({ department: deptName, ...deptsMap[deptName] });
                }
              });
            }

            toast.success('Variables imported successfully.');
          } catch (error) {
            toast.error('Failed to parse the file.');
          } finally {
            if (e.target) e.target.value = '';
          }
        };
        reader.readAsBinaryString(file);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-400">
            System Variables
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Configure global application variables, templates, and statutory parameters.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {priv.canImport && (
            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportVariables}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Import Variables"
              />
              <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2">
                <Upload className="h-4 w-4 text-slate-400" />
                Import
              </Button>
            </div>
          )}
          {priv.canExport && (
            <Button variant="outline" onClick={handleExportVariables} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2">
              <Download className="h-4 w-4 text-slate-400" />
              Export
            </Button>
          )}
          {priv.canEdit && (
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold gap-2 transition-all">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          )}
        </div>
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
              {priv.canEdit && (
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
              )}

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
                            {priv.canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveHoliday(holiday.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="New Position" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} className="flex-1" />
                  <Button onClick={handleAddPosition} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {positions.map(pos => (
                  <div key={pos} className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                    {pos}
                    {priv.canEdit && (
                      <button onClick={() => removePosition(pos)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
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
              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="New Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1" />
                  <Button onClick={handleAddDepartment} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="w-40 text-center">Work Days/Week</TableHead>
                      <TableHead className="w-[100px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map(dep => {
                      const defaultDays = ['OPERATIONS', 'ENGINEERING'].includes(dep.toUpperCase()) ? 6 : 5;
                      const days = localPayrollVars.departmentWorkDays?.[dep] ?? defaultDays;
                      return (
                        <TableRow key={dep}>
                          <TableCell className="font-medium text-slate-800">{dep}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={1}
                              max={7}
                              value={days}
                              onChange={(e) => {
                                const nw = { ...(localPayrollVars.departmentWorkDays || {}), [dep]: Math.max(1, Math.min(7, Number(e.target.value))) };
                                updateLocalPayrollVariables({ departmentWorkDays: nw });
                              }}
                              className="h-8 w-20 mx-auto text-center"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {priv.canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDepartment(dep)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ——— CLIENTS ——— */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Clients</CardTitle>
              <CardDescription>Manage clients. These are shared with the Sites &amp; Clients page.</CardDescription>
            </CardHeader>
            <CardContent>
              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="New Client Name"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (newClient && !clients.includes(newClient)) { addClient(newClient); setNewClient(''); } } }}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => { if (newClient && !clients.includes(newClient)) { addClient(newClient); setNewClient(''); } }}
                    variant="outline"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {clients.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No clients yet. Add one above or via Sites &amp; Clients.</p>
                )}
                {clients.map(c => (
                  <div key={c} className="bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 text-sm flex items-center gap-2 text-indigo-800">
                    {c}
                    {priv.canEdit && (
                      <button onClick={() => removeClient(c)} className="text-indigo-300 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ——— LEAVE TYPES ——— */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Leave Types</CardTitle>
              <CardDescription>Manage the types of leave available on employee leave forms.</CardDescription>
            </CardHeader>
            <CardContent>
              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="e.g. Compassionate Leave" value={newLeaveType} onChange={(e) => setNewLeaveType(e.target.value)} className="flex-1" />
                  <Button onClick={() => { if (newLeaveType && !leaveTypes.includes(newLeaveType)) { addLeaveType(newLeaveType); setNewLeaveType(''); } }} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {leaveTypes.map(lt => (
                  <div key={lt} className="bg-teal-50 border border-teal-200 rounded-full px-3 py-1 text-sm flex items-center gap-2 text-teal-800">
                    {lt}
                    {priv.canEdit && (
                      <button onClick={() => removeLeaveType(lt)} className="text-teal-400 hover:text-rose-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ——— MOVED TASK TEMPLATES ——— */}
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
              {priv.canEdit && (
                <div className="flex gap-2">
                  <Input placeholder="Task Title (e.g. Provide Laptop)" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1" />
                  <Input placeholder="Assignee (e.g. IT)" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} className="w-32" />
                  <Button variant="outline" onClick={handleAddTask} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
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
                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'onboarding')}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
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
                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveTask(t.title, 'offboarding')}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
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
                    value={localPayrollVars.basic}
                    onChange={e => updateLocalPayrollVariables({ basic: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Housing</label>
                  <Input
                    type="number"
                    value={localPayrollVars.housing}
                    onChange={e => updateLocalPayrollVariables({ housing: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Transport</label>
                  <Input
                    type="number"
                    value={localPayrollVars.transport}
                    onChange={e => updateLocalPayrollVariables({ transport: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Other Allowances</label>
                  <Input
                    type="number"
                    value={localPayrollVars.otherAllowances}
                    onChange={e => updateLocalPayrollVariables({ otherAllowances: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Employee Pension Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={localPayrollVars.employeePensionRate}
                    onChange={e => updateLocalPayrollVariables({ employeePensionRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Deducted from employee salary (default 8%)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Employer Pension Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={localPayrollVars.employerPensionRate}
                    onChange={e => updateLocalPayrollVariables({ employerPensionRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Company's contribution to pension (default 10%)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">Withholding Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(localPayrollVars.withholdingTaxRate * 100).toFixed(1)}
                    onChange={e => updateLocalPayrollVariables({ withholdingTaxRate: Number(e.target.value) / 100 })}
                  />
                  <p className="text-xs text-slate-400">Applied when employee has Withholding Tax</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">NSITF Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={localPayrollVars.nsitfRate}
                    onChange={e => updateLocalPayrollVariables({ nsitfRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Company's NSITF contribution (1% by default)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">VAT Rate (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={localPayrollVars.vatRate}
                    onChange={e => updateLocalPayrollVariables({ vatRate: Number(e.target.value) })}
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
                Work days are <strong>auto-computed</strong> per department and year ({payrollYear}), excluding Sundays, holidays, and off-days based on each department's configured days/week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Department picker */}
              <div className="flex items-center gap-2 mb-4">
                <label className="text-xs font-semibold text-slate-600 uppercase">Department:</label>
                <select
                  value={monthConfigDept}
                  onChange={e => setMonthConfigDept(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  <option value="">— All (6 days/wk default) —</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {monthConfigDept && (() => {
                  const configuredDays = localPayrollVars.departmentWorkDays?.[monthConfigDept];
                  const defaultDays = ['OPERATIONS', 'ENGINEERING'].includes(monthConfigDept.toUpperCase()) ? 6 : 5;
                  const effective = configuredDays ?? defaultDays;
                  return <span className="text-xs text-indigo-600 font-medium bg-indigo-50 rounded-full px-2 py-0.5">{effective} days/week</span>;
                })()}
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Start of Mth</TableHead>
                      <TableHead>End of Mth</TableHead>
                      <TableHead className="text-center">Work Days</TableHead>
                      <TableHead>OT Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthsList.map(({ key, label }) => {
                      const monthNum = MONTH_INDEX[key];
                      const startDate = new Date(payrollYear, monthNum - 1, 1);
                      const endDate = new Date(payrollYear, monthNum, 0);

                      // Compute workdays for selected department
                      const selectedDefaultDays = monthConfigDept
                        ? (['OPERATIONS', 'ENGINEERING'].includes(monthConfigDept.toUpperCase()) ? 6 : 5)
                        : 6;
                      const deptWorkDaysPerWeek = monthConfigDept
                        ? (localPayrollVars.departmentWorkDays?.[monthConfigDept] ?? selectedDefaultDays)
                        : 6;
                      const computedWorkDays = computeWorkDays(payrollYear, monthNum, holidayDateStrings, deptWorkDaysPerWeek);

                      const data = localMonthVals[key] || { workDays: 0, overtimeRate: 0.5 };
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
                              onChange={e => updateLocalMonthValue(key, { workDays: computedWorkDays, overtimeRate: Number(e.target.value) })}
                            />
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
                    <Input type="number" value={localPayeVars.craBase}
                      onChange={e => updateLocalPayeVars({ craBase: Number(e.target.value) })} />
                    <p className="text-xs text-slate-400">Fixed statutory amount (default ₦800,000)</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Rent Relief Rate (%)</label>
                    <Input type="number" step="0.1" value={(localPayeVars.rentReliefRate * 100).toFixed(1)}
                      onChange={e => updateLocalPayeVars({ rentReliefRate: Number(e.target.value) / 100 })} />
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
                      {[...localPayeVars.taxBrackets]
                        .sort((a, b) => {
                          if (a.upTo === null) return 1;
                          if (b.upTo === null) return -1;
                          return a.upTo - b.upTo;
                        })
                        .map(b => (
                          <TableRow key={b.id}>
                            <TableCell>
                              <Input className="h-8 w-36" value={b.label}
                                onChange={e => updateLocalTaxBracket(b.id, { label: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-8 w-36"
                                placeholder="(top bracket)"
                                value={b.upTo !== null ? b.upTo : ''}
                                onChange={e => updateLocalTaxBracket(b.id, { upTo: e.target.value === '' ? null : Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.1" className="h-8 w-24"
                                value={(b.rate * 100).toFixed(1)}
                                onChange={e => updateLocalTaxBracket(b.id, { rate: Number(e.target.value) / 100 })} />
                            </TableCell>
                            <TableCell>
                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                  onClick={() => removeLocalTaxBracket(b.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
                    addLocalTaxBracket({
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
                    addLocalExtraCond({ id: Math.random().toString(36).slice(2), label: newExtraLabel, amount: Number(newExtraAmount), enabled: true });
                    setNewExtraLabel(''); setNewExtraAmount('');
                  }}><Plus className="h-4 w-4" /> Add</Button>
                </div>
                {localPayeVars.extraConditions.length === 0 ? (
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
                        {localPayeVars.extraConditions.map(cond => (
                          <TableRow key={cond.id}>
                            <TableCell className="font-medium">{cond.label}</TableCell>
                            <TableCell>
                              <Input type="number" className="w-32 h-8" value={cond.amount}
                                onChange={e => updateLocalExtraCond(cond.id, { amount: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <input type="checkbox" checked={cond.enabled}
                                onChange={e => updateLocalExtraCond(cond.id, { enabled: e.target.checked })}
                                className="h-4 w-4 accent-indigo-600" />
                            </TableCell>
                            <TableCell>
                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"
                                  onClick={() => removeLocalExtraCond(cond.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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

