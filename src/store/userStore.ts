import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardPriv    { canView: boolean; }
export interface FinanceDashPriv  { canView: boolean; redactAmounts: boolean; }

// ─── HR ──────────────────────────────────────────────────────
export interface EmployeesPriv   { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; redactSalary: boolean; }
export interface OnboardingPriv  { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface AttendancePriv  { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface LeavesPriv      { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewSummary: boolean; }
export interface SalaryLoansPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; redactAmounts: boolean; }
export interface ReportsPriv     { canView: boolean; canExport: boolean; }

// ─── Admin ───────────────────────────────────────────────────
export interface SitesPriv {
  canView: boolean;
  canAddSite: boolean; canEditSite: boolean; canDeleteSite: boolean;
  canAddClient: boolean; canEditClient: boolean; canDeleteClient: boolean;
  canViewClientSummary: boolean;
}

// ─── Account ─────────────────────────────────────────────────
export interface BillingPriv  { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; redactAmounts: boolean; }
export interface PaymentsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; redactAmounts: boolean; canViewVat: boolean; canManageVat: boolean; }
export interface PayrollPriv  {
  canView: boolean; canGenerate: boolean; redactAmounts: boolean;
  canViewPayeSchedule: boolean; canViewPensionSchedule: boolean; canViewNsitfSchedule: boolean;
}
export interface FinancialReportsPriv {
  canView: boolean; canExport: boolean; redactAmounts: boolean;
  canViewPayrollSummary: boolean; canViewLoansAndAdvances: boolean;
}

// ─── Settings ────────────────────────────────────────────────
export interface VariablesPriv { canView: boolean; canEdit: boolean; }
export interface UsersPriv     { canView: boolean; canManage: boolean; }

// ─── Master interface ─────────────────────────────────────────
export interface UserPrivileges {
  // Dashboard
  dashboard:         DashboardPriv;
  financeDashboard:  FinanceDashPriv;
  // HR
  employees:         EmployeesPriv;
  onboarding:        OnboardingPriv;
  attendance:        AttendancePriv;
  leaves:            LeavesPriv;
  salaryLoans:       SalaryLoansPriv;
  reports:           ReportsPriv;
  // Admin
  sites:             SitesPriv;
  // Account
  billing:           BillingPriv;
  payments:          PaymentsPriv;
  payroll:           PayrollPriv;
  financialReports:  FinancialReportsPriv;
  // Settings
  variables:         VariablesPriv;
  users:             UsersPriv;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
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
  financeDashboard: { canView: true, redactAmounts: false },
  employees:        { canView: true, canAdd: true, canEdit: true, canDelete: true, redactSalary: false },
  onboarding:       { canView: true, canAdd: true, canEdit: true, canDelete: true },
  attendance:       { canView: true, canAdd: true, canEdit: true, canDelete: true },
  leaves:           { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewSummary: true },
  salaryLoans:      { canView: true, canAdd: true, canEdit: true, canDelete: true, redactAmounts: false },
  reports:          { canView: true, canExport: true },
  sites:            { canView: true, canAddSite: true, canEditSite: true, canDeleteSite: true, canAddClient: true, canEditClient: true, canDeleteClient: true, canViewClientSummary: true },
  billing:          { canView: true, canCreate: true, canEdit: true, canDelete: true, redactAmounts: false },
  payments:         { canView: true, canAdd: true, canEdit: true, canDelete: true, redactAmounts: false, canViewVat: true, canManageVat: true },
  payroll:          { canView: true, canGenerate: true, redactAmounts: false, canViewPayeSchedule: true, canViewPensionSchedule: true, canViewNsitfSchedule: true },
  financialReports: { canView: true, canExport: true, redactAmounts: false, canViewPayrollSummary: true, canViewLoansAndAdvances: true },
  variables:        { canView: true, canEdit: true },
  users:            { canView: true, canManage: true },
};

// ─── NO ACCESS ───────────────────────────────────────────────
export const NO_ACCESS: UserPrivileges = {
  dashboard:        { canView: false },
  financeDashboard: { canView: false, redactAmounts: false },
  employees:        { canView: false, canAdd: false, canEdit: false, canDelete: false, redactSalary: false },
  onboarding:       { canView: false, canAdd: false, canEdit: false, canDelete: false },
  attendance:       { canView: false, canAdd: false, canEdit: false, canDelete: false },
  leaves:           { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewSummary: false },
  salaryLoans:      { canView: false, canAdd: false, canEdit: false, canDelete: false, redactAmounts: false },
  reports:          { canView: false, canExport: false },
  sites:            { canView: false, canAddSite: false, canEditSite: false, canDeleteSite: false, canAddClient: false, canEditClient: false, canDeleteClient: false, canViewClientSummary: false },
  billing:          { canView: false, canCreate: false, canEdit: false, canDelete: false, redactAmounts: false },
  payments:         { canView: false, canAdd: false, canEdit: false, canDelete: false, redactAmounts: false, canViewVat: false, canManageVat: false },
  payroll:          { canView: false, canGenerate: false, redactAmounts: false, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false },
  financialReports: { canView: false, canExport: false, redactAmounts: false, canViewPayrollSummary: false, canViewLoansAndAdvances: false },
  variables:        { canView: false, canEdit: false },
  users:            { canView: false, canManage: false },
};

