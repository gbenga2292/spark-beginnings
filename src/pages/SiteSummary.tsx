import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Download, Lock, Printer } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSrc from '../../logo/logo-2.png';
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
                checked={selectedDepts.length === 0 || selectedDepts.includes(dept)} 
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

function EmployeeDropdown({
  availableEmployees,
  selectedEmployees,
  onToggleEmployee,
  onSelectAll,
  onClearAll,
}: {
  availableEmployees: { id: string, name: string }[];
  selectedEmployees: string[];
  onToggleEmployee: (empId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [search, setSearch] = useState('');
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
      setSearch('');
    }
    setOpen(o => !o);
  };

  const isFiltered = selectedEmployees.length > 0;
  const displayLabel = !isFiltered 
    ? 'All Employees' 
    : selectedEmployees.length === availableEmployees.length 
    ? 'All Employees' 
    : `${selectedEmployees.length} selected`;

  const filteredEmployees = availableEmployees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

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
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Emp</span>
        {displayLabel}
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[220px] w-[260px] max-h-[350px] flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3 pb-2 pt-1 border-b border-slate-100 shrink-0">
            <input
              type="text"
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="overflow-y-auto flex-1 py-1">
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
            {filteredEmployees.map(emp => (
              <label key={emp.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={selectedEmployees.length === 0 || selectedEmployees.includes(emp.id)} 
                  onChange={() => onToggleEmployee(emp.id)} 
                  className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer" 
                />
                <span className="text-[11px] font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors truncate">{emp.name}</span>
              </label>
            ))}
          </div>
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
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'excel' | 'pdf' | null>(null);
  const [exportSeparate, setExportSeparate] = useState(true);
  const [exportIncSummary, setExportIncSummary] = useState(true);
  const [exportIncBreakdown, setExportIncBreakdown] = useState(true);
  const [selectedRowDetails, setSelectedRowDetails] = useState<{ client: string; name: string; staffBreakdown: any[] } | null>(null);

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

  // Sync selectedEmployees with selectedDepts: reset employees when depts change
  useEffect(() => {
    setSelectedEmployees([]);
  }, [selectedDepts]);

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

  const availableEmployees = useMemo(() => {
    // Note: User requested that when a dept is selected, the employees listed might be linked.
    // We will show employees that belong to the selected departments (or all if none selected).
    const filtered = selectedDepts.length > 0 
      ? employees.filter(e => selectedDepts.includes(e.department?.trim() || ''))
      : employees;
      
    return filtered
      .map(e => ({ id: e.id, name: `${e.firstname} ${e.surname}`.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, selectedDepts]);

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
    const resultsList: { name: string; client: string; cost: number; pension: number; paye: number; wht: number; loanRepayment: number; netPay: number; teamSize: number; staffBreakdown?: any[] }[] = [];
    let total = 0, totalPension = 0, totalPaye = 0, totalWht = 0, totalLoan = 0, totalNet = 0;

    const siteAllocations: Record<string, { cost: number; pension: number; paye: number; wht: number; loanRepayment: number; netPay: number; teamSize: Set<string>; displayName: string; displayClient: string; staffBreakdown: Map<string, any> }> = {};

    // 1. Initialize with Master Map
    Object.values(masterSiteMap).forEach(s => {
      const key = s.name.toLowerCase().trim();
      siteAllocations[key] = { cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0, teamSize: new Set(), displayName: s.name, displayClient: s.client, staffBreakdown: new Map() };
    });

    // 2. Ensure Office bucket exists
    if (!siteAllocations[officeKey]) {
      const officeSite = sites.find(s => s.name.toLowerCase().trim() === 'office' || s.client === 'DCEL');
      siteAllocations[officeKey] = { 
        cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0, teamSize: new Set(), 
        displayName: officeSite?.name || 'Office', 
        displayClient: officeSite?.client || 'DCEL',
        staffBreakdown: new Map()
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

        // Employee filter
        if (selectedEmployees.length > 0 && !selectedEmployees.includes(staffPayrollId)) {
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
                displayClient: master?.client || (cName?.trim() && cName.trim() !== 'Internal' ? cName.trim() : 'Internal'),
                staffBreakdown: new Map()
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

            const existingBreakdown = siteAllocations[siteKey].staffBreakdown.get(staffPayrollId) || { id: staffPayrollId, cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0 };
            existingBreakdown.cost += allocatedCost;
            existingBreakdown.pension += allocatedPension;
            existingBreakdown.paye += allocatedPaye;
            existingBreakdown.wht += allocatedWht;
            existingBreakdown.loanRepayment += allocatedLoanRepayment;
            existingBreakdown.netPay += allocatedNetPay;
            siteAllocations[siteKey].staffBreakdown.set(staffPayrollId, existingBreakdown);

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

          const existingBreakdown = siteAllocations[officeKey].staffBreakdown.get(staffPayrollId) || { id: staffPayrollId, cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0 };
          existingBreakdown.cost += staffGrossPay;
          existingBreakdown.pension += staffPension;
          existingBreakdown.paye += staffPaye;
          existingBreakdown.wht += staffWht;
          existingBreakdown.loanRepayment += staffLoanRepayment;
          existingBreakdown.netPay += staffNetPay;
          siteAllocations[officeKey].staffBreakdown.set(staffPayrollId, existingBreakdown);

          const clientKey = siteAllocations[officeKey].displayClient.toLowerCase().trim();
          if (!clientTeamSize[clientKey]) {
            clientTeamSize[clientKey] = new Set();
          }
          clientTeamSize[clientKey].add(staffPayrollId);
        }
      });
    });

    if (isCollapsed) {
      const clientGroups: Record<string, { client: string; cost: number; pension: number; paye: number; wht: number; loanRepayment: number; netPay: number; teamSize: number; staffBreakdown: Map<string, any> }> = {};
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
              teamSize: clientTeamSize[clientKey]?.size || 0,
              staffBreakdown: new Map()
            };
          }
          clientGroups[clientKey].cost += data.cost;
          clientGroups[clientKey].pension += data.pension;
          clientGroups[clientKey].paye += data.paye;
          clientGroups[clientKey].wht += data.wht;
          clientGroups[clientKey].loanRepayment += data.loanRepayment;
          clientGroups[clientKey].netPay += data.netPay;

          data.staffBreakdown.forEach((val, staffId) => {
             const existing = clientGroups[clientKey].staffBreakdown.get(staffId) || { id: staffId, cost: 0, pension: 0, paye: 0, wht: 0, loanRepayment: 0, netPay: 0 };
             existing.cost += val.cost;
             existing.pension += val.pension;
             existing.paye += val.paye;
             existing.wht += val.wht;
             existing.loanRepayment += val.loanRepayment;
             existing.netPay += val.netPay;
             clientGroups[clientKey].staffBreakdown.set(staffId, existing);
          });
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
          teamSize: data.teamSize,
          staffBreakdown: Array.from(data.staffBreakdown.values())
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
            teamSize: data.teamSize.size,
            staffBreakdown: Array.from(data.staffBreakdown.values())
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
  }, [monthsToProcess, isCollapsed, selectedDepts, selectedEmployees, selectedYear, employees, sites, pendingSites, attendanceRecords, monthValues]);

  const executeExport = (separateSheets: boolean, incSummary = true, incBreakdown = false) => {
    if (results.length === 0) return;
    if (!incSummary && !incBreakdown) return;

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
      const totalRow: any = { "S/N": "Total", "Client": "" };
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

    // Adds a per-site employee breakdown sheet for each site in the given months
    const addBreakdownSheets = (months: number[], sheetSuffix = '') => {
      const data = getSummaryData(months);
      data.results.forEach(siteData => {
        if (!siteData.staffBreakdown || siteData.staffBreakdown.length === 0) return;
        const breakRows = siteData.staffBreakdown
          .sort((a, b) => b.cost - a.cost)
          .map((staff, idx) => {
            const emp = employees.find(e => e.id === staff.id);
            const name = emp ? `${emp.firstname} ${emp.surname}` : 'Unknown Employee';
            return {
              'S/N': (idx + 1).toString(),
              'Employee': name,
              'Gross Salary (₦)': staff.cost,
              'Pension (₦)': staff.pension,
              'PAYE (₦)': staff.paye,
              'WHT (₦)': staff.wht,
              'Net Pay (₦)': staff.netPay,
            };
          });
        // Site total row
        breakRows.push({
          'S/N': 'Total', 'Employee': 'SITE TOTAL',
          'Gross Salary (₦)': siteData.cost,
          'Pension (₦)': siteData.pension,
          'PAYE (₦)': siteData.paye,
          'WHT (₦)': siteData.wht,
          'Net Pay (₦)': siteData.netPay,
        });
        const ws = XLSX.utils.json_to_sheet(breakRows);
        // Excel sheet names max 31 chars
        const rawName = `${siteData.client}${siteData.name ? `-${siteData.name}` : ''}${sheetSuffix}`;
        XLSX.utils.book_append_sheet(wb, ws, rawName.substring(0, 31));
      });
    };

    if (separateSheets) {
      monthsToProcess.forEach(mIdx => {
        const mName = monthNames[mIdx - 1];
        if (incSummary) {
          const rows = generateRowsForMonths([mIdx]);
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, mName);
        }
        if (incBreakdown) {
          // Suffix with month abbreviation so site sheet names don't collide
          addBreakdownSheets([mIdx], ` (${mName.slice(0, 3)})`);
        }
      });
    } else {
      if (incSummary) {
        const rows = generateRowsForMonths(monthsToProcess);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, isCollapsed ? "Client Summary" : "Site Summary");
      }
      if (incBreakdown) {
        addBreakdownSheets(monthsToProcess);
      }
    }

    const fileName = isCollapsed ? "Client_Summary" : "Site_Summary";
    const dateLabel = monthsToProcess.length === 1
      ? monthNames[selectedMonth - 1]
      : `${monthNames[monthsToProcess[0] - 1]}_to_${monthNames[monthsToProcess[monthsToProcess.length - 1] - 1]}`;
    XLSX.writeFile(wb, `${fileName}_${dateLabel}_${selectedYear}.xlsx`);
  };

  const handleExportClick = (mode: 'excel' | 'pdf') => {
    if (results.length === 0) return;
    setExportMode(mode);
    setExportSeparate(monthsToProcess.length > 1);
    setExportIncSummary(true);
    setExportIncBreakdown(true);
    setShowExportModal(true);
  };

  const exportPDF = (separateSheets: boolean = false, incSummary = true, incBreakdown = true) => {
    if (results.length === 0) return;
    const doc = new jsPDF('landscape');
    
    const fm = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const title = isCollapsed ? "Client Summary Report" : "Site Summary Report";
    const dateLabel = monthsToProcess.length === 1 
      ? monthNames[selectedMonth - 1] 
      : `${monthNames[monthsToProcess[0] - 1]} - ${monthNames[monthsToProcess[monthsToProcess.length - 1] - 1]}`;

    const monthsToIterate = separateSheets ? monthsToProcess : [monthsToProcess];

    monthsToIterate.forEach((monthOrMonths, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const currentMonths = Array.isArray(monthOrMonths) ? monthOrMonths : [monthOrMonths];
      const currentDateLabel = Array.isArray(monthOrMonths) 
        ? dateLabel 
        : monthNames[monthOrMonths - 1];

      // ── Professional Header ─────────────────────────────────────────
      const pageW = doc.internal.pageSize.getWidth();

      // Full-width deep navy banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageW, 52, 'F');

      // Subtle accent stripe at bottom of banner
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 49, pageW, 3, 'F');

      // Logo — give it room: left-aligned in the banner with padding
      try {
        doc.addImage(logoSrc, 'PNG', 10, 6, 38, 38);
      } catch (_) {}

      // Vertical divider after logo
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.6);
      doc.line(56, 10, 56, 44);

      // Company name — large, white, bold
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('DCEL Office Suite', 62, 22);

      // Report type — indigo accent
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(165, 180, 252); // indigo-300
      doc.text(title, 62, 31);

      // Period & Generated — right-aligned in banner
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Period:`, pageW - 84, 20);
      doc.text(`Generated:`, pageW - 84, 28);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text(`${currentDateLabel} ${selectedYear}`, pageW - 60, 20);
      doc.text(format(new Date(), 'dd MMM, yyyy'), pageW - 55, 28);

      let finalY = 62;


      const data = getSummaryData(currentMonths);
      const tableData = data.results.map((r, i) => {
        const row = [
          (i + 1).toString(),
          r.client,
        ];
        if (!isCollapsed) row.push(r.name);
        
        row.push(
          fm(r.cost),
          fm(r.pension),
          fm(r.paye),
          fm(r.wht),
          fm(r.loanRepayment),
          fm(r.netPay)
        );
        return row;
      });

      const totalRow = [
        "Total",
        isCollapsed ? "GRAND TOTAL" : "",
      ];
      if (!isCollapsed) totalRow.push("GRAND TOTAL");
      
      totalRow.push(
        fm(data.grandTotal),
        fm(data.grandPension),
        fm(data.grandPaye),
        fm(data.grandWht),
        fm(data.grandLoanRepayment),
        fm(data.grandNetPay)
      );
      
      tableData.push(totalRow);

      const head = [["S/N", "Client"]];
      if (!isCollapsed) head[0].push("Site Name");
      head[0].push(
        "Gross Salary (N)",
        "Pension (N)",
        "PAYE (N)",
        "WHT (N)",
        "Loan Repay. (N)",
        "Net Pay (N)"
      );

      autoTable(doc, {
        startY: finalY,
        head: head,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        footStyles: { fillColor: [30, 41, 59] }, // Slate 800
        styles: { fontSize: 8 },
        columnStyles: {
          [(isCollapsed ? 2 : 3)]: { halign: 'right' },
          [(isCollapsed ? 3 : 4)]: { halign: 'right' },
          [(isCollapsed ? 4 : 5)]: { halign: 'right' },
          [(isCollapsed ? 5 : 6)]: { halign: 'right' },
          [(isCollapsed ? 6 : 7)]: { halign: 'right' },
          [(isCollapsed ? 7 : 8)]: { halign: 'right' },
        },
        didParseCell: function(data) {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249]; // Slate 100
          }
        }
      });

      // Employee Breakdowns
      if (incBreakdown) {
        data.results.forEach((siteData) => {
          if (siteData.staffBreakdown && siteData.staffBreakdown.length > 0) {
            // ── Professional breakdown page header ───────────────────
            const bPageW = doc.internal.pageSize.getWidth();
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, bPageW, 52, 'F');
            doc.setFillColor(79, 70, 229);
            doc.rect(0, 49, bPageW, 3, 'F');

            try { doc.addImage(logoSrc, 'PNG', 10, 6, 38, 38); } catch (_) {}

            doc.setDrawColor(79, 70, 229);
            doc.setLineWidth(0.6);
            doc.line(56, 10, 56, 44);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(255, 255, 255);
            doc.text('DCEL Office Suite', 62, 19);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(165, 180, 252);
            doc.text('Employee Breakdown', 62, 27);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            const siteLabel = `${siteData.client}${siteData.name ? ` — ${siteData.name}` : ''}`;
            doc.text(siteLabel, 62, 35);

            // Right-side meta
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            doc.text('Period:', bPageW - 84, 20);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(255, 255, 255);
            doc.text(`${currentDateLabel} ${selectedYear}`, bPageW - 60, 20);

            
            const staffData = siteData.staffBreakdown.sort((a, b) => b.cost - a.cost).map((staff, idx) => {
              const emp = employees.find(e => e.id === staff.id);
              const name = emp ? `${emp.firstname} ${emp.surname}` : 'Unknown Employee';
              return [
                (idx + 1).toString(),
                name,
                fm(staff.cost),
                fm(staff.pension),
                fm(staff.paye),
                fm(staff.wht),
                fm(staff.netPay)
              ];
            });

            // Add site total row to the breakdown
            staffData.push([
              "",
              "TOTAL",
              fm(siteData.cost),
              fm(siteData.pension),
              fm(siteData.paye),
              fm(siteData.wht),
              fm(siteData.netPay)
            ]);

            autoTable(doc, {
              startY: 62,
              head: [["S/N", "Employee Name", "Gross Salary (N)", "Pension (N)", "PAYE (N)", "WHT (N)", "Net Pay (N)"]],
              body: staffData,
              theme: 'grid',
              headStyles: { fillColor: [51, 65, 85] },
              styles: { fontSize: 9 },
              columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
              },
              didParseCell: function(cellData) {
                if (cellData.row.index === staffData.length - 1) {
                  cellData.cell.styles.fontStyle = 'bold';
                  cellData.cell.styles.fillColor = [241, 245, 249];
                }
              }
            });
          }
        });
      } // end incBreakdown
    });


    const fileName = isCollapsed ? "Client_Summary" : "Site_Summary";
    doc.save(`${fileName}_${dateLabel.replace(/ /g, '_')}_${selectedYear}.pdf`);
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
                setSelectedDepts(prev => {
                  if (prev.length === 0) {
                    return availableDepts.filter(d => d !== dept);
                  }
                  return prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept];
                });
              }}
              onSelectAll={() => setSelectedDepts([])}
              onClearAll={() => setSelectedDepts([])}
            />

            <EmployeeDropdown
              availableEmployees={availableEmployees}
              selectedEmployees={selectedEmployees}
              onToggleEmployee={(empId) => {
                setSelectedEmployees(prev => {
                  if (prev.length === 0) {
                    return availableEmployees.map(e => e.id).filter(id => id !== empId);
                  }
                  return prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId];
                });
              }}
              onSelectAll={() => setSelectedEmployees([])}
              onClearAll={() => setSelectedEmployees([])}
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
          
          <div className="flex gap-2 shrink-0 self-end sm:self-auto">
            <Button onClick={() => handleExportClick('pdf')} variant="outline" size="sm" className="gap-2" disabled={results.length === 0}>
              <Printer className="h-4 w-4" /> Export PDF
            </Button>
            <Button onClick={() => handleExportClick('excel')} variant="outline" size="sm" className="gap-2" disabled={results.length === 0}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </div>
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
                <TableRow key={idx} className="cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => setSelectedRowDetails({ client: r.client, name: r.name, staffBreakdown: r.staffBreakdown || [] })}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium text-indigo-900 group-hover:underline">{r.client}</TableCell>
                  {!isCollapsed && <TableCell className="group-hover:underline">{r.name}</TableCell>}
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
                {monthsToProcess.length} months selected — choose how to structure the {exportMode === 'excel' ? 'workbook' : 'PDF'}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 my-4">

              {monthsToProcess.length > 1 && (
                <>
                  {/* ── Option 1: Combine ── */}
                  <button
                    onClick={() => setExportSeparate(false)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      !exportSeparate
                        ? 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-300'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    {/* radio dot */}
                    <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${!exportSeparate ? 'border-indigo-500' : 'border-slate-300'}`}>
                      {!exportSeparate && <span className="w-2 h-2 rounded-full bg-indigo-500 block" />}
                    </span>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">Combine all months</span>
                      <span className="text-slate-500 text-xs mt-0.5 block">
                        Aggregates all {monthsToProcess.length} months into a single {exportMode === 'excel' ? 'sheet' : 'document'} named "{isCollapsed ? 'Client Summary' : 'Site Summary'}".
                      </span>
                    </div>
                  </button>

                  {/* ── Option 2: Separate ── */}
                  <div className={`rounded-xl border transition-all ${exportSeparate ? 'border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-300' : 'border-slate-200'}`}>
                    <button
                      onClick={() => setExportSeparate(true)}
                      className="flex items-start gap-3 p-4 w-full text-left cursor-pointer"
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${exportSeparate ? 'border-indigo-500' : 'border-slate-300'}`}>
                        {exportSeparate && <span className="w-2 h-2 rounded-full bg-indigo-500 block" />}
                      </span>
                      <div>
                        <span className="font-bold text-slate-800 text-sm block">Separate by month</span>
                        <span className="text-slate-500 text-xs mt-0.5 block">
                          Creates a separate {exportMode === 'excel' ? 'worksheet' : 'section'} for each month — e.g. "January", "February", etc.
                        </span>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* ── Content checkboxes ── */}
              {(exportSeparate || monthsToProcess.length === 1) && (
                <div className={`px-4 pb-4 pt-1 ${monthsToProcess.length > 1 ? 'border-t border-indigo-100' : ''}`}>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Include in export:</p>
                  <div className="flex flex-col gap-2.5">

                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={exportIncSummary}
                        onChange={e => setExportIncSummary(e.target.checked)}
                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 block leading-tight">Summary Table</span>
                        <span className="text-xs text-slate-400">Site / client totals</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={exportIncBreakdown}
                        onChange={e => setExportIncBreakdown(e.target.checked)}
                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 block leading-tight">Employee Breakdown</span>
                        <span className="text-xs text-slate-400">Per-site employee detail {exportMode === 'excel' ? '(separate sheets)' : '(extra pages)'}</span>
                      </div>
                    </label>
                  </div>

                  {!exportIncSummary && !exportIncBreakdown && (
                    <p className="text-xs text-amber-600 mt-2.5 font-medium">⚠ Select at least one option to export.</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-row justify-end">
              <Button
                variant="outline"
                onClick={() => setShowExportModal(false)}
                className="text-slate-600 hover:bg-slate-50 border-slate-200"
              >
                Cancel
              </Button>
              <Button
                disabled={exportSeparate && !exportIncSummary && !exportIncBreakdown}
                onClick={() => {
                  if (!exportSeparate) {
                    if (exportMode === 'excel') executeExport(false, true, false);
                    else exportPDF(false, true, true);
                  } else {
                    if (exportMode === 'excel') executeExport(true, exportIncSummary, exportIncBreakdown);
                    else exportPDF(true, exportIncSummary, exportIncBreakdown);
                  }
                  setShowExportModal(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                Export →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


      {selectedRowDetails && (
        <Dialog open={!!selectedRowDetails} onOpenChange={(open) => !open && setSelectedRowDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Employee Breakdown: {selectedRowDetails.client} {selectedRowDetails.name ? `- ${selectedRowDetails.name}` : ''}
              </DialogTitle>
              <DialogDescription>
                List of employees and their contributed costs for this site/client in the selected period.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto mt-4 border rounded-lg">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead className="text-right">Gross Salary (₦)</TableHead>
                    <TableHead className="text-right">Pension (₦)</TableHead>
                    <TableHead className="text-right">PAYE Tax (₦)</TableHead>
                    <TableHead className="text-right">WHT (₦)</TableHead>
                    <TableHead className="text-right">Net Pay (₦)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRowDetails.staffBreakdown.sort((a, b) => b.cost - a.cost).map((staff, idx) => {
                    const emp = employees.find(e => e.id === staff.id);
                    const name = emp ? `${emp.firstname} ${emp.surname}` : 'Unknown Employee';
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-slate-700">{name}</TableCell>
                        <TableCell className="text-right">₦{(Math.round(staff.cost * 100)/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-slate-500">₦{(Math.round(staff.pension * 100)/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-slate-500">₦{(Math.round(staff.paye * 100)/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-slate-500">₦{(Math.round(staff.wht * 100)/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-emerald-700 font-medium">₦{(Math.round(staff.netPay * 100)/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    );
                  })}
                  {selectedRowDetails.staffBreakdown.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-slate-500">No employees found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => setSelectedRowDetails(null)} variant="outline">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
