import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import {
    Users, AlertCircle, Clock, UserPlus, CheckCircle2, Filter,
    UserX, CalendarOff, FileText, Briefcase, TrendingUp, MapPin,
    Timer, CalendarCheck, BarChart3, UserCheck
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
    AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer,
    Tooltip, XAxis, YAxis, Legend, PieChart, Pie, Cell, LabelList
} from 'recharts';

function computeWorkDays(year: number, monthNum: number, holidayDates: string[], workDaysPerWeek: number = 6, empStartDate?: string, empEndDate?: string): number {
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    let actualStart = new Date(startDate);
    if (empStartDate) {
        const empS = new Date(empStartDate);
        if (!isNaN(empS.getTime()) && empS > actualStart) actualStart = empS;
    }

    let actualEnd = new Date(endDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (today < actualEnd) actualEnd = today;

    if (empEndDate) {
        const empE = new Date(empEndDate);
        if (!isNaN(empE.getTime()) && empE < actualEnd) actualEnd = empE;
    }

    let days = 0;
    for (let d = new Date(actualStart); d <= actualEnd; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0) continue; // Sunday
        if (workDaysPerWeek < 6 && dow === 6) continue; // Saturday
        const isHoliday = holidayDates.some(hd => {
            const hDate = new Date(hd);
            return hDate.getDate() === d.getDate() && hDate.getMonth() === d.getMonth() && hDate.getFullYear() === d.getFullYear();
        });
        if (!isHoliday) days++;
    }
    return Math.max(0, days);
}

