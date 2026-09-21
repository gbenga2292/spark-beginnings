import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/src/hooks/useAuth";
import { useAppData, deriveMainTaskStatus, getMainTaskProgress } from "@/src/contexts/AppDataContext";
import { useWorkspace } from "@/src/hooks/use-workspace";
import { useAppStore as useStore } from "@/src/store/appStore";
import { useUserStore } from "@/src/store/userStore";
import {
  CheckCircle2, AlertTriangle, TrendingUp, ArrowRight,
  Circle, Loader2, Calendar, Clock, Users, BarChart2,
  Flame, Zap, Award, Flag, Lock, Target, ListTodo, Activity,
  CheckCheck, Layers, ArrowUpRight, Sparkles, ChevronRight, ChevronDown,
  Archive, RotateCcw, Trash2, Fuel, Receipt, FileText, Building2,
  Hourglass, ShieldAlert, ShieldCheck, Wrench, AlertCircle, Package
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow, isPast, differenceInHours } from "date-fns";
import { TaskDetailSheet } from "@/src/components/tasks/TaskDetailSheet";
import { Button } from "@/src/components/ui/button";
import { toast, showConfirm } from "@/src/components/ui/toast";
import { supabase } from "@/src/integrations/supabase/client";
import type { TaskPriority } from "@/src/types/tasks";
import { useSetPageTitle } from "@/src/contexts/PageContext";
import { MetricHeroCard } from "@/src/components/ui/MetricHeroCard";
import { useRefillForecast } from "@/src/hooks/useRefillForecast";
import { useOperations } from "@/src/contexts/OperationsContext";
import { RefillForecastModal } from "@/src/components/analytics/RefillForecastModal";
import { ActiveSiteInvoicesModal } from "@/src/components/analytics/ActiveSiteInvoicesModal";
import { useActiveSiteInvoices, ActiveSiteInvoiceSummary } from "@/src/hooks/useActiveSiteInvoices";
import { InvoiceDetailDialog } from "@/src/pages/InvoiceDetailDialog";
import type { Invoice } from "@/src/store/appStore";
import { formatDisplayDate } from "@/src/lib/dateUtils";
import { cn } from "@/src/lib/utils";
import { useMachineReconSummary } from "@/src/hooks/useMachineReconSummary";
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

