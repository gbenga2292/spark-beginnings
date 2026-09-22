import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  Lock, 
  Building2, 
  MapPin, 
  Zap, 
  User, 
  ListTodo,
  CheckCircle2,
  Circle,
  CornerDownLeft,
  Bell,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAppStore } from '@/src/store/appStore';
import type { AppUser, SubTaskStatus, TaskUrgency } from '@/src/types/tasks';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface QuickTaskDialogProps {
  open: boolean;
  onClose: () => void;
  clientName?: string;
  clientId?: string;
  siteName?: string;
  siteId?: string;
  users: AppUser[];
  currentUserId: string;
  teamId?: string;
  workspaceId?: string;
  isDarkTheme?: boolean;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export function QuickTaskDialog({
  open,
  onClose,
  clientName = '',
  clientId = '',
  siteName = '',
  siteId = '',
  users,
  currentUserId,
  teamId = 'dcel-team',
  workspaceId,
  isDarkTheme = false
}: QuickTaskDialogProps) {
  const { createMainTask, addReminder } = useAppData();
  const clientProfiles = useAppStore(s => s.clientProfiles);
  const sites = useAppStore(s => s.sites);
  const employees = useAppStore(s => s.employees);
  const clientContacts = useAppStore(s => s.clientContacts);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Urgency & Priority State
  const [urgency, setUrgency] = useState<TaskUrgency>('medium');

  // Reminder State
  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderAt, setReminderAt] = useState('');

  // Requester State
  const [requesterType, setRequesterType] = useState<'CLIENT' | 'DCEL' | 'CUSTOM'>('CLIENT');
  const [requesterName, setRequesterName] = useState('');
  const [customRequester, setCustomRequester] = useState('');

  // To-Do items state
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [newTodoInput, setNewTodoInput] = useState('');

  // Active users for assignees
  const activeUsers = useMemo(() => {
    return users.filter(u => u.isActive !== false);
  }, [users]);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = (val?: string | null) => !!val && UUID_REGEX.test(val.trim());

  // Resolved Client & Site display labels and IDs
  const resolvedClient = useMemo(() => {
    let match = clientProfiles.find(c => (clientId && c.id === clientId) || (clientName && c.name?.trim().toLowerCase() === clientName.trim().toLowerCase()));
    if (!match && clientName) {
      match = clientProfiles.find(c => c.name?.trim().toLowerCase().includes(clientName.trim().toLowerCase()) || clientName.trim().toLowerCase().includes(c.name?.trim().toLowerCase()));
    }
    const resolvedId = (match?.id && isValidUuid(match.id)) ? match.id : (isValidUuid(clientId) ? clientId : undefined);
    return { id: resolvedId, name: match?.name || clientName || 'Client' };
  }, [clientName, clientId, clientProfiles]);

  const resolvedSite = useMemo(() => {
    let match = sites.find(s => (siteId && s.id === siteId) || (siteName && s.name?.trim().toLowerCase() === siteName.trim().toLowerCase()));
    if (!match && siteName) {
      match = sites.find(s => s.name?.trim().toLowerCase().includes(siteName.trim().toLowerCase()) || siteName.trim().toLowerCase().includes(s.name?.trim().toLowerCase()));
    }
    const resolvedId = (match?.id && isValidUuid(match.id)) ? match.id : (isValidUuid(siteId) ? siteId : undefined);
    const resolvedName = match?.name || siteName || '';
    if (!resolvedId && !resolvedName) return null;
    return { id: resolvedId, name: resolvedName };
  }, [siteName, siteId, sites]);

  // Client-specific contacts
  const relevantContacts = useMemo(() => {
    if (!resolvedClient.name) return [];
    return clientContacts.filter(c => {
      return c.clientName?.trim().toLowerCase() === resolvedClient.name.trim().toLowerCase();
    });
  }, [clientContacts, resolvedClient]);

  // Filtered DCEL Employees
  const dcelEmployees = useMemo(() => {
    return employees
      .filter(e => {
        const isTerminated = e.status === 'Terminated';
        const hasPastEndDate = Boolean(e.endDate && !isNaN(new Date(e.endDate).getTime()) && new Date(e.endDate).getTime() <= Date.now());
        return !isTerminated && !hasPastEndDate;
      })
      .map(e => ({
        id: e.id,
        name: `${e.firstname || ''} ${e.surname || ''}`.trim() || e.employeeCode || e.id,
        position: e.position || e.department || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Reset form when opened & pre-select first contact if available
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setAssignedTo([]);
      setUrgency('medium');
      setEnableReminder(false);
      setReminderAt('');
      setTodoItems([]);
      setNewTodoInput('');
      if (requesterType === 'CLIENT' && relevantContacts.length > 0) {
        setRequesterName(relevantContacts[0].name);
      }
    }
  }, [open]);

  // Reminder time helpers
  const getSuggestedReminderTime = (offsetHours = 2) => {
    const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getTomorrowMorningTime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleToggleReminder = (checked: boolean) => {
    setEnableReminder(checked);
    if (checked && !reminderAt) {
      setReminderAt(getSuggestedReminderTime(2));
    }
  };

  // Keyboard shortcut: Ctrl/Cmd + Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, title, description, assignedTo, urgency, enableReminder, reminderAt, requesterType, requesterName, customRequester, todoItems]);

  // Add a new todo item
  const handleAddTodo = () => {
    const trimmed = newTodoInput.trim();
    if (!trimmed) return;
    setTodoItems(prev => [
      ...prev,
      { id: crypto.randomUUID ? crypto.randomUUID() : `todo-${Date.now()}-${Math.random()}`, text: trimmed, completed: false }
    ]);
    setNewTodoInput('');
  };

  // Toggle todo completion before task creation
  const handleToggleTodo = (id: string) => {
    setTodoItems(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  // Remove todo item
  const handleRemoveTodo = (id: string) => {
    setTodoItems(prev => prev.filter(item => item.id !== id));
  };

  // Toggle assignee
  const handleToggleAssignee = (userId: string) => {
    setAssignedTo(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveRequestedBy = requesterType === 'CUSTOM'
        ? customRequester.trim()
        : requesterName.trim();
      const effectiveRequestedByType = effectiveRequestedBy ? (requesterType === 'CUSTOM' ? 'CLIENT' : requesterType) : undefined;

      const mainAssignedToStr = assignedTo.length > 0 ? assignedTo.join(',') : undefined;

      // Map todoItems to subtasks
      const subtasksPayload = todoItems.map(item => ({
        title: item.text.trim(),
        description: '',
        assignedTo: mainAssignedToStr || null,
        status: (item.completed ? 'completed' : 'not_started') as SubTaskStatus,
        clientId: resolvedClient.id || undefined,
        siteId: resolvedSite?.id || undefined,
        requestedByType: effectiveRequestedByType,
        requestedBy: effectiveRequestedBy || undefined,
      }));

      const created = await createMainTask(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          createdBy: currentUserId,
          teamId,
          workspaceId: workspaceId ?? teamId,
          assignedTo: mainAssignedToStr,
          clientId: resolvedClient.id || undefined,
          siteId: resolvedSite?.id || undefined,
          urgency,
          priority: urgency === 'critical' ? 'urgent' : urgency === 'high' ? 'high' : urgency === 'medium' ? 'medium' : 'low',
          requestedByType: effectiveRequestedByType,
          requestedBy: effectiveRequestedBy || undefined,
          skipAutoSubtask: subtasksPayload.length > 0
        },
        subtasksPayload
      );

      if (enableReminder && reminderAt && created?.id && addReminder) {
        try {
          await addReminder({
            title: `Reminder: ${title.trim()}`,
            body: description.trim() || undefined,
            remindAt: new Date(reminderAt).toISOString(),
            frequency: 'once',
            recipientIds: assignedTo.length > 0 ? assignedTo : [currentUserId],
            sendEmail: false,
            isActive: true,
            createdBy: currentUserId,
            mainTaskId: created.id,
          });
        } catch (remErr) {
          console.error('Failed to create reminder for quick task:', remErr);
        }
      }

      if (created) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to create quick task:', err);
      toast.error('Failed to create quick task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[6px] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className={cn(
          "w-full max-w-[500px] rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]",
          isDarkTheme 
            ? "bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/80" 
            : "bg-white border-slate-200/90 text-slate-900 shadow-xl"
        )}
      >
        {/* Sleek Minimalist Header */}
        <div className={cn(
          "px-5 pt-4 pb-3.5 border-b flex items-start justify-between shrink-0",
          isDarkTheme ? "border-slate-800/80 bg-slate-900" : "border-slate-100 bg-white"
        )}>
          <div className="space-y-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white leading-none">
                Quick Task
              </h2>
            </div>
            
            {/* Elegant Locked Context Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span className="truncate max-w-[170px]">{resolvedClient.name || 'Client'}</span>
                <Lock className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
              </span>

              {resolvedSite && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[150px]">{resolvedSite.name}</span>
                  <Lock className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimalist Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title Input */}
          <div>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title..."
              className={cn(
                "w-full px-3 py-2 text-sm sm:text-[15px] font-medium rounded-xl border transition-all focus:outline-none focus:ring-2",
                isDarkTheme 
                  ? "bg-slate-800/80 border-slate-700/80 text-white placeholder-slate-500 focus:ring-blue-500/20 focus:border-blue-500" 
                  : "bg-slate-50/60 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-blue-500/15 focus:border-blue-600 shadow-xs"
              )}
            />
          </div>

          {/* Minimalist 2-Column Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Requester Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Requester
                </span>
                
                {/* Segmented Control */}
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => { setRequesterType('CLIENT'); setRequesterName(''); }}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                      requesterType === 'CLIENT'
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRequesterType('DCEL'); setRequesterName(''); }}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                      requesterType === 'DCEL'
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRequesterType('CUSTOM'); setRequesterName(''); }}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all",
                      requesterType === 'CUSTOM'
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    Other
                  </button>
                </div>
              </div>

              {requesterType === 'CLIENT' && (
                <select
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  className={cn(
                    "w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 transition-all",
                    isDarkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                  )}
                >
                  <option value="">Select client contact...</option>
                  {relevantContacts.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}{c.position ? ` — ${c.position}` : ''}{c.isPrincipal ? ' ⭐' : ''}
                    </option>
                  ))}
                  {relevantContacts.length === 0 && (
                    <option disabled value="">No contacts registered for client</option>
                  )}
                </select>
              )}

              {requesterType === 'DCEL' && (
                <select
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  className={cn(
                    "w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 transition-all",
                    isDarkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                  )}
                >
                  <option value="">Select staff member...</option>
                  <optgroup label="Employees">
                    {dcelEmployees.map(emp => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}{emp.position ? ` — ${emp.position}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  {activeUsers.length > 0 && (
                    <optgroup label="System Users">
                      {activeUsers.map(u => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}

              {requesterType === 'CUSTOM' && (
                <input
                  type="text"
                  value={customRequester}
                  onChange={e => setCustomRequester(e.target.value)}
                  placeholder="Enter contact name..."
                  className={cn(
                    "w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 transition-all",
                    isDarkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                  )}
                />
              )}
            </div>

            {/* Assignees Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Assign To
                </span>
                {assignedTo.length > 0 && (
                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    {assignedTo.length} assigned
                  </span>
                )}
              </div>

              <select
                value=""
                onChange={e => {
                  if (e.target.value) {
                    handleToggleAssignee(e.target.value);
                  }
                }}
                className={cn(
                  "w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 transition-all",
                  isDarkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                )}
              >
                <option value="">+ Assign user...</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.id} disabled={assignedTo.includes(u.id)}>
                    {u.name} {assignedTo.includes(u.id) ? '✓' : ''}
                  </option>
                ))}
              </select>

              {/* Chips */}
              {assignedTo.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {assignedTo.map(uid => {
                    const u = activeUsers.find(user => user.id === uid);
                    return (
                      <span
                        key={uid}
                        onClick={() => handleToggleAssignee(uid)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400 cursor-pointer transition-colors group"
                        title="Click to remove"
                      >
                        <User className="w-2.5 h-2.5 text-slate-400 group-hover:text-red-500" />
                        <span className="truncate max-w-[100px]">{u?.name || uid}</span>
                        <X className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Minimalist Urgency Tag Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Urgency
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {urgency === 'critical' ? 'Urgent priority' : urgency === 'high' ? 'High priority' : urgency === 'medium' ? 'Standard priority' : 'Low priority'}
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              {[
                { id: 'low', label: 'Normal', activeCls: 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-200/80 dark:border-slate-600 shadow-2xs', dot: 'bg-slate-400' },
                { id: 'medium', label: 'Medium', activeCls: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60 shadow-2xs', dot: 'bg-amber-500' },
                { id: 'high', label: 'High', activeCls: 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800/60 shadow-2xs', dot: 'bg-orange-500' },
                { id: 'critical', label: 'Urgent', activeCls: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800/60 shadow-2xs', dot: 'bg-rose-500' },
              ].map(tag => {
                const isSelected = urgency === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setUrgency(tag.id as any)}
                    className={cn(
                      "py-1 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 border",
                      isSelected
                        ? cn("font-semibold", tag.activeCls)
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50"
                    )}
                  >
                    {isSelected && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", tag.dot)} />}
                    <span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description or notes (optional)..."
              className={cn(
                "w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none",
                isDarkTheme 
                  ? "bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500/20 focus:border-blue-500" 
                  : "bg-slate-50/50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-blue-500/15 focus:border-blue-600 shadow-2xs"
              )}
            />
          </div>

          {/* Minimalist Reminder Checkbox & Schedule */}
          <div className="p-2.5 rounded-xl border transition-all bg-slate-50/40 dark:bg-slate-800/30 border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label 
                onClick={() => handleToggleReminder(!enableReminder)}
                className="inline-flex items-center gap-2.5 cursor-pointer select-none group"
              >
                <div className={cn(
                  "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                  enableReminder
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isDarkTheme ? "border-slate-600 bg-slate-800 group-hover:border-blue-400" : "border-slate-300 bg-white group-hover:border-blue-500"
                )}>
                  {enableReminder && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex items-center gap-1.5">
                  <Bell className={cn("w-3.5 h-3.5 transition-colors", enableReminder ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Set Reminder
                  </span>
                </div>
              </label>

              {enableReminder && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  Notification active
                </span>
              )}
            </div>

            <AnimatePresence>
              {enableReminder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.16 }}
                  className="overflow-hidden space-y-2 pt-2.5 pl-6"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setReminderAt(getSuggestedReminderTime(1))}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 border border-slate-200/80 dark:border-slate-700 transition-colors"
                    >
                      In 1 hour
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderAt(getSuggestedReminderTime(3))}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 border border-slate-200/80 dark:border-slate-700 transition-colors"
                    >
                      In 3 hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderAt(getTomorrowMorningTime())}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 border border-slate-200/80 dark:border-slate-700 transition-colors"
                    >
                      Tomorrow 9 AM
                    </button>
                  </div>

                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={e => setReminderAt(e.target.value)}
                    className={cn(
                      "w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 transition-all",
                      isDarkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Minimalist To-Do Checklist (Subtasks) */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>To-Do List</span>
              </span>
              {todoItems.length > 0 && (
                <span className="text-[10px] font-medium text-slate-400">
                  {todoItems.filter(i => i.completed).length}/{todoItems.length} completed
                </span>
              )}
            </div>

            {/* Seamless Add Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newTodoInput}
                  onChange={e => setNewTodoInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTodo();
                    }
                  }}
                  placeholder="Add item (press Enter to list)..."
                  className={cn(
                    "w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2",
                    isDarkTheme 
                      ? "bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500/20 focus:border-blue-500" 
                      : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-500/15 focus:border-blue-600 shadow-2xs"
                  )}
                />
                <button
                  type="button"
                  onClick={handleAddTodo}
                  disabled={!newTodoInput.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                  title="Add item"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Checklist Items */}
            {todoItems.length > 0 && (
              <div className={cn(
                "rounded-xl border divide-y overflow-hidden max-h-44 overflow-y-auto style-scroll",
                isDarkTheme ? "bg-slate-850/50 border-slate-800 divide-slate-800" : "bg-slate-50/40 border-slate-200/80 divide-slate-100"
              )}>
                {todoItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <div
                      onClick={() => handleToggleTodo(item.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
                    >
                      <button
                        type="button"
                        className={cn(
                          "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all shrink-0",
                          item.completed 
                            ? "bg-blue-600 border-blue-600 text-white" 
                            : isDarkTheme ? "border-slate-600 hover:border-blue-400" : "border-slate-300 hover:border-blue-500 bg-white"
                        )}
                      >
                        {item.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </button>
                      <span className={cn(
                        "truncate font-normal",
                        item.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"
                      )}>
                        {item.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveTodo(item.id)}
                      className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                      title="Delete item"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Elegant Footer */}
        <div className={cn(
          "px-5 py-3 border-t flex items-center justify-between shrink-0",
          isDarkTheme ? "border-slate-800 bg-slate-900/90" : "border-slate-100 bg-slate-50/60"
        )}>
          <span className="text-[10px] text-slate-400">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[9px] font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[9px] font-mono">Enter</kbd> to save
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !title.trim()}
              className="h-8 px-3.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span>Creating...</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  <span>Create Task</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
