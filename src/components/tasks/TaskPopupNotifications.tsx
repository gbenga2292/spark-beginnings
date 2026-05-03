/**
 * TaskPopupNotifications
 *
 * Invasive floating notification cards (similar to WhatsApp mobile push
 * notifications) that appear in the bottom-right corner of the screen
 * when:
 *  - The current user is mentioned in a task comment
 *  - The current user is assigned to a task / subtask
 *  - A task the current user is assigned to has a new comment / update
 *  - Any task-change reminder is created that targets the current user
 *
 * Each popup auto-dismisses after 7 seconds and can be:
 *  - Clicked → navigated to the relevant task
 *  - Dismissed with the ✕ button
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AtSign, Bell, CheckCircle2, MessageSquare, User, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore } from '@/src/store/userStore';
import { supabase } from '@/src/integrations/supabase/client';
import { useTheme } from '@/src/hooks/useTheme';
import { addHours, addDays, addMonths, isBefore } from 'date-fns';
import type { Reminder, ReminderFrequency } from '@/src/types/tasks';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface TaskPopup {
  id: string;
  type: 'mention' | 'assignment' | 'update' | 'new_task';
  title: string;
  body: string;
  taskUrl?: string;
  subtaskUrl?: string;
  timestamp: number;
  reminderId?: string;
}

const POPUP_TTL_MS = 15000; // auto-dismiss after 15 s
const MAX_POPUPS   = 4;    // max stacked popups

/* ─── Icons per type ─────────────────────────────────────────────────────── */
function TypeIcon({ type }: { type: TaskPopup['type'] }) {
  switch (type) {
    case 'mention':    return <AtSign    className="w-4 h-4" />;
    case 'assignment': return <User      className="w-4 h-4" />;
    case 'update':     return <MessageSquare className="w-4 h-4" />;
    case 'new_task':   return <Zap       className="w-4 h-4" />;
    default:           return <Bell      className="w-4 h-4" />;
  }
}

/* ─── Colour ring per type ───────────────────────────────────────────────── */
function ringClass(type: TaskPopup['type']) {
  switch (type) {
    case 'mention':    return 'bg-indigo-600';
    case 'assignment': return 'bg-emerald-600';
    case 'update':     return 'bg-sky-600';
    case 'new_task':   return 'bg-amber-500';
    default:           return 'bg-slate-500';
  }
}

