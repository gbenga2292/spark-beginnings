import { useMemo, useCallback } from 'react';
import { useAppStore, Invoice, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { normalizeDate } from '@/src/lib/dateUtils';

export interface ActiveSiteInvoiceDetail {
  invoice: Invoice;
  invoiceNumber: string;
  duration: number;
  startDate: string;
  scheduledEndDate: string;
  liveEndDate: string;
  offDaysCount: number;
  daysRemaining: number;
  billedDaysCounted: number;
  urgency: 'overdue' | 'today' | 'soon' | 'safe';
  urgencyLabel: string;
  urgencyBadgeClass: string;
  isConcurrent: boolean;
}

export interface ActiveSiteInvoiceSummary {
  siteId: string;
  siteName: string;
  clientName: string;
  hasMultipleConcurrent: boolean;
  concurrentCount: number;
  invoices: ActiveSiteInvoiceDetail[];
  primaryInvoice?: ActiveSiteInvoiceDetail;
  hasActiveInvoices: boolean;
}

export function useActiveSiteInvoices() {
  const { sites = [], invoices = [], pendingSites = [] } = useAppStore();
  const { dailyMachineLogs = [], siteHoldPeriods = [] } = useOperations();

  // Helper to determine if a site is a dewatering project
  const isDewateringSite = useCallback((s: Site) => {
    if (!s) return false;
    const clientLower = s.client?.trim().toLowerCase() || '';
    const nameLower = s.name?.trim().toLowerCase() || '';

    // 1. Check linked onboarding questionnaire in pendingSites
    const q = (pendingSites || []).find(
      ps => (ps.siteId && ps.siteId === s.id) ||
        (ps.siteName?.trim().toLowerCase() === nameLower && ps.clientName?.trim().toLowerCase() === clientLower)
    );
    if (q) {
      const rawService = (
        q.phase1?.whatIsBeingBuilt ||
        (q as any).service ||
        (q as any).serviceName ||
        ''
      ).trim().toLowerCase();

      if (rawService) {
        if (rawService.includes('dewatering')) return true;
        return false;
      }
    }

    // 2. Clients known exclusively for non-dewatering projects
    if (clientLower.includes('first bank')) {
      return false;
    }

    // 3. Explicit service field on site object if present
    if ((s as any).service && !(s as any).service.toLowerCase().includes('dewatering')) {
      return false;
    }

    return true;
  }, [pendingSites]);

  const activeSiteInvoices = useMemo(() => {
    // 1. Filter ALL current active dewatering sites, strictly omitting sites on hold & non-dewatering
    const activeDewateringSites = (sites || [])
      .filter(s => {
        if (s.status !== 'Active') return false;

        const clientLower = s.client?.trim().toLowerCase() || '';
        if (clientLower === 'dcel') return false;

        const nameLower = s.name?.trim().toLowerCase() || '';
        if (
          nameLower === 'office' ||
          nameLower.includes('site office') ||
          nameLower.includes('office (dcel)') ||
          nameLower.includes('dcel office')
        ) {
          return false;
        }

        // Must be active dewatering site
        if (!isDewateringSite(s)) return false;

        // Strictly omit sites that are currently on hold
        const isOnHold = (siteHoldPeriods || []).some(
          h => (h.siteId === s.id || h.siteName?.trim().toLowerCase() === nameLower) && !h.holdEnd
        );
        if (isOnHold || (s as any).isOnHold) return false;

        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // 2. Index dailyMachineLogs by siteId and siteName for fast lookups
    const logsBySiteAndDate = new Map<string, typeof dailyMachineLogs>();
    dailyMachineLogs.forEach(l => {
      if (l.siteId) {
        const keyId = `${l.siteId}_${l.date}`;
        if (!logsBySiteAndDate.has(keyId)) logsBySiteAndDate.set(keyId, []);
        logsBySiteAndDate.get(keyId)!.push(l);
      }
      const sName = (l.siteName || (l as any).site_name || '').trim().toLowerCase();
      if (sName) {
        const keyName = `${sName}_${l.date}`;
        if (!logsBySiteAndDate.has(keyName)) logsBySiteAndDate.set(keyName, []);
        logsBySiteAndDate.get(keyName)!.push(l);
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summaries: ActiveSiteInvoiceSummary[] = [];

    activeDewateringSites.forEach(site => {
      const siteNameLower = site.name?.trim().toLowerCase();
      const siteId = site.id;

      // Find all invoices for this site that are NOT marked as 'Paid'
      const siteInvoices = invoices.filter(inv => {
        const invSiteName = (inv.siteName || inv.project || '').trim().toLowerCase();
        const matchesSite = inv.siteId === siteId || 
          (siteNameLower && invSiteName === siteNameLower) ||
          (siteNameLower && siteNameLower.length > 3 && invSiteName.includes(siteNameLower)) ||
          (siteNameLower && invSiteName.length > 3 && siteNameLower.includes(invSiteName));
        const isUnpaid = inv.status !== 'Paid';
        return matchesSite && isUnpaid;
      });

      // Calculate details for each unpaid invoice
      const invoiceDetails: ActiveSiteInvoiceDetail[] = [];

      siteInvoices.forEach(inv => {
        const startDateStr = normalizeDate(inv.date || inv.dueDate || '');
        const duration = Number(inv.duration) || 0;
        if (!startDateStr || duration <= 0) return;

        const start = new Date(startDateStr);
        if (isNaN(start.getTime())) return;

        // 1. Scheduled expiry date (simple calendar addition)
        const scheduledDateObj = new Date(start);
        scheduledDateObj.setDate(scheduledDateObj.getDate() + duration - 1);
        const scheduledEndDate = scheduledDateObj.toISOString().split('T')[0];

        // 2. Dynamic live end date with off-days deduction
        let daysCounted = 0;
        let offDaysCount = 0;
        let currentDate = new Date(start);
        const linkedAssets = inv.linkedAssetIds || [];

        let iterations = 0;
        while (daysCounted < duration && iterations < 365) {
          iterations++;
          const dateStr = currentDate.toISOString().split('T')[0];
          const logsForDate = logsBySiteAndDate.get(`${siteId}_${dateStr}`) ||
                              (siteNameLower ? logsBySiteAndDate.get(`${siteNameLower}_${dateStr}`) : undefined) ||
                              [];

          let dayContribution = 1.0;
          if (logsForDate.length > 0) {
            const relevantLogs = linkedAssets.length > 0
              ? logsForDate.filter(l => linkedAssets.includes(l.assetId))
              : logsForDate;

            if (relevantLogs.length > 0) {
              const contributions = relevantLogs.map(l => {
                const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (status === 'full') return 1.0;
                if (status === 'half') return 0.5;
                return 0.0;
              });
              dayContribution = Math.min(...contributions);
            }
          }

          if (dayContribution === 0.0) {
            offDaysCount += 1;
          } else if (dayContribution === 0.5) {
            offDaysCount += 0.5;
          }

          daysCounted += dayContribution;
          if (daysCounted < duration) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        const liveEndDate = currentDate.toISOString().split('T')[0];

        // Calculate days remaining from today to liveEndDate
        const liveTarget = new Date(liveEndDate);
        liveTarget.setHours(0, 0, 0, 0);
        const diffMs = liveTarget.getTime() - today.getTime();
        const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

        let urgency: 'overdue' | 'today' | 'soon' | 'safe' = 'safe';
        let urgencyLabel = '';
        let urgencyBadgeClass = '';

        if (daysRemaining < 0) {
          urgency = 'overdue';
          urgencyLabel = `Overdue by ${Math.abs(daysRemaining)}d`;
          urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        } else if (daysRemaining === 0) {
          urgency = 'today';
          urgencyLabel = 'Due Today';
          urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        } else if (daysRemaining === 1) {
          urgency = 'soon';
          urgencyLabel = 'Due Tomorrow';
          urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        } else if (daysRemaining <= 4) {
          urgency = 'soon';
          urgencyLabel = `Due in ${daysRemaining} days`;
          urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        } else {
          urgency = 'safe';
          urgencyLabel = `In ${daysRemaining} days`;
          urgencyBadgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
        }

        invoiceDetails.push({
          invoice: inv,
          invoiceNumber: inv.invoiceNumber || 'Invoice',
          duration,
          startDate: startDateStr,
          scheduledEndDate,
          liveEndDate,
          offDaysCount,
          daysRemaining,
          billedDaysCounted: Number(daysCounted.toFixed(1)),
          urgency,
          urgencyLabel,
          urgencyBadgeClass,
          isConcurrent: false,
        });
      });

      // Filter to currently running / active invoices:
      // Include all invoices with daysRemaining >= -45 (recent/current window),
      // or at minimum the latest invoice if all are older
      let runningInvoices = invoiceDetails.filter(d => d.daysRemaining >= -45);
      if (runningInvoices.length === 0 && invoiceDetails.length > 0) {
        // Fallback to the latest invoice by startDate
        runningInvoices = [
          [...invoiceDetails].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
        ];
      }

      // Sort running invoices by daysRemaining ascending (most urgent first)
      runningInvoices.sort((a, b) => a.daysRemaining - b.daysRemaining);

      const hasMultipleConcurrent = runningInvoices.length > 1;
      if (hasMultipleConcurrent) {
        runningInvoices.forEach(inv => {
          inv.isConcurrent = true;
        });
      }

      summaries.push({
        siteId: site.id,
        siteName: site.name,
        clientName: site.client || '',
        hasMultipleConcurrent,
        concurrentCount: runningInvoices.length,
        invoices: runningInvoices,
        primaryInvoice: runningInvoices[0] || undefined,
        hasActiveInvoices: runningInvoices.length > 0,
      });
    });

    // Sort active sites:
    // 1. Sites with running invoices sorted by urgency (closest daysRemaining first)
    // 2. Sites with multiple concurrent invoices prioritized
    // 3. Sites with no running invoices at the bottom
    return summaries.sort((a, b) => {
      if (a.hasActiveInvoices && !b.hasActiveInvoices) return -1;
      if (!a.hasActiveInvoices && b.hasActiveInvoices) return 1;
      if (a.hasMultipleConcurrent && !b.hasMultipleConcurrent) return -1;
      if (!a.hasMultipleConcurrent && b.hasMultipleConcurrent) return 1;

      const remA = a.primaryInvoice?.daysRemaining ?? 9999;
      const remB = b.primaryInvoice?.daysRemaining ?? 9999;
      return remA - remB;
    });
  }, [sites, invoices, dailyMachineLogs, siteHoldPeriods, isDewateringSite]);

  const totalActiveSites = activeSiteInvoices.length;
  const concurrentSitesCount = activeSiteInvoices.filter(s => s.hasMultipleConcurrent).length;

  return {
    activeSiteInvoices,
    totalActiveSites,
    concurrentSitesCount,
  };
}
