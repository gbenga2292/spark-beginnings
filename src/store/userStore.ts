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
export interface EmployeesPriv   { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewSalary: boolean; canViewAnalytics: boolean; canViewOrganogram: boolean; canImport: boolean; canExport: boolean; }
export interface DisciplinaryPriv{ canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface EvaluationsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface OnboardingPriv  { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface AttendancePriv  { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canImport: boolean; canExport: boolean; }
export interface LeavesPriv      { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewSummary: boolean; }
export interface SalaryLoansPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewAmounts: boolean; }
export interface ReportsPriv     { canView: boolean; canExport: boolean; }
export interface HmoPriv         { canView: boolean; canAdd: boolean; canEdit: boolean; canExport: boolean; }

// ─── Admin ───────────────────────────────────────────────────
export interface ClientsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
export interface SitesPriv {
  canView: boolean;
  canAddSite: boolean; canEditSite: boolean; canDeleteSite: boolean;
  canAddClient: boolean; canEditClient: boolean; canDeleteClient: boolean;
  canViewClientSummary: boolean;
  canImport: boolean;
  canExport: boolean;
}

// ─── Operations ──────────────────────────────────────────────
// Overview / Dashboard
export interface OperationsPriv { canView: boolean; canViewAnalytics: boolean; }
// Inventory (Assets)
export interface OpsInventoryPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canImport: boolean; canExport: boolean; }
// Waybills
export interface OpsWaybillsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean; }
// Quick Checkout / Logistics
export interface OpsCheckoutPriv { canView: boolean; canAdd: boolean; }
// Maintenance
export interface OpsMaintenancePriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; }
// Vehicles
export interface OpsVehiclesPriv { 
  canView: boolean; 
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewFleet: boolean; canAddFleet: boolean; canEditFleet: boolean; canDeleteFleet: boolean;
  canViewLogs: boolean; canAddLogs: boolean; canEditLogs: boolean; canDeleteLogs: boolean;
  canViewDocuments: boolean; canEditDocuments: boolean;
  canImport: boolean; canExport: boolean;
}
// Ops Site Manager
export interface OpsSitesPriv { canView: boolean; }

// ─── Account ─────────────────────────────────────────────────
export interface BillingPriv  { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canViewAmounts: boolean; canImport: boolean; canExport: boolean; }
export interface PaymentsPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canViewAmounts: boolean; canViewVat: boolean; canManageVat: boolean; canImport: boolean; canExport: boolean; }
export interface PayrollPriv  {
  canView: boolean; canGenerate: boolean; canViewAmounts: boolean;
  canViewPayeSchedule: boolean; canViewPensionSchedule: boolean; canViewNsitfSchedule: boolean; canViewWithholdingSchedule: boolean;
}
export interface FinancialReportsPriv {
  canView: boolean; canExport: boolean; canViewAmounts: boolean;
  canViewPayrollSummary: boolean; canViewLoansAndAdvances: boolean;
}
export interface LedgerPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canImport: boolean; canExport: boolean; }

// ─── Settings ────────────────────────────────────────────────
export interface VariablesPriv { canView: boolean; canEdit: boolean; canImport: boolean; canExport: boolean; canBackup: boolean; canRestore: boolean; }
export interface UsersPriv     { canView: boolean; canManage: boolean; canOverrideDiaryDelete: boolean; }
export interface ActivityLogPriv { canView: boolean; canExport: boolean; }

