import { useState, useRef, useEffect } from "react";
import { List, LayoutGrid, Target, AlignJustify, ChevronDown, CalendarRange, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type TaskViewMode = "list" | "compact" | "board" | "focus" | "gantt" | "inbox";

interface ViewToggleProps {
  value: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
}

const VIEWS: { mode: TaskViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "list", icon: List, label: "List" },
  { mode: "compact", icon: AlignJustify, label: "Compact" },
  { mode: "board", icon: LayoutGrid, label: "Board" },
  { mode: "focus", icon: Target, label: "Focus" },
  { mode: "gantt", icon: CalendarRange, label: "Gantt Chart" },
  { mode: "inbox", icon: Inbox, label: "Inbox" },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
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

  const activeView = VIEWS.find(v => v.mode === value) || VIEWS[0];
  const ActiveIcon = activeView.icon;

  return (
    <div className="relative z-50" ref={containerRef}>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-card text-xs font-semibold text-foreground hover:bg-muted/80 transition-all shadow-sm ring-1 ring-border/20"
      >
        <ActiveIcon className="w-3.5 h-3.5 text-primary" />
        <span>{activeView.label}</span>
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
            {VIEWS.map(v => {
              const isActive = value === v.mode;
              return (
                <button
                  key={v.mode}
                  onClick={() => { onChange(v.mode); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-muted ${
                    isActive ? "text-primary font-semibold bg-primary/5" : "text-foreground"
                  }`}
                >
                  <v.icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {v.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
