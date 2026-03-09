import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useAppStore } from '@/src/store/appStore';
import {
    Users, UserMinus, DollarSign, TrendingUp, AlertCircle,
    Clock, UserPlus, FileSpreadsheet, CheckCircle2, CreditCard, Backpack,
    Filter
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { LineChart, Line, AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

function computeWorkDays(year: number, monthNum: number, holidayDates: string[]): number {
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    let days = 0;
    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
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

const fm = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

export function Dashboard() {
    const employees = useAppStore((state) => state.employees).filter(e => e.status !== 'Terminated');
    const attendanceRecords = useAppStore((state) => state.attendanceRecords);
    const salaryAdvances = useAppStore((state) => state.salaryAdvances);
    const loans = useAppStore((state) => state.loans);
    const leaves = useAppStore((state) => state.leaves);
    const holidays = useAppStore((state) => state.publicHolidays);
    const monthValues = useAppStore((state) => state.monthValues);
    const payrollVariables = useAppStore((state) => state.payrollVariables);

    const currentDate = new Date();

    // Global Filters
    const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());
    const [filterMonth, setFilterMonth] = useState<number>(currentDate.getMonth() + 1);

    const monthKey = MONTHS.find(m => m.value === filterMonth)?.key || 'jan';

    // 1. FINANCIAL CALCULATIONS (For Selected Month & Year)
    const financeStats = useMemo(() => {
        let totalGrossExposure = 0;
        let totalStatutory = 0;
        let totalOvertimeCost = 0;

        const officialWorkdays = computeWorkDays(filterYear, filterMonth, holidays.map(h => h.date));
        const monthConfig = monthValues[monthKey] || { workDays: officialWorkdays, overtimeRate: 0.5 };
        const otRate = monthConfig.overtimeRate;

        employees.filter(e => e.status === 'Active').forEach(emp => {
            const standardSalary = emp.monthlySalaries[monthKey as keyof typeof emp.monthlySalaries] || 0;
            let daysWorked = 0;
            let daysAbsent = 0;
            let otInstances = 0;

            for (const r of attendanceRecords) {
                if (r.staffId === emp.id && r.mth === filterMonth && r.date.startsWith(filterYear.toString())) {
                    if (r.day?.toLowerCase() === 'yes') {
                        daysWorked++;
                        if (r.ot > 0) otInstances++;
                    } else if (r.day?.toLowerCase() === 'no') {
                        daysAbsent++;
                    }
                }
            }

            if (daysWorked > officialWorkdays) daysWorked = officialWorkdays;

            let salary = 0;
            let overtime = 0;

            if (standardSalary > 0 && officialWorkdays > 0) {
                const dailyRate = standardSalary / officialWorkdays;
                const isOperations = ['OPERATIONS', 'ENGINEERING'].includes(emp.department.toUpperCase());

                if (isOperations) {
                    salary = dailyRate * daysWorked;
                } else {
                    salary = standardSalary - (dailyRate * daysAbsent);
                    if (salary < 0) salary = 0;
                }
                overtime = otInstances * (dailyRate * (1 + otRate));
                totalOvertimeCost += overtime;
            }

            const grossPay = salary + overtime;
            totalGrossExposure += grossPay;

            if (emp.payeTax) {
                const basic = salary * (payrollVariables.basic / 100);
                const housing = salary * (payrollVariables.housing / 100);
                const transport = salary * (payrollVariables.transport / 100);
                const pensionSum = basic + housing + transport;

                const pension = pensionSum * (payrollVariables.employeePensionRate / 100);
                const employerPension = pensionSum * (payrollVariables.employerPensionRate / 100);
                const nsitf = grossPay * ((payrollVariables.nsitfRate || 1) / 100);

                const estimatedPAYE = grossPay > 60000 ? (grossPay * 0.10) : 0;
                totalStatutory += (pension + employerPension + nsitf + estimatedPAYE);
            }
        });

        let outstandingLoans = 0;
        salaryAdvances.forEach(a => {
            if (a.status === 'Approved') outstandingLoans += a.amount;
        });
        loans.forEach(l => {
            if (l.status === 'Active') outstandingLoans += l.remainingBalance;
        });

        return { totalGrossExposure, totalStatutory, totalOvertimeCost, outstandingLoans };
    }, [employees, attendanceRecords, monthKey, holidays, payrollVariables, monthValues, filterMonth, filterYear, salaryAdvances, loans]);

    // 2. OPERATIONAL HEALTH (For Selected Month & Year)
    const opsStats = useMemo(() => {
        const activeStaff = employees.filter(e => e.status === 'Active');

        let presentOps = 0;
        let possibleOpsDays = 0;

        const officialWorkdays = computeWorkDays(filterYear, filterMonth, holidays.map(h => h.date));
        const opsStaff = activeStaff.filter(e => ['OPERATIONS', 'ENGINEERING'].includes(e.department.toUpperCase()));

        // We calculate an aggregate attendance rate for the entire selected month
        opsStaff.forEach(emp => {
            let presentCount = 0;
            for (const r of attendanceRecords) {
                if (r.staffId === emp.id && r.mth === filterMonth && r.date.startsWith(filterYear.toString())) {
                    if (r.day?.toLowerCase() === 'yes') presentCount++;
                }
            }
            presentOps += presentCount;
            possibleOpsDays += officialWorkdays; // assuming they should be there every workday
        });

        let attendanceRate = 0;
        if (possibleOpsDays > 0) {
            attendanceRate = Math.round((presentOps / possibleOpsDays) * 100);
            if (attendanceRate > 100) attendanceRate = 100;
        }

        return { presentOps, possibleOpsDays, expectedOps: opsStaff.length, attendanceRate };
    }, [employees, attendanceRecords, filterMonth, filterYear, holidays]);


    // 3. HR PULSE & CHART DATA
    const hrStats = useMemo(() => {
        const totalActive = employees.filter(e => e.status === 'Active').length;
        const totalOnLeave = employees.filter(e => e.status === 'On Leave').length;

        // Headcount Growth Chart logic (based on filterYear)
        const headcountChartData = MONTHS.map((m) => {
            const endOfMonthTimestamp = new Date(filterYear, m.value, 0).getTime();
            let count = 0;
            employees.forEach(emp => {
                if (emp.startDate) {
                    const startTs = new Date(emp.startDate).getTime();
                    if (startTs <= endOfMonthTimestamp) count++;
                } else {
                    count++; // Assume active if no start date
                }
            });
            return {
                name: m.label.substring(0, 3),
                Headcount: count,
            };
        });

        return { totalActive, totalOnLeave, headcountChartData };
    }, [employees, filterYear]);


    // Annual Payroll & Overtime Trend (based on filterYear)
    const chartData = useMemo(() => {
        return MONTHS.map((m) => {
            const targetMonthIdx = m.value;
            let totalPayroll = 0;
            let totalOvertime = 0;

            const officialWorkdays = computeWorkDays(filterYear, targetMonthIdx, holidays.map(h => h.date));
            const monthConfig = monthValues[m.key] || { workDays: officialWorkdays, overtimeRate: 0.5 };
            const otRate = monthConfig.overtimeRate;

            employees.filter(e => e.status === 'Active').forEach(emp => {
                const standardSalary = emp.monthlySalaries[m.key as keyof typeof emp.monthlySalaries] || 0;
                let daysWorked = 0;
                let daysAbsent = 0;
                let otInstances = 0;

                for (const r of attendanceRecords) {
                    if (r.staffId === emp.id && r.mth === targetMonthIdx && r.date.startsWith(filterYear.toString())) {
                        if (r.day?.toLowerCase() === 'yes') {
                            daysWorked++;
                            if (r.ot > 0) otInstances++;
                        } else if (r.day?.toLowerCase() === 'no') {
                            daysAbsent++;
                        }
                    }
                }

                if (daysWorked > officialWorkdays) daysWorked = officialWorkdays;

                let salary = 0;
                let overtime = 0;

                if (standardSalary > 0 && officialWorkdays > 0) {
                    const dailyRate = standardSalary / officialWorkdays;
                    const isOperations = ['OPERATIONS', 'ENGINEERING'].includes(emp.department.toUpperCase());

                    if (isOperations) {
                        salary = dailyRate * daysWorked;
                    } else {
                        salary = standardSalary - (dailyRate * daysAbsent);
                        if (salary < 0) salary = 0;
                    }
                    overtime = otInstances * (dailyRate * (1 + otRate));
                }

                totalPayroll += (salary + overtime);
                totalOvertime += overtime;
            });

            return {
                name: m.label.substring(0, 3),
                Payroll: totalPayroll,
                Overtime: totalOvertime,
            };
        });
    }, [employees, attendanceRecords, holidays, monthValues, filterYear]);


    // 4. ACTIONABLE ALERTS (Removed salary advances / loans per user request)
    const alerts = useMemo(() => {
        const ALERTS: { type: 'warning' | 'info' | 'urgent', msg: string }[] = [];

        // Next public holiday
        const futureHolidays = holidays.map(h => ({ ...h, d: new Date(h.date) })).filter(h => h.d >= currentDate).sort((a, b) => a.d.getTime() - b.d.getTime());
        if (futureHolidays.length > 0) {
            const nextHol = futureHolidays[0];
            const daysUntil = Math.ceil((nextHol.d.getTime() - currentDate.getTime()) / (1000 * 3600 * 24));
            if (daysUntil <= 14) ALERTS.push({ type: 'warning', msg: `Upcoming Public Holiday: ${nextHol.name} in ${daysUntil} day(s).` });
        }

        if (ALERTS.length === 0) {
            ALERTS.push({ type: 'info', msg: 'No pending critical actions. Systems nominal.' });
        }

        return ALERTS;
    }, [holidays, currentDate]);

    const availableYears = Array.from({ length: Math.max(filterYear - 2023 + 1, 5) }, (_, i) => 2023 + i).reverse();

    return (
        <div className="flex flex-col gap-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Live Organizational Overview</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <Filter className="h-4 w-4 text-slate-400 mx-2" />
                    <select
                        className="bg-transparent text-sm font-medium outline-none py-1 pr-2 text-slate-700 hover:text-indigo-600 cursor-pointer border-r border-slate-200"
                        value={filterMonth}
                        onChange={e => setFilterMonth(Number(e.target.value))}
                    >
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select
                        className="bg-transparent text-sm font-medium outline-none py-1 pl-2 text-slate-700 hover:text-indigo-600 cursor-pointer"
                        value={filterYear}
                        onChange={e => setFilterYear(Number(e.target.value))}
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* ZONE 1: FINANCIAL HEADER */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white border-0 shadow-xl overflow-hidden relative">
                    <div className="absolute right-0 top-0 opacity-10">
                        <DollarSign className="w-32 h-32 -mt-4 -mr-4" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-indigo-200 uppercase tracking-widest flex justify-between">
                            Payroll Exposure <Badge variant="outline" className="text-[10px] text-white/60 border-white/20">{MONTHS.find(m => m.value === filterMonth)?.label} {filterYear}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-black mb-1">₦{fm(financeStats.totalGrossExposure)}</div>
                        <p className="text-xs text-indigo-300 flex items-center mt-1 font-medium">
                            Gross liability based on specific month attendance.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-[0.03] text-rose-500">
                        <Backpack className="w-32 h-32 -mt-4 -mr-4" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-widest flex justify-between items-center gap-2">
                            Est. Statutory Liab.
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900 mb-1">₦{fm(financeStats.totalStatutory)}</div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            Projected PAYE, Pension & NSITF.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-[0.03] text-amber-500">
                        <CreditCard className="w-32 h-32 -mt-4 -mr-4" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-widest">Active Outstanding Adv.</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900 mb-1">₦{fm(financeStats.outstandingLoans)}</div>
                        <p className="text-xs text-slate-500 flex items-center mt-1">
                            <TrendingUp className="h-3 w-3 mr-1 text-slate-400" /> Capital returning to company.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ZONE 1.5: PAYROLL CHART */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-lg flex items-center justify-between gap-2 text-slate-800">
                        <span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-600" /> Annual Payroll & Overtime Trend (Gross)</span>
                        <Badge variant="outline" className="font-normal text-xs bg-white text-slate-500">{filterYear} Performance</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => value >= 1000000 ? `₦${(value / 1000000).toFixed(1)}M` : `₦${(value / 1000).toFixed(0)}k`}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#f59e0b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => value >= 1000000 ? `₦${(value / 1000000).toFixed(1)}M` : `₦${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number | undefined) => `₦${(value ?? 0).toLocaleString()}`}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Line yAxisId="left" type="monotone" name="Total Gross Payroll" dataKey="Payroll" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                <Line yAxisId="right" type="monotone" name="Overtime Burn" dataKey="Overtime" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-12">
                {/* ZONE 2: OPERATIONS & HEADCOUNT TREND */}
                <Card className="md:col-span-7 flex flex-col shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <CardTitle className="text-lg flex items-center justify-between gap-2 text-slate-800">
                            <span className="flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600" /> Headcount Growth</span>
                            <Badge variant="outline" className="font-normal text-xs bg-white text-slate-500">{filterYear} Performance</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 flex flex-col gap-6">

                        <div className="flex gap-8 items-center justify-between px-4 pb-2">
                            <div className="text-center">
                                <div className="text-6xl font-black text-emerald-600">{opsStats.attendanceRate}%</div>
                                <div className="text-sm font-semibold text-slate-500 mt-2 uppercase tracking-wider">Average Attendance rate</div>
                                <div className="text-[10px] text-slate-400 mt-1">For Operations across {MONTHS.find(m => m.value === filterMonth)?.label}</div>
                            </div>

                            <div className="h-20 w-px bg-slate-200 hidden sm:block"></div>

                            <div className="text-center">
                                <div className="text-4xl font-bold text-amber-500">₦{fm(financeStats.totalOvertimeCost)}</div>
                                <div className="text-sm font-semibold text-slate-500 mt-2 uppercase tracking-wider">Total Overtime Burn</div>
                                <div className="text-[10px] text-slate-400 mt-1">Paid to Ops staff in {MONTHS.find(m => m.value === filterMonth)?.label}</div>
                            </div>
                        </div>

                        <div className="h-[200px] w-full mt-auto">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hrStats.headcountChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHeadcount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" name="Total Human Capital" dataKey="Headcount" stroke="#10b981" strokeWidth={2} fill="url(#colorHeadcount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* ZONE 3 & 4: HR PULSE & COMMAND CENTER */}
                <div className="md:col-span-5 flex flex-col gap-6">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="border-b bg-slate-50/50 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600" /> HR Pulse</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-3xl font-bold text-slate-900">{hrStats.totalActive}</div>
                                    <div className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1">Active Headcount</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold text-amber-500">{hrStats.totalOnLeave}</div>
                                    <div className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1">Staff on Leave</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="flex-1 shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-200 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2 text-slate-800"><Clock className="h-5 w-5 text-indigo-600" /> Action Center</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 flex flex-col gap-6 h-full">

                            <div className="space-y-3">
                                {alerts.map((alert, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-md text-sm font-medium ${alert.type === 'urgent' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
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

                            <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-slate-100">
                                <Button variant="outline" className="justify-start gap-2 h-12 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-semibold" onClick={() => window.location.href = '/onboarding'}>
                                    <UserPlus className="h-4 w-4 text-indigo-500" /> Hire Staff
                                </Button>
                                <Button variant="outline" className="justify-start gap-2 h-12 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-semibold" onClick={() => window.location.href = '/payroll'}>
                                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Run Payroll
                                </Button>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
