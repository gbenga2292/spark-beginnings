import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { format, isPast } from "date-fns";
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import {
  Search, Circle, Loader2, CheckCircle2, AlertTriangle,
  User, Calendar, Clock, ChevronDown, ChevronRight,
  MessageSquare, Hash, Paperclip, Send, FolderOpen, X,
  ArrowRight, ArrowLeft, Plus, Hourglass, FileText, FileSpreadsheet, Presentation
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
  const { user: currentUser } = useAuth();
  const { updateSubtaskStatus, postComment, getSubtaskComments, addSubtask, assignSubtask, getMainTaskWorkflow } = useAppData();

  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<"updates" | "workflow" | "files">("updates");

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

  // Expand all groups on first load
  useEffect(() => {
    if (expandedGroups.size === 0 && groupedTasks.length > 0) {
      setExpandedGroups(new Set(groupedTasks.map(g => g.mainTask!.id)));
    }
  }, [groupedTasks]);

  // Flatten EVERYTHING bypassing search filter for Prev/Next navigation strictly structurally
  const allFlatSubtasks = useMemo(() => {
    const sortedMain = [...mainTasks].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const result: SubTask[] = [];
    sortedMain.forEach(m => {
      const ms = subtasks.filter(s => ((s as any).main_task_id || s.mainTaskId) === m.id);
      result.push(...ms);
    });
    return result;
  }, [mainTasks, subtasks]);

  // Flatten only the currently searched groups for display count
  const flatSubtasks = useMemo(() => groupedTasks.flatMap(g => g.subs), [groupedTasks]);

  // Auto-select first task if nothing is selected
  useEffect(() => {
    if (!activeSubtaskId && flatSubtasks.length > 0 && flatSubtasks[0]?.id) {
      onSelectSubtask(flatSubtasks[0].id!);
    }
  }, [flatSubtasks]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const activeSubtask = subtasks.find(s => s.id === activeSubtaskId) ?? null;
  // Normalize mainTaskId for Supabase snake_case
  const activeMainTaskId = activeSubtask ? ((activeSubtask as any).main_task_id || activeSubtask.mainTaskId) : null;
  const activeMainTask = activeMainTaskId ? mainTasks.find(m => m.id === activeMainTaskId) ?? null : null;
  const activeAssignee = activeSubtask?.assignedTo ? users.find(u => u.id === activeSubtask.assignedTo) ?? null : null;

  const activeIndex = activeSubtask ? allFlatSubtasks.findIndex(s => s.id === activeSubtask.id) : -1;
  const navigateSubtask = (dir: 1 | -1) => {
    const nextItem = allFlatSubtasks[activeIndex + dir];
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
            groupedTasks.map(({ mainTask, subs }) => (
              <div key={mainTask!.id} className="mb-1">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(mainTask!.id)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${expandedGroups.has(mainTask!.id) ? '' : '-rotate-90'}`}
                    />
                    <span className="text-[13px] font-semibold text-slate-700 truncate">{mainTask!.title}</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 flex-shrink-0 ml-1">({subs.length})</span>
                </button>

                {/* Subtask List */}
                {expandedGroups.has(mainTask!.id) && (
                  <div className="pl-1 pr-2 space-y-0.5">
                    {subs.map(sub => {
                      const isActive = sub.id === activeSubtaskId;
                      const isOverdue = sub.deadline && isPast(new Date(sub.deadline)) && sub.status !== 'completed';
                      const sc = statusConfig[sub.status];

                      return (
                        <button
                          key={sub.id}
                          onClick={() => onSelectSubtask(sub.id!)}
                          className={`group relative w-full flex items-center justify-between pl-6 pr-3 py-2.5 rounded-xl text-left transition-all
                            ${isActive ? 'bg-primary/10' : 'hover:bg-slate-50'}
                          `}
                        >
                          {/* Active indicator */}
                          {isActive && <div className="absolute left-2 top-2 bottom-2 w-1 bg-primary rounded-full" />}

                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox */}
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                              ${sub.status === 'completed' ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary/60'}
                            `}>
                              {sub.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[13px] font-medium truncate ${
                                sub.status === 'completed' ? 'line-through text-slate-400' :
                                isActive ? 'text-primary' : 'text-slate-700'
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

                    {/* Add Task */}
                    <button
                      onClick={() => addSubtask({ title: "New Task", mainTaskId: mainTask!.id, description: "" })}
                      className="w-full flex items-center gap-2 pl-7 pr-3 py-2 text-[12px] font-medium text-slate-400 hover:text-primary transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Task
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── MIDDLE + RIGHT AREA ───────────────────────────────────────────── */}
      {activeSubtask && activeMainTask ? (
        <div className="flex-1 flex overflow-hidden min-w-0">

          {/* MIDDLE: Task Detail */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f8]">
            {/* Top nav */}
            <div className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
              <div className="flex items-center gap-4 text-sm font-semibold text-slate-400">
                <button
                  onClick={() => navigateSubtask(-1)}
                  disabled={activeIndex <= 0}
                  className="flex items-center gap-1.5 hover:text-slate-700 transition-colors disabled:opacity-30"
                >
                  <ArrowLeft className="w-4 h-4" /> Previous Task
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <button
                  onClick={() => navigateSubtask(1)}
                  disabled={activeIndex >= allFlatSubtasks.length - 1 || activeIndex === -1}
                  className="flex items-center gap-1.5 hover:text-slate-700 transition-colors disabled:opacity-30"
                >
                  Next Task <ArrowRight className="w-4 h-4" />
                </button>
              </div>
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
                  <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                    <CheckCircle2 className="w-4 h-4" /> Preview
                  </button>
                </div>

                {/* Action Pills */}
                <div className="flex items-center gap-3 flex-wrap mb-8">
                  {activeSubtask.deadline && isPast(new Date(activeSubtask.deadline)) && activeSubtask.status !== 'completed' && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                    </span>
                  )}

                  {/* Status pill — clickable buttons for status change */}
                  {(['not_started', 'in_progress', 'completed'] as SubTaskStatus[]).map(s => {
                    const sc = statusConfig[s];
                    const SIcon = sc.icon;
                    const isActive = activeSubtask.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => currentUser && updateSubtaskStatus(activeSubtask.id!, s, currentUser.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isActive ? sc.pillClass + ' ring-2 ring-offset-1 ring-primary/30' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <SIcon className="w-3.5 h-3.5" /> {sc.label}
                      </button>
                    );
                  })}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
                        <User className="w-3.5 h-3.5" /> Assign <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 max-h-[300px] overflow-y-auto">
                      <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b mb-1">
                        Select an assignee for this subtask:
                      </div>
                      <DropdownMenuItem onClick={() => assignSubtask(activeSubtask.id!, "")} className="cursor-pointer text-slate-500 font-medium italic">
                        Unassigned
                      </DropdownMenuItem>
                      {users.filter(u => !u.isDeleted && !u.isSuspended).map(u => (
                        <DropdownMenuItem
                          key={u.id}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => assignSubtask(activeSubtask.id!, u.id)}
                        >
                          <Avatar className="w-5 h-5 flex-shrink-0">
                            <AvatarImage src={u.avatarUrl} />
                            <AvatarFallback className={`text-[8px] text-white ${u.avatarColor || 'bg-slate-400'}`}>
                              {u.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`${activeSubtask.assignedTo === u.id ? 'font-bold text-primary' : 'font-medium'}`}>{u.name}</span>
                          {activeSubtask.assignedTo === u.id && <CheckCircle2 className="w-3 h-3 text-primary ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                            onClick={() => currentUser && updateSubtaskStatus(activeSubtask.id!, status, currentUser.id)}
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
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    {activeAssignee ? (
                      <>
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={activeAssignee.avatarUrl} />
                          <AvatarFallback className={`text-[9px] text-white ${activeAssignee.avatarColor}`}>
                            {activeAssignee.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {activeAssignee.name}
                      </>
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

                {/* Description card */}
                {activeSubtask.description && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm mb-8">
                    <MessageSquare className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{activeSubtask.description}</p>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* RIGHT: Updates Panel */}
          <div className="w-[340px] flex-shrink-0 bg-white border-l border-border flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border flex-shrink-0">
              {(['updates', 'workflow', 'files'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 py-4 text-xs font-bold capitalize tracking-wide relative transition-colors ${
                    rightTab === tab ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {tab}
                  {rightTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              ))}
            </div>

            {rightTab === 'updates' && (
              <UpdatesFeed
                subtask={activeSubtask}
                mainTask={activeMainTask}
                users={users}
                currentUser={currentUser}
                postComment={postComment}
                getSubtaskComments={getSubtaskComments}
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
    </div>
  );
}

// ── Updates Feed ─────────────────────────────────────────────────────────────
function UpdatesFeed({ subtask, mainTask, users, currentUser, postComment, getSubtaskComments }: {
  subtask: SubTask;
  mainTask: MainTask;
  users: AppUser[];
  currentUser: any;
  postComment: any;
  getSubtaskComments: any;
}) {
  const [text, setText] = useState("");
  const comments = getSubtaskComments(subtask.id);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSend = () => {
    if (!text.trim() || !currentUser) return;
    // Support both main_task_id (Supabase snake_case) and mainTaskId
    const mainId = (mainTask as any).id || mainTask.id;
    postComment(subtask.id, mainId, currentUser.id, text.trim(), [], undefined);
    setText("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
        {comments.length === 0 ? (
          <p className="text-sm text-center text-slate-400 py-10">No updates yet. Be the first to post!</p>
        ) : (
          comments.map((c: any) => {
            // Normalize snake_case from Supabase
            const authorId = c.authorId || c.author_id;
            const createdAt = c.createdAt || c.created_at || new Date().toISOString();
            const author = users.find((u: any) => u.id === authorId);
            const renderText = (t: string) => {
              return t.split(/(@\w+|#\S+)/g).map((part: string, i: number) => {
                if (part.startsWith('@')) return <span key={i} className="font-semibold text-primary">{part}</span>;
                if (part.startsWith('#')) return <span key={i} className="font-semibold text-emerald-600">{part}</span>;
                return <span key={i}>{part}</span>;
              });
            };
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarImage src={author?.avatarUrl} />
                      <AvatarFallback className={`text-xs font-bold text-white ${author?.avatarColor || 'bg-slate-400'}`}>
                        {author?.name?.substring(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{author?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-slate-400">@{author?.name?.split(' ')[0] || 'user'}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {format(new Date(createdAt), "h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{renderText(c.text)}</p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Compose */}
      <div className="p-4 border-t border-border bg-white flex-shrink-0">
        <div className="relative border border-slate-200 rounded-2xl bg-white overflow-hidden focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Write an update..."
            rows={2}
            className="w-full px-4 py-3 text-sm text-slate-700 bg-transparent resize-none focus:outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
            <div className="flex items-center gap-0.5">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-yellow-600 transition-colors" title="Attach file">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors" title="Mention user">
                <span className="text-sm font-bold">@</span>
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors" title="Create subtask">
                <Hash className="w-3.5 h-3.5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors" title="File path">
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              disabled={!text.trim()}
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
