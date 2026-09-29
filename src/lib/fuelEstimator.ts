import type { Asset, DailyMachineLog, DieselRefill } from '@/src/types/operations';

export interface FuelEstimationParams {
  machineId: string;
  siteId?: string;
  targetDate: string; // e.g. "2026-09-29"
  currentRefill?: number; // refill entered today, or 0
  dailyMachineLogs: DailyMachineLog[];
  assets: Asset[];
  dieselRefills?: DieselRefill[];
}

export interface FuelEstimationResult {
  startingRemainingLitres: number; // fuel in tank before today's refill (e.g. 18L)
  refillAdded: number; // today's refill (e.g. 60L)
  estimatedDipstickLitres: number; // startingRemaining + refillAdded (e.g. 78L)
  tankCapacityLitres: number; // e.g. 90L
  isOverCapacity: boolean; // estimatedDipstickLitres > tankCapacityLitres
  overCapacityByLitres: number; // max(0, estimatedDipstickLitres - tankCapacityLitres)
  burnRate: number; // e.g. 18 L/day
  lastAnchorDate: string | null;
  lastAnchorType: 'dipstick' | 'refill' | null;
  activeDaysSinceAnchor: number;
}

/**
 * Calculates current estimated fuel remaining and post-refill dipstick level
 * matching the Next Refill Date Forecast methodology:
 * 
 * 1. Finds the most recent telemetry anchor (dipstick reading or diesel refill).
 * 2. Deducts fuel burned for operational days since the anchor (using rated daily burn rate, e.g. 18L/day).
 * 3. Adds today's fuel refill (entered or allocated).
 * 4. NEVER silently clamps to tank capacity — reports the exact calculated value
 *    and flags `isOverCapacity` so users can clearly see if fuel exceeds tank volume.
 */
export function calculateEstimatedFuelLevel(params: FuelEstimationParams): FuelEstimationResult | null {
  const { machineId, siteId, targetDate, currentRefill, dailyMachineLogs, assets, dieselRefills } = params;
  if (!machineId || !targetDate) return null;

  const rawAsset = (assets || []).find(
    a => a.id === machineId || a.name?.toLowerCase().trim() === machineId.toLowerCase().trim()
  );
  const benchmarkBurnRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;
  const tankCapacityLitres = Number(rawAsset?.tankCapacityLitres) || 0;

  // Filter logs for this machine before targetDate
  // Sort descending by date
  const priorLogs = (dailyMachineLogs || [])
    .filter(l => l.assetId === machineId && l.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastDipstickLog = priorLogs.find(l => l.dipstickLevelLitres != null && Number(l.dipstickLevelLitres) >= 0);
  const lastDipstickDate = lastDipstickLog?.date || null;
  const lastDipstickLitres = lastDipstickLog?.dipstickLevelLitres != null ? Number(lastDipstickLog.dipstickLevelLitres) : null;

  const lastRefillLog = priorLogs.find(l => (Number(l.dieselUsage) || 0) > 0);
  const lastRefillDate = lastRefillLog?.date || null;
  const lastRefillLitres = Number(lastRefillLog?.dieselUsage) || 0;
  const wasLastRefillFull = !!lastRefillLog?.isTankFilledToFull;

  const effectiveTankCapacity = tankCapacityLitres > 0 
    ? tankCapacityLitres 
    : (lastRefillLitres > 0 ? lastRefillLitres : (lastDipstickLitres || 120));

  let startingRemainingLitres = 0;
  let lastAnchorDate: string | null = null;
  let lastAnchorType: 'dipstick' | 'refill' | null = null;
  let activeDaysSinceAnchor = 0;

  const hasTelemetryAnchor = (lastRefillLog != null || lastDipstickLog != null);

  if (hasTelemetryAnchor) {
    if (lastDipstickDate && (!lastRefillDate || lastDipstickDate >= lastRefillDate)) {
      lastAnchorDate = lastDipstickDate;
      lastAnchorType = 'dipstick';

      priorLogs.forEach(l => {
        if (l.date > lastDipstickDate) {
          const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
          if (opDay === 'full') activeDaysSinceAnchor += 1;
          else if (opDay === 'half') activeDaysSinceAnchor += 0.5;
        }
      });

      const burnedSinceDip = activeDaysSinceAnchor * benchmarkBurnRate;
      startingRemainingLitres = Math.max(0, Math.round((lastDipstickLitres || 0) - burnedSinceDip));
    } else if (lastRefillDate) {
      lastAnchorDate = lastRefillDate;
      lastAnchorType = 'refill';

      priorLogs.forEach(l => {
        if (l.date > lastRefillDate) {
          const opDay = l.operationalDay ?? (l.isActive ? 'full' : 'none');
          if (opDay === 'full') activeDaysSinceAnchor += 1;
          else if (opDay === 'half') activeDaysSinceAnchor += 0.5;
        }
      });

      const burnedSinceRefill = activeDaysSinceAnchor * benchmarkBurnRate;

      let remainingFromDipstick = 0;
      if (lastDipstickLitres != null && lastDipstickDate && lastDipstickDate < lastRefillDate) {
        let daysBetween = 0;
        priorLogs.forEach(l => {
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
      
      startingRemainingLitres = Math.max(0, Math.round(baseline - burnedSinceRefill));
    }
  } else {
    return null;
  }

  // Refill allocation for today from formal refills if not explicitly passed
  let refillAdded = currentRefill != null && currentRefill > 0 ? currentRefill : 0;
  if (refillAdded <= 0 && dieselRefills && siteId) {
    refillAdded = (dieselRefills || [])
      .filter(r => r.date === targetDate && r.siteId === siteId)
      .flatMap(r => r.machineAllocations || [])
      .filter(a => a.assetId === machineId)
      .reduce((sum, a) => sum + (a.allocatedLitres || 0), 0);
  }

  // Dipstick post-refill = starting fuel remaining + today's refill
  // If no refill was added, dipstick reflects current remaining fuel before refill
  const totalFuel = startingRemainingLitres + refillAdded;
  const estimatedDipstickLitres = parseFloat(totalFuel.toFixed(1));
  const isOverCapacity = tankCapacityLitres > 0 && estimatedDipstickLitres > tankCapacityLitres;
  const overCapacityByLitres = isOverCapacity 
    ? parseFloat((estimatedDipstickLitres - tankCapacityLitres).toFixed(1)) 
    : 0;

  return {
    startingRemainingLitres,
    refillAdded,
    estimatedDipstickLitres,
    tankCapacityLitres,
    isOverCapacity,
    overCapacityByLitres,
    burnRate: benchmarkBurnRate,
    lastAnchorDate,
    lastAnchorType,
    activeDaysSinceAnchor,
  };
}
