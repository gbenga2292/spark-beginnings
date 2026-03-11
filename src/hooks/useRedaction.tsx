import { useUserStore, UserPrivileges } from '@/src/store/userStore';

type RedactionKey =
  | 'employees'
  | 'financeDashboard'
  | 'salaryLoans'
  | 'billing'
  | 'payments'
  | 'payroll'
  | 'financialReports';

/**
 * Returns whether amounts should be shown (true = visible, false = redacted).
 * Admins (no currentUser set) always see full data.
 */
export function useRedaction(page: RedactionKey): boolean {
  const currentUser = useUserStore((s) => s.getCurrentUser());

  // If no user (super admin flow) → always show
  if (!currentUser) return true;

  const priv = currentUser.privileges;

  switch (page) {
    case 'employees':        return !(priv.employees?.redactSalary ?? false);
    case 'financeDashboard': return !(priv.financeDashboard?.redactAmounts ?? false);
    case 'salaryLoans':      return !(priv.salaryLoans?.redactAmounts ?? false);
    case 'billing':          return !(priv.billing?.redactAmounts ?? false);
    case 'payments':         return !(priv.payments?.redactAmounts ?? false);
    case 'payroll':          return !(priv.payroll?.redactAmounts ?? false);
    case 'financialReports': return !(priv.financialReports?.redactAmounts ?? false);
    default:                 return true;
  }
}

/** Render a monetary value, blurring it if the user's redaction flag is set. */
export function RedactedAmount({
  value,
  showCurrency = true,
  className = '',
}: {
  value: string | number;
  showCurrency?: boolean;
  className?: string;
}) {
  const formatted = typeof value === 'number'
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  return (
    <span className={`inline-flex items-center gap-0.5 select-none blur-sm pointer-events-none text-slate-400 ${className}`}>
      {showCurrency && '₦'}████
    </span>
  ) as unknown as React.ReactElement;
}

// Re-export for convenience
export { useRedaction as default };
