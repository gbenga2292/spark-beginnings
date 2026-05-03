import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useWorkspace } from '@/src/hooks/use-workspace';
import { useAppStore } from '@/src/store/appStore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import {
    format, subDays, isPast, parseISO, startOfMonth, endOfMonth,
    startOfYear, endOfYear, isSameDay, isWithinInterval, getDaysInMonth,
    getYear, getMonth,
} from 'date-fns';
import { Download, AlertCircle, Clock, CheckCircle2, Activity, Filter, FileText, ChevronDown, CalendarDays, FolderOpen, FileSpreadsheet, TrendingUp, GanttChartSquare } from 'lucide-react';
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

export function TaskReports() {
    useAuth(); // keep auth context alive
    return <AnalyticsDashboard />;
}

/* ─── ANALYTICS CORE ENGINE ────────────────────────────────────────────────── */
function AnalyticsDashboard() {
    const { user: currentUser } = useAuth();
    const { subtasks: allSubtasks, users } = useAppData();
    const { wsTasks: allMainTasks, wsMembers: teamUsers, workspace } = useWorkspace();

    const appUser = users.find(u => u.id === currentUser?.id);
    const isExternalHr = appUser?.privileges?.tasks?.isExternalHr;

    const mainTasks = useMemo(() => {
        if (isExternalHr) return allMainTasks.filter(mt => {
            const isAssigned = (mt.assignedTo || mt.assigned_to || '').includes(currentUser?.id || '');
            return !!mt.is_hr_task || mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id || isAssigned;
        });
        return allMainTasks;
    }, [allMainTasks, isExternalHr, currentUser?.id]);

    const subtasks = useMemo(() => {
        if (isExternalHr) {
            const hrTaskIds = new Set(mainTasks.map(mt => mt.id));
            return allSubtasks.filter(s => hrTaskIds.has(s.mainTaskId!) || hrTaskIds.has((s as any).main_task_id));
        }
        return allSubtasks;
    }, [allSubtasks, mainTasks, isExternalHr]);

    // ── Filter state ─────────────────────────────────────────────────────────
    // Rolling window (days) — used when year+month are both blank
    const [rolling, setRolling]       = useState<number | null>(30);
    const [filterYear, setFilterYear] = useState<number | ''>('');   // '' = all
    const [filterMonth, setFilterMonth] = useState<number | ''>(''); // '' = all  (0-indexed)
    const [filterSite, setFilterSite]   = useState<string>('all');

    const yearList = useMemo(() => buildYearList(subtasks), [subtasks]);
    const sites = useAppStore(s => s.sites);

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
            
            // Site Filter Logic: Try to match main task title with a site name
            if (filterSite !== 'all') {
                const mt = mainTasks.find(m => m.id === s.mainTaskId);
                if (!mt || !mt.title.toLowerCase().includes(filterSite.toLowerCase())) return false;
            }

            try {
                return isWithinInterval(parseISO(s.createdAt), { start: intervalStart, end: intervalEnd });
            } catch { return false; }
        }),
    [subtasks, mainTasks, intervalStart, intervalEnd, filterSite]);

    // ── All-time subtasks (unfiltered by date) ─────────────────────────────
    const allStatusSubs = subtasks;

    const completedSubs  = validSubs.filter(s => s.status === 'completed');
    const inProgressSubs = validSubs.filter(s => s.status === 'in_progress');

    // ── Avg closure time (days) ─────────────────────────────────────────────
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
            const userSubs    = allStatusSubs.filter(s => {
                if (!s.assignedTo) return false;
                const assignees = typeof s.assignedTo === 'string' 
                    ? s.assignedTo.split(',').map(id => id.trim()) 
                    : Array.isArray(s.assignedTo) ? s.assignedTo : [];
                return assignees.includes(user.id);
            });
            const overdue     = userSubs.filter(s => s.deadline && isPast(parseISO(s.deadline)) && s.status !== 'completed').length;
            const stuckInProg = userSubs.filter(s => s.status === 'in_progress').length;
            const completed   = userSubs.filter(s => s.status === 'completed').length;
            return { ...user, total: userSubs.length, overdue, stuckInProg, completed, riskScore: (overdue * 3) + stuckInProg };
        }).filter(u => u.total > 0).sort((a, b) => b.riskScore - a.riskScore),
    [teamUsers, subtasks]);

    // ── Priority Distribution ──
    const priorityData = useMemo(() => {
        const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
        validSubs.forEach(s => {
            if (s.priority) counts[s.priority] = (counts[s.priority] || 0) + 1;
        });
        return [
            { name: 'Urgent', value: counts.urgent, color: '#f43f5e' },
            { name: 'High',   value: counts.high,   color: '#f59e0b' },
            { name: 'Medium', value: counts.medium, color: '#6366f1' },
            { name: 'Low',    value: counts.low,    color: '#94a3b8' },
        ].filter(p => p.value > 0);
    }, [validSubs]);

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

    // Mobile menu state
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const currentSiteName = useMemo(() => {
        if (filterSite === 'all') return 'All Sites';
        return sites.find(s => s.name === filterSite)?.name || filterSite;
    }, [filterSite, sites]);

    useSetPageTitle(
        'Performance Analytics',
        `Analyzing ${periodLabel} · ${currentSiteName}`,
        <div className="relative flex items-center gap-2">
            {/* ── Desktop View (Hidden on Mobile) ── */}
            <div className="hidden sm:flex items-center gap-2 overflow-x-auto hide-scrollbar">
                {/* Site Selector */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 min-w-[140px] justify-between gap-2 px-3 text-[10px] font-bold uppercase tracking-tight border-slate-200 bg-white hover:border-indigo-300 transition-colors">
                            {currentSiteName}
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px] max-h-[300px] overflow-y-auto">
                        <DropdownMenuItem className="text-xs" onClick={() => setFilterSite('all')}>
                            All Sites
                        </DropdownMenuItem>
                        {sites.map(s => (
                            <DropdownMenuItem key={s.id} className="text-xs" onClick={() => setFilterSite(s.name)}>
                                {s.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-8 w-[1px] bg-slate-200 mx-1" />

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

                <div className="h-8 w-[1px] bg-slate-200 mx-1" />

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
                    <FileSpreadsheet className="h-4 w-4" /> <span>Export Analysis</span>
                </Button>
            </div>

            {/* ── Mobile View (Action Buttons) ── */}
            <div className="flex sm:hidden items-center gap-2">
                <Button 
                    size="sm" 
                    onClick={handleExport}
                    className="h-9 w-9 p-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95"
                    title="Export Analysis"
                >
                    <FileSpreadsheet className="h-4 w-4" />
                </Button>

                <button
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm"
                    onClick={() => setMobileMenuOpen(o => !o)}
                    title="More options"
                >
                    <span className="text-lg font-black leading-none tracking-tighter">⋮</span>
                </button>
            </div>

            {/* ── Mobile Dropdown Panel ── */}
            {mobileMenuOpen && (
                <>
                    <div className="sm:hidden fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[2px]" onClick={() => setMobileMenuOpen(false)} />
                    <div className="sm:hidden fixed top-16 right-3 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 -mt-1">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Report Filters</h4>
                            <button onClick={() => setMobileMenuOpen(false)} className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">Done</button>
                        </div>

                        {/* Site Filter */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Filter by Site</p>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full h-10 justify-between px-3 text-xs border-slate-200 dark:border-slate-800">
                                        <span className="truncate">{currentSiteName}</span>
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-[300px] overflow-y-auto">
                                    <DropdownMenuItem onClick={() => setFilterSite('all')}>All Sites</DropdownMenuItem>
                                    {sites.map(s => (
                                        <DropdownMenuItem key={s.id} onClick={() => setFilterSite(s.name)}>{s.name}</DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Date Filters */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Year</p>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full h-10 justify-between px-3 text-xs border-slate-200 dark:border-slate-800">
                                            {filterYear === '' ? 'All' : filterYear}
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => { setFilterYear(''); setFilterMonth(''); }}>All Years</DropdownMenuItem>
                                        {yearList.map(y => (
                                            <DropdownMenuItem key={y} onClick={() => { setFilterYear(y); setFilterMonth(''); setRolling(null); }}>{y}</DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Month</p>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild disabled={filterYear === ''}>
                                        <Button variant="outline" className="w-full h-10 justify-between px-3 text-xs border-slate-200 dark:border-slate-800">
                                            {filterMonth === '' ? 'All' : MONTHS[filterMonth as number].slice(0,3)}
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => setFilterMonth('')}>All Months</DropdownMenuItem>
                                        {MONTHS.map((m, i) => (
                                            <DropdownMenuItem key={i} onClick={() => setFilterMonth(i)}>{m}</DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Rolling Window */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Rolling Period</p>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild disabled={filterYear !== ''}>
                                    <Button variant="outline" className="w-full h-10 justify-between px-3 text-xs border-slate-200 dark:border-slate-800">
                                        {rolling === null ? 'All Time' : `Last ${rolling} days`}
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => setRolling(null)}>All Time</DropdownMenuItem>
                                    {[7, 14, 30, 90].map(days => (
                                        <DropdownMenuItem key={days} onClick={() => setRolling(days)}>Last {days} days</DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <Button 
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-tight rounded-xl shadow-md"
                        >
                            Apply Filters
                        </Button>
                    </div>
                </>
            )}
        </div>,
        [filterYear, filterMonth, rolling, periodLabel, filterSite, sites, currentSiteName, mobileMenuOpen, yearList]
    );

    function startOfDay(d: Date) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    return (
        <div className="h-full flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <motion.div 
                variants={container} 
                initial="hidden" 
                animate="show" 
                className="space-y-6 h-full flex flex-col min-h-0 py-6 px-6 overflow-y-auto"
            >

            {/* ── Stat Cards ── */}
            <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        icon: <GanttChartSquare className="w-5 h-5" />,
                        bg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600',
                        label: 'Total Workload',
                        value: validSubs.length,
                        sub: 'Subtasks in this period',
                    },
                    {
                        icon: <CheckCircle2 className="w-5 h-5" />,
                        bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        label: 'Completed',
                        value: completedSubs.length,
                        sub: `${validSubs.length > 0 ? Math.round((completedSubs.length / validSubs.length) * 100) : 0}% completion rate`,
                        subColor: 'text-emerald-600',
                    },
                    {
                        icon: <TrendingUp className="w-5 h-5" />,
                        bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
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
                    <motion.div 
                        key={card.label} 
                        whileHover={{ y: -2 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2.5 rounded-xl ${card.bg} shadow-inner`}>{card.icon}</div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{card.label}</p>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{card.value}</p>
                        </div>
                        <p className={`text-[11px] font-medium mt-1.5 ${card.subColor ?? 'text-slate-500'}`}>{card.sub}</p>
                    </motion.div>
                ))}
            </motion.div>

            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">

                {/* Velocity / Burn Chart */}
                <motion.div variants={item} className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow">
                    <div className="mb-6 flex justify-between items-start">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Task Velocity / Burn Chart</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {bucketMode === 'monthly' ? 'Monthly' : 'Daily'} throughput — created vs closed · {periodLabel}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Created</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Closed</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
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
                <motion.div variants={item} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <Activity className="w-4 h-4 text-rose-500" /> Bottleneck Radar
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1">Ranked by operational blockages (all time)</p>
                    </div>
                    <div className="overflow-y-auto flex-1 p-3">
                        {bottleneckData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                                <p className="text-center text-xs font-medium text-slate-400">No blocked team members — great!</p>
                            </div>
                        ) : bottleneckData.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <div className={`w-9 h-9 rounded-full ${u.avatarColor} flex-shrink-0 flex items-center justify-center text-white text-[10px] font-black shadow-md`}>
                                    {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                                    <div className="flex gap-1.5 mt-1 flex-wrap">
                                        {u.overdue > 0     && <span className="text-[9px] bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold border border-red-100 dark:border-red-900/20">{u.overdue} Overdue</span>}
                                        {u.stuckInProg > 0 && <span className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold border border-amber-100 dark:border-amber-900/20">{u.stuckInProg} In Prog</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-rose-500 tracking-tighter">Risk {u.riskScore}</p>
                                    <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500 underline decoration-slate-200 underline-offset-2">Inspect</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Project Pipeline */}
                <motion.div variants={item} className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 min-h-64 flex flex-col hover:shadow-md transition-shadow">
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Project Pipeline Health</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Completion ratios for active projects · {periodLabel}</p>
                    </div>
                    <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                        {projectHealthData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
                                <FolderOpen className="w-8 h-8 text-slate-300" />
                                <p className="text-center text-xs font-medium text-slate-400">No projects found in this period</p>
                            </div>
                        ) : projectHealthData.map(p => (
                            <div key={p.name} className="space-y-2 group">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate tracking-tight">{p.name}</span>
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded uppercase">{Math.round((p.completed / (p.completed + (p.remaining || 0))) * 100) || 0}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                    <motion.div 
                                        initial={{ width: 0 }} 
                                        animate={{ width: `${Math.round((p.completed / (p.completed + (p.remaining || 0))) * 100) || 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className={`h-full rounded-full shadow-sm ${
                                            (p.completed / (p.completed + (p.remaining || 0))) > 0.8 ? 'bg-emerald-500' : 
                                            (p.completed / (p.completed + (p.remaining || 0))) > 0.4 ? 'bg-indigo-500' : 'bg-amber-500'
                                        }`} 
                                    />
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.completed} / {p.completed + (p.remaining || 0)} Units Done</span>
                                    <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Analyze Project →</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Priority Breakdown */}
                <motion.div variants={item} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center hover:shadow-md transition-shadow">
                    <div className="w-full mb-6">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Priority Breakdown</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Risk distribution for this period</p>
                    </div>
                    {priorityData.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-12">No priority data.</p>
                    ) : (
                        <div className="relative w-full aspect-square max-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={priorityData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {priorityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{validSubs.length}</span>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tasks</span>
                            </div>
                        </div>
                    )}
                    <div className="w-full mt-4 space-y-1.5 overflow-y-auto max-h-[100px]">
                        {priorityData.map(p => (
                            <div key={p.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: p.color }} />
                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{p.name}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white tracking-widest">{p.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    </div>
    );
}
