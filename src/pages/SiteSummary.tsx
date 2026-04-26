import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Download, Lock } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { usePayrollCalculator } from '@/src/hooks/usePayrollCalculator';
import { calculateAttendanceMetrics } from '@/src/lib/attendanceLogic';

export function SiteSummary({ filterYear, filterMonth }: { filterYear?: string, filterMonth?: string } = {}) {
  const [internalMonth, setInternalMonth] = useState(new Date().getMonth() + 1);
  const [internalYear, setInternalYear] = useState(new Date().getFullYear().toString());

  const selectedMonth = filterMonth && filterMonth !== 'All' ? parseInt(filterMonth, 10) : internalMonth;
  const selectedYear = filterYear && filterYear !== 'All' ? filterYear : internalYear;

  const monthValues = useAppStore(s => s.monthValues);
  const attendanceRecords = useAppStore(s => s.attendanceRecords);
  const pendingSites = useAppStore(s => s.pendingSites);
  const employees = useAppStore(s => s.employees);
  const sites = useAppStore(s => s.sites);
  const publicHolidays = useAppStore(s => s.publicHolidays);

  const priv = usePriv('sites');
  const { calculatePayrollForMonth } = usePayrollCalculator();

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

    const filterAllMonths = filterMonth === 'All';
    const monthsToProcess = filterAllMonths 
      ? Array.from({ length: parseInt(selectedYear) === new Date().getFullYear() ? new Date().getMonth() + 1 : 12 }, (_, i) => i + 1)
      : [selectedMonth];

    // Build a Master Client Map for accuracy
    const masterSiteMap: Record<string, { client: string; name: string }> = {};
    sites.forEach(s => {
      masterSiteMap[s.name.toLowerCase().trim()] = { client: s.client, name: s.name };
    });
    pendingSites.forEach(s => {
      const key = s.siteName.toLowerCase().trim();
      if (!masterSiteMap[key]) {
        masterSiteMap[key] = { client: s.clientName || 'Internal', name: s.siteName };
      }
    });

    // Group purely by Site Name. The Master Lists dictate the true assigned Client.
    const siteAllocations: Record<string, { cost: number; teamSize: Set<string>; displayName: string; displayClient: string }> = {};

    // 1. Initialize with Master Map
    Object.values(masterSiteMap).forEach(s => {
      const key = s.name.toLowerCase().trim();
      siteAllocations[key] = { cost: 0, teamSize: new Set(), displayName: s.name, displayClient: s.client };
    });

    // 2. Ensure a definitive 'Office' bucket exists
    const officeKey = 'office';
    if (!siteAllocations[officeKey]) {
      const officeSite = sites.find(s => s.name.toLowerCase().trim() === 'office' || s.client === 'DCEL');
      siteAllocations[officeKey] = { 
        cost: 0, 
        teamSize: new Set(), 
        displayName: officeSite?.name || 'Office', 
        displayClient: officeSite?.client || 'DCEL' 
      };
    }

    monthsToProcess.forEach(mIdx => {
      const mKey = monthsMap[mIdx - 1];
      const mValues = monthValues[mKey];
      if (!mValues || mValues.workDays <= 0) return;

      const payrollRows = calculatePayrollForMonth(mKey, parseInt(selectedYear));
      const holidayDates = publicHolidays.map(h => h.date);
      const payrollVariables = useAppStore.getState().payrollVariables;
      const mOvertimeRate = mValues.overtimeRate;

      payrollRows.forEach(row => {
        const staffPayrollId = row.id;
        const staffGrossPay = row.grossPay;
        
        if (staffGrossPay <= 0) return;

        const staffRecords = attendanceRecords.filter(r => {
          if (!r.date || r.staffId !== staffPayrollId) return false;
          const [yStr, mStr] = r.date.split('-');
          return parseInt(yStr, 10) === parseInt(selectedYear) && parseInt(mStr, 10) === mIdx;
        });

        // Gather this staff's proportional weight for each site they worked
        const staffSiteContribution: Record<string, number> = {};
        let totalStaffUnits = 0;

        staffRecords.forEach(r => {
          const metrics = calculateAttendanceMetrics(r, holidayDates, payrollVariables, monthValues as any, attendanceRecords);

          const processShift = (sName: string, cName: string, weight: number) => {
            if (!sName || weight <= 0) return;
            const cleanedSite = sName.trim();
            const lowerSite = cleanedSite.toLowerCase();
            
            if (!siteAllocations[lowerSite]) {
              // Try to find a fuzzy match in master map if exact match fails
              const fuzzyMasterKey = Object.keys(masterSiteMap).find(k => 
                k.includes(lowerSite) || lowerSite.includes(k)
              );
              const master = fuzzyMasterKey ? masterSiteMap[fuzzyMasterKey] : null;

              siteAllocations[lowerSite] = { 
                cost: 0, 
                teamSize: new Set(), 
                displayName: master?.name || cleanedSite, 
                displayClient: master?.client || (cName?.trim() && cName.trim() !== 'Internal' ? cName.trim() : 'Internal')
              };
            } else {
                // Already exists, but ensure we are using the Master Client name if available
                const fuzzyMasterKey = Object.keys(masterSiteMap).find(k => 
                    k === lowerSite || k.includes(lowerSite) || lowerSite.includes(k)
                );
                const master = fuzzyMasterKey ? masterSiteMap[fuzzyMasterKey] : null;
                if (master && (siteAllocations[lowerSite].displayClient === 'Internal' || !siteAllocations[lowerSite].displayClient)) {
                    siteAllocations[lowerSite].displayName = master.name;
                    siteAllocations[lowerSite].displayClient = master.client;
                }
            }

            staffSiteContribution[lowerSite] = (staffSiteContribution[lowerSite] || 0) + weight;
            totalStaffUnits += weight;
          };

          // Standard Shifts (Cores)
          if (r.day === 'Yes') processShift(r.daySite, r.dayClient, 1);
          if (r.night === 'Yes') processShift(r.nightSite, r.nightClient, 1);

          // OT / Premium Components
          if (metrics.ot > 0) {
            processShift(metrics.otSite, '', 1 + mOvertimeRate);
          }
        });

        // Distribute Gross Pay across sites based on worked weights
        if (totalStaffUnits > 0) {
          Object.entries(staffSiteContribution).forEach(([siteKey, units]) => {
            const proportion = units / totalStaffUnits;
            const allocatedCost = proportion * staffGrossPay;
            
            siteAllocations[siteKey].cost += allocatedCost;
            siteAllocations[siteKey].teamSize.add(staffPayrollId);
          });
        } else {
          // No physical attendance records for this month -> attribute to Office overhead
          siteAllocations[officeKey].cost += staffGrossPay;
          siteAllocations[officeKey].teamSize.add(staffPayrollId);
        }
      });
    });


    // Convert map to strictly populated array
    Object.values(siteAllocations).forEach(data => {
      if (data.cost > 0) {
        results.push({
          name: data.displayName,
          client: data.displayClient,
          cost: data.cost,
          teamSize: data.teamSize.size
        });
        grandTotal += data.cost;
      }
    });

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
    XLSX.writeFile(wb, `Site_Summary_${monthNames[selectedMonth - 1]}_${selectedYear}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
          <div className="overflow-x-auto">
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
    </div>
  );
}