// ─── DEFAULT PRESETS ─────────────────────────────────────────
const DEFAULT_PRESETS: PrivilegePreset[] = [
  { id: 'preset-full', name: 'Super Admin (Full Access)', privileges: FULL_ACCESS },
  {
    id: 'preset-hr',
    name: 'HR Manager',
    privileges: {
      ...NO_ACCESS,
      dashboard:   { canView: true },
      employees:   { canView: true, canAdd: true, canEdit: true, canDelete: false, redactSalary: false },
      onboarding:  { canView: true, canAdd: true, canEdit: true, canDelete: false },
      attendance:  { canView: true, canAdd: true, canEdit: true, canDelete: false },
      leaves:      { canView: true, canAdd: true, canEdit: true, canDelete: false, canViewSummary: true },
      salaryLoans: { canView: true, canAdd: true, canEdit: false, canDelete: false, redactAmounts: false },
      reports:     { canView: true, canExport: true },
      payroll:     { canView: true, canGenerate: true, redactAmounts: false, canViewPayeSchedule: true, canViewPensionSchedule: true, canViewNsitfSchedule: true },
    },
  },
  {
    id: 'preset-finance',
    name: 'Finance Officer',
    privileges: {
      ...NO_ACCESS,
      dashboard:        { canView: true },
      financeDashboard: { canView: true, redactAmounts: false },
      salaryLoans:      { canView: true, canAdd: true, canEdit: false, canDelete: false, redactAmounts: false },
      billing:          { canView: true, canCreate: true, canEdit: true, canDelete: false, redactAmounts: false },
      payments:         { canView: true, canAdd: true, canEdit: true, canDelete: false, redactAmounts: false, canViewVat: true, canManageVat: false },
      payroll:          { canView: true, canGenerate: false, redactAmounts: false, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false },
      financialReports: { canView: true, canExport: true, redactAmounts: false, canViewPayrollSummary: true, canViewLoansAndAdvances: true },
      reports:          { canView: true, canExport: true },
    },
  },
  {
    id: 'preset-viewer',
    name: 'View Only',
    privileges: {
      ...NO_ACCESS,
      dashboard:        { canView: true },
      financeDashboard: { canView: true, redactAmounts: true },
      employees:        { canView: true, canAdd: false, canEdit: false, canDelete: false, redactSalary: true },
      onboarding:       { canView: true, canAdd: false, canEdit: false, canDelete: false },
      attendance:       { canView: true, canAdd: false, canEdit: false, canDelete: false },
      leaves:           { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewSummary: true },
      salaryLoans:      { canView: true, canAdd: false, canEdit: false, canDelete: false, redactAmounts: true },
      reports:          { canView: true, canExport: false },
      sites:            { canView: true, canAddSite: false, canEditSite: false, canDeleteSite: false, canAddClient: false, canEditClient: false, canDeleteClient: false, canViewClientSummary: true },
      billing:          { canView: true, canCreate: false, canEdit: false, canDelete: false, redactAmounts: true },
      payments:         { canView: true, canAdd: false, canEdit: false, canDelete: false, redactAmounts: true, canViewVat: true, canManageVat: false },
      payroll:          { canView: true, canGenerate: false, redactAmounts: true, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false },
      financialReports: { canView: true, canExport: false, redactAmounts: true, canViewPayrollSummary: false, canViewLoansAndAdvances: false },
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

      addUser:    (user)        => set((s) => ({ users: [...s.users, user] })),
      updateUser: (id, data)    => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...data } : u)) })),
      deleteUser: (id)          => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      setCurrentUser: (id)      => set({ currentUserId: id }),

      addPreset:    (preset)      => set((s) => ({ presets: [...s.presets, preset] })),
      updatePreset: (id, preset)  => set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, ...preset } : p)) })),
      deletePreset: (id)          => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

      setSuperAdminCreated:      () => set({ superAdminCreated: true }),
      setSuperAdminSignupEnabled: (enabled) => set({ superAdminSignupEnabled: enabled }),

      getCurrentUser: () => {
        const state = get();
        return state.users.find((u) => u.id === state.currentUserId) ?? null;
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
      // Merge stored data with new defaults so existing users get new keys
      merge: (persisted: any, current) => {
        const merged = { ...current, ...persisted };
        // Ensure every existing user has all new privilege keys
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

// Deep-merge helper so existing users get any new privilege keys defaulted to false
function deepMergePrivileges(defaults: UserPrivileges, stored: Partial<UserPrivileges>): UserPrivileges {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof UserPrivileges)[]) {
    result[key] = { ...defaults[key], ...(stored[key] ?? {}) } as any;
  }
  return result;
}
