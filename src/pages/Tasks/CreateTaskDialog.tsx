import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, ChevronDown, Clock, RefreshCw, Users, Bell, CheckCircle2, MapPin } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAppStore } from '@/src/store/appStore';
import type { SubTask, SubTaskStatus, MainTask, AppUser, TaskPriority } from "@/src/types/tasks";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@/src/components/tasks/TasksShared";

interface CreateTaskDialogProps {
  onClose: () => void;
  onSubmit?: (task: Omit<MainTask, "id" | "createdAt" | "updatedAt">, subs: Omit<SubTask, "id" | "mainTaskId" | "createdAt" | "updatedAt">[]) => void;
  users: AppUser[];
  currentUserId: string;
  teamId: string;
  workspaceId?: string;
  isPersonal?: boolean;
  isExternalHr?: boolean;
  initialTitle?: string;
  initialDescription?: string;
  initialClientId?: string;
  initialSiteId?: string;
  initialDeadline?: string;
  initialDeadlineTime?: string;
  isDarkTheme?: boolean;
}

export function CreateTaskDialog({
  onClose,
  onSubmit,
  users,
  currentUserId,
  teamId,
  workspaceId,
  isPersonal,
  isExternalHr,
  initialTitle = "",
  initialDescription = "",
  initialClientId = "",
  initialSiteId = "",
  initialDeadline = "",
  initialDeadlineTime = "",
  isDarkTheme = false
}: CreateTaskDialogProps) {
  const { addReminder, createMainTask } = useAppData();
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const activeUsers = users.filter(u => u.isActive !== false);

  const [title, setTitle] = useState(initialTitle);
  const [description, setDesc] = useState(initialDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [deadlineTime, setDeadlineTime] = useState(initialDeadlineTime);
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approverId, setApproverId] = useState<string>("");
  const [isHrTask, setIsHrTask] = useState(isExternalHr ?? false);
  const [showSubs, setShowSubs] = useState(true);
  const [subtasks, setSubs] = useState<{ title: string; assignedTo: string[]; deadline: string; deadlineTime: string; priority: TaskPriority | undefined; requiresApproval: boolean; approverId?: string }[]>([]);

  // ── Tag to Site state ─────────────────────────────────────────────────────
  const [tagToSite, setTagToSite] = useState(!!(initialClientId || initialSiteId));
  const [clientId, setClientId] = useState<string>(initialClientId);
  const [siteId, setSiteId] = useState<string>(initialSiteId);

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

  const addRow = () => setSubs(p => [...p, { title: "", assignedTo: [], deadline: "", deadlineTime: "", priority: undefined, requiresApproval: false, approverId: "" }]);
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
        status: (s.requiresApproval ? "pending_approval" : "not_started") as SubTaskStatus,
        deadline: s.deadline ? (s.deadlineTime ? `${s.deadline}T${s.deadlineTime}` : s.deadline) : undefined,
        priority: s.priority,
        requiresApproval: s.requiresApproval,
        approverId: s.requiresApproval ? s.approverId : undefined,
        clientId: tagToSite && clientId ? clientId : undefined,
        siteId: tagToSite && siteId ? siteId : undefined,
      });
    });

    const mainAssignedToStr = assignedTo.length > 0 ? assignedTo.join(',') : undefined;

    const createdTask = await createMainTask(
      { 
        title: title.trim(), 
        description: description.trim(), 
        createdBy: currentUserId, 
        teamId, 
        workspaceId: workspaceId ?? teamId, 
        assignedTo: mainAssignedToStr, 
        deadline: combinedDeadline, 
        priority, 
        requiresApproval, 
        approverId: requiresApproval ? approverId : undefined,
        is_hr_task: isHrTask,
        clientId: tagToSite && clientId ? clientId : undefined,
        siteId: tagToSite && siteId ? siteId : undefined,
        skipAutoSubtask: finalSubs.length > 0
      },
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
        className={`border rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] ${
          isDarkTheme ? "bg-[#0f111a] border-[#2a2e3d] text-white" : "bg-card border-border text-foreground"
        }`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r ${
          isDarkTheme ? "border-white/5 from-indigo-500/5 to-transparent" : "border-border from-primary/5 to-transparent"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDarkTheme ? "bg-indigo-500/10" : "bg-primary/10"
            }`}>
              <Plus className={`w-4.5 h-4.5 ${isDarkTheme ? "text-indigo-400" : "text-primary"}`} />
            </div>
            <div>
              <h2 className={`text-base font-semibold ${isDarkTheme ? "text-white" : "text-foreground"}`}>New Task</h2>
              <p className={`text-[11px] ${isDarkTheme ? "text-white/50" : "text-muted-foreground"}`}>Create a new task and assign subtasks</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
            isDarkTheme ? "hover:bg-white/5 text-white/50 hover:text-white" : "hover:bg-muted text-muted-foreground"
          }`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${
              isDarkTheme ? "text-white/80" : "text-foreground"
            }`}>
              Task Title <span className="text-red-400">*</span>
            </label>
            <input required autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Review Q2 Report"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all shadow-sm ${
                isDarkTheme 
                  ? "border-white/10 bg-[#141622] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                  : "border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              }`} />
          </div>

          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${
              isDarkTheme ? "text-white/80" : "text-foreground"
            }`}>Description</label>
            <textarea rows={2} value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Optional notes…"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all shadow-sm resize-none ${
                isDarkTheme 
                  ? "border-white/10 bg-[#141622] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                  : "border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              }`} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="relative">
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${
                isDarkTheme ? "text-white/80" : "text-foreground"
              }`}>Assigned To</label>
              <button type="button" onClick={() => setOpenMainDropdown(!openMainDropdown)}
                className={`w-full px-3.5 py-2.5 flex items-center justify-between rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all shadow-sm cursor-pointer whitespace-nowrap overflow-hidden ${
                  isDarkTheme 
                    ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                    : "border-border bg-background text-foreground focus:ring-primary/20"
                }`}>
                <span className="truncate">{assignedTo.length > 0 ? `${assignedTo.length} assignee(s)` : "Unassigned"}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground opacity-50 shrink-0" />
              </button>
              {openMainDropdown && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setOpenMainDropdown(false)} />
                  <div className={`absolute top-full left-0 mt-2 min-w-full w-max max-w-[350px] max-h-[220px] overflow-y-auto border rounded-xl shadow-xl z-[101] py-1 hide-scrollbar ${
                    isDarkTheme ? "bg-[#141622] border-white/10 text-white" : "bg-card border-border text-foreground"
                  }`}>
                    <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors w-full border-b ${
                      isDarkTheme ? "hover:bg-white/5 border-white/5" : "hover:bg-muted border-border"
                    }`}>
                      <input type="checkbox"
                        checked={assignedTo.length === activeUsers.length && activeUsers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setAssignedTo(activeUsers.map(u => u.id));
                          else setAssignedTo([]);
                        }}
                        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <span className="text-sm font-semibold whitespace-normal leading-tight">All staff</span>
                    </label>
                    {activeUsers.map(u => (
                      <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors w-full ${
                        isDarkTheme ? "hover:bg-white/5" : "hover:bg-muted"
                      }`}>
                        <input type="checkbox"
                          checked={assignedTo.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setAssignedTo(prev => [...prev, u.id]);
                            else setAssignedTo(prev => prev.filter(id => id !== u.id));
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <span className="text-sm whitespace-normal leading-tight">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${
                isDarkTheme ? "text-white/80" : "text-foreground"
              }`}>Due Date</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all shadow-sm ${
                  isDarkTheme 
                    ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                    : "border-border bg-background text-foreground focus:ring-primary/20"
                }`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${
                isDarkTheme ? "text-white/80" : "text-foreground"
              }`}>Time <span className={`normal-case font-normal ${isDarkTheme ? "text-white/40" : "text-muted-foreground/60"}`}>(opt.)</span></label>
              <input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)}
                disabled={!deadline}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
                  isDarkTheme 
                    ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                    : "border-border bg-background text-foreground focus:ring-primary/20"
                }`} />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
              isDarkTheme ? "text-white/80" : "text-foreground"
            }`}>Priority</label>
            <div className={`flex items-center gap-2 flex-wrap p-1.5 rounded-xl border ${
              isDarkTheme ? "bg-white/5 border-white/5" : "bg-muted/30 border-border/50"
            }`}>
              <button type="button" onClick={() => setPriority(undefined)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                  !priority 
                    ? (isDarkTheme ? "bg-[#141622] text-white border border-white/10 ring-1 ring-indigo-500/20" : "bg-background text-foreground border border-border ring-1 ring-primary/20") 
                    : (isDarkTheme ? "text-white/50 hover:text-white hover:bg-white/5" : "text-muted-foreground hover:text-foreground hover:bg-black/5")
                }`}>None</button>
              {PRIORITY_ORDER.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm border ${
                    priority === p 
                      ? `${PRIORITY_CONFIG[p].className} ring-1 ${isDarkTheme ? "ring-indigo-500/20" : "ring-primary/20"}` 
                      : (isDarkTheme ? "border-transparent text-white/50 hover:text-white hover:bg-white/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5")
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all" />
              <span className={`text-xs font-medium ${isDarkTheme ? "text-white/80" : "text-foreground"}`}>Approval Needed</span>
            </label>
            {requiresApproval && (
              <div className="ml-6">
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                  isDarkTheme ? "text-white/40" : "text-muted-foreground"
                }`}>Select Approver</label>
                <select 
                  value={approverId} 
                  onChange={e => setApproverId(e.target.value)}
                  required={requiresApproval}
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 ${
                    isDarkTheme 
                      ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                      : "border-border bg-background text-foreground focus:ring-primary/20"
                  }`}
                >
                  <option value="">Choose an approver...</option>
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.id} className={isDarkTheme ? "bg-[#141622]" : ""}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer mt-1 group">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              isHrTask ? "bg-rose-500 border-rose-500 text-white" : (isDarkTheme ? "border-white/10 bg-[#141622]" : "border-border bg-background")
            }`}>
              <input type="checkbox" checked={isHrTask} onChange={e => setIsHrTask(e.target.checked)}
                className="sr-only" />
              {isHrTask && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <span className={`text-xs font-medium flex items-center gap-1.5 ${isDarkTheme ? "text-white/80" : "text-foreground"}`}>
              HR Task 
            </span>
          </label>

          {/* Tag to Site Section */}
          <div className={`mt-2 border rounded-xl transition-all ${
            tagToSite 
              ? (isDarkTheme ? "bg-indigo-500/10 border-indigo-500/20" : "bg-primary/5 border-primary/20") 
              : (isDarkTheme ? "border-white/10" : "border-border")
          }`}>
             <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setTagToSite(!tagToSite)}>
                <div className="flex items-center gap-2.5">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                     tagToSite 
                       ? (isDarkTheme ? "bg-indigo-600 text-white" : "bg-primary text-primary-foreground") 
                       : (isDarkTheme ? "bg-white/5 text-white/50" : "bg-muted text-muted-foreground")
                   }`}>
                      <MapPin className="w-4 h-4" />
                   </div>
                   <div>
                      <span className={`text-sm font-semibold ${isDarkTheme ? "text-white" : "text-foreground"}`}>Tag to Site / Client</span>
                      <p className={`text-[10px] ${isDarkTheme ? "text-white/40" : "text-muted-foreground"}`}>Associate this task with a specific client and site</p>
                   </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${
                  tagToSite 
                    ? (isDarkTheme ? "bg-indigo-600" : "bg-primary") 
                    : (isDarkTheme ? "bg-white/10" : "bg-slate-200")
                }`}>
                   <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${tagToSite ? "left-5" : "left-1"}`} />
                </div>
             </div>

             <AnimatePresence>
                {tagToSite && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-4">
                         <div>
                            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                              isDarkTheme ? "text-white/40" : "text-muted-foreground"
                            }`}>Client</label>
                            <select value={clientId} onChange={e => { setClientId(e.target.value); setSiteId(""); }}
                               className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                                 isDarkTheme 
                                   ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                   : "border-border bg-background text-foreground focus:ring-primary/20"
                               }`}>
                               <option value="" className={isDarkTheme ? "bg-[#141622]" : ""}>No Client</option>
                               {clientProfiles.map(c => (
                                  <option key={c.id} value={c.id} className={isDarkTheme ? "bg-[#141622]" : ""}>{c.name}</option>
                               ))}
                            </select>
                         </div>
                         <div>
                            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                              isDarkTheme ? "text-white/40" : "text-muted-foreground"
                            }`}>Site</label>
                            <select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={!clientId}
                               className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 disabled:opacity-50 ${
                                 isDarkTheme 
                                   ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                   : "border-border bg-background text-foreground focus:ring-primary/20"
                               }`}>
                               <option value="" className={isDarkTheme ? "bg-[#141622]" : ""}>No Site</option>
                               {sites.filter(s => {
                                  const cName = clientProfiles.find(c => c.id === clientId)?.name;
                                  return s.client === cName || s.client === clientId;
                                }).map(s => (
                                  <option key={s.id} value={s.id} className={isDarkTheme ? "bg-[#141622]" : ""}>{s.name}</option>
                                ))}
                            </select>
                         </div>
                      </div>
                   </motion.div>
                )}
             </AnimatePresence>
          </div>

          <div className={`border rounded-xl overflow-hidden ${isDarkTheme ? "border-white/5" : "border-border"}`}>
            <button type="button" onClick={toggleSubs}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left ${
                isDarkTheme ? "bg-white/5 hover:bg-white/10" : "bg-muted/50 hover:bg-muted"
              }`}>
              <span className={`text-sm font-medium flex items-center gap-2 ${isDarkTheme ? "text-white" : "text-foreground"}`}>
                <Plus className={`w-3.5 h-3.5 ${isDarkTheme ? "text-indigo-400" : "text-primary"}`} />Subtasks
                {subtasks.length > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    isDarkTheme ? "bg-[#141622] text-indigo-400" : "bg-primary/10 text-primary"
                  }`}>{subtasks.length}</span>
                )}
              </span>
              <span className={`text-xs ${isDarkTheme ? "text-white/40" : "text-muted-foreground"}`}>{showSubs ? "Hide" : "Optional"}</span>
            </button>

            <AnimatePresence>
              {showSubs && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-4 pb-4 pt-3 space-y-3">
                    {subtasks.map((sub, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold w-4 flex-shrink-0 text-right ${isDarkTheme ? "text-white/40" : "text-muted-foreground"}`}>{i + 1}.</span>
                          <input required value={sub.title} onChange={e => updateRow(i, "title", e.target.value)}
                            placeholder="Subtask title"
                            className={`flex-1 px-3 py-2 rounded-xl border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm ${
                              isDarkTheme 
                                ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                : "border-border bg-background text-foreground focus:ring-primary/20"
                            }`} />
                          <button type="button" onClick={() => removeRow(i)}
                            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                              isDarkTheme 
                                ? "text-white/40 hover:text-red-400 hover:bg-white/5" 
                                : "text-muted-foreground hover:text-red-500 hover:bg-red-50"
                            }`}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 ml-6 flex-wrap">
                          <div className="relative">
                            <button type="button" onClick={() => setOpenSubDropdown(openSubDropdown === i ? null : i)}
                              className={`px-2.5 py-1.5 flex items-center justify-between gap-2 min-w-[120px] rounded-lg border text-xs focus:outline-none focus:ring-1 shadow-sm cursor-pointer ${
                                isDarkTheme 
                                  ? "border-white/10 bg-[#141622] text-white/70 focus:ring-indigo-500/20" 
                                  : "border-border bg-background text-foreground focus:ring-primary/20"
                              }`}>
                              <span className="truncate">{sub.assignedTo.length > 0 ? `${sub.assignedTo.length} selected` : "Assign..."}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground opacity-50 shrink-0" />
                            </button>
                            {openSubDropdown === i && (
                              <>
                                <div className="fixed inset-0 z-[100]" onClick={() => setOpenSubDropdown(null)} />
                                <div className={`absolute top-full left-0 mt-1 min-w-[200px] w-max max-w-[350px] max-h-[200px] overflow-y-auto border rounded-lg shadow-xl z-[101] py-1 hide-scrollbar ${
                                  isDarkTheme ? "bg-[#141622] border-white/10 text-white" : "bg-card border-border text-foreground"
                                }`}>
                                  {activeUsers.map(u => (
                                    <label key={u.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                      isDarkTheme ? "hover:bg-white/5" : "hover:bg-muted"
                                    }`}>
                                      <input type="checkbox"
                                        checked={sub.assignedTo.includes(u.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) updateRow(i, "assignedTo", [...sub.assignedTo, u.id]);
                                          else updateRow(i, "assignedTo", sub.assignedTo.filter(id => id !== u.id));
                                        }}
                                        className="w-3 h-3 rounded" />
                                      <span className="text-xs whitespace-normal leading-tight">{u.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <input type="date" value={sub.deadline} onChange={e => updateRow(i, "deadline", e.target.value)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs bg-background focus:outline-none focus:ring-1 shadow-sm ${
                              isDarkTheme 
                                ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                : "border-border bg-background text-foreground focus:ring-primary/20"
                            }`} />
                          <input type="time" value={sub.deadlineTime} onChange={e => updateRow(i, "deadlineTime", e.target.value)}
                            disabled={!sub.deadline}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs bg-background focus:outline-none focus:ring-1 shadow-sm disabled:opacity-50 ${
                              isDarkTheme 
                                ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                : "border-border bg-background text-foreground focus:ring-primary/20"
                            }`} />
                          <select value={sub.priority ?? ""} onChange={e => updateRow(i, "priority", e.target.value ? e.target.value as TaskPriority : undefined)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs bg-background focus:outline-none focus:ring-1 shadow-sm ${
                              isDarkTheme 
                                ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                : "border-border bg-background text-foreground focus:ring-primary/20"
                            }`}>
                            <option value="" className={isDarkTheme ? "bg-[#141622]" : ""}>No Priority</option>
                            {PRIORITY_ORDER.map(p => <option key={p} value={p} className={isDarkTheme ? "bg-[#141622]" : ""}>{PRIORITY_CONFIG[p].label}</option>)}
                          </select>
                        </div>
                        <div className="ml-6 flex flex-col gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={sub.requiresApproval} onChange={e => updateRow(i, "requiresApproval", e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20" />
                            <span className={`text-[11px] font-medium transition-colors ${
                              isDarkTheme ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground"
                            }`}>Approval Needed</span>
                          </label>
                          {sub.requiresApproval && (
                            <div className="w-full max-w-[200px]">
                              <label className={`block text-[9px] font-bold uppercase tracking-wider mb-1 ${
                                isDarkTheme ? "text-white/40" : "text-muted-foreground"
                              }`}>Select Approver</label>
                              <select 
                                value={sub.approverId} 
                                onChange={e => updateRow(i, "approverId", e.target.value)}
                                required={sub.requiresApproval}
                                className={`w-full px-2 py-1 rounded-lg border text-[11px] focus:outline-none focus:ring-2 ${
                                  isDarkTheme 
                                    ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                    : "border-border bg-background text-foreground focus:ring-primary/20"
                                }`}
                              >
                                <option value="">Choose an approver...</option>
                                {activeUsers.map(u => (
                                  <option key={u.id} value={u.id} className={isDarkTheme ? "bg-[#141622]" : ""}>{u.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addRow}
                      className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all active:scale-[0.98] ${
                        isDarkTheme 
                          ? "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white" 
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                      }`}>
                      + Add another subtask
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reminder Section */}
          <div className={`mt-2 border rounded-xl transition-all ${
            enableReminder 
              ? (isDarkTheme ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50/10 border-indigo-200/50") 
              : (isDarkTheme ? "border-white/5" : "border-border")
          }`}>
             <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setEnableReminder(!enableReminder)}>
                <div className="flex items-center gap-2.5">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                     enableReminder 
                       ? "bg-indigo-500 text-white" 
                       : (isDarkTheme ? "bg-white/5 text-white/50" : "bg-muted text-muted-foreground")
                   }`}>
                      <Bell className="w-4 h-4" />
                   </div>
                   <div>
                      <span className={`text-sm font-semibold ${isDarkTheme ? "text-white" : "text-foreground"}`}>Enable Reminder</span>
                      <p className={`text-[10px] ${isDarkTheme ? "text-white/40" : "text-muted-foreground"}`}>Notification before task is due</p>
                   </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${
                  enableReminder ? "bg-indigo-600" : (isDarkTheme ? "bg-white/10" : "bg-slate-200")
                }`}>
                   <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${enableReminder ? "left-5" : "left-1"}`} />
                </div>
             </div>

             <AnimatePresence>
                {enableReminder && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 grid grid-cols-1 gap-4">
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                               <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                                 isDarkTheme ? "text-white/40" : "text-muted-foreground"
                               }`}>
                                  <Clock className="w-3 h-3" /> Time To Remind At <span className="text-red-400">*</span>
                               </label>
                               <input type="datetime-local" value={reminderAt} onChange={e => setReminderAt(e.target.value)}
                                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                                    isDarkTheme 
                                      ? "border-white/10 bg-[#141622] text-white focus:ring-indigo-500/20" 
                                      : "border-border bg-background text-foreground focus:ring-indigo-100"
                                  }`} />
                            </div>
                            <div>
                               <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1 ${
                                 isDarkTheme ? "text-white/40" : "text-muted-foreground"
                               }`}>
                                  <RefreshCw className="w-3 h-3" /> Frequency
                               </label>
                               <div className="flex flex-wrap gap-1">
                                  {FREQ_KEYS.map(f => (
                                     <button key={f} type="button" onClick={() => setReminderFreq(f)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                                          reminderFreq === f 
                                            ? "bg-indigo-600 text-white border-indigo-600" 
                                            : (isDarkTheme 
                                                ? "bg-transparent text-white/50 border-white/10 hover:border-indigo-500/50 hover:text-white" 
                                                : "bg-white text-muted-foreground border-border hover:border-indigo-300")
                                        }`}>
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
            <button type="button" onClick={onClose}
              className={`px-5 h-auto py-2.5 rounded-xl border text-sm transition-colors ${
                isDarkTheme 
                  ? "border-white/10 bg-transparent text-white/60 hover:bg-white/5 hover:text-white" 
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}>Cancel</button>
            <button type="submit" disabled={!title.trim() || (enableReminder && !reminderAt) || isSubmitting}
              className={`px-5 h-auto py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                isDarkTheme 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-600/50" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}>
              {isSubmitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
