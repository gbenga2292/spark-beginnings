import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, ChevronDown, Clock, RefreshCw, Users, Bell, CheckCircle2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAppData } from '@/src/contexts/AppDataContext';
import type { SubTask, SubTaskStatus, MainTask, AppUser, TaskPriority } from "@/src/types/tasks";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@/src/components/tasks/TasksShared";

interface CreateTaskDialogProps {
  onClose: () => void;
  onSubmit: (task: Omit<MainTask, "id" | "createdAt" | "updatedAt">, subs: Omit<SubTask, "id" | "mainTaskId" | "createdAt" | "updatedAt">[]) => void;
  users: AppUser[];
  currentUserId: string;
  teamId: string;
  workspaceId?: string;
  isPersonal?: boolean;
  isExternalHr?: boolean;
}

export function CreateTaskDialog({ onClose, onSubmit, users, currentUserId, teamId, workspaceId, isPersonal, isExternalHr }: CreateTaskDialogProps) {
  const { addReminder, createMainTask } = useAppData();

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isHrTask, setIsHrTask] = useState(isExternalHr ?? false);
  const [showSubs, setShowSubs] = useState(true);
  const [subtasks, setSubs] = useState<{ title: string; assignedTo: string[]; deadline: string; deadlineTime: string; priority: TaskPriority | undefined; requiresApproval: boolean }[]>([]);

  // ── Reminder state ────────────────────────────────────────────────────────
  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  const [reminderFreq, setReminderFreq] = useState<'once'|'hourly'|'every_6_hours'|'daily'|'weekly'|'monthly'>('once');

  type ReminderFreq = 'once' | 'hourly' | 'every_6_hours' | 'daily' | 'weekly' | 'monthly';
  const FREQ_KEYS: ReminderFreq[] = ['once', 'hourly', 'every_6_hours', 'daily', 'weekly', 'monthly'];
  const FREQ_LABELS: Record<ReminderFreq, string> = {
    once: 'Once', hourly: 'Hourly', every_6_hours: 'Every 6h',
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
  };

  const reminderRecipients = assignedTo.length > 0 ? assignedTo : [currentUserId];

  const [openMainDropdown, setOpenMainDropdown] = useState(false);
  const [openSubDropdown, setOpenSubDropdown] = useState<number | null>(null);

  const addRow = () => setSubs(p => [...p, { title: "", assignedTo: [], deadline: "", deadlineTime: "", priority: undefined, requiresApproval: false }]);
  const removeRow = (i: number) => setSubs(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, k: string, v: any) =>
    setSubs(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const toggleSubs = () => {
    setShowSubs(s => {
      if (!s && subtasks.length === 0) addRow();
      return !s;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const validSubs = subtasks.filter(s => s.title.trim());
    const combinedDeadline = deadline
      ? deadlineTime ? `${deadline}T${deadlineTime}` : deadline
      : undefined;

    const finalSubs: any[] = [];
    validSubs.forEach(s => {
      finalSubs.push({
        title: s.title.trim(),
        description: "",
        assignedTo: s.assignedTo.length > 0 ? s.assignedTo.join(',') : null,
        status: "not_started" as SubTaskStatus,
        deadline: s.deadline ? (s.deadlineTime ? `${s.deadline}T${s.deadlineTime}` : s.deadline) : undefined,
        priority: s.priority,
        requiresApproval: s.requiresApproval,
      });
    });

    const mainAssignedToStr = assignedTo.length > 0 ? assignedTo.join(',') : undefined;

    const createdTask = await createMainTask(
      { title: title.trim(), description: description.trim(), createdBy: currentUserId, teamId, workspaceId: workspaceId ?? teamId, assignedTo: mainAssignedToStr, deadline: combinedDeadline, priority, requiresApproval, is_hr_task: isHrTask },
      finalSubs
    );

    if (enableReminder && reminderAt && createdTask?.id) {
      await addReminder({
        title: `Reminder: ${title.trim()}`,
        body: description.trim() || undefined,
        remindAt: new Date(reminderAt).toISOString(),
        frequency: reminderFreq,
        recipientIds: reminderRecipients,
        sendEmail: false,
        isActive: true,
        createdBy: currentUserId,
        mainTaskId: createdTask.id,
      });
    }

    setIsSubmitting(false);
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
            <div className="relative">
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Assigned To</label>
              <button type="button" onClick={() => setOpenMainDropdown(!openMainDropdown)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer whitespace-nowrap overflow-hidden">
                <span className="truncate">{assignedTo.length > 0 ? `${assignedTo.length} assignee(s)` : "Unassigned"}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground opacity-50 shrink-0" />
              </button>
              {openMainDropdown && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setOpenMainDropdown(false)} />
                  <div className="absolute top-full left-0 mt-2 min-w-full w-max max-w-[350px] max-h-[220px] overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-[101] py-1 hide-scrollbar">
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted transition-colors w-full border-b border-border">
                      <input type="checkbox"
                        checked={assignedTo.length === users.length && users.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setAssignedTo(users.map(u => u.id));
                          else setAssignedTo([]);
                        }}
                        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <span className="text-sm font-semibold text-foreground whitespace-normal leading-tight">All staff</span>
                    </label>
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted transition-colors w-full">
                        <input type="checkbox"
                          checked={assignedTo.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setAssignedTo(prev => [...prev, u.id]);
                            else setAssignedTo(prev => prev.filter(id => id !== u.id));
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <span className="text-sm text-foreground whitespace-normal leading-tight">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
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
          
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all" />
            <span className="text-xs font-medium text-foreground">Requires review before completion</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer mt-1 group">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isHrTask ? 'bg-rose-500 border-rose-500 text-white' : 'border-border bg-background'}`}>
              <input type="checkbox" checked={isHrTask} onChange={e => setIsHrTask(e.target.checked)}
                className="sr-only" />
              {isHrTask && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              HR Task 
            </span>
          </label>

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
                          <div className="relative">
                            <button type="button" onClick={() => setOpenSubDropdown(openSubDropdown === i ? null : i)}
                              className="px-2.5 py-1.5 flex items-center justify-between gap-2 min-w-[120px] rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-sm cursor-pointer">
                              <span className="truncate">{sub.assignedTo.length > 0 ? `${sub.assignedTo.length} selected` : 'Assign...'}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground opacity-50 shrink-0" />
                            </button>
                            {openSubDropdown === i && (
                              <>
                                <div className="fixed inset-0 z-[100]" onClick={() => setOpenSubDropdown(null)} />
                                <div className="absolute top-full left-0 mt-1 min-w-[200px] w-max max-w-[350px] max-h-[200px] overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-[101] py-1 hide-scrollbar">
                                  {users.map(u => (
                                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors">
                                      <input type="checkbox"
                                        checked={sub.assignedTo.includes(u.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) updateRow(i, "assignedTo", [...sub.assignedTo, u.id]);
                                          else updateRow(i, "assignedTo", sub.assignedTo.filter(id => id !== u.id));
                                        }}
                                        className="w-3 h-3 rounded" />
                                      <span className="text-xs text-foreground whitespace-normal leading-tight">{u.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <input type="date" value={sub.deadline} onChange={e => updateRow(i, "deadline", e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-sm" />
                          <input type="time" value={sub.deadlineTime} onChange={e => updateRow(i, "deadlineTime", e.target.value)}
                            disabled={!sub.deadline}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-sm disabled:opacity-50" />
                          <select value={sub.priority ?? ''} onChange={e => updateRow(i, "priority", e.target.value ? e.target.value as TaskPriority : undefined)}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-sm">
                            <option value="">No Priority</option>
                            {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
                          </select>
                        </div>
                        <div className="ml-6 flex items-center">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={sub.requiresApproval} onChange={e => updateRow(i, "requiresApproval", e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20" />
                            <span className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">Requires Review</span>
                          </label>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addRow}
                      className="w-full py-2.5 rounded-xl border border-dashed border-border bg-muted/30 text-xs font-semibold text-muted-foreground hover:bg-muted transition-all active:scale-[0.98]">
                      + Add another subtask
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reminder Section */}
          <div className={`mt-2 border border-border rounded-xl transition-all ${enableReminder ? 'bg-indigo-50/10 border-indigo-200/50' : ''}`}>
             <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setEnableReminder(!enableReminder)}>
                <div className="flex items-center gap-2.5">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${enableReminder ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      <Bell className="w-4 h-4" />
                   </div>
                   <div>
                      <span className="text-sm font-semibold text-foreground">Enable Reminder</span>
                      <p className="text-[10px] text-muted-foreground">Notification before task is due</p>
                   </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${enableReminder ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                   <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${enableReminder ? 'left-5' : 'left-1'}`} />
                </div>
             </div>

             <AnimatePresence>
                {enableReminder && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 grid grid-cols-1 gap-4">
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                               <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Time To Remind At <span className="text-red-400">*</span>
                               </label>
                               <input type="datetime-local" value={reminderAt} onChange={e => setReminderAt(e.target.value)}
                                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div>
                               <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" /> Frequency
                               </label>
                               <div className="flex flex-wrap gap-1">
                                  {FREQ_KEYS.map(f => (
                                     <button key={f} type="button" onClick={() => setReminderFreq(f)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${reminderFreq === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-muted-foreground border-border hover:border-indigo-300'}`}>
                                        {FREQ_LABELS[f]}
                                     </button>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>
                   </motion.div>
                )}
             </AnimatePresence>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" onClick={onClose}
              className="px-5 h-auto py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</Button>
            <Button type="submit" disabled={!title.trim() || (enableReminder && !reminderAt) || isSubmitting}
              className="px-5 h-auto py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
