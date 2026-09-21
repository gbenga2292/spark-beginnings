/**
 * Wellpoint Dewatering Sizing & Practical Installation Engine
 * 
 * Implements civil engineering sizing logic for:
 * - Topologies: Full Ring (4-sided), U-Shape (3-sided), L-Shape (2-sided), Single Line (1-sided)
 * - Available pipe stock constraints (6m & 3m modular mix vs 6m-only inventory)
 * - Smart installation offset optimization around standard pipe modules
 * - Per-side modular header breakdown
 * - Contractor-grade installation Bill of Quantities (fittings, swing joints, couplings, suction/discharge lines)
 */

export type DewateringLayoutType = 'ring' | 'u_shape' | 'l_shape' | 'single_line';
export type PipeStockOption = 'all' | '6m_only';
export type OffsetMode = 'auto' | 'manual';

export interface DewateringInput {
  landLength: number; // m
  landWidth: number; // m
  excavationLength: number; // m
  excavationWidth: number; // m
  excavationDepth: number; // m
  waterTableDepth: number; // m b.g.l. (below ground level)
  requiredDrawdown: number; // m below pit base (or target water level b.g.l.)
  ingressRequired: boolean;
  ingressWidth: number; // m (min 6.0m when ingressRequired is true)
  ingressSide?: 'north' | 'east' | 'south' | 'west';
  layoutType?: DewateringLayoutType;
  pipeStock?: PipeStockOption;
  offsetMode?: OffsetMode;
  manualOffset?: number; // m
  minOffset?: number; // m (default 0.75m)
}

export interface RunSegment {
  id: string;
  name: string;
  length: number; // m
  headers6m: number;
  headers3m: number;
  nominalLength: number; // 6*h6 + 3*h3
  wasteOrOverlap: number; // nominalLength - length
}

export interface DewateringCalculationResult {
  status: 'REQUIRED' | 'NOT_REQUIRED' | 'ERROR';
  errorMessage?: string;
  warningMessage?: string;
  optimizationNote?: string;
  targetDepth: number; // m b.g.l.
  effectiveWaterLevel: number; // m b.g.l.
  drawdownAmount: number; // m of water column to depress
  offsetL: number; // (LL - L) / 2
  offsetW: number; // (LW - W) / 2
  designOffset: number; // selected/effective installation offset
  recommendedOffset: number; // best offset from modular auto-fit
  effL: number; // L + 2 * designOffset
  effW: number; // W + 2 * designOffset
  layoutType: DewateringLayoutType;
  pipeStock: PipeStockOption;
  activeRunCount: number;
  runs: RunSegment[];
  loopPerimeter: number; // total active line length (m)
  filters: number; // wellpoint filters (1.0m c/c)
  pumps: number; // vacuum pumps
  headers6m: number; // total 6m pipes
  headers3m: number; // total 3m pipes
  baseHeaderLength: number; // sum of actual run lengths
  finalHeaderLength: number; // sum of modular pipe lengths
  elbows90: number;
  tees: number;
  endCaps: number;
  swingJoints: number;
  couplings: number;
  suctionHoses: number;
  dischargeHoseMeters: number;
  autoSummary: string;
}

export const EMPTY_DEWATERING_INPUT: DewateringInput = {
  landLength: 0,
  landWidth: 0,
  excavationLength: 0,
  excavationWidth: 0,
  excavationDepth: 0,
  waterTableDepth: 0,
  requiredDrawdown: 0,
  ingressRequired: false,
  ingressWidth: 6.0,
  ingressSide: 'south',
  layoutType: 'ring',
  pipeStock: 'all',
  offsetMode: 'manual',
  manualOffset: 1.0,
  minOffset: 0.75,
};

export const DEFAULT_DEWATERING_INPUT: DewateringInput = {
  landLength: 30,
  landWidth: 24,
  excavationLength: 6,
  excavationWidth: 6,
  excavationDepth: 4.0,
  waterTableDepth: 1.0,
  requiredDrawdown: 0.5,
  ingressRequired: false,
  ingressWidth: 6.0,
  ingressSide: 'south',
  layoutType: 'ring',
  pipeStock: 'all',
  offsetMode: 'manual',
  manualOffset: 1.0,
  minOffset: 0.75,
};

