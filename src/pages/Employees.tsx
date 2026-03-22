import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { Search, Plus, MoreHorizontal, Download, Upload, ArrowLeft, Save, Pencil, Trash2, Eye, X } from 'lucide-react';
import { useAppStore, Employee, MonthlySalary } from '@/src/store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useRedaction } from '@/src/hooks/useRedaction';
import { Dialog } from '@/src/components/ui/dialog';
import { useAppData } from '@/src/contexts/AppDataContext';

const POSITION_HIERARCHY = [
  'CEO',
  'Head of Admin',
  'Head of Operations',
  'Projects Supervisor',
  'Logistics and Warehouse Officer',
  'Admin/Accounts Officer',
  'HR Officer',
  'Foreman',
  'Engineer',
  'Site Supervisor',
  'Assistant Supervisor',
  'Mechanic Technician/Site Worker',
  'Site Worker',
  'Driver',
  'Adhoc Staff',
  'Security',
  'Consultant',
  'Sponsored Student'
];

export function Employees() {
  const [activeTab, setActiveTab] = useState<'Active' | 'Delisted'>('Active');
  const [detailTab, setDetailTab] = useState<'Overview' | 'Attendance' | 'Leaves' | 'Disciplinary' | 'Evaluations' | 'Reminders'>('Overview');
  const [activeTabMonth, setActiveTabMonth] = useState<string>('All');
  const [activeTabYear, setActiveTabYear] = useState<string>(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [viewingNarrative, setViewingNarrative] = useState<{type: 'Disciplinary' | 'Evaluation', data: any} | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const employees = useAppStore((state) => state.employees);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const leaves = useAppStore((state) => state.leaves);
  const addEmployee = useAppStore((state) => state.addEmployee);
  const updateEmployee = useAppStore((state) => state.updateEmployee);
  const deleteEmployee = useAppStore((state) => state.deleteEmployee);
  const positions = useAppStore((state) => state.positions);
  const departments = useAppStore((state) => state.departments);
  const addPosition = useAppStore((state) => state.addPosition);
  const addDepartment = useAppStore((state) => state.addDepartment);
  const disciplinaryRecords = useAppStore((state) => state.disciplinaryRecords);
  const evaluations = useAppStore((state) => state.evaluations);
  const { reminders } = useAppData();

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('employees');
  const canSeeSalary = useRedaction('employees');

  const [sortBy, setSortBy] = useState<'name' | 'position' | 'startDate' | 'dateAdded'>('position');

  const filteredEmployees = employees.filter(emp => {
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch = emp.surname.toLowerCase().includes(searchLow) ||
      emp.firstname.toLowerCase().includes(searchLow) ||
      emp.department.toLowerCase().includes(searchLow) ||
      (emp.employeeCode?.toLowerCase() || '').includes(searchLow);
    const matchesTab = activeTab === 'Delisted' ? emp.status === 'Terminated' : emp.status !== 'Terminated';
    return matchesSearch && matchesTab;
  }).sort((a, b) => {
    if (sortBy === 'name') return (a.surname + a.firstname).localeCompare(b.surname + b.firstname);
    if (sortBy === 'position') {
      const posA = a.position || '';
      const posB = b.position || '';
      const idxA = POSITION_HIERARCHY.indexOf(posA);
      const idxB = POSITION_HIERARCHY.indexOf(posB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return posA.localeCompare(posB);
    }
    if (sortBy === 'startDate') return new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime();
    return 0; // maintain default dateAdded order which matches array order
  });

  const [formData, setFormData] = useState<Partial<Employee>>({
    staffType: 'INTERNAL',
    status: 'Active',
    payeTax: false,
    withholdingTax: false,
    monthlySalaries: {
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
    }
  });

  const handleSave = () => {
    if (!formData.surname || !formData.firstname) {
      toast.error('Surname and Firstname are required.');
      return;
    }

    const nextCodeNumber = Math.max(0, ...employees.map(e => parseInt(e.employeeCode?.replace(/\D/g, '') || '0')));
    const employeeCode = formData.employeeCode || `EMP-${String(nextCodeNumber + 1).padStart(3, '0')}`;

    const newEmployee: Employee = {
      id: crypto.randomUUID(),
      employeeCode,
      surname: formData.surname || '',
      firstname: formData.firstname || '',
      department: formData.department || '',
      staffType: formData.staffType as 'INTERNAL' | 'EXTERNAL',
      position: formData.position || '',
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      yearlyLeave: formData.yearlyLeave || 0,
      bankName: formData.bankName || '',
      accountNo: formData.accountNo || '',
      payeTax: formData.payeTax || false,
      withholdingTax: formData.withholdingTax || false,
      taxId: formData.taxId || '',
      pensionNumber: formData.pensionNumber || '',
      status: formData.status as 'Active' | 'On Leave' | 'Terminated',
      monthlySalaries: formData.monthlySalaries as MonthlySalary,
      avatar: formData.avatar || '',
      excludeFromOnboarding: formData.excludeFromOnboarding || false,
      rent: formData.rent || 0,
    };

    addEmployee(newEmployee);
    setIsAdding(false);
    setFormData({
      staffType: 'INTERNAL',
      status: 'Active',
      payeTax: false,
      withholdingTax: false,
      monthlySalaries: {
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
      }
    });
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setFormData({ ...employee });
    setIsEditing(true);
    setOpenMenuId(null);
  };

  const handleUpdate = () => {
    if (!editingEmployeeId) return;
    if (!formData.surname || !formData.firstname) {
      toast.error('Surname and Firstname are required.');
      return;
    }
    updateEmployee(editingEmployeeId, formData);
    setIsEditing(false);
    setEditingEmployeeId(null);
    toast.success('Employee updated successfully.');
    setFormData({
      staffType: 'INTERNAL',
      status: 'Active',
      payeTax: false,
      withholdingTax: false,
      monthlySalaries: {
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
      }
    });
  };

  const handleView = (employee: Employee) => {
    setViewingEmployee(employee);
    setOpenMenuId(null);
  };

  const closeViewModal = () => {
    setViewingEmployee(null);
    setDetailTab('Overview');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportCSV = () => {
    try {
      if (employees.length === 0) {
        toast.info('No employees to export');
        return;
      }
      const headers = ['id', 'employeeCode', 'surname', 'firstname', 'department', 'staffType', 'position', 'status', 'yearlyLeave', 'startDate', 'endDate', 'bankName', 'accountNo', 'taxId', 'pensionNumber', 'payeTax', 'withholdingTax', 'excludeFromOnboarding', 'rent', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const extractCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

      const rows = employees.map(emp => {
        const data = [
          emp.id, emp.employeeCode || '', emp.surname, emp.firstname, emp.department, emp.staffType,
          emp.position, emp.status, emp.yearlyLeave, emp.startDate || '',
          emp.endDate || '', emp.bankName || '', emp.accountNo || '', emp.taxId || '',
          emp.pensionNumber || '', emp.payeTax, emp.withholdingTax, emp.excludeFromOnboarding || false, emp.rent || 0,
          canSeeSalary ? emp.monthlySalaries.jan : '***', canSeeSalary ? emp.monthlySalaries.feb : '***', canSeeSalary ? emp.monthlySalaries.mar : '***',
          canSeeSalary ? emp.monthlySalaries.apr : '***', canSeeSalary ? emp.monthlySalaries.may : '***', canSeeSalary ? emp.monthlySalaries.jun : '***',
          canSeeSalary ? emp.monthlySalaries.jul : '***', canSeeSalary ? emp.monthlySalaries.aug : '***', canSeeSalary ? emp.monthlySalaries.sep : '***',
          canSeeSalary ? emp.monthlySalaries.oct : '***', canSeeSalary ? emp.monthlySalaries.nov : '***', canSeeSalary ? emp.monthlySalaries.dec : '***'
        ];
        return data.map(extractCSV).join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `employees_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Successfully exported ${employees.length} employees`);
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const parseCSVRow = (str: string) => {
    const vals: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '"') {
        inQuotes = !inQuotes;
      } else if (str[i] === ',' && !inQuotes) {
        vals.push(cur.trim());
        cur = '';
      } else {
        cur += str[i];
      }
    }
    vals.push(cur.trim());
    return vals;
  };

  const handleImportCSVSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImportFile(file);
    e.target.value = '';
  };

  const processImport = (file: File, mode: 'update' | 'replace' | 'append') => {
    setImportFile(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error('Invalid or empty CSV file'); return;
        }

        let importedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;
        const newDepartments = new Set<string>();
        const newPositions = new Set<string>();
        const csvProcessedIds = new Set<string>();

        // Check if the current CSV has employeeCode as header index 1
        const headerRow = parseCSVRow(lines[0]);
        const hasEmployeeCode = headerRow[1]?.toLowerCase() === 'employeecode';

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVRow(lines[i]);
          
          // Adjust index offsets dynamically depending on whether employeeCode existed in the file
          const offset = hasEmployeeCode ? 1 : 0;
          if (vals.length >= 17 + offset) {
            const importedDept = vals[3 + offset]?.trim();
            const importedPosition = vals[5 + offset]?.trim();
            
            if (importedDept && !departments.includes(importedDept)) newDepartments.add(importedDept);
            if (importedPosition && !positions.includes(importedPosition)) newPositions.add(importedPosition);

            const providedId = vals[0]?.trim() || '';
            const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(providedId);
            const employeeCodeValue = hasEmployeeCode ? vals[1]?.trim() : '';
            // Only preserve original ID if we aren't appending everything as new
            const idToUse = (mode !== 'append' && isValidUUID) ? providedId : crypto.randomUUID();
            
            if (idToUse) csvProcessedIds.add(idToUse); // Track for 'replace' mode

            const parsedEmp: Employee = {
              id: idToUse,
              employeeCode: mode === 'append' ? '' : (employeeCodeValue || (isValidUUID ? '' : providedId)),
              surname: vals[1 + offset], firstname: vals[2 + offset], department: vals[3 + offset], staffType: vals[4 + offset] as any,
              position: vals[5 + offset], status: vals[6 + offset] as any, yearlyLeave: parseInt(vals[7 + offset]) || 0,
              startDate: vals[8 + offset] || '', endDate: vals[9 + offset] || '', bankName: vals[10 + offset] || '',
              accountNo: vals[11 + offset] || '', taxId: vals[12 + offset] || '', pensionNumber: vals[13 + offset] || '',
              payeTax: ['true', 'yes', '1'].includes(vals[14 + offset]?.trim().toLowerCase() || ''),
              withholdingTax: ['true', 'yes', '1'].includes(vals[15 + offset]?.trim().toLowerCase() || ''),
              excludeFromOnboarding: ['true', 'yes', '1'].includes(vals[16 + offset]?.trim().toLowerCase() || ''),
              rent: parseFloat(vals[17 + offset]) || 0,
              monthlySalaries: {
                jan: parseFloat(vals[18 + offset]) || 0, feb: parseFloat(vals[19 + offset]) || 0, mar: parseFloat(vals[20 + offset]) || 0,
                apr: parseFloat(vals[21 + offset]) || 0, may: parseFloat(vals[22 + offset]) || 0, jun: parseFloat(vals[23 + offset]) || 0,
                jul: parseFloat(vals[24 + offset]) || 0, aug: parseFloat(vals[25 + offset]) || 0, sep: parseFloat(vals[26 + offset]) || 0,
                oct: parseFloat(vals[27 + offset]) || 0, nov: parseFloat(vals[28 + offset]) || 0, dec: parseFloat(vals[29 + offset]) || 0
              }
            };
            const existing = employees.find(e => e.id === parsedEmp.id);
            if (existing && mode !== 'append') { 
              updateEmployee(existing.id, parsedEmp); 
              updatedCount++; 
            } else { 
              addEmployee(parsedEmp); 
              importedCount++; 
            }
          }
        }

        // If mode is replace, delete all employees NOT found in this CSV
        if (mode === 'replace') {
          employees.forEach(emp => {
            if (!csvProcessedIds.has(emp.id)) {
              deleteEmployee(emp.id);
              deletedCount++;
            }
          });
        }

        // Auto-add new departments and positions to the store
        let addedDeptCount = 0;
        let addedPosCount = 0;
        newDepartments.forEach(dept => {
          addDepartment(dept);
          addedDeptCount++;
        });
        newPositions.forEach(pos => {
          addPosition(pos);
          addedPosCount++;
        });

        let message = `Import complete: ${importedCount} Added | ${updatedCount} Updated`;
        if (deletedCount > 0) message += ` | ${deletedCount} Removed`;
        if (addedDeptCount > 0 || addedPosCount > 0) {
          message += `. ${addedDeptCount} new department(s) and ${addedPosCount} new position(s) added to Variables.`;
        }
        toast.success(message);
      } catch (err) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  // Render Employee Form (Add or Edit)
  const renderEmployeeForm = (isEdit: boolean) => (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button variant="ghost" size="icon" onClick={() => { setIsAdding(false); setIsEditing(false); }} className="hover:bg-slate-100 rounded-full h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
              {isEdit ? 'Edit Employee Record' : 'Add New Employee'}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Configure profile details, compensation, and system access.</p>
          </div>
        </div>
        <Button onClick={isEdit ? handleUpdate : handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all font-semibold w-full sm:w-auto">
          <Save className="h-4 w-4" /> {isEdit ? 'Save Changes' : 'Create Employee'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* --- LEFT COLUMN: Primary Details --- */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Personal & Job Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Surname</label>
                  <Input value={formData.surname || ''} onChange={e => setFormData({ ...formData, surname: e.target.value })} placeholder="e.g. DAVIES" className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Firstname</label>
                  <Input value={formData.firstname || ''} onChange={e => setFormData({ ...formData, firstname: e.target.value })} placeholder="e.g. HUBERT" className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Code</label>
                  <Input value={formData.employeeCode || ''} onChange={e => setFormData({ ...formData, employeeCode: e.target.value })} placeholder="e.g. EMP-001 (Auto-generated if empty)" className="bg-slate-50 focus:bg-white font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Department</label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                    <option value="" disabled>Select Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Position</label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.position || ''} onChange={e => setFormData({ ...formData, position: e.target.value })}>
                    <option value="" disabled>Select Position</option>
                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff Type</label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.staffType} onChange={e => setFormData({ ...formData, staffType: e.target.value as any })}>
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="EXTERNAL">EXTERNAL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Yearly Leave (Days)</label>
                  <Input type="number" value={formData.yearlyLeave || ''} onChange={e => setFormData({ ...formData, yearlyLeave: parseInt(e.target.value) || 0 })} className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                  <Input type="date" value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">End Date</label>
                  <Input type="date" value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="bg-slate-50 focus:bg-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {canSeeSalary && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-slate-800">Monthly Salary Matrix (₦)</CardTitle>
                  <CardDescription className="mt-1">Define gross monthly salary dynamically. Subject to revision.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="bg-white shadow-sm" onClick={() => {
                  const janVal = formData.monthlySalaries?.jan || 0;
                  setFormData({
                    ...formData,
                    monthlySalaries: {
                      jan: janVal, feb: janVal, mar: janVal, apr: janVal,
                      may: janVal, jun: janVal, jul: janVal, aug: janVal,
                      sep: janVal, oct: janVal, nov: janVal, dec: janVal
                    }
                  });
                }}>
                  Copy Jan to All
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((month) => (
                    <div key={month} className="space-y-1">
                      <label className="text-xs font-bold uppercase text-slate-500">{month}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 font-medium">₦</span>
                        <Input type="number" value={formData.monthlySalaries?.[month as keyof MonthlySalary] || ''} onChange={e => setFormData({ ...formData, monthlySalaries: { ...formData.monthlySalaries!, [month]: parseFloat(e.target.value) || 0 } })} className="font-mono text-sm pl-7 bg-slate-50 focus:bg-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* --- RIGHT COLUMN: Secondary Details --- */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800 text-center">Profile Image</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center">
              <Avatar className="h-32 w-32 border-4 border-white shadow-md mb-4 bg-slate-100">
                <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-4xl">
                  {formData.firstname?.charAt(0) || ''}{formData.surname?.charAt(0) || ''}
                </AvatarFallback>
                {formData.avatar && <img src={formData.avatar} alt="Avatar" className="object-cover" />}
              </Avatar>
              <div className="flex gap-2 w-full justify-center">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm h-9 px-4 py-2">
                    <Upload className="h-4 w-4 mr-2 text-slate-500" /> Upload Image
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
                {formData.avatar && (
                  <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9" onClick={() => setFormData({ ...formData, avatar: '' })}>
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">Financial Setup</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Name</label>
                  <Input value={formData.bankName || ''} onChange={e => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g. STANBIC" className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Account No.</label>
                  <Input value={formData.accountNo || ''} onChange={e => setFormData({ ...formData, accountNo: e.target.value })} className="font-mono bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tax ID</label>
                  <Input value={formData.taxId || ''} onChange={e => setFormData({ ...formData, taxId: e.target.value })} className="font-mono bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pension Number</label>
                  <Input value={formData.pensionNumber || ''} onChange={e => setFormData({ ...formData, pensionNumber: e.target.value })} className="font-mono bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Rent (₦)</label>
                  <Input type="number" value={formData.rent || 0} onChange={e => setFormData({ ...formData, rent: Number(e.target.value) })} className="font-mono bg-slate-50 focus:bg-white" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={formData.payeTax} onChange={e => setFormData({ ...formData, payeTax: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4" />
                  Subject to PAYE Tax
                </label>
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={formData.withholdingTax} onChange={e => setFormData({ ...formData, withholdingTax: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4" />
                  Subject to Withholding Tax
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 border-t-4 border-t-indigo-500">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
              <CardTitle className="text-slate-800">System Preferences</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <label className="flex items-start gap-3 text-sm font-medium cursor-pointer p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                <input type="checkbox" id="excludeFromOnboarding" checked={formData.excludeFromOnboarding || false} onChange={e => setFormData({ ...formData, excludeFromOnboarding: e.target.checked })} className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4 shrink-0" />
                <span className="text-slate-700 leading-snug">
                  Exclude from Onboarding & Offboarding workflows
                  <span className="block text-xs text-slate-500 font-normal mt-0.5">Useful for Management, Directors, or Owners.</span>
                </span>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  // Render View Modal
  const renderViewModal = () => {
    if (!viewingEmployee) return null;
    const emp = viewingEmployee;
    const totalSalary = Object.values(emp.monthlySalaries).reduce((a: number, b: number) => a + b, 0);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-indigo-600 p-4 flex justify-between items-center rounded-t-lg">
            <h3 className="text-white font-bold text-lg">Employee Details</h3>
            <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700" onClick={closeViewModal}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-xl">
                  {emp.firstname.charAt(0)}{emp.surname.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{emp.surname} {emp.firstname}</h2>
                <p className="text-slate-500">{emp.position} - {emp.department}</p>
                <Badge variant={emp.status === 'Active' ? 'success' : emp.status === 'On Leave' ? 'warning' : 'destructive'} className="mt-1">
                  {emp.status}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div className="flex bg-slate-100 rounded-lg p-1 grow md:grow-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {['Overview', 'Attendance', 'Leaves', 'Disciplinary', 'Evaluations', 'Reminders'].map(tab => (
                  <button
                    key={tab}
                    className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${detailTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setDetailTab(tab as any)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {(detailTab === 'Attendance' || detailTab === 'Leaves' || detailTab === 'Disciplinary' || detailTab === 'Evaluations') && (
                <div className="flex gap-2 shrink-0 ml-auto">
                  <select
                    value={activeTabMonth}
                    onChange={(e) => setActiveTabMonth(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="All">All Months</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'short' })}</option>
                    ))}
                  </select>
                  <select
                    value={activeTabYear}
                    onChange={(e) => setActiveTabYear(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="All">All Years</option>
                    {Array.from({ length: 5 }, (_, i) => {
                      const yr = new Date().getFullYear() - 2 + i;
                      return <option key={yr} value={yr}>{yr}</option>;
                    })}
                  </select>
                </div>
              )}
            </div>

            {detailTab === 'Overview' && (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Personal Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Emp Code:</span><span className="font-mono">{emp.employeeCode || emp.id.substring(0,8)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Staff Type:</span><span>{emp.staffType}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Start Date:</span><span>{emp.startDate || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">End Date:</span><span>{emp.endDate || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Yearly Leave:</span><span>{emp.yearlyLeave} days</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Bank & Tax</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Bank:</span><span>{emp.bankName || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Account:</span><span className="font-mono">{emp.accountNo || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Tax ID:</span><span className="font-mono">{emp.taxId || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Pension:</span><span className="font-mono">{emp.pensionNumber || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">PAYE Tax:</span><span>{emp.payeTax ? 'Yes' : 'No'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">WHT Tax:</span><span>{emp.withholdingTax ? 'Yes' : 'No'}</span></div>
                    </div>
                  </div>
                </div>

                {canSeeSalary && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Salary Information</h4>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                        {Object.entries(emp.monthlySalaries).map(([month, amount]) => (
                          <div key={month} className="flex justify-between">
                            <span className="text-slate-500 uppercase text-xs">{month}:</span>
                            <span className="font-mono">₦{amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                        <span className="font-semibold">Annual Total:</span>
                        <span className="text-xl font-bold text-indigo-600">₦{totalSalary.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {detailTab === 'Reminders' && (() => {
               const empReminders = reminders.filter(r => r.title.includes(emp.firstname) && r.title.includes(emp.surname));
               return (
                 <div className="space-y-4">
                   {empReminders.length === 0 ? (
                     <div className="text-center py-8 bg-white rounded-lg border border-slate-100 shadow-inner">
                        <p className="text-slate-500 font-medium">No system reminders tied to this employee.</p>
                     </div>
                   ) : (
                     <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-slate-50/50">
                             <TableHead>Reminder Title</TableHead>
                             <TableHead>Trigger Date</TableHead>
                             <TableHead>Status</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {empReminders.map(r => {
                             const isPast = new Date(r.remindAt) < new Date();
                             return (
                               <TableRow key={r.id} className="hover:bg-slate-50/80">
                                 <TableCell className="font-semibold text-slate-800 text-xs">{r.title}</TableCell>
                                 <TableCell className="font-mono text-[11px] text-slate-500">{new Date(r.remindAt).toLocaleString()}</TableCell>
                                 <TableCell>
                                   <Badge variant="outline" className={`text-[10px] ${r.isActive ? (isPast ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200') : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                     {!r.isActive ? 'Dismissed' : (isPast ? 'Overdue' : 'Pending')}
                                   </Badge>
                                 </TableCell>
                               </TableRow>
                             );
                           })}
                         </TableBody>
                       </Table>
                     </div>
                   )}
                 </div>
               );
            })()}

            {detailTab === 'Attendance' && (() => {
              const empAtt = attendanceRecords
                .filter(r => r.staffId === emp.id)
                .filter(r => activeTabYear === 'All' ? true : r.date?.startsWith(activeTabYear))
                .filter(r => activeTabMonth === 'All' ? true : new Date(r.date || '').getMonth() + 1 === parseInt(activeTabMonth))
                .sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
              
              const actualWorkdays = empAtt.reduce((sum, r) => sum + ((Number(r.dayWk) || 0) + (Number(r.nightWk) || 0)), 0);
              const absentDays = empAtt.filter(r => r.isPresent === 'No').length;
              const overtimeHours = empAtt.reduce((sum, r) => sum + (Number(r.ot) || 0), 0);

              return (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-700">
                     <span>Actual Workdays: {actualWorkdays}</span>
                     <span className="mx-2 text-slate-300">|</span>
                     <span>Absent: {absentDays}</span>
                     <span className="mx-2 text-slate-300">|</span>
                     <span>Overtime: {overtimeHours} hrs</span>
                  </div>
                  {empAtt.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-lg border border-slate-100 shadow-inner">
                      <p className="text-slate-500 font-medium">No attendance records found for selected period.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="w-24">Date</TableHead>
                            <TableHead>Client/Site</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {empAtt.map(r => (
                            <TableRow key={r.id}>
                              <TableCell className="font-mono text-[11px] text-slate-500">{r.date}</TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {r.dayClient && r.dayClient !== 'N/A' ? `${r.dayClient} - ${r.daySite}` : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={r.isPresent === 'Yes' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}>
                                  {r.isPresent === 'Yes' ? 'Present' : 'Absent'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })()}

            {detailTab === 'Leaves' && (() => {
              const empLeaves = leaves
                .filter(l => l.employeeId === emp.id)
                .filter(l => activeTabYear === 'All' ? true : l.startDate?.startsWith(activeTabYear))
                .filter(l => activeTabMonth === 'All' ? true : new Date(l.startDate || '').getMonth() + 1 === parseInt(activeTabMonth))
                .sort((a,b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
              
              const totalTaken = empLeaves.filter(l => l.status !== 'Cancelled').reduce((acc, l) => acc + l.duration, 0);
              const entitlement = emp.yearlyLeave || 20;
              const remaining = entitlement - totalTaken;

              return (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-slate-700">
                     <span>Entitled: {entitlement}</span>
                     <span className="mx-2 text-slate-300">|</span>
                     <span>Taken: {totalTaken}</span>
                     <span className="mx-2 text-slate-300">|</span>
                     <span>Remaining: {remaining}</span>
                  </div>
                  {empLeaves.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-lg border border-slate-100 shadow-inner">
                      <p className="text-slate-500 font-medium">No leave records found for selected period.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead>Type</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {empLeaves.map(l => (
                            <TableRow key={l.id}>
                              <TableCell className="font-semibold text-xs">{l.leaveType}</TableCell>
                              <TableCell className="font-mono text-[11px] text-slate-500">{l.startDate} to {l.expectedEndDate}</TableCell>
                              <TableCell className="text-[11px]">{l.duration} Days</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={l.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}>
                                  {l.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })()}

            {detailTab === 'Disciplinary' && (() => {
               const empDiscip = disciplinaryRecords
                 .filter(r => r.employeeId === emp.id)
                 .filter(r => activeTabYear === 'All' ? true : r.date?.startsWith(activeTabYear))
                 .filter(r => activeTabMonth === 'All' ? true : new Date(r.date || '').getMonth() + 1 === parseInt(activeTabMonth))
                 .sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
               return (
                 <div className="space-y-4">
                   {empDiscip.length === 0 ? (
                     <div className="text-center py-8 bg-white rounded-lg border border-slate-100 shadow-inner">
                        <p className="text-slate-500 font-medium">No active disciplinary events for selected period.</p>
                        <p className="text-xs text-slate-400 mt-1">Good standing.</p>
                     </div>
                   ) : (
                     <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-slate-50/50">
                             <TableHead className="w-24">Date</TableHead>
                             <TableHead>Type</TableHead>
                             <TableHead>Severity</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {empDiscip.map(d => (
                             <TableRow key={d.id} className="hover:bg-slate-50/80">
                               <TableCell className="font-mono text-[11px] text-slate-500">{d.date}</TableCell>
                               <TableCell className="font-semibold text-slate-800 text-xs">{d.type}</TableCell>
                               <TableCell>
                                 <Badge variant={d.severity.includes('Warning') ? 'warning' : 'destructive'} className="text-[10px]">{d.severity}</Badge>
                               </TableCell>
                               <TableCell className="text-right">
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setViewingNarrative({ type: 'Disciplinary', data: d })}>
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               </TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     </div>
                   )}
                 </div>
               );
            })()}

            {detailTab === 'Evaluations' && (() => {
               const empEvals = evaluations
                 .filter(e => e.employeeId === emp.id)
                 .filter(e => activeTabYear === 'All' ? true : e.date?.startsWith(activeTabYear))
                 .filter(e => activeTabMonth === 'All' ? true : new Date(e.date || '').getMonth() + 1 === parseInt(activeTabMonth))
                 .sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
               return (
                 <div className="space-y-4">
                   {empEvals.length === 0 ? (
                     <div className="text-center py-8 bg-white rounded-lg border border-slate-100 shadow-inner">
                        <p className="text-slate-500 font-medium">No evaluation records found for selected period.</p>
                        <p className="text-xs text-slate-400 mt-1">Schedule a review to get started.</p>
                     </div>
                   ) : (
                     <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-slate-50/50">
                             <TableHead className="w-24">Date</TableHead>
                             <TableHead>Type</TableHead>
                             <TableHead>Score</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {empEvals.map(e => (
                             <TableRow key={e.id} className="hover:bg-slate-50/80">
                               <TableCell className="font-mono text-[11px] text-slate-500">{e.date}</TableCell>
                               <TableCell className="font-semibold text-slate-800 text-xs">{e.type}</TableCell>
                               <TableCell>
                                 <span className={`text-xs font-bold ${e.overallScore >= 70 ? 'text-emerald-600' : e.overallScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                   {e.overallScore}%
                                 </span>
                               </TableCell>
                               <TableCell className="text-right">
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setViewingNarrative({ type: 'Evaluation', data: e })}>
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               </TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     </div>
                   )}
                 </div>
               );
            })()}
          </div>
        </div>

        <Dialog open={!!viewingNarrative} onClose={() => setViewingNarrative(null)} title={viewingNarrative?.type === 'Disciplinary' ? 'Disciplinary Narrative' : 'Evaluation Details'}>
          {viewingNarrative && (
            <div className="space-y-4">
              {viewingNarrative.type === 'Disciplinary' ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{emp.surname} {emp.firstname}</h4>
                      <p className="text-sm text-slate-500">{viewingNarrative.data.date} • {viewingNarrative.data.type}</p>
                    </div>
                    <Badge variant={viewingNarrative.data.severity.includes('Warning') ? 'warning' : 'destructive'}>{viewingNarrative.data.severity}</Badge>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Narrative of Event</h5>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">
                      {viewingNarrative.data.description || 'No description provided.'}
                    </div>
                  </div>
                  {viewingNarrative.data.actionTaken && (
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Action Taken / Resolution</h5>
                      <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg text-sm text-rose-900 whitespace-pre-wrap">
                        {viewingNarrative.data.actionTaken}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{emp.surname} {emp.firstname}</h4>
                      <p className="text-sm text-slate-500">{viewingNarrative.data.date} • {viewingNarrative.data.type}</p>
                    </div>
                    <span className={`text-xl font-bold ${viewingNarrative.data.overallScore >= 70 ? 'text-emerald-600' : viewingNarrative.data.overallScore >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {viewingNarrative.data.overallScore}%
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Manager Notes</h5>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">
                      {viewingNarrative.data.managerNotes || 'No notes provided.'}
                    </div>
                  </div>
                </>
              )}
              <div className="pt-2 text-xs text-slate-400 border-t border-slate-100 flex items-center justify-between">
                <span>Logged by: {viewingNarrative.data.createdBy || 'System'}</span>
                <Badge variant={viewingNarrative.data.status === 'Active' || viewingNarrative.data.status === 'Acknowledged' ? 'default' : 'outline'}>{viewingNarrative.data.status}</Badge>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    );
  };

  // If adding new employee
  if (isAdding) {
    return renderEmployeeForm(false);
  }

  // If editing existing employee
  if (isEditing) {
    return renderEmployeeForm(true);
  }

  // Main employee list view
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
            Employee Directory
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage personnel records, roles, and compensation details.</p>
        </div>
        <div className="flex items-center gap-3">
          {priv.canExport && (
            <Button variant="outline" className="gap-2 bg-white text-slate-700 hover:bg-slate-50 shadow-sm border-slate-200" onClick={handleExportCSV}>
              <Download className="h-4 w-4 text-slate-500" /> Export CSV
            </Button>
          )}
          {priv.canAdd && (
            <label className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200 rounded-md h-9 px-4 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap">
              <Upload className="h-4 w-4 text-slate-500" /> Import Data
              <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
            </label>
          )}
          {priv.canAdd && (
            <Button className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md mx-2 transition-all" onClick={() => { setIsAdding(true); setOpenMenuId(null); setFormData({ staffType: 'INTERNAL', status: 'Active', payeTax: false, withholdingTax: false, monthlySalaries: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 } }); }}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-[500px]">
        <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
          <div className="flex bg-slate-200/50 p-1 rounded-lg">
            <button
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'Active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('Active')}
            >
              Active Personnel
            </button>
            <button
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'Delisted' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('Delisted')}
            >
              Delisted
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search Name or Code..."
                className="pl-9 bg-white border-slate-200 h-9 text-sm focus-visible:ring-indigo-500/50 rounded-lg shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="dateAdded">Sort By: Default</option>
              <option value="name">Sort By: Name</option>
              <option value="position">Sort By: Position</option>
              <option value="startDate">Sort By: Start Date</option>
            </select>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Staff Type</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Bank Info</TableHead>
              <TableHead>Taxes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee) => (
              <TableRow key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200">
                      <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs">
                        {employee.firstname.charAt(0)}{employee.surname.charAt(0)}
                      </AvatarFallback>
                      {employee.avatar && <img src={employee.avatar} alt="Avatar" className="object-cover" />}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{employee.surname} {employee.firstname}</span>
                      <span className="text-xs text-slate-500 font-mono tracking-tight">{employee.employeeCode || `EMP-${employee.id.substring(0, 4).toUpperCase()}`}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>
                  <Badge variant={employee.staffType === 'INTERNAL' ? 'default' : 'outline'}>
                    {employee.staffType}
                  </Badge>
                </TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{employee.bankName}</span>
                    <span className="text-xs text-slate-500 font-mono">{employee.accountNo}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-col text-xs">
                    {employee.payeTax && <span className="text-emerald-600 font-medium">PAYE: YES</span>}
                    {employee.withholdingTax && <span className="text-amber-600 font-medium">WHT: YES</span>}
                    {!employee.payeTax && !employee.withholdingTax && <span className="text-slate-400">None</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="View details" onClick={() => handleView(employee)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {priv.canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit employee" onClick={() => handleEdit(employee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {priv.canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete employee" onClick={async () => {
                        const ok = await showConfirm(`Are you sure you want to delete ${employee.surname} ${employee.firstname}?`, { variant: 'danger', confirmLabel: 'Delete' });
                        if (ok) { deleteEmployee(employee.id); toast.success('Employee record deleted'); }
                      }}>
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
      {renderViewModal()}

      {/* Import Modal Options */}
      {importFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Import Policy</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              How would you like to process the employee records from this CSV file?
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => processImport(importFile, 'update')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3 flex-col items-center justify-center">
                <span className="font-semibold block text-base">Update & Add (Recommended)</span>
                <span className="block text-xs opacity-80 mt-1 font-normal text-center">Modifies matching IDs. Adds missing ones. Leaves others alone.</span>
              </Button>
              <Button onClick={() => processImport(importFile, 'append')} variant="outline" className="border-slate-200 h-auto py-3 text-slate-700 hover:bg-slate-50 flex-col items-center justify-center">
                <span className="font-semibold block text-base">Append Only</span>
                <span className="block text-xs text-slate-500 mt-1 font-normal text-center">Adds every row as a brand new employee, completely ignoring current IDs.</span>
              </Button>
              <Button onClick={() => processImport(importFile, 'replace')} variant="outline" className="border-rose-200 h-auto py-3 text-rose-600 hover:bg-rose-50 flex-col items-center justify-center">
                <span className="font-semibold block text-base">Replace Entire List</span>
                <span className="block text-xs text-rose-500/80 mt-1 font-normal text-center">Deletes current staff that are NOT in this CSV. Updates matches. Adds new ones.</span>
              </Button>
              <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 mt-2">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


