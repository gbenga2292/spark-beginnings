import { useEffect, useRef } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore, NO_ACCESS, UserPrivileges } from '@/src/store/userStore';
import { fetchAllAppData, fetchAllUsers, fetchPresets } from '@/src/lib/supabaseService';
import { supabase } from '@/src/integrations/supabase/client';

/** Fills in any missing privilege sections using NO_ACCESS defaults. */
function backfillPrivileges(
  defaults: UserPrivileges,
  stored: Partial<UserPrivileges>
): UserPrivileges {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof UserPrivileges)[]) {
    result[key] = { ...defaults[key], ...(stored[key] ?? {}) } as any;
  }
  return result;
}

/** Returns true if a privileges object has at least one permission set to true. */
function hasAnyGrant(privs: Partial<UserPrivileges>): boolean {
  return Object.values(privs).some(
    (section) => section && Object.values(section as object).some(Boolean)
  );
}

/**
 * Loads all data from Supabase into Zustand stores when authenticated.
 * Call once at the app root level.
 */
export function useDataLoader(isAuthenticated: boolean) {
  const loaded = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || loaded.current) return;
    loaded.current = true;

    (async () => {
      try {
        const [appData, users, presets] = await Promise.all([
          fetchAllAppData(),
          fetchAllUsers(),
          fetchPresets(),
        ]);

        // Hydrate appStore
        useAppStore.setState({
          sites: appData.sites,
          clients: appData.clients,
          employees: appData.employees,
          attendanceRecords: appData.attendanceRecords,
          invoices: appData.invoices,
          pendingInvoices: appData.pendingInvoices,
          salaryAdvances: appData.salaryAdvances,
          loans: appData.loans,
          payments: appData.payments,
          vatPayments: appData.vatPayments,
          publicHolidays: appData.publicHolidays,
          departmentTasksList: appData.departmentTasksList.length > 0 ? appData.departmentTasksList : useAppStore.getState().departmentTasksList,
          leaves: appData.leaves,
          leaveTypes: appData.leaveTypes.length > 0 ? appData.leaveTypes : useAppStore.getState().leaveTypes,
          positions: appData.positions.length > 0 ? appData.positions : useAppStore.getState().positions,
          departments: appData.departments.length > 0 ? appData.departments : useAppStore.getState().departments,
          ...(appData.payrollVariables ? { payrollVariables: appData.payrollVariables as any } : {}),
          ...(appData.payeTaxVariables ? { payeTaxVariables: appData.payeTaxVariables as any } : {}),
          ...(appData.monthValues && Object.keys(appData.monthValues as any).length > 0 ? { monthValues: appData.monthValues as any } : {}),
        });

        // ── Merge user data ──────────────────────────────────────────
        const localUsers = useUserStore.getState().users;
        const localMap = new Map(localUsers.map((u) => [u.id, u]));
        const remoteIds = new Set(users.map((u) => u.id));

        const mergedUsers = users.map((remoteUser) => {
          const localUser = localMap.get(remoteUser.id);
          const remotePrivs = backfillPrivileges(NO_ACCESS, remoteUser.privileges ?? {});

          // Supabase has real grants → use them (source of truth)
          if (hasAnyGrant(remotePrivs)) {
            return { ...remoteUser, privileges: remotePrivs };
          }

          // Supabase returned empty — fall back to local if available
          if (localUser && hasAnyGrant(localUser.privileges)) {
            return { ...remoteUser, privileges: localUser.privileges };
          }

          return { ...remoteUser, privileges: remotePrivs };
        });

        // Preserve locally-created users not yet in Supabase
        const localOnlyUsers = localUsers.filter((u) => !remoteIds.has(u.id));

        // ── Set currentUserId to the logged-in Supabase user ────────
        // This must happen AFTER users are loaded so getCurrentUser() works.
        // We re-read the Supabase session here to get the current user's id.
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const currentSupabaseId = authUser?.id ?? useUserStore.getState().currentUserId;

        useUserStore.setState({
          users: [...mergedUsers, ...localOnlyUsers],
          presets: presets.length > 0 ? presets : useUserStore.getState().presets,
          superAdminCreated: appData.superAdminCreated,
          superAdminSignupEnabled: appData.superAdminSignupEnabled,
          // Ensure currentUserId is set to the Supabase auth user id
          ...(currentSupabaseId ? { currentUserId: currentSupabaseId } : {}),
        });

        console.log('[DataLoader] All data loaded from Supabase');
      } catch (err) {
        console.error('[DataLoader] Failed to load data:', err);
      }
    })();
  }, [isAuthenticated]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      loaded.current = false;
    }
  }, [isAuthenticated]);
}
