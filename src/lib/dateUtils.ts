/**
 * Normalizes a date string to yyyy-MM-dd format for input type="date".
 * If it's invalid or empty, returns an empty string.
 */
export function normalizeDate(dateStr: any): string {
  if (!dateStr) return '';
  
  // Handle native Date objects (from Excel's cellDates: true)
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return '';
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Ensure we're working with a string
  if (typeof dateStr !== 'string') {
    dateStr = String(dateStr);
  }

  // If it's already in the correct format, or at least starts with 4 digits and has dashes
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
  
  // Try to parse it
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // If it's like 01-02-24, try to split and swap
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      // Guessing dd-mm-yy or mm-dd-yy
      // Usually we want yyyy-mm-dd
      let [p1, p2, p3] = parts;
      if (p1.length === 4) return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      if (p3.length === 4) return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      if (p3.length === 2) {
         const yearPrefix = parseInt(p3) > 50 ? '19' : '20';
         return `${yearPrefix}${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      }
    }
    return '';
  }
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
