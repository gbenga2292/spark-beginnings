import type { Asset, DailyMachineLog, DieselRefill } from '@/src/types/operations';

export interface FuelEstimationParams {
  machineId: string;
  siteId?: string;
  targetDate: string; // e.g. "2026-09-29"
  currentRefill?: number; // refill entered today, or 0
  dailyMachineLogs: DailyMachineLog[];
  assets: Asset[];
  dieselRefills?: DieselRefill[];
  /** 'end_of_day' accounts for today's operational burn; 'start_of_day' calculates post-refill level before today's shift */
  timing?: 'end_of_day' | 'start_of_day';
  /** Operating status for today (full, half, off/none) */
  operationalDay?: 'full' | 'half' | 'off' | 'none';
}

export interface FuelEstimationResult {
  startingRemainingLitres: number; // fuel in tank before today's refill (e.g. 18L)
  refillAdded: number; // today's refill (e.g. 60L)
  todayBurn: number; // fuel consumed during today's shift if end_of_day (e.g. 18L)
  estimatedDipstickLitres: number; // clamped to tank capacity (e.g. min(tankCapacity, starting + refill - todayBurn))
  unclampedLitres: number; // raw calculated volume before clamping
  tankCapacityLitres: number; // e.g. 90L
  isOverCapacity: boolean; // unclampedLitres > tankCapacityLitres
  overCapacityByLitres: number; // max(0, unclampedLitres - tankCapacityLitres)
  burnRate: number; // e.g. 18 L/day
  timing: 'end_of_day' | 'start_of_day';
  lastAnchorDate: string | null;
  lastAnchorType: 'dipstick' | 'refill' | null;
  activeDaysSinceAnchor: number;
}

/**
 * Calculates current estimated fuel remaining and post-refill/end-of-shift dipstick level:
 * 
 * 1. Finds the most recent physical telemetry anchor (manual dipstick reading or formal diesel refill).
 *    Note: Auto-calculated estimates (isDipstickManual === false) are ignored as anchors to prevent drift.
 * 2. Deducts fuel burned for operational days between anchor and targetDate using daily burn rate.
 * 3. Adds today's fuel refill (entered or allocated).
 * 4. In 'end_of_day' mode (default), deducts today's fuel consumption based on operationalDay.
 * 5. Clamps displayed dipstick level to physical tank capacity while flagging isOverCapacity.
 */
export function calculateEstimatedFuelLevel(params: FuelEstimationParams): FuelEstimationResult | null {
  const {
    machineId,
    siteId,
    targetDate,
    currentRefill,
    dailyMachineLogs,
    assets,
    dieselRefills,
    timing = 'end_of_day',
    operationalDay = 'full',
  } = params;
  if (!machineId || !targetDate) return null;

  const rawAsset = (assets || []).find(
    a => a.id === machineId || a.name?.toLowerCase().trim() === machineId.toLowerCase().trim()
  );
  const benchmarkBurnRate = Number(rawAsset?.expectedDailyBurnRate) || 18.0;
  const tankCapacityLitres = Number(rawAsset?.tankCapacityLitres) || 0;

  // Filter logs for this machine strictly before targetDate, sorted descending
  const priorLogs = (dailyMachineLogs || [])
    .filter(l => l.assetId === machineId && l.date < targetDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Only physically measured dipstick readings act as anchors (ignore auto-estimates)
  const lastDipstickLog = priorLogs.find(
    l => l.dipstickLevelLitres != null &&
         Number(l.dipstickLevelLitres) >= 0 &&
         l.isDipstickManual !== false
  );
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

  // Calculate today's fuel consumption if timing is 'end_of_day'
  let todayBurn = 0;
  if (timing === 'end_of_day') {
    const todayRatio = operationalDay === 'full' ? 1.0 : (operationalDay === 'half' ? 0.5 : 0.0);
    todayBurn = parseFloat((todayRatio * benchmarkBurnRate).toFixed(1));
  }

  // Raw calculated remaining volume
  const unclamped = Math.max(0, parseFloat((startingRemainingLitres + refillAdded - todayBurn).toFixed(1)));
  const preBurnVolume = startingRemainingLitres + refillAdded;
  const isOverCapacity = tankCapacityLitres > 0 && preBurnVolume > tankCapacityLitres;
  const overCapacityByLitres = isOverCapacity 
    ? parseFloat((preBurnVolume - tankCapacityLitres).toFixed(1)) 
    : 0;

  // Clamped physically to tank capacity
  const estimatedDipstickLitres = tankCapacityLitres > 0
    ? Math.min(tankCapacityLitres, unclamped)
    : unclamped;

  return {
    startingRemainingLitres,
    refillAdded,
    todayBurn,
    estimatedDipstickLitres,
    unclampedLitres: unclamped,
    tankCapacityLitres,
    isOverCapacity,
    overCapacityByLitres,
    burnRate: benchmarkBurnRate,
    timing,
    lastAnchorDate,
    lastAnchorType,
    activeDaysSinceAnchor,
  };
}
