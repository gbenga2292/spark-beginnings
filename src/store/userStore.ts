import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/src/lib/supabaseService';

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardPriv    { canView: boolean; }

// ─── Tasks ───────────────────────────────────────────────────
export interface TasksPriv {
  canView: boolean;
  canViewMyTasks: boolean;
  canViewDashboard: boolean;
  canViewReminders: boolean;
  canViewReports: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
}

// ─── HR ──────────────────────────────────────────────────────
export interface EmployeesPriv   { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewSalary: boolean; canExport: boolean; }
export interface DisciplinaryPriv{ canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface EvaluationsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface OnboardingPriv  { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface AttendancePriv  { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canImport: boolean; canExport: boolean; }
export interface LeavesPriv      { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewSummary: boolean; }
export interface SalaryLoansPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewAmounts: boolean; }
export interface ReportsPriv     { canView: boolean; canExport: boolean; }

// ─── Admin ───────────────────────────────────────────────────
export interface SitesPriv {
  canView: boolean;
  canAddSite: boolean; canEditSite: boolean; canDeleteSite: boolean;
  canAddClient: boolean; canEditClient: boolean; canDeleteClient: boolean;
  canViewClientSummary: boolean;
  canImport: boolean; canExport: boolean;
}

// ─── Operations ──────────────────────────────────────────────
export interface OperationsPriv {
  canView: boolean;
  canManageAssets: boolean;
  canManageWaybills: boolean;
  canManageLogistics: boolean;
  canViewAnalytics: boolean;
}

// ─── Account ─────────────────────────────────────────────────
export interface BillingPriv  { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canViewAmounts: boolean; canImport: boolean; canExport: boolean; }
export interface PaymentsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewAmounts: boolean; canViewVat: boolean; canManageVat: boolean; canImport: boolean; canExport: boolean; }
export interface PayrollPriv  {
  canView: boolean; canGenerate: boolean; canViewAmounts: boolean;
  canViewPayeSchedule: boolean; canViewPensionSchedule: boolean; canViewNsitfSchedule: boolean;
}
export interface FinancialReportsPriv {
  canView: boolean; canExport: boolean; canViewAmounts: boolean;
  canViewPayrollSummary: boolean; canViewLoansAndAdvances: boolean;
}
export interface LedgerPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean; }

// ─── Settings ────────────────────────────────────────────────
export interface VariablesPriv { canView: boolean; canEdit: boolean; canImport: boolean; canExport: boolean; }
export interface UsersPriv     { canView: boolean; canManage: boolean; }

