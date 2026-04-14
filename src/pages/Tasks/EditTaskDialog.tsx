import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, ChevronDown, Clock, RefreshCw, Users, Bell, CheckCircle2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import type { MainTask, AppUser, TaskPriority } from "@/src/types/tasks";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@/src/components/tasks/TasksShared";

interface EditTaskDialogProps {
  task: MainTask;
  users: AppUser[];
  onClose: () => void;
  onSave: (patch: Partial<MainTask>) => void;
}

export function EditTaskDialog({ task, users, onClose, onSave }: EditTaskDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDesc] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState<string[]>(
    task.assignedTo ? task.assignedTo.split(',').filter(Boolean) : []
  );
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [priority, setPriority] = useState<TaskPriority | undefined>(task.priority);
  const [requiresApproval, setRequiresApproval] = useState(task.requiresApproval ?? false);
  const [openDropdown, setOpenDropdown] = useState(false);

  const isProj = !!task.is_project;
  const label = isProj ? "Project" : "Task";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const assignedToStr = assignedTo.length > 0 ? assignedTo.join(',') : undefined;
    onSave({ title: title.trim(), description: description.trim(), assignedTo: assignedToStr, deadline: deadline || undefined, priority, requiresApproval });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pencil className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit {label}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{task.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">{label} Title <span className="text-red-400">*</span></label>
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(d => !d)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer whitespace-nowrap overflow-hidden"
                >
                  <span className="truncate text-sm">
                    {assignedTo.length > 0 ? `${assignedTo.length} assignee(s)` : 'Unassigned'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground opacity-50 shrink-0" />
                </button>
                {openDropdown && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setOpenDropdown(false)} />
                    <div className="absolute top-full left-0 mt-2 w-full max-h-[220px] overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-[101] py-1 hide-scrollbar">
                      <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted transition-colors w-full border-b border-border">
                        <input type="checkbox"
                          checked={assignedTo.length === users.length && users.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setAssignedTo(users.map(u => u.id));
                            else setAssignedTo([]);
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Users className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">All staff</span>
                      </label>
                      {users.map(u => (
                        <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted transition-colors w-full">
                          <input
                            type="checkbox"
                            checked={assignedTo.includes(u.id)}
                            onChange={e => {
                              if (e.target.checked) setAssignedTo(prev => [...prev, u.id]);
                              else setAssignedTo(prev => prev.filter(id => id !== u.id));
                            }}
                            className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                          />
                          <div className={`w-5 h-5 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-[8px] font-bold shrink-0`}>
                            {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-xs text-foreground truncate">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {assignedTo.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {assignedTo.map(id => {
                    const u = users.find(u => u.id === id);
                    if (!u) return null;
                    return (
                      <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        {u.name.split(' ')[0]}
                        <button type="button" onClick={() => setAssignedTo(prev => prev.filter(x => x !== id))} className="hover:text-red-500 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
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

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all" />
            <span className="text-xs font-medium text-foreground">Requires review before completion</span>
          </label>

          <EditTaskReminderSection taskId={task.id} assignedTo={assignedTo.join(',')} users={users} />

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" onClick={onClose}
              className="px-5 h-auto py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</Button>
            <Button type="submit" disabled={!title.trim()}
              className="px-5 h-auto py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditTaskReminderSection({ taskId, assignedTo, users }: { taskId: string; assignedTo: string; users: AppUser[] }) {
  const { addReminder } = useAppData();
  const { user: currentUser } = useAuth();

  const FREQ_LABELS: Record<string, string> = {
    once: 'Once', hourly: 'Hourly', every_6_hours: 'Every 6h',
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
  };

  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderAt, setReminderAt] = useState('');
  const [reminderFreq, setReminderFreq] = useState<'once'|'hourly'|'every_6_hours'|'daily'|'weekly'|'monthly'>('once');
  const [saved, setSaved] = useState(false);

  const recipientIds = assignedTo
    ? assignedTo.split(',').filter(Boolean)
    : currentUser?.id ? [currentUser.id] : [];

  const handleSaveReminder = async () => {
    if (!reminderAt || !currentUser) return;
    await addReminder({
      title: 'Task Reminder',
      remindAt: new Date(reminderAt).toISOString(),
      frequency: reminderFreq,
      recipientIds,
      sendEmail: false,
      isActive: true,
      createdBy: currentUser.id,
      mainTaskId: taskId,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setEnableReminder(s => !s)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bell className={`w-3.5 h-3.5 ${enableReminder ? 'text-indigo-500' : 'text-muted-foreground'}`} />
          Time & Reminder
          {enableReminder && <span className="text-[11px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">On</span>}
        </span>
        <span className="text-xs text-muted-foreground">{enableReminder ? 'Hide' : 'Optional'}</span>
      </button>

      <AnimatePresence>
        {enableReminder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-4 border-t border-border">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Remind At <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={e => { setReminderAt(e.target.value); setSaved(false); }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Repeat
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(FREQ_LABELS) as Array<keyof typeof FREQ_LABELS>).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setReminderFreq(f as any); setSaved(false); }}
                      className={`py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                        reminderFreq === f
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700'
                          : 'border-border text-muted-foreground hover:border-indigo-300 hover:text-foreground'
                      }`}
                    >
                      {FREQ_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Recipients
                  <span className="normal-case font-normal text-muted-foreground/60 ml-1">(auto from assignee)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {recipientIds.length > 0 ? recipientIds.map(id => {
                    const u = users.find(u => u.id === id);
                    const name = u?.name ?? 'You';
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${u?.avatarColor || 'bg-slate-400'} flex items-center justify-center text-white text-[7px] font-bold`}>
                          {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        {name.split(' ')[0]}
                      </span>
                    );
                  }) : (
                    <span className="text-xs text-muted-foreground italic">No assignee — reminder will go to you</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveReminder}
                disabled={!reminderAt}
                className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  saved
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                {saved ? 'Reminder Saved!' : 'Update Reminder Only'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
