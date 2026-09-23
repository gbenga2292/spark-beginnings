import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Flame, ArrowRight, X, Calendar, Hourglass, ExternalLink, AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { format, isPast, isToday, isTomorrow, differenceInDays, differenceInHours } from 'date-fns';
import type { SubTask, MainTask, TaskUrgency } from '@/src/types/tasks';

// ── Urgency rank ───────────────────────────────────────────────────────────────
const URGENCY_RANK: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };

// ── Visual config per urgency (matches target design) ─────────────────────────
export const URGENCY_CONFIG: Record<TaskUrgency, {
  label: string;
  badgeCls: string;
  dotCls: string;
  leftBarCls: string;
  cardBg: string;
  cardBorder: string;
  btnCls: string;
  isUrgent: boolean;
}> = {
  critical: {
    label: 'HIGH PRIORITY',
    badgeCls: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60',
    dotCls: 'bg-rose-500 animate-pulse',
    leftBarCls: 'bg-rose-500',
    cardBg: 'bg-rose-50/50 dark:bg-rose-950/10',
    cardBorder: 'border-rose-200 dark:border-rose-900/60',
    btnCls: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
    isUrgent: true,
  },
  high: {
    label: 'HIGH PRIORITY',
    badgeCls: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60',
    dotCls: 'bg-rose-500 animate-pulse',
    leftBarCls: 'bg-rose-500',
    cardBg: 'bg-rose-50/50 dark:bg-rose-950/10',
    cardBorder: 'border-rose-200 dark:border-rose-900/60',
    btnCls: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
    isUrgent: true,
  },
  medium: {
    label: 'MEDIUM',
    badgeCls: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
    dotCls: 'bg-amber-500',
    leftBarCls: 'bg-amber-400',
    cardBg: 'bg-white dark:bg-zinc-900/40',
    cardBorder: 'border-zinc-200 dark:border-zinc-800',
    btnCls: 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800',
    isUrgent: false,
  },
  low: {
    label: 'ROUTINE',
    badgeCls: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
    dotCls: 'bg-blue-500',
    leftBarCls: 'bg-blue-500',
    cardBg: 'bg-white dark:bg-zinc-900/40',
    cardBorder: 'border-zinc-200 dark:border-zinc-800',
    btnCls: 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800',
    isUrgent: false,
  },
};

