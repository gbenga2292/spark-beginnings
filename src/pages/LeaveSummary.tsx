import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Search, ListFilter, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAppStore } from '@/src/store/appStore';
import { filterAndSortEmployeesExcludingCEO } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';

// ── Robust date parser supporting DD/MM/YYYY, YYYY-MM-DD, etc. ─────────────────
function parseEmployeeStartDate(raw?: string | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Slash format e.g. "DD/MM/YYYY" or "YYYY/MM/DD"
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt;
      } else {
        // DD/MM/YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
  }

  // 2. Hyphen format e.g. "YYYY-MM-DD" or "DD-MM-YYYY"
  if (trimmed.includes('-')) {
    const clean = trimmed.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt;
      } else {
        // DD-MM-YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
  }

  // Fallback
  const dt = new Date(trimmed);
  return !isNaN(dt.getTime()) ? dt : null;
}

// ── Only employees who have joined for over a year are counted for leave ────────
function hasJoinedOverOneYear(emp: { startDate?: string; verifiedStartDate?: string }): boolean {
  const dateStr = emp.verifiedStartDate || emp.startDate;
  const startDate = parseEmployeeStartDate(dateStr);
  if (!startDate) return false;

  const now = new Date();
  const oneYearAfter = new Date(startDate);
  oneYearAfter.setFullYear(oneYearAfter.getFullYear() + 1);

  return oneYearAfter <= now;
}

type SortField = 'name' | 'department' | 'entitlement' | 'daysTaken' | 'remaining' | 'timesTaken' | 'status';
type SortDirection = 'asc' | 'desc';

