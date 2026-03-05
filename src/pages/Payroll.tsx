import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Download, FileText, Calculator, CreditCard, ChevronDown, X, Printer } from 'lucide-react';
import { useAppStore, Employee } from '@/src/store/appStore';

interface PayrollRecord {
  id: string;
  name: string;
  position: string;
  department: string;
  bankName: string;
  accountNo: string;
  basic: number;
  allowances: number;
  deductions: number;
  taxDeduction: number;
  net: number;
  status: 'Pending' | 'Processed';
}

export function Payroll() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollRecord | null>(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const employees = useAppStore((state) => state.employees);
  const [selectedMonth, setSelectedMonth] = useState('jan');

  const months = [
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

  // Calculate payroll from real employee data
  const payrollData = useMemo(() => {
    const monthKey = selectedMonth as keyof typeof employees[0]['monthlySalaries'];
    return employees
      .filter(e => e.status === 'Active')
      .map((emp) => {
        const basic = emp.monthlySalaries[monthKey] || 0;
        const taxDeduction = emp.payeTax ? basic * 0.1 : 0; // 10% PAYE tax
        const net = basic - taxDeduction;
        return {
          id: emp.id,
          name: `${emp.surname} ${emp.firstname}`,
          position: emp.position,
          department: emp.department,
          bankName: emp.bankName,
          accountNo: emp.accountNo,
          basic,
          allowances: 0,
          deductions: taxDeduction,
          taxDeduction,
          net,
          status: 'Pending' as const,
        };
      });
  }, [employees, selectedMonth]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalBasic = payrollData.reduce((sum, p) => sum + p.basic, 0);
    const totalDeductions = payrollData.reduce((sum, p) => sum + p.deductions, 0);
    const totalNet = payrollData.reduce((sum, p) => sum + p.net, 0);
    return { totalBasic, totalDeductions, totalNet, employeeCount: payrollData.length };
  }, [payrollData]);

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const handleViewPayslip = (record: PayrollRecord) => {
    setSelectedEmployee(record);
    setShowPayslip(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!selectedEmployee) return;
    
    const content = `
PAYSTUB FOR ${selectedEmployee.name.toUpperCase()}
==============================================
Period: ${months.find(m => m.key === selectedMonth)?.label}
Employee ID: ${selectedEmployee.id}
Position: ${selectedEmployee.position}
Department: ${selectedEmployee.department}
Bank: ${selectedEmployee.bankName}
Account: ${selectedEmployee.accountNo}

EARNINGS:
Basic Salary: ₦${selectedEmployee.basic.toLocaleString()}
Allowances:   ₦${selectedEmployee.allowances.toLocaleString()}
-----------------------------------
Gross Pay:    ₦${(selectedEmployee.basic + selectedEmployee.allowances).toLocaleString()}

DEDUCTIONS:
PAYE Tax:     ₦${selectedEmployee.taxDeduction.toLocaleString()}
-----------------------------------
Total Deduct: ₦${selectedEmployee.deductions.toLocaleString()}

NET PAY:      ₦${selectedEmployee.net.toLocaleString()}
==============================================
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip_${selectedEmployee.name.replace(/\s+/g, '_')}_${selectedMonth}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedMonthLabel = months.find(m => m.key === selectedMonth)?.label || selectedMonth;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payroll Processing</h1>
          <p className="text-slate-500 mt-2">Manage salaries, taxes, and generate payslips.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
          <Button 
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={handleProcess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </span>
            ) : (
              <><Calculator className="h-4 w-4" /> Run Payroll</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <label className="text-sm font-medium text-slate-700">Select Month:</label>
        <select 
          className="flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {months.map(month => (
            <option key={month.key} value={month.key}>{month.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Payroll</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₦{totals.totalBasic.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Basic Salary</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Deductions</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₦{totals.totalDeductions.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Taxes (PAYE)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Employees on List</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totals.employeeCount}</div>
            <p className="text-xs text-slate-500 mt-1">Active employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Net Payroll</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₦{totals.totalNet.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">After deductions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
          <CardTitle>Current Pay Period: {selectedMonthLabel}</CardTitle>
          <Button variant="outline" size="sm" className="gap-2">
            Filter <ChevronDown className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{record.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{record.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-slate-600">₦{record.basic.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-emerald-600">+₦{record.allowances.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-red-600">-₦{record.deductions.toLocaleString()}</TableCell>
                  <TableCell className="font-mono font-bold text-slate-900">₦{record.net.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={(record.status as string) === 'Processed' ? 'success' : 'warning'}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-indigo-600 gap-1"
                      onClick={() => handleViewPayslip(record)}
                    >
                      <FileText className="h-4 w-4" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payslip Modal */}
      {showPayslip && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Floating Action Buttons */}
            <div className="sticky top-0 bg-indigo-600 p-4 flex justify-between items-center rounded-t-lg">
              <h3 className="text-white font-bold text-lg">Employee Payslip</h3>
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="gap-1"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" /> Print
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="gap-1"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-indigo-700"
                  onClick={() => setShowPayslip(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Payslip Content - A4 Style */}
            <div className="p-8 bg-white" id="payslip-content">
              {/* Company Header */}
              <div className="border-b-2 border-indigo-600 pb-4 mb-6">
                <h1 className="text-2xl font-bold text-indigo-900">DCEL HR</h1>
                <p className="text-sm text-slate-500">Employee Payslip</p>
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Employee Details</h3>
                  <table className="w-full text-sm">
                    <tr>
                      <td className="py-1 text-slate-600">Name:</td>
                      <td className="py-1 font-medium">{selectedEmployee.name}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">Employee ID:</td>
                      <td className="py-1 font-mono">{selectedEmployee.id}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">Position:</td>
                      <td className="py-1">{selectedEmployee.position}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">Department:</td>
                      <td className="py-1">{selectedEmployee.department}</td>
                    </tr>
                  </table>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Payment Details</h3>
                  <table className="w-full text-sm">
                    <tr>
                      <td className="py-1 text-slate-600">Pay Period:</td>
                      <td className="py-1 font-medium">{selectedMonthLabel}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">Bank:</td>
                      <td className="py-1">{selectedEmployee.bankName}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">Account No:</td>
                      <td className="py-1 font-mono">{selectedEmployee.accountNo}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">Status:</td>
                      <td className="py-1">
                        <Badge variant="success">{selectedEmployee.status}</Badge>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>

              {/* Earnings Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2 border-b pb-1">Earnings</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 text-slate-600">Description</th>
                      <th className="py-2 text-right text-slate-600">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2">Basic Salary</td>
                      <td className="py-2 text-right font-mono">{selectedEmployee.basic.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Allowances</td>
                      <td className="py-2 text-right font-mono text-emerald-600">+{selectedEmployee.allowances.toLocaleString()}</td>
                    </tr>
                    <tr className="border-t font-semibold">
                      <td className="py-2">Gross Pay</td>
                      <td className="py-2 text-right font-mono">{(selectedEmployee.basic + selectedEmployee.allowances).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2 border-b pb-1">Deductions</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 text-slate-600">Description</th>
                      <th className="py-2 text-right text-slate-600">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2">PAYE Tax</td>
                      <td className="py-2 text-right font-mono text-red-600">-{selectedEmployee.taxDeduction.toLocaleString()}</td>
                    </tr>
                    <tr className="border-t font-semibold">
                      <td className="py-2">Total Deductions</td>
                      <td className="py-2 text-right font-mono text-red-600">-{selectedEmployee.deductions.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Pay */}
              <div className="bg-indigo-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-indigo-900">NET PAY</span>
                  <span className="text-2xl font-bold text-indigo-900">₦{selectedEmployee.net.toLocaleString()}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t text-center text-xs text-slate-400">
                <p>This is a computer-generated document. No signature required.</p>
                <p>Generated on {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

