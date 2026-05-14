// ── Interview Management Types ────────────────────────────────────────────────

export type InterviewStage = 'Preliminary' | 'Final';

export type InterviewStatus =
  | 'Invited'
  | 'Scheduled'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled';

export type InterviewDecision =
  | 'Not Applicable'
  | 'Applicable'
  | 'Callback'
  | 'Forwarded to Onboarding';

/** Section 7 suitability tick-box */
export type SuitabilityVerdict =
  | 'Potential Star'
  | 'Good Candidate'
  | 'Average'
  | 'Not Suitable';

/** Section 2.1 — Academic / Professional qualifications row */
export interface QualificationRow {
  dates: string;
  institution: string;
  qualification: string;
}

/** Section 2.2 — Work experience row */
export interface WorkExperienceRow {
  date: string;
  organisation: string;
  jobTitle: string;
}

/**
 * Section 3 — Key attributes rated 1–4:
 *   1 = Poor | 2 = Average | 3 = Good | 4 = Excellent
 */
export interface KeyAttributes {
  appearance: number;        // 1–4
  attitude: number;
  intelligenceAptitude: number;
  motivation: number;
  teamSpirit: number;
  leadershipAbility: number;
  competence: number;
}

/** The completed interview scoresheet (Sections 1–8) */
export interface InterviewScoresheet {
  // Section 1
  applicantName: string;
  jobTitle: string;
  stage: InterviewStage;

  // Section 2
  qualifications: QualificationRow[];
  workExperience: WorkExperienceRow[];

  // Section 3
  keyAttributes: Partial<KeyAttributes>;

  // Section 4
  presentSalary: string;
  askingSalary: string;
  noticePeriod: string;
  indebtedness: string;

  // Section 5
  reasonForLeaving: string;

  // Section 6
  otherComments: string;

  // Section 7
  suitabilityVerdict?: SuitabilityVerdict;

  // Section 8
  otherInterviewers: string;
  interviewerName: string;
  interviewDate: string;
}

/** A candidate who has been invited / interviewed */
export interface InterviewCandidate {
  id: string;
  candidateName: string;
  phone?: string;
  email?: string;
  appliedRole: string;
  department?: string;
  stage: InterviewStage;
  scheduledDate: string;      // ISO date string
  scheduledTime?: string;     // HH:mm
  status: InterviewStatus;
  decision?: InterviewDecision;
  callbackDate?: string;      // If decision = 'Callback'
  rejectionNote?: string;     // If decision = 'Not Applicable'

  // Link to a second-stage interview if this is Preliminary
  followUpInterviewId?: string;

  // Filled in when interview is conducted
  scoresheet?: InterviewScoresheet; // Legacy/Primary
  scoresheets?: InterviewScoresheet[]; // Multi-interviewer support

  // Metadata
  invitedBy: string;          // user name
  createdAt: string;
  updatedAt?: string;

  // If forwarded to onboarding, track the employee ID created
  onboardingEmployeeId?: string;

  // AI-extracted CV data from the Invite stage — auto-populates the Scoresheet History tab
  cvQualifications?: QualificationRow[];
  cvWorkExperience?: WorkExperienceRow[];

  // Optional invite details
  source?: string;
  remarks?: string;
}
