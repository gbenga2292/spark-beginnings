import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Download, FileSpreadsheet, FileText, PieChart as PieChartIcon, TrendingUp, Users, Building2, DollarSign, Activity, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getBase64ImageFromUrl = async (imageUrl: string) => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

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

  const departmentData = useMemo(() => {
    const deps: Record<string, number> = {};
    employees.forEach(e => {
      if (e.status === 'Active') {
        const dep = e.department || 'Unassigned';
        deps[dep] = (deps[dep] || 0) + 1;
      }
    });
    return Object.entries(deps)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  const headcountStatusData = useMemo(() => [
    { name: 'Active', value: activeEmployees, color: '#10b981' },
    { name: 'Inactive', value: inactiveEmployees, color: '#f43f5e' }
  ], [activeEmployees, inactiveEmployees]);

  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const siteFinancialData = useMemo(() => {
    const siteMap: Record<string, { paid: number, pending: number }> = {};
    sites.forEach(s => {
      siteMap[s.name] = { paid: 0, pending: 0 };
    });

    invoices.forEach(inv => {
      if (siteMap[inv.siteName]) {
        if (inv.status === 'Paid') {
          siteMap[inv.siteName].paid += inv.amount;
        } else {
          siteMap[inv.siteName].pending += inv.amount;
        }
      }
    });

    return Object.entries(siteMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending));
  }, [sites, invoices]);

  const showExportMessage = (message: string) => {
    setExportMessage(message);
    setTimeout(() => setExportMessage(null), 3000);
  };

  const generatePdf = async (title: string, head: string[][], body: (string | number)[][], filename: string) => {
    try {
      const doc = new jsPDF();

      const logoBase64 = await getBase64ImageFromUrl('/logo/logo-2.png');
      doc.addImage(logoBase64, 'PNG', 14, 10, 35, 12);

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(title, 14, 34);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);

      autoTable(doc, {
        startY: 46,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 8, cellPadding: 3 },
      });

      doc.save(filename);
      showExportMessage(`${title} PDF exported successfully!`);
    } catch (error) {
      console.error('Error generating PDF', error);
      toast.error('Failed to generate PDF. check console for details.');
    }
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

  const exportHeadcountPdf = () => {
    const head = [["Employee ID", "Surname", "Firstname", "Department", "Position", "Status", "Start Date"]];
    const body = employees.map(emp => [emp.id, emp.surname, emp.firstname, emp.department, emp.position, emp.status, emp.startDate]);
    generatePdf("Headcount Report", head, body, "headcount_report.pdf");
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

  const exportPayrollPdf = () => {
    const head = [["Employee ID", "Name", "Department", "Annual Total (₦)"]];
    const body = employees.map(emp => {
      const salaries = Object.values(emp.monthlySalaries);
      const annual = salaries.reduce((a, b) => a + b, 0);
      return [emp.id, `${emp.surname} ${emp.firstname}`, emp.department, annual.toLocaleString()];
    });
    generatePdf("Payroll Summary", head, body, "payroll_report.pdf");
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

  const exportAttendancePdf = () => {
    if (attendanceRecords.length === 0) {
      toast.error('No attendance records found.');
      return;
    }
    const head = [["Date", "Staff Name", "Day Site", "Night Site", "Present", "OT"]];
    const body = attendanceRecords.slice(0, 100).map(rec => [rec.date, rec.staffName, rec.daySite, rec.nightSite, rec.isPresent, rec.ot]);
    // Limited to 100 on PDF for performance & readability on demo
    generatePdf("Attendance Report (Recent)", head, body, "attendance_report.pdf");
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
    <div className="flex flex-col gap-8 pb-10">
      {exportMessage && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5" />
          {exportMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Generate insights, visualize trends, and export data for compliance.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Total Employees</CardTitle>
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalEmployees}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{activeEmployees} Active, {inactiveEmployees} Inactive</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Active Sites</CardTitle>
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{activeSites}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">of {totalSites} total sites</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Annual Payroll</CardTitle>
            <DollarSign className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">₦{(annualPayroll / 1000000).toFixed(1)}M</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total yearly cost limit</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Total Revenue</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">₦{(totalRevenue / 1000000).toFixed(1)}M</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">From processed invoices</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Active Employees by Department
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Employees" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Financial Overview By Site
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siteFinancialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000000 ? `₦${(value / 1000000).toFixed(1)}M` : `₦${(value / 1000).toFixed(0)}k`} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number | undefined) => `₦${(value ?? 0).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} />
                  <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid Invoice" />
                  <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending Invoice" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <PieChartIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Headcount Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex justify-center items-center">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={headcountStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {headcountStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Headcount & Turnover</CardTitle>
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10">Analyze employee demographics, growth, and retention rates.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50" onClick={exportHeadcountReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50" onClick={exportHeadcountPdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Payroll Summary</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10">Detailed breakdown of salaries, taxes, and deductions.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50" onClick={exportPayrollReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50" onClick={exportPayrollPdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Attendance & Leave</CardTitle>
            <TrendingUp className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10">Track absenteeism, overtime hours, and leave balances.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50" onClick={exportAttendanceReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50" onClick={exportAttendancePdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-6">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
          <CardTitle className="text-slate-900 dark:text-white">Custom Report Builder</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Select data points to generate a custom Excel report tailored to your needs.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg border border-slate-100 dark:border-slate-800">
              {['Employee Details', 'Salary Info', 'Bank Details', 'Emergency Contacts', 'Leave History', 'Performance Ratings', 'Project Hours', 'Tax Information'].map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(item)}
                    onChange={() => toggleField(item)}
                    className="rounded border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 text-indigo-600 focus:ring-indigo-600 h-4 w-4 transition-all"
                  />
                  {item}
                </label>
              ))}
            </div>
            <div className="pt-4 flex justify-end">
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={generateReport}>
                <Download className="h-4 w-4" /> Generate Custom Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