// ─── Missing Bundled Pages ───────────────────────────────────
export interface CommLogPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean; }
export interface BeneficiariesPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canImport: boolean; canExport: boolean; }
export interface DailyJournalPriv { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean; }

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
  hmo:               HmoPriv;
  reports:           ReportsPriv;
  clients:           ClientsPriv;
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
  opsInventory:      OpsInventoryPriv;
  opsWaybills:       OpsWaybillsPriv;
  opsCheckout:       OpsCheckoutPriv;
  opsMaintenance:    OpsMaintenancePriv;
  opsVehicles:       OpsVehiclesPriv;
  opsSites:          OpsSitesPriv;
  activityLog:       ActivityLogPriv;
  commLog:           CommLogPriv;
  beneficiaries:     BeneficiariesPriv;
  dailyJournal:      DailyJournalPriv;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // Not used with Supabase auth, kept for interface compat
  avatar?: string;
  avatarColor?: string;
  role?: string;
  workspaceId: string;
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
  employees:        { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewSalary: true, canViewAnalytics: true, canViewOrganogram: true, canImport: true, canExport: true },
  disciplinary:     { canView: true, canAdd: true, canEdit: true, canDelete: true },
  evaluations:      { canView: true, canAdd: true, canEdit: true, canDelete: true },
  onboarding:       { canView: true, canAdd: true, canEdit: true, canDelete: true },
  attendance:       { canView: true, canAdd: true, canEdit: true, canDelete: true, canImport: true, canExport: true },
  leaves:           { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewSummary: true },
  salaryLoans:      { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewAmounts: true },
  hmo:              { canView: true, canAdd: true, canEdit: true, canExport: true },
  reports:          { canView: true, canExport: true },
  clients:          { canView: true, canAdd: true, canEdit: true, canDelete: true },
  sites:            { canView: true, canAddSite: true, canEditSite: true, canDeleteSite: true, canAddClient: true, canEditClient: true, canDeleteClient: true, canViewClientSummary: true, canImport: true, canExport: true },
  billing:          { canView: true, canCreate: true, canEdit: true, canDelete: true, canViewAmounts: true, canImport: true, canExport: true },
  payments:         { canView: true, canAdd: true, canEdit: true, canDelete: true, canViewAmounts: true, canViewVat: true, canManageVat: true, canImport: true, canExport: true },
  payroll:          { canView: true, canGenerate: true, canViewAmounts: true, canViewPayeSchedule: true, canViewPensionSchedule: true, canViewNsitfSchedule: true, canViewWithholdingSchedule: true },
  financialReports: { canView: true, canExport: true, canViewAmounts: true, canViewPayrollSummary: true, canViewLoansAndAdvances: true },
  ledger:           { canView: true, canAdd: true, canEdit: true, canDelete: true, canImport: true, canExport: true },
  variables:        { canView: true, canEdit: true, canImport: true, canExport: true, canBackup: true, canRestore: true },
  users:            { canView: true, canManage: true, canOverrideDiaryDelete: true },
  tasks:            { canView: true, canViewMyTasks: true, canViewDashboard: true, canViewReminders: true, canViewReports: true, canCreateTasks: true, canEditTasks: true, canDeleteTasks: true },
  operations:       { canView: true, canViewAnalytics: true },
  opsInventory:     { canView: true, canAdd: true, canEdit: true, canDelete: true, canImport: true, canExport: true },
  opsWaybills:      { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true },
  opsCheckout:      { canView: true, canAdd: true },
  opsMaintenance:   { canView: true, canAdd: true, canEdit: true, canDelete: true },
  opsVehicles:      { 
    canView: true, 
    canAdd: true, canEdit: true, canDelete: true,
    canViewFleet: true, canAddFleet: true, canEditFleet: true, canDeleteFleet: true,
    canViewLogs: true, canAddLogs: true, canEditLogs: true, canDeleteLogs: true,
    canViewDocuments: true, canEditDocuments: true,
    canImport: true, canExport: true
  },
  opsSites:         { canView: true },
  activityLog:      { canView: true, canExport: true },
  commLog:          { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true },
  beneficiaries:    { canView: true, canAdd: true, canEdit: true, canDelete: true, canImport: true, canExport: true },
  dailyJournal:     { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true },
};

