import { useEffect, useRef } from 'react';
import { useAppStore, DEFAULT_OFFBOARDING_TASKS, DEFAULT_LEAVE_TYPES } from '@/src/store/appStore';
import { useUserStore, NO_ACCESS, UserPrivileges } from '@/src/store/userStore';
import { fetchAllAppData, fetchAllUsers, fetchPresets, db } from '@/src/lib/supabaseService';
import { supabase } from '@/src/integrations/supabase/client';
import { dbToSite, dbToEmployee, dbToAttendance, dbToInvoice, dbToPendingInvoice, dbToSalaryAdvance, dbToLoan, dbToPayment, dbToVatPayment, dbToLeave, dbToProfile, dbToDisciplinary, dbToEvaluation, dbToCommLog, dbToCompanyExpense, dbToPendingSite, dbToLedgerEntry, dbToClientProfile, dbToDailyJournal, dbToSiteJournalEntry, dbToVehicle, dbToVehicleMovement, dbToVehicleDocumentType, dbToInterviewCandidate, dbToLeaveType, dbToStaffMerit, dbToClientContact } from '@/src/lib/supabaseService';
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
    let cancelled = false;

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

        // Auto-seed default leave types if completely missing from DB
        if (appData.leaveTypes.length === 0) {
          console.log('Seeding default leave types...');
          db.setLeaveTypes(DEFAULT_LEAVE_TYPES).catch(err => console.warn('Auto-seed leave types ignored:', err));
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

        // Load client contacts from DB; auto-migrate any contacts found only in commLogs
        const dbContacts = appData.clientContacts || [];
        const dbContactKeys = new Set(
          dbContacts.map((c: any) => `${c.clientName.trim().toLowerCase()}||${c.name.trim().toLowerCase()}`)
        );

        // Build contacts from commLogs that are missing from the DB
        const commLogContacts: any[] = [];
        (appData.commLogs || []).forEach((l: any) => {
          if (l.isInternal || !l.contactPerson || !l.client) return;
          const key = `${l.client.trim().toLowerCase()}||${l.contactPerson.trim().toLowerCase()}`;
          if (!dbContactKeys.has(key) && !commLogContacts.some((c: any) => `${c.clientName.trim().toLowerCase()}||${c.name.trim().toLowerCase()}` === key)) {
            commLogContacts.push({
              id: generateId(),
              name: l.contactPerson.trim(),
              clientName: l.client.trim(),
              siteIds: l.siteId ? [l.siteId] : [],
              siteNames: l.siteName ? [l.siteName] : [],
              isActive: true,
              isPrincipal: false,
              createdAt: l.date || new Date().toISOString(),
              updatedAt: l.date || new Date().toISOString(),
            });
          }
        });

        // Auto-migrate commLog-only contacts to the database (fire and forget)
        if (commLogContacts.length > 0) {
          db.upsertClientContacts(commLogContacts)
            .catch(err => console.warn('[DataLoader] Auto-migrate commLog contacts failed:', err));
        }

        const clientContacts = [...dbContacts, ...commLogContacts];

        // Build the app state payload
        const appStatePayload = {
          commLogs: appData.commLogs || [],
          clientContacts,
          sites: appData.sites,
          clients: appData.clients,
          clientProfiles: appData.clientProfiles || [],
          salaryAdvances: appData.salaryAdvances,
          loans: appData.loans,
          payments: appData.payments,
          vatPayments: appData.vatPayments,
          publicHolidays: appData.publicHolidays,
          departmentTasksList: processedDeptTasks,
          leaves: appData.leaves,
          leaveTypes: (() => {
            const raw = appData.leaveTypes.length > 0 ? appData.leaveTypes : useAppStore.getState().leaveTypes;
            // Purge anything that is NOT a clean name or is a stringified JSON object
            const sanitized = (raw || []).filter(lt => {
              if (!lt.name) return false;
              const name = String(lt.name).trim();
              if (name === '' || name.startsWith('{') || name.startsWith('[')) return false;
              return true;
            });
            // If we have suspicious data OR it's a first-time load, we must ensure defaults exist
            if (sanitized.length === 0) return [...DEFAULT_LEAVE_TYPES];
            return sanitized;
          })(),
          disciplinaryRecords: appData.disciplinaryRecords,
          evaluations: appData.evaluations,
          positions: appData.positions.length > 0 ? appData.positions : useAppStore.getState().positions,
          departments: appData.departments.length > 0 ? appData.departments : useAppStore.getState().departments,
          pendingSites: appData.pendingSites || [],
          staffMeritRecords: appData.staffMeritRecords || [],
          vehicleDocumentTypes: appData.vehicleDocumentTypes || [],
          interviewCandidates: appData.interviewCandidates || [],
          ...(appData.payrollVariables ? { payrollVariables: appData.payrollVariables as any } : {}),
          ...(appData.payeTaxVariables ? { payeTaxVariables: appData.payeTaxVariables as any } : {}),
          ...(appData.monthValues && Object.keys(appData.monthValues as any).length > 0 ? { monthValues: appData.monthValues as any } : {}),
          // Mark the current year as fully loaded (all pages fetched via pagination).
          // This prevents fetchAttendanceYearIfNeeded from re-fetching on first navigation
          // while still allowing lazy loads for past years (e.g. 2025) on demand.
          loadedAttendanceYears: [],
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

        // We do NOT preserve locally-created users not yet in Supabase.
        // Users are always created via the edge function, so if they are missing
        // from Supabase, it means they were deleted by an admin.
        // Preserving them here would cause deleted users to be immortalized across page reloads.

        // ── Set currentUserId to the logged-in Supabase user ────────
        const currentSupabaseId = authUser?.id ?? useUserStore.getState().currentUserId;

        let finalUsers = [...mergedUsers];
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
        if (cancelled) return;
        useNetworkStore.getState().setSyncing(false);
        // Silently ignore abort errors from Strict Mode double-mount / lock conflicts.
        // Do NOT reset loaded.current here — doing so causes an infinite abort→retry loop
        // because the second Strict Mode mount immediately steals the Web Lock again.
        if (err?.name === 'AbortError' || err?.message?.includes('AbortError') || err?.message?.includes('Lock')) {
          console.warn('[DataLoader] Ignored AbortError/Lock issue (likely Strict Mode overlap).');
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
    }, 200); // Delay to outlast React Strict Mode's double-mount cycle (~100ms) and avoid Web Lock conflicts

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
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

    const ACTIVE_TABLES = [
      'employees', 'attendance_records', 'profiles', 'payments', 'vat_payments', 'comm_logs', 
      'company_expenses', 'pending_sites', 'clients', 'ledger_categories', 
      'ledger_vendors', 'ledger_banks', 'ledger_beneficiary_banks', 'ledger_entries', 
      'daily_journals', 'site_journal_entries', 'vehicles', 'vehicle_movement_log', 
      'vehicle_document_types', 'interview_candidates', 'positions', 'departments', 
      'leave_types', 'public_holidays', 'department_tasks', 'staff_merit_record', 
      'privilege_presets', 'app_settings', 'client_contacts'
    ];

    const handler = (payload: any) => {
      const table = payload.table;
      const eventType = payload.eventType;
      const newRow = payload.new as Record<string, any>;
      const oldRow = payload.old as Record<string, any>;

      // Task-related tables are exclusively managed by AppDataContext's own
      // realtime channel ('app-realtime'). Skip them here to avoid double-processing.
      const TASK_TABLES = ['main_tasks', 'subtasks', 'task_updates', 'reminders'];
      if (TASK_TABLES.includes(table)) return;

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
                  const oldUser = currentUsers.find(u => u.id === updated.id);
                  const normalizedOld = JSON.stringify(backfillPrivileges(NO_ACCESS, oldUser?.privileges || {}));
                  const normalizedNew = JSON.stringify(backfillPrivileges(NO_ACCESS, updated.privileges || {}));

                  if (normalizedOld !== normalizedNew) {
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
                  const log = dbToCommLog(newRow);
                  const updatedLogs = [...current, log];
                  
                  // Update clientContacts dynamically in store
                  let updatedContacts = [...appState.clientContacts];
                  if (!log.isInternal && log.contactPerson && log.client) {
                    const contactName = log.contactPerson.trim();
                    const clientName = log.client.trim();
                    const contactLower = contactName.toLowerCase();
                    const clientLower = clientName.toLowerCase();
                    
                    const existingIdx = updatedContacts.findIndex(
                      c => c.clientName.trim().toLowerCase() === clientLower && c.name.trim().toLowerCase() === contactLower
                    );
                    
                    if (existingIdx === -1) {
                      updatedContacts.push({
                        id: generateId(),
                        name: contactName,
                        clientName: clientName,
                        siteIds: log.siteId ? [log.siteId] : [],
                        siteNames: log.siteName ? [log.siteName] : [],
                        isActive: true,
                        createdAt: log.date || new Date().toISOString(),
                        updatedAt: log.date || new Date().toISOString(),
                      });
                    } else {
                      const existing = updatedContacts[existingIdx];
                      const newSiteIds = log.siteId && !existing.siteIds.includes(log.siteId) ? [...existing.siteIds, log.siteId] : existing.siteIds;
                      const newSiteNames = log.siteName && !existing.siteNames.includes(log.siteName) ? [...existing.siteNames, log.siteName] : existing.siteNames;
                      updatedContacts[existingIdx] = {
                        ...existing,
                        siteIds: newSiteIds,
                        siteNames: newSiteNames,
                        updatedAt: new Date().toISOString(),
                      };
                    }
                  }
                  useAppStore.setState({ commLogs: updatedLogs, clientContacts: updatedContacts });
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
            case 'clients': {
              const current = appState.clientProfiles;
              if (eventType === 'INSERT') {
                if (!current.some((c: any) => c.id === newRow.id)) {
                  useAppStore.setState({ clientProfiles: [...current, dbToClientProfile(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToClientProfile(newRow);
                useAppStore.setState({ clientProfiles: current.map((c: any) => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ clientProfiles: current.filter((c: any) => c.id !== oldRow.id) });
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
            case 'daily_journals': {
              const current = appState.dailyJournals;
              if (eventType === 'INSERT') {
                if (!current.some(j => j.id === newRow.id)) {
                  useAppStore.setState({ dailyJournals: [dbToDailyJournal(newRow), ...current] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToDailyJournal(newRow);
                useAppStore.setState({ dailyJournals: current.map(j => j.id === updated.id ? updated : j) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ dailyJournals: current.filter(j => j.id !== oldRow.id) });
              }
              break;
            }
            case 'site_journal_entries': {
              const current = appState.siteJournalEntries;
              if (eventType === 'INSERT') {
                if (!current.some(e => e.id === newRow.id)) {
                  useAppStore.setState({ siteJournalEntries: [...current, dbToSiteJournalEntry(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToSiteJournalEntry(newRow);
                useAppStore.setState({ siteJournalEntries: current.map(e => e.id === updated.id ? updated : e) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ siteJournalEntries: current.filter(e => e.id !== oldRow.id) });
              }
              break;
            }
            case 'vehicles': {
              const current = appState.vehicles;
              if (eventType === 'INSERT') {
                if (!current.some(v => v.id === newRow.id)) {
                  useAppStore.setState({ vehicles: [...current, dbToVehicle(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToVehicle(newRow);
                useAppStore.setState({ vehicles: current.map(v => v.id === updated.id ? updated : v) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ vehicles: current.filter(v => v.id !== oldRow.id) });
              }
              break;
            }
            case 'vehicle_movement_log': {
              const current = appState.vehicleTrips;
              if (eventType === 'INSERT') {
                if (!current.some(t => t.id === newRow.id)) {
                  useAppStore.setState({ vehicleTrips: [...current, dbToVehicleMovement(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToVehicleMovement(newRow);
                useAppStore.setState({ vehicleTrips: current.map(t => t.id === updated.id ? updated : t) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ vehicleTrips: current.filter(t => t.id !== oldRow.id) });
              }
              break;
            }
            case 'vehicle_document_types': {
              const current = appState.vehicleDocumentTypes;
              if (eventType === 'INSERT') {
                if (!current.some(t => t.id === newRow.id)) {
                  useAppStore.setState({ vehicleDocumentTypes: [...current, dbToVehicleDocumentType(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToVehicleDocumentType(newRow);
                useAppStore.setState({ vehicleDocumentTypes: current.map(t => t.id === updated.id ? updated : t) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ vehicleDocumentTypes: current.filter(t => t.id !== oldRow.id) });
              }
              break;
            }
            case 'interview_candidates': {
              const current = appState.interviewCandidates;
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ interviewCandidates: [dbToInterviewCandidate(newRow), ...current] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToInterviewCandidate(newRow);
                useAppStore.setState({ interviewCandidates: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ interviewCandidates: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'positions': {
              const current = appState.positions;
              const mapPos = (p: any) => ({
                id: p.id,
                title: p.title || p.name,
                departmentId: p.department_id || null,
              });
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ positions: [...current, mapPos(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = mapPos(newRow);
                useAppStore.setState({ positions: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ positions: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'departments': {
              const current = appState.departments;
              const mapDept = (d: any) => ({
                id: d.id,
                name: d.name,
                staffType: d.staff_type || 'OFFICE',
                workDaysPerWeek: d.work_days_per_week || 5,
                parentDepartmentId: d.parent_department_id || null,
              });
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ departments: [...current, mapDept(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = mapDept(newRow);
                useAppStore.setState({ departments: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ departments: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'leave_types': {
              const current = appState.leaveTypes;
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ leaveTypes: [...current, dbToLeaveType(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToLeaveType(newRow);
                useAppStore.setState({ leaveTypes: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ leaveTypes: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'public_holidays': {
              const current = appState.publicHolidays;
              const mapHoliday = (h: any) => ({
                id: h.id,
                date: h.date,
                name: h.name,
              });
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ publicHolidays: [...current, mapHoliday(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = mapHoliday(newRow);
                useAppStore.setState({ publicHolidays: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ publicHolidays: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'department_tasks': {
              const current = appState.departmentTasksList;
              const mapDeptTask = (d: any) => ({
                department: d.department,
                onboardingTasks: d.onboarding_tasks || [],
                offboardingTasks: d.offboarding_tasks || [],
              });
              if (eventType === 'INSERT') {
                if (!current.some(c => c.department === newRow.department)) {
                  useAppStore.setState({ departmentTasksList: [...current, mapDeptTask(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = mapDeptTask(newRow);
                useAppStore.setState({ departmentTasksList: current.map(c => c.department === updated.department ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ departmentTasksList: current.filter(c => c.department !== oldRow.department) });
              }
              break;
            }
            case 'staff_merit_record': {
              const current = appState.staffMeritRecords;
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ staffMeritRecords: [...current, dbToStaffMerit(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToStaffMerit(newRow);
                useAppStore.setState({ staffMeritRecords: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ staffMeritRecords: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'privilege_presets': {
              const userStoreState = useUserStore.getState();
              const current = userStoreState.presets;
              const mapPreset = (p: any) => ({
                id: p.id,
                name: p.name,
                privileges: p.privileges,
              });
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useUserStore.setState({ presets: [...current, mapPreset(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = mapPreset(newRow);
                useUserStore.setState({ presets: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useUserStore.setState({ presets: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
            case 'app_settings': {
              if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const payload: any = {};
                if (newRow.payroll_variables !== undefined) payload.payrollVariables = newRow.payroll_variables;
                if (newRow.paye_tax_variables !== undefined) payload.payeTaxVariables = newRow.paye_tax_variables;
                if (newRow.month_values !== undefined) payload.monthValues = newRow.month_values;
                if (newRow.hr_variables !== undefined) payload.hrVariables = newRow.hr_variables;
                if (newRow.onboarding_templates !== undefined) payload.onboardingTemplates = newRow.onboarding_templates;
                if (newRow.super_admin_created !== undefined) payload.superAdminCreated = newRow.super_admin_created;
                if (newRow.super_admin_signup_enabled !== undefined) payload.superAdminSignupEnabled = newRow.super_admin_signup_enabled;
                if (newRow.id !== undefined) payload.settingsId = newRow.id;
                
                useAppStore.setState(payload);
                if (newRow.super_admin_created !== undefined || newRow.super_admin_signup_enabled !== undefined) {
                  useUserStore.setState({
                    superAdminCreated: newRow.super_admin_created ?? false,
                    superAdminSignupEnabled: newRow.super_admin_signup_enabled ?? true,
                  });
                }
              }
              break;
            }
            case 'client_contacts': {
              const current = appState.clientContacts;
              if (eventType === 'INSERT') {
                if (!current.some(c => c.id === newRow.id)) {
                  useAppStore.setState({ clientContacts: [...current, dbToClientContact(newRow)] });
                }
              } else if (eventType === 'UPDATE') {
                const updated = dbToClientContact(newRow);
                useAppStore.setState({ clientContacts: current.map(c => c.id === updated.id ? updated : c) });
              } else if (eventType === 'DELETE') {
                useAppStore.setState({ clientContacts: current.filter(c => c.id !== oldRow.id) });
              }
              break;
            }
          }
    };

    let channel = supabase.channel('app-realtime-global');

    ACTIVE_TABLES.forEach(t => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, handler);
    });

    channel.subscribe((status, err) => {
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
