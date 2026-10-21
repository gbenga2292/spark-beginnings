import { useUserStore, UserPrivileges, FULL_ACCESS, NO_ACCESS } from '@/src/store/userStore';

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

  const priv = currentUser.privileges?.[section];
  if (priv) return priv;

  // Fallback for newly separated privileges on existing user profiles
  if (section === 'vendorInvoices' && currentUser.privileges?.ledger) {
    const l = currentUser.privileges.ledger;
    return {
      canView: !!l.canView,
      canAdd: !!l.canAdd,
      canEdit: !!l.canEdit,
      canDelete: !!l.canDelete,
      canRecordPayment: !!l.canAdd,
      canDirectApprove: !!l.canDirectApprove,
    } as unknown as UserPrivileges[K];
  }

  if (section === 'phonebook' && (currentUser.privileges?.sites || currentUser.privileges?.clients)) {
    const s = currentUser.privileges.sites || currentUser.privileges.clients;
    return {
      canView: !!s?.canView,
      canAdd: !!(s as any)?.canAdd || !!(s as any)?.canAddClient,
      canEdit: !!(s as any)?.canEdit || !!(s as any)?.canEditClient,
      canDelete: !!(s as any)?.canDelete || !!(s as any)?.canDeleteClient,
      canExport: !!(s as any)?.canExport,
    } as unknown as UserPrivileges[K];
  }

  // Guard: if this section is missing from stored privileges (schema added later),
  // fall back to NO_ACCESS for that section so the UI never receives undefined.
  return NO_ACCESS[section];
}
