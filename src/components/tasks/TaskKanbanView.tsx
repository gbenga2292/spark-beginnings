import { AnimatePresence } from "framer-motion";
import { Circle, Loader2, Hourglass, CheckCircle2 } from "lucide-react";
import type { SubTask, SubTaskStatus, MainTask, AppUser } from "@/types/tasks";
import { SubtaskCard, MainTaskCard } from "./TaskCard";
import { deriveMainTaskStatus } from "@/contexts/AppDataContext";

/* ─── Kanban column config ─────────────────────────────────────────────────── */
const COLUMNS: { status: SubTaskStatus; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { status: "not_started", label: "Not Started", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/50" },
  { status: "in_progress", label: "In Progress", icon: Loader2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { status: "pending_approval", label: "Pending", icon: Hourglass, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
  { status: "completed", label: "Done", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
];

const MAIN_COLUMNS: { status: string; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { status: "not_started", label: "Not Started", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/50" },
  { status: "in_progress", label: "In Progress", icon: Loader2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { status: "completed", label: "Done", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
];

/* ─── Subtask Kanban (for User view / My Tasks) ──────────────────────────── */
interface SubtaskKanbanProps {
  subtasks: SubTask[];
  mainTasks: MainTask[];
  users: AppUser[];
  onClickSubtask: (id: string) => void;
  hidePendingApproval?: boolean;
}

export function SubtaskKanbanView({ subtasks, mainTasks, users, onClickSubtask, hidePendingApproval }: SubtaskKanbanProps) {
  const cols = hidePendingApproval ? COLUMNS.filter(c => c.status !== "pending_approval") : COLUMNS;

  return (
    <div className={`grid gap-3 ${cols.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
      {cols.map(col => {
        const items = subtasks.filter(s => s.status === col.status);
        return (
          <div key={col.status} className={`rounded-xl ${col.bg} border border-border/50 p-3 min-h-[200px]`}>
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <col.icon className={`w-3.5 h-3.5 ${col.color}`} />
              <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
              <span className="text-[10px] font-bold bg-card border border-border text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {items.map(sub => {
                  const mt = mainTasks.find(m => m.id === sub.mainTaskId);
                  const assignee = sub.assignedTo ? users.find(u => u.id === sub.assignedTo) : undefined;
                  return (
                    <SubtaskCard
                      key={sub.id}
                      subtask={sub}
                      mainTask={mt}
                      assignee={assignee}
                      onClick={() => onClickSubtask(sub.id)}
                      compact
                    />
                  );
                })}
              </AnimatePresence>
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground/50 text-center py-8 italic">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Task Kanban (for Admin All Tasks view) ────────────────────────── */
interface MainTaskKanbanProps {
  mainTasks: MainTask[];
  allSubtasks: SubTask[];
  users: AppUser[];
  onClickTask: (id: string) => void;
}

export function MainTaskKanbanView({ mainTasks, allSubtasks, users, onClickTask }: MainTaskKanbanProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {MAIN_COLUMNS.map(col => {
        const items = mainTasks.filter(mt => deriveMainTaskStatus(mt.id, allSubtasks) === col.status);
        return (
          <div key={col.status} className={`rounded-xl ${col.bg} border border-border/50 p-3 min-h-[200px]`}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <col.icon className={`w-3.5 h-3.5 ${col.color}`} />
              <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
              <span className="text-[10px] font-bold bg-card border border-border text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {items.map(mt => {
                  const subs = allSubtasks.filter(s => s.mainTaskId === mt.id);
                  return (
                    <MainTaskCard
                      key={mt.id}
                      task={mt}
                      subtasks={subs}
                      users={users}
                      onClick={() => onClickTask(mt.id)}
                      compact
                    />
                  );
                })}
              </AnimatePresence>
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground/50 text-center py-8 italic">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
