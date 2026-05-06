import { AnimatePresence } from "framer-motion";
import { Circle, Loader2, Hourglass, CheckCircle2, Bell, Clock } from "lucide-react";
import { format, isPast } from "date-fns";
import type { SubTask, SubTaskStatus, MainTask, AppUser } from "@/src/types/tasks";
import { SubtaskCard, MainTaskCard } from "./TaskCard";
import { deriveMainTaskStatus } from '@/src/contexts/AppDataContext';

/* â”€â”€â”€ Badge helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function computeBadges(
  comments: any[],
  myId: string | undefined,
  myFirstName: string | undefined,
  readMap: Record<string, string>,
  taskId: string,
  relatedSubIds: string[] = [],
): { isMentioned: boolean; unseenCount: number } {
  if (!myId) return { isMentioned: false, unseenCount: 0 };

  const readAt = readMap[taskId] || '';
  const subIdSet = new Set(relatedSubIds);
  const taskCmts = comments.filter(c => {
    const cMainId = c.main_task_id ?? c.mainTaskId;
    const cSubId  = c.subtask_id  ?? c.subtaskId;
    return cMainId === taskId || (cSubId && subIdSet.has(cSubId));
  });

  const isMentioned = !!myFirstName && taskCmts.some(c =>
    (c.content || c.text || '').toLowerCase().includes(`@${myFirstName.toLowerCase()}`) &&
    (c.created_at || '') > readAt
  );

  const unseenCount = taskCmts.filter(c =>
    (c.author_id ?? c.authorId) !== myId &&
    (c.created_at || '') > readAt
  ).length;

  return { isMentioned, unseenCount };
}


/* â”€â”€â”€ Kanban column config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const COLUMNS: { status: SubTaskStatus; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { status: "not_started", label: "Not Started", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/50" },
  { status: "in_progress", label: "In Progress", icon: Loader2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { status: "pending_approval", label: "Pending", icon: Hourglass, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
  { status: "completed", label: "Done", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
];

const MAIN_COLUMNS: { status: string; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { status: "not_started", label: "Not Started", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/50" },
  { status: "in_progress", label: "In Progress", icon: Loader2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { status: "pending_approval", label: "Pending", icon: Hourglass, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
  { status: "completed", label: "Done", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
];

/* â”€â”€â”€ Subtask Kanban (for User view / My Tasks) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface SubtaskKanbanProps {
  subtasks: SubTask[];
  mainTasks: MainTask[];
  users: AppUser[];
  onClickSubtask: (id: string) => void;
  hidePendingApproval?: boolean;
  reminders?: any[];
  comments?: any[];
  currentUserId?: string;
  currentUserFirstName?: string;
  readMap?: Record<string, string>;
}

function ReminderKanbanCard({ reminder }: { reminder: any }) {
  const isOverdue = isPast(new Date(reminder.remindAt));
  return (
    <div className="bg-card border border-border p-3 rounded-lg shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{reminder.title}</h4>
        <Bell className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
      </div>
      {reminder.body && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{reminder.body}</p>}
      <div className="flex items-center gap-1.5 mt-auto">
        <Clock className={`w-3 h-3 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
        <span className={`text-[10px] font-medium ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
          {format(new Date(reminder.remindAt), "MMM d, h:mm a")}
        </span>
      </div>
    </div>
  );
}

export function SubtaskKanbanView({
  subtasks, mainTasks, users, onClickSubtask, hidePendingApproval, reminders,
  comments = [], currentUserId, currentUserFirstName, readMap = {},
}: SubtaskKanbanProps) {
  const allColumns = [
    { type: 'col', status: 'not_started' },
    { type: 'col', status: 'in_progress' },
    { type: 'reminders', status: 'reminders' },
    { type: 'col', status: 'completed' },
    { type: 'col', status: 'pending_approval' }
  ];

  const colsToRender = allColumns.filter(c => {
    if (c.type === 'reminders') return !!reminders;
    if (c.status === 'pending_approval' && hidePendingApproval) return false;
    return true;
  });

  const numCols = Math.min(5, colsToRender.length);
  const gridClasses = `grid gap-3 grid-cols-2 lg:grid-cols-${numCols}`;

  return (
    <div className={gridClasses}>
      {colsToRender.map((cConfig) => {
        if (cConfig.type === 'reminders') {
          return (
            <div key="reminders" className="rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 p-3 min-h-[200px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Reminders</span>
                <span className="text-[10px] font-bold bg-card border border-border text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">
                  {reminders?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {reminders?.map(r => <ReminderKanbanCard key={r.id} reminder={r} />)}
                </AnimatePresence>
                {(!reminders || reminders.length === 0) && (
                  <p className="text-[11px] text-muted-foreground/50 text-center py-8 italic">No active reminders</p>
                )}
              </div>
            </div>
          );
        }

        const col = COLUMNS.find(x => x.status === cConfig.status)!;
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
                  const assignee = sub.assignedTo ? users.find(u => u.id === sub.assignedTo?.split(',')[0]) : undefined;
                  const { isMentioned, unseenCount } = computeBadges(
                    comments, currentUserId, currentUserFirstName, readMap,
                    sub.id ?? '', []
                  );
                  return (
                    <SubtaskCard
                      key={sub.id}
                      subtask={sub}
                      mainTask={mt}
                      assignee={assignee}
                      onClick={() => onClickSubtask(sub.id ?? '')}
                      compact
                      isMentioned={isMentioned}
                      unseenCount={unseenCount}
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

/* â”€â”€â”€ Main Task Kanban (for Admin All Tasks view) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface MainTaskKanbanProps {
  mainTasks: MainTask[];
  allSubtasks: SubTask[];
  users: AppUser[];
  onClickTask: (id: string) => void;
  reminders?: any[];
  comments?: any[];
  currentUserId?: string;
  currentUserFirstName?: string;
  readMap?: Record<string, string>;
}

export function MainTaskKanbanView({
  mainTasks, allSubtasks, users, onClickTask, reminders,
  comments = [], currentUserId, currentUserFirstName, readMap = {},
}: MainTaskKanbanProps) {
  const allColumns = [
    { type: 'col', status: 'not_started' },
    { type: 'col', status: 'in_progress' },
    { type: 'reminders', status: 'reminders' },
    { type: 'col', status: 'pending_approval' },
    { type: 'col', status: 'completed' }
  ];

  const colsToRender = allColumns.filter(c => {
    if (c.type === 'reminders') return !!reminders;
    return true;
  });

  const numCols = Math.min(4, colsToRender.length);
  const gridClasses = `grid gap-3 grid-cols-2 lg:grid-cols-${numCols}`;

  return (
    <div className={gridClasses}>
      {colsToRender.map((cConfig) => {
        if (cConfig.type === 'reminders') {
          return (
            <div key="reminders" className="rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 p-3 min-h-[200px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Reminders</span>
                <span className="text-[10px] font-bold bg-card border border-border text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">
                  {reminders?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {reminders?.map(r => <ReminderKanbanCard key={r.id} reminder={r} />)}
                </AnimatePresence>
                {(!reminders || reminders.length === 0) && (
                  <p className="text-[11px] text-muted-foreground/50 text-center py-8 italic">No active reminders</p>
                )}
              </div>
            </div>
          );
        }

        const col = MAIN_COLUMNS.find(x => x.status === cConfig.status)!;
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
                  const subIds = subs.map(s => s.id ?? '');
                  const { isMentioned, unseenCount } = computeBadges(
                    comments, currentUserId, currentUserFirstName, readMap,
                    mt.id, subIds
                  );
                  return (
                    <MainTaskCard
                      key={mt.id}
                      task={mt}
                      subtasks={subs}
                      users={users}
                      onClick={() => onClickTask(mt.id)}
                      compact
                      isMentioned={isMentioned}
                      unseenCount={unseenCount}
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
