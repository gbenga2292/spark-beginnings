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

  // ── Excel serial number (cellDates: false, raw number) ───────────
  if (typeof dateStr === 'number') {
    if (dateStr <= 1) return ''; // 0 = empty, 1 = Jan 1 1900 (Excel bug)
    // Excel epoch is Dec 30, 1899; convert serial → UTC date
    const excelEpoch = Date.UTC(1899, 11, 30);
    const msDate = new Date(excelEpoch + dateStr * 86_400_000);
    const y = msDate.getUTCFullYear();
    const m = String(msDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(msDate.getUTCDate()).padStart(2, '0');
    if (y < 1950 || y > 2100) return '';
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
