import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { isPast, isToday, isTomorrow } from "date-fns";
import type { SubTask, MainTask } from "@/src/types/tasks";

interface TaskStatsBarProps {
  mainTasks: MainTask[];
  subtasks: SubTask[];
  label?: string;
}

export function TaskStatsBar({ mainTasks, subtasks, label }: TaskStatsBarProps) {
  const total = subtasks.length;
  const completed = subtasks.filter(s => s.status === "completed").length;
  const inProgress = subtasks.filter(s => s.status === "in_progress").length;
  const overdue = subtasks.filter(s => s.deadline && isPast(new Date(s.deadline)) && s.status !== "completed").length;
  const dueToday = subtasks.filter(s => s.deadline && isToday(new Date(s.deadline)) && s.status !== "completed").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { icon: ListTodo, label: "Total", value: total, color: "text-primary", bg: "bg-primary/10" },
    { icon: Clock, label: "In Progress", value: inProgress, color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: CheckCircle2, label: "Done", value: completed, color: "text-green-500", bg: "bg-green-500/10" },
    { icon: AlertTriangle, label: "Overdue", value: overdue, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 mb-4"
    >
      {label && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Progress ring */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${pct * 1.508} ${150.8 - pct * 1.508}`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{pct}%</span>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {stats.map(s => (
            <div key={s.label} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${s.bg} min-w-[80px]`}>
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <div>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            </div>
          ))}
          {dueToday > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-warning/10 min-w-[80px]">
              <Clock className="w-3.5 h-3.5 text-warning" />
              <div>
                <p className="text-sm font-bold text-warning">{dueToday}</p>
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Due Today</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