// ─── NO ACCESS ───────────────────────────────────────────────
export const NO_ACCESS: UserPrivileges = {
  dashboard:        { canView: false },
  employees:        { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewSalary: false, canViewAnalytics: false, canViewOrganogram: false, canImport: false, canExport: false },
  disciplinary:     { canView: false, canAdd: false, canEdit: false, canDelete: false },
  evaluations:      { canView: false, canAdd: false, canEdit: false, canDelete: false },
  onboarding:       { canView: false, canAdd: false, canEdit: false, canDelete: false },
  attendance:       { canView: false, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
  leaves:           { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewSummary: false },
  salaryLoans:      { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false },
  hmo:              { canView: false, canAdd: false, canEdit: false, canExport: false },
  reports:          { canView: false, canExport: false },
  clients:          { canView: false, canAdd: false, canEdit: false, canDelete: false },
  sites:            { canView: false, canAddSite: false, canEditSite: false, canDeleteSite: false, canAddClient: false, canEditClient: false, canDeleteClient: false, canViewClientSummary: false, canImport: false, canExport: false },
  billing:          { canView: false, canCreate: false, canEdit: false, canDelete: false, canViewAmounts: false, canImport: false, canExport: false },
  payments:         { canView: false, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false, canViewVat: false, canManageVat: false, canImport: false, canExport: false },
  payroll:          { canView: false, canGenerate: false, canViewAmounts: false, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false, canViewWithholdingSchedule: false },
  financialReports: { canView: false, canExport: false, canViewAmounts: false, canViewPayrollSummary: false, canViewLoansAndAdvances: false },
  ledger:           { canView: false, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
  variables:        { canView: false, canEdit: false, canImport: false, canExport: false, canBackup: false, canRestore: false },
  users:            { canView: false, canManage: false, canOverrideDiaryDelete: false },
  tasks:            { canView: false, canViewMyTasks: false, canViewDashboard: false, canViewReminders: false, canViewReports: false, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false },
  operations:       { canView: false, canViewAnalytics: false },
  opsInventory:     { canView: false, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
  opsWaybills:      { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false },
  opsCheckout:      { canView: false, canAdd: false },
  opsMaintenance:   { canView: false, canAdd: false, canEdit: false, canDelete: false },
  opsVehicles:      { 
    canView: false, 
    canAdd: false, canEdit: false, canDelete: false,
    canViewFleet: false, canAddFleet: false, canEditFleet: false, canDeleteFleet: false,
    canViewLogs: false, canAddLogs: false, canEditLogs: false, canDeleteLogs: false,
    canViewDocuments: false, canEditDocuments: false,
    canImport: false, canExport: false
  },
  opsSites:         { canView: false },
  activityLog:      { canView: false, canExport: false },
  commLog:          { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false },
  beneficiaries:    { canView: false, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
  dailyJournal:     { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false },
};

// ─── DEFAULT PRESETS ─────────────────────────────────────────
const DEFAULT_PRESETS: PrivilegePreset[] = [
  { id: 'preset-full', name: 'Super Admin (Full Access)', privileges: FULL_ACCESS },
  {
    id: 'preset-hr', name: 'HR Manager',
    privileges: {
      ...NO_ACCESS,
      dashboard:   { canView: true },
      employees:   { canView: true, canAdd: true, canEdit: true, canDelete: false, canViewSalary: true, canViewAnalytics: true, canViewOrganogram: true, canImport: true, canExport: true },
      disciplinary:{ canView: true, canAdd: true, canEdit: true, canDelete: false },
      evaluations: { canView: true, canAdd: true, canEdit: true, canDelete: false },
      onboarding:  { canView: true, canAdd: true, canEdit: true, canDelete: false },
      attendance:  { canView: true, canAdd: true, canEdit: true, canDelete: false, canImport: true, canExport: true },
      leaves:      { canView: true, canAdd: true, canEdit: true, canDelete: false, canViewSummary: true },
      salaryLoans: { canView: true, canAdd: true, canEdit: false, canDelete: false, canViewAmounts: true },
      hmo:         { canView: true, canAdd: true, canEdit: true, canExport: true },
      reports:     { canView: true, canExport: true },
      payroll:     { canView: true, canGenerate: true, canViewAmounts: true, canViewPayeSchedule: true, canViewPensionSchedule: true, canViewNsitfSchedule: true, canViewWithholdingSchedule: true },
      tasks:       { canView: true, canViewMyTasks: true, canViewDashboard: true, canViewReminders: true, canViewReports: true, canCreateTasks: true, canEditTasks: true, canDeleteTasks: false },
      beneficiaries:{ canView: true, canAdd: true, canEdit: true, canDelete: false, canImport: true, canExport: true },
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
      payroll:          { canView: true, canGenerate: false, canViewAmounts: true, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false, canViewWithholdingSchedule: false },
      financialReports: { canView: true, canExport: true, canViewAmounts: true, canViewPayrollSummary: true, canViewLoansAndAdvances: true },
      ledger:           { canView: true, canAdd: true, canEdit: true, canDelete: false, canImport: true, canExport: true },
      reports:          { canView: true, canExport: true },
      tasks:            { canView: false, canViewMyTasks: false, canViewDashboard: false, canViewReminders: false, canViewReports: false, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false },
    },
  },
  {
    id: 'preset-viewer', name: 'View Only',
    privileges: {
      ...NO_ACCESS,
      dashboard:        { canView: true },
      employees:        { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewSalary: false, canViewAnalytics: false, canViewOrganogram: false, canImport: false, canExport: false },
      onboarding:       { canView: true, canAdd: false, canEdit: false, canDelete: false },
      attendance:       { canView: true, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
      leaves:           { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewSummary: true },
      salaryLoans:      { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false },
      reports:          { canView: true, canExport: false },
      sites:            { canView: true, canAddSite: false, canEditSite: false, canDeleteSite: false, canAddClient: false, canEditClient: false, canDeleteClient: false, canViewClientSummary: true, canImport: false, canExport: false },
      billing:          { canView: true, canCreate: false, canEdit: false, canDelete: false, canViewAmounts: false, canImport: false, canExport: false },
      payments:         { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewAmounts: false, canViewVat: true, canManageVat: false, canImport: false, canExport: false },
      payroll:          { canView: true, canGenerate: false, canViewAmounts: false, canViewPayeSchedule: false, canViewPensionSchedule: false, canViewNsitfSchedule: false, canViewWithholdingSchedule: false },
      financialReports: { canView: true, canExport: false, canViewAmounts: false, canViewPayrollSummary: false, canViewLoansAndAdvances: false },
      ledger:           { canView: true, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
      tasks:            { canView: true, canViewMyTasks: false, canViewDashboard: false, canViewReminders: false, canViewReports: false, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false },
      operations:       { canView: true, canViewAnalytics: false },
      opsInventory:     { canView: true, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
      opsWaybills:      { canView: true, canAdd: false, canEdit: false, canDelete: false, canExport: false },
      opsCheckout:      { canView: true, canAdd: false },
      opsMaintenance:   { canView: true, canAdd: false, canEdit: false, canDelete: false },
      opsVehicles:      { canView: true, canAdd: false, canEdit: false, canDelete: false, canViewFleet: true, canAddFleet: false, canEditFleet: false, canDeleteFleet: false, canViewLogs: true, canAddLogs: false, canEditLogs: false, canDeleteLogs: false, canViewDocuments: true, canEditDocuments: false, canImport: false, canExport: false },
      opsSites:         { canView: true },
      activityLog:      { canView: true, canExport: false },
      commLog:          { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false },
      beneficiaries:    { canView: true, canAdd: false, canEdit: false, canDelete: false, canImport: false, canExport: false },
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
            workspaceId: u.workspaceId || 'dcel-team',
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
    result[key] = { ...defaults[key], ...(stored[key] ?? {}) } as any;
  }
  return result;
}