// ─── Master interface ─────────────────────────────────────────
export interface UserPrivileges {
  dashboard:         DashboardPriv;
  employees:         EmployeesPriv;
  disciplinary:      DisciplinaryPriv;
  evaluations:       EvaluationsPriv;
  onboarding:        OnboardingPriv;
  attendance:        AttendancePriv;
  leaves:            LeavesPriv;
  salaryLoans:       SalaryLoansPriv;
  reports:           ReportsPriv;
  sites:             SitesPriv;
  billing:           BillingPriv;
  payments:          PaymentsPriv;
  payroll:           PayrollPriv;
  financialReports:  FinancialReportsPriv;
  ledger:            LedgerPriv;
  variables:         VariablesPriv;
  users:             UsersPriv;
  tasks:             TasksPriv;
  operations:        OperationsPriv;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // Not used with Supabase auth, kept for interface compat
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

// ─── FULL ACCESS ─────────────────────────────────────────────
export const FULL_ACCESS: UserPrivileges = {
  dashboard:        { canView: true },
  employees:        { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewSalary: true, canExport: true },
  disciplinary:     { canView: true, canAdd: true, canEdit: true, canDelete: true },
  evaluations:      { canView: true, canAdd: true, canEdit: true, canDelete: true },
  onboarding:       { canView: true, canAdd: true, canEdit: true, canDelete: true },
  attendance:       { canView: true, canAdd: true, canEdit: true, canDelete: true, canImport: true, canExport: true },
  leaves:           { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewSummary: true },
  salaryLoans:      { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewAmounts: true },
  reports:          { canView: true, canExport: true },
  sites:            { canView: true, canAddSite: true, canEditSite: true, canDeleteSite: true, canAddClient: true, canEditClient: true, canDeleteClient: true, canViewClientSummary: true, canImport: true, canExport: true },
  billing:          { canView: true, canCreate: true, canEdit: true, canDelete: true, canViewAmounts: true, canImport: true, canExport: true },
  payments:         { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewAmounts: true, canViewVat: true, canManageVat: true, canImport: true, canExport: true },
  payroll:          { canView: true, canGenerate: true, canViewAmounts: true, canViewPayeSchedule: true, canViewPensionSchedule: true, canViewNsitfSchedule: true },
  financialReports: { canView: true, canExport: true, canViewAmounts: true, canViewPayrollSummary: true, canViewLoansAndAdvances: true },
  ledger:           { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true },
  variables:        { canView: true, canEdit: true, canImport: true, canExport: true },
  users:            { canView: true, canManage: true },
  tasks:            { canView: true, canViewMyTasks: true, canViewDashboard: true, canViewReminders: true, canViewReports: true, canCreateTasks: true, canEditTasks: true, canDeleteTasks: true },
  operations:       { canView: true, canManageAssets: true, canManageWaybills: true, canManageLogistics: true, canViewAnalytics: true },
};

// ─── NO ACCESS ───────────────────────────────────────────────
export const NO_ACCESS: UserPrivileges = {
  dashboard:        { canView: false },
  employees:        { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewSalary: false, canExport: false },
  disciplinary:     { canView: false, canAdd: false, canEdit: false, canDelete: false },
  evaluations:      { canView: false, canAdd: false, canEdit: false, canDelete: false },
  onboarding:       { canView: false, canAdd: false, canEdit: false, canDelete: false },
  attendance:       { canView: false, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
  leaves:           { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewSummary: false },
  salaryLoans:      { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false },
  reports:          { canView: false, canExport: false },
  sites:            { canView: false, canAddSite: false, canEditSite: false, canDeleteSite: false, canAddClient: false, canEditClient: false, canDeleteClient: false, canViewClientSummary: false, canImport: false, canExport: false },
  billing:          { canView: false, canCreate: false, canEdit: false, canDelete: false, canViewAmounts: false, canImport: false, canExport: false },
  payments:         { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false, canViewVat: false, canManageVat: false, canImport: false, canExport: false },
  payroll:          { canView: false, canGenerate: false, canViewAmounts: false, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false },
  financialReports: { canView: false, canExport: false, canViewAmounts: false, canViewPayrollSummary: false, canViewLoansAndAdvances: false },
  ledger:           { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false },
  variables:        { canView: false, canEdit: false, canImport: false, canExport: false },
  users:            { canView: false, canManage: false },
  tasks:            { canView: false, canViewMyTasks: false, canViewDashboard: false, canViewReminders: false, canViewReports: false, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false },
  operations:       { canView: false, canManageAssets: false, canManageWaybills: false, canManageLogistics: false, canViewAnalytics: false },
};

// ─── DEFAULT PRESETS ─────────────────────────────────────────
const DEFAULT_PRESETS: PrivilegePreset[] = [
  { id: 'preset-full', name: 'Super Admin (Full Access)', privileges: FULL_ACCESS },
  {
    id: 'preset-hr', name: 'HR Manager',
    privileges: {
      ...NO_ACCESS,
      dashboard:   { canView: true },
      employees:   { canView: true, canAdd: true, canEdit: true, canDelete: false, canViewSalary: true, canExport: true },
      disciplinary:{ canView: true, canAdd: true, canEdit: true, canDelete: false },
      evaluations: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      onboarding:  { canView: true, canAdd: true, canEdit: true, canDelete: false },
      attendance:  { canView: true, canAdd: true, canEdit: true, canDelete: false, canImport: true, canExport: true },
      leaves:      { canView: true, canAdd: true, canEdit: true, canDelete: false, canViewSummary: true },
      salaryLoans: { canView: true, canAdd: true, canEdit: false, canDelete: false, canViewAmounts: true },
      reports:     { canView: true, canExport: true },
      payroll:     { canView: true, canGenerate: true, canViewAmounts: true, canViewPayeSchedule: true, canViewPensionSchedule: true, canViewNsitfSchedule: true },
      tasks:       { canView: true, canViewMyTasks: true, canViewDashboard: true, canViewReminders: true, canViewReports: true, canCreateTasks: true, canEditTasks: true, canDeleteTasks: false },
    },
  },
  {
    id: 'preset-finance', name: 'Finance Officer',
    privileges: {
      ...NO_ACCESS,
      dashboard:        { canView: true },
      salaryLoans:      { canView: true, canAdd: true, canEdit: false, canDelete: false, canViewAmounts: true },
      billing:          { canView: true, canCreate: true, canEdit: true, canDelete: false, canViewAmounts: true, canImport: true, canExport: true },
      payments:         { canView: true, canAdd: true, canEdit: true, canDelete: false, canViewAmounts: true, canViewVat: true, canManageVat: false, canImport: true, canExport: true },
      payroll:          { canView: true, canGenerate: false, canViewAmounts: true, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false },
      financialReports: { canView: true, canExport: true, canViewAmounts: true, canViewPayrollSummary: true, canViewLoansAndAdvances: true },
      ledger:           { canView: true, canAdd: true, canEdit: true, canDelete: false, canExport: true },
      reports:          { canView: true, canExport: true },
      tasks:            { canView: false, canViewMyTasks: false, canViewDashboard: false, canViewReminders: false, canViewReports: false, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false },
    },
  },
  {
    id: 'preset-viewer', name: 'View Only',
    privileges: {
      ...NO_ACCESS,
      dashboard:        { canView: true },
      employees:        { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewSalary: false, canExport: false },
      onboarding:       { canView: true, canAdd: false, canEdit: false, canDelete: false },
      attendance:       { canView: true, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
      leaves:           { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewSummary: true },
      salaryLoans:      { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false },
      reports:          { canView: true, canExport: false },
      sites:            { canView: true, canAddSite: false, canEditSite: false, canDeleteSite: false, canAddClient: false, canEditClient: false, canDeleteClient: false, canViewClientSummary: true, canImport: false, canExport: false },
      billing:          { canView: true, canCreate: false, canEdit: false, canDelete: false, canViewAmounts: false, canImport: false, canExport: false },
      payments:         { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false, canViewVat: true, canManageVat: false, canImport: false, canExport: false },
      payroll:          { canView: true, canGenerate: false, canViewAmounts: false, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false },
      financialReports: { canView: true, canExport: false, canViewAmounts: false, canViewPayrollSummary: false, canViewLoansAndAdvances: false },
      ledger:           { canView: true, canAdd: false, canEdit: false, canDelete: false, canExport: false },
      tasks:            { canView: true, canViewMyTasks: false, canViewDashboard: false, canViewReminders: false, canViewReports: false, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false },
    },
  },
];

// ─── STORE ───────────────────────────────────────────────────
interface UserStore {
  users: AppUser[];
  presets: PrivilegePreset[];
  superAdminCreated: boolean;
  superAdminSignupEnabled: boolean;
  currentUserId: string | null;

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

      addUser: (user) => {
        set((s) => {
          if (s.users.some(u => u.id === user.id)) return s;
          return { users: [...s.users, user] };
        });
        // Profile is created via Supabase auth trigger; just update privileges
        db.updateProfile(user.id, { name: user.name, privileges: user.privileges, is_active: user.isActive });
      },
      updateUser: (id, data) => {
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...data } : u)) }));
        const update: any = {};
        if (data.name !== undefined) update.name = data.name;
        if (data.email !== undefined) update.email = data.email;
        if (data.avatar !== undefined) update.avatar = data.avatar;
        if (data.privileges !== undefined) update.privileges = data.privileges;
        if (data.isActive !== undefined) update.is_active = data.isActive;
        if (Object.keys(update).length > 0) db.updateProfile(id, update);
      },
      deleteUser: (id) => {
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        // Note: To fully delete a Supabase auth user, use the edge function or admin dashboard
      },
      setCurrentUser: (id) => set({ currentUserId: id }),

      addPreset: (preset) => { set((s) => ({ presets: [...s.presets, preset] })); db.insertPreset(preset); },
      updatePreset: (id, preset) => { set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, ...preset } : p)) })); db.updatePreset(id, preset); },
      deletePreset: (id) => { set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })); db.deletePreset(id); },

      setSuperAdminCreated: () => { set({ superAdminCreated: true }); db.updateSettings({ superAdminCreated: true }); },
      setSuperAdminSignupEnabled: (enabled) => { set({ superAdminSignupEnabled: enabled }); db.updateSettings({ superAdminSignupEnabled: enabled }); },

      getCurrentUser: () => {
        const state = get();
        return state.users.find((u) => u.id === state.currentUserId) ?? null;
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted };
        if (merged.users) {
          merged.users = merged.users.map((u: AppUser) => ({
            ...u,
            privileges: deepMergePrivileges(NO_ACCESS, u.privileges),
          }));
        }
        return merged;
      },
    }
  )
);

function deepMergePrivileges(defaults: UserPrivileges, stored: Partial<UserPrivileges>): UserPrivileges {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof UserPrivileges)[]) {
    // If operations is missing, default it to sites privileges if they exist
    if (key === 'operations' && !stored[key] && stored['sites']) {
      result[key] = { ...defaults[key], ...stored['sites'] } as any;
      continue;
    }
    result[key] = { ...defaults[key], ...(stored[key] ?? {}) } as any;
  }
  return result;
}
