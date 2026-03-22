import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Circle, Loader2, CheckCircle2, 
  Flag, Trash2, ChevronDown, 
  User, LayoutGrid, Clock, FolderOpen 
} from "lucide-react";
import { differenceInHours, format, isToday, isTomorrow } from "date-fns";
import type { TaskPriority, SubTaskStatus } from "@/src/types/tasks";

// ─── Shared config ──────────────────────────────────────────────────────────
export const statusConfig: Record<SubTaskStatus, { label: string; pillClass: string; dot: string; icon: React.ElementType }> = {
  not_started: { label: "Not Started", pillClass: "chip-pending", dot: "bg-gray-400", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress", dot: "bg-blue-600", icon: Loader2 },
  pending_approval: { label: "Pending Approval", pillClass: "chip-pending-approval", dot: "bg-amber-400", icon: Circle },
  completed: { label: "Completed", pillClass: "chip-completed", dot: "bg-green-600", icon: CheckCircle2 },
};

export const mainStatusConfig = {
  not_started: { label: "Not Started", pillClass: "chip-pending" },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress" },
  completed: { label: "Completed", pillClass: "chip-completed" },
};

export function formatDueDate(d?: string) {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  } catch { return ""; }
}

export type SortOption = 'date_asc' | 'date_desc' | 'urgency' | 'alpha';
export const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Most Urgent', value: 'urgency' },
  { label: 'Due Date (Earliest)', value: 'date_asc' },
  { label: 'Due Date (Latest)', value: 'date_desc' },
  { label: 'Alphabetical', value: 'alpha' },
];

// ─── Priority config ────────────────────────────────────────────────────────────
export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string; dot: string; border: string; bg: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400', border: 'border-l-slate-300', bg: '' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-400', border: 'border-l-amber-400', bg: 'bg-amber-50/30 dark:bg-amber-900/10' },
  high: { label: 'High', className: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-l-orange-500', bg: 'bg-orange-50/30 dark:bg-orange-900/10' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500', border: 'border-l-red-500', bg: 'bg-red-50/25 dark:bg-red-900/10' },
};
export const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

export function PriorityBadge({ priority, size = 'sm' }: { priority?: TaskPriority; size?: 'xs' | 'sm' }) {
  if (!priority) return null;
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.className} ${size === 'xs' ? 'text-[10px] px-1.5' : ''}`}>
      <Flag className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

export function PriorityPicker({ value, onChange }: { value?: TaskPriority; onChange: (p: TaskPriority | undefined) => void }) {
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all hover:shadow-sm ${value ? PRIORITY_CONFIG[value].className : 'border-border bg-muted text-muted-foreground hover:text-foreground'}`}
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
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-muted ${value === p ? 'font-semibold ' + PRIORITY_CONFIG[p].className : 'text-foreground'}`}>
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

// ─── Delete confirm inline ──────────────────────────────────────────────────────────
export function DeleteTaskButton({ onConfirm }: { onConfirm: () => void }) {
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

export function DeleteSubtaskButton({ hasActivity, onConfirm }: { hasActivity: boolean; onConfirm: () => void }) {
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

export function urgencyScore(sub: { deadline?: string; status: string }) {
  if (sub.status === "completed") return 99999;
  if (!sub.deadline) return 5000;
  const hoursUntil = differenceInHours(new Date(sub.deadline), new Date());
  return hoursUntil < 0 ? -1000 + hoursUntil : hoursUntil;
}

export function applySortToSubs<T extends { title: string; deadline?: string; status: string }>(list: T[], sort: SortOption): T[] {
  const sorted = [...list];
  switch (sort) {
    case 'urgency': return sorted.sort((a, b) => urgencyScore(a) - urgencyScore(b));
    case 'date_asc': return sorted.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
    case 'date_desc': return sorted.sort((a, b) => (b.deadline ?? '').localeCompare(a.deadline ?? ''));
    case 'alpha': return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

export function loadDefaultSort(): SortOption {
  try { return (localStorage.getItem('tf_default_sort') as SortOption) || 'urgency'; } catch { return 'urgency'; }
}

export function loadDefaultView(): "list" | "compact" | "board" | "focus" | "gantt" {
  try { return (localStorage.getItem('tf_default_view') as "list" | "compact" | "board" | "focus" | "gantt") || 'list'; } catch { return 'list'; }
}

export function ScopePicker({ scope, setScope, myCount, pendingCount }: { scope: 'all' | 'mine' | 'pending_review' | 'projects', setScope: (s: any) => void, myCount: number, pendingCount: number }) {
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
    <div className="relative z-50" ref={containerRef}>
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