// ── Progress bar ───────────────────────────────────────────────────────────────
function PriorityProgressBar({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = high + medium + low;
  if (total === 0) return null;
  const highPct  = (high   / total) * 100;
  const medPct   = (medium / total) * 100;
  const lowPct   = (low    / total) * 100;

  return (
    <div className="mt-3">
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-zinc-100 dark:bg-zinc-800">
        {high   > 0 && <div className="bg-rose-500 transition-all"  style={{ width: `${highPct}%` }} />}
        {medium > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${medPct}%` }} />}
        {low    > 0 && <div className="bg-blue-500 transition-all"  style={{ width: `${lowPct}%` }} />}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {high   > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500  shrink-0" />{high} Urgent / High</span>}
        {medium > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />{medium} Medium</span>}
        {low    > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500  shrink-0" />{low} Low / Routine</span>}
      </div>
    </div>
  );
}

// ── Task validity ──────────────────────────────────────────────────────────────
function isTaskActiveAndValid(sub: SubTask, parentMap: Map<string, MainTask>): boolean {
  if ((sub as any).isDeleted || (sub as any).is_deleted || (sub as any).deleted_at) return false;
  if ((sub.status as string) === 'archived' || (sub as any).is_archived) return false;
  if (sub.status === 'completed' || (sub.status as string) === 'done' || (sub as any).is_completed) return false;

  const parentId = sub.mainTaskId || (sub as any).main_task_id;
  if (parentId) {
    const parent = parentMap.get(parentId);
    if (parent) {
      if (parent.isDeleted || (parent as any).is_deleted || (parent as any).deleted_at) return false;
      const ps = (parent as any).status;
      if (ps === 'completed' || ps === 'done' || (parent as any).is_completed) return false;
      if (ps === 'archived' || (parent as any).is_archived) return false;
    }
  }

  if (sub.deadline) {
    const d = new Date(sub.deadline);
    if (!isNaN(d.getTime()) && isPast(d) && !isToday(d) && differenceInDays(new Date(), d) > 30) return false;
  } else if (sub.createdAt || (sub as any).created_at) {
    const c = new Date(sub.createdAt || (sub as any).created_at);
    if (!isNaN(c.getTime()) && differenceInDays(new Date(), c) > 60) return false;
  }
  return true;
}

// ── Main component ─────────────────────────────────────────────────────────────
export const DailyUrgentTasksModal = memo(function DailyUrgentTasksModal() {
  const { user }       = useAuth();
  const currentUser    = useUserStore(s => s.getCurrentUser());
  const { subtasks, mainTasks, users } = useAppData();
  const { isDark }     = useTheme();
  const navigate       = useNavigate();

  const [isOpen,        setIsOpen]        = useState(false);
  const [hasEvaluated,  setHasEvaluated]  = useState(false);

  // ── O(1) index maps ─────────────────────────────────────────────────────────
  const mainTasksById = useMemo(() => {
    const m = new Map<string, MainTask>();
    if (mainTasks) for (let i = 0; i < mainTasks.length; i++) m.set(mainTasks[i].id, mainTasks[i]);
    return m;
  }, [mainTasks]);

  const usersById = useMemo(() => {
    const m = new Map<string, string>();
    if (users) {
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const first = u.name ? u.name.split(' ')[0] : 'Team';
        m.set(u.id, first);
        if (u.email) m.set(u.email.toLowerCase(), first);
      }
    }
    return m;
  }, [users]);

  // ── Pending approvals ────────────────────────────────────────────────────────
  const pendingApprovals = useMemo(() => {
    if (!user?.id || !subtasks) return [];
    const uid = user.id;
    return subtasks.filter(sub => {
      if (sub.status !== 'pending_approval') return false;
      if ((sub as any).isDeleted || (sub as any).is_deleted || (sub as any).deleted_at) return false;
      if ((sub.status as string) === 'archived' || (sub as any).is_archived) return false;
      const pid = sub.mainTaskId || (sub as any).main_task_id;
      if (pid) {
        const p = mainTasksById.get(pid);
        if (p && (p.isDeleted || (p as any).is_deleted || (p as any).status === 'completed' || (p as any).status === 'archived')) return false;
      }
      const isApprover  = sub.approverId === uid;
      const isCreator   = sub.createdBy  === uid || (sub as any).created_by === uid;
      const isAdmin     = (user as any)?.role === 'admin' || (user as any)?.role === 'co-admin' || currentUser?.role === 'admin';
      return isApprover || (isAdmin && !sub.approverId) || isCreator;
    });
  }, [subtasks, mainTasksById, user, currentUser]);

  // ── Active urgent tasks ──────────────────────────────────────────────────────
  const myUrgentTasks = useMemo(() => {
    if (!user?.id || !subtasks) return [];
    const uid  = user.id.toLowerCase();
    const name = currentUser?.name?.toLowerCase();
    const mail = user?.email?.toLowerCase();

    const active = subtasks.filter(sub => {
      if (!isTaskActiveAndValid(sub, mainTasksById)) return false;
      const str      = (sub.assignedTo || (sub as any).assigned_to || '').trim();
      const assigned = str ? str.split(',').map((s: string) => s.trim().toLowerCase()) : [];
      const mine = assigned.includes(uid) || (name && assigned.includes(name)) || (mail && assigned.includes(mail));
      const isCBM   = sub.createdBy === user.id || (sub as any).created_by === user.id;
      const pid     = sub.mainTaskId || (sub as any).main_task_id;
      const parent  = pid ? mainTasksById.get(pid) : null;
      const isPCBM  = parent && (parent.createdBy === user.id || (parent as any).created_by === user.id);
      if (mine) return true;
      if ((isCBM || isPCBM) && assigned.length > 0) return true;
      return false;
    });

    return active.sort((a, b) => {
      const ar = a.urgency ? (URGENCY_RANK[a.urgency] ?? 5) : 5;
      const br = b.urgency ? (URGENCY_RANK[b.urgency] ?? 5) : 5;
      if (ar !== br) return ar - br;
      const ad = a.deadline ? new Date(a.deadline).getTime() : 9999999999999;
      const bd = b.deadline ? new Date(b.deadline).getTime() : 9999999999999;
      return ad - bd;
    });
  }, [subtasks, mainTasksById, user, currentUser]);

  // ── Analytics ────────────────────────────────────────────────────────────────
  const urgencyAnalytics = useMemo(() => {
    const g: Record<TaskUrgency, { count: number; earliest: Date | null }> = {
      critical: { count: 0, earliest: null },
      high:     { count: 0, earliest: null },
      medium:   { count: 0, earliest: null },
      low:      { count: 0, earliest: null },
    };
    for (const t of myUrgentTasks) {
      const u = (t.urgency || 'medium') as TaskUrgency;
      if (g[u]) {
        g[u].count++;
        if (t.deadline) {
          const d = new Date(t.deadline);
          if (!isNaN(d.getTime()) && (!g[u].earliest || d < g[u].earliest!)) g[u].earliest = d;
        }
      }
    }
    return g;
  }, [myUrgentTasks]);

  // ── Enriched tasks ───────────────────────────────────────────────────────────
  const enrichedUrgentTasks = useMemo(() => {
    const now  = new Date();
    const uid  = user?.id?.toLowerCase();
    const name = currentUser?.name?.toLowerCase();
    const mail = user?.email?.toLowerCase();

    return myUrgentTasks.map(sub => {
      const parent  = mainTasksById.get(sub.mainTaskId || (sub as any).main_task_id);
      const urgency = (sub.urgency || 'medium') as TaskUrgency;
      const urgConf = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.medium;

      let deadlineLabel = 'No strict deadline';
      let deadlineCls   = 'text-zinc-400 dark:text-zinc-500';
      let isOverdue     = false;

      if (sub.deadline) {
        const d = new Date(sub.deadline);
        if (isPast(d) && !isToday(d)) {
          const hrs = differenceInHours(now, d);
          deadlineLabel = hrs < 48 ? `Action Required · ${hrs}h overdue` : `Overdue (${format(d, 'MMM d')})`;
          deadlineCls   = 'text-rose-600 dark:text-rose-400 font-semibold';
          isOverdue     = true;
        } else if (isToday(d)) {
          deadlineLabel = `Due today at ${format(d, 'h:mm a')}`;
          deadlineCls   = 'text-amber-600 dark:text-amber-400 font-semibold';
        } else if (isTomorrow(d)) {
          deadlineLabel = `Due tomorrow, ${format(d, 'h:mm a')}`;
          deadlineCls   = 'text-amber-600 dark:text-amber-400';
        } else {
          deadlineLabel = `Due in ${differenceInDays(d, now)}d (${format(d, 'MMM d')})`;
          deadlineCls   = 'text-zinc-500 dark:text-zinc-400';
        }
      }

      const str      = (sub.assignedTo || (sub as any).assigned_to || '').trim();
      const list     = str ? str.split(',').map((s: string) => s.trim()) : [];
      const mine     = list.some(a => {
        const al = a.toLowerCase();
        return al === uid || (name && al === name) || (mail && al === mail);
      });
      const names = list.map(id => usersById.get(id) || id).join(', ');

      return { sub, parentTitle: parent?.title, urgConf, urgency, deadlineLabel, deadlineCls, isOverdue, isAssignedToMe: mine, assigneeNames: names };
    });
  }, [myUrgentTasks, mainTasksById, usersById, user, currentUser]);

  const enrichedApprovals = useMemo(() =>
    pendingApprovals.map(sub => ({
      sub,
      parentTitle: mainTasksById.get(sub.mainTaskId || (sub as any).main_task_id)?.title,
      creatorName: usersById.get(sub.createdBy || (sub as any).created_by) || 'Team',
    })),
  [pendingApprovals, mainTasksById, usersById]);

  // ── Session trigger ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || hasEvaluated) return;
    const t = setTimeout(() => {
      const key = `dcel_briefing_session_shown_${user.id}_${format(new Date(), 'yyyy-MM-dd')}`;
      if (!sessionStorage.getItem(key)) { setIsOpen(true); sessionStorage.setItem(key, 'true'); }
      setHasEvaluated(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [user?.id, hasEvaluated]);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('open-daily-briefing', open);
    return () => window.removeEventListener('open-daily-briefing', open);
  }, []);

  const markDismissed = () => {
    if (user?.id) sessionStorage.setItem(`dcel_briefing_session_shown_${user.id}_${format(new Date(), 'yyyy-MM-dd')}`, 'true');
  };
  const handleDismiss        = () => { markDismissed(); setIsOpen(false); };
  const handleNavigateToTask = (sub: SubTask) => {
    markDismissed(); setIsOpen(false);
    const mid = sub.mainTaskId || (sub as any).main_task_id;
    navigate(mid ? `/tasks?openTask=${mid}&open=${sub.id}` : `/tasks?open=${sub.id}`);
  };

  if (!isOpen) return null;

  const totalCount = pendingApprovals.length + myUrgentTasks.length;
  const highTotal  = urgencyAnalytics.critical.count + urgencyAnalytics.high.count;
  const medCount   = urgencyAnalytics.medium.count;
  const lowCount   = urgencyAnalytics.low.count;

  // Build coloured narrative parts
  const narrativeParts: Array<{ text: string; cls: string }> = [];
  if (highTotal > 0) narrativeParts.push({ text: `${highTotal} urgent`, cls: 'text-rose-600 dark:text-rose-400 font-semibold' });
  if (medCount  > 0) narrativeParts.push({ text: `${medCount} medium`,  cls: 'text-amber-600 dark:text-amber-400 font-semibold' });
  if (lowCount  > 0) narrativeParts.push({ text: `${lowCount} low`,     cls: 'text-blue-600 dark:text-blue-400 font-semibold' });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
          onClick={handleDismiss}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className={`relative w-full max-w-[560px] max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
            isDark ? 'bg-zinc-950 border border-zinc-800 text-zinc-100' : 'bg-white border border-zinc-200 text-zinc-900'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className={`px-6 pt-5 pb-4 border-b flex items-start justify-between shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-100 bg-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200/80 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[15px] font-bold tracking-tight">Daily Priority Briefing</h2>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    totalCount > 0
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  }`}>
                    {totalCount} {totalCount === 1 ? 'action' : 'actions'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {format(new Date(), 'EEEE, MMMM d')} · <span className="font-medium">Focus overview</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">

            {/* Summary banner */}
            {totalCount > 0 && (
              <div className={`px-4 py-3.5 rounded-xl border ${
                isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200/80'
              }`}>
                {narrativeParts.length > 0 ? (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {'You have '}
                    {narrativeParts.map((part, i) => (
                      <React.Fragment key={i}>
                        <span className={part.cls}>{part.text}</span>
                        {i < narrativeParts.length - 2 ? ', ' : i === narrativeParts.length - 2 ? ', and ' : ''}
                      </React.Fragment>
                    ))}
                    {' priority tasks requiring attention today.'}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">All active tasks and approvals are up to date.</p>
                )}
                <PriorityProgressBar high={highTotal} medium={medCount} low={lowCount} />
              </div>
            )}

            {/* Pending Approvals */}
            {enrichedApprovals.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Hourglass className="w-3.5 h-3.5 text-amber-500" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Approvals Awaiting Review ({enrichedApprovals.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-400">Sorted by Priority</span>
                </div>
                <div className="space-y-2">
                  {enrichedApprovals.map(({ sub, parentTitle, creatorName }) => (
                    <div
                      key={sub.id}
                      className={`relative rounded-xl border overflow-hidden flex items-center justify-between gap-3 p-3 transition-all ${
                        isDark ? 'bg-amber-950/10 border-amber-900/50 hover:border-amber-700/60' : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-xl" />
                      <div className="min-w-0 flex-1 pl-2">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                            Approval
                          </span>
                          {parentTitle && (
                            <span className="text-[11px] text-zinc-400 truncate max-w-[190px]">{parentTitle}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{sub.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                          <span>Requested by <strong>{creatorName}</strong></span>
                          {sub.budgetRequested && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              ₦{Number(sub.budgetRequested).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleNavigateToTask(sub)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm"
                      >
                        Review Now <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active tasks */}
            {enrichedUrgentTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Active Tasks by Urgency ({enrichedUrgentTasks.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-400">Sorted by Priority</span>
                </div>
                <div className="space-y-2">
                  {enrichedUrgentTasks.map(({ sub, parentTitle, urgConf, deadlineLabel, deadlineCls, isOverdue, isAssignedToMe, assigneeNames }) => (
                    <div
                      key={sub.id}
                      className={`relative rounded-xl border overflow-hidden flex items-center justify-between gap-3 p-3 transition-all hover:shadow-sm ${urgConf.cardBg} ${urgConf.cardBorder}`}
                    >
                      {/* Left accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${urgConf.leftBarCls} rounded-l-xl`} />

                      <div className="min-w-0 flex-1 pl-2">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${urgConf.badgeCls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${urgConf.dotCls} inline-block`} />
                            {urgConf.label}
                          </span>
                          {isAssignedToMe ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60">
                              Assigned to you
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60">
                              Delegated · {assigneeNames || 'team'}
                            </span>
                          )}
                          {parentTitle && (
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[160px]">{parentTitle}</span>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug">{sub.title}</p>

                        <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                          {isOverdue
                            ? <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                            : <Calendar    className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />}
                          <span className={deadlineCls}>{deadlineLabel}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleNavigateToTask(sub)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${urgConf.btnCls}`}
                      >
                        {urgConf.isUrgent ? 'Review Now' : 'View'} <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {totalCount === 0 && (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">You're all caught up!</p>
                <p className="text-xs text-zinc-400 mt-1">No pending approvals or priority tasks right now.</p>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-100 bg-zinc-50/60'
          }`}>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
              Shows on app open · Click <Flame className="w-3 h-3 text-amber-500 mx-0.5" /> anytime
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDismiss}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Close
              </button>
              <button
                onClick={() => { handleDismiss(); navigate('/tasks'); }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
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
