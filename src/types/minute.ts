export interface MeetingActionItem {
  id: string;
  description: string;
  assigneeName?: string;
  assigneeId?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  selected?: boolean;
  convertedToTaskId?: string;
}

export interface MeetingMinute {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  meetingType: 'HR' | 'Management' | 'Departmental' | 'Project' | 'Disciplinary' | 'General';
  chairPerson: string;
  attendees: string[];
  absentees?: string[];
  executiveSummary: string;
  agendaTopics: Array<{
    id: string;
    topic: string;
    discussion: string;
    decisions?: string[];
  }>;
  keyDecisions: string[];
  actionItems: MeetingActionItem[];
  rawTranscript?: string;
  engineUsed: 'gemini' | 'groq' | 'gladia' | 'notebooklm' | 'manual';
  status: 'draft' | 'reviewed' | 'finalized';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type TranscriptionEngine = 'gemini' | 'groq' | 'gladia' | 'notebooklm';