export function LeaveSummary() {
  const navigate = useNavigate();
  const allEmployees = useAppStore((state) => state.employees);
  const leaves = useAppStore((state) => state.leaves);
  const departments = useAppStore((state) => state.departments);
  const leaveTypes = useAppStore((state) => state.leaveTypes);

  // Filter to active staff who have joined for OVER a year
  const employees = useMemo(() => {
    const eligibleEmployees = allEmployees.filter(e => {
      const isActive =
        (e.status === 'Active' || e.status === 'On Leave') &&
        (e.staffType === 'OFFICE' || e.staffType === 'FIELD');
      if (!isActive) return false;

      // Only count employees who have been with the company over 1 year
      return hasJoinedOverOneYear(e);
    });

    return filterAndSortEmployeesExcludingCEO(eligibleEmployees);
  }, [allEmployees]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterLeaveType, setFilterLeaveType] = useState('All Leaves');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // For numeric metrics default desc, for strings default asc
      setSortDirection(field === 'name' || field === 'department' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    );
  };

  const currentYear = new Date().getFullYear();

  // Summary logic
  const leaveSummary = useMemo(() => {
    return employees.map(emp => {
      const empLeaves = leaves.filter(l => l.employeeId === emp.id && l.status !== 'Cancelled');

      const deductibleTaken = empLeaves.reduce((acc, l) => {
        const typeStr = (l.leaveType || '').toLowerCase();
        // Maternity and Paternity do not reduce annual leave
        if (typeStr.includes('maternity') || typeStr.includes('paternity')) return acc;
        return acc + l.duration;
      }, 0);

      // Leaves matching the selected specific leave filter
      const specificLeaves = filterLeaveType === 'All Leaves' ? [] : empLeaves.filter(l => l.leaveType === filterLeaveType);
      const timesTakenSpecific = specificLeaves.length;
      const daysTakenSpecific = specificLeaves.reduce((acc, l) => acc + l.duration, 0);

      const entitlement = emp.yearlyLeave || 14;
      const remaining = entitlement - deductibleTaken;

      const isCurrentlyOnLeave = empLeaves.some(l => {
        if (!l.startDate || !l.expectedEndDate || l.status !== 'Active' || l.dateReturned) return false;
        const todayMidnight = new Date().setHours(0, 0, 0, 0);
        const start = new Date(l.startDate).setHours(0, 0, 0, 0);
        const resumptionDate = new Date(l.expectedEndDate).setHours(0, 0, 0, 0);
        return start <= todayMidnight && todayMidnight < resumptionDate;
      });

      return { emp, deductibleTaken, remaining, entitlement, isCurrentlyOnLeave, timesTakenSpecific, daysTakenSpecific };
    });
  }, [employees, leaves]);

  const filteredSummary = useMemo(() => {
    return leaveSummary.filter(item => {
      const matchesSearch = `${item.emp.surname} ${item.emp.firstname}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = filterDept === 'All' || item.emp.department === filterDept;
      return matchesSearch && matchesDept;
    });
  }, [leaveSummary, searchQuery, filterDept]);

  // Apply column sorting
  const sortedSummary = useMemo(() => {
    const list = [...filteredSummary];
    list.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortField) {
        case 'name':
          valA = `${a.emp.surname} ${a.emp.firstname}`.toLowerCase();
          valB = `${b.emp.surname} ${b.emp.firstname}`.toLowerCase();
          break;
        case 'department':
          valA = (a.emp.department || '').toLowerCase();
          valB = (b.emp.department || '').toLowerCase();
          break;
        case 'entitlement':
          valA = a.entitlement;
          valB = b.entitlement;
          break;
        case 'timesTaken':
          valA = a.timesTakenSpecific;
          valB = b.timesTakenSpecific;
          break;
        case 'daysTaken':
          valA = filterLeaveType === 'All Leaves' ? a.deductibleTaken : a.daysTakenSpecific;
          valB = filterLeaveType === 'All Leaves' ? b.deductibleTaken : b.daysTakenSpecific;
          break;
        case 'remaining':
          valA = a.remaining;
          valB = b.remaining;
          break;
        case 'status':
          valA = a.isCurrentlyOnLeave ? 1 : 0;
          valB = b.isCurrentlyOnLeave ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? comp : -comp;
      }

      const diff = Number(valA) - Number(valB);
      return sortDirection === 'asc' ? diff : -diff;
    });
    return list;
  }, [filteredSummary, sortField, sortDirection, filterLeaveType]);

  useSetPageTitle(
    'Leave Entitlement Summary',
    `Leave balances for staff with over 1 year of continuous service (${currentYear})`,
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => navigate(-1)}
      className="gap-2 text-slate-500 hover:text-slate-800"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </Button>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      <Card className="border border-slate-200 dark:border-slate-800 rounded-md shadow-none overflow-hidden bg-white dark:bg-slate-900 min-h-[500px] flex flex-col">
        <div className="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <ListFilter className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                Leave Balances <span className="text-slate-400 dark:text-slate-500 font-normal">({sortedSummary.length})</span>
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Staff with &gt; 1 year of service</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-md w-full sm:w-auto">
              <select
                className="bg-transparent w-full border-none text-xs font-semibold text-slate-700 dark:text-slate-200 px-2 py-1 outline-none cursor-pointer"
                value={filterLeaveType}
                onChange={e => setFilterLeaveType(e.target.value)}
              >
                <option value="All Leaves">All Leaves</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-md w-full sm:w-auto">
              <select
                className="bg-transparent w-full border-none text-xs font-semibold text-slate-700 dark:text-slate-200 px-2 py-1 outline-none cursor-pointer"
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search staff name..." 
                className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 h-9 text-xs focus-visible:ring-blue-500 rounded-md shadow-none" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[11px] tracking-wider font-semibold">
                <th 
                  onClick={() => handleSort('name')} 
                  className="px-5 py-3.5 cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('department')} 
                  className="px-5 py-3.5 hidden sm:table-cell cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Department</span>
                    {renderSortIcon('department')}
                  </div>
                </th>
                {filterLeaveType === 'All Leaves' ? (
                  <>
                    <th 
                      onClick={() => handleSort('entitlement')} 
                      className="px-5 py-3.5 text-center cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Annual Leave</span>
                        {renderSortIcon('entitlement')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('daysTaken')} 
                      className="px-5 py-3.5 text-center cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Days Taken</span>
                        {renderSortIcon('daysTaken')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('remaining')} 
                      className="px-5 py-3.5 text-center cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Remaining</span>
                        {renderSortIcon('remaining')}
                      </div>
                    </th>
                  </>
                ) : (
                  <>
                    <th 
                      onClick={() => handleSort('timesTaken')} 
                      className="px-5 py-3.5 text-center cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Times Taken</span>
                        {renderSortIcon('timesTaken')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('daysTaken')} 
                      className="px-5 py-3.5 text-center cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Days Taken</span>
                        {renderSortIcon('daysTaken')}
                      </div>
                    </th>
                  </>
                )}
                <th 
                  onClick={() => handleSort('status')} 
                  className="px-5 py-3.5 text-center cursor-pointer select-none group hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedSummary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <p className="font-medium text-slate-700 dark:text-slate-300">No staff found matching your criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Note: Only employees who have completed at least 1 year of service from their start date are eligible for leave balance tracking.</p>
                  </td>
                </tr>
              ) : (
                sortedSummary.map(({ emp, deductibleTaken, remaining, entitlement, isCurrentlyOnLeave, timesTakenSpecific, daysTakenSpecific }) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200 uppercase text-xs">{emp.surname} {emp.firstname}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell">{emp.department}</td>
                    {filterLeaveType === 'All Leaves' ? (
                      <>
                        <td className="px-5 py-3 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-300">{entitlement}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-semibold tabular-nums ${deductibleTaken > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{deductibleTaken}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-semibold tabular-nums ${remaining < 5 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{remaining}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-center">
                          <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">{timesTakenSpecific}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-semibold tabular-nums ${daysTakenSpecific > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{daysTakenSpecific}</span>
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3 text-center">
                      <Badge variant="outline" className={isCurrentlyOnLeave ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40'}>
                        {isCurrentlyOnLeave ? 'On Leave' : 'Active'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800 flex-1">
          {sortedSummary.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500">
              <p className="font-medium text-slate-700 dark:text-slate-300">No staff found matching your criteria.</p>
              <p className="text-xs text-slate-400 mt-1">Note: Only employees who have completed at least 1 year of service from their start date are eligible for leave balance tracking.</p>
            </div>
          ) : (
            sortedSummary.map(({ emp, deductibleTaken, remaining, entitlement, isCurrentlyOnLeave, timesTakenSpecific, daysTakenSpecific }) => (
              <div key={`mobile-${emp.id}`} className="p-4 flex flex-col gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs">{emp.surname} {emp.firstname}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{emp.department}</span>
                  </div>
                  <Badge variant="outline" className={isCurrentlyOnLeave ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40'}>
                    {isCurrentlyOnLeave ? 'On Leave' : 'Active'}
                  </Badge>
                </div>

                <div className={`grid ${filterLeaveType === 'All Leaves' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-xs mt-1`}>
                  {filterLeaveType === 'All Leaves' ? (
                    <>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 text-center">Entitled</span>
                        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200 mt-1">{entitlement}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 text-center">Taken</span>
                        <span className={`font-semibold tabular-nums mt-1 ${deductibleTaken > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{deductibleTaken}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 text-center">Remaining</span>
                        <span className={`font-semibold tabular-nums mt-1 ${remaining < 5 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{remaining}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 text-center">Times Taken</span>
                        <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400 mt-1">{timesTakenSpecific}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 text-center">Days Taken</span>
                        <span className={`font-semibold tabular-nums mt-1 ${daysTakenSpecific > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{daysTakenSpecific}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
