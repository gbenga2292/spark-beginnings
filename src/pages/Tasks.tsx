import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData, deriveMainTaskStatus, getMainTaskProgress } from '@/src/contexts/AppDataContext';
import { useWorkspace } from '@/src/hooks/use-workspace';
import type { SubTask, SubTaskStatus, MainTask, AppUser } from "@/src/types/tasks";
import type { TaskPriority } from "@/src/types/tasks";
import {
  Plus, Search, Circle, Loader2,
  CheckCircle2, Calendar, X, Users, Clock, ChevronDown,
  ChevronRight, UserCheck, Trash2, ArrowUpDown, Flag, MessageSquare, Send, Pencil,
  Lock, User, FolderOpen, LayoutGrid, List
} from "lucide-react";
import { differenceInHours, addDays } from "date-fns";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { TaskDetailSheet } from "@/src/components/tasks/TaskDetailSheet";
import { ViewToggle, type TaskViewMode } from "@/src/components/tasks/ViewToggle";
import { SubtaskKanbanView, MainTaskKanbanView } from "@/src/components/tasks/TaskKanbanView";
import { TaskFocusView } from "@/src/components/tasks/TaskFocusView";

import type { Project } from "@/src/types/tasks/project";
import { CreateProjectDialog } from "@/src/components/tasks/CreateProjectDialog";

/* ─── Shared config ────────────────────────────────────────────────────────── */
const statusConfig: Record<SubTaskStatus, { label: string; pillClass: string; dot: string; icon: React.ElementType }> = {
  not_started: { label: "Not Started", pillClass: "chip-pending", dot: "bg-gray-400", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress", dot: "bg-blue-600", icon: Loader2 },
  pending_approval: { label: "Pending Approval", pillClass: "chip-pending-approval", dot: "bg-amber-400", icon: Circle },
  completed: { label: "Completed", pillClass: "chip-completed", dot: "bg-green-600", icon: CheckCircle2 },
};

const mainStatusConfig = {
  not_started: { label: "Not Started", pillClass: "chip-pending" },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress" },
  completed: { label: "Completed", pillClass: "chip-completed" },
};

function formatDueDate(d?: string) {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  } catch { return ""; }
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

type SortOption = 'date_asc' | 'date_desc' | 'urgency' | 'alpha';
const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Most Urgent', value: 'urgency' },
  { label: 'Due Date (Earliest)', value: 'date_asc' },
  { label: 'Due Date (Latest)', value: 'date_desc' },
  { label: 'Alphabetical', value: 'alpha' },
];

/* ─── Priority config ──────────────────────────────────────────────────────────── */
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string; dot: string; border: string; bg: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400', border: 'border-l-slate-300', bg: '' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-400', border: 'border-l-amber-400', bg: 'bg-amber-50/30 dark:bg-amber-900/10' },
  high: { label: 'High', className: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-l-orange-500', bg: 'bg-orange-50/30 dark:bg-orange-900/10' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500', border: 'border-l-red-500', bg: 'bg-red-50/25 dark:bg-red-900/10' },
};
const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

