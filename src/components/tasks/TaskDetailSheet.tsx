import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/src/components/task_ui/sheet";
import {
  Circle, Loader2, CheckCircle2, Calendar, User, MessageSquare,
  Send, X, Hash, Plus, GitBranch, AlertTriangle, Paperclip,
  FileText, FileSpreadsheet, Presentation, Download, Clock, ThumbsUp, ThumbsDown, Hourglass,
  FolderOpen, Link, ChevronDown,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import type { SubTask, SubTaskStatus, TaskComment, AppUser, CommentAttachment, WorkflowEvent } from "@/src/types/tasks";

const statusConfig: Record<SubTaskStatus, { label: string; pillClass: string; icon: React.ElementType }> = {
  not_started: { label: "Not Started", pillClass: "chip-pending", icon: Circle },
  in_progress: { label: "In Progress", pillClass: "chip-in-progress", icon: Loader2 },
  pending_approval: { label: "Pending Approval", pillClass: "chip-pending-approval", icon: Hourglass },
  completed: { label: "Completed", pillClass: "chip-completed", icon: CheckCircle2 },
};

// ── Allowed file types ────────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = [".docx", ".xlsx", ".pptx"];
const ALLOWED_MIME = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function getFileType(name: string): "docx" | "xlsx" | "pptx" | null {
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".pptx")) return "pptx";
  return null;
}

const fileIcons: Record<string, React.ElementType> = {
  docx: FileText,
  xlsx: FileSpreadsheet,
  pptx: Presentation,
};
const fileColors: Record<string, string> = {
  docx: "text-blue-600 bg-blue-50 border-blue-200",
  xlsx: "text-green-600 bg-green-50 border-green-200",
  pptx: "text-orange-600 bg-orange-50 border-orange-200",
};

// ── Workflow event config ─────────────────────────────────────────────────────
const eventConfig: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
  task_created: { color: "text-blue-600", icon: Plus, bg: "bg-blue-100" },
  subtask_created: { color: "text-indigo-600", icon: Plus, bg: "bg-indigo-100" },
  subtask_assigned: { color: "text-purple-600", icon: User, bg: "bg-purple-100" },
  comment_posted: { color: "text-gray-600", icon: MessageSquare, bg: "bg-gray-100" },
  subtask_status_changed: { color: "text-green-600", icon: CheckCircle2, bg: "bg-green-100" },
  urgent_request: { color: "text-red-600", icon: AlertTriangle, bg: "bg-red-100" },
  file_attached: { color: "text-yellow-700", icon: Paperclip, bg: "bg-yellow-100" },
};

interface TaskDetailSheetProps {
  subtaskId: string | null;
  onClose: () => void;
}

type TabType = "updates" | "workflow";

