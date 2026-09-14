import { useMemo, useCallback } from 'react';
import { useAppStore, Site } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';

export interface RefillForecastItem {
  siteId: string;
  siteName: string;
  machineId: string;
  machineName: string;
  shortName: string;
  tankCapacityLitres: number;
  benchmarkBurnRate: number;
  lastRefillDate: string | null;
  lastRefillLitres: number;
  lastDipstickDate: string | null;
  lastDipstickLitres: number | null;
  estimatedRemainingLitres: number;
  fuelPercentage: number;
  isDipstickVerified: boolean;
  runwayDays: number;
  daysUntilRefill: number;
  targetRefillDate: string | null;
  targetRefillFormatted: string;
  urgency: 'critical' | 'today' | 'tomorrow' | 'soon' | 'safe' | 'unbenchmarked';
  urgencyLabel: string;
  urgencyBadgeClass: string;
}

export function formatMachineShortName(fullName: string): string {
  if (!fullName) return 'Machine';
  let clean = fullName.replace(/^dewatering\s+/i, '').trim();
  clean = clean.replace(/^pump\s+pump/i, 'Pump');
  clean = clean.replace(/dewatering\s+pump/i, 'Pump');
  clean = clean.replace(/dewatering/i, '').trim();

  if (clean.length > 22) {
    const parts = clean.split(/\s*[-–/]\s*/);
    if (parts.length > 1) {
      clean = `${parts[0]} (${parts[1].slice(0, 10)})`;
    } else {
      clean = clean.slice(0, 20) + '…';
    }
  }
  return clean;
}

export function formatLastRefilledDate(dateInput: any): string {
  if (!dateInput) return 'No refill recorded';
  const normalized = normalizeDate(dateInput);
  if (!normalized) return 'No refill recorded';

  const [yStr, mStr, dStr] = normalized.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);
  const targetDate = new Date(year, month, day);
  if (isNaN(targetDate.getTime())) return '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const dayName = targetDate.toLocaleDateString('en-GB', { weekday: 'long' });
  const formattedDate = `${dStr.padStart(2, '0')}/${mStr.padStart(2, '0')}/${yStr}`;

  if (diffDays === 0) {
    return `Today, ${formattedDate}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${formattedDate}`;
  }

  const currentDayOfWeek = today.getDay();
  const daysSinceMonday = (currentDayOfWeek + 6) % 7;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - daysSinceMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const isLastCalendarWeek = targetDate >= startOfLastWeek && targetDate < startOfThisWeek;
  const isSevenToThirteenDaysAgo = diffDays >= 7 && diffDays <= 13;

  if (isLastCalendarWeek || isSevenToThirteenDaysAgo) {
    return `Last ${dayName}, ${formattedDate}`;
  }

  return `${dayName}, ${formattedDate}`;
}

