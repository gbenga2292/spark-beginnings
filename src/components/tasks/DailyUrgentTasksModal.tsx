import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Flame, ArrowRight, X, Calendar, Hourglass, ExternalLink, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import type { SubTask, MainTask, TaskUrgency } from '@/src/types/tasks';

// ── Urgency Rank & Minimalist Config ─────────────────────────────────────────
const URGENCY_RANK: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export const URGENCY_CONFIG: Record<TaskUrgency, { label: string; badgeCls: string; dotCls: string; borderCls: string }> = {
  critical: {
    label: 'Critical',
    badgeCls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40',
    dotCls: 'bg-rose-500 animate-pulse',
    borderCls: 'border-rose-400 dark:border-rose-700',
  },
  high: {
    label: 'High',
    badgeCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    dotCls: 'bg-amber-500',
    borderCls: 'border-amber-300 dark:border-amber-800',
  },
  medium: {
    label: 'Medium',
    badgeCls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-800',
    dotCls: 'bg-slate-400',
    borderCls: 'border-slate-300 dark:border-slate-800',
  },
  low: {
    label: 'Low',
    badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
    dotCls: 'bg-emerald-500',
    borderCls: 'border-emerald-300 dark:border-emerald-800',
  },
};

/**
 * Filter out tasks that are deleted, archived, completed, or obsolete/stale.
 */
function isTaskActiveAndValid(sub: SubTask, parentMap: Map<string, MainTask>): boolean {
  if ((sub as any).isDeleted || (sub as any).is_deleted || (sub as any).deleted_at) return false;
  if ((sub.status as string) === 'archived' || (sub as any).is_archived) return false;
  if (sub.status === 'completed' || (sub.status as string) === 'done' || (sub as any).is_completed) return false;

  const parentId = sub.mainTaskId || (sub as any).main_task_id;
  if (parentId) {
    const parent = parentMap.get(parentId);
    if (parent) {
      if (parent.isDeleted || (parent as any).is_deleted || (parent as any).deleted_at) return false;
      const pStatus = (parent as any).status;
      if (pStatus === 'completed' || pStatus === 'done' || (parent as any).is_completed) return false;
      if (pStatus === 'archived' || (parent as any).is_archived) return false;
    }
  }

  // Exclude stale abandoned tasks (overdue > 30 days or no deadline created > 60 days)
  if (sub.deadline) {
    const d = new Date(sub.deadline);
    if (!isNaN(d.getTime()) && isPast(d) && !isToday(d)) {
      if (differenceInDays(new Date(), d) > 30) return false;
    }
  } else if (sub.createdAt || (sub as any).created_at) {
    const c = new Date(sub.createdAt || (sub as any).created_at);
    if (!isNaN(c.getTime()) && differenceInDays(new Date(), c) > 60) return false;
  }

  return true;
}

