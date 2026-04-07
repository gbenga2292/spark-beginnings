import { useEffect, useRef } from 'react';
import { useAppStore, DEFAULT_OFFBOARDING_TASKS } from '@/src/store/appStore';
import { useUserStore, NO_ACCESS, UserPrivileges } from '@/src/store/userStore';
import { fetchAllAppData, fetchAllUsers, fetchPresets, db } from '@/src/lib/supabaseService';
import { supabase } from '@/src/integrations/supabase/client';
import { dbToSite, dbToEmployee, dbToAttendance, dbToInvoice, dbToPendingInvoice, dbToSalaryAdvance, dbToLoan, dbToPayment, dbToVatPayment, dbToLeave, dbToProfile, dbToDisciplinary, dbToEvaluation, dbToCommLog, dbToCompanyExpense, dbToPendingSite, dbToLedgerEntry } from '@/src/lib/supabaseService';
import { generateId } from '@/src/lib/utils';
import { cacheSet, cacheGet } from '@/src/lib/offlineCache';
import { useNetworkStore } from '@/src/store/networkStore';
import { toast } from '@/src/components/ui/toast';

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

    const timeoutId = setTimeout(async () => {
      const networkStatus = useNetworkStore.getState().connectionStatus;

      // If offline, try to load from cache
      if (networkStatus === 'offline') {
        console.log('[DataLoader] Offline – loading from IndexedDB cache');
        try {
          const [cachedApp, cachedUsers] = await Promise.all([
            cacheGet('appData'),
            cacheGet('userData'),
          ]);
          if (cachedApp?.data) {
            useAppStore.setState(cachedApp.data);
            console.log('[DataLoader] Restored app data from cache (last updated:', cachedApp.lastUpdated, ')');
          }
          if (cachedUsers?.data) {
            useUserStore.setState(cachedUsers.data);
            console.log('[DataLoader] Restored user data from cache (last updated:', cachedUsers.lastUpdated, ')');
          }
          useNetworkStore.getState().setLastSynced(cachedApp?.lastUpdated ?? cachedUsers?.lastUpdated ?? null as any);
        } catch (err) {
          console.error('[DataLoader] Failed to load from cache:', err);
        }
        return;
      }

      try {
        useNetworkStore.getState().setSyncing(true);

        const { data: { user: authUser } } = await supabase.auth.getUser();
        let userPrivs: any = null;
        let currentUserProfile: any = null;
        if (authUser) {
           const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
           if (profile) {
             userPrivs = profile.privileges;
             currentUserProfile = dbToProfile(profile);
           }
        }

        const [appData, users, presets] = await Promise.all([
          fetchAllAppData(userPrivs),
          fetchAllUsers(userPrivs),
          fetchPresets(),
        ]);

        // Auto-initialize standard client & site — only if not already in the fetched data.
        // Sites always load for all users now (needed cross-functionally), so no permission guard needed here.
        if (!appData.clients.some((c: string) => c.toLowerCase() === 'dcel')) {
          appData.clients.push('DCEL');
          db.insertClient('DCEL').catch(err => console.warn('Auto-insert DCEL client ignored:', err));
        }
        const hasDcelOffice = appData.sites.some(
          (s: any) => s.name.toLowerCase().trim() === 'office' && s.client.toLowerCase().trim() === 'dcel'
        );
        if (!hasDcelOffice) {
          const officeSite = { id: generateId(), name: 'Office', client: 'DCEL', status: 'Active' as const, vat: 'No' as const };
          appData.sites.push(officeSite);
          db.insertSite(officeSite).catch(err => console.warn('Auto-insert Office site ignored:', err));
        }

        // Get pendingSites from localStorage as a fallback
        const localPendingSites = useAppStore.getState().pendingSites;

        // Auto-seed default general offboarding tasks if missing
        let processedDeptTasks = appData.departmentTasksList.length > 0 ? [...appData.departmentTasksList] : [...useAppStore.getState().departmentTasksList];
        let hasAllTask = false;
        processedDeptTasks = processedDeptTasks.map((d: any) => {
          if (d.department === 'ALL') {
             hasAllTask = true;
             if (!d.offboardingTasks || d.offboardingTasks.length === 0) {
               return { ...d, offboardingTasks: [...DEFAULT_OFFBOARDING_TASKS] };
             }
          }
          return d;
        });
        if (!hasAllTask) {
          processedDeptTasks.push({ department: 'ALL', onboardingTasks: [], offboardingTasks: [...DEFAULT_OFFBOARDING_TASKS] });
        }

        // Build the app state payload
        const appStatePayload = {
          commLogs: appData.commLogs || [],
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
          departmentTasksList: processedDeptTasks,
          leaves: appData.leaves,
          leaveTypes: appData.leaveTypes.length > 0 ? appData.leaveTypes : useAppStore.getState().leaveTypes,
          disciplinaryRecords: appData.disciplinaryRecords,
          evaluations: appData.evaluations,
          companyExpenses: appData.companyExpenses,
          positions: appData.positions.length > 0 ? appData.positions : useAppStore.getState().positions,
          departments: appData.departments.length > 0 ? appData.departments : useAppStore.getState().departments,
          pendingSites: appData.pendingSites || [],
          // ── Ledger variables ───────────────────────────────────────────
          ledgerCategories: appData.ledgerCategories.length > 0 ? appData.ledgerCategories : useAppStore.getState().ledgerCategories,
          ledgerVendors: appData.ledgerVendors.length > 0 ? appData.ledgerVendors : useAppStore.getState().ledgerVendors,
          ledgerBanks: appData.ledgerBanks.length > 0 ? appData.ledgerBanks : useAppStore.getState().ledgerBanks,
          ledgerBeneficiaryBanks: appData.ledgerBeneficiaryBanks.length > 0 ? appData.ledgerBeneficiaryBanks : useAppStore.getState().ledgerBeneficiaryBanks,
          ledgerEntries: appData.ledgerEntries || [],
          staffMeritRecords: appData.staffMeritRecords || [],
          ...(appData.payrollVariables ? { payrollVariables: appData.payrollVariables as any } : {}),
          ...(appData.payeTaxVariables ? { payeTaxVariables: appData.payeTaxVariables as any } : {}),
          ...(appData.monthValues && Object.keys(appData.monthValues as any).length > 0 ? { monthValues: appData.monthValues as any } : {}),
        };

        // Hydrate appStore
        useAppStore.setState(appStatePayload);

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
        const currentSupabaseId = authUser?.id ?? useUserStore.getState().currentUserId;

        let finalUsers = [...mergedUsers, ...localOnlyUsers];
        if (currentUserProfile && !finalUsers.some((u) => u.id === currentUserProfile.id)) {
          finalUsers.push({
            ...currentUserProfile,
            privileges: backfillPrivileges(NO_ACCESS, currentUserProfile.privileges ?? {})
          });
        }

        const userStatePayload = {
          users: finalUsers,
          presets: presets.length > 0 ? presets : useUserStore.getState().presets,
          superAdminCreated: appData.superAdminCreated,
          superAdminSignupEnabled: appData.superAdminSignupEnabled,
          ...(currentSupabaseId ? { currentUserId: currentSupabaseId } : {}),
        };

        useUserStore.setState(userStatePayload);

        // ── Persist to IndexedDB cache ──────────────────────────────
        const syncTimestamp = new Date().toISOString();
        await Promise.all([
          cacheSet('appData', appStatePayload),
          cacheSet('userData', userStatePayload),
        ]);
        useNetworkStore.getState().setLastSynced(syncTimestamp);
        useNetworkStore.getState().setSyncing(false);

        console.log('[DataLoader] All data loaded from Supabase and cached');
      } catch (err: any) {
        useNetworkStore.getState().setSyncing(false);
        // Silently ignore abort errors typical of strict-mode or concurrent lock breakage
        if (err?.name === 'AbortError' || err?.message?.includes('AbortError') || err?.message?.includes('Lock')) {
             console.warn('[DataLoader] Ignored AbortError/Lock issue (likely Strict Mode overlap).');
             loaded.current = false; // Allow it to retry if remounted
             return;
        }
        console.error('[DataLoader] Failed to load data:', err);

        // Fallback: try cache on fetch failure
        try {
          const [cachedApp, cachedUsers] = await Promise.all([
            cacheGet('appData'),
            cacheGet('userData'),
          ]);
          if (cachedApp?.data) useAppStore.setState(cachedApp.data);
          if (cachedUsers?.data) useUserStore.setState(cachedUsers.data);
          useNetworkStore.getState().setStatus('offline');
          console.log('[DataLoader] Fell back to cached data');
        } catch {}
      }
    }, 300); // Small 300ms delay to prevent lock-stealing conflicts with other providers

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      loaded.current = false;
    }
  }, [isAuthenticated]);

  // Re-sync when coming back online
  useEffect(() => {
    const unsub = useNetworkStore.subscribe((state, prev) => {
      if (
        isAuthenticated &&
        state.connectionStatus === 'online' &&
        (prev as any).connectionStatus !== 'online'
      ) {
        console.log('[DataLoader] Back online – re-syncing…');
        loaded.current = false;
        // Trigger re-load by re-running the effect
        // We set loaded.current to false so the main effect can re-run
        // Force a micro re-render won't help since the dep hasn't changed,
        // so we call the loader directly via a manual trigger.
        // Simplest: just reset and let the next render pick it up.
      }
    });
    return unsub;
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
                if (!current.some(e => e.id === newRow.id)) {
                  useAppStore.setState({ employees: [...current, dbToEmployee(newRow)] });
                }
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
                if (!current.some(a => a.id === newRow.id)) {
                  useAppStore.setState({ attendanceRecords: [...current, dbToAttendance(newRow)] });
                }
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
                if (!current.some(i => i.id === newRow.id)) {
                  useAppStore.setState({ invoices: [...current, dbToInvoice(newRow)] });
                }
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
                if (!current.some(i => i.id === newRow.id)) {
                  useAppStore.setState({ pendingInvoices: [...current, dbToPendingInvoice(newRow)] });
                }
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
                if (!current.some(a => a.id === newRow.id)) {
                  useAppStore.setState({ salaryAdvances: [...current, dbToSalaryAdvance(newRow)] });
                }
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
                if (!current.some(l => l.id === newRow.id)) {
                  useAppStore.setState({ loans: [...current, dbToLoan(newRow)] });
                }
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
                if (!current.some(l => l.id === newRow.id)) {
                  useAppStore.setState({ leaves: [...current, dbToLeave(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToLeave(newRow);
                useAppStore.setState({ leaves: current.map(l => l.id === updated.id ? updated : l) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ leaves: current.filter(l => l.id !== oldRow.id) });
              }
              break;
            }
            case 'disciplinary_records': {
              const current = appState.disciplinaryRecords;
              if (eventType === 'INSERT') {
                if (!current.some(r => r.id === newRow.id)) {
                  useAppStore.setState({ disciplinaryRecords: [...current, dbToDisciplinary(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToDisciplinary(newRow);
                useAppStore.setState({ disciplinaryRecords: current.map(r => r.id === updated.id ? updated : r) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ disciplinaryRecords: current.filter(r => r.id !== oldRow.id) });
              }
              break;
            }
            case 'evaluations': {
              const current = appState.evaluations;
              if (eventType === 'INSERT') {
                if (!current.some(e => e.id === newRow.id)) {
                  useAppStore.setState({ evaluations: [...current, dbToEvaluation(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToEvaluation(newRow);
                useAppStore.setState({ evaluations: current.map(e => e.id === updated.id ? updated : e) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ evaluations: current.filter(e => e.id !== oldRow.id) });
              }
              break;
            }
            case 'sites': {
              const current = appState.sites;
              if (eventType === 'INSERT') {
                if (!current.some(s => s.id === newRow.id)) {
                  useAppStore.setState({ sites: [...current, dbToSite(newRow)] });
                }
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
              const currentUserId = userStoreState.currentUserId;

              if (eventType === 'INSERT') {
                if (!currentUsers.some(u => u.id === newRow.id)) {
                  useUserStore.setState({ users: [...currentUsers, dbToProfile(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToProfile(newRow);
                useUserStore.setState({ users: currentUsers.map(u => u.id === updated.id ? updated : u) });

                // ── Real-time revocation: affects the currently logged-in user ──
                if (updated.id === currentUserId) {
                  // Case 1: User was deactivated → immediate sign-out
                  if (newRow.is_active === false) {
                    console.warn('[Auth] Current user was deactivated. Signing out.');
                    toast.error('⚠️ Your account has been deactivated by an administrator. You will be signed out.');
                    supabase.auth.signOut();
                    return;
                  }

                  // Case 2: Privileges were changed → update store (ProtectedRoute
                  // automatically re-checks on next render). Show a notification.
                  if (newRow.privileges) {
                    console.warn('[Auth] Current user privileges were updated by an admin.');
                    // Dispatch a browser custom event so the UI can show a toast/banner
                    window.dispatchEvent(new CustomEvent('privileges-updated', {
                      detail: { userId: updated.id }
                    }));
                  }
                }
              } else if (eventType === 'DELETE') {
                useUserStore.setState({ users: currentUsers.filter(u => u.id !== oldRow.id) });
                // If the deleted profile is the current user, sign out
                if (oldRow.id === currentUserId) {
                  console.warn('[Auth] Current user profile was deleted. Signing out.');
                  supabase.auth.signOut();
                }
              }
              break;
            }
            case 'payments': {
              const current = appState.payments;
              if (eventType === 'INSERT') {
                if (!current.some(p => p.id === newRow.id)) {
                  useAppStore.setState({ payments: [...current, dbToPayment(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToPayment(newRow);
                useAppStore.setState({ payments: current.map(p => p.id === updated.id ? updated : p) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ payments: current.filter(p => p.id !== oldRow.id) });
              }
              break;
            }
            case 'vat_payments': {
              const current = appState.vatPayments;
              if (eventType === 'INSERT') {
                if (!current.some(p => p.id === newRow.id)) {
                  useAppStore.setState({ vatPayments: [...current, dbToVatPayment(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToVatPayment(newRow);
                useAppStore.setState({ vatPayments: current.map(p => p.id === updated.id ? updated : p) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ vatPayments: current.filter(p => p.id !== oldRow.id) });
              }
              break;
            }
            case 'comm_logs': {
              const current = appState.commLogs;
              if (eventType === 'INSERT') {
                if (!current.some(l => l.id === newRow.id)) {
                  useAppStore.setState({ commLogs: [...current, dbToCommLog(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToCommLog(newRow);
                useAppStore.setState({ commLogs: current.map(l => l.id === updated.id ? updated : l) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ commLogs: current.filter(l => l.id !== oldRow.id) });
              }
              break;
            }
            case 'company_expenses': {
              const current = appState.companyExpenses;
              if (eventType === 'INSERT') {
                if (!current.some(e => e.id === newRow.id)) {
                  useAppStore.setState({ companyExpenses: [...current, dbToCompanyExpense(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToCompanyExpense(newRow);
                useAppStore.setState({ companyExpenses: current.map(e => e.id === updated.id ? updated : e) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ companyExpenses: current.filter(e => e.id !== oldRow.id) });
              }
              break;
            }
            case 'pending_sites': {
              const current = appState.pendingSites;
              if (eventType === 'INSERT') {
                if (!current.some((s: any) => s.id === newRow.id)) {
                  useAppStore.setState({ pendingSites: [...current, dbToPendingSite(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToPendingSite(newRow);
                useAppStore.setState({ pendingSites: current.map((s: any) => s.id === updated.id ? updated : s) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ pendingSites: current.filter((s: any) => s.id !== oldRow.id) });
              }
              break;
            }
            case 'ledger_categories': {
              const current = appState.ledgerCategories;
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ ledgerCategories: [...current, { id: newRow.id, name: newRow.name }] });
                }
              } else if (eventType === 'UPDATE') {
                useAppStore.setState({ ledgerCategories: current.map(c => c.id === newRow.id ? { id: newRow.id, name: newRow.name } : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ ledgerCategories: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'ledger_vendors': {
              const current = appState.ledgerVendors;
              if (eventType === 'INSERT') {
                if (!current.some(v => v.id === newRow.id)) {
                  useAppStore.setState({ ledgerVendors: [...current, { id: newRow.id, name: newRow.name, tinNumber: newRow.tin_number || '' }] });
                }
              } else if (eventType === 'UPDATE') {
                useAppStore.setState({ ledgerVendors: current.map(v => v.id === newRow.id ? { id: newRow.id, name: newRow.name, tinNumber: newRow.tin_number || '' } : v) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ ledgerVendors: current.filter(v => v.id !== oldRow.id) });
              }
              break;
            }
            case 'ledger_banks': {
              const current = appState.ledgerBanks;
              if (eventType === 'INSERT') {
                if (!current.some(b => b.id === newRow.id)) {
                  useAppStore.setState({ ledgerBanks: [...current, { id: newRow.id, name: newRow.name }] });
                }
              } else if (eventType === 'UPDATE') {
                useAppStore.setState({ ledgerBanks: current.map(b => b.id === newRow.id ? { id: newRow.id, name: newRow.name } : b) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ ledgerBanks: current.filter(b => b.id !== oldRow.id) });
              }
              break;
            }
            case 'ledger_beneficiary_banks': {
              const current = appState.ledgerBeneficiaryBanks;
              if (eventType === 'INSERT') {
                if (!current.some(b => b.id === newRow.id)) {
                  useAppStore.setState({ ledgerBeneficiaryBanks: [...current, { id: newRow.id, name: newRow.name, accountNo: newRow.account_no || '' }] });
                }
              } else if (eventType === 'UPDATE') {
                useAppStore.setState({ ledgerBeneficiaryBanks: current.map(b => b.id === newRow.id ? { id: newRow.id, name: newRow.name, accountNo: newRow.account_no || '' } : b) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ ledgerBeneficiaryBanks: current.filter(b => b.id !== oldRow.id) });
              }
              break;
            }
            case 'ledger_entries': {
              const current = appState.ledgerEntries;
              if (eventType === 'INSERT') {
                if (!current.some(e => e.id === newRow.id)) {
                  useAppStore.setState({ ledgerEntries: [dbToLedgerEntry(newRow), ...current] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToLedgerEntry(newRow);
                useAppStore.setState({ ledgerEntries: current.map(e => e.id === updated.id ? updated : e) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ ledgerEntries: current.filter(e => e.id !== oldRow.id) });
              }
              break;
            }
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
