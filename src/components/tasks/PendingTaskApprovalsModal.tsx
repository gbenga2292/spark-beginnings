import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  X,
  Clock,
  Hourglass,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Banknote,
  Send,
  Calendar,
  User as UserIcon,
  MessageSquare,
  Sparkles,
  Loader2,
  FolderGit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import type { SubTask, MainTask } from '@/src/types/tasks';

// ── Common decline reasons for 1-click selection ──────────────────────────────
const QUICK_DECLINE_REASONS = [
  'Missing supporting documents / receipts',
  'Requested budget exceeds allocated limit',
  'Requires revisions before sign-off',
  'Duplicate or outdated request',
];

interface PendingApprovalItem {
  subtask: SubTask;
  parentTask: MainTask | null;
  requesterName: string;
  isDirectApprover: boolean;
}

export function PendingTaskApprovalsModal() {
  const { user } = useAuth();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const {
    subtasks,
    mainTasks,
    users,
    approveSubtask,
    rejectSubtask,
    updateSubtaskStatus,
    postComment,
  } = useAppData();

  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Active decline prompt state for a specific subtask
  const [decliningSubtaskId, setDecliningSubtaskId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [allCleared, setAllCleared] = useState(false);

  // Keep a map of main tasks for quick lookup
  const mainTasksById = useMemo(() => {
    const map = new Map<string, MainTask>();
    mainTasks.forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    return map;
  }, [mainTasks]);

  // Keep a map of user names
  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.id) map.set(u.id, u.name || u.email || 'Team Member');
    });
    return map;
  }, [users]);

  // ── Calculate all tasks pending current user's approval ───────────────────────
  const pendingApprovals = useMemo<PendingApprovalItem[]>(() => {
    if (!user?.id || !subtasks || subtasks.length === 0) return [];

    const currentUserId = user.id;
    const currentUserName = currentUser?.name?.toLowerCase().trim() || '';

    const isAdmin =
      currentUser?.role?.toLowerCase().includes('admin') ||
      (user as any)?.role?.toLowerCase().includes('admin') ||
      (user as any)?.role?.toLowerCase().includes('co-admin') ||
      currentUser?.role?.toLowerCase().includes('director') ||
      currentUser?.role?.toLowerCase().includes('manager') ||
      currentUser?.privileges?.tasks?.canEditTasks;

    const items: PendingApprovalItem[] = [];

    for (const sub of subtasks) {
      // Must be awaiting approval
      if (sub.status !== 'pending_approval') continue;
      if ((sub as any).isDeleted || (sub as any).is_deleted || (sub as any).deleted_at) continue;
      if (sub.status === 'archived' || (sub as any).is_archived) continue;

      const parentId = sub.mainTaskId || (sub as any).main_task_id;
      const parent = parentId ? mainTasksById.get(parentId) || null : null;

      if (parent) {
        if (parent.isDeleted || (parent as any).is_deleted) continue;
        if ((parent as any).status === 'completed' || (parent as any).status === 'archived') continue;
      }

      // Identify approver designation
      const subApproverId = sub.approverId || (sub as any).approver_id;
      const mainApproverId = parent?.approverId || (parent as any)?.approver_id;

      // 1. Direct subtask approver match
      const isSubApprover = subApproverId === currentUserId;

      // 2. Main task approver match (if subtask has no specific approver)
      const isMainApprover = !subApproverId && mainApproverId === currentUserId;

      // 3. Workflow tasks (e.g. leave approval step) where assignedTo is the designated approver
      let isWorkflowApprover = false;
      try {
        const meta = JSON.parse(sub.description || '{}');
        if (meta.refType && sub.assignedTo) {
          const assignees = sub.assignedTo.split(',').map((s) => s.trim().toLowerCase());
          if (assignees.includes(currentUserId.toLowerCase()) || (currentUserName && assignees.includes(currentUserName))) {
            isWorkflowApprover = true;
          }
        }
      } catch {
        // Not a JSON workflow description
      }

      // STRICT CHECK: ONLY the designated approver user sees this popup (nobody else)
      const isApproverUser = isSubApprover || isMainApprover || isWorkflowApprover;

      if (!isApproverUser) continue;

      // Ensure a user doesn't get prompted to approve their own request
      const creatorId = sub.createdBy || (sub as any).created_by;
      if (creatorId === currentUserId && !isSubApprover && !isMainApprover) {
        continue;
      }

      const requesterId = creatorId || parent?.createdBy || '';
      const requesterName = usersById.get(requesterId) || 'Team Member';

      items.push({
        subtask: sub,
        parentTask: parent,
        requesterName,
        isDirectApprover: true,
      });
    }

    return items;
  }, [user?.id, currentUser, subtasks, mainTasksById, usersById]);

  // ── Auto-Popup Trigger with Snooze Handling ──────────────────────────────────
  const hasPromptedThisSessionRef = useRef(false);

  useEffect(() => {
    if (!user?.id || pendingApprovals.length === 0) return;

    const snoozeKey = `dcel_task_approvals_snooze_${user.id}`;
    const snoozedIdsKey = `dcel_task_approvals_snoozed_ids_${user.id}`;

    const snoozeTimestampStr = localStorage.getItem(snoozeKey);
    const snoozedTimestamp = snoozeTimestampStr ? Number(snoozeTimestampStr) : 0;
    const isSnoozed = Date.now() < snoozedTimestamp;

    // Check if there are any *new* task IDs that were not part of the snooze
    let hasNewUnseenTasks = false;
    try {
      const snoozedIds: string[] = JSON.parse(localStorage.getItem(snoozedIdsKey) || '[]');
      hasNewUnseenTasks = pendingApprovals.some((item) => item.subtask.id && !snoozedIds.includes(item.subtask.id));
    } catch {
      hasNewUnseenTasks = true;
    }

    // Auto-open if not snoozed, OR if a brand new pending task arrived
    if (!isSnoozed || hasNewUnseenTasks) {
      if (!hasPromptedThisSessionRef.current) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          hasPromptedThisSessionRef.current = true;
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id, pendingApprovals]);

  // ── Real-time trigger: auto-open when a new task needing approval arrives ─────
  const prevPendingCountRef = useRef(pendingApprovals.length);
  useEffect(() => {
    if (pendingApprovals.length > prevPendingCountRef.current) {
      // New approval arrived while on screen!
      setIsOpen(true);
      setAllCleared(false);
    }
    prevPendingCountRef.current = pendingApprovals.length;
  }, [pendingApprovals.length]);

  // ── Event Listener for manual triggers (e.g. from header or buttons) ─────────
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setAllCleared(false);
    };
    window.addEventListener('open-pending-approvals', handleOpen);
    return () => window.removeEventListener('open-pending-approvals', handleOpen);
  }, []);

  // ── Snooze Handler (Remind me in 1 hour) ──────────────────────────────────────
  const handleSnooze = useCallback(() => {
    if (user?.id) {
      const snoozeKey = `dcel_task_approvals_snooze_${user.id}`;
      const snoozedIdsKey = `dcel_task_approvals_snoozed_ids_${user.id}`;
      const oneHourFromNow = Date.now() + 60 * 60 * 1000;

      localStorage.setItem(snoozeKey, oneHourFromNow.toString());
      localStorage.setItem(
        snoozedIdsKey,
        JSON.stringify(pendingApprovals.map((i) => i.subtask.id).filter(Boolean))
      );
    }
    setIsOpen(false);
    setDecliningSubtaskId(null);
    toast.info('Approval reminders snoozed for 1 hour.');
  }, [user?.id, pendingApprovals]);

  // ── Quick Approve Handler ────────────────────────────────────────────────────
  const handleQuickApprove = async (item: PendingApprovalItem) => {
    const subtaskId = item.subtask.id;
    if (!subtaskId || processingId) return;

    setProcessingId(subtaskId);
    try {
      const parentId = item.subtask.mainTaskId || (item.subtask as any).main_task_id || '';
      const actorId = currentUser?.id || user?.id || '';
      const actorName = currentUser?.name || 'Approver';

      // 1. If standard approval flag, bypass interceptor to mark completed
      if (item.subtask.requiresApproval || (item.subtask as any).requires_approval) {
        await updateSubtaskStatus(subtaskId, 'completed', actorId, true);
      } else {
        await approveSubtask(subtaskId, actorId);
      }

      // 2. Post an audit comment notifying the requester and team
      if (parentId) {
        await postComment(
          subtaskId,
          parentId,
          actorId,
          `✅ **Approved** by ${actorName} — Task sign-off granted and marked as completed.`
        );
      }

      toast.success(`Task "${item.subtask.title}" approved!`);

      // If this was the last item, show celebration screen
      if (pendingApprovals.length <= 1) {
        setAllCleared(true);
        setTimeout(() => {
          setIsOpen(false);
          setAllCleared(false);
        }, 2200);
      }
    } catch (err) {
      console.error('Approval failed:', err);
      toast.error('Failed to approve task. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Batch Approve All Handler ────────────────────────────────────────────────
  const handleApproveAll = async () => {
    if (pendingApprovals.length === 0 || processingId) return;

    setProcessingId('batch-all');
    try {
      const actorId = currentUser?.id || user?.id || '';
      const actorName = currentUser?.name || 'Approver';

      for (const item of pendingApprovals) {
        const subtaskId = item.subtask.id;
        if (!subtaskId) continue;
        const parentId = item.subtask.mainTaskId || (item.subtask as any).main_task_id || '';

        if (item.subtask.requiresApproval || (item.subtask as any).requires_approval) {
          await updateSubtaskStatus(subtaskId, 'completed', actorId, true);
        } else {
          await approveSubtask(subtaskId, actorId);
        }

        if (parentId) {
          await postComment(
            subtaskId,
            parentId,
            actorId,
            `✅ **Approved** by ${actorName} — Batch approval sign-off granted.`
          );
        }
      }

      toast.success(`All ${pendingApprovals.length} tasks approved!`);
      setAllCleared(true);
      setTimeout(() => {
        setIsOpen(false);
        setAllCleared(false);
      }, 2200);
    } catch (err) {
      console.error('Batch approve error:', err);
      toast.error('Failed to batch approve tasks.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Decline / Reject Handler ─────────────────────────────────────────────────
  const handleConfirmDecline = async (item: PendingApprovalItem) => {
    const subtaskId = item.subtask.id;
    if (!subtaskId || processingId) return;

    if (!declineReason.trim()) {
      toast.error('Please enter or select a reason for declining.');
      return;
    }

    setProcessingId(subtaskId);
    try {
      const parentId = item.subtask.mainTaskId || (item.subtask as any).main_task_id || '';
      const actorId = currentUser?.id || user?.id || '';
      const actorName = currentUser?.name || 'Approver';
      const cleanReason = declineReason.trim();

      // 1. Call context rejectSubtask to revert status to in_progress with rejectedAt timestamp
      await rejectSubtask(subtaskId, actorId, cleanReason);

      // 2. Post audit comment detailing the decline reason
      if (parentId) {
        await postComment(
          subtaskId,
          parentId,
          actorId,
          `❌ **Request Declined / Needs Revision** by ${actorName}\n**Reason:** ${cleanReason}`
        );
      }

      toast.info(`Task "${item.subtask.title}" declined. Creator notified to revise.`);
      setDecliningSubtaskId(null);
      setDeclineReason('');

      // If this was the last item, show completion
      if (pendingApprovals.length <= 1) {
        setAllCleared(true);
        setTimeout(() => {
          setIsOpen(false);
          setAllCleared(false);
        }, 2200);
      }
    } catch (err) {
      console.error('Decline failed:', err);
      toast.error('Failed to decline task. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Navigate to full task view ───────────────────────────────────────────────
  const handleNavigateToTask = (item: PendingApprovalItem) => {
    setIsOpen(false);
    const parentId = item.subtask.mainTaskId || (item.subtask as any).main_task_id;
    const subId = item.subtask.id;
    if (parentId && subId) {
      navigate(`/tasks?openTask=${parentId}&open=${subId}`);
    } else if (subId) {
      navigate(`/tasks?open=${subId}`);
    } else {
      navigate('/tasks?scope=pending_review');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99998] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={handleSnooze}
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-modal-title"
        >
          {/* Header */}
          <div
            className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="approval-modal-title" className="text-base font-bold text-foreground">
                    Action Required: Pending Approvals
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    {pendingApprovals.length} {pendingApprovals.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The following tasks have been submitted for your review and sign-off.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pendingApprovals.length > 1 && !allCleared && (
                <button
                  type="button"
                  onClick={handleApproveAll}
                  disabled={!!processingId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {processingId === 'batch-all' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Approve All ({pendingApprovals.length})</span>
                </button>
              )}

              <button
                onClick={handleSnooze}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Remind me later (1 hr)"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
            {allCleared ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 animate-in zoom-in-75 duration-300" />
                </div>
                <h3 className="text-lg font-bold text-foreground">All Approvals Cleared!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You have reviewed and acted on all outstanding task approval requests. Great job!
                </p>
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-foreground">No pending approvals at the moment</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You will be notified whenever someone requests your sign-off.
                </p>
              </div>
            ) : (
              pendingApprovals.map((item) => {
                const sub = item.subtask;
                const isDecliningThis = decliningSubtaskId === sub.id;
                const isProcessing = processingId === sub.id;

                // Format waiting duration
                const waitingTime = sub.pendingApprovalSince
                  ? formatDistanceToNow(new Date(sub.pendingApprovalSince), { addSuffix: true })
                  : sub.createdAt
                  ? formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })
                  : null;

                const isOverdue = sub.deadline && isPast(new Date(sub.deadline));

                return (
                  <div
                    key={sub.id}
                    className={`relative rounded-xl border transition-all overflow-hidden ${
                      isDark
                        ? 'bg-slate-900/60 border-slate-800 hover:border-amber-500/30'
                        : 'bg-white border-slate-200/90 hover:border-amber-400/60 shadow-xs'
                    }`}
                  >
                    {/* Left Accent Bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />

                    <div className="pl-4 pr-3.5 py-3.5 space-y-2.5">
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.parentTask && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[220px]">
                              <FolderGit2 className="w-3 h-3 text-slate-400 shrink-0" />
                              {item.parentTask.title}
                            </span>
                          )}

                          {sub.urgency && sub.urgency !== 'low' && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                sub.urgency === 'critical' || sub.urgency === 'high'
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                                  : 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                              }`}
                            >
                              {sub.urgency}
                            </span>
                          )}

                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Overdue
                            </span>
                          )}
                        </div>

                        {waitingTime && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" /> Submitted {waitingTime}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-snug">
                          {sub.title}
                        </h4>
                        {sub.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {(() => {
                              try {
                                const parsed = JSON.parse(sub.description);
                                if (parsed.reason) return parsed.reason;
                                if (parsed.note) return parsed.note;
                                if (parsed.refType) return `Workflow: ${parsed.refType.replace(/_/g, ' ')}`;
                              } catch {}
                              return sub.description;
                            })()}
                          </p>
                        )}
                      </div>

                      {/* Requester & Budget Info Pills */}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold uppercase">
                            {item.requesterName.charAt(0)}
                          </div>
                          <span>
                            Requested by <strong className="text-foreground font-semibold">{item.requesterName}</strong>
                          </span>
                        </div>

                        {(sub.hasBudget || sub.budgetRequested) && Number(sub.budgetRequested) > 0 && (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/40">
                            <Banknote className="w-3.5 h-3.5" />
                            <span>₦{Number(sub.budgetRequested).toLocaleString()}</span>
                          </div>
                        )}

                        {sub.deadline && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Due {format(new Date(sub.deadline), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons Row */}
                      {!isDecliningThis ? (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleNavigateToTask(item)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open in Task View</span>
                          </button>

                          <div className="flex items-center gap-2">
                            {/* Decline Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setDecliningSubtaskId(sub.id || null);
                                setDeclineReason('');
                              }}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>

                            {/* Quick Approve Button */}
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(item)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Expanded Decline Reason Tray */
                        <div className="pt-2 border-t border-rose-100 dark:border-rose-900/40 space-y-2.5 animate-in fade-in-50 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Decline Reason & Feedback:
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setDecliningSubtaskId(null);
                                setDeclineReason('');
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>

                          {/* Quick Chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_DECLINE_REASONS.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => setDeclineReason(reason)}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                  declineReason === reason
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {reason}
                              </button>
                            ))}
                          </div>

                          <textarea
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="State why this is declined or what changes are required before approval..."
                            rows={2}
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-rose-500 text-foreground"
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDecliningSubtaskId(null);
                                setDeclineReason('');
                              }}
                              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDecline(item)}
                              disabled={isProcessing || !declineReason.trim()}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>Confirm Decline</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            className={`px-5 py-3 border-t flex items-center justify-between gap-3 shrink-0 text-xs ${
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/80'
            }`}
          >
            <button
              type="button"
              onClick={handleSnooze}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-1 px-2 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Remind me later (1 hour)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/tasks?scope=pending_review');
              }}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <span>View full Task Inbox</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
