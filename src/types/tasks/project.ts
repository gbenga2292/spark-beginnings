import type { TaskPriority } from './index';

// ─── Project Template (preset in Settings) ────────────────────────────────
export interface ProjectTemplateSubtask {
  id: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  defaultAssignee?: string;   // userId or empty
  relativeDayOffset: number;  // days from project start (e.g. 0 = day 1, 3 = day 4)
}

export interface ProjectTemplate {
  id: string;
  name: string;               // e.g. "Dewatering", "Waterproofing"
  serviceType: string;        // category label
  subtasks: ProjectTemplateSubtask[];
  createdAt: string;
  updatedAt: string;
}

// ─── Live Project (created from a template) ────────────────────────────────
export type ProjectStatus = 'active' | 'completed' | 'on_hold';

export interface Project {
  id: string;
  workspaceId: string;
  templateId: string;          // which template was used
  name: string;                // project name
  serviceType: string;
  startDate: string;           // ISO date
  durationDays: number;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  mainTaskId: string;          // the generated MainTask ID
}