function PriorityBadge({ priority, size = 'sm' }: { priority?: TaskPriority; size?: 'xs' | 'sm' }) {
  if (!priority) return null;
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.className} ${size === 'xs' ? 'text-[10px] px-1.5' : ''}`}>
      <Flag className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function PriorityPicker({ value, onChange }: { value?: TaskPriority; onChange: (p: TaskPriority | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(p => !p);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all hover:shadow-sm ${value ? PRIORITY_CONFIG[value].className : 'border-border bg-muted text-muted-foreground hover:text-foreground'
          }`}
      >
        <Flag className="w-3 h-3" />
        {value ? PRIORITY_CONFIG[value].label : 'Priority'}
      </button>

      <AnimatePresence>
        {open && createPortal(
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
            className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[140px]"
          >
            <button type="button" onClick={() => { onChange(undefined); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
              <span className="w-2 h-2 rounded-full border border-muted-foreground/40" />None
            </button>
            {PRIORITY_ORDER.map(p => (
              <button key={p} type="button" onClick={() => { onChange(p); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-muted ${value === p ? 'font-semibold ' + PRIORITY_CONFIG[p].className : 'text-foreground'
                  }`}>
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[p].dot}`} />
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Delete confirm inline ────────────────────────────────────────────────────────── */
function DeleteTaskButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return (
    <button onClick={e => { e.stopPropagation(); setConfirming(true); }}
      className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all"
      title="Delete task">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.12 }}
      className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2 py-1"
      onClick={e => e.stopPropagation()}>
      <span className="text-[11px] font-medium text-red-600 whitespace-nowrap">Delete?</span>
      <button onClick={() => { onConfirm(); setConfirming(false); }}
        className="px-2 py-0.5 bg-red-500 text-white text-[11px] font-semibold rounded-lg hover:bg-red-600 transition-colors">
        Yes
      </button>
      <button onClick={() => setConfirming(false)}
        className="px-2 py-0.5 bg-white border border-red-200 text-red-500 text-[11px] font-semibold rounded-lg hover:bg-red-50 transition-colors">
        No
      </button>
    </motion.div>
  );
}

/* ─── Subtask delete — locked when subtask has comments ────────────────────── */
function DeleteSubtaskButton({ hasActivity, onConfirm }: { hasActivity: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (hasActivity) {
    return (
      <span
        title="Cannot delete — this subtask has updates or is an active thread"
        className="p-1 rounded-lg text-muted-foreground/20 cursor-not-allowed select-none"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
    );
  }

  if (!confirming) return (
    <button
      onClick={e => { e.stopPropagation(); setConfirming(true); }}
      className="p-1 rounded-lg text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
      title="Delete subtask (no activity — safe to remove)">
      <Trash2 className="w-3 h-3" />
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.1 }}
      className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-1.5 py-0.5"
      onClick={e => e.stopPropagation()}>
      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">Sure?</span>
      <button
        onClick={() => { onConfirm(); setConfirming(false); }}
        className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors">
        Yes
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="px-1.5 py-0.5 text-red-500 text-[10px] font-bold rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
        No
      </button>
    </motion.div>
  );
}

function urgencyScore(sub: { deadline?: string; status: string }) {
  if (sub.status === "completed") return 99999;
  if (!sub.deadline) return 5000;
  const hoursUntil = differenceInHours(new Date(sub.deadline), new Date());
  return hoursUntil < 0 ? -1000 + hoursUntil : hoursUntil;
}

function applySortToSubs<T extends { title: string; deadline?: string; status: string }>(list: T[], sort: SortOption): T[] {
  const sorted = [...list];
  switch (sort) {
    case 'urgency': return sorted.sort((a, b) => urgencyScore(a) - urgencyScore(b));
    case 'date_asc': return sorted.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
    case 'date_desc': return sorted.sort((a, b) => (b.deadline ?? '').localeCompare(a.deadline ?? ''));
    case 'alpha': return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

function loadDefaultSort(): SortOption {
  try { return (localStorage.getItem('tf_default_sort') as SortOption) || 'urgency'; } catch { return 'urgency'; }
}

function loadDefaultView(): TaskViewMode {
  try { return (localStorage.getItem('tf_default_view') as TaskViewMode) || 'list'; } catch { return 'list'; }
}

function ScopePicker({ scope, setScope, myCount, pendingCount }: { scope: 'all' | 'mine' | 'pending_review' | 'projects', setScope: (s: any) => void, myCount: number, pendingCount: number }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const SCOPES = [
    { value: 'mine', label: 'Mine', icon: User, count: myCount },
    { value: 'all', label: 'All', icon: LayoutGrid },
    { value: 'pending_review', label: 'Review', icon: Clock, count: pendingCount },
    { value: 'projects', label: 'Projects', icon: FolderOpen },
  ];

  const active = SCOPES.find(s => s.value === scope) || SCOPES[1];

  return (
    <div className="relative z-20" ref={containerRef}>
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-card text-foreground transition-all shadow-sm ring-1 ring-border/20 ${
          scope === 'pending_review' && pendingCount > 0 ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-border/40 hover:bg-muted/80'
        }`}
      >
        <span>{active.label}</span>
        {active.count !== undefined && active.count > 0 && (
          <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            active.value === 'pending_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-primary/10 text-primary'
          }`}>
            {active.count}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-muted-foreground ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
           <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 z-40 bg-card border border-border rounded-xl shadow-[0...10px_rgba(0,0,0,0.1)] overflow-hidden min-w-[130px]"
          >
            {SCOPES.map(s => {
              const isActive = scope === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => { setScope(s.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors hover:bg-muted ${
                    isActive ? "text-primary font-semibold bg-primary/5" : "text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <s.icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    {s.label}
                  </span>
                  {s.count !== undefined && s.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {s.count}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type PriorityFilter = TaskPriority | 'all';

/* ─── Main export ──────────────────────────────────────────────────────────── */
export default function Tasks() {
  const { user: currentUser } = useAuth();
  const { isPersonal } = useWorkspace();
  if (isPersonal) return <PersonalTasksView />;
  return <AdminTasksView />;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PERSONAL WORKSPACE TASKS
═══════════════════════════════════════════════════════════════════════════════ */
function PersonalTasksView() {
  const { mainTasks, subtasks, createMainTask, addSubtask, deleteSubtask,
    updateSubtask, updateSubtaskStatus, deleteMainTask, updateMainTask, comments, reminders } = useAppData();
  const { user: currentUser } = useAuth();
  const { wsTasks, workspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<MainTask | null>(null);
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>(loadDefaultSort());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  
  const [viewMode, setViewModeState] = useState<TaskViewMode>(() => (localStorage.getItem('tf_default_view') as TaskViewMode) || loadDefaultView());

  const setViewMode = (v: TaskViewMode) => {
    setViewModeState(v);
    localStorage.setItem('tf_default_view', v);
  };

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && subtasks.length > 0) {
      setOpenSubtaskId(openId);
      const parentSub = subtasks.find(s => s.id === openId);
      if (parentSub) {
        setExpanded(prev => new Set([...prev, parentSub.mainTaskId]));
        setTimeout(() => document.getElementById(`subtask-row-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
    const openTaskId = searchParams.get("openTask");
    if (openTaskId) {
      setExpanded(prev => new Set([...prev, openTaskId]));
      setTimeout(() => document.getElementById(`task-row-${openTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
    
    // Clear 'open' and 'openTask' params
    if (openId || openTaskId) {
       setSearchParams(prev => {
         const next = new URLSearchParams(prev);
         next.delete("open");
         next.delete("openTask");
         return next;
       }, { replace: true });
    }
  }, [searchParams, setSearchParams, subtasks]);

  const wsTaskIds = new Set(wsTasks.map(mt => mt.id));
  const wsSubs = subtasks.filter(s => wsTaskIds.has(s.mainTaskId));

  const STATUS_TABS = [
    { label: "All", value: "all" },
    { label: "Not Started", value: "not_started" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
  ] as const;

  const filtered = wsTasks.filter(mt =>
    (mt.title.toLowerCase().includes(search.toLowerCase()) ||
      mt.description.toLowerCase().includes(search.toLowerCase())) &&
    (priorityFilter === 'all' || mt.priority === priorityFilter) &&
    (statusFilter === 'all' || deriveMainTaskStatus(mt.id, wsSubs) === statusFilter)
  );

  const toggle = (id: string) =>
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-0">

      {/* Toolbar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-2 mb-3 flex-wrap">
        <ViewToggle value={viewMode} onChange={setViewMode} />

        {/* Sort */}
        <div className="relative">
          <button onClick={() => setShowSortMenu(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
          </button>
          {showSortMenu && (
            <div className="absolute left-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-lg py-1 w-52">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${sortBy === opt.value ? 'bg-violet-50 text-violet-600 font-medium dark:bg-violet-900/20 dark:text-violet-400' : 'text-foreground hover:bg-muted'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority filter */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-1">
            {(['all', ...PRIORITY_ORDER] as PriorityFilter[]).map(p => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${priorityFilter === p
                  ? p === 'all' ? 'bg-foreground text-background border-foreground' : PRIORITY_CONFIG[p as TaskPriority].className
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                  }`}>
                {p === 'all' ? 'All' : PRIORITY_CONFIG[p as TaskPriority].label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Task</span>
        </button>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search your tasks…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted text-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-card transition-all border border-border focus:border-violet-300" />
          {search && <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </motion.div>

      {/* ── BOARD VIEW ── */}
      {viewMode === 'board' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <MainTaskKanbanView
            mainTasks={filtered}
            allSubtasks={wsSubs}
            users={[]}
            onClickTask={id => toggle(id)}
            reminders={reminders.filter(r => r.isActive && (r.createdBy === currentUser?.id || r.recipientIds?.includes(currentUser?.id ?? '')))}
          />
        </motion.div>
      )}

      {/* ── FOCUS VIEW ── */}
      {viewMode === 'focus' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <TaskFocusView
            subtasks={wsSubs}
            mainTasks={wsTasks}
            users={[]}
            onClickSubtask={id => setOpenSubtaskId(id)}
          />
        </motion.div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
          {/* Status tabs */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1 mb-4 border-b border-border pb-0">
            {STATUS_TABS.map(tab => {
              const isActive = statusFilter === tab.value;
              const count = tab.value === "all" ? wsTasks.length : wsTasks.filter(mt => deriveMainTaskStatus(mt.id, wsSubs) === tab.value).length;
              if (tab.value !== 'all' && count === 0) return null;
              return (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-t-md ${isActive ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" : "bg-muted text-muted-foreground"}`}>{count}</span>
                  )}
                  {isActive && <motion.div layoutId="personal-status-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
                </button>
              );
            })}
          </motion.div>

          {/* Task list */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {filtered.length === 0 ? (
              <div className="text-center py-24 bg-card border border-violet-100 dark:border-violet-900/30 rounded-xl">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-base font-medium text-foreground">No personal tasks yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first private task to get started.</p>
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 px-5 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors">
                  + New Task
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(mt => {
                  const isExpanded = expanded.has(mt.id);
                  const subs = applySortToSubs(wsSubs.filter(s => s.mainTaskId === mt.id), sortBy) as SubTask[];
                  const progress = getMainTaskProgress(mt.id, wsSubs);
                  const status = deriveMainTaskStatus(mt.id, wsSubs);
                  const sc = mainStatusConfig[status];
                  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

                  return (
                    <div key={mt.id} id={`task-row-${mt.id}`}
                      className={`bg-card border rounded-xl overflow-hidden hover:shadow-sm transition-all border-l-4 ${mt.priority ? PRIORITY_CONFIG[mt.priority].border : 'border-l-violet-300 dark:border-l-violet-700'} border-violet-100 dark:border-violet-900/30`}>
                      {/* Task header */}
                      <div role="button" tabIndex={0}
                        onClick={() => toggle(mt.id)}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle(mt.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors text-left cursor-pointer">
                        <div className="text-muted-foreground flex-shrink-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-foreground font-medium truncate">{mt.title}</p>
                            {mt.priority && <PriorityBadge priority={mt.priority} size="xs" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{progress.completed}/{progress.total} tasks</span>
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-violet-400 dark:bg-violet-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-medium">{pct}%</span>
                          </div>
                        </div>
                        {mt.deadline && (
                          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                            <Calendar className="w-3 h-3" />{format(new Date(mt.deadline), "MMM d")}
                          </div>
                        )}
                        <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                          <PriorityPicker value={mt.priority} onChange={p => updateMainTask(mt.id, { priority: p })} />
                        </div>
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-max flex-shrink-0 ${sc.pillClass}`}>
                          {sc.label}
                        </span>
                      </div>

                      {/* Subtasks */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="border-t border-violet-100 dark:border-violet-900/30">
                              {subs.length === 0 && (
                                <p className="px-5 py-4 text-xs text-muted-foreground italic">No subtasks yet.</p>
                              )}

                              <div className="divide-y divide-violet-50 dark:divide-violet-900/20">
                                {subs.map((sub, i) => {
                                  const sc2 = statusConfig[sub.status];
                                  const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== "completed";
                                  return (
                                    <motion.div key={sub.id ?? i} id={`subtask-row-${sub.id}`}
                                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.03, duration: 0.25 }}
                                      onClick={() => setOpenSubtaskId(sub.id ?? null)}
                                      className="flex items-center gap-3 px-5 py-3 hover:bg-violet-50/60 dark:hover:bg-violet-950/30 transition-colors cursor-pointer group">
                                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc2.dot}`} />
                                      <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-medium truncate ${sub.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"} group-hover:text-violet-600 transition-colors`}>
                                          {sub.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {(sub as SubTask).description && <p className="text-xs text-muted-foreground truncate">{(sub as SubTask).description}</p>}
                                        </div>
                                      </div>
                                      {(sub as SubTask).priority && <PriorityBadge priority={(sub as SubTask).priority} size="xs" />}
                                      {sub.deadline && (
                                        <span className={`text-[11px] flex items-center gap-1 flex-shrink-0 hidden md:flex ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                                          <Clock className="w-3 h-3" />{formatDueDate(sub.deadline)}
                                        </span>
                                      )}
                                      <div onClick={e => e.stopPropagation()} className="flex items-center gap-1 flex-shrink-0">
                                        <DeleteSubtaskButton
                                          hasActivity={comments.some(c => c.subtaskId === sub.id) || sub.status !== 'not_started'}
                                          onConfirm={() => deleteSubtask(sub.id ?? '')}
                                        />
                                      </div>
                                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${sc2.pillClass} flex-shrink-0`}>
                                        {sc2.label}
                                      </span>
                                    </motion.div>
                                  );
                                })}
                              </div>

                              <div className="px-5 py-3 border-t border-violet-100 dark:border-violet-900/30 flex items-center justify-between gap-2">
                                <AddSubtaskInline mainTaskId={mt.id} users={[]} onAdd={sub => addSubtask(sub)} isPersonal />
                                <DeleteTaskButton onConfirm={() => deleteMainTask(mt.id)} />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />

      {showCreate && (
        <CreateTaskDialog
          onClose={() => setShowCreate(false)}
          onSubmit={createMainTask}
          users={[]}
          currentUserId={currentUser?.id ?? ""}
          teamId={workspace?.id ?? ""}
          workspaceId={workspace?.id ?? ""}
          isPersonal
        />
      )}

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          users={[]}
          onClose={() => setEditingTask(null)}
          onSave={(patch) => { updateMainTask(editingTask.id, patch); setEditingTask(null); }}
        />
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ADMIN VIEW
═══════════════════════════════════════════════════════════════════════════════ */
function AdminTasksView() {
  const { mainTasks, subtasks, users, comments, createMainTask, addSubtask, assignSubtask,
    updateSubtask, deleteSubtask, updateSubtaskStatus, deleteMainTask, updateMainTask,
    postComment, getMainTaskComments, projects, createProject, reminders } = useAppData();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<MainTask | null>(null);
  const [chatTaskId, setChatTaskId] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<SubTask | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [assignDialog, setAssignDialog] = useState<{ subtaskId: string; current: string | null } | null>(null);
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  
  const [scope, setScopeState] = useState<'all' | 'mine' | 'pending_review' | 'projects'>(() => (localStorage.getItem('tf_default_scope') as any) || 'all');
  const [viewMode, setViewModeState] = useState<TaskViewMode>(() => (localStorage.getItem('tf_default_view') as TaskViewMode) || loadDefaultView());

  const setScope = (s: any) => {
    setScopeState(s);
    localStorage.setItem('tf_default_scope', s);
  };

  const setViewMode = (v: TaskViewMode) => {
    setViewModeState(v);
    localStorage.setItem('tf_default_view', v);
  };

  const [sortBy, setSortBy] = useState<SortOption>(loadDefaultSort());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showCreateProject, setShowCreateProject] = useState(false);

  const handleSetDefault = () => localStorage.setItem('tf_default_sort', sortBy);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && subtasks.length > 0) {
      setOpenSubtaskId(openId);
      const parentSub = subtasks.find(s => s.id === openId);
      if (parentSub) {
        setExpanded(prev => new Set([...prev, parentSub.mainTaskId]));
        setTimeout(() => document.getElementById(`subtask-row-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
    const openTaskId = searchParams.get("openTask");
    if (openTaskId) {
      setExpanded(prev => new Set([...prev, openTaskId]));
      setTimeout(() => document.getElementById(`task-row-${openTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
    
    // Clear 'open' and 'openTask' params
    if (openId || openTaskId) {
       setSearchParams(prev => {
         const next = new URLSearchParams(prev);
         next.delete("open");
         next.delete("openTask");
         return next;
       }, { replace: true });
    }
  }, [searchParams, setSearchParams, subtasks]);

  const { wsTasks: teamTasks, wsMembers, workspace: teamWs } = useWorkspace();
  const activeUsers = wsMembers;
  const teamSubtaskIds = new Set(teamTasks.map(mt => mt.id));
  const teamSubtasks = subtasks.filter(s => teamSubtaskIds.has(s.mainTaskId));
  const mySubs = teamSubtasks.filter(s => s.assignedTo === currentUser?.id);
  const pendingApprovalSubs = teamSubtasks.filter(s => s.status === 'pending_approval');

  const filtered = teamTasks.filter(mt => {
    const tMatch = mt.title?.toLowerCase().includes(search.toLowerCase());
    const dMatch = mt.description?.toLowerCase().includes(search.toLowerCase());
    return tMatch || dMatch;
  });

  const toggle = (id: string) =>
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const STATUS_TABS = [
    { label: "All", value: "all" },
    { label: "Not Started", value: "not_started" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
  ] as const;
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const tabFiltered = filtered.filter(mt => {
    if (statusFilter === "all") return true;
    return deriveMainTaskStatus(mt.id, teamSubtasks) === statusFilter;
  }).filter(mt => {
    if (priorityFilter === 'all') return true;
    return mt.priority === priorityFilter;
  });

  // My Tasks sub-view
  const [myStatusFilter, setMyStatusFilter] = useState<SubTaskStatus | "all">("all");
  const [mySearch, setMySearch] = useState("");
  const MY_STATUS_TABS: { label: string; value: SubTaskStatus | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Not Started", value: "not_started" },
    { label: "In Progress", value: "in_progress" },
    { label: "Pending Approval", value: "pending_approval" },
    { label: "Completed", value: "completed" },
  ];
  const filteredMySubs = applySortToSubs(mySubs.filter(s => {
    if (mySearch && !s.title.toLowerCase().includes(mySearch.toLowerCase())) return false;
    if (myStatusFilter !== "all" && s.status !== myStatusFilter) return false;
    return true;
  }), sortBy) as SubTask[];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-0">

      {/* ── Toolbar — Primary Row ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-3 mb-3 flex-wrap">
        {/* View toggle */}
        <ViewToggle value={viewMode} onChange={setViewMode} />

        {/* Thin divider */}
        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Scope toggle */}
        <ScopePicker
          scope={scope}
          setScope={setScope}
          myCount={mySubs.length}
          pendingCount={pendingApprovalSubs.length}
        />

        <div className="flex-1" />

        {/* Sort */}
        <div className="relative">
          <button onClick={() => setShowSortMenu(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/40 hover:border-border">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-lg py-1 w-52">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${sortBy === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                  {opt.label}
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-4 py-2">
                <button onClick={() => { handleSetDefault(); setShowSortMenu(false); }}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  Set as default sort
                </button>
              </div>
            </div>
          )}
        </div>

        {scope === 'projects' ? (
          <button onClick={() => setShowCreateProject(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md">
            <FolderOpen className="w-4 h-4" /><span className="hidden sm:inline">New Project</span>
          </button>
        ) : (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Task</span>
          </button>
        )}
      </motion.div>

      {/* ── Priority Filter Row (conditional) ── */}
      {scope === 'all' && (viewMode === 'list' || viewMode === 'compact') && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">Priority</span>
            {(['all', ...PRIORITY_ORDER] as PriorityFilter[]).map(p => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${priorityFilter === p
                  ? p === 'all' ? 'bg-foreground text-background border-foreground' : PRIORITY_CONFIG[p as TaskPriority].className
                  : 'border-border bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}>
                {p === 'all' ? 'All' : PRIORITY_CONFIG[p as TaskPriority].label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text"
            placeholder={scope === 'mine' ? "Search my tasks…" : "Search tasks…"}
            value={scope === 'mine' ? mySearch : search}
            onChange={e => scope === 'mine' ? setMySearch(e.target.value) : setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted text-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all border border-border focus:border-primary/30" />
          {(scope === 'mine' ? mySearch : search) && (
            <button onClick={() => scope === 'mine' ? setMySearch("") : setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>

      {/* ── BOARD VIEW ── */}
      {viewMode === 'board' && scope === 'all' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <MainTaskKanbanView
            mainTasks={tabFiltered}
            allSubtasks={teamSubtasks}
            users={activeUsers}
            onClickTask={id => { toggle(id); setViewMode('list'); }}
            reminders={reminders.filter(r => r.isActive && (r.createdBy === currentUser?.id || r.recipientIds?.includes(currentUser?.id ?? '')))}
          />
        </motion.div>
      )}
      {viewMode === 'board' && scope === 'mine' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <SubtaskKanbanView
            subtasks={filteredMySubs as SubTask[]}
            mainTasks={mainTasks}
            users={activeUsers}
            onClickSubtask={id => setOpenSubtaskId(id)}
            reminders={reminders.filter(r => r.isActive && (r.createdBy === currentUser?.id || r.recipientIds?.includes(currentUser?.id ?? '')))}
          />
        </motion.div>
      )}

      {/* ── FOCUS VIEW ── */}
      {viewMode === 'focus' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <TaskFocusView
            subtasks={scope === 'mine' ? mySubs : teamSubtasks}
            mainTasks={mainTasks}
            users={activeUsers}
            onClickSubtask={id => setOpenSubtaskId(id)}
          />
        </motion.div>
      )}

      {/* ── COMPACT VIEW ── */}
      {viewMode === 'compact' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {(() => {
            const compactPool = scope === 'mine' ? filteredMySubs : scope === 'pending_review' ? pendingApprovalSubs : (() => {
              const allSubs = tabFiltered.flatMap(mt => teamSubtasks.filter(s => s.mainTaskId === mt.id));
              return applySortToSubs(allSubs, sortBy);
            })();
            if (compactPool.length === 0) return (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No tasks to show.</p>
              </div>
            );
            return (
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {/* Compact header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Task</span>
                  <span className="w-20 text-center hidden sm:block">Assigned by</span>
                  <span className="w-16 text-center hidden sm:block">Due</span>
                  <span className="w-20 text-center">Status</span>
                </div>
                {compactPool.map((sub, i) => {
                  const sc = statusConfig[sub.status];
                  const mt = mainTasks.find(m => m.id === sub.mainTaskId);
                  const creator = mt ? users.find(u => u.id === mt.createdBy) : null;
                  const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';
                  return (
                    <motion.div key={sub.id ?? i}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      onClick={() => setOpenSubtaskId(sub.id ?? null)}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                        <span className={`text-sm truncate ${sub.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {sub.title}
                        </span>
                      </div>
                      <div className="w-20 flex justify-center hidden sm:flex">
                        {creator ? (
                          <div className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-full ${creator.avatarColor} flex items-center justify-center text-white text-[7px] font-bold`}>
                              {creator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate max-w-[48px]">{creator.name.split(' ')[0]}</span>
                          </div>
                        ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
                      </div>
                      <div className="w-16 text-center hidden sm:block">
                        {sub.deadline ? (
                          <span className={`text-[11px] ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                            {formatDueDate(sub.deadline)}
                          </span>
                        ) : <span className="text-[10px] text-muted-foreground/40">—</span>}
                      </div>
                      <div className="w-20 flex justify-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.pillClass}`}>
                          {sc.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* ── PROJECTS VIEW ── */}
      {scope === 'projects' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {(() => {
            const wsProjects = projects.filter(p => p.workspaceId === teamWs?.id);
            if (wsProjects.length === 0) return (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create a project from a preset template to get started.</p>
              </div>
            );
            return (
              <div className="space-y-3">
                {wsProjects.map(proj => {
                  const mt = mainTasks.find(m => m.id === proj.mainTaskId);
                  const projSubs = mt ? subtasks.filter(s => s.mainTaskId === mt.id) : [];
                  const completed = projSubs.filter(s => s.status === 'completed').length;
                  const total = projSubs.length;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const endDate = addDays(new Date(proj.startDate), proj.durationDays);
                  const isOverdue = isPast(endDate) && pct < 100;
                  return (
                    <div key={proj.id}
                      onClick={() => { if (mt) { setScope('all'); setExpanded(prev => new Set([...prev, mt.id])); } }}
                      className="bg-card border border-border rounded-xl p-4 hover:bg-muted/30 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-foreground truncate">{proj.name}</h4>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">{proj.serviceType}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{(() => { try { return format(new Date(proj.startDate), 'MMM d'); } catch { return ''; } })()} → {(() => { try { return format(endDate, 'MMM d'); } catch { return ''; } })()}</span>
                            <span>{proj.durationDays}d</span>
                            <span>{completed}/{total} done</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOverdue && <span className="text-[10px] font-bold text-destructive">Overdue</span>}
                          <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center">
                            <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : 'text-foreground'}`}>{pct}%</span>
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </motion.div>
      )}




      {viewMode === 'list' && scope === 'mine' && (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1 mb-4 border-b border-border pb-0 overflow-x-auto">
            {MY_STATUS_TABS.map(tab => {
              const isActive = myStatusFilter === tab.value;
              const count = tab.value === "all" ? mySubs.length : mySubs.filter(s => s.status === tab.value).length;
              if (tab.value !== 'all' && count === 0) return null;
              return (
                <button key={tab.value} onClick={() => setMyStatusFilter(tab.value)}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap
                    ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full
                      ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{count}</span>
                  )}
                  {isActive && <motion.div layoutId="admin-my-status-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              );
            })}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {filteredMySubs.length === 0 ? (
              <div className="text-center py-24 bg-card border border-border rounded-xl">
                <p className="text-4xl mb-3">🎉</p>
                <p className="text-base font-medium text-foreground">{mySubs.length === 0 ? 'No tasks assigned to you yet' : 'No tasks match this filter'}</p>
                <p className="text-sm text-muted-foreground mt-1">Tasks assigned to you will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMySubs.map((sub, i) => {
                  const sc = statusConfig[sub.status];
                  const mt = mainTasks.find(m => m.id === sub.mainTaskId);
                  const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== "completed";
                  return (
                    <motion.div key={sub.id ?? i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25 }}
                      onClick={() => setOpenSubtaskId(sub.id ?? null)}
                      className={`flex items-center gap-3 px-4 py-3.5 bg-card border rounded-xl hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group ${(sub as SubTask).priority ? `border-l-4 ${PRIORITY_CONFIG[(sub as SubTask).priority!].border}` : ''}`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium group-hover:text-primary transition-colors truncate ${sub.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {sub.title}
                        </p>
                        {mt && <p className="text-xs text-muted-foreground truncate mt-0.5">{mt.title}</p>}
                      </div>
                      {(sub as SubTask).priority && <PriorityBadge priority={(sub as SubTask).priority} size="xs" />}
                      {sub.deadline && (
                        <span className={`text-[11px] flex items-center gap-1 flex-shrink-0 hidden md:flex ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />{formatDueDate(sub.deadline)}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full w-max flex-shrink-0 ${sc.pillClass}`}>
                        {sc.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ── LIST VIEW: PENDING REVIEW ── */}
      {viewMode === 'list' && scope === 'pending_review' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {pendingApprovalSubs.length === 0 ? (
            <div className="text-center py-24 bg-card border border-border rounded-xl">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-base font-medium text-foreground">All clear — nothing pending review</p>
              <p className="text-sm text-muted-foreground mt-1">When team members submit work for approval, it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...pendingApprovalSubs].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()).map((sub, i) => {
                const submitter = users.find(u => u.id === sub.assignedTo);
                const parentTask = mainTasks.find(mt => mt.id === sub.mainTaskId);
                const isOverdue = sub.deadline && isPast(new Date(sub.deadline));
                return (
                  <motion.div key={sub.id ?? i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    onClick={() => setOpenSubtaskId(sub.id ?? null)}
                    className="flex items-center gap-3 px-4 py-3.5 bg-card border border-amber-200 dark:border-amber-800/30 rounded-xl hover:shadow-sm transition-all cursor-pointer group border-l-4 border-l-amber-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{sub.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {parentTask && <span className="text-xs text-muted-foreground truncate">{parentTask.title}</span>}
                        {sub.deadline && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            <Clock className="w-2.5 h-2.5" />{formatDueDate(sub.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    {submitter && (
                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                        <div className={`w-5 h-5 rounded-full ${submitter.avatarColor} flex items-center justify-center text-white text-[8px] font-bold`}>
                          {submitter.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-xs text-muted-foreground">{submitter.name.split(' ')[0]}</span>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setOpenSubtaskId(sub.id ?? null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-semibold transition-colors shadow-sm whitespace-nowrap flex-shrink-0">
                      Review →
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── LIST VIEW: ALL TASKS ── */}
      {viewMode === 'list' && scope === 'all' && (<>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1 mb-4 border-b border-border pb-0">
          {STATUS_TABS.map(tab => {
            const isActive = statusFilter === tab.value;
            const count = tab.value === "all" ? teamTasks.length
              : teamTasks.filter(mt => deriveMainTaskStatus(mt.id, teamSubtasks) === tab.value).length;
            return (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-t-md
                  ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full
                    ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{count}</span>
                )}
                {isActive && (
                  <motion.div layoutId="status-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {tabFiltered.length === 0 ? (
            <div className="text-center py-24 bg-card border border-border rounded-xl">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-base font-medium text-foreground">No tasks found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new task.</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                + New Task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tabFiltered.map(mt => {
                const isExpanded = expanded.has(mt.id);
                const subs = teamSubtasks.filter(s => s.mainTaskId === mt.id);
                const progress = getMainTaskProgress(mt.id, teamSubtasks);
                const status = deriveMainTaskStatus(mt.id, teamSubtasks);
                const sc = mainStatusConfig[status];
                const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

                return (
                  <div key={mt.id} id={`task-row-${mt.id}`}
                    className={`bg-card border border-border rounded-xl overflow-hidden transition-colors border-l-4 ${mt.priority ? PRIORITY_CONFIG[mt.priority].border : 'border-l-transparent'
                      } hover:shadow-sm`}>
                    {/* Main task header */}
                    <div role="button" tabIndex={0}
                      onClick={() => toggle(mt.id)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle(mt.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-colors text-left cursor-pointer">
                      <div className="text-muted-foreground flex-shrink-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-foreground font-medium truncate">{mt.title}</p>
                          {mt.priority && <PriorityBadge priority={mt.priority} size="xs" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{progress.completed}/{progress.total} subtasks</span>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div className={`h-full rounded-full ${status === "completed" ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-medium hidden sm:inline">{pct}%</span>
                          {(() => {
                            const assignee = mt.assignedTo ? users.find(u => u.id === mt.assignedTo) : null;
                            return assignee ? (
                              <span className="flex items-center gap-1 ml-1">
                                <span className="text-border">·</span>
                                <div className={`w-3.5 h-3.5 rounded-full ${assignee.avatarColor} flex items-center justify-center text-white text-[7px] font-bold`}>
                                  {assignee.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </div>
                                <span>{assignee.name.split(" ")[0]}</span>
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      {mt.deadline && (
                        <span className={`hidden sm:flex items-center gap-1 text-xs flex-shrink-0 ${isPast(new Date(mt.deadline)) && status !== "completed" ? "text-red-500" : "text-muted-foreground"}`}>
                          <Calendar className="w-3 h-3" />{format(new Date(mt.deadline), "MMM d")}
                        </span>
                      )}
                      <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                        <PriorityPicker value={mt.priority} onChange={p => updateMainTask(mt.id, { priority: p })} />
                      </div>
                      {currentUser?.id === mt.createdBy && (
                        <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                          <button
                            onClick={() => setEditingTask(mt)}
                            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"
                            title="Edit task">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-max flex-shrink-0 ${sc.pillClass}`}>
                        {sc.label}
                      </span>
                    </div>

                    {/* Subtask rows */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="border-t border-border">
                            {subs.length === 0 && (
                              <p className="px-5 py-4 text-xs text-muted-foreground italic">No subtasks yet.</p>
                            )}

                            <div className="divide-y divide-border/50">
                              {subs.map((sub, i) => {
                                const sc2 = statusConfig[sub.status];
                                const assignee = users.find(u => u.id === sub.assignedTo);
                                const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== "completed";
                                return (
                                  <motion.div key={sub.id} id={`subtask-row-${sub.id}`}
                                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.03, duration: 0.25 }}
                                    onClick={() => setOpenSubtaskId(sub.id)}
                                    className="flex items-center gap-3 px-5 py-3 hover:bg-primary/5 transition-colors cursor-pointer group">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc2.dot}`} />
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-sm font-medium truncate ${sub.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                        {sub.title}
                                      </p>
                                      {sub.description && <p className="text-xs text-muted-foreground truncate">{sub.description}</p>}
                                    </div>
                                    {/* Assignee */}
                                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                                      {assignee ? (
                                        <>
                                          <div className={`w-5 h-5 rounded-full ${assignee.avatarColor} flex items-center justify-center text-white text-[9px] font-bold`}>
                                            {assignee.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                          </div>
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">{assignee.name.split(" ")[0]}</span>
                                        </>
                                      ) : (
                                        <button onClick={(e) => { e.stopPropagation(); setAssignDialog({ subtaskId: sub.id, current: null }); }}
                                          className="text-xs text-muted-foreground italic hover:text-primary transition-colors flex items-center gap-1">
                                          <UserCheck className="w-3 h-3" />Assign
                                        </button>
                                      )}
                                    </div>
                                    {sub.priority && <PriorityBadge priority={sub.priority} size="xs" />}
                                    {sub.deadline && (
                                      <span className={`text-[11px] flex items-center gap-1 flex-shrink-0 hidden md:flex ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                                        <Clock className="w-3 h-3" />{formatDueDate(sub.deadline)}
                                      </span>
                                    )}
                                    <div onClick={e => e.stopPropagation()} className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        onClick={() => setEditingSubtask(sub)}
                                        className="p-1 rounded-lg text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-all"
                                        title="Edit subtask">
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <DeleteSubtaskButton
                                        hasActivity={comments.some(c => c.subtaskId === sub.id) || sub.status !== 'not_started'}
                                        onConfirm={() => deleteSubtask(sub.id)}
                                      />
                                    </div>
                                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${sc2.pillClass}`}>
                                      {sc2.label}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>

                            <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
                              <AddSubtaskInline mainTaskId={mt.id} users={activeUsers} onAdd={sub => addSubtask(sub)} />
                              <div className="flex items-center gap-2">
                                <button onClick={() => setChatTaskId(mt.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                  <MessageSquare className="w-3 h-3" /> Chat
                                </button>
                                <DeleteTaskButton onConfirm={() => deleteMainTask(mt.id)} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </>)}

      {/* ── BOARD VIEW: PENDING REVIEW (same as list) ── */}
      {viewMode === 'board' && scope === 'pending_review' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <SubtaskKanbanView
            subtasks={pendingApprovalSubs}
            mainTasks={mainTasks}
            users={activeUsers}
            onClickSubtask={id => setOpenSubtaskId(id)}
          />
        </motion.div>
      )}

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />

      {showCreate && (
        <CreateTaskDialog
          onClose={() => setShowCreate(false)}
          onSubmit={createMainTask}
          users={activeUsers}
          currentUserId={currentUser?.id ?? ""}
          teamId={teamWs?.id ?? ""}
          workspaceId={teamWs?.id ?? ""}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          users={activeUsers}
          onClose={() => setEditingTask(null)}
          onSave={(patch) => { updateMainTask(editingTask.id, patch); setEditingTask(null); }}
        />
      )}

      {chatTaskId && (
        <MainTaskChatSheet
          mainTaskId={chatTaskId}
          users={users}
          currentUserId={currentUser?.id ?? ""}
          getComments={getMainTaskComments}
          onPost={(text) => postComment(chatTaskId, chatTaskId, currentUser?.id ?? "", text)}
          onClose={() => setChatTaskId(null)}
        />
      )}

      {showCreateProject && (
        <CreateProjectDialog
          onClose={() => setShowCreateProject(false)}
          onSubmit={(payload) => createProject(payload)}
          users={activeUsers}
          currentUserId={currentUser?.id ?? ""}
          teamId={teamWs?.id ?? ""}
          workspaceId={teamWs?.id ?? ""}
        />
      )}

      {editingSubtask && (
        <EditSubtaskDialog
          subtask={editingSubtask}
          users={activeUsers}
          onClose={() => setEditingSubtask(null)}
          onSave={(patch) => { updateSubtask(editingSubtask.id, patch); setEditingSubtask(null); }}
        />
      )}

      {assignDialog && (
        <AssignUserDialog
          subtaskId={assignDialog.subtaskId}
          currentAssignee={assignDialog.current}
          users={activeUsers}
          onAssign={uid => { assignSubtask(assignDialog.subtaskId, uid); setAssignDialog(null); }}
          onClose={() => setAssignDialog(null)}
        />
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   USER VIEW
═══════════════════════════════════════════════════════════════════════════════ */
function UserTasksView() {
  const { user: currentUser } = useAuth();
  const { subtasks, mainTasks, users, createMainTask, updateSubtaskStatus } = useAppData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubTaskStatus | "all">("all");
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(loadDefaultSort());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<TaskViewMode>(loadDefaultView());
  const handleSetDefault = () => localStorage.setItem('tf_default_sort', sortBy);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      setOpenSubtaskId(openId);
      navigate("/tasks", { replace: true });
    }
    const openTaskId = searchParams.get("openTask");
    if (openTaskId) {
      navigate("/tasks", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { localStorage.setItem('tf_default_view', viewMode); }, [viewMode]);

  const { wsTasks: teamTasks, wsMembers, workspace: teamWs } = useWorkspace();
  const activeUsers = wsMembers;
  const teamSubtaskIds = new Set(teamTasks.map(mt => mt.id));
  const teamSubtasks = subtasks.filter(s => teamSubtaskIds.has(s.mainTaskId));
  const allSubs = teamSubtasks;
  const mySubs = teamSubtasks.filter(s => s.assignedTo === currentUser?.id);

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const pool = scope === 'mine' ? mySubs : allSubs;

  const filtered = applySortToSubs(pool.filter(s => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  }), sortBy) as SubTask[];

  const STATUS_TABS: { label: string; value: SubTaskStatus | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Not Started", value: "not_started" },
    { label: "In Progress", value: "in_progress" },
    { label: "Pending Approval", value: "pending_approval" },
    { label: "Completed", value: "completed" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-0">

      {/* Toolbar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-2 mb-3 flex-wrap">
        <ViewToggle value={viewMode} onChange={setViewMode} />

        <div className="flex items-center bg-muted rounded-full p-0.5">
          <button onClick={() => setScope('mine')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${scope === 'mine' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Mine {mySubs.length > 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded-full">{mySubs.length}</span>}
          </button>
          <button onClick={() => setScope('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${scope === 'all' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            All
          </button>
        </div>

        <div className="relative">
          <button onClick={() => setShowSortMenu(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-lg py-1 w-52">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${sortBy === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                  {opt.label}
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-4 py-2">
                <button onClick={() => { handleSetDefault(); setShowSortMenu(false); }}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  Set as default sort
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground hidden sm:block">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Task</span>
        </button>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-muted text-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all border border-border focus:border-primary/30" />
          {search && <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </motion.div>

      {/* ── BOARD VIEW ── */}
      {viewMode === 'board' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <SubtaskKanbanView
            subtasks={filtered as SubTask[]}
            mainTasks={mainTasks}
            users={activeUsers}
            onClickSubtask={id => setOpenSubtaskId(id)}
          />
        </motion.div>
      )}

      {/* ── FOCUS VIEW ── */}
      {viewMode === 'focus' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <TaskFocusView
            subtasks={pool}
            mainTasks={mainTasks}
            users={activeUsers}
            onClickSubtask={id => setOpenSubtaskId(id)}
          />
        </motion.div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1 mb-4 border-b border-border pb-0 overflow-x-auto">
            {STATUS_TABS.map(tab => {
              const isActive = statusFilter === tab.value;
              const count = tab.value === "all" ? pool.length : pool.filter(s => s.status === tab.value).length;
              if (tab.value !== 'all' && count === 0) return null;
              return (
                <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap
                    ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full
                      ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{count}</span>
                  )}
                  {isActive && <motion.div layoutId="user-status-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              );
            })}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {filtered.length === 0 ? (
              <div className="text-center py-24 bg-card border border-border rounded-xl">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-base font-medium text-foreground">No tasks found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((sub, i) => {
                  const sc = statusConfig[sub.status];
                  const mt = mainTasks.find(m => m.id === sub.mainTaskId);
                  const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== "completed";
                  return (
                    <motion.div key={sub.id ?? i}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25 }}
                      onClick={() => setOpenSubtaskId(sub.id ?? null)}
                      className={`flex items-center gap-3 px-4 py-3.5 bg-card border rounded-xl hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer group ${(sub as SubTask).priority ? `border-l-4 ${PRIORITY_CONFIG[(sub as SubTask).priority!].border}` : ''}`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium group-hover:text-primary transition-colors truncate ${sub.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {sub.title}
                        </p>
                        {mt && <p className="text-xs text-muted-foreground truncate mt-0.5">{mt.title}</p>}
                      </div>
                      {(sub as SubTask).priority && <PriorityBadge priority={(sub as SubTask).priority} size="xs" />}
                      {sub.deadline && (
                        <span className={`text-[11px] flex items-center gap-1 flex-shrink-0 hidden md:flex ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />{formatDueDate(sub.deadline)}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full w-max flex-shrink-0 ${sc.pillClass}`}>
                        {sc.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}

      <TaskDetailSheet subtaskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} />

      {showCreate && (
        <CreateTaskDialog
          onClose={() => setShowCreate(false)}
          onSubmit={createMainTask}
          users={activeUsers}
          currentUserId={currentUser?.id ?? ""}
          teamId={teamWs?.id ?? ""}
          workspaceId={teamWs?.id ?? ""}
        />
      )}
    </motion.div>
  );
}

/* ─── Inline add subtask ───────────────────────────────────────────────────── */
function AddSubtaskInline({ mainTaskId, users, onAdd, isPersonal }: {
  mainTaskId: string;
  users: AppUser[];
  isPersonal?: boolean;
  onAdd: (s: Omit<SubTask, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");
  const { user: currentUser } = useAuth();
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);

  const handleAdd = () => {
    if (!title.trim()) return;
    const assignee = isPersonal ? (currentUser?.id ?? null) : (assignedTo || null);
    onAdd({ mainTaskId, title: title.trim(), description: desc.trim(), assignedTo: assignee, status: "not_started", deadline: deadline || undefined, priority });
    setTitle(""); setDesc(""); setAssignedTo(""); setDeadline(""); setPriority(undefined); setOpen(false);
  };

  const accentColor = isPersonal ? 'text-violet-600 hover:text-violet-700' : 'text-primary hover:text-primary/80';
  const accentRing = isPersonal ? 'focus:ring-violet-200 border-violet-200/60 dark:border-violet-800/40' : 'focus:ring-primary/20 border-primary/20';

  if (!open) return (
    <button onClick={() => setOpen(true)} className={`flex items-center gap-1.5 text-xs font-semibold ${accentColor} transition-colors`}>
      <Plus className="w-4 h-4" /> Add Subtask
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className={`space-y-3 rounded-xl p-4 border flex-1 shadow-sm w-full ${isPersonal ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40' : 'bg-primary/5 border-primary/20'}`}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Subtask title *"
        className={`w-full px-3 py-2 rounded-lg border text-sm bg-card text-foreground focus:outline-none focus:ring-2 ${accentRing}`} />
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20" />
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${!isPersonal ? 'md:grid-cols-3' : ''} gap-3`}>
        {!isPersonal && (
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20" />
        <select value={priority ?? ''} onChange={e => setPriority(e.target.value ? e.target.value as TaskPriority : undefined)}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Priority…</option>
          {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleAdd}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-colors shadow-sm ${isPersonal ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>Add Subtask</button>
      </div>
    </motion.div>
  );
}

/* ─── Create Main Task dialog ────────────────────────────────────────────────── */
function CreateTaskDialog({ onClose, onSubmit, users, currentUserId, teamId, workspaceId, isPersonal }: {
  onClose: () => void;
  onSubmit: (task: Omit<MainTask, "id" | "createdAt" | "updatedAt">, subs: Omit<SubTask, "id" | "mainTaskId" | "createdAt" | "updatedAt">[]) => void;
  users: AppUser[];
  currentUserId: string;
  teamId: string;
  workspaceId?: string;
  isPersonal?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [showSubs, setShowSubs] = useState(true);
  const [subtasks, setSubs] = useState<{ title: string; assignedTo: string; deadline: string; deadlineTime: string; priority: TaskPriority | undefined }[]>([]);

  const addRow = () => setSubs(p => [...p, { title: "", assignedTo: "", deadline: "", deadlineTime: "", priority: undefined }]);
  const removeRow = (i: number) => setSubs(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, k: string, v: string) =>
    setSubs(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const toggleSubs = () => {
    setShowSubs(s => {
      if (!s && subtasks.length === 0) addRow();
      return !s;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const validSubs = subtasks.filter(s => s.title.trim());
    const combinedDeadline = deadline
      ? deadlineTime ? `${deadline}T${deadlineTime}` : deadline
      : undefined;
    onSubmit(
      { title: title.trim(), description: description.trim(), createdBy: currentUserId, teamId, workspaceId: workspaceId ?? teamId, assignedTo: assignedTo || undefined, deadline: combinedDeadline, priority },
      validSubs.map(s => ({
        title: s.title.trim(),
        description: "",
        assignedTo: s.assignedTo || null,
        status: "not_started" as SubTaskStatus,
        deadline: s.deadline ? (s.deadlineTime ? `${s.deadline}T${s.deadlineTime}` : s.deadline) : undefined,
        priority: s.priority,
      }))
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Task</h2>
              <p className="text-[11px] text-muted-foreground">Create a new task and assign subtasks</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">
              Task Title <span className="text-red-400">*</span>
            </label>
            <input required autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Review Q2 Report"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Description</label>
            <textarea rows={2} value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Optional notes…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all shadow-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Assigned To</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Due Date</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Time <span className="normal-case font-normal text-muted-foreground/60">(opt.)</span></label>
              <input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)}
                disabled={!deadline}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Priority</label>
            <div className="flex items-center gap-2 flex-wrap bg-muted/30 p-1.5 rounded-xl border border-border/50">
              <button type="button" onClick={() => setPriority(undefined)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${!priority ? 'bg-background text-foreground border border-border ring-1 ring-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>None</button>
              {PRIORITY_ORDER.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm border ${priority === p ? `${PRIORITY_CONFIG[p].className} ring-1 ring-primary/20` : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <button type="button" onClick={toggleSubs}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-primary" />Subtasks
                {subtasks.length > 0 && <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">{subtasks.length}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{showSubs ? "Hide" : "Optional"}</span>
            </button>

            <AnimatePresence>
              {showSubs && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-4 pb-4 pt-3 space-y-3">
                    {subtasks.map((sub, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground w-4 flex-shrink-0 text-right">{i + 1}.</span>
                          <input required value={sub.title} onChange={e => updateRow(i, "title", e.target.value)}
                            placeholder="Subtask title"
                            className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                          <button type="button" onClick={() => removeRow(i)}
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 ml-6 flex-wrap">
                          <select value={sub.assignedTo} onChange={e => updateRow(i, "assignedTo", e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 max-w-[120px] shadow-sm cursor-pointer">
                            <option value="">Assign…</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                          </select>
                          <input type="date" value={sub.deadline} onChange={e => updateRow(i, "deadline", e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 w-[120px] shadow-sm" />
                          <input type="time" value={sub.deadlineTime ?? ''} onChange={e => updateRow(i, "deadlineTime", e.target.value)}
                            disabled={!sub.deadline} title="Deadline time (optional)"
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 w-[100px] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm" />
                          <select value={sub.priority ?? ''} onChange={e => updateRow(i, "priority", e.target.value || undefined as any)}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 max-w-[100px] shadow-sm cursor-pointer">
                            <option value="">Priority…</option>
                            {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addRow}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/90 font-medium transition-colors">
                      <Plus className="w-3 h-3" /> Add another subtask
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Create Task
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Assign user dialog ───────────────────────────────────────────────────── */
function AssignUserDialog({ subtaskId, currentAssignee, users, onAssign, onClose }: {
  subtaskId: string; currentAssignee: string | null; users: AppUser[];
  onAssign: (uid: string | null) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Assign Subtask</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-4 space-y-2">
          <button onClick={() => onAssign(null)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors ${!currentAssignee ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground italic">Unassign</span>
          </button>
          {users.map(u => (
            <button key={u.id} onClick={() => onAssign(u.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors ${currentAssignee === u.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}>
              <div className={`w-8 h-8 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                {u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-foreground">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              {currentAssignee === u.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Edit Task Dialog ──────────────────────────────────────────────────────── */
function EditTaskDialog({ task, users, onClose, onSave }: {
  task: MainTask;
  users: AppUser[];
  onClose: () => void;
  onSave: (patch: Partial<MainTask>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDesc] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assignedTo ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [priority, setPriority] = useState<TaskPriority | undefined>(task.priority);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), assignedTo: assignedTo || undefined, deadline: deadline || undefined, priority });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pencil className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit Task</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{task.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Task Title <span className="text-red-400">*</span></label>
            <input required autoFocus value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Description</label>
            <textarea rows={2} value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Optional notes…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all shadow-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Assigned To</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Priority</label>
            <div className="grid grid-cols-5 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
              <button type="button" onClick={() => setPriority(undefined)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all ${!priority
                  ? 'bg-foreground text-background border-foreground shadow-sm scale-105'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}>
                <span className="w-3 h-3 rounded-full border-2 border-current opacity-40" />None
              </button>
              {PRIORITY_ORDER.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all ${priority === p
                    ? PRIORITY_CONFIG[p].className + ' shadow-sm scale-105'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                    }`}>
                  <span className={`w-3 h-3 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Main Task Chat Sheet ──────────────────────────────────────────────────── */
function MainTaskChatSheet({ mainTaskId, users, currentUserId, getComments, onPost, onClose }: {
  mainTaskId: string;
  users: AppUser[];
  currentUserId: string;
  getComments: (id: string) => import('@/src/types/tasks').TaskComment[];
  onPost: (text: string) => void;
  onClose: () => void;
}) {
  const { mainTasks, subtasks } = useAppData();
  const task = mainTasks.find(t => t.id === mainTaskId);
  const taskSubtasks = subtasks.filter(s => s.mainTaskId === mainTaskId);

  const mainComments = getComments(mainTaskId);
  const allFeedEntries = [
    ...mainComments,
    ...taskSubtasks.flatMap(s => getComments(s.id).map(c => ({ ...c, _subId: s.id, _subTitle: s.title }))),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const [text, setText] = useState('');
  const [hashQuery, setHashQuery] = useState<string | null>(null);
  const [hashStart, setHashStart] = useState(0);
  const [hashIndex, setHashIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allFeedEntries.length]);

  const hashResults = hashQuery !== null
    ? taskSubtasks.filter(s => s.title.toLowerCase().includes(hashQuery.toLowerCase())).slice(0, 8)
    : [];

  const mentionResults = mentionQuery !== null
    ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || u.name.split(' ')[0].toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setText(val);
    const textBeforeCaret = val.slice(0, cursor);

    const atMatch = textBeforeCaret.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
      setHashQuery(null);
      return;
    } else {
      setMentionQuery(null);
    }

    const lastHash = val.lastIndexOf('#', cursor - 1);
    if (lastHash !== -1 && (lastHash === 0 || /\s/.test(val[lastHash - 1]))) {
      const fragment = val.slice(lastHash + 1, cursor);
      if (!fragment.includes(' ')) { setHashQuery(fragment); setHashStart(lastHash); setHashIndex(0); return; }
    }
    setHashQuery(null);
  };

  const handleHashSelect = (sub: SubTask) => {
    const before = text.slice(0, hashStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    setText(before + `#[${sub.title}]` + ' ' + after);
    setHashQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleMentionSelect = (user: AppUser) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    setText(before + `@${user.name.split(' ')[0]} ` + after);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const send = () => {
    const t = text.trim(); if (!t) return;
    onPost(t); setText(''); setHashQuery(null); setMentionQuery(null);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (hashQuery !== null && hashResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHashIndex(i => Math.min(i + 1, hashResults.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHashIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleHashSelect(hashResults[hashIndex]); return; }
      if (e.key === 'Escape') { setHashQuery(null); return; }
    }
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleMentionSelect(mentionResults[mentionIndex]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const renderText = (raw: string) => {
    const parts = raw.split(/(#\[[^\]]+\]|@\w+)/g);
    return parts.map((part, i) => {
      const subMatch = part.match(/^#\[(.+)\]$/);
      if (subMatch) return <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[12px] font-semibold bg-primary/15 text-primary" title={`Subtask: ${subMatch[1]}`}>#{subMatch[1]}</span>;
      const mentionMatch = part.match(/^@(\w+)$/);
      if (mentionMatch) return <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[12px] font-semibold bg-primary/15 text-primary">@{mentionMatch[1]}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  return createPortal(
    <>
      {/* ── Background Overlay ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[99] bg-black/5 backdrop-blur-[1px]"
      />

      {/* ── Chat Drawer ── */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-[100] w-full sm:w-[460px] bg-card border-l border-border shadow-2xl flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Task Updates Feed</h2>
              {task && <p className="text-[11px] text-muted-foreground truncate">{task.title}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">{allFeedEntries.length} update{allFeedEntries.length !== 1 ? 's' : ''}</span>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        </div>

        {/* ── Subtask pills ── */}
        {taskSubtasks.length > 0 && (
          <div className="px-4 py-2.5 border-b border-border/50 bg-muted/30 flex-shrink-0">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Subtasks</p>
            <div className="flex flex-wrap gap-1.5">
              {taskSubtasks.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-card border border-border text-muted-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.status === 'completed' ? 'bg-green-500' : s.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  {s.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Unified Feed ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {allFeedEntries.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No updates yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Post an update or type <span className="font-mono font-bold">#</span> to reference a subtask</p>
            </div>
          )}
          {allFeedEntries.map((c: any) => {
            const author = users.find(u => u.id === c.authorId);
            const isMe = c.authorId === currentUserId;
            const isMain = c.subtaskId === mainTaskId;
            const parentSub = !isMain ? taskSubtasks.find(s => s.id === c.subtaskId) : null;

            if (c.isEvent) {
              return (
                <div key={c.id} className="flex justify-center my-3 relative">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border/40 pointer-events-none" />
                  <span className="relative z-10 text-[10px] bg-card px-2 py-0.5 rounded-full text-muted-foreground/80 font-medium whitespace-nowrap border border-border/50">
                    <span className="text-foreground/70 font-semibold">{isMe ? 'You' : author?.name.split(' ')[0]}</span> {c.text.replace(/Subtask created:|Urgent info request:/, (match: string) => match.toLowerCase())}
                  </span>
                </div>
              );
            }

            return (
              <div key={c.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5 ${author?.avatarColor ?? 'bg-muted-foreground'}`}>
                  {author?.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'}
                </div>
                <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-foreground">{isMe ? 'You' : author?.name.split(' ')[0]}</span>
                    {isMain
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 uppercase tracking-wide">Main</span>
                      : parentSub && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 font-semibold">#{parentSub.title}</span>
                    }
                  </div>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                    <p className="whitespace-pre-wrap text-[13px]">{renderText(c.text)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 px-1">
                    {c.createdAt && !isNaN(new Date(c.createdAt).getTime()) 
                      ? format(new Date(c.createdAt), 'MMM d · h:mm a') 
                      : ''}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── # Picker ── */}
        {hashQuery !== null && hashResults.length > 0 && (
          <div className="mx-4 mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden flex-shrink-0">
            <div className="px-3 py-1.5 border-b border-border/50 bg-muted/50 flex items-center gap-1.5">
              <span className="text-primary font-bold font-mono">#</span>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Reference a Subtask</p>
            </div>
            {hashResults.map((sub, idx) => (
              <button key={sub.id} onClick={() => handleHashSelect(sub)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${idx === hashIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.status === 'completed' ? 'bg-green-500' : sub.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <span className="font-medium truncate">{sub.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0 capitalize">{sub.status.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── @ Picker ── */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="mx-4 mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden flex-shrink-0">
            <div className="px-3 py-1.5 border-b border-border/50 bg-muted/50 flex items-center gap-1.5">
              <span className="text-primary font-bold font-mono">@</span>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mention a teammate</p>
            </div>
            {mentionResults.map((u, idx) => (
              <button key={u.id} onClick={() => handleMentionSelect(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${idx === mentionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}>
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold ${u.avatarColor}`}>
                  {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <span className="font-medium text-sm">{u.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0 capitalize">{u.role}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Input ── */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card">
          <div className="flex items-end gap-2 bg-muted rounded-2xl px-4 py-3">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKey}
              placeholder="Post an update… @Name, #Subtask"
              rows={2}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-32"
            />
            <button onClick={send} disabled={!text.trim()}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">Shift+Enter for new line · <span className="font-mono font-semibold">@</span> mention · <span className="font-mono font-semibold">#</span> subtask</p>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

/* ─── Edit Subtask Dialog ───────────────────────────────────────────────────── */
function EditSubtaskDialog({ subtask, users, onClose, onSave }: {
  subtask: SubTask;
  users: AppUser[];
  onClose: () => void;
  onSave: (patch: Partial<SubTask>) => void;
}) {
  const [title, setTitle] = useState(subtask.title);
  const [description, setDesc] = useState(subtask.description ?? '');
  const [assignedTo, setAssignedTo] = useState(subtask.assignedTo ?? '');
  const [deadline, setDeadline] = useState(subtask.deadline ?? '');
  const [status, setStatus] = useState<SubTaskStatus>(subtask.status);
  const [priority, setPriority] = useState<TaskPriority | undefined>(subtask.priority);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), assignedTo: assignedTo || null, deadline: deadline || undefined, status, priority });
  };

  const statusOptions: { value: SubTaskStatus; label: string; cls: string }[] = [
    { value: 'not_started', label: 'Not Started', cls: 'chip-pending' },
    { value: 'in_progress', label: 'In Progress', cls: 'chip-in-progress' },
    { value: 'pending_approval', label: 'Pending Approval', cls: 'chip-pending-approval' },
    { value: 'completed', label: 'Completed', cls: 'chip-completed' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pencil className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit Subtask</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{subtask.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Title <span className="text-red-400">*</span></label>
            <input required autoFocus value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Description</label>
            <textarea rows={2} value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Optional notes…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all shadow-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Assigned To</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Priority</label>
            <div className="flex items-center gap-2 flex-wrap bg-muted/30 p-1.5 rounded-xl border border-border/50">
              <button type="button" onClick={() => setPriority(undefined)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${!priority ? 'bg-background text-foreground border border-border ring-1 ring-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>None</button>
              {PRIORITY_ORDER.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm border ${priority === p ? `${PRIORITY_CONFIG[p].className} ring-1 ring-primary/20` : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5'}`}>
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
              {statusOptions.map(opt => (
                <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all shadow-sm ${status === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5 bg-background'
                    }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

