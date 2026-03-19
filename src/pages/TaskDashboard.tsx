import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useAppData, deriveMainTaskStatus, getMainTaskProgress } from "@/contexts/AppDataContext";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  CheckCircle2, AlertTriangle, TrendingUp, ArrowRight,
  Circle, Loader2, Calendar, Clock, Users, BarChart2, ChevronRight,
  Flame, Zap, Award, Flag, User, Lock, Target, ListTodo
} from
  "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, isPast, differenceInHours } from "date-fns";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import type { TaskPriority } from "@/types/tasks";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
};

const statusConfig = {
  not_started: { label: "Not Started", pillClass: "chip-pending", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress", icon: Loader2 },
  pending_approval: { label: "Pending Approval", pillClass: "chip-pending", icon: Circle },
  completed: { label: "Completed", pillClass: "chip-completed", icon: CheckCircle2 }
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-500 border border-slate-200',
  medium: 'bg-amber-50 text-amber-600 border border-amber-200',
  high: 'bg-orange-50 text-orange-600 border border-orange-200',
  urgent: 'bg-red-50 text-red-600 border border-red-200'
};

function PriorityPill({ priority }: { priority?: TaskPriority; }) {
  if (!priority) return null;
  return (
    <span className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_BADGE[priority]}`}>
      <Flag className="w-2 h-2" />{priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>);

}

function formatDueDate(dueDate?: string) {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isPast(d)) return `${format(d, "MMM d")} (overdue)`;
  return format(d, "MMM d");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function urgencyScore(sub: { deadline?: string; status: string; }) {
  if (sub.status === "completed") return 99999;
  let score = 0;
  if (sub.deadline) {
    const d = new Date(sub.deadline);
    const hoursUntil = differenceInHours(d, new Date());
    if (hoursUntil < 0) score = -1000 + hoursUntil; else
      score = hoursUntil;
  } else {
    score = 5000;
  }
  return score;
}

/* ─── Router ─────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { currentUser } = useAuth();
  const { isPersonal } = useWorkspace();

  // Personal workspace → always show personal dashboard (solo)
  if (isPersonal) return <PersonalSpaceDashboard />;
  // Team workspace — role-based
  if (currentUser?.role === "admin") return <AdminDashboard />;
  return <UserDashboard />;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PERSONAL SPACE DASHBOARD
   Clean, private, solo-focused. No team, no assignments, no approvals.
═══════════════════════════════════════════════════════════════════════════════ */
function PersonalSpaceDashboard() {
  const { currentUser } = useAuth();
  const { subtasks, workspaces } = useAppData();
  const { wsTasks, workspace } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const wsTaskIds = new Set(wsTasks.map((mt) => mt.id));
  const wsSubs = subtasks.filter((s) => wsTaskIds.has(s.mainTaskId));

  const completed = wsSubs.filter((s) => s.status === 'completed').length;
  const inProgress = wsSubs.filter((s) => s.status === 'in_progress').length;
  const notStarted = wsSubs.filter((s) => s.status === 'not_started').length;
  const rate = wsSubs.length > 0 ? Math.round(completed / wsSubs.length * 100) : 0;

  const urgent = [...wsSubs].
    filter((s) => s.status !== 'completed').
    sort((a, b) => urgencyScore(a) - urgencyScore(b)).
    slice(0, 8);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header — violet personal identity */}
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800">
              Personal Space
            </span>
          </div>
          <h2 className="text-2xl font-heading font-normal text-foreground">
            {getGreeting()}, {currentUser?.name.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {inProgress > 0 ?
              <><span className="font-medium text-foreground">{inProgress}</span> tasks in progress</> :
              'Your private workspace — no teammates, just you.'}
            {notStarted > 0 && <span className="text-amber-500 font-medium"> · {notStarted} not started</span>}
          </p>
        </div>
        <button onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors shadow-sm">
          <ListTodo className="w-4 h-4" /> My Tasks
        </button>
      </motion.div>

      {/* Stats — personal palette (violet/purple) */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PersonalStatCard label="My Tasks" value={wsTasks.length} icon={ListTodo} color="violet" sub="Total task groups" />
        <PersonalStatCard label="In Progress" value={inProgress} icon={Loader2} color="violet" sub="Active now" />
        <PersonalStatCard label="Completed" value={completed} icon={CheckCircle2} color="green" sub={`${rate}% done`} />
        <PersonalStatCard label="Not Started" value={notStarted} icon={Target} color="amber" sub="Waiting to start" />
      </motion.div>

      {/* Progress bar */}
      <motion.div variants={item} className="bg-card border border-violet-100 dark:border-violet-900/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-foreground">My Progress</span>
          </div>
          <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{rate}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="h-full bg-violet-500 rounded-full" />
        </div>
        <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />{inProgress} in progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />{completed} completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" />{notStarted} pending</span>
        </div>
      </motion.div>

      {/* Tasks + Productivity */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Upcoming tasks */}
        <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-medium text-foreground">Upcoming Tasks</h3>
              {urgent.length > 0 &&
                <span className="text-[11px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-semibold">{urgent.length}</span>
              }
            </div>
            <button onClick={() => navigate('/tasks')} className="text-xs font-medium text-violet-600 hover:text-violet-500 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {urgent.length === 0 ?
              <div className="px-5 py-10 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm text-muted-foreground">All clear! No pending tasks.</p>
              </div> :
              urgent.map((sub, i) => {
                const mt = wsTasks.find((m) => m.id === sub.mainTaskId);
                const sc = statusConfig[sub.status as keyof typeof statusConfig] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline));
                return (
                  <div key={sub.id} onClick={() => setOpenSubtaskId(sub.id)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 cursor-pointer transition-colors group">
                    <span className="text-[11px] font-bold text-muted-foreground/50 w-5 text-center">{i + 1}</span>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-destructive' : sub.status === 'in_progress' ? 'bg-violet-500' : 'bg-muted-foreground/30'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground truncate group-hover:text-violet-600 transition-colors">{sub.title}</p>
                        {mt?.priority && <PriorityPill priority={mt.priority} />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{mt?.title ?? ""}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                      <StatusIcon className="w-3 h-3" />{sc.label}
                    </span>
                    {sub.deadline &&
                      <span className={`text-[11px] flex-shrink-0 w-16 text-right hidden sm:block ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3 inline mr-0.5" />{formatDueDate(sub.deadline)}
                      </span>
                    }
                  </div>);

              })}
          </div>
        </motion.div>

        {/* Right: productivity + task breakdown */}
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <PersonalProductivityScore />
          {wsTasks.length > 0 &&
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-500" /> Task Groups
              </p>
              <div className="space-y-2">
                {wsTasks.slice(0, 5).map((mt) => {
                  const prog = getMainTaskProgress(mt.id, wsSubs);
                  const pct = prog.total > 0 ? Math.round(prog.completed / prog.total * 100) : 0;
                  return (
                    <div key={mt.id} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm bg-violet-500 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{mt.title}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mx-2">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground w-10 text-right">{prog.completed}/{prog.total}</span>
                    </div>);

                })}
              </div>
            </div>
          }
        </motion.div>
      </div>

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </motion.div>);

}

