import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Download, FileSpreadsheet, FileText, PieChart, TrendingUp, Users, Building2, DollarSign } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';

export function Reports() {
  const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
  const sites = useAppStore((state) => state.sites);
  const invoices = useAppStore((state) => state.invoices);
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const inactiveEmployees = employees.filter(e => e.status !== 'Active').length;

  const totalSites = sites.length;
  const activeSites = sites.filter(s => s.status === 'Active').length;

  const calculateAnnualPayroll = () => {
    return employees.reduce((total, emp) => {
      const monthlyTotal = Object.values(emp.monthlySalaries).reduce((sum, val) => sum + val, 0);
      return total + monthlyTotal;
    }, 0);
  };
  const annualPayroll = calculateAnnualPayroll();

  const totalRevenue = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const showExportMessage = (message: string) => {
    setExportMessage(message);
    setTimeout(() => setExportMessage(null), 3000);
  };

  const exportHeadcountReport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee ID,Surname,Firstname,Department,Position,Status,Start Date\n";
    employees.forEach(emp => {
      csvContent += `${emp.id},${emp.surname},${emp.firstname},${emp.department},${emp.position},${emp.status},${emp.startDate}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "headcount_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showExportMessage("Headcount Report exported successfully!");
  };

  const exportPayrollReport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee ID,Name,Department,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Annual Total\n";
    employees.forEach(emp => {
      const salaries = Object.values(emp.monthlySalaries);
      const annual = salaries.reduce((a, b) => a + b, 0);
      csvContent += `${emp.id},${emp.surname} ${emp.firstname},${emp.department},${salaries.join(',')},${annual}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "payroll_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showExportMessage("Payroll Report exported successfully!");
  };

  const exportAttendanceReport = () => {
    if (attendanceRecords.length === 0) {
      toast.error('No attendance records found. Please add attendance data first.');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Staff Name,Position,Day Site,Night Site,Day,Night,Absent Status,OT,Present\n";
    attendanceRecords.forEach(rec => {
      csvContent += `${rec.date},${rec.staffName},${rec.position},${rec.daySite},${rec.nightSite},${rec.day},${rec.night},${rec.absentStatus},${rec.ot},${rec.isPresent}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showExportMessage("Attendance Report exported successfully!");
  };

  const generateReport = () => {
    if (selectedFields.length === 0) {
      toast.error('Please select at least one data point.');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += selectedFields.join(",") + "\n";

    employees.forEach(emp => {
      const row = selectedFields.map(field => {
        switch (field) {
          case 'Employee Details': return `${emp.surname} ${emp.firstname}`;
          case 'Salary Info': return Object.values(emp.monthlySalaries).reduce((a: number, b: number) => a + b, 0);
          case 'Bank Details': return `${emp.bankName} - ${emp.accountNo}`;
          case 'Emergency Contacts': return 'N/A';
          case 'Leave History': return emp.yearlyLeave;
          case 'Performance Ratings': return 'N/A';
          case 'Project Hours': return 'N/A';
          case 'Tax Information': return emp.payeTax ? 'PAYE' : 'None';
          default: return '';
        }
      });
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "custom_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showExportMessage("Custom Report generated successfully!");
  };

  return (
    <div className="flex flex-col gap-8">
      {exportMessage && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <Download className="h-4 w-4" />
          {exportMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 mt-2">Generate insights and export data for compliance and analysis.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Total Employees</CardTitle>
            <Users className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{totalEmployees}</div>
            <p className="text-sm text-slate-500 mt-1">{activeEmployees} Active, {inactiveEmployees} Inactive</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Active Sites</CardTitle>
            <Building2 className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{activeSites}</div>
            <p className="text-sm text-slate-500 mt-1">of {totalSites} total sites</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Annual Payroll</CardTitle>
            <DollarSign className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">₦{(annualPayroll / 1000000).toFixed(1)}M</div>
            <p className="text-sm text-slate-500 mt-1">Total yearly cost</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Total Revenue</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">₦{(totalRevenue / 1000000).toFixed(1)}M</div>
            <p className="text-sm text-slate-500 mt-1">From paid invoices</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Headcount & Turnover</CardTitle>
            <PieChart className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">Analyze employee demographics, growth, and retention rates.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportHeadcountReport}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => toast.info('PDF generation would require a server-side solution.')}>
                <FileText className="h-4 w-4 text-red-600" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Payroll Summary</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">Detailed breakdown of salaries, taxes, and deductions by department.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportPayrollReport}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => toast.info('PDF generation would require a server-side solution.')}>
                <FileText className="h-4 w-4 text-red-600" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Attendance & Leave</CardTitle>
            <PieChart className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">Track absenteeism, overtime hours, and leave balances.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportAttendanceReport}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => toast.info('PDF generation would require a server-side solution.')}>
                <FileText className="h-4 w-4 text-red-600" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle>Custom Report Builder</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Select data points to generate a custom Excel report.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Employee Details', 'Salary Info', 'Bank Details', 'Emergency Contacts', 'Leave History', 'Performance Ratings', 'Project Hours', 'Tax Information'].map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(item)}
                    onChange={() => toggleField(item)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                  />
                  {item}
                </label>
              ))}
            </div>
            <div className="pt-4 flex justify-end">
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={generateReport}>
                <Download className="h-4 w-4" /> Generate Custom Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

