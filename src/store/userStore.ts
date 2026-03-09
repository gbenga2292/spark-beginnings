import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Every page/feature privilege
export interface PagePrivileges {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserPrivileges {
  attendance: PagePrivileges;
  employees: PagePrivileges;
  sites: PagePrivileges;
  leaves: PagePrivileges;
  billing: PagePrivileges;
  payments: PagePrivileges;
  salaryLoans: PagePrivileges;
  payroll: { canView: boolean; canGenerate: boolean };
  dashboard: { canView: boolean };
  financeDashboard: { canView: boolean };
  reports: { canView: boolean; canExport: boolean };
  variables: { canView: boolean; canEdit: boolean };
  users: { canView: boolean; canManage: boolean };
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // In production use hashing; for demo this is plaintext
  avatar?: string;
  privileges: UserPrivileges;
  isActive: boolean;
  createdAt: string;
}

export interface PrivilegePreset {
  id: string;
  name: string;
  privileges: UserPrivileges;
}

// Full access preset
export const FULL_ACCESS: UserPrivileges = {
  attendance: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  employees: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  sites: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  leaves: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  billing: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  payments: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  salaryLoans: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  payroll: { canView: true, canGenerate: true },
  dashboard: { canView: true },
  financeDashboard: { canView: true },
  reports: { canView: true, canExport: true },
  variables: { canView: true, canEdit: true },
  users: { canView: true, canManage: true },
};

export const NO_ACCESS: UserPrivileges = {
  attendance: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  employees: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  sites: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  leaves: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  billing: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  payments: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  salaryLoans: { canView: false, canAdd: false, canEdit: false, canDelete: false },
  payroll: { canView: false, canGenerate: false },
  dashboard: { canView: false },
  financeDashboard: { canView: false },
  reports: { canView: false, canExport: false },
  variables: { canView: false, canEdit: false },
  users: { canView: false, canManage: false },
};

const DEFAULT_PRESETS: PrivilegePreset[] = [
  { id: 'preset-full', name: 'Super Admin (Full Access)', privileges: FULL_ACCESS },
  {
    id: 'preset-hr',
    name: 'HR Manager',
    privileges: {
      ...NO_ACCESS,
      attendance: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      employees: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      leaves: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      payroll: { canView: true, canGenerate: true },
      dashboard: { canView: true },
      reports: { canView: true, canExport: true },
    },
  },
  {
    id: 'preset-finance',
    name: 'Finance Officer',
    privileges: {
      ...NO_ACCESS,
      billing: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      payments: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      salaryLoans: { canView: true, canAdd: true, canEdit: false, canDelete: false },
      payroll: { canView: true, canGenerate: false },
      financeDashboard: { canView: true },
      dashboard: { canView: true },
      reports: { canView: true, canExport: true },
    },
  },
  {
    id: 'preset-viewer',
    name: 'View Only',
    privileges: {
      ...NO_ACCESS,
      attendance: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      employees: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      sites: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      leaves: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      billing: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      payments: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      salaryLoans: { canView: true, canAdd: false, canEdit: false, canDelete: false },
      payroll: { canView: true, canGenerate: false },
      dashboard: { canView: true },
      financeDashboard: { canView: true },
      reports: { canView: true, canExport: false },
    },
  },
];

interface UserStore {
  users: AppUser[];
  presets: PrivilegePreset[];
  superAdminCreated: boolean;
  superAdminSignupEnabled: boolean;
  currentUserId: string | null;

  // Actions
  addUser: (user: AppUser) => void;
  updateUser: (id: string, data: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  setCurrentUser: (id: string | null) => void;
  addPreset: (preset: PrivilegePreset) => void;
  updatePreset: (id: string, preset: Partial<PrivilegePreset>) => void;
  deletePreset: (id: string) => void;
  setSuperAdminCreated: () => void;
  setSuperAdminSignupEnabled: (enabled: boolean) => void;
  getCurrentUser: () => AppUser | null;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      users: [],
      presets: DEFAULT_PRESETS,
      superAdminCreated: false,
      superAdminSignupEnabled: true,
      currentUserId: null,

      addUser: (user) => set((s) => ({ users: [...s.users, user] })),
      updateUser: (id, data) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
        })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      setCurrentUser: (id) => set({ currentUserId: id }),

      addPreset: (preset) => set((s) => ({ presets: [...s.presets, preset] })),
      updatePreset: (id, preset) =>
        set((s) => ({
          presets: s.presets.map((p) => (p.id === id ? { ...p, ...preset } : p)),
        })),
      deletePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

      setSuperAdminCreated: () => set({ superAdminCreated: true }),
      setSuperAdminSignupEnabled: (enabled) => set({ superAdminSignupEnabled: enabled }),

      getCurrentUser: () => {
        const state = get();
        return state.users.find((u) => u.id === state.currentUserId) ?? null;
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
