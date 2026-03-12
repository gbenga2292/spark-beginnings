import { useUserStore, UserPrivileges, FULL_ACCESS } from '@/src/store/userStore';

/**
 * Returns the current user's privilege object for a given page section.
 * Falls back to FULL_ACCESS when no user is set (super-admin flow) or when
 * the section is missing from the user's stored privileges (e.g. added after
 * the user was created).
 *
 * Usage:
 *   const priv = usePriv('employees');
 *   // priv.canAdd, priv.canEdit, priv.canDelete …
 */
export function usePriv<K extends keyof UserPrivileges>(section: K): UserPrivileges[K] {
  const currentUser = useUserStore((s) => s.getCurrentUser());
  if (!currentUser) return FULL_ACCESS[section];
  // Guard: if this section is missing from stored privileges (schema added later),
  // fall back to FULL_ACCESS for that section so the UI never receives undefined.
  return currentUser.privileges[section] ?? FULL_ACCESS[section];
}
