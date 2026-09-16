/**
 * Wellpoint Dewatering Sizing Calculation Engine
 * 
 * Implements civil engineering sizing logic for perimeter wellpoint installations,
 * header pipe breakdowns (6m / 3m sections), vacuum pumps, fittings, and site boundary clearance checks.
 */

export interface DewateringInput {
  landLength: number; // m
  landWidth: number; // m
  excavationLength: number; // m
  excavationWidth: number; // m
  excavationDepth: number; // m
  waterTableDepth: number; // m b.g.l. (below ground level)
  requiredDrawdown: number; // m below pit base
  ingressRequired: boolean;
  ingressWidth: number; // m (min 6.0m when ingressRequired is true)
}

export interface DewateringCalculationResult {
  status: 'REQUIRED' | 'NOT_REQUIRED' | 'ERROR';
  errorMessage?: string;
  warningMessage?: string;
  targetDepth: number; // m (D + 0.5)
  effectiveWaterLevel: number; // m (WT - Rd)
  offsetL: number; // (LL - L) / 2
  offsetW: number; // (LW - W) / 2
  designOffset: number; // min(1.0, offsetL, offsetW)
  effL: number; // L + 2 * designOffset
  effW: number; // W + 2 * designOffset
  loopPerimeter: number; // P = 2 * (effL + effW)
  filters: number; // ceil(P / 1.0)
  pumps: number; // max(1, ceil(P / 60))
  baseHeaderLength: number; // P + pumps * 2.0
  finalHeaderLength: number; // ceil(baseHeaderLength * 1.10)
  headers6m: number;
  headers3m: number;
  elbows90: number; // 3 if ingress else 4
  tees: number; // 1 suction tee per pump to tie into ring-main
  endCaps: number; // 2 end blanking caps for ingress break ends
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
};

export const DEFAULT_DEWATERING_INPUT: DewateringInput = {
  landLength: 30,
  landWidth: 24,
  excavationLength: 20,
  excavationWidth: 14,
  excavationDepth: 3.5,
  waterTableDepth: 1.2,
  requiredDrawdown: 0.5,
  ingressRequired: false,
  ingressWidth: 6.0,
};

