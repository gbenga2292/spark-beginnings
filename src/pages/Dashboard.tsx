import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
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

function computeWorkDays(year: number, monthNum: number, holidayDates: string[]): number {
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    let days = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0) continue;
        const isHoliday = holidayDates.some(hd => {
            const hDate = new Date(hd);
            return hDate.getDate() === d.getDate() && hDate.getMonth() === d.getMonth() && hDate.getFullYear() === d.getFullYear();
        });
        if (!isHoliday) days++;
    }
    return days;
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
    const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
    const attendanceRecords = useAppStore((state) => state.attendanceRecords);
    const leaves = useAppStore((state) => state.leaves);
    const holidays = useAppStore((state) => state.publicHolidays);
    const invoices = useAppStore((state) => state.invoices);
    const salaryAdvances = useAppStore((state) => state.salaryAdvances);
    const loans = useAppStore((state) => state.loans);
    const sites = useAppStore((state) => state.sites);
    const { reminders } = useAppData();

    const currentDate = new Date();

    const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());
    const [filterMonth, setFilterMonth] = useState<number | null>(currentDate.getMonth() + 1);

    // ── TOP KPI CARDS ──
    const kpiStats = useMemo(() => {
        const activeStaff = employees.filter(e => e.status === 'Active');
        const onLeave = employees.filter(e => e.status === 'On Leave');
        const monthsToProcess = filterMonth ? [filterMonth] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        // Absent count & OT count for filtered period
        let totalAbsentDays = 0;
        let totalOTInstances = 0;
        let totalPresentDays = 0;
        let totalPossibleDays = 0;

        activeStaff.forEach(emp => {
            monthsToProcess.forEach(targetMonth => {
                const officialWorkdays = computeWorkDays(filterYear, targetMonth, holidays.map(h => h.date));
                totalPossibleDays += officialWorkdays;
                let present = 0, absent = 0, ot = 0;
                for (const r of attendanceRecords) {
                    if (r.staffId === emp.id && r.mth === targetMonth && r.date.startsWith(filterYear.toString())) {
                        if (r.day?.toLowerCase() === 'yes') { present++; if (r.ot > 0) ot++; }
                        else if (r.day?.toLowerCase() === 'no') { absent++; }
                    }
                }
                totalPresentDays += present;
                totalAbsentDays += absent;
                totalOTInstances += ot;
            });
        });

        const attendanceRate = totalPossibleDays > 0 ? Math.min(100, Math.round((totalPresentDays / totalPossibleDays) * 100)) : 0;

        // Unpaid invoices count
        const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid').length;

        // Pending leave requests (leaves without a return date are considered pending)
        const pendingLeaves = leaves.filter(l => !l.dateReturned || l.dateReturned === '').length;

        // Pending salary advance requests
        const pendingAdvances = salaryAdvances.filter(a => a.status === 'Pending').length;

        // Active loans count
        const activeLoans = loans.filter(l => l.status === 'Active').length;

        // Active sites
        const activeSites = sites.filter(s => s.status === 'Active').length;

        return {
            totalActive: activeStaff.length,
            totalOnLeave: onLeave.length,
            totalAbsentDays,
            totalOTInstances,
            totalPresentDays,
            totalPossibleDays,
            attendanceRate,
            unpaidInvoices,
            pendingLeaves,
            pendingAdvances,
            activeLoans,
            activeSites,
        };
    }, [employees, attendanceRecords, holidays, filterMonth, filterYear, invoices, leaves, salaryAdvances, loans, sites]);

    // ── DEPARTMENT BREAKDOWN ──
    const deptData = useMemo(() => {
        const deptMap: Record<string, number> = {};
        employees.filter(e => e.status === 'Active').forEach(emp => {
            const dept = emp.department || 'Unassigned';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        return Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [employees]);

    // ── MONTHLY ATTENDANCE & OT TREND ──
    const attendanceTrend = useMemo(() => {
        return MONTHS.map(m => {
            const activeStaff = employees.filter(e => e.status === 'Active');
            const officialWorkdays = computeWorkDays(filterYear, m.value, holidays.map(h => h.date));
            let present = 0, absent = 0, overtime = 0;

            activeStaff.forEach(emp => {
                for (const r of attendanceRecords) {
                    if (r.staffId === emp.id && r.mth === m.value && r.date.startsWith(filterYear.toString())) {
                        if (r.day?.toLowerCase() === 'yes') { present++; if (r.ot > 0) overtime++; }
                        else if (r.day?.toLowerCase() === 'no') { absent++; }
                    }
                }
            });

            return { name: m.label.substring(0, 3), Present: present, Absent: absent, Overtime: overtime };
        });
    }, [employees, attendanceRecords, holidays, filterYear]);

    // ── HEADCOUNT GROWTH ──
    const headcountChartData = useMemo(() => {
        return MONTHS.map((m) => {
            const endOfMonthTimestamp = new Date(filterYear, m.value, 0).getTime();
            let count = 0;
            employees.forEach(emp => {
                if (emp.startDate) {
                    if (new Date(emp.startDate).getTime() <= endOfMonthTimestamp) count++;
                } else {
                    count++;
                }
            });
            return { name: m.label.substring(0, 3), Headcount: count };
        });
    }, [employees, filterYear]);

    // ── SITE STAFFING ──
    const siteStaffing = useMemo(() => {
        const siteMap: Record<string, number> = {};
        employees.filter(e => e.status === 'Active').forEach(emp => {
            const site = (emp as any).site || (emp as any).siteName || 'Unassigned';
            siteMap[site] = (siteMap[site] || 0) + 1;
        });
        return Object.entries(siteMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    }, [employees]);

    // ── LEAVE TYPE BREAKDOWN ──
    const leaveBreakdown = useMemo(() => {
        const typeMap: Record<string, number> = {};
        leaves.forEach(l => {
            if (l.startDate) {
                const d = new Date(l.startDate);
                if (d.getFullYear() === filterYear && (filterMonth === null || d.getMonth() + 1 === filterMonth)) {
                    const type = l.reason?.split(' ')[0] || 'Leave';
                    typeMap[type] = (typeMap[type] || 0) + 1;
                }
            }
        });
        return Object.entries(typeMap).map(([name, value]) => ({ name, value }));
    }, [leaves, filterYear, filterMonth]);

    // ── ALERTS ──
    const alerts = useMemo(() => {
        const ALERTS: { type: 'warning' | 'info' | 'urgent', msg: string }[] = [];

        if (kpiStats.pendingLeaves > 0) {
            ALERTS.push({ type: 'warning', msg: `${kpiStats.pendingLeaves} leave request(s) awaiting approval.` });
        }
        if (kpiStats.pendingAdvances > 0) {
            ALERTS.push({ type: 'warning', msg: `${kpiStats.pendingAdvances} salary advance request(s) pending.` });
        }
        if (kpiStats.unpaidInvoices > 0) {
            ALERTS.push({ type: 'info', msg: `${kpiStats.unpaidInvoices} invoice(s) remain unpaid.` });
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

        const activeRems = reminders.filter(r => r.isActive);
        activeRems.forEach(r => {
            const remDate = new Date(r.remindAt);
            const diffHrs = (remDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
            if (diffHrs <= 24 && diffHrs > 0) {
                ALERTS.push({ type: 'warning', msg: `Reminder: ${r.title} is due soon.` });
            } else if (diffHrs <= 0) {
                ALERTS.push({ type: 'urgent', msg: `Overdue Reminder: ${r.title}.` });
            }
        });

        if (ALERTS.length === 0) {
            ALERTS.push({ type: 'info', msg: 'No pending critical actions. Systems nominal.' });
        }

        return ALERTS;
    }, [holidays, currentDate, kpiStats, reminders]);

    const availableYears = Array.from({ length: Math.max(filterYear - 2023 + 1, 5) }, (_, i) => 2023 + i).reverse();

    return (
        <div className="flex flex-col gap-6 pb-10">
            {/* Header + Filters */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Operational & Workforce Overview</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <Filter className="h-4 w-4 text-slate-400 mx-2" />
                    <select className="bg-transparent text-sm font-medium outline-none py-1 pr-2 text-slate-700 cursor-pointer border-r border-slate-200"
                        value={filterMonth ?? ''} onChange={e => setFilterMonth(e.target.value === '' ? null : Number(e.target.value))}>
                        <option value="">All Months</option>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select className="bg-transparent text-sm font-medium outline-none py-1 pl-2 text-slate-700 cursor-pointer"
                        value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* TOP KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-3xl font-black text-emerald-600">{kpiStats.totalActive}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Staff</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                            <CalendarOff className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="text-3xl font-black text-amber-600">{kpiStats.totalOnLeave}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">On Leave</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                            <UserX className="w-5 h-5 text-rose-600" />
                        </div>
                        <div className="text-3xl font-black text-rose-600">{kpiStats.totalAbsentDays}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Absent Days</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-violet-50 flex items-center justify-center">
                            <Timer className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="text-3xl font-black text-violet-600">{kpiStats.totalOTInstances}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">OT Instances</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-sky-50 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-sky-600" />
                        </div>
                        <div className="text-3xl font-black text-sky-600">{kpiStats.unpaidInvoices}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unpaid Invoices</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="text-3xl font-black text-indigo-600">{kpiStats.activeSites}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Sites</div>
                    </CardContent>
                </Card>
            </div>

            {/* ATTENDANCE RATE HERO + ATTENDANCE/OT TREND CHART */}
            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-8 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center justify-between gap-2 text-slate-800">
                            <span className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-600" /> Attendance & Overtime Trend</span>
                            <Badge variant="outline" className="font-normal text-xs bg-white text-slate-500">{filterYear}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-[280px] w-full" style={{ minWidth: 0, minHeight: '280px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="Present" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#10b981' }} formatter={(v: any) => v > 0 ? v : ''} />
                                    </Bar>
                                    <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="Absent" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#ef4444' }} formatter={(v: any) => v > 0 ? v : ''} />
                                    </Bar>
                                    <Bar dataKey="Overtime" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="Overtime" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#8b5cf6' }} formatter={(v: any) => v > 0 ? v : ''} />
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

                    <Card className="shadow-sm border-slate-200">
                        <CardContent className="p-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 bg-amber-50 rounded-lg">
                                    <div className="text-2xl font-bold text-amber-600">{kpiStats.pendingLeaves}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 mt-1">Pending Leaves</div>
                                </div>
                                <div className="text-center p-3 bg-sky-50 rounded-lg">
                                    <div className="text-2xl font-bold text-sky-600">{kpiStats.pendingAdvances}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 mt-1">Pending Advances</div>
                                </div>
                                <div className="text-center p-3 bg-violet-50 rounded-lg">
                                    <div className="text-2xl font-bold text-violet-600">{kpiStats.activeLoans}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 mt-1">Active Loans</div>
                                </div>
                                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                                    <div className="text-2xl font-bold text-emerald-600">{kpiStats.totalPresentDays}</div>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 mt-1">Days Worked</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ROW 3: HEADCOUNT TREND + DEPARTMENT PIE + LEAVE BREAKDOWN */}
            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-5 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center justify-between gap-2 text-slate-800">
                            <span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-600" /> Headcount Growth</span>
                            <Badge variant="outline" className="font-normal text-xs bg-white text-slate-500">{filterYear}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-[220px] w-full" style={{ minWidth: 0, minHeight: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={headcountChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHeadcount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" name="Headcount" dataKey="Headcount" stroke="#10b981" strokeWidth={2} fill="url(#colorHeadcount)">
                                        <LabelList dataKey="Headcount" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#10b981' }} />
                                    </Area>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-4 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                            <Briefcase className="h-5 w-5 text-indigo-600" /> Staff by Department
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {deptData.length > 0 ? (
                            <div className="h-[220px] w-full" style={{ minWidth: 0, minHeight: '220px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`} fontSize={10}>
                                            {deptData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">No department data</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-3 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                            <CalendarCheck className="h-5 w-5 text-indigo-600" /> Leave Types
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {leaveBreakdown.length > 0 ? (
                            <div className="space-y-3">
                                {leaveBreakdown.map((item, i) => (
                                    <div key={item.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                                            <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs font-bold">{item.value}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[180px] text-slate-400 text-sm">No leave records</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ROW 4: SITE STAFFING + ACTION CENTER */}
            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-7 shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                            <MapPin className="h-5 w-5 text-indigo-600" /> Staff Distribution by Site
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {siteStaffing.length > 0 ? (
                            <div className="h-[200px] w-full" style={{ minWidth: 0, minHeight: '200px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={siteStaffing} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                        <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={100} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="count" name="Staff Count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18}>
                                            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#6366f1' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">No site assignment data</div>
                        )}
                    </CardContent>
                </Card>

                <div className="md:col-span-5 flex flex-col gap-6">
                    <Card className="flex-1 shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-200 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2 text-slate-800"><Clock className="h-5 w-5 text-indigo-600" /> Action Center</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 flex flex-col gap-4 h-full">
                            <div className="space-y-3 flex-1">
                                {alerts.map((alert, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-md text-sm font-medium ${
                                        alert.type === 'urgent' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                        alert.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                        'bg-slate-50 text-slate-600 border border-slate-100'
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