/* ─── Single popup card ──────────────────────────────────────────────────── */
function PopupCard({
  popup,
  onDismiss,
  onNavigate,
  onMarkAsDone,
  isDark,
}: {
  popup: TaskPopup;
  onDismiss: (id: string) => void;
  onNavigate: (popup: TaskPopup) => void;
  onMarkAsDone?: (popup: TaskPopup) => void;
  isDark: boolean;
}) {
  const url = popup.taskUrl;  // Always open the main task detail page

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(popup.id);
    }, POPUP_TTL_MS);
    return () => clearTimeout(timer);
  }, [popup.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,  scale: 1   }}
      exit  ={{ opacity: 0, x: 80, scale: 0.88, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className={`relative w-80 rounded-xl shadow-2xl border overflow-hidden ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      {/* Top accent colour bar */}
      <div className={`h-1 w-full ${ringClass(popup.type)}`} />

      <div className="p-3.5 flex items-start gap-3">
        {/* Icon */}
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white ${ringClass(popup.type)}`}>
          <TypeIcon type={popup.type} />
        </div>

        {/* Body */}
        <div
          className={`flex-1 min-w-0 ${url ? 'cursor-pointer' : ''}`}
          onClick={() => url && onNavigate(popup)}
        >
          <p className="text-[12px] font-bold leading-tight">{popup.title}</p>
          <p className={`text-[11px] mt-0.5 leading-snug line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {popup.body}
          </p>
          {url && (
            <span className={`text-[10px] font-semibold mt-1 inline-block ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              Tap to open →
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(popup.id); }}
            className={`p-1 rounded-lg transition-colors flex items-center justify-center ${
              isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
          
          {popup.reminderId && onMarkAsDone && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkAsDone(popup); }}
              title="Mark as Done"
              className={`p-1 rounded-lg transition-colors flex items-center justify-center mt-1 ${
                isDark ? 'text-emerald-500 hover:bg-emerald-900/30' : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function TaskPopupNotifications() {
  const { user } = useAuth();
  const { subtasks, mainTasks, comments, reminders, updateReminder } = useAppData();
  const currentUser = useUserStore(s => s.getCurrentUser());
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [popups, setPopups] = useState<TaskPopup[]>([]);
  // Track reminder IDs we've already shown to prevent duplicates on re-render
  const shownIds = useRef<Set<string>>(new Set());
  // Track comment IDs processed by real-time so we don't re-process on initial load
  const processedCommentIds = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const pushPopup = useCallback((p: Omit<TaskPopup, 'id' | 'timestamp'> & { dedupeKey?: string }) => {
    const dedupeKey = p.dedupeKey || `${p.type}-${p.title}-${p.body}`;
    if (shownIds.current.has(dedupeKey)) return;
    shownIds.current.add(dedupeKey);

    const popup: TaskPopup = {
      id: `popup-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      ...p,
    };
    setPopups(prev => [popup, ...prev].slice(0, MAX_POPUPS));
  }, []);

  const dismiss = useCallback((id: string) => {
    setPopups(prev => prev.filter(x => x.id !== id));
  }, []);

  const handleNavigate = useCallback((popup: TaskPopup) => {
    // Always navigate to the main task detail page, not the subtask slip
    const url = popup.taskUrl;
    if (url) navigate(url);
    dismiss(popup.id);
  }, [navigate, dismiss]);

  const handleMarkAsDone = useCallback((popup: TaskPopup) => {
    if (!popup.reminderId) return;
    const rem = reminders.find(r => r.id === popup.reminderId);
    if (!rem) {
      dismiss(popup.id);
      return;
    }

    if (!rem.frequency || rem.frequency === 'once') {
      updateReminder(rem.id, { isActive: false });
    } else {
      const current = new Date(rem.remindAt);
      let nextDate = current;
      switch (rem.frequency) {
        case 'hourly': nextDate = addHours(current, 1); break;
        case 'every_6_hours': nextDate = addHours(current, 6); break;
        case 'daily': nextDate = addDays(current, 1); break;
        case 'weekly': nextDate = addDays(current, 7); break;
        case 'monthly': nextDate = addMonths(current, 1); break;
      }
      
      if (rem.endAt && isBefore(new Date(rem.endAt), nextDate)) {
        updateReminder(rem.id, { isActive: false });
      } else {
        updateReminder(rem.id, { remindAt: nextDate.toISOString() });
      }
    }
    
    dismiss(popup.id);
  }, [reminders, updateReminder, dismiss]);

  /* ── Mark all existing comments as already 'seen' on mount ───────────── */
  useEffect(() => {
    if (!initialised.current && comments.length > 0) {
      comments.forEach(c => processedCommentIds.current.add(c.id));
      initialised.current = true;
    }
  }, [comments]);

  /* ── Timer-based: fire reminder popups only when remind_at time arrives ─ */
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const checkReminders = () => {
      const now = Date.now();
      const WINDOW_MS = 2 * 60 * 1000; // 2-minute window around remind_at

      reminders.forEach(rem => {
        if (!rem.isActive) return;
        // Skip mention-type reminders (handled by task_updates listener)
        if (rem.title?.startsWith('Mentioned')) return;

        const isGlobal    = !rem.recipientIds || rem.recipientIds.length === 0;
        const isRecipient = isGlobal || rem.recipientIds?.includes(userId);
        const isSelf      = rem.createdBy === userId;
        if (!isRecipient || isSelf) return;

        const remindAt = new Date(rem.remindAt).getTime();
        const diff = now - remindAt;

        // Fire for any unacknowledged past reminder.
        // It won't spam because `shownIds.current` tracks it for the session.
        if (diff < 0) return;

        // HR visibility filter: align with Tasks.tsx / TaskDashboard.tsx hasHrAccess pattern
        const isExternalHr = currentUser?.privileges?.tasks?.isExternalHr;
        const isHrDept = currentUser?.department?.toLowerCase() === 'hr';
        const hasHrAccess = isExternalHr || isHrDept;

        const mt = mainTasks.find(m => m.id === rem.mainTaskId);
        if (mt?.is_hr_task) {
          // HR tasks: only authorized HR personnel, creators, or assignees get notified
          const isCreator = mt.created_by === userId || (mt as any).createdBy === userId;
          const isAssigned = (mt.assignedTo || (mt as any).assigned_to || '').includes(userId);
          if (!hasHrAccess && !isCreator && !isAssigned) return;
        } else if (isExternalHr) {
          // External HR consultants are suppressed from non-HR task reminders unless directly involved
          const isCreator = mt && (mt.created_by === userId || (mt as any).createdBy === userId);
          const isAssigned = mt && (mt.assignedTo || (mt as any).assigned_to || '').includes(userId);
          if (!isCreator && !isAssigned) return;
        }

        const isNewTask  = rem.title === 'New Task Created';
        const isAssigned = rem.title?.startsWith('Assigned') || rem.title?.includes('assigned');

        let type: TaskPopup['type'] = 'update';
        if (isNewTask)  type = 'new_task';
        else if (isAssigned) type = 'assignment';

        pushPopup({
          type,
          title: isNewTask ? '🆕 New Task' : isAssigned ? '✅ Task Assigned' : '🔔 Reminder',
          body:  rem.body || rem.title || 'You have a reminder',
          taskUrl:   rem.mainTaskId ? `/tasks?openTask=${rem.mainTaskId}` : undefined,
          dedupeKey: `rem-popup-${rem.id}`,
          reminderId: rem.id,
        });
      });
    };

    // Check immediately and then every 30 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 30_000);
    return () => clearInterval(interval);
  }, [user?.id, reminders, pushPopup]);

  /* ── Real-time: new comment / subtask changes ───────────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const channel = supabase
      .channel(`task-popups-${userId}`)
      // Real-time: new comment on a task the user is assigned to
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_updates' },
        payload => {
          const comment = payload.new;
          if (!comment?.id) return;

          // Skip comments we already had on initial load
          if (processedCommentIds.current.has(comment.id)) return;
          processedCommentIds.current.add(comment.id);

          // Don't notify on own comments
          if (comment.author_id === userId || comment.authorId === userId) return;

          const subtaskId   = comment.subtask_id || comment.subtaskId;
          const mainTaskId  = comment.main_task_id || comment.mainTaskId;

          // Is the current user assigned to this subtask or main task?
          const sub  = subtaskId  ? subtasks.find(s => s.id === subtaskId)  : null;
          const mt   = mainTaskId ? mainTasks.find(m => m.id === mainTaskId) : null;

          const subAssignees  = (sub?.assignedTo || sub?.assigned_to || '').split(',').map((x: string) => x.trim());
          const mtAssignees   = (mt?.assignedTo  || mt?.assigned_to  || '').split(',').map((x: string) => x.trim());
          const isSubCreator  = sub?.createdBy === userId || sub?.created_by === userId;
          const isMtCreator   = mt?.createdBy  === userId || mt?.created_by  === userId;

          // Check for @mention in text FIRST so we can include it in the isRelevant check
          const myName   = (currentUser?.name || '').toLowerCase();
          const text     = (comment.content || comment.text || '').toLowerCase();
          const isMention = !!myName && text.includes(`@${myName.split(' ')[0].toLowerCase()}`);

          let isReplyToMe = false;
          const replyMatch = text.match(/\[reply_to:([\w-]+)\]/);
          if (replyMatch) {
              const targetCommentId = replyMatch[1];
              const targetComment = comments.find(c => c.id === targetCommentId);
              if (targetComment && (targetComment.author_id === userId || targetComment.authorId === userId)) {
                  isReplyToMe = true;
              }
          }

          const isRelevant = subAssignees.includes(userId) || mtAssignees.includes(userId) || isSubCreator || isMtCreator || isMention || isReplyToMe;
          if (!isRelevant) return;

          const isExternalHr = currentUser?.privileges?.tasks?.isExternalHr;
          const isAssigned = mt && (mt.assignedTo || (mt as any).assigned_to || '').includes(userId);
          if (isExternalHr && mt && !mt.is_hr_task && !isMtCreator && !isAssigned) return;

          const taskTitle = mt?.title || sub?.title || 'a task';

          pushPopup({
            type:      isMention ? 'mention' : 'update',
            title:     isMention ? `@ You were mentioned` : isReplyToMe ? `↩️ Someone replied to you` : `💬 New update on task`,
            body:      `${taskTitle}: ${(comment.content || comment.text || '').replace(/\[reply_to:[\w-]+\]/g, '').trim().slice(0, 80)}`,
            taskUrl:   mainTaskId ? `/tasks?openTask=${mainTaskId}` : undefined,
            subtaskUrl: subtaskId ? `/tasks?open=${subtaskId}`     : undefined,
            dedupeKey: `comment-popup-${comment.id}`,
          });
        }
      )
      // Real-time: subtask assigned or re-assigned to the user
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'subtasks' },
        payload => {
          const mt = mainTasks.find(m => m.id === (payload.new.mainTaskId || payload.new.main_task_id));

          const isExternalHr = currentUser?.privileges?.tasks?.isExternalHr;
          const isCreator = mt && (mt.created_by === userId || (mt as any).createdBy === userId);
          const isAssigned = mt && (mt.assignedTo || (mt as any).assigned_to || '').includes(userId);
          if (isExternalHr && mt && !mt.is_hr_task && !isCreator && !isAssigned) return;

          pushPopup({
            type:      'assignment',
            title:     '✅ You were assigned a task',
            body:      `${payload.new.title}${mt ? ` (${mt.title})` : ''}`,
            subtaskUrl: `/tasks?open=${payload.new.id}`,
            taskUrl:   mt ? `/tasks?openTask=${mt.id}` : undefined,
            dedupeKey: `assign-sub-${payload.new.id}-${Date.now()}`,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'subtasks' },
        payload => {
          const newAssigned = (payload.new?.assignedTo  || payload.new?.assigned_to  || '');
          const creator = (payload.new?.createdBy || payload.new?.created_by || '');
          // only notify if assigned to us, and we are not the one who created it!
          if (!newAssigned.includes(userId) || creator === userId) return;

          const mt = mainTasks.find(m => m.id === (payload.new.mainTaskId || payload.new.main_task_id));

          const isExternalHr = currentUser?.privileges?.tasks?.isExternalHr;
          const isCreator = mt && (mt.created_by === userId || (mt as any).createdBy === userId);
          const isAssigned = mt && (mt.assignedTo || (mt as any).assigned_to || '').includes(userId);
          if (isExternalHr && mt && !mt.is_hr_task && !isCreator && !isAssigned) return;

          pushPopup({
            type:      'assignment',
            title:     '✅ You were assigned a new task',
            body:      `${payload.new.title}${mt ? ` (${mt.title})` : ''}`,
            subtaskUrl: `/tasks?open=${payload.new.id}`,
            taskUrl:   mt ? `/tasks?openTask=${mt.id}` : undefined,
            dedupeKey: `assign-sub-insert-${payload.new.id}-${Date.now()}`,
          });
        }
      )

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, subtasks, mainTasks, currentUser, pushPopup]);

  /* ── Portal render ───────────────────────────────────────────────────── */
  return createPortal(
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2.5"
      style={{ pointerEvents: 'none' }}
    >
      <AnimatePresence mode="popLayout">
        {popups.map(p => (
          <PopupCard
            key={p.id}
            popup={p}
            onDismiss={dismiss}
            onNavigate={handleNavigate}
            onMarkAsDone={handleMarkAsDone}
            isDark={isDark}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
