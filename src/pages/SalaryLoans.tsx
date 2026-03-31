import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import {
  CheckCircle, ArrowLeft, List, Wallet, CalendarRange, Landmark,
  Banknote, User, CreditCard, Clock, XCircle, ShieldCheck
} from 'lucide-react';
import { useAppStore, SalaryAdvance, Loan } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { usePriv } from '@/src/hooks/usePriv';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';

export function SalaryLoans() {
  const priv = usePriv('payroll');
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

  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const departments = useAppStore((state) => state.departments);
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);

  // Compute internal employees only
  const internalEmployees = employees.filter(e => {
    const internalDeptNames = departments.filter(d => d.staffType === 'OFFICE').map(d => d.name);
    return e.position !== 'Adhoc Staff' && internalDeptNames.includes(e.department);
  });

  const addSalaryAdvance = useAppStore((state) => state.addSalaryAdvance);
  const addLoan = useAppStore((state) => state.addLoan);
  const updateSalaryAdvance = useAppStore((state) => state.updateSalaryAdvance);
  const updateLoan = useAppStore((state) => state.updateLoan);

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
            title: `Approve: ${empName} — ₦${Number(amount).toLocaleString()} Salary Advance`,
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
            title: `Approve: ${empName} — ₦${principal.toLocaleString()} ${requestType}`,
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

  useSetPageTitle(
    viewMode ? 'Financial Entries Database' : 'Financial Request',
    viewMode ? 'View all recorded salary advances and loans' : 'Submit salary advances or loans for approval',
    <Button 
      variant={viewMode ? "default" : "outline"}
      size="sm"
      className={viewMode ? "bg-indigo-600 hover:bg-indigo-700 h-9" : "border-slate-200 h-9"}
      onClick={() => setViewMode(!viewMode)}
    >
      {viewMode ? (
        <><ArrowLeft className="h-4 w-4 mr-2" /> Back to Form</>
      ) : (
        <><List className="h-4 w-4 mr-2" /> View Database</>
      )}
    </Button>
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
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-4 h-12 text-xs uppercase tracking-wider">Employee</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Amount</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Date</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Approver</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryAdvances.map(sa => (
                    <TableRow key={sa.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium px-4 text-slate-900">{sa.employeeName}</TableCell>
                      <TableCell className="font-mono font-medium text-slate-700">
                        ₦{(priv as any)?.canViewAmounts === false ? '***' : sa.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{sa.requestDate}</TableCell>
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
                    </TableRow>
                  ))}
                  {salaryAdvances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">No salary advances recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-4 h-12 text-xs uppercase tracking-wider">Employee</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Amount</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Pay Start</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Approver</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Status</TableHead>
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
                        ₦{(priv as any)?.canViewAmounts === false ? '***' : ln.principalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{ln.paymentStartDate}</TableCell>
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
                    </TableRow>
                  ))}
                  {loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">No loans recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col md:flex-row">

        {/* Left Side: Gradient Banner */}
        <div className="md:w-[40%] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-10 text-white flex flex-col justify-between relative overflow-hidden">
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
        <div className="md:w-[60%] p-8 lg:p-12 bg-slate-50/50">
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
                className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base shadow-lg shadow-indigo-200 transition-all hover:shadow-indigo-300 hover:-translate-y-0.5"
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
