import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Search, ListFilter, ArrowLeft } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAppStore } from '@/src/store/appStore';
import { filterAndSortEmployeesExcludingCEO } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function LeaveSummary() {
  const navigate = useNavigate();
  const allEmployees = useAppStore((state) => state.employees);
  const leaves = useAppStore((state) => state.leaves);
  const departments = useAppStore((state) => state.departments);
  const leaveTypes = useAppStore((state) => state.leaveTypes);

  const employees = useMemo(() => {
    const activeEmployees = allEmployees.filter(e => 
      (e.status === 'Active' || e.status === 'On Leave') &&
      (e.staffType === 'OFFICE' || e.staffType === 'FIELD')
    );
    return filterAndSortEmployeesExcludingCEO(activeEmployees);
  }, [allEmployees]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterLeaveType, setFilterLeaveType] = useState('All Leaves');

  const currentYear = new Date().getFullYear();

  // Summary logic extracted from Leaves.tsx
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
      
      const entitlement = emp.yearlyLeave || 20;
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
  }, [employees, leaves, currentYear]);

  const filteredSummary = useMemo(() => {
    return leaveSummary.filter(item => {
      const matchesSearch = `${item.emp.surname} ${item.emp.firstname}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = filterDept === 'All' || item.emp.department === filterDept;
      // We don't filter rows by filterLeaveType, we only change the columns inside them
      return matchesSearch && matchesDept;
    });
  }, [leaveSummary, searchQuery, filterDept, filterLeaveType]);

  useSetPageTitle(
    'Leave Entitlement Summary',
    `Overview of all employee leave balances for the year ${currentYear}`,
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

      <Card className="border-none shadow-sm overflow-hidden bg-white min-h-[500px] flex flex-col">
        <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
          <div className="flex items-center gap-2 ml-1">
            <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
              <ListFilter className="h-4 w-4" />
            </div>
            <p className="font-semibold text-slate-700 text-sm">Leave Balances <span className="text-slate-400 font-normal">({filteredSummary.length})</span></p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/50 p-1 rounded-lg w-full sm:w-auto">
              <select
                className="bg-transparent w-full border-none text-sm font-semibold text-slate-600 px-2 py-1 outline-none cursor-pointer"
                value={filterLeaveType}
                onChange={e => setFilterLeaveType(e.target.value)}
              >
                <option value="All Leaves">All Leaves</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-lg w-full sm:w-auto">
              <select
                className="bg-transparent w-full border-none text-sm font-semibold text-slate-600 px-2 py-1 outline-none cursor-pointer"
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departments.map((dept, i) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search staff name..." 
                className="pl-9 bg-white border-slate-200 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] tracking-wider font-bold">
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4 hidden sm:table-cell">Department</th>
                {filterLeaveType === 'All Leaves' ? (
                  <>
                    <th className="px-5 py-4 text-center">Annual Leave</th>
                    <th className="px-5 py-4 text-center">Days Taken</th>
                    <th className="px-5 py-4 text-center">Remaining</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-4 text-center">Times Taken</th>
                    <th className="px-5 py-4 text-center">Days Taken</th>
                  </>
                )}
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSummary.map(({ emp, deductibleTaken, remaining, entitlement, isCurrentlyOnLeave, timesTakenSpecific, daysTakenSpecific }) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-800 uppercase text-xs">{emp.surname} {emp.firstname}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden sm:table-cell">{emp.department}</td>
                    {filterLeaveType === 'All Leaves' ? (
                      <>
                        <td className="px-5 py-3 text-center font-mono font-semibold">{entitlement}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-mono font-bold ${deductibleTaken > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{deductibleTaken}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-mono font-bold ${remaining < 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{remaining}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-center">
                          <span className="font-mono font-bold text-indigo-600">{timesTakenSpecific}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-mono font-bold ${daysTakenSpecific > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{daysTakenSpecific}</span>
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3 text-center">
                      <Badge variant="outline" className={isCurrentlyOnLeave ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
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
        <div className="md:hidden flex flex-col divide-y divide-slate-100 flex-1">
          {filteredSummary.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500">
              No records found matching your filters.
            </div>
          ) : (
            filteredSummary.map(({ emp, deductibleTaken, remaining, entitlement, isCurrentlyOnLeave, timesTakenSpecific, daysTakenSpecific }) => (
              <div key={`mobile-${emp.id}`} className="p-4 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 uppercase text-sm">{emp.surname} {emp.firstname}</span>
                    <span className="text-xs text-slate-500 mt-0.5">{emp.department}</span>
                  </div>
                  <Badge variant="outline" className={isCurrentlyOnLeave ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                    {isCurrentlyOnLeave ? 'On Leave' : 'Active'}
                  </Badge>
                </div>

                <div className={`grid ${filterLeaveType === 'All Leaves' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-sm mt-1`}>
                  {filterLeaveType === 'All Leaves' ? (
                    <>
                      <div className="flex flex-col items-center bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Entitled</span>
                        <span className="font-mono font-semibold text-slate-700 mt-1">{entitlement}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Taken</span>
                        <span className={`font-mono font-bold mt-1 ${deductibleTaken > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{deductibleTaken}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Remaining</span>
                        <span className={`font-mono font-bold mt-1 ${remaining < 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{remaining}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Times Taken</span>
                        <span className="font-mono font-bold text-indigo-600 mt-1">{timesTakenSpecific}</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Days Taken</span>
                        <span className={`font-mono font-bold mt-1 ${daysTakenSpecific > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{daysTakenSpecific}</span>
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

