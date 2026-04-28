/**
 * Normalizes a date value to yyyy-MM-dd format for input type="date".
 * Handles: JS Date objects (from XLSX cellDates:true), Excel serial numbers,
 * dd/mm/yyyy strings (app export format), yyyy-mm-dd, and various other formats.
 * Returns '' for empty, invalid, or out-of-range values.
 */
export function normalizeDate(dateStr: any): string {
  if (!dateStr) return '';

  // ── JS Date object (from XLSX cellDates: true) ───────────────────
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return '';
    // Always use UTC methods — XLSX stores internally as UTC midnight
    const y = dateStr.getUTCFullYear();
    const m = String(dateStr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getUTCDate()).padStart(2, '0');
    // Reject epoch / near-epoch dates that come from empty date-formatted cells
    if (y < 1950 || y > 2100) return '';
    return `${y}-${m}-${d}`;
  }

  // ── JS number (Excel serial or JS Timestamp) ───────────────────
  if (typeof dateStr === 'number') {
    if (dateStr <= 1) return ''; // 0 = empty, 1 = Jan 1 1900 (Excel bug)

    let msDate: Date;
    // Excel serial numbers for reasonable dates (1950-2100) are ~18,000 to ~73,000.
    // JS timestamps for those dates are > 1,000,000,000 (ms) or > 1,000,000 (s).
    if (dateStr > 200000) {
      // Treat as JS timestamp (ms or s)
      // If it's small-ish (e.g. < 1e11), it might be seconds. 
      // If it's large (e.g. > 1e11), it's definitely milliseconds.
      msDate = new Date(dateStr > 10000000000 ? dateStr : dateStr * 1000);
    } else {
      // Treat as Excel serial number (days since 1899-12-30)
      const excelEpoch = Date.UTC(1899, 11, 30);
      msDate = new Date(excelEpoch + dateStr * 86_400_000);
    }

    if (isNaN(msDate.getTime())) return '';

    const y = msDate.getUTCFullYear();
    const m = String(msDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(msDate.getUTCDate()).padStart(2, '0');
    
    // Safety check for reasonable date range
    if (y < 1900 || y > 2200) return '';
    return `${y}-${m}-${d}`;
  }

  // ── Coerce to string ─────────────────────────────────────────────
  if (typeof dateStr !== 'string') {
    dateStr = String(dateStr);
  }
  const s = dateStr.trim();
  if (!s || s === '0' || s === '0.0') return '';

  // ── Already yyyy-mm-dd (or yyyy-mm-ddT...) ───────────────────────
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];

  // ── dd/mm/yyyy  (app's own export format) ────────────────────────
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const y = parseInt(yyyy);
    if (y < 1950 || y > 2100) return '';
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // ── dd-mm-yyyy or other dash variants ────────────────────────────
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p1.length === 4) {
      // yyyy-mm-dd (already handled above, but catch edge cases)
      return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
    }
    if (p3.length === 4) {
      const y = parseInt(p3);
      if (y < 1950 || y > 2100) return '';
      return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
    if (p3.length === 2) {
      const yearPrefix = parseInt(p3) > 50 ? '19' : '20';
      const fullYear = `${yearPrefix}${p3}`;
      return `${fullYear}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
  }

  // ── General Date.parse fallback ──────────────────────────────────
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return '';
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const d = String(parsed.getUTCDate()).padStart(2, '0');
  if (y < 1950 || y > 2100) return '';
  return `${y}-${m}-${d}`;
}

/**
 * Standardizes a date value for UI display across the entire application.
 * Returns in dd/mm/yyyy format as requested by the user.
 */
export function formatDisplayDate(dateStr: any): string {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return '—';

  // normalized is always yyyy-MM-dd at this point
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return '—';
}

/**
 * Returns the start and end dates for a payroll period given a year, month, and start day.
 * If startDay is 1, returns the calendar month.
 * If startDay is > 1, returns from (month-1, day) to (month, day-1).
 */
export function getPayrollPeriodDates(year: number, month: number, startDay: number = 1): { start: Date, end: Date } {
  if (startDay <= 1) {
    // Calendar month: Jan 1 to Jan 31
    return {
      start: new Date(year, month - 1, 1, 12, 0, 0),
      end: new Date(year, month, 0, 12, 0, 0)
    };
  }
  
  // Custom cycle: If month is January (1) and startDay is 26:
  // We return Dec 26 to Jan 25 (the period ENDING in January)
  
  // 1. Start Date: Day X of PREVIOUS month
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  const actualStartDay = Math.min(startDay, prevMonthLastDay);
  const start = new Date(year, month - 2, actualStartDay, 12, 0, 0);
  
  // 2. End Date: Day X-1 of CURRENT month
  const currMonthLastDay = new Date(year, month, 0).getDate();
  const actualEndDay = Math.min(startDay - 1, currMonthLastDay);
  
  // If actualEndDay is 0 (startDay=1), fallback to currMonthLastDay
  const end = new Date(year, month - 1, actualEndDay || currMonthLastDay, 12, 0, 0);
  
  return { start, end };
}
