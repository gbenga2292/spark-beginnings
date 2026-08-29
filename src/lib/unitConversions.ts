/**
 * Unit and Packaging Conversion Utilities
 * Supports dual-unit displays (e.g. "4 Boxes + 12 Pcs") and pack <-> single conversions.
 */

export interface DualUnitBreakdown {
  packs: number;
  singles: number;
  totalSingles: number;
  hasPackaging: boolean;
  displayText: string;
}

/**
 * Parses clean unit name from strings like "pcs - Pieces" or "kg - Kilograms"
 */
export function getCleanUnitName(unitOfMeasurement: string): string {
  if (!unitOfMeasurement) return 'pcs';
  if (unitOfMeasurement.includes(' - ')) {
    return unitOfMeasurement.split(' - ')[0].trim();
  }
  return unitOfMeasurement.trim();
}

/**
 * Computes dual-unit breakdown (Packs + Singles)
 */
export function getDualUnitBreakdown(
  quantity: number,
  baseUnit: string,
  packUnit?: string,
  packSize?: number
): DualUnitBreakdown {
  const cleanBase = getCleanUnitName(baseUnit);
  const qty = Math.max(0, Number(quantity) || 0);

  if (!packUnit || !packSize || packSize <= 1) {
    return {
      packs: 0,
      singles: qty,
      totalSingles: qty,
      hasPackaging: false,
      displayText: `${qty.toLocaleString()} ${cleanBase}`
    };
  }

  const packs = Math.floor(qty / packSize);
  const singles = Number((qty % packSize).toFixed(2));
  const pluralPack = packs === 1 ? packUnit : (packUnit.endsWith('s') ? packUnit : `${packUnit}s`);

  let text = '';
  if (packs > 0 && singles > 0) {
    text = `${packs} ${pluralPack} + ${singles} ${cleanBase} (${qty.toLocaleString()} ${cleanBase})`;
  } else if (packs > 0 && singles === 0) {
    text = `${packs} ${pluralPack} (${qty.toLocaleString()} ${cleanBase})`;
  } else {
    text = `${singles} ${cleanBase}`;
  }

  return {
    packs,
    singles,
    totalSingles: qty,
    hasPackaging: true,
    displayText: text
  };
}

/**
 * Formats a quantity with dual-unit awareness
 */
export function formatDualUnit(
  quantity: number,
  baseUnit: string,
  packUnit?: string,
  packSize?: number
): string {
  return getDualUnitBreakdown(quantity, baseUnit, packUnit, packSize).displayText;
}

/**
 * Converts packs and loose singles into total base unit quantity
 */
export function packsToUnits(
  packs: number,
  looseSingles: number,
  packSize?: number
): number {
  const p = Math.max(0, Number(packs) || 0);
  const s = Math.max(0, Number(looseSingles) || 0);
  const size = Math.max(1, Number(packSize) || 1);
  return (p * size) + s;
}
