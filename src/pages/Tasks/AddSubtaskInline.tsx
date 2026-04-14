import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, ChevronDown } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import type { SubTask, AppUser, TaskPriority } from "@/src/types/tasks";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@/src/components/tasks/TasksShared";

interface AddSubtaskInlineProps {
  mainTaskId: string;
  users: AppUser[];
  isPersonal?: boolean;
  onAdd: (s: Omit<SubTask, "id" | "createdAt" | "updatedAt">) => void;
}

export function AddSubtaskInline({ mainTaskId, users, isPersonal, onAdd }: AddSubtaskInlineProps) {
  const [open, setOpen] = useState(false);
  const [openSubDrop, setOpenSubDrop] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const { user: currentUser } = useAuth();
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const handleAdd = () => {
    if (!title.trim()) return;
    const assignee = isPersonal ? (currentUser?.id ?? null) : (assignedTo.length > 0 ? assignedTo.join(',') : null);
    const combinedDeadline = deadline ? (deadlineTime ? `${deadline}T${deadlineTime}` : deadline) : undefined;
    onAdd({ mainTaskId, title: title.trim(), description: desc.trim(), assignedTo: assignee, status: "not_started", deadline: combinedDeadline, priority, requiresApproval });
    setTitle(""); setDesc(""); setAssignedTo([]); setDeadline(""); setDeadlineTime(""); setPriority(undefined); setRequiresApproval(false); setOpen(false);
  };

  const accentColor = isPersonal ? 'text-indigo-600 hover:text-indigo-700' : 'text-primary hover:text-primary/80';
  const accentRing = isPersonal ? 'focus:ring-indigo-200 border-indigo-200/60 dark:border-indigo-800/40' : 'focus:ring-primary/20 border-primary/20';

  if (!open) return (
    <button onClick={() => setOpen(true)} className={`flex items-center gap-1.5 text-xs font-semibold ${accentColor} transition-colors`}>
      <Plus className="w-4 h-4" /> Add Subtask
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className={`space-y-3 rounded-xl p-4 border flex-1 shadow-sm w-full ${isPersonal ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-800/40' : 'bg-primary/5 border-primary/20'}`}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Subtask title *"
        className={`w-full px-3 py-2 rounded-lg border text-sm bg-card text-foreground focus:outline-none focus:ring-2 ${accentRing}`} />
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20" />
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3`}>
        {!isPersonal && (
          <div className="relative">
            <button type="button" onClick={() => setOpenSubDrop(!openSubDrop)}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer overflow-hidden">
              <span className="truncate">{assignedTo.length > 0 ? `${assignedTo.length} selected` : 'Assign...'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground opacity-50 shrink-0" />
            </button>
            {openSubDrop && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setOpenSubDrop(false)} />
                <div className="absolute top-full left-0 mt-1 min-w-[200px] w-max max-w-[350px] max-h-[200px] overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-[101] py-1 hide-scrollbar">
                  <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors border-b border-border">
                    <input type="checkbox"
                      checked={assignedTo.length === users.length && users.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setAssignedTo(users.map(u => u.id));
                        else setAssignedTo([]);
                      }}
                      className="w-3 h-3 rounded text-primary focus:ring-primary/20" />
                    <span className="text-xs font-semibold text-foreground whitespace-normal leading-tight">All staff</span>
                  </label>
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors">
                      <input type="checkbox"
                        checked={assignedTo.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setAssignedTo(prev => [...prev, u.id]);
                          else setAssignedTo(prev => prev.filter(id => id !== u.id));
                        }}
                        className="w-3 h-3 rounded" />
                      <span className="text-xs text-foreground whitespace-normal leading-tight">{u.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />

        <input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)}
          disabled={!deadline}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
        <select value={priority ?? ''} onChange={e => setPriority(e.target.value ? e.target.value as TaskPriority : undefined)}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Priority…</option>
          {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
          <span className="text-xs font-medium text-foreground">Requires review before completion</span>
        </label>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleAdd}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-colors shadow-sm ${isPersonal ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>Add Subtask</button>
      </div>
    </motion.div>
  );
}
