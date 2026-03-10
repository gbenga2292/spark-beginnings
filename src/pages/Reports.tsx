import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Download, FileSpreadsheet, FileText, PieChart as PieChartIcon, Users, Building2, Activity, CheckCircle2, CalendarClock } from 'lucide-react';
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
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Filter state for Operations Staff Site Work Report
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = [currentYear, currentYear - 1, currentYear - 2];

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const inactiveEmployees = employees.filter(e => e.status !== 'Active').length;
  const totalSites = sites.length;
  const activeSites = sites.filter(s => s.status === 'Active').length;

  const departmentData = useMemo(() => {
    const deps: Record<string, number> = {};
    employees.forEach(e => {
      if (e.status === 'Active') {
        const dep = e.department || 'Unassigned';
        deps[dep] = (deps[dep] || 0) + 1;
      }
    });
    return Object.entries(deps).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [employees]);

  const headcountStatusData = useMemo(() => [
    { name: 'Active', value: activeEmployees, color: '#10b981' },
    { name: 'Inactive', value: inactiveEmployees, color: '#f43f5e' }
  ], [activeEmployees, inactiveEmployees]);

  // Filter operations staff
  const operationsStaff = employees.filter(emp => emp.department === 'OPERATIONS');

  // Calculate site work data for operations staff
  const operationsStaffSiteData = useMemo(() => {
    const filteredRecords = attendanceRecords.filter(rec => {
      const recDate = new Date(rec.date);
      return recDate.getMonth() + 1 === selectedMonth && recDate.getFullYear() === selectedYear;
    });

    const siteCounts: Record<string, Record<string, number>> = {};

    operationsStaff.forEach(emp => {
      siteCounts[emp.id] = {};
      sites.forEach(site => {
        siteCounts[emp.id][site.name] = 0;
      });
    });

    filteredRecords.forEach(rec => {
      const empId = rec.staffId;
      if (siteCounts[empId]) {
        // Count day site
        if (rec.daySite && rec.day === 'Yes') {
          siteCounts[empId][rec.daySite] = (siteCounts[empId][rec.daySite] || 0) + 1;
        }
        // Count night site
        if (rec.nightSite && rec.night === 'Yes') {
          siteCounts[empId][rec.nightSite] = (siteCounts[empId][rec.nightSite] || 0) + 1;
        }
      }
    });

    return { siteCounts, totalRecords: filteredRecords.length };
  }, [attendanceRecords, selectedMonth, selectedYear, operationsStaff, sites]);

  const toggleField = (field: string) => {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };

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
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, 34);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);
      autoTable(doc, { startY: 46, head, body, theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, cellPadding: 3 } });
      doc.save(filename);
      showExportMessage(`${title} PDF exported successfully!`);
    } catch (error) {
      console.error('Error generating PDF', error);
      toast.error('Failed to generate PDF.');
    }
  };

  const exportHeadcountReport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee ID,Surname,Firstname,Department,Position,Status,Start Date\n";
    employees.forEach(emp => {
      csvContent += `${emp.id},${emp.surname},${emp.firstname},${emp.department},${emp.position},${emp.status},${emp.startDate}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "headcount_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showExportMessage("Headcount Report exported!");
  };

  const exportHeadcountPdf = () => {
    const head = [["Employee ID", "Surname", "Firstname", "Department", "Position", "Status", "Start Date"]];
    const body = employees.map(emp => [emp.id, emp.surname, emp.firstname, emp.department, emp.position, emp.status, emp.startDate]);
    generatePdf("Headcount Report", head, body, "headcount_report.pdf");
  };

  const exportAttendanceReport = () => {
    if (attendanceRecords.length === 0) { toast.error('No attendance records found.'); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Staff Name,Position,Day Site,Night Site,Day,Night,Absent Status,OT,Present\n";
    attendanceRecords.forEach(rec => {
      csvContent += `${rec.date},${rec.staffName},${rec.position},${rec.daySite},${rec.nightSite},${rec.day},${rec.night},${rec.absentStatus},${rec.ot},${rec.isPresent}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "attendance_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showExportMessage("Attendance Report exported!");
  };

  const exportAttendancePdf = () => {
    if (attendanceRecords.length === 0) { toast.error('No attendance records found.'); return; }
    const head = [["Date", "Staff Name", "Day Site", "Night Site", "Present", "OT"]];
    const body = attendanceRecords.slice(0, 100).map(rec => [rec.date, rec.staffName, rec.daySite, rec.nightSite, rec.isPresent, rec.ot]);
    generatePdf("Attendance Report (Recent)", head, body, "attendance_report.pdf");
  };

  const generateReport = () => {
    if (selectedFields.length === 0) { toast.error('Please select at least one data point.'); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += selectedFields.join(",") + "\n";
    employees.forEach(emp => {
      const row = selectedFields.map(field => {
        switch (field) {
          case 'Employee Details': return `${emp.surname} ${emp.firstname}`;
          case 'Department & Position': return `${emp.department} - ${emp.position}`;
          case 'Bank Details': return `${emp.bankName} - ${emp.accountNo}`;
          case 'Emergency Contacts': return 'N/A';
          case 'Leave History': return emp.yearlyLeave;
          case 'Start Date': return emp.startDate;
          case 'Status': return emp.status;
          case 'Tax Information': return emp.payeTax ? 'PAYE' : 'None';
          default: return '';
        }
      });
      csvContent += row.join(",") + "\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "custom_employee_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showExportMessage("Custom Employee Report generated!");
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {exportMessage && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5" />{exportMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
            Employee Reports & Analytics
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Workforce insights, attendance trends, and HR compliance reports.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Total Employees</CardTitle>
            <Users className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{totalEmployees}</div>
            <p className="text-sm text-slate-500 mt-1">{activeEmployees} Active, {inactiveEmployees} Inactive</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Active Sites</CardTitle>
            <Building2 className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{activeSites}</div>
            <p className="text-sm text-slate-500 mt-1">of {totalSites} total sites</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Attendance Records</CardTitle>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{attendanceRecords.length}</div>
            <p className="text-sm text-slate-500 mt-1">Total daily register entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <Activity className="h-5 w-5 text-indigo-600" /> Employees by Department
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

        <Card className="shadow-sm bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <PieChartIcon className="h-5 w-5 text-emerald-600" /> Headcount Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex justify-center items-center">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={headcountStatusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                    {headcountStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Export Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Headcount & Turnover</CardTitle>
            <Users className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Employee demographics, growth, and retention rates.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportHeadcountReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportHeadcountPdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Attendance & Leave</CardTitle>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Track absenteeism, overtime hours, and leave balances.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportAttendanceReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportAttendancePdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations Staff Site Work Report */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Operations Staff Site Work Report
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="ml-auto text-sm text-slate-500">
              {operationsStaffSiteData.totalRecords} attendance records for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </div>
          </div>

          {/* Operations Staff Site Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-left font-semibold text-slate-900">Employee</TableHead>
                  {sites.filter(s => s.status === 'Active').map(site => (
                    <TableHead key={site.id} className="text-center font-semibold text-slate-900">{site.name}</TableHead>
                  ))}
                  <TableHead className="text-center font-semibold text-slate-900 bg-slate-100">Total Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operationsStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={sites.filter(s => s.status === 'Active').length + 2} className="text-center py-8 text-slate-500">
                      No operations staff found.
                    </TableCell>
                  </TableRow>
                ) : (
                  operationsStaff.map(emp => {
                    const empSiteCounts = operationsStaffSiteData.siteCounts[emp.id] || {};
                    const totalDays = Object.values(empSiteCounts).reduce((sum: number, count) => sum + (count as number), 0);
                    
                    return (
                      <TableRow key={emp.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-800">
                          {emp.surname} {emp.firstname}
                          <div className="text-xs text-slate-500">{emp.position}</div>
                        </TableCell>
                        {sites.filter(s => s.status === 'Active').map(site => {
                          const days = empSiteCounts[site.name] || 0;
                          return (
                            <TableCell key={site.id} className={`text-center py-3 ${days > 0 ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-400'}`}>
                              {days > 0 ? days : '—'}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-semibold bg-slate-50 text-slate-800">
                          {totalDays}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Custom Employee Report Builder */}
      <Card className="bg-white border-slate-200 mb-6">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-slate-900">Custom Employee Report Builder</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Select employee data points to generate a custom report.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-lg border border-slate-100">
              {['Employee Details', 'Department & Position', 'Bank Details', 'Emergency Contacts', 'Leave History', 'Start Date', 'Status', 'Tax Information'].map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={selectedFields.includes(item)} onChange={() => toggleField(item)}
                    className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-600 h-4 w-4 transition-all" />
                  {item}
                </label>
              ))}
            </div>
            <div className="pt-4 flex justify-end">
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={generateReport}>
                <Download className="h-4 w-4" /> Generate Employee Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
