import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Plus, Trash2, Save, Download, Upload, BookOpen, Settings2, Briefcase, X, ChevronRight, Edit2 } from 'lucide-react';
import { useAppStore, Employee, AttendanceRecord, Site, Invoice, PendingInvoice, LeaveRecord, LedgerEntry, CompanyExpense, CommLog } from '@/src/store/appStore';
import { NairaSign } from '@/src/components/ui/naira-sign';
import { computeWorkDays, MONTH_INDEX } from '@/src/lib/workdays';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { generateId } from '@/src/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/src/components/ui/dialog';
import * as XLSX from 'xlsx';

export function Variables() {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const positions = useAppStore((state) => state.positions);
  const departments = useAppStore((state) => state.departments);
  const clients = useAppStore((state) => state.clients);
  const addPosition = useAppStore((state) => state.addPosition);
  const removePosition = useAppStore((state) => state.removePosition);
  const updatePosition = useAppStore((state) => state.updatePosition);
  const addDepartment = useAppStore((state) => state.addDepartment);
  const removeDepartment = useAppStore((state) => state.removeDepartment);
  const updateDepartment = useAppStore((state) => state.updateDepartment);
  const addClient = useAppStore((state) => state.addClient);
  const storePayrollVariables = useAppStore((state) => state.payrollVariables);
  const storeMonthValues = useAppStore((state) => state.monthValues);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const addPublicHoliday = useAppStore((state) => state.addPublicHoliday);
  const removePublicHoliday = useAppStore((state) => state.removePublicHoliday);
  const storePayeTaxVariables = useAppStore((state) => state.payeTaxVariables);
  const storeHrVariables = useAppStore((state) => state.hrVariables);
  const saveAllSettingsStore = useAppStore((state) => state.saveAllSettings);
  const departmentTasksList = useAppStore((state) => state.departmentTasksList);

  const {
    setPositions, setDepartments, setClients, setPublicHolidays,
    setLeaveTypes, setLedgerCategories, setLedgerVendors,
    setLedgerBanks, setLedgerBeneficiaryBanks, setDepartmentTasksList,
    updateHrVariables
  } = useAppStore();

  const [localPayrollVars, setLocalPayrollVars] = useState(storePayrollVariables);
  const [localPayeVars, setLocalPayeVars] = useState(storePayeTaxVariables);
  const [localMonthVals, setLocalMonthVals] = useState(storeMonthValues);
  const [localHrVars, setLocalHrVars] = useState(storeHrVariables);
  const [isDirty, setIsDirty] = useState(false);
  const setVariablesDirty = useAppStore((state) => state.setVariablesDirty || ((val: boolean) => setIsDirty(val))); // fallback

  const [editingVar, setEditingVar] = useState<{
    type: 'department' | 'position' | 'client' | 'leaveType' | 'holiday' | 'ledgerCategory' | 'ledgerVendor' | 'ledgerBank' | 'ledgerBenBank' | 'ledgerVendorTIN';
    id?: string;
    oldValue: string;
    date?: string; // for holidays
  } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renameDateInput, setRenameDateInput] = useState('');
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [isPropagating, setIsPropagating] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setLocalPayrollVars(storePayrollVariables);
      setLocalPayeVars(storePayeTaxVariables);
      setLocalMonthVals(storeMonthValues);
      setLocalHrVars(storeHrVariables);
    }
  }, [storePayrollVariables, storePayeTaxVariables, storeMonthValues, storeHrVariables, isDirty]);

  useEffect(() => {
    return () => setIsDirty(false);
  }, []);

  // ── Ledger variables ───────────────────────────────────────
  const ledgerCategories = useAppStore((state) => state.ledgerCategories);
  const ledgerBanks = useAppStore((state) => state.ledgerBanks);
  const ledgerBeneficiaryBanks = useAppStore((state) => state.ledgerBeneficiaryBanks);
  const ledgerVendors = useAppStore((state) => state.ledgerVendors);
  const addLedgerCategory = useAppStore((state) => state.addLedgerCategory);
  const removeLedgerCategory = useAppStore((state) => state.removeLedgerCategory);
  const addLedgerBank = useAppStore((state) => state.addLedgerBank);
  const removeLedgerBank = useAppStore((state) => state.removeLedgerBank);
  const addLedgerBeneficiaryBank = useAppStore((state) => state.addLedgerBeneficiaryBank);
  const removeLedgerBeneficiaryBank = useAppStore((state) => state.removeLedgerBeneficiaryBank);
  const addLedgerVendor = useAppStore((state) => state.addLedgerVendor);
  const removeLedgerVendor = useAppStore((state) => state.removeLedgerVendor);

  const [newCat, setNewCat] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorTin, setNewVendorTin] = useState('');
  const [newBenBankName, setNewBenBankName] = useState('');

  // Top-level section switch: 'system' | 'ledger' | 'services'
  const [varSection, setVarSection] = useState<'system' | 'ledger' | 'services'>('system');

  const updateDepartmentTasks = useAppStore((state) => state.updateDepartmentTasks);

  // Service Templates State
  const getServiceTemplates = useAppStore((state) => state.getServiceTemplates);
  const updateServiceTemplate = useAppStore((state) => state.updateServiceTemplate);
  const removeServiceTemplateStore = useAppStore((state) => state.removeServiceTemplate);

  const serviceTemplates = useMemo(() => getServiceTemplates(), [departmentTasksList]);
  
  const [selectedService, setSelectedService] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceTaskTitle, setNewServiceTaskTitle] = useState('');
  const [newServiceTaskAssignee, setNewServiceTaskAssignee] = useState('');

  // Navigation blocker removed because it requires react-router v6 createBrowserRouter data routers
  // Relying only on window.addEventListener('beforeunload') below

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
  const [newTaskPosition, setNewTaskPosition] = useState('end');
  const [newOffTaskTitle, setNewOffTaskTitle] = useState('');
  const [newOffTaskAssignee, setNewOffTaskAssignee] = useState('');
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
  const [newPosDeptId, setNewPosDeptId] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newDeptStaffType, setNewDeptStaffType] = useState<'OFFICE' | 'FIELD' | 'NON-EMPLOYEE'>('OFFICE');
  const [newLeaveType, setNewLeaveType] = useState('');
  const [newPayeeType, setNewPayeeType] = useState('');

  const handleAddHoliday = () => {
    if (!newDate || !newName) return;
    addPublicHoliday({ id: generateId(), date: newDate, name: newName });
    setNewDate('');
    setNewName('');
  };

  const handleRemoveHoliday = (id: string) => {
    removePublicHoliday(id);
  };

  const handleAddPosition = () => {
    if (newPosition && newPosDeptId && !positions.some(p => p.title.toLowerCase() === newPosition.toLowerCase() && p.departmentId === newPosDeptId)) {
      addPosition({ id: generateId(), title: newPosition, departmentId: newPosDeptId });
      setNewPosition('');
      setNewPosDeptId('');
    } else if (!newPosDeptId) {
      toast.error('Select a department for the new position.');
    } else {
      toast.error('Position already exists in this department.');
    }
  };

  const handleAddDepartment = () => {
    if (newDepartment && !departments.some(d => d.name.toLowerCase() === newDepartment.toLowerCase())) {
      addDepartment({ id: generateId(), name: newDepartment, staffType: newDeptStaffType, workDaysPerWeek: 5 });
      setNewDepartment('');
      setNewDeptStaffType('OFFICE');
    } else if (newDepartment) {
      toast.error('Department name already exists.');
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
  const updateLocalHrVariables = (vars: Partial<typeof localHrVars>) => {
    setLocalHrVars(p => ({ ...p, ...vars }));
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

  const handleOpenRename = (type: any, oldValue: string, id?: string, date?: string) => {
    const state = useAppStore.getState();
    const counts: Record<string, number> = {};

    // Filter out 0 counts to only show relevant ones
    const addCount = (key: string, count: number) => {
      if (count > 0) counts[key] = count;
    };

    if (type === 'department') {
      addCount('Employees', state.employees.filter(e => e.department === oldValue).length);
      addCount('Secondary Depts', state.employees.filter(e => e.secondaryDepartments?.includes(oldValue)).length);
      addCount('Task Templates', (state.departmentTasksList || []).filter(t => t.department === oldValue).length);
    } else if (type === 'position') {
      addCount('Employees', state.employees.filter(e => e.position === oldValue).length);
      addCount('Attendance Records', state.attendanceRecords.filter(a => a.position === oldValue).length);
    } else if (type === 'client') {
      addCount('Sites', state.sites.filter(s => s.client === oldValue).length);
      addCount('Invoices', state.invoices.filter(i => i.client === oldValue).length);
      addCount('Quotations', state.pendingInvoices.filter(i => i.client === oldValue).length);
      addCount('Ledger Entries', state.ledgerEntries.filter(l => l.client === oldValue).length);
      addCount('Comm Logs', (state.commLogs || []).filter(c => c.client === oldValue).length);
      addCount('Payments', (state.payments || []).filter(p => p.client === oldValue).length);
      addCount('VAT Payments', (state.vatPayments || []).filter(v => v.client === oldValue).length);
    } else if (type === 'leaveType') {
      addCount('Leave Records', (state.leaves || []).filter(l => l.leaveType === oldValue).length);
    } else if (type === 'ledgerCategory') {
      addCount('Ledger Entries', state.ledgerEntries.filter(l => l.category === oldValue).length);
    } else if (type === 'ledgerVendor') {
      addCount('Ledger Entries', state.ledgerEntries.filter(l => l.vendor === oldValue).length);
    } else if (type === 'ledgerBank') {
      addCount('Ledger Entries', state.ledgerEntries.filter(l => l.bank === oldValue).length);
      addCount('Company Expenses', state.companyExpenses.filter(e => e.paidFrom === oldValue).length);
    } else if (type === 'ledgerBenBank') {
      addCount('Company Expenses', (state.companyExpenses || []).filter(e => e.paidToBankName === oldValue).length);
    }

    setUsageCounts(counts);
    setEditingVar({ type, oldValue, id, date });
    setRenameInput(oldValue);
    setRenameDateInput(date || '');
  };

  const handleCommitRename = async (propagate: boolean) => {
    if (!editingVar || !renameInput.trim()) return;
    const { type, id, oldValue, date } = editingVar;
    const newValue = renameInput.trim();
    const newDate = renameDateInput;
    
    if (oldValue === newValue && date === newDate) {
      setEditingVar(null);
      return;
    }

    setIsPropagating(true);
    try {
      const state = useAppStore.getState();

      if (type === 'holiday' && id) {
        state.addPublicHoliday({ id, date: newDate, name: newValue }); // This actually updates if id exists in many implementations, but let's check store
        // Wait, store uses addPublicHoliday for both? Let's check removeHoliday + add
      } else if (type === 'department' && id) {
        state.updateDepartment(id, { name: newValue });
        if (propagate) {
          const empIds = state.employees.filter(e => e.department === oldValue).map(e => e.id);
          if (empIds.length > 0) state.bulkUpdateEmployees(empIds, { department: newValue });
          
          state.employees.forEach(e => {
            if (e.secondaryDepartments?.includes(oldValue)) {
              const newSec = e.secondaryDepartments.map(d => d === oldValue ? newValue : d);
              state.updateEmployee(e.id, { secondaryDepartments: newSec });
            }
          });
          
          const taskMatch = (state.departmentTasksList || []).find(t => t.department === oldValue);
          if (taskMatch) state.updateDepartmentTasks({ ...taskMatch, department: newValue });
        }
      } else if (type === 'position' && id) {
        state.updatePosition(id, { title: newValue });
        if (propagate) {
          const empIds = state.employees.filter(e => e.position === oldValue).map(e => e.id);
          if (empIds.length > 0) state.bulkUpdateEmployees(empIds, { position: newValue });
          
          // Attendance records propagation (can be thousands, usually done via DB)
          // But store logic call db.updateX for each usually. 
          // For simplicity we try store functions if they exist.
          state.attendanceRecords.forEach(a => {
            if (a.position === oldValue) state.updateAttendanceRecord?.(a.id, { position: newValue });
          });
        }
      } else if (type === 'client') {
        state.setClients(state.clients.map(c => c === oldValue ? newValue : c));
        if (propagate) {
          state.sites.filter(s => s.client === oldValue).forEach(s => state.updateSite(s.id, { client: newValue }));
          state.invoices.filter(i => i.client === oldValue).forEach(i => state.updateInvoice(i.id, { client: newValue }));
          state.pendingInvoices.filter(i => i.client === oldValue).forEach(i => state.updatePendingInvoice(i.id, { client: newValue }));
          state.ledgerEntries.filter(l => l.client === oldValue).forEach(l => state.updateLedgerEntry(l.id, { client: newValue }));
          // ... etc for payments, vat, commLogs if functions exist
        }
      } else if (type === 'leaveType') {
        state.setLeaveTypes(useAppStore.getState().leaveTypes.map(lt => lt === oldValue ? newValue : lt));
        if (propagate) {
           (state.leaves || []).filter(l => l.leaveType === oldValue).forEach(l => state.updateLeave?.(l.id, { leaveType: newValue }));
        }
      } else if (type === 'ledgerCategory') {
        state.updateLedgerCategory(id!, { name: newValue });
        if (propagate) state.ledgerEntries.filter(l => l.category === oldValue).forEach(l => state.updateLedgerEntry(l.id, { category: newValue }));
      } else if (type === 'ledgerVendor') {
        state.updateLedgerVendor(id!, { name: newValue });
        if (propagate) state.ledgerEntries.filter(l => l.vendor === oldValue).forEach(l => state.updateLedgerEntry(l.id, { vendor: newValue }));
      } else if (type === 'ledgerVendorTIN') {
        state.updateLedgerVendor(id!, { tinNumber: newValue });
      } else if (type === 'ledgerBank') {
        state.updateLedgerBank(id!, { name: newValue });
        if (propagate) {
          state.ledgerEntries.filter(l => l.bank === oldValue).forEach(l => state.updateLedgerEntry(l.id, { bank: newValue }));
          state.companyExpenses.filter(e => e.paidFrom === oldValue).forEach(e => state.updateCompanyExpense(e.id, { paidFrom: newValue }));
        }
      } else if (type === 'ledgerBenBank') {
        state.updateLedgerBeneficiaryBank(id!, { name: newValue });
        if (propagate) {
          state.companyExpenses.filter(e => e.paidToBankName === oldValue).forEach(e => state.updateCompanyExpense(e.id, { paidToBankName: newValue }));
        }
      }

      toast.success('Successfully updated and propagated changes.');
      setEditingVar(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update some records.');
    } finally {
      setIsPropagating(false);
    }
  };

  const handleSave = async () => {
    const ok = await showConfirm('Are you sure you want to save all changes to the database? This will update global system parameters.', { title: 'Save Changes' });
    if (!ok) return;

    saveAllSettingsStore(localPayrollVars, localPayeVars, localMonthVals, localHrVars);
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

    const newTask = { title: newTaskTitle, assignee: newTaskAssignee, insertAfter: newTaskPosition };
    const tasks = [...currentTasks.onboardingTasks];

    if (newTaskPosition === 'start') {
      tasks.unshift(newTask);
    } else if (newTaskPosition === 'end' || !newTaskPosition.startsWith('custom-after-')) {
      tasks.push(newTask);
    } else {
      const afterIdx = parseInt(newTaskPosition.replace('custom-after-', ''), 10);
      tasks.splice(afterIdx + 1, 0, newTask);
    }

    updateDepartmentTasks({ ...currentTasks, onboardingTasks: tasks });
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskPosition('end');
  };

  const handleAddOffboardingTask = () => {
    if (!newOffTaskTitle || !newOffTaskAssignee) return;
    const currentTasks = departmentTasksList.find(d => d.department === taskDeptFilter) ||
      { department: taskDeptFilter, onboardingTasks: [], offboardingTasks: [] };
    currentTasks.offboardingTasks.push({ title: newOffTaskTitle, assignee: newOffTaskAssignee });
    updateDepartmentTasks(currentTasks);
    setNewOffTaskTitle('');
    setNewOffTaskAssignee('');
  };

  const handleMoveTask = (idx: number, dir: 'up' | 'down') => {
    const currentTasks = departmentTasksList.find(d => d.department === taskDeptFilter);
    if (!currentTasks) return;
    const tasks = [...currentTasks.onboardingTasks];
    if (dir === 'up' && idx > 0) [tasks[idx - 1], tasks[idx]] = [tasks[idx], tasks[idx - 1]];
    if (dir === 'down' && idx < tasks.length - 1) [tasks[idx], tasks[idx + 1]] = [tasks[idx + 1], tasks[idx]];
    updateDepartmentTasks({ ...currentTasks, onboardingTasks: tasks });
  };

  const handleMoveOffTask = (idx: number, dir: 'up' | 'down') => {
    const currentTasks = departmentTasksList.find(d => d.department === taskDeptFilter);
    if (!currentTasks) return;
    const tasks = [...currentTasks.offboardingTasks];
    if (dir === 'up' && idx > 0) [tasks[idx - 1], tasks[idx]] = [tasks[idx], tasks[idx - 1]];
    if (dir === 'down' && idx < tasks.length - 1) [tasks[idx], tasks[idx + 1]] = [tasks[idx + 1], tasks[idx]];
    updateDepartmentTasks({ ...currentTasks, offboardingTasks: tasks });
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

  const handleDeduplicateAllTasks = async () => {
    const cleaned = departmentTasksList.map(dept => ({
      ...dept,
      onboardingTasks: dept.onboardingTasks.filter((t, i, self) =>
        i === self.findIndex(x => x.title === t.title && x.assignee === t.assignee)
      ),
      offboardingTasks: dept.offboardingTasks.filter((t, i, self) =>
        i === self.findIndex(x => x.title === t.title && x.assignee === t.assignee)
      )
    }));
    
    // Check if anything was actually removed
    const totalOriginal = departmentTasksList.reduce((acc, d) => acc + d.onboardingTasks.length + d.offboardingTasks.length, 0);
    const totalCleaned = cleaned.reduce((acc, d) => acc + d.onboardingTasks.length + d.offboardingTasks.length, 0);
    
    if (totalOriginal === totalCleaned) {
      toast.info("No duplicates found to clean.");
      return;
    }

    await setDepartmentTasksList(cleaned);
    toast.success(`Cleanup complete: Removed ${totalOriginal - totalCleaned} duplicate tasks.`);
  };

  const currentTaskView = departmentTasksList.find(d => d.department === taskDeptFilter) ||
    { department: taskDeptFilter, onboardingTasks: [], offboardingTasks: [] };

  const handleExportVariables = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Positions
      const posData = positions.map(p => {
        const dept = departments.find(d => d.id === p.departmentId);
        return { Position: p.title, Department: dept?.name || 'Unassigned' };
      });
      const posSheet = posData.length > 0 ? XLSX.utils.json_to_sheet(posData, { header: ['Position', 'Department'] }) : XLSX.utils.aoa_to_sheet([['Position', 'Department']]);
      XLSX.utils.book_append_sheet(wb, posSheet, 'Positions');

      // Departments
      const deptData = departments.map(d => ({ Department: d.name, 'Work Days/Week': d.workDaysPerWeek }));
      const deptSheet = deptData.length > 0 ? XLSX.utils.json_to_sheet(deptData, { header: ['Department', 'Work Days/Week'] }) : XLSX.utils.aoa_to_sheet([['Department', 'Work Days/Week']]);
      XLSX.utils.book_append_sheet(wb, deptSheet, 'Departments');

      // Clients
      const clientData = clients.filter(c => c.toLowerCase() !== 'dcel').map(c => ({ Client: c }));
      const clientSheet = clientData.length > 0 ? XLSX.utils.json_to_sheet(clientData, { header: ['Client'] }) : XLSX.utils.aoa_to_sheet([['Client']]);
      XLSX.utils.book_append_sheet(wb, clientSheet, 'Clients');

      // Leave Types
      const leaveData = leaveTypes.map(l => ({ LeaveType: l }));
      const leaveSheet = leaveData.length > 0 ? XLSX.utils.json_to_sheet(leaveData, { header: ['LeaveType'] }) : XLSX.utils.aoa_to_sheet([['LeaveType']]);
      XLSX.utils.book_append_sheet(wb, leaveSheet, 'Leave_Types');

      // Public Holidays
      const phData = publicHolidays.map(h => ({ Date: h.date, Name: h.name }));
      const phSheet = phData.length > 0 ? XLSX.utils.json_to_sheet(phData, { header: ['Date', 'Name'] }) : XLSX.utils.aoa_to_sheet([['Date', 'Name']]);
      XLSX.utils.book_append_sheet(wb, phSheet, 'Public_Holidays');

      // Payroll Variables
      const payrollData = [
        { Key: 'Basic Salary (%)', Value: localPayrollVars.basic },
        { Key: 'Housing Allowance (%)', Value: localPayrollVars.housing },
        { Key: 'Transport Allowance (%)', Value: localPayrollVars.transport },
        { Key: 'Other Allowances (%)', Value: localPayrollVars.otherAllowances },
        { Key: 'Employee Pension (%)', Value: localPayrollVars.employeePensionRate },
        { Key: 'Employer Pension (%)', Value: localPayrollVars.employerPensionRate },
        { Key: 'NSITF (%)', Value: localPayrollVars.nsitfRate },
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
      const taskSheet = taskData.length > 0 ? XLSX.utils.json_to_sheet(taskData, { header: ['Department', 'Type', 'Title', 'Assignee'] }) : XLSX.utils.aoa_to_sheet([['Department', 'Type', 'Title', 'Assignee']]);
      XLSX.utils.book_append_sheet(wb, taskSheet, 'Task_Templates');

      // Ledger Variables
      const lCatData = ledgerCategories.map(c => ({ Category: c.name }));
      const lCatSheet = lCatData.length > 0 ? XLSX.utils.json_to_sheet(lCatData, { header: ['Category'] }) : XLSX.utils.aoa_to_sheet([['Category']]);
      XLSX.utils.book_append_sheet(wb, lCatSheet, 'Ledger_Categories');

      const lVenData = ledgerVendors.map(v => ({ Vendor: v.name, TIN: v.tinNumber }));
      const lVenSheet = lVenData.length > 0 ? XLSX.utils.json_to_sheet(lVenData, { header: ['Vendor', 'TIN'] }) : XLSX.utils.aoa_to_sheet([['Vendor', 'TIN']]);
      XLSX.utils.book_append_sheet(wb, lVenSheet, 'Ledger_Vendors');

      const lBankData = ledgerBanks.map(b => ({ Bank: b.name }));
      const lBankSheet = lBankData.length > 0 ? XLSX.utils.json_to_sheet(lBankData, { header: ['Bank'] }) : XLSX.utils.aoa_to_sheet([['Bank']]);
      XLSX.utils.book_append_sheet(wb, lBankSheet, 'Ledger_Banks');

      const lBenData = ledgerBeneficiaryBanks.map(b => ({ Bank: b.name }));
      const lBenSheet = lBenData.length > 0 ? XLSX.utils.json_to_sheet(lBenData, { header: ['Bank'] }) : XLSX.utils.aoa_to_sheet([['Bank']]);
      XLSX.utils.book_append_sheet(wb, lBenSheet, 'Ledger_Beneficiary_Banks');

      // Service Templates
      const srvData: any[] = [];
      serviceTemplates.forEach(s => {
        s.subtasks.forEach(t => srvData.push({
          ServiceName: s.serviceName,
          TaskTitle: t.title,
          Assignee: t.assignee
        }));
      });
      const srvSheet = srvData.length > 0 ? XLSX.utils.json_to_sheet(srvData, { header: ['ServiceName', 'TaskTitle', 'Assignee'] }) : XLSX.utils.aoa_to_sheet([['ServiceName', 'TaskTitle', 'Assignee']]);
      XLSX.utils.book_append_sheet(wb, srvSheet, 'Service_Templates');

      // HR & Month Variables
      const hrData = [
        { Key: 'Absence Threshold', Value: localHrVars.flaggedAbsenceThreshold },
        { Key: 'Disciplinary Exp. (Months)', Value: localHrVars.disciplinaryExpirationMonths },
        { Key: 'Probation Days', Value: localHrVars.defaultProbationDays },
        { Key: 'Investigation Days', Value: localHrVars.investigationPeriodDays },
        { Key: 'Appeal Days', Value: localHrVars.appealPeriodDays },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hrData), 'HR_Variables');

      const stageLabels = Object.entries(localHrVars.onboardingStageLabels || {}).map(([k, v]) => ({ Step: k, Label: v }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stageLabels), 'Onboarding_Labels');

      const monthData = Object.entries(localMonthVals).map(([k, v]) => ({ Month: k, WorkDays: v.workDays, OTRate: v.overtimeRate }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthData), 'Month_Variables');

      const fileName = 'System_Variables.xlsx';
      const win = window as any;
      if (win.electronAPI?.savePathDialog) {
        win.electronAPI.savePathDialog({
          title: 'Export System Variables (Excel)',
          defaultPath: fileName,
          filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        }).then((filePath: string) => {
          if (filePath) {
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            win.electronAPI.writeFile(filePath, buf, 'binary').then((success: boolean) => {
              if (success) toast.success(`Exported to ${filePath}`);
              else toast.error('Failed to save file.');
            });
          }
        });
      } else {
        XLSX.writeFile(wb, fileName);
      }
      toast.success('System variables exported successfully.');
    } catch (error) {
      toast.error('Failed to export variables.');
    }
  };

  const handleImportVariables = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm(
      'Ready to import variables. Would you like to OVERWRITE existing data? (No will APPEND new entries instead)',
      { 
        title: 'Import Variables',
        confirmLabel: 'Overwrite All',
        cancelLabel: 'Append New'
      }
    ).then(async (isOverwrite) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: 'binary' });

          // Local collections for bulk updates if overwrite
          const newDepts: any[] = isOverwrite ? [] : [...departments];
          const newPositions: any[] = isOverwrite ? [] : [...positions];
          const newClients: string[] = isOverwrite ? [] : [...clients];
          const newLeaveTypes: string[] = isOverwrite ? [] : [...leaveTypes];
          const newHolidays: any[] = isOverwrite ? [] : [...publicHolidays];
          const newLCats: any[] = isOverwrite ? [] : [...ledgerCategories];
          const newLVendors: any[] = isOverwrite ? [] : [...ledgerVendors];
          const newLBanks: any[] = isOverwrite ? [] : [...ledgerBanks];
          const newLBenBanks: any[] = isOverwrite ? [] : [...ledgerBeneficiaryBanks];
          const newTaskLists: any[] = isOverwrite ? [] : [...departmentTasksList];

          if (wb.SheetNames.includes('Departments')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Departments']);
            data.forEach(row => {
              const name = String(row.Department || row.name || '').trim();
              if (name && (isOverwrite || !newDepts.some(d => d.name.toLowerCase() === name.toLowerCase()))) {
                newDepts.push({
                  id: generateId(),
                  name,
                  staffType: row.staffType || 'OFFICE',
                  workDaysPerWeek: Number(row['Work Days/Week'] || row.workDaysPerWeek) || 5
                });
              }
            });
            await setDepartments(newDepts);
          }

          if (wb.SheetNames.includes('Positions')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Positions']);
            data.forEach(row => {
              const title = String(row.Position || row.title || '').trim();
              const dName = String(row.Department || '').trim();
              let deptId = null;
              if (dName) {
                const d = newDepts.find(d => d.name.toLowerCase() === dName.toLowerCase());
                if (d) deptId = d.id;
              }
              if (title && (isOverwrite || !newPositions.some(p => p.title.toLowerCase() === title.toLowerCase() && p.departmentId === deptId))) {
                newPositions.push({ id: generateId(), title, departmentId: deptId });
              }
            });
            await setPositions(newPositions);
          }

          if (wb.SheetNames.includes('Clients')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Clients']);
            data.forEach(row => {
              const c = String(row.Client || row.name || '').trim();
              if (c && c.toLowerCase() !== 'dcel' && (isOverwrite || !newClients.includes(c))) {
                newClients.push(c);
              }
            });
            await setClients(newClients);
          }

          if (wb.SheetNames.includes('Leave_Types')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Leave_Types']);
            data.forEach(row => {
              const lt = String(row.LeaveType || row.Leave_Type || '').trim();
              if (lt && (isOverwrite || !newLeaveTypes.includes(lt))) {
                newLeaveTypes.push(lt);
              }
            });
            await setLeaveTypes(newLeaveTypes);
          }

          if (wb.SheetNames.includes('Public_Holidays')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Public_Holidays']);
            data.forEach(row => {
              const date = normalizeDate(row.Date || row.date || '');
              const name = String(row.Name || '');
              if (date && name && (isOverwrite || !newHolidays.some(h => h.date === date && h.name === name))) {
                newHolidays.push({ id: generateId(), date, name });
              }
            });
            await setPublicHolidays(newHolidays);
          }

          if (wb.SheetNames.includes('Ledger_Categories')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Ledger_Categories']);
            data.forEach(row => {
              const name = String(row.Category || '').trim();
              if (name && (isOverwrite || !newLCats.some(c => c.name.toLowerCase() === name.toLowerCase()))) {
                newLCats.push({ id: generateId(), name });
              }
            });
            await setLedgerCategories(newLCats);
          }

          if (wb.SheetNames.includes('Ledger_Vendors')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Ledger_Vendors']);
            data.forEach(row => {
              const name = String(row.Vendor || '').trim();
              if (name && (isOverwrite || !newLVendors.some(v => v.name.toLowerCase() === name.toLowerCase()))) {
                newLVendors.push({ id: generateId(), name, tinNumber: String(row.TIN || '') });
              }
            });
            await setLedgerVendors(newLVendors);
          }

          if (wb.SheetNames.includes('Ledger_Banks')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Ledger_Banks']);
            data.forEach(row => {
              const name = String(row.Bank || '').trim();
              if (name && (isOverwrite || !newLBanks.some(b => b.name.toLowerCase() === name.toLowerCase()))) {
                newLBanks.push({ id: generateId(), name });
              }
            });
            await setLedgerBanks(newLBanks);
          }

          if (wb.SheetNames.includes('Ledger_Beneficiary_Banks')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Ledger_Beneficiary_Banks']);
            data.forEach(row => {
              const name = String(row.Bank || '').trim();
              if (name && (isOverwrite || !newLBenBanks.some(b => b.name.toLowerCase() === name.toLowerCase()))) {
                newLBenBanks.push({ id: generateId(), name, accountNo: '' });
              }
            });
            await setLedgerBeneficiaryBanks(newLBenBanks);
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
                if (row.Key.includes('VAT')) newPv.vatRate = val;
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

          if (wb.SheetNames.includes('HR_Variables')) {
            const hrData = XLSX.utils.sheet_to_json<any>(wb.Sheets['HR_Variables']);
            const newHr = { ...localHrVars };
            hrData.forEach(row => {
              const val = parseInt(row.Value, 10);
              if (!isNaN(val)) {
                if (row.Key.includes('Absence')) newHr.flaggedAbsenceThreshold = val;
                if (row.Key.includes('Disciplinary')) newHr.disciplinaryExpirationMonths = val;
                if (row.Key.includes('Probation')) newHr.defaultProbationDays = val;
                if (row.Key.includes('Investigation')) newHr.investigationPeriodDays = val;
                if (row.Key.includes('Appeal')) newHr.appealPeriodDays = val;
              }
            });

            if (wb.SheetNames.includes('Onboarding_Labels')) {
              const labelData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Onboarding_Labels']);
              const labels: Record<string, string> = isOverwrite ? {} : { ...(newHr.onboardingStageLabels || {}) };
              labelData.forEach(row => {
                if (row.Step && row.Label) labels[String(row.Step)] = String(row.Label);
              });
              newHr.onboardingStageLabels = labels;
            }
            updateLocalHrVariables(newHr);
          }

          if (wb.SheetNames.includes('Month_Variables')) {
            const mData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Month_Variables']);
            const newMonths = { ...localMonthVals };
            mData.forEach(row => {
              if (row.Month) {
                newMonths[row.Month] = {
                  workDays: Number(row.WorkDays) || 22,
                  overtimeRate: Number(row.OTRate) || 0.5
                };
              }
            });
            setLocalMonthVals(newMonths);
          }

          if (wb.SheetNames.includes('Task_Templates')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Task_Templates']);
            data.forEach(row => {
              const deptName = row.Department;
              if (!deptName) return;
              let list = newTaskLists.find(d => d.department === deptName);
              if (!list) {
                list = { department: deptName, onboardingTasks: [], offboardingTasks: [] };
                newTaskLists.push(list);
              }
              const task = { title: String(row.Title || ''), assignee: String(row.Assignee || '') };
              const isOnboarding = String(row.Type).toLowerCase() === 'onboarding';
              const targetList = isOnboarding ? list.onboardingTasks : list.offboardingTasks;
              const exists = targetList.some((t: any) => t.title === task.title && t.assignee === task.assignee);
              if (!exists) targetList.push(task);
            });
          }

          if (wb.SheetNames.includes('Service_Templates')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['Service_Templates']);
            data.forEach(row => {
              const sName = `__SERVICE__${row.ServiceName}`;
              let list = newTaskLists.find(d => d.department === sName);
              if (!list) {
                list = { department: sName, onboardingTasks: [], offboardingTasks: [] };
                newTaskLists.push(list);
              }
              const exists = list.onboardingTasks.some((t: any) => t.title === String(row.TaskTitle) && t.assignee === String(row.Assignee));
              if (!exists) list.onboardingTasks.push({ title: String(row.TaskTitle), assignee: String(row.Assignee) });
            });
          }
          
          if (wb.SheetNames.includes('Task_Templates') || wb.SheetNames.includes('Service_Templates')) {
            await setDepartmentTasksList(newTaskLists);
          }

          toast.success('Variables imported successfully.');
        } catch (error) {
          console.error(error);
          toast.error('Failed to parse the file.');
        } finally {
          if (e.target) e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
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
            <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
              <Download className="h-3.5 w-3.5 text-indigo-500" />
              Import
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportVariables}
                className="hidden"
              />
            </label>
          )}
          {priv.canExport && (
            <Button 
              variant="outline" 
              onClick={handleExportVariables} 
              className="gap-2 h-9 px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-500" />
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

      {/* Section selector */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 self-start">
        <button
          onClick={() => setVarSection('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            varSection === 'system'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings2 className="h-4 w-4" />
          System Variables
        </button>
        <button
          onClick={() => setVarSection('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            varSection === 'ledger'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Ledger Variables
        </button>
        <button
          onClick={() => setVarSection('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            varSection === 'services'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Project Services
        </button>
      </div>

      {varSection === 'services' ? (
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200 border-t-4 border-t-cyan-500">
            <CardHeader className="bg-cyan-50/30 rounded-t-lg border-b border-cyan-100">
              <CardTitle className="text-cyan-900">Configure Project Services</CardTitle>
              <CardDescription>
                Define available services (e.g., Dewatering, Waterproofing) and their preset subtasks. These templates populate automatically during Site Onboarding when creating a new project.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              
              {/* Add New Service */}
              {priv.canEdit && (
                <div className="flex gap-2">
                  <Input 
                    placeholder="New Service Name (e.g. Dewatering)" 
                    value={newServiceName} 
                    onChange={e => setNewServiceName(e.target.value)} 
                    className="flex-1 max-w-sm"
                  />
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (!newServiceName) return;
                      const exists = serviceTemplates.find(s => s.serviceName.toLowerCase() === newServiceName.toLowerCase());
                      if (!exists) {
                        updateServiceTemplate({ serviceName: newServiceName, subtasks: [] });
                        setNewServiceName('');
                        setSelectedService(newServiceName);
                      } else {
                        toast.error('Service already exists');
                      }
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add Service
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {serviceTemplates.length === 0 && <p className="text-sm text-slate-400 italic">No services configured.</p>}
                {serviceTemplates.map(s => (
                  <button
                    key={s.serviceName}
                    onClick={() => setSelectedService(s.serviceName === selectedService ? '' : s.serviceName)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${selectedService === s.serviceName 
                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm' 
                        : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {s.serviceName}
                    {priv.canEdit && selectedService === s.serviceName && (
                      <span
                        className="p-0.5 rounded-full hover:bg-red-500/20 text-white/70 hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm(
                            `Are you sure you want to completely remove the ${s.serviceName} service and its tasks?`,
                            { title: 'Remove Service' }
                          ).then(confirmed => {
                            if (confirmed) {
                              removeServiceTemplateStore(s.serviceName);
                              if (selectedService === s.serviceName) setSelectedService('');
                            }
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Service Subtasks */}
              {selectedService && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/20 overflow-hidden mt-6">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-cyan-100/60 border-b border-cyan-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                      Preset Tasks for {selectedService}
                    </span>
                    <span className="text-[10px] text-cyan-700 bg-cyan-100/80 rounded px-2 py-0.5 font-semibold">
                      {serviceTemplates.find(s => s.serviceName === selectedService)?.subtasks.length || 0} tasks
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    {priv.canEdit && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-white rounded-lg border border-cyan-100 shadow-sm">
                        <Input 
                          placeholder="Task Title (e.g. Site Visitation)" 
                          value={newServiceTaskTitle} 
                          onChange={(e) => setNewServiceTaskTitle(e.target.value)} 
                          className="md:col-span-6 h-9" 
                        />
                        <select 
                          className="md:col-span-4 h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" 
                          value={newServiceTaskAssignee} 
                          onChange={(e) => setNewServiceTaskAssignee(e.target.value)}
                        >
                          <option value="">-- Default Assignee Team --</option>
                          <option value="HR">HR</option>
                          <option value="Engineering">Engineering</option>
                          <option value="Operations">Operations</option>
                          <option value="Site Manager">Site Manager</option>
                          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            if (!newServiceTaskTitle) return;
                            const srv = serviceTemplates.find(s => s.serviceName === selectedService);
                            if (srv) {
                              updateServiceTemplate({ ...srv, subtasks: [...srv.subtasks, { title: newServiceTaskTitle, assignee: newServiceTaskAssignee }] });
                              setNewServiceTaskTitle('');
                            }
                          }} 
                          className="md:col-span-2 gap-1 border-cyan-300 text-cyan-700 hover:bg-cyan-50 h-9" 
                          disabled={!newServiceTaskTitle}
                        >
                          <Plus className="h-4 w-4" /> Add Task
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {(serviceTemplates.find(s => s.serviceName === selectedService)?.subtasks || []).map((t, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm group hover:border-cyan-300 transition-colors">
                          <span className="h-6 w-6 rounded-full bg-cyan-100/50 text-cyan-700 text-[11px] font-bold flex items-center justify-center shrink-0 border border-cyan-200">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{t.title}</p>
                            {t.assignee && <p className="text-[11px] text-slate-500 mt-0.5">Assigned to: {t.assignee}</p>}
                          </div>
                          {priv.canEdit && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" 
                              onClick={() => {
                                const srv = serviceTemplates.find(s => s.serviceName === selectedService);
                                if (srv) updateServiceTemplate({ ...srv, subtasks: srv.subtasks.filter((_, i) => i !== idx) });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {(serviceTemplates.find(s => s.serviceName === selectedService)?.subtasks || []).length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-6 italic border-2 border-dashed border-slate-200 rounded-lg">
                          No tasks defined for this service yet. Add one above.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : varSection === 'ledger' ? (
        /* ── LEDGER VARIABLES SECTION ─────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Categories</CardTitle>
              <CardDescription>Expense categories used for ledger entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-2">
                <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New Category" />
                <Button disabled={!priv.canEdit} onClick={() => { if(newCat) { addLedgerCategory({id: generateId(), name: newCat}); setNewCat(''); } }}>Add</Button>
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden max-h-72 overflow-y-auto">
                <Table>
                  <TableBody>
                    {ledgerCategories.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-slate-700">{c.name}</TableCell>
                        <TableCell className="w-[50px]">
                          {priv.canEdit && (
                            <Button variant="ghost" size="icon" onClick={async () => { const conf = await showConfirm(`Delete category "${c.name}"?`, { variant: 'danger' }); if (conf) removeLedgerCategory(c.id); }}>
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {ledgerCategories.length === 0 && (
                      <TableRow><TableCell className="text-slate-400 text-center text-sm py-6 italic">No categories yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Banks / Accounts</CardTitle>
              <CardDescription>Pay-from accounts and bank names.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-2">
                <Input value={newBank} onChange={e => setNewBank(e.target.value)} placeholder="New Bank Name" />
                <Button disabled={!priv.canEdit} onClick={() => { if(newBank) { addLedgerBank({id: generateId(), name: newBank}); setNewBank(''); } }}>Add</Button>
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden max-h-72 overflow-y-auto">
                <Table>
                  <TableBody>
                    {ledgerBanks.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-slate-700">{b.name}</TableCell>
                        <TableCell className="w-[50px]">
                          {priv.canEdit && (
                            <Button variant="ghost" size="icon" onClick={async () => { const conf = await showConfirm(`Delete bank "${b.name}"?`, { variant: 'danger' }); if (conf) removeLedgerBank(b.id); }}>
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {ledgerBanks.length === 0 && (
                      <TableRow><TableCell className="text-slate-400 text-center text-sm py-6 italic">No banks yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 md:col-span-2 lg:col-span-1">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Vendors</CardTitle>
              <CardDescription>Store vendors with optional TIN numbers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-2">
                <Input value={newVendorName} onChange={e => setNewVendorName(e.target.value)} placeholder="Vendor Name" className="flex-1" />
                <Input value={newVendorTin} onChange={e => setNewVendorTin(e.target.value)} placeholder="TIN" className="w-[100px]" />
                <Button disabled={!priv.canEdit} onClick={() => { if(newVendorName) { addLedgerVendor({id: generateId(), name: newVendorName, tinNumber: newVendorTin}); setNewVendorName(''); setNewVendorTin(''); } }}>Add</Button>
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead>Vendor</TableHead><TableHead>TIN</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ledgerVendors.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-slate-700">{v.name}</TableCell>
                        <TableCell className="text-sm text-slate-500">{v.tinNumber || '—'}</TableCell>
                        <TableCell className="w-[80px]">
                          <div className="flex items-center gap-1">
                            {priv.canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => handleOpenRename('ledgerVendor', v.name, v.id)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {priv.canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={async () => { const conf = await showConfirm(`Delete vendor "${v.name}"?`, { variant: 'danger' }); if (conf) removeLedgerVendor(v.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {ledgerVendors.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-slate-400 text-center text-sm py-6 italic">No vendors yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Beneficiary Banks (Paid To)</CardTitle>
              <CardDescription>Target banks and accounts for company expenses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-2 w-full">
                <Input value={newBenBankName} onChange={e => setNewBenBankName(e.target.value)} placeholder="Bank Name" className="flex-1" />
                <Button disabled={!priv.canEdit} onClick={() => { if(newBenBankName) { addLedgerBeneficiaryBank({id: generateId(), name: newBenBankName, accountNo: ''}); setNewBenBankName(''); } }}>Add</Button>
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead>Bank</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ledgerBeneficiaryBanks.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-slate-700">{b.name}</TableCell>
                        <TableCell className="w-[80px]">
                          <div className="flex items-center gap-1">
                            {priv.canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => handleOpenRename('ledgerBenBank', b.name, b.id)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {priv.canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={async () => { const conf = await showConfirm(`Delete beneficiary bank "${b.name}"?`, { variant: 'danger' }); if (conf) removeLedgerBeneficiaryBank(b.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {ledgerBeneficiaryBanks.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-slate-400 text-center text-sm py-6 italic">No beneficiary banks yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
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
                          <TableCell className="font-medium">{formatDisplayDate(holiday.date)}</TableCell>
                          <TableCell>{holiday.name}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {priv.canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenRename('holiday', holiday.name, holiday.id, holiday.date)}
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
                            </div>
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
                  <select
                    className="h-10 rounded border border-slate-200 px-3 w-40 text-sm bg-white"
                    value={newPosDeptId}
                    onChange={(e) => setNewPosDeptId(e.target.value)}
                  >
                    <option value="">-- Dept --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <Button onClick={handleAddPosition} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto w-full">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead>Position Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-[80px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4 italic">No positions defined.</TableCell></TableRow>
                    ) : (
                      positions.map(pos => {
                        return (
                          <TableRow key={pos.id}>
                            <TableCell className="align-middle">
                              {priv.canEdit ? (
                                <Input 
                                  value={pos.title}
                                  onChange={(e) => updatePosition(pos.id, { title: e.target.value })}
                                  className="h-8 max-w-[250px]"
                                />
                              ) : (
                                <span className="font-medium text-slate-800">{pos.title}</span>
                              )}
                            </TableCell>
                            <TableCell className="align-middle bg-transparent">
                              {priv.canEdit ? (
                                <select
                                  className="h-8 rounded border border-slate-200 px-2 text-sm bg-white min-w-[120px]"
                                  value={pos.departmentId || ''}
                                  onChange={(e) => updatePosition(pos.id, { departmentId: e.target.value })}
                                >
                                  <option value="">Unassigned</option>
                                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                              ) : (
                                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md">
                                  {departments.find(d => d.id === pos.departmentId)?.name || 'Unassigned'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-middle bg-transparent">
                              {(() => {
                                const dept = departments.find(d => d.id === pos.departmentId);
                                if (!dept) return <span className="text-[10px] font-bold text-slate-300">N/A</span>;
                                if (dept.staffType === 'NON-EMPLOYEE') 
                                  return <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full uppercase">Non-Employee</span>;
                                return (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${dept.staffType === 'FIELD' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {dept.staffType} Staff
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right align-middle">
                              <div className="flex items-center justify-end gap-1">
                                {priv.canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenRename('position', pos.title, pos.id)}
                                    className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {priv.canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removePosition(pos.id)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* --- MOVED DEPARTMENTS --- */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>Manage available departments and their hierarchy.</CardDescription>
            </CardHeader>
            <CardContent>
              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input placeholder="New Department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="flex-1" />
                  <div className="flex flex-col gap-1.5 w-40">
                    <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Dept Category</label>
                    <select 
                       className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer focus:ring-2 focus:ring-indigo-400 outline-none"
                       value={newDeptStaffType}
                       onChange={(e) => setNewDeptStaffType(e.target.value as any)}
                    >
                       <option value="OFFICE">Office Staff</option>
                       <option value="FIELD">Field Staff</option>
                       <option value="NON-EMPLOYEE">Non-Employee</option>
                    </select>
                  </div>
                  <Button onClick={handleAddDepartment} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="border rounded-md overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Parent Dept</TableHead>
                      <TableHead>Category (Routing)</TableHead>
                      <TableHead className="w-32 text-center">Work Days/Wk</TableHead>
                      <TableHead className="w-[80px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map(dep => {
                      return (
                        <TableRow key={dep.id}>
                          <TableCell className="font-medium text-slate-800">
                            {dep.name}
                          </TableCell>
                          <TableCell>
                            {priv.canEdit ? (
                              <select
                                className="h-8 rounded border border-slate-200 px-2 text-sm bg-white w-full"
                                value={dep.parentDepartmentId || ''}
                                onChange={(e) => updateDepartment(dep.id, { parentDepartmentId: e.target.value || null })}
                              >
                                <option value="">None (Top Level)</option>
                                {departments.filter(d => d.id !== dep.id).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md block truncate">
                                {departments.find(d => d.id === dep.parentDepartmentId)?.name || 'None'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {priv.canEdit ? (
                              <select 
                                 className="h-8 rounded border border-slate-200 px-2 text-sm bg-white min-w-[140px] focus:ring-2 focus:ring-indigo-400 outline-none"
                                 value={dep.staffType}
                                 onChange={(e) => updateDepartment(dep.id, { staffType: e.target.value as any })}
                              >
                                 <option value="OFFICE">Office Staff</option>
                                 <option value="FIELD">Field Staff</option>
                                 <option value="NON-EMPLOYEE">Non-Employee</option>
                              </select>
                            ) : (
                               <div className="flex">
                                 {dep.staffType === 'NON-EMPLOYEE' ? (
                                   <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full uppercase">Non-Employee</span>
                                 ) : (
                                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${dep.staffType === 'FIELD' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                     {dep.staffType} Staff
                                   </span>
                                 )}
                               </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={1}
                              max={7}
                              value={dep.workDaysPerWeek}
                              onChange={(e) => {
                                updateDepartment(dep.id, { workDaysPerWeek: Math.max(1, Math.min(7, Number(e.target.value))) });
                              }}
                              className="h-8 w-16 mx-auto text-center"
                              disabled={!priv.canEdit}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {priv.canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenRename('department', dep.name, dep.id)}
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {priv.canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeDepartment(dep.id)}
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
                      <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-teal-200">
                        <button onClick={() => handleOpenRename('leaveType', lt)} className="text-teal-400 hover:text-indigo-600">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={() => removeLeaveType(lt)} className="text-teal-400 hover:text-rose-500">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ——— PAYEE TYPES ——— */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Payee Types</CardTitle>
              <CardDescription>Define categories for non-employees (e.g. Director, Contractor).</CardDescription>
            </CardHeader>
            <CardContent>
              {priv.canEdit && (
                <div className="flex gap-2 mb-4">
                  <Input 
                    placeholder="e.g. Volunteer" 
                    value={newPayeeType} 
                    onChange={(e) => setNewPayeeType(e.target.value)} 
                    className="flex-1" 
                  />
                  <Button 
                    onClick={() => { 
                      if (newPayeeType && !(localHrVars.payeeTypes || []).includes(newPayeeType)) { 
                        const newTypes = [...(localHrVars.payeeTypes || []), newPayeeType];
                        updateHrVariables({ payeeTypes: newTypes });
                        updateLocalHrVariables({ payeeTypes: newTypes }); 
                        setNewPayeeType(''); 
                      } 
                    }} 
                    variant="outline" 
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(localHrVars.payeeTypes || []).map(pt => (
                  <div key={pt} className="bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 text-sm flex items-center gap-2 text-indigo-800">
                    {pt}
                    {priv.canEdit && (
                      <button 
                        onClick={() => {
                          const newTypes = (localHrVars.payeeTypes || []).filter(t => t !== pt);
                          updateHrVariables({ payeeTypes: newTypes });
                          updateLocalHrVariables({ payeeTypes: newTypes });
                        }} 
                        className="text-indigo-400 hover:text-rose-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Task Templates */}
          <Card className="shadow-sm border-slate-200 border-t-4 border-t-indigo-500">
            <CardHeader className="bg-indigo-50/30 rounded-t-lg border-b border-indigo-100 flex-row items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-indigo-900">Onboarding Task Templates</CardTitle>
                <CardDescription>
                  <strong>System Default Tasks</strong> (Steps 1–8) are built-in for all departments and cannot be removed.
                  Add <strong>custom extra tasks</strong> below and choose where they slot in.
                </CardDescription>
              </div>
              {priv.canEdit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-indigo-600 text-white hover:bg-indigo-700 border-none h-8 gap-2 ml-4 px-4"
                  onClick={handleDeduplicateAllTasks}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clean Duplicate Tasks
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Department filter */}
              <div className="flex gap-2">
                <select className="flex-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm cursor-pointer" value={taskDeptFilter} onChange={(e) => setTaskDeptFilter(e.target.value)}>
                  <option value="ALL">ALL DEPARTMENTS (always applied)</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              {/* Unified Onboarding Tasks */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-100/60 border-b border-indigo-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Onboarding Tasks{taskDeptFilter !== 'ALL' ? ` — ${taskDeptFilter}` : ' (All Departments)'}</span>
                  <span className="text-[10px] text-indigo-600 bg-indigo-100 rounded px-2 py-0.5 font-semibold">{taskDeptFilter === 'ALL' ? 7 + currentTaskView.onboardingTasks.length : currentTaskView.onboardingTasks.length} tasks</span>
                </div>
                <div className="p-3 space-y-3">
                  
                  {/* System Base Tasks (Only shown in ALL DEPARTMENTS) */}
                  {taskDeptFilter === 'ALL' && (
                    <div className="space-y-1.5 mb-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Core System Stages (Hardcoded Flow)</p>
                      {[
                        { step: '1', key: '1', defaultLabel: 'Send Necessary Information (Forms)' },
                        { step: '2', key: '2', defaultLabel: 'Return of Forms' },
                        { step: '3', key: '3', defaultLabel: 'Verification of Documents' },
                        { step: '4', key: '4', defaultLabel: 'Resumption — Verified Start Date' },
                        { step: '5', key: '5', defaultLabel: 'Employment Letters' },
                        { step: '6', key: '6', defaultLabel: 'Orientation (HR, Department, Site, HSE)' },
                        { step: '7', key: '7', defaultLabel: 'Provision of PPE, Handbook & Requirements' },
                      ].map(item => (
                        <div key={item.step} className="flex gap-2 p-2 rounded-lg bg-white border border-indigo-100 items-center">
                          <span className="h-6 w-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{item.step}</span>
                          <div className="flex-1">
                            {priv.canEdit ? (
                               <input 
                                 className="text-sm font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full transition-colors"
                                 value={localHrVars.onboardingStageLabels?.[item.key] ?? item.defaultLabel}
                                 onChange={(e) => updateLocalHrVariables({ onboardingStageLabels: { ...(localHrVars.onboardingStageLabels || {}), [item.key]: e.target.value } })}
                               />
                            ) : (
                               <p className="text-sm font-semibold text-slate-700">{localHrVars.onboardingStageLabels?.[item.key] ?? item.defaultLabel}</p>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">System Flow</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {priv.canEdit && (
                    <div className="space-y-2 p-3 bg-white rounded-lg border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Add Custom Onboarding Task</p>
                      <Input placeholder="Task title (e.g. Provide Laptop)" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="text-sm h-9" />
                      <div className="grid grid-cols-2 gap-2">
                        <select className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}>
                          <option value="">-- Select Assignee Dept --</option>
                          <option value="HR">HR</option>
                          <option value="IT">IT</option>
                          <option value="Finance">Finance</option>
                          <option value="Management">Management</option>
                          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                        <select className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" value={newTaskPosition} onChange={e => setNewTaskPosition(e.target.value)}>
                          <option value="start">Insert before Step 1</option>
                          <option value="after-1">After Step 1 (Send Forms)</option>
                          <option value="after-2">After Step 2 (Return of Forms)</option>
                          <option value="after-3">After Step 3 (Verification)</option>
                          <option value="after-4">After Step 4 (Start Date)</option>
                          <option value="after-5">After Step 5 (Letters)</option>
                          <option value="after-6">After Step 6 (Orientation)</option>
                          <option value="end">At End (after all steps)</option>
                          {currentTaskView.onboardingTasks.map((t, i) => (
                            <option key={i} value={`custom-after-${i}`}>After custom: "{t.title.slice(0, 22)}{t.title.length > 22 ? '...' : ''}"</option>
                          ))}
                        </select>
                      </div>
                      <Button variant="outline" onClick={handleAddTask} className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 w-full h-9" disabled={!newTaskTitle || !newTaskAssignee}>
                        <Plus className="h-4 w-4" /> Add Task
                      </Button>
                    </div>
                  )}
                  {currentTaskView.onboardingTasks.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-4 italic">No custom tasks added for this department context.</p>
                    : <div className="space-y-1.5">{currentTaskView.onboardingTasks.map((t, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 group hover:border-indigo-300 transition-colors">
                          <div className="flex flex-col gap-0.5">
                            <button className="h-5 w-5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center disabled:opacity-30 text-[10px]" onClick={() => handleMoveTask(idx, 'up')} disabled={idx === 0}>&#9650;</button>
                            <button className="h-5 w-5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center disabled:opacity-30 text-[10px]" onClick={() => handleMoveTask(idx, 'down')} disabled={idx === currentTaskView.onboardingTasks.length - 1}>&#9660;</button>
                          </div>
                          <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0">+</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{t.title}</p>
                            <p className="text-[11px] text-slate-500">Assignee: {t.assignee}</p>
                          </div>
                          {priv.canEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveTask(t.title, 'onboarding')}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}</div>
                  }
                </div>
              </div>

              {/* Offboarding tasks */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-rose-100/60 border-b border-rose-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Offboarding Tasks{taskDeptFilter !== 'ALL' ? ` — ${taskDeptFilter}` : ''}</span>
                  <span className="text-[10px] text-rose-600 bg-rose-100 rounded px-2 py-0.5 font-semibold">{currentTaskView.offboardingTasks.length} task{currentTaskView.offboardingTasks.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="p-3 space-y-2">
                  {priv.canEdit && (
                    <div className="flex gap-2 p-2 bg-white rounded-lg border border-rose-100">
                      <Input placeholder="Task title" value={newOffTaskTitle} onChange={e => setNewOffTaskTitle(e.target.value)} className="flex-1 text-sm h-9" />
                      <select className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm w-44 shrink-0" value={newOffTaskAssignee} onChange={e => setNewOffTaskAssignee(e.target.value)}>
                        <option value="">-- Assignee Dept --</option>
                        <option value="HR">HR</option>
                        <option value="IT">IT</option>
                        <option value="Finance">Finance</option>
                        <option value="Management">Management</option>
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                      <Button variant="outline" onClick={handleAddOffboardingTask} className="gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 shrink-0 h-9" disabled={!newOffTaskTitle || !newOffTaskAssignee}>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  )}
                  {currentTaskView.offboardingTasks.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-4 italic">No offboarding tasks configured.</p>
                    : currentTaskView.offboardingTasks.map((t, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-rose-100 group hover:border-rose-300 transition-colors">
                          <div className="flex flex-col gap-0.5">
                            <button className="h-5 w-5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center disabled:opacity-30 text-[10px]" onClick={() => handleMoveOffTask(idx, 'up')} disabled={idx === 0}>&#9650;</button>
                            <button className="h-5 w-5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center disabled:opacity-30 text-[10px]" onClick={() => handleMoveOffTask(idx, 'down')} disabled={idx === currentTaskView.offboardingTasks.length - 1}>&#9660;</button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{t.title}</p>
                            <p className="text-[11px] text-slate-400">Assignee: {t.assignee}</p>
                          </div>
                          {priv.canEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveTask(t.title, 'offboarding')}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))
                  }
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Performance & Conduct Variables */}
          <Card className="shadow-sm border-slate-200 border-t-4 border-t-rose-500">
            <CardHeader className="bg-rose-50/30 rounded-t-lg border-b border-rose-100">
              <CardTitle className="text-rose-900">Performance & Conduct Configuration</CardTitle>
              <CardDescription>
                Configure point weights, categories, and policy enforcement for the professional ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Merit Point Weight (Default)</label>
                  <Input 
                    type="number" 
                    value={localHrVars.meritWeight ?? 1} 
                    onChange={e => updateLocalHrVariables({ meritWeight: Number(e.target.value) })}
                    className="h-10 border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">Default points for positive accolades.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Demerit Point Weight (Default)</label>
                  <Input 
                    type="number" 
                    value={localHrVars.demeritWeight ?? -1} 
                    onChange={e => updateLocalHrVariables({ demeritWeight: Number(e.target.value) })}
                    className="h-10 border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">Default points for disciplinary cases.</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase">Performance Categories</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(localHrVars.performanceCategories || ['Attendance', 'Behavioral', 'Performance', 'Safety/PPE', 'Accolade', 'Clarity']).map((cat, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600">
                      {cat}
                      {priv.canEdit && (
                        <button onClick={() => {
                          const newCats = (localHrVars.performanceCategories || ['Attendance', 'Behavioral', 'Performance', 'Safety/PPE', 'Accolade', 'Clarity']).filter(c => c !== cat);
                          updateHrVariables({ performanceCategories: newCats });
                          updateLocalHrVariables({ performanceCategories: newCats });
                        }} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {priv.canEdit && (
                  <div className="flex gap-2">
                    <Input id="newPerformanceCat" placeholder="Add category (e.g. HSE)" className="h-9 border-slate-100" />
                    <Button size="sm" onClick={() => {
                      const inp = document.getElementById('newPerformanceCat') as HTMLInputElement;
                      if (inp.value) {
                        const newCats = [...(localHrVars.performanceCategories || ['Attendance', 'Behavioral', 'Performance', 'Safety/PPE', 'Accolade', 'Clarity']), inp.value];
                        updateHrVariables({ performanceCategories: newCats });
                        updateLocalHrVariables({ performanceCategories: newCats });
                        inp.value = '';
                      }
                    }} className="bg-slate-800 hover:bg-black text-white px-4">Add</Button>
                  </div>
                )}
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Suspension Cap (Days)</label>
                  <Input 
                    type="number" 
                    value={localHrVars.suspensionCapDays ?? 30} 
                    onChange={e => updateLocalHrVariables({ suspensionCapDays: Number(e.target.value) })}
                    className="h-10 border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Maximum allowable suspension period per violation according to policy.</p>
                </div>

                <div className="pt-4 border-t border-rose-100 flex flex-col gap-4">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sanction Thresholds (Points based)</label>
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase py-2">Sanction Level</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase py-2 w-32">Points Target</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(localHrVars.sanctionThresholds || [
                          { action: 'Verbal Warning', points: -1 },
                          { action: 'Written Warning', points: -3 },
                          { action: 'Final Warning', points: -5 },
                          { action: 'Suspension', points: -8 },
                          { action: 'Termination', points: -12 }
                        ]).map((st, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="text-sm font-semibold text-slate-700">{st.action}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="number" 
                                  value={st.points} 
                                  onChange={e => {
                                    const newThresholds = [...(localHrVars.sanctionThresholds || [])];
                                    newThresholds[idx] = { ...st, points: Number(e.target.value) };
                                    updateLocalHrVariables({ sanctionThresholds: newThresholds });
                                  }}
                                  className="h-8 text-sm font-mono text-center bg-slate-50"
                                />
                                <span className="text-[10px] font-bold text-rose-500">PTS</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Thresholds define when HR should automatically review and issue the next level of disciplinary action.</p>
                </div>
            </CardContent>
          </Card>
        </div> {/* END LEFT COLUMN */}


        {/* --- RIGHT COLUMN --- */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800 flex items-center gap-2">Payroll Breakdown Variables (<NairaSign className="h-4 w-4" />)</CardTitle>
              <CardDescription>Adjust the percentage breakdown for components of basic salary and automated deductions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Salary Components Breakdown</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Combined components should correctly total 100%.</p>
                  </div>
                  {(() => {
                    const total = Number(localPayrollVars.basic || 0) + Number(localPayrollVars.housing || 0) + Number(localPayrollVars.transport || 0) + Number(localPayrollVars.otherAllowances || 0);
                    const isPerfect = total === 100;
                    const isOver = total > 100;
                    return (
                      <div className={`px-4 py-2 rounded-lg border flex flex-col items-end justify-center transition-colors shadow-sm ${
                        isPerfect ? 'bg-emerald-50 border-emerald-200' : isOver ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                      }`}>
                        <span className={`text-xl font-black leading-none ${isPerfect ? 'text-emerald-600' : isOver ? 'text-rose-600' : 'text-amber-600'}`}>
                          {total}%
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isPerfect ? 'text-emerald-500' : isOver ? 'text-rose-500' : 'text-amber-500'}`}>
                          Total
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {(() => {
                  const total = Number(localPayrollVars.basic || 0) + Number(localPayrollVars.housing || 0) + Number(localPayrollVars.transport || 0) + Number(localPayrollVars.otherAllowances || 0);
                  const denom = Math.max(100, total);
                  const b = (Number(localPayrollVars.basic || 0) / denom) * 100;
                  const h = (Number(localPayrollVars.housing || 0) / denom) * 100;
                  const t = (Number(localPayrollVars.transport || 0) / denom) * 100;
                  const o = (Number(localPayrollVars.otherAllowances || 0) / denom) * 100;

                  return (
                    <div className="h-3.5 w-full bg-slate-200 rounded-full overflow-hidden flex border border-slate-300/50 shadow-inner">
                      {b > 0 && <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${b}%` }} title={`Basic: ${localPayrollVars.basic}%`} />}
                      {h > 0 && <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${h}%` }} title={`Housing: ${localPayrollVars.housing}%`} />}
                      {t > 0 && <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${t}%` }} title={`Transport: ${localPayrollVars.transport}%`} />}
                      {o > 0 && <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${o}%` }} title={`Other: ${localPayrollVars.otherAllowances}%`} />}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-start gap-1.5">
                      <span className="w-2.5 h-2.5 mt-0.5 rounded-sm bg-indigo-500 block shrink-0"></span>
                      Basic Salary
                    </label>
                    <Input
                      type="number"
                      className="font-mono text-sm shadow-sm h-9"
                      value={localPayrollVars.basic}
                      onChange={e => updateLocalPayrollVariables({ basic: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-start gap-1.5">
                      <span className="w-2.5 h-2.5 mt-0.5 rounded-sm bg-emerald-500 block shrink-0"></span>
                      Housing
                    </label>
                    <Input
                      type="number"
                      className="font-mono text-sm shadow-sm h-9"
                      value={localPayrollVars.housing}
                      onChange={e => updateLocalPayrollVariables({ housing: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-start gap-1.5">
                      <span className="w-2.5 h-2.5 mt-0.5 rounded-sm bg-amber-500 block shrink-0"></span>
                      Transport
                    </label>
                    <Input
                      type="number"
                      className="font-mono text-sm shadow-sm h-9"
                      value={localPayrollVars.transport}
                      onChange={e => updateLocalPayrollVariables({ transport: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-start gap-1.5 leading-tight">
                      <span className="w-2.5 h-2.5 mt-0.5 rounded-sm bg-rose-500 block shrink-0"></span>
                      Other Allowances
                    </label>
                    <Input
                      type="number"
                      className="font-mono text-sm shadow-sm h-9"
                      value={localPayrollVars.otherAllowances}
                      onChange={e => updateLocalPayrollVariables({ otherAllowances: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <div className="space-y-1.5">
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
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">WHT Rate (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={localPayrollVars.withholdingTaxRate}
                    onChange={e => updateLocalPayrollVariables({ withholdingTaxRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-400">Withholding Tax (5% by default)</p>
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
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
                {monthConfigDept && (() => {
                  const deptObj = departments.find(d => d.name === monthConfigDept);
                  const effective = deptObj?.workDaysPerWeek ?? (deptObj?.staffType === 'FIELD' ? 6 : 5);
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

                      // Compute workdays using the department's workDaysPerWeek from the departments table
                      const selectedDefaultDays = monthConfigDept
                        ? (() => { const d = departments.find(dep => dep.name === monthConfigDept); return d?.workDaysPerWeek ?? (d?.staffType === 'FIELD' ? 6 : 5); })()
                        : 6;
                      const deptWorkDaysPerWeek = monthConfigDept ? selectedDefaultDays : 6;
                      const computedWorkDays = computeWorkDays(payrollYear, monthNum, holidayDateStrings, deptWorkDaysPerWeek);

                      const data = localMonthVals[key] || { workDays: 0, overtimeRate: 0.5 };
                      const formatDate = (d: Date) =>
                        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-slate-500 text-xs font-mono">{formatDisplayDate(startDate)}</TableCell>
                          <TableCell className="text-slate-500 text-xs font-mono">{formatDisplayDate(endDate)}</TableCell>
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
                These values drive the payroll calculation system.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-tighter">Calculation Logic Reference</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase">1. Gross Revenue</p>
                    <p className="text-xs text-slate-700 font-medium">(Monthly Salary × 12) + Overtime</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase">2. Reliefs (CRA)</p>
                    <p className="text-xs text-slate-700 font-medium">Base CRA + Rent Relief (Max 500k) + Pension</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase">3. Taxable Income</p>
                    <p className="text-xs text-slate-700 font-medium">Gross Revenue &minus; Total Reliefs</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase">4. Monthly PAYE</p>
                    <p className="text-xs text-slate-700 font-medium">(Annual Tax from Brackets) &divide; 12</p>
                  </div>
                </div>
              </div>

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
          
          {/* --- HR Module & Disciplinary Settings --- */}
          <Card className="border-indigo-200">
            <CardHeader className="bg-indigo-50/50 rounded-t-lg border-b border-indigo-100">
              <CardTitle className="text-indigo-900">HR, Disciplinary &amp; Lifecycle Settings (Due Process)</CardTitle>
              <CardDescription>
                Configure thresholds, time-frames, and policies applied automatically by the system. Includes specific "Due Process" variables such as the investigation timeframe and appeal allowance periods.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase">Attendance &amp; Disciplinary Auto-Triggers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Flagged Absence Threshold</label>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={localHrVars.flaggedAbsenceThreshold}
                        onChange={e => updateLocalHrVariables({ flaggedAbsenceThreshold: parseInt(e.target.value) || 0 })} />
                      <span className="text-sm text-slate-500 whitespace-nowrap">flagged days</span>
                    </div>
                    <p className="text-xs text-slate-400">Absences generating auto-warning (e.g. 3)</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Disciplinary Expiration/Rolling Period</label>
                    <div className="flex items-center gap-2">
                       <Input type="number" value={localHrVars.disciplinaryExpirationMonths}
                        onChange={e => updateLocalHrVariables({ disciplinaryExpirationMonths: parseInt(e.target.value) || 0 })} />
                       <span className="text-sm text-slate-500 whitespace-nowrap">months</span>
                    </div>
                    <p className="text-xs text-slate-400">Duration a record stays active</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase">Evaluations &amp; Lifecycle Checks</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Default Probation Period</label>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={localHrVars.defaultProbationDays}
                        onChange={e => updateLocalHrVariables({ defaultProbationDays: parseInt(e.target.value) || 0 })} />
                      <span className="text-sm text-slate-500 whitespace-nowrap">days</span>
                    </div>
                    <p className="text-xs text-slate-400">Triggers probation review process</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 border-t pt-4 border-slate-100">
                <p className="text-xs font-bold text-indigo-500 uppercase">Due Process Settings</p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-lg mb-2">
                  Legally compliant HR actions require allowing the employee time to investigate notes or make appeals before termination or suspension takes final effect.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Investigation Response Period</label>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={localHrVars.investigationPeriodDays}
                        onChange={e => updateLocalHrVariables({ investigationPeriodDays: parseInt(e.target.value) || 0 })} />
                      <span className="text-sm text-slate-500 whitespace-nowrap">days</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Time to reply to a disciplinary query</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Appeal Window</label>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={localHrVars.appealPeriodDays}
                        onChange={e => updateLocalHrVariables({ appealPeriodDays: parseInt(e.target.value) || 0 })} />
                      <span className="text-sm text-slate-500 whitespace-nowrap">days</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Time allowed to appeal an action</p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
      )}
      <RenameVariableDialog 
        isOpen={!!editingVar}
        onClose={() => setEditingVar(null)}
        editingVar={editingVar}
        renameInput={renameInput}
        setRenameInput={setRenameInput}
        renameDateInput={renameDateInput}
        setRenameDateInput={setRenameDateInput}
        usageCounts={usageCounts}
        isPropagating={isPropagating}
        onConfirm={handleCommitRename}
      />
    </div>
  );
}

function RenameVariableDialog({ isOpen, onClose, editingVar, renameInput, setRenameInput, renameDateInput, setRenameDateInput, usageCounts, isPropagating, onConfirm }: { 
  isOpen: boolean, 
  onClose: () => void, 
  editingVar: any, 
  renameInput: string, 
  setRenameInput: (v: string) => void, 
  renameDateInput?: string, 
  setRenameDateInput?: (v: string) => void, 
  usageCounts: Record<string, number>, 
  isPropagating: boolean, 
  onConfirm: (shouldProp: boolean) => void 
}) {
  const [shouldPropagate, setShouldPropagate] = useState(true);
  const totalRefs = Object.values(usageCounts || {}).reduce((a: number, b: number) => a + b, 0);

  // Auto-reset propagation checkbox when modal opens
  useEffect(() => {
    if (isOpen) setShouldPropagate(totalRefs > 0);
  }, [isOpen, totalRefs]);

  if (!editingVar) return null;

  const getTitle = () => {
    switch (editingVar.type) {
      case 'department': return 'Rename Department';
      case 'position': return 'Rename Position';
      case 'client': return 'Rename Client';
      case 'leaveType': return 'Rename Leave Type';
      case 'holiday': return 'Edit Public Holiday';
      case 'ledgerCategory': return 'Rename Ledger Category';
      case 'ledgerVendor': return 'Rename Vendor Name';
      case 'ledgerVendorTIN': return 'Update Vendor TIN';
      case 'ledgerBank': return 'Rename Bank';
      case 'ledgerBenBank': return 'Rename Beneficiary Bank';
      default: return 'Rename Variable';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-indigo-600" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Old Value</label>
            <div className="p-3 bg-slate-50 border rounded-md text-sm font-medium text-slate-400 italic">
              {editingVar.oldValue}
            </div>
          </div>

          {editingVar.type === 'holiday' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Holiday Date</label>
              <Input 
                type="date"
                value={renameDateInput}
                onChange={e => setRenameDateInput?.(e.target.value)}
                className="h-10"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">New Value</label>
            <Input 
              value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              placeholder="Enter new name..."
              className="h-10 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {totalRefs > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <Settings2 className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Found {totalRefs} referenced records</p>
                  <div className="mt-1 space-y-1">
                    {Object.entries(usageCounts).map(([key, count]) => (
                      <div key={key} className="text-[11px] text-amber-700 flex justify-between">
                        <span>{key}:</span>
                        <span className="font-bold">{count} records</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
                <input 
                  type="checkbox" 
                  id="propagateCheck"
                  checked={shouldPropagate}
                  onChange={e => setShouldPropagate(e.target.checked)}
                  className="h-4 w-4 accent-amber-600"
                />
                <label htmlFor="propagateCheck" className="text-xs font-semibold text-amber-900 cursor-pointer select-none">
                  Update all {totalRefs} records to the new name?
                </label>
              </div>
              <p className="text-[10px] text-amber-600 leading-tight">
                If checked, every instance mentioned above will be updated automatically. If unchecked, only the variable definition itself is changed.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={isPropagating}>Cancel</Button>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700 text-white" 
            onClick={() => onConfirm(shouldPropagate)}
            disabled={isPropagating || !renameInput.trim()}
          >
            {isPropagating ? 'Updating...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


