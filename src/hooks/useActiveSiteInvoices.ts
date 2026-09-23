import { useMemo, useCallback } from 'react';
import { useAppStore, Invoice, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { normalizeDate } from '@/src/lib/dateUtils';

export interface ActiveSiteInvoiceMachineDetail {
  id: string;
  name: string;
  serialNumber?: string;
  consumedDays: number;
  unloggedDays?: number;
  projectedConsumedDays?: number;
  unloggedDates?: string[];
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
  unloggedDays?: number;
  projectedConsumedDays?: number;
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
  isSequentialChain?: boolean;
  invoiceRelationLabel?: string;
  invoices: ActiveSiteInvoiceDetail[];
  primaryInvoice?: ActiveSiteInvoiceDetail;
  hasActiveInvoices: boolean;
  hasLapsedInvoice: boolean;
  maxLapsedDays: number;
  // Cumulative Site Pool fields
  totalBilledDays: number;
  totalLoggedDays: number;
  totalUnloggedDays: number;
  totalProjectedDays: number;
  missingLogDates: string[];
  unloggedDaysCount: number;
  hasUnloggedDays: boolean;
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

export const isAuxiliaryAsset = (m: { name?: string }) => {
  const n = (m.name || '').toLowerCase();
  return n.includes('tank') || n.includes('hose') || n.includes('fitting') || n.includes('pipe') || n.includes('adapter');
};

export const checkIsInvoiceAuxOnly = (inv: Invoice): boolean => {
  const hasAux = (inv.auxiliaryEquipment?.length || 0) > 0;
  if (!hasAux) return false;
  const noOfMach = Number(inv.noOfMachine || 0);
  const rentalCost = Number(inv.rentalCost || (inv as any).rental_cost || 0);
  const auxCost = Number(inv.auxiliaryCost || (inv as any).auxiliary_cost || 0);
  const configs = (inv as any).machineConfigs;
  const allConfigsZero = Array.isArray(configs) && configs.length > 0 && configs.every((c: any) => Number(c.rate || 0) === 0);

  return noOfMach === 0 || (rentalCost === 0 && auxCost > 0) || allConfigsZero;
};

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
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const summaries: ActiveSiteInvoiceSummary[] = [];

    activeDewateringSites.forEach(site => {
      const siteNameLower = site.name?.trim().toLowerCase();
      const siteId = site.id;

      // Helper to check if a specific date was on recorded hold for this site
      const isDateOnHold = (dateStr: string) => {
        return (siteHoldPeriods || []).some(h => {
          if (h.siteId !== siteId && (h.siteName || '').trim().toLowerCase() !== siteNameLower) return false;
          const startH = h.holdStart ? normalizeDate(h.holdStart) : '';
          const endH = h.holdEnd ? normalizeDate(h.holdEnd) : todayStr;
          return Boolean(startH && dateStr >= startH && dateStr <= endH);
        });
      };

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

        // 2. Subsequent invoice detection (scoped by equipment track: pump vs auxiliary)
        const isInvAuxOnly = checkIsInvoiceAuxOnly(inv);
        const invAuxNames = (inv.auxiliaryEquipment || []).map(a => (a.name || '').trim().toLowerCase()).filter(Boolean);

        const subsequentInvoices = allSiteInvoices.filter(other => {
          if (other.id === inv.id) return false;
          const otherStart = normalizeDate(other.date || other.dueDate || '');
          if (!otherStart || otherStart <= startDateStr) return false;

          const isOtherAuxOnly = checkIsInvoiceAuxOnly(other);

          // Pump invoices only chain with subsequent pump invoices
          if (!isInvAuxOnly && isOtherAuxOnly) return false;

          // Auxiliary invoices only chain with subsequent auxiliary invoices covering the same equipment
          if (isInvAuxOnly) {
            if (!isOtherAuxOnly) return false;
            const otherAuxNames = (other.auxiliaryEquipment || []).map(a => (a.name || '').trim().toLowerCase()).filter(Boolean);
            const sharesItem = invAuxNames.some(n => otherAuxNames.some(on => on.includes(n) || n.includes(on)));
            if (!sharesItem) return false;
          }

          return true;
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
        // Fallback: if no machines explicitly linked to invoice:
        if (effectiveLinkedIds.size === 0) {
          if (isInvAuxOnly && invAuxNames.length > 0) {
            (maintenanceAssets || []).forEach(a => {
              const aSite = (a.site || '').trim().toLowerCase();
              const match = aSite === siteNameLower || aSite === siteId.toLowerCase() ||
                (aSite.length > 3 && siteNameLower && siteNameLower.includes(aSite)) ||
                (siteNameLower && siteNameLower.length > 3 && aSite.includes(siteNameLower));
              if (match) {
                const aName = (a.name || '').toLowerCase();
                if (invAuxNames.some(aux => aName.includes(aux) || aux.includes(aName))) {
                  effectiveLinkedIds.add(a.id);
                }
              }
            });
          } else {
            // For pump invoices: only add pump assets (exclude auxiliary tanks/equipment)
            siteMachineIds.forEach(id => {
              const asset = (maintenanceAssets || []).find(a => a.id === id);
              const aName = (asset?.name || '').toLowerCase();
              const isAuxAsset = aName.includes('tank') || aName.includes('hose') || aName.includes('fitting');
              if (!isAuxAsset) {
                effectiveLinkedIds.add(id);
              }
            });
            if (effectiveLinkedIds.size === 0) {
              siteMachineIds.forEach(id => effectiveLinkedIds.add(id));
            }
          }
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
            (siteNameLower && siteNameLower.length > 3 && siteNameLower.includes(lSiteName));

          if (!matchSite) return false;

          // Date boundary: from invoice startDate onwards
          if (l.date < startDateStr) return false;

          // Cap at subsequent invoice start date if applicable
          if (nextStartDateStr && l.date >= nextStartDateStr) return false;

          // If machine is specified, must match effective linked machines
          if (l.assetId && effectiveLinkedArray.length > 0) {
            return effectiveLinkedArray.includes(l.assetId);
          }

          return true;
        });

        // 5. Machine configurations from invoice
        const rawConfigs = (inv as any).machineConfigs;
        const machineConfigs: Array<{
          assetId?: string;
          machineName?: string;
          duration?: number;
          ratePerDay?: number;
          sameDurationAsFirst?: boolean;
          sameRateAsFirst?: boolean;
        }> = Array.isArray(rawConfigs) ? rawConfigs : [];

        const firstDur = machineConfigs[0]?.duration ? parseFloat(String(machineConfigs[0].duration)) : duration;

        let totalContractedDays = duration;
        if (isInvAuxOnly && (inv.auxiliaryEquipment?.length || 0) > 0) {
          totalContractedDays = inv.auxiliaryEquipment!.reduce((sum, item) => {
            return sum + (parseFloat(String(item.duration ?? 0)) || duration);
          }, 0);
        } else if (machineConfigs.length > 0) {
          totalContractedDays = machineConfigs.reduce((sum, cfg, idx) => {
            const dur = idx === 0 
              ? firstDur 
              : (cfg.sameDurationAsFirst ? firstDur : (parseFloat(String(cfg.duration ?? 0)) || firstDur || duration));
            return sum + dur;
          }, 0);
        }

        // Build list of unique machines known to this invoice
        const siteMachinesMap = new Map<string, { id: string; name: string; serialNumber?: string }>();

        effectiveLinkedArray.forEach(id => {
          if (!siteMachinesMap.has(id)) {
            const asset = maintenanceAssets.find(a => a.id === id);
            siteMachinesMap.set(id, { id, name: asset?.name || 'Machine', serialNumber: asset?.serialNumber });
          }
        });
        machineConfigs.forEach(cfg => {
          if (cfg.assetId && !siteMachinesMap.has(cfg.assetId)) {
            const asset = maintenanceAssets.find(a => a.id === cfg.assetId);
            siteMachinesMap.set(cfg.assetId, { 
              id: cfg.assetId, 
              name: asset?.name || 'Machine', 
              serialNumber: asset?.serialNumber 
            });
          }
        });

        (maintenanceAssets || []).forEach(a => {
          const aSite = (a.site || '').trim().toLowerCase();
          const match = aSite === siteNameLower || 
                        aSite === siteId.toLowerCase() || 
                        (aSite.length > 3 && siteNameLower && siteNameLower.includes(aSite)) || 
                        (siteNameLower && siteNameLower.length > 3 && aSite.includes(siteNameLower));
          if (match && !siteMachinesMap.has(a.id)) {
            // For auxiliary invoices, only include matching auxiliary assets
            if (isInvAuxOnly && invAuxNames.length > 0) {
              const aName = (a.name || '').toLowerCase();
              if (invAuxNames.some(aux => aName.includes(aux) || aux.includes(aName))) {
                siteMachinesMap.set(a.id, { id: a.id, name: a.name, serialNumber: a.serialNumber });
              }
            } else if (!isInvAuxOnly) {
              siteMachinesMap.set(a.id, { id: a.id, name: a.name, serialNumber: a.serialNumber });
            }
          }
        });
        (sitePumpDates || []).forEach(pd => {
          if (pd.siteId === siteId && !siteMachinesMap.has(pd.assetId)) {
            const asset = maintenanceAssets.find(a => a.id === pd.assetId);
            if (!isInvAuxOnly && asset && isAuxiliaryAsset(asset)) return;
            if (isInvAuxOnly && asset && !isAuxiliaryAsset(asset)) return;
            siteMachinesMap.set(pd.assetId, { 
              id: pd.assetId, 
              name: asset?.name || 'Machine', 
              serialNumber: asset?.serialNumber 
            });
          }
        });
        relevantMachineLogs.forEach(l => {
          if (l.assetId && !siteMachinesMap.has(l.assetId)) {
            const asset = maintenanceAssets.find(a => a.id === l.assetId);
            if (!isInvAuxOnly && asset && isAuxiliaryAsset(asset)) return;
            if (isInvAuxOnly && asset && !isAuxiliaryAsset(asset)) return;
            siteMachinesMap.set(l.assetId, { 
              id: l.assetId, 
              name: l.assetName || asset?.name || 'Machine', 
              serialNumber: asset?.serialNumber 
            });
          }
        });

        const siteMachinesArray = Array.from(siteMachinesMap.values());
        const invoicedMachineCount = isInvAuxOnly
          ? Math.max(1, inv.auxiliaryEquipment?.length || 1)
          : Math.max(
              machineConfigs.length,
              Number(inv.noOfMachine) || 1
            );
        const machineCount = invoicedMachineCount;

        // Fallback: if machineConfigs is empty but site has multiple machines, scale totalContractedDays (pumps only)
        if (!isInvAuxOnly && machineConfigs.length === 0 && totalContractedDays === duration && machineCount > 1) {
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

        // 6. Per-machine breakdown and consumption (with assumed active unlogged days)
        const machinesDetail: ActiveSiteInvoiceMachineDetail[] = enrichedMachines.map((m, idx) => {
          const mLogs = relevantMachineLogs.filter(l => l.assetId === m.id);
          const mConsumed = Number((mLogs.reduce((acc, l) => {
            const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
            if (status === 'full') return acc + 1;
            if (status === 'half') return acc + 0.5;
            return acc;
          }, 0)).toFixed(1));

          // Calculate unlogged past days between machine/invoice start and yesterday.
          // Unlogged days are assumed active (1.0 day/day) unless explicitly logged otherwise or on hold.
          // Note: Auxiliary items (e.g. Sedimentation Tank) are passive rentals, not active pump engines.
          const pumpDateRec = (sitePumpDates || []).find(pd => pd.siteId === siteId && pd.assetId === m.id);
          const mStartStr = pumpDateRec?.pumpStartDate ? normalizeDate(pumpDateRec.pumpStartDate) : startDateStr;
          const mEffectiveStart = mStartStr > startDateStr ? mStartStr : startDateStr;
          const mStopStr = m.stopDate ? normalizeDate(m.stopDate) : undefined;

          let mUnloggedDays = 0;
          const mUnloggedDates: string[] = [];

          if (!isInvAuxOnly && !isAuxiliaryAsset(m) && !m.isStopped && mEffectiveStart <= yesterdayStr) {
            const iterDate = new Date(mEffectiveStart);
            let limit = 0;
            while (limit < 365) {
              limit++;
              const curDateStr = iterDate.toISOString().split('T')[0];
              if (curDateStr > yesterdayStr) break;
              if (mStopStr && curDateStr > mStopStr) break;
              if (nextStartDateStr && curDateStr >= nextStartDateStr) break;

              if (!isDateOnHold(curDateStr)) {
                const logExists = mLogs.some(l => l.date === curDateStr);
                if (!logExists) {
                  mUnloggedDays += 1;
                  mUnloggedDates.push(curDateStr);
                }
              }
              iterDate.setDate(iterDate.getDate() + 1);
            }
          }

          const mProjectedConsumed = Number((mConsumed + mUnloggedDays).toFixed(1));

          const cfg = !hasSwappedMachines ? machineConfigs[idx] : undefined;
          const mDuration = cfg
            ? (cfg.sameDurationAsFirst ? firstDur : (parseFloat(String(cfg.duration ?? 0)) || firstDur || duration))
            : duration;

          const isOver = mDuration > 0 && mProjectedConsumed > mDuration;
          const overDays = isOver ? Number((mProjectedConsumed - mDuration).toFixed(1)) : 0;

          return {
            id: m.id,
            name: m.name,
            serialNumber: m.serialNumber,
            consumedDays: mConsumed,
            unloggedDays: mUnloggedDays,
            projectedConsumedDays: mProjectedConsumed,
            unloggedDates: mUnloggedDates,
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

        const invoiceUnloggedDays = machinesDetail.reduce((sum, m) => sum + (m.unloggedDays || 0), 0);
        const projectedConsumedDays = Number((consumedDays + invoiceUnloggedDays).toFixed(1));

        // Lapsed calculation: compare against total contracted days and per-machine overruns
        const totalOverrun = Math.max(0, projectedConsumedDays - totalContractedDays);
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
          const calDays = Math.max(1, Math.abs(daysRemaining));
          urgencyLabel = `+${calDays}d Overdue`;
          urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        } else if (!hasNextInvoice && projectedConsumedDays >= totalContractedDays) {
          urgency = 'today';
          urgencyLabel = 'Due Today';
          urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        } else if (!hasNextInvoice && (totalContractedDays - projectedConsumedDays) <= (3 * machineCount) && (totalContractedDays - projectedConsumedDays) > 0) {
          const rem = Math.ceil((totalContractedDays - projectedConsumedDays) / machineCount);
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
          urgencyLabel = `Due in ${daysRemaining}d`;
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
          unloggedDays: invoiceUnloggedDays,
          projectedConsumedDays,
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

      const hasMultipleInvoices = runningInvoices.length > 1;
      // An invoice chain is sequential if invoices follow each other (e.g. #305 -> #309 with hasNextInvoice)
      const isSequentialChain = hasMultipleInvoices && runningInvoices.some(inv => inv.hasNextInvoice);
      const invoiceRelationLabel = hasMultipleInvoices
        ? (isSequentialChain ? `${runningInvoices.length} Chained Invoices` : `${runningInvoices.length} Concurrent Invoices`)
        : undefined;

      const hasMultipleConcurrent = hasMultipleInvoices && !isSequentialChain;

      if (hasMultipleInvoices) {
        runningInvoices.forEach(inv => {
          inv.isConcurrent = !isSequentialChain;
        });
      }

      // Cumulative Site Pool Calculations (totalBilledDays is split by track below)

      // Collect all machines for the site from all running invoices
      const siteMachinesMap = new Map<string, ActiveSiteInvoiceMachineDetail>();
      runningInvoices.forEach(inv => {
        (inv.machines || []).forEach(m => {
          if (!siteMachinesMap.has(m.id)) {
            siteMachinesMap.set(m.id, { ...m });
          } else {
            const existing = siteMachinesMap.get(m.id)!;
            // For sequential invoices, machine logs were partitioned into non-overlapping date ranges
            // per invoice period, so we sum the consumed days across periods to reflect full usage.
            if (isSequentialChain) {
              existing.consumedDays = Number((existing.consumedDays + m.consumedDays).toFixed(1));
            } else {
              existing.consumedDays = Math.max(existing.consumedDays, m.consumedDays);
            }
            if (m.unloggedDates && m.unloggedDates.length > 0) {
              const combined = new Set([...(existing.unloggedDates || []), ...m.unloggedDates]);
              existing.unloggedDates = Array.from(combined).sort();
            }
            existing.unloggedDays = (existing.unloggedDates || []).length;
            existing.projectedConsumedDays = Number((existing.consumedDays + existing.unloggedDays).toFixed(1));
          }
        });
      });

      const poolMachines = Array.from(siteMachinesMap.values());
      poolMachines.sort((a, b) => {
        if (a.isStopped && !b.isStopped) return 1;
        if (!a.isStopped && b.isStopped) return -1;
        return a.name.localeCompare(b.name);
      });

      // Separate running invoices by track: pump invoices vs auxiliary invoices
      const pumpRunningInvoices = runningInvoices.filter(inv => !checkIsInvoiceAuxOnly(inv.invoice));
      const auxRunningInvoices = runningInvoices.filter(inv => checkIsInvoiceAuxOnly(inv.invoice));
      
      // If there are pump invoices running, totalBilledDays reflects pump contracted capacity
      const totalBilledDays = pumpRunningInvoices.length > 0
        ? pumpRunningInvoices.reduce((sum, inv) => sum + inv.totalContractedDays, 0)
        : runningInvoices.reduce((sum, inv) => sum + inv.totalContractedDays, 0);

      const activePumps = poolMachines.filter(m => !m.isStopped && !isAuxiliaryAsset(m));
      const activeAuxMachines = poolMachines.filter(m => !m.isStopped && isAuxiliaryAsset(m));
      const activeMachinesCount = Math.max(
        1,
        activePumps.length || (pumpRunningInvoices[0]?.machineCount || runningInvoices[0]?.machineCount || 1)
      );

      // Collect missing log dates across active running pumps
      const siteMissingDatesSet = new Set<string>();
      activePumps.forEach(m => {
        (m.unloggedDates || []).forEach(d => siteMissingDatesSet.add(d));
      });
      const missingLogDates = Array.from(siteMissingDatesSet).sort();
      const unloggedDaysCount = missingLogDates.length;
      const hasUnloggedDays = unloggedDaysCount > 0;
      const totalUnloggedDays = Number(activePumps.reduce((sum, m) => sum + (m.unloggedDays || 0), 0).toFixed(1));

      // Only count logged days of pumps towards pump capacity (if pumps are present)
      const totalLoggedDays = Number((pumpRunningInvoices.length > 0
        ? poolMachines.filter(m => !isAuxiliaryAsset(m)).reduce((sum, m) => sum + m.consumedDays, 0)
        : poolMachines.reduce((sum, m) => sum + m.consumedDays, 0)).toFixed(1));
      const totalProjectedDays = Number((totalLoggedDays + totalUnloggedDays).toFixed(1));

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
              claimedStoppedIds.add(predMachine.id);
              currId = predId;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        if (preds.length > 0) {
          activeM.predecessors = preds;
        }
      });

      // 2. Timeline pairing for stopped machines not linked via replacedAssetId
      const unclaimedStopped = stoppedPumps.filter(p => !claimedStoppedIds.has(p.id) && !isAuxiliaryAsset(p));
      if (unclaimedStopped.length > 0 && activePumps.length > 0) {
        unclaimedStopped.forEach(stoppedM => {
          const stopDate = stoppedM.stopDate;
          const pairedActive = activePumps.find(activeM => {
            if (activeM.predecessors && activeM.predecessors.length > 0) return false;
            const pumpDateRec = (sitePumpDates || []).find(p => p.siteId === siteId && p.assetId === activeM.id);
            const startD = pumpDateRec?.pumpStartDate;
            if (stopDate && startD) {
              return startD >= stopDate;
            }
            return true;
          });

          if (pairedActive) {
            if (!pairedActive.predecessors) pairedActive.predecessors = [];
            pairedActive.predecessors.push({
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
        const slotWithUnlogged = Number((m.slotConsumedDays + (m.unloggedDays || 0)).toFixed(1));
        m.contractedDays = perActiveMachineBilledDays;
        m.isOver = m.contractedDays > 0 && slotWithUnlogged > m.contractedDays;
        m.overDays = m.isOver ? Number((slotWithUnlogged - m.contractedDays).toFixed(1)) : 0;
      });

      // For active auxiliary machines (e.g. Sedimentation Tank), allocate their contracted quota from aux running invoices
      const totalAuxBilledDays = auxRunningInvoices.reduce((sum, inv) => sum + inv.totalContractedDays, 0);
      activeAuxMachines.forEach(m => {
        m.contractedDays = totalAuxBilledDays > 0 ? totalAuxBilledDays : m.contractedDays;
        m.slotConsumedDays = m.consumedDays;
        m.isOver = m.contractedDays > 0 && m.consumedDays > m.contractedDays;
        m.overDays = m.isOver ? Number((m.consumedDays - m.contractedDays).toFixed(1)) : 0;
      });

      // Any remaining unclaimed stopped machines do not hold active capacity quota
      stoppedPumps.filter(p => !claimedStoppedIds.has(p.id)).forEach(m => {
        m.contractedDays = 0;
        m.slotConsumedDays = m.consumedDays;
        m.isOver = false;
        m.overDays = 0;
      });

      // Final roster: active pumps (with nested swap info) followed by any remaining unclaimed stopped pumps and active aux items
      const finalPoolMachines = [
        ...activePumps,
        ...stoppedPumps.filter(p => !claimedStoppedIds.has(p.id)),
        ...activeAuxMachines
      ];

      const isOverrun = totalBilledDays > 0 && totalProjectedDays > totalBilledDays;
      const overrunDays = isOverrun ? Number((totalProjectedDays - totalBilledDays).toFixed(1)) : 0;
      const remainingDays = isOverrun ? 0 : Math.max(0, Number((totalBilledDays - totalProjectedDays).toFixed(1)));

      const targetInvoices = pumpRunningInvoices.length > 0 ? pumpRunningInvoices : runningInvoices;
      const earliestStartDate = targetInvoices.length > 0
        ? [...targetInvoices].map(i => i.startDate).filter(Boolean).sort()[0]
        : undefined;
      const latestScheduledEndDate = targetInvoices.length > 0
        ? [...targetInvoices].map(i => i.scheduledEndDate).filter(Boolean).sort().reverse()[0]
        : undefined;
      const latestLiveEndDate = targetInvoices.length > 0
        ? [...targetInvoices].map(i => i.liveEndDate).filter(Boolean).sort().reverse()[0]
        : undefined;

      // Calculate calendar days remaining to live target
      let calendarDaysToTarget = 999;
      if (latestLiveEndDate) {
        const targetDateObj = new Date(latestLiveEndDate);
        targetDateObj.setHours(0, 0, 0, 0);
        calendarDaysToTarget = Math.round((targetDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      let calendarRunwayDays = 0;
      if (isOverrun) {
        calendarRunwayDays = -Math.max(1, Math.ceil(overrunDays / activeMachinesCount));
      } else if (calendarDaysToTarget < 0) {
        calendarRunwayDays = calendarDaysToTarget;
      } else if (remainingDays <= 0) {
        calendarRunwayDays = 0;
      } else {
        const capacityRunway = Math.ceil(remainingDays / activeMachinesCount);
        calendarRunwayDays = Math.min(capacityRunway, Math.max(0, calendarDaysToTarget));
      }

      const progressPct = totalBilledDays > 0 ? Math.min(100, (totalProjectedDays / totalBilledDays) * 100) : 0;

      let urgency: 'overdue' | 'today' | 'soon' | 'safe' = 'safe';
      let urgencyLabel = '';
      let urgencyBadgeClass = '';

      if (isOverrun || calendarRunwayDays < 0) {
        urgency = 'overdue';
        const calOverdueDays = Math.max(1, Math.abs(calendarRunwayDays));
        urgencyLabel = `+${calOverdueDays}d Overdue`;
        urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      } else if (calendarRunwayDays === 0 || remainingDays === 0) {
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

      const hasLapsedInvoice = isOverrun || runningInvoices.some(inv => inv.isLapsed);
      const maxLapsedDays = Math.max(overrunDays, runningInvoices.reduce((max, inv) => Math.max(max, inv.lapsedDays || 0), 0));

      summaries.push({
        siteId: site.id,
        siteName: site.name,
        clientName: site.client || '',
        hasMultipleConcurrent,
        concurrentCount: runningInvoices.length,
        isSequentialChain,
        invoiceRelationLabel,
        invoices: runningInvoices,
        primaryInvoice: runningInvoices[0] || undefined,
        hasActiveInvoices: runningInvoices.length > 0,
        hasLapsedInvoice,
        maxLapsedDays,
        totalBilledDays,
        totalLoggedDays,
        totalUnloggedDays,
        totalProjectedDays,
        missingLogDates,
        unloggedDaysCount,
        hasUnloggedDays,
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