export const PRESET_SCENARIOS: {
  id: string;
  name: string;
  description: string;
  inputs: DewateringInput;
}[] = [
  {
    id: 'standard-basement-ring',
    name: 'Standard Basement (Full Ring)',
    description: 'Medium 4-sided pit enclosure with 1.0m setback and standard 6m/3m modular pipes.',
    inputs: {
      landLength: 30,
      landWidth: 24,
      excavationLength: 6,
      excavationWidth: 6,
      excavationDepth: 4.0,
      waterTableDepth: 1.0,
      requiredDrawdown: 0.5,
      ingressRequired: false,
      ingressWidth: 6.0,
      layoutType: 'ring',
      pipeStock: 'all',
      offsetMode: 'manual',
      manualOffset: 1.0,
      minOffset: 0.75,
    },
  },
  {
    id: 'u-shape-ramp',
    name: 'U-Shape Excavation with Ramp',
    description: '3-sided system leaving one face open for earthmoving equipment ingress.',
    inputs: {
      landLength: 35,
      landWidth: 25,
      excavationLength: 18,
      excavationWidth: 12,
      excavationDepth: 4.5,
      waterTableDepth: 1.5,
      requiredDrawdown: 0.5,
      ingressRequired: true,
      ingressWidth: 6.0,
      layoutType: 'u_shape',
      pipeStock: 'all',
      offsetMode: 'auto',
      manualOffset: 1.0,
      minOffset: 0.75,
    },
  },
  {
    id: 'l-shape-boundary',
    name: 'L-Shape Corner Intercept',
    description: '2-sided cutoff line for excavations adjacent to an existing basement or retaining wall.',
    inputs: {
      landLength: 25,
      landWidth: 20,
      excavationLength: 12,
      excavationWidth: 10,
      excavationDepth: 3.5,
      waterTableDepth: 1.2,
      requiredDrawdown: 0.5,
      ingressRequired: false,
      ingressWidth: 6.0,
      layoutType: 'l_shape',
      pipeStock: '6m_only',
      offsetMode: 'auto',
      manualOffset: 1.0,
      minOffset: 0.75,
    },
  },
  {
    id: 'single-line-trench',
    name: 'Single Line Trench Cutoff',
    description: 'Linear wellpoint run parallel to pipeline trench or unidirectional groundwater gradient.',
    inputs: {
      landLength: 40,
      landWidth: 15,
      excavationLength: 24,
      excavationWidth: 4,
      excavationDepth: 3.0,
      waterTableDepth: 1.0,
      requiredDrawdown: 0.5,
      ingressRequired: false,
      ingressWidth: 6.0,
      layoutType: 'single_line',
      pipeStock: 'all',
      offsetMode: 'auto',
      manualOffset: 1.0,
      minOffset: 0.75,
    },
  },
];

/**
 * Break down a single physical run length into available modular pipes.
 */
export function breakdownRunLength(
  length: number,
  stockOption: PipeStockOption
): { headers6m: number; headers3m: number; nominalLength: number; wasteOrOverlap: number } {
  if (length <= 0) {
    return { headers6m: 0, headers3m: 0, nominalLength: 0, wasteOrOverlap: 0 };
  }

  if (stockOption === '6m_only') {
    const headers6m = Math.ceil(length / 6);
    const nominalLength = headers6m * 6;
    return {
      headers6m,
      headers3m: 0,
      nominalLength,
      wasteOrOverlap: Number((nominalLength - length).toFixed(2)),
    };
  }

  // Stock option: 'all' (6m and 3m)
  // Find combination of 6m & 3m that spans >= length with minimum nominal length
  const needed = Math.ceil(length / 3) * 3;
  const headers6m = Math.floor(needed / 6);
  const headers3m = (needed % 6 === 3) ? 1 : 0;
  const nominalLength = headers6m * 6 + headers3m * 3;

  return {
    headers6m,
    headers3m,
    nominalLength,
    wasteOrOverlap: Number((nominalLength - length).toFixed(2)),
  };
}

/**
 * Find the optimal installation offset that minimizes pipe cutting/waste
 * and respects physical site boundaries.
 */
