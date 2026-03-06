import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { Search, Plus, MoreHorizontal, Download, Upload, ArrowLeft, Save, Pencil, Trash2, Eye, X } from 'lucide-react';
import { useAppStore, Employee, MonthlySalary } from '@/src/store/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { toast, showConfirm } from '@/src/components/ui/toast';

export function Employees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const employees = useAppStore((state) => state.employees);
  const addEmployee = useAppStore((state) => state.addEmployee);
  const updateEmployee = useAppStore((state) => state.updateEmployee);
  const deleteEmployee = useAppStore((state) => state.deleteEmployee);
  const positions = useAppStore((state) => state.positions);
  const departments = useAppStore((state) => state.departments);

  const filteredEmployees = employees.filter(emp =>
    emp.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.firstname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    const newEmployee: Employee = {
      id: `EMP-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
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
  };

  // Render Employee Form (Add or Edit)
  const renderEmployeeForm = (isEdit: boolean) => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setIsAdding(false); setIsEditing(false); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isEdit ? 'Edit Employee' : 'Add Employee'}
            </h1>
            <p className="text-slate-500 mt-1">Enter employee details, financials, and salary matrix.</p>
          </div>
        </div>
        <Button onClick={isEdit ? handleUpdate : handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Save className="h-4 w-4" /> {isEdit ? 'Update Employee' : 'Save Employee'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal & Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Surname</label>
                <Input
                  value={formData.surname || ''}
                  onChange={e => setFormData({ ...formData, surname: e.target.value })}
                  placeholder="e.g. DAVIES"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Firstname</label>
                <Input
                  value={formData.firstname || ''}
                  onChange={e => setFormData({ ...formData, firstname: e.target.value })}
                  placeholder="e.g. HUBERT"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={formData.department || ''}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={formData.position || ''}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                >
                  <option value="">Select Position</option>
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Staff Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={formData.staffType}
                  onChange={e => setFormData({ ...formData, staffType: e.target.value as any })}
                >
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="EXTERNAL">EXTERNAL</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Yearly Leave (Days)</label>
                <Input
                  type="number"
                  value={formData.yearlyLeave || ''}
                  onChange={e => setFormData({ ...formData, yearlyLeave: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial & Tax Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bank Name</label>
                <Input
                  value={formData.bankName || ''}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="e.g. STANBIC"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Account No.</label>
                <Input
                  value={formData.accountNo || ''}
                  onChange={e => setFormData({ ...formData, accountNo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tax ID</label>
                <Input
                  value={formData.taxId || ''}
                  onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pension Number</label>
                <Input
                  value={formData.pensionNumber || ''}
                  onChange={e => setFormData({ ...formData, pensionNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.payeTax}
                  onChange={e => setFormData({ ...formData, payeTax: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                />
                Subject to PAYE Tax
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.withholdingTax}
                  onChange={e => setFormData({ ...formData, withholdingTax: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                />
                Subject to Withholding Tax
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Salary Matrix (Subject to Revision)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((month) => (
                <div key={month} className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">{month}</label>
                  <Input
                    type="number"
                    value={formData.monthlySalaries?.[month as keyof MonthlySalary] || ''}
                    onChange={e => setFormData({
                      ...formData,
                      monthlySalaries: {
                        ...formData.monthlySalaries!,
                        [month]: parseFloat(e.target.value) || 0
                      }
                    })}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const janVal = formData.monthlySalaries?.jan || 0;
                  setFormData({
                    ...formData,
                    monthlySalaries: {
                      jan: janVal, feb: janVal, mar: janVal, apr: janVal,
                      may: janVal, jun: janVal, jul: janVal, aug: janVal,
                      sep: janVal, oct: janVal, nov: janVal, dec: janVal
                    }
                  });
                }}
              >
                Copy Jan Salary to All Months
              </Button>
            </div>
          </CardContent>
        </Card>
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

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Personal Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Employee ID:</span><span className="font-mono">{emp.id}</span></div>
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
          </div>
        </div>
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
    <div className="flex flex-col gap-8">
      {renderViewModal()}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Total Workforce</h1>
          <p className="text-slate-500 mt-2">Manage your employee records, financials, and roles.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search employees..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Filter</Button>
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
              <TableRow key={employee.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
                        {employee.firstname.charAt(0)}{employee.surname.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{employee.surname} {employee.firstname}</span>
                      <span className="text-xs text-slate-500 font-mono">{employee.id}</span>
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
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-500"
                      onClick={() => {
                        const currentOpen = openMenuId === employee.id ? null : employee.id;
                        setOpenMenuId(currentOpen);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {openMenuId === employee.id && (
                      <div className="absolute right-0 top-8 z-50 w-40 bg-white rounded-md shadow-lg border border-slate-200 py-1">
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                          onClick={() => handleEdit(employee)}
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                          onClick={() => handleView(employee)}
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          onClick={async () => {
                            const ok = await showConfirm(`Delete ${employee.surname} ${employee.firstname}?`, { variant: 'danger', confirmLabel: 'Delete' });
                            if (ok) { deleteEmployee(employee.id); toast.success('Employee deleted.'); }
                            setOpenMenuId(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

