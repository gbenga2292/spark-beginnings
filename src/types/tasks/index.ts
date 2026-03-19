// ─── Team (legacy — kept for backward compatibility) ─────────────────────────
export interface Team {
    id: string;
    name: string;
    industry?: string;
    size?: string;
    logoUrl?: string;
    createdAt: string;
}

// ─── Workspace ────────────────────────────────────────────────────────────────
export type WorkspaceType = 'personal' | 'team';

export interface Workspace {
    id: string;
    name: string;                   // e.g. "Acme Corp Workspace" or "My Personal Space"
    type: WorkspaceType;
    ownerId: string;                // creator — permanent admin of this workspace
    memberIds: string[];            // active member userIds (includes owner)
    createdAt: string;
    updatedAt: string;
}

// ─── Workspace Invite ─────────────────────────────────────────────────────────
export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'declined';

export interface WorkspaceInvite {
    id: string;
    workspaceId: string;
    workspaceName: string;          // denormalised for display before acceptance
    inviterId: string;
    inviteeEmail: string;           // email the invite was sent to
    inviteeId?: string;             // set when the invitee is already a registered user
    status: WorkspaceInviteStatus;
    createdAt: string;
    respondedAt?: string;
}

// ─── User ────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'co-admin' | 'user';

export interface AppUser {
    id: string;
    teamId: string;               // legacy — equals primary workspaceId
    workspaceIds: string[];       // all workspaces this user belongs to
    activeWorkspaceId: string;    // currently-selected workspace
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    isSuspended: boolean;
    isDeleted: boolean;
    createdAt: string;
    lastLogin?: string;
    avatarColor: string;
    avatarUrl?: string;
    emailNotifications?: boolean;
    department?: string;
    phone?: string;
}

// ─── Task priority ──────────────────────────────────────────────────────────
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ─── Task hierarchy ───────────────────────────────────────────────────────────
export type SubTaskStatus = 'not_started' | 'in_progress' | 'pending_approval' | 'completed';
export type MainTaskStatus = 'not_started' | 'in_progress' | 'completed';

export interface SubTask {
    id?: string;
    mainTaskId?: string;
    workspaceId?: string;          // added for Firestore workspace-scoped queries
    title: string;
    description?: string;
    assignedTo?: string | null;
    status: SubTaskStatus;
    priority?: TaskPriority;
    createdAt?: string;
    updatedAt?: string;
    deadline?: string;
    pendingApprovalSince?: string;
    approvedBy?: string;
    rejectedAt?: string;
}

export interface MainTask {
    id: string;
    teamId: string;               // legacy — equals workspaceId
    workspaceId: string;          // workspace this task belongs to
    title: string;
    description: string;
    createdBy: string;
    assignedTo?: string;
    priority?: TaskPriority;
    isDeleted?: boolean;
    createdAt: string;
    updatedAt: string;
    deadline?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface Notification {
    id: string;
    userId: string;
    type: 'assignment' | 'reminder' | 'completed' | 'mention' | 'workflow_update' | 'urgent_request' | 'response' | 'workspace_invite';
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    subtaskId?: string;
    mainTaskId?: string;
    workspaceInviteId?: string;
    isUrgent?: boolean;
    fromUserId?: string;
    deletedAt?: string;
    emailSent?: boolean;
}

// ─── Reminders ────────────────────────────────────────────────────────────────
export type ReminderFrequency = 'once' | 'hourly' | 'every_6_hours' | 'daily' | 'weekly' | 'monthly';

export interface Reminder {
    id: string;
    title: string;
    body: string;
    createdBy: string;
    recipientIds: string[];
    remindAt: string;
    endAt?: string;
    frequency: ReminderFrequency;
    isActive: boolean;
    sendEmail: boolean;
    createdAt: string;
    updatedAt: string;
    lastSentAt?: string;
    mainTaskId?: string;
    subtaskId?: string;
}

// ─── File attachment on a comment ─────────────────────────────────────────────
export interface CommentAttachment {
    name: string;
    type: 'docx' | 'xlsx' | 'pptx';
    sizeBytes: number;
    base64: string;
}

// ─── Task Comments / Updates ──────────────────────────────────────────────────
export interface TaskComment {
    id: string;
    subtaskId: string;
    mainTaskId: string;
    workspaceId: string;          // added for Firestore workspace-scoped queries
    authorId: string;
    text: string;
    createdAt: string;
    mentionedUserIds: string[];
    createdSubtaskId?: string;
    attachments?: CommentAttachment[];
    isUrgentRequest?: boolean;
    /** Network / local file paths shared in this update (e.g. \\Server\Share\file.xlsx) */
    fileLinks?: string[];
}

// ─── Workflow event ───────────────────────────────────────────────────────────
export type WorkflowEventType =
    | 'task_created'
    | 'subtask_created'
    | 'subtask_assigned'
    | 'comment_posted'
    | 'subtask_status_changed'
    | 'urgent_request'
    | 'file_attached';

export interface WorkflowEvent {
    id: string;
    type: WorkflowEventType;
    actorId: string;
    targetUserIds: string[];
    mainTaskId: string;
    workspaceId: string;          // added for Firestore workspace-scoped queries
    subtaskId?: string;
    commentId?: string;
    label: string;
    createdAt: string;
    isUrgent?: boolean;
}

// ─── Auth Session ─────────────────────────────────────────────────────────────
export interface AuthSession {
    userId: string;
    teamId: string;
    workspaceId: string;
    role: UserRole;
}
