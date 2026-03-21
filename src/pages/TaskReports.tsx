import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useWorkspace } from '@/src/hooks/use-workspace';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
    format, subDays, isPast, parseISO, startOfMonth, endOfMonth,
    startOfYear, endOfYear, isSameDay, isWithinInterval, getDaysInMonth,
    getYear, getMonth,
} from 'date-fns';
import { Download, AlertCircle, Clock, CheckCircle2, Activity, Filter, FileText, ChevronDown, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item      = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];

/* ── Build year list from subtask timestamps ──────────────────────────────── */
function buildYearList(subtasks: { createdAt?: string }[]): number[] {
    const set = new Set<number>();
    const curr = new Date().getFullYear();
    set.add(curr);
    subtasks.forEach(s => {
        if (s.createdAt) {
            try { set.add(getYear(parseISO(s.createdAt))); } catch {}
        }
    });
    return Array.from(set).sort((a, b) => b - a); // newest first
}

export default function Reports() {
    useAuth(); // keep auth context alive
    return <AnalyticsDashboard />;
}

/* ─── ANALYTICS CORE ENGINE ────────────────────────────────────────────────── */
function AnalyticsDashboard() {
    const { subtasks } = useAppData();
    const { wsTasks: mainTasks, wsMembers: teamUsers, workspace } = useWorkspace();

    // ── Filter state ─────────────────────────────────────────────────────────
    // Rolling window (days) — used when year+month are both blank
    const [rolling, setRolling]       = useState<number | null>(30);
    const [filterYear, setFilterYear] = useState<number | ''>('');   // '' = all
    const [filterMonth, setFilterMonth] = useState<number | ''>(''); // '' = all  (0-indexed)

    const yearList = useMemo(() => buildYearList(subtasks), [subtasks]);

    // ── Resolve effective date interval ──────────────────────────────────────
    // Priority: Year+Month > Year only > Rolling window
    const { intervalStart, intervalEnd, bucketMode } = useMemo((): {
        intervalStart: Date;
        intervalEnd: Date;
        bucketMode: 'daily' | 'monthly';
    } => {
        const now = new Date();

        if (filterYear !== '') {
            if (filterMonth !== '') {
                // Specific month of specific year — daily buckets
                const ref = new Date(filterYear, filterMonth as number, 1);
                return {
                    intervalStart: startOfMonth(ref),
                    intervalEnd:   endOfMonth(ref),
                    bucketMode:    'daily',
                };
            }
            // Whole year — monthly buckets
            const ref = new Date(filterYear, 0, 1);
            return {
                intervalStart: startOfYear(ref),
                intervalEnd:   endOfYear(ref),
                bucketMode:    'monthly',
            };
        }

        // Rolling window fallback (or "all time" if rolling is null)
        const days = rolling ?? 365;
        return {
            intervalStart: startOfDay(subDays(now, days)),
            intervalEnd:   now,
            bucketMode:    'daily',
        };
    }, [filterYear, filterMonth, rolling]);

    // ── Subtasks within the resolved interval ────────────────────────────────
    const validSubs = useMemo(() =>
        subtasks.filter(s => {
            if (!s.createdAt) return false;
            try {
                return isWithinInterval(parseISO(s.createdAt), { start: intervalStart, end: intervalEnd });
            } catch { return false; }
        }),
    [subtasks, intervalStart, intervalEnd]);

    // All-time subtasks for bottleneck (unfiltered by date)
    const allSubs = subtasks;

    const completedSubs  = validSubs.filter(s => s.status === 'completed');
    const inProgressSubs = validSubs.filter(s => s.status === 'in_progress');

    // ── Avg closure time (days between createdAt → updatedAt where completed) ─
    const avgClosureDays = useMemo(() => {
        const pairs = completedSubs
            .filter(s => s.createdAt && s.updatedAt)
            .map(s => {
                try {
                    const created = parseISO(s.createdAt!);
                    const closed  = parseISO(s.updatedAt!);
                    return Math.max(0, (closed.getTime() - created.getTime()) / 86_400_000);
                } catch { return null; }
            })
            .filter((v): v is number => v !== null);
        if (pairs.length === 0) return null;
        return (pairs.reduce((a, b) => a + b, 0) / pairs.length).toFixed(1);
    }, [completedSubs]);

    // ── 1. Bottleneck Analysis (uses ALL subtasks — not date-filtered) ────────
    const bottleneckData = useMemo(() =>
        teamUsers.map(user => {
            const userSubs    = allSubs.filter(s => s.assignedTo === user.id);
            const overdue     = userSubs.filter(s => s.deadline && isPast(parseISO(s.deadline)) && s.status !== 'completed').length;
            const stuckInProg = userSubs.filter(s => s.status === 'in_progress').length;
            const completed   = userSubs.filter(s => s.status === 'completed').length;
            return { ...user, total: userSubs.length, overdue, stuckInProg, completed, riskScore: (overdue * 3) + stuckInProg };
        }).filter(u => u.total > 0).sort((a, b) => b.riskScore - a.riskScore),
    [teamUsers, allSubs]);

    // ── 2. Velocity chart — bucket by day or month within the interval ────────
    const velocityData = useMemo(() => {
        if (bucketMode === 'monthly') {
            // 12 monthly buckets for the selected year
            return MONTHS.map((label, mIdx) => {
                const ref   = new Date(filterYear as number, mIdx, 1);
                const start = startOfMonth(ref);
                const end   = endOfMonth(ref);

                const created = subtasks.filter(s => {
                    if (!s.createdAt) return false;
                    try { return isWithinInterval(parseISO(s.createdAt), { start, end }); } catch { return false; }
                }).length;

                const closed = subtasks.filter(s => {
                    if (s.status !== 'completed' || !s.updatedAt) return false;
                    try { return isWithinInterval(parseISO(s.updatedAt), { start, end }); } catch { return false; }
                }).length;

                return { date: label.slice(0, 3), created, closed };
            });
        }

        // Daily buckets
        const days: { date: string; created: number; closed: number }[] = [];
        let cursor = new Date(intervalStart);
        while (cursor <= intervalEnd) {
            const day      = new Date(cursor);
            const dayLabel = format(day, 'MMM d');

            const created = subtasks.filter(s => {
                if (!s.createdAt) return false;
                try { return isSameDay(parseISO(s.createdAt), day); } catch { return false; }
            }).length;

            const closed = subtasks.filter(s => {
                if (s.status !== 'completed' || !s.updatedAt) return false;
                try { return isSameDay(parseISO(s.updatedAt), day); } catch { return false; }
            }).length;

            days.push({ date: dayLabel, created, closed });
            cursor.setDate(cursor.getDate() + 1);
        }
        return days;
    }, [subtasks, intervalStart, intervalEnd, bucketMode, filterYear]);

    // ── 3. Project health (within interval) ──────────────────────────────────
    const projectHealthData = useMemo(() =>
        mainTasks.map(mt => {
            const mSubs = validSubs.filter(s => s.mainTaskId === mt.id);
            const comp  = mSubs.filter(s => s.status === 'completed').length;
            return {
                name:      mt.title.length > 18 ? mt.title.slice(0, 18) + '…' : mt.title,
                completed: comp,
                remaining: mSubs.length - comp,
                total:     mSubs.length,
            };
        }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 8),
    [mainTasks, validSubs]);

    // ── Excel export ─────────────────────────────────────────────────────────
    const handleExport = () => {
        const rows = validSubs.map(s => ({
            'Project':  mainTasks.find(m => m.id === s.mainTaskId)?.title ?? 'Unknown',
            'Task ID':  s.id ?? '',
            'Title':    s.title,
            'Status':   s.status,
            'Assignee': teamUsers.find(u => u.id === s.assignedTo)?.name ?? 'Unassigned',
            'Deadline': s.deadline ? format(parseISO(s.deadline), 'yyyy-MM-dd') : 'No Deadline',
            'Overdue':  s.deadline && isPast(parseISO(s.deadline)) && s.status !== 'completed' ? 'YES' : 'NO',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Task Report');
        XLSX.writeFile(wb, `Task_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    // ── Human-readable period label ───────────────────────────────────────────
    const periodLabel = useMemo(() => {
        if (filterYear !== '') {
            if (filterMonth !== '') return `${MONTHS[filterMonth as number]} ${filterYear}`;
            return `Full Year ${filterYear}`;
        }
        if (rolling) return `Last ${rolling} days`;
        return 'All time';
    }, [filterYear, filterMonth, rolling]);

    function startOfDay(d: Date) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 h-full flex flex-col min-h-0 pb-6">

            {/* ── Page Header ── */}
            <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Activity className="h-5 w-5 text-indigo-500" /> Analytical Reports
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Showing: <span className="font-semibold text-foreground">{periodLabel}</span>
                        {' · '}{workspace?.name}
                    </p>
                </div>
                <button onClick={handleExport}
                    className="self-start flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                    <Download className="h-4 w-4" /> Export XLSX
                </button>
            </motion.div>

            {/* ── Filter Bar ── */}
            <motion.div variants={item}
                className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-2xl shadow-sm">

                <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filter Period</span>

                {/* Year */}
                <div className="relative">
                    <select
                        value={filterYear}
                        onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setFilterYear(val);
                            setFilterMonth('');  // reset month when year changes
                            if (val !== '') setRolling(null); // year takes priority
                        }}
                        className="appearance-none pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm">
                        <option value="">All Years</option>
                        {yearList.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>

                {/* Month — only enabled when a year is selected */}
                <div className="relative">
                    <select
                        value={filterMonth}
                        disabled={filterYear === ''}
                        onChange={e => {
                            setFilterMonth(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        className="appearance-none pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                        <option value="">All Months</option>
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-border mx-1" />

                {/* Rolling window — active only when no year is selected */}
                <div className="relative">
                    <select
                        value={rolling ?? ''}
                        disabled={filterYear !== ''}
                        onChange={e => {
                            setRolling(e.target.value === '' ? null : Number(e.target.value));
                        }}
                        className="appearance-none pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                        <option value="">Rolling window</option>
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={60}>Last 60 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 6 months</option>
                        <option value={365}>Last 12 months</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>

                {/* Clear filters */}
                {(filterYear !== '' || rolling !== 30) && (
                    <button
                        onClick={() => { setFilterYear(''); setFilterMonth(''); setRolling(30); }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1">
                        Reset
                    </button>
                )}
            </motion.div>

            {/* ── Stat Cards ── */}
            <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        icon: <FileText className="w-5 h-5" />,
                        bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
                        label: 'Total Workload',
                        value: validSubs.length,
                        sub: 'Subtasks in this period',
                    },
                    {
                        icon: <CheckCircle2 className="w-5 h-5" />,
                        bg: 'bg-green-100 dark:bg-green-900/30 text-green-600',
                        label: 'Completed',
                        value: completedSubs.length,
                        sub: `${validSubs.length > 0 ? Math.round((completedSubs.length / validSubs.length) * 100) : 0}% completion rate`,
                        subColor: 'text-green-600',
                    },
                    {
                        icon: <Clock className="w-5 h-5" />,
                        bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
                        label: 'Avg Closure Time',
                        value: avgClosureDays !== null ? `${avgClosureDays}d` : '—',
                        sub: 'createdAt → completedAt',
                    },
                    {
                        icon: <AlertCircle className="w-5 h-5" />,
                        bg: 'bg-red-100 dark:bg-red-900/30 text-red-600',
                        label: 'Critical Risk',
                        value: bottleneckData.reduce((a, b) => a + b.overdue, 0),
                        sub: 'Overdue tasks (all time)',
                        subColor: 'text-red-600',
                    },
                ].map(card => (
                    <div key={card.label} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-xl ${card.bg}`}>{card.icon}</div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                        </div>
                        <p className="text-3xl font-black text-foreground">{card.value}</p>
                        <p className={`text-[11px] mt-1 ${card.subColor ?? 'text-muted-foreground'}`}>{card.sub}</p>
                    </div>
                ))}
            </motion.div>

            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">

                {/* Velocity / Burn Chart */}
                <motion.div variants={item} className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm p-5 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-foreground">Task Velocity / Burn Chart</h3>
                        <p className="text-xs text-muted-foreground">
                            {bucketMode === 'monthly' ? 'Monthly' : 'Daily'} throughput — created vs closed · {periodLabel}
                        </p>
                    </div>
                    <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-[0.08]" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false}
                                    tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted-foreground"
                                    interval={velocityData.length > 30 ? Math.ceil(velocityData.length / 15) : 0} />
                                <YAxis axisLine={false} tickLine={false}
                                    tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted-foreground"
                                    allowDecimals={false} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', fontSize: 12 }}
                                    itemStyle={{ fontWeight: 600 }} />
                                <Area type="monotone" dataKey="created" name="New Tasks"
                                    stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#gCreated)" />
                                <Area type="monotone" dataKey="closed" name="Closed Tasks"
                                    stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gClosed)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Bottleneck Radar */}
                <motion.div variants={item} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/40">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Filter className="w-4 h-4 text-rose-500" /> Bottleneck Radar
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Ranked by operational blockages (all time)</p>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2">
                        {bottleneckData.length === 0 ? (
                            <p className="text-center text-xs text-muted-foreground py-12">No blocked team members — great!</p>
                        ) : bottleneckData.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                                <div className={`w-8 h-8 rounded-full ${u.avatarColor} flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
                                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                                    <div className="flex gap-1.5 mt-1 flex-wrap">
                                        {u.overdue > 0     && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">{u.overdue} Overdue</span>}
                                        {u.stuckInProg > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">{u.stuckInProg} In Prog</span>}
                                    </div>
                                </div>
                                <p className="text-xs font-black text-rose-500 flex-shrink-0">Risk {u.riskScore}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Project Pipeline */}
                <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-2xl shadow-sm p-5 min-h-64 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-foreground">Project Pipeline Health</h3>
                        <p className="text-xs text-muted-foreground">Completion ratios for active projects · {periodLabel}</p>
                    </div>
                    {projectHealthData.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-12">No project data in this period.</p>
                    ) : (
                        <div className="flex-1 min-h-0" style={{ height: Math.max(200, projectHealthData.length * 40) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={projectHealthData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} className="opacity-[0.08]" stroke="currentColor" />
                                    <XAxis type="number" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted-foreground"
                                        allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: 'currentColor' }} width={140} className="text-muted-foreground font-medium" />
                                    <RechartsTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', fontSize: 12 }} />
                                    <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" barSize={14} />
                                    <Bar dataKey="remaining" name="Remaining"  stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={14} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
