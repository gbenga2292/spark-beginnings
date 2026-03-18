import { useEffect, useRef } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore, NO_ACCESS, UserPrivileges } from '@/src/store/userStore';
import { fetchAllAppData, fetchAllUsers, fetchPresets, db } from '@/src/lib/supabaseService';
import { supabase } from '@/src/integrations/supabase/client';
import { dbToSite, dbToEmployee, dbToAttendance, dbToInvoice, dbToPendingInvoice, dbToSalaryAdvance, dbToLoan, dbToPayment, dbToVatPayment, dbToLeave, dbToProfile } from '@/src/lib/supabaseService';

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

        // Auto-initialize standard client & site
        if (!appData.clients.includes('DCEL')) {
          appData.clients.push('DCEL');
          db.insertClient('DCEL');
        }
        if (!appData.sites.some(s => s.name.toLowerCase() === 'office' && s.client.toLowerCase() === 'dcel')) {
          const officeSite = { id: crypto.randomUUID(), name: 'Office', client: 'DCEL', status: 'Active' as const, vat: 'No' as const };
          appData.sites.push(officeSite);
          db.insertSite(officeSite);
        }

        // Preserve pendingSites from localStorage — they have no Supabase table yet
        const localPendingSites = useAppStore.getState().pendingSites;

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
          // Always preserve pendingSites from localStorage — not synced to Supabase
          pendingSites: localPendingSites,
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

/**
 * Creates Realtime subscriptions to core tables so that changes
 * made by other users immediately reflect in the Zustand store.
 */
export function useRealtimeData(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;

    // We create a global channel to listen to all public schema changes
    // Alternatively, you can create one channel per table
    const channel = supabase
      .channel('app-realtime-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table;
          const eventType = payload.eventType;
          const newRow = payload.new as Record<string, any>;
          const oldRow = payload.old as Record<string, any>;

          // Helper to get current state safely
          const appState = useAppStore.getState();

          switch (table) {
            case 'employees': {
              const current = appState.employees;
              if (eventType === 'INSERT') {
                useAppStore.setState({ employees: [...current, dbToEmployee(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToEmployee(newRow);
                useAppStore.setState({ employees: current.map(e => e.id === updated.id ? updated : e) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ employees: current.filter(e => e.id !== oldRow.id) });
              }
              break;
            }
            case 'attendance_records': {
              const current = appState.attendanceRecords;
              if (eventType === 'INSERT') {
                useAppStore.setState({ attendanceRecords: [...current, dbToAttendance(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToAttendance(newRow);
                useAppStore.setState({ attendanceRecords: current.map(a => a.id === updated.id ? updated : a) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ attendanceRecords: current.filter(a => a.id !== oldRow.id) });
              }
              break;
            }
            case 'invoices': {
              const current = appState.invoices;
              if (eventType === 'INSERT') {
                useAppStore.setState({ invoices: [...current, dbToInvoice(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToInvoice(newRow);
                useAppStore.setState({ invoices: current.map(i => i.id === updated.id ? updated : i) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ invoices: current.filter(i => i.id !== oldRow.id) });
              }
              break;
            }
            case 'pending_invoices': {
              const current = appState.pendingInvoices;
              if (eventType === 'INSERT') {
                useAppStore.setState({ pendingInvoices: [...current, dbToPendingInvoice(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToPendingInvoice(newRow);
                useAppStore.setState({ pendingInvoices: current.map(i => i.id === updated.id ? updated : i) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ pendingInvoices: current.filter(i => i.id !== oldRow.id) });
              }
              break;
            }
            case 'salary_advances': {
              const current = appState.salaryAdvances;
              if (eventType === 'INSERT') {
                useAppStore.setState({ salaryAdvances: [...current, dbToSalaryAdvance(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToSalaryAdvance(newRow);
                useAppStore.setState({ salaryAdvances: current.map(a => a.id === updated.id ? updated : a) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ salaryAdvances: current.filter(a => a.id !== oldRow.id) });
              }
              break;
            }
            case 'loans': {
              const current = appState.loans;
              if (eventType === 'INSERT') {
                useAppStore.setState({ loans: [...current, dbToLoan(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToLoan(newRow);
                useAppStore.setState({ loans: current.map(l => l.id === updated.id ? updated : l) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ loans: current.filter(l => l.id !== oldRow.id) });
              }
              break;
            }
            case 'leaves': {
              const current = appState.leaves;
              if (eventType === 'INSERT') {
                useAppStore.setState({ leaves: [...current, dbToLeave(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToLeave(newRow);
                useAppStore.setState({ leaves: current.map(l => l.id === updated.id ? updated : l) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ leaves: current.filter(l => l.id !== oldRow.id) });
              }
              break;
            }
            case 'sites': {
              const current = appState.sites;
              if (eventType === 'INSERT') {
                useAppStore.setState({ sites: [...current, dbToSite(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToSite(newRow);
                useAppStore.setState({ sites: current.map(s => s.id === updated.id ? updated : s) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ sites: current.filter(s => s.id !== oldRow.id) });
              }
              break;
            }
            case 'profiles': {
              const userStoreState = useUserStore.getState();
              const currentUsers = userStoreState.users;
              if (eventType === 'INSERT') {
                useUserStore.setState({ users: [...currentUsers, dbToProfile(newRow)] });
              } else if (eventType === 'UPDATE') {
                const updated = dbToProfile(newRow);
                useUserStore.setState({ users: currentUsers.map(u => u.id === updated.id ? updated : u) });
              } else if (eventType === 'DELETE') {
                useUserStore.setState({ users: currentUsers.filter(u => u.id !== oldRow.id) });
              }
              break;
            }
            // You can add payments, vat_payments and others if needed
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Error setting up realtime:", err);
        } else {
          console.log("Realtime subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);
}
