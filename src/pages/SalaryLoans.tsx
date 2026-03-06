import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { CheckCircle, ArrowLeft, List, Wallet, CalendarRange, Landmark, Banknote, User, CreditCard } from 'lucide-react';
import { useAppStore, SalaryAdvance, Loan } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';

export function SalaryLoans() {
  const [requestType, setRequestType] = useState('Salary Advance');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [payStartDate, setPayStartDate] = useState('');

  const [viewMode, setViewMode] = useState(false);

  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);

  const addSalaryAdvance = useAppStore((state) => state.addSalaryAdvance);
  const addLoan = useAppStore((state) => state.addLoan);

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
        status: 'Approved' // Auto-approved upon entry
      };
      addSalaryAdvance(newAdvance);
      toast.success('Salary Advance Approved and Recorded');
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
        status: 'Active' // Auto-active upon entry
      };
      addLoan(newLoan);
      toast.success('Loan Approved and Recorded');
    }
    handleClear();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Active':
        return <Badge className="bg-emerald-100 text-emerald-800 border-0 flex items-center gap-1 w-max px-2.5 py-0.5 font-medium"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
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
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Entries Database</h2>
            <p className="text-slate-500 mt-1">View all recorded salary advances and loans</p>
          </div>
          <Button onClick={() => setViewMode(false)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl h-10 px-5">
            <ArrowLeft className="h-4 w-4" /> Back to Form
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    <TableHead className="px-6 h-12 text-xs uppercase tracking-wider">Employee</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Amount</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Date</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryAdvances.map(sa => (
                    <TableRow key={sa.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium px-6 text-slate-900">{sa.employeeName}</TableCell>
                      <TableCell className="font-mono font-medium text-slate-700">₦{sa.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{sa.requestDate}</TableCell>
                      <TableCell>{getStatusBadge(sa.status)}</TableCell>
                    </TableRow>
                  ))}
                  {salaryAdvances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-slate-400">No salary advances recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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
                    <TableHead className="px-6 h-12 text-xs uppercase tracking-wider">Employee</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Amount</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Pay Start Date</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Duration</TableHead>
                    <TableHead className="h-12 text-xs uppercase tracking-wider">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map(ln => (
                    <TableRow key={ln.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium px-6">
                        <div className="flex flex-col">
                          <span className="text-slate-900">{ln.employeeName}</span>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5 font-semibold">{ln.loanType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-slate-700">₦{ln.principalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{ln.paymentStartDate}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{ln.duration} mos</TableCell>
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
            <h1 className="text-3xl font-bold tracking-tight mb-3">Financial Request</h1>
            <p className="text-indigo-100 text-sm leading-relaxed mb-8 opacity-90">
              Seamlessly record salary advances or long-term loans. Submissions are instantly approved and scheduled for automated payroll deduction.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <Button
              onClick={() => setViewMode(true)}
              variant="outline"
              className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm gap-2 h-12 rounded-xl transition-all"
            >
              <List className="h-5 w-5" /> View Database
            </Button>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-[60%] p-8 lg:p-12 bg-slate-50/50">
          <div className="space-y-6">

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
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} — {emp.position}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
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

            {requestType !== 'Salary Advance' && (
              <div className="grid grid-cols-2 gap-6 p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
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

            <div className="pt-6 flex gap-4">
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
                Process Request
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