export function useRefillForecast() {
  const { sites, pendingSites = [] } = useAppStore();
  const { 
    dailyMachineLogs = [], 
    sitePumpDates = [], 
    waybills = [], 
    assets = [], 
    maintenanceAssets = [],
    siteHoldPeriods = []
  } = useOperations();

  const isDewateringSite = useCallback((s: Site) => {
    if (!s) return false;
    const clientLower = s.client?.trim().toLowerCase() || '';
    const nameLower = s.name?.trim().toLowerCase() || '';

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

    if (clientLower.includes('first bank')) {
      return false;
    }

    if ((s as any).service && !(s as any).service.toLowerCase().includes('dewatering')) {
      return false;
    }

    return true;
  }, [pendingSites]);

  const activeSites = useMemo(() => {
    return (sites || [])
      .filter(s => {
        if (s.status !== 'Active') return false;

        const clientLower = s.client?.trim().toLowerCase();
        if (clientLower === 'dcel') return false;

        const nameLower = s.name?.trim().toLowerCase();
        if (
          nameLower === 'office' ||
          nameLower.includes('site office') ||
          nameLower.includes('office (dcel)') ||
          nameLower.includes('dcel office')
        ) {
          return false;
        }

        if (!isDewateringSite(s)) return false;

        const isOnHold = (siteHoldPeriods || []).some(
          h => (h.siteId === s.id || h.siteName?.trim().toLowerCase() === nameLower) && !h.holdEnd
        );
        return !isOnHold;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, siteHoldPeriods, isDewateringSite]);

  const fleetRefillForecast = useMemo(() => {
    const list: RefillForecastItem[] = [];

    (activeSites || []).forEach(site => {
      const siteWb = (waybills || []).filter(w =>
        (w.siteName?.toLowerCase() === site.name.toLowerCase() || w.siteId === site.id) &&
        w.status !== 'outstanding'
      );
      const invMap = new Map<string, number>();
      siteWb.filter(w => w.type === 'waybill').forEach(wb => {
        wb.items.forEach(item => {
          invMap.set(item.assetId, (invMap.get(item.assetId) || 0) + item.quantity);
        });
      });
      siteWb.filter(w => w.type === 'return').forEach(wb => {
        wb.items.forEach(item => {
          const cur = invMap.get(item.assetId) || 0;
          invMap.set(item.assetId, Math.max(0, cur - item.quantity));
        });
      });

      const pumpConfigs = (sitePumpDates || []).filter(pd => pd.siteId === site.id);
      const sLogs = (dailyMachineLogs || []).filter(l => l.siteId === site.id);

      const machineIdSet = new Set<string>();
      (assets || []).filter(a => a.type === 'equipment' && a.requiresLogging && (invMap.get(a.id) || 0) > 0).forEach(a => machineIdSet.add(a.id));
      pumpConfigs.forEach(pd => machineIdSet.add(pd.assetId));
      sLogs.forEach(l => machineIdSet.add(l.assetId));

      machineIdSet.forEach(mId => {
        const pd = pumpConfigs.find(p => p.assetId === mId);
        const hasExplicitStop = !!pd?.pumpStopDate;
        const isReplaced = pumpConfigs.some(p => p.replacedAssetId === mId);
        const isCurrentlyActive = !hasExplicitStop && !isReplaced && (
          (pd?.pumpStartDate && !pd?.pumpStopDate) ||
          (invMap.get(mId) || 0) > 0
        );

        if (!isCurrentlyActive) return;

        const rawAsset = (assets || []).find(a => a.id === mId || a.name?.toLowerCase().trim() === mId.toLowerCase().trim());
        const maintAsset = (maintenanceAssets || []).find(m => m.id === mId);
        const machineName = rawAsset?.name || maintAsset?.name || sLogs.find(l => l.assetId === mId)?.assetName || 'Pump Unit';
        const benchmarkBurnRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;
        const tankCapacityLitres = Number(rawAsset?.tankCapacityLitres) || 0;

        const mLogs = sLogs.filter(l => l.assetId === mId).sort((a, b) => b.date.localeCompare(a.date));
        const lastDipstickLog = mLogs.find(l => l.dipstickLevelLitres != null && Number(l.dipstickLevelLitres) >= 0);
        const lastDipstickDate = lastDipstickLog?.date || null;
        const lastDipstickLitres = lastDipstickLog?.dipstickLevelLitres != null ? Number(lastDipstickLog.dipstickLevelLitres) : null;

        const lastRefillLog = mLogs.find(l => (Number(l.dieselUsage) || 0) > 0);
        const lastRefillDate = lastRefillLog?.date || null;
        const lastRefillLitres = Number(lastRefillLog?.dieselUsage) || 0;
        const wasLastRefillFull = !!lastRefillLog?.isTankFilledToFull;

        const effectiveTankCapacity = tankCapacityLitres > 0 
          ? tankCapacityLitres 
          : (lastRefillLitres > 0 ? lastRefillLitres : (lastDipstickLitres || 120));

        let estimatedRemainingLitres = 0;
        let isDipstickVerified = false;
        const hasTelemetryAnchor = (lastRefillLog != null || lastDipstickLog != null);

        if (hasTelemetryAnchor && effectiveTankCapacity > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const hasTodayLog = mLogs.some(l => l.date === todayStr);

          if (lastDipstickDate && (!lastRefillDate || lastDipstickDate >= lastRefillDate)) {
            let activeDaysSinceDip = 0;
            mLogs.forEach(l => {
              if (l.date > lastDipstickDate) {
                const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (opDay === 'full') activeDaysSinceDip += 1;
                else if (opDay === 'half') activeDaysSinceDip += 0.5;
              }
            });
            if (isCurrentlyActive && todayStr > lastDipstickDate && !hasTodayLog) {
              activeDaysSinceDip += 1;
            }
            const burnedSinceDip = activeDaysSinceDip * benchmarkBurnRate;
            estimatedRemainingLitres = Math.max(0, Math.min(effectiveTankCapacity, Math.round((lastDipstickLitres || 0) - burnedSinceDip)));
            isDipstickVerified = (activeDaysSinceDip === 0);
          } else if (lastRefillDate) {
            let activeDaysSinceRefill = 0;
            mLogs.forEach(l => {
              if (l.date > lastRefillDate) {
                const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                if (opDay === 'full') activeDaysSinceRefill += 1;
                else if (opDay === 'half') activeDaysSinceRefill += 0.5;
              }
            });
            if (isCurrentlyActive && todayStr > lastRefillDate && !hasTodayLog) {
              activeDaysSinceRefill += 1;
            }
            const burnedSinceRefill = activeDaysSinceRefill * benchmarkBurnRate;

            let remainingFromDipstick = 0;
            if (lastDipstickLitres != null && lastDipstickDate && lastDipstickDate < lastRefillDate) {
              let daysBetween = 0;
              mLogs.forEach(l => {
                if (l.date > lastDipstickDate && l.date < lastRefillDate) {
                  const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                  if (opDay === 'full') daysBetween += 1;
                  else if (opDay === 'half') daysBetween += 0.5;
                }
              });
              remainingFromDipstick = Math.max(0, lastDipstickLitres - (daysBetween * benchmarkBurnRate));
            }

            const baseline = wasLastRefillFull 
              ? effectiveTankCapacity 
              : (lastDipstickLitres != null 
                  ? Math.min(effectiveTankCapacity, remainingFromDipstick + lastRefillLitres)
                  : (tankCapacityLitres > 0 ? Math.min(effectiveTankCapacity, lastRefillLitres) : effectiveTankCapacity));
            estimatedRemainingLitres = Math.max(0, Math.round(baseline - burnedSinceRefill));
          }
        }

        const fuelPercentage = (hasTelemetryAnchor && effectiveTankCapacity > 0)
          ? Math.min(100, Math.max(0, Math.round((estimatedRemainingLitres / effectiveTankCapacity) * 100)))
          : 0;

        const runwayDays = (hasTelemetryAnchor && benchmarkBurnRate > 0 && estimatedRemainingLitres > 0)
          ? (estimatedRemainingLitres / benchmarkBurnRate)
          : 0;

        let urgency: 'critical' | 'today' | 'tomorrow' | 'soon' | 'safe' | 'unbenchmarked' = 'safe';
        let urgencyLabel = '';
        let urgencyBadgeClass = '';
        let targetRefillDate: string | null = null;
        let targetRefillFormatted = 'No telemetry';
        let daysUntilRefill = 0;

        if (!hasTelemetryAnchor) {
          urgency = 'unbenchmarked';
          urgencyLabel = 'No Logs';
          urgencyBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
          targetRefillFormatted = 'Check Dipstick';
        } else if (runwayDays <= 0) {
          urgency = 'critical';
          urgencyLabel = 'Overdue / Empty';
          urgencyBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800';
          targetRefillFormatted = 'Immediate Refill';
          daysUntilRefill = 0;
          targetRefillDate = new Date().toISOString().split('T')[0];
        } else {
          daysUntilRefill = Math.max(0, Math.floor(runwayDays - 1.0));
          const target = new Date();
          target.setDate(target.getDate() + daysUntilRefill);
          targetRefillDate = target.toISOString().split('T')[0];
          targetRefillFormatted = formatDisplayDate(targetRefillDate);

          if (daysUntilRefill === 0 || runwayDays <= 1.0) {
            urgency = 'today';
            urgencyLabel = 'Today';
            urgencyBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
          } else if (daysUntilRefill === 1) {
            urgency = 'tomorrow';
            urgencyLabel = 'Tomorrow';
            urgencyBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
          } else if (daysUntilRefill <= 3) {
            urgency = 'soon';
            urgencyLabel = `In ${daysUntilRefill} days`;
            urgencyBadgeClass = 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
          } else {
            urgency = 'safe';
            urgencyLabel = `In ${daysUntilRefill} days`;
            urgencyBadgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
          }
        }

        const shortName = formatMachineShortName(machineName);

        list.push({
          siteId: site.id,
          siteName: site.name,
          machineId: mId,
          machineName,
          shortName,
          tankCapacityLitres: effectiveTankCapacity,
          benchmarkBurnRate,
          lastRefillDate,
          lastRefillLitres,
          lastDipstickDate,
          lastDipstickLitres,
          estimatedRemainingLitres,
          fuelPercentage,
          isDipstickVerified,
          runwayDays: Number(runwayDays.toFixed(1)),
          daysUntilRefill,
          targetRefillDate,
          targetRefillFormatted,
          urgency,
          urgencyLabel,
          urgencyBadgeClass,
        });
      });
    });

    const urgencyRank: Record<string, number> = {
      critical: 0,
      today: 1,
      tomorrow: 2,
      soon: 3,
      safe: 4,
      unbenchmarked: 5,
    };

    return list.sort((a, b) => {
      const rankDiff = (urgencyRank[a.urgency] ?? 99) - (urgencyRank[b.urgency] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      if (a.daysUntilRefill !== b.daysUntilRefill) return a.daysUntilRefill - b.daysUntilRefill;
      return a.fuelPercentage - b.fuelPercentage;
    });
  }, [activeSites, sitePumpDates, dailyMachineLogs, waybills, assets, maintenanceAssets]);

  const { urgentRefillCount, tomorrowRefillCount } = useMemo(() => {
    let urgent = 0;
    let tomorrow = 0;
    for (let i = 0; i < fleetRefillForecast.length; i++) {
      const u = fleetRefillForecast[i].urgency;
      if (u === 'critical' || u === 'today') {
        urgent++;
      } else if (u === 'tomorrow') {
        tomorrow++;
      }
    }
    return { urgentRefillCount: urgent, tomorrowRefillCount: tomorrow };
  }, [fleetRefillForecast]);

  return {
    activeSites,
    fleetRefillForecast,
    urgentRefillCount,
    tomorrowRefillCount,
  };
}
