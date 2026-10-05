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

export interface CommitteeGroup {
  id: string;
  name: string;
  description?: string;
  memberNames: string[];
}

export interface MeetingSettings {
  defaultMeetingType: string;
  defaultChairPerson: string;
  defaultLocation: string;
  defaultActionTurnaroundDays: number;
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
  committeeGroups: CommitteeGroup[];
  customPromptGuidelines: string;
  showWatermark: boolean;
  watermarkText: string;
  includeSignatureLines: boolean;
  signatory1Title: string;
  signatory2Title: string;
  confidentialityLevel: 'Public' | 'Internal' | 'Confidential' | 'Strictly Confidential';
}

export interface MeetingMinute {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  meetingType: string;
  chairPerson: string;
  attendees: string[];
  absentees?: string[];
  confidentiality?: 'Public' | 'Internal' | 'Confidential' | 'Strictly Confidential';
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