/* ─── Personal Stat Card ─────────────────────────────────────────────────── */
function PersonalStatCard({ label, value, icon: Icon, color, sub


}: { label: string; value: number; icon: React.ElementType; color: 'violet' | 'green' | 'amber' | 'red'; sub?: string; }) {
  const colorMap = {
    violet: { icon: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-200 dark:border-violet-800' },
    green: { icon: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800' },
    amber: { icon: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
    red: { icon: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' }
  };
  const c = colorMap[color];
  return (
    <div className={`p-4 rounded-xl bg-card border ${c.border} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${c.icon}`}>{value}</p>
      <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>);

}

/* ─── Personal Productivity Score ────────────────────────────────────────── */
function PersonalProductivityScore() {
  const { currentUser } = useAuth();
  const { subtasks, reminders } = useAppData();
  const { wsTasks } = useWorkspace();
  const wsTaskIds = new Set(wsTasks.map((mt) => mt.id));
  const mySubs = subtasks.filter((s) => wsTaskIds.has(s.mainTaskId));
  const myReminders = reminders.filter((r) => r.isActive && r.createdBy === currentUser?.id);

  const total = mySubs.length;
  const completed = mySubs.filter((s) => s.status === 'completed').length;
  const completionRate = total > 0 ? completed / total : 0;
  const withDeadline = mySubs.filter((s) => s.deadline && s.status === 'completed');
  const onTime = withDeadline.filter((s) => new Date(s.updatedAt) <= new Date(s.deadline!)).length;
  const onTimeRate = withDeadline.length > 0 ? onTime / withDeadline.length : completed > 0 ? 1 : 0;
  const notStuck = mySubs.filter((s) => s.status !== 'not_started').length;
  const engagementRate = total > 0 ? notStuck / total : 0;
  const reminderScore = Math.min(myReminders.length / 3, 1);
  const score = Math.round(completionRate * 40 + onTimeRate * 30 + engagementRate * 20 + reminderScore * 10);

  const getScoreColor = (s: number) => {
    if (s >= 80) return { ring: 'text-green-500', bg: 'bg-green-500', label: 'Excellent', emoji: '🔥' };
    if (s >= 60) return { ring: 'text-violet-500', bg: 'bg-violet-500', label: 'Good', emoji: '👍' };
    if (s >= 40) return { ring: 'text-amber-500', bg: 'bg-amber-500', label: 'Fair', emoji: '📈' };
    return { ring: 'text-destructive', bg: 'bg-destructive', label: 'Needs Work', emoji: '💪' };
  };
  const sc = getScoreColor(score);

  const breakdowns = [
    { label: 'Completion', value: Math.round(completionRate * 100), weight: '40%' },
    { label: 'On-Time', value: Math.round(onTimeRate * 100), weight: '30%' },
    { label: 'Engagement', value: Math.round(engagementRate * 100), weight: '20%' },
    { label: 'Planning', value: Math.round(reminderScore * 100), weight: '10%' }];


  return (
    <div className="bg-card border border-violet-100 dark:border-violet-900/30 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className={`w-4 h-4 ${sc.ring}`} />
        <h3 className="text-sm font-medium text-foreground">Productivity Score</h3>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor"
              className={sc.ring} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${score / 100 * 213.6} 213.6`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">{score}</span>
            <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">{sc.emoji} {sc.label}</span>
          </div>
          {breakdowns.map((b) =>
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-20">{b.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${sc.bg} transition-all`} style={{ width: `${b.value}%` }} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{b.value}%</span>
            </div>
          )}
        </div>
      </div>
      {total === 0 &&
        <p className="text-[11px] text-muted-foreground mt-3 text-center">Create tasks to start tracking your productivity</p>
      }
    </div>);

}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEAM WORKSPACE — ADMIN DASHBOARD
═══════════════════════════════════════════════════════════════════════════════ */
function AdminDashboard() {
  const { currentUser } = useAuth();
  const { subtasks, users } = useAppData();
  const { wsTasks, wsMembers } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const wsTaskIds = new Set(wsTasks.map((mt) => mt.id));
  const teamSubs = subtasks.filter((s) => wsTaskIds.has(s.mainTaskId));

  const completed = teamSubs.filter((s) => s.status === "completed").length;
  const inProgress = teamSubs.filter((s) => s.status === "in_progress").length;
  const notStarted = teamSubs.filter((s) => s.status === "not_started").length;
  const completionRate = teamSubs.length > 0 ? Math.round(completed / teamSubs.length * 100) : 0;

  const urgentTasks = [...teamSubs].
    filter((s) => s.status !== "completed").
    sort((a, b) => urgencyScore(a) - urgencyScore(b)).
    slice(0, 10);

  const getMainTask = (id: string) => wsTasks.find((m) => m.id === id);
  const getUser = (id: string | null) => users.find((u) => u.id === id);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">






          </div>
          <h2 className="text-2xl font-heading font-normal text-foreground">
            {getGreeting()} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your team has <span className="font-medium text-foreground">{inProgress}</span> modules in progress
            {notStarted > 0 && <span className="text-warning font-medium"> · {notStarted} not started</span>}
          </p>
        </div>
        <button onClick={() => navigate("/tasks")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <ArrowRight className="w-4 h-4" /> Manage Tasks
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Team Tasks" value={wsTasks.length} icon={TrendingUp} color="blue" sub="Main tasks" />
        <StatCard label="In Progress" value={inProgress} icon={Loader2} color="blue" sub={`${Math.round(inProgress / Math.max(teamSubs.length, 1) * 100)}% of modules`} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} color="green" sub={`${completionRate}% completion rate`} />
        <StatCard label="Not Started" value={notStarted} icon={AlertTriangle} color="yellow" sub="Awaiting attention" />
      </motion.div>

      {/* Progress bar */}
      <motion.div variants={item} className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Team Progress</span>
          </div>
          <span className="text-sm font-semibold text-primary">{completionRate}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${completionRate}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="h-full bg-primary rounded-full" />
        </div>
        <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />{inProgress} in progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />{completed} completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" />{notStarted} not started</span>
        </div>
      </motion.div>

      {/* Urgent Tasks + By Main Task */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Top 10 Urgent */}
        <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-medium text-foreground">Top Urgent Tasks</h3>
              <span className="text-[11px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">{urgentTasks.length}</span>
            </div>
            <button onClick={() => navigate("/tasks")} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {urgentTasks.length === 0 ?
              <div className="px-5 py-10 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm text-muted-foreground">All clear! No pending tasks.</p>
              </div> :
              urgentTasks.map((sub, i) => {
                const mt = getMainTask(sub.mainTaskId);
                const assignee = getUser(sub.assignedTo);
                const sc = statusConfig[sub.status as keyof typeof statusConfig] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline));
                return (
                  <div key={sub.id} onClick={() => setOpenSubtaskId(sub.id)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="text-[11px] font-bold text-muted-foreground/50 w-5 text-center">{i + 1}</span>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-destructive' : sub.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{sub.title}</p>
                        {mt?.priority && <PriorityPill priority={mt.priority} />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{assignee?.name ?? "Unassigned"}</span>
                        <span>·</span>
                        <span>{mt?.title ?? ""}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                      <StatusIcon className="w-3 h-3" />{sc.label}
                    </span>
                    {sub.deadline &&
                      <span className={`text-[11px] flex-shrink-0 w-16 text-right hidden sm:block ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3 inline mr-0.5" />{formatDueDate(sub.deadline)}
                      </span>
                    }
                  </div>);

              })}
          </div>
        </motion.div>

        {/* Right column */}
        <motion.div variants={item} className="lg:col-span-2 space-y-3">
          <ProductivityScore />
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-medium text-foreground mb-3">By Main Task</p>
            <div className="space-y-2">
              {wsTasks.map((mt) => {
                const prog = getMainTaskProgress(mt.id, teamSubs);
                const pct = prog.total > 0 ? Math.round(prog.completed / prog.total * 100) : 0;
                return (
                  <div key={mt.id} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary flex-shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1 truncate">{mt.title}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mx-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right">{prog.completed}/{prog.total}</span>
                  </div>);

              })}
            </div>
          </div>
        </motion.div>
      </div>
      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </motion.div>);

}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEAM WORKSPACE — USER DASHBOARD
═══════════════════════════════════════════════════════════════════════════════ */
function UserDashboard() {
  const { currentUser } = useAuth();
  const { subtasks, users } = useAppData();
  const { wsTasks, wsMembers } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const wsTaskIds = new Set(wsTasks.map((mt) => mt.id));
  const teamSubs = subtasks.filter((s) => wsTaskIds.has(s.mainTaskId));

  const mySubs = teamSubs.filter((s) => s.assignedTo === currentUser?.id);
  const myCreatedTasks = wsTasks.filter((mt) => mt.createdBy === currentUser?.id);

  const myDone = mySubs.filter((s) => s.status === 'completed').length;
  const myProgress = mySubs.filter((s) => s.status === 'in_progress').length;
  const myPending = mySubs.filter((s) => s.status === 'not_started').length;
  const myRate = mySubs.length > 0 ? Math.round(myDone / mySubs.length * 100) : 0;
  const myPendingApproval = mySubs.filter((s) => s.status === 'pending_approval').length;

  const myUrgent = [...mySubs].
    filter((s) => s.status !== 'completed').
    sort((a, b) => urgencyScore(a) - urgencyScore(b)).
    slice(0, 10);

  const getUser = (id: string | null) => users.find((u) => u.id === id);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              Team Workspace · {wsMembers.length} member{wsMembers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <h2 className="text-2xl font-heading font-normal text-foreground">
            {getGreeting()}, {currentUser?.name.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            You have <span className="font-medium text-foreground">{myProgress}</span> tasks in progress
            {myPending > 0 && <span className="text-warning font-medium"> · {myPending} not started</span>}
            {myPendingApproval > 0 && <span className="text-warning font-medium"> · {myPendingApproval} awaiting approval</span>}
          </p>
        </div>
        <button onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <ArrowRight className="w-4 h-4" /> All Tasks
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assigned to Me" value={mySubs.length} icon={TrendingUp} color="blue" sub="My subtasks" />
        <StatCard label="In Progress" value={myProgress} icon={Loader2} color="blue" sub={`${Math.round(myProgress / Math.max(mySubs.length, 1) * 100)}% of mine`} />
        <StatCard label="Completed" value={myDone} icon={CheckCircle2} color="green" sub={`${myRate}% completion rate`} />
        <StatCard label="Tasks I Created" value={myCreatedTasks.length} icon={Users} color="yellow" sub="Tasks I initiated" />
      </motion.div>

      {/* Progress bar */}
      <motion.div variants={item} className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">My Progress</span>
          </div>
          <span className="text-sm font-semibold text-primary">{myRate}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${myRate}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            className="h-full bg-primary rounded-full" />
        </div>
        <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />{myProgress} in progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />{myDone} completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" />{myPending} pending</span>
          {myPendingApproval > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" />{myPendingApproval} awaiting approval</span>}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* My Urgent Tasks */}
        <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-medium text-foreground">My Urgent Tasks</h3>
              {myUrgent.length > 0 &&
                <span className="text-[11px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-semibold">{myUrgent.length}</span>
              }
            </div>
            <button onClick={() => navigate('/tasks')} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {myUrgent.length === 0 ?
              <div className="px-5 py-10 text-center">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-sm text-muted-foreground">No pending tasks. You're all caught up!</p>
              </div> :
              myUrgent.map((sub, i) => {
                const mt = wsTasks.find((m) => m.id === sub.mainTaskId);
                const sc = (statusConfig as Record<string, typeof statusConfig['completed']>)[sub.status] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';
                return (
                  <div key={sub.id} onClick={() => setOpenSubtaskId(sub.id)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="text-[11px] font-bold text-muted-foreground/50 w-5 text-center">{i + 1}</span>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-destructive' :
                      sub.status === 'in_progress' ? 'bg-primary' :
                        sub.status === 'pending_approval' ? 'bg-warning' : 'bg-muted-foreground/30'}`
                    } />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate group-hover:text-primary transition-colors ${sub.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`
                        }>{sub.title}</p>
                        {mt?.priority && <PriorityPill priority={mt.priority} />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{mt?.title ?? ''}</span>
                        {sub.deadline && <><span>·</span><span className={`flex items-center gap-0.5 ${isOverdue ? 'text-destructive' : ''}`}>
                          <Clock className="w-3 h-3" />{formatDueDate(sub.deadline)}
                        </span></>}
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                      <StatusIcon className="w-3 h-3" />{sc.label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </div>);

              })}
          </div>
        </motion.div>

        {/* Right column */}
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <ProductivityScore />

          {myCreatedTasks.length > 0 &&
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-medium text-foreground">Tasks I Created</h3>
                <span className="ml-auto text-[11px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/20">{myCreatedTasks.length}</span>
              </div>
              <div className="divide-y divide-border/50">
                {myCreatedTasks.slice(0, 4).map((mt) => {
                  const subs = teamSubs.filter((s) => s.mainTaskId === mt.id);
                  const done = subs.filter((s) => s.status === 'completed').length;
                  const pendingApproval = subs.filter((s) => s.status === 'pending_approval').length;
                  const pct = subs.length > 0 ? Math.round(done / subs.length * 100) : 0;
                  return (
                    <div key={mt.id} onClick={() => navigate(`/tasks?openTask=${mt.id}`)}
                      className="px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors group">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors flex-1">{mt.title}</p>
                        {pendingApproval > 0 &&
                          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                            {pendingApproval} awaiting approval
                          </span>
                        }
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">{done}/{subs.length}</span>
                      </div>
                    </div>);

                })}
              </div>
            </div>
          }

          {/* Team Activity — only in team workspace */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Team Activity</h3>
            </div>
            <div className="divide-y divide-border/50">
              {[...teamSubs].
                sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).
                slice(0, 5).
                map((sub) => {
                  const assignee = getUser(sub.assignedTo);
                  const mt = wsTasks.find((m) => m.id === sub.mainTaskId);
                  const isMe = sub.assignedTo === currentUser?.id;
                  return (
                    <div key={sub.id} onClick={() => setOpenSubtaskId(sub.id)}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className={`w-6 h-6 rounded-full ${assignee?.avatarColor ?? 'bg-muted-foreground/50'} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5`}>
                        {assignee?.name.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {isMe ? <span className="text-primary">You</span> : assignee?.name.split(' ')[0] ?? 'Unassigned'}
                          {' '}<span className="text-muted-foreground font-normal">· {sub.title}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{mt?.title}</p>
                      </div>
                    </div>);

                })}
            </div>
          </div>
        </motion.div>
      </div>

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </motion.div>);

}

/* ─── Team Productivity Score ────────────────────────────────────────────── */
function ProductivityScore() {
  const { currentUser } = useAuth();
  const { subtasks, reminders } = useAppData();
  const { wsTasks } = useWorkspace();

  const wsTaskIds = new Set(wsTasks.map((mt) => mt.id));
  const mySubs = subtasks.filter((s) => wsTaskIds.has(s.mainTaskId) && s.assignedTo === currentUser?.id);

  const total = mySubs.length;
  const completed = mySubs.filter((s) => s.status === 'completed').length;
  const completionRate = total > 0 ? completed / total : 0;
  const withDeadline = mySubs.filter((s) => s.deadline && s.status === 'completed');
  const onTime = withDeadline.filter((s) => {
    const deadline = new Date(s.deadline!);
    const updated = new Date(s.updatedAt);
    return updated <= deadline;
  }).length;
  const onTimeRate = withDeadline.length > 0 ? onTime / withDeadline.length : completed > 0 ? 1 : 0;
  const notStuck = mySubs.filter((s) => s.status !== 'not_started').length;
  const engagementRate = total > 0 ? notStuck / total : 0;
  const myReminders = reminders.filter((r) => r.isActive && (r.createdBy === currentUser?.id || r.recipientIds.includes(currentUser?.id ?? '')));
  const reminderScore = Math.min(myReminders.length / 3, 1);
  const score = Math.round(completionRate * 40 + onTimeRate * 30 + engagementRate * 20 + reminderScore * 10);

  const getScoreColor = (s: number) => {
    if (s >= 80) return { ring: 'text-green-500', bg: 'bg-green-500', label: 'Excellent', emoji: '🔥' };
    if (s >= 60) return { ring: 'text-primary', bg: 'bg-primary', label: 'Good', emoji: '👍' };
    if (s >= 40) return { ring: 'text-warning', bg: 'bg-warning', label: 'Fair', emoji: '📈' };
    return { ring: 'text-destructive', bg: 'bg-destructive', label: 'Needs Work', emoji: '💪' };
  };
  const sc = getScoreColor(score);

  const breakdowns = [
    { label: 'Completion', value: Math.round(completionRate * 100), weight: '40%' },
    { label: 'On-Time', value: Math.round(onTimeRate * 100), weight: '30%' },
    { label: 'Engagement', value: Math.round(engagementRate * 100), weight: '20%' },
    { label: 'Planning', value: Math.round(reminderScore * 100), weight: '10%' }];


  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className={`w-4 h-4 ${sc.ring}`} />
        <h3 className="text-sm font-medium text-foreground">Productivity Score</h3>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor"
              className={sc.ring} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${score / 100 * 213.6} 213.6`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">{score}</span>
            <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">{sc.emoji} {sc.label}</span>
          </div>
          {breakdowns.map((b) =>
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-20">{b.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${sc.bg} transition-all`} style={{ width: `${b.value}%` }} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{b.value}%</span>
            </div>
          )}
        </div>
      </div>
      {total === 0 &&
        <p className="text-[11px] text-muted-foreground mt-3 text-center">Assign tasks to start tracking productivity</p>
      }
    </div>);

}

/* ─── Shared StatCard ──────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color, sub

}: { label: string; value: number; icon: React.ElementType; color: "blue" | "green" | "red" | "yellow" | "gray"; sub?: string; }) {
  const colorMap = {
    blue: { icon: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    green: { icon: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
    red: { icon: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
    yellow: { icon: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    gray: { icon: "text-muted-foreground", bg: "bg-muted", border: "border-border" }
  };
  const c = colorMap[color];
  return (
    <div className={`p-4 rounded-xl bg-card border ${c.border} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-semibold ${c.icon} tabular-nums`}>{value}</p>
      <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>);

}
