export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  assigneeAvatar?: string;
  department: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updates: TaskUpdate[];
}

export interface TaskUpdate {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  receipts?: TaskUpdateReceipt[];
}

/**
 * High-water mark cursor — tracks the last message a user has read in a task/subtask thread.
 * Used to calculate unread counts without scanning every message.
 * Matches the `task_participant_status` table.
 */
export interface TaskParticipantStatus {
  id: string;
  taskId: string;       // maps to task_id (can be main_task_id or subtask_id)
  userId: string;
  lastReadTimestamp: string; // ISO 8601 — last time this user "read" this thread
}

/**
 * Per-message receipt — tracks delivered/read state for a specific update and user.
 * Used to render ✓✓ (delivered) and blue ✓✓ (read) receipts like WhatsApp/iMessage.
 * Matches the `task_update_receipts` table.
 */
export interface TaskUpdateReceipt {
  id: string;
  updateId: string;     // FK → task_updates.id
  userId: string;
  status: 'delivered' | 'read';
  readAt: string;       // ISO 8601
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
