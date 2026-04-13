import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Search, ListFilter } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { filterAndSortEmployeesExcludingCEO } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function LeaveSummary() {
  const allEmployees = useAppStore((state) => state.employees);
  const leaves = useAppStore((state) => state.leaves);
  const departments = useAppStore((state) => state.departments);

  const employees = useMemo(() => {
    const activeEmployees = allEmployees.filter(e => e.status === 'Active' || e.status === 'On Leave');
    return filterAndSortEmployeesExcludingCEO(activeEmployees);
  }, [allEmployees]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  const currentYear = new Date().getFullYear();

  // Summary logic extracted from Leaves.tsx
  const leaveSummary = useMemo(() => {
    return employees.map(emp => {
      const empLeaves = leaves.filter(l => l.employeeId === emp.id && l.status !== 'Cancelled');
      
      const totalTaken = empLeaves.reduce((acc, l) => {
        // Only count valid, non-cancelled leaves
        return acc + l.duration;
      }, 0);
      
      const entitlement = emp.yearlyLeave || 20;
      const remaining = entitlement - totalTaken;

      const isCurrentlyOnLeave = empLeaves.some(l => {
        if (!l.startDate || !l.expectedEndDate || l.status !== 'Active' || l.dateReturned) return false;
        const todayMidnight = new Date().setHours(0, 0, 0, 0);
        const start = new Date(l.startDate).setHours(0, 0, 0, 0);
        const resumptionDate = new Date(l.expectedEndDate).setHours(0, 0, 0, 0);
        return start <= todayMidnight && todayMidnight < resumptionDate;
      });

      return { emp, totalTaken, remaining, entitlement, isCurrentlyOnLeave };
    });
  }, [employees, leaves, currentYear]);

  const filteredSummary = useMemo(() => {
    return leaveSummary.filter(item => {
      const matchesSearch = `${item.emp.surname} ${item.emp.firstname}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = filterDept === 'All' || item.emp.department === filterDept;
      return matchesSearch && matchesDept;
    });
  }, [leaveSummary, searchQuery, filterDept]);

  useSetPageTitle(
    'Leave Entitlement Summary',
    `Overview of all employee leave balances for the year ${currentYear}`
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
            <div className="flex bg-slate-200/50 p-1 rounded-lg">
              <select
                className="bg-transparent border-none text-sm font-semibold text-slate-600 px-2 py-1 outline-none cursor-pointer"
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

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] tracking-wider font-bold">
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4 text-center">Entitlement</th>
                <th className="px-5 py-4 text-center">Days Taken</th>
                <th className="px-5 py-4 text-center">Remaining</th>
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
                filteredSummary.map(({ emp, totalTaken, remaining, entitlement, isCurrentlyOnLeave }) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-800 uppercase text-xs">{emp.surname} {emp.firstname}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{emp.department}</td>
                    <td className="px-5 py-3 text-center font-mono font-semibold">{entitlement}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`font-mono font-bold ${totalTaken > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{totalTaken}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`font-mono font-bold ${remaining < 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{remaining}</span>
                    </td>
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
      </Card>
    </div>
  );
}