export function TaskDetailSheet({ subtaskId, onClose }: TaskDetailSheetProps) {
  const { user: currentUser } = useAuth();
  const {
    subtasks, mainTasks, users,
    updateSubtaskStatus, approveSubtask, rejectSubtask,
    postComment, getSubtaskComments, getMainTaskWorkflow,
  } = useAppData();

  const [tab, setTab] = useState<TabType>("updates");
  const [text, setText] = useState("");
  const [approvalNote, setApprovalNote] = useState(""); // feedback note for approve/reject
  const [pendingAttachments, setPendingAttachments] = useState<CommentAttachment[]>([]);
  const [pendingFileLinks, setPendingFileLinks] = useState<string[]>([]);
  const [showPathInput, setShowPathInput] = useState(false);
  const [pathInputValue, setPathInputValue] = useState("");
  const [uploadError, setUploadError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  // ── @ mention autocomplete state ─────────────────────────────────────────
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);

  const subtask = subtasks.find((s) => s.id === subtaskId) ?? null;
  const mainTask = subtask ? mainTasks.find((m) => m.id === subtask.mainTaskId) ?? null : null;
  const assignee = subtask ? users.find((u) => u.id === subtask.assignedTo) ?? null : null;
  const creator = mainTask ? users.find((u) => u.id === mainTask.createdBy) ?? null : null;
  const comments = subtaskId ? getSubtaskComments(subtaskId) : [];
  const workflowEvents = mainTask ? getMainTaskWorkflow(mainTask.id) : [];
  const activeUsers = users.filter((u) => !u.isDeleted && !u.isSuspended && (u.teamId === (currentUser as any)?.teamId || u.workspaceIds?.some(id => currentUser?.workspaceIds?.includes(id))));

  const mentionResults: AppUser[] = mentionQuery !== null
    ? activeUsers.filter((u) =>
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      u.name.split(" ")[0].toLowerCase().startsWith(mentionQuery.toLowerCase())
    ).slice(0, 6)
    : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  useEffect(() => { setMentionIndex(0); }, [mentionQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── selectMention must be defined BEFORE the early return (Rules of Hooks) ──
  const selectMention = (user: AppUser) => {
    const firstName = user.name.split(" ")[0];
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    const newText = `${before}@${firstName} ${after}`;
    setText(newText);
    setMentionQuery(null);
    const newCaret = before.length + firstName.length + 2;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCaret, newCaret);
      }
    });
  };

  if (!subtask || !mainTask) return null;

  const sc = statusConfig[subtask.status];
  const StatusIcon = sc.icon;
  const isOverdue = subtask.deadline && isPast(new Date(subtask.deadline)) && subtask.status !== "completed";
  const isCreator = mainTask.createdBy === currentUser?.id;
  const isAssignee = subtask.assignedTo === currentUser?.id;

  // ── Text change & @ detection ─────────────────────────────────────────
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const caret = e.target.selectionStart ?? val.length;
    setText(val);
    const textBeforeCaret = val.slice(0, caret);
    const atMatch = textBeforeCaret.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(caret - atMatch[0].length);
    } else {
      setMentionQuery(null);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionResults.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectMention(mentionResults[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !currentUser) return;
    postComment(subtask.id, subtask.mainTaskId, currentUser.id, trimmed, pendingAttachments, pendingFileLinks.length > 0 ? pendingFileLinks : undefined);
    setText("");
    setPendingAttachments([]);
    setPendingFileLinks([]);
    setShowPathInput(false);
    setPathInputValue("");
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  // ── Add file path link ──────────────────────────────────────────────────────
  const handleAddFilePath = () => {
    const trimmed = pathInputValue.trim();
    if (!trimmed) return;
    setPendingFileLinks(prev => [...prev, trimmed]);
    setPathInputValue("");
    setShowPathInput(false);
  };

  const handleOpenFilePath = (filePath: string) => {
    const api = (window as any).electronAPI;
    if (api?.showInFolder) {
      api.showInFolder(filePath);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(filePath).catch(() => { });
      alert(`Path copied to clipboard:\n${filePath}`);
    }
  };
  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError("");
    const files = Array.from(e.target.files ?? []);
    const newAttachments: CommentAttachment[] = [];

    files.forEach((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME.includes(file.type)) {
        setUploadError(`"${file.name}" is not allowed. Only .docx, .xlsx, .pptx files.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setUploadError(`"${file.name}" exceeds the 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        const fileType = getFileType(file.name.toLowerCase()) ?? "docx";
        setPendingAttachments((prev) => [
          ...prev,
          { name: file.name, type: fileType, sizeBytes: file.size, base64 },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const insertHash = () => { setText((t) => t + "#"); textareaRef.current?.focus(); };

  return (
    <Sheet open={!!subtaskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-card border-l border-border w-full sm:max-w-lg overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <SheetHeader className="px-5 pt-4 pb-0 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3 pb-3">
            <div className="min-w-0 flex-1">
              {/* Status pill + overdue on same line as close button */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 w-max ${sc.pillClass}`}>
                  <StatusIcon className="w-2.5 h-2.5" />{sc.label}
                </span>
                {isOverdue && <span className="text-[10px] text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">⚠ Overdue</span>}
              </div>
              <SheetTitle className="text-foreground text-[15px] font-semibold leading-snug">{subtask.title}</SheetTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                In <span className="font-medium text-foreground/80">{mainTask.title}</span>
                {assignee && <> · <span className="text-foreground/70">{assignee.name.split(' ')[0]}</span></>}
                {subtask.deadline && <> · <span className={isOverdue ? 'text-destructive font-medium' : ''}>{format(new Date(subtask.deadline), 'MMM d, yyyy')}</span></>}
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground flex-shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 -mb-px">
            {(["updates", "workflow"] as TabType[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`relative px-4 py-2 text-[11px] font-medium capitalize transition-colors
                  ${tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "updates" ? (
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3" />Updates{comments.length > 0 && <span className="ml-0.5 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{comments.length}</span>}</span>
                ) : (
                  <span className="flex items-center gap-1.5"><GitBranch className="w-3 h-3" />Workflow{workflowEvents.length > 0 && <span className="ml-0.5 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{workflowEvents.length}</span>}</span>
                )}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">

          {/* Compact meta strip */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {assignee
                ? <div className="flex items-center gap-1"><div className={`w-4 h-4 rounded-full ${assignee.avatarColor} flex items-center justify-center text-white text-[8px] font-bold`}>{assignee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div><span className="font-medium text-foreground">{assignee.name}</span></div>
                : <span className="italic">Unassigned</span>}
            </div>
            {subtask.deadline && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-semibold' : ''}`}>
                <Calendar className="w-3 h-3" />
                {format(new Date(subtask.deadline), 'MMM d, yyyy')}
              </div>
            )}
            {creator && (
              <div className="flex items-center gap-1 ml-auto">
                <div className={`w-4 h-4 rounded-full ${creator.avatarColor} flex items-center justify-center text-white text-[8px] font-bold`}>{creator.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>
                <span>{creator.name.split(' ')[0]}</span>
              </div>
            )}
          </div>

          {/* Description — collapsed to 2 lines with expand toggle */}
          {subtask.description && (
            <p className="text-[13px] text-foreground/80 leading-relaxed line-clamp-2">{subtask.description}</p>
          )}

          {/* ── Status section — collapsible ── */}
          <details className="group" open>
            <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">Status</p>
              <ChevronDown className="w-3 h-3 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>

            {/* ── COMPLETED & LOCKED ── */}
            {subtask.status === 'completed' && (
              <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/60 dark:bg-green-950/20 p-3 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-800 dark:text-green-400">Task Completed &amp; Approved</p>
                  <p className="text-[11px] text-green-600 dark:text-green-500 mt-0.5">
                    This task has been finalised. Status is locked to reflect the approval outcome.
                  </p>
                </div>
                {/* Only admins can reopen */}
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => updateSubtaskStatus(subtask.id, 'in_progress', currentUser.id)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg border border-green-300 dark:border-green-800 text-[11px] font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                    title="Admin: reopen this completed task"
                  >
                    Reopen
                  </button>
                )}
              </div>
            )}

            {/* PENDING APPROVAL banner — visible to everyone */}
            {subtask.status === 'pending_approval' && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-3">
                <Hourglass className="w-4 h-4 text-amber-600 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800">Awaiting creator's approval</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    {isCreator
                      ? 'This task is waiting for you to approve or reject.'
                      : `Submitted for completion — ${creator?.name ?? 'the task creator'} needs to approve.`}
                  </p>
                </div>
              </div>
            )}

            {/* CREATOR: Feedback form + Approve / Reject when pending */}
            {subtask.status === 'pending_approval' && isCreator && (
              <div className="mb-3 rounded-xl border border-amber-200/50 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 overflow-hidden">
                <div className="px-3 pt-3 pb-2">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-500 mb-1.5">Your feedback (required)</p>
                  <textarea
                    value={approvalNote}
                    onChange={e => setApprovalNote(e.target.value)}
                    placeholder="Write feedback for the assignee — what looks good, what needs work, approval notes…"
                    rows={3}
                    className="w-full text-xs rounded-lg border border-amber-200/50 dark:border-amber-900/50 bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-medium ${approvalNote.trim().length === 0
                      ? 'text-muted-foreground'
                      : approvalNote.trim().length < 5
                        ? 'text-destructive'
                        : 'text-green-600 dark:text-green-500'
                      }`}>
                      {approvalNote.trim().length === 0
                        ? 'Feedback is required before approving or rejecting'
                        : approvalNote.trim().length < 5
                          ? 'Too short — please write a meaningful note'
                          : '✓ Ready to submit'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{approvalNote.length} chars</span>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex gap-0 border-t border-amber-100">
                  <button
                    disabled={approvalNote.trim().length < 5}
                    onClick={() => {
                      approveSubtask(subtask.id, currentUser!.id, approvalNote.trim());
                      setApprovalNote("");
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-amber-100"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    disabled={approvalNote.trim().length < 5}
                    onClick={() => {
                      rejectSubtask(subtask.id, currentUser!.id, approvalNote.trim());
                      setApprovalNote("");
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Send Back
                  </button>
                </div>
              </div>
            )}

            {/* Status toggle buttons — only when NOT pending or completed */}
            {subtask.status !== 'pending_approval' && subtask.status !== 'completed' && (
              <div className="flex gap-2">
                {/* Forward-only: Not Started & In Progress — assignee/admin only */}
                {(['not_started', 'in_progress'] as SubTaskStatus[]).map((s) => {
                  const cfg = statusConfig[s]; const SIcon = cfg.icon; const isActive = subtask.status === s;
                  const canChange = isAssignee || isCreator || currentUser?.role === 'admin';
                  // Prevent moving backwards: if already in_progress, disable not_started for non-admins
                  const isBackwards = s === 'not_started' && subtask.status === 'in_progress' && currentUser?.role !== 'admin';
                  return (
                    <button key={s}
                      disabled={!canChange || isBackwards}
                      onClick={() => updateSubtaskStatus(subtask.id, s, currentUser?.id ?? '')}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                        ${isActive ? `${cfg.pillClass} ring-1 ring-primary/30 bg-primary/10 text-primary border-primary/20` : 'border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'}`}
                      title={isBackwards ? 'Cannot move backwards — task is already in progress' : undefined}>
                      <SIcon className="w-3 h-3" />{cfg.label}
                    </button>
                  );
                })}

                {/* Submit for Approval / Mark Complete */}
                {isCreator || currentUser?.role === 'admin' ? (
                  <button
                    onClick={() => updateSubtaskStatus(subtask.id, 'completed', currentUser!.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border border-border text-muted-foreground hover:bg-muted transition-all">
                    <CheckCircle2 className="w-3 h-3" />Completed
                  </button>
                ) : isAssignee ? (
                  <button
                    onClick={() => updateSubtaskStatus(subtask.id, 'completed', currentUser!.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 transition-all">
                    <CheckCircle2 className="w-3 h-3" />Submit for Approval
                  </button>
                ) : (
                  <button disabled
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border border-border text-muted-foreground/40 cursor-not-allowed">
                    <CheckCircle2 className="w-3 h-3" />Completed
                  </button>
                )}
              </div>
            )}

            {!isAssignee && !isCreator && currentUser?.role !== 'admin' && subtask.status !== 'completed' && (
              <p className="text-[11px] text-gray-400 mt-1.5">Only the assigned user or task creator can change status.</p>
            )}
          </details>

          <div className="border-t border-border/50" />

          {/* ── UPDATES TAB ── */}
          {tab === "updates" && (
            <div>
              {/* Collapsible syntax hint */}
              <details className="group mb-3">
                <summary className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-primary/70 hover:text-primary select-none list-none">
                  <MessageSquare className="w-3 h-3" />
                  Quick shortcuts
                  <ChevronDown className="w-3 h-3 ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 p-3 bg-primary/5 border border-primary/15 rounded-xl text-[11px] text-primary space-y-1">
                  <p><code className="bg-primary/20 px-1 rounded">@Name</code> — mention &amp; notify a team member</p>
                  <p><code className="bg-primary/20 px-1 rounded">@Name #Task title</code> — creates an <strong>urgent info request</strong> subtask</p>
                  <p><code className="bg-primary/20 px-1 rounded">📎</code> — attach Word, Excel, or PowerPoint files</p>
                </div>
              </details>

              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No updates yet. Post the first one below.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <CommentBubble key={c.id} comment={c} users={activeUsers} currentUserId={currentUser?.id ?? ""} subtasks={subtasks} />
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          )}

          {/* ── WORKFLOW TAB ── */}
          {tab === "workflow" && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-4">Full task delegation chain for <strong>{mainTask.title}</strong></p>
              {workflowEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No workflow events yet.</p>
              ) : (
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {workflowEvents.map((ev, i) => {
                      const cfg = eventConfig[ev.type] ?? eventConfig.comment_posted;
                      const EvIcon = cfg.icon;
                      const actor = users.find((u) => u.id === ev.actorId);
                      const targets = ev.targetUserIds.map((tid) => users.find((u) => u.id === tid)).filter(Boolean) as AppUser[];
                      return (
                        <div key={ev.id} className="flex gap-3 relative">
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.bg} z-10`}>
                            {ev.isUrgent
                              ? <AlertTriangle className="w-4 h-4 text-red-600" />
                              : <EvIcon className={`w-4 h-4 ${cfg.color}`} />}
                          </div>
                          <div className="flex-1 min-w-0 pb-4">
                            <p className={`text-sm font-medium ${ev.isUrgent ? "text-red-500" : "text-foreground"}`}>
                              {ev.isUrgent && <span className="mr-1">🚨</span>}{ev.label}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              {actor && (
                                <span className="flex items-center gap-1">
                                  <div className={`w-4 h-4 rounded-full ${actor.avatarColor} flex items-center justify-center text-white text-[8px] font-bold`}>
                                    {actor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <span>{actor.name.split(" ")[0]}</span>
                                </span>
                              )}
                              {targets.length > 0 && <span className="text-muted-foreground/60">→</span>}
                              {targets.map((t) => (
                                <span key={t.id} className="flex items-center gap-1">
                                  <div className={`w-4 h-4 rounded-full ${t.avatarColor} flex items-center justify-center text-white text-[8px] font-bold`}>
                                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <span>{t.name.split(" ")[0]}</span>
                                </span>
                              ))}
                              <span className="text-muted-foreground/60">·</span>
                              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{format(new Date(ev.createdAt), "MMM d, h:mm a")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Compose footer (only on updates tab) ── */}
        {tab === "updates" && (
          <div className="px-5 pt-4 pb-8 border-t border-border flex-shrink-0 bg-card">
            {/* Pending file path links */}
            {pendingFileLinks.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {pendingFileLinks.map((fp, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700">
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                    <span className="flex-1 truncate font-mono text-[11px]">{fp}</span>
                    <button onClick={() => setPendingFileLinks(prev => prev.filter((_, j) => j !== i))} className="text-emerald-400 hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File path input panel */}
            {showPathInput && (
              <div className="mb-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <p className="text-[11px] font-semibold text-emerald-800 mb-1.5 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" /> Attach File Location
                </p>
                <p className="text-[10px] text-emerald-600/80 mb-2">
                  Paste a network path (e.g. <code className="bg-emerald-100 px-1 rounded">\\Server\Share\File.xlsx</code>) or local path. Anyone on the same network can click to open it in File Explorer.
                </p>
                <div className="flex gap-2">
                  <input
                    ref={pathInputRef}
                    autoFocus
                    type="text"
                    value={pathInputValue}
                    onChange={e => setPathInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddFilePath(); } if (e.key === 'Escape') { setShowPathInput(false); setPathInputValue(''); } }}
                    placeholder="\\Server\Share\Folder\File.xlsx"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-emerald-200 bg-white text-foreground font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  />
                  <button
                    onClick={handleAddFilePath}
                    disabled={!pathInputValue.trim()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40"
                  >
                    Attach
                  </button>
                  <button
                    onClick={() => { setShowPathInput(false); setPathInputValue(''); }}
                    className="px-2 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Pending file attachments (.docx/.xlsx/.pptx) */}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAttachments.map((att, idx) => {
                  const FIcon = fileIcons[att.type] ?? FileText;
                  return (
                    <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${fileColors[att.type] ?? "text-muted-foreground bg-muted border-border"}`}>
                      <FIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{att.name}</span>
                      <button onClick={() => removeAttachment(idx)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {uploadError && (
              <p className="text-xs text-red-500 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{uploadError}</p>
            )}

            {/* @ mention autocomplete popup */}
            {mentionQuery !== null && mentionResults.length > 0 && (
              <div ref={mentionRef} className="mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mention a teammate</span>
                </div>
                <ul>
                  {mentionResults.map((u, i) => (
                    <li key={u.id}>
                      <button type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectMention(u); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === mentionIndex ? "bg-primary/10" : "hover:bg-muted"}`}>
                        <div className={`w-7 h-7 rounded-full ${u.avatarColor} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className="ml-auto text-[10px] text-muted-foreground/60 capitalize">{u.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Post an update… use @Name or #Subtask"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm text-foreground rounded-xl border border-border bg-card resize-none
                    placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all pr-20"
                />
                {/* Quick insert icons */}
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.xlsx,.pptx"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => { setShowPathInput(p => !p); setPathInputValue(''); }}
                    title="Attach a file path / network location"
                    className={`w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors ${showPathInput ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:text-emerald-600'}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setUploadError(""); fileInputRef.current?.click(); }}
                    title="Attach file (Word, Excel, PowerPoint)"
                    className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-yellow-600 transition-colors">
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={insertHash} title="Create a subtask"
                    className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                    <Hash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <button onClick={handleSend} disabled={!text.trim()}
                className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 mb-0.5">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 pb-1">Enter to send · @Name mention · 📁 file path · 📎 file attach</p>

          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Comment bubble ── */
function CommentBubble({ comment, users, currentUserId, subtasks }: {
  comment: TaskComment; users: AppUser[];
  currentUserId: string; subtasks: SubTask[];
}) {
  const author = users.find((u) => u.id === comment.authorId);
  const isMe = comment.authorId === currentUserId;
  const createdSub = comment.createdSubtaskId
    ? subtasks.find((s) => s.id === comment.createdSubtaskId)
    : null;

  const renderText = (text: string) => {
    const parts = text.split(/(@\w+|#.+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) return <span key={i} className={`font-semibold ${isMe ? "text-blue-200" : "text-blue-600"}`}>{part}</span>;
      if (part.startsWith("#")) return <span key={i} className={`font-semibold ${isMe ? "text-green-200" : "text-green-600"}`}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full ${author?.avatarColor ?? "bg-gray-400"} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5`}>
        {author?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "?"}
      </div>
      <div className={`flex-1 max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${isMe ? "flex-row-reverse" : ""}`}>
          <span className="font-medium text-foreground/80">{isMe ? "You" : author?.name ?? "Unknown"}</span>
          <span>·</span>
          <span>{format(new Date(comment.createdAt), "MMM d, h:mm a")}</span>
          {comment.isUrgentRequest && <span className="text-red-500 font-semibold text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">🚨 Urgent</span>}
        </div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words
          ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}>
          {renderText(comment.text)}
        </div>

        {/* Attachments */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1 w-full">
            {comment.attachments.map((att, i) => {
              const FIcon = fileIcons[att.type] ?? FileText;
              const colorClass = isMe
                ? "text-blue-100 bg-blue-500/50 border-blue-400"
                : fileColors[att.type] ?? "text-gray-600 bg-gray-50 border-gray-200";
              return (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${colorClass}`}>
                  <FIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{att.name}</span>
                  <span className="text-[10px] opacity-60">{(att.sizeBytes / 1024).toFixed(0)}KB</span>
                  <a href={att.base64} download={att.name}
                    className="ml-1 hover:opacity-80 transition-opacity"
                    title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {createdSub && (
          <div className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 mt-0.5">
            <Plus className="w-3 h-3 flex-shrink-0" />
            <span>Subtask created: <strong>{createdSub.title}</strong></span>
          </div>
        )}

        {/* File path links */}
        {comment.fileLinks && comment.fileLinks.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1 w-full">
            {comment.fileLinks.map((filePath, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const api = (window as any).electronAPI;
                  if (api?.showInFolder) {
                    api.showInFolder(filePath);
                  } else {
                    navigator.clipboard.writeText(filePath).catch(() => { });
                    alert(`Path copied to clipboard:\n${filePath}`);
                  }
                }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all
                  ${isMe
                    ? 'bg-emerald-600/20 border-emerald-400/40 text-emerald-100 hover:bg-emerald-600/30'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  }`}
                title="Click to open in File Explorer"
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                <span className="flex-1 font-mono text-[11px] truncate">{filePath}</span>
                <span className={`text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${isMe ? 'text-emerald-300' : 'text-emerald-600'}`}>
                  Open →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── MetaCard ── */
function MetaCard({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1.5">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      {children}
    </div>
  );
}
