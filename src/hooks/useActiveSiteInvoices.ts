import { useMemo, useCallback } from 'react';
import { useAppStore, Invoice, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { normalizeDate } from '@/src/lib/dateUtils';

export interface ActiveSiteInvoiceMachineDetail {
  id: string;
  name: string;
  serialNumber?: string;
  consumedDays: number;
  contractedDays: number;
  isOver: boolean;
  overDays: number;
  isStopped?: boolean;
  stopDate?: string;
  slotConsumedDays?: number;
  predecessors?: { id: string; name: string; consumedDays: number; stopDate?: string }[];
}

export interface ActiveSiteInvoiceDetail {
  invoice: Invoice;
  invoiceNumber: string;
  duration: number;
  totalContractedDays: number;
  machineCount: number;
  machines: ActiveSiteInvoiceMachineDetail[];
  hasSwappedMachines?: boolean;
  startDate: string;
  scheduledEndDate: string;
  liveEndDate: string;
  offDaysCount: number;
  daysRemaining: number;
  billedDaysCounted: number;
  consumedDays: number;
  lapsedDays: number;
  isLapsed: boolean;
  hasNextInvoice: boolean;
  nextInvoiceNumber?: string;
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
  hasLapsedInvoice: boolean;
  maxLapsedDays: number;
  // Cumulative Site Pool fields
  totalBilledDays: number;
  totalLoggedDays: number;
  remainingDays: number;
  overrunDays: number;
  isOverrun: boolean;
  activeMachinesCount: number;
  calendarRunwayDays: number;
  progressPct: number;
  urgency: 'overdue' | 'today' | 'soon' | 'safe';
  urgencyLabel: string;
  urgencyBadgeClass: string;
  siteMachines: ActiveSiteInvoiceMachineDetail[];
  earliestStartDate?: string;
  latestScheduledEndDate?: string;
  latestLiveEndDate?: string;
}

export function useActiveSiteInvoices() {
  const { sites = [], invoices = [], pendingSites = [] } = useAppStore();
  const { dailyMachineLogs = [], siteHoldPeriods = [], sitePumpDates = [], maintenanceAssets = [] } = useOperations();

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

      // Find all invoices for this site (both paid and unpaid, to track cycle continuity)
      const allSiteInvoices = invoices.filter(inv => {
        const invSiteName = (inv.siteName || inv.project || '').trim().toLowerCase();
        const matchesSite = inv.siteId === siteId || 
          (siteNameLower && invSiteName === siteNameLower) ||
          (siteNameLower && siteNameLower.length > 3 && invSiteName.includes(siteNameLower)) ||
          (siteNameLower && invSiteName.length > 3 && siteNameLower.includes(invSiteName));
        return matchesSite;
      });

      // Collect machine IDs for this site from maintenanceAssets and sitePumpDates
      const siteMachineIds = new Set<string>();
      (maintenanceAssets || []).forEach(a => {
        const aSite = (a.site || '').trim().toLowerCase();
        if (aSite && (aSite === siteNameLower || aSite === siteId.toLowerCase())) {
          siteMachineIds.add(a.id);
        }
      });
      (sitePumpDates || []).forEach(pd => {
        if (pd.siteId === siteId) {
          siteMachineIds.add(pd.assetId);
        }
      });

      // Calculate details for each invoice
      const invoiceDetails: ActiveSiteInvoiceDetail[] = [];

      allSiteInvoices.forEach(inv => {
        const startDateStr = normalizeDate(inv.date || inv.dueDate || '');
        const duration = Number(inv.duration) || 0;
        if (!startDateStr || duration <= 0) return;

        const start = new Date(startDateStr);
        if (isNaN(start.getTime())) return;

        // 1. Scheduled expiry date (simple calendar addition)
        const scheduledDateObj = new Date(start);
        scheduledDateObj.setDate(scheduledDateObj.getDate() + duration - 1);
        const scheduledEndDate = scheduledDateObj.toISOString().split('T')[0];

        // 2. Subsequent invoice detection
        const subsequentInvoices = allSiteInvoices.filter(other => {
          if (other.id === inv.id) return false;
          const otherStart = normalizeDate(other.date || other.dueDate || '');
          return Boolean(otherStart && otherStart > startDateStr);
        });
        const hasNextInvoice = subsequentInvoices.length > 0;
        const nextInvoice = hasNextInvoice
          ? [...subsequentInvoices].sort((a, b) => 
              (normalizeDate(a.date || a.dueDate || '')).localeCompare(normalizeDate(b.date || b.dueDate || ''))
            )[0]
          : undefined;
        const nextInvoiceNumber = nextInvoice?.invoiceNumber;
        const nextStartDateStr = nextInvoice ? normalizeDate(nextInvoice.date || nextInvoice.dueDate || '') : undefined;

        // 3. Effective linked machines (mirroring InvoiceRuntimeTracker swap logic)
        const linkedIds: string[] = inv.linkedAssetIds ?? [];
        const effectiveLinkedIds = new Set<string>(linkedIds);
        (sitePumpDates || []).forEach(pd => {
          if (pd.replacedAssetId && effectiveLinkedIds.has(pd.replacedAssetId)) {
            if (!inv.siteId || pd.siteId === inv.siteId) {
              effectiveLinkedIds.add(pd.assetId);
            }
          }
        });
        // Fallback: if no machines explicitly linked to invoice, use site machines
        if (effectiveLinkedIds.size === 0) {
          siteMachineIds.forEach(id => effectiveLinkedIds.add(id));
        }
        const effectiveLinkedArray = Array.from(effectiveLinkedIds);

        // 4. Relevant logs from invoice start date onwards for this site
        // If a subsequent invoice exists, cap logs before that subsequent invoice's start
        const relevantMachineLogs = dailyMachineLogs.filter(l => {
          // Must match the site
          const lSiteId = (l.siteId || '').trim().toLowerCase();
          const lSiteName = (l.siteName || (l as any).site_name || '').trim().toLowerCase();
          const matchSite = (lSiteId && (lSiteId === siteId.toLowerCase() || (inv.siteId && lSiteId === inv.siteId.toLowerCase()))) ||
            (siteNameLower && lSiteName === siteNameLower) ||
            (siteNameLower && siteNameLower.length > 3 && lSiteName.includes(siteNameLower)) ||
            (siteNameLower && lSiteName.length > 3 && siteNameLower.includes(lSiteName));
          if (!matchSite) return false;

          if (effectiveLinkedArray.length > 0) {
            if (!effectiveLinkedArray.includes(l.assetId)) return false;
          }

          const logDate = l.date ? l.date.substring(0, 10) : '';
          if (!logDate || logDate < startDateStr) return false;
          if (nextStartDateStr && logDate >= nextStartDateStr) return false;
          return true;
        });

        // 4. Determine contracted days across machines
        const machineConfigs: any[] = inv.machineConfigs ?? [];
        const firstDur = parseFloat(String(machineConfigs[0]?.duration ?? 0)) || duration;
        let totalContractedDays = 0;
        if (machineConfigs.length > 0) {
          totalContractedDays = machineConfigs.reduce((sum: number, c: any) => {
            const d = c.sameDurationAsFirst ? firstDur : (parseFloat(String(c.duration ?? 0)) || firstDur || duration);
            return sum + d;
          }, 0);
          if (inv.noOfMachine && inv.noOfMachine > machineConfigs.length) {
            totalContractedDays += (inv.noOfMachine - machineConfigs.length) * (firstDur || duration);
          }
        } else {
          const count = Number(inv.noOfMachine) || 1;
          totalContractedDays = count * duration;
        }

        // 5. Collect machine assets for this site (matching maintenanceAssets, sitePumpDates, and logs)
        const siteMachinesMap = new Map<string, { id: string; name: string; serialNumber?: string }>();
        (maintenanceAssets || []).forEach(a => {
          const aSite = (a.site || '').trim().toLowerCase();
          const match = aSite === siteNameLower || 
                        aSite === siteId.toLowerCase() || 
                        (aSite.length > 3 && siteNameLower && siteNameLower.includes(aSite)) || 
                        (siteNameLower && siteNameLower.length > 3 && aSite.includes(siteNameLower));
          if (match) {
            siteMachinesMap.set(a.id, { id: a.id, name: a.name, serialNumber: a.serialNumber });
          }
        });
        (sitePumpDates || []).forEach(pd => {
          if (pd.siteId === siteId) {
            const asset = maintenanceAssets.find(a => a.id === pd.assetId);
            siteMachinesMap.set(pd.assetId, { 
              id: pd.assetId, 
              name: asset?.name || 'Machine', 
              serialNumber: asset?.serialNumber 
            });
          }
        });
        (inv.linkedAssetIds || []).forEach(id => {
          if (!siteMachinesMap.has(id)) {
            const asset = maintenanceAssets.find(a => a.id === id);
            siteMachinesMap.set(id, { id, name: asset?.name || 'Machine', serialNumber: asset?.serialNumber });
          }
        });
        relevantMachineLogs.forEach(l => {
          if (l.assetId && !siteMachinesMap.has(l.assetId)) {
            const asset = maintenanceAssets.find(a => a.id === l.assetId);
            siteMachinesMap.set(l.assetId, { 
              id: l.assetId, 
              name: l.assetName || asset?.name || 'Machine', 
              serialNumber: asset?.serialNumber 
            });
          }
        });

        const siteMachinesArray = Array.from(siteMachinesMap.values());
        const invoicedMachineCount = Math.max(
          machineConfigs.length,
          Number(inv.noOfMachine) || 1
        );
        const machineCount = invoicedMachineCount;

        // Fallback: if machineConfigs is empty but site has multiple machines, scale totalContractedDays
        if (machineConfigs.length === 0 && totalContractedDays === duration && machineCount > 1) {
          totalContractedDays = machineCount * duration;
        }

        // Check for stopped/swapped machines from sitePumpDates
        const enrichedMachines = siteMachinesArray.map(m => {
          const pumpDateRec = (sitePumpDates || []).find(pd => 
            pd.siteId === siteId && pd.assetId === m.id
          );
          const isStopped = Boolean(pumpDateRec?.pumpStopDate);
          const stopDate = pumpDateRec?.pumpStopDate || undefined;
          return { ...m, isStopped, stopDate };
        });

        // Sort so active running machines appear first, then swapped/stopped machines
        enrichedMachines.sort((a, b) => {
          if (a.isStopped && !b.isStopped) return 1;
          if (!a.isStopped && b.isStopped) return -1;
          return a.name.localeCompare(b.name);
        });

        const hasSwappedMachines = enrichedMachines.length > invoicedMachineCount || enrichedMachines.some(m => m.isStopped);

        // 6. Per-machine breakdown and consumption
        const machinesDetail: ActiveSiteInvoiceMachineDetail[] = enrichedMachines.map((m, idx) => {
          const mLogs = relevantMachineLogs.filter(l => l.assetId === m.id);
          const mConsumed = Number((mLogs.reduce((acc, l) => {
            const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
            if (status === 'full') return acc + 1;
            if (status === 'half') return acc + 0.5;
            return acc;
          }, 0)).toFixed(1));

          const cfg = !hasSwappedMachines ? machineConfigs[idx] : undefined;
          const mDuration = cfg
            ? (cfg.sameDurationAsFirst ? firstDur : (parseFloat(String(cfg.duration ?? 0)) || firstDur || duration))
            : duration;

          const isOver = mDuration > 0 && mConsumed > mDuration;
          const overDays = isOver ? Number((mConsumed - mDuration).toFixed(1)) : 0;

          return {
            id: m.id,
            name: m.name,
            serialNumber: m.serialNumber,
            consumedDays: mConsumed,
            contractedDays: mDuration,
            isOver,
            overDays,
            isStopped: m.isStopped,
            stopDate: m.stopDate,
          };
        });

        // Consumed days = sum of day fractions per log (1 for full, 0.5 for half)
        const consumedDays = Number((relevantMachineLogs.reduce((acc, l) => {
          const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
          if (status === 'full') return acc + 1;
          if (status === 'half') return acc + 0.5;
          return acc;
        }, 0)).toFixed(1));

        // Lapsed calculation: compare against total contracted days and per-machine overruns
        const totalOverrun = Math.max(0, consumedDays - totalContractedDays);
        const machineOverrunSum = machinesDetail.reduce((sum, m) => sum + m.overDays, 0);
        const rawLapse = Math.max(totalOverrun, machineOverrunSum);
        const lapsedDays = (!hasNextInvoice && rawLapse > 0) ? Number(rawLapse.toFixed(1)) : 0;
        const isLapsed = !hasNextInvoice && lapsedDays > 0;

        // 7. Dynamic live end date with off-days deduction
        let daysCounted = 0;
        let offDaysCount = 0;
        let currentDate = new Date(start);

        let iterations = 0;
        while (daysCounted < duration && iterations < 365) {
          iterations++;
          const dateStr = currentDate.toISOString().split('T')[0];
          const logsForDate = logsBySiteAndDate.get(`${siteId}_${dateStr}`) ||
                              (siteNameLower ? logsBySiteAndDate.get(`${siteNameLower}_${dateStr}`) : undefined) ||
                              [];

          let dayContribution = 1.0;
          if (logsForDate.length > 0) {
            const relevantLogs = effectiveLinkedArray.length > 0
              ? logsForDate.filter(l => effectiveLinkedArray.includes(l.assetId))
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

        if (isLapsed) {
          urgency = 'overdue';
          urgencyLabel = `+${lapsedDays % 1 === 0 ? lapsedDays.toFixed(0) : lapsedDays.toFixed(1)}d Overrun`;
          urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        } else if (!hasNextInvoice && consumedDays >= totalContractedDays) {
          urgency = 'today';
          urgencyLabel = 'Due Today';
          urgencyBadgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        } else if (!hasNextInvoice && (totalContractedDays - consumedDays) <= (3 * machineCount) && (totalContractedDays - consumedDays) > 0) {
          const rem = Math.ceil((totalContractedDays - consumedDays) / machineCount);
          urgency = 'soon';
          urgencyLabel = `Due in ${rem}d`;
          urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
        } else if (daysRemaining < 0) {
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
          urgencyLabel = `${daysRemaining}d left`;
          urgencyBadgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
        }

        invoiceDetails.push({
          invoice: inv,
          invoiceNumber: inv.invoiceNumber || 'Invoice',
          duration,
          totalContractedDays,
          machineCount,
          machines: machinesDetail,
          hasSwappedMachines,
          startDate: startDateStr,
          scheduledEndDate,
          liveEndDate,
          offDaysCount,
          daysRemaining,
          billedDaysCounted: Number(daysCounted.toFixed(1)),
          consumedDays,
          lapsedDays,
          isLapsed,
          hasNextInvoice,
          nextInvoiceNumber,
          urgency,
          urgencyLabel,
          urgencyBadgeClass,
          isConcurrent: false,
        });
      });

      // Running invoices:
      // 1. Any invoice not marked 'Paid' that is active/recent (daysRemaining >= -45)
      // 2. Any invoice that is lapsed (isLapsed === true), even if marked 'Paid'
      let runningInvoices = invoiceDetails.filter(d => {
        if (d.invoice.status !== 'Paid' && d.daysRemaining >= -45) return true;
        if (d.isLapsed) return true;
        return false;
      });

      if (runningInvoices.length === 0 && invoiceDetails.length > 0) {
        // Fallback to the latest invoice by startDate so cycle status is always visible
        runningInvoices = [
          [...invoiceDetails].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
        ];
      }

      // Sort running invoices: lapsed/overdue first, then by daysRemaining
      runningInvoices.sort((a, b) => {
        if (a.isLapsed && !b.isLapsed) return -1;
        if (!a.isLapsed && b.isLapsed) return 1;
        if (a.isLapsed && b.isLapsed) return b.lapsedDays - a.lapsedDays;
        return a.daysRemaining - b.daysRemaining;
      });

      const hasMultipleConcurrent = runningInvoices.length > 1;
      if (hasMultipleConcurrent) {
        runningInvoices.forEach(inv => {
          inv.isConcurrent = true;
        });
      }

      // Cumulative Site Pool Calculations
      const totalBilledDays = runningInvoices.reduce((sum, inv) => sum + inv.totalContractedDays, 0);

      // Collect all machines for the site from all running invoices
      const siteMachinesMap = new Map<string, ActiveSiteInvoiceMachineDetail>();
      runningInvoices.forEach(inv => {
        (inv.machines || []).forEach(m => {
          if (!siteMachinesMap.has(m.id)) {
            siteMachinesMap.set(m.id, { ...m });
          } else {
            const existing = siteMachinesMap.get(m.id)!;
            existing.consumedDays = Math.max(existing.consumedDays, m.consumedDays);
          }
        });
      });

      const poolMachines = Array.from(siteMachinesMap.values());
      poolMachines.sort((a, b) => {
        if (a.isStopped && !b.isStopped) return 1;
        if (!a.isStopped && b.isStopped) return -1;
        return a.name.localeCompare(b.name);
      });

      const totalLoggedDays = Number(poolMachines.reduce((sum, m) => sum + m.consumedDays, 0).toFixed(1));
      const activePumps = poolMachines.filter(m => !m.isStopped);
      const activeMachinesCount = Math.max(
        1,
        activePumps.length || (runningInvoices[0]?.machineCount || 1)
      );

      // In the site pool, total billed days are distributed across active running machines
      const perActiveMachineBilledDays = (activeMachinesCount > 0 && totalBilledDays > 0)
        ? Number((totalBilledDays / activeMachinesCount).toFixed(1))
        : 0;

      // Link swapped / predecessor machines to active running machines
      const stoppedPumps = poolMachines.filter(m => m.isStopped);
      const claimedStoppedIds = new Set<string>();

      // 1. Explicit lineage via sitePumpDates (replacedAssetId)
      activePumps.forEach(activeM => {
        const preds: { id: string; name: string; consumedDays: number; stopDate?: string }[] = [];
        let currId = activeM.id;
        const visited = new Set<string>([currId]);

        while (currId) {
          const pd = (sitePumpDates || []).find(p => p.siteId === siteId && p.assetId === currId);
          const predId = pd?.replacedAssetId;
          if (predId && !visited.has(predId)) {
            visited.add(predId);
            const predMachine = siteMachinesMap.get(predId) || stoppedPumps.find(p => p.id === predId);
            if (predMachine) {
              preds.push({
                id: predMachine.id,
                name: predMachine.name,
                consumedDays: predMachine.consumedDays,
                stopDate: predMachine.stopDate,
              });
              claimedStoppedIds.add(predId);
            }
            currId = predId;
          } else {
            break;
          }
        }
        if (preds.length > 0) {
          activeM.predecessors = preds;
        }
      });

      // 2. Fallback lineage: If stopped machines exist on site that were not explicitly linked via replacedAssetId,
      // pair them with active pumps that don't have predecessors yet
      const unclaimedStopped = stoppedPumps.filter(p => !claimedStoppedIds.has(p.id));
      const activeWithoutPreds = activePumps.filter(p => !p.predecessors || p.predecessors.length === 0);
      if (unclaimedStopped.length > 0 && activeWithoutPreds.length > 0) {
        unclaimedStopped.forEach((stoppedM, idx) => {
          const targetActive = activeWithoutPreds[idx % activeWithoutPreds.length];
          if (targetActive) {
            if (!targetActive.predecessors) targetActive.predecessors = [];
            targetActive.predecessors.push({
              id: stoppedM.id,
              name: stoppedM.name,
              consumedDays: stoppedM.consumedDays,
              stopDate: stoppedM.stopDate,
            });
            claimedStoppedIds.add(stoppedM.id);
          }
        });
      }

      // Compute slotConsumedDays and contracted quota for active pumps
      activePumps.forEach(m => {
        const predSum = (m.predecessors || []).reduce((sum, p) => sum + p.consumedDays, 0);
        m.slotConsumedDays = Number((m.consumedDays + predSum).toFixed(1));
        m.contractedDays = perActiveMachineBilledDays;
        m.isOver = m.contractedDays > 0 && (m.slotConsumedDays || m.consumedDays) > m.contractedDays;
        m.overDays = m.isOver ? Number(((m.slotConsumedDays || m.consumedDays) - m.contractedDays).toFixed(1)) : 0;
      });

      // Any remaining unclaimed stopped machines do not hold active capacity quota
      stoppedPumps.filter(p => !claimedStoppedIds.has(p.id)).forEach(m => {
        m.contractedDays = 0;
        m.slotConsumedDays = m.consumedDays;
        m.isOver = false;
        m.overDays = 0;
      });

      // Final roster: active pumps (with nested swap info) followed by any remaining unclaimed stopped pumps
      const finalPoolMachines = [
        ...activePumps,
        ...stoppedPumps.filter(p => !claimedStoppedIds.has(p.id))
      ];

      const isOverrun = totalBilledDays > 0 && totalLoggedDays > totalBilledDays;
      const overrunDays = isOverrun ? Number((totalLoggedDays - totalBilledDays).toFixed(1)) : 0;
      const remainingDays = isOverrun ? 0 : Math.max(0, Number((totalBilledDays - totalLoggedDays).toFixed(1)));
      const calendarRunwayDays = Math.ceil(remainingDays / activeMachinesCount);
      const progressPct = totalBilledDays > 0 ? Math.min(100, (totalLoggedDays / totalBilledDays) * 100) : 0;

      let urgency: 'overdue' | 'today' | 'soon' | 'safe' = 'safe';
      let urgencyLabel = '';
      let urgencyBadgeClass = '';

      if (isOverrun) {
        urgency = 'overdue';
        urgencyLabel = `+${overrunDays.toFixed(1)}d Overrun`;
        urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      } else if (calendarRunwayDays <= 0) {
        urgency = 'today';
        urgencyLabel = 'Due Today';
        urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      } else if (calendarRunwayDays === 1) {
        urgency = 'soon';
        urgencyLabel = 'Due Tomorrow';
        urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      } else if (calendarRunwayDays <= 3) {
        urgency = 'soon';
        urgencyLabel = `Due in ${calendarRunwayDays}d`;
        urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      } else {
        urgency = 'safe';
        urgencyLabel = `${calendarRunwayDays}d runway`;
        urgencyBadgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      }

      const earliestStartDate = runningInvoices.length > 0
        ? [...runningInvoices].map(i => i.startDate).filter(Boolean).sort()[0]
        : undefined;
      const latestScheduledEndDate = runningInvoices.length > 0
        ? [...runningInvoices].map(i => i.scheduledEndDate).filter(Boolean).sort().reverse()[0]
        : undefined;
      const latestLiveEndDate = runningInvoices.length > 0
        ? [...runningInvoices].map(i => i.liveEndDate).filter(Boolean).sort().reverse()[0]
        : undefined;

      const hasLapsedInvoice = isOverrun || runningInvoices.some(inv => inv.isLapsed);
      const maxLapsedDays = Math.max(overrunDays, runningInvoices.reduce((max, inv) => Math.max(max, inv.lapsedDays || 0), 0));

      summaries.push({
        siteId: site.id,
        siteName: site.name,
        clientName: site.client || '',
        hasMultipleConcurrent,
        concurrentCount: runningInvoices.length,
        invoices: runningInvoices,
        primaryInvoice: runningInvoices[0] || undefined,
        hasActiveInvoices: runningInvoices.length > 0,
        hasLapsedInvoice,
        maxLapsedDays,
        totalBilledDays,
        totalLoggedDays,
        remainingDays,
        overrunDays,
        isOverrun,
        activeMachinesCount,
        calendarRunwayDays,
        progressPct,
        urgency,
        urgencyLabel,
        urgencyBadgeClass,
        siteMachines: finalPoolMachines,
        earliestStartDate,
        latestScheduledEndDate,
        latestLiveEndDate,
      });
    });

    // Sort active sites:
    // 1. Sites with overrun at the VERY TOP
    // 2. Sites with running invoices sorted by calendar runway (closest days first)
    // 3. Sites with multiple concurrent invoices prioritized
    // 4. Sites with no running invoices at the bottom
    return summaries.sort((a, b) => {
      if (a.isOverrun && !b.isOverrun) return -1;
      if (!a.isOverrun && b.isOverrun) return 1;
      if (a.isOverrun && b.isOverrun) {
        return b.overrunDays - a.overrunDays;
      }

      if (a.hasActiveInvoices && !b.hasActiveInvoices) return -1;
      if (!a.hasActiveInvoices && b.hasActiveInvoices) return 1;
      if (a.hasMultipleConcurrent && !b.hasMultipleConcurrent) return -1;
      if (!a.hasMultipleConcurrent && b.hasMultipleConcurrent) return 1;

      return a.calendarRunwayDays - b.calendarRunwayDays;
    });
  }, [sites, invoices, dailyMachineLogs, siteHoldPeriods, sitePumpDates, maintenanceAssets, isDewateringSite]);

  const totalActiveSites = activeSiteInvoices.length;
  const concurrentSitesCount = activeSiteInvoices.filter(s => s.hasMultipleConcurrent).length;
  const lapsedSitesCount = activeSiteInvoices.filter(s => s.isOverrun || s.hasLapsedInvoice).length;

  return {
    activeSiteInvoices,
    totalActiveSites,
    concurrentSitesCount,
    lapsedSitesCount,
  };
}

