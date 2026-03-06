import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useAppStore, SalaryAdvance, Loan } from '@/src/store/appStore';
import logoSrc from '../../logo/logo-1.png';
import { toast } from '@/src/components/ui/toast';

export function SalaryLoans() {
  const [requestType, setRequestType] = useState('Salary Advance');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [payStartDate, setPayStartDate] = useState('');

  const [viewMode, setViewMode] = useState(false);

  const employees = useAppStore((state) => state.employees);
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);

  const addSalaryAdvance = useAppStore((state) => state.addSalaryAdvance);
  const addLoan = useAppStore((state) => state.addLoan);

  const updateSalaryAdvance = useAppStore((state) => state.updateSalaryAdvance);
  const updateLoan = useAppStore((state) => state.updateLoan);

  const handleClear = () => {
    setRequestType('Salary Advance');
    setStaffId('');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setDuration('');
    setPayStartDate('');
  };

  const handleSubmit = () => {
    const emp = employees.find(e => e.id === staffId);
    if (!emp) {
      toast.error('Please select a staff member');
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (requestType === 'Salary Advance') {
      const newAdvance: SalaryAdvance = {
        id: `SA-${Date.now()}`,
        employeeId: staffId,
        employeeName: `${emp.surname} ${emp.firstname}`,
        amount: Number(amount),
        requestDate: date,
        status: 'Pending'
      };
      addSalaryAdvance(newAdvance);
      toast.success('Salary Advance Request Submitted Successfully');
    } else {
      if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
        toast.error('Please enter a valid duration in months for the loan');
        return;
      }
      if (!payStartDate) {
        toast.error('Please enter a Pay Start Date');
        return;
      }

      const principal = Number(amount);
      const mths = Number(duration);
      const monthlyDeduction = principal / mths;

      const newLoan: Loan = {
        id: `LN-${Date.now()}`,
        employeeId: staffId,
        employeeName: `${emp.surname} ${emp.firstname}`,
        loanType: requestType,
        principalAmount: principal,
        monthlyDeduction: monthlyDeduction,
        duration: mths,
        startDate: date,
        paymentStartDate: payStartDate,
        remainingBalance: principal,
        status: 'Pending'
      };
      addLoan(newLoan);
      toast.success('Loan Request Submitted Successfully');
    }
    handleClear();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Active':
        return <Badge variant="success" className="flex items-center gap-1 w-max"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
      case 'Rejected':
        return <Badge variant="destructive" className="flex items-center gap-1 w-max"><XCircle className="h-3 w-3" /> {status}</Badge>;
      case 'Pending':
        return <Badge variant="warning" className="flex items-center gap-1 w-max"> {status}</Badge>;
      case 'Deducted':
      case 'Completed':
        return <Badge className="bg-slate-500 w-max">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (viewMode) {
    return (
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Entries Database</h2>
          <Button onClick={() => setViewMode(false)} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Form
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Salary Advances</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryAdvances.map(sa => (
                    <TableRow key={sa.id}>
                      <TableCell className="font-medium">{sa.employeeName}</TableCell>
                      <TableCell>₦{sa.amount.toLocaleString()}</TableCell>
                      <TableCell>{sa.requestDate}</TableCell>
                      <TableCell>{getStatusBadge(sa.status)}</TableCell>
                      <TableCell className="text-right">
                        {sa.status === 'Pending' && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="text-emerald-600 h-8" onClick={() => updateSalaryAdvance(sa.id, { status: 'Approved' })}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-red-600 h-8" onClick={() => updateSalaryAdvance(sa.id, { status: 'Rejected' })}>Reject</Button>
                          </div>
                        )}
                        {sa.status === 'Approved' && (
                          <span className="text-[11px] text-slate-400 font-medium italic">Auto-deducted</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {salaryAdvances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">No salary advances requested.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map(ln => (
                    <TableRow key={ln.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{ln.employeeName}</span>
                          <span className="text-xs text-slate-500">{ln.loanType}</span>
                        </div>
                      </TableCell>
                      <TableCell>₦{ln.principalAmount.toLocaleString()}</TableCell>
                      <TableCell>{ln.duration} mos</TableCell>
                      <TableCell>{getStatusBadge(ln.status)}</TableCell>
                      <TableCell className="text-right">
                        {ln.status === 'Pending' && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="text-emerald-600 h-8" onClick={() => updateLoan(ln.id, { status: 'Active' })}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-red-600 h-8" onClick={() => updateLoan(ln.id, { status: 'Rejected' })}>Reject</Button>
                          </div>
                        )}
                        {ln.status === 'Active' && (
                          <span className="text-[11px] text-slate-400 font-medium italic">Auto-deducted</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">No loans requested.</TableCell>
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
    <div className="flex items-center justify-center min-h-[80vh] bg-slate-50/50 p-4">
      <div className="bg-white rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden w-full max-w-xl">
        <div className="p-8 pb-10">
          <div className="flex justify-center mb-6">
            <img src={logoSrc} alt="Dewatering Construction etc ltd" className="h-28 object-contain" />
          </div>

          <h1 className="text-center text-2xl font-black mb-8 uppercase tracking-wide">
            LOANS AND SALARY ADVANCE FORM
          </h1>

          <div className="space-y-5 px-4 md:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-32 font-bold text-sm shrink-0">Request Type:</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="flex-1 h-10 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-semibold"
              >
                <option value="Salary Advance">Salary Advance</option>
                <option value="Personal Loan">Personal Loan</option>
                <option value="Emergency Loan">Emergency Loan</option>
                <option value="Housing Loan">Housing Loan</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-32 font-bold text-sm shrink-0">Staff:</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="flex-1 h-10 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-semibold"
              >
                <option value="">Select Staff</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-32 font-bold text-sm shrink-0">Date:</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 font-semibold"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-32 font-bold text-sm shrink-0">Amount:</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="flex-1 font-semibold"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-32 font-bold text-sm shrink-0">Duration:</label>
              <div className="flex-1 flex items-center gap-3">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={requestType === 'Salary Advance'}
                  className="w-24 font-semibold"
                />
                <span className="font-bold text-sm">Months</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-32 font-bold text-sm shrink-0">Pay Start Date:</label>
              <Input
                type="date"
                value={payStartDate}
                onChange={(e) => setPayStartDate(e.target.value)}
                disabled={requestType === 'Salary Advance'}
                className="flex-1 font-semibold"
              />
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 flex justify-center gap-4">
          <Button
            onClick={handleClear}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 h-10 border-2 border-red-700 w-32"
          >
            Clear Form
          </Button>
          <Button
            onClick={() => setViewMode(true)}
            className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-6 h-10 border-2 border-slate-700 w-32"
          >
            View Entries
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#0078d4] hover:bg-[#0060a8] text-white font-bold px-6 h-10 border-2 border-[#005a9e] shadow-[0_2px_4px_rgba(0,120,212,0.4)] w-32"
          >
            Submit Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
