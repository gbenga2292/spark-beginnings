import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, ChevronDown, Clock, RefreshCw, Users, Bell, CheckCircle2, MapPin } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAppStore } from '@/src/store/appStore';
import type { MainTask, AppUser, TaskPriority, TaskUrgency } from "@/src/types/tasks";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@/src/components/tasks/TasksShared";
import { URGENCY_CONFIG } from "@/src/components/tasks/DailyUrgentTasksModal";

const URGENCY_ORDER: TaskUrgency[] = ['low', 'medium', 'high', 'critical'];

interface EditTaskDialogProps {
  task: MainTask;
  users: AppUser[];
  onClose: () => void;
  onSave: (patch: Partial<MainTask>) => void;
}

export function EditTaskDialog({ task, users, onClose, onSave }: EditTaskDialogProps) {
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const employees = useAppStore(s => s.employees);
  const clientContacts = useAppStore(s => s.clientContacts);

  const [title, setTitle] = useState(task.title);
  const [description, setDesc] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState<string[]>(
    task.assignedTo ? task.assignedTo.split(',').filter(Boolean) : []
  );
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [priority, setPriority] = useState<TaskPriority | undefined>(task.priority);
  const [urgency, setUrgency] = useState<TaskUrgency>(task.urgency || 'medium');
  const [requiresApproval, setRequiresApproval] = useState(task.requiresApproval ?? false);
  const [approverId, setApproverId] = useState(task.approverId || '');
  const [hasBudget, setHasBudget] = useState(task.hasBudget ?? false);
  const [budgetRequested, setBudgetRequested] = useState<number | undefined>(task.budgetRequested);
  const [isHrTask, setIsHrTask] = useState(task.is_hr_task ?? false);
  const [openDropdown, setOpenDropdown] = useState(false);

  // Tag to Site state — pre-populate from existing task
  const [tagToSite, setTagToSite] = useState(!!(task.clientId || task.siteId));
  const [clientId, setClientId] = useState(task.clientId || '');
  const [siteId, setSiteId] = useState(task.siteId || '');

  // ── Requested By state (DCEL vs CLIENT) ───────────────────────────────────
  const initialRequestedBy = (task as any).requestedBy || (task as any).requested_by || '';
  const initialRequestedByType = (task as any).requestedByType || (task as any).requested_by_type || (task.clientId ? 'CLIENT' : 'DCEL');

  const [requestedByType, setRequestedByType] = useState<'DCEL' | 'CLIENT'>(initialRequestedByType);
  const [requestedBy, setRequestedBy] = useState<string>(initialRequestedBy);

  const [isCustomRequestedBy, setIsCustomRequestedBy] = useState(() => {
    if (!initialRequestedBy) return false;
    if (initialRequestedByType === 'DCEL') {
      const match = employees.some(e => `${e.firstname || ''} ${e.surname || ''}`.trim().toLowerCase() === initialRequestedBy.trim().toLowerCase());
      return !match;
    } else {
      const match = clientContacts.some(c => c.name?.trim().toLowerCase() === initialRequestedBy.trim().toLowerCase());
      return !match;
    }
  });
  const [customRequestedBy, setCustomRequestedBy] = useState(() => {
    if (!initialRequestedBy) return "";
    if (initialRequestedByType === 'DCEL') {
      const match = employees.some(e => `${e.firstname || ''} ${e.surname || ''}`.trim().toLowerCase() === initialRequestedBy.trim().toLowerCase());
      return match ? "" : initialRequestedBy;
    } else {
      const match = clientContacts.some(c => c.name?.trim().toLowerCase() === initialRequestedBy.trim().toLowerCase());
      return match ? "" : initialRequestedBy;
    }
  });

  // Selected client profile and name for filtering client contacts
  const selectedClient = useMemo(() => {
    if (!clientId) return null;
    return clientProfiles.find(c => c.id === clientId || c.name?.trim().toLowerCase() === clientId.trim().toLowerCase()) || null;
  }, [clientId, clientProfiles]);

  const selectedClientName = selectedClient?.name || clientId;

  // Client contacts strictly for the selected client
  const clientSpecificContacts = useMemo(() => {
    if (!selectedClientName) return { siteSpecific: [], otherContacts: [], total: 0 };
    const cleanClient = selectedClientName.trim().toLowerCase();
    const forThisClient = clientContacts.filter(c => 
      c.clientName?.trim().toLowerCase() === cleanClient
    );
    
    // When siteId is chosen, partition into site-linked / principal contacts vs other contacts of this client
    const siteSpecific = siteId
      ? forThisClient.filter(c => c.isPrincipal || (c.siteIds || []).includes(siteId))
      : forThisClient;
    const otherContacts = siteId
      ? forThisClient.filter(c => !c.isPrincipal && !(c.siteIds || []).includes(siteId))
      : [];

    return { siteSpecific, otherContacts, total: forThisClient.length };
  }, [clientContacts, selectedClientName, siteId]);

  // Office and Field employees for DCEL (excluding offboarded employees unless already selected on this task)
  const dcelEmployees = useMemo(() => {
    return employees
      .filter(e => {
        const t = (e.staffType || '').toUpperCase();
        const isStaff = t === 'OFFICE' || t === 'FIELD' || !t || t !== 'NON-EMPLOYEE';
        if (!isStaff) return false;

        const fullName = `${e.firstname || ''} ${e.surname || ''}`.trim();
        const isCurrentSelection = (requestedBy && fullName === requestedBy) || (initialRequestedBy && fullName === initialRequestedBy);

        const isTerminated = e.status === 'Terminated';
        const hasPastEndDate = Boolean(e.endDate && !isNaN(new Date(e.endDate).getTime()) && new Date(e.endDate).getTime() <= Date.now());
        const isOffboarded = isTerminated || hasPastEndDate;

        // If offboarded, only keep if this employee was already the recorded requester on this task
        if (isOffboarded && !isCurrentSelection) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const nameA = `${a.firstname || ''} ${a.surname || ''}`.trim().toLowerCase();
        const nameB = `${b.firstname || ''} ${b.surname || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees, requestedBy, initialRequestedBy]);

  const isProj = !!task.is_project;
  const label = isProj ? "Project" : "Task";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const assignedToStr = assignedTo.length > 0 ? assignedTo.join(',') : undefined;
    const effectiveRequestedBy = (tagToSite && (isCustomRequestedBy ? customRequestedBy.trim() : requestedBy.trim())) || null;
    const effectiveRequestedByType = (tagToSite && effectiveRequestedBy) ? requestedByType : null;

    onSave({ 
      title: title.trim(), 
      description: description.trim(), 
      assignedTo: assignedToStr, 
      deadline: deadline || undefined, 
      priority, 
      urgency,
      requiresApproval, 
      approverId: requiresApproval ? approverId : undefined,
      hasBudget: requiresApproval ? hasBudget : undefined,
      budgetRequested: (requiresApproval && hasBudget) ? budgetRequested : undefined,
      is_hr_task: isHrTask,
      clientId: tagToSite && clientId ? clientId : null,
      siteId: tagToSite && siteId ? siteId : null,
      requestedByType: effectiveRequestedByType as any,
      requestedBy: effectiveRequestedBy as any,
    });
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
                    <div className="absolute top-full left-0 mt-2 w-full max-h-[300px] overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-[101] pt-1 pb-10">
                      <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted transition-colors w-full border-b border-border">
                        <input type="checkbox"
                          checked={assignedTo.length === users.filter(u => u.isActive !== false).length && users.filter(u => u.isActive !== false).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setAssignedTo(users.filter(u => u.isActive !== false).map(u => u.id));
                            else setAssignedTo([]);
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Users className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">All staff</span>
                      </label>
                      {users.filter(u => u.isActive !== false).map(u => (
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

          {/* Urgency Level */}
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Urgency Level</label>
            <div className="grid grid-cols-4 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
              {URGENCY_ORDER.map(u => {
                const conf = URGENCY_CONFIG[u];
                const isSelected = urgency === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? `${conf.badgeCls} ${conf.cardBorder} shadow-sm scale-105 ring-1 ring-primary/20`
                        : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${conf.dotCls}`} />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-muted/20 p-4 rounded-xl border border-border/50 space-y-3 mt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all" />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Requires Approval</span>
            </label>
            {requiresApproval && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Approving Authority</label>
                  <select 
                    value={approverId} 
                    onChange={e => setApproverId(e.target.value)}
                    required={requiresApproval}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                  >
                    <option value="">Choose an approver...</option>
                    {users.filter(u => u.isActive !== false).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={hasBudget} onChange={e => setHasBudget(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all" />
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Include Budget Request</span>
                </label>
                
                {hasBudget && (
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Requesting Amount (₦)</label>
                    <input type="number" min="0" value={budgetRequested ?? ''} onChange={e => setBudgetRequested(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
                  </div>
                )}
              </motion.div>
            )}
          </div>

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

          {/* Tag to Site Section */}
          <div className={`mt-1 border border-border rounded-xl transition-all ${tagToSite ? 'bg-primary/5 border-primary/20' : ''}`}>
             <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setTagToSite(!tagToSite)}>
                <div className="flex items-center gap-2.5">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${tagToSite ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <MapPin className="w-4 h-4" />
                   </div>
                   <div>
                      <span className="text-sm font-semibold text-foreground">Tag to Site / Client</span>
                      <p className="text-[10px] text-muted-foreground">Associate with a specific client and site</p>
                   </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${tagToSite ? 'bg-primary' : 'bg-slate-200'}`}>
                   <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${tagToSite ? 'left-5' : 'left-1'}`} />
                </div>
             </div>
             <AnimatePresence>
                {tagToSite && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Client</label>
                            <select value={clientId} onChange={e => { setClientId(e.target.value); setSiteId(''); }}
                               className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
                               <option value="">No Client</option>
                               {clientProfiles.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                               ))}
                            </select>
                         </div>
                         <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Site</label>
                            <select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={!clientId}
                               className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
                               <option value="">No Site</option>
                               {sites.filter(s => {
                                  const cName = clientProfiles.find(c => c.id === clientId)?.name;
                                  return s.client === cName || s.client === clientId;
                               }).map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                               ))}
                            </select>
                         </div>
                      </div>

                      {/* Requested By Section — only shows when Tag to Site / Client is active */}
                      <div className="px-4 pb-4 pt-3 border-t border-border/60">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Requested By
                            </label>
                          </div>

                          {/* Toggle DCEL vs CLIENT */}
                          <div className="flex items-center p-0.5 rounded-lg border border-border bg-background shadow-xs text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setRequestedByType('DCEL');
                                setRequestedBy('');
                                setIsCustomRequestedBy(false);
                                setCustomRequestedBy('');
                              }}
                              className={`px-2.5 py-0.5 rounded-md transition-all text-xs font-bold cursor-pointer ${
                                requestedByType === 'DCEL'
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              DCEL
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRequestedByType('CLIENT');
                                setRequestedBy('');
                                setIsCustomRequestedBy(false);
                                setCustomRequestedBy('');
                              }}
                              className={`px-2.5 py-0.5 rounded-md transition-all text-xs font-bold cursor-pointer ${
                                requestedByType === 'CLIENT'
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              CLIENT
                            </button>
                          </div>
                        </div>

                        {requestedByType === 'DCEL' ? (
                          <div className="space-y-2">
                            <select
                              value={isCustomRequestedBy ? '__CUSTOM__' : requestedBy}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '__CUSTOM__') {
                                  setIsCustomRequestedBy(true);
                                } else {
                                  setIsCustomRequestedBy(false);
                                  setRequestedBy(val);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                            >
                              <option value="">Choose Field / Office employee...</option>
                              <optgroup label="Office & Field Employees">
                                {dcelEmployees.map(emp => {
                                  const name = `${emp.firstname || ''} ${emp.surname || ''}`.trim() || emp.employeeCode || emp.id;
                                  const role = emp.position || emp.department || '';
                                  const type = emp.staffType ? `[${emp.staffType}]` : '';
                                  const isTerminated = emp.status === 'Terminated';
                                  const hasPastEndDate = Boolean(emp.endDate && !isNaN(new Date(emp.endDate).getTime()) && new Date(emp.endDate).getTime() <= Date.now());
                                  const isOffboarded = isTerminated || hasPastEndDate;
                                  const offboardedTag = isOffboarded ? ' [Offboarded]' : '';
                                  return (
                                    <option key={emp.id} value={name}>
                                      {name}{role ? ` — ${role}` : ''} {type}{offboardedTag}
                                    </option>
                                  );
                                })}
                              </optgroup>
                              {dcelEmployees.length === 0 && users.length > 0 && (
                                <optgroup label="System Users">
                                  {users.filter(u => u.isActive !== false).map(u => (
                                    <option key={u.id} value={u.name}>
                                      {u.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <option value="__CUSTOM__">
                                + Other (Type custom name...)
                              </option>
                            </select>

                            {isCustomRequestedBy && (
                              <input
                                type="text"
                                autoFocus
                                value={customRequestedBy}
                                onChange={e => setCustomRequestedBy(e.target.value)}
                                placeholder="Enter DCEL requester name..."
                                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <select
                              value={isCustomRequestedBy ? '__CUSTOM__' : requestedBy}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '__CUSTOM__') {
                                  setIsCustomRequestedBy(true);
                                } else {
                                  setIsCustomRequestedBy(false);
                                  setRequestedBy(val);
                                }
                              }}
                              disabled={!selectedClientName}
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {!selectedClientName ? (
                                <option value="" disabled>
                                  Please select a Client above first...
                                </option>
                              ) : clientSpecificContacts.total === 0 ? (
                                <option value="" disabled>
                                  No contacts recorded for {selectedClientName}
                                </option>
                              ) : (
                                <option value="">
                                  Choose contact for {selectedClientName}...
                                </option>
                              )}

                              {clientSpecificContacts.siteSpecific.length > 0 && (
                                <optgroup
                                  label={siteId ? "Linked to this Site / Principal" : `${selectedClientName} Contacts`}
                                >
                                  {clientSpecificContacts.siteSpecific.map(c => {
                                    const cPos = c.position ? ` — ${c.position}` : '';
                                    const cStar = c.isPrincipal ? ' ⭐ (Principal)' : '';
                                    return (
                                      <option key={c.id} value={c.name}>
                                        {c.name}{cPos}{cStar}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              )}

                              {clientSpecificContacts.otherContacts.length > 0 && (
                                <optgroup
                                  label={`Other ${selectedClientName} Contacts`}
                                >
                                  {clientSpecificContacts.otherContacts.map(c => {
                                    const cPos = c.position ? ` — ${c.position}` : '';
                                    return (
                                      <option key={c.id} value={c.name}>
                                        {c.name}{cPos}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              )}

                              {selectedClientName && (
                                <option value="__CUSTOM__">
                                  + Other (Type custom contact name...)
                                </option>
                              )}
                            </select>

                            {isCustomRequestedBy && (
                              <input
                                type="text"
                                autoFocus
                                value={customRequestedBy}
                                onChange={e => setCustomRequestedBy(e.target.value)}
                                placeholder="Enter client contact name..."
                                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                              />
                            )}
                          </div>
                        )}
                      </div>
                   </motion.div>
                )}
             </AnimatePresence>
          </div>

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
