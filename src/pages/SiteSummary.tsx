import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Download, Lock } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { usePayrollCalculator } from '@/src/hooks/usePayrollCalculator';
import { calculateAttendanceMetrics, getStaffDateWorkedMap } from '@/src/lib/attendanceLogic';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog';

function DepartmentDropdown({
  availableDepts,
  selectedDepts,
  onToggleDept,
  onSelectAll,
  onClearAll,
}: {
  availableDepts: string[];
  selectedDepts: string[];
  onToggleDept: (dept: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(o => !o);
  };

  const isFiltered = selectedDepts.length > 0;
  const displayLabel = !isFiltered 
    ? 'All Departments' 
    : selectedDepts.length === availableDepts.length 
    ? 'All Departments' 
    : `${selectedDepts.length} selected`;

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={toggle}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition-all whitespace-nowrap ${
          !isFiltered
            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
            : 'border-indigo-300 bg-indigo-50 text-indigo-700'
        }`}
      >
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Dept</span>
        {displayLabel}
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[180px] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <button 
            type="button" 
            onClick={onSelectAll} 
            className="w-full text-left px-3 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            Select All
          </button>
          <button 
            type="button" 
            onClick={onClearAll} 
            className="w-full text-left px-3 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border-b border-slate-100 transition-colors mb-1 pb-1.5"
          >
            Clear Filters (All)
          </button>
          {availableDepts.map(dept => (
            <label key={dept} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={selectedDepts.includes(dept)} 
                onChange={() => onToggleDept(dept)} 
                className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer" 
              />
              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{dept}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export function SiteSummary({ filterYears = [], filterMonths = [] }: { filterYears?: string[], filterMonths?: string[] } = {}) {
  const [internalMonth, setInternalMonth] = useState(new Date().getMonth() + 1);
  const [internalYear, setInternalYear] = useState(new Date().getFullYear().toString());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);

  const selectedMonth = filterMonths.length > 0 && !filterMonths.includes('All') ? parseInt(filterMonths[0], 10) : internalMonth;
  const selectedYear = filterYears.length > 0 && !filterYears.includes('All') ? filterYears[0] : internalYear;

  const monthValues = useAppStore(s => s.monthValues);
  const attendanceRecords = useAppStore(s => s.attendanceRecords);
  const fetchAttendanceYearIfNeeded = useAppStore(s => s.fetchAttendanceYearIfNeeded);
  const pendingSites = useAppStore(s => s.pendingSites);
  const employees = useAppStore(s => s.employees);
  const sites = useAppStore(s => s.sites);
  const publicHolidays = useAppStore(s => s.publicHolidays);

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    if (!isNaN(yearNum)) {
      fetchAttendanceYearIfNeeded(yearNum);
    }
  }, [selectedYear, fetchAttendanceYearIfNeeded]);

  const priv = usePriv('sites');
  const { calculatePayrollForMonth } = usePayrollCalculator();
  const staffDateWorkedMap = useMemo(() => getStaffDateWorkedMap(attendanceRecords), [attendanceRecords]);

  const availableDepts = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.department) depts.add(e.department.trim());
    });
    return Array.from(depts).sort();
  }, [employees]);

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

  const filterAllMonths = filterMonths.includes('All') || filterMonths.length === 0;
  const monthsToProcess = filterAllMonths 
    ? Array.from({ length: parseInt(selectedYear) === new Date().getFullYear() ? new Date().getMonth() + 1 : 12 }, (_, i) => i + 1)
    : filterMonths.map(m => parseInt(m, 10)).filter(m => !isNaN(m));

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

  const officeKey = 'office';

  // Helper function to calculate cost data for a given set of months
  const getSummaryData = (months: number[]) => {
    const resultsList: { name: string; client: string; cost: number; pension: number; paye: number; wht: number; loanRepayment: number; netPay: number; teamSize: number }[] = [];
    let total = 0, totalPension = 0, totalPaye = 0, totalWht = 0, totalLoan = 0, totalNet = 0;

    const siteAllocations: Record<string, { cost: number; pension: number; paye: number; wht: number; loanRepayment: number; netPay: number; teamSize: Set<string>; displayName: string; displayClient: string }> = {};

    // 1. Initialize with Master Map
    Object.values(masterSiteMap).forEach(s => {
      const key = s.name.toLowerCase().trim();
      siteAllocations[key] = { cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0, teamSize: new Set(), displayName: s.name, displayClient: s.client };
    });

    // 2. Ensure Office bucket exists
    if (!siteAllocations[officeKey]) {
      const officeSite = sites.find(s => s.name.toLowerCase().trim() === 'office' || s.client === 'DCEL');
      siteAllocations[officeKey] = { 
        cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0, teamSize: new Set(), 
        displayName: officeSite?.name || 'Office', 
        displayClient: officeSite?.client || 'DCEL' 
      };
    }

    const clientTeamSize: Record<string, Set<string>> = {};

    months.forEach(mIdx => {
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
        const staffPension = row.pension || 0;
        const staffPaye = row.paye || 0;
        const staffWht = row.withholdingTax || 0;
        const staffLoanRepayment = row.loanRepayment || 0;
        const staffNetPay = row.takeHomePay || 0;
        const staffDept = row.department || '';
        
        if (staffGrossPay <= 0) return;

        // Department filter
        if (selectedDepts.length > 0 && !selectedDepts.includes(staffDept)) {
          return;
        }

        const staffRecords = attendanceRecords.filter(r => {
          if (!r.date || r.staffId !== staffPayrollId) return false;
          const [yStr, mStr] = r.date.split('-');
          return parseInt(yStr, 10) === parseInt(selectedYear) && parseInt(mStr, 10) === mIdx;
        });

        // Proportional weight distribution
        const staffSiteContribution: Record<string, number> = {};
        let totalStaffUnits = 0;

        staffRecords.forEach(r => {
          const metrics = calculateAttendanceMetrics(r, holidayDates, payrollVariables, monthValues as any, staffDateWorkedMap);

          const processShift = (sName: string, cName: string, weight: number) => {
            if (!sName || weight <= 0) return;
            const cleanedSite = sName.trim();
            const lowerSite = cleanedSite.toLowerCase();
            
            if (!siteAllocations[lowerSite]) {
              const fuzzyMasterKey = Object.keys(masterSiteMap).find(k => 
                k.includes(lowerSite) || lowerSite.includes(k)
              );
              const master = fuzzyMasterKey ? masterSiteMap[fuzzyMasterKey] : null;

              siteAllocations[lowerSite] = { 
                cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0, teamSize: new Set(), 
                displayName: master?.name || cleanedSite, 
                displayClient: master?.client || (cName?.trim() && cName.trim() !== 'Internal' ? cName.trim() : 'Internal')
              };
            } else {
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

          if (r.day === 'Yes') processShift(r.daySite, r.dayClient, 1);
          if (r.night === 'Yes') processShift(r.nightSite, r.nightClient, 1);

          if (metrics.ot > 0) {
            processShift(metrics.otSite, '', 1 + mOvertimeRate);
          }
        });

        // Distribute Gross Pay across sites based on worked weights
        if (totalStaffUnits > 0) {
          Object.entries(staffSiteContribution).forEach(([siteKey, units]) => {
            const proportion = units / totalStaffUnits;
            const allocatedCost = proportion * staffGrossPay;
            const allocatedPension = proportion * staffPension;
            const allocatedPaye = proportion * staffPaye;
            const allocatedWht = proportion * staffWht;
            const allocatedLoanRepayment = proportion * staffLoanRepayment;
            const allocatedNetPay = proportion * staffNetPay;
            
            siteAllocations[siteKey].cost += allocatedCost;
            siteAllocations[siteKey].pension += allocatedPension;
            siteAllocations[siteKey].paye += allocatedPaye;
            siteAllocations[siteKey].wht += allocatedWht;
            siteAllocations[siteKey].loanRepayment += allocatedLoanRepayment;
            siteAllocations[siteKey].netPay += allocatedNetPay;
            siteAllocations[siteKey].teamSize.add(staffPayrollId);

            const clientKey = siteAllocations[siteKey].displayClient.toLowerCase().trim();
            if (!clientTeamSize[clientKey]) {
              clientTeamSize[clientKey] = new Set();
            }
            clientTeamSize[clientKey].add(staffPayrollId);
          });
        } else {
          // Office overhead fallback
          siteAllocations[officeKey].cost += staffGrossPay;
          siteAllocations[officeKey].pension += staffPension;
          siteAllocations[officeKey].paye += staffPaye;
          siteAllocations[officeKey].wht += staffWht;
          siteAllocations[officeKey].loanRepayment += staffLoanRepayment;
          siteAllocations[officeKey].netPay += staffNetPay;
          siteAllocations[officeKey].teamSize.add(staffPayrollId);

          const clientKey = siteAllocations[officeKey].displayClient.toLowerCase().trim();
          if (!clientTeamSize[clientKey]) {
            clientTeamSize[clientKey] = new Set();
          }
          clientTeamSize[clientKey].add(staffPayrollId);
        }
      });
    });

    if (isCollapsed) {
      const clientGroups: Record<string, { client: string; cost: number; pension: number; paye: number; wht: number; loanRepayment: number; netPay: number; teamSize: number }> = {};
      Object.values(siteAllocations).forEach(data => {
        if (data.cost > 0) {
          const clientKey = data.displayClient.toLowerCase().trim();
          if (!clientGroups[clientKey]) {
            clientGroups[clientKey] = {
              client: data.displayClient,
              cost: 0,
              pension: 0,
              paye: 0,
              wht: 0,
              loanRepayment: 0,
              netPay: 0,
              teamSize: clientTeamSize[clientKey]?.size || 0
            };
          }
          clientGroups[clientKey].cost += data.cost;
          clientGroups[clientKey].pension += data.pension;
          clientGroups[clientKey].paye += data.paye;
          clientGroups[clientKey].wht += data.wht;
          clientGroups[clientKey].loanRepayment += data.loanRepayment;
          clientGroups[clientKey].netPay += data.netPay;
        }
      });

      Object.values(clientGroups).forEach(data => {
        const cost = Math.round(data.cost * 100) / 100;
        const pensionVal = Math.round(data.pension * 100) / 100;
        const payeVal = Math.round(data.paye * 100) / 100;
        const whtVal = Math.round(data.wht * 100) / 100;
        const loanRepaymentVal = Math.round(data.loanRepayment * 100) / 100;
        const netPayVal = Math.round((cost - (pensionVal + payeVal + whtVal + loanRepaymentVal)) * 100) / 100;

        resultsList.push({
          name: '',
          client: data.client,
          cost,
          pension: pensionVal,
          paye: payeVal,
          wht: whtVal,
          loanRepayment: loanRepaymentVal,
          netPay: netPayVal,
          teamSize: data.teamSize
        });
        total += cost;
        totalPension += pensionVal;
        totalPaye += payeVal;
        totalWht += whtVal;
        totalLoan += loanRepaymentVal;
        totalNet += netPayVal;
      });
    } else {
      Object.values(siteAllocations).forEach(data => {
        if (data.cost > 0) {
          const cost = Math.round(data.cost * 100) / 100;
          const pensionVal = Math.round(data.pension * 100) / 100;
          const payeVal = Math.round(data.paye * 100) / 100;
          const whtVal = Math.round(data.wht * 100) / 100;
          const loanRepaymentVal = Math.round(data.loanRepayment * 100) / 100;
          const netPayVal = Math.round((cost - (pensionVal + payeVal + whtVal + loanRepaymentVal)) * 100) / 100;

          resultsList.push({
            name: data.displayName,
            client: data.displayClient,
            cost,
            pension: pensionVal,
            paye: payeVal,
            wht: whtVal,
            loanRepayment: loanRepaymentVal,
            netPay: netPayVal,
            teamSize: data.teamSize.size
          });
          total += cost;
          totalPension += pensionVal;
          totalPaye += payeVal;
          totalWht += whtVal;
          totalLoan += loanRepaymentVal;
          totalNet += netPayVal;
        }
      });
    }

    resultsList.sort((a, b) => b.cost - a.cost);

    return {
      results: resultsList,
      grandTotal: total,
      grandPension: totalPension,
      grandPaye: totalPaye,
      grandWht: totalWht,
      grandLoanRepayment: totalLoan,
      grandNetPay: totalNet
    };
  };

  const { results, grandTotal, grandPension, grandPaye, grandWht, grandLoanRepayment, grandNetPay } = useMemo(() => {
    return getSummaryData(monthsToProcess);
  }, [monthsToProcess, isCollapsed, selectedDepts, selectedYear, employees, sites, pendingSites, attendanceRecords, monthValues]);

  const executeExport = (separateSheets: boolean) => {
    if (results.length === 0) return;
    
    const wb = XLSX.utils.book_new();

    const generateRowsForMonths = (months: number[]) => {
      const data = getSummaryData(months);
      const exportRows = data.results.map((r, i) => {
        const row: any = {
          "S/N": (i + 1).toString(),
          "Client": r.client,
        };
        if (!isCollapsed) {
          row["Site"] = r.name;
        }
        row["Gross Salary (₦)"] = r.cost;
        row["Pension (₦)"] = r.pension;
        row["PAYE (₦)"] = r.paye;
        row["Withholding Tax (₦)"] = r.wht;
        row["Loan Repayment (₦)"] = r.loanRepayment;
        row["Net Pay (₦)"] = r.netPay;
        return row;
      });

      // Append GRAND TOTAL row
      const totalRow: any = {
        "S/N": "Total",
        "Client": "",
      };
      if (!isCollapsed) {
        totalRow["Site"] = "GRAND TOTAL";
      } else {
        totalRow["Client"] = "GRAND TOTAL";
      }
      totalRow["Gross Salary (₦)"] = data.grandTotal;
      totalRow["Pension (₦)"] = data.grandPension;
      totalRow["PAYE (₦)"] = data.grandPaye;
      totalRow["Withholding Tax (₦)"] = data.grandWht;
      totalRow["Loan Repayment (₦)"] = data.grandLoanRepayment;
      totalRow["Net Pay (₦)"] = data.grandNetPay;
      exportRows.push(totalRow);
      return exportRows;
    };

    if (separateSheets) {
      // Create separate sheet for each month
      monthsToProcess.forEach(mIdx => {
        const rows = generateRowsForMonths([mIdx]);
        const ws = XLSX.utils.json_to_sheet(rows);
        const name = monthNames[mIdx - 1];
        XLSX.utils.book_append_sheet(wb, ws, name);
      });
    } else {
      // Combine all in one worksheet
      const rows = generateRowsForMonths(monthsToProcess);
      const ws = XLSX.utils.json_to_sheet(rows);
      const name = isCollapsed ? "Client Summary" : "Site Summary";
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    const fileName = isCollapsed ? "Client_Summary" : "Site_Summary";
    const dateLabel = monthsToProcess.length === 1 
      ? monthNames[selectedMonth - 1] 
      : `${monthNames[monthsToProcess[0] - 1]}_to_${monthNames[monthsToProcess[monthsToProcess.length - 1] - 1]}`;
    XLSX.writeFile(wb, `${fileName}_${dateLabel}_${selectedYear}.xlsx`);
  };

  const handleExportClick = () => {
    if (results.length === 0) return;
    if (monthsToProcess.length > 1) {
      setShowExportModal(true);
    } else {
      executeExport(false); // Only one month selected, export combined/single worksheet
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="text-sm text-slate-500">
              Work Days: <span className="font-semibold text-slate-700">{workDays}</span> |
              Overtime Rate: <span className="font-semibold text-slate-700">{overtimeRate}</span>
            </div>

            <div className="hidden sm:block w-px h-4 bg-slate-200" />

            <DepartmentDropdown
              availableDepts={availableDepts}
              selectedDepts={selectedDepts}
              onToggleDept={(dept) => {
                setSelectedDepts(prev => 
                  prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
                );
              }}
              onSelectAll={() => setSelectedDepts(availableDepts)}
              onClearAll={() => setSelectedDepts([])}
            />

            <div className="hidden sm:block w-px h-4 bg-slate-200" />

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
              <Checkbox 
                checked={isCollapsed} 
                onCheckedChange={(checked) => setIsCollapsed(!!checked)} 
              />
              <span>Collapse to Client Summary</span>
            </label>
          </div>
          
          <Button onClick={handleExportClick} variant="outline" size="sm" className="gap-2 shrink-0 self-end sm:self-auto" disabled={results.length === 0}>
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
                {!isCollapsed && <TableHead>Site Name</TableHead>}
                <TableHead className="text-right">Gross Salary (₦)</TableHead>
                <TableHead className="text-right">Pension (₦)</TableHead>
                <TableHead className="text-right">PAYE Tax (₦)</TableHead>
                <TableHead className="text-right">WHT (₦)</TableHead>
                <TableHead className="text-right">Loan Repayment (₦)</TableHead>
                <TableHead className="text-right">Net Pay (₦)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium text-indigo-900">{r.client}</TableCell>
                  {!isCollapsed && <TableCell>{r.name}</TableCell>}
                  <TableCell className="text-right font-bold text-slate-700">₦{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-slate-600">₦{r.pension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-slate-600">₦{r.paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-slate-600">₦{r.wht.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-slate-600">₦{r.loanRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">₦{r.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isCollapsed ? 8 : 9} className="text-center py-8 text-slate-500">
                    No costs recorded for this month.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {results.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/80 font-bold border-t-2">
                  <td colSpan={isCollapsed ? 2 : 3} className="px-4 py-3 text-right">GRAND TOTAL:</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandPension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandPaye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandWht.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-lg">₦{grandLoanRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 text-lg font-bold">₦{grandNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </Table>
          </div>
        </div>
      </div>

      {showExportModal && (
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Export Options</DialogTitle>
              <DialogDescription>
                You have selected multiple months. How would you like to structure the exported Excel workbook?
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 my-4">
              <button
                onClick={() => {
                  executeExport(false);
                  setShowExportModal(false);
                }}
                className="flex flex-col items-start p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group cursor-pointer"
              >
                <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-900">Combine all in one worksheet</span>
                <span className="text-slate-500 text-xs mt-1">Aggregates all selected months into a single sheet named "{isCollapsed ? 'Client Summary' : 'Site Summary'}".</span>
              </button>

              <button
                onClick={() => {
                  executeExport(true);
                  setShowExportModal(false);
                }}
                className="flex flex-col items-start p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group cursor-pointer"
              >
                <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-900">Separate each month</span>
                <span className="text-slate-500 text-xs mt-1">Creates a separate worksheet for each selected month (e.g. "January", "February", etc.) inside the same file.</span>
              </button>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowExportModal(false)}
                className="w-full sm:w-auto text-slate-600 hover:bg-slate-50 border-slate-200"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