const statusConfig = {
  not_started: { label: "To Start", pillClass: "chip-pending", icon: Circle },
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

function isUserOwnApproval(
  sub: any,
  parentTask: any,
  currentUserId: string
): boolean {
  if (!sub || sub.is_deleted || sub.status !== 'pending_approval' || !currentUserId) return false;

  // 1. Current user is an assignee in this subtask (e.g. assigned workflow approvals, reviews, or tasks)
  const assignees = typeof sub.assignedTo === 'string'
    ? sub.assignedTo.split(',').map((id: string) => id.trim())
    : Array.isArray(sub.assignedTo) ? sub.assignedTo : [];
  if (assignees.includes(currentUserId)) return true;

  // 2. Current user is explicitly the designated approver for the subtask
  const subApproverId = sub.approverId || sub.approver_id;
  if (subApproverId && subApproverId === currentUserId) {
    return true;
  }

  // 3. Current user is explicitly the designated approver for the parent main task
  const mainApproverId = parentTask?.approverId || parentTask?.approver_id;
  if (mainApproverId && mainApproverId === currentUserId) {
    return true;
  }

  // 4. If no explicit approver was designated on the subtask or main task, the main task creator is the reviewer
  if (!subApproverId && !mainApproverId) {
    const creatorId = parentTask?.createdBy || parentTask?.created_by;
    if (creatorId && creatorId === currentUserId) {
      return true;
    }
  }

  return false;
}

/* â”€â”€â”€ Router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export function TaskDashboard() {
  const { user: currentUser } = useAuth();
  const { isPersonal } = useWorkspace();
  if (isPersonal) return <PersonalSpaceDashboard />;
  if (currentUser?.role === "admin") return <AdminDashboard />;
  return <UserDashboard />;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PERSONAL SPACE DASHBOARD â€” vibrant cobalt blue theme
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function PersonalSpaceDashboard() {
  const { user: currentUser } = useAuth();
  const { subtasks } = useAppData();
  const { wsTasks, workspace } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const userObj = useUserStore((s) => s.getCurrentUser());
  const firstName = userObj?.name ? userObj.name.split(' ')[0] : ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'User').split(' ')[0].split('@')[0];

  useSetPageTitle(
    `${getGreeting()}, ${firstName}`,
    'Operational Command & Launchpad',
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate('/tasks/archive')} className="gap-2">
        <Archive className="w-4 h-4" /> Archive
      </Button>
      <Button variant="default" size="sm" onClick={() => navigate('/tasks')} className="gap-2">
        <ListTodo className="w-4 h-4" /> My Tasks <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );

  const activeWsTasks = wsTasks.filter(mt => {
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project || mt.is_hr_task || mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id;
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

      {/* â”€â”€ Hero Metric Row â”€â”€ */}
      <motion.div variants={item}>
        <MetricHeroCard
          title="Personal Task Efficiency"
          heroValue={`${rate}%`}
          heroLabel="Completion Rate"
          period="Active Workspace"
          sparklineData={[
            Math.max(0, rate - 30),
            Math.max(0, rate - 20),
            Math.max(0, rate - 15),
            Math.max(0, rate - 5),
            rate
          ]}
          secondaryMetrics={[
            { label: 'Total Tasks', value: activeWsTasks.length },
            { label: 'In Progress', value: inProgress },
            { label: 'Completed', value: completed },
          ]}
        />
      </motion.div>

      {/* â”€â”€ Progress + Score row â”€â”€ */}
      <motion.div variants={item} className="grid lg:grid-cols-5 gap-5">
        {/* Progress bar card */}
        <div className="lg:col-span-3 bg-card border border-border rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Task Execution Breakdown</p>
              <p className="text-[11px] text-muted-foreground">Across {activeWsTasks.length} task groups</p>
            </div>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{rate}%</span>
          </div>
          {/* Multi-segment progress */}
          <div className="relative w-full h-2 bg-muted rounded-sm overflow-hidden flex">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(inProgress / Math.max(wsSubs.length, 1)) * 100}%` }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="h-full bg-blue-500" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              className="h-full bg-emerald-500" />
          </div>
          <div className="flex items-center gap-5 mt-4">
            {[
              { label: 'In Progress', count: inProgress, color: 'bg-blue-500' },
              { label: 'Completed', count: completed, color: 'bg-emerald-500' },
              { label: 'Pending', count: notStarted, color: 'bg-muted-foreground/30' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${s.color}`} />
                <span className="text-xs text-muted-foreground tabular-nums"><strong className="text-foreground">{s.count}</strong> {s.label}</span>
              </div>
            ))}
          </div>
          {/* Task group mini-bars */}
          {activeWsTasks.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
              {activeWsTasks.slice(0, 4).map(mt => {
                const prog = getMainTaskProgress(mt.id, wsSubs);
                const pct = prog.total > 0 ? Math.round(prog.completed / prog.total * 100) : 0;
                return (
                  <div key={mt.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex-shrink-0 w-28 truncate">{mt.title}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground w-8 text-right tabular-nums">{pct}%</span>
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

      {/* â”€â”€ Upcoming Tasks â”€â”€ */}
      <motion.div variants={item} className="bg-card border border-border rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">Upcoming Tasks</h3>
              <p className="text-[11px] text-muted-foreground truncate">Sorted by urgency</p>
            </div>
            {urgent.length > 0 && (
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-sm font-bold border border-blue-200 dark:border-blue-800 shrink-0 tabular-nums">
                {urgent.length}
              </span>
            )}
          </div>
          <button onClick={() => navigate('/tasks')} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors shrink-0 pl-2">
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {urgent.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
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
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums hidden sm:block">{i + 1}</span>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 hidden sm:block ${isOverdue ? 'bg-red-500' : sub.status === 'in_progress' ? 'bg-blue-600' : 'bg-muted-foreground/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">{sub.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{mt?.title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-0 mt-1 sm:mt-0 ml-0 sm:ml-auto">
                    {mt?.priority && <PriorityPill priority={mt.priority} />}
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${sc.pillClass}`}>
                      <StatusIcon className="w-3 h-3" />{sc.label}
                    </span>
                    {sub.deadline && (
                      <span className={`text-[11px] flex-shrink-0 flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />{safeFmt(sub.deadline)}
                      </span>
                    )}
                  </div>
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

/* â”€â”€â”€ Personal Productivity Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function PersonalProductivityScore() {
  const { user: currentUser } = useAuth();
  const { subtasks, reminders } = useAppData();
  const { wsTasks } = useWorkspace();
  const activeWsTasks = wsTasks.filter(mt => {
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project || mt.is_hr_task || mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id;
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
    if (s >= 80) return { ring: '#22c55e', label: 'Excellent', emoji: 'ðŸ”¥', ringCls: 'text-green-500' };
    if (s >= 60) return { ring: '#2563eb', label: 'Good', emoji: 'ðŸ’¡', ringCls: 'text-blue-500' };
    if (s >= 40) return { ring: '#f59e0b', label: 'Fair', emoji: 'ðŸ“ˆ', ringCls: 'text-amber-500' };
    return { ring: '#ef4444', label: 'Needs Work', emoji: 'ðŸ’ª', ringCls: 'text-red-500' };
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
    <div className="bg-card border border-border rounded-md p-5 h-full flex flex-col">
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN DASHBOARD â€” team-focused, bold data-driven design
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const { subtasks, users } = useAppData();
  const { wsTasks, wsMembers } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const userObj = useUserStore((s) => s.getCurrentUser());
  const firstName = userObj?.name ? userObj.name.split(' ')[0] : ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'User').split(' ')[0].split('@')[0];

  useSetPageTitle(
    `${getGreeting()}, ${firstName}`,
    'Operational Command & Launchpad',
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate('/tasks/archive')} className="gap-2">
        <Archive className="w-4 h-4" /> Archive
      </Button>
      <Button variant="default" size="sm" onClick={() => navigate('/tasks')} className="gap-2">
        Manage Tasks <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );

  const appUser = users.find(u => u.id === currentUser?.id);
  const isExternalHr = appUser?.privileges?.tasks?.isExternalHr;

  const activeWsTasks = wsTasks.filter(mt => {
    const isAssigned = (mt.assignedTo || (mt as any).assigned_to || '').includes(currentUser?.id || '');
    if (isExternalHr) return !!mt.is_hr_task || mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id || isAssigned;
    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project || mt.is_hr_task || mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id;
  });

  const wsTaskIds = new Set(activeWsTasks.map(mt => mt.id));
  const teamSubs = subtasks.filter(s => wsTaskIds.has(s.mainTaskId || (s as any).main_task_id));

  const [adminTab, setAdminTab] = useState<'tasks' | 'approvals'>('tasks');
  const [adminSortFilter, setAdminSortFilter] = useState<'urgent' | 'all'>('urgent');

  // Only the user's OWN approvals (approver or assignee)
  const approvalSubs = useMemo(() => {
    return teamSubs.filter(s => {
      const parentTask = activeWsTasks.find(mt => mt.id === ((s as any).main_task_id || s.mainTaskId)) ||
        wsTasks.find(mt => mt.id === ((s as any).main_task_id || s.mainTaskId));
      return isUserOwnApproval(
        s,
        parentTask,
        currentUser?.id || ''
      );
    }).sort((a, b) => urgencyScore(a) - urgencyScore(b));
  }, [teamSubs, activeWsTasks, wsTasks, currentUser]);

  const activeTeamSubs = useMemo(() => teamSubs.filter(s => s.status !== 'completed'), [teamSubs]);
  const completedTeamSubs = useMemo(() => teamSubs.filter(s => s.status === 'completed'), [teamSubs]);

  const completed = completedTeamSubs.length;
  const inProgress = teamSubs.filter(s => s.status === "in_progress").length;
  const notStarted = teamSubs.filter(s => s.status === "not_started").length;
  const completionRate = teamSubs.length > 0 ? Math.round(completed / teamSubs.length * 100) : 0;

  const displayedTasks = useMemo(() => {
    if (adminTab === 'approvals') {
      return approvalSubs;
    }
    if (adminSortFilter === 'urgent') {
      return [...activeTeamSubs].sort((a, b) => urgencyScore(a) - urgencyScore(b)).slice(0, 15);
    }
    return [...activeTeamSubs].sort((a, b) => urgencyScore(a) - urgencyScore(b));
  }, [adminTab, adminSortFilter, approvalSubs, activeTeamSubs]);

  const getMainTask = (id: string) => activeWsTasks.find(m => m.id === id);
  const getUser = (id: string | null) => users.find(u => u.id === id);

  const name = ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'Admin').split(' ')[0].split('@')[0];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-8">

      {/* â”€â”€ Hero Metric Row â”€â”€ */}
      <motion.div variants={item}>
        <MetricHeroCard
          title={isExternalHr ? "Authorized HR Tasks" : "Team Operations Overview"}
          heroValue={`${completionRate}%`}
          heroLabel="Team Completion Rate"
          period="Active Sprint"
          sparklineData={[
            Math.max(0, completionRate - 25),
            Math.max(0, completionRate - 18),
            Math.max(0, completionRate - 10),
            Math.max(0, completionRate - 4),
            completionRate
          ]}
          secondaryMetrics={[
            { label: isExternalHr ? 'HR Tasks' : 'Active Tasks', value: activeTeamSubs.length },
            { 
              label: 'Approvals Needed', 
              value: approvalSubs.length,
              tone: approvalSubs.length > 0 ? 'negative' : 'neutral'
            },
          ]}
        />
      </motion.div>

      {/* â”€â”€ Main content â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Tasks & Approvals */}
        <motion.div variants={item} className="lg:col-span-3 bg-card border border-border rounded-md overflow-hidden">
          {/* Card Header with Segmented Tabs (Tasks & Approvals) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border bg-card">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 dark:bg-muted/40 border border-border/50 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setAdminTab('tasks')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                  adminTab === 'tasks'
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{isExternalHr ? 'HR Tasks' : 'Active Tasks'}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold",
                  adminTab === 'tasks' ? "bg-muted text-foreground" : "bg-muted/70 text-muted-foreground"
                )}>
                  {activeTeamSubs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('approvals')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                  adminTab === 'approvals'
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <Hourglass className={cn("w-3.5 h-3.5", approvalSubs.length > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground")} />
                <span>Approvals Needed</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold transition-all",
                  approvalSubs.length > 0
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-muted/70 text-muted-foreground"
                )}>
                  {approvalSubs.length}
                </span>
              </button>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-3 justify-between sm:justify-end">
              {adminTab === 'tasks' && (
                <div className="relative flex items-center">
                  <select
                    value={adminSortFilter}
                    onChange={(e) => setAdminSortFilter(e.target.value as any)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground bg-transparent border border-border/60 rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-primary cursor-pointer appearance-none outline-none"
                  >
                    <option value="urgent" className="bg-card text-foreground">Urgent First</option>
                    <option value="all" className="bg-card text-foreground">All Active</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1.5 pointer-events-none" />
                </div>
              )}
              {adminTab === 'approvals' && (
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  {approvalSubs.length === 1 ? '1 approval awaiting your response' : `${approvalSubs.length} approvals awaiting your response`}
                </p>
              )}
              <button onClick={() => navigate("/tasks")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {displayedTasks.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {adminTab === 'approvals'
                  ? "All approvals clear!"
                  : "All tasks clear!"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {adminTab === 'approvals'
                  ? "You have no pending approvals requiring your action."
                  : "No pending tasks found for this filter."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {displayedTasks.map((sub, i) => {
                const mt = getMainTask(sub.mainTaskId!) || wsTasks.find(m => m.id === sub.mainTaskId);
                const isApproval = adminTab === 'approvals' || sub.status === 'pending_approval';
                const assignee = getUser(sub.assignedTo?.split(',')[0] ?? null);
                const sc = statusConfig[sub.status as keyof typeof statusConfig] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';

                return (
                  <div key={sub.id ?? i} onClick={() => setOpenSubtaskId(sub.id ?? null)}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/40 cursor-pointer transition-colors group">
                    <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums hidden sm:block flex-shrink-0">{i + 1}</span>
                    <div className={cn(
                      "w-1 h-10 rounded-full flex-shrink-0 hidden sm:block",
                      isApproval
                        ? "bg-amber-500"
                        : isOverdue
                        ? "bg-red-500"
                        : sub.status === 'in_progress'
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={cn(
                          "text-sm text-foreground truncate group-hover:text-primary transition-colors font-medium flex-1 min-w-0",
                          sub.status === 'completed' ? "line-through text-muted-foreground" : "text-foreground"
                        )}>{sub.title}</p>
                      </div>
                      <div className="flex items-center gap-x-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                        <span className="flex items-center gap-1 shrink-0"><Users className="w-3 h-3" />{assignee?.name ?? "Unassigned"}{sub.assignedTo?.includes(',') && ' +'}</span>
                        <span className="hidden sm:inline shrink-0">·</span>
                        <span className="truncate hidden sm:inline min-w-0">{mt?.title ?? ""}</span>
                        {sub.deadline && (
                          <>
                            <span className="hidden sm:inline shrink-0">·</span>
                            <span className={cn(
                              "flex items-center gap-0.5 shrink-0",
                              isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"
                            )}>
                              <Clock className="w-3 h-3" />
                              {safeFmt(sub.deadline)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                      {mt?.priority && <PriorityPill priority={mt.priority} />}
                      {isApproval ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Respond / Review
                        </span>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 whitespace-nowrap ${sc.pillClass}`}>
                          <StatusIcon className="w-3 h-3" />{sc.label}
                        </span>
                      )}
                      <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
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
          <div className="bg-card border border-border rounded-md p-5">
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   USER DASHBOARD
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function UserDashboard() {
  const { user: currentUser } = useAuth();
  const { subtasks, users } = useAppData();
  const { wsTasks, wsMembers } = useWorkspace();
  const navigate = useNavigate();
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [isActiveInvoicesModalOpen, setIsActiveInvoicesModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { hrVariables } = useStore();
  const { restoreSubtask, deleteSubtaskPermanently } = useAppData();

  const appUser = users.find(u => u.id === currentUser?.id);
  const storeUser = useUserStore(s => s.getCurrentUser());
  const effectiveUser = appUser || storeUser || currentUser;

  const firstName = (effectiveUser as any)?.name ? (effectiveUser as any).name.split(' ')[0] : ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'User').split(' ')[0].split('@')[0];

  useSetPageTitle(
    `${getGreeting()}, ${firstName}`,
    'Operational Command & Launchpad',
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate('/tasks/archive')} className="gap-2">
        <Archive className="w-4 h-4" /> Archive
      </Button>
      <Button variant="default" size="sm" onClick={() => navigate('/tasks')} className="gap-2">
        All Tasks <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );

  const isSuperAdmin = (effectiveUser as any)?.privileges?.users?.canManage === true;

  const canViewInvoices = isSuperAdmin ||
    (effectiveUser as any)?.privileges?.billing?.canView === true;

  const canViewRefillForecast = isSuperAdmin ||
    (effectiveUser as any)?.privileges?.operations?.canView === true ||
    (effectiveUser as any)?.privileges?.opsDiesel?.canView === true;

  const canViewMachineRecon = isSuperAdmin ||
    (effectiveUser as any)?.privileges?.opsMachineRecon?.canView === true ||
    (effectiveUser as any)?.privileges?.operations?.canView === true;

  const hasRightWidgets = canViewRefillForecast || canViewInvoices || canViewMachineRecon;

  const isExternalHr = appUser?.privileges?.tasks?.isExternalHr;
  const isHrDept = appUser?.department?.toLowerCase() === 'hr';
  const hasHrAccess = isExternalHr || isHrDept;

  const activeWsTasks = wsTasks.filter(mt => {
    const isAssigned = (mt.assignedTo || (mt as any).assigned_to || '').includes(currentUser?.id || '');
    const isCreator = mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id;
    
    // HR task visibility logic
    if (mt.is_hr_task) {
      return hasHrAccess || isCreator || isAssigned;
    }

    if (isExternalHr) {
      return isCreator || isAssigned;
    }

    const hasSubs = subtasks.some(s => s.mainTaskId === mt.id || s.main_task_id === mt.id);
    return hasSubs || mt.is_project || isCreator;
  });

  const [taskTab, setTaskTab] = useState<'tasks' | 'approvals'>('tasks');
  const [taskSortFilter, setTaskSortFilter] = useState<'urgent' | 'all'>('urgent');

  const wsTaskIds = new Set(activeWsTasks.map(mt => mt.id));

  // Subtasks assigned to the current user (or all HR subtasks for HR users)
  const mySubs = subtasks.filter(s => {
    const belongsToActive = wsTaskIds.has((s as any).main_task_id || s.mainTaskId);
    if (!belongsToActive || s.is_deleted) return false;
    
    // Get the parent task to check if it's an HR task
    const parentTask = activeWsTasks.find(mt => mt.id === ((s as any).main_task_id || s.mainTaskId));
    const isHr = parentTask?.is_hr_task;
    
    if (isHr) return hasHrAccess || s.assignedTo?.includes(currentUser?.id as string);
    if (isExternalHr) return true; // Consultants see all subtasks of their authorized tasks
    
    return s.assignedTo?.includes(currentUser?.id as string);
  });

  // All non-deleted subtasks in the active workspace
  const allWorkspaceSubs = subtasks.filter(s => {
    const belongsToActive = wsTaskIds.has((s as any).main_task_id || s.mainTaskId);
    return belongsToActive && !s.is_deleted;
  });

  // Only the user's OWN approvals:
  // - You are the designated approver for the subtask or main task (or creator reviewing it)
  // - OR you are an assignee in the approval subtask
  const approvalSubs = useMemo(() => {
    return allWorkspaceSubs.filter(s => {
      const parentTask = activeWsTasks.find(mt => mt.id === ((s as any).main_task_id || s.mainTaskId)) ||
        wsTasks.find(mt => mt.id === ((s as any).main_task_id || s.mainTaskId));
      return isUserOwnApproval(
        s,
        parentTask,
        currentUser?.id || ''
      );
    }).sort((a, b) => urgencyScore(a) - urgencyScore(b));
  }, [allWorkspaceSubs, activeWsTasks, wsTasks, currentUser]);

  const myActiveSubs = useMemo(() => mySubs.filter(s => s.status !== 'completed'), [mySubs]);
  const myCompletedSubs = useMemo(() => mySubs.filter(s => s.status === 'completed'), [mySubs]);

  const myDone = myCompletedSubs.length;
  const myProgress = mySubs.filter(s => s.status === 'in_progress').length;
  const myPending = mySubs.filter(s => s.status === 'not_started').length;
  const myRate = mySubs.length > 0 ? Math.round(myDone / mySubs.length * 100) : 0;
  const myPendingApproval = mySubs.filter(s => s.status === 'pending_approval').length;

  const displayedTasks = useMemo(() => {
    if (taskTab === 'approvals') {
      return approvalSubs;
    }
    // 'tasks' tab: active non-completed tasks
    if (taskSortFilter === 'urgent') {
      return [...myActiveSubs].sort((a, b) => urgencyScore(a) - urgencyScore(b)).slice(0, 15);
    }
    return [...myActiveSubs].sort((a, b) => urgencyScore(a) - urgencyScore(b));
  }, [taskTab, taskSortFilter, approvalSubs, myActiveSubs]);

  const getUser = (id: string | null) => users.find(u => u.id === id);

  const name = ((currentUser as any)?.user_metadata?.name || currentUser?.email || 'User').split(' ')[0].split('@')[0];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-8">

      {/* â”€â”€ Hero Metric Row â”€â”€ */}
      <motion.div variants={item}>
        <MetricHeroCard
          title={isExternalHr ? "Authorized HR Assignments" : "My Active Tasks"}
          heroValue={`${myRate}%`}
          heroLabel="Completion Rate"
          period="Current Assignments"
          sparklineData={[
            Math.max(0, myRate - 20),
            Math.max(0, myRate - 12),
            Math.max(0, myRate - 8),
            Math.max(0, myRate - 2),
            myRate
          ]}
          secondaryMetrics={[
            { label: isExternalHr ? 'HR Tasks' : 'Active Tasks', value: myActiveSubs.length },
            { 
              label: 'Approvals Needed', 
              value: approvalSubs.length,
              tone: approvalSubs.length > 0 ? 'negative' : 'neutral'
            },
          ]}
        />
      </motion.div>

      {/* â”€â”€ Main Content Grid â”€â”€ */}
      <div className={cn("grid gap-5", hasRightWidgets ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1")}>
        {/* â”€â”€ Left Column: Tasks + Machine Fleet (3 cols when widgets present, full width when hidden) â”€â”€ */}
        <motion.div variants={item} className={cn("space-y-4", hasRightWidgets ? "lg:col-span-3" : "col-span-1")}>
          {/* Tasks & Approvals Card */}
          <div className="bg-card border border-border rounded-md overflow-hidden">
          {/* Card Header with Segmented Tabs (Tasks & Approvals) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border bg-card">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 dark:bg-muted/40 border border-border/50 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setTaskTab('tasks')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                  taskTab === 'tasks'
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{isExternalHr ? 'HR Tasks' : 'My Tasks'}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold",
                  taskTab === 'tasks' ? "bg-muted text-foreground" : "bg-muted/70 text-muted-foreground"
                )}>
                  {myActiveSubs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTaskTab('approvals')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                  taskTab === 'approvals'
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <Hourglass className={cn("w-3.5 h-3.5", approvalSubs.length > 0 ? "text-amber-500 animate-pulse" : "text-muted-foreground")} />
                <span>Approvals Needed</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold transition-all",
                  approvalSubs.length > 0
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-muted/70 text-muted-foreground"
                )}>
                  {approvalSubs.length}
                </span>
              </button>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-3 justify-between sm:justify-end">
              {taskTab === 'tasks' && (
                <div className="relative flex items-center">
                  <select
                    value={taskSortFilter}
                    onChange={(e) => setTaskSortFilter(e.target.value as any)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground bg-transparent border border-border/60 rounded-md py-1 pl-2 pr-6 focus:ring-1 focus:ring-primary cursor-pointer appearance-none outline-none"
                  >
                    <option value="urgent" className="bg-card text-foreground">Urgent First</option>
                    <option value="all" className="bg-card text-foreground">All Active</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1.5 pointer-events-none" />
                </div>
              )}
              {taskTab === 'approvals' && (
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  {approvalSubs.length === 1 ? '1 approval awaiting your response' : `${approvalSubs.length} approvals awaiting your response`}
                </p>
              )}
              <button onClick={() => navigate('/tasks')} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {displayedTasks.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {taskTab === 'approvals'
                  ? "All approvals clear!"
                  : "You're all caught up!"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {taskTab === 'approvals'
                  ? "You have no pending approvals requiring your action."
                  : "No pending tasks found for this filter."}
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-border/40">
              {displayedTasks.map((sub, i) => {
                const mt = activeWsTasks.find(m => m.id === sub.mainTaskId || m.id === (sub as any).main_task_id) ||
                  wsTasks.find(m => m.id === sub.mainTaskId || m.id === (sub as any).main_task_id);
                const isApproval = taskTab === 'approvals' || sub.status === 'pending_approval';
                const sc = (statusConfig as Record<string, typeof statusConfig['completed']>)[sub.status] ?? statusConfig.not_started;
                const StatusIcon = sc.icon;
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';

                // Resolve assignee names for approvals context
                const assigneeNames = (typeof sub.assignedTo === 'string' ? sub.assignedTo.split(',') : Array.isArray(sub.assignedTo) ? sub.assignedTo : [])
                  .map(id => users.find(u => u.id === id.trim())?.name)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div
                    key={sub.id ?? i}
                    onClick={() => setOpenSubtaskId(sub.id ?? null)}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/40 transition-colors group cursor-pointer"
                  >
                    <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums hidden sm:block flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className={cn(
                      "w-1 h-10 rounded-full flex-shrink-0 hidden sm:block",
                      isApproval
                        ? "bg-amber-500"
                        : isOverdue
                        ? "bg-red-500"
                        : sub.status === 'in_progress'
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate group-hover:text-primary transition-colors",
                        sub.status === 'completed' ? "line-through text-muted-foreground" : "text-foreground"
                      )}>
                        {sub.title}
                      </p>
                      <div className="flex items-center gap-x-1.5 mt-0.5 text-[11px] text-muted-foreground min-w-0">
                        <span className="truncate min-w-0">{mt?.title ?? ''}</span>
                        {assigneeNames && isApproval && (
                          <>
                            <span className="shrink-0">·</span>
                            <span className="truncate min-w-0 text-slate-500 dark:text-slate-400">
                              For: {assigneeNames}
                            </span>
                          </>
                        )}
                        {sub.deadline && (
                          <>
                            <span className="shrink-0">·</span>
                            <span className={cn(
                              "flex items-center gap-0.5 shrink-0",
                              isOverdue ? "text-red-500 font-medium" : ""
                            )}>
                              <Clock className="w-3 h-3" />
                              {safeFmt(sub.deadline)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                      {mt?.priority && <PriorityPill priority={mt.priority} />}
                      {isApproval ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Respond / Review
                        </span>
                      ) : (
                        <span className={cn(
                          "text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0 whitespace-nowrap",
                          sc.pillClass
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      )}
                      <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>{/* end task card */}

          {/* Machine Fleet widget: same width as task card, contained below it */}
          {canViewMachineRecon && (
            <MachineReconCard />
          )}
        </motion.div>

        {/* â”€â”€ Right Column: Refill Forecast + Active Site Invoices (permission-checked) â”€â”€ */}
        {hasRightWidgets && (
          <motion.div variants={item} className="lg:col-span-2 space-y-4">
            {canViewRefillForecast && (
              <RefillForecastCard onOpenModal={() => setIsRefillModalOpen(true)} />
            )}
            {canViewInvoices && (
              <ActiveSiteInvoicesCard
                onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                onOpenModal={() => setIsActiveInvoicesModalOpen(true)}
              />
            )}
          </motion.div>
        )}
      </div>

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />
      {canViewRefillForecast && (
        <RefillForecastModal
          isOpen={isRefillModalOpen}
          onClose={() => setIsRefillModalOpen(false)}
        />
      )}
      {canViewInvoices && (
        <ActiveSiteInvoicesModal
          isOpen={isActiveInvoicesModalOpen}
          onClose={() => setIsActiveInvoicesModalOpen(false)}
          onSelectInvoice={(inv) => setSelectedInvoice(inv)}
          onSelectSite={(siteId) => navigate(`/site-analytics?siteId=${siteId}`)}
        />
      )}
      {canViewInvoices && selectedInvoice && (
        <InvoiceDetailDialog
          open={!!selectedInvoice}
          invoice={selectedInvoice}
          invoiceList={[selectedInvoice]}
          onClose={() => setSelectedInvoice(null)}
          onNavigate={() => {}}
          onEdit={() => navigate('/client-accounts')}
          onPrint={() => {}}
        />
      )}
    </motion.div>
  );
}

/* â”€â”€â”€ Refill Forecast Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function RefillForecastCard({ onOpenModal }: { onOpenModal: () => void }) {
  const { fleetRefillForecast, urgentRefillCount, tomorrowRefillCount } = useRefillForecast();

  const previewItems = fleetRefillForecast.slice(0, 4);

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Fuel className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">Refill Forecast</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {urgentRefillCount > 0
                ? `${urgentRefillCount} urgent refill${urgentRefillCount > 1 ? 's' : ''}`
                : tomorrowRefillCount > 0
                ? `${tomorrowRefillCount} due tomorrow`
                : 'Next pump fuel targets'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0 pl-2 cursor-pointer"
        >
          View more <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {previewItems.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-9 h-9 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-foreground">All tanks optimal</p>
          <p className="text-xs text-muted-foreground mt-0.5">No immediate fuel refills forecasted.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {previewItems.map(item => (
            <div
              key={`${item.siteId}-${item.machineId}`}
              onClick={onOpenModal}
              className="px-4 sm:px-5 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {item.siteName}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0",
                  item.urgencyBadgeClass
                )}>
                  {item.urgencyLabel}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="font-medium text-foreground/90">{item.shortName}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="truncate">Last: {item.lastRefillDate ? formatDisplayDate(item.lastRefillDate) : 'No log'}</span>
                </div>
                <div className="text-right shrink-0 text-[11px] font-medium text-foreground/80">
                  Next: {item.targetRefillFormatted}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {fleetRefillForecast.length > 4 && (
        <div className="p-2.5 bg-muted/20 border-t border-border/40 text-center">
          <button
            type="button"
            onClick={onOpenModal}
            className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            + {fleetRefillForecast.length - 4} more machines in forecast
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Site Pool Card Sub-Component ----------------------------------------- */
function SitePoolCard({
  siteItem,
  onSelectInvoice,
  showSiteName = false,
  onQuickFillMissingLogs,
  isLogging = false,
}: {
  siteItem: ActiveSiteInvoiceSummary;
  onSelectInvoice: (inv: Invoice) => void;
  showSiteName?: boolean;
  onQuickFillMissingLogs?: (siteItem: ActiveSiteInvoiceSummary) => void;
  isLogging?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-md border space-y-2.5 transition-colors p-3",
      showSiteName ? "bg-background/90" : "bg-muted/10",
      siteItem.isOverrun
        ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/15"
        : "border-border/60 hover:border-border"
    )}>
      {/* If showSiteName is true (e.g. inside a client group with multiple sites) */}
      {showSiteName && (
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              siteItem.isOverrun ? "bg-rose-500" : "bg-blue-500"
            )} />
            <span className="font-bold text-xs text-foreground truncate">
              {siteItem.siteName}
            </span>
          </div>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0",
            siteItem.urgencyBadgeClass
          )}>
            {siteItem.urgencyLabel}
          </span>
        </div>
      )}

      {/* Top Metric Row: Logged / Billed, Active Pumps, Capacity */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            "font-bold font-mono text-sm tabular-nums",
            siteItem.isOverrun ? "text-rose-600 dark:text-rose-400" : "text-foreground"
          )}>
            {siteItem.totalLoggedDays.toFixed(1)}d logged
          </span>
          {siteItem.totalUnloggedDays > 0 && (
            <span 
              className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700/60"
              title="Assumed active operational days"
            >
              +{siteItem.totalUnloggedDays.toFixed(1)}d unlogged
            </span>
          )}
          <span className="text-muted-foreground font-mono tabular-nums">
            / {siteItem.totalBilledDays}d billed
          </span>
          <span className="text-[11px] text-muted-foreground font-normal">
            ({siteItem.activeMachinesCount} active pump{siteItem.activeMachinesCount === 1 ? '' : 's'})
          </span>
        </div>

        <div className="text-right text-[11px] text-muted-foreground shrink-0 font-medium">
          {siteItem.isOverrun ? (
            <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
              {siteItem.activeMachinesCount > 1
                ? `+${siteItem.overrunDays.toFixed(1)}d over (${Math.max(1, Math.abs(siteItem.calendarRunwayDays))}d × ${siteItem.activeMachinesCount} pumps)`
                : `+${siteItem.overrunDays.toFixed(1)}d over (${Math.max(1, Math.abs(siteItem.calendarRunwayDays))}d overdue)`}
            </span>
          ) : siteItem.remainingDays === 0 ? (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              0.0d capacity left
            </span>
          ) : (
            <span>
              {siteItem.remainingDays.toFixed(1)}d capacity left
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200/70 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            siteItem.isOverrun ? "bg-rose-500" :
            siteItem.progressPct >= 80 ? "bg-amber-500" : "bg-blue-500"
          )}
          style={{ width: `${Math.min(100, siteItem.progressPct)}%` }}
        />
      </div>

      {/* Missing Logs Banner & 1-Click Action */}
      {siteItem.hasUnloggedDays && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/80 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold text-xs text-amber-900 dark:text-amber-100 shrink-0">
              {siteItem.unloggedDaysCount} unlogged day{siteItem.unloggedDaysCount === 1 ? '' : 's'}
            </span>
            <span className="text-amber-800 dark:text-amber-300 font-mono text-[10px] shrink-0">
              ({siteItem.missingLogDates.map(d => format(parseISO(d), 'MMM d')).join(', ')})
            </span>
            <span className="text-[10px] text-amber-700/90 dark:text-amber-400/90 font-medium shrink-0">
              · assumed active
            </span>
          </div>
          {onQuickFillMissingLogs && (
            <button
              type="button"
              onClick={() => onQuickFillMissingLogs(siteItem)}
              disabled={isLogging}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-[10px] shrink-0 transition-all shadow-xs cursor-pointer disabled:opacity-50 self-start sm:self-center whitespace-nowrap"
              title="Record full active operational logs for missing dates"
            >
              {isLogging ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              <span>{isLogging ? 'Logging...' : 'Log Missing Days'}</span>
            </button>
          )}
        </div>
      )}

      {/* Billed Invoices contributing to pool */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
          Invoices:
        </span>
        {siteItem.invoices.map((invDetail) => (
          <button
            key={invDetail.invoice.id}
            type="button"
            onClick={() => onSelectInvoice(invDetail.invoice)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border border-border/80 bg-background hover:border-primary/60 hover:text-primary transition-colors cursor-pointer"
            title="Click to view invoice details"
          >
            <FileText className="w-3 h-3 text-blue-500" />
            <span>#{invDetail.invoiceNumber}</span>
            <span className="text-muted-foreground/70 font-mono text-[10px]">({invDetail.totalContractedDays}d)</span>
          </button>
        ))}
        {siteItem.hasMultipleConcurrent && (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ml-auto">
            {siteItem.concurrentCount} Concurrent Invoices
          </span>
        )}
      </div>

      {/* Per-machine breakdown */}
      {siteItem.siteMachines && siteItem.siteMachines.length > 0 && (
        <div className="py-1.5 px-2.5 rounded bg-muted/40 dark:bg-slate-900/40 border border-border/40 space-y-1.5">
          {siteItem.siteMachines.map(m => {
            const displayConsumed = m.slotConsumedDays !== undefined ? m.slotConsumedDays : m.consumedDays;
            return (
              <div key={m.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className={cn(
                      "truncate font-medium max-w-[160px] sm:max-w-[250px]",
                      m.isStopped ? "text-muted-foreground/60" : "text-foreground"
                    )}>
                      {m.name}
                    </span>
                    {m.isStopped && (
                      <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-muted text-muted-foreground/70 shrink-0">
                        swapped
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 font-mono tabular-nums text-[11px] shrink-0">
                    <span className={cn(
                      "font-semibold",
                      (m.isOver || (siteItem.isOverrun && !m.isStopped)) ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"
                    )}>
                      {displayConsumed.toFixed(1)}
                    </span>
                    {(m.unloggedDays || 0) > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium" title={`${m.unloggedDays}d unlogged assumed active`}>
                        (+{m.unloggedDays}d)
                      </span>
                    )}
                    {m.contractedDays > 0 ? (
                      <>
                        <span className="text-muted-foreground/60 text-[10px]">/</span>
                        <span className="text-muted-foreground text-[11px] font-medium">
                          {m.contractedDays.toFixed(1)} days
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/60 text-[10px]">d logged</span>
                    )}
                    {m.isOver && !m.isStopped && (
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 ml-0.5">
                        +{m.overDays.toFixed(1)}d
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-line for predecessor swaps (Option 1) */}
                {m.predecessors && m.predecessors.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/75 pl-2 font-mono">
                    <span className="text-muted-foreground/40">↳</span>
                    <span>
                      {m.consumedDays.toFixed(1)}d current (+ {m.predecessors.map(p => `${p.consumedDays.toFixed(1)}d ex-${p.name.replace(/^dewatering\s+/i, '')}`).join(', ')})
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom row: Scheduled vs Live expiry */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
        <div className="flex items-center gap-1.5 truncate">
          <span>Start: {formatDisplayDate(siteItem.earliestStartDate || siteItem.invoices[0]?.startDate)}</span>
        </div>
        <div className="text-right shrink-0">
          <span className={cn(
            "font-medium",
            siteItem.isOverrun ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-foreground"
          )}>
            {siteItem.isOverrun
              ? `Overrun since: ${formatDisplayDate(siteItem.latestLiveEndDate || siteItem.latestScheduledEndDate)}`
              : `Live Target: ${formatDisplayDate(siteItem.latestLiveEndDate || siteItem.latestScheduledEndDate)}`
            }
          </span>
        </div>
      </div>
    </div>
  );
}

/* --- Active Site Invoices Card ------------------------------------------- */
function ActiveSiteInvoicesCard({
  onSelectInvoice,
  onOpenModal,
}: {
  onSelectInvoice: (inv: Invoice) => void;
  onOpenModal?: () => void;
}) {
  const navigate = useNavigate();
  const [groupBy, setGroupBy] = useState<'site' | 'client'>('site');
  const { activeSiteInvoices, totalActiveSites, concurrentSitesCount, lapsedSitesCount } = useActiveSiteInvoices();
  const { logDailyActivitiesBulk } = useOperations();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const [loggingSiteId, setLoggingSiteId] = useState<string | null>(null);

  const handleAutoFillMissingLogs = async (siteItem: ActiveSiteInvoiceSummary) => {
    if (!siteItem.missingLogDates || siteItem.missingLogDates.length === 0) return;
    const activePumps = (siteItem.siteMachines || []).filter(m => !m.isStopped);
    if (activePumps.length === 0) return;

    setLoggingSiteId(siteItem.siteId);
    try {
      const logsToSave: Parameters<typeof logDailyActivitiesBulk>[0] = [];
      for (const date of siteItem.missingLogDates) {
        for (const pump of activePumps) {
          logsToSave.push({
            assetId: pump.id,
            assetName: pump.name,
            siteId: siteItem.siteId,
            siteName: siteItem.siteName,
            date,
            isActive: true,
            operationalDay: 'full',
            downtimeEntries: [],
            dieselUsage: 0,
            loggedBy: currentUser?.name || 'Operator',
          });
        }
      }
      if (logsToSave.length > 0) {
        await logDailyActivitiesBulk(logsToSave);
      }
      toast.success(`Logged ${logsToSave.length} operational entries for ${siteItem.siteName} (${siteItem.missingLogDates.length} days recorded as active).`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to log missing days');
    } finally {
      setLoggingSiteId(null);
    }
  };

  // Group by client
  const clientGroups = useMemo(() => {
    const clientMap = new Map<string, { displayName: string; sites: ActiveSiteInvoiceSummary[] }>();
    activeSiteInvoices.forEach(s => {
      const raw = (s.clientName || 'Other Clients').trim() || 'Other Clients';
      const key = raw.toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, { displayName: raw, sites: [] });
      }
      clientMap.get(key)!.sites.push(s);
    });

    const groups = Array.from(clientMap.values()).map(({ displayName, sites }) => {
      const totalBilledDays = sites.reduce((sum, s) => sum + s.totalBilledDays, 0);
      const totalLoggedDays = Number(sites.reduce((sum, s) => sum + s.totalLoggedDays, 0).toFixed(1));
      const totalUnloggedDays = Number(sites.reduce((sum, s) => sum + (s.totalUnloggedDays || 0), 0).toFixed(1));
      const totalProjectedDays = Number(sites.reduce((sum, s) => sum + (s.totalProjectedDays || s.totalLoggedDays), 0).toFixed(1));
      const activeMachinesCount = sites.reduce((sum, s) => sum + s.activeMachinesCount, 0);
      const isOverrun = totalBilledDays > 0 && totalProjectedDays > totalBilledDays;
      const overrunDays = isOverrun ? Number((totalProjectedDays - totalBilledDays).toFixed(1)) : 0;
      const remainingDays = isOverrun ? 0 : Math.max(0, Number((totalBilledDays - totalProjectedDays).toFixed(1)));
      const minRunway = Math.min(...sites.map(s => s.calendarRunwayDays));
      const calendarRunwayDays = isFinite(minRunway) ? minRunway : Math.ceil(remainingDays / Math.max(1, activeMachinesCount));
      const progressPct = totalBilledDays > 0 ? Math.min(100, (totalProjectedDays / totalBilledDays) * 100) : 0;
      const hasAnyOverrun = sites.some(s => s.isOverrun || s.calendarRunwayDays < 0);
      const invoicesCount = sites.reduce((sum, s) => sum + s.invoices.length, 0);

      let urgencyBadgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      let urgencyLabel = `${calendarRunwayDays}d runway`;

      if (hasAnyOverrun || isOverrun || calendarRunwayDays < 0) {
        urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        const calDays = Math.max(1, Math.abs(calendarRunwayDays));
        urgencyLabel = `+${calDays}d Overdue`;
      } else if (calendarRunwayDays <= 0 || remainingDays === 0) {
        urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        urgencyLabel = 'Due Today';
      } else if (calendarRunwayDays === 1) {
        urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        urgencyLabel = 'Due Tomorrow';
      } else if (calendarRunwayDays <= 3) {
        urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        urgencyLabel = `Due in ${calendarRunwayDays}d`;
      }

      return {
        clientName: displayName,
        sites,
        totalSites: sites.length,
        totalBilledDays,
        totalLoggedDays,
        totalUnloggedDays,
        totalProjectedDays,
        remainingDays,
        overrunDays,
        isOverrun: hasAnyOverrun || isOverrun,
        activeMachinesCount,
        calendarRunwayDays,
        progressPct,
        invoicesCount,
        urgencyBadgeClass,
        urgencyLabel,
      };
    });

    return groups.sort((a, b) => {
      if (a.isOverrun && !b.isOverrun) return -1;
      if (!a.isOverrun && b.isOverrun) return 1;
      if (a.isOverrun && b.isOverrun) return b.overrunDays - a.overrunDays;
      return a.calendarRunwayDays - b.calendarRunwayDays;
    });
  }, [activeSiteInvoices]);

  const totalClientsCount = clientGroups.length;

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Receipt className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">Active Site Invoices</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {groupBy === 'site'
                ? `${totalActiveSites} Active Dewatering Site${totalActiveSites === 1 ? '' : 's'}`
                : `${totalClientsCount} Client${totalClientsCount === 1 ? '' : 's'} (${totalActiveSites} Sites)`
              }
              {lapsedSitesCount > 0 ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1">
                  · {lapsedSitesCount} with unbilled overrun
                </span>
              ) : concurrentSitesCount > 0 ? (
                ` · ${concurrentSitesCount} with concurrent invoices`
              ) : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle By Site / By Client */}
          <div className="flex items-center bg-muted/60 dark:bg-muted/30 p-0.5 rounded-md text-[11px] font-medium border border-border/50">
            <button
              type="button"
              onClick={() => setGroupBy('site')}
              className={cn(
                "px-2 py-0.5 rounded transition-all cursor-pointer",
                groupBy === 'site'
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              By Site
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('client')}
              className={cn(
                "px-2 py-0.5 rounded transition-all cursor-pointer",
                groupBy === 'client'
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              By Client
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenModal || (() => navigate('/client-accounts'))}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0 pl-1 cursor-pointer"
          >
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeSiteInvoices.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-9 h-9 rounded-md bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">No active dewatering sites</p>
          <p className="text-xs text-muted-foreground mt-0.5">All active sites are either on hold or closed.</p>
        </div>
      ) : groupBy === 'site' ? (
        <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
          {activeSiteInvoices.map(siteItem => (
            <div
              key={siteItem.siteId}
              className="px-4 sm:px-5 py-3.5 space-y-2.5"
            >
              {/* Site Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    siteItem.isOverrun ? "bg-rose-500 ring-2 ring-rose-500/20" :
                    siteItem.hasActiveInvoices ? "bg-blue-500" : "bg-muted-foreground/40"
                  )} />
                  <p className="text-sm font-bold text-foreground truncate">
                    {siteItem.siteName}
                  </p>
                  {siteItem.clientName && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                      ({siteItem.clientName})
                    </span>
                  )}
                </div>

                {siteItem.hasActiveInvoices && (
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                    siteItem.urgencyBadgeClass
                  )}>
                    {siteItem.urgencyLabel}
                  </span>
                )}
              </div>

              {/* If no running invoices */}
              {!siteItem.hasActiveInvoices ? (
                <p className="text-xs text-muted-foreground/80 pl-4.5">
                  All billing cycles settled · No active running invoice for this site.
                </p>
              ) : (
                <SitePoolCard
                  siteItem={siteItem}
                  onSelectInvoice={onSelectInvoice}
                  onQuickFillMissingLogs={handleAutoFillMissingLogs}
                  isLogging={loggingSiteId === siteItem.siteId}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        /* --- By Client View --- */
        <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
          {clientGroups.map(group => (
            <div
              key={group.clientName}
              className="px-4 sm:px-5 py-3.5 space-y-2.5"
            >
              {/* Client Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    group.isOverrun ? "bg-rose-500 ring-2 ring-rose-500/20" : "bg-blue-500"
                  )} />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-bold text-foreground truncate">
                      {group.clientName}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    ({group.totalSites} active site{group.totalSites === 1 ? '' : 's'})
                  </span>
                </div>

                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                  group.urgencyBadgeClass
                )}>
                  {group.urgencyLabel}
                </span>
              </div>

              {/* Combined Progress Banner if client has multiple sites */}
              {group.totalSites > 1 && (
                <div className="px-3 py-2 rounded-md bg-muted/40 dark:bg-muted/20 border border-border/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Client Total ({group.totalSites} Sites):
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {group.totalLoggedDays.toFixed(1)}d logged / {group.totalBilledDays}d billed
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/70 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        group.isOverrun ? "bg-rose-500" :
                        group.progressPct >= 80 ? "bg-amber-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(100, group.progressPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Sites list under this client */}
              <div className="space-y-2">
                {group.sites.map(siteItem => (
                  <SitePoolCard
                    key={siteItem.siteId}
                    siteItem={siteItem}
                    onSelectInvoice={onSelectInvoice}
                    showSiteName={group.totalSites > 1}
                    onQuickFillMissingLogs={handleAutoFillMissingLogs}
                    isLogging={loggingSiteId === siteItem.siteId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€ Team Productivity Score (shared between admin + user) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    if (s >= 80) return { ring: '#22c55e', label: 'Excellent', emoji: 'ðŸ”¥', ringCls: 'text-green-500' };
    if (s >= 60) return { ring: '#2563eb', label: 'Good', emoji: 'ðŸ’¡', ringCls: 'text-primary' };
    if (s >= 40) return { ring: '#f59e0b', label: 'Fair', emoji: 'ðŸ“ˆ', ringCls: 'text-amber-500' };
    return { ring: '#ef4444', label: 'Needs Work', emoji: 'ðŸ’ª', ringCls: 'text-red-500' };
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
    <div className="bg-card border border-border rounded-md p-5">
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

/* â”€â”€â”€ Stat Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function StatCard({ label, value, color, sub }: {
  label: string; value: number; icon?: any;
  color?: "blue" | "green" | "red" | "yellow" | "gray"; sub?: string;
}) {
  return (
    <div className="p-4 rounded-md border border-border bg-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-3xl font-bold font-mono tracking-tight text-foreground tabular-nums mt-2">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/80 mt-1">{sub}</p>}
    </div>
  );
}

/* â”€â”€â”€ Machine Recon Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function MachineReconCard() {
  const navigate = useNavigate();
  const recon = useMachineReconSummary();
  const [expanded, setExpanded] = useState(false);

  const hasAlerts = recon.stalledSites.length > 0 || recon.discrepancies.length > 0 || recon.serviceOverdue > 0;
  const alertCount = recon.stalledSites.length + recon.discrepancies.length + recon.serviceOverdue;

  const statusDotColor = (s: 'Full Day' | 'Half Day' | 'Off' | null) => {
    if (s === 'Full Day') return 'bg-emerald-500';
    if (s === 'Half Day') return 'bg-amber-400';
    if (s === 'Off') return 'bg-rose-500';
    return 'bg-muted-foreground/30';
  };

  const displayedSites = expanded ? recon.siteAllocations : recon.siteAllocations.slice(0, 4);
  const canExpand = recon.siteAllocations.length > 4;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-sky-500/10">
            <Wrench className="h-4 w-4 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Machine Fleet</p>
            <p className="text-[11px] text-muted-foreground">Reconciliation status</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAlerts && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-500 text-[11px] font-semibold px-2 py-0.5">
              <AlertCircle className="h-3 w-3" />
              {alertCount} alert{alertCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => navigate('/operations/machines')}
            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Fleet Pulse Chips */}
      <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
        {[
          { label: 'Deployed', value: recon.deployedOnSite, color: 'text-emerald-500', bg: 'bg-emerald-500/8' },
          { label: 'Idle', value: recon.idleInWarehouse, color: 'text-sky-400', bg: 'bg-sky-400/8' },
          { label: 'Maintenance', value: recon.underMaintenance, color: 'text-amber-400', bg: 'bg-amber-400/8' },
          { label: 'Overdue SVC', value: recon.serviceOverdue, color: recon.serviceOverdue > 0 ? 'text-rose-500' : 'text-muted-foreground', bg: recon.serviceOverdue > 0 ? 'bg-rose-500/8' : '' },
        ].map(chip => (
          <div key={chip.label} className={cn('flex flex-col items-center py-3 gap-0.5', chip.bg)}>
            <span className={cn('text-xl font-bold font-mono tabular-nums', chip.color)}>{chip.value}</span>
            <span className="text-[10px] text-muted-foreground text-center leading-tight">{chip.label}</span>
          </div>
        ))}
      </div>

      {/* Overdue machines alert */}
      {recon.serviceOverdue > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/6 border-b border-rose-500/20">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
          <p className="text-[11px] text-rose-500 truncate">
            <span className="font-semibold">{recon.overdueNames.slice(0, 2).join(', ')}</span>
            {recon.overdueNames.length > 2 && ` +${recon.overdueNames.length - 2} more`} overdue for service
          </p>
        </div>
      )}

      {/* Stalled site alert */}
      {recon.stalledSites.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/6 border-b border-amber-500/20">
          <Hourglass className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-400">
            <span className="font-semibold">{recon.stalledSites.length} site{recon.stalledSites.length > 1 ? 's' : ''}</span> with no logged pump hours in 3+ days:{' '}
            {recon.stalledSites.slice(0, 2).map(s => s.siteName).join(', ')}
            {recon.stalledSites.length > 2 && ` +${recon.stalledSites.length - 2} more`}
          </p>
        </div>
      )}

      {/* Site allocation rows */}
      <div className="divide-y divide-border/50">
        {recon.siteAllocations.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-5">No active dewatering sites</p>
        ) : (
          displayedSites.map(site => (
            <div
              key={site.siteId}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors',
                site.isStalled && 'bg-amber-500/4'
              )}
            >
              {/* Pump status dots */}
              <div className="flex items-center gap-0.5 shrink-0">
                {site.pumps.length > 0
                  ? site.pumps.slice(0, 6).map(p => (
                    <span
                      key={p.id}
                      title={`${p.name}: ${p.lastLogStatus ?? 'No log'}`}
                      className={cn('w-2 h-2 rounded-full', statusDotColor(p.lastLogStatus))}
                    />
                  ))
                  : <span className="w-2 h-2 rounded-full bg-muted-foreground/20" />}
                {site.pumps.length > 6 && (
                  <span className="text-[10px] text-muted-foreground ml-1">+{site.pumps.length - 6}</span>
                )}
              </div>

              {/* Site name */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-foreground truncate">{site.siteName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{site.clientName}</p>
              </div>

              {/* Right: pump count + delta badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[12px] font-mono font-semibold text-foreground tabular-nums">
                  {site.pumpsOnSite}
                  {site.pumpsExpected > 0 && <span className="text-muted-foreground font-normal text-[10px]">/{site.pumpsExpected}</span>}
                </span>
                {site.pumpsExpected > 0 && site.delta !== 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                    site.delta < 0
                      ? 'bg-rose-500/12 text-rose-500'
                      : 'bg-emerald-500/12 text-emerald-500'
                  )}>
                    {site.delta > 0 ? '+' : ''}{site.delta}
                  </span>
                )}
                {site.isStalled && (
                  <span title={`No logs for ${site.stalledDays} day(s)`}>
                    <Hourglass className="h-3 w-3 text-amber-400" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Expand / Collapse */}
      {canExpand && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-border hover:bg-muted/30 transition-colors"
        >
          {expanded ? (
            <><ChevronDown className="h-3 w-3 rotate-180" /> Show less</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Show {recon.siteAllocations.length - 4} more sites</>
          )}
        </button>
      )}

      {/* Pipeline footer */}
      {(recon.pendingSitesCount > 0 || recon.pipelineGap !== 0) && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2.5 border-t border-border',
          recon.pipelineGap > 0 ? 'bg-rose-500/5' : 'bg-muted/20'
        )}>
          <Package className={cn('h-3.5 w-3.5 shrink-0', recon.pipelineGap > 0 ? 'text-rose-400' : 'text-muted-foreground')} />
          <p className="text-[11px] text-muted-foreground flex-1">
            <span className="font-medium text-foreground">{recon.pendingSitesCount} pending site{recon.pendingSitesCount !== 1 ? 's' : ''}</span>
            {recon.pendingPumpsRequired > 0 && <> need <span className="font-medium text-foreground">{recon.pendingPumpsRequired}</span> pump{recon.pendingPumpsRequired !== 1 ? 's' : ''}</>}
          </p>
          {recon.pipelineGap > 0 ? (
            <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
              -{recon.pipelineGap} shortage
            </span>
          ) : recon.pipelineGap <= 0 && recon.pendingPumpsRequired > 0 ? (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              ✓ Covered
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
