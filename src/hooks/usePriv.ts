import { useUserStore, UserPrivileges, FULL_ACCESS } from '@/src/store/userStore';

/**
 * Returns the current user's privilege object for a given page section.
 * Falls back to FULL_ACCESS when no user is set (super-admin flow).
 *
 * Usage:
 *   const priv = usePriv('employees');
 *   // priv.canAdd, priv.canEdit, priv.canDelete …
 */
export function usePriv<K extends keyof UserPrivileges>(section: K): UserPrivileges[K] {
  const currentUser = useUserStore((s) => s.getCurrentUser());
  if (!currentUser) return FULL_ACCESS[section];
  return currentUser.privileges[section];
}