export const PRESET_SCENARIOS: {
  id: string;
  name: string;
  description: string;
  inputs: DewateringInput;
}[] = [
  {
    id: 'standard-basement',
    name: 'Standard Basement Pit',
    description: 'Medium residential basement with 1.0m recommended setback on all sides.',
    inputs: {
      landLength: 35,
      landWidth: 25,
      excavationLength: 22,
      excavationWidth: 14,
      excavationDepth: 3.8,
      waterTableDepth: 1.5,
      requiredDrawdown: 0.5,
      ingressRequired: false,
      ingressWidth: 6.0,
    },
  },
  {
    id: 'deep-commercial-ingress',
    name: 'Deep Pit with Ramp Ingress',
    description: 'Commercial excavation requiring open vehicle access ramp (min 6.0m break).',
    inputs: {
      landLength: 50,
      landWidth: 40,
      excavationLength: 32,
      excavationWidth: 24,
      excavationDepth: 5.5,
      waterTableDepth: 2.0,
      requiredDrawdown: 0.5,
      ingressRequired: true,
      ingressWidth: 8.0,
    },
  },
  {
    id: 'tight-urban-setback',
    name: 'Tight Urban Boundary (<1m Setback)',
    description: 'Constrained city site with narrow 0.6m boundary clearance requiring spade-end wellpoints.',
    inputs: {
      landLength: 17.2,
      landWidth: 13.2,
      excavationLength: 16.0,
      excavationWidth: 12.0,
      excavationDepth: 4.0,
      waterTableDepth: 1.8,
      requiredDrawdown: 0.5,
      ingressRequired: false,
      ingressWidth: 6.0,
    },
  },
  {
    id: 'deep-water-table-check',
    name: 'Naturally Low Water Table (Dry Pit)',
    description: 'Water table naturally sits below excavation drawdown target (Dewatering Not Required).',
    inputs: {
      landLength: 40,
      landWidth: 30,
      excavationLength: 20,
      excavationWidth: 15,
      excavationDepth: 3.0,
      waterTableDepth: 4.8,
      requiredDrawdown: 0.5,
      ingressRequired: false,
      ingressWidth: 6.0,
    },
  },
];

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
  } = inputs;

  // If essential dimensions are not entered or cleared to zero, return null (waiting for input)
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

  // Step 1: Dewatering check
  const target = D + 0.5;
  const effectiveWaterLevel = WT - Rd;

  if (effectiveWaterLevel >= target) {
    const summary = `Dewatering not required. The static water table (${WT.toFixed(2)}m b.g.l.) minus required drawdown (${Rd.toFixed(2)}m) is naturally at or below the target dry depth (${target.toFixed(2)}m b.g.l.). No perimeter pumping installation necessary.`;
    return {
      status: 'NOT_REQUIRED',
      targetDepth: target,
      effectiveWaterLevel,
      offsetL: (LL - L) / 2,
      offsetW: (LW - W) / 2,
      designOffset: Math.min(1.0, (LL - L) / 2, (LW - W) / 2),
      effL: L,
      effW: W,
      loopPerimeter: 0,
      filters: 0,
      pumps: 0,
      baseHeaderLength: 0,
      finalHeaderLength: 0,
      headers6m: 0,
      headers3m: 0,
      elbows90: 0,
      tees: 0,
      endCaps: 0,
      autoSummary: summary,
    };
  }

  // Step 2: Offset
  const offsetL = (LL - L) / 2;
  const offsetW = (LW - W) / 2;
  const designOffset = Math.min(1.0, offsetL, offsetW);

  if (designOffset < 0.1) {
    return createErrorResult(
      `Excavation nearly touches boundary. Only ${designOffset.toFixed(2)}m space available. No space for wellpoints (minimum 0.10m required).`,
      inputs,
      designOffset
    );
  }

  let warningMessage: string | undefined;
  if (designOffset < 1.0) {
    warningMessage = `Only ${designOffset.toFixed(2)}m setback available (recommended is 1.00m). Use spade-end wellpoints or seek boundary access permission.`;
  }

  // Step 3: Effective perimeter
  const effL = L + 2 * designOffset;
  const effW = W + 2 * designOffset;
  const P = 2 * (effL + effW);

  // Step 4: Filters
  const filters = Math.ceil(P / 1.0);

  // Step 5: Pumps (100 m³/hr, max 60m header)
  const pumps = Math.max(1, Math.ceil(P / 60));

  // Step 6: Header length (includes 2.0m connection spool per pump + 10% safety buffer)
  const baseHeader = P + pumps * 2.0;
  const finalHeader = Math.ceil(baseHeader * 1.10);

  // Step 7: Header breakdown into 6m and 3m standard modular pipes
  const full6m = Math.floor(finalHeader / 6);
  const remainder = finalHeader - full6m * 6;
  let headers6m = full6m;
  let headers3m = 0;

  if (remainder === 0) {
    headers6m = full6m;
    headers3m = 0;
  } else if (remainder <= 3) {
    headers6m = full6m;
    headers3m = 1;
  } else {
    headers6m = full6m + 1;
    headers3m = 0;
  }

  // Step 8: Elbows (3 if open perimeter with ingress, 4 for standard 4-corner closed ring)
  const elbows90 = ingress ? 3 : 4;

  // Step 9: Tees (1 suction tie-in tee per vacuum pump connected into the header line)
  const tees = pumps;

  // Step 10: End blanking caps (2 caps to seal the open ends of the ring-main when ingress ramp is cut)
  const endCaps = ingress ? 2 : 0;

  // Auto-Summary Generation
  let summary = `Ring-main shall be installed at ${designOffset.toFixed(2)}m offset from pit edge.`;
  if (designOffset < 1.0) {
    summary += ' Verify clearance with site surveyor.';
  }
  summary += ' Pumps shall maintain a continuous ring-main; confirm ingress break points prior to installation.';

  return {
    status: 'REQUIRED',
    warningMessage,
    targetDepth: target,
    effectiveWaterLevel,
    offsetL,
    offsetW,
    designOffset,
    effL,
    effW,
    loopPerimeter: P,
    filters,
    pumps,
    baseHeaderLength: baseHeader,
    finalHeaderLength: finalHeader,
    headers6m,
    headers3m,
    elbows90,
    tees,
    endCaps,
    autoSummary: summary,
  };
}

function createErrorResult(
  message: string,
  inputs: DewateringInput,
  designOffset = 0
): DewateringCalculationResult {
  const target = inputs.excavationDepth + 0.5;
  const offsetL = (inputs.landLength - inputs.excavationLength) / 2;
  const offsetW = (inputs.landWidth - inputs.excavationWidth) / 2;

  return {
    status: 'ERROR',
    errorMessage: message,
    targetDepth: target,
    effectiveWaterLevel: inputs.waterTableDepth - inputs.requiredDrawdown,
    offsetL: Math.max(0, offsetL),
    offsetW: Math.max(0, offsetW),
    designOffset,
    effL: inputs.excavationLength,
    effW: inputs.excavationWidth,
    loopPerimeter: 0,
    filters: 0,
    pumps: 0,
    baseHeaderLength: 0,
    finalHeaderLength: 0,
    headers6m: 0,
    headers3m: 0,
    elbows90: 0,
    tees: 0,
    endCaps: 0,
    autoSummary: `Calculation Error: ${message}`,
  };
}
