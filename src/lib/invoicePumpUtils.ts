import { normalizeDate } from './dateUtils';

export interface InvoiceLikeForPump {
  id?: string;
  pumpStartDate?: string | null;
  startDate?: string | null;
  date?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  site?: string | null;
}

export interface SitePumpDateLike {
  id?: string;
  siteId: string;
  assetId?: string | null;
  pumpStartDate?: string | null;
  pumpStopDate?: string | null;
}

/**
 * Resolves the effective pump start date for an invoice.
 * Correctly differentiates between restarted sites, past stints, and current active runs.
 * 1. Honors explicit invoice.pumpStartDate.
 * 2. Excludes historical pump stints that already stopped prior to the invoice creation date.
 * 3. Matches the stint closest in proximity to the invoice cycle date.
 */
export function resolveEffectivePumpStartDate(
  inv: InvoiceLikeForPump | null | undefined,
  sites: { id: string; name?: string }[],
  sitePumpDates: SitePumpDateLike[]
): string | undefined {
  if (!inv) return undefined;

  // 1. If invoice explicitly has pumpStartDate recorded, prioritize it
  if (inv.pumpStartDate && inv.pumpStartDate.trim() !== '') {
    return normalizeDate(inv.pumpStartDate) || inv.pumpStartDate;
  }

  // 2. Identify site by siteId or siteName
  const sName = (inv.siteName || inv.site || '').trim().toLowerCase();
  const sObj = sites.find(s => (inv.siteId && s.id === inv.siteId) || (s.name && s.name.trim().toLowerCase() === sName));
  const sId = sObj?.id || inv.siteId;
  if (!sId) return undefined;

  // 3. Get all configured pump dates for this site
  const siteRecords = (sitePumpDates || []).filter(p => p.siteId === sId && p.pumpStartDate && p.pumpStartDate.trim() !== '');
  if (siteRecords.length === 0) return undefined;

  const invDateStr = normalizeDate(inv.startDate || inv.date);
  const invTime = invDateStr ? new Date(invDateStr).getTime() : NaN;

  // 4. Exclude pump stints that stopped BEFORE this invoice was issued
  // (e.g. site restarted in November; September pump stints that ended on 2026-09-15 must never be applied to November invoices)
  const relevantRecords = siteRecords.filter(p => {
    if (isNaN(invTime)) return true;
    if (p.pumpStopDate && p.pumpStopDate.trim() !== '') {
      const stopTime = new Date(p.pumpStopDate).getTime();
      if (stopTime < invTime) return false;
    }
    return true;
  });

  if (relevantRecords.length === 0) {
    // All known pumps for this site stopped in the past prior to this invoice.
    // The site has restarted, but no new pump stint has started yet -> return undefined so it displays Pending
    return undefined;
  }

  // 5. Sort eligible candidates by proximity to the invoice date
  if (!isNaN(invTime)) {
    const sortedByProximity = [...relevantRecords].sort((a, b) => {
      const timeA = new Date(a.pumpStartDate!).getTime();
      const timeB = new Date(b.pumpStartDate!).getTime();
      const diffA = Math.abs(timeA - invTime);
      const diffB = Math.abs(timeB - invTime);
      if (diffA !== diffB) return diffA - diffB;
      // If tied, prefer currently active pump (no stop date)
      const aActive = !a.pumpStopDate ? 1 : 0;
      const bActive = !b.pumpStopDate ? 1 : 0;
      return bActive - aActive;
    });
    return normalizeDate(sortedByProximity[0].pumpStartDate) || sortedByProximity[0].pumpStartDate || undefined;
  }

  // Fallback if invoice has no date: prefer active, newest pump
  const activeRecords = relevantRecords.filter(p => !p.pumpStopDate || p.pumpStopDate.trim() === '');
  const pool = activeRecords.length > 0 ? activeRecords : relevantRecords;
  const sortedDesc = [...pool].sort((a, b) => (b.pumpStartDate || '').localeCompare(a.pumpStartDate || ''));
  return normalizeDate(sortedDesc[0].pumpStartDate) || sortedDesc[0].pumpStartDate || undefined;
}
