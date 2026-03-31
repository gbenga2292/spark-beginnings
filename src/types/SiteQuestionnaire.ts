export interface SiteQuestionnaire {
  id: string;
  siteId?: string; // Links to an existing site, or will be generated once approved
  clientName: string;
  siteName: string; // The proposed site name
  address?: string; // Site/client address
  contactPersonName?: string; // Initial contact person name
  contactPersonPhone?: string; // Contact person phone (numbers only)
  status: 'Pending' | 'Active' | 'Rejected' | 'Ended'; // 'Pending' means it hasn't passed phases 1-4
  
  // Phase 1 – Initial Inquiry (Head of Operations)
  phase1: {
    isNewSite: boolean;
    isNewClient: boolean;
    whatIsBeingBuilt: string;
    excavationDepthMeters: string;
    siteLength: string;
    siteWidth: string;
    timelineStartDate: string;
    geotechnicalReportAvailable: boolean;
    hydrogeologicalDataAvailable: boolean;
    completed: boolean; // True if all required fields are filled
  };

  // Phase 2 – Site Visit & Technical Assessment (Head of Operations)
  phase2: {
    siteVisited: boolean;
    walkthroughCompleted: boolean;
    knownObstacles: string;
    dischargeLocation: string;
    dieselSupplyStrategy: 'Client' | 'DCEL' | '';
    completed: boolean;
  };

  // Phase 3 – System Design & Equipment Calculation (Head of Operations)
  phase3: {
    dewateringMethods: string[];
    totalWellpointsRequired: string;
    totalHeadersRequired: string;
    totalPumpsRequired: string;
    expectedDailyDieselUsage: string;
    completed: boolean;
  };

  // Phase 4 – Commercial Proposal (Accounts Department only)
  phase4: {
    quotationSent: boolean;
    clientFeedbackReceived: boolean;
    proposalAccepted: boolean;
    clientTaxStatus: 'Mainland (7.5%)' | 'Free Trade Zone (0%)' | '';
    scopeOfWorkSummary: string;
    scopeExclusionsSummary: string;
    timelineConfirmed: boolean;
    permittingResponsibilityOutlined: boolean;
    tinProvided: boolean;
    completed: boolean;
  };

  // Phase 5 – Mobilization, Installation & Payment Milestones (Ops + Accounts)
  phase5: {
    safetyPlanIntegrated: boolean;
    stage1AdvanceReceived: boolean;
    stage2InstallationComplete: boolean;
    stage2FirstInvoiceIssued: boolean;
    stage3TimelyBilling: boolean;
    stage4DemobilizationComplete: boolean;
    stage4FinalInvoiceIssued: boolean;
    actualEndDate: string;
    completed: boolean;
  };

  createdAt: string;
  updatedAt: string;
}
