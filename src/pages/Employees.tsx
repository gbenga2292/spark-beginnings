import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Search, Plus, MoreHorizontal, Download, Upload, ArrowLeft, Save, Pencil, Trash2, Eye, X, Network, CheckSquare, Square, Settings2, Users, ChevronDown } from 'lucide-react';
import { useAppStore, Employee, MonthlySalary, DisciplinaryRecord } from '@/src/store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useRedaction } from '@/src/hooks/useRedaction';
import { Dialog } from '@/src/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/src/components/ui/dropdown-menu';
import { useAppData } from '@/src/contexts/AppDataContext';
import { Checkbox } from '@/src/components/ui/checkbox';
import { normalizeDate, formatDisplayDate } from '@/src/lib/dateUtils';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';
import { useDebounce } from '@/src/hooks/useDebounce';

import { getPositionIndex } from '@/src/lib/hierarchy';

export function Employees() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'Active' | 'Delisted'>('Active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkFormData, setBulkFormData] = useState<Partial<Employee>>({});
  const [detailTab, setDetailTab] = useState<'Overview' | 'Attendance' | 'Leaves' | 'Conduct' | 'Evaluations' | 'Reminders'>('Overview');
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
  const bulkUpdateEmployees = useAppStore(state => state.bulkUpdateEmployees);
  const positions = useAppStore((state) => state.positions);
  const departments = useAppStore((state) => state.departments);
  const addPosition = useAppStore((state) => state.addPosition);
  const addDepartment = useAppStore((state) => state.addDepartment);
  const disciplinaryRecords = useAppStore((state) => state.disciplinaryRecords);
  const evaluations = useAppStore((state) => state.evaluations);
  const hrVariables = useAppStore((state) => state.hrVariables);
  const { addDisciplinaryRecord, deleteDisciplinaryRecord } = useAppStore();
  const { reminders, addReminder } = useAppData();

  const [isLoggingPerformance, setIsLoggingPerformance] = useState(false);
  const [performanceRecord, setPerformanceRecord] = useState<Partial<DisciplinaryRecord>>({
    type: 'Behavioral',
    severity: 'Verbal Warning',
    points: 0,
    description: '',
  });

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('employees');
  const canSeeSalary = useRedaction('employees');

  const [sortBy, setSortBy] = useState<'name' | 'position' | 'startDate' | 'dateAdded'>('position');

  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredEmployees = useMemo(() => {
    const searchLow = debouncedSearch.toLowerCase();
    return employees.filter(emp => {
      const matchesSearch = emp.surname.toLowerCase().includes(searchLow) ||
        emp.firstname.toLowerCase().includes(searchLow) ||
        emp.department.toLowerCase().includes(searchLow) ||
        (emp.employeeCode?.toLowerCase() || '').includes(searchLow);
      const matchesTab = activeTab === 'Delisted' ? emp.status === 'Terminated' : (emp.status === 'Active' || emp.status === 'On Leave');
      return matchesSearch && matchesTab && emp.staffType !== 'NON-EMPLOYEE';
    }).sort((a, b) => {
      if (sortBy === 'name') return (a.surname + a.firstname).localeCompare(b.surname + b.firstname);
      if (sortBy === 'position') {
        const idxA = getPositionIndex(a.position);
        const idxB = getPositionIndex(b.position);
        if (idxA !== idxB) return idxA - idxB;
        return (a.position || '').localeCompare(b.position || '');
      }
      if (sortBy === 'startDate') return new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime();
      return 0;
    });
  }, [employees, debouncedSearch, activeTab, sortBy]);

  const [formData, setFormData] = useState<Partial<Employee>>({
    staffType: 'OFFICE',
    level: 10,
    status: 'Active',
    payeTax: false,
    withholdingTax: false,
    monthlySalaries: {
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
    }
  });
  
  useEffect(() => {
    // If no end date is provided (checked via normalizeDate), status should always default to 'Active'
    // and cannot be 'Terminated'.
    const normalizedEndDate = normalizeDate(formData.endDate);
    if (!normalizedEndDate) {
      if (formData.status === 'Terminated') {
        setFormData(prev => ({ ...prev, status: 'Active' }));
      }
    } else {
      // If end date is present, automate status based on current date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eDate = new Date(normalizedEndDate);
      
      if (!isNaN(eDate.getTime())) {
        const autoStatus = today < eDate ? 'Active' : 'Terminated';
        if (formData.status !== autoStatus) {
          setFormData(prev => ({ ...prev, status: autoStatus as any }));
        }
      }
    }
  }, [formData.endDate, formData.status]);

  const handleSave = () => {
    if (!formData.surname || !formData.firstname) {
      toast.error('Surname and Firstname are required.');
      return;
    }
    const normalizedEndDate = normalizeDate(formData.endDate);
    const normalizedStartDate = normalizeDate(formData.startDate);

    if (normalizedEndDate && normalizedStartDate) {
      const eDate = new Date(normalizedEndDate);
      const sDate = new Date(normalizedStartDate);
      if (!isNaN(eDate.getTime()) && !isNaN(sDate.getTime()) && eDate < sDate) {
        toast.error('End date cannot be before the start date.');
        return;
      }
    }

    // Level Validation: Only one Level 1 in the whole company
    if (formData.level === 1) {
      const existingLevel1 = employees.find(e => e.level === 1 && e.status !== 'Terminated');
      if (existingLevel1) {
        toast.error(`There can only be one Level 1 (Head of Company). Currently assigned to ${existingLevel1.firstname} ${existingLevel1.surname}.`);
        return;
      }
    }

    // Level Validation: Only one Level 2 per department
    if (formData.level === 2) {
      const deptsToCheck = [formData.department, ...(formData.secondaryDepartments || [])].filter(Boolean);
      for (const deptName of deptsToCheck) {
        const existingLevel2 = employees.find(e => 
          e.level === 2 && 
          (e.department === deptName || e.secondaryDepartments?.includes(deptName as string)) && 
          e.status !== 'Terminated'
        );
        if (existingLevel2) {
          toast.error(`There can only be one Level 2 (Head of Department) in ${deptName}. Currently: ${existingLevel2.firstname} ${existingLevel2.surname}.`);
          return;
        }
      }
    }

    const nextCodeNumber = Math.max(0, ...employees.map(e => parseInt(e.employeeCode?.replace(/\D/g, '') || '0')));
    const employeeCode = formData.employeeCode || `EMP-${String(nextCodeNumber + 1).padStart(3, '0')}`;

    let finalStatus = formData.status as 'Active' | 'On Leave' | 'Terminated';
    const nEndDate = normalizeDate(formData.endDate);
    if (!nEndDate) {
      if (finalStatus === 'Terminated') finalStatus = 'Active';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eDate = new Date(nEndDate);
      if (!isNaN(eDate.getTime())) {
        finalStatus = today < eDate ? 'Active' : 'Terminated';
      }
    }

    const newEmployee: Employee = {
      ...(formData as Employee),
      id: generateId(),
      employeeCode,
      status: finalStatus,
      monthlySalaries: formData.monthlySalaries || {
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
      },
      onboardingTasks: (formData as any).onboardingTasks || [],
      excludeFromOnboarding: formData.excludeFromOnboarding || false,
      rent: formData.rent || 0,
      lashmaPolicyNumber: formData.lashmaPolicyNumber || '',
      lashmaRegistrationDate: formData.lashmaRegistrationDate || '',
      lashmaExpiryDate: formData.lashmaExpiryDate || '',
      phone: formData.phone || '',
      email: formData.email || '',
      lineManager: formData.lineManager || undefined,
      payeeType: formData.payeeType || 'Staff',
      typeOfPay: formData.typeOfPay || 'Monthly',
      startMonthOfPay: formData.startMonthOfPay || 'jan',
      level: formData.level || 10,
    };

    addEmployee(newEmployee);
    
    // Manage LASHMA Renewal Reminder
    if (newEmployee.lashmaExpiryDate) {
      const expiry = new Date(newEmployee.lashmaExpiryDate);
      const remindAt = new Date(expiry);
      remindAt.setDate(remindAt.getDate() - 7);
      
      const title = `LASHMA Renewal: ${newEmployee.firstname} ${newEmployee.surname}`;
      // Basic check to avoid duplicates: find existing reminder with same title
      const existing = reminders.find(r => r.title === title && r.isActive);
      
      if (!existing || existing.remindAt !== remindAt.toISOString()) {
        addReminder({
          title,
          body: `Health insurance (LASHMA) for ${newEmployee.firstname} ${newEmployee.surname} expires on ${newEmployee.lashmaExpiryDate}. Please initiate renewal.`,
          remindAt: remindAt.toISOString(),
          recipientIds: [], // HR/Admin usually get notifications by default if left empty or if they created it
          frequency: 'once',
          isActive: true
        });
      }
    }
    setIsAdding(false);
    setFormData({
      staffType: 'OFFICE',
      level: 10,
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
    const normalizedEndDate = normalizeDate(formData.endDate);
    const normalizedStartDate = normalizeDate(formData.startDate);

    if (normalizedEndDate && normalizedStartDate) {
      const eDate = new Date(normalizedEndDate);
      const sDate = new Date(normalizedStartDate);
      if (!isNaN(eDate.getTime()) && !isNaN(sDate.getTime()) && eDate < sDate) {
        toast.error('End date cannot be before the start date.');
        return;
      }
    }

    // Level Validation for Edit
    if (formData.level === 1) {
      const existingLevel1 = employees.find(e => e.level === 1 && e.id !== editingEmployeeId && e.status !== 'Terminated');
      if (existingLevel1) {
        toast.error(`There can only be one Level 1 (Head of Company). Currently: ${existingLevel1.firstname} ${existingLevel1.surname}.`);
        return;
      }
    }
    // Level Validation for Edit
    if (formData.level === 2) {
      const deptsToCheck = [formData.department, ...(formData.secondaryDepartments || [])].filter(Boolean);
      for (const deptName of deptsToCheck) {
        const existingLevel2 = employees.find(e => 
          e.level === 2 && 
          (e.department === deptName || e.secondaryDepartments?.includes(deptName as string)) && 
          e.id !== editingEmployeeId && 
          e.status !== 'Terminated'
        );
        if (existingLevel2) {
          toast.error(`There can only be one Level 2 (Head of Department) in ${deptName}. Currently: ${existingLevel2.firstname} ${existingLevel2.surname}.`);
          return;
        }
      }
    }

    let finalStatus = formData.status as 'Active' | 'On Leave' | 'Terminated';
    const nEndDate = normalizeDate(formData.endDate);
    if (!nEndDate) {
      if (finalStatus === 'Terminated') finalStatus = 'Active';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eDate = new Date(nEndDate);
      if (!isNaN(eDate.getTime())) {
        finalStatus = today < eDate ? 'Active' : 'Terminated';
      }
    }

    const updateData = { ...formData, status: finalStatus };
    updateEmployee(editingEmployeeId, updateData);
    
    // Manage LASHMA Renewal Reminder
    if (formData.lashmaExpiryDate) {
      const expiry = new Date(formData.lashmaExpiryDate);
      const remindAt = new Date(expiry);
      remindAt.setDate(remindAt.getDate() - 7);
      
      const title = `LASHMA Renewal: ${formData.firstname} ${formData.surname}`;
      // Basic check to avoid duplicates: find existing reminder with same title
      const existing = reminders.find(r => r.title === title && r.isActive);
      
      if (!existing || existing.remindAt !== remindAt.toISOString()) {
        addReminder({
          title,
          body: `Health insurance (LASHMA) for ${formData.firstname} ${formData.surname} expires on ${formData.lashmaExpiryDate}. Please initiate renewal.`,
          remindAt: remindAt.toISOString(),
          recipientIds: [], 
          frequency: 'once',
          isActive: true
        });
      }
    }

    setIsEditing(false);
    setEditingEmployeeId(null);
    toast.success('Employee updated successfully.');
    setFormData({
      staffType: 'OFFICE',
      level: 10,
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

  const handleExportCSV = async (mode: 'bare' | 'detailed' = 'detailed') => {
    try {
      let headers: string[] = [];
      const canSeeSalary = (priv as any)?.canViewSalaries ?? true;

      if (mode === 'bare') {
        headers = ['ID', 'Code', 'Surname', 'Firstname', 'Department', 'Position', 'Status', 'Start Date'];
      } else {
        headers = [
          'id', 'employeeCode', 'surname', 'firstname', 'department', 'staffType', 'level', 'position', 'status',
          'yearlyLeave', 'startDate', 'endDate', 'bankName', 'accountNo', 'taxId', 'pensionNumber', 'lashmaPolicyNumber',
          'lashmaRegistrationDate', 'lashmaExpiryDate', 'payeTax', 'withholdingTax', 'excludeFromOnboarding', 'rent',
          'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
        ];
      }

      const extractCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
      const extractCSVText = (str: any) => `="${String(str || '').replace(/"/g, '""')}"`;

      const rows = employees.map(emp => {
        let data: any[] = [];
        if (mode === 'bare') {
          data = [
            emp.id,
            emp.employeeCode,
            emp.surname,
            emp.firstname,
            emp.department,
            emp.position,
            emp.status,
            formatDisplayDate(emp.startDate) || ''
          ];
        } else {
          data = [
            emp.id,
            extractCSV(emp.employeeCode || ''),
            extractCSV(emp.surname),
            extractCSV(emp.firstname),
            extractCSV(emp.department),
            extractCSV(emp.staffType),
            extractCSV(emp.level),
            extractCSV(emp.position),
            extractCSV(emp.status),
            extractCSV(emp.yearlyLeave),
            extractCSV(formatDisplayDate(emp.startDate) || ''),
            extractCSV(formatDisplayDate(emp.endDate) || ''),
            extractCSV(emp.bankName || ''),
            extractCSVText(emp.accountNo || ''),
            extractCSVText(emp.taxId || ''),
            extractCSVText(emp.pensionNumber || ''),
            extractCSVText(emp.lashmaPolicyNumber || ''),
            extractCSV(formatDisplayDate(emp.lashmaRegistrationDate) || ''),
            extractCSV(formatDisplayDate(emp.lashmaExpiryDate) || ''),
            extractCSV(emp.payeTax),
            extractCSV(emp.withholdingTax),
            extractCSV(emp.excludeFromOnboarding || false),
            extractCSV(emp.rent || 0),
            extractCSV(canSeeSalary ? emp.monthlySalaries.jan : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.feb : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.mar : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.apr : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.may : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.jun : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.jul : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.aug : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.sep : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.oct : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.nov : '***'),
            extractCSV(canSeeSalary ? emp.monthlySalaries.dec : '***'),
          ];
        }
        return mode === 'bare' ? data.map(extractCSV).join(',') : data.join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const fileName = `employees_export_${mode === 'bare' ? 'bare_' : ''}${new Date().toISOString().slice(0, 10)}.csv`;

      if (window.electronAPI?.savePathDialog) {
        const filePath = await window.electronAPI.savePathDialog({
          title: `Export Employee Directory (${mode === 'bare' ? 'Bare Minimum' : 'Detailed'})`,
          defaultPath: fileName,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (filePath) {
          const success = await window.electronAPI.writeFile(filePath, csvContent, 'utf8');
          if (success) toast.success(`Exported to ${filePath}`);
          else toast.error('Failed to save file.');
        }
      } else {
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Successfully exported ${employees.length} employees`);
      }
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
        if (inQuotes && i + 1 < str.length && str[i + 1] === '"') {
          // RFC 4180: "" inside a quoted field = literal quote character
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
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

  // Strip Excel text-force wrapper (="...") and tab prefix from a CSV value
  const stripExcelText = (val: string): string => {
    // Handle ="..." Excel formula wrapper (from our export)
    if (/^=".*"$/.test(val)) return val.slice(2, -1).replace(/""/g, '"');
    // Handle tab-prefixed values (Excel sometimes adds \t to force text)
    if (val.startsWith('\t')) return val.slice(1);
    return val;
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const headerRow = parseCSVRow(lines[0]);
        
        // Helper to find index by multiple common names (case-insensitive)
        const getIdx = (candidates: string[]) => {
          for (const cand of candidates) {
            const idx = headerRow.findIndex(h => h.toLowerCase() === cand.toLowerCase());
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const idxMap = {
          id: getIdx(['id']),
          employeeCode: getIdx(['employeeCode', 'staffCode', 'code']),
          surname: getIdx(['surname', 'last name']),
          firstname: getIdx(['firstname', 'first name']),
          department: getIdx(['department', 'dept']),
          staffType: getIdx(['staffType', 'staff_type', 'type']),
          level: getIdx(['level']),
          position: getIdx(['position', 'title']),
          status: getIdx(['status']),
          yearlyLeave: getIdx(['yearlyLeave', 'yearly_leave', 'leave']),
          startDate: getIdx(['startDate', 'start_date', 'joined']),
          endDate: getIdx(['endDate', 'end_date', 'terminated']),
          bankName: getIdx(['bankName', 'bank']),
          accountNo: getIdx(['accountNo', 'account']),
          taxId: getIdx(['taxId', 'tax_id', 'tin']),
          pensionNumber: getIdx(['pensionNumber', 'pension']),
          lashmaPolicyNumber: getIdx(['lashmaPolicyNumber', 'lashma_policy']),
          lashmaRegistrationDate: getIdx(['lashmaRegistrationDate', 'lashma_reg_date']),
          lashmaExpiryDate: getIdx(['lashmaExpiryDate', 'lashma_expiry']),
          payeTax: getIdx(['payeTax', 'paye_tax', 'paye']),
          withholdingTax: getIdx(['withholdingTax', 'with_tax', 'wht']),
          excludeFromOnboarding: getIdx(['excludeFromOnboarding', 'exclude_from_onboarding']),
          rent: getIdx(['rent']),
          jan: getIdx(['jan']), feb: getIdx(['feb']), mar: getIdx(['mar']), apr: getIdx(['apr']),
          may: getIdx(['may']), jun: getIdx(['jun']), jul: getIdx(['jul']), aug: getIdx(['aug']),
          sep: getIdx(['sep']), oct: getIdx(['oct']), nov: getIdx(['nov']), dec: getIdx(['dec'])
        };

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVRow(lines[i]);
          if (vals.length < 3) continue; // Skip Malformed rows
          
          const importedDept = idxMap.department !== -1 ? vals[idxMap.department]?.trim() : '';
          const importedPosition = idxMap.position !== -1 ? vals[idxMap.position]?.trim() : '';
          
          if (importedDept && !departments.some(d => d.name === importedDept)) newDepartments.add(importedDept);
          if (importedPosition && !positions.some(p => p.title === importedPosition)) newPositions.add(importedPosition);

          const providedId = idxMap.id !== -1 ? (vals[idxMap.id]?.trim() || '') : '';
          const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(providedId);
          
          const idToUse = (mode !== 'append' && isValidUUID) ? providedId : generateId();
          if (idToUse) csvProcessedIds.add(idToUse);

          const rawStartDate = idxMap.startDate !== -1 ? (vals[idxMap.startDate] || '') : '';
          const rawEndDate = idxMap.endDate !== -1 ? (vals[idxMap.endDate] || '') : '';
          const normalizedStartDate = normalizeDate(rawStartDate);
          const normalizedEndDate = normalizeDate(rawEndDate);

          const val = (idx: number) => idx !== -1 ? (vals[idx] || '') : '';
          const num = (idx: number) => idx !== -1 ? (parseFloat(vals[idx]) || 0) : 0;
          const bool = (idx: number) => {
            if (idx === -1) return false;
            const str = (vals[idx] || '').trim().toLowerCase();
            return ['true', 'yes', '1'].includes(str);
          };

          const parsedEmp: Employee = {
            id: idToUse,
            employeeCode: mode === 'append' ? "" : (val(idxMap.employeeCode) || (isValidUUID ? "" : providedId)),
            surname: val(idxMap.surname), 
            firstname: val(idxMap.firstname), 
            department: val(idxMap.department) || 'Unassigned', 
            staffType: (val(idxMap.staffType) || 'FIELD') as any,
            level: idxMap.level !== -1 ? (parseInt(vals[idxMap.level]) || 10) : 10,
            position: val(idxMap.position), 
            status: (val(idxMap.status) || 'Active') as any, 
            yearlyLeave: parseInt(val(idxMap.yearlyLeave)) || 0,
            startDate: normalizedStartDate, 
            endDate: (() => {
              if (normalizedEndDate && normalizedStartDate) {
                const sDate = new Date(normalizedStartDate);
                const eDate = new Date(normalizedEndDate);
                if (!isNaN(eDate.getTime()) && !isNaN(sDate.getTime()) && eDate < sDate) return '';
              }
              return normalizedEndDate;
            })(),
            bankName: val(idxMap.bankName),
            accountNo: stripExcelText(val(idxMap.accountNo)),
            taxId: stripExcelText(val(idxMap.taxId)),
            pensionNumber: stripExcelText(val(idxMap.pensionNumber)),
            lashmaPolicyNumber: stripExcelText(val(idxMap.lashmaPolicyNumber)),
            lashmaRegistrationDate: normalizeDate(val(idxMap.lashmaRegistrationDate)),
            lashmaExpiryDate: normalizeDate(val(idxMap.lashmaExpiryDate)),
            payeTax: bool(idxMap.payeTax),
            withholdingTax: bool(idxMap.withholdingTax),
            excludeFromOnboarding: bool(idxMap.excludeFromOnboarding),
            rent: num(idxMap.rent),
            monthlySalaries: {
              jan: num(idxMap.jan), feb: num(idxMap.feb), mar: num(idxMap.mar), apr: num(idxMap.apr),
              may: num(idxMap.may), jun: num(idxMap.jun), jul: num(idxMap.jul), aug: num(idxMap.aug),
              sep: num(idxMap.sep), oct: num(idxMap.oct), nov: num(idxMap.nov), dec: num(idxMap.dec)
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
          addDepartment({ id: generateId(), name: dept, staffType: 'OFFICE', workDaysPerWeek: 5 });
          addedDeptCount++;
        });
        newPositions.forEach(pos => {
          addPosition({ id: generateId(), title: pos, departmentId: '' });
          addedPosCount++;
        });

        let message = `Import complete: ${importedCount} Added | ${updatedCount} Updated`;
        if (deletedCount > 0) message += ` | ${deletedCount} Removed`;
        if (addedDeptCount > 0 || addedPosCount > 0) {
          message += `. ${addedDeptCount} new department(s) and ${addedPosCount} new position(s) added to Variables.`;
        }
        toast.success(message);
      } catch (err: any) {
        toast.error(`Failed to parse CSV file: ${err.message}`);
        console.error('CSV Import Error:', err);
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
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Position</label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                    value={formData.position || ''} 
                    onChange={e => {
                      const newPos = e.target.value;
                      const posObj = positions.find(p => p.title === newPos);
                      let deptObj = null;
                      if (posObj?.departmentId) {
                        deptObj = departments.find(d => d.id === posObj.departmentId);
                      }
                      setFormData({ 
                        ...formData, 
                        position: newPos,
                        department: deptObj ? deptObj.name : '',
                        staffType: deptObj ? deptObj.staffType : 'OFFICE'
                      });
                    }}>
                    <option value="" disabled>Select Position</option>
                    {positions
                      .filter(p => {
                        const dept = departments.find(d => d.id === p.departmentId);
                        return dept?.staffType !== 'NON-EMPLOYEE';
                      })
                      .map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Department</label>
                  <Input value={formData.department || ''} disabled className="bg-slate-100/50 text-slate-500 cursor-not-allowed" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Secondary / Dual-Department (HOD Role)</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md min-h-12 max-h-48 overflow-y-auto">
                    {departments
                      .filter(d => d.name !== formData.department && d.staffType !== 'NON-EMPLOYEE')
                      .map(dept => (
                      <label key={dept.id} className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-indigo-50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={formData.secondaryDepartments?.includes(dept.name) || false} 
                          onChange={e => {
                            const current = formData.secondaryDepartments || [];
                            const next = e.target.checked ? [...current, dept.name] : current.filter(n => n !== dept.name);
                            setFormData({ ...formData, secondaryDepartments: next });
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-3.5 w-3.5"
                        />
                        {dept.name}
                      </label>
                    ))}
                    {departments.filter(d => d.name !== formData.department && d.staffType !== 'NON-EMPLOYEE').length === 0 && (
                      <span className="text-[10px] text-slate-400 italic">No other departments available.</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff Type</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                    value={formData.staffType || 'OFFICE'} 
                    onChange={e => setFormData({ ...formData, staffType: e.target.value as any })}
                  >
                    <option value="OFFICE">OFFICE</option>
                    <option value="FIELD">FIELD</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Level</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                    value={formData.level || 10} 
                    onChange={e => setFormData({ ...formData, level: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lv => (
                      <option key={lv} value={lv}>Level {lv} {lv === 1 ? '(Head of Company)' : lv === 2 ? '(Head of Dept)' : ''}</option>
                    ))}
                  </select>
                </div>
                {formData.staffType !== 'NON-EMPLOYEE' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Line Manager</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                      value={formData.lineManager || ''} 
                      onChange={e => setFormData({ ...formData, lineManager: e.target.value || undefined })}
                    >
                      <option value="">None / Top Executive</option>
                      {employees
                        .filter(emp => emp.staffType !== 'NON-EMPLOYEE' && emp.id !== formData.id && emp.status === 'Active')
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.firstname} {emp.surname} ({emp.position})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone</label>
                  <Input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g. +234 801 234 5678" className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                  <Input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="e.g. john@company.com" className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
                  <select 
                    className={`flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none ${normalizeDate(formData.endDate) ? 'opacity-70 cursor-not-allowed' : ''}`} 
                    value={formData.status} 
                    onChange={e => {
                      const newStatus = e.target.value;
                      if (newStatus === 'Terminated' && !normalizeDate(formData.endDate)) {
                        toast.error('Termination status requires an Official End Date.');
                        return;
                      }
                      setFormData({ ...formData, status: newStatus as any });
                    }}
                    disabled={!!normalizeDate(formData.endDate)}
                  >
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
                  <Input type="date" value={normalizeDate(formData.startDate)} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="bg-slate-50 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">End Date</label>
                  <Input type="date" value={normalizeDate(formData.endDate)} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="bg-slate-50 focus:bg-white" />
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
                {formData.avatar && <AvatarImage src={formData.avatar} alt="Avatar" className="object-cover" />}
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">LASHMA Policy Number</label>
                    <Input value={formData.lashmaPolicyNumber || ''} onChange={e => setFormData({ ...formData, lashmaPolicyNumber: e.target.value })} placeholder="Enter policy number" className="bg-slate-50 focus:bg-white font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">LASHMA Registration Date</label>
                      <Input type="date" value={normalizeDate(formData.lashmaRegistrationDate)} onChange={e => setFormData({ ...formData, lashmaRegistrationDate: e.target.value })} className="bg-slate-50 focus:bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">LASHMA Expiry Date</label>
                      <Input type="date" value={normalizeDate(formData.lashmaExpiryDate)} onChange={e => setFormData({ ...formData, lashmaExpiryDate: e.target.value })} className="bg-slate-50 focus:bg-white" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Rent (₦)</label>
                    <Input type="number" value={formData.rent || 0} onChange={e => setFormData({ ...formData, rent: Number(e.target.value) })} className="font-mono bg-slate-50 focus:bg-white" />
                  </div>
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
                {emp.avatar && <AvatarImage src={emp.avatar} alt="Avatar" className="object-cover" />}
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{emp.surname} {emp.firstname}</h2>
                <p className="text-slate-500">
                  {emp.position} - {emp.department}
                  {emp.secondaryDepartments && emp.secondaryDepartments.length > 0 && (
                    <span className="text-indigo-500 font-medium ml-1">
                      (Dual: {emp.secondaryDepartments.join(', ')})
                    </span>
                  )}
                </p>
                <Badge variant={emp.status === 'Active' ? 'success' : emp.status === 'On Leave' ? 'warning' : 'destructive'} className="mt-1">
                  {emp.status}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div className="flex bg-slate-100 rounded-lg p-1 grow md:grow-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {['Overview', 'Attendance', 'Leaves', 'Conduct', 'Evaluations', 'Reminders'].map(tab => (
                  <button
                    key={tab}
                    className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${detailTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setDetailTab(tab as any)}
                  >
                    {tab === 'Conduct' ? 'Merits & Incidents' : tab}
                  </button>
                ))}
              </div>
              
              {(detailTab === 'Attendance' || detailTab === 'Leaves' || detailTab === 'Conduct' || detailTab === 'Evaluations') && (
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
                      <div className="flex justify-between"><span className="text-slate-500">Start Date:</span><span>{formatDisplayDate(emp.startDate) || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">End Date:</span><span>{formatDisplayDate(emp.endDate) || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Yearly Leave:</span><span>{emp.yearlyLeave} days</span></div>
                      {emp.phone && <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span className="font-mono">{emp.phone}</span></div>}
                      {emp.email && <div className="flex justify-between"><span className="text-slate-500">Email:</span><span className="text-indigo-600">{emp.email}</span></div>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Bank & Tax</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Bank:</span><span>{emp.bankName || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Account:</span><span className="font-mono">{emp.accountNo || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Tax ID:</span><span className="font-mono">{emp.taxId || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Pension:</span><span className="font-mono">{emp.pensionNumber || 'N/A'}</span></div>
                      <div className="flex justify-between font-bold text-emerald-600"><span className="text-emerald-500">LASHMA:</span><span className="font-mono">{emp.lashmaPolicyNumber}</span></div>
                      {emp.lashmaRegistrationDate && <div className="flex justify-between text-xs"><span className="text-slate-500">Reg. Date:</span><span>{formatDisplayDate(emp.lashmaRegistrationDate)}</span></div>}
                      {emp.lashmaExpiryDate && <div className="flex justify-between text-xs text-rose-500 font-semibold"><span className="text-slate-500">Expiry Date:</span><span>{formatDisplayDate(emp.lashmaExpiryDate)}</span></div>}
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
                                 <TableCell className="font-mono text-[11px] text-slate-500">{formatDisplayDate(r.remindAt)}</TableCell>
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
                              <TableCell className="font-mono text-[11px] text-slate-500">{formatDisplayDate(r.date)}</TableCell>
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
                              <TableCell className="font-mono text-[11px] text-slate-500">{formatDisplayDate(l.startDate)} to {formatDisplayDate(l.expectedEndDate)}</TableCell>
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

            {detailTab === 'Conduct' && (() => {
               const empEvents = disciplinaryRecords
                 .filter(r => r.employeeId === emp.id)
                 .filter(r => activeTabYear === 'All' ? true : r.date?.startsWith(activeTabYear))
                 .filter(r => activeTabMonth === 'All' ? true : new Date(r.date || '').getMonth() + 1 === parseInt(activeTabMonth))
                 .sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
               
               const totalPoints = empEvents.reduce((sum, r) => sum + (r.points || 0), 0);

               return (
                 <div className="space-y-4">
                   <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Score</span>
                          <span className={`text-xl font-black ${totalPoints > 0 ? 'text-emerald-600' : totalPoints < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
                          </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Events</span>
                          <span className="text-lg font-bold text-slate-700">{empEvents.length}</span>
                        </div>
                      </div>

                   </div>

                   {empEvents.length === 0 ? (
                     <div className="text-center py-8 bg-white rounded-lg border border-slate-100 shadow-inner">
                        <p className="text-slate-500 font-medium">No professional conduct events for selected period.</p>
                        <p className="text-xs text-slate-400 mt-1">Clean record and good standing.</p>
                     </div>
                   ) : (
                     <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-slate-50/50">
                             <TableHead className="w-24">Date</TableHead>
                             <TableHead>Type/Incidence</TableHead>
                             <TableHead>Weight</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {empEvents.map(d => (
                             <TableRow key={d.id} className="hover:bg-slate-50/80">
                               <TableCell className="font-mono text-[11px] text-slate-500">{formatDisplayDate(d.date)}</TableCell>
                               <TableCell>
                                 <div className="font-semibold text-slate-800 text-xs">{d.type}</div>
                                 <div className="text-[10px] text-slate-500">{d.severity}</div>
                               </TableCell>
                               <TableCell>
                                 <Badge variant={d.points && d.points > 0 ? 'success' : d.points && d.points < 0 ? 'destructive' : 'outline'} className="text-[10px] font-black">
                                   {d.points && d.points > 0 ? `+${d.points}` : d.points || 0}
                                 </Badge>
                               </TableCell>
                               <TableCell className="text-right">
                                 <div className="flex justify-end gap-1">
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setViewingNarrative({ type: 'Disciplinary', data: d })}>
                                     <Eye className="h-4 w-4" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50" onClick={async () => {
                                      const ok = await showConfirm('Delete this performance event?', { variant: 'danger' });
                                      if (ok) {
                                        deleteDisciplinaryRecord(d.id);
                                        toast.success('Event deleted.');
                                      }
                                   }}>
                                      <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </div>
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
                               <TableCell className="font-mono text-[11px] text-slate-500">{formatDisplayDate(e.date)}</TableCell>
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

  const renderBulkEditModal = () => {
    if (!isBulkEditing) return null;

    const handleBulkUpdate = () => {
      if (Object.keys(bulkFormData).length === 0) {
        toast.info('No changes to apply.');
        return;
      }

      // Special handling for staffType change:
      // If staffType is changed to 'NON-EMPLOYEE', clear position, department, level, lineManager
      if (bulkFormData.staffType === 'NON-EMPLOYEE') {
        bulkFormData.position = '';
        bulkFormData.department = '';
        bulkFormData.level = 10; // Default level for non-employees
        bulkFormData.lineManager = undefined;
      } else if (bulkFormData.position) {
        // If position is set, try to infer department and staffType from it
        const selectedPosition = positions.find(p => p.title === bulkFormData.position);
        if (selectedPosition && selectedPosition.departmentId) {
          const dept = departments.find(d => d.id === selectedPosition.departmentId);
          if (dept) {
            bulkFormData.department = dept.name;
            bulkFormData.staffType = dept.staffType;
          }
        }
      }

      bulkUpdateEmployees(selectedIds, bulkFormData);
      toast.success(`Updated ${selectedIds.length} employees.`);
      setIsBulkEditing(false);
      setSelectedIds([]);
      setBulkFormData({});
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-indigo-600 p-4 flex justify-between items-center rounded-t-lg">
            <h3 className="text-white font-bold text-lg">Bulk Edit Employees ({selectedIds.length})</h3>
            <Button variant="ghost" size="sm" className="text-white hover:bg-indigo-700" onClick={() => setIsBulkEditing(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-sm text-slate-600">Apply changes to the selected {selectedIds.length} employees. Only fields you modify here will be updated.</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  value={bulkFormData.status || ''}
                  onChange={e => setBulkFormData({ ...bulkFormData, status: e.target.value as any })}
                >
                  <option value="">No Change</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Staff Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  value={bulkFormData.staffType || ''}
                  onChange={e => setBulkFormData({ ...bulkFormData, staffType: e.target.value as any })}
                >
                  <option value="">No Change</option>
                  <option value="OFFICE">OFFICE</option>
                  <option value="FIELD">FIELD</option>
                </select>
              </div>

              {bulkFormData.staffType !== 'NON-EMPLOYEE' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Position</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      value={bulkFormData.position || ''}
                      onChange={e => {
                        const newPos = e.target.value;
                        const posObj = positions.find(p => p.title === newPos);
                        let deptObj = null;
                        if (posObj?.departmentId) {
                          deptObj = departments.find(d => d.id === posObj.departmentId);
                        }
                        setBulkFormData({
                          ...bulkFormData,
                          position: newPos,
                          department: deptObj ? deptObj.name : '',
                          staffType: deptObj ? deptObj.staffType : bulkFormData.staffType // Keep existing staffType if not inferred
                        });
                      }}>
                      <option value="">No Change</option>
                      {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Department</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      value={bulkFormData.department || ''}
                      onChange={e => setBulkFormData({ ...bulkFormData, department: e.target.value })}
                    >
                      <option value="">No Change</option>
                      {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Level</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      value={bulkFormData.level || ''}
                      onChange={e => setBulkFormData({ ...bulkFormData, level: parseInt(e.target.value) || undefined })}
                    >
                      <option value="">No Change</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lv => (
                        <option key={lv} value={lv}>Level {lv} {lv === 1 ? '(Head of Company)' : lv === 2 ? '(Head of Dept)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Line Manager</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      value={bulkFormData.lineManager || ''}
                      onChange={e => setBulkFormData({ ...bulkFormData, lineManager: e.target.value || undefined })}
                    >
                      <option value="">No Change</option>
                      <option value="NONE">None / Top Executive</option>
                      {employees
                        .filter(emp => emp.staffType !== 'NON-EMPLOYEE' && !selectedIds.includes(emp.id) && emp.status === 'Active')
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.firstname} {emp.surname} ({emp.position})</option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <Checkbox
                    checked={bulkFormData.payeTax}
                    onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, payeTax: checked as boolean })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                  />
                  Subject to PAYE Tax
                </label>
                <label className="flex items-center gap-3 text-sm font-medium cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <Checkbox
                    checked={bulkFormData.withholdingTax}
                    onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, withholdingTax: checked as boolean })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                  />
                  Subject to Withholding Tax
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsBulkEditing(false)}>Cancel</Button>
              <Button onClick={handleBulkUpdate} className="bg-indigo-600 hover:bg-indigo-700 text-white">Apply Changes</Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPerformanceLogModal = () => {
    if (!isLoggingPerformance || !viewingEmployee) return null;
    const emp = viewingEmployee;
    const meritDefault = hrVariables?.meritWeight ?? 1;
    const demeritDefault = hrVariables?.demeritWeight ?? -1;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsLoggingPerformance(false)} />
        <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden font-sans">
          <div className={`p-6 bg-gradient-to-r ${(performanceRecord.points || 0) > 0 ? 'from-emerald-600 to-teal-600' : (performanceRecord.points || 0) < 0 ? 'from-rose-600 to-pink-600' : 'from-indigo-600 to-blue-600'}`}>
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Log Professional Event</h3>
                <button onClick={() => setIsLoggingPerformance(false)} className="text-white/70 hover:text-white transition-colors duration-200"><X className="h-6 w-6" /></button>
             </div>
             <p className="text-white/80 text-sm font-medium">Internal Ledger for {emp.firstname} {emp.surname}</p>
          </div>

          <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date of Event</label>
                 <Input type="date" value={performanceRecord.date} onChange={e => setPerformanceRecord({...performanceRecord, date: e.target.value})} className="rounded-xl border-slate-100 bg-slate-50/50" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Point Weight</label>
                 <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl hover:bg-rose-50 hover:text-rose-600 border-slate-100" onClick={() => setPerformanceRecord({...performanceRecord, points: (performanceRecord.points || 0) - 1})}>
                      <span className="font-bold">-</span>
                    </Button>
                    <Input type="number" value={performanceRecord.points} onChange={e => setPerformanceRecord({...performanceRecord, points: parseInt(e.target.value) || 0})} className="h-10 text-center font-black rounded-xl border-slate-100 bg-slate-50/50" />
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 border-slate-100" onClick={() => setPerformanceRecord({...performanceRecord, points: (performanceRecord.points || 0) + 1})}>
                      <span className="font-bold">+</span>
                    </Button>
                 </div>
                 <p className="text-[9px] text-slate-400 mt-1 italic text-center">Merit: +{meritDefault}, Demerit: {demeritDefault}</p>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Event Type</label>
               <select value={performanceRecord.type} onChange={e => {
                  const val = e.target.value;
                  // Auto-assign weight based on type if points is 0 or neutral
                  let pts = performanceRecord.points || 0;
                  if (val === 'Accolade' && pts <= 0) pts = meritDefault;
                  if (['Attendance', 'Behavioral', 'Performance', 'Safety/PPE'].includes(val) && pts >= 0) pts = demeritDefault;
                  setPerformanceRecord({...performanceRecord, type: val as any, points: pts});
               }} className="w-full h-11 px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {hrVariables?.performanceCategories?.length ? (
                    hrVariables.performanceCategories.map(c => <option key={c} value={c}>{c}</option>)
                  ) : (
                    <>
                      <option value="Attendance">Attendance (Lateness/Absenteeism)</option>
                      <option value="Behavioral">Behavioral (Conduct/Attitude)</option>
                      <option value="Performance">Performance (Work Quality)</option>
                      <option value="Safety/PPE">Safety/PPE Compliance</option>
                      <option value="Accolade">Accolade / Special Recognition</option>
                      <option value="Other">Other Category</option>
                    </>
                  )}
               </select>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Official Severity / Action</label>
               <select value={performanceRecord.severity} onChange={e => setPerformanceRecord({...performanceRecord, severity: e.target.value as any})} className="w-full h-11 px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  <option value="Neutral/Info">Neutral / Informational Only</option>
                  {hrVariables?.actionLevels?.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                  <option value="Accolade - Commendation">Accolade - Commendation</option>
                  <option value="Accolade - Outstanding">Accolade - Outstanding Performance</option>
               </select>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Event Description & Narrative</label>
               <textarea value={performanceRecord.description} onChange={e => setPerformanceRecord({...performanceRecord, description: e.target.value})} placeholder="Describe exactly what happened..." className="w-full h-24 px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-inner" />
            </div>

            <Button onClick={() => {
              if (!performanceRecord.description) return toast.error('Add description');
              const rec: DisciplinaryRecord = {
                id: generateId(),
                employeeId: emp.id,
                date: performanceRecord.date || new Date().toISOString().split('T')[0],
                type: performanceRecord.type || 'Behavioral',
                severity: performanceRecord.severity || 'Verbal Warning',
                description: performanceRecord.description,
                points: performanceRecord.points || 0,
                status: 'Active',
                createdBy: 'HR System',
                workspaceId: 'dcel', // Corrected mapping
                acknowledged: false,
                visibleToEmployee: true,
                workflowState: 'Reported'
              };
              addDisciplinaryRecord(rec);
              toast.success('Performance record updated');
              setIsLoggingPerformance(false);
            }} className="w-full rounded-2xl h-14 font-black uppercase tracking-widest bg-slate-900 hover:bg-black text-white shadow-lg transition-all active:scale-95 duration-300">
              Post to Ledger
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Set page title and header buttons
  useSetPageTitle(
    'Personnel Directory',
    'Manage office & field staff, hierarchy, and payroll',
    <div className="hidden sm:flex items-center gap-2">
      {selectedIds.length > 0 && (
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 h-9"
          onClick={() => {
            setBulkFormData({});
            setIsBulkEditing(true);
          }}
        >
          <Settings2 className="h-4 w-4" /> Bulk Edit ({selectedIds.length})
        </Button>
      )}
      {priv.canExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9 px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm">
              <Upload className="h-3.5 w-3.5 text-emerald-500" /> Export <ChevronDown className="h-3 w-3 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Choose Export Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportCSV('bare')} className="cursor-pointer">
              <div className="flex flex-col">
                <span className="font-medium">Basic CSV</span>
                <span className="text-[10px] text-slate-500">Essential fields only</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportCSV('detailed')} className="cursor-pointer">
              <div className="flex flex-col">
                <span className="font-medium">Detailed CSV</span>
                <span className="text-[10px] text-slate-500">Full employee data including salaries</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {priv.canAdd && (
        <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
          <Download className="h-3.5 w-3.5 text-indigo-500" /> Import
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
        </label>
      )}
      <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => navigate('/organogram')}>
        <Network className="h-4 w-4" /> Organogram
      </Button>
      {priv.canAdd && (
        <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-9" onClick={() => { setIsAdding(true); setOpenMenuId(null); setFormData({ staffType: 'OFFICE', level: 10, status: 'Active', payeTax: false, withholdingTax: false, monthlySalaries: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 } }); }}>
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      )}
    </div>
  );

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
      {/* ── Mobile Actions ── */}
      <div className="flex sm:hidden flex-col gap-3 px-1">
        <div className="flex flex-wrap gap-2">
          {priv.canAdd && (
            <Button className="flex-1 gap-2 bg-indigo-600 text-white" onClick={() => { setIsAdding(true); setOpenMenuId(null); setFormData({ staffType: 'OFFICE', level: 10, status: 'Active', payeTax: false, withholdingTax: false, monthlySalaries: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 } }); }}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          )}
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/organogram')}>
            <Network className="h-4 w-4" /> Organogram
          </Button>
        </div>
        <div className="flex gap-2">
          {priv.canExport && (
            <Button variant="outline" className="flex-1 gap-2 text-[11px] font-bold uppercase tracking-tight" onClick={() => handleExportCSV('detailed')}>
              <Upload className="h-4 w-4 text-emerald-500" /> Export CSV
            </Button>
          )}
          {priv.canAdd && (
            <label className="flex-1 flex items-center justify-center gap-2 px-4 h-10 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50">
              <Download className="h-4 w-4 text-indigo-500" /> Import
              <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            </label>
          )}
        </div>
        {selectedIds.length > 0 && (
          <Button 
            className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => { setBulkFormData({}); setIsBulkEditing(true); }}
          >
            <Settings2 className="h-4 w-4" /> Bulk Edit Selected ({selectedIds.length})
          </Button>
        )}
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
              <TableHead className="w-10">
                <Checkbox 
                  checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedIds(filteredEmployees.map(e => e.id));
                    else setSelectedIds([]);
                  }}
                />
              </TableHead>
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
              <TableRow key={employee.id} className={`${selectedIds.includes(employee.id) ? 'bg-indigo-50/50' : ''} hover:bg-slate-50/50 transition-colors`}>
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(employee.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds([...selectedIds, employee.id]);
                      else setSelectedIds(selectedIds.filter(id => id !== employee.id));
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200">
                      <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs">
                        {employee.firstname.charAt(0)}{employee.surname.charAt(0)}
                      </AvatarFallback>
                      {employee.avatar && <AvatarImage src={employee.avatar} alt="Avatar" className="object-cover" />}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{employee.surname} {employee.firstname}</span>
                      <span className="text-xs text-slate-500 font-mono tracking-tight">{employee.employeeCode || `EMP-${employee.id.substring(0, 4).toUpperCase()}`}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>
                  <Badge variant={employee.staffType === 'OFFICE' ? 'default' : employee.staffType === 'FIELD' ? 'secondary' : 'outline'}>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 data-[state=open]:bg-slate-100 data-[state=open]:text-indigo-600">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 fade-in-80 zoom-in-95 data-[state=closed]:fade-out-80 data-[state=closed]:zoom-out-95">
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleView(employee)}>
                        <Eye className="h-4 w-4 text-slate-400" /> View Details
                      </DropdownMenuItem>
                      {priv.canEdit && (
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleEdit(employee)}>
                          <Pencil className="h-4 w-4 text-slate-400" /> Edit Record
                        </DropdownMenuItem>
                      )}
                      {priv.canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 cursor-pointer focus:text-red-700 focus:bg-red-50 gap-2 font-medium"
                            onClick={async () => {
                              const ok = await showConfirm(`Are you sure you want to delete ${employee.surname} ${employee.firstname}?`, { variant: 'danger', confirmLabel: 'Delete' });
                              if (ok) { deleteEmployee(employee.id); toast.success('Employee record deleted'); }
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {renderBulkEditModal()}
      {renderViewModal()}
      {renderPerformanceLogModal()}
      
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
