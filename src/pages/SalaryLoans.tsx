import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Plus, X, Save, DollarSign, CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAppStore, SalaryAdvance, Loan } from '@/src/store/appStore';

export function SalaryLoans() {
  const [activeTab, setActiveTab] = useState('advances');
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  
  const employees = useAppStore((state) => state.employees);
  const salaryAdvances = useAppStore((state) => state.salaryAdvances);
  const loans = useAppStore((state) => state.loans);
  const addSalaryAdvance = useAppStore((state) => state.addSalaryAdvance);
  const updateSalaryAdvance = useAppStore((state) => state.updateSalaryAdvance);
  const addLoan = useAppStore((state) => state.addLoan);
  const updateLoan = useAppStore((state) => state.updateLoan);

  const [advanceForm, setAdvanceForm] = useState({
    employeeId: '',
    amount: 0,
    requestDate: ''
  });

  const [loanForm, setLoanForm] = useState({
    employeeId: '',
    loanType: 'Personal Loan',
    principalAmount: 0,
    duration: 12,
    paymentStartDate: ''
  });

  const handleSubmitAdvance = () => {
    const emp = employees.find(e => e.id === advanceForm.employeeId);
    if (!emp || !advanceForm.amount || !advanceForm.requestDate) {
      alert("Please select an employee, enter amount and date");
      return;
    }

    const newAdvance: SalaryAdvance = {
      id: `SA-${Date.now()}`,
      employeeId: advanceForm.employeeId,
      employeeName: `${emp.surname} ${emp.firstname}`,
      amount: advanceForm.amount,
      requestDate: advanceForm.requestDate,
      status: 'Pending'
    };

    addSalaryAdvance(newAdvance);
    setShowAdvanceForm(false);
    setAdvanceForm({ employeeId: '', amount: 0, requestDate: '' });
  };

  const handleSubmitLoan = () => {
    const emp = employees.find(e => e.id === loanForm.employeeId);
    if (!emp || !loanForm.principalAmount || !loanForm.paymentStartDate) {
      alert("Please select an employee, enter amount, duration and payment start date");
      return;
    }

    const monthlyDeduction = loanForm.principalAmount / loanForm.duration;

    const newLoan: Loan = {
      id: `LN-${Date.now()}`,
      employeeId: loanForm.employeeId,
      employeeName: `${emp.surname} ${emp.firstname}`,
      loanType: loanForm.loanType,
      principalAmount: loanForm.principalAmount,
      monthlyDeduction: monthlyDeduction,
      duration: loanForm.duration,
      startDate: new Date().toISOString().split('T')[0],
      paymentStartDate: loanForm.paymentStartDate,
      remainingBalance: loanForm.principalAmount,
      status: 'Pending'
    };

    addLoan(newLoan);
    setShowLoanForm(false);
    setLoanForm({
      employeeId: '',
      loanType: 'Personal Loan',
      principalAmount: 0,
      duration: 12,
      paymentStartDate: ''
    });
  };

  const handleApproveAdvance = (id: string) => {
    updateSalaryAdvance(id, { status: 'Approved' });
  };

  const handleRejectAdvance = (id: string) => {
    updateSalaryAdvance(id, { status: 'Rejected' });
  };

  const handleApproveLoan = (id: string) => {
    updateLoan(id, { status: 'Active' });
  };

  const handleRejectLoan = (id: string) => {
    updateLoan(id, { status: 'Rejected' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Active':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
      case 'Rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> {status}</Badge>;
      case 'Pending':
        return <Badge variant="warning" className="flex items-center gap-1"><Clock className="h-3 w-3" /> {status}</Badge>;
      case 'Deducted':
        return <Badge className="bg-slate-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
      case 'Completed':
        return <Badge variant="outline" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Salary Advances & Loans</h1>
          <p className="text-slate-500 mt-2">Manage employee salary advances and loan requests.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="advances">Salary Advances</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
        </TabsList>

        {/* Salary Advances Tab */}
        <TabsContent value="advances" className="space-y-6">
          <div className="flex justify-end">
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAdvanceForm(true)}>
              <Plus className="h-4 w-4" /> Request Advance
            </Button>
          </div>

          {showAdvanceForm && (
            <Card className="border-t-4 border-t-indigo-600 shadow-md">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4 flex flex-row justify-between items-center">
                <CardTitle className="text-indigo-900 text-xl">New Salary Advance Request</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowAdvanceForm(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Employee</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={advanceForm.employeeId}
                      onChange={(e) => setAdvanceForm({...advanceForm, employeeId: e.target.value})}
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Amount (₦)</label>
                    <Input 
                      type="number"
                      placeholder="e.g. 100000"
                      value={advanceForm.amount || ''}
                      onChange={(e) => setAdvanceForm({...advanceForm, amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Request Date</label>
                    <Input 
                      type="date"
                      value={advanceForm.requestDate}
                      onChange={(e) => setAdvanceForm({...advanceForm, requestDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <Button variant="outline" onClick={() => setShowAdvanceForm(false)}>Cancel</Button>
                  <Button onClick={handleSubmitAdvance} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Save className="h-4 w-4" /> Submit Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Requests</CardTitle>
                <DollarSign className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{salaryAdvances.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {salaryAdvances.filter(a => a.status === 'Pending').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {salaryAdvances.filter(a => a.status === 'Approved' || a.status === 'Deducted').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Value</CardTitle>
                <CreditCard className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ₦{salaryAdvances.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle>Salary Advance Requests</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryAdvances.map((advance) => (
                    <TableRow key={advance.id}>
                      <TableCell className="font-medium">{advance.employeeName}</TableCell>
                      <TableCell className="font-mono">₦{advance.amount.toLocaleString()}</TableCell>
                      <TableCell>{advance.requestDate}</TableCell>
                      <TableCell>{getStatusBadge(advance.status)}</TableCell>
                      <TableCell className="text-right">
                        {advance.status === 'Pending' && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-emerald-600"
                              onClick={() => handleApproveAdvance(advance.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => handleRejectAdvance(advance.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {advance.status === 'Approved' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-indigo-600"
                            onClick={() => updateSalaryAdvance(advance.id, { status: 'Deducted' })}
                          >
                            Mark as Deducted
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loans Tab */}
        <TabsContent value="loans" className="space-y-6">
          <div className="flex justify-end">
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowLoanForm(true)}>
              <Plus className="h-4 w-4" /> Request Loan
            </Button>
          </div>

          {showLoanForm && (
            <Card className="border-t-4 border-t-indigo-600 shadow-md">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4 flex flex-row justify-between items-center">
                <CardTitle className="text-indigo-900 text-xl">New Loan Request</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowLoanForm(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Employee</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={loanForm.employeeId}
                      onChange={(e) => setLoanForm({...loanForm, employeeId: e.target.value})}
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Loan Type</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={loanForm.loanType}
                      onChange={(e) => setLoanForm({...loanForm, loanType: e.target.value})}
                    >
                      <option value="Personal Loan">Personal Loan</option>
                      <option value="Emergency Loan">Emergency Loan</option>
                      <option value="Housing Loan">Housing Loan</option>
                      <option value="Car Loan">Car Loan</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Principal Amount (₦)</label>
                    <Input 
                      type="number"
                      placeholder="e.g. 500000"
                      value={loanForm.principalAmount || ''}
                      onChange={(e) => setLoanForm({...loanForm, principalAmount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Duration (Months)</label>
                    <Input 
                      type="number"
                      placeholder="e.g. 12"
                      value={loanForm.duration || ''}
                      onChange={(e) => setLoanForm({...loanForm, duration: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Payment Start Date</label>
                    <Input 
                      type="date"
                      value={loanForm.paymentStartDate}
                      onChange={(e) => setLoanForm({...loanForm, paymentStartDate: e.target.value})}
                    />
                  </div>
                  {loanForm.principalAmount > 0 && loanForm.duration > 0 && (
                    <div className="md:col-span-2 p-4 bg-indigo-50 rounded-lg">
                      <p className="text-sm text-indigo-700">
                        <strong>Monthly Deduction:</strong> ₦{(loanForm.principalAmount / loanForm.duration).toLocaleString()} 
                        <span className="text-xs ml-2">({loanForm.duration} months)</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <Button variant="outline" onClick={() => setShowLoanForm(false)}>Cancel</Button>
                  <Button onClick={handleSubmitLoan} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Save className="h-4 w-4" /> Submit Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Loans</CardTitle>
                <DollarSign className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{loans.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {loans.filter(l => l.status === 'Pending').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Active</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {loans.filter(l => l.status === 'Active').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Outstanding</CardTitle>
                <CreditCard className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  ₦{loans.reduce((sum, l) => sum + l.remainingBalance, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle>Loan Requests</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Loan Type</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Monthly Ded.</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.employeeName}</TableCell>
                      <TableCell>{loan.loanType}</TableCell>
                      <TableCell className="font-mono">₦{loan.principalAmount.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">₦{loan.monthlyDeduction.toLocaleString()}</TableCell>
                      <TableCell>{loan.duration} months</TableCell>
                      <TableCell className="font-mono">₦{loan.remainingBalance.toLocaleString()}</TableCell>
                      <TableCell>{loan.paymentStartDate}</TableCell>
                      <TableCell>{getStatusBadge(loan.status)}</TableCell>
                      <TableCell className="text-right">
                        {loan.status === 'Pending' && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-emerald-600"
                              onClick={() => handleApproveLoan(loan.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => handleRejectLoan(loan.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

