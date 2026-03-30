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
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";

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
            const userSubs    = allSubs.filter(s => s.assignedTo?.includes(user.id));
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
            'Assignee': teamUsers.find(u => u.id === s.assignedTo?.split(',')[0])?.name + (s.assignedTo?.includes(',') ? ' + others' : '') || 'Unassigned',
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

    useSetPageTitle(
        'Performance Analytics',
        `Showing data for ${periodLabel} across ${workspace?.name}`,
        <div className="flex items-center gap-2">
            {/* Year Selector */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 min-w-[110px] justify-between gap-2 px-3 text-[10px] font-bold uppercase tracking-tight border-slate-200 bg-white">
                        {filterYear === '' ? 'All Years' : filterYear}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[110px]">
                    <DropdownMenuItem className="text-xs" onClick={() => {
                        setFilterYear('');
                        setFilterMonth('');
                    }}>
                        All Years
                    </DropdownMenuItem>
                    {yearList.map(y => (
                        <DropdownMenuItem key={y} className="text-xs" onClick={() => {
                            setFilterYear(y);
                            setFilterMonth('');
                            setRolling(null);
                        }}>
                            {y}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Month Selector */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={filterYear === ''}>
                    <Button variant="outline" size="sm" className="h-9 min-w-[130px] justify-between gap-2 px-3 text-[10px] font-bold uppercase tracking-tight border-slate-200 bg-white disabled:opacity-50">
                        {filterMonth === '' ? 'All Months' : MONTHS[filterMonth as number]}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[130px]">
                    <DropdownMenuItem className="text-xs" onClick={() => setFilterMonth('')}>
                        All Months
                    </DropdownMenuItem>
                    {MONTHS.map((m, i) => (
                        <DropdownMenuItem key={i} className="text-xs" onClick={() => setFilterMonth(i)}>
                            {m}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

            {/* Rolling Window */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={filterYear !== ''}>
                    <Button variant="outline" size="sm" className="h-9 min-w-[140px] justify-between gap-2 px-3 text-[10px] font-bold uppercase tracking-tight border-slate-200 bg-white disabled:opacity-50">
                        {rolling === null ? 'All Time' : `Last ${rolling} days`}
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[140px]">
                    <DropdownMenuItem className="text-xs" onClick={() => setRolling(null)}>All Time</DropdownMenuItem>
                    {[7, 14, 30, 90].map(days => (
                        <DropdownMenuItem key={days} className="text-xs" onClick={() => setRolling(days)}>
                            Last {days} days
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button 
                size="sm" 
                onClick={handleExport}
                className="h-9 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-tight shadow-md transition-all active:scale-95"
            >
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </Button>
        </div>,
        [filterYear, filterMonth, rolling, periodLabel, workspace?.name]
    );

    function startOfDay(d: Date) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 h-full flex flex-col min-h-0 py-6 px-6">

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