export function findOptimalOffset(
  L: number,
  W: number,
  maxAllowedOffset: number,
  minOffset: number,
  layoutType: DewateringLayoutType,
  pipeStock: PipeStockOption,
  preferredOffset = 1.0
): { recommendedOffset: number; note: string } {
  const minO = Math.max(0.1, minOffset);
  const maxO = Math.max(minO, Math.min(maxAllowedOffset, 2.5));

  let bestOffset = Math.min(preferredOffset, maxO);
  let bestScore = -Infinity;

  // Test candidate offsets in 0.05m increments
  const step = 0.05;
  for (let o = minO; o <= maxO + 0.001; o += step) {
    const roundedO = Math.round(o * 100) / 100;
    const runL = L + 2 * roundedO;
    const runW = W + 2 * roundedO;

    let activeLengths: number[] = [];
    if (layoutType === 'ring') activeLengths = [runL, runW, runL, runW];
    else if (layoutType === 'u_shape') activeLengths = [runL, runW, runW];
    else if (layoutType === 'l_shape') activeLengths = [runL, runW];
    else activeLengths = [runL];

    let totalWaste = 0;
    activeLengths.forEach(len => {
      const { wasteOrOverlap } = breakdownRunLength(len, pipeStock);
      totalWaste += wasteOrOverlap;
    });

    // Score: minimize waste, mildly prefer being close to preferredOffset (1.0m)
    const proximityPenalty = Math.abs(roundedO - preferredOffset) * 0.8;
    const score = -(totalWaste * 1.5) - proximityPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestOffset = roundedO;
    }
  }

  const note = `Offset ${bestOffset.toFixed(2)}m selected: cleanly fits standard ${pipeStock === '6m_only' ? '6m' : '6m & 3m'} pipes while maintaining site boundary clearance.`;
  return { recommendedOffset: bestOffset, note };
}