export const DailyUrgentTasksModal = memo(function DailyUrgentTasksModal() {
  const { user } = useAuth();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const { subtasks, mainTasks, users } = useAppData();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  // ── High Performance O(1) Index Maps ───────────────────────────────────────
  const mainTasksById = useMemo(() => {
    const map = new Map<string, MainTask>();
    if (mainTasks) {
      for (let i = 0; i < mainTasks.length; i++) {
        map.set(mainTasks[i].id, mainTasks[i]);
      }
    }
    return map;
  }, [mainTasks]);

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    if (users) {
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const firstName = u.name ? u.name.split(' ')[0] : 'Team';
        map.set(u.id, firstName);
        if (u.email) map.set(u.email.toLowerCase(), firstName);
      }
    }
    return map;
  }, [users]);

  // ── 1. Pending Approvals (strictly active, non-deleted, awaiting approval) ───
  const pendingApprovals = useMemo(() => {
    if (!user?.id || !subtasks) return [];
    const userId = user.id;

    return subtasks.filter(sub => {
      if (sub.status !== 'pending_approval') return false;
      if ((sub as any).isDeleted || (sub as any).is_deleted || (sub as any).deleted_at) return false;
      if ((sub.status as string) === 'archived' || (sub as any).is_archived) return false;

      const parentId = sub.mainTaskId || (sub as any).main_task_id;
      if (parentId) {
        const parent = mainTasksById.get(parentId);
        if (parent && (parent.isDeleted || (parent as any).is_deleted || (parent as any).status === 'completed' || (parent as any).status === 'archived')) {
          return false;
        }
      }

      const isApprover = sub.approverId === userId;
      const isCreator = sub.createdBy === userId || (sub as any).created_by === userId;
      const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'co-admin' || currentUser?.role === 'admin';
      return isApprover || (isAdmin && !sub.approverId) || isCreator;
    });
  }, [subtasks, mainTasksById, user, currentUser]);

  // ── 2. Active Incomplete Tasks: strictly assigned to me OR created by me & assigned to others ─
  const myUrgentTasks = useMemo(() => {
    if (!user?.id || !subtasks) return [];
    const userId = user.id.toLowerCase();
    const currentName = currentUser?.name?.toLowerCase();
    const userEmail = user?.email?.toLowerCase();

    const active = subtasks.filter(sub => {
      if (!isTaskActiveAndValid(sub, mainTasksById)) return false;

      const assignedStr = (sub.assignedTo || (sub as any).assigned_to || '').trim();
      const assigned = assignedStr ? assignedStr.split(',').map((s: string) => s.trim().toLowerCase()) : [];

      const isAssignedToMe = assigned.includes(userId) || 
        (currentName && assigned.includes(currentName)) ||
        (userEmail && assigned.includes(userEmail));

      const isCreatedByMe = sub.createdBy === user.id || (sub as any).created_by === user.id;
      const parentId = sub.mainTaskId || (sub as any).main_task_id;
      const parent = parentId ? mainTasksById.get(parentId) : null;
      const isParentCreatedByMe = parent && (parent.createdBy === user.id || (parent as any).created_by === user.id);

      // Condition 1: Assigned to me
      if (isAssignedToMe) return true;

      // Condition 2: Created by me and assigned to people (so I can stay abreast)
      if ((isCreatedByMe || isParentCreatedByMe) && assigned.length > 0) return true;

      return false;
    });

    // Sort by Urgency (Critical > High > Medium > Low), then by deadline date
    return active.sort((a, b) => {
      const aUrgRank = a.urgency ? (URGENCY_RANK[a.urgency] ?? 5) : 5;
      const bUrgRank = b.urgency ? (URGENCY_RANK[b.urgency] ?? 5) : 5;
      if (aUrgRank !== bUrgRank) {
        return aUrgRank - bUrgRank;
      }
      const aDate = a.deadline ? new Date(a.deadline).getTime() : 9999999999999;
      const bDate = b.deadline ? new Date(b.deadline).getTime() : 9999999999999;
      return aDate - bDate;
    });
  }, [subtasks, mainTasksById, user, currentUser]);

  // ── 3. Urgency Analytics Breakdown ─────────────────────────────────────────
  const urgencyAnalytics = useMemo(() => {
    const groups: Record<TaskUrgency, { count: number; earliestDeadline: Date | null }> = {
      critical: { count: 0, earliestDeadline: null },
      high: { count: 0, earliestDeadline: null },
      medium: { count: 0, earliestDeadline: null },
      low: { count: 0, earliestDeadline: null },
    };

    let overdueCount = 0;

    for (let i = 0; i < myUrgentTasks.length; i++) {
      const task = myUrgentTasks[i];
      const urg = (task.urgency || 'medium') as TaskUrgency;
      if (groups[urg]) {
        groups[urg].count += 1;
        if (task.deadline) {
          const d = new Date(task.deadline);
          if (!isNaN(d.getTime())) {
            if (!groups[urg].earliestDeadline || d < groups[urg].earliestDeadline) {
              groups[urg].earliestDeadline = d;
            }
            if (isPast(d) && !isToday(d)) {
              overdueCount += 1;
            }
          }
        }
      }
    }

    return { groups, overdueCount };
  }, [myUrgentTasks]);

  const formatNearestDate = (d: Date | null) => {
    if (!d) return 'No due date';
    if (isToday(d)) return 'Due today';
    if (isTomorrow(d)) return 'Due tomorrow';
    if (isPast(d)) return `Overdue (${format(d, 'MMM d')})`;
    return `Due ${format(d, 'MMM d')}`;
  };

  // Build natural summary phrase
  const summaryNarrative = useMemo(() => {
    const parts: string[] = [];
    if (pendingApprovals.length > 0) {
      parts.push(`${pendingApprovals.length} pending ${pendingApprovals.length === 1 ? 'approval' : 'approvals'}`);
    }
    if (urgencyAnalytics.groups.critical.count > 0) {
      const d = urgencyAnalytics.groups.critical.earliestDeadline;
      const count = urgencyAnalytics.groups.critical.count;
      parts.push(`${count} critical ${count === 1 ? 'task' : 'tasks'}${d ? ` (${formatNearestDate(d)})` : ''}`);
    }
    if (urgencyAnalytics.groups.high.count > 0) {
      const d = urgencyAnalytics.groups.high.earliestDeadline;
      const count = urgencyAnalytics.groups.high.count;
      parts.push(`${count} high priority ${count === 1 ? 'task' : 'tasks'}${d ? ` (${formatNearestDate(d)})` : ''}`);
    }
    if (urgencyAnalytics.groups.medium.count > 0) {
      const count = urgencyAnalytics.groups.medium.count;
      parts.push(`${count} medium task${count === 1 ? '' : 's'}`);
    }

    if (parts.length === 0) return 'All active tasks and approvals are up to date.';
    if (parts.length === 1) return `You have ${parts[0]} requiring attention today.`;
    if (parts.length === 2) return `You have ${parts[0]} and ${parts[1]} requiring attention today.`;
    return `You have ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]} requiring attention today.`;
  }, [pendingApprovals.length, urgencyAnalytics]);

  // ── 4. Pre-Enriched Task Rows (Zero computation during render) ─────────────
  const enrichedUrgentTasks = useMemo(() => {
    const now = new Date();
    const userId = user?.id?.toLowerCase();
    const currentName = currentUser?.name?.toLowerCase();
    const userEmail = user?.email?.toLowerCase();

    return myUrgentTasks.map(sub => {
      const parentTask = mainTasksById.get(sub.mainTaskId || (sub as any).main_task_id);
      const urgency = sub.urgency || 'medium';
      const urgConf = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.medium;

      let deadlineLabel = 'No deadline';
      let deadlineCls = 'text-muted-foreground';
      if (sub.deadline) {
        const d = new Date(sub.deadline);
        if (isPast(d) && !isToday(d)) {
          deadlineLabel = `Overdue (${format(d, 'MMM d')})`;
          deadlineCls = 'text-rose-600 font-semibold';
        } else if (isToday(d)) {
          deadlineLabel = 'Due today';
          deadlineCls = 'text-amber-600 font-semibold';
        } else if (isTomorrow(d)) {
          deadlineLabel = 'Due tomorrow';
          deadlineCls = 'text-amber-600';
        } else {
          const days = differenceInDays(d, now);
          deadlineLabel = `Due in ${days}d (${format(d, 'MMM d')})`;
          deadlineCls = 'text-muted-foreground';
        }
      }

      const assignedStr = (sub.assignedTo || (sub as any).assigned_to || '').trim();
      const assignedList = assignedStr ? assignedStr.split(',').map(s => s.trim()) : [];
      const isAssignedToMe = assignedList.some(a => {
        const al = a.toLowerCase();
        return al === userId || (currentName && al === currentName) || (userEmail && al === userEmail);
      });
      const assigneeNames = assignedList.map(aId => usersById.get(aId) || aId).join(', ');

      return {
        sub,
        parentTitle: parentTask?.title,
        urgConf,
        deadlineLabel,
        deadlineCls,
        isAssignedToMe,
        assigneeNames,
      };
    });
  }, [myUrgentTasks, mainTasksById, usersById, user, currentUser]);

  const enrichedApprovals = useMemo(() => {
    return pendingApprovals.map(sub => {
      const parentTask = mainTasksById.get(sub.mainTaskId || (sub as any).main_task_id);
      const creatorName = usersById.get(sub.createdBy || (sub as any).created_by) || 'Team';
      return {
        sub,
        parentTitle: parentTask?.title,
        creatorName,
      };
    });
  }, [pendingApprovals, mainTasksById, usersById]);

  // ── 5. Trigger Briefing Modal on Startup (session-based) ────────────────────
  useEffect(() => {
    if (!user?.id || hasEvaluated) return;

    // Wait 1s for hydration
    const timer = setTimeout(() => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const sessionKey = `dcel_briefing_session_shown_${user.id}_${todayStr}`;
      const shownThisSession = sessionStorage.getItem(sessionKey);

      if (!shownThisSession) {
        setIsOpen(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
      setHasEvaluated(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [user?.id, hasEvaluated]);

  // ── 6. Listen for custom event to manually open ──────────────────────────────
  useEffect(() => {
    const handleManualOpen = () => setIsOpen(true);
    window.addEventListener('open-daily-briefing', handleManualOpen);
    return () => window.removeEventListener('open-daily-briefing', handleManualOpen);
  }, []);

  const markDismissed = () => {
    if (user?.id) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      sessionStorage.setItem(`dcel_briefing_session_shown_${user.id}_${todayStr}`, 'true');
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setIsOpen(false);
  };

  const handleNavigateToTask = (sub: SubTask) => {
    markDismissed();
    setIsOpen(false);
    const mainId = sub.mainTaskId || (sub as any).main_task_id;
    if (mainId) {
      navigate(`/tasks?openTask=${mainId}&open=${sub.id}`);
    } else {
      navigate(`/tasks?open=${sub.id}`);
    }
  };

  if (!isOpen) return null;

  const totalCount = pendingApprovals.length + myUrgentTasks.length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Minimalist Frosted Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
          onClick={handleDismiss}
        />

        {/* Elegant Minimalist Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className={`relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
            isDark 
              ? 'bg-zinc-950 border-zinc-800 text-zinc-100 shadow-black/70' 
              : 'bg-white border-zinc-200/90 text-zinc-900 shadow-slate-300/40'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-6 py-5 border-b flex items-start justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/70'
          }`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight">Daily Priority Briefing</h2>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    totalCount > 0 
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}>
                    {totalCount} {totalCount === 1 ? 'action' : 'actions'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(), 'EEEE, MMMM d')} · Focus overview
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
              }`}
              title="Close briefing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Minimalist Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin">

            {/* Quick Natural Language Summary Banner */}
            {totalCount > 0 && (
              <div className={`px-4 py-3 rounded-xl border flex items-start gap-3 ${
                isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-zinc-50/80 border-zinc-200/60'
              }`}>
                <div className="w-1 self-stretch rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {summaryNarrative}
                  </p>

                  {/* Elegant Horizontal Counters */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 text-[11px]">
                    {urgencyAnalytics.groups.critical.count > 0 && (
                      <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {urgencyAnalytics.groups.critical.count} Critical
                      </span>
                    )}
                    {urgencyAnalytics.groups.high.count > 0 && (
                      <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {urgencyAnalytics.groups.high.count} High
                      </span>
                    )}
                    {pendingApprovals.length > 0 && (
                      <span className="flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                        <Hourglass className="w-3 h-3" />
                        {pendingApprovals.length} Approval{pendingApprovals.length === 1 ? '' : 's'}
                      </span>
                    )}
                    {urgencyAnalytics.groups.medium.count > 0 && (
                      <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        {urgencyAnalytics.groups.medium.count} Medium
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 1: Pending Approvals */}
            {enrichedApprovals.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Approvals Awaiting Review ({enrichedApprovals.length})
                  </h3>
                </div>

                <div className="space-y-2">
                  {enrichedApprovals.map(({ sub, parentTitle, creatorName }) => (
                    <div
                      key={sub.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isDark 
                          ? 'bg-zinc-900/40 border-zinc-800 hover:border-amber-500/40' 
                          : 'bg-white border-zinc-200/80 hover:border-amber-400/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Approval
                          </span>
                          {parentTitle && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {parentTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate text-zinc-800 dark:text-zinc-100">
                          {sub.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span>Requested by {creatorName}</span>
                          {sub.budgetRequested && (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              ₦{Number(sub.budgetRequested).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleNavigateToTask(sub)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-white flex items-center gap-1 shadow-xs shrink-0 transition-all cursor-pointer"
                      >
                        Review <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Active Tasks in Order of Urgency */}
            {enrichedUrgentTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Tasks by Urgency ({enrichedUrgentTasks.length})
                  </h3>
                </div>

                <div className="space-y-2">
                  {enrichedUrgentTasks.map(({ sub, parentTitle, urgConf, deadlineLabel, deadlineCls, isAssignedToMe, assigneeNames }) => (
                    <div
                      key={sub.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isDark 
                          ? 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700' 
                          : 'bg-white border-zinc-200/70 hover:border-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {/* Minimalist urgency indicator */}
                          <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${urgConf.badgeCls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${urgConf.dotCls}`} />
                            {urgConf.label}
                          </span>
                          {isAssignedToMe ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Assigned to you
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Delegated to {assigneeNames || 'team'}
                            </span>
                          )}
                          {parentTitle && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                              {parentTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate text-zinc-900 dark:text-zinc-100">
                          {sub.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          <span className={`flex items-center gap-1 ${deadlineCls}`}>
                            <Calendar className="w-3 h-3" /> {deadlineLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleNavigateToTask(sub)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                          isDark 
                            ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' 
                            : 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totalCount === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">You are all caught up!</p>
                <p className="text-xs mt-0.5">No pending approvals or high-priority tasks assigned to you right now.</p>
              </div>
            )}

          </div>

          {/* Minimalist Footer */}
          <div className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-zinc-100 bg-zinc-50/50'
          }`}>
            <p className="text-[11px] text-muted-foreground">
              Shows on app open · Click <Flame className="w-3 h-3 inline text-amber-500" /> anytime
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDismiss}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  isDark 
                    ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800' 
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleDismiss();
                  navigate('/tasks');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                Task Register <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
});
