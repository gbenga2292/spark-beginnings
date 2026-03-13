import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Download, Lock } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export function SiteSummary() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const monthValues = useAppStore(s => s.monthValues);
  const attendanceRecords = useAppStore(s => s.attendanceRecords);
  const employees = useAppStore(s => s.employees);
  const sites = useAppStore(s => s.sites);

  const priv = usePriv('sites');

  if (!priv.canViewClientSummary) {
    return (
      <div className="flex h-full items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-slate-100">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
            <Lock className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-sm text-slate-500">You do not have permission to view the site summary. Please contact an administrator to request access.</p>
          </div>
        </div>
      </div>
    );
  }

  const monthsMap = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const currentMonthKey = monthsMap[selectedMonth - 1];
  const { workDays, overtimeRate } = monthValues[currentMonthKey];

  const results: { name: string; client: string; cost: number; teamSize: number }[] = [];
  let grandTotal = 0;

  if (workDays > 0) {
    const salaryDict: Record<string, number> = {};
    employees.forEach(emp => {
      salaryDict[emp.id] = emp.monthlySalaries[currentMonthKey] || 0;
    });

    const monthRecords = attendanceRecords.filter(r => r.mth === selectedMonth);

    sites.forEach(site => {
      const siteName = site.name.toLowerCase().trim();
      const staffDays: Record<string, number> = {};

      monthRecords.forEach(r => {
        let matched = false;
        let increment = 0;

        if (r.daySite && r.daySite.toLowerCase().trim() === siteName) {
          matched = true;
          increment = 1;
        } else if (r.nightSite && r.nightSite.toLowerCase().trim() === siteName) {
          matched = true;
          increment = 1;
        } else if (r.otSite && r.otSite.toLowerCase().trim() === siteName) {
          matched = true;
          increment = overtimeRate;
        }

        if (matched) {
          staffDays[r.staffId] = (staffDays[r.staffId] || 0) + increment;
        }
      });

      let siteTotalCost = 0;
      Object.keys(staffDays).forEach(staffId => {
        const salary = salaryDict[staffId] || 0;
        const days = staffDays[staffId];
        if (salary > 0) {
          siteTotalCost += (salary / workDays) * days;
        }
      });

      if (siteTotalCost > 0) {
        results.push({
          name: site.name,
          client: site.client,
          cost: siteTotalCost,
          teamSize: Object.keys(staffDays).length
        });
        grandTotal += siteTotalCost;
      }
    });
  }

  results.sort((a, b) => b.cost - a.cost);

  const handleExportSummaryCSV = () => {
    if (results.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(results.map((r, i) => ({
      "S/N": i + 1,
      "Client": r.client,
      "Site": r.name,
      "Total Cost (₦)": r.cost.toFixed(2)
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Site Summary");
    XLSX.writeFile(wb, `Site_Summary_${monthNames[selectedMonth - 1]}_${format(new Date(), 'yyyy')}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="h-9 px-3 border border-slate-200 rounded-md bg-white text-sm font-medium"
            >
              {monthNames.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <div className="text-sm text-slate-500">
              Work Days: <span className="font-semibold text-slate-700">{workDays}</span> |
              Overtime Rate: <span className="font-semibold text-slate-700">{overtimeRate}</span>
            </div>
          </div>
          <Button onClick={handleExportSummaryCSV} variant="outline" size="sm" className="gap-2" disabled={results.length === 0}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/N</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Site Name</TableHead>
                <TableHead className="text-right">Total Cost (₦)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium text-indigo-900">{r.client}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-bold text-slate-700">₦{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No costs recorded for this month.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {results.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/80 font-bold border-t-2">
                  <td colSpan={3} className="px-4 py-3 text-right">GRAND TOTAL:</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </div>
    </div>
  );
}

