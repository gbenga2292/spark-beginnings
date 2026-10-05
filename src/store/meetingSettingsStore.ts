import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MeetingSettings, CommitteeGroup } from '@/src/types/minute';

export const DEFAULT_MEETING_SETTINGS: MeetingSettings = {
  defaultMeetingType: 'HR',
  defaultChairPerson: 'HR Admin',
  defaultLocation: 'Conference Room',
  defaultActionTurnaroundDays: 7,
  defaultPriority: 'medium',
  committeeGroups: [
    {
      id: 'grp-exec',
      name: 'Executive Committee',
      description: 'Senior management & directors',
      memberNames: [],
    },
    {
      id: 'grp-hr',
      name: 'HR Management Team',
      description: 'HR and administrative coordinators',
      memberNames: [],
    },
    {
      id: 'grp-ops',
      name: 'Operations & Site Leads',
      description: 'Operations managers and site engineers',
      memberNames: [],
    },
  ],
  customPromptGuidelines: '',
  showWatermark: true,
  watermarkText: 'CONFIDENTIAL - CORPORATE MINUTES',
  includeSignatureLines: true,
  signatory1Title: 'Prepared By (Secretary)',
  signatory2Title: 'Approved By (Chairperson)',
  confidentialityLevel: 'Confidential',
};

interface MeetingSettingsState {
  settings: MeetingSettings;
  updateSettings: (updates: Partial<MeetingSettings>) => void;
  addCommitteeGroup: (group: Omit<CommitteeGroup, 'id'>) => void;
  updateCommitteeGroup: (id: string, updates: Partial<CommitteeGroup>) => void;
  deleteCommitteeGroup: (id: string) => void;
  resetSettings: () => void;
}

export const useMeetingSettingsStore = create<MeetingSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_MEETING_SETTINGS,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      addCommitteeGroup: (group) =>
        set((state) => ({
          settings: {
            ...state.settings,
            committeeGroups: [
              ...state.settings.committeeGroups,
              { ...group, id: `group-${Date.now()}` },
            ],
          },
        })),

      updateCommitteeGroup: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            committeeGroups: state.settings.committeeGroups.map((g) =>
              g.id === id ? { ...g, ...updates } : g
            ),
          },
        })),

      deleteCommitteeGroup: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            committeeGroups: state.settings.committeeGroups.filter((g) => g.id !== id),
          },
        })),

      resetSettings: () =>
        set({
          settings: DEFAULT_MEETING_SETTINGS,
        }),
    }),
    {
      name: 'dcel-meeting-settings-store',
    }
  )
);
