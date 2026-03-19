import { motion } from 'framer-motion';
import { useAppData, deriveMainTaskStatus, getMainTaskProgress } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useWorkspace } from '@/src/hooks/use-workspace';
import { CheckCircle2, Loader2, Circle, Calendar, Users, BarChart3, Clock, TrendingUp } from 'lucide-react';
import { format, isPast } from 'date-fns';


const statusLabels = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' } as const;
const statusStyle = {
    not_started: 'bg-gray-100 text-gray-600 border-gray-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function Reports() {
    const { user: currentUser } = useAuth();
    return currentUser?.role === 'admin' ? <AdminReports /> : <UserReports />;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN VIEW â€” full company-wide dashboard
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminReports() {
    const { subtasks } = useAppData();
    const { user: currentUser } = useAuth();
    const { wsTasks: teamTasks, wsMembers: teamUsers, workspace } = useWorkspace();

    // Active workspace scoped data
    const teamTaskIds = new Set(teamTasks.map(mt => mt.id));
    const teamSubtasks = subtasks.filter(s => teamTaskIds.has(s.mainTaskId));

    const totalSubs = teamSubtasks.length;
    const completedSubs = teamSubtasks.filter((s) => s.status === 'completed').length;
    const inProgressSubs = teamSubtasks.filter((s) => s.status === 'in_progress').length;
    const notStartedSubs = teamSubtasks.filter((s) => s.status === 'not_started').length;

    const userWorkload = teamUsers.map((u) => {
        const mySubs = teamSubtasks.filter((s) => s.assignedTo === u.id);
        return {
            user: u,
            total: mySubs.length,
            completed: mySubs.filter((s) => s.status === 'completed').length,
            inProgress: mySubs.filter((s) => s.status === 'in_progress').length,
            notStarted: mySubs.filter((s) => s.status === 'not_started').length,
        };
    }).sort((a, b) => b.total - a.total);

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            <motion.div variants={item}>
                <h2 className="text-lg font-semibold text-foreground">Reports &amp; Monitoring</h2>
                <p className="text-sm text-muted-foreground">{workspace?.name ?? 'Workspace'} progress overview</p>
            </motion.div>

            {/* Summary cards */}
            <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Tasks', value: totalSubs, icon: BarChart3, color: 'border-border bg-card', valueColor: 'text-foreground' },
                    { label: 'Completed', value: completedSubs, icon: CheckCircle2, color: 'border-green-200 bg-green-50', valueColor: 'text-green-700' },
                    { label: 'In Progress', value: inProgressSubs, icon: Loader2, color: 'border-blue-200 bg-blue-50', valueColor: 'text-blue-700' },
                    { label: 'Not Started', value: notStartedSubs, icon: Circle, color: 'border-border bg-muted/50', valueColor: 'text-muted-foreground' },
                ].map((c) => (
                    <div key={c.label} className={`border rounded-2xl p-4 ${c.color}`}>
                        <c.icon className={`w-4 h-4 mb-2 ${c.valueColor}`} />
                        <p className={`text-2xl font-bold tabular-nums ${c.valueColor}`}>{c.value}</p>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">{c.label}</p>
                        {totalSubs > 0 && <p className="text-[11px] text-muted-foreground/70 mt-1">{Math.round((c.value / totalSubs) * 100)}% of total</p>}
                    </div>
                ))}
            </motion.div>

            {/* Main Task progress */}
            <motion.div variants={item} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Task Progress</h3>
                </div>
                <div className="divide-y divide-border/50">
                    {teamTasks.map((mt) => {
                        const progress = getMainTaskProgress(mt.id, teamSubtasks);
                        const status = deriveMainTaskStatus(mt.id, teamSubtasks);
                        const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
                        const assignees = [...new Set(teamSubtasks.filter((s) => s.mainTaskId === mt.id && s.assignedTo).map((s) => s.assignedTo!))]
                            .map((uid) => teamUsers.find((u) => u.id === uid)).filter(Boolean);
                        const subs = teamSubtasks.filter((s) => s.mainTaskId === mt.id);

                        return (
                            <div key={mt.id} className="px-5 py-4">
                                <div className="flex items-start justify-between gap-4 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-foreground">{mt.title}</p>
                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusStyle[status]}`}>
                                                {statusLabels[status]}
                                            </span>
                                        </div>
                                        {mt.deadline && (
                                            <p className={`text-xs mt-0.5 flex items-center gap-1 ${isPast(new Date(mt.deadline)) && status !== 'completed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                <Calendar className="w-3 h-3" /> Due {format(new Date(mt.deadline), 'MMMM d, yyyy')}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold text-foreground flex-shrink-0">{pct}%</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                                    <motion.div
                                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
                                        className={`h-full rounded-full ${status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                    {subs.map((sub) => {
                                        const assignee = teamUsers.find((u) => u.id === sub.assignedTo);
                                        return (
                                            <div key={sub.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${statusStyle[sub.status]}`}>
                                                {sub.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> :
                                                    sub.status === 'in_progress' ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" /> :
                                                        <Circle className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />}
                                                <span className="flex-1 truncate font-medium">{sub.title}</span>
                                                {assignee && (
                                                    <div title={assignee.name} className={`w-5 h-5 rounded-full ${assignee.avatarColor} flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
                                                        {assignee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs text-muted-foreground">{progress.completed}/{progress.total} modules completed</span>
                                    <div className="flex -space-x-1">
                                        {assignees.map((u) => u && (
                                            <div key={u.id} title={u.name} className={`w-5 h-5 rounded-full ${u.avatarColor} border-2 border-card flex items-center justify-center text-white text-[8px] font-bold`}>
                                                {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Team workload */}
            <motion.div variants={item} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Team Workload</h3>
                </div>
                <div className="divide-y divide-border/50">
                    {userWorkload.map(({ user, total, completed, inProgress, notStarted }) => {
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                        return (
                            <div key={user.id} className="px-5 py-3.5 flex items-center gap-4">
                                <div className={`w-9 h-9 rounded-full ${user.avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                                    {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div>
                                            <span className="text-sm font-medium text-foreground">{user.name}</span>
                                            {user.department && <span className="ml-2 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{user.department}</span>}
                                        </div>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">{completed}/{total} done</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                                            className="h-full bg-blue-500 rounded-full" />
                                    </div>
                                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                                        <span className="text-green-600">{completed} done</span>
                                        <span className="text-blue-600">{inProgress} active</span>
                                        <span>{notStarted} pending</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {userWorkload.length === 0 && (
                        <p className="px-5 py-8 text-sm text-muted-foreground text-center">No team members yet.</p>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   USER VIEW â€” personal stats only, no other user's data
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function UserReports() {
    const { user: currentUser } = useAuth();
    const { subtasks } = useAppData();
    const { wsTasks: teamTasks } = useWorkspace();

    // Active workspace scoped data
    const teamTaskIds = new Set(teamTasks.map(mt => mt.id));
    const teamSubtasks = subtasks.filter(s => teamTaskIds.has(s.mainTaskId));

    const mySubs = teamSubtasks.filter((s) => s.assignedTo === currentUser?.id);
    const completed = mySubs.filter((s) => s.status === 'completed').length;
    const inProgress = mySubs.filter((s) => s.status === 'in_progress').length;
    const notStarted = mySubs.filter((s) => s.status === 'not_started').length;
    const total = mySubs.length;
    const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Main tasks the user is involved in
    const myProjectIds = [...new Set(mySubs.map((s) => s.mainTaskId))];
    const myProjects = teamTasks.filter((mt) => myProjectIds.includes(mt.id));

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            <motion.div variants={item}>
                <h2 className="text-lg font-semibold text-foreground">My Progress Report</h2>
                <p className="text-sm text-muted-foreground">Your personal task performance overview</p>
            </motion.div>

            {/* Personal stats */}
            <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Assigned to Me', value: total, icon: BarChart3, color: 'border-border bg-card', valueColor: 'text-foreground' },
                    { label: 'Completed', value: completed, icon: CheckCircle2, color: 'border-green-200 bg-green-50', valueColor: 'text-green-700' },
                    { label: 'In Progress', value: inProgress, icon: TrendingUp, color: 'border-blue-200 bg-blue-50', valueColor: 'text-blue-700' },
                    { label: 'Not Started', value: notStarted, icon: Clock, color: 'border-amber-200 bg-amber-50', valueColor: 'text-amber-700' },
                ].map((c) => (
                    <div key={c.label} className={`border rounded-2xl p-4 ${c.color}`}>
                        <c.icon className={`w-4 h-4 mb-2 ${c.valueColor}`} />
                        <p className={`text-2xl font-bold tabular-nums ${c.valueColor}`}>{c.value}</p>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">{c.label}</p>
                        {total > 0 && <p className="text-[11px] text-muted-foreground/70 mt-1">{Math.round((c.value / total) * 100)}% of mine</p>}
                    </div>
                ))}
            </motion.div>

            {/* Overall progress bar */}
            <motion.div variants={item} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Overall Completion</h3>
                    <span className="text-2xl font-bold text-foreground">{overallPct}%</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" />
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{completed} completed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{inProgress} in progress</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />{notStarted} not started</span>
                </div>
            </motion.div>

            {/* My Subtasks by Main Task */}
            {myProjects.length > 0 && (
                <motion.div variants={item} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                        <h3 className="text-sm font-semibold text-foreground">My Subtasks by Main Task</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Main tasks you are contributing to</p>
                    </div>
                    <div className="divide-y divide-border/50">
                        {myProjects.map((mt) => {
                            const projectSubs = mySubs.filter((s) => s.mainTaskId === mt.id);
                            const projCompleted = projectSubs.filter((s) => s.status === 'completed').length;
                            const projPct = projectSubs.length > 0 ? Math.round((projCompleted / projectSubs.length) * 100) : 0;
                            const status = deriveMainTaskStatus(mt.id, teamSubtasks);

                            return (
                                <div key={mt.id} className="px-5 py-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{mt.title}</p>
                                            {mt.deadline && (
                                                <p className={`text-xs flex items-center gap-1 mt-0.5 ${isPast(new Date(mt.deadline)) && status !== 'completed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                    <Calendar className="w-3 h-3" />Due {format(new Date(mt.deadline), 'MMM d, yyyy')}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-foreground">{projPct}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${projPct}%` }} transition={{ duration: 0.6 }}
                                            className={`h-full rounded-full ${projCompleted === projectSubs.length ? 'bg-green-500' : 'bg-blue-500'}`} />
                                    </div>
                                    <div className="space-y-1.5">
                                        {projectSubs.map((sub) => (
                                            <div key={sub.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${statusStyle[sub.status]}`}>
                                                {sub.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> :
                                                    sub.status === 'in_progress' ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" /> :
                                                        <Circle className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />}
                                                <span className="flex-1 truncate font-medium">{sub.title}</span>
                                                {sub.deadline && (
                                                    <span className={`text-[10px] ${isPast(new Date(sub.deadline)) && sub.status !== 'completed' ? 'text-red-500' : 'text-current opacity-60'}`}>
                                                        {format(new Date(sub.deadline), 'MMM d')}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {total === 0 && (
                <motion.div variants={item} className="text-center py-20 bg-card border border-border rounded-2xl">
                    <p className="text-4xl mb-3">ðŸ“‹</p>
                    <p className="text-base font-medium text-foreground">No tasks assigned yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Your progress will appear here once tasks are assigned to you.</p>
                </motion.div>
            )}
        </motion.div>
    );
}