export function calculateDewatering(inputs: DewateringInput): DewateringCalculationResult | null {
  const {
    landLength: LL,
    landWidth: LW,
    excavationLength: L,
    excavationWidth: W,
    excavationDepth: D,
    waterTableDepth: WT,
    requiredDrawdown: Rd,
    ingressRequired: ingress,
    ingressWidth,
    layoutType = 'ring',
    pipeStock = 'all',
    offsetMode = 'manual',
    manualOffset = 1.0,
    minOffset = 0.75,
  } = inputs;

  // If essential dimensions are missing or zero, return null
  if (!LL || !LW || !L || !W || !D) {
    return null;
  }

  // Basic physical validation
  if (LL <= L) {
    return createErrorResult(
      `Land length (${LL}m) must be greater than excavation length (${L}m).`,
      inputs
    );
  }
  if (LW <= W) {
    return createErrorResult(
      `Land width (${LW}m) must be greater than excavation width (${W}m).`,
      inputs
    );
  }

  // Max clearance to boundary
  const offsetL = (LL - L) / 2;
  const offsetW = (LW - W) / 2;
  const maxBoundaryOffset = Math.min(offsetL, offsetW);

  if (maxBoundaryOffset < 0.1) {
    return createErrorResult(
      `Excavation touches boundary. Only ${maxBoundaryOffset.toFixed(2)}m clearance available (minimum 0.10m required).`,
      inputs
    );
  }

  // Step 1: Hydraulic Target & Dewatering check
  // If user entered Rd > D (e.g. entered absolute target depth 5.5m), use Rd as target depth.
  // Otherwise, target depth = D + (Rd > 0 ? Rd : 0.5)
  const target = Rd > D ? Rd : D + (Rd > 0 ? Rd : 0.5);
  const effectiveWaterLevel = WT;
  const drawdownAmount = Math.max(0, target - effectiveWaterLevel);

  // If water table is naturally at or below the target depth, dewatering is not needed
  if (effectiveWaterLevel >= target) {
    const summary = `Dewatering not required. The static water table (${WT.toFixed(2)}m b.g.l.) sits below the required target formation depth (${target.toFixed(2)}m b.g.l.). No pumping installation necessary.`;
    return {
      status: 'NOT_REQUIRED',
      targetDepth: target,
      effectiveWaterLevel,
      drawdownAmount: 0,
      offsetL,
      offsetW,
      designOffset: Math.min(1.0, maxBoundaryOffset),
      recommendedOffset: Math.min(1.0, maxBoundaryOffset),
      effL: L,
      effW: W,
      layoutType,
      pipeStock,
      activeRunCount: 0,
      runs: [],
      loopPerimeter: 0,
      filters: 0,
      pumps: 0,
      headers6m: 0,
      headers3m: 0,
      baseHeaderLength: 0,
      finalHeaderLength: 0,
      elbows90: 0,
      tees: 0,
      endCaps: 0,
      swingJoints: 0,
      couplings: 0,
      suctionHoses: 0,
      dischargeHoseMeters: 0,
      autoSummary: summary,
    };
  }

  // Step 2: Determine Design Offset (Smart Auto-Fit vs Manual)
  const { recommendedOffset, note: optNote } = findOptimalOffset(
    L,
    W,
    maxBoundaryOffset,
    minOffset,
    layoutType,
    pipeStock,
    manualOffset || 1.0
  );

  let designOffset: number;
  if (offsetMode === 'auto') {
    designOffset = recommendedOffset;
  } else {
    // Manual mode clamped within physical boundary
    designOffset = Math.min(Math.max(0.1, manualOffset || 1.0), maxBoundaryOffset);
  }

  let warningMessage: string | undefined;
  if (designOffset < 0.75) {
    warningMessage = `Narrow ${designOffset.toFixed(2)}m setback available (recommended is ≥0.75m). Use spade-end wellpoint tips and take extra care near pit face.`;
  }

  // Step 3: Effective Geometry
  const effL = L + 2 * designOffset;
  const effW = W + 2 * designOffset;

  // Step 4: Construct Active Runs per Layout Type
  const runs: RunSegment[] = [];

  if (layoutType === 'ring') {
    // 4 sides - account for vehicle ingress break on the selected side
    const side = inputs.ingressSide || 'south';
    const isIngressNorth = ingress && ingressWidth > 0 && side === 'north';
    const isIngressEast = ingress && ingressWidth > 0 && side === 'east';
    const isIngressSouth = ingress && ingressWidth > 0 && side === 'south';
    const isIngressWest = ingress && ingressWidth > 0 && side === 'west';

    const northLen = isIngressNorth ? Math.max(0, effL - ingressWidth) : effL;
    const topBreakdown = breakdownRunLength(northLen, pipeStock);
    runs.push({
      id: 'north',
      name: isIngressNorth ? `North Run (Side 1 - less ${ingressWidth.toFixed(1)}m ingress)` : 'North Run (Side 1)',
      length: northLen,
      ...topBreakdown,
    });

    const eastLen = isIngressEast ? Math.max(0, effW - ingressWidth) : effW;
    const rightBreakdown = breakdownRunLength(eastLen, pipeStock);
    runs.push({
      id: 'east',
      name: isIngressEast ? `East Run (Side 2 - less ${ingressWidth.toFixed(1)}m ingress)` : 'East Run (Side 2)',
      length: eastLen,
      ...rightBreakdown,
    });

    const southLen = isIngressSouth ? Math.max(0, effL - ingressWidth) : effL;
    const southBreakdown = breakdownRunLength(southLen, pipeStock);
    runs.push({
      id: 'south',
      name: isIngressSouth ? `South Run (Side 3 - less ${ingressWidth.toFixed(1)}m ingress)` : 'South Run (Side 3)',
      length: southLen,
      ...southBreakdown,
    });

    const westLen = isIngressWest ? Math.max(0, effW - ingressWidth) : effW;
    const leftBreakdown = breakdownRunLength(westLen, pipeStock);
    runs.push({
      id: 'west',
      name: isIngressWest ? `West Run (Side 4 - less ${ingressWidth.toFixed(1)}m ingress)` : 'West Run (Side 4)',
      length: westLen,
      ...leftBreakdown,
    });
  } else if (layoutType === 'u_shape') {
    // 3 sides: Top, East, West (South remains open)
    const topBreakdown = breakdownRunLength(effL, pipeStock);
    runs.push({
      id: 'north',
      name: 'North Run (Top)',
      length: effL,
      ...topBreakdown,
    });

    const rightBreakdown = breakdownRunLength(effW, pipeStock);
    runs.push({
      id: 'east',
      name: 'East Run (Right)',
      length: effW,
      ...rightBreakdown,
    });

    const leftBreakdown = breakdownRunLength(effW, pipeStock);
    runs.push({
      id: 'west',
      name: 'West Run (Left)',
      length: effW,
      ...leftBreakdown,
    });
  } else if (layoutType === 'l_shape') {
    // 2 sides: Top and Left
    const topBreakdown = breakdownRunLength(effL, pipeStock);
    runs.push({
      id: 'north',
      name: 'North Run (Top)',
      length: effL,
      ...topBreakdown,
    });

    const leftBreakdown = breakdownRunLength(effW, pipeStock);
    runs.push({
      id: 'west',
      name: 'West Run (Left)',
      length: effW,
      ...leftBreakdown,
    });
  } else {
    // Single Line: Top run
    const topBreakdown = breakdownRunLength(effL, pipeStock);
    runs.push({
      id: 'north',
      name: 'Linear Cutoff Run',
      length: effL,
      ...topBreakdown,
    });
  }

  // Totals from runs
  const loopPerimeter = Number(runs.reduce((acc, r) => acc + r.length, 0).toFixed(2));
  const headers6m = runs.reduce((acc, r) => acc + r.headers6m, 0);
  const headers3m = runs.reduce((acc, r) => acc + r.headers3m, 0);
  const baseHeaderLength = loopPerimeter;
  const finalHeaderLength = headers6m * 6 + headers3m * 3;

  // Step 5: Wellpoints / Filters (1.0m c/c along active lines)
  const filters = Math.max(4, Math.ceil(loopPerimeter / 1.0));

  // Step 6: Pumps (100 m³/hr vacuum pumps, max 60m header coverage per pump)
  const pumps = Math.max(1, Math.ceil(loopPerimeter / 60));

  // Step 7: Layout-specific fittings
  let elbows90 = 0;
  let endCaps = 0;

  if (layoutType === 'ring') {
    elbows90 = ingress ? 3 : 4;
    endCaps = ingress ? 2 : 0;
  } else if (layoutType === 'u_shape') {
    elbows90 = 2;
    endCaps = 2;
  } else if (layoutType === 'l_shape') {
    elbows90 = 1;
    endCaps = 2;
  } else {
    // Single Line
    elbows90 = 0;
    endCaps = 2;
  }

  // 1 Suction tee per pump to tie into the active line
  const tees = pumps;

  // 1 Flexible swing arm / joint per wellpoint filter
  const swingJoints = filters;

  // Total quick-release lever / Bauer clamp couplings
  // (Pipe-to-pipe joints within runs + elbows + tees + end caps + pump tie-in)
  const totalPipes = headers6m + headers3m;
  const pipeToPipeJoints = Math.max(0, totalPipes - runs.length);
  const couplings = pipeToPipeJoints + (elbows90 * 2) + (tees * 2) + endCaps + pumps;

  // 1 Heavy-duty armored suction hose per pump
  const suctionHoses = pumps;

  // 25m layflat discharge hose roll per pump
  const dischargeHoseMeters = pumps * 25;

  // Auto-Summary
  const layoutLabel = layoutType === 'ring' ? 'Closed Ring (4-sided)'
    : layoutType === 'u_shape' ? 'U-Shape (3-sided)'
    : layoutType === 'l_shape' ? 'L-Shape (2-sided)'
    : 'Single Line (1-sided)';

  let summary = `${layoutLabel} installation at ${designOffset.toFixed(2)}m offset. Total line: ${loopPerimeter.toFixed(1)}m. Required drawdown: ${drawdownAmount.toFixed(1)}m to target depth of ${target.toFixed(2)}m b.g.l.`;
  if (pipeStock === '6m_only') {
    summary += ' Sized exclusively with 6m header pipes.';
  } else {
    summary += ' Modular assembly using standard 6m and 3m header pipes.';
  }

  return {
    status: 'REQUIRED',
    warningMessage,
    optimizationNote: optNote,
    targetDepth: target,
    effectiveWaterLevel,
    drawdownAmount,
    offsetL,
    offsetW,
    designOffset,
    recommendedOffset,
    effL,
    effW,
    layoutType,
    pipeStock,
    activeRunCount: runs.length,
    runs,
    loopPerimeter,
    filters,
    pumps,
    headers6m,
    headers3m,
    baseHeaderLength,
    finalHeaderLength,
    elbows90,
    tees,
    endCaps,
    swingJoints,
    couplings,
    suctionHoses,
    dischargeHoseMeters,
    autoSummary: summary,
  };
}

