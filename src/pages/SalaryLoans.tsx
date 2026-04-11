import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import {
  CheckCircle, ArrowLeft, List, Wallet, CalendarRange, Landmark,
  Banknote, User, CreditCard, Clock, XCircle, ShieldCheck, Download, Upload, Trash2
} from 'lucide-react';
import { useAppStore, SalaryAdvance, Loan } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';

export function SalaryLoans({ setPreviewModal }: { setPreviewModal?: (val: any) => void }) {
  const priv = usePriv('salaryLoans');
  const { user: currentUser } = useAuth();
  const { users, createMainTask, addSubtask } = useAppData();

  const [requestType, setRequestType] = useState('Salary Advance');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [payStartDate, setPayStartDate] = useState('');
  const [approverId, setApproverId] = useState('');
  const [viewMode, setViewMode] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const employees = useAppStore((state) => state.employees).filter(e => e.status === 'Active' || e.status === 'On Leave');
  const departments = useAppStore((state) => state.departments);
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);

  // Compute internal employees (Office and Field)
  const internalEmployees = employees.filter(e => {
    const internalDeptNames = departments
      .filter(d => d.staffType === 'OFFICE' || d.staffType === 'FIELD')
      .map(d => d.name);

    return e.position !== 'Adhoc Staff' && internalDeptNames.includes(e.department);
  });

  const addSalaryAdvance = useAppStore((state) => state.addSalaryAdvance);
  const addLoan = useAppStore((state) => state.addLoan);
  const updateSalaryAdvance = useAppStore((state) => state.updateSalaryAdvance);
  const updateLoan = useAppStore((state) => state.updateLoan);
  const deleteSalaryAdvance = useAppStore((state) => state.deleteSalaryAdvance);
  const deleteLoan = useAppStore((state) => state.deleteLoan);

  // Approver options — all active system users except current user
  const approverOptions = users.filter((u: any) => u.id !== currentUser?.id && !u.isDeleted);

  const handleClear = () => {
    setRequestType('Salary Advance');
    setStaffId('');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setDuration('');
    setPayStartDate('');
    setApproverId('');
  };

  const handleDeleteAdvance = async (id: string, name: string) => {
    const confirmed = await showConfirm(`Are you sure you want to delete the salary advance for ${name}?`, { variant: 'danger' });
    if (confirmed) {
      deleteSalaryAdvance(id);
      toast.success('Salary advance deleted successfully.');
    }
  };

  const handleDeleteLoan = async (id: string, name: string) => {
    const confirmed = await showConfirm(`Are you sure you want to delete the loan for ${name}?`, { variant: 'danger' });
    if (confirmed) {
      deleteLoan(id);
      toast.success('Loan deleted successfully.');
    }
  };

  const handleSubmit = async () => {
    const emp = employees.find(e => e.id === staffId);
    if (!emp) { toast.error('Please select a staff member'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast.error('Please enter a valid amount'); return; }
    if (!approverId) { toast.error('Please select an approver'); return; }

    const approver = approverOptions.find((u: any) => u.id === approverId);
    const approverName = approver?.name || 'Unknown';
    const empName = `${emp.surname} ${emp.firstname}`;

    if (requestType === 'Salary Advance') {
      const newAdvance: SalaryAdvance = {
        id: generateId(),
        employeeId: staffId,
        employeeName: empName,
        amount: Number(amount),
        requestDate: date,
        status: 'Pending',
        approvedById: approverId,
        approvedByName: approverName,
      };
      addSalaryAdvance(newAdvance);

      // Create approval task
      try {
        const today430 = new Date();
        today430.setHours(16, 30, 0, 0);

        const taskTitle = `Approve Salary Advance for ${empName}`;
        const mainTask = await createMainTask({
          title: taskTitle,
          description: `Salary Advance approval request submitted by ${currentUser?.user_metadata?.name || 'HR'}.`,
          createdBy: currentUser?.id,
          teamId: 'dcel-team',
          workspaceId: 'dcel-team',
          assignedTo: approverId,
          deadline: today430.toISOString(),
        });
        if (mainTask?.id) {
          const subtaskDesc = JSON.stringify({ refType: 'salary_advance', refId: newAdvance.id, amount: Number(amount), employeeName: empName });
          const sub = await addSubtask({
            title: `Approve: ${empName} — ₦${Number().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Salary Advance`,
            description: subtaskDesc,
            mainTaskId: mainTask.id,
            assignedTo: approverId,
            status: 'not_started',
            priority: 'high',
            deadline: today430.toISOString(),
          });
          // Store subtask id back on the advance record
          if ((sub as any)?.id) {
            updateSalaryAdvance(newAdvance.id, { approvalTaskId: (sub as any).id });
          }
        }
      } catch (e) {
        console.error('Failed to create approval task:', e);
      }

      toast.success(`Salary Advance submitted. Pending approval from ${approverName}.`);
    } else {
      if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) { toast.error('Please enter a valid duration in months'); return; }
      if (!payStartDate) { toast.error('Please enter a Pay Start Date'); return; }

      const principal = Number(amount);
      const mths = Number(duration);

      const newLoan: Loan = {
        id: generateId(),
        employeeId: staffId,
        employeeName: empName,
        loanType: requestType,
        principalAmount: principal,
        monthlyDeduction: principal / mths,
        duration: mths,
        startDate: date,
        paymentStartDate: payStartDate,
        remainingBalance: principal,
        status: 'Pending',
        approvedById: approverId,
        approvedByName: approverName,
      };
      addLoan(newLoan);

      // Create approval task
      try {
        const today430 = new Date();
        today430.setHours(16, 30, 0, 0);

        const taskTitle = `Approve ${requestType} for ${empName}`;
        const mainTask = await createMainTask({
          title: taskTitle,
          description: `${requestType} approval request submitted by ${currentUser?.user_metadata?.name || 'HR'}.`,
          createdBy: currentUser?.id,
          teamId: 'dcel-team',
          workspaceId: 'dcel-team',
          assignedTo: approverId,
          deadline: today430.toISOString(),
        });
        if (mainTask?.id) {
          const subtaskDesc = JSON.stringify({ refType: 'loan', refId: newLoan.id, amount: principal, employeeName: empName });
          const sub = await addSubtask({
            title: `Approve: ${empName} — ₦${principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${requestType}`,
            description: subtaskDesc,
            mainTaskId: mainTask.id,
            assignedTo: approverId,
            status: 'not_started',
            priority: 'high',
            deadline: today430.toISOString(),
          });
          if ((sub as any)?.id) {
            updateLoan(newLoan.id, { approvalTaskId: (sub as any).id });
          }
        }
      } catch (e) {
        console.error('Failed to create approval task:', e);
      }

      toast.success(`${requestType} submitted. Pending approval from ${approverName}.`);
    }
    handleClear();
  };

  const handleExportCSV = async (mode: 'bare' | 'detailed') => {
    try {
      const headers = mode === 'bare'
        ? ['Type', 'Employee', 'Amount', 'Date', 'Status']
        : ['id', 'Type', 'Employee ID', 'Employee Name', 'Amount', 'Date', 'Pay Start Date', 'Duration', 'Monthly Deduction', 'Remaining Balance', 'Approver', 'Status'];

      const extractCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

      const advanceRows = salaryAdvances.map(sa => {
        if (mode === 'bare') {
          return [
            'Salary Advance',
            sa.employeeName,
            sa.amount,
            formatDisplayDate(sa.requestDate),
            sa.status
          ];
        }
        return [
          sa.id,
          'Salary Advance',
          sa.employeeId,
          sa.employeeName,
          sa.amount,
          formatDisplayDate(sa.requestDate),
          '',
          '',
          '',
          '',
          sa.approvedByName || '',
          sa.status
        ];
      });

      const loanRows = loans.map(ln => {
        if (mode === 'bare') {
          return [
            ln.loanType,
            ln.employeeName,
            ln.principalAmount,
            formatDisplayDate(ln.startDate),
            ln.status
          ];
        }
        return [
          ln.id,
          ln.loanType,
          ln.employeeId,
          ln.employeeName,
          ln.principalAmount,
          formatDisplayDate(ln.startDate),
          formatDisplayDate(ln.paymentStartDate),
          ln.duration,
          ln.monthlyDeduction,
          ln.remainingBalance,
          ln.approvedByName || '',
          ln.status
        ];
      });

      const csvContent = [headers.join(','), ...advanceRows.map(r => r.map(extractCSV).join(',')), ...loanRows.map(r => r.map(extractCSV).join(','))].join('\n');
      const fileName = `Financial_Requests_${mode === 'bare' ? 'Bare' : 'Detailed'}_${new Date().toISOString().slice(0, 10)}.csv`;

      const onConfirm = async () => {
        if (window.electronAPI?.savePathDialog) {
          const filePath = await window.electronAPI.savePathDialog({
            title: `Export Financial Entries (${mode === 'bare' ? 'Bare Minimum' : 'Detailed'})`,
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
          toast.success('Successfully exported financial entries');
        }
      };

      if (setPreviewModal) {
        setPreviewModal({
          isOpen: true,
          title: `Preview Financial Entries (${mode === 'bare' ? 'Summary' : 'Detailed'})`,
          filename: fileName,
          headers: headers.map(h => h.toUpperCase()),
          data: [...advanceRows, ...loanRows].map(row =>
            row.map(cell => typeof cell === 'number' ? `₦${cell.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(cell))
          ),
          onConfirm
        });
      } else {
        onConfirm();
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

        let advCount = 0;
        let loanCount = 0;

        const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());
        const getIdx = (key: string) => headers.indexOf(key.toLowerCase());

        const idx = {
          type: getIdx('type'),
          empName: getIdx('employee name'),
          empId: getIdx('employee ID'),
          amount: getIdx('amount'),
          date: getIdx('date'),
          payStart: getIdx('pay start date'),
          duration: getIdx('duration'),
          status: getIdx('status'),
          id: getIdx('id')
        };

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVRow(lines[i]);
          const type = vals[idx.type] || '';
          const empName = vals[idx.empName] || '';
          const empId = vals[idx.empId] || employees.find(e => `${e.surname} ${e.firstname}` === empName)?.id || '';
          const amount = parseFloat(vals[idx.amount]) || 0;
          const status = (vals[idx.status] || 'Pending') as any;
          const date = normalizeDate(vals[idx.date]);

          if (type.includes('Advance')) {
            addSalaryAdvance({
              id: (mode !== 'append' && vals[idx.id]) ? vals[idx.id] : generateId(),
              employeeId: empId,
              employeeName: empName,
              amount,
              requestDate: date,
              status
            });
            advCount++;
          } else {
            const payStart = normalizeDate(vals[idx.payStart]);
            const duration = parseInt(vals[idx.duration]) || 1;
            addLoan({
              id: (mode !== 'append' && vals[idx.id]) ? vals[idx.id] : generateId(),
              employeeId: empId,
              employeeName: empName,
              loanType: type,
              principalAmount: amount,
              monthlyDeduction: amount / duration,
              duration,
              startDate: date,
              paymentStartDate: payStart || date,
              remainingBalance: amount,
              status
            });
            loanCount++;
          }
        }
        toast.success(`Imported ${advCount} advances and ${loanCount} loans.`);
      } catch (err) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  useSetPageTitle(
    viewMode ? 'Financial Entries Database' : 'Financial Request',
    viewMode ? 'View all recorded salary advances and loans' : 'Submit salary advances or loans for approval',
    <div className="flex items-center gap-2">
      {priv.canAdd && (
        <label className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 shadow-sm border border-indigo-200 rounded-md h-9 px-3 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap">
          <Upload className="h-4 w-4" /> Import
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
        </label>
      )}
      {priv.canAdd && (
        <div className="relative group">
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-9 px-3 text-xs gap-2">
            <Download className="h-4 w-4" /> Export
          </button>
          
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden translate-y-1 group-hover:translate-y-0">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
              <span className="font-semibold text-xs text-slate-700">Choose Export Type</span>
            </div>
            
            <button 
              onClick={() => handleExportCSV('bare')} 
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex flex-col border-b border-slate-50"
            >
              <span className="font-medium text-sm text-slate-900">Bare Minimum</span>
              <span className="text-[10px] text-slate-500">Essential fields for reporting</span>
            </button>
            
            <button 
              onClick={() => handleExportCSV('detailed')} 
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex flex-col"
            >
              <span className="font-medium text-sm text-slate-900">Detailed Version</span>
              <span className="text-[10px] text-slate-500">Full database records</span>
            </button>
          </div>
        </div>
      )}
      <Button
        variant={viewMode ? "default" : "outline"}
        size="sm"
        className={viewMode ? "bg-indigo-600 hover:bg-indigo-700 h-9 text-xs" : "border-slate-200 h-9 text-xs"}
        onClick={() => setViewMode(!viewMode)}
      >
        {viewMode ? (
          <><ArrowLeft className="h-4 w-4 mr-2" /> Back to Form</>
        ) : (
          <><List className="h-4 w-4 mr-2" /> View Database</>
        )}
      </Button>
    </div>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Active':
        return <Badge className="bg-emerald-100 text-emerald-800 border-0 flex items-center gap-1 w-max px-2.5 py-0.5 font-medium"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
      case 'Pending':
        return <Badge className="bg-amber-100 text-amber-800 border-0 flex items-center gap-1 w-max px-2.5 py-0.5 font-medium"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-800 border-0 flex items-center gap-1 w-max px-2.5 py-0.5 font-medium"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      case 'Deducted':
      case 'Completed':
        return <Badge className="bg-slate-100 text-slate-600 border-0 flex items-center gap-1 w-max px-2.5 py-0.5 font-medium"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (viewMode) {
    return (
      <>
        <div className="flex flex-col gap-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Salary Advances Table */}
            <Card className="shadow-md border-0 ring-1 ring-slate-100 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-indigo-500" /> Salary Advances
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-4 h-12 text-xs uppercase tracking-wider">Employee</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Date</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Approver</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Status</TableHead>
                      {priv.canDelete && <TableHead className="h-12 w-16 text-xs uppercase tracking-wider text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryAdvances.map(sa => (
                      <TableRow key={sa.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium px-4 text-slate-900">{sa.employeeName}</TableCell>
                        <TableCell className="font-mono font-medium text-slate-700">
                          ₦{(priv as any)?.canViewAmounts === false ? '***' : sa.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{formatDisplayDate(sa.requestDate)}</TableCell>
                        <TableCell>
                          {sa.approvedByName ? (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              {sa.status === 'Approved'
                                ? <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                : <Clock className="h-3 w-3 text-amber-500" />}
                              {sa.approvedByName}
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </TableCell>
                        <TableCell>{getStatusBadge(sa.status)}</TableCell>
                        {priv.canDelete && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteAdvance(sa.id, sa.employeeName)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {salaryAdvances.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={priv.canDelete ? 6 : 5} className="text-center py-12 text-slate-400">No salary advances recorded.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>

            {/* Loans Table */}
            <Card className="shadow-md border-0 ring-1 ring-slate-100 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-emerald-500" /> Active Loans
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-4 h-12 text-xs uppercase tracking-wider">Employee</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Pay Start</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Approver</TableHead>
                      <TableHead className="h-12 text-xs uppercase tracking-wider">Status</TableHead>
                      {priv.canDelete && <TableHead className="h-12 w-16 text-xs uppercase tracking-wider text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map(ln => (
                      <TableRow key={ln.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium px-4">
                          <div className="flex flex-col">
                            <span className="text-slate-900">{ln.employeeName}</span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5 font-semibold">{ln.loanType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-slate-700">
                          ₦{(priv as any)?.canViewAmounts === false ? '***' : ln.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{formatDisplayDate(ln.paymentStartDate)}</TableCell>
                        <TableCell>
                          {ln.approvedByName ? (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              {ln.status === 'Approved' || ln.status === 'Active'
                                ? <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                : <Clock className="h-3 w-3 text-amber-500" />}
                              {ln.approvedByName}
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </TableCell>
                        <TableCell>{getStatusBadge(ln.status)}</TableCell>
                        {priv.canDelete && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteLoan(ln.id, ln.employeeName)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {loans.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={priv.canDelete ? 6 : 5} className="text-center py-12 text-slate-400">No loans recorded.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Import Modal Options */}
        {importFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
            <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">Import Policy</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                How would you like to process the record entries from this CSV file?
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => processImport(importFile, 'update')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3.5 flex-col items-center justify-center">
                  <span className="font-bold block text-base leading-none">Update & Add</span>
                  <span className="block text-[10px] opacity-70 mt-1.5 font-normal text-center">Matches IDs and adds new ones. Recommended.</span>
                </Button>
                <Button onClick={() => processImport(importFile, 'append')} variant="outline" className="border-slate-200 h-auto py-3.5 text-slate-700 hover:bg-slate-50 flex-col items-center justify-center">
                  <span className="font-bold block text-base leading-none">Append Only</span>
                  <span className="block text-[10px] text-slate-400 mt-1.5 font-normal text-center">Creates brand new records for every row.</span>
                </Button>
                <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 mt-2 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col md:flex-row">

        {/* Left Side: Gradient Banner */}
        <div className="md:w-[40%] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-6 md:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center p-3 font-bold bg-white/10 backdrop-blur-md rounded-2xl mb-8 border border-white/20">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">Finance Portal</h1>
            <p className="text-indigo-100 text-sm leading-relaxed mb-8 opacity-90">
              Submit requests for advances or loans. Requests go through a multi-stage approval process.
            </p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-[60%] p-6 md:p-8 lg:p-12 bg-slate-50/50">
          <div className="space-y-5">

            {/* Request Type */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" /> Request Type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow appearance-none cursor-pointer"
              >
                <option value="Salary Advance">Salary Advance</option>
                <option value="Personal Loan">Personal Loan</option>
                <option value="Emergency Loan">Emergency Loan</option>
                <option value="Housing Loan">Housing Loan</option>
              </select>
            </div>

            {/* Select Staff */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" /> Select Staff
              </label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow appearance-none cursor-pointer"
              >
                <option value="">Choose an employee...</option>
                {internalEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} — {emp.position}</option>
                ))}
              </select>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-slate-400" /> Amount (₦)
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="h-12 rounded-xl border-slate-200 font-medium text-lg focus:ring-indigo-500 bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-slate-400" /> Request Date
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 font-medium bg-white"
                />
              </div>
            </div>

            {/* Loan-specific fields */}
            {requestType !== 'Salary Advance' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-indigo-900">Duration (Months)</label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 6"
                    className="h-11 rounded-lg border-indigo-200 bg-white text-indigo-900 font-medium focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-indigo-900">Pay Start Date</label>
                  <Input
                    type="date"
                    value={payStartDate}
                    onChange={(e) => setPayStartDate(e.target.value)}
                    className="h-11 rounded-lg border-indigo-200 bg-white text-indigo-900 font-medium focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Send for Approval To */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" /> Send for Approval To
              </label>
              <select
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-indigo-200 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow appearance-none cursor-pointer"
              >
                <option value="">Select approver...</option>
                {approverOptions.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {approverId && (
                <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  A task will be sent to the approver for review before processing.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-4">
              <Button
                onClick={handleClear}
                variant="ghost"
                className="h-12 px-6 rounded-xl font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                Clear
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base transition-all hover:-translate-y-0.5"
              >
                Submit for Approval
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
