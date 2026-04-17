import { motion } from "framer-motion";
import { Clock, Flag, CheckCircle2, Circle, Loader2, User, Hourglass, AtSign } from "lucide-react";
import { isPast, isToday, isTomorrow, format } from "date-fns";
import type { SubTask, SubTaskStatus, MainTask, AppUser, TaskPriority } from "@/src/types/tasks";
import { getMainTaskProgress, deriveMainTaskStatus } from '@/src/contexts/AppDataContext';

/* ─── Priority config ──────────────────────────────────────────────────────── */
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; border: string }> = {
  low: { label: "Low", dot: "bg-slate-400", border: "border-l-slate-300" },
  medium: { label: "Medium", dot: "bg-amber-400", border: "border-l-amber-400" },
  high: { label: "High", dot: "bg-orange-500", border: "border-l-orange-500" },
  urgent: { label: "Urgent", dot: "bg-red-500", border: "border-l-red-500" },
};

const statusConfig: Record<SubTaskStatus, { label: string; pillClass: string; dot: string; icon: React.ElementType }> = {
  not_started: { label: "Not Started", pillClass: "chip-pending", dot: "bg-gray-400", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress", dot: "bg-blue-600", icon: Loader2 },
  pending_approval: { label: "Pending", pillClass: "chip-pending-approval", dot: "bg-amber-400", icon: Hourglass },
  completed: { label: "Done", pillClass: "chip-completed", dot: "bg-green-600", icon: CheckCircle2 },
};

function formatDueDate(d?: string) {
  if (!d) return "";
  const date = new Date(d);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

/* ─── Main Task Card (for Board/Focus views) ─────────────────────────────── */
interface MainTaskCardProps {
  task: MainTask;
  subtasks: SubTask[];
  users: AppUser[];
  onClick: () => void;
  compact?: boolean;
  isMentioned?: boolean;
  unseenCount?: number;
}

export function MainTaskCard({ task, subtasks, users, onClick, compact, isMentioned, unseenCount }: MainTaskCardProps) {
  const progress = getMainTaskProgress(task.id, subtasks);
  const status = deriveMainTaskStatus(task.id, subtasks);
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isOverdue = task.deadline && isPast(new Date(task.deadline)) && status !== "completed";
  const assignee = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={`bg-card border rounded-xl cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group border-l-4 ${
        task.priority ? PRIORITY_CONFIG[task.priority].border : "border-l-transparent"
      } ${compact ? "p-3" : "p-4"}`}
    >
      {/* Title + priority + badges */}
      <div className="flex items-start gap-2 mb-2">
        <p className={`font-medium text-foreground group-hover:text-primary transition-colors flex-1 ${compact ? "text-xs" : "text-sm"} ${status === "completed" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* WhatsApp-style @ mention badge */}
          {isMentioned && (
            <span title="You were mentioned" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600 text-white">
              <AtSign className="w-2.5 h-2.5" />
            </span>
          )}
          {/* Unread count badge */}
          {!isMentioned && unseenCount != null && unseenCount > 0 && (
            <span title={`${unseenCount} unread update${unseenCount !== 1 ? 's' : ''}`}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white min-w-[18px] justify-center">
              {unseenCount}
            </span>
          )}
          {task.priority && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${PRIORITY_CONFIG[task.priority].dot}`} title={task.priority} />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${status === "completed" ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">{pct}%</span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground">{progress.completed}/{progress.total} subtasks</span>
        {task.deadline && (
          <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            <Clock className="w-2.5 h-2.5" />{formatDueDate(task.deadline)}
          </span>
        )}
        {assignee && (
          <div className={`w-5 h-5 rounded-full ${assignee.avatarColor} flex items-center justify-center text-white text-[8px] font-bold ml-auto`} title={assignee.name}>
            {assignee.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Subtask Card (for Board/Focus views) ──────────────────────────────── */
interface SubtaskCardProps {
  subtask: SubTask;
  mainTask?: MainTask;
  assignee?: AppUser;
  onClick: () => void;
  compact?: boolean;
  isMentioned?: boolean;
  unseenCount?: number;
}

export function SubtaskCard({ subtask, mainTask, assignee, onClick, compact, isMentioned, unseenCount }: SubtaskCardProps) {
  const sc = statusConfig[subtask.status];
  const isOverdue = subtask.deadline && isPast(new Date(subtask.deadline)) && subtask.status !== "completed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={`bg-card border rounded-xl cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group ${
        subtask.priority ? `border-l-4 ${PRIORITY_CONFIG[subtask.priority].border}` : ""
      } ${compact ? "p-2.5" : "p-3.5"}`}
    >
      {/* Status dot + title + badges */}
      <div className="flex items-start gap-2 mb-1.5">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${sc.dot}`} />
        <p className={`flex-1 font-medium group-hover:text-primary transition-colors ${compact ? "text-xs" : "text-sm"} ${subtask.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {subtask.title}
        </p>
        {/* WhatsApp-style badges */}
        {isMentioned && (
          <span title="You were mentioned" className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold bg-indigo-600 text-white flex-shrink-0">
            <AtSign className="w-2.5 h-2.5" />
          </span>
        )}
        {!isMentioned && unseenCount != null && unseenCount > 0 && (
          <span title={`${unseenCount} unread update${unseenCount !== 1 ? 's' : ''}`}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white flex-shrink-0 min-w-[16px] justify-center">
            {unseenCount}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap ml-[18px]">
        {mainTask && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md truncate max-w-[120px]">{mainTask.title}</span>}
        {subtask.deadline && (
          <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            <Clock className="w-2.5 h-2.5" />{formatDueDate(subtask.deadline)}
          </span>
        )}
        {subtask.priority && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[subtask.priority].dot}`} title={subtask.priority} />
        )}
        {assignee && (
          <div className={`w-4 h-4 rounded-full ${assignee.avatarColor} flex items-center justify-center text-white text-[7px] font-bold ml-auto`} title={assignee.name}>
            {assignee.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
        )}
      </div>
    </motion.div>
  );
}