function createErrorResult(
  message: string,
  inputs: DewateringInput
): DewateringCalculationResult {
  const target = inputs.excavationDepth + (inputs.requiredDrawdown || 0.5);
  const offsetL = (inputs.landLength - inputs.excavationLength) / 2;
  const offsetW = (inputs.landWidth - inputs.excavationWidth) / 2;

  return {
    status: 'ERROR',
    errorMessage: message,
    targetDepth: target,
    effectiveWaterLevel: inputs.waterTableDepth,
    drawdownAmount: 0,
    offsetL: Math.max(0, offsetL),
    offsetW: Math.max(0, offsetW),
    designOffset: 0,
    recommendedOffset: 1.0,
    effL: inputs.excavationLength,
    effW: inputs.excavationWidth,
    layoutType: inputs.layoutType || 'ring',
    pipeStock: inputs.pipeStock || 'all',
    activeRunCount: 0,
    runs: [],
    loopPerimeter: 0,
    filters: 0,
    pumps: 0,
    headers6m: 0,
    headers3m: 0,
    baseHeaderLength: 0,
    finalHeaderLength: 0,
    elbows90: 0,
    tees: 0,
    endCaps: 0,
    swingJoints: 0,
    couplings: 0,
    suctionHoses: 0,
    dischargeHoseMeters: 0,
    autoSummary: `Calculation Error: ${message}`,
  };
}