const MONTHS = [
    { label: 'January', value: 1, key: 'jan' },
    { label: 'February', value: 2, key: 'feb' },
    { label: 'March', value: 3, key: 'mar' },
    { label: 'April', value: 4, key: 'apr' },
    { label: 'May', value: 5, key: 'may' },
    { label: 'June', value: 6, key: 'jun' },
    { label: 'July', value: 7, key: 'jul' },
    { label: 'August', value: 8, key: 'aug' },
    { label: 'September', value: 9, key: 'sep' },
    { label: 'October', value: 10, key: 'oct' },
    { label: 'November', value: 11, key: 'nov' },
    { label: 'December', value: 12, key: 'dec' },
];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function Dashboard() {
    const departments = useAppStore((state) => state.departments);
    const nonEmployeeDeptNames = useMemo(() => new Set(departments.filter(d => d.staffType === 'NON-EMPLOYEE').map(d => d.name)), [departments]);

    const employees = useAppStore((state) => state.employees).filter(e => 
        (e.status === 'Active' || e.status === 'On Leave') && 
        e.staffType?.toUpperCase() !== 'NON-EMPLOYEE' && e.staffType?.toUpperCase() !== 'NON EMPLOYEE' &&
        (!e.department || !nonEmployeeDeptNames.has(e.department))
    );
    const attendanceRecords = useAppStore((state) => state.attendanceRecords);
    const leaves = useAppStore((state) => state.leaves);
    const holidays = useAppStore((state) => state.publicHolidays);
    const salaryAdvances = useAppStore((state) => state.salaryAdvances);
    const loans = useAppStore((state) => state.loans);
    const sites = useAppStore((state) => state.sites).filter(s => s.name?.toUpperCase() !== 'DCEL' && s.name?.toUpperCase() !== 'OFFICE');
    const payrollVariables = useAppStore((state) => state.payrollVariables);
    const { reminders } = useAppData();

    const currentDate = new Date();

    const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());
    const [filterMonth, setFilterMonth] = useState<number | null>(currentDate.getMonth() + 1);
    const [chartViewMode, setChartViewMode] = useState<'capacity' | 'efficiency' | 'employee'>('capacity');

    // ── TOP KPI CARDS ──
    const kpiStats = useMemo(() => {
        const historicallyActiveStaff = employees.filter(e => {
            if (e.status !== 'Active' && !e.endDate) return false;
            if (e.staffType === 'NON-EMPLOYEE') return false; 
            return true;
        });

        const monthsToProcess = filterMonth ? [filterMonth] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        // Absent count & OT count for filtered period
        let totalAbsentDays = 0;
        let totalOTInstances = 0;
        let totalPresentDays = 0;
        let totalPossibleDays = 0;

        historicallyActiveStaff.forEach(emp => {
                    const deptObj = departments.find(d => d.name === (emp.department || ''));
                    const wDays = deptObj?.workDaysPerWeek ?? (emp.staffType === 'OFFICE' ? 5 : 6);


            monthsToProcess.forEach(targetMonth => {
                const startOfViewingMonth = new Date(filterYear, targetMonth - 1, 1);
                const endOfViewingMonth = new Date(filterYear, targetMonth, 0);

                if (emp.startDate && new Date(emp.startDate) > endOfViewingMonth) return;
                if (emp.endDate && new Date(emp.endDate) < startOfViewingMonth) return;

                const daysInMth = endOfViewingMonth.getDate();

                for (let day = 1; day <= daysInMth; day++) {
                    const dateStr = `${filterYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dDate = new Date(filterYear, targetMonth - 1, day);
                    
                    if (emp.startDate && new Date(emp.startDate) > dDate) continue;
                    if (emp.endDate && new Date(emp.endDate) < dDate) continue;

                    const isSun = dDate.getDay() === 0;
                    const isSat = dDate.getDay() === 6;
                    const isHol = holidays.some(h => h.date === dateStr);
                    
                    let shouldBeWorking = !isSun && !isHol;
                    if (wDays < 6 && isSat) shouldBeWorking = false;

                    if (shouldBeWorking) totalPossibleDays++;

                    const r = attendanceRecords.find(x => x.date === dateStr && x.staffId === emp.id);

                    if (r) {
                        const isDay = r.day?.toLowerCase() === 'yes';
                        const isNight = r.night?.toLowerCase() === 'yes';
                        const worked = isDay || isNight;
                        const isOffDay = !shouldBeWorking; // true if Sunday, Holiday, or 5-day-Sat
                        const hasOt = (r.overtimeDetails && r.overtimeDetails.trim() !== '') || (r.ot || 0) > 0 || (isOffDay && worked) || (isDay && isNight);

                        if (worked) {
                            if (shouldBeWorking) {
                                totalPresentDays++;
                            }
                            if (hasOt) totalOTInstances++;
                        } else if (r.day?.toLowerCase() === 'no' || r.night?.toLowerCase() === 'no') {
                            if (shouldBeWorking) {
                                totalAbsentDays++;
                            }
                        } else if (emp.staffType === 'OFFICE' && shouldBeWorking) {
                            totalPresentDays++;
                        }
                    } else {
                        if (emp.staffType === 'OFFICE' && shouldBeWorking) {
                            totalPresentDays++;
                        }
                    }
                }
            });
        });

        const attendanceRate = totalPossibleDays > 0 ? Math.min(100, Math.round((totalPresentDays / totalPossibleDays) * 100)) : 0;


        // --- Leave logic ---
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        // "On Leave Now": leave has started on/before today, not yet past expectedEndDate, and employee hasn't returned
        const currentlyOnLeave = leaves.filter(l => {
            if (l.status === 'Cancelled') return false;
            if (l.dateReturned && l.dateReturned !== '') return false;
            const start = new Date(l.startDate);
            const resumptionDate = new Date(l.expectedEndDate);
            start.setHours(0, 0, 0, 0);
            resumptionDate.setHours(0, 0, 0, 0);
            return start <= todayMidnight && todayMidnight < resumptionDate;
        }).length;

        // "Pending Leaves": not yet started (future) AND no dateReturned — excludes anyone currently mid-leave
        const pendingLeaves = leaves.filter(l => {
            if (l.status === 'Cancelled') return false;
            if (l.dateReturned && l.dateReturned !== '') return false;
            const start = new Date(l.startDate);
            start.setHours(0, 0, 0, 0);
            return start > todayMidnight;
        }).length;

        // Pending salary advance requests
        const pendingAdvances = salaryAdvances.filter(a => a.status === 'Pending').length;

        // Active loans count
        const activeLoans = loans.filter(l => l.status === 'Active').length;

        // Active sites
        const activeSites = sites.filter(s => s.status === 'Active').length;

        return {
            totalActive: historicallyActiveStaff.length,
            totalOnLeave: currentlyOnLeave,
            totalAbsentDays,
            totalOTInstances,
            totalPresentDays,
            totalPossibleDays,
            attendanceRate,
            pendingLeaves,
            pendingAdvances,
            activeLoans,
            activeSites,
        };
    }, [employees, attendanceRecords, holidays, filterMonth, filterYear, leaves, salaryAdvances, loans, sites, departments]);

    // ── DEPARTMENT BREAKDOWN ──
    const deptData = useMemo(() => {
        const deptMap: Record<string, number> = {};
        employees.filter(e => e.status === 'Active').forEach(emp => {
            const dept = emp.department || 'Unassigned';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        return Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [employees]);

    // ── DYNAMIC ATTENDANCE & OT TREND ──
    const attendanceTrend = useMemo(() => {
        const historicallyActiveStaff = employees.filter(e => {
            if (e.status !== 'Active' && !e.endDate) return false;
            if (e.staffType === 'NON-EMPLOYEE') return false; 
            return true;
        });
        const activeCount = historicallyActiveStaff.length || 1;

        if (filterMonth) {
            // --> 1. SPECIFIC MONTH SELECTED: Show Day-by-Day exact Headcount
            const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
            const dailyData = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                let present = 0, absent = 0, overtime = 0;
                
                // Track how many employees were actually employed and supposed to work on this specific day
                let expectedStaffForDay = 0;
                const dDate = new Date(filterYear, filterMonth - 1, day);
                
                // Exclude Sundays and Holidays from expectations
                const isSun = dDate.getDay() === 0;
                const isSat = dDate.getDay() === 6;
                const isHol = holidays.some(h => h.date === dateStr);

                historicallyActiveStaff.forEach(emp => {
                    if (emp.startDate && new Date(emp.startDate) > dDate) return;
                    if (emp.endDate && new Date(emp.endDate) < dDate) return;

                            const deptObj = departments.find(d => d.name === (emp.department || ''));
                    const wDays = deptObj?.workDaysPerWeek ?? (emp.staffType === 'OFFICE' ? 5 : 6);

                    
                    let shouldBeWorking = !isSun && !isHol;
                    if (wDays < 6 && isSat) shouldBeWorking = false;
                    
                    if (shouldBeWorking) expectedStaffForDay++;

                    const r = attendanceRecords.find(x => x.date === dateStr && x.staffId === emp.id);
                    if (r) {
                        const isDay = r.day?.toLowerCase() === 'yes';
                        const isNight = r.night?.toLowerCase() === 'yes';
                        const worked = isDay || isNight;
                        const isOffDay = !shouldBeWorking;
                        const hasOt = (r.overtimeDetails && r.overtimeDetails.trim() !== '') || (r.ot || 0) > 0 || (isOffDay && worked) || (isDay && isNight);

                        if (worked) {
                            if (shouldBeWorking) {
                                present++;
                            }
                            if (hasOt) overtime++;
                        } else if (r.day?.toLowerCase() === 'no' || r.night?.toLowerCase() === 'no') {
                            if (shouldBeWorking) {
                                absent++;
                            }
                        } else if (emp.staffType === 'OFFICE' && shouldBeWorking) {
                            present++;
                        }
                    } else {
                        if (emp.staffType === 'OFFICE' && shouldBeWorking) {
                            present++;
                        }
                    }
                });

                // Force minimum 1 to avoid division by zero
                const dailyActiveCount = expectedStaffForDay || 1;
                
                let p = present, a = absent, o = overtime;
                
                if (chartViewMode === 'efficiency') {
                    p = Math.round((present / dailyActiveCount) * 100);
                    a = Math.round((absent / dailyActiveCount) * 100);
                    o = present > 0 ? Math.round((overtime / present) * 100) : 0;
                } else if (chartViewMode === 'employee') {
                    p = Number((present / dailyActiveCount).toFixed(2));
                    a = Number((absent / dailyActiveCount).toFixed(2));
                    o = Number((overtime / dailyActiveCount).toFixed(2));
                }

                dailyData.push({ name: `${day}`, Present: p, Absent: a, Overtime: o });
            }
            return dailyData;
            
        } else {
            // --> 2. ALL MONTHS SELECTED: Yearly View
            return MONTHS.map(m => {
                let present = 0, absent = 0, overtime = 0;
                let exactMonthlyPossibleDays = 0;
                let aggregateBaseWorkdays = 0; // The theoretical maximum capacity if everyone worked their respective days
                let monthlyActiveCount = 0; // Track how many staff were actually eligible to work this month

                historicallyActiveStaff.forEach(emp => {
                    const startOfViewingMonth = new Date(filterYear, m.value - 1, 1);
                    const endOfViewingMonth = new Date(filterYear, m.value, 0);

                    if (emp.startDate && new Date(emp.startDate) > endOfViewingMonth) return;
                    if (emp.endDate && new Date(emp.endDate) < startOfViewingMonth) return;

                    monthlyActiveCount++;

                            const deptObj = departments.find(d => d.name === (emp.department || ''));
                    const wDays = deptObj?.workDaysPerWeek ?? (emp.staffType === 'OFFICE' ? 5 : 6);

                    
                    // Daily iteration for precise monthly tracking (matching kpiStats)
                    const daysInMth = endOfViewingMonth.getDate();
                    for (let day = 1; day <= daysInMth; day++) {
                        const dateStr = `${filterYear}-${String(m.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dDate = new Date(filterYear, m.value - 1, day);
                        
                        if (emp.startDate && new Date(emp.startDate) > dDate) continue;
                        if (emp.endDate && new Date(emp.endDate) < dDate) continue;

                        const isSun = dDate.getDay() === 0;
                        const isSat = dDate.getDay() === 6;
                        const isHol = holidays.some(h => h.date === dateStr);
                        
                        let shouldBeWorking = !isSun && !isHol;
                        if (wDays < 6 && isSat) shouldBeWorking = false;

                        if (shouldBeWorking) {
                            aggregateBaseWorkdays++;
                            exactMonthlyPossibleDays++;
                        }

                        const r = attendanceRecords.find(x => x.date === dateStr && x.staffId === emp.id);

                        if (r) {
                            const isDay = r.day?.toLowerCase() === 'yes';
                            const isNight = r.night?.toLowerCase() === 'yes';
                            const worked = isDay || isNight;
                            const isOffDay = !shouldBeWorking;
                            const hasOt = (r.overtimeDetails && r.overtimeDetails.trim() !== '') || (r.ot || 0) > 0 || (isOffDay && worked) || (isDay && isNight);

                            if (worked) {
                                if (shouldBeWorking) {
                                    present++;
                                }
                                if (hasOt) overtime++;
                            } else if (r.day?.toLowerCase() === 'no' || r.night?.toLowerCase() === 'no') {
                                if (shouldBeWorking) {
                                    absent++;
                                }
                            } else if (emp.staffType === 'OFFICE' && shouldBeWorking) {
                                present++;
                            }
                        } else {
                            if (emp.staffType === 'OFFICE' && shouldBeWorking) {
                                present++;
                            }
                        }
                    }
                });

                let p = 0, a = 0, o = 0;
                const dynamicCurrentActive = exactMonthlyPossibleDays > 0 ? (exactMonthlyPossibleDays / (aggregateBaseWorkdays / (monthlyActiveCount || 1))) || 1 : 1;
                
                if (chartViewMode === 'capacity') {
                    // Show exact total Man-Days for the month
                    p = present;
                    a = absent;
                    o = overtime;
                } else if (chartViewMode === 'efficiency') {
                    p = exactMonthlyPossibleDays > 0 ? Math.round((present / exactMonthlyPossibleDays) * 100) : 0;
                    a = exactMonthlyPossibleDays > 0 ? Math.round((absent / exactMonthlyPossibleDays) * 100) : 0;
                    o = present > 0 ? Math.round((overtime / present) * 100) : 0;
                } else if (chartViewMode === 'employee') {
                    p = Number((present / dynamicCurrentActive).toFixed(1));
                    a = Number((absent / dynamicCurrentActive).toFixed(1));
                    o = Number((overtime / dynamicCurrentActive).toFixed(1));
                }

                return { name: m.label.substring(0, 3), Present: p, Absent: a, Overtime: o };
            });
        }
    }, [employees, attendanceRecords, holidays, filterYear, filterMonth, chartViewMode, departments]);

    // ── HEADCOUNT GROWTH ──
    const headcountChartData = useMemo(() => {
        return MONTHS.map((m) => {
            const startOfMonthTimestamp = new Date(filterYear, m.value - 1, 1).getTime();
            const endOfMonthTimestamp = new Date(filterYear, m.value, 0).getTime();
            let count = 0;
            employees.forEach(emp => {
                if (emp.staffType !== 'FIELD' && emp.staffType !== 'OFFICE') return;
                
                if (emp.endDate && new Date(emp.endDate).getTime() < startOfMonthTimestamp) return;

                if (emp.startDate) {
                    if (new Date(emp.startDate).getTime() <= endOfMonthTimestamp) count++;
                } else {
                    count++;
                }
            });
            return { name: m.label.substring(0, 3), Headcount: count };
        });
    }, [employees, filterYear]);

    // ── POSITION STAFFING ──
    const positionStaffing = useMemo(() => {
        const positionMap: Record<string, number> = {};
        employees.filter(e => e.status === 'Active').forEach(emp => {
            const pos = emp.position || 'Unassigned';
            positionMap[pos] = (positionMap[pos] || 0) + 1;
        });
        return Object.entries(positionMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    }, [employees]);



    // ── ALERTS ──
    const alerts = useMemo(() => {
        const ALERTS: { type: 'warning' | 'info' | 'urgent', msg: string }[] = [];

        if (kpiStats.pendingLeaves > 0) {
            ALERTS.push({ type: 'warning', msg: `${kpiStats.pendingLeaves} leave request(s) awaiting approval.` });
        }
        if (kpiStats.pendingAdvances > 0) {
            ALERTS.push({ type: 'warning', msg: `${kpiStats.pendingAdvances} salary advance request(s) pending.` });
        }

        const futureHolidays = holidays.map(h => ({ ...h, d: new Date(h.date) })).filter(h => h.d >= currentDate).sort((a, b) => a.d.getTime() - b.d.getTime());
        if (futureHolidays.length > 0) {
            const nextHol = futureHolidays[0];
            const daysUntil = Math.ceil((nextHol.d.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
            if (daysUntil <= 14) ALERTS.push({ type: 'warning', msg: `Upcoming Public Holiday: ${nextHol.name} in ${daysUntil} day(s).` });
        }

        if (kpiStats.attendanceRate < 70 && kpiStats.totalPossibleDays > 0) {
            ALERTS.push({ type: 'urgent', msg: `Low attendance rate: ${kpiStats.attendanceRate}% — review staffing.` });
        }

        if (ALERTS.length === 0) {
            ALERTS.push({ type: 'info', msg: 'No pending critical actions. Systems nominal.' });
        }

        return ALERTS;
    }, [holidays, currentDate, kpiStats, reminders]);

    const availableYears = Array.from({ length: Math.max(filterYear - 2023 + 1, 5) }, (_, i) => 2023 + i).reverse();

    useSetPageTitle(
        'Dashboard',
        'Operational & Workforce Overview',
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <Filter className="h-4 w-4 text-slate-400 mx-2 hidden sm:block" />
            <select className="bg-transparent text-sm font-medium outline-none py-1 pr-2 text-slate-700 dark:text-slate-200 cursor-pointer border-r border-slate-200 dark:border-slate-600"
                value={filterMonth ?? ''} onChange={e => setFilterMonth(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">All Months</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="bg-transparent text-sm font-medium outline-none py-1 pl-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 pb-10">
            {/* TOP KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <Card className="shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{kpiStats.totalActive}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Staff</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                            <CalendarOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{kpiStats.totalOnLeave}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">On Leave</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                            <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">{kpiStats.totalAbsentDays}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Absent Days</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-violet-600 dark:text-violet-400">{kpiStats.totalOTInstances}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">OT Instances</div>
                    </CardContent>
                </Card>



                <Card className="shadow-sm">
                    <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">{kpiStats.activeSites}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Sites</div>
                    </CardContent>
                </Card>
            </div>

            {/* ATTENDANCE RATE HERO + ATTENDANCE/OT TREND CHART */}
            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-8 shadow-sm">
                    <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 pb-4">
                        <CardTitle className="text-sm sm:text-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-800 dark:text-slate-100">
                            <span className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-500" /> <span className="truncate">Attendance & OT Trend</span></span>
                            <div className="flex items-center gap-2">
                                <select
                                    className="text-xs font-medium bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-1 px-2 rounded outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    value={chartViewMode}
                                    onChange={(e) => setChartViewMode(e.target.value as any)}
                                >
                                    <option value="capacity">Operational Capacity</option>
                                    <option value="efficiency">Efficiency Rate (%)</option>
                                    <option value="employee">Per Employee Average</option>
                                </select>
                                <Badge variant="outline" className="font-normal text-xs bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-500 dark:text-slate-300">{filterYear}</Badge>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-[280px] w-full" style={{ minWidth: 0, minHeight: '280px' }}>
                            <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                                <BarChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', backgroundColor: 'rgba(30,41,59,0.95)', color: '#f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)' }} />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="Absent" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#ef4444' }} formatter={(v: any) => v > 0 ? (chartViewMode === 'efficiency' ? `${v}%` : v) : ''} />
                                    </Bar>
                                    <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="Present" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#10b981' }} formatter={(v: any) => v > 0 ? (chartViewMode === 'efficiency' ? `${v}%` : v) : ''} />
                                    </Bar>
                                    <Bar dataKey="Overtime" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="Overtime" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#8b5cf6' }} formatter={(v: any) => v > 0 ? (chartViewMode === 'efficiency' ? `${v}%` : v) : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* ATTENDANCE RATE + QUICK STATS */}
                <div className="md:col-span-4 flex flex-col gap-6">
                    <Card className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white border-0 shadow-xl overflow-hidden relative flex-1">
                        <div className="absolute right-0 top-0 opacity-10">
                            <Users className="w-32 h-32 -mt-4 -mr-4" />
                        </div>
                        <CardContent className="p-6 flex flex-col items-center justify-center h-full relative z-10 gap-2">
                            <div className="text-7xl font-black">{kpiStats.attendanceRate}%</div>
                            <div className="text-sm font-semibold text-indigo-200 uppercase tracking-widest">Attendance Rate</div>
                            <div className="text-[10px] text-indigo-300 mt-1">
                                {filterMonth ? MONTHS.find(m => m.value === filterMonth)?.label : 'All Months'} {filterYear}
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                                <div className="bg-emerald-400 h-2 rounded-full transition-all" style={{ width: `${kpiStats.attendanceRate}%` }}></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardContent className="p-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{kpiStats.pendingLeaves}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mt-1">Pending Leaves</div>
                                </div>
                                <div className="text-center p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{kpiStats.pendingAdvances}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mt-1">Pending Advances</div>
                                </div>
                                <div className="text-center p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{kpiStats.activeLoans}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mt-1">Active Loans</div>
                                </div>
                                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{kpiStats.totalPresentDays}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mt-1">Days Worked</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ROW 3: HEADCOUNT TREND + DEPARTMENT PIE */}
            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-7 shadow-sm">
                    <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 pb-4">
                        <CardTitle className="text-lg flex items-center justify-between gap-2 text-slate-800 dark:text-slate-100">
                            <span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-500" /> Headcount Growth</span>
                            <Badge variant="outline" className="font-normal text-xs bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-500 dark:text-slate-300">{filterYear}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-[220px] w-full" style={{ minWidth: 0, minHeight: '220px' }}>
                            <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                                <AreaChart data={headcountChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHeadcount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', backgroundColor: 'rgba(30,41,59,0.95)', color: '#f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)' }} />
                                    <Area type="monotone" name="Headcount" dataKey="Headcount" stroke="#10b981" strokeWidth={2} fill="url(#colorHeadcount)">
                                        <LabelList dataKey="Headcount" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#10b981' }} />
                                    </Area>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-5 shadow-sm">
                    <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <Briefcase className="h-5 w-5 text-indigo-500" /> Staff by Department
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {deptData.length > 0 ? (
                            <div className="h-[220px] w-full" style={{ minWidth: 0, minHeight: '220px' }}>
                                <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`} fontSize={10}>
                                            {deptData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', backgroundColor: 'rgba(30,41,59,0.95)', color: '#f1f5f9' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[220px] text-slate-400 dark:text-slate-500 text-sm">No department data</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ROW 4: POSITION STAFFING + ACTION CENTER */}
            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-7 shadow-sm">
                    <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <Briefcase className="h-5 w-5 text-indigo-500" /> Staff Distribution by Position
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {positionStaffing.length > 0 ? (
                            <div className="h-[200px] w-full" style={{ minWidth: 0, minHeight: '200px' }}>
                                <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                                    <BarChart data={positionStaffing} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.15)" />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={100} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid rgba(148,163,184,0.2)', backgroundColor: 'rgba(30,41,59,0.95)', color: '#f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)' }} />
                                        <Bar dataKey="count" name="Staff Count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18}>
                                            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#818cf8' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-slate-400 dark:text-slate-500 text-sm">No position assignment data</div>
                        )}
                    </CardContent>
                </Card>

                <div className="md:col-span-5 flex flex-col gap-6">
                    <Card className="flex-1 shadow-sm">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-slate-100"><Clock className="h-5 w-5 text-indigo-500" /> Action Center</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 pb-5 flex flex-col gap-4">
                            <div className="space-y-3 pr-2 overflow-y-auto max-h-[280px] custom-scrollbar">
                                {alerts.map((alert, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-md text-sm font-medium ${
                                        alert.type === 'urgent' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800/50' :
                                        alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800/50' :
                                        'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                                    }`}>
                                        {alert.type === 'urgent' && <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />}
                                        {alert.type === 'warning' && <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />}
                                        {alert.type === 'info' && <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />}
                                        <p>{alert.msg}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

