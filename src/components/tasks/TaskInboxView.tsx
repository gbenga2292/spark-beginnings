import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, isPast } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/src/hooks/useAuth';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAppStore } from '@/src/store/appStore';
import {
  Search, Circle, Loader2, CheckCircle2, AlertTriangle,
  User, Calendar, Clock, ChevronDown, ChevronRight,
  MessageSquare, Hash, Paperclip, Send, FolderOpen, X,
  ArrowRight, ArrowLeft, Plus, Hourglass, FileText, FileSpreadsheet, Presentation,
  Pencil, Reply, Link as LinkIcon, Check
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/src/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/src/components/ui/dropdown-menu";
import type { SubTask, MainTask, AppUser, SubTaskStatus, CommentAttachment } from "@/src/types/tasks";

// ── Status Config ─────────────────────────────────────────────────────────────
const statusConfig: Record<SubTaskStatus, { label: string; pillClass: string; dotColor: string; icon: React.ElementType }> = {
  not_started: { label: "Not Started", pillClass: "bg-slate-100 text-slate-600 border border-slate-200", dotColor: "bg-slate-400", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "bg-blue-100 text-blue-700 border border-blue-200", dotColor: "bg-blue-500", icon: Loader2 },
  pending_approval: { label: "Review", pillClass: "bg-amber-100 text-amber-700 border border-amber-200", dotColor: "bg-amber-500", icon: Hourglass },
  completed: { label: "Completed", pillClass: "bg-green-100 text-green-700 border border-green-200", dotColor: "bg-green-500", icon: CheckCircle2 },
};

const STATUS_FLOW: SubTaskStatus[] = ["not_started", "in_progress", "pending_approval", "completed"];
const STATUS_LABELS: Record<SubTaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_approval: "Review",
  completed: "Completed",
};

interface TaskInboxViewProps {
  subtasks: SubTask[];
  mainTasks: MainTask[];
  users: AppUser[];
  activeSubtaskId: string | null;
  onSelectSubtask: (id: string | null) => void;
  className?: string;
  onClose?: () => void;
}

