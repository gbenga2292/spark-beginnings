import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/hooks/useAuth";
import { useAppData, deriveMainTaskStatus, getMainTaskProgress } from "@/src/contexts/AppDataContext";
import { useWorkspace } from "@/src/hooks/use-workspace";
import { useAppStore as useStore } from "@/src/store/appStore";
import {
  CheckCircle2, AlertTriangle, TrendingUp, ArrowRight,
  Circle, Loader2, Calendar, Clock, Users, BarChart2,
  Flame, Zap, Award, Flag, Lock, Target, ListTodo, Activity,
  CheckCheck, Layers, ArrowUpRight, Sparkles, ChevronRight, ChevronDown,
  Archive, RotateCcw, Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, isPast, differenceInHours } from "date-fns";
import { TaskDetailSheet } from "@/src/components/tasks/TaskDetailSheet";
import { Button } from "@/src/components/ui/button";
import { toast, showConfirm } from "@/src/components/ui/toast";
import { supabase } from "@/src/integrations/supabase/client";
import type { TaskPriority } from "@/src/types/tasks";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

const statusConfig = {
  not_started: { label: "Not Started", pillClass: "chip-pending", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress", icon: Loader2 },
  pending_approval: { label: "Pending Approval", pillClass: "chip-pending-approval", icon: Circle },
  completed: { label: "Completed", pillClass: "chip-completed", icon: CheckCircle2 }
};

const PRIORITY_BADGE: Record<TaskPriority, { cls: string; dot: string }> = {
  low:    { cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  medium: { cls: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-400' },
  high:   { cls: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' },
  urgent: { cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' },
};

function PriorityPill({ priority }: { priority?: TaskPriority }) {
  if (!priority) return null;
  const p = PRIORITY_BADGE[priority];
  if (!p) return null; // guard against unknown/legacy priority values from DB
  return (
    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${p.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />{priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function safeFmt(d?: string, fmt = "MMM d") {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isPast(date)) return `${format(date, fmt)} (overdue)`;
    return format(date, fmt);
  } catch { return ""; }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function urgencyScore(sub: { deadline?: string; status: string }) {
  if (sub.status === "completed") return 99999;
  if (sub.deadline) {
    const hoursUntil = differenceInHours(new Date(sub.deadline), new Date());
    return hoursUntil < 0 ? -1000 + hoursUntil : hoursUntil;
  }
  return 5000;
}

/* ─── Router ──────────────────────────────────────────────────────────────── */
export function TaskDashboard() {
  const { user: currentUser } = useAuth();
  const { isPersonal } = useWorkspace();
  if (isPersonal) return <PersonalSpaceDashboard />;
  if (currentUser?.role === "admin") return <AdminDashboard />;
  return <UserDashboard />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERSONAL SPACE DASHBOARD — vibrant violet theme
══════════════════════════════════════════════════════════════════════════════ */
function PersonalSpaceDashboard() {
  const { user: currentUser } = useAuth();
  const { subtasks } = useAppData();
  const { wsTasks, workspace } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const activeWsTasks = wsTasks.filter(mt => {
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project;
  });

  const wsTaskIds = new Set(activeWsTasks.map(mt => mt.id));
  const wsSubs = subtasks.filter(s => wsTaskIds.has(s.mainTaskId!));

  const completed = wsSubs.filter(s => s.status === 'completed').length;
  const inProgress = wsSubs.filter(s => s.status === 'in_progress').length;
  const notStarted = wsSubs.filter(s => s.status === 'not_started').length;
  const rate = wsSubs.length > 0 ? Math.round(completed / wsSubs.length * 100) : 0;
  const urgent = [...wsSubs].filter(s => s.status !== 'completed').sort((a, b) => urgencyScore(a) - urgencyScore(b)).slice(0, 8);

  const name = ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'User').split(' ')[0].split('@')[0];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-8">

      {/* ── Hero Header ── */}
      <motion.div variants={item}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-lg">
          {/* Abstract background blobs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-24 w-32 h-32 bg-white/5 rounded-full blur-xl" />
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <Lock className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full border border-white/20 backdrop-blur-sm">
                  Personal Space
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {getGreeting()}, {name} 👋
              </h2>
              <p className="text-white/70 text-sm mt-1">
                {inProgress > 0
                  ? <><span className="font-semibold text-white">{inProgress}</span> tasks in progress · <span className="text-white/60">{completed} completed</span></>
                  : 'Your private workspace — no teammates, just you.'
                }
              </p>
            </div>
            <button onClick={() => navigate('/tasks')} className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold transition-all backdrop-blur-sm">
              <ListTodo className="w-4 h-4" /> My Tasks <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Inline mini-stats */}
          <div className="relative mt-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: activeWsTasks.length, icon: Layers },
              { label: 'Active', value: inProgress, icon: Activity },
              { label: 'Done', value: completed, icon: CheckCheck },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-center backdrop-blur-sm">
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-white/60 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Progress + Score row ── */}
      <motion.div variants={item} className="grid lg:grid-cols-5 gap-5">
        {/* Progress bar card */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Overall Progress</p>
                <p className="text-[11px] text-muted-foreground">Across {activeWsTasks.length} task groups</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">{rate}%</span>
          </div>
          {/* Multi-segment progress */}
          <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden flex">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(inProgress / Math.max(wsSubs.length, 1)) * 100}%` }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="h-full bg-violet-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              className="h-full bg-green-500" />
          </div>
          <div className="flex items-center gap-5 mt-4">
            {[
              { label: 'In Progress', count: inProgress, color: 'bg-violet-500' },
              { label: 'Completed', count: completed, color: 'bg-green-500' },
              { label: 'Pending', count: notStarted, color: 'bg-muted-foreground/25' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.count} {s.label}</span>
              </div>
            ))}
          </div>
          {/* Task group mini-bars */}
          {activeWsTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {activeWsTasks.slice(0, 4).map(mt => {
                const prog = getMainTaskProgress(mt.id, wsSubs);
                const pct = prog.total > 0 ? Math.round(prog.completed / prog.total * 100) : 0;
                return (
                  <div key={mt.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex-shrink-0 w-28 truncate">{mt.title}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-400 dark:bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Productivity Score */}
        <div className="lg:col-span-2">
          <PersonalProductivityScore />
        </div>
      </motion.div>

      {/* ── Upcoming Tasks ── */}
      <motion.div variants={item} className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Upcoming Tasks</h3>
              <p className="text-[11px] text-muted-foreground">Sorted by urgency</p>
            </div>
            {urgent.length > 0 && (
              <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-bold border border-violet-200 dark:border-violet-800">
                {urgent.length}
              </span>
            )}
          </div>
          <button onClick={() => navigate('/tasks')} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500 transition-colors">
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {urgent.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">All tasks complete!</p>
            <p className="text-xs text-muted-foreground mt-1">Check back after adding new tasks.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {urgent.map((sub, i) => {
              const mt = activeWsTasks.find(m => m.id === sub.mainTaskId);
              const sc = statusConfig[sub.status as keyof typeof statusConfig] ?? statusConfig.not_started;
              const StatusIcon = sc.icon;
              const isOverdue = sub.deadline && isPast(new Date(sub.deadline));
              return (
                <div key={sub.id ?? i} onClick={() => setOpenSubtaskId(sub.id ?? null)}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 cursor-pointer transition-colors group">
                  <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums">{i + 1}</span>
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : sub.status === 'in_progress' ? 'bg-violet-500' : 'bg-muted-foreground/20'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors font-medium">{sub.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{mt?.title}</p>
                  </div>
                  {mt?.priority && <PriorityPill priority={mt.priority} />}
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                    <StatusIcon className="w-3 h-3" />{sc.label}
                  </span>
                  {sub.deadline && (
                    <span className={`text-[11px] flex-shrink-0 hidden sm:flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                      <Clock className="w-3 h-3" />{safeFmt(sub.deadline)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </motion.div>
  );
}

/* ─── Personal Productivity Score ──────────────────────────────────────── */
function PersonalProductivityScore() {
  const { user: currentUser } = useAuth();
  const { subtasks, reminders } = useAppData();
  const { wsTasks } = useWorkspace();
  const activeWsTasks = wsTasks.filter(mt => {
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project;
  });
  const wsTaskIds = new Set(activeWsTasks.map(mt => mt.id));
  const mySubs = subtasks.filter(s => wsTaskIds.has(s.mainTaskId!));
  const myReminders = reminders.filter(r => r.isActive && r.createdBy === currentUser?.id);

  const total = mySubs.length;
  const completed = mySubs.filter(s => s.status === 'completed').length;
  const completionRate = total > 0 ? completed / total : 0;
  const withDeadline = mySubs.filter(s => s.deadline && s.status === 'completed');
  const onTime = withDeadline.filter(s => new Date(s.updatedAt!) <= new Date(s.deadline!)).length;
  const onTimeRate = withDeadline.length > 0 ? onTime / withDeadline.length : completed > 0 ? 1 : 0;
  const notStuck = mySubs.filter(s => s.status !== 'not_started').length;
  const engagementRate = total > 0 ? notStuck / total : 0;
  const reminderScore = Math.min(myReminders.length / 3, 1);
  const score = Math.round(completionRate * 40 + onTimeRate * 30 + engagementRate * 20 + reminderScore * 10);

  const getScoreGrade = (s: number) => {
    if (s >= 80) return { ring: '#22c55e', label: 'Excellent', emoji: '🔥', ringCls: 'text-green-500' };
    if (s >= 60) return { ring: '#8b5cf6', label: 'Good', emoji: '💡', ringCls: 'text-violet-500' };
    if (s >= 40) return { ring: '#f59e0b', label: 'Fair', emoji: '📈', ringCls: 'text-amber-500' };
    return { ring: '#ef4444', label: 'Needs Work', emoji: '💪', ringCls: 'text-red-500' };
  };
  const sc = getScoreGrade(score);

  const breakdowns = [
    { label: 'Completion', value: Math.round(completionRate * 100) },
    { label: 'On-Time', value: Math.round(onTimeRate * 100) },
    { label: 'Engagement', value: Math.round(engagementRate * 100) },
    { label: 'Planning', value: Math.round(reminderScore * 100) },
  ];

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Award className={`w-4 h-4 ${sc.ringCls}`} />
        <h3 className="text-sm font-semibold text-foreground">Productivity Score</h3>
        <span className="ml-auto text-xs font-semibold text-muted-foreground/60">{sc.emoji} {sc.label}</span>
      </div>

      <div className="flex items-center gap-4 mb-5">
        {/* SVG ring */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
            <circle cx="44" cy="44" r={radius} fill="none" stroke={sc.ring}
              strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{score}</span>
            <span className="text-[9px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        {/* bars */}
        <div className="flex-1 space-y-2">
          {breakdowns.map(b => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16">{b.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${b.value}%` }}
                  transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                  style={{ backgroundColor: sc.ring }}
                  className="h-full rounded-full" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{b.value}%</span>
            </div>
          ))}
        </div>
      </div>
      {total === 0 && (
        <p className="text-[11px] text-muted-foreground text-center mt-auto">Create tasks to start tracking</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — team-focused, bold data-driven design
══════════════════════════════════════════════════════════════════════════════ */
function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const { subtasks, users } = useAppData();
  const { wsTasks, wsMembers } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const activeWsTasks = wsTasks.filter(mt => {
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project;
  });

  const wsTaskIds = new Set(activeWsTasks.map(mt => mt.id));
  const teamSubs = subtasks.filter(s => wsTaskIds.has(s.mainTaskId!));

  const completed = teamSubs.filter(s => s.status === "completed").length;
  const inProgress = teamSubs.filter(s => s.status === "in_progress").length;
  const notStarted = teamSubs.filter(s => s.status === "not_started").length;
  const pendingApproval = teamSubs.filter(s => s.status === "pending_approval").length;
  const completionRate = teamSubs.length > 0 ? Math.round(completed / teamSubs.length * 100) : 0;

  const urgentTasks = [...teamSubs].filter(s => s.status !== "completed").sort((a, b) => urgencyScore(a) - urgencyScore(b)).slice(0, 10);
  const getMainTask = (id: string) => activeWsTasks.find(m => m.id === id);
  const getUser = (id: string | null) => users.find(u => u.id === id);

  const name = ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'Admin').split(' ')[0].split('@')[0];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-8">

      {/* ── Hero Banner ── */}
      <motion.div variants={item}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 p-6 text-white shadow-lg">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-32 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          </div>
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/20">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full border border-white/20">
                  Team Workspace · {wsMembers.length} members
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">{getGreeting()}, {name} 👋</h2>
              <p className="text-white/70 text-sm mt-1">
                Your team has <span className="font-semibold text-white">{inProgress}</span> tasks in progress
                {pendingApproval > 0 && <span className="text-amber-200"> · {pendingApproval} awaiting approval</span>}
              </p>
            </div>
            <button onClick={() => navigate("/tasks")} className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold transition-all">
              Manage Tasks <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {/* Stats row */}
          <div className="relative mt-5 grid grid-cols-4 gap-2">
            {[
              { label: 'Tasks', value: activeWsTasks.length, icon: Layers },
              { label: 'Active', value: inProgress, icon: Activity },
              { label: 'Review', value: pendingApproval, icon: Clock },
              { label: 'Done', value: completed, icon: CheckCheck },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 px-2 py-2.5 text-center backdrop-blur-sm">
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-white/60 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Team Tasks" value={activeWsTasks.length} icon={TrendingUp} color="blue" sub="Main tasks" />
        <StatCard label="In Progress" value={inProgress} icon={Loader2} color="blue" sub={`${Math.round(inProgress / Math.max(teamSubs.length, 1) * 100)}% active`} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} color="green" sub={`${completionRate}% rate`} />
        <StatCard label="Awaiting" value={notStarted} icon={AlertTriangle} color="yellow" sub="Not started" />
      </motion.div>

      {/* ── Main content ── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* Urgent tasks */}
        <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Flame className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Top Urgent Tasks</h3>
                <p className="text-[11px] text-muted-foreground">{urgentTasks.length} items need attention</p>
              </div>
            </div>
            <button onClick={() => navigate("/tasks")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {urgentTasks.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">All clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No pending urgent tasks.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {urgentTasks.map((sub, i) => {
                const mt = getMainTask(sub.mainTaskId!);
                const assignee = getUser(sub.assignedTo?.split(',')[0] ?? null);
                const sc = statusConfig[sub.status as keyof typeof statusConfig] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline));
                return (
                  <div key={sub.id ?? i} onClick={() => setOpenSubtaskId(sub.id ?? null)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors group">
                    <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums">{i + 1}</span>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : sub.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors font-medium">{sub.title}</p>
                        {mt?.priority && <PriorityPill priority={mt.priority} />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{assignee?.name ?? "Unassigned"}{sub.assignedTo?.includes(',') && ' +'}</span>
                        <span>·</span>
                        <span className="truncate">{mt?.title ?? ""}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                      <StatusIcon className="w-3 h-3" />{sc.label}
                    </span>
                    {sub.deadline && (
                      <span className={`text-[11px] flex-shrink-0 hidden sm:flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />{safeFmt(sub.deadline)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Right column */}
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <ProductivityScore />

          {/* Team progress by task */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">By Main Task</h4>
            </div>
            <div className="space-y-3">
              {activeWsTasks.slice(0, 6).map(mt => {
                const prog = getMainTaskProgress(mt.id, teamSubs);
                const pct = prog.total > 0 ? Math.round(prog.completed / prog.total * 100) : 0;
                return (
                  <div key={mt.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground truncate flex-1 pr-2">{mt.title}</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">{prog.completed}/{prog.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   USER DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */
function UserDashboard() {
  const { user: currentUser } = useAuth();
  const { subtasks, users } = useAppData();
  const { wsTasks, wsMembers } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const { hrVariables } = useStore();
  const { restoreSubtask, deleteSubtaskPermanently } = useAppData();

  const activeWsTasks = wsTasks.filter(mt => {
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project;
  });

  const [taskFilter, setTaskFilter] = useState<'my_tasks' | 'urgent' | 'all' | 'completed' | 'under_review'>('my_tasks');
  const myCreatedTasks = activeWsTasks.filter(mt => mt.createdBy === currentUser?.id);
  const wsTaskIds = new Set(activeWsTasks.map(mt => mt.id));
  const mySubs = subtasks.filter(s => s.assignedTo?.includes(currentUser?.id as string) && !s.is_deleted && wsTaskIds.has((s as any).main_task_id || s.mainTaskId));


  const myDone = mySubs.filter(s => s.status === 'completed').length;
  const myProgress = mySubs.filter(s => s.status === 'in_progress').length;
  const myPending = mySubs.filter(s => s.status === 'not_started').length;
  const myRate = mySubs.length > 0 ? Math.round(myDone / mySubs.length * 100) : 0;
  const myPendingApproval = mySubs.filter(s => s.status === 'pending_approval').length;

  const displayedTasks = (() => {
    switch (taskFilter) {
      case 'urgent':
        return [...mySubs].filter(s => s.status !== 'completed').sort((a, b) => urgencyScore(a) - urgencyScore(b)).slice(0, 10);
      case 'completed':
        return [...mySubs].filter(s => s.status === 'completed').sort((a, b) => urgencyScore(a) - urgencyScore(b));
      case 'under_review':
        return [...mySubs].filter(s => s.status === 'pending_approval').sort((a, b) => urgencyScore(a) - urgencyScore(b));
      case 'all':
        return [...mySubs].sort((a, b) => urgencyScore(a) - urgencyScore(b)).slice(0, 50);
      case 'my_tasks':
      default:
        return [...mySubs].filter(s => s.status !== 'completed').sort((a, b) => urgencyScore(a) - urgencyScore(b));
    }
  })();
  const getUser = (id: string | null) => users.find(u => u.id === id);

  const name = ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'User').split(' ')[0].split('@')[0];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-8">

      {/* ── Hero Banner ── */}
      <motion.div variants={item}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-lg">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/8 rounded-full blur-2xl" />
          </div>
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full border border-white/20">
                  Team Workspace · {wsMembers.length} members
                </span>
              </div>
              <h2 className="text-2xl font-bold">{getGreeting()}, {name} 👋</h2>
              <p className="text-white/70 text-sm mt-1">
                You have <span className="font-semibold text-white">{myProgress}</span> tasks in progress
                {myPendingApproval > 0 && <span className="text-amber-200"> · {myPendingApproval} awaiting approval</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/tasks/archive')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all">
                <Archive className="w-4 h-4" />
                Archive
              </button>
              <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold transition-all">
                All Tasks <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-4 gap-2">
            {[
              { label: 'Assigned', value: mySubs.length },
              { label: 'Active', value: myProgress },
              { label: 'Approval', value: myPendingApproval },
              { label: 'Done', value: myDone },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 px-2 py-2.5 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-white/60 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assigned to Me" value={mySubs.length} icon={TrendingUp} color="blue" sub="My subtasks" />
        <StatCard label="In Progress" value={myProgress} icon={Loader2} color="blue" sub={`${Math.round(myProgress / Math.max(mySubs.length, 1) * 100)}% of mine`} />
        <StatCard label="Completed" value={myDone} icon={CheckCircle2} color="green" sub={`${myRate}% completion rate`} />
        <StatCard label="Tasks I Created" value={myCreatedTasks.length} icon={Users} color="yellow" sub="Tasks I initiated" />
      </motion.div>

      {/* ── Progress ── */}
      <motion.div variants={item} className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">My Progress</span>
          </div>
          <span className="text-lg font-bold text-primary tabular-nums">{myRate}%</span>
        </div>
        <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(myProgress / Math.max(mySubs.length, 1)) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="h-full bg-primary" />
          <motion.div initial={{ width: 0 }} animate={{ width: `${myRate}%` }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="h-full bg-green-500" />
          {myPendingApproval > 0 && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${(myPendingApproval / Math.max(mySubs.length, 1)) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              className="h-full bg-amber-400" />
          )}
        </div>
        <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />{myProgress} in progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />{myDone} completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" />{myPending} pending</span>
          {myPendingApproval > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />{myPendingApproval} in review</span>}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Urgent tasks */}
        <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="relative flex items-center">
                  <select
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value as any)}
                    className="text-sm font-semibold text-foreground bg-transparent border-none py-0 pl-0 pr-5 focus:ring-0 cursor-pointer appearance-none outline-none z-10"
                  >
                    <option className="bg-card text-foreground" value="my_tasks">My Tasks</option>
                    <option className="bg-card text-foreground" value="urgent">Urgent Tasks</option>
                    <option className="bg-card text-foreground" value="all">All Tasks</option>
                    <option className="bg-card text-foreground" value="completed">Completed Tasks</option>
                    <option className="bg-card text-foreground" value="under_review">Under Review Tasks</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-0 pointer-events-none" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {taskFilter === 'urgent' ? 'Sorted by deadline' : 'Sorted by urgency'}
                </p>
              </div>
            </div>
            <button onClick={() => navigate('/tasks')} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {displayedTasks.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">You're all caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No pending tasks found for this filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {displayedTasks.map((sub, i) => {
                const mt = activeWsTasks.find(m => m.id === sub.mainTaskId);
                const sc = (statusConfig as Record<string, typeof statusConfig['completed']>)[sub.status] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';
                return (
                  <div key={sub.id ?? i} onClick={() => setOpenSubtaskId(sub.id ?? null)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group cursor-pointer">
                    <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums">{i + 1}</span>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : sub.status === 'in_progress' ? 'bg-primary' : sub.status === 'pending_approval' ? 'bg-amber-400' : 'bg-muted-foreground/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate group-hover:text-primary transition-colors ${sub.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{sub.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{mt?.title ?? ''}</span>
                        {sub.deadline && <>
                          <span>·</span>
                          <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                            <Clock className="w-3 h-3" />{safeFmt(sub.deadline)}
                          </span>
                        </>}
                      </div>
                    </div>
                    <>
                      {mt?.priority && <PriorityPill priority={mt.priority} />}
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                        <StatusIcon className="w-3 h-3" />{sc.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Right: score + created tasks */}
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <ProductivityScore />
          {myCreatedTasks.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Tasks I Created</h3>
                <span className="ml-auto text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{myCreatedTasks.length}</span>
              </div>
              <div className="divide-y divide-border/50">
                {myCreatedTasks.slice(0, 4).map(mt => {
                  const subs = subtasks.filter(s => s.mainTaskId === mt.id);
                  const done = subs.filter(s => s.status === 'completed').length;
                  const penApproval = subs.filter(s => s.status === 'pending_approval').length;
                  const pct = subs.length > 0 ? Math.round(done / subs.length * 100) : 0;
                  return (
                    <div key={mt.id} onClick={() => navigate(`/tasks?openTask=${mt.id}`)}
                      className="px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors flex-1">{mt.title}</p>
                        {penApproval > 0 && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">{penApproval} review</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{done}/{subs.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
    </motion.div>
  );
}

/* ─── Team Productivity Score (shared between admin + user) ─────────────── */
function ProductivityScore() {
  const { user: currentUser } = useAuth();
  const { subtasks, reminders } = useAppData();
  const { wsTasks } = useWorkspace();

  const wsTaskIds = new Set(wsTasks.map(mt => mt.id));
  const mySubs = subtasks.filter(s => wsTaskIds.has(s.mainTaskId!) && s.assignedTo?.includes(currentUser?.id as string));

  const total = mySubs.length;
  const completed = mySubs.filter(s => s.status === 'completed').length;
  const completionRate = total > 0 ? completed / total : 0;
  const withDeadline = mySubs.filter(s => s.deadline && s.status === 'completed');
  const onTime = withDeadline.filter(s => new Date(s.updatedAt!) <= new Date(s.deadline!)).length;
  const onTimeRate = withDeadline.length > 0 ? onTime / withDeadline.length : completed > 0 ? 1 : 0;
  const notStuck = mySubs.filter(s => s.status !== 'not_started').length;
  const engagementRate = total > 0 ? notStuck / total : 0;
  const myReminders = reminders.filter(r => r.isActive && (r.createdBy === currentUser?.id || r.recipientIds.includes(currentUser?.id ?? '')));
  const reminderScore = Math.min(myReminders.length / 3, 1);
  const score = Math.round(completionRate * 40 + onTimeRate * 30 + engagementRate * 20 + reminderScore * 10);

  const getScoreGrade = (s: number) => {
    if (s >= 80) return { ring: '#22c55e', label: 'Excellent', emoji: '🔥', ringCls: 'text-green-500' };
    if (s >= 60) return { ring: '#6366f1', label: 'Good', emoji: '💡', ringCls: 'text-primary' };
    if (s >= 40) return { ring: '#f59e0b', label: 'Fair', emoji: '📈', ringCls: 'text-amber-500' };
    return { ring: '#ef4444', label: 'Needs Work', emoji: '💪', ringCls: 'text-red-500' };
  };
  const sc = getScoreGrade(score);

  const breakdowns = [
    { label: 'Completion', value: Math.round(completionRate * 100) },
    { label: 'On-Time', value: Math.round(onTimeRate * 100) },
    { label: 'Engagement', value: Math.round(engagementRate * 100) },
    { label: 'Planning', value: Math.round(reminderScore * 100) },
  ];
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className={`w-4 h-4 ${sc.ringCls}`} />
        <h3 className="text-sm font-semibold text-foreground">Productivity Score</h3>
        <span className="ml-auto text-xs font-semibold text-muted-foreground/60">{sc.emoji} {sc.label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
            <circle cx="38" cy="38" r={radius} fill="none" stroke={sc.ring}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">{score}</span>
            <span className="text-[9px] text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {breakdowns.map(b => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16">{b.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div style={{ width: `${b.value}%`, backgroundColor: sc.ring }} className="h-full rounded-full transition-all" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground w-7 text-right">{b.value}%</span>
            </div>
          ))}
        </div>
      </div>
      {total === 0 && <p className="text-[11px] text-muted-foreground mt-3 text-center">Assign tasks to start tracking productivity</p>}
    </div>
  );
}

/* ─── Stat Card ─────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number; icon: React.ElementType;
  color: "blue" | "green" | "red" | "yellow" | "gray"; sub?: string;
}) {
  const accentMap = {
    blue:   { icon: "text-primary", bg: "bg-primary/10", accent: '#4f46e5', accentEnd: '#818cf8' },
    green:  { icon: "text-green-500", bg: "bg-green-500/10", accent: '#16a34a', accentEnd: '#4ade80' },
    red:    { icon: "text-destructive", bg: "bg-destructive/10", accent: '#dc2626', accentEnd: '#f87171' },
    yellow: { icon: "text-amber-500", bg: "bg-amber-500/10", accent: '#d97706', accentEnd: '#fbbf24' },
    gray:   { icon: "text-muted-foreground", bg: "bg-muted", accent: '#64748b', accentEnd: '#94a3b8' }
  };
  const c = accentMap[color];
  return (
    <div className="task-stat-card p-4" style={{ '--stat-accent': c.accent, '--stat-accent-end': c.accentEnd } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 ${c.icon}`} />
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/20" />
      </div>
      <p className={`text-2xl font-bold ${c.icon} tabular-nums`}>{value}</p>
      <p className="text-xs font-semibold text-foreground/80 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
