import { List, LayoutGrid, Target, AlignJustify } from "lucide-react";
import { motion } from "framer-motion";

export type TaskViewMode = "list" | "compact" | "board" | "focus";

interface ViewToggleProps {
  value: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
}

const VIEWS: { mode: TaskViewMode; icon: React.ElementType; label: string }[] = [
  { mode: "list", icon: List, label: "List" },
  { mode: "compact", icon: AlignJustify, label: "Compact" },
  { mode: "board", icon: LayoutGrid, label: "Board" },
  { mode: "focus", icon: Target, label: "Focus" },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-muted rounded-xl p-0.5 gap-0.5">
      {VIEWS.map(v => {
        const isActive = value === v.mode;
        return (
          <button
            key={v.mode}
            onClick={() => onChange(v.mode)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="view-toggle-bg"
                className="absolute inset-0 bg-card rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <v.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