export function TaskInboxView({ subtasks, mainTasks, users, activeSubtaskId, onSelectSubtask, className, onClose }: TaskInboxViewProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const subUser = useUserStore((s) => s.getCurrentUser());
  const { updateEmployee } = useAppStore();
  const { updateSubtaskStatus, postComment, getSubtaskComments, addSubtask, assignSubtask, getMainTaskWorkflow, approveSubtask, rejectSubtask, addReminder } = useAppData();

  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<"updates" | "workflow" | "files">("updates");
  
  // Custom HMO UI Prompt State
  const [hmoPrompt, setHmoPrompt] = useState<{ isOpen: boolean; duration: string; startDate: string; employeeId: string; subtaskId: string | null }>({
    isOpen: false,
    duration: '12',
    startDate: new Date().toISOString().split('T')[0],
    employeeId: '',
    subtaskId: null
  });

  // Group subtasks under their MainTasks — normalize snake_case from Supabase
  const groupedTasks = useMemo(() => {
    const filteredSubs = subtasks.filter(s => {
      const title = s.title || '';
      const desc = s.description || '';
      const q = search.toLowerCase();
      return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    });
    const groups: Record<string, SubTask[]> = {};
    filteredSubs.forEach(sub => {
      // Supabase returns main_task_id in snake_case
      const mtId: string = (sub as any).main_task_id || sub.mainTaskId || '';
      if (!mtId) return;
      if (!groups[mtId]) groups[mtId] = [];
      groups[mtId].push(sub);
    });
    return Object.entries(groups)
      .map(([mainTaskId, subs]) => ({
        mainTask: mainTasks.find(m => m.id === mainTaskId),
        subs,
      }))
      .filter(g => g.mainTask !== undefined)
      .sort((a, b) => new Date(b.mainTask!.createdAt || 0).getTime() - new Date(a.mainTask!.createdAt || 0).getTime());
  }, [subtasks, mainTasks, search]);

  const activeSubtask = subtasks.find(s => s.id === activeSubtaskId) ?? null;
  // Normalize mainTaskId for Supabase snake_case
  const activeMainTaskId = activeSubtask ? ((activeSubtask as any).main_task_id || activeSubtask.mainTaskId) : null;

  // Expand only active group on load to keep others closed by default
  useEffect(() => {
    if (activeMainTaskId) {
      setExpandedGroups(new Set([activeMainTaskId]));
    }
  }, [activeMainTaskId]);


  // Flatten only the currently searched groups for display count
  const flatSubtasks = useMemo(() => groupedTasks.flatMap(g => g.subs), [groupedTasks]);

  // Auto-select first task once on initial mount (not on every update)
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!hasAutoSelected.current && !activeSubtaskId && flatSubtasks.length > 0 && flatSubtasks[0]?.id) {
      hasAutoSelected.current = true;
      onSelectSubtask(flatSubtasks[0].id!);
    }
  }, [flatSubtasks, activeSubtaskId, onSelectSubtask]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };


  const activeMainTask = activeMainTaskId ? mainTasks.find(m => m.id === activeMainTaskId) ?? null : null;
  const assigneesStrs = typeof activeSubtask?.assignedTo === 'string' 
    ? activeSubtask.assignedTo.split(',').map((id: string) => id.trim()).filter(Boolean)
    : Array.isArray(activeSubtask?.assignedTo) 
      ? activeSubtask.assignedTo as string[] 
      : [];
  const activeAssignees = assigneesStrs.map((id: string) => users.find(u => u.id === id)).filter(Boolean) as AppUser[];

  const activeIndex = activeSubtask ? flatSubtasks.findIndex(s => s.id === activeSubtask.id) : -1;
  const navigateSubtask = (dir: 1 | -1) => {
    const nextItem = flatSubtasks[activeIndex + dir];
    if (nextItem?.id) onSelectSubtask(nextItem.id!);
  };

  return (
    <div className={className || "flex h-[calc(100vh-140px)] rounded-2xl border border-border overflow-hidden shadow-sm"}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-border bg-white flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {flatSubtasks.length}
              </span>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors hidden sm:flex"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Group List */}
        <div className="flex-1 overflow-y-auto py-2">
          {groupedTasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No tasks found</div>
          ) : (
            groupedTasks.map(({ mainTask, subs }) => {
                // Derive main task status for color coding
                const allDone = subs.length > 0 && subs.every(s => s.status === 'completed');
                const anyOverdue = subs.some(s => s.deadline && isPast(new Date(s.deadline)) && s.status !== 'completed');
                const anyInProgress = subs.some(s => s.status === 'in_progress' || s.status === 'pending_approval');
                const mtStatusColor = allDone
                  ? 'bg-green-500'
                  : anyOverdue
                  ? 'bg-red-500'
                  : anyInProgress
                  ? 'bg-amber-400'
                  : 'bg-blue-400';
                const mtBorderColor = allDone
                  ? 'border-l-green-400'
                  : anyOverdue
                  ? 'border-l-red-400'
                  : anyInProgress
                  ? 'border-l-amber-400'
                  : 'border-l-blue-300';
              const isGroupActive = subs.some(s => s.id === activeSubtaskId);
              
              return (
              <div key={mainTask!.id} className={`mb-1.5 border-l-4 ${isGroupActive ? 'border-orange-400 bg-orange-50/30 shadow-sm' : mtBorderColor} ml-0.5 rounded-r-lg transition-all`}>
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(mainTask!.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors text-left rounded-r-lg ${isGroupActive ? 'bg-orange-50/80 border-b border-orange-100/50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronDown
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isGroupActive ? 'text-orange-500' : 'text-slate-400'} ${expandedGroups.has(mainTask!.id) ? '' : '-rotate-90'}`}
                    />
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${mtStatusColor}`} title={allDone ? 'Completed' : anyOverdue ? 'Overdue' : anyInProgress ? 'In Progress' : 'Not Started'} />
                    <span className={`text-[13px] font-semibold truncate ${isGroupActive ? 'text-orange-950' : 'text-slate-700'}`}>{mainTask!.title}</span>
                  </div>
                  <span className={`text-[11px] font-bold flex-shrink-0 ml-1 ${isGroupActive ? 'text-orange-600' : 'text-slate-400'}`}>({subs.length})</span>
                </button>

                {/* Subtask List */}
                {expandedGroups.has(mainTask!.id) && (
                  <div className="pl-1.5 pr-2 py-1 space-y-1">
                    {subs.map(sub => {
                      const isActive = sub.id === activeSubtaskId;
                      const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';
                      const sc = statusConfig[sub.status];

                      return (
                        <button
                          key={sub.id}
                          onClick={() => onSelectSubtask(sub.id!)}
                          className={`group relative w-full flex items-center justify-between pl-6 pr-3 py-2.5 rounded-xl text-left transition-all
                            ${isActive ? 'bg-orange-100/60 ring-1 ring-orange-300 shadow-sm' : 'hover:bg-slate-50'}
                          `}
                        >
                          {/* Active indicator */}
                          {isActive && <div className="absolute left-1.5 top-2 bottom-2 w-1.5 bg-orange-500 rounded-full shadow-sm" />}

                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox */}
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = sub.status === 'completed' ? 'not_started' : 'completed';
                                const mtId = (sub as any).main_task_id || sub.mainTaskId;
                                const mainT = mainTasks.find(m => m.id === mtId);
                                const isAssignee = sub.assignedTo?.split(',').includes(currentUser?.id || '');
                                const canChange = currentUser?.role === 'admin' || currentUser?.role === 'co-admin' || mainT?.createdBy === currentUser?.id || isAssignee;
                                if (canChange && currentUser) {
                                  updateSubtaskStatus(sub.id!, newStatus, currentUser.id);
                                } else {
                                  toast.error("You don't have permission to change this task's status");
                                }
                              }}
                              className={`w-4 h-4 mx-0.5 rounded border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all cursor-pointer shadow-sm
                              ${sub.status === 'completed' 
                                ? (isActive ? 'bg-orange-500 border-orange-500 shadow-orange-500/20' : 'bg-primary border-primary shadow-primary/20') 
                                : (isActive 
                                    ? 'border-orange-400 bg-white/50 dark:bg-slate-800/80 hover:bg-orange-200 dark:hover:bg-orange-900/40' 
                                    : 'border-slate-300 dark:border-slate-500 group-hover:border-primary/60 dark:bg-slate-800/50')}
                            `}>
                              {sub.status === 'completed' && <Check className="w-3 h-3 text-white stroke-[3] translate-px" />}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[13px] font-medium truncate ${
                                sub.status === 'completed' ? 'line-through text-slate-400' :
                                isActive ? 'text-orange-950 font-bold' : 'text-slate-700'
                              }`}>{sub.title}</p>
                              {sub.deadline && (
                                <p className={`text-[11px] flex items-center gap-0.5 mt-0.5 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                  <Clock className="w-2.5 h-2.5" />
                                  {format(new Date(sub.deadline), 'MMM d')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Status dot */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dotColor}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── MIDDLE + RIGHT AREA ───────────────────────────────────────────── */}
      {activeSubtask && activeMainTask ? (
        <div className="flex-1 flex overflow-hidden min-w-0">

          {/* MIDDLE: Task Detail */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Top nav */}
            <div className="h-16 border-b border-border bg-slate-50/50 flex items-center justify-between px-6 flex-shrink-0">
              <button
                onClick={() => navigateSubtask(-1)}
                disabled={activeIndex <= 0}
                className="relative flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-700 text-sm font-bold shadow-[0_0_0_1px_#e2e8f0,0_3px_0_0_#cbd5e1] hover:bg-slate-50 active:translate-y-[3px] active:shadow-[0_0_0_1px_#e2e8f0,0_0_0_0_#cbd5e1] transition-colors disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_0_0_1px_#e2e8f0,0_3px_0_0_#cbd5e1] disabled:cursor-not-allowed select-none"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" /> Previous Task
              </button>

              <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                Task Navigation
              </div>

              <button
                onClick={() => navigateSubtask(1)}
                disabled={activeIndex >= flatSubtasks.length - 1 || activeIndex === -1}
                className="relative flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-700 text-sm font-bold shadow-[0_0_0_1px_#e2e8f0,0_3px_0_0_#cbd5e1] hover:bg-slate-50 active:translate-y-[3px] active:shadow-[0_0_0_1px_#e2e8f0,0_0_0_0_#cbd5e1] transition-colors disabled:opacity-40 disabled:active:translate-y-0 disabled:active:shadow-[0_0_0_1px_#e2e8f0,0_3px_0_0_#cbd5e1] disabled:cursor-not-allowed select-none"
              >
                Next Task <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 max-w-3xl">

                {/* Title & Parent */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">{activeSubtask.title}</h1>
                    <p className="text-sm text-slate-500">{activeMainTask.title}</p>
                  </div>
                  {(() => {
                    let link = '';
                    let label = 'Preview';
                    let privKey: keyof UserPrivileges | null = null;
                    const mtTitle = activeMainTask.title.toLowerCase();
                    const stTitle = activeSubtask.title.toLowerCase();

                    try {
                      const meta = JSON.parse(activeSubtask.description || '{}');
                      const privs = subUser?.privileges as UserPrivileges;
                      if (meta.refType === 'leave') { link = '/leaves'; label = 'View Leaves'; privKey = 'leaves'; }
                      if (meta.refType === 'hmo') {
                          if (privs?.hmo) {
                             link = '/hmo'; label = 'View HMO Panel'; privKey = 'hmo';
                          } else {
                             link = '';
                          }
                      }
                      if (meta.refType === 'salary_advance' || meta.refType === 'loan') { link = '/salary-loans'; label = 'View Loan'; privKey = 'salaryLoans'; }
                      if (meta.refId && (meta.refType === 'site' || mtTitle.includes('onboard'))) { link = `/sites/onboarding/${meta.refId}`; label = 'View Onboarding'; privKey = 'sites'; }
                    } catch(e) {}

                    if (!link) {
                      if (mtTitle.includes('onboard') || stTitle.includes('onboard')) {
                        link = '/sites';
                        label = 'Site Onboarding';
                        privKey = 'sites';
                      } else if (mtTitle.includes('site') || stTitle.includes('site')) {
                        link = '/sites';
                        label = 'View Sites';
                        privKey = 'sites';
                      } else if (mtTitle.includes('asset') || stTitle.includes('asset')) {
                        link = '/operations';
                        label = 'View Assets';
                        privKey = 'operations';
                      } else if (mtTitle.includes('waybill') || stTitle.includes('waybill')) {
                        link = '/operations/waybills';
                        label = 'View Waybills';
                        privKey = 'operations';
                      } else if (mtTitle.includes('employee') || mtTitle.includes('new hire') || stTitle.includes('employee') || stTitle.includes('new hire')) {
                        link = '/employees';
                        label = 'View Employee';
                        privKey = 'employees';
                      } else if (mtTitle.includes('payroll')) {
                        link = '/payroll';
                        label = 'View Payroll';
                        privKey = 'payroll';
                      } else if (mtTitle.includes('invoice') || mtTitle.includes('billing')) {
                        link = '/client-accounts';
                        label = 'View Billing';
                        privKey = 'billing';
                      }
                    }

                    if (!link) return null;

                    let hasAccess = true;
                    if (privKey && subUser) {
                        hasAccess = !!((subUser.privileges[privKey] as any)?.canView);
                    }

                    if (!hasAccess) {
                        return (
                          <button 
                            onClick={() => toast.error(`You do not have permission to access ${label.replace('View ', '')}`)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-400 cursor-not-allowed shadow-sm"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 opacity-60" /> No Access
                          </button>
                        );
                    }

                    return (
                      <button 
                        onClick={() => navigate(link)}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm active:translate-y-px"
                      >
                        <LinkIcon className="w-4 h-4" /> {label}
                      </button>
                    );
                  })()}
                </div>

                {/* Action Pills */}
                <div className="flex items-center gap-3 flex-wrap mb-8">
                  {activeSubtask.deadline && isPast(new Date(activeSubtask.deadline)) && activeSubtask.status !== 'completed' && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                      <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                    </span>
                  )}

                  {(() => {
                    // Check if this is an approval workflow task
                    let isApprovalTask = false;
                    let isApprover = false;
                    try {
                      const meta = JSON.parse(activeSubtask.description || '{}');
                      if (meta.refType && meta.refType !== 'hmo') {
                          isApprovalTask = true;
                          isApprover = activeSubtask.assignedTo?.split(',').includes(currentUser?.id || '') ?? false;
                      }
                    } catch (e) {
                      // Normal text description
                    }
                    
                    const isStandardApproval = (activeSubtask.requiresApproval || (activeSubtask as any).requires_approval) && activeSubtask.status === 'pending_approval';
                    if (isStandardApproval) {
                        isApprovalTask = true;
                        isApprover = activeMainTask.createdBy === currentUser?.id || currentUser?.role === 'admin';
                    }

                    if (isApprovalTask) {
                      const hasActed = activeSubtask.status === 'completed' || !!(activeSubtask as any).rejectedAt;
                      
                      return (
                        <>
                          <button
                            onClick={() => {
                              if (!isApprover || hasActed) return;
                              if (isStandardApproval) {
                                // Pass bypassApproval=true so the requiresApproval interception is skipped
                                updateSubtaskStatus(activeSubtask.id!, 'completed', currentUser?.id, true);
                                postComment(activeSubtask.id!, activeMainTask.id, `✅ **Approved** — Task marked as completed.`, currentUser?.id);
                              } else {
                                approveSubtask(activeSubtask.id!, currentUser?.id);
                              }
                            }}
                            disabled={!isApprover || hasActed}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                              hasActed ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' :
                              !isApprover ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' :
                              'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve Request
                          </button>
                          <button
                            onClick={() => {
                              if (!isApprover || hasActed) return;
                              const reason = window.prompt("Rejection reason (optional):");
                              if (reason !== null) {
                                  if (isStandardApproval) {
                                      // Standard task: revert to in_progress and post comment
                                      updateSubtaskStatus(activeSubtask.id!, 'in_progress', currentUser?.id);
                                      if (reason) postComment(activeSubtask.id!, activeMainTask.id, `❌ **Rejected**\nReason: ${reason}`, currentUser?.id);
                                  } else {
                                      rejectSubtask(activeSubtask.id!, currentUser?.id, reason);
                                  }
                              }
                            }}
                            disabled={!isApprover || hasActed}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                              hasActed ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed hidden' :
                              !isApprover ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed hidden' :
                              'bg-white text-rose-600 border-rose-200 hover:bg-rose-50 shadow-sm'
                            }`}
                          >
                            <X className="w-4 h-4" /> Reject Request
                          </button>
                        </>
                      );
                    }

                    // Otherwise, render normal standard task status pills
                    return (['not_started', 'in_progress', 'completed'] as SubTaskStatus[]).map(s => {
                      const sc = statusConfig[s];
                      const SIcon = sc.icon;
                      const isActive = activeSubtask.status === s;
                      const isAssignee = activeSubtask.assignedTo?.split(',').includes(currentUser?.id || '');
                      const canChangeStatus = currentUser?.role === 'admin' || currentUser?.role === 'co-admin' || activeMainTask?.createdBy === currentUser?.id || isAssignee;
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            if (!canChangeStatus || !currentUser) return;
                            
                            // Special intercept logic for HMO tasks
                            let isHmo = false;
                            let hmoEmpId = "";
                            try {
                              const meta = JSON.parse(activeSubtask.description || '{}');
                              if (meta.refType === 'hmo') {
                                isHmo = true;
                                hmoEmpId = meta.employeeId;
                              }
                            } catch (e) {}

                            if (isHmo && s === 'completed' && hmoEmpId) {
                               setHmoPrompt({
                                  isOpen: true,
                                  duration: '12',
                                  startDate: new Date().toISOString().split('T')[0],
                                  employeeId: hmoEmpId,
                                  subtaskId: activeSubtask.id || null
                               });
                               return;
                            }

                            updateSubtaskStatus(activeSubtask.id!, s, currentUser.id);
                          }}
                          disabled={!canChangeStatus}
                          title={!canChangeStatus ? 'Only admins and the task creator can change status' : undefined}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isActive ? sc.pillClass + ' ring-2 ring-offset-1 ring-primary/30' :
                            !canChangeStatus ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' :
                            'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <SIcon className="w-3.5 h-3.5" /> {sc.label}
                        </button>
                      );
                    });
                  })()}

                  {/* Assign button — only admins, co-admins or the task creator can reassign — supports multiple */}
                  {(currentUser?.role === 'admin' || currentUser?.role === 'co-admin' || activeMainTask?.createdBy === currentUser?.id) && (
                    <AssignMultiDropdown
                      activeSubtask={activeSubtask}
                      activeMainTask={activeMainTask}
                      users={users.filter(u => !u.isDeleted && !u.isSuspended)}
                      currentUser={currentUser}
                      assignSubtask={assignSubtask}
                      addSubtask={addSubtask}
                    />
                  )}
                </div>

                {/* Status Stepper */}
                <div className="mb-10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">STATUS:</p>
                  <div className="flex items-center gap-0">
                    {STATUS_FLOW.map((status, i) => {
                      const currentIdx = STATUS_FLOW.indexOf(activeSubtask.status);
                      const isActive = activeSubtask.status === status;
                      const isPastPhase = i < currentIdx;
                      return (
                        <React.Fragment key={status}>
                          <div
                            className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer
                              ${isActive ? 'bg-primary text-white shadow-md shadow-primary/25' :
                                isPastPhase ? 'text-primary' :
                                'text-slate-400'
                              }`}
                          onClick={() => {
                              const isAssignee = activeSubtask.assignedTo?.split(',').includes(currentUser?.id || '');
                              const canChangeStatus = currentUser?.role === 'admin' || currentUser?.role === 'co-admin' || activeMainTask?.createdBy === currentUser?.id || isAssignee;
                              if (canChangeStatus && currentUser) updateSubtaskStatus(activeSubtask.id!, status, currentUser.id);
                            }}
                          >
                            {STATUS_LABELS[status]}
                          </div>
                          {i < STATUS_FLOW.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-1 border-t-2 border-dashed ${isPastPhase ? 'border-primary/40' : 'border-slate-200'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Meta Fields */}
                <div className="grid grid-cols-[110px_1fr] gap-y-4 text-sm mb-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <span className="font-semibold text-slate-500 flex items-center">Assigned:</span>
                  <div className="flex items-center gap-2 font-medium text-slate-800 flex-wrap">
                    {activeAssignees.length > 0 ? (
                      activeAssignees.map(assignee => (
                        <div key={assignee.id} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={assignee.avatarUrl} />
                            <AvatarFallback className={`text-[9px] text-white ${assignee.avatarColor || 'bg-slate-500'}`}>
                              {assignee.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{assignee.name}</span>
                        </div>
                      ))
                    ) : "Unassigned"}
                  </div>

                  <span className="font-semibold text-slate-500 flex items-center">Priority:</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-800 capitalize">
                    {activeSubtask.priority === 'high' || activeSubtask.priority === 'urgent' ?
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> :
                      <div className="w-2 h-2 rounded-full bg-slate-300" />}
                    {activeSubtask.priority || 'Normal'}
                  </div>

                  <span className="font-semibold text-slate-500 flex items-center">Timeline:</span>
                  <div className="text-slate-800 font-medium">
                    {activeSubtask.createdAt ? format(new Date(activeSubtask.createdAt), "MMM d") : "—"}
                    {" → "}
                    {activeSubtask.deadline ? format(new Date(activeSubtask.deadline), "MMM d") : "—"}
                  </div>
                </div>

                {/* Task Narration (Main Task Description) */}
                {activeMainTask.description && (
                  <div className="mb-6">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Task Narration (Project Context)</h3>
                    <div className="flex items-start gap-3 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-sm">
                      <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{activeMainTask.description}</p>
                    </div>
                  </div>
                )}

                {/* Description card */}
                {activeSubtask.description && (
                  <div className="mb-8">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subtask Details</h3>
                    <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <MessageSquare className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{activeSubtask.description}</p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* RIGHT: Updates Panel */}
          <div className="w-[520px] flex-shrink-0 bg-white border-l border-border flex flex-col overflow-hidden">
            <div className="flex bg-slate-50 border-b border-border" style={{ flexShrink: 0 }}>
              {(['updates', 'workflow', 'files'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 w-full flex items-center justify-center py-4 text-sm font-bold capitalize tracking-wide transition-all border-b-2 cursor-pointer ${
                    rightTab === tab
                      ? 'bg-white text-primary border-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent'
                  }`}
                >
                  {tab === 'updates' ? '💬 Updates' : tab === 'workflow' ? '⚡ Workflow' : '📎 Files'}
                </button>
              ))}
            </div>

            {/* Tab Content — constrained below tabs, cannot overflow upward */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {rightTab === 'updates' && (
                <UpdatesFeed
                  subtask={activeSubtask}
                  mainTask={activeMainTask}
                  users={users}
                  currentUser={currentUser}
                  postComment={postComment}
                  getSubtaskComments={getSubtaskComments}
                  updateSubtaskStatus={updateSubtaskStatus}
                  addSubtask={addSubtask}
                  addReminder={addReminder}
                  subtasks={subtasks}
                  onSelectSubtask={onSelectSubtask}
                />
              )}
              {rightTab === 'workflow' && (
                <WorkflowFeed mainTask={activeMainTask} users={users} getMainTaskWorkflow={getMainTaskWorkflow} />
              )}
              {rightTab === 'files' && (
                <FilesFeed subtask={activeSubtask} getSubtaskComments={getSubtaskComments} users={users} />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f7f8] text-slate-400 p-8">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-600 mb-1">Select a task</p>
          <p className="text-sm text-slate-400">Choose a task from the sidebar to view details</p>
        </div>
      )}

      {hmoPrompt.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-800">
             <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <h3 className="text-[15px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
                   <AlertTriangle className="w-5 h-5 text-indigo-500" /> HMO Policy Renewal
                 </h3>
                 <button onClick={() => setHmoPrompt(p => ({ ...p, isOpen: false }))} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
             </div>
             <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Renewal Start Date</label>
                  <input 
                    type="date" 
                    value={hmoPrompt.startDate} 
                    onChange={e => setHmoPrompt(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Duration (Months)</label>
                  <input 
                    type="number" 
                    value={hmoPrompt.duration} 
                    onChange={e => setHmoPrompt(p => ({ ...p, duration: e.target.value }))}
                    className="w-full h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                  />
                </div>
             </div>
             <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setHmoPrompt(p => ({ ...p, isOpen: false }))} className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Cancel</button>
                <button 
                  onClick={() => {
                     if (!hmoPrompt.duration || !hmoPrompt.startDate) return;
                     const durationVal = parseInt(hmoPrompt.duration) || 12;
                     const expDate = new Date(hmoPrompt.startDate);
                     expDate.setMonth(expDate.getMonth() + durationVal);
                     updateEmployee(hmoPrompt.employeeId, {
                        lashmaRegistrationDate: hmoPrompt.startDate,
                        lashmaExpiryDate: expDate.toISOString().split('T')[0],
                        lashmaDuration: durationVal,
                     });
                     if (hmoPrompt.subtaskId) updateSubtaskStatus(hmoPrompt.subtaskId, 'completed', currentUser?.id);
                     toast.success("HMO Policy renewed successfully!");
                     setHmoPrompt(p => ({ ...p, isOpen: false }));
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Updates Feed ─────────────────────────────────────────────────────────────
function UpdatesFeed({ subtask, mainTask, users, currentUser, postComment, getSubtaskComments, updateSubtaskStatus, addSubtask, addReminder, subtasks, onSelectSubtask }: {
  subtask: SubTask;
  mainTask: MainTask;
  users: AppUser[];
  currentUser: any;
  postComment: any;
  getSubtaskComments: any;
  updateSubtaskStatus: any;
  addSubtask: any;
  addReminder: any;
  subtasks?: SubTask[];
  onSelectSubtask?: (id: string | null) => void;
}) {
  const { updateComment } = useAppData();
  const [text, setText] = useState("");
  const comments = getSubtaskComments(subtask.id);
  const endRef = useRef<HTMLDivElement>(null);

  // Mention State
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  
  // Edit & Reply State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTextContent, setEditTextContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);

  // Attachments State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<{name: string, base64: string}[]>([]);
  const [pendingFileLinks, setPendingFileLinks] = useState<string[]>([]);

  const filteredUsers = users.filter(u => u.id !== currentUser?.id && u.name?.toLowerCase().includes(mentionQuery.toLowerCase()));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    Array.from(e.target.files).forEach(file => {
       const reader = new FileReader();
       reader.onloadend = () => {
         setPendingAttachments(prev => [...prev, { name: file.name, base64: reader.result as string }]);
       };
       reader.readAsDataURL(file);
    });
    e.target.value = ''; // reset so the same file can be selected again
  };

  const handleAttachLink = async (isFolder: boolean) => {
     // In Electron, open a native folder picker — else fall back to a text input overlay workaround
     const electronAPI = (window as any).electronAPI;
     if (electronAPI?.openPathDialog) {
         const result = await electronAPI.openPathDialog({ folder: isFolder, title: isFolder ? 'Select a folder path to link' : 'Select a file path to link' });
         if (result) {
             const paths = Array.isArray(result) ? result : [result];
             setPendingFileLinks(prev => [...prev, ...paths]);
         }
     } else {
         // Web fallback: show a second hidden file input in 'directory' mode
         const inp = document.createElement('input');
         inp.type = 'file';
         if (isFolder) {
             (inp as any).webkitdirectory = true;
         }
         inp.onchange = () => {
             const files = inp.files;
             if (files && files.length > 0) {
                 if (isFolder) {
                     const dir = files[0].webkitRelativePath.split('/')[0] || files[0].name;
                     setPendingFileLinks(prev => [...prev, dir]);
                 } else {
                     Array.from(files).forEach(f => {
                         setPendingFileLinks(prev => [...prev, f.name]);
                     });
                 }
             }
         };
         inp.click();
     }
  };

  const handleSend = () => {
    if ((!text.trim() && pendingAttachments.length === 0 && pendingFileLinks.length === 0) || !currentUser) return;
    // Support both main_task_id (Supabase snake_case) and mainTaskId
    const mainId = (mainTask as any).id || mainTask.id;
    const content = text.trim();

    // Auto status update on first update from "Not Started" to "In Progress"
    if (subtask.status === 'not_started' && comments.length === 0) {
      updateSubtaskStatus(subtask.id, 'in_progress', currentUser.id);
    }

    let finalContent = content;
    if (replyingTo) {
        finalContent = `[reply_to:${replyingTo.id}]\n${content}`;
    }

    // Capture "#" to create a linked subtask
    // Extended syntax: #TaskTitle@AssigneeName!YYYY-MM-DD description text
    // Example: #Fix login bug@Tunde!2026-04-01 check the auth flow
    const hashMatch = content.match(/#([^@!\n.]+)(?:@(\S+))?(?:!(\S+))?(?:[.\s]+(.*))?/is);
    if (hashMatch) {
      const rawTitle = hashMatch[1].trim();
      const rawAssignee = hashMatch[2]?.trim();
      const rawDate = hashMatch[3]?.trim();
      let subtaskDesc = hashMatch[4] ? hashMatch[4].trim() : '';

      // Resolve assignee by first name match
      let assignedTo: string | null = null;
      if (rawAssignee) {
        const match = users.find(u => u.name?.split(' ')[0].toLowerCase() === rawAssignee.toLowerCase());
        if (match) assignedTo = match.id;
      }

      // Validate and parse date token
      let dueDate: string | null = null;
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) dueDate = parsed.toISOString();
      }
      
      if (replyingTo) {
          subtaskDesc = subtaskDesc || `Context:\n${finalContent}`;
      }

      if (rawTitle) {
        addSubtask({
          title: rawTitle,
          description: subtaskDesc,
          mainTaskId: mainId,
          assignedTo,
          dueDate,
          status: 'not_started'
        });
        if (assignedTo) {
          toast.success(`Subtask "${rawTitle}" created${rawAssignee ? ` · assigned to ${rawAssignee}` : ''}${dueDate ? ` · due ${rawDate}` : ''}`);
        }
      }
    }

    // Capture "@" mentions to send notifications via the reminders system
    const mentions = Array.from(finalContent.matchAll(/@(\w+)/g)).map(m => m[1].toLowerCase());
    if (mentions.length > 0) {
      users.forEach(u => {
        const fname = (u.name || "").split(' ')[0].toLowerCase();
        if (mentions.includes(fname) && u.id !== currentUser.id) {
           addReminder({
             title: `Mentioned in Task: ${mainTask.title}`,
             body: `${currentUser.name} mentioned you: "${finalContent.substring(0, 50)}..."`,
             remindAt: new Date().toISOString(),
             recipientIds: [u.id],
             createdBy: currentUser.id,
             mainTaskId: mainId,
             subtaskId: subtask.id,
             isActive: true
           });
        }
      });
    }

    // Pass the attachments directly
    postComment(subtask.id, mainId, currentUser.id, finalContent, pendingAttachments, pendingFileLinks);
    setText("");
    setReplyingTo(null);
    setPendingAttachments([]);
    setPendingFileLinks([]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5 bg-slate-50/40">
        {comments.length === 0 ? (
          <p className="text-sm text-center text-slate-400 py-10">No updates yet. Be the first to post!</p>
        ) : (
          comments.map((c: any) => {
            // Normalize snake_case from Supabase
            const authorId = c.authorId || c.author_id;
            const createdAt = c.createdAt || c.created_at || new Date().toISOString();
            const author = users.find((u: any) => u.id === authorId);
            const isAuthor = authorId === currentUser?.id;
            const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'co-admin';
            const isPast24Hours = (new Date().getTime() - new Date(createdAt).getTime()) > 24 * 60 * 60 * 1000;
            const canEdit = isAdmin || (isAuthor && !isPast24Hours);
            const renderText = (t: string) => {
              return t.split(/(@\w+|#\S+)/g).map((part: string, i: number) => {
                if (part.startsWith('@')) return <span key={i} className="font-semibold text-primary bg-primary/10 px-1 rounded">{part}</span>;
                if (part.startsWith('#')) {
                  const tag = part.slice(1).toLowerCase();
                  // Find the subtask whose title matches this tag (within same main task)
                  const mainTaskId = (subtask as any).main_task_id || subtask.mainTaskId;
                  const linked = subtasks?.find(s => {
                    const sMainId = (s as any).main_task_id || s.mainTaskId;
                    return sMainId === mainTaskId && s.title?.toLowerCase().includes(tag);
                  });
                  if (linked && onSelectSubtask) {
                    return (
                      <button
                        key={i}
                        onClick={() => onSelectSubtask(linked.id!)}
                        className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors text-xs cursor-pointer underline-offset-2 hover:underline"
                        title={`Go to subtask: ${linked.title}`}
                      >
                        {part}
                      </button>
                    );
                  }
                  return <span key={i} className="font-semibold text-emerald-600 bg-emerald-50 px-1 rounded">{part}</span>;
                }
                return <span key={i}>{part}</span>;
              });
            };
            return (
              <div key={c.id} id={`comment-${c.id}`} className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2 relative z-0 group transition-all">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="w-6 h-6 flex-shrink-0">
                      <AvatarImage src={author?.avatarUrl} />
                      <AvatarFallback className={`text-[9px] font-bold text-white ${author?.avatarColor || 'bg-slate-400'}`}>
                        {author?.name?.substring(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-bold text-slate-900 leading-none">{author?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-slate-400 leading-none">@{author?.name?.split(' ')[0] || 'user'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      <button onClick={() => setReplyingTo(c)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Reply"><Reply className="w-3 h-3" /></button>
                      {canEdit && <button onClick={() => { setEditingId(c.id); setEditTextContent(c.text); }} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Edit"><Pencil className="w-3 h-3" /></button>}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {format(new Date(createdAt), "h:mm a")}
                    </span>
                  </div>
                </div>
                {editingId === c.id ? (
                  <div className="mt-1.5">
                    <textarea 
                      value={editTextContent} 
                      onChange={e => setEditTextContent(e.target.value)} 
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20" 
                      rows={2} 
                    />
                    <div className="flex gap-1.5 mt-1 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-[10px] font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1 rounded-md transition-colors">Cancel</button>
                      <button onClick={() => { 
                        if (c.text !== editTextContent) {
                          if (!isAuthor || isPast24Hours) {
                            const mainTaskId = (subtask as any).main_task_id || subtask.mainTaskId;
                            postComment(c.subtask_id || c.subtaskId || subtask.id, mainTaskId, currentUser.id, `⚙️ **Admin Edit Log:** Update by @${author?.name?.split(' ')[0] || 'user'} was edited.\n\n**Original:**\n${c.text}\n\n**New:**\n${editTextContent}`);
                          }
                          updateComment(c.id, editTextContent); 
                        }
                        setEditingId(null); 
                      }} className="text-[10px] font-bold bg-primary text-white px-3 py-1 rounded-md hover:bg-primary/90 transition-colors shadow-sm">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const m = c.text.match(/^\[reply_to:([a-zA-Z0-9.-]+)\]\n([\s\S]*)$/);
                      if (m) {
                        const refId = m[1];
                        const refBody = m[2];
                        const refComm = comments.find((pc: any) => pc.id === refId);
                        const refAuthor = refComm ? users.find((u: any) => u.id === (refComm.authorId || refComm.author_id)) : null;
                        
                        return (
                          <div className="mb-1">
                            <div 
                              onClick={() => {
                                const el = document.getElementById(`comment-${refId}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-1');
                                  setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-1'), 2000);
                                }
                              }}
                              className="mb-1.5 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all flex flex-col gap-0.5 border-l-4 border-l-blue-400"
                            >
                                <span className="text-[9px] font-bold text-blue-700 flex items-center gap-1"><Reply className="w-2.5 h-2.5"/> Reply to {refAuthor?.name || 'Unknown'}</span>
                                <span className="text-[10px] text-slate-500 truncate">{refComm?.text.replace(/^\[reply_to:[^\]]+\]\n/, '') || 'Message deleted'}</span>
                            </div>
                            <p className="text-[12px] text-slate-700 leading-snug whitespace-pre-wrap">{renderText(refBody)}</p>
                          </div>
                        );
                      }
                      
                      return <p className="text-[12px] text-slate-700 leading-snug whitespace-pre-wrap">{renderText(c.text)}</p>;
                    })()}
                    {/* Attachments */}
                    {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.attachments.map((att: any, ai: number) => {
                          const isImg = att.type?.startsWith('image/');
                          return isImg ? (
                            <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                              <img src={att.url} alt={att.name} className="max-w-[160px] max-h-[120px] object-cover" />
                            </a>
                          ) : (
                            <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                              <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                    {/* File path links */}
                    {Array.isArray(c.file_links) && c.file_links.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.file_links.map((lnk: string, li: number) => {
                           const isElectron = !!(window as any).electronAPI;
                           const linkName = lnk.split(/[/\\]/).pop() || lnk;
                           return isElectron ? (
                             <button
                               key={li}
                               onClick={() => (window as any).electronAPI.shellOpenPath(lnk)}
                               className="flex items-center gap-1 px-2 py-1 bg-sky-50 border border-sky-100 rounded-md text-[10px] font-semibold text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer text-left"
                               title={`Open: ${lnk}`}
                             >
                                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-[220px] hover:underline underline-offset-1">{linkName}</span>
                             </button>
                           ) : (
                             <div key={li} className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-700">
                               <LinkIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                               <span className="truncate max-w-[220px]" title={lnk}>{linkName}</span>
                             </div>
                           );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Compose */}
      <div className="p-4 border-t border-border bg-white flex-shrink-0 relative z-20">
        {replyingTo && (
           <div className="mb-3 px-4 py-2 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start justify-between">
              <div className="min-w-0 pr-4">
                 <p className="text-[11px] font-bold text-blue-800 mb-0.5 flex items-center gap-1.5"><Reply className="w-3.5 h-3.5" /> Replying to {users.find(u => u.id === (replyingTo.author_id || replyingTo.authorId))?.name}</p>
                 <p className="text-xs text-blue-700 truncate opacity-80">{replyingTo.text}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-colors"><X className="w-3.5 h-3.5"/></button>
           </div>
        )}

        <div className="relative border border-slate-200 rounded-2xl bg-white focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />

          {(pendingAttachments.length > 0 || pendingFileLinks.length > 0) && (
             <div className="flex flex-wrap gap-2 pt-3 px-4 pb-0">
               {pendingAttachments.map((a, i) => (
                  <div key={`att-${i}`} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                     <Paperclip className="w-3 h-3 text-slate-400" />
                     <span className="truncate max-w-[120px]" title={a.name}>{a.name}</span>
                     <button onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
                  </div>
               ))}
               {pendingFileLinks.map((l, i) => (
                  <div key={`lnk-${i}`} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-medium text-emerald-700">
                     <FolderOpen className="w-3 h-3 text-emerald-400" />
                     <span className="truncate max-w-[120px]" title={l}>{l.split('\\').pop() || l}</span>
                     <button onClick={() => setPendingFileLinks(prev => prev.filter((_, idx) => idx !== i))} className="text-emerald-500 hover:text-red-500 ml-1"><X className="w-3 h-3" /></button>
                  </div>
               ))}
             </div>
          )}

          {/* Mention Popover */}
          {showMention && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 flex flex-col py-1">
              {filteredUsers.slice(0, 5).map((u, idx) => (
                <button
                  key={u.id}
                  onClick={() => {
                     const textarea = document.getElementById(`updates-textarea-${subtask.id}`) as HTMLTextAreaElement;
                     const cursor = textarea?.selectionStart || text.length;
                     const textBefore = text.substring(0, cursor);
                     const match = textBefore.match(/(?:^|\s)@(\w*)$/);
                     if (match) {
                         const mentionStr = `@${u.name.split(" ")[0]}`;
                         const beforeMention = textBefore.substring(0, textBefore.length - match[1].length - 1 + (match[0].startsWith(' ') ? 1 : 0));
                         const afterCursor = text.substring(cursor);
                         setText(beforeMention + mentionStr + " " + afterCursor);
                         setShowMention(false);
                     }
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${idx === mentionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                   <Avatar className="w-6 h-6 flex-shrink-0">
                     <AvatarImage src={u.avatarUrl} />
                     <AvatarFallback className={`text-[9px] font-bold text-white ${u.avatarColor || 'bg-slate-400'}`}>
                       {u.name.substring(0, 2).toUpperCase()}
                     </AvatarFallback>
                   </Avatar>
                   <div className="flex flex-col min-w-0">
                     <span className="font-semibold truncate leading-tight">{u.name}</span>
                     <span className="text-[10px] opacity-60 truncate leading-tight">@{u.name.split(' ')[0].toLowerCase()}</span>
                   </div>
                </button>
              ))}
            </div>
          )}

          <textarea
            id={`updates-textarea-${subtask.id}`}
            value={text}
            onChange={e => {
              const val = e.target.value;
              setText(val);
              const cursor = e.target.selectionStart;
              const textBefore = val.substring(0, cursor);
              const match = textBefore.match(/(?:^|\s)@(\w*)$/);
              if (match) {
                  setShowMention(true);
                  setMentionQuery(match[1]);
                  setMentionIndex(0);
              } else {
                  setShowMention(false);
              }
            }}
            onKeyDown={e => {
              if (showMention && filteredUsers.length > 0) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex(prev => (prev + 1) % Math.min(filteredUsers.length, 5));
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex(prev => (prev - 1 + Math.min(filteredUsers.length, 5)) % Math.min(filteredUsers.length, 5));
                    return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const u = filteredUsers[mentionIndex];
                    if (u) {
                       const textarea = e.target as HTMLTextAreaElement;
                       const cursor = textarea.selectionStart;
                       const textBefore = text.substring(0, cursor);
                       const match = textBefore.match(/(?:^|\s)@(\w*)$/);
                       if (match) {
                           const mentionStr = `@${u.name.split(" ")[0]}`;
                           const beforeMention = textBefore.substring(0, textBefore.length - match[1].length - 1 + (match[0].startsWith(' ') ? 1 : 0));
                           const afterCursor = text.substring(cursor);
                           setText(beforeMention + mentionStr + " " + afterCursor);
                           setShowMention(false);
                       }
                    }
                    return;
                }
                if (e.key === "Escape") {
                    setShowMention(false);
                    return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                handleSend(); 
              }
            }}
            placeholder="Write an update..."
            rows={2}
            className="w-full px-4 py-3 text-sm text-slate-700 bg-transparent resize-none focus:outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
            <div className="flex items-center gap-0.5">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-yellow-600 transition-colors" title="Attach file">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleAttachLink(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-sky-600 transition-colors" title="Link a file on local network">
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleAttachLink(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors" title="Link a folder on local network">
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => {
                 const textarea = document.getElementById(`updates-textarea-${subtask.id}`) as HTMLTextAreaElement;
                 if (textarea) {
                     setText(text + (text.endsWith(' ') || text === '' ? '@' : ' @'));
                     textarea.focus();
                 }
              }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors" title="Mention user">
                <span className="text-sm font-bold">@</span>
              </button>
              <button onClick={() => {
                 const textarea = document.getElementById(`updates-textarea-${subtask.id}`) as HTMLTextAreaElement;
                 if (textarea) {
                     setText(text + (text.endsWith(' ') || text === '' ? '#' : ' #'));
                     textarea.focus();
                 }
              }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" title="Create subtask">
                <Hash className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              disabled={(!text.trim() && pendingAttachments.length === 0 && pendingFileLinks.length === 0)}
              onClick={handleSend}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 px-1">Enter to send · Shift+Enter for new line · @mention · #subtask</p>
      </div>
    </div>
  );
}

// ── Workflow Feed ────────────────────────────────────────────────────────────
function WorkflowFeed({ mainTask, users, getMainTaskWorkflow }: { mainTask: any; users: any[]; getMainTaskWorkflow: any }) {
  const events = mainTask ? getMainTaskWorkflow(mainTask.id) : [];

  // Map the event `type` field from getMainTaskWorkflow to icon/color config
  const eventConfig: Record<string, { color: string; icon: any; bg: string; label: string }> = {
    task_created:          { color: "text-blue-600",   icon: Plus,          bg: "bg-blue-100",   label: "Task Created" },
    subtask_created:       { color: "text-indigo-600", icon: Plus,          bg: "bg-indigo-100", label: "Subtask Added" },
    subtask_assigned:      { color: "text-purple-600", icon: User,          bg: "bg-purple-100", label: "Task Delegated" },
    comment_posted:        { color: "text-slate-600",  icon: MessageSquare, bg: "bg-slate-100",  label: "Update Posted" },
    user_mentioned:        { color: "text-primary",    icon: MessageSquare, bg: "bg-primary/10", label: "User Mentioned" },
    subtask_status_changed:{ color: "text-green-600",  icon: CheckCircle2,  bg: "bg-green-100",  label: "Status Changed" },
    urgent_request:        { color: "text-red-600",    icon: AlertTriangle, bg: "bg-red-100",    label: "Urgent Request" },
    file_attached:         { color: "text-yellow-700", icon: Paperclip,     bg: "bg-yellow-100", label: "File Attached" },
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CheckCircle2 className="w-10 h-10 mb-3 text-slate-200" />
          <p className="text-sm font-medium">No workflow history yet.</p>
          <p className="text-xs mt-1">Activity will appear here as tasks progress.</p>
        </div>
      ) : (
        events.map((e: any, i: number) => {
          // getMainTaskWorkflow returns: { type, actorId, label, createdAt, ... }
          const actorId = e.actorId || e.userId || e.user_id;
          const actor = users.find((x: any) => x.id === actorId);
          const type = e.type || e.eventType || e.event_type || 'comment_posted';
          const config = eventConfig[type] || { color: "text-slate-600", icon: Circle, bg: "bg-slate-100", label: "Activity" };
          const EIcon = config.icon;
          const displayLabel = e.label || config.label;
          const createdAt = e.createdAt || e.created_at || new Date().toISOString();

          // For assignments, show the target user's name
          const targetUser = e.targetUserIds?.length > 0
            ? users.find((x: any) => x.id === e.targetUserIds[0])
            : null;

          return (
            <div key={i} className="flex gap-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-200 transition-colors">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
                <EIcon className="w-4 h-4" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{displayLabel}</p>
                    {actor && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-4 h-4 rounded-full ${actor.avatarColor || 'bg-slate-400'} flex items-center justify-center`}>
                          <span className="text-[7px] font-bold text-white">{actor.name?.substring(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="text-xs text-slate-500">{actor.name}</span>
                        {targetUser && (
                          <>
                            <span className="text-xs text-slate-400">→</span>
                            <div className={`w-4 h-4 rounded-full ${targetUser.avatarColor || 'bg-primary'} flex items-center justify-center`}>
                              <span className="text-[7px] font-bold text-white">{targetUser.name?.substring(0, 2).toUpperCase()}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{targetUser.name}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                    {format(new Date(createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Files Feed ───────────────────────────────────────────────────────────────
function FilesFeed({ subtask, getSubtaskComments, users }: { subtask: any; getSubtaskComments: any; users: any[] }) {
  const comments = getSubtaskComments(subtask.id);
  const files: any[] = [];
  comments.forEach((c: any) => {
    if (c.attachments) c.attachments.forEach((a: any) => files.push({ ...a, comment: c, type: 'attachment' }));
    if (c.fileLinks) c.fileLinks.forEach((f: any) => files.push({ link: f, comment: c, type: 'link' }));
    // Normalize snake_case
    if (c.file_links) c.file_links.forEach((f: any) => files.push({ link: f, comment: c, type: 'link' }));
  });

  const handleOpenFilePath = (filePath: string) => {
    const api = (window as any).electronAPI;
    if (api?.shellOpenPath) api.shellOpenPath(filePath);
    else if (api?.showInFolder) api.showInFolder(filePath);
    else { navigator.clipboard.writeText(filePath).catch(() => {}); toast.success(`Path copied to clipboard:\n${filePath}`); }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
      {files.length === 0 ? (
        <p className="text-sm text-center text-slate-400 py-10">No files attached to this task yet.</p>
      ) : (
        files.map((f, i) => {
          const authorId = f.comment.authorId || f.comment.author_id;
          const author = users.find(u => u.id === authorId);
          if (f.type === 'link') {
            return (
              <div key={i} className="flex flex-col p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 transition-colors shadow-sm group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate pr-2" title={f.link}>{f.link.split('\\').pop() || f.link}</p>
                      <p className="text-[10px] text-slate-400">Shared by {author?.name || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenFilePath(f.link)}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-xl transition-colors shrink-0"
                >
                  Open Path
                </button>
              </div>
            );
          }
          return (
             <div key={i} className="flex flex-col p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 transition-colors shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate pr-2" title={f.name}>{f.name}</p>
                      <p className="text-[10px] text-slate-400">Attached by {author?.name || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
                <a
                  href={f.base64}
                  download={f.name}
                  className="w-full py-2 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-xl transition-colors shrink-0"
                >
                  Download File
                </a>
             </div>
          );
        })
      )}
    </div>
  );
}

// ── Multi-Assign Dropdown ───────────────────────────────────────────────────
function AssignMultiDropdown({ activeSubtask, activeMainTask, users, currentUser, assignSubtask, addSubtask }: any) {
  const { subtasks } = useAppData();
  
  const currentAssignees = activeSubtask.assignedTo ? activeSubtask.assignedTo.split(',') : [];

  const toggleAssignee = (uid: string) => {
      let newAssignees = [...currentAssignees];
      if (newAssignees.includes(uid)) {
          // Unassign
          newAssignees = newAssignees.filter(id => id !== uid);
      } else {
          // Assign
          newAssignees.push(uid);
      }
      assignSubtask(activeSubtask.id, newAssignees.length > 0 ? newAssignees.join(',') : null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
          <User className="w-3.5 h-3.5" /> Assign <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-[400px] overflow-y-auto">
        <div className="p-2 text-[11px] font-medium text-slate-400 bg-slate-50 border-b mb-1 uppercase tracking-wider">
          Assign Team Members
        </div>
        <DropdownMenuItem onClick={() => assignSubtask(activeSubtask.id, "")} className="cursor-pointer text-slate-500 font-medium italic mb-1">
          Unassigned
        </DropdownMenuItem>
        {users.map((u: any) => {
          const isSelected = currentAssignees.includes(u.id);
          
          return (
            <DropdownMenuItem
              key={u.id}
              className="flex items-center gap-2 cursor-pointer py-2"
              onClick={(e) => { e.preventDefault(); toggleAssignee(u.id); }}
            >
              <div className="flex items-center justify-center w-4 h-4 border border-slate-200 rounded shadow-sm mr-1">
                 {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              </div>
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarImage src={u.avatarUrl} />
                <AvatarFallback className={`text-[9px] font-bold text-white ${u.avatarColor || 'bg-slate-400'}`}>
                  {u.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={`${isSelected ? 'font-bold text-primary' : 'font-medium text-slate-600'} text-sm`}>{u.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
