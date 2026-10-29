import { useCallback, useState } from 'react';

const STORAGE_KEY = 'financial.includeBroughtForward.v2';

/** Persisted toggle controlling whether prior-period Balance B/F is applied in financial reports. Defaults to false. */
export function useIncludeBroughtForward(): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
      // Migrate / reset legacy key that defaulted to true
      if (localStorage.getItem('financial.includeBroughtForward') !== null) {
        localStorage.removeItem('financial.includeBroughtForward');
      }
      // Default to FALSE because prior-year ledger vouchers are not yet in the database
      return false;
    } catch {
      return false;
    }
  });

  const update = useCallback((next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* storage unavailable — keep in-memory value */
    }
  }, []);

  return [value, update];
}
