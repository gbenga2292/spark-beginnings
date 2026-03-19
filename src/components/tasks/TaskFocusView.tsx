import { motion } from "framer-motion";
import { AlertTriangle, Clock, Zap, CheckCircle2 } from "lucide-react";
import { isPast, isToday, isTomorrow } from "date-fns";
import type { SubTask, MainTask, AppUser } from "@/types/tasks";
import { SubtaskCard } from "./TaskCard";

interface TaskFocusViewProps {
  subtasks: SubTask[];
  mainTasks: MainTask[];
  users: AppUser[];
  onClickSubtask: (id: string) => void;
}

export function TaskFocusView({ subtasks, mainTasks, users, onClickSubtask }: TaskFocusViewProps) {
  const active = subtasks.filter(s => s.status !== "completed");
  
  const overdue = active.filter(s => s.deadline && isPast(new Date(s.deadline)));
  const dueToday = active.filter(s => s.deadline && isToday(new Date(s.deadline)) && !isPast(new Date(s.deadline)));
  const dueTomorrow = active.filter(s => s.deadline && isTomorrow(new Date(s.deadline)));
  const urgent = active.filter(s => s.priority === "urgent" && !overdue.includes(s) && !dueToday.includes(s));
  
  // Everything else that's not in the above categories
  const focusedIds = new Set([...overdue, ...dueToday, ...dueTomorrow, ...urgent].map(s => s.id));
  const rest = active.filter(s => !focusedIds.has(s.id));

  const completedRecently = subtasks
    .filter(s => s.status === "completed")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const sections = [
    { title: "🔥 Overdue", items: overdue, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", empty: null },
    { title: "⚡ Due Today", items: dueToday, icon: Zap, color: "text-warning", bg: "bg-warning/5 border-warning/20", empty: null },
    { title: "📅 Due Tomorrow", items: dueTomorrow, icon: Clock, color: "text-blue-500", bg: "bg-blue-500/5 border-blue-500/20", empty: null },
    { title: "🚨 Urgent", items: urgent, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/5 border-red-500/20", empty: null },
  ].filter(s => s.items.length > 0);

  if (sections.length === 0 && rest.length === 0 && completedRecently.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-border rounded-2xl">
        <p className="text-4xl mb-3">🎉</p>
        <p className="text-lg font-semibold text-foreground">All clear!</p>
        <p className="text-sm text-muted-foreground mt-1">No urgent or upcoming tasks. Great work!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Priority sections */}
      {sections.map((section, idx) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className={`rounded-2xl border p-4 ${section.bg}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold">{section.title}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-card border border-border ${section.color}`}>
              {section.items.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {section.items.map(sub => {
              const mt = mainTasks.find(m => m.id === sub.mainTaskId);
              const assignee = sub.assignedTo ? users.find(u => u.id === sub.assignedTo) : undefined;
              return (
                <SubtaskCard key={sub.id} subtask={sub} mainTask={mt} assignee={assignee} onClick={() => onClickSubtask(sub.id)} />
              );
            })}
          </div>
        </motion.div>
      ))}

      {/* Other active tasks */}
      {rest.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sections.length * 0.05 }}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Other Active Tasks ({rest.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map(sub => {
              const mt = mainTasks.find(m => m.id === sub.mainTaskId);
              const assignee = sub.assignedTo ? users.find(u => u.id === sub.assignedTo) : undefined;
              return (
                <SubtaskCard key={sub.id} subtask={sub} mainTask={mt} assignee={assignee} onClick={() => onClickSubtask(sub.id)} compact />
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recently completed */}
      {completedRecently.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (sections.length + 1) * 0.05 }}
          className="opacity-60"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500" /> Recently Done
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {completedRecently.map(sub => {
              const mt = mainTasks.find(m => m.id === sub.mainTaskId);
              return (
                <SubtaskCard key={sub.id} subtask={sub} mainTask={mt} onClick={() => onClickSubtask(sub.id)} compact />
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
